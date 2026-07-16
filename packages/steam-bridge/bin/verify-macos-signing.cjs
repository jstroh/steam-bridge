#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const STEAM_BRIDGE_MACOS_LAUNCHER_ID = "STEAM_BRIDGE_MACOS_ENV_LAUNCHER_V1";
const REQUIRED_TRUE_ENTITLEMENTS = [
  "com.apple.security.cs.allow-dyld-environment-variables",
  "com.apple.security.cs.disable-library-validation"
];
const FORBIDDEN_ENTITLEMENTS = ["com.apple.security.app-sandbox"];

function main(args = process.argv.slice(2)) {
  const status = runCli(args);
  if (status !== 0) {
    process.exit(status);
  }
}

function runCli(args, io = console) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    io.error(error.message);
    printUsage(io);
    return 2;
  }

  if (options.help) {
    printUsage(io);
    return 0;
  }

  if (options.selfTest) {
    try {
      runSelfTest();
    } catch (error) {
      io.error(error.message);
      return 1;
    }
    io.log("macOS Steam signing verifier self-test passed.");
    return 0;
  }

  if (process.platform !== "darwin") {
    io.error("macOS Steam signing verification must run on macOS.");
    return 1;
  }

  const appExe = options.appExe;
  if (!appExe) {
    io.error("missing --app-exe value");
    printUsage(io);
    return 2;
  }

  try {
    verifyMacAppBundleLauncher(appExe, "native launcher");
    verifySteamLauncherIdentity(appExe, "native launcher");
    verifyRenamedElectronIsNotLauncher(`${appExe}.electron`, "renamed Electron executable");
    verifySignedExecutable(appExe, "native launcher");
    verifySignedExecutable(`${appExe}.electron`, "renamed Electron executable");
  } catch (error) {
    io.error(error.message);
    return 1;
  }
  io.log(`macOS Steam signing verified: ${appExe}`);
  return 0;
}

function parseArgs(args) {
  const options = { appExe: "" };
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
      case "--app-exe":
        index += 1;
        if (!args[index]) {
          throw new Error("missing --app-exe value");
        }
        options.appExe = args[index];
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`unknown option: ${arg}`);
        }
        if (options.appExe) {
          throw new Error(`unexpected argument: ${arg}`);
        }
        options.appExe = arg;
        break;
    }
  }
  return options;
}

function printUsage(io = console) {
  io.error(`Usage:
  steam-bridge-verify-macos-signing --app-exe PATH
  steam-bridge-verify-macos-signing --self-test

Verifies the packaged macOS launcher and renamed Electron executable are
installed as the app bundle executable pair, carry the expected launcher
identity, are arm64-only, codesigned, and signed with
Steam-overlay-compatible entitlements.
`);
}

function verifyMacAppBundleLauncher(filePath, label) {
  const bundle = resolveMacAppBundleExecutable(filePath);
  if (!bundle) {
    return;
  }

  assertNonEmptyFile(bundle.infoPlist, "app bundle Info.plist");
  const bundleExecutable = readCfBundleExecutable(bundle.infoPlist);
  assertBundleExecutableMatches(bundle, bundleExecutable, label);
}

function resolveMacAppBundleExecutable(filePath) {
  const resolved = path.resolve(filePath);
  const marker = `${path.sep}Contents${path.sep}MacOS${path.sep}`;
  const markerIndex = resolved.lastIndexOf(marker);
  if (markerIndex < 0) {
    return undefined;
  }

  const appRoot = resolved.slice(0, markerIndex);
  if (!appRoot.endsWith(".app")) {
    return undefined;
  }

  const macosRelativePath = resolved.slice(markerIndex + marker.length);
  return {
    appRoot,
    executableName: path.basename(resolved),
    infoPlist: path.join(appRoot, "Contents", "Info.plist"),
    macosRelativePath
  };
}

function readCfBundleExecutable(infoPlistPath) {
  let plutilError;
  try {
    const result = run(
      "/usr/bin/plutil",
      ["-extract", "CFBundleExecutable", "raw", "-o", "-", infoPlistPath],
      `failed to read CFBundleExecutable from ${infoPlistPath}`,
      { allowStdout: true }
    );
    const value = result.stdout.trim();
    if (value) {
      return value;
    }
  } catch (error) {
    plutilError = error;
  }

  try {
    return parseCfBundleExecutable(fs.readFileSync(infoPlistPath, "utf8"));
  } catch (error) {
    if (plutilError) {
      throw new Error(`${plutilError.message}\n${error.message}`);
    }
    throw error;
  }
}

