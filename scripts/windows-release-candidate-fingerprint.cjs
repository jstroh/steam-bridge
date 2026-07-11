#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BUNDLE_CONTENT_ALGORITHM = "steam-bridge-windows-bundle-content-v1";
const CANDIDATE_BINDING_DOMAIN = "steam-bridge-windows-candidate-binding-v1";
const CANDIDATE_AUDIT_DOMAIN = "steam-bridge-windows-package-audit-v1";
const CANDIDATE_BINDING_PREFIX = "STEAM_BRIDGE_WINDOWS_CANDIDATE_BINDING ";
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const MAX_COMPONENT_LENGTH = 255;
const MAX_RELATIVE_PATH_LENGTH = 32760;
const CONTENT_FINGERPRINT_KEYS = ["algorithm", "fileCount", "schemaVersion", "sha256", "totalSize"];
const CANDIDATE_BINDING_KEYS = [
  "auditSha256",
  "bindingSha256",
  "electronVersion",
  "kind",
  "nativeBinding",
  "package",
  "release",
  "schemaVersion",
  "signing",
  "target",
  "windowsBundle"
];

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    selfTest();
    console.log("Windows release-candidate fingerprint self-test passed.");
  } else {
    main();
  }
}

function main() {
  const directory = readArg("--directory");
  const auditManifest = readArg("--audit-manifest");
  if (!directory || !auditManifest) {
    throw new Error(
      "Usage: node scripts/windows-release-candidate-fingerprint.cjs " +
        "--directory <win-unpacked> --audit-manifest <package-audit.json>"
    );
  }
  const audit = readJson(path.resolve(auditManifest), "package audit manifest");
  const binding = verifyCandidateDirectory(path.resolve(directory), audit);
  console.log(`${CANDIDATE_BINDING_PREFIX}${JSON.stringify(binding)}`);
}

function inspectCandidateDirectory(root) {
  const resolvedRoot = path.resolve(root);
  const rootStats = fs.lstatSync(resolvedRoot, { bigint: true });
  assert.ok(rootStats.isDirectory() && !rootStats.isSymbolicLink(), "Candidate root must be a real directory.");
  const realRoot = fs.realpathSync.native(resolvedRoot);
  const files = [];
  const seenPortablePaths = new Set();
  const seenRealDirectories = new Set();

  walk(resolvedRoot, "");
  files.sort((left, right) => Buffer.compare(Buffer.from(left.relativePath), Buffer.from(right.relativePath)));
  assert.ok(files.length > 0, "Candidate directory must contain at least one file.");
  assert.ok(files.length <= 0xffffffff, "Candidate bundle has too many files for fingerprint schema 1.");

  const digest = crypto.createHash("sha256");
  digest.update(Buffer.from(`${BUNDLE_CONTENT_ALGORITHM}\0`, "utf8"));
  const fileCount = Buffer.alloc(4);
  fileCount.writeUInt32BE(files.length);
  digest.update(fileCount);
  let totalSize = 0;
  for (const file of files) {
    const relativeBytes = Buffer.from(file.relativePath, "utf8");
    const pathLength = Buffer.alloc(4);
    pathLength.writeUInt32BE(relativeBytes.length);
    const size = Buffer.alloc(8);
    size.writeBigUInt64BE(BigInt(file.size));
    digest.update(Buffer.from([0x46]));
    digest.update(pathLength);
    digest.update(relativeBytes);
    digest.update(size);
    digest.update(Buffer.from(file.sha256, "hex"));
    totalSize += file.size;
    assert.ok(Number.isSafeInteger(totalSize), "Candidate bundle total size exceeds the safe integer range.");
  }

  return {
    fingerprint: {
      schemaVersion: 1,
      algorithm: BUNDLE_CONTENT_ALGORITHM,
      fileCount: files.length,
      totalSize,
      sha256: digest.digest("hex")
    },
    files
  };

  function walk(directory, relativeDirectory) {
    const realDirectory = fs.realpathSync.native(directory);
    const realRelative = path.relative(realRoot, realDirectory);
    assert.ok(
      realRelative === "" || (!realRelative.startsWith(`..${path.sep}`) && realRelative !== ".."),
      "Candidate directory resolves outside its root."
    );
    const realDirectoryKey = realDirectory.normalize("NFC").toLowerCase();
    assert.ok(!seenRealDirectories.has(realDirectoryKey), "Candidate directory graph contains a repeated real path.");
    seenRealDirectories.add(realDirectoryKey);
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      validatePathComponent(entry.name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      validatePortableRelativePath(relativePath);
      const portableKey = relativePath.normalize("NFC").toLowerCase();
      assert.ok(!seenPortablePaths.has(portableKey), `Candidate contains a portable path collision: ${relativePath}`);
      seenPortablePaths.add(portableKey);

      const absolutePath = path.join(directory, entry.name);
      const stats = fs.lstatSync(absolutePath, { bigint: true });
      assert.equal(stats.isSymbolicLink(), false, `Candidate contains a symbolic link or junction: ${relativePath}`);
      if (stats.isDirectory()) {
        walk(absolutePath, relativePath);
      } else if (stats.isFile()) {
        assert.equal(stats.nlink, 1n, `Candidate contains a hard-linked file: ${relativePath}`);
        const stableFile = hashStableFile(absolutePath, stats, relativePath);
        files.push({
          relativePath,
          size: stableFile.size,
          sha256: stableFile.sha256
        });
      } else {
        throw new Error(`Candidate contains an unsupported filesystem entry: ${relativePath}`);
      }
    }
  }
}

