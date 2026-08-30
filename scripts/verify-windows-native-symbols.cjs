const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

if (process.argv.includes("--self-test")) {
  assert.equal(
    parseDebugId("Debug Info File Check\n  > Debug ID: e3e78d87-2bfc-44a6-83bb-53658b54d40b-1\n"),
    "e3e78d87-2bfc-44a6-83bb-53658b54d40b-1"
  );
  assert.throws(() => parseDebugId("Debug Info File Check\n"), /does not contain exactly one debug ID/);
  assert.throws(
    () => parseDebugId("Debug ID: aaa-1\nDebug ID: bbb-1\n"),
    /does not contain exactly one debug ID/
  );
  console.log("Windows native symbol verifier self-test passed.");
  process.exit(0);
}

const addonPath = requiredPath("--addon");
const pdbPath = requiredPath("--pdb");
const addonDebugId = inspectDebugFile(addonPath);
const pdbDebugId = inspectDebugFile(pdbPath);

assert.equal(
  pdbDebugId,
  addonDebugId,
  `Windows addon and PDB debug IDs do not match: addon=${addonDebugId} pdb=${pdbDebugId}`
);

console.log(`Verified Windows addon/PDB debug ID ${addonDebugId}.`);

function requiredPath(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`Missing required ${name} path.`);
  }
  const resolved = path.resolve(value);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`${resolved} is not a non-empty regular file.`);
  }
  return resolved;
}

function inspectDebugFile(filePath) {
  const sentryCli = path.join(repoRoot, "node_modules", "@sentry", "cli", "bin", "sentry-cli");
  const result = spawnSync(process.execPath, [sentryCli, "debug-files", "check", filePath], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      [`Sentry CLI could not inspect ${filePath}.`, result.stderr?.trim(), result.stdout?.trim()]
        .filter(Boolean)
        .join("\n")
    );
  }
  return parseDebugId(`${result.stdout || ""}\n${result.stderr || ""}`);
}

function parseDebugId(output) {
  const matches = [...output.matchAll(/\bDebug ID:\s*([^\s]+)/g)].map((match) => match[1].toLowerCase());
  if (matches.length !== 1) {
    throw new Error(`Debug file check does not contain exactly one debug ID: ${matches.length}.`);
  }
  return matches[0];
}
