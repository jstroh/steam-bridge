const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const runtimeOnly = process.argv.includes("--runtime-only");
const target = readArg("--target") || currentTarget();

const targetConfig = {
  "aarch64-apple-darwin": {
    platform: "darwin",
    arch: "arm64",
    nativeLibrary: "libsteam_bridge_native.dylib",
    redistFolder: "osx",
    redistName: "libsteam_api.dylib"
  },
  "x86_64-pc-windows-msvc": {
    platform: "win32",
    arch: "x64",
    nativeLibrary: "steam_bridge_native.dll",
    redistFolder: "win64",
    redistName: "steam_api64.dll"
  },
  "x86_64-unknown-linux-gnu": {
    platform: "linux",
    arch: "x64",
    nativeLibrary: "libsteam_bridge_native.so",
    redistFolder: "linux64",
    redistName: "libsteam_api.so"
  }
};

const config = targetConfig[target];
if (!config) {
  throw new Error(
    `Unsupported Steam Bridge target ${target}. Supported targets: ${Object.keys(targetConfig).join(", ")}.`
  );
}

if (!runtimeOnly && (process.platform !== config.platform || process.arch !== config.arch)) {
  throw new Error(
    `Target ${target} must be linked on ${config.platform}/${config.arch}; current host is ${process.platform}/${process.arch}.`
  );
}

if (!runtimeOnly) {
  const source = findNativeLibrary();
  const destination = path.join(packageRoot, "steam_bridge_native.local.node");

  if (!source) {
    throw new Error(`Native library for ${target} was not found. Run npm run native:build first.`);
  }

  copyNativeLibrary(source, destination);
  console.log(`Linked ${destination}`);
}

const redist = findSteamRedistributable();
if (redist) {
  const redistDestination = path.join(packageRoot, config.redistName);
  copySteamRedistributable(redist, redistDestination);
  console.log(`Linked ${redistDestination}`);
} else {
  console.warn(
    `Steam runtime library ${config.redistName} was not found. ` +
      "Set STEAMWORKS_SDK_PATH or copy it next to the .node file before runtime smoke tests."
  );
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function currentTarget() {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "aarch64-apple-darwin";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "x86_64-pc-windows-msvc";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "x86_64-unknown-linux-gnu";
  }

  throw new Error(
    `Unsupported Steam Bridge host ${process.platform}/${process.arch}. ` +
      "Supported hosts: macOS arm64, Windows x64, Linux x64."
  );
}

function releaseDirs() {
  return [
    path.join(repoRoot, "target", target, "release"),
    path.join(repoRoot, "target", "release")
  ];
}

function findNativeLibrary() {
  for (const dir of releaseDirs()) {
    const candidate = path.join(dir, config.nativeLibrary);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function findSteamRedistributable() {
  const sdkPath = process.env.STEAMWORKS_SDK_PATH || process.env.STEAM_BRIDGE_SDK_PATH;
  const candidates = [
    sdkPath ? path.join(sdkPath, "redistributable_bin", config.redistFolder, config.redistName) : "",
    path.join(repoRoot, "sdk", "redistributable_bin", config.redistFolder, config.redistName),
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
      const found = findInDirectory(candidate, config.redistName);
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

function copyNativeLibrary(source, destination) {
  fs.copyFileSync(source, destination);
  if (target === "aarch64-apple-darwin") {
    signMacosBinary(destination);
  }
}

function copySteamRedistributable(source, destination) {
  if (target === "aarch64-apple-darwin") {
    copyArm64MachO(source, destination);
    signMacosBinary(destination);
    return;
  }

  fs.copyFileSync(source, destination);
}

function copyArm64MachO(source, destination) {
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
