#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

if (process.argv.includes("--self-test")) {
  selfTest();
  console.log("Release-candidate publish verifier self-test passed.");
} else {
  main();
}

function main() {
  const tarballArg = readArg("--tarball");
  const auditArg = readArg("--audit-manifest");
  if (!tarballArg || !auditArg) {
    throw new Error(
      "Usage: node scripts/publish-release-candidate.cjs --tarball <steam-bridge.tgz> " +
        "[--bundle-archive <steam-bridge-win-unpacked.tar>] " +
        "--audit-manifest <steam-bridge-windows-package-audit.json> " +
        "[--require-publishable|--publish --release-tag <vX.Y.Z>] [--tag <npm-tag>]"
    );
  }
  const tarball = path.resolve(tarballArg);
  const auditManifest = path.resolve(auditArg);
  const publishRequested = process.argv.includes("--publish");
  const requirePublishable = publishRequested || process.argv.includes("--require-publishable");
  const bundleArchiveArg = readArg("--bundle-archive");
  const npmTag = readArg("--tag");
  const verified = verifyReleaseCandidate(tarball, auditManifest, {
    requirePublishable,
    releaseTag: readArg("--release-tag") || process.env.GITHUB_REF_NAME || "",
    bundleArchive: bundleArchiveArg ? path.resolve(bundleArchiveArg) : undefined
  });
  console.log(`Verified canonical npm release candidate ${path.basename(tarball)} sha256=${verified.sha256}`);

  if (!publishRequested) {
    console.log("Verification-only mode; pass --publish to publish this exact tarball without repacking the workspace.");
    return;
  }
  validatePublishTag(verified.packageVersion, npmTag);
  const args = ["publish", tarball];
  if (npmTag) {
    args.push("--tag", npmTag);
  }
  const invocation = resolveNpmInvocation(args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: path.dirname(tarball),
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
  const audit = JSON.parse(fs.readFileSync(auditManifest, "utf8"));
  assert.equal(audit.schemaVersion, 1, "unsupported package audit schema");
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
  const expected = audit.package?.tarball;
  assert.ok(expected, "package audit is missing tarball identity");
  assert.equal(expected.fileName, path.basename(tarball), "tarball filename differs from the audited candidate");

  const bytes = fs.readFileSync(tarball);
  const actual = {
    size: bytes.length,
    sha1: crypto.createHash("sha1").update(bytes).digest("hex"),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    sha512: crypto.createHash("sha512").update(bytes).digest("hex"),
    integrity: `sha512-${crypto.createHash("sha512").update(bytes).digest("base64")}`
  };
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
    const archiveBytes = fs.readFileSync(bundleArchive);
    const actualArchive = {
      size: archiveBytes.length,
      sha1: crypto.createHash("sha1").update(archiveBytes).digest("hex"),
      sha256: crypto.createHash("sha256").update(archiveBytes).digest("hex"),
      sha512: crypto.createHash("sha512").update(archiveBytes).digest("hex"),
      integrity: `sha512-${crypto.createHash("sha512").update(archiveBytes).digest("base64")}`
    };
    for (const field of Object.keys(actualArchive)) {
      assert.equal(
        actualArchive[field],
        expectedArchive[field],
        `Windows bundle archive ${field} differs from the audited candidate`
      );
    }
    actual.bundleArchiveSha256 = actualArchive.sha256;
  }
  if (options.requirePublishable) {
    assert.ok(bundleArchive, "publishing requires the retained, audited Windows bundle archive");
    assert.equal(
      audit.liveSmokeCapability?.protocolPackaged,
      true,
      "publishing requires the retained Windows bundle to contain the live smoke protocol"
    );
    assert.equal(audit.signing?.required, true, "publishing requires an audit produced by the signed package gate");
    for (const fileName of [
      "appExecutable",
      "steam_bridge_native.win32-x64-msvc.node",
      "steam_api64.dll",
      "sdkencryptedappticket64.dll"
    ]) {
      assert.equal(
        audit.finalBundle?.authenticode?.[fileName]?.status,
        "Valid",
        `publishing requires valid Authenticode evidence for ${fileName}`
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
    assert.equal(
      audit.signing?.publisherMatches?.appExecutable,
      true,
      "publishing requires the Electron executable to match the expected publisher"
    );
    assert.equal(
      audit.signing?.publisherMatches?.nativeAddon,
      true,
      "publishing requires the native addon to match the expected publisher"
    );
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
    const bundleBytes = Buffer.from("retained signed Windows bundle bytes");
    fs.writeFileSync(bundleArchive, bundleBytes);
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
        schemaVersion: 1,
        package: {
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
        signing: {
          required: true,
          publisherMatches: { appExecutable: true, nativeAddon: true }
        },
        finalBundle: {
          archive: {
            fileName: path.basename(bundleArchive),
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
        release: { gitCommit: "0123456789abcdef", gitRefName: "v0.1.0" }
      })}\n`
    );
    assert.equal(verifyReleaseCandidate(tarball, audit).sha256, expected.sha256);
    assert.equal(
      verifyReleaseCandidate(tarball, audit, {
        requirePublishable: true,
        releaseTag: "v0.1.0",
        bundleArchive
      }).sha256,
      expected.sha256
    );
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

function assertNonEmptyFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile() || fs.statSync(filePath).size === 0) {
    throw new Error(`Missing or empty ${label}: ${filePath}`);
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

module.exports = { verifyReleaseCandidate };