function parseCfBundleExecutable(plist) {
  const match = /<key>\s*CFBundleExecutable\s*<\/key>\s*<string>([^<]+)<\/string>/.exec(plist);
  if (!match) {
    throw new Error("Info.plist missing CFBundleExecutable");
  }
  return decodeXmlText(match[1].trim());
}

function decodeXmlText(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function assertBundleExecutableMatches(bundle, bundleExecutable, label) {
  if (bundle.macosRelativePath !== bundle.executableName) {
    throw new Error(
      `${label} must be directly under Contents/MacOS: ${bundle.macosRelativePath}`
    );
  }
  if (bundleExecutable !== bundle.executableName) {
    throw new Error(
      `${label} is not the app bundle executable: ${bundle.infoPlist} CFBundleExecutable is ` +
        `"${bundleExecutable}", expected "${bundle.executableName}"`
    );
  }
}

function verifySignedExecutable(filePath, label) {
  assertExecutable(filePath, label);
  verifyArm64Only(filePath, label);
  run(
    "codesign",
    ["--verify", "--ignore-resources", "--verbose=2", filePath],
    `${label} codesign verification failed`
  );
  const entitlements = readEntitlements(filePath, label);
  verifyEntitlements(entitlements, label);
}

function verifySteamLauncherIdentity(filePath, label) {
  assertBinaryMarker(filePath, label, true);
}

function verifyRenamedElectronIsNotLauncher(filePath, label) {
  assertBinaryMarker(filePath, label, false);
}

function assertBinaryMarker(filePath, label, expectedPresent) {
  assertNonEmptyFile(filePath, label);
  const marker = Buffer.from(STEAM_BRIDGE_MACOS_LAUNCHER_ID, "utf8");
  const hasMarker = fs.readFileSync(filePath).includes(marker);
  if (expectedPresent && !hasMarker) {
    throw new Error(`${label} is not the Steam Bridge macOS launcher: missing ${STEAM_BRIDGE_MACOS_LAUNCHER_ID}`);
  }
  if (!expectedPresent && hasMarker) {
    throw new Error(
      `${label} must be the renamed Electron executable, not the Steam Bridge macOS launcher: ${filePath}`
    );
  }
}

function assertExecutable(filePath, label) {
  const stats = statNonEmptyFile(filePath, label);
  if ((stats.mode & 0o111) === 0) {
    throw new Error(`${label} is not executable: ${filePath}`);
  }
}

function assertNonEmptyFile(filePath, label) {
  statNonEmptyFile(filePath, label);
}

function statNonEmptyFile(filePath, label) {
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    throw new Error(`${label} is missing: ${filePath}`);
  }

  if (!stats.isFile()) {
    throw new Error(`${label} is not a file: ${filePath}`);
  }
  if (stats.size <= 0) {
    throw new Error(`${label} is empty: ${filePath}`);
  }
  return stats;
}

function verifyArm64Only(filePath, label) {
  const result = run("lipo", ["-archs", filePath], `${label} architecture check failed`, {
    allowStdout: true
  });
  const archs = result.stdout.trim().split(/\s+/).filter(Boolean);
  assert.deepEqual(archs, ["arm64"], `${label} must contain only an arm64 macOS slice`);
}

function readEntitlements(filePath, label) {
  const result = run("codesign", ["-d", "--entitlements", ":-", filePath], `${label} entitlement read failed`, {
    allowStdout: true
  });
  return parseEntitlementBooleans(result.stdout);
}

function parseEntitlementBooleans(plist) {
  const entitlements = new Map();
  const keyValuePattern = /<key>([^<]+)<\/key>\s*<(true|false)\/>/g;
  for (const match of plist.matchAll(keyValuePattern)) {
    entitlements.set(match[1], match[2] === "true");
  }
  return entitlements;
}

function verifyEntitlements(entitlements, label) {
  for (const key of REQUIRED_TRUE_ENTITLEMENTS) {
    if (entitlements.get(key) !== true) {
      throw new Error(`${label} missing required true entitlement: ${key}`);
    }
  }
  for (const key of FORBIDDEN_ENTITLEMENTS) {
    if (entitlements.has(key)) {
      throw new Error(`${label} must not include entitlement: ${key}`);
    }
  }
}

function run(command, args, errorPrefix, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", options.allowStdout ? "pipe" : "ignore", "pipe"]
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(detail ? `${errorPrefix}:\n${detail}` : errorPrefix);
  }

  return result;
}

