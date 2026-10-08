const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const tar = require("tar");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
const {
  inspectCandidatePackage,
  verifyInstalledPackage,
  verifyReceiptConsumerPackage
} = require("../scripts/windows-consumer-package-binding.cjs");

function fixture(callback) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "steam-bridge-package-binding-test-"));
  try {
    const installed = path.join(root, "installed");
    fs.mkdirSync(path.join(installed, "dist"), { recursive: true });
    fs.mkdirSync(path.join(installed, "templates"));
    const files = {
      "package.json": JSON.stringify({ name: "steam-bridge", version: "1.2.3", exports: { "./electron": "./dist/electron.js" } }),
      "README.md": "synthetic package",
      "dist/electron.js": "canonical producer",
      "templates/electron-input-preload.cjs": "canonical preload",
      "steam_bridge_native.win32-x64-msvc.node": "synthetic native, never loaded",
      "steam_api64.dll": "synthetic steam, never loaded",
      "sdkencryptedappticket64.dll": "synthetic ticket, never loaded"
    };
    for (const [file, bytes] of Object.entries(files)) fs.writeFileSync(path.join(installed, file), bytes);
    const archive = path.join(root, "candidate.tgz");
    tar.create({ cwd: installed, file: archive, sync: true, gzip: true, portable: true, noMtime: true, prefix: "package" }, Object.keys(files));
    const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    const sha256 = digest(archive);
    const candidate = inspectCandidatePackage(archive, sha256);
    callback({ root, installed, archive, sha256, digest, candidate, files });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("complete ordinary install binds exact TGZ metadata and all seven synthetic files", () => fixture(({ installed, candidate, sha256 }) => {
  assert.deepEqual(verifyInstalledPackage(installed, candidate), candidate.binding);
  assert.equal(candidate.binding.tarball.sha256, sha256);
  assert.equal(candidate.binding.contentFingerprint.fileCount, 7);
  assert.equal(candidate.binding.metadataPolicy, "normal-install-exact-bytes-v1");
}));

test("canonical inventory reads only pinned archive bytes without mutable extraction", () => fixture(({ archive, sha256, candidate }) => {
  const originalMkdir = fs.mkdtempSync;
  const originalWrite = fs.writeFileSync;
  fs.mkdtempSync = fs.writeFileSync = () => { throw new Error("Canonical inventory must not write temporary files."); };
  try {
    assert.deepEqual(inspectCandidatePackage(archive, sha256), candidate);
  } finally {
    fs.mkdtempSync = originalMkdir;
    fs.writeFileSync = originalWrite;
  }
}));

test("publisher self-test uses physical temporary storage even when the OS temp path is an alias", () => fixture(({ root }) => {
  const physical = path.join(root, "physical-temp");
  const alias = path.join(root, "alias-temp");
  fs.mkdirSync(physical);
  fs.symlinkSync(physical, alias, process.platform === "win32" ? "junction" : "dir");
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/publish-release-candidate.cjs"), "--self-test"], {
    env: { ...process.env, TEMP: alias, TMP: alias, TMPDIR: alias },
    encoding: "utf8", timeout: 30000, windowsHide: true
  });
  assert.equal(result.status, 0, "Publisher self-test must canonicalize its owned temporary root: " + result.stderr);
  assert.match(result.stdout, /Release-candidate publish verifier self-test passed/);
}));

for (const file of ["dist/electron.js", "templates/electron-input-preload.cjs", "package.json", "README.md"]) {
  test("rejects changed " + file + " with unchanged native files", () => fixture(({ installed, candidate, files }) => {
    fs.writeFileSync(path.join(installed, file), "x".repeat(Buffer.byteLength(files[file])));
    assert.throws(() => verifyInstalledPackage(installed, candidate), /Complete consumer package differs/);
  }));
  test("rejects missing " + file + " with unchanged native files", () => fixture(({ installed, candidate }) => {
    fs.unlinkSync(path.join(installed, file));
    assert.throws(() => verifyInstalledPackage(installed, candidate), /Complete consumer package differs/);
  }));
}

