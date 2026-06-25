const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const runtimeOnly = process.argv.includes("--runtime-only");
const targetArg = readArg("--target");

const sourceName = process.platform === "win32"
  ? "steam_bridge_native.dll"
  : process.platform === "darwin"
    ? "libsteam_bridge_native.dylib"
    : "libsteam_bridge_native.so";
const redistName = process.platform === "win32"
  ? "steam_api64.dll"
  : process.platform === "darwin"
    ? "libsteam_api.dylib"
    : "libsteam_api.so";
const redistFolder = process.platform === "win32"
  ? "win64"
  : process.platform === "darwin"
    ? "osx"
    : "linux64";

if (!runtimeOnly) {
  const source = findNativeLibrary();
  const destination = path.join(packageRoot, "steam_bridge_native.local.node");

  if (!source) {
    throw new Error("Native library was not found. Run cargo build -p steam-bridge-native --release first.");
  }

  fs.copyFileSync(source, destination);
  signMacosNodeBinary(destination);
  console.log(`Linked ${destination}`);
}

const redist = findSteamRedistributable();
if (redist) {
  const redistDestination = path.join(packageRoot, redistName);
  fs.copyFileSync(redist, redistDestination);
  console.log(`Linked ${redistDestination}`);
} else {
  console.warn(`Steam runtime library ${redistName} was not found. Set STEAMWORKS_SDK_PATH or copy it next to the .node file before runtime smoke tests.`);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function releaseDirs() {
  const dirs = [];

  if (targetArg) {
    dirs.push(path.join(repoRoot, "target", targetArg, "release"));
  }

  dirs.push(path.join(repoRoot, "target", "release"));

  const targetRoot = path.join(repoRoot, "target");
  if (fs.existsSync(targetRoot)) {
    for (const entry of fs.readdirSync(targetRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        dirs.push(path.join(targetRoot, entry.name, "release"));
      }
    }
  }

  return [...new Set(dirs)];
}

function findNativeLibrary() {
  for (const dir of releaseDirs()) {
    const candidate = path.join(dir, sourceName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function findSteamRedistributable() {
  const sdkPath = process.env.STEAMWORKS_SDK_PATH || process.env.STEAM_BRIDGE_SDK_PATH;
  const candidates = [
    sdkPath ? path.join(sdkPath, "redistributable_bin", redistFolder, redistName) : "",
    path.join(repoRoot, "sdk", "redistributable_bin", redistFolder, redistName),
    ...releaseDirs().map((dir) => path.join(dir, "build")),
    path.join(repoRoot, "target")
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }

    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      const found = findInDirectory(candidate, redistName);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function findInDirectory(directory, fileName) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return candidate;
    }

    if (entry.isDirectory()) {
      const found = findInDirectory(candidate, fileName);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function signMacosNodeBinary(filePath) {
  if (process.platform !== "darwin") {
    return;
  }

  const result = spawnSync("codesign", ["--force", "--sign", "-", filePath], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Failed to ad-hoc sign ${filePath}.`,
        result.stderr.trim(),
        result.stdout.trim()
      ].filter(Boolean).join("\n")
    );
  }
}
