#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const tar = require("tar");
const {
  createCandidateBinding,
  inspectCandidateDirectory,
  verifyBundleArchiveContent
} = require("./windows-release-candidate-fingerprint.cjs");
const {
  assembleLiveProofReceipt,
  PROFILE_CONTRACTS,
  readAndValidateLiveProofReceipt
} = require("./windows-live-proof-receipt.cjs");

const MAX_BUNDLE_ARCHIVE_BYTES = 4 * 1024 * 1024 * 1024;

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    selfTest();
    console.log("Release-candidate publish verifier self-test passed.");
  } else {
    main();
  }
}

function main() {
  const tarballArg = readArg("--tarball");
  const auditArg = readArg("--audit-manifest");
  if (!tarballArg || !auditArg) {
    throw new Error(
      "Usage: node scripts/publish-release-candidate.cjs --tarball <steam-bridge.tgz> " +
        "[--bundle-archive <steam-bridge-win-unpacked.tar>] " +
        "--audit-manifest <steam-bridge-windows-package-audit.json> " +
        "[--live-proof-receipt <windows-live-proof-receipt.json>] " +
        "[--previous-tarball <steam-bridge-previous.tgz> " +
        "--previous-live-proof-receipt <windows-live-proof-receipt.json> " +
        "--previous-release-tag <vX.Y.Z>] " +
        "[--require-publishable|--publish --release-tag <vX.Y.Z>] [--tag <npm-tag>]"
    );
  }
  const tarball = path.resolve(tarballArg);
  const auditManifest = path.resolve(auditArg);
  const publishRequested = process.argv.includes("--publish");
  const requirePublishable = publishRequested || process.argv.includes("--require-publishable");
  const bundleArchiveArg = readArg("--bundle-archive");
  const npmTag = readArg("--tag");
  const liveProofReceiptArg = readArg("--live-proof-receipt");
  const previousTarballArg = readArg("--previous-tarball");
  const previousLiveProofReceiptArg = readArg("--previous-live-proof-receipt");
  const previousReleaseTag = readArg("--previous-release-tag");
  const verified = verifyReleaseCandidate(tarball, auditManifest, {
    requirePublishable,
    releaseTag: readArg("--release-tag") || process.env.GITHUB_REF_NAME || "",
    bundleArchive: bundleArchiveArg ? path.resolve(bundleArchiveArg) : undefined
  });
  console.log(`Verified canonical npm release candidate ${path.basename(tarball)} sha256=${verified.sha256}`);

  const liveProofReceipt = validateLiveProofForPublish(
    publishRequested,
    liveProofReceiptArg,
    verified.candidateBinding,
    {
      candidateTarball: tarball,
      previousTarball: previousTarballArg ? path.resolve(previousTarballArg) : undefined,
      previousLiveProofReceipt: previousLiveProofReceiptArg
        ? path.resolve(previousLiveProofReceiptArg)
        : undefined,
      previousReleaseTag
    }
  );
  if (liveProofReceipt) {
    const prefix = liveProofReceipt.documentationOnlySuccessor
      ? "Verified documentation-only successor against prior Windows live proof"
      : "Verified matching Windows live-proof receipt";
    console.log(`${prefix} sha256=${liveProofReceipt.receiptSha256}`);
  }

  if (!publishRequested) {
    console.log("Verification-only mode; pass --publish to publish this exact tarball without repacking the workspace.");
    return;
  }
  validatePublishTag(verified.packageVersion, npmTag);
  const publishCopy = createVerifiedPublishCopy(tarball, verified);
  try {
    const args = ["publish", publishCopy.tarball];
    if (npmTag) {
      args.push("--tag", npmTag);
    }
    const invocation = resolveNpmInvocation(args);
    const result = spawnSync(invocation.command, invocation.args, {
      cwd: publishCopy.directory,
      stdio: "inherit",
      shell: false,
      windowsHide: true
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`npm publish of the verified tarball failed with status ${result.status ?? "unknown"}.`);
    }
  } finally {
    fs.rmSync(publishCopy.directory, { recursive: true, force: true });
  }
}

function validateLiveProofForPublish(publishRequested, receiptArg, candidateBinding, options = {}) {
  const hasPriorTarball = Boolean(options.previousTarball);
  const hasPriorReceipt = Boolean(options.previousLiveProofReceipt);
  const hasPriorReleaseTag = Boolean(options.previousReleaseTag);
  assert.ok(
    (hasPriorTarball && hasPriorReceipt && hasPriorReleaseTag) ||
      (!hasPriorTarball && !hasPriorReceipt && !hasPriorReleaseTag),
    "documentation-only publication requires the previous tarball, its live-proof receipt, and its release tag"
  );
  assert.ok(
    !(receiptArg && hasPriorTarball),
    "provide either an exact live-proof receipt or documentation-only predecessor proof, not both"
  );
  let receipt = receiptArg
    ? readAndValidateLiveProofReceipt(path.resolve(receiptArg), candidateBinding)
    : null;
  if (hasPriorTarball) {
    receipt = verifyDocumentationOnlySuccessor(
      options.previousTarball,
      options.candidateTarball,
      options.previousLiveProofReceipt,
      options.previousReleaseTag,
      candidateBinding
    );
  }
  if (publishRequested) {
    assert.ok(
      receipt,
      "npm publication requires a matching Windows live-proof receipt or verified documentation-only predecessor proof"
    );
  }
  return receipt;
}

