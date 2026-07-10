#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const asar = require("@electron/asar");
const { Arch, Platform, build } = require("electron-builder");
const tar = require("tar");
const {
  WINDOWS_RUNTIME_FILES,
  assertMatchingRuntimeFiles,
  inspectWindowsRuntimeDirectory,
  resolvePackagedWindowsRuntimeDirectory
} = require("./verify-windows-packaged-artifacts.cjs");

const repoRoot = path.resolve(__dirname, "..");
const packageRoot = path.join(repoRoot, "packages", "steam-bridge");
const exampleRoot = path.join(repoRoot, "examples", "electron-basic");
const fixtureRoot = path.join(repoRoot, "fixtures", "windows-electron-builder-asar");
const fixtureConfig = require(path.join(fixtureRoot, "electron-builder.config.cjs"));
const outputRoot = path.resolve(readArg("--output-dir") || path.join(repoRoot, "dist", "windows-electron-builder-asar"));
const requestedTarball = readArg("--tarball");
const keepStage = process.argv.includes("--keep-stage") || process.env.STEAM_BRIDGE_KEEP_WINDOWS_ASAR_STAGE === "1";
const requireSigned = process.argv.includes("--require-signed");
const expectedPublisherSubject =
  readArg("--expected-publisher-subject") || process.env.STEAM_BRIDGE_WINDOWS_EXPECTED_PUBLISHER_SUBJECT || "";
const expectedPublisherThumbprintInput =
  readArg("--expected-publisher-thumbprint") || process.env.STEAM_BRIDGE_WINDOWS_EXPECTED_PUBLISHER_THUMBPRINT || "";
const expectedPublisherThumbprint = normalizeThumbprint(expectedPublisherThumbprintInput);
const allPublishArtifacts = Object.freeze([
  "steam_bridge_native.darwin-arm64.node",
  "libsteam_api.dylib",
  "libsdkencryptedappticket.dylib",
  ...WINDOWS_RUNTIME_FILES,
  "steam_bridge_native.linux-x64-gnu.node",
  "libsteam_api.so",
  "libsdkencryptedappticket.so"
]);
const liveSmokeFiles = Object.freeze([
  "main.js",
  "preload.js",
  "index.html",
  "smoke-sanitize.cjs",
  "smoke-error.cjs",
  "checkout-proof.cjs"
]);
const windowsToolFiles = Object.freeze([
  "sign-windows-package.ps1",
  "summarize-windows-overlay-matrix.cjs",
  "upsert-steam-app-launch-options.cjs",
  "upsert-steam-shortcut.cjs",
  "windows-app-control-dev-mode.ps1",
  "windows-electron-smoke.ps1",
  "windows-native-overlay-control.ps1",
  "windows-overlay-matrix.ps1",
  "windows-overlay-task.ps1",
  "windows-render-health-probe.ps1",
  "windows-steam-app-launch-options.ps1"
]);

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    selfTest();
    console.log("Windows electron-builder ASAR gate self-test passed.");
  } else {
    main().catch((error) => {
      console.error(error);
      preserveFailureExitCode();
    });
  }
}

