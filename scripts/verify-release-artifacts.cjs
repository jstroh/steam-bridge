const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  WINDOWS_NATIVE_ADDON,
  inspectWindowsRuntimeDirectory
} = require("./verify-windows-packaged-artifacts.cjs");

const repoRoot = path.resolve(__dirname, "..");
const target = readArg("--target") || currentTarget();
const packageDir = path.resolve(readArg("--package-dir") || path.join(repoRoot, "packages", "steam-bridge"));

const targets = {
  "aarch64-apple-darwin": {
    platform: "darwin",
    arch: "arm64",
    native: "steam_bridge_native.darwin-arm64.node",
    runtime: ["libsteam_api.dylib", "libsdkencryptedappticket.dylib"]
  },
  "x86_64-pc-windows-msvc": {
    platform: "win32",
    arch: "x64",
    native: "steam_bridge_native.win32-x64-msvc.node",
    runtime: ["steam_api64.dll", "sdkencryptedappticket64.dll"]
  },
  "x86_64-unknown-linux-gnu": {
    platform: "linux",
    arch: "x64",
    native: "steam_bridge_native.linux-x64-gnu.node",
    runtime: ["libsteam_api.so", "libsdkencryptedappticket.so"]
  }
};

const config = targets[target];
if (!config) {
  throw new Error(`Unsupported release target ${target}. Supported targets: ${Object.keys(targets).join(", ")}.`);
}

const expectedFiles = [config.native, ...config.runtime].map((fileName) => path.join(packageDir, fileName));
for (const filePath of expectedFiles) {
  assertNonEmptyFile(filePath);
}

const nativePath = path.join(packageDir, config.native);
if (target === "x86_64-pc-windows-msvc") {
  verifyWindowsArtifact(nativePath);
} else if (process.platform === config.platform && process.arch === config.arch) {
  verifyCurrentPlatformArtifact(nativePath);
} else {
  console.log(
    `Verified release artifact presence for ${target}; binary inspection skipped on ${process.platform}/${process.arch}.`
  );
}

console.log(`Release artifacts verified for ${target}.`);

function verifyCurrentPlatformArtifact(nativePath) {
  if (target === "x86_64-unknown-linux-gnu") {
    verifyLinuxArtifact(nativePath);
    return;
  }

  if (target === "aarch64-apple-darwin") {
    verifyMacosArtifact(nativePath);
    return;
  }

}

function verifyLinuxArtifact(nativePath) {
  const ldd = run("ldd", ["-r", nativePath], { encoding: "utf8", check: false });
  const lddOutput = `${ldd.stdout || ""}${ldd.stderr || ""}`;
  const missingLibraries = lddOutput.split(/\r?\n/).filter((line) => /\bnot found\b/.test(line));
  const unresolvedSymbols = unresolvedLinuxSymbolLines(lddOutput).filter(
    ({ symbol }) => !isAllowedLinuxAddonImport(symbol)
  );

  if (
    missingLibraries.length > 0 ||
    unresolvedSymbols.length > 0 ||
    (ldd.status !== 0 && unresolvedLinuxSymbolLines(lddOutput).length === 0)
  ) {
    throw new Error(
      [
        `Linux native artifact has unresolved runtime dependencies: ${nativePath}`,
        [...missingLibraries, ...unresolvedSymbols.map(({ line }) => line), lddOutput.trim()].filter(Boolean).join("\n")
      ].filter(Boolean).join("\n")
    );
  }

  const nm = run("nm", ["-D", nativePath], { encoding: "utf8" });
  const unresolvedSteamBridgeSymbols = nm.stdout
    .split(/\r?\n/)
    .filter((line) => /\bU\s+(?:.*steam_bridge_|_ZL.*k_Steam)/.test(line));

  if (unresolvedSteamBridgeSymbols.length > 0) {
    throw new Error(
      [
        `Linux native artifact has unresolved Steam Bridge shim symbols: ${nativePath}`,
        unresolvedSteamBridgeSymbols.join("\n")
      ].join("\n")
    );
  }
}

function unresolvedLinuxSymbolLines(output) {
  return output
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/\bundefined symbol:\s*([^\s]+)/);
      return match ? { line, symbol: match[1] } : undefined;
    })
    .filter(Boolean);
}

function isAllowedLinuxAddonImport(symbol) {
  return /^(napi_|node_api_)/.test(symbol);
}

function verifyMacosArtifact(nativePath) {
  for (const fileName of [config.native, ...config.runtime]) {
    const filePath = path.join(packageDir, fileName);
    const archs = run("lipo", ["-archs", filePath], { encoding: "utf8" }).stdout.trim().split(/\s+/).filter(Boolean);
    assert.deepEqual(archs, ["arm64"], `${fileName} must contain only an arm64 macOS slice`);
  }

  run("otool", ["-L", nativePath], { encoding: "utf8" });
}

function verifyWindowsArtifact(nativePath) {
  assert.equal(path.basename(nativePath), WINDOWS_NATIVE_ADDON);
  const inspected = inspectWindowsRuntimeDirectory(packageDir);
  for (const [fileName, file] of Object.entries(inspected.files)) {
    console.log(
      `Verified ${fileName}: ${file.pe.machine} ${file.pe.format} size=${file.size} sha256=${file.sha256}`
    );
  }
}

function assertNonEmptyFile(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} does not exist`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.isFile(), `${filePath} is not a file`);
  assert.ok(stat.size > 0, `${filePath} is empty`);
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.encoding,
    stdio: options.encoding ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32"
  });

  if (options.check !== false && result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stderr?.trim(),
        result.stdout?.trim()
      ].filter(Boolean).join("\n")
    );
  }

  return result;
}
