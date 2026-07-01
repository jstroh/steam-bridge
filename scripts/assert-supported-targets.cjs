const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const supportedTargets = [
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu"
];
const unsupportedTargets = [
  "x86_64-apple-darwin"
];
const unsupportedMacExampleTokens = [
  "x86_64-apple-darwin",
  "darwin-x64",
  "universal"
];

const packageJson = require(path.join(repoRoot, "packages", "steam-bridge", "package.json"));
const examplePackageJson = require(path.join(repoRoot, "examples", "electron-basic", "package.json"));
const examplePackagerScript = fs.readFileSync(path.join(repoRoot, "scripts", "package-electron-example.cjs"), "utf8");
const actualTargets = [...(packageJson.napi?.targets ?? [])].sort();
const expectedTargets = [...supportedTargets].sort();

assertDeepEqual(actualTargets, expectedTargets, "package napi targets");
assert.equal(
  examplePackageJson.scripts?.["package:mac"],
  "node ../../scripts/package-electron-example.cjs --target aarch64-apple-darwin",
  "Electron example package:mac script must build only the Apple Silicon macOS target"
);

if ("os" in packageJson || "cpu" in packageJson) {
  throw new Error("steam-bridge package.json should not use broad os/cpu gates; runtime target checks are platform-specific.");
}

for (const target of unsupportedTargets) {
  if (actualTargets.includes(target)) {
    throw new Error(`Unsupported target must not be published: ${target}`);
  }
}

const exampleScripts = JSON.stringify(examplePackageJson.scripts ?? {});
for (const token of unsupportedMacExampleTokens) {
  if (exampleScripts.includes(token)) {
    throw new Error(`Electron example must not expose unsupported macOS package target ${token}.`);
  }
}

assertMatch(
  examplePackagerScript,
  /"aarch64-apple-darwin":\s*\{[\s\S]*?platform:\s*"darwin"[\s\S]*?arch:\s*"arm64"/,
  "example packager must package macOS as Apple Silicon arm64"
);
assertNoMatch(
  examplePackagerScript,
  /x86_64-apple-darwin|darwin-x64|universal2?|platform:\s*"darwin"[\s\S]{0,160}arch:\s*"x64"/,
  "example packager must not expose Intel or universal macOS targets"
);

console.log(`Steam Bridge supported targets confirmed: ${supportedTargets.join(", ")}`);
console.log("Steam Bridge macOS smoke target policy confirmed: Apple Silicon arm64 only");

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch.\nExpected: ${expected.join(", ")}\nActual: ${actual.join(", ")}`);
  }
}

function assertMatch(value, pattern, message) {
  if (!pattern.test(value)) {
    throw new Error(message);
  }
}

function assertNoMatch(value, pattern, message) {
  if (pattern.test(value)) {
    throw new Error(message);
  }
}