function fingerprintCandidateDirectory(root) {
  return inspectCandidateDirectory(root).fingerprint;
}

function verifyCandidateDirectory(root, audit) {
  const expected = validateContentFingerprint(audit?.finalBundle?.contentFingerprint);
  const actual = fingerprintCandidateDirectory(root);
  assert.deepEqual(actual, expected, "Candidate directory content differs from the package audit.");
  return createCandidateBinding(audit);
}

function verifyBundleArchiveContent(archivePath, expectedFingerprint, rootDirectory) {
  const tar = require("tar");
  assertNonEmptyFile(archivePath, "retained Windows bundle archive");
  const expected = validateContentFingerprint(expectedFingerprint);
  assert.match(rootDirectory || "", /^[A-Za-z0-9._-]+$/, "Archive root directory is invalid.");
  const expectedPrefix = `${rootDirectory}/`;
  const seen = new Set();
  let archiveFileCount = 0;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-windows-bundle-verify-"));
  try {
    const snapshot = path.join(tempRoot, "candidate.tar");
    const extractionRoot = path.join(tempRoot, "extract");
    fs.mkdirSync(extractionRoot);
    const maxArchiveBytes =
      BigInt(expected.totalSize) + BigInt(expected.fileCount) * 16384n + 10n * 1024n * 1024n;
    copyStableRegularFile(archivePath, snapshot, maxArchiveBytes);
    let archiveTotalSize = 0;
    tar.list({
      file: snapshot,
      sync: true,
      strict: true,
      onReadEntry(entry) {
        const entryPath = String(entry.path || "");
        validateArchiveEntryPath(entryPath, rootDirectory);
        const portableKey = entryPath.replace(/\/$/, "").normalize("NFC").toLowerCase();
        assert.ok(!seen.has(portableKey), `Archive contains a duplicate portable path: ${entryPath}`);
        seen.add(portableKey);
        assert.equal(entry.type, "File", `Archive contains unsupported entry type ${entry.type}.`);
        assert.ok(entryPath.startsWith(expectedPrefix), `Archive file is outside ${rootDirectory}.`);
        assert.ok(Number.isSafeInteger(entry.size) && entry.size >= 0, "Archive entry has an invalid size.");
        archiveFileCount += 1;
        archiveTotalSize += entry.size;
        assert.ok(archiveFileCount <= expected.fileCount, "Archive contains too many files.");
        assert.ok(archiveTotalSize <= expected.totalSize, "Archive content exceeds the audited total size.");
      }
    });
    assert.equal(archiveFileCount, expected.fileCount, "Archive file count differs from the content fingerprint.");
    assert.equal(archiveTotalSize, expected.totalSize, "Archive total size differs from the content fingerprint.");
    tar.extract({
      cwd: extractionRoot,
      file: snapshot,
      sync: true,
      strict: true,
      preservePaths: false,
      unlink: true
    });
    assert.deepEqual(fs.readdirSync(extractionRoot).sort(compareOrdinal), [rootDirectory]);
    const extractedRoot = path.join(extractionRoot, rootDirectory);
    const actual = fingerprintCandidateDirectory(extractedRoot);
    assert.deepEqual(actual, expectedFingerprint, "Archive content differs from the package audit fingerprint.");
    return actual;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function createCandidateBinding(audit) {
  assert.equal(audit?.schemaVersion, 2, "Candidate binding requires package audit schema 2.");
  assert.equal(audit?.target, "x86_64-pc-windows-msvc", "Candidate binding requires the Windows x64 target.");
  assert.equal(audit?.package?.name, "steam-bridge", "Candidate binding requires the steam-bridge package.");
  assert.match(audit?.package?.version || "", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "Invalid package version.");
  assert.match(audit?.package?.tarball?.sha256 || "", /^[a-f0-9]{64}$/, "Invalid tarball SHA-256.");
  assert.match(audit?.finalBundle?.archive?.sha256 || "", /^[a-f0-9]{64}$/, "Invalid bundle archive SHA-256.");
  assert.equal(audit?.finalBundle?.archive?.rootDirectory, "win-unpacked", "Invalid bundle archive root.");
  assert.match(audit?.release?.gitCommit || "", /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i, "Invalid release Git commit.");
  assert.match(audit?.release?.gitRefName || "", /^[A-Za-z0-9._/-]{1,255}$/, "Invalid release Git ref.");
  assert.match(audit?.electronBuilder?.electronVersion || "", /^\d+\.\d+\.\d+$/, "Invalid Electron version.");
  assert.ok(Number.isInteger(audit?.package?.nativeBinding?.methodCount) && audit.package.nativeBinding.methodCount > 0);
  assert.match(audit?.package?.nativeBinding?.methodsSha256 || "", /^[a-f0-9]{64}$/);
  assert.equal(typeof audit?.signing?.required, "boolean", "Candidate binding requires signing policy evidence.");
  assert.equal(typeof audit?.signing?.expectedPublisherSubjectConfigured, "boolean");
  assert.equal(typeof audit?.signing?.expectedPublisherThumbprintConfigured, "boolean");
  assert.equal(typeof audit?.signing?.publisherMatches?.appExecutable, "boolean");
  assert.equal(typeof audit?.signing?.publisherMatches?.nativeAddon, "boolean");
  const bundleContent = validateContentFingerprint(audit.finalBundle.contentFingerprint);
  assert.equal(
    audit.finalBundle.archive.fileCount,
    bundleContent.fileCount,
    "Bundle archive file count differs from the content fingerprint."
  );
  const base = {
    kind: "steam-bridge-windows-release-candidate-binding",
    schemaVersion: 1,
    target: audit.target,
    package: {
      name: audit.package.name,
      version: audit.package.version,
      tarballSha256: audit.package.tarball.sha256
    },
    electronVersion: audit.electronBuilder.electronVersion,
    nativeBinding: {
      methodCount: audit.package.nativeBinding.methodCount,
      methodsSha256: audit.package.nativeBinding.methodsSha256
    },
    windowsBundle: {
      archiveSha256: audit.finalBundle.archive.sha256,
      contentFingerprint: bundleContent
    },
    release: {
      gitCommit: audit.release.gitCommit.toLowerCase(),
      gitRefName: audit.release.gitRefName
    },
    signing: {
      required: audit.signing.required,
      expectedPublisherSubjectConfigured: audit.signing.expectedPublisherSubjectConfigured,
      expectedPublisherThumbprintConfigured: audit.signing.expectedPublisherThumbprintConfigured,
      appExecutablePublisherMatches: audit.signing.publisherMatches.appExecutable,
      nativeAddonPublisherMatches: audit.signing.publisherMatches.nativeAddon
    },
    auditSha256: hashCanonicalJson(CANDIDATE_AUDIT_DOMAIN, audit)
  };
  return {
    ...base,
    bindingSha256: hashCanonicalJson(CANDIDATE_BINDING_DOMAIN, base)
  };
}

function validateCandidateBinding(binding) {
  assertPlainObject(binding, "Candidate binding");
  assert.deepEqual(Object.keys(binding).sort(compareOrdinal), CANDIDATE_BINDING_KEYS);
  assert.equal(binding.kind, "steam-bridge-windows-release-candidate-binding");
  assert.equal(binding.schemaVersion, 1, "Unsupported candidate binding schema.");
  assert.equal(binding.target, "x86_64-pc-windows-msvc", "Candidate binding target is not Windows x64.");
  assert.deepEqual(Object.keys(binding.package || {}).sort(compareOrdinal), ["name", "tarballSha256", "version"]);
  assert.equal(binding.package.name, "steam-bridge", "Candidate binding package name is invalid.");
  assert.match(binding.package.version || "", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.match(binding.package.tarballSha256 || "", /^[a-f0-9]{64}$/);
  assert.match(binding.electronVersion || "", /^\d+\.\d+\.\d+$/);
  assert.deepEqual(Object.keys(binding.nativeBinding || {}).sort(compareOrdinal), ["methodCount", "methodsSha256"]);
  assert.ok(Number.isInteger(binding.nativeBinding.methodCount) && binding.nativeBinding.methodCount > 0);
  assert.match(binding.nativeBinding.methodsSha256 || "", /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(binding.windowsBundle || {}).sort(compareOrdinal), ["archiveSha256", "contentFingerprint"]);
  assert.match(binding.windowsBundle.archiveSha256 || "", /^[a-f0-9]{64}$/);
  validateContentFingerprint(binding.windowsBundle.contentFingerprint);
  assert.deepEqual(Object.keys(binding.release || {}).sort(compareOrdinal), ["gitCommit", "gitRefName"]);
  assert.match(binding.release.gitCommit || "", /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
  assert.match(binding.release.gitRefName || "", /^[A-Za-z0-9._/-]{1,255}$/);
  assert.deepEqual(Object.keys(binding.signing || {}).sort(compareOrdinal), [
    "appExecutablePublisherMatches",
    "expectedPublisherSubjectConfigured",
    "expectedPublisherThumbprintConfigured",
    "nativeAddonPublisherMatches",
    "required"
  ]);
  assert.equal(typeof binding.signing.required, "boolean");
  assert.equal(typeof binding.signing.expectedPublisherSubjectConfigured, "boolean");
  assert.equal(typeof binding.signing.expectedPublisherThumbprintConfigured, "boolean");
  assert.equal(typeof binding.signing.appExecutablePublisherMatches, "boolean");
  assert.equal(typeof binding.signing.nativeAddonPublisherMatches, "boolean");
  assert.match(binding.auditSha256 || "", /^[a-f0-9]{64}$/);
  const { bindingSha256, ...base } = binding;
  assert.equal(
    bindingSha256,
    hashCanonicalJson(CANDIDATE_BINDING_DOMAIN, base),
    "Candidate binding hash is inconsistent."
  );
  return binding;
}

function validateContentFingerprint(value) {
  assertPlainObject(value, "Bundle content fingerprint");
  assert.deepEqual(Object.keys(value).sort(compareOrdinal), CONTENT_FINGERPRINT_KEYS);
  assert.equal(value.schemaVersion, 1, "Unsupported bundle content fingerprint schema.");
  assert.equal(value.algorithm, BUNDLE_CONTENT_ALGORITHM, "Unsupported bundle content fingerprint algorithm.");
  assert.ok(
    Number.isSafeInteger(value.fileCount) && value.fileCount > 0 && value.fileCount <= 0xffffffff,
    "Bundle file count is outside schema-1 bounds."
  );
  assert.ok(Number.isSafeInteger(value.totalSize) && value.totalSize >= 0, "Bundle total size is invalid.");
  assert.match(value.sha256 || "", /^[a-f0-9]{64}$/, "Bundle content SHA-256 is invalid.");
  return value;
}

function validateArchiveEntryPath(entryPath, rootDirectory) {
  assert.ok(entryPath && !entryPath.includes("\\"), "Archive entry path must use forward slashes.");
  assert.equal(path.posix.isAbsolute(entryPath), false, "Archive entry path must be relative.");
  const trimmed = entryPath.replace(/\/$/, "");
  const components = trimmed.split("/");
  assert.ok(components.length > 0 && components[0] === rootDirectory, "Archive entry has the wrong root directory.");
  for (const component of components) {
    validatePathComponent(component);
  }
  assert.equal(path.posix.normalize(trimmed), trimmed, "Archive entry path is not normalized.");
}

function validatePortableRelativePath(relativePath) {
  assert.ok(relativePath && !relativePath.includes("\\"), "Candidate relative paths must use forward slashes.");
  assert.equal(path.posix.isAbsolute(relativePath), false, "Candidate relative paths must not be absolute.");
  assert.equal(path.posix.normalize(relativePath), relativePath, "Candidate relative path is not normalized.");
  assert.ok(relativePath.length <= MAX_RELATIVE_PATH_LENGTH, "Candidate relative path is too long.");
  for (const component of relativePath.split("/")) {
    validatePathComponent(component);
  }
}

function validatePathComponent(component) {
  assert.ok(component && component !== "." && component !== "..", "Candidate path contains traversal.");
  assert.ok(component.length <= MAX_COMPONENT_LENGTH, "Candidate path component is too long.");
  assert.ok(isWellFormedString(component), "Candidate path contains malformed Unicode.");
  assert.match(component, /^[\x20-\x7e]+$/, "Candidate path must use portable printable ASCII.");
  assert.doesNotMatch(component, /[\u0000-\u001f\u007f<>:"|?*]/, "Candidate path is not portable to Windows.");
  assert.equal(component, component.normalize("NFC"), "Candidate path must use NFC normalization.");
  assert.doesNotMatch(component, /[ .]$/, "Candidate path component has an unsupported trailing character.");
  const deviceName = component.split(".", 1)[0];
  assert.doesNotMatch(
    deviceName,
    /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i,
    "Candidate path contains a reserved Windows device name."
  );
}

function hashCanonicalJson(domain, value) {
  return crypto.createHash("sha256").update(`${domain}\n${canonicalJson(value)}\n`).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    assert.ok(Number.isSafeInteger(value), "Canonical JSON numbers must be safe integers.");
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  assertPlainObject(value, "Canonical JSON value");
  return `{${Object.keys(value)
    .sort(compareOrdinal)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function hashStableFile(filePath, expectedStats, relativePath) {
  const descriptor = fs.openSync(filePath, "r");
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    assertStableFileIdentity(expectedStats, before, relativePath);
    assert.ok(before.size <= BigInt(Number.MAX_SAFE_INTEGER), `Candidate file is too large: ${relativePath}`);
    const digest = crypto.createHash("sha256");
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let size = 0;
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) {
        break;
      }
      digest.update(buffer.subarray(0, count));
      size += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    assertStableFileIdentity(before, after, relativePath);
    assert.equal(BigInt(size), after.size, `Candidate file changed size while hashing: ${relativePath}`);
    return {
      size,
      sha256: digest.digest("hex")
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function assertStableFileIdentity(expected, actual, relativePath) {
  for (const field of ["dev", "ino", "size", "nlink", "mtimeNs", "ctimeNs"]) {
    assert.equal(actual[field], expected[field], `Candidate file changed while hashing: ${relativePath}`);
  }
  assert.ok(actual.isFile() && !actual.isSymbolicLink(), `Candidate file identity is invalid: ${relativePath}`);
}

function hashFileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assertPlainObject(value, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  assert.equal(Object.getPrototypeOf(value), Object.prototype, `${label} must be a plain object.`);
}

function assertNonEmptyFile(filePath, label) {
  assert.ok(fs.existsSync(filePath), `Missing ${label}.`);
  const stats = fs.lstatSync(filePath);
  assert.ok(stats.isFile() && !stats.isSymbolicLink() && stats.size > 0, `${label} must be a non-empty regular file.`);
}

function readJson(filePath, label) {
  assertNonEmptyFile(filePath, label);
  const stats = fs.lstatSync(filePath);
  assert.ok(stats.size <= MAX_JSON_BYTES, `${label} exceeds the supported size.`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function copyStableRegularFile(source, destination, maxBytes) {
  const sourceDescriptor = fs.openSync(source, "r");
  const destinationDescriptor = fs.openSync(destination, "wx", 0o400);
  try {
    const before = fs.fstatSync(sourceDescriptor, { bigint: true });
    assert.ok(before.isFile() && before.size > 0n && before.size <= maxBytes, "Archive has an invalid size.");
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
    }
    fs.fsyncSync(destinationDescriptor);
    const after = fs.fstatSync(sourceDescriptor, { bigint: true });
    assertStableFileIdentity(before, after, "retained Windows bundle archive");
    assert.equal(total, after.size, "Archive changed size while being copied.");
  } finally {
    fs.closeSync(destinationDescriptor);
    fs.closeSync(sourceDescriptor);
  }
}

function isWellFormedString(value) {
  if (typeof value.isWellFormed === "function") {
    return value.isWellFormed();
  }
  return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selfTest() {
  const tar = require("tar");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-candidate-fingerprint-self-test-"));
  try {
    const bundle = path.join(tempRoot, "bundle");
    fs.mkdirSync(path.join(bundle, "nested"), { recursive: true });
    fs.writeFileSync(path.join(bundle, "z.txt"), "z");
    fs.writeFileSync(path.join(bundle, "nested", "a.txt"), "alpha");
    const inspected = inspectCandidateDirectory(bundle);
    assert.equal(inspected.fingerprint.fileCount, 2);
    assert.equal(inspected.fingerprint.totalSize, 6);
    assert.deepEqual(
      inspected.files.map((entry) => entry.relativePath),
      ["nested/a.txt", "z.txt"]
    );
    const originalFingerprint = inspected.fingerprint;
    fs.mkdirSync(path.join(bundle, "empty-directory"));
    assert.deepEqual(fingerprintCandidateDirectory(bundle), originalFingerprint);
    fs.rmdirSync(path.join(bundle, "empty-directory"));
    assert.throws(() =>
      validateContentFingerprint({
        ...originalFingerprint,
        fileCount: 0x100000000
      })
    );
    fs.utimesSync(path.join(bundle, "z.txt"), new Date(0), new Date());
    assert.deepEqual(fingerprintCandidateDirectory(bundle), originalFingerprint);
    fs.writeFileSync(path.join(bundle, "z.txt"), "changed");
    assert.notEqual(fingerprintCandidateDirectory(bundle).sha256, originalFingerprint.sha256);
    fs.writeFileSync(path.join(bundle, "z.txt"), "z");
    assert.deepEqual(fingerprintCandidateDirectory(bundle), originalFingerprint);
    fs.writeFileSync(path.join(bundle, "empty.txt"), "");
    const withEmptyFile = fingerprintCandidateDirectory(bundle);
    assert.equal(withEmptyFile.fileCount, 3);
    assert.equal(withEmptyFile.totalSize, originalFingerprint.totalSize);
    assert.notEqual(withEmptyFile.sha256, originalFingerprint.sha256);
    fs.rmSync(path.join(bundle, "empty.txt"));
    fs.renameSync(path.join(bundle, "z.txt"), path.join(bundle, "renamed.txt"));
    assert.notEqual(fingerprintCandidateDirectory(bundle).sha256, originalFingerprint.sha256);
    fs.renameSync(path.join(bundle, "renamed.txt"), path.join(bundle, "z.txt"));

    for (const invalidName of ["CON.txt", "trailing.", "stream:name", "é.txt"]) {
      fs.writeFileSync(path.join(bundle, invalidName), "invalid");
      assert.throws(() => inspectCandidateDirectory(bundle));
      fs.rmSync(path.join(bundle, invalidName));
    }

    if (process.platform !== "win32") {
      fs.writeFileSync(path.join(bundle, "A.txt"), "A");
      fs.writeFileSync(path.join(bundle, "a.txt"), "a");
      const caseVariants = fs.readdirSync(bundle).filter((entry) => entry.toLowerCase() === "a.txt");
      if (caseVariants.length === 2) {
        assert.throws(() => inspectCandidateDirectory(bundle), /portable path collision/);
      }
      for (const caseVariant of caseVariants) {
        fs.rmSync(path.join(bundle, caseVariant));
      }
      fs.symlinkSync("z.txt", path.join(bundle, "link.txt"));
      assert.throws(() => inspectCandidateDirectory(bundle), /symbolic link or junction/);
      fs.rmSync(path.join(bundle, "link.txt"));
      fs.linkSync(path.join(bundle, "z.txt"), path.join(bundle, "hardlink.txt"));
      assert.throws(() => inspectCandidateDirectory(bundle), /hard-linked file/);
      fs.rmSync(path.join(bundle, "hardlink.txt"));
    }

    const archive = path.join(tempRoot, "bundle.tar");
    tar.create(
      { cwd: bundle, file: archive, sync: true, portable: true, noMtime: true, prefix: "win-unpacked" },
      inspected.files.map((entry) => entry.relativePath)
    );
    const archiveSha256 = hashFileSha256(archive);
    const audit = {
      schemaVersion: 2,
      target: "x86_64-pc-windows-msvc",
      package: {
        name: "steam-bridge",
        version: "0.1.0",
        nativeBinding: { methodCount: 1121, methodsSha256: "3".repeat(64) },
        tarball: { sha256: "1".repeat(64) }
      },
      electronBuilder: { electronVersion: "43.1.0" },
      finalBundle: {
        archive: {
          sha256: archiveSha256,
          rootDirectory: "win-unpacked",
          fileCount: originalFingerprint.fileCount
        },
        contentFingerprint: originalFingerprint
      },
      signing: {
        required: true,
        expectedPublisherSubjectConfigured: false,
        expectedPublisherThumbprintConfigured: true,
        publisherMatches: { appExecutable: true, nativeAddon: true }
      },
      release: { gitCommit: "2".repeat(40), gitRefName: "main" }
    };
    verifyBundleArchiveContent(archive, originalFingerprint, "win-unpacked");
    const wrongRootArchive = path.join(tempRoot, "wrong-root.tar");
    tar.create(
      { cwd: bundle, file: wrongRootArchive, sync: true, portable: true, noMtime: true, prefix: "other-root" },
      inspected.files.map((entry) => entry.relativePath)
    );
    assert.throws(() => verifyBundleArchiveContent(wrongRootArchive, originalFingerprint, "win-unpacked"));
    const duplicateArchive = path.join(tempRoot, "duplicate.tar");
    tar.create(
      { cwd: bundle, file: duplicateArchive, sync: true, portable: true, noMtime: true, prefix: "win-unpacked" },
      ["z.txt", "z.txt"]
    );
    assert.throws(() => verifyBundleArchiveContent(duplicateArchive, originalFingerprint, "win-unpacked"));
    const directoryArchive = path.join(tempRoot, "directory-entry.tar");
    tar.create(
      { cwd: bundle, file: directoryArchive, sync: true, portable: true, noMtime: true, prefix: "win-unpacked" },
      ["nested"]
    );
    assert.throws(() => verifyBundleArchiveContent(directoryArchive, originalFingerprint, "win-unpacked"));
    const binding = verifyCandidateDirectory(bundle, audit);
    validateCandidateBinding(JSON.parse(JSON.stringify(binding)));
    assert.throws(
      () => validateCandidateBinding({ ...binding, bindingSha256: "0".repeat(64) }),
      /hash is inconsistent/
    );

    const vectorRoot = path.join(tempRoot, "vector");
    fs.mkdirSync(path.join(vectorRoot, "resources"), { recursive: true });
    fs.writeFileSync(path.join(vectorRoot, "SteamBridgeSmoke.exe"), "exe");
    fs.writeFileSync(path.join(vectorRoot, "resources", "app.asar"), "asar");
    assert.deepEqual(fingerprintCandidateDirectory(vectorRoot), {
      schemaVersion: 1,
      algorithm: BUNDLE_CONTENT_ALGORITHM,
      fileCount: 2,
      totalSize: 7,
      sha256: "1a604a641950a5d42b3da5cf78351ecabc2254dcf7e0d91cae697f2fd8c2bfaa"
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = {
  BUNDLE_CONTENT_ALGORITHM,
  CANDIDATE_BINDING_PREFIX,
  canonicalJson,
  createCandidateBinding,
  fingerprintCandidateDirectory,
  hashCanonicalJson,
  inspectCandidateDirectory,
  validateCandidateBinding,
  validateContentFingerprint,
  verifyBundleArchiveContent,
  verifyCandidateDirectory
};