function verifyDocumentationOnlySuccessor(
  previousTarball,
  candidateTarball,
  previousLiveProofReceipt,
  previousReleaseTag,
  candidateBinding
) {
  assertNonEmptyFile(previousTarball, "previous npm tarball");
  assertNonEmptyFile(candidateTarball, "candidate npm tarball");
  const receipt = readAndValidateLiveProofReceipt(previousLiveProofReceipt);
  assert.match(previousReleaseTag || "", /^v\d+\.\d+\.\d+$/, "previous release tag is invalid");
  assert.equal(
    receipt.candidate.release.gitRefName,
    previousReleaseTag,
    "previous live-proof receipt does not belong to the requested release tag"
  );
  const previousHash = hashStableRegularFile(previousTarball, "previous npm tarball");
  assert.equal(
    previousHash.sha256,
    receipt.candidate.package.tarballSha256,
    "previous npm tarball does not match the retained live-proof receipt"
  );

  const previous = inspectNpmPackageTarball(previousTarball, "previous npm tarball");
  const candidate = inspectNpmPackageTarball(candidateTarball, "candidate npm tarball");
  assert.equal(previous.packageJson.name, "steam-bridge");
  assert.equal(candidate.packageJson.name, "steam-bridge");
  assert.equal(previous.packageJson.version, receipt.candidate.package.version);
  assert.equal(candidate.packageJson.version, candidateBinding.package.version);
  assert.equal(hashStableRegularFile(candidateTarball, "candidate npm tarball").sha256, candidateBinding.package.tarballSha256);
  assertStablePatchSuccessor(previous.packageJson.version, candidate.packageJson.version);

  const previousPackageJson = { ...previous.packageJson };
  const candidatePackageJson = { ...candidate.packageJson };
  delete previousPackageJson.version;
  delete candidatePackageJson.version;
  assert.deepEqual(
    candidatePackageJson,
    previousPackageJson,
    "documentation-only successor changed package metadata beyond its version"
  );
  assert.notEqual(
    candidate.files.get("README.md").sha256,
    previous.files.get("README.md").sha256,
    "documentation-only successor must change README.md"
  );

  const previousPaths = [...previous.files.keys()].sort();
  const candidatePaths = [...candidate.files.keys()].sort();
  assert.deepEqual(candidatePaths, previousPaths, "documentation-only successor changed the published file inventory");
  for (const relativePath of previousPaths) {
    if (relativePath === "README.md" || relativePath === "package.json") {
      continue;
    }
    assert.deepEqual(
      candidate.files.get(relativePath),
      previous.files.get(relativePath),
      `documentation-only successor changed published runtime file ${relativePath}`
    );
  }
  assert.equal(candidateBinding.electronVersion, receipt.candidate.electronVersion);
  assert.deepEqual(candidateBinding.nativeBinding, receipt.candidate.nativeBinding);

  return {
    ...receipt,
    documentationOnlySuccessor: {
      previousVersion: previous.packageJson.version,
      candidateVersion: candidate.packageJson.version,
      unchangedRuntimeFileCount: previousPaths.length - 2
    }
  };
}

function inspectNpmPackageTarball(tarballPath, label) {
  const bytes = readStableRegularFile(tarballPath, label, 128 * 1024 * 1024);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-npm-tarball-inspect-"));
  const snapshot = path.join(tempRoot, "package.tgz");
  const extractRoot = path.join(tempRoot, "extract");
  try {
    fs.writeFileSync(snapshot, bytes, { flag: "wx", mode: 0o400 });
    fs.mkdirSync(extractRoot);
    const seen = new Set();
    let totalSize = 0;
    tar.list({
      file: snapshot,
      sync: true,
      strict: true,
      onReadEntry(entry) {
        const entryPath = String(entry.path || "");
        assert.equal(entry.type, "File", `${label} contains unsupported entry type ${entry.type}`);
        assert.ok(entryPath.startsWith("package/"), `${label} contains a file outside package/`);
        assert.equal(path.posix.normalize(entryPath), entryPath, `${label} contains a non-canonical path`);
        assert.ok(!entryPath.includes("\\") && !entryPath.includes("\0"), `${label} contains an unsafe path`);
        const portablePath = entryPath.normalize("NFC").toLowerCase();
        assert.ok(!seen.has(portablePath), `${label} contains a duplicate portable path`);
        seen.add(portablePath);
        assert.ok(Number.isSafeInteger(entry.size) && entry.size >= 0, `${label} contains an invalid file size`);
        totalSize += entry.size;
        assert.ok(totalSize <= 128 * 1024 * 1024, `${label} expands beyond the supported size`);
      }
    });
    tar.extract({
      cwd: extractRoot,
      file: snapshot,
      sync: true,
      strict: true,
      preservePaths: false,
      unlink: true
    });
    assert.deepEqual(fs.readdirSync(extractRoot), ["package"], `${label} must contain exactly one package root`);
    const packageRoot = path.join(extractRoot, "package");
    const files = inspectRegularFiles(packageRoot);
    assert.ok(files.has("README.md"), `${label} is missing README.md`);
    assert.ok(files.has("package.json"), `${label} is missing package.json`);
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
    return { files, packageJson };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function inspectRegularFiles(root) {
  const files = new Map();
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      assert.ok(entry.isFile() && !entry.isSymbolicLink(), `npm package contains unsupported entry ${absolute}`);
      const relativePath = path.relative(root, absolute).split(path.sep).join("/");
      const stats = fs.statSync(absolute);
      const bytes = fs.readFileSync(absolute);
      files.set(relativePath, {
        size: bytes.length,
        mode: stats.mode & 0o777,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex")
      });
    }
  };
  visit(root);
  return files;
}