async function main() {
  assert.equal(process.platform, "win32", "The Windows electron-builder ASAR gate must run on Windows.");
  assert.equal(process.arch, "x64", "The Windows electron-builder ASAR gate must run in an x64 Node.js process.");
  if (process.env.STEAM_BRIDGE_NATIVE_PATH) {
    throw new Error("Unset STEAM_BRIDGE_NATIVE_PATH before running the exact package gate.");
  }
  if (expectedPublisherThumbprintInput && expectedPublisherThumbprint.length !== 40) {
    throw new Error("The expected Windows publisher thumbprint must contain exactly 40 hexadecimal characters.");
  }
  if (requireSigned && !expectedPublisherSubject && !expectedPublisherThumbprint) {
    throw new Error(
      "--require-signed also requires --expected-publisher-subject or --expected-publisher-thumbprint."
    );
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-windows-asar-gate-"));
  const packDir = path.join(tempRoot, "pack");
  const extractDir = path.join(tempRoot, "extract");
  const stageDir = path.join(tempRoot, "app");
  fs.mkdirSync(packDir);
  fs.mkdirSync(extractDir);
  fs.mkdirSync(stageDir);

  try {
    let requestedTarballPath;
    if (requestedTarball) {
      requestedTarballPath = path.resolve(requestedTarball);
      assertNonEmptyFile(requestedTarballPath, "requested publish tarball");
      if (isPathInside(outputRoot, requestedTarballPath)) {
        const preservedTarball = path.join(packDir, path.basename(requestedTarballPath));
        fs.copyFileSync(requestedTarballPath, preservedTarball);
        requestedTarballPath = preservedTarball;
      }
    }
    fs.rmSync(outputRoot, { recursive: true, force: true });
    fs.mkdirSync(outputRoot, { recursive: true });
    const packed = requestedTarball ? undefined : packSteamBridge(packDir);
    const tarball = requestedTarballPath || packed.tarball;
    assertNonEmptyFile(tarball, "publish tarball");
    const tarballHashes = hashFile(tarball);
    if (packed) {
      assert.equal(packed.metadata.integrity, tarballHashes.integrity, "npm pack integrity must match tarball bytes");
      assert.equal(packed.metadata.shasum, tarballHashes.sha1, "npm pack shasum must match tarball bytes");
      const packedFiles = new Set((packed.metadata.files || []).map((file) => file.path));
      for (const fileName of allPublishArtifacts) {
        assert.ok(packedFiles.has(fileName), `npm pack manifest is missing ${fileName}`);
      }
    }

    extractTarball(tarball, extractDir);
    const extractedPackageRoot = path.join(extractDir, "package");
    const packageJson = readJson(path.join(extractedPackageRoot, "package.json"));
    assert.equal(packageJson.name, "steam-bridge");
    for (const fileName of allPublishArtifacts) {
      assertNonEmptyFile(path.join(extractedPackageRoot, fileName), `publish artifact ${fileName}`);
    }
    const sourceRuntime = inspectWindowsRuntimeDirectory(extractedPackageRoot);

    stageFixture(stageDir, tarball, packageJson.version, tarballHashes, sourceRuntime);
    installExactTarball(stageDir);
    const installedPackageRoot = path.join(stageDir, "node_modules", "steam-bridge");
    const installedRuntime = inspectWindowsRuntimeDirectory(installedPackageRoot);
    assertMatchingRuntimeFiles(sourceRuntime, installedRuntime, "tarball", "installed package");
    assertNoPostInstallRepair(stageDir, sourceRuntime, installedRuntime);

    const provenancePath = path.join(stageDir, "steam-bridge-package-provenance.json");
    const provenance = readJson(provenancePath);
    const hookEvidence = { afterPack: null, afterSign: null };
    const config = {
      ...fixtureConfig,
      directories: { output: outputRoot },
      win: {
        ...fixtureConfig.win,
        forceCodeSigning: requireSigned
      },
      afterPack: async (context) => {
        const appRuntimeDir = resolvePackagedWindowsRuntimeDirectory(context.appOutDir);
        const appRuntime = inspectWindowsRuntimeDirectory(appRuntimeDir);
        assertMatchingRuntimeFiles(sourceRuntime, appRuntime, "tarball", "electron-builder afterPack");
        hookEvidence.afterPack = packageRuntimeEvidence(context.appOutDir, appRuntimeDir, appRuntime);
      },
      afterSign: async (context) => {
        const appRuntimeDir = resolvePackagedWindowsRuntimeDirectory(context.appOutDir);
        const appRuntime = inspectWindowsRuntimeDirectory(appRuntimeDir);
        hookEvidence.afterSign = packageRuntimeEvidence(context.appOutDir, appRuntimeDir, appRuntime);
      }
    };

    await build({
      projectDir: stageDir,
      targets: Platform.WINDOWS.createTarget("dir", Arch.x64),
      config
    });
    assert.ok(hookEvidence.afterPack, "electron-builder afterPack evidence was not collected");

    const appDir = path.join(outputRoot, "win-unpacked");
    const appExe = path.join(appDir, "SteamBridgeSmoke.exe");
    assertNonEmptyFile(appExe, "packaged Electron executable");
    const finalRuntimeDir = resolvePackagedWindowsRuntimeDirectory(appDir);
    const finalRuntime = inspectWindowsRuntimeDirectory(finalRuntimeDir);
    assertMatchingRuntimeFiles(sourceRuntime, finalRuntime, "tarball", "final Electron bundle", {
      allowAuthenticodeChanges: true
    });
    const runtimeDllPreservation = assertRuntimeDllBytesPreserved(sourceRuntime, finalRuntime);
    verifyAsarLayout(appDir, provenance, packageJson);
    const checkoutValidatorProbe = verifyCheckoutValidatorToolTree(appDir);
    const liveSmokeCapability = verifyLiveSmokeCapability(appDir);

    const signatures = getAuthenticodeEvidence({
      appExecutable: appExe,
      [WINDOWS_RUNTIME_FILES[0]]: path.join(finalRuntimeDir, WINDOWS_RUNTIME_FILES[0]),
      [WINDOWS_RUNTIME_FILES[1]]: path.join(finalRuntimeDir, WINDOWS_RUNTIME_FILES[1]),
      [WINDOWS_RUNTIME_FILES[2]]: path.join(finalRuntimeDir, WINDOWS_RUNTIME_FILES[2])
    });
    const publisherMatches = {
      appExecutable: false,
      nativeAddon: false
    };
    if (requireSigned) {
      for (const [fileName, signature] of Object.entries(signatures)) {
        assert.equal(signature.status, "Valid", `${fileName} must have a valid Authenticode signature`);
      }
      assertExpectedPublisher(signatures.appExecutable, "packaged Electron executable");
      assertExpectedPublisher(signatures[WINDOWS_RUNTIME_FILES[0]], "Steam Bridge native addon");
      publisherMatches.appExecutable = true;
      publisherMatches.nativeAddon = true;
    }

    const executableProbe = runPackagedExecutable(appExe, outputRoot);
    const bundleArchive = createDeterministicBundleArchive(
      appDir,
      path.join(outputRoot, `steam-bridge-${packageJson.version}-windows-x64-win-unpacked.tar`)
    );
    const manifest = {
      schemaVersion: 1,
      target: "x86_64-pc-windows-msvc",
      package: {
        name: packageJson.name,
        version: packageJson.version,
        tarball: {
          fileName: path.basename(tarball),
          size: tarballHashes.size,
          sha1: tarballHashes.sha1,
          sha256: tarballHashes.sha256,
          sha512: tarballHashes.sha512,
          integrity: tarballHashes.integrity,
          exactPublishArtifacts: [...allPublishArtifacts]
        }
      },
      electronBuilder: {
        version: require("electron-builder/package.json").version,
        electronVersion: fixtureConfig.electronVersion,
        asar: true,
        smartUnpack: false,
        asarUnpack: [...fixtureConfig.asarUnpack],
        signExts: [...fixtureConfig.win.signExts]
      },
      source: packageRuntimeEvidence(extractedPackageRoot, extractedPackageRoot, sourceRuntime),
      installed: packageRuntimeEvidence(stageDir, installedPackageRoot, installedRuntime),
      afterPack: hookEvidence.afterPack,
      afterSign: {
        hookInvoked: Boolean(hookEvidence.afterSign),
        ...(hookEvidence.afterSign || packageRuntimeEvidence(appDir, finalRuntimeDir, finalRuntime))
      },
      finalBundle: {
        ...packageRuntimeEvidence(appDir, finalRuntimeDir, finalRuntime),
        authenticode: signatures,
        runtimeDllPreservation,
        archive: bundleArchive
      },
      signing: {
        required: requireSigned,
        expectedPublisherSubjectConfigured: Boolean(expectedPublisherSubject),
        expectedPublisherThumbprintConfigured: Boolean(expectedPublisherThumbprint),
        publisherMatches
      },
      release: {
        gitCommit: process.env.GITHUB_SHA || readGitValue(["rev-parse", "HEAD"]),
        gitRefName: process.env.GITHUB_REF_NAME || readGitValue(["branch", "--show-current"])
      },
      executableProbe,
      checkoutValidatorProbe,
      liveSmokeCapability
    };
    const manifestPath = path.join(outputRoot, "steam-bridge-windows-package-audit.json");
    writeJson(manifestPath, manifest);
    fs.copyFileSync(tarball, path.join(outputRoot, path.basename(tarball)));
    console.log(`Windows electron-builder ASAR package gate passed: ${manifestPath}`);
  } finally {
    if (keepStage) {
      console.log(`Keeping Windows ASAR gate stage: ${tempRoot}`);
    } else {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

function packSteamBridge(packDir) {
  run("npm", ["run", "build", "-w", "steam-bridge"], repoRoot);
  const result = run("npm", ["pack", "--json", "--pack-destination", packDir], packageRoot, {
    encoding: "utf8"
  });
  const metadata = JSON.parse(result.stdout)[0];
  if (!metadata?.filename) {
    throw new Error("npm pack did not return a steam-bridge tarball.");
  }
  return { metadata, tarball: path.join(packDir, metadata.filename) };
}

function extractTarball(tarball, extractDir) {
  run("tar", ["-xzf", tarball, "-C", extractDir], repoRoot);
}

function stageFixture(stageDir, tarball, packageVersion, tarballHashes, sourceRuntime) {
  fs.copyFileSync(path.join(fixtureRoot, "main.cjs"), path.join(stageDir, "main.cjs"));
  const smokeDir = path.join(stageDir, "smoke");
  fs.mkdirSync(smokeDir);
  for (const fileName of liveSmokeFiles) {
    fs.copyFileSync(path.join(exampleRoot, fileName), path.join(smokeDir, fileName));
  }
  const toolsDir = path.join(stageDir, "windows-tools");
  fs.mkdirSync(toolsDir);
  for (const fileName of windowsToolFiles) {
    fs.copyFileSync(path.join(repoRoot, "scripts", fileName), path.join(toolsDir, fileName));
  }
  fs.copyFileSync(path.join(exampleRoot, "checkout-proof.cjs"), path.join(toolsDir, "checkout-proof.cjs"));
  fs.cpSync(
    path.join(repoRoot, "scripts", "windows-native-overlay-control"),
    path.join(toolsDir, "windows-native-overlay-control"),
    { recursive: true }
  );
  fs.writeFileSync(path.join(toolsDir, "steam_appid.txt"), "480\n");
  const packageInputDir = path.join(stageDir, ".package-input");
  fs.mkdirSync(packageInputDir);
  fs.copyFileSync(tarball, path.join(packageInputDir, "steam-bridge.tgz"));
  writeJson(path.join(stageDir, "package.json"), {
    name: "steam-bridge-windows-asar-gate",
    version: "0.0.0",
    private: true,
    main: "main.cjs",
    dependencies: {
      "steam-bridge": "file:.package-input/steam-bridge.tgz"
    }
  });
  writeJson(path.join(stageDir, "steam-bridge-package-provenance.json"), {
    schemaVersion: 1,
    source: "exact-npm-pack-tarball",
    packageName: "steam-bridge",
    packageVersion,
    target: "x86_64-pc-windows-msvc",
    tarball: {
      fileName: path.basename(tarball),
      size: tarballHashes.size,
      sha1: tarballHashes.sha1,
      sha256: tarballHashes.sha256,
      sha512: tarballHashes.sha512,
      integrity: tarballHashes.integrity
    },
    windowsRuntime: sourceRuntime.files
  });
}

function installExactTarball(stageDir) {
  assert.ok(!fs.existsSync(path.join(stageDir, "node_modules")), "Fixture must be empty before exact tarball install");
  run(
    "npm",
    ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock"],
    stageDir
  );
}

function assertNoPostInstallRepair(stageDir, sourceRuntime, installedRuntime) {
  assertMatchingRuntimeFiles(sourceRuntime, installedRuntime, "tarball", "installed package");
  const repairNames = ["steam_bridge_native.local.node", "steam_bridge_native.node"];
  for (const fileName of repairNames) {
    assert.ok(
      !fs.existsSync(path.join(stageDir, "node_modules", "steam-bridge", fileName)),
      `Exact tarball fixture must not contain repair artifact ${fileName}`
    );
  }
}

function verifyAsarLayout(appDir, expectedProvenance, expectedPackageJson) {
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, "app.asar");
  assertNonEmptyFile(asarPath, "app.asar");
  assert.ok(!fs.existsSync(path.join(resourcesDir, "app")), "ASAR gate must not contain a loose resources/app tree");
  const publicExportEntries = Object.entries(expectedPackageJson.exports || {}).map(([exportName, exportTarget]) => {
    const defaultTarget = typeof exportTarget === "string" ? exportTarget : exportTarget?.default;
    assert.equal(typeof defaultTarget, "string", `Steam Bridge export ${exportName} must have a default target`);
    assert.match(defaultTarget, /^\.\//, `Steam Bridge export ${exportName} must have a package-relative default target`);
    return ["node_modules", "steam-bridge", ...defaultTarget.slice(2).split("/")];
  });

  for (const entryParts of [
    ["main.cjs"],
    ...liveSmokeFiles.map((fileName) => ["smoke", fileName]),
    ["steam-bridge-package-provenance.json"],
    ["node_modules", "steam-bridge", "package.json"],
    ...publicExportEntries,
    ["node_modules", "steam-bridge", "dist", "generated-steamworks-enums.js"],
    ["node_modules", "steam-bridge", "dist", "native.js"]
  ]) {
    const relativePath = asarEntryPath(entryParts);
    const stat = asar.statFile(asarPath, relativePath);
    assert.equal(Boolean(stat.unpacked), false, `${entryParts.join("/")} must remain archived in app.asar`);
  }
  assert.ok(
    !asar.listPackage(asarPath).some((entry) => entry.includes(".package-input")),
    "The stable tarball install input must not be packaged into app.asar"
  );
  const archivedFixturePackage = JSON.parse(
    asar.extractFile(asarPath, asarEntryPath(["package.json"])).toString("utf8")
  );
  assert.equal(
    archivedFixturePackage.dependencies?.["steam-bridge"],
    "file:.package-input/steam-bridge.tgz",
    "Archived fixture metadata must use a stable relative tarball reference"
  );
  const archivedSteamBridgePackage = JSON.parse(
    asar
      .extractFile(asarPath, asarEntryPath(["node_modules", "steam-bridge", "package.json"]))
      .toString("utf8")
  );
  assert.equal(archivedSteamBridgePackage.name, expectedPackageJson.name);
  assert.equal(archivedSteamBridgePackage.version, expectedPackageJson.version);
  assert.equal(archivedSteamBridgePackage.main, expectedPackageJson.main);
  assert.deepEqual(
    archivedSteamBridgePackage.exports,
    expectedPackageJson.exports,
    "Archived Steam Bridge entrypoints must match the exact tarball"
  );
  for (const fileName of WINDOWS_RUNTIME_FILES) {
    const relativePath = asarEntryPath(["node_modules", "steam-bridge", fileName]);
    const stat = asar.statFile(asarPath, relativePath);
    assert.equal(
      Boolean(stat.unpacked),
      true,
      `node_modules/steam-bridge/${fileName} must be marked ASAR-unpacked`
    );
  }

  const physicalPackageDir = path.join(resourcesDir, "app.asar.unpacked", "node_modules", "steam-bridge");
  const physicalFiles = listFiles(physicalPackageDir).map((filePath) => normalizeRelativePath(path.relative(physicalPackageDir, filePath)));
  assert.deepEqual(physicalFiles.sort(), [...WINDOWS_RUNTIME_FILES].sort(), "Only the exact Windows runtime trio may be unpacked");

  const archivedProvenance = JSON.parse(
    asar.extractFile(asarPath, asarEntryPath(["steam-bridge-package-provenance.json"])).toString("utf8")
  );
  assert.deepEqual(archivedProvenance, expectedProvenance, "Archived provenance must match the exact tarball stage");
}

function runPackagedExecutable(appExe, artifactDir) {
  const resultPath = path.join(artifactDir, "electron-native-load-result.json");
  const profileRoot = path.join(artifactDir, ".electron-probe-profile");
  fs.rmSync(resultPath, { force: true });
  fs.rmSync(profileRoot, { recursive: true, force: true });
  let result;
  try {
    result = spawnSync(appExe, [`--steam-bridge-package-probe-result=${resultPath}`], {
      cwd: path.dirname(appExe),
      env: isolatedCandidateEnvironment(profileRoot),
      encoding: "utf8",
      timeout: 60000,
      windowsHide: true
    });
  } finally {
    fs.rmSync(profileRoot, { recursive: true, force: true });
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Packaged Electron native-load probe failed with status ${result.status}: ${[result.stderr, result.stdout]
        .filter(Boolean)
        .join("\n")}`
    );
  }
  const probe = readJson(resultPath);
  assert.equal(probe.ok, true);
  assert.equal(probe.appPackaged, true);
  assert.equal(probe.platform, "win32");
  assert.equal(probe.arch, "x64");
  assert.equal(probe.packageEntryInAsar, true);
  assert.equal(probe.physicalAddonPresent, true);
  assert.equal(probe.nativeOverridePresent, false);
  assert.equal(probe.steamRunningType, "boolean");
  assert.equal(probe.needsPresentPollingEnabledType, "boolean");
  return probe;
}

function verifyCheckoutValidatorToolTree(appDir) {
  const toolRoot = path.join(appDir, "resources", "steam-bridge-tools");
  const validator = path.join(toolRoot, "bin", "validate-checkout-target.cjs");
  const runtimeEntry = path.join(toolRoot, "dist", "index.js");
  assertNonEmptyFile(validator, "external checkout validator CLI");
  assertNonEmptyFile(runtimeEntry, "external checkout validator runtime");
  const profileRoot = path.join(outputRoot, ".validator-probe-profile");
  fs.rmSync(profileRoot, { recursive: true, force: true });
  try {
    run(process.execPath, [validator, "--self-test"], appDir, {
      env: isolatedCandidateEnvironment(profileRoot)
    });
  } finally {
    fs.rmSync(profileRoot, { recursive: true, force: true });
  }
  return {
    ok: true,
    packageRelativeTree: true,
    validator: normalizeRelativePath(path.relative(appDir, validator)),
    runtimeEntry: normalizeRelativePath(path.relative(appDir, runtimeEntry))
  };
}

function verifyLiveSmokeCapability(appDir) {
  const asarPath = path.join(appDir, "resources", "app.asar");
  const sourceHashes = {};
  for (const fileName of liveSmokeFiles) {
    const archived = asar.extractFile(asarPath, asarEntryPath(["smoke", fileName]));
    const source = fs.readFileSync(path.join(exampleRoot, fileName));
    const archivedSha256 = crypto.createHash("sha256").update(archived).digest("hex");
    const sourceSha256 = crypto.createHash("sha256").update(source).digest("hex");
    assert.equal(archivedSha256, sourceSha256, `Archived live smoke source differs for ${fileName}`);
    sourceHashes[fileName] = archivedSha256;
  }

  const smokeMain = asar.extractFile(asarPath, asarEntryPath(["smoke", "main.js"])).toString("utf8");
  for (const marker of [
    "--steam-bridge-smoke-autorun-action",
    "STEAM_BRIDGE_SMOKE_RESULT_FILE",
    "presenter-ready",
    "ensureElectronSteamOverlay"
  ]) {
    assert.ok(smokeMain.includes(marker), `Archived live smoke protocol is missing ${marker}`);
  }

  const packagedTools = [...windowsToolFiles, "checkout-proof.cjs", "steam_appid.txt"];
  const toolHashes = {};
  for (const fileName of packagedTools) {
    const packagedPath = path.join(appDir, fileName);
    assertNonEmptyFile(packagedPath, `packaged live smoke tool ${fileName}`);
    if (fileName !== "steam_appid.txt") {
      const sourcePath =
        fileName === "checkout-proof.cjs"
          ? path.join(exampleRoot, fileName)
          : path.join(repoRoot, "scripts", fileName);
      const packagedSha256 = hashFile(packagedPath).sha256;
      const sourceSha256 = hashFile(sourcePath).sha256;
      assert.equal(packagedSha256, sourceSha256, `Packaged live smoke tool differs from source: ${fileName}`);
      toolHashes[fileName] = packagedSha256;
    }
  }
  assert.equal(fs.readFileSync(path.join(appDir, "steam_appid.txt"), "utf8").trim(), "480");
  assertDirectory(
    path.join(appDir, "windows-native-overlay-control"),
    "packaged Windows native overlay control source"
  );

  return {
    protocolPackaged: true,
    executable: "SteamBridgeSmoke.exe",
    publicAppId: "480",
    sourceHashes,
    toolHashes,
    packagedTools
  };
}

function assertRuntimeDllBytesPreserved(sourceRuntime, finalRuntime) {
  const evidence = {};
  for (const fileName of WINDOWS_RUNTIME_FILES.slice(1)) {
    const sourceSha256 = sourceRuntime.files[fileName].sha256;
    const finalSha256 = finalRuntime.files[fileName].sha256;
    assert.equal(
      finalSha256,
      sourceSha256,
      `${fileName} must retain its exact upstream bytes and Authenticode signature`
    );
    evidence[fileName] = {
      preserved: true,
      sourceSha256,
      finalSha256
    };
  }
  return evidence;
}

function createDeterministicBundleArchive(appDir, archivePath) {
  const files = listFiles(appDir)
    .map((filePath) => normalizeRelativePath(path.relative(appDir, filePath)))
    .sort();
  assert.ok(files.length > 0, "Packaged Windows bundle must contain files before archiving");
  fs.rmSync(archivePath, { force: true });
  tar.create(
    {
      cwd: appDir,
      file: archivePath,
      sync: true,
      portable: true,
      noMtime: true,
      prefix: "win-unpacked"
    },
    files
  );
  assertNonEmptyFile(archivePath, "retained Windows bundle archive");
  return {
    fileName: path.basename(archivePath),
    rootDirectory: "win-unpacked",
    fileCount: files.length,
    ...hashFile(archivePath)
  };
}

function getAuthenticodeEvidence(files) {
  const evidence = {};
  for (const [label, filePath] of Object.entries(files)) {
    const env = sanitizedChildEnvironment(process.env, { STEAM_BRIDGE_SIGNATURE_FILE: filePath });
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$signature = Get-AuthenticodeSignature -LiteralPath $env:STEAM_BRIDGE_SIGNATURE_FILE; " +
          "[PSCustomObject]@{ status = [string]$signature.Status; " +
          "signerSubject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }; " +
          "signerThumbprint = if ($signature.SignerCertificate) { $signature.SignerCertificate.Thumbprint } else { $null } } " +
          "| ConvertTo-Json -Compress"
      ],
      { env, encoding: "utf8", windowsHide: true }
    );
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Authenticode inspection failed for ${label}: ${result.stderr || result.stdout}`);
    }
    evidence[label] = JSON.parse(result.stdout.trim());
  }
  return evidence;
}

function assertExpectedPublisher(signature, label) {
  if (expectedPublisherThumbprint) {
    assert.equal(
      normalizeThumbprint(signature.signerThumbprint),
      expectedPublisherThumbprint,
      `${label} signer thumbprint must match the configured publisher`
    );
  }
  if (expectedPublisherSubject) {
    assert.ok(
      String(signature.signerSubject || "").toLowerCase().includes(expectedPublisherSubject.toLowerCase()),
      `${label} signer subject must contain the configured publisher subject`
    );
  }
}

function packageRuntimeEvidence(baseDir, runtimeDir, inspected) {
  return {
    runtimeDirectory: normalizeRelativePath(path.relative(baseDir, runtimeDir) || "."),
    files: inspected.files
  };
}

function hashFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  const sha512Base64 = crypto.createHash("sha512").update(bytes).digest("base64");
  return {
    size: bytes.length,
    sha1: crypto.createHash("sha1").update(bytes).digest("hex"),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    sha512: crypto.createHash("sha512").update(bytes).digest("hex"),
    integrity: `sha512-${sha512Base64}`
  };
}

function listFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(filePath));
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }
  return files;
}

