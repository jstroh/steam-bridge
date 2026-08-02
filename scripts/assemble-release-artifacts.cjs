const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");

const repoRoot = path.resolve(__dirname, "..");
const packageDir = path.join(repoRoot, "packages", "steam-bridge");
const cliArgs = process.argv.slice(2);

if (cliArgs.length === 1 && cliArgs[0] === "--self-test") {
  runArgumentSelfTest();
  process.exit(0);
}

const artifactsDirArg = readArtifactsDirectoryArg(cliArgs);

if (!artifactsDirArg) {
  throw new Error("Usage: node scripts/assemble-release-artifacts.cjs --artifacts-dir <downloaded-artifacts-dir>");
}

const artifactsDir = path.resolve(artifactsDirArg);

const targets = {
  "aarch64-apple-darwin": [
    "steam_bridge_native.darwin-arm64.node",
    "libsteam_api.dylib",
    "libsdkencryptedappticket.dylib"
  ],
  "x86_64-pc-windows-msvc": [
    "steam_bridge_native.win32-x64-msvc.node",
    "steam_api64.dll",
    "sdkencryptedappticket64.dll"
  ],
  "x86_64-unknown-linux-gnu": [
    "steam_bridge_native.linux-x64-gnu.node",
    "libsteam_api.so",
    "libsdkencryptedappticket.so"
  ]
};

cleanGeneratedPackageArtifacts();

for (const [target, files] of Object.entries(targets)) {
  const sourceDir = path.join(artifactsDir, `steam-bridge-${target}`);
  assertDirectory(sourceDir);
  assertNoUnexpectedFiles(sourceDir, files);

  for (const fileName of files) {
    const source = path.join(sourceDir, fileName);
    const destination = path.join(packageDir, fileName);
    assertFile(source);
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, fs.statSync(source).mode);
    console.log(`Copied ${path.relative(repoRoot, destination)}`);
  }

  run(process.execPath, [
    path.join(repoRoot, "scripts", "verify-release-artifacts.cjs"),
    "--target",
    target,
    "--package-dir",
    packageDir
  ]);
}

console.log("Release artifacts assembled into packages/steam-bridge.");

function cleanGeneratedPackageArtifacts() {
  for (const entry of fs.readdirSync(packageDir)) {
    if (isGeneratedPackageArtifact(entry)) {
      fs.rmSync(path.join(packageDir, entry), { force: true });
    }
  }
}

function isGeneratedPackageArtifact(fileName) {
  return (
    fileName.endsWith(".node") ||
    /^libsteam_api\./.test(fileName) ||
    /^libsdkencryptedappticket\./.test(fileName) ||
    /^steam_api.*\.dll$/.test(fileName) ||
    /^sdkencryptedappticket.*\.dll$/.test(fileName)
  );
}

function assertNoUnexpectedFiles(directory, expectedFiles) {
  const expected = new Set(expectedFiles);
  const actual = fs.readdirSync(directory).filter((entry) => fs.statSync(path.join(directory, entry)).isFile());
  const unexpected = actual.filter((entry) => !expected.has(entry));

  if (unexpected.length > 0) {
    throw new Error(`${directory} contains unexpected files: ${unexpected.join(", ")}`);
  }
}

function assertDirectory(directory) {
  const stat = fs.statSync(directory);
  if (!stat.isDirectory()) {
    throw new Error(`${directory} is not a directory`);
  }
}

function assertFile(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`${filePath} is missing or empty`);
  }
}

function readArtifactsDirectoryArg(args) {
  if (args.length === 2 && args[0] === "--artifacts-dir" && args[1]) {
    return args[1];
  }

  if (args.length === 1 && args[0].startsWith("--artifacts-dir=")) {
    return args[0].slice("--artifacts-dir=".length) || undefined;
  }

  // npm 10.9.2, bundled with the pinned Node 22.13.0 release runner, consumes
  // the unknown option when forwarding `npm run ... -- --artifacts-dir dir`
  // but leaves its value as the sole positional argument. Accept only that
  // exact unambiguous shape; internal callers use the explicit flag directly.
  if (args.length === 1 && !args[0].startsWith("-")) {
    return args[0];
  }

  return undefined;
}

function runArgumentSelfTest() {
  assert.equal(readArtifactsDirectoryArg(["--artifacts-dir", "release-artifacts"]), "release-artifacts");
  assert.equal(readArtifactsDirectoryArg(["--artifacts-dir=release-artifacts"]), "release-artifacts");
  assert.equal(readArtifactsDirectoryArg(["release-artifacts"]), "release-artifacts");
  assert.equal(readArtifactsDirectoryArg([]), undefined);
  assert.equal(readArtifactsDirectoryArg(["--artifacts-dir"]), undefined);
  assert.equal(readArtifactsDirectoryArg(["--artifacts-dir="]), undefined);
  assert.equal(readArtifactsDirectoryArg(["--artifacts-dir", "first", "second"]), undefined);
  assert.equal(readArtifactsDirectoryArg(["first", "second"]), undefined);
  assert.equal(readArtifactsDirectoryArg(["--other", "release-artifacts"]), undefined);
  console.log("Release artifact argument self-test passed.");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