function runSelfTest() {
  const appRoot = path.resolve("/tmp/Steam Bridge.app");
  const bundle = resolveMacAppBundleExecutable(path.join(appRoot, "Contents", "MacOS", "Steam Bridge"));
  assert.deepEqual(bundle, {
    appRoot,
    executableName: "Steam Bridge",
    infoPlist: path.join(appRoot, "Contents", "Info.plist"),
    macosRelativePath: "Steam Bridge"
  });
  assert.equal(resolveMacAppBundleExecutable("/tmp/Steam Bridge"), undefined);

  assert.equal(
    parseCfBundleExecutable(`<plist><dict>
  <key>CFBundleExecutable</key>
  <string>SteamBridgeSmoke</string>
</dict></plist>`),
    "SteamBridgeSmoke"
  );
  assert.equal(
    parseCfBundleExecutable(`<dict><key>CFBundleExecutable</key><string>Steam &amp; Bridge</string></dict>`),
    "Steam & Bridge"
  );
  assert.throws(() => parseCfBundleExecutable("<dict></dict>"), /CFBundleExecutable/);

  assertBundleExecutableMatches(
    {
      executableName: "SteamBridgeSmoke",
      infoPlist: "/tmp/SteamBridgeSmoke.app/Contents/Info.plist",
      macosRelativePath: "SteamBridgeSmoke"
    },
    "SteamBridgeSmoke",
    "self-test launcher"
  );
  assert.throws(
    () =>
      assertBundleExecutableMatches(
        {
          executableName: "SteamBridgeSmoke",
          infoPlist: "/tmp/SteamBridgeSmoke.app/Contents/Info.plist",
          macosRelativePath: "SteamBridgeSmoke"
        },
        "SteamBridgeSmoke.electron",
        "self-test launcher"
      ),
    /CFBundleExecutable/
  );
  assert.throws(
    () =>
      assertBundleExecutableMatches(
        {
          executableName: "SteamBridgeSmoke",
          infoPlist: "/tmp/SteamBridgeSmoke.app/Contents/Info.plist",
          macosRelativePath: "Nested/SteamBridgeSmoke"
        },
        "SteamBridgeSmoke",
        "self-test launcher"
      ),
    /directly under Contents\/MacOS/
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-signing-self-test-"));
  try {
    const launcherPath = path.join(tempDir, "Launcher");
    const electronPath = path.join(tempDir, "Launcher.electron");
    fs.writeFileSync(launcherPath, `prefix ${STEAM_BRIDGE_MACOS_LAUNCHER_ID} suffix`);
    fs.writeFileSync(electronPath, "ordinary electron executable bytes");
    verifySteamLauncherIdentity(launcherPath, "self-test launcher");
    verifyRenamedElectronIsNotLauncher(electronPath, "self-test electron");
    assert.throws(
      () => verifySteamLauncherIdentity(electronPath, "self-test missing launcher marker"),
      /not the Steam Bridge macOS launcher/
    );
    assert.throws(
      () => verifyRenamedElectronIsNotLauncher(launcherPath, "self-test electron launcher copy"),
      /must be the renamed Electron executable/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const goodEntitlements = parseEntitlementBooleans(`<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>`);
  verifyEntitlements(goodEntitlements, "self-test executable");

  assert.throws(
    () =>
      verifyEntitlements(
        parseEntitlementBooleans(`<dict>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
</dict>`),
        "missing entitlement executable"
      ),
    /disable-library-validation/
  );

  assert.throws(
    () =>
      verifyEntitlements(
        parseEntitlementBooleans(`<dict>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><false/>
</dict>`),
        "false entitlement executable"
      ),
    /disable-library-validation/
  );

  assert.throws(
    () =>
      verifyEntitlements(
        parseEntitlementBooleans(`<dict>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
  <key>com.apple.security.app-sandbox</key><false/>
</dict>`),
        "sandbox entitlement executable"
      ),
    /app-sandbox/
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  FORBIDDEN_ENTITLEMENTS,
  REQUIRED_TRUE_ENTITLEMENTS,
  STEAM_BRIDGE_MACOS_LAUNCHER_ID,
  main,
  assertBundleExecutableMatches,
  parseArgs,
  parseCfBundleExecutable,
  parseEntitlementBooleans,
  readCfBundleExecutable,
  resolveMacAppBundleExecutable,
  runCli,
  runSelfTest,
  verifyEntitlements,
  verifyMacAppBundleLauncher,
  verifyRenamedElectronIsNotLauncher,
  verifySignedExecutable,
  verifySteamLauncherIdentity
};