function selfTest() {
  assert.equal(fixtureConfig.productName, "SteamBridgeSmoke");
  assert.deepEqual(fixtureConfig.asar, { smartUnpack: false });
  assert.deepEqual(
    fixtureConfig.asarUnpack.map((entry) => path.basename(entry)).sort(),
    [...WINDOWS_RUNTIME_FILES].sort()
  );
  assert.equal(fixtureConfig.npmRebuild, false);
  assert.ok(fixtureConfig.win.signExts.includes(".node"));
  assert.deepEqual(fixtureConfig.win.signExts, [".node"]);
  assert.ok(
    fixtureConfig.extraResources.some((entry) => entry.to === "steam-bridge-tools/bin/validate-checkout-target.cjs")
  );
  assert.ok(fixtureConfig.extraResources.some((entry) => entry.to === "steam-bridge-tools/dist"));
  assert.ok(fixtureConfig.files.includes("smoke/**/*"));
  assert.ok(fixtureConfig.extraFiles.some((entry) => entry.from === "windows-tools" && entry.to === "."));
  assert.equal(
    asarEntryPath(["node_modules", "steam-bridge", "package.json"], path.win32),
    "node_modules\\steam-bridge\\package.json"
  );
  assert.equal(
    asarEntryPath(["node_modules", "steam-bridge", "package.json"], path.posix),
    "node_modules/steam-bridge/package.json"
  );
  const fatalExitProbe = spawnSync(
    process.execPath,
    [
      "-e",
      `const { preserveFailureExitCode } = require(${JSON.stringify(__filename)}); ` +
        'if (typeof preserveFailureExitCode !== "function") process.exit(2); ' +
        'process.stdout.write("guard-invoked"); preserveFailureExitCode(); process.exitCode = 0;'
    ],
    { encoding: "utf8" }
  );
  assert.equal(fatalExitProbe.stdout, "guard-invoked", "Fatal exit probe must invoke the exported guard");
  assert.equal(fatalExitProbe.stderr, "", "Fatal exit probe must not fail for an unrelated exception");
  assert.equal(fatalExitProbe.status, 1, "Fatal gate errors must remain nonzero if electron-builder resets exitCode");
  const bytes = Buffer.from("exact tarball bytes");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-windows-asar-gate-self-test-"));
  try {
    const filePath = path.join(tempRoot, "package.tgz");
    fs.writeFileSync(filePath, bytes);
    const fakeNpmCli = path.join(tempRoot, "npm-cli.js");
    fs.writeFileSync(fakeNpmCli, "// test npm CLI\n");
    assert.deepEqual(
      resolveInvocation("npm", ["pack"], {
        platform: "win32",
        npmExecPath: fakeNpmCli,
        nodeExecPath: "node.exe"
      }),
      { command: "node.exe", args: [fakeNpmCli, "pack"] }
    );
    const hashes = hashFile(filePath);
    assert.equal(hashes.size, bytes.length);
    assert.equal(hashes.integrity, `sha512-${crypto.createHash("sha512").update(bytes).digest("base64")}`);
    const bundleDir = path.join(tempRoot, "bundle");
    fs.mkdirSync(path.join(bundleDir, "resources"), { recursive: true });
    fs.writeFileSync(path.join(bundleDir, "app.exe"), "executable bytes");
    fs.writeFileSync(path.join(bundleDir, "resources", "app.asar"), "archive bytes");
    const firstArchive = createDeterministicBundleArchive(bundleDir, path.join(tempRoot, "first.tar"));
    fs.utimesSync(path.join(bundleDir, "app.exe"), new Date(1_000_000), new Date(2_000_000));
    const secondArchive = createDeterministicBundleArchive(bundleDir, path.join(tempRoot, "second.tar"));
    assert.equal(firstArchive.sha256, secondArchive.sha256, "Bundle archive must ignore source mtimes");
    assert.equal(firstArchive.fileCount, 2);
    const extractedBundleDir = path.join(tempRoot, "extracted");
    fs.mkdirSync(extractedBundleDir);
    tar.extract({ cwd: extractedBundleDir, file: path.join(tempRoot, "first.tar"), sync: true });
    assert.equal(
      fs.readFileSync(path.join(extractedBundleDir, "win-unpacked", "app.exe"), "utf8"),
      "executable bytes",
      "Retained bundle archive must round-trip exact file content"
    );
    const fakeRuntime = {
      files: Object.fromEntries(
        WINDOWS_RUNTIME_FILES.map((fileName) => [fileName, { sha256: `${fileName}-hash` }])
      )
    };
    const preserved = assertRuntimeDllBytesPreserved(fakeRuntime, fakeRuntime);
    assert.equal(preserved[WINDOWS_RUNTIME_FILES[1]].preserved, true);
    const changedRuntime = structuredClone(fakeRuntime);
    changedRuntime.files[WINDOWS_RUNTIME_FILES[1]].sha256 = "changed";
    assert.throws(
      () => assertRuntimeDllBytesPreserved(fakeRuntime, changedRuntime),
      /must retain its exact upstream bytes/
    );
    const scrubbed = sanitizedChildEnvironment(
      {
        PATH: "safe-path",
        WIN_CSC_LINK: "secret-link",
        WIN_CSC_KEY_PASSWORD: "secret-password",
        CSC_LINK: "secret-alias",
        NODE_AUTH_TOKEN: "secret-token",
        NPM_CONFIG__AUTH: "secret-npm-auth",
        NPM_CONFIG_USERCONFIG: "secret-config",
        AWS_SECRET_ACCESS_KEY: "secret-cloud-key",
        STEAM_BRIDGE_APP_ID: "must-not-pass",
        SteamAppId: "must-not-pass",
        SteamGameId: "must-not-pass",
        SteamOverlayGameId: "must-not-pass"
      },
      { TEST_SAFE_VALUE: "safe" }
    );
    assert.equal(scrubbed.PATH, "safe-path");
    assert.equal(scrubbed.TEST_SAFE_VALUE, "safe");
    for (const name of [
      "WIN_CSC_LINK",
      "WIN_CSC_KEY_PASSWORD",
      "CSC_LINK",
      "NODE_AUTH_TOKEN",
      "NPM_CONFIG__AUTH",
      "NPM_CONFIG_USERCONFIG",
      "AWS_SECRET_ACCESS_KEY",
      "STEAM_BRIDGE_APP_ID",
      "SteamAppId",
      "SteamGameId",
      "SteamOverlayGameId"
    ]) {
      assert.equal(scrubbed[name], undefined, `Candidate environment must remove ${name}`);
    }
    const isolated = isolatedCandidateEnvironment(path.join(tempRoot, "isolated-profile"));
    assert.equal(isolated.HOME, path.join(tempRoot, "isolated-profile"));
    assert.equal(isolated.USERPROFILE, isolated.HOME);
    assert.ok(isolated.TEMP.startsWith(isolated.HOME));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  if (process.platform === "win32") {
    for (const fileName of [
      "sign-windows-package.ps1",
      "windows-electron-smoke.ps1",
      "windows-native-overlay-control.ps1",
      "windows-overlay-matrix.ps1",
      "windows-overlay-task.ps1"
    ]) {
      assertPowerShellParses(path.join(repoRoot, "scripts", fileName));
    }
  }
}

function assertPowerShellParses(filePath) {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$tokens = $null; $errors = $null; " +
        "[System.Management.Automation.Language.Parser]::ParseFile($env:STEAM_BRIDGE_PS_FILE, [ref]$tokens, [ref]$errors) | Out-Null; " +
        "if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }"
    ],
    {
      env: sanitizedChildEnvironment(process.env, { STEAM_BRIDGE_PS_FILE: filePath }),
      encoding: "utf8",
      windowsHide: true
    }
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`PowerShell parser rejected ${filePath}: ${result.stderr || result.stdout}`);
  }
}

function assertNonEmptyFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile() || fs.statSync(filePath).size === 0) {
    throw new Error(`Missing or empty ${label}: ${filePath}`);
  }
}

function assertDirectory(directory, label) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`Missing ${label}: ${directory}`);
  }
}

function readJson(filePath) {
  assertNonEmptyFile(filePath, "JSON file");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}

function asarEntryPath(segments, pathImplementation = path) {
  return pathImplementation.join(...segments);
}

function isPathInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function normalizeThumbprint(value) {
  return String(value || "")
    .replace(/[^0-9a-f]/gi, "")
    .toUpperCase();
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(command, args, cwd, options = {}) {
  const invocation = resolveInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: options.encoding,
    stdio: options.encoding ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
    env: options.env || sanitizedChildEnvironment()
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status ?? "unknown"}): ${command} ${args.join(" ")}${
        options.encoding ? `\n${result.stderr || result.stdout || ""}` : ""
      }`
    );
  }
  return result;
}

function preserveFailureExitCode() {
  process.exitCode = 1;
  process.on("exit", () => {
    process.exitCode = 1;
  });
}

function resolveInvocation(command, args, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== "win32" || command !== "npm") {
    return { command, args };
  }
  const npmExecPath = options.npmExecPath || process.env.npm_execpath;
  assertNonEmptyFile(npmExecPath, "npm JavaScript CLI from npm_execpath");
  return {
    command: options.nodeExecPath || process.execPath,
    args: [npmExecPath, ...args]
  };
}

function sanitizedChildEnvironment(source = process.env, additions = {}) {
  const env = {};
  const allowed = new Set([
    "ALLUSERSPROFILE",
    "APPDATA",
    "COMMONPROGRAMFILES",
    "COMMONPROGRAMFILES(X86)",
    "COMSPEC",
    "HOME",
    "HOMEDRIVE",
    "HOMEPATH",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "LOCALAPPDATA",
    "LOGNAME",
    "NUMBER_OF_PROCESSORS",
    "OS",
    "PATH",
    "PATHEXT",
    "PROCESSOR_ARCHITECTURE",
    "PROCESSOR_IDENTIFIER",
    "PROGRAMDATA",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)",
    "PUBLIC",
    "SHELL",
    "SYSTEMDRIVE",
    "SYSTEMROOT",
    "TEMP",
    "TERM",
    "TMP",
    "TMPDIR",
    "USER",
    "USERNAME",
    "USERPROFILE",
    "WINDIR"
  ]);
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined || !allowed.has(name.toUpperCase())) {
      continue;
    }
    env[name] = value;
  }
  return { ...env, ...additions };
}

function isolatedCandidateEnvironment(profileRoot, additions = {}) {
  const resolvedProfileRoot = path.resolve(profileRoot);
  const appData = path.join(resolvedProfileRoot, "AppData", "Roaming");
  const localAppData = path.join(resolvedProfileRoot, "AppData", "Local");
  const temp = path.join(resolvedProfileRoot, "Temp");
  for (const directory of [appData, localAppData, temp]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  return sanitizedChildEnvironment(process.env, {
    HOME: resolvedProfileRoot,
    USERPROFILE: resolvedProfileRoot,
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
    TEMP: temp,
    TMP: temp,
    TMPDIR: temp,
    ...additions
  });
}

function readGitValue(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

module.exports = {
  createDeterministicBundleArchive,
  installExactTarball,
  preserveFailureExitCode,
  stageFixture,
  verifyAsarLayout,
  verifyLiveSmokeCapability
};
