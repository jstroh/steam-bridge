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

const packageJson = require(path.join(repoRoot, "packages", "steam-bridge", "package.json"));
const actualTargets = [...(packageJson.napi?.targets ?? [])].sort();
const expectedTargets = [...supportedTargets].sort();

assertDeepEqual(actualTargets, expectedTargets, "package napi targets");

if ("os" in packageJson || "cpu" in packageJson) {
  throw new Error("steam-bridge package.json should not use broad os/cpu gates; runtime target checks are platform-specific.");
}

for (const target of unsupportedTargets) {
  if (actualTargets.includes(target)) {
    throw new Error(`Unsupported target must not be published: ${target}`);
  }
}

console.log(`Steam Bridge supported targets confirmed: ${supportedTargets.join(", ")}`);

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch.\nExpected: ${expected.join(", ")}\nActual: ${actual.join(", ")}`);
  }
}