test("rejects extra files before reading their contents, and extra empty directories", () => fixture(({ installed, candidate }) => {
  const extra = path.join(installed, ".env");
  fs.writeFileSync(extra, "synthetic forbidden extra");
  assert.throws(() => verifyInstalledPackage(installed, candidate), /Complete consumer package differs/);
  fs.unlinkSync(extra);
  fs.mkdirSync(path.join(installed, "unexpected"));
  assert.throws(() => verifyInstalledPackage(installed, candidate), /extra directory/);
}));

test("rejects hard-linked installed files and TGZ", () => fixture(({ root, installed, archive, sha256, candidate }) => {
  fs.linkSync(path.join(installed, "dist/electron.js"), path.join(root, "linked-producer"));
  assert.throws(() => verifyInstalledPackage(installed, candidate), /hard link/);
  fs.linkSync(archive, path.join(root, "linked-archive"));
  assert.throws(() => inspectCandidatePackage(archive, sha256), /hard linked/);
}));

test("rejects a package directory junction before reading its target", () => fixture(({ root, installed, candidate }) => {
  const target = path.join(root, "linked-dist");
  fs.renameSync(path.join(installed, "dist"), target);
  fs.symlinkSync(target, path.join(installed, "dist"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => verifyInstalledPackage(installed, candidate), /link/);
}));

test("rejects an extra file introduced after preflight before reading it", () => fixture(({ installed, candidate }) => {
  const originalReadDir = fs.readdirSync;
  const originalOpen = fs.openSync;
  let rootReads = 0;
  let extraOpened = false;
  const extra = path.join(installed, ".env");
  fs.readdirSync = function (directory, ...args) {
    if (directory === installed && ++rootReads === 2) fs.writeFileSync(extra, "synthetic forbidden extra");
    return originalReadDir.call(this, directory, ...args);
  };
  fs.openSync = function (file, ...args) {
    if (file === extra && args[0] === "r") extraOpened = true;
    return originalOpen.call(this, file, ...args);
  };
  try {
    assert.throws(() => verifyInstalledPackage(installed, candidate), /Complete consumer package differs/);
    assert.equal(extraOpened, false);
  } finally {
    fs.readdirSync = originalReadDir;
    fs.openSync = originalOpen;
  }
}));

test("rejects altered TGZ and forged downstream full-package fingerprint", () => fixture(({ installed, archive, candidate, sha256 }) => {
  const runtimeFiles = Object.fromEntries(candidate.files.filter(file => file.relativePath.endsWith(".node") || file.relativePath.endsWith(".dll"))
    .map(file => [file.relativePath, { bytes: file.size, sha256: file.sha256 }]));
  const receipt = { candidate: { package: { tarballSha256: sha256 } }, profiles: [{ installedRuntime: { packageBinding: candidate.binding, files: runtimeFiles } }] };
  assert.deepEqual(verifyReceiptConsumerPackage(receipt, archive), candidate.binding);
  const forged = structuredClone(receipt);
  forged.profiles[0].installedRuntime.packageBinding.contentFingerprint.sha256 = "0".repeat(64);
  assert.throws(() => verifyReceiptConsumerPackage(forged, archive), /differs from the canonical TGZ/);
  const conflictingNative = structuredClone(receipt);
  conflictingNative.profiles[0].installedRuntime.files["steam_bridge_native.win32-x64-msvc.node"].sha256 = "0".repeat(64);
  assert.throws(() => verifyReceiptConsumerPackage(conflictingNative, archive), /native-file evidence differs/);
  fs.appendFileSync(archive, "changed");
  assert.throws(() => inspectCandidatePackage(archive, sha256), /TGZ bytes differ/);
  assert.deepEqual(verifyInstalledPackage(installed, candidate), candidate.binding);
}));

for (const name of ["package/../escape", "package/CON.txt", "package/stream:payload", "package/back\\slash", "/absolute", "package/trailing."]) {
  test("rejects unsafe archive path " + name + " before inventory admission", () => fixture(({ root, archive, digest }) => {
    const bytes = zlib.gunzipSync(fs.readFileSync(archive));
    bytes.fill(0, 0, 100);
    bytes.write(name, 0, "utf8");
    bytes.fill(32, 148, 156);
    const checksum = bytes.subarray(0, 512).reduce((sum, value) => sum + value, 0);
    bytes.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
    const unsafe = path.join(root, "unsafe.tgz");
    fs.writeFileSync(unsafe, zlib.gzipSync(bytes));
    assert.throws(() => inspectCandidatePackage(unsafe, digest(unsafe)), /TGZ|traversal|Windows/);
    assert.equal(fs.existsSync(path.join(root, "escape")), false);
  }));
}

for (const name of ["package/README.md", "package/readme.md", "package/dist"]) {
  test("rejects duplicate or file/directory archive collision " + name, () => fixture(({ root, archive, digest }) => {
    const bytes = zlib.gunzipSync(fs.readFileSync(archive));
    bytes.fill(0, 0, 100);
    bytes.write(name, 0, "utf8");
    bytes.fill(32, 148, 156);
    const checksum = bytes.subarray(0, 512).reduce((sum, value) => sum + value, 0);
    bytes.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
    const collision = path.join(root, "collision.tgz");
    fs.writeFileSync(collision, zlib.gzipSync(bytes));
    assert.throws(() => inspectCandidatePackage(collision, digest(collision)), /collision/);
  }));
}

for (const type of ["1", "2", "5"]) {
  test("rejects archive hard links, symbolic links and directory entries: " + type, () => fixture(({ root, archive, digest }) => {
    const bytes = zlib.gunzipSync(fs.readFileSync(archive));
    bytes.write(type, 156, "ascii");
    if (type !== "5") bytes.write("package/README.md", 157, "ascii");
    bytes.fill(32, 148, 156);
    const checksum = bytes.subarray(0, 512).reduce((sum, value) => sum + value, 0);
    bytes.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
    const linked = path.join(root, "linked.tgz");
    fs.writeFileSync(linked, zlib.gzipSync(bytes));
    assert.throws(() => inspectCandidatePackage(linked, digest(linked)), /unsupported entry/);
  }));
}

test("rejects a truncated archive entry before binding", () => fixture(({ root, archive, digest }) => {
  const bytes = zlib.gunzipSync(fs.readFileSync(archive));
  const truncated = path.join(root, "truncated.tgz");
  fs.writeFileSync(truncated, zlib.gzipSync(bytes.subarray(0, 514)));
  assert.throws(() => inspectCandidatePackage(truncated, digest(truncated)), /truncated|TAR_BAD_ARCHIVE|unexpected EOF|incomplete/i);
}));

for (const variant of ["missing-end", "trailing-partial-header", "data-after-end"]) {
  test("rejects incomplete or hidden archive contents: " + variant, () => fixture(({ root, archive, digest }) => {
    const bytes = zlib.gunzipSync(fs.readFileSync(archive));
    let changed;
    if (variant === "missing-end") changed = bytes.subarray(0, bytes.length - 1024);
    else if (variant === "trailing-partial-header") changed = Buffer.concat([bytes.subarray(0, bytes.length - 1024), Buffer.alloc(100)]);
    else changed = Buffer.concat([bytes, bytes.subarray(0, 1024)]);
    const invalid = path.join(root, variant + ".tgz");
    fs.writeFileSync(invalid, zlib.gzipSync(changed));
    assert.throws(() => inspectCandidatePackage(invalid, digest(invalid)), /framing|end markers|data after/);
  }));
}
