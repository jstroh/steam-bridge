#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const examplePackagePath = path.join(repoRoot, "examples", "electron-basic", "package.json");
const lockfilePath = path.join(repoRoot, "package-lock.json");
const installedElectronPackagePath = path.join(repoRoot, "node_modules", "electron", "package.json");
const checkLatest = process.argv.includes("--latest");

const examplePackage = readJson(examplePackagePath);
const lockfile = readJson(lockfilePath);
const declaredElectronVersion = examplePackage.dependencies?.electron;

assert.equal(
  typeof declaredElectronVersion,
  "string",
  "Electron smoke example must declare electron as a dependency"
);
assert.match(
  declaredElectronVersion,
  /^\d+\.\d+\.\d+$/,
  "Electron smoke example must pin an exact stable Electron version"
);

const workspaceElectronVersion = lockfile.packages?.["examples/electron-basic"]?.dependencies?.electron;
assert.equal(
  workspaceElectronVersion,
  declaredElectronVersion,
  "package-lock workspace electron dependency must match examples/electron-basic/package.json"
);

const lockedElectronVersion = lockfile.packages?.["node_modules/electron"]?.version;
assert.equal(
  lockedElectronVersion,
  declaredElectronVersion,
  "package-lock installed electron version must match examples/electron-basic/package.json"
);

if (fs.existsSync(installedElectronPackagePath)) {
  const installedElectronVersion = readJson(installedElectronPackagePath).version;
  assert.equal(
    installedElectronVersion,
    declaredElectronVersion,
    "installed node_modules electron version must match examples/electron-basic/package.json"
  );
}

if (checkLatest) {
  const latestElectronVersion = npmViewElectronVersion();
  assert.equal(
    declaredElectronVersion,
    latestElectronVersion,
    `Electron smoke example must track the latest Electron release from npm. Latest is ${latestElectronVersion}.`
  );
}

console.log(`Electron smoke runtime confirmed: electron ${declaredElectronVersion}${checkLatest ? " (latest)" : ""}`);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function npmViewElectronVersion() {
  const result = spawnSync("npm", ["view", "electron", "version", "--silent"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(
      `Could not read latest Electron version from npm.\n${result.stderr || result.stdout || "npm view failed"}`
    );
  }
  const version = result.stdout.trim();
  assert.match(version, /^\d+\.\d+\.\d+$/, "npm view electron version must return a stable semver version");
  return version;
}