function assertStablePatchSuccessor(previousVersion, candidateVersion) {
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const previousMatch = pattern.exec(previousVersion || "");
  const candidateMatch = pattern.exec(candidateVersion || "");
  assert.ok(previousMatch && candidateMatch, "documentation-only publication requires stable semantic versions");
  const previous = previousMatch.slice(1).map(Number);
  const candidate = candidateMatch.slice(1).map(Number);
  assert.deepEqual(candidate.slice(0, 2), previous.slice(0, 2), "documentation-only publication must stay in the same major/minor line");
  assert.equal(candidate[2], previous[2] + 1, "documentation-only publication must be the next patch version");
}

function createVerifiedPublishCopy(tarball, expected) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-npm-publish-"));
  fs.chmodSync(directory, 0o700);
  const destination = path.join(directory, path.basename(tarball));
  try {
    const bytes = readStableRegularFile(tarball, "release tarball");
    const actual = hashBuffer(bytes);
    for (const field of ["size", "sha1", "sha256", "sha512", "integrity"]) {
      assert.equal(actual[field], expected[field], `publish copy ${field} differs from the verified candidate`);
    }
    const descriptor = fs.openSync(destination, "wx", 0o400);
    try {
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    assert.deepEqual(hashBuffer(fs.readFileSync(destination)), actual);
    return { directory, tarball: destination };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function createStableSnapshot(source, label, expectedSize) {
  assert.ok(
    Number.isSafeInteger(expectedSize) && expectedSize > 0 && expectedSize <= MAX_BUNDLE_ARCHIVE_BYTES,
    `${label} audited size is invalid`
  );
  const initial = fs.lstatSync(source, { bigint: true });
  assert.ok(initial.isFile() && !initial.isSymbolicLink(), `${label} must be a regular file`);
  assert.equal(initial.nlink, 1n, `${label} must not be hard linked`);
  assert.equal(initial.size, BigInt(expectedSize), `${label} size differs from the package audit`);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-candidate-snapshot-"));
  fs.chmodSync(directory, 0o700);
  const file = path.join(directory, path.basename(source));
  let sourceDescriptor;
  let destinationDescriptor;
  try {
    sourceDescriptor = fs.openSync(source, "r");
    destinationDescriptor = fs.openSync(file, "wx", 0o400);
    const before = fs.fstatSync(sourceDescriptor, { bigint: true });
    assertStableFileStats(initial, before, label);
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let total = 0n;
    for (;;) {
      const count = fs.readSync(sourceDescriptor, buffer, 0, buffer.length, null);
      if (count === 0) {
        break;
      }
      let offset = 0;
      while (offset < count) {
        offset += fs.writeSync(destinationDescriptor, buffer, offset, count - offset);
      }
      total += BigInt(count);
      assert.ok(total <= BigInt(expectedSize), `${label} exceeds its audited size while being copied`);
    }
    fs.fsyncSync(destinationDescriptor);
    const after = fs.fstatSync(sourceDescriptor, { bigint: true });
    const finalPathStats = fs.lstatSync(source, { bigint: true });
    assertStableFileStats(before, after, label);
    assertStableFileStats(after, finalPathStats, label);
    assert.equal(total, BigInt(expectedSize), `${label} changed size while being copied`);
    const destinationStats = fs.fstatSync(destinationDescriptor, { bigint: true });
    assert.equal(destinationStats.size, total, `${label} snapshot has the wrong size`);
    fs.closeSync(destinationDescriptor);
    destinationDescriptor = undefined;
    fs.closeSync(sourceDescriptor);
    sourceDescriptor = undefined;
    return { directory, file };
  } catch (error) {
    if (destinationDescriptor !== undefined) {
      fs.closeSync(destinationDescriptor);
      destinationDescriptor = undefined;
    }
    if (sourceDescriptor !== undefined) {
      fs.closeSync(sourceDescriptor);
      sourceDescriptor = undefined;
    }
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  } finally {
    if (destinationDescriptor !== undefined) {
      fs.closeSync(destinationDescriptor);
    }
    if (sourceDescriptor !== undefined) {
      fs.closeSync(sourceDescriptor);
    }
  }
}

function resolveNpmInvocation(args, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== "win32") {
    return { command: "npm", args };
  }
  const npmExecPath = options.npmExecPath || process.env.npm_execpath;
  assertNonEmptyFile(npmExecPath, "npm JavaScript CLI from npm_execpath");
  return {
    command: options.nodeExecPath || process.execPath,
    args: [npmExecPath, ...args]
  };
}

function verifyReleaseCandidate(tarball, auditManifest, options = {}) {
  assertNonEmptyFile(tarball, "release tarball");
  assertNonEmptyFile(auditManifest, "package audit manifest");
  const audit = readJsonFile(auditManifest, "package audit manifest");
  assert.equal(audit.schemaVersion, 2, "unsupported package audit schema");
  assert.equal(audit.executableProbe?.ok, true, "package audit is missing a successful final executable probe");
  const nativeBinding = audit.package?.nativeBinding;
  assert.equal(nativeBinding?.schemaVersion, 1, "package audit is missing native binding schema 1");
  assert.equal(nativeBinding?.interfaceName, "NativeBinding", "package audit has the wrong native binding interface");
  assert.ok(
    Number.isInteger(nativeBinding?.methodCount) && nativeBinding.methodCount > 0,
    "package audit is missing a positive native binding method count"
  );
  assert.match(
    nativeBinding?.methodsSha256 || "",
    /^[a-f0-9]{64}$/,
    "package audit is missing the native binding method hash"
  );
  assert.equal(
    audit.executableProbe?.nativeBindingProbe?.ok,
    true,
    "package audit is missing a successful native binding probe"
  );
  assert.equal(
    audit.executableProbe.nativeBindingProbe.expectedMethodCount,
    nativeBinding.methodCount,
    "native binding probe expected count differs from the package contract"
  );
  assert.equal(
    audit.executableProbe.nativeBindingProbe.verifiedMethodCount,
    nativeBinding.methodCount,
    "native binding probe verified count differs from the package contract"
  );
  assert.equal(
    audit.executableProbe.nativeBindingProbe.expectedMethodsSha256,
    nativeBinding.methodsSha256,
    "native binding probe expected hash differs from the package contract"
  );
  assert.equal(
    audit.executableProbe.nativeBindingProbe.verifiedMethodsSha256,
    nativeBinding.methodsSha256,
    "native binding probe verified hash differs from the package contract"
  );
  assert.equal(
    audit.executableProbe.nativeBindingProbe.missingMethodCount,
    0,
    "native binding probe reports missing methods"
  );
  assert.equal(
    audit.executableProbe.nativeBindingProbe.nonFunctionMethodCount,
    0,
    "native binding probe reports non-function methods"
  );
  assert.equal(audit.checkoutValidatorProbe?.ok, true, "package audit is missing a successful checkout-validator probe");
  const candidateBinding = createCandidateBinding(audit);
  const expected = audit.package?.tarball;
  assert.ok(expected, "package audit is missing tarball identity");
  assert.equal(expected.fileName, path.basename(tarball), "tarball filename differs from the audited candidate");

  const actual = hashBuffer(readStableRegularFile(tarball, "release tarball"));
  for (const field of Object.keys(actual)) {
    assert.equal(actual[field], expected[field], `tarball ${field} differs from the audited candidate`);
  }
  const bundleArchive = options.bundleArchive;
  if (bundleArchive) {
    const expectedArchive = audit.finalBundle?.archive;
    assert.ok(expectedArchive, "package audit is missing the retained Windows bundle archive identity");
    assertNonEmptyFile(bundleArchive, "retained Windows bundle archive");
    assert.equal(
      path.basename(bundleArchive),
      expectedArchive.fileName,
      "Windows bundle archive filename differs from the audited candidate"
    );
    assert.ok(
      Number.isSafeInteger(expectedArchive.size) &&
        expectedArchive.size > 0 &&
        expectedArchive.size <= MAX_BUNDLE_ARCHIVE_BYTES,
      "Windows bundle archive audit has an invalid size"
    );
    const archiveSnapshot = createStableSnapshot(
      bundleArchive,
      "retained Windows bundle archive",
      expectedArchive.size
    );
    try {
      const actualArchive = hashStableRegularFile(
        archiveSnapshot.file,
        "private retained Windows bundle archive snapshot"
      );
      for (const field of Object.keys(actualArchive)) {
        assert.equal(
          actualArchive[field],
          expectedArchive[field],
          `Windows bundle archive ${field} differs from the audited candidate`
        );
      }
      verifyBundleArchiveContent(
        archiveSnapshot.file,
        audit.finalBundle.contentFingerprint,
        expectedArchive.rootDirectory
      );
      actual.bundleArchiveSha256 = actualArchive.sha256;
    } finally {
      fs.rmSync(archiveSnapshot.directory, { recursive: true, force: true });
    }
  }
  if (options.requirePublishable) {
    assert.ok(bundleArchive, "publishing requires the retained, audited Windows bundle archive");
    assert.equal(
      audit.liveSmokeCapability?.protocolPackaged,
      true,
      "publishing requires the retained Windows bundle to contain the live smoke protocol"
    );
    assert.equal(typeof audit.signing?.required, "boolean", "publishing requires explicit signing policy evidence");
    for (const fileName of ["steam_api64.dll", "sdkencryptedappticket64.dll"]) {
      assert.equal(
        audit.finalBundle?.authenticode?.[fileName]?.status,
        "Valid",
        `publishing requires valid upstream Authenticode evidence for ${fileName}`
      );
    }
    for (const fileName of ["steam_api64.dll", "sdkencryptedappticket64.dll"]) {
      const preservation = audit.finalBundle?.runtimeDllPreservation?.[fileName];
      assert.equal(preservation?.preserved, true, `publishing requires exact source-byte preservation for ${fileName}`);
      assert.equal(
        preservation?.finalSha256,
        preservation?.sourceSha256,
        `publishing requires matching source and final hashes for ${fileName}`
      );
    }
    if (audit.signing.required) {
      assert.equal(
        audit.signing.expectedPublisherSubjectConfigured === true ||
          audit.signing.expectedPublisherThumbprintConfigured === true,
        true,
        "signed publishing requires an exact expected publisher policy in the package audit"
      );
      for (const fileName of ["appExecutable", "steam_bridge_native.win32-x64-msvc.node"]) {
        assert.equal(
          audit.finalBundle?.authenticode?.[fileName]?.status,
          "Valid",
          `signed publishing requires valid Authenticode evidence for ${fileName}`
        );
      }
      assert.equal(
        audit.signing.publisherMatches?.appExecutable,
        true,
        "signed publishing requires the Electron executable to match the expected publisher"
      );
      assert.equal(
        audit.signing.publisherMatches?.nativeAddon,
        true,
        "signed publishing requires the native addon to match the expected publisher"
      );
    } else {
      assert.equal(audit.signing.expectedPublisherSubjectConfigured, false);
      assert.equal(audit.signing.expectedPublisherThumbprintConfigured, false);
      assert.equal(audit.signing.publisherMatches?.appExecutable, false);
      assert.equal(audit.signing.publisherMatches?.nativeAddon, false);
      for (const fileName of ["appExecutable", "steam_bridge_native.win32-x64-msvc.node"]) {
        assert.equal(
          audit.finalBundle?.authenticode?.[fileName]?.status,
          "NotSigned",
          `unsigned publishing requires ${fileName} to have no partial or invalid Authenticode signature`
        );
      }
    }
    assert.ok(audit.release?.gitCommit, "publishing requires a source Git commit in the package audit");
    const releaseTag = options.releaseTag || audit.release?.gitRefName || "";
    assert.equal(releaseTag, `v${audit.package?.version}`, "release tag must exactly match the audited package version");
    assert.equal(
      audit.release?.gitRefName,
      releaseTag,
      "release tag must match the Git ref recorded by the signed package gate"
    );
  }
  actual.packageVersion = audit.package?.version;
  actual.candidateBinding = candidateBinding;
  return actual;
}

function validatePublishTag(packageVersion, tag) {
  if (tag !== undefined) {
    assert.match(tag, /^[a-z0-9][a-z0-9._-]{0,127}$/i, "npm dist-tag contains unsupported characters");
    assert.doesNotMatch(tag, /^v?\d+(?:\.\d+){0,2}(?:[-+].*)?$/i, "npm dist-tag must not be a version");
  }
  if (String(packageVersion || "").includes("-") && (!tag || tag.toLowerCase() === "latest")) {
    throw new Error("Publishing a prerelease package requires an explicit non-latest npm dist-tag.");
  }
}

function selfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-release-candidate-self-test-"));
  try {
    const tarball = path.join(tempRoot, "steam-bridge-0.1.0.tgz");
    const bundleArchive = path.join(tempRoot, "steam-bridge-0.1.0-windows-x64-win-unpacked.tar");
    const audit = path.join(tempRoot, "audit.json");
    const bytes = Buffer.from("canonical publish bytes");
    fs.writeFileSync(tarball, bytes);
    const bundleDir = path.join(tempRoot, "win-unpacked-source");
    fs.mkdirSync(path.join(bundleDir, "resources"), { recursive: true });
    fs.writeFileSync(path.join(bundleDir, "SteamBridgeSmoke.exe"), "signed app");
    fs.writeFileSync(path.join(bundleDir, "resources", "app.asar"), "asar bytes");
    const bundleInspection = inspectCandidateDirectory(bundleDir);
    tar.create(
      { cwd: bundleDir, file: bundleArchive, sync: true, portable: true, noMtime: true, prefix: "win-unpacked" },
      bundleInspection.files.map((entry) => entry.relativePath)
    );
    const bundleBytes = fs.readFileSync(bundleArchive);
    assert.throws(
      () => createStableSnapshot(bundleArchive, "retained Windows bundle archive", bundleBytes.length + 1),
      /size differs from the package audit/
    );
    assert.throws(
      () => createStableSnapshot(bundleArchive, "retained Windows bundle archive", MAX_BUNDLE_ARCHIVE_BYTES + 1),
      /audited size is invalid/
    );
    const fakeNpmCli = path.join(tempRoot, "npm-cli.js");
    fs.writeFileSync(fakeNpmCli, "// test npm CLI\n");
    assert.deepEqual(
      resolveNpmInvocation(["publish", tarball], {
        platform: "win32",
        npmExecPath: fakeNpmCli,
        nodeExecPath: "node.exe"
      }),
      { command: "node.exe", args: [fakeNpmCli, "publish", tarball] }
    );
    const expected = {
      fileName: path.basename(tarball),
      size: bytes.length,
      sha1: crypto.createHash("sha1").update(bytes).digest("hex"),
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      sha512: crypto.createHash("sha512").update(bytes).digest("hex"),
      integrity: `sha512-${crypto.createHash("sha512").update(bytes).digest("base64")}`
    };
    fs.writeFileSync(
      audit,
      `${JSON.stringify({
        schemaVersion: 2,
        target: "x86_64-pc-windows-msvc",
        package: {
          name: "steam-bridge",
          version: "0.1.0",
          nativeBinding: {
            schemaVersion: 1,
            interfaceName: "NativeBinding",
            methodCount: 1121,
            methodsSha256: "f77039e3a26e3a6fcb68bcc695d1cb7393cd5712a901ce57c0425f539fa272ad"
          },
          tarball: expected
        },
        executableProbe: {
          ok: true,
          nativeBindingProbe: {
            ok: true,
            expectedMethodCount: 1121,
            verifiedMethodCount: 1121,
            expectedMethodsSha256: "f77039e3a26e3a6fcb68bcc695d1cb7393cd5712a901ce57c0425f539fa272ad",
            verifiedMethodsSha256: "f77039e3a26e3a6fcb68bcc695d1cb7393cd5712a901ce57c0425f539fa272ad",
            missingMethodCount: 0,
            nonFunctionMethodCount: 0
          }
        },
        checkoutValidatorProbe: { ok: true },
        liveSmokeCapability: { protocolPackaged: true },
        electronBuilder: { electronVersion: "43.1.0" },
        signing: {
          required: true,
          expectedPublisherSubjectConfigured: false,
          expectedPublisherThumbprintConfigured: true,
          publisherMatches: { appExecutable: true, nativeAddon: true }
        },
        finalBundle: {
          contentFingerprint: bundleInspection.fingerprint,
          archive: {
            fileName: path.basename(bundleArchive),
            rootDirectory: "win-unpacked",
            fileCount: bundleInspection.fingerprint.fileCount,
            size: bundleBytes.length,
            sha1: crypto.createHash("sha1").update(bundleBytes).digest("hex"),
            sha256: crypto.createHash("sha256").update(bundleBytes).digest("hex"),
            sha512: crypto.createHash("sha512").update(bundleBytes).digest("hex"),
            integrity: `sha512-${crypto.createHash("sha512").update(bundleBytes).digest("base64")}`
          },
          runtimeDllPreservation: {
            "steam_api64.dll": {
              preserved: true,
              sourceSha256: "steam-api-hash",
              finalSha256: "steam-api-hash"
            },
            "sdkencryptedappticket64.dll": {
              preserved: true,
              sourceSha256: "encrypted-ticket-hash",
              finalSha256: "encrypted-ticket-hash"
            }
          },
          authenticode: {
            appExecutable: { status: "Valid" },
            "steam_bridge_native.win32-x64-msvc.node": { status: "Valid" },
            "steam_api64.dll": { status: "Valid" },
            "sdkencryptedappticket64.dll": { status: "Valid" }
          }
        },
        release: { gitCommit: "0123456789abcdef0123456789abcdef01234567", gitRefName: "v0.1.0" }
      })}\n`
    );
    assert.equal(verifyReleaseCandidate(tarball, audit).sha256, expected.sha256);
    const publishableCandidate = verifyReleaseCandidate(tarball, audit, {
      requirePublishable: true,
      releaseTag: "v0.1.0",
      bundleArchive
    });
    assert.equal(publishableCandidate.sha256, expected.sha256);
    assert.equal(validateLiveProofForPublish(false, undefined, publishableCandidate.candidateBinding), null);
    assert.throws(
      () => validateLiveProofForPublish(true, undefined, publishableCandidate.candidateBinding),
      /requires a matching Windows live-proof receipt/
    );
    const receiptPath = path.join(tempRoot, "windows-live-proof-receipt.json");
    writeJson(receiptPath, createSelfTestReceipt(publishableCandidate.candidateBinding));
    assert.ok(validateLiveProofForPublish(true, receiptPath, publishableCandidate.candidateBinding));
    const signedAudit = JSON.parse(fs.readFileSync(audit, "utf8"));
    const previousDocsTarball = createDocumentationOnlySelfTestTarball(
      tempRoot,
      "previous-docs-package",
      "1.2.3",
      "previous readme",
      "unchanged runtime"
    );
    const candidateDocsTarball = createDocumentationOnlySelfTestTarball(
      tempRoot,
      "candidate-docs-package",
      "1.2.4",
      "cleaner readme",
      "unchanged runtime"
    );
    const previousDocsAudit = JSON.parse(JSON.stringify(signedAudit));
    previousDocsAudit.package.version = "1.2.3";
    previousDocsAudit.package.tarball = {
      fileName: path.basename(previousDocsTarball),
      ...hashStableRegularFile(previousDocsTarball, "self-test previous documentation tarball")
    };
    previousDocsAudit.release = {
      gitCommit: "1".repeat(40),
      gitRefName: "v1.2.3"
    };
    const previousDocsBinding = createCandidateBinding(previousDocsAudit);
    const previousDocsReceipt = path.join(tempRoot, "previous-docs-live-proof-receipt.json");
    writeJson(previousDocsReceipt, createSelfTestReceipt(previousDocsBinding));
    const candidateDocsAudit = JSON.parse(JSON.stringify(signedAudit));
    candidateDocsAudit.package.version = "1.2.4";
    candidateDocsAudit.package.tarball = {
      fileName: path.basename(candidateDocsTarball),
      ...hashStableRegularFile(candidateDocsTarball, "self-test candidate documentation tarball")
    };
    candidateDocsAudit.release = {
      gitCommit: "2".repeat(40),
      gitRefName: "v1.2.4"
    };
    const candidateDocsBinding = createCandidateBinding(candidateDocsAudit);
    const documentationProof = validateLiveProofForPublish(true, undefined, candidateDocsBinding, {
      candidateTarball: candidateDocsTarball,
      previousTarball: previousDocsTarball,
      previousLiveProofReceipt: previousDocsReceipt,
      previousReleaseTag: "v1.2.3"
    });
    assert.deepEqual(documentationProof.documentationOnlySuccessor, {
      previousVersion: "1.2.3",
      candidateVersion: "1.2.4",
      unchangedRuntimeFileCount: 1
    });
    assert.throws(
      () =>
        validateLiveProofForPublish(true, undefined, candidateDocsBinding, {
          candidateTarball: candidateDocsTarball,
          previousTarball: previousDocsTarball,
          previousLiveProofReceipt: previousDocsReceipt,
          previousReleaseTag: "v1.2.2"
        }),
      /does not belong to the requested release tag/
    );
    assert.throws(
      () =>
        validateLiveProofForPublish(true, receiptPath, candidateDocsBinding, {
          candidateTarball: candidateDocsTarball,
          previousTarball: previousDocsTarball,
          previousLiveProofReceipt: previousDocsReceipt,
          previousReleaseTag: "v1.2.3"
        }),
      /either an exact live-proof receipt or documentation-only predecessor proof/
    );
    assert.throws(
      () =>
        validateLiveProofForPublish(true, undefined, candidateDocsBinding, {
          candidateTarball: candidateDocsTarball,
          previousTarball: previousDocsTarball
        }),
      /requires the previous tarball, its live-proof receipt, and its release tag/
    );
    const changedRuntimeTarball = createDocumentationOnlySelfTestTarball(
      tempRoot,
      "changed-runtime-package",
      "1.2.4",
      "cleaner readme",
      "changed runtime"
    );
    const changedRuntimeAudit = JSON.parse(JSON.stringify(candidateDocsAudit));
    changedRuntimeAudit.package.tarball = {
      fileName: path.basename(changedRuntimeTarball),
      ...hashStableRegularFile(changedRuntimeTarball, "self-test changed-runtime tarball")
    };
    assert.throws(
      () =>
        validateLiveProofForPublish(true, undefined, createCandidateBinding(changedRuntimeAudit), {
          candidateTarball: changedRuntimeTarball,
          previousTarball: previousDocsTarball,
          previousLiveProofReceipt: previousDocsReceipt,
          previousReleaseTag: "v1.2.3"
        }),
      /changed published runtime file index.js/
    );
    const unsignedAudit = JSON.parse(JSON.stringify(signedAudit));
    unsignedAudit.signing = {
      required: false,
      expectedPublisherSubjectConfigured: false,
      expectedPublisherThumbprintConfigured: false,
      publisherMatches: { appExecutable: false, nativeAddon: false }
    };
    unsignedAudit.finalBundle.authenticode.appExecutable.status = "NotSigned";
    unsignedAudit.finalBundle.authenticode["steam_bridge_native.win32-x64-msvc.node"].status = "NotSigned";
    writeJson(audit, unsignedAudit);
    const unsignedCandidate = verifyReleaseCandidate(tarball, audit, {
      requirePublishable: true,
      releaseTag: "v0.1.0",
      bundleArchive
    });
    writeJson(receiptPath, createSelfTestReceipt(unsignedCandidate.candidateBinding));
    assert.ok(validateLiveProofForPublish(true, receiptPath, unsignedCandidate.candidateBinding));
    unsignedAudit.finalBundle.authenticode.appExecutable.status = "HashMismatch";
    writeJson(audit, unsignedAudit);
    assert.throws(
      () =>
        verifyReleaseCandidate(tarball, audit, {
          requirePublishable: true,
          releaseTag: "v0.1.0",
          bundleArchive
        }),
      /no partial or invalid Authenticode signature/
    );
    writeJson(audit, signedAudit);
    const publishCopy = createVerifiedPublishCopy(tarball, publishableCandidate);
    try {
      fs.appendFileSync(tarball, "changed-after-private-copy");
      assert.equal(hashBuffer(fs.readFileSync(publishCopy.tarball)).sha256, expected.sha256);
    } finally {
      fs.rmSync(publishCopy.directory, { recursive: true, force: true });
      fs.writeFileSync(tarball, bytes);
    }
    const validAudit = JSON.parse(fs.readFileSync(audit, "utf8"));
    for (const [mutate, expectedError] of [
      [(value) => (value.package.nativeBinding.schemaVersion = 2), /native binding schema 1/],
      [(value) => (value.package.nativeBinding.interfaceName = "OtherBinding"), /wrong native binding interface/],
      [(value) => (value.package.nativeBinding.methodCount = 0), /positive native binding method count/],
      [(value) => (value.package.nativeBinding.methodsSha256 = "invalid"), /native binding method hash/],
      [(value) => (value.executableProbe.nativeBindingProbe.ok = false), /successful native binding probe/],
      [
        (value) => (value.executableProbe.nativeBindingProbe.expectedMethodCount -= 1),
        /expected count differs/
      ],
      [
        (value) => (value.executableProbe.nativeBindingProbe.verifiedMethodCount -= 1),
        /verified count differs/
      ],
      [
        (value) => (value.executableProbe.nativeBindingProbe.expectedMethodsSha256 = "0".repeat(64)),
        /expected hash differs/
      ],
      [
        (value) => (value.executableProbe.nativeBindingProbe.verifiedMethodsSha256 = "0".repeat(64)),
        /verified hash differs/
      ],
      [(value) => (value.executableProbe.nativeBindingProbe.missingMethodCount = 1), /missing methods/],
      [(value) => (value.executableProbe.nativeBindingProbe.nonFunctionMethodCount = 1), /non-function methods/]
    ]) {
      const invalidAudit = JSON.parse(JSON.stringify(validAudit));
      mutate(invalidAudit);
      writeJson(audit, invalidAudit);
      assert.throws(() => verifyReleaseCandidate(tarball, audit), expectedError);
    }
    writeJson(audit, validAudit);
    assert.throws(
      () =>
        verifyReleaseCandidate(tarball, audit, {
          requirePublishable: true,
          releaseTag: "v0.2.0",
          bundleArchive
        }),
      /release tag must exactly match/
    );
    const tamperedBundleArchive = path.join(tempRoot, "tampered-win-unpacked.tar");
    fs.writeFileSync(tamperedBundleArchive, Buffer.concat([bundleBytes, Buffer.from("tampered")]));
    assert.throws(
      () => verifyReleaseCandidate(tarball, audit, { bundleArchive: tamperedBundleArchive }),
      /bundle archive filename differs|bundle archive .* differs/
    );
    fs.appendFileSync(tarball, "tampered");
    assert.throws(() => verifyReleaseCandidate(tarball, audit), /differs from the audited candidate/);
    validatePublishTag("1.0.0", undefined);
    validatePublishTag("1.0.0-beta.1", "beta");
    assert.throws(() => validatePublishTag("1.0.0-beta.1", undefined), /explicit non-latest/);
    assert.throws(() => validatePublishTag("1.0.0-beta.1", "latest"), /explicit non-latest/);
    assert.throws(() => validatePublishTag("1.0.0", "1.0.0"), /must not be a version/);
    assert.throws(() => validatePublishTag("1.0.0", "unsafe tag"), /unsupported characters/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function createSelfTestReceipt(candidateBinding) {
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
  return assembleLiveProofReceipt(candidateBinding, profiles, "2026-07-11T00:00:00.000Z", true);
}

function createDocumentationOnlySelfTestTarball(tempRoot, name, version, readme, runtime) {
  const sourceRoot = path.join(tempRoot, name);
  const tarball = path.join(tempRoot, `${name}.tgz`);
  fs.mkdirSync(sourceRoot);
  writeJson(path.join(sourceRoot, "package.json"), {
    name: "steam-bridge",
    version,
    main: "index.js"
  });
  fs.writeFileSync(path.join(sourceRoot, "README.md"), `${readme}\n`);
  fs.writeFileSync(path.join(sourceRoot, "index.js"), `${runtime}\n`);
  tar.create(
    {
      cwd: sourceRoot,
      file: tarball,
      sync: true,
      gzip: true,
      portable: true,
      noMtime: true,
      prefix: "package"
    },
    ["README.md", "index.js", "package.json"]
  );
  return tarball;
}

function assertNonEmptyFile(filePath, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Missing or empty ${label}: ${filePath}`);
  }
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size === 0) {
    throw new Error(`Missing or empty ${label}: ${filePath}`);
  }
}

function readJsonFile(filePath, label) {
  const stats = fs.lstatSync(filePath);
  assert.ok(stats.isFile() && !stats.isSymbolicLink() && stats.size > 0, `${label} must be a regular file`);
  assert.ok(stats.size <= 16 * 1024 * 1024, `${label} exceeds the supported size`);
  return JSON.parse(readStableRegularFile(filePath, label, 16 * 1024 * 1024).toString("utf8"));
}

function readStableRegularFile(filePath, label, maxBytes = 512 * 1024 * 1024) {
  assertNonEmptyFile(filePath, label);
  const descriptor = fs.openSync(filePath, "r");
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    assert.ok(before.isFile() && before.size > 0n && before.size <= BigInt(maxBytes), `${label} has an invalid size`);
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor, { bigint: true });
    assertStableFileStats(before, after, label);
    assert.equal(BigInt(bytes.length), after.size, `${label} changed size while being read`);
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function hashStableRegularFile(filePath, label) {
  assertNonEmptyFile(filePath, label);
  const descriptor = fs.openSync(filePath, "r");
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    assert.ok(before.isFile() && before.size > 0n && before.size <= BigInt(Number.MAX_SAFE_INTEGER));
    const sha1 = crypto.createHash("sha1");
    const sha256Hash = crypto.createHash("sha256");
    const sha512Hex = crypto.createHash("sha512");
    const sha512Base64 = crypto.createHash("sha512");
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let total = 0;
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) {
        break;
      }
      const chunk = buffer.subarray(0, count);
      sha1.update(chunk);
      sha256Hash.update(chunk);
      sha512Hex.update(chunk);
      sha512Base64.update(chunk);
      total += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    assertStableFileStats(before, after, label);
    assert.equal(BigInt(total), after.size, `${label} changed size while being hashed`);
    return {
      size: total,
      sha1: sha1.digest("hex"),
      sha256: sha256Hash.digest("hex"),
      sha512: sha512Hex.digest("hex"),
      integrity: `sha512-${sha512Base64.digest("base64")}`
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function assertStableFileStats(before, after, label) {
  for (const field of ["dev", "ino", "size", "nlink", "mtimeNs", "ctimeNs"]) {
    assert.equal(after[field], before[field], `${label} changed while being inspected`);
  }
}

function hashBuffer(bytes) {
  return {
    size: bytes.length,
    sha1: crypto.createHash("sha1").update(bytes).digest("hex"),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    sha512: crypto.createHash("sha512").update(bytes).digest("hex"),
    integrity: `sha512-${crypto.createHash("sha512").update(bytes).digest("base64")}`
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

module.exports = { verifyDocumentationOnlySuccessor, verifyReleaseCandidate };
