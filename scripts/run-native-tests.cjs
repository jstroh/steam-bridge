"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const supportedTargets = new Set([
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu"
]);

function targetForHost(platform, arch) {
  const target = {
    "darwin:arm64": "aarch64-apple-darwin",
    "linux:x64": "x86_64-unknown-linux-gnu",
    "win32:x64": "x86_64-pc-windows-msvc"
  }[`${platform}:${arch}`];
  if (!target) {
    throw new Error(`native tests do not support host ${platform}/${arch}`);
  }
  return target;
}

function parseTarget(argv, hostTarget = targetForHost(process.platform, process.arch)) {
  if (argv.length === 0) {
    return undefined;
  }
  if (argv.length !== 2 || argv[0] !== "--target") {
    throw new Error("run-native-tests accepts only an optional --target <target> argument");
  }
  const target = argv[1];
  if (!target || !supportedTargets.has(target)) {
    throw new Error(`--target must be one of: ${[...supportedTargets].join(", ")}`);
  }
  if (target !== hostTarget) {
    throw new Error(`--target ${target} cannot run on this host; expected ${hostTarget}`);
  }
  return target;
}

function steamworksRuntimeDirectoryFromMetadata(metadata, platform) {
  const steamworks = metadata.packages?.find((entry) => entry.name === "steamworks-sys");
  if (!steamworks?.manifest_path) {
    throw new Error("cargo metadata did not contain steamworks-sys");
  }
  const platformDirectory = platform === "win32" ? "win64" : platform === "darwin" ? "osx" : "linux64";
  return path.join(
    path.dirname(steamworks.manifest_path),
    "lib",
    "steam",
    "redistributable_bin",
    platformDirectory
  );
}

function readCargoMetadata(root) {
  const result = spawnSync("cargo", ["metadata", "--format-version", "1"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: false
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`cargo metadata failed with exit code ${result.status}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

function runtimeLibraryEnvironment(root, platform, source = process.env, extraDirectories = []) {
  const env = { ...source };
  const runtimeDirectory = path.join(root, "packages", "steam-bridge");
  const variable = platform === "win32" ? "PATH" : platform === "darwin" ? "DYLD_LIBRARY_PATH" : "LD_LIBRARY_PATH";
  const environmentKey = Object.keys(env).find((key) => key.toUpperCase() === variable) ?? variable;
  const delimiter = platform === "win32" ? ";" : ":";
  const directories = [...extraDirectories, runtimeDirectory];
  if (env[environmentKey]) {
    directories.push(env[environmentKey]);
  }
  env[environmentKey] = directories.join(delimiter);
  return env;
}

function main() {
  const root = path.resolve(__dirname, "..");
  const target = parseTarget(process.argv.slice(2));
  const args = ["test", "-p", "steam-bridge-native"];
  if (target) {
    args.push("--target", target);
  }
  const cargoMetadata = readCargoMetadata(root);
  const steamworksRuntimeDirectory = steamworksRuntimeDirectoryFromMetadata(cargoMetadata, process.platform);
  if (!fs.existsSync(steamworksRuntimeDirectory)) {
    throw new Error(`Steamworks runtime directory is missing: ${steamworksRuntimeDirectory}`);
  }
  const result = spawnSync("cargo", args, {
    cwd: root,
    env: runtimeLibraryEnvironment(root, process.platform, process.env, [steamworksRuntimeDirectory]),
    stdio: "inherit",
    shell: false
  });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  parseTarget,
  runtimeLibraryEnvironment,
  steamworksRuntimeDirectoryFromMetadata,
  targetForHost
};
