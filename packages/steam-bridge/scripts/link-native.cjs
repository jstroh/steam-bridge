const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const runtimeOnly = process.argv.includes("--runtime-only");
const targetArg = readArg("--target");
const supportedTarget = "aarch64-apple-darwin";

if (targetArg && targetArg !== supportedTarget) {
  throw new Error(`Steam Bridge only supports ${supportedTarget}; received ${targetArg}.`);
}

if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error("Steam Bridge native linking is supported only on Apple Silicon macOS.");
}

const sourceName = "libsteam_bridge_native.dylib";
const redistName = "libsteam_api.dylib";
const redistFolder = "osx";

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
  copyArm64Binary(redist, redistDestination);
  signMacosBinary(redistDestination);
  console.log(`Linked ${redistDestination}`);
} else {
  console.warn(`Steam runtime library ${redistName} was not found. Set STEAMWORKS_SDK_PATH or copy it next to the .node file before runtime smoke tests.`);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function releaseDirs() {
  return [
    path.join(repoRoot, "target", targetArg || supportedTarget, "release")
  ];
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
    ...releaseDirs().map((dir) => path.join(dir, "build"))
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

function copyArm64Binary(source, destination) {
  const archs = readMachOArchitectures(source);

  if (!archs.includes("arm64")) {
    throw new Error(`${source} does not contain an arm64 slice.`);
  }

  if (archs.length === 1) {
    fs.copyFileSync(source, destination);
    return;
  }

  const result = spawnSync("lipo", ["-thin", "arm64", source, "-output", destination], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Failed to thin ${source} to arm64.`,
        result.stderr.trim(),
        result.stdout.trim()
      ].filter(Boolean).join("\n")
    );
  }
}

function readMachOArchitectures(filePath) {
  const result = spawnSync("lipo", ["-archs", filePath], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Failed to inspect architectures for ${filePath}.`,
        result.stderr.trim(),
        result.stdout.trim()
      ].filter(Boolean).join("\n")
    );
  }

  return result.stdout.trim().split(/\s+/).filter(Boolean);
}

function signMacosNodeBinary(filePath) {
  signMacosBinary(filePath);
}

function signMacosBinary(filePath) {
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
