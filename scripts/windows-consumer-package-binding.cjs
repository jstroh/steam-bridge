const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const packagedTar = path.join(__dirname, "windows-consumer-tar.cjs");
const tar = fs.existsSync(packagedTar) ? require(packagedTar) : require("tar");
const {
  inspectCandidateDirectory,
  fingerprintFileInventory,
  validateContentFingerprint
} = require("./windows-release-candidate-fingerprint.cjs");

const MAX_PACKAGE_BYTES = 128 * 1024 * 1024;
const MAX_PACKAGE_FILES = 2048;
const MAX_ARCHIVE_BYTES = MAX_PACKAGE_BYTES + MAX_PACKAGE_FILES * 16384 + 1024 * 1024;
const WINDOWS_RUNTIME_FILES = ["steam_bridge_native.win32-x64-msvc.node", "steam_api64.dll", "sdkencryptedappticket64.dll"];
const BINDING_KIND = "steam-bridge-windows-consumer-package-binding";
const METADATA_POLICY = "normal-install-exact-bytes-v1";

function readStableTarball(file, expectedSha256) {
  assert.match(expectedSha256 || "", /^[a-f0-9]{64}$/, "Candidate TGZ hash is invalid.");
  file = path.resolve(file);
  assert.equal(portablePhysicalPath(fs.realpathSync.native(file)), portablePhysicalPath(file), "Candidate TGZ traverses a link.");
  const beforePath = fs.lstatSync(file, { bigint: true });
  assert.ok(beforePath.isFile() && !beforePath.isSymbolicLink(), "Candidate TGZ must be a regular file.");
  assert.equal(beforePath.nlink, 1n, "Candidate TGZ must not be hard linked.");
  const descriptor = fs.openSync(file, "r");
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    sameStats(beforePath, before, true);
    assert.ok(before.size > 0n && before.size <= BigInt(MAX_PACKAGE_BYTES), "Candidate TGZ exceeds its size bound.");
    const buffer = Buffer.alloc(Number(before.size) + 1);
    let read = 0;
    while (read < buffer.length) {
      const count = fs.readSync(descriptor, buffer, read, buffer.length - read, read);
      if (count === 0) break;
      read += count;
    }
    const bytes = buffer.subarray(0, read);
    sameStats(before, fs.fstatSync(descriptor, { bigint: true }));
    sameStats(before, fs.lstatSync(file, { bigint: true }), true);
    assert.equal(BigInt(bytes.length), before.size);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), expectedSha256, "Candidate TGZ bytes differ.");
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function portablePhysicalPath(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function sameStats(before, after, allowUnavailableIdentifiers = false) {
  assert.ok(after.isFile() && !after.isSymbolicLink(), "Candidate TGZ identity changed.");
  for (const key of ["dev", "ino", "size", "nlink", "mtimeNs", "ctimeNs"]) {
    if (allowUnavailableIdentifiers && (key === "dev" || key === "ino") && (before[key] === 0n || after[key] === 0n)) continue;
    assert.equal(after[key], before[key], "Candidate TGZ changed while being read.");
  }
}

function validateEntryPath(value) {
  assert.ok(value.startsWith("package/"), "Candidate TGZ entry is outside package/.");
  assert.ok(value.length <= 32760 && !value.includes("\\"), "Candidate TGZ entry path is invalid.");
  assert.equal(path.posix.normalize(value), value, "Candidate TGZ entry path is not canonical.");
  for (const component of value.split("/")) {
    assert.ok(component && component !== "." && component !== ".." && component.length <= 255, "Candidate TGZ contains traversal.");
    assert.match(component, /^[\x20-\x7e]+$/, "Candidate TGZ path must be portable ASCII.");
    assert.doesNotMatch(component, /[<>:"|?*]|[ .]$/, "Candidate TGZ path is not portable to Windows.");
    assert.doesNotMatch(component.split(".", 1)[0], /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, "Candidate TGZ contains a Windows device name.");
  }
}

function inspectCandidatePackage(tarball, expectedSha256) {
  const bytes = readStableTarball(tarball, expectedSha256);
  const archiveBytes = zlib.gunzipSync(bytes, { maxOutputLength: MAX_ARCHIVE_BYTES });
  validateCompleteArchive(archiveBytes);
  const seen = new Set();
  const directories = new Set();
  const files = [];
  const manifestChunks = [];
  let totalSize = 0;
  tar.list({ sync: true, strict: true, onReadEntry(entry) {
    assert.equal(entry.type, "File", "Candidate TGZ contains a link or unsupported entry.");
    validateEntryPath(entry.header.path);
    validateEntryPath(entry.path);
    const key = entry.path.toLowerCase();
    assert.ok(!seen.has(key) && !directories.has(key), "Candidate TGZ contains a portable path collision.");
    const components = key.split("/");
    for (let length = 1; length < components.length; length++) {
      const directory = components.slice(0, length).join("/");
      assert.ok(!seen.has(directory), "Candidate TGZ contains a file/directory collision.");
      directories.add(directory);
    }
    seen.add(key);
    assert.ok(seen.size <= MAX_PACKAGE_FILES, "Candidate TGZ contains too many files.");
    assert.ok(Number.isSafeInteger(entry.size) && entry.size >= 0, "Candidate TGZ file size is invalid.");
    totalSize += entry.size;
    assert.ok(totalSize <= MAX_PACKAGE_BYTES, "Candidate TGZ expands beyond its size bound.");
    const digest = crypto.createHash("sha256");
    let received = 0;
    const isManifest = entry.path === "package/package.json";
    if (isManifest) assert.ok(entry.size <= 1024 * 1024, "Candidate package metadata exceeds its size bound.");
    entry.on("data", chunk => {
      received += chunk.length;
      assert.ok(received <= entry.size, "Candidate TGZ entry exceeds its declared size.");
      digest.update(chunk);
      if (isManifest) manifestChunks.push(chunk);
    });
    entry.on("end", () => {
      assert.equal(received, entry.size, "Candidate TGZ entry is truncated.");
      files.push({ relativePath: entry.path.slice("package/".length), size: received, sha256: digest.digest("hex") });
    });
  } }).end(archiveBytes);
  files.sort((left, right) => Buffer.compare(Buffer.from(left.relativePath), Buffer.from(right.relativePath)));
  assert.equal(files.length, seen.size, "Candidate inventory is incomplete.");
  const fingerprint = fingerprintFileInventory(files);
  assert.equal(fingerprint.totalSize, totalSize, "Candidate inventory size differs.");
  const manifest = JSON.parse(Buffer.concat(manifestChunks).toString("utf8"));
  assert.equal(manifest.name, "steam-bridge");
  assert.match(manifest.version || "", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  return {
    files,
    binding: {
      kind: BINDING_KIND,
      schemaVersion: 1,
      metadataPolicy: METADATA_POLICY,
      packageName: manifest.name,
      packageVersion: manifest.version,
      tarball: { size: bytes.length, sha256: expectedSha256 },
      contentFingerprint: fingerprint
    }
  };
}

function validateCompleteArchive(bytes) {
  assert.ok(bytes.length >= 1024 && bytes.length % 512 === 0, "Candidate TGZ has truncated archive framing.");
  let offset = 0;
  let extended;
  let globalExtended;
  let headerCount = 0;
  while (offset + 512 <= bytes.length) {
    const header = new tar.Header(bytes, offset, extended, globalExtended);
    if (header.nullBlock) {
      assert.ok(bytes.length - offset >= 1024 && bytes.subarray(offset).every(byte => byte === 0),
        "Candidate TGZ is missing complete end markers or has data after its end.");
      assert.equal(extended, undefined, "Candidate TGZ has a dangling extended header.");
      return;
    }
    assert.ok(header.cksumValid, "Candidate TGZ archive header checksum is invalid.");
    assert.ok(++headerCount <= MAX_PACKAGE_FILES * 8, "Candidate TGZ has too many archive headers.");
    assert.ok(Number.isSafeInteger(header.size) && header.size >= 0 && header.size <= MAX_PACKAGE_BYTES,
      "Candidate TGZ archive entry size is invalid.");
    const start = offset + 512;
    const end = start + header.size;
    offset = start + Math.ceil(header.size / 512) * 512;
    assert.ok(offset <= bytes.length, "Candidate TGZ archive entry is truncated.");
    const metadataTypes = ["ExtendedHeader", "OldExtendedHeader", "GlobalExtendedHeader", "NextFileHasLongPath", "OldGnuLongPath", "NextFileHasLongLinkpath"];
    if (metadataTypes.includes(header.type)) {
      assert.ok(header.size <= 1024 * 1024, "Candidate TGZ extended metadata exceeds its size bound.");
      const value = bytes.subarray(start, end).toString("utf8");
      if (header.type === "GlobalExtendedHeader") globalExtended = tar.Pax.parse(value, globalExtended, true);
      else if (header.type === "ExtendedHeader" || header.type === "OldExtendedHeader") extended = tar.Pax.parse(value, extended, false);
      else {
        extended ||= Object.create(null);
        extended[header.type === "NextFileHasLongLinkpath" ? "linkpath" : "path"] = value.split("\0")[0];
      }
    } else {
      assert.equal(header.type, "File", "Candidate TGZ contains a link or unsupported entry.");
      extended = undefined;
    }
  }
  throw new Error("Candidate TGZ is missing complete archive end markers.");
}

function verifyInstalledPackage(root, candidate) {
  root = path.resolve(root);
  assert.equal(portablePhysicalPath(fs.realpathSync.native(root)), portablePhysicalPath(root), "Consumer package root traverses a link.");
  const rootStats = fs.lstatSync(root);
  assert.ok(rootStats.isDirectory() && !rootStats.isSymbolicLink(), "Consumer package root must be a real directory.");
  const expectedFiles = new Map(candidate.files.map(file => [file.relativePath, file]));
  const expectedDirectories = new Set();
  for (const file of candidate.files) {
    const components = file.relativePath.split("/");
    for (let length = 1; length < components.length; length++) expectedDirectories.add(components.slice(0, length).join("/"));
  }
  function visit(directory, prefix) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? prefix + "/" + entry.name : entry.name;
      const absolute = path.join(directory, entry.name);
      const stats = fs.lstatSync(absolute);
      assert.equal(stats.isSymbolicLink(), false, "Consumer package contains a link.");
      if (stats.isDirectory()) {
        assert.ok(expectedDirectories.has(relative), "Consumer package contains an extra directory.");
        visit(absolute, relative);
      } else {
        const expected = expectedFiles.get(relative);
        assert.ok(expected && stats.isFile(), "Complete consumer package differs from the canonical TGZ.");
        assert.equal(stats.nlink, 1, "Consumer package contains a hard link.");
        assert.equal(stats.size, expected.size, "Complete consumer package differs from the canonical TGZ.");
      }
    }
  }
  visit(root, "");
  const actual = inspectCandidateDirectory(root, candidate.files);
  assert.deepEqual(actual.files, candidate.files, "Complete consumer package differs from the canonical TGZ.");
  assert.deepEqual(actual.fingerprint, candidate.binding.contentFingerprint);
  return candidate.binding;
}

function validateConsumerPackageBinding(binding, candidateBinding) {
  assert.deepEqual(Object.keys(binding || {}).sort(), ["contentFingerprint", "kind", "metadataPolicy", "packageName", "packageVersion", "schemaVersion", "tarball"]);
  assert.equal(binding.kind, BINDING_KIND);
  assert.equal(binding.schemaVersion, 1);
  assert.equal(binding.metadataPolicy, METADATA_POLICY);
  assert.equal(binding.packageName, candidateBinding.package.name);
  assert.equal(binding.packageVersion, candidateBinding.package.version);
  assert.deepEqual(Object.keys(binding.tarball || {}).sort(), ["sha256", "size"]);
  assert.equal(binding.tarball.sha256, candidateBinding.package.tarballSha256);
  assert.ok(Number.isSafeInteger(binding.tarball.size) && binding.tarball.size > 0 && binding.tarball.size <= MAX_PACKAGE_BYTES);
  const fingerprint = validateContentFingerprint(binding.contentFingerprint);
  assert.ok(fingerprint.fileCount > 0 && fingerprint.fileCount <= MAX_PACKAGE_FILES && fingerprint.totalSize <= MAX_PACKAGE_BYTES);
  return binding;
}

function verifyReceiptConsumerPackage(receipt, tarball) {
  const candidate = inspectCandidatePackage(tarball, receipt.candidate.package.tarballSha256);
  verifyReceiptConsumerInventory(receipt, candidate);
  return candidate.binding;
}

function verifyReceiptConsumerInventory(receipt, candidate) {
  for (const profile of receipt.profiles) {
    assert.deepEqual(profile.installedRuntime.packageBinding, candidate.binding,
      "Live proof complete consumer-package binding differs from the canonical TGZ.");
    for (const name of WINDOWS_RUNTIME_FILES) {
      const file = candidate.files.find(file => file.relativePath === name);
      assert.ok(file && file.size > 0, "Canonical TGZ is missing a Windows runtime file.");
      assert.deepEqual(profile.installedRuntime.files[name], { bytes: file.size, sha256: file.sha256 },
        "Live proof native-file evidence differs from the canonical TGZ.");
    }
  }
  return candidate.binding;
}

module.exports = { inspectCandidatePackage, verifyInstalledPackage, validateConsumerPackageBinding, verifyReceiptConsumerPackage, verifyReceiptConsumerInventory };
