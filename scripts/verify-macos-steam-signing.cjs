#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const REQUIRED_TRUE_ENTITLEMENTS = [
  "com.apple.security.cs.allow-dyld-environment-variables",
  "com.apple.security.cs.disable-library-validation"
];
const FORBIDDEN_ENTITLEMENTS = ["com.apple.security.app-sandbox"];

main();

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exit(2);
  }

  if (options.help) {
    printUsage();
    return;
  }

  if (options.selfTest) {
    try {
      runSelfTest();
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
    return;
  }

  if (process.platform !== "darwin") {
    console.error("macOS Steam signing verification must run on macOS.");
    process.exit(1);
  }

  const appExe = options.appExe;
  if (!appExe) {
    console.error("missing --app-exe value");
    printUsage();
    process.exit(2);
  }

  try {
    verifySignedExecutable(appExe, "native launcher");
    verifySignedExecutable(`${appExe}.electron`, "renamed Electron executable");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(`macOS Steam signing verified: ${appExe}`);
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

function printUsage() {
  console.error(`Usage:
  verify-macos-steam-signing.cjs --app-exe PATH
  verify-macos-steam-signing.cjs --self-test

Verifies the packaged macOS smoke launcher and renamed Electron executable are
arm64-only, codesigned, and signed with Steam-overlay-compatible entitlements.
`);
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

function assertExecutable(filePath, label) {
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
  if ((stats.mode & 0o111) === 0) {
    throw new Error(`${label} is not executable: ${filePath}`);
  }
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

  console.log("macOS Steam signing verifier self-test passed.");
}
