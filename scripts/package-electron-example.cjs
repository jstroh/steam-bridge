const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { packager } = require("@electron/packager");

const repoRoot = path.resolve(__dirname, "..");
const exampleRoot = path.join(repoRoot, "examples", "electron-basic");
const packageRoot = path.join(repoRoot, "packages", "steam-bridge");
const outputRoot = path.join(repoRoot, "dist", "electron-smoke");
const target = readArg("--target") || currentTarget();
const artifactsDir = readArg("--artifacts-dir");
const keepStage = process.env.STEAM_BRIDGE_KEEP_EXAMPLE_STAGE === "1";

const targetConfig = {
  "aarch64-apple-darwin": {
    platform: "darwin",
    arch: "arm64",
    appPath: "SteamBridgeSmoke-darwin-arm64/SteamBridgeSmoke.app",
    requiredFiles: [
      "steam_bridge_native.darwin-arm64.node",
      "libsteam_api.dylib",
      "libsdkencryptedappticket.dylib"
    ]
  },
  "x86_64-pc-windows-msvc": {
    platform: "win32",
    arch: "x64",
    appPath: "SteamBridgeSmoke-win32-x64/SteamBridgeSmoke.exe",
    requiredFiles: [
      "steam_bridge_native.win32-x64-msvc.node",
      "steam_api64.dll",
      "sdkencryptedappticket64.dll"
    ]
  },
  "x86_64-unknown-linux-gnu": {
    platform: "linux",
    arch: "x64",
    appPath: "SteamBridgeSmoke-linux-x64/SteamBridgeSmoke",
    requiredFiles: [
      "steam_bridge_native.linux-x64-gnu.node",
      "libsteam_api.so",
      "libsdkencryptedappticket.so"
    ]
  }
};

const config = targetConfig[target];
if (!config) {
  throw new Error(`Unsupported example target ${target}. Supported targets: ${Object.keys(targetConfig).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  let tempRoot;

  try {
    if (artifactsDir) {
      run("npm", ["run", "release:assemble", "--", "--artifacts-dir", artifactsDir], repoRoot);
    }

    const packageArtifactSources = resolvePackageArtifactSources(target, config.requiredFiles);
    run("npm", ["run", "build", "-w", "steam-bridge"], repoRoot);

    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-electron-smoke-"));
    const packDir = path.join(tempRoot, "pack");
    const stageDir = path.join(tempRoot, "app");
    fs.mkdirSync(packDir);
    fs.mkdirSync(stageDir);

    const tarball = packSteamBridge(packDir);
    stageExample(stageDir, tarball);
    installStageDependencies(stageDir);
    copyStagePackageArtifacts(stageDir, packageArtifactSources);
    pruneStagePackageArtifacts(stageDir, config.requiredFiles);
    validateStagePackageArtifacts(stageDir, config.requiredFiles);
    await packageStage(stageDir);
  } finally {
    if (tempRoot && keepStage) {
      console.log(`Keeping example package stage: ${tempRoot}`);
    } else if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }

    if (artifactsDir) {
      cleanPackageArtifacts();
    }
  }
}

function packSteamBridge(packDir) {
  const result = run("npm", ["pack", "--json", "--pack-destination", packDir], packageRoot, {
    encoding: "utf8"
  });
  const packed = JSON.parse(result.stdout);
  const filename = packed[0]?.filename;
  if (!filename) {
    throw new Error("npm pack did not return a steam-bridge tarball.");
  }

  return path.join(packDir, filename);
}

function stageExample(stageDir, tarball) {
  for (const fileName of ["main.js", "preload.js", "index.html", "smoke-sanitize.cjs", "smoke-error.cjs"]) {
    fs.copyFileSync(path.join(exampleRoot, fileName), path.join(stageDir, fileName));
  }

  fs.writeFileSync(path.join(stageDir, "steam_appid.txt"), "480\n");
  fs.writeFileSync(
    path.join(stageDir, "package.json"),
    JSON.stringify(
      {
        name: "steam-bridge-electron-smoke",
        version: "0.1.0",
        private: true,
        main: "main.js",
        dependencies: {
          "steam-bridge": `file:${tarball}`
        }
      },
      null,
      2
    )
  );
}

function installStageDependencies(stageDir) {
  run("npm", ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], stageDir);
}

function pruneStagePackageArtifacts(stageDir, requiredFiles) {
  const bridgeDir = path.join(stageDir, "node_modules", "steam-bridge");
  const required = new Set(requiredFiles);

  for (const entry of fs.readdirSync(bridgeDir)) {
    if (isGeneratedPackageArtifact(entry) && !required.has(entry)) {
      fs.rmSync(path.join(bridgeDir, entry), { force: true });
    }
  }
}

function validateStagePackageArtifacts(stageDir, requiredFiles) {
  const bridgeDir = path.join(stageDir, "node_modules", "steam-bridge");
  const requiredNativeExports = ["isOverlayNeedsPresentPollingEnabled"];

  for (const fileName of requiredFiles) {
    const filePath = path.join(bridgeDir, fileName);
    if (!isNonEmptyFile(filePath)) {
      throw new Error(`Staged steam-bridge package is missing required artifact ${fileName}.`);
    }

    if (fileName.endsWith(".node")) {
      validateNativeArtifactExports(filePath, requiredNativeExports);
    }
  }

  if (isCurrentHostTarget(target)) {
    validateStageNativeBindingLoads(stageDir, requiredNativeExports);
  }
}

function validateNativeArtifactExports(filePath, exportNames) {
  const binary = fs.readFileSync(filePath);
  for (const exportName of exportNames) {
    if (binary.indexOf(Buffer.from(exportName, "utf8")) < 0) {
      throw new Error(
        `Native artifact ${filePath} does not contain required N-API export ${exportName}. Rebuild the native addon.`
      );
    }
  }
}

function validateStageNativeBindingLoads(stageDir, exportNames) {
  const script = `
const { loadNativeBinding } = require("./node_modules/steam-bridge/dist/native.js");
const binding = loadNativeBinding();
const exportNames = ${JSON.stringify(exportNames)};
for (const exportName of exportNames) {
  if (typeof binding[exportName] !== "function") {
    throw new Error(\`Native binding missing required export \${exportName}\`);
  }
}
`;
  run(process.execPath, ["-e", script], stageDir);
}

async function packageStage(stageDir) {
  const examplePackage = require(path.join(exampleRoot, "package.json"));
  const electronVersion = examplePackage.dependencies.electron;
  const targetOut = path.join(outputRoot, target);
  fs.rmSync(targetOut, { recursive: true, force: true });
  fs.mkdirSync(targetOut, { recursive: true });

  const appPaths = await packager({
    dir: stageDir,
    name: "SteamBridgeSmoke",
    platform: config.platform,
    arch: config.arch,
    out: targetOut,
    overwrite: true,
    asar: false,
    prune: false,
    electronVersion
  });

  for (const appPath of appPaths) {
    copyTargetHelpers(appPath);
    console.log(`Packaged ${appPath}`);
  }

  console.log(`Primary launch path: ${path.join(targetOut, config.appPath)}`);
}

function copyTargetHelpers(appPath) {
  if (target === "aarch64-apple-darwin") {
    const helperPath = path.join(appPath, "macos-electron-smoke.sh");
    fs.copyFileSync(path.join(repoRoot, "scripts", "macos-electron-smoke.sh"), helperPath);
    fs.chmodSync(helperPath, 0o755);
    compileMacSteamEnvLauncher(appPath);
    fs.copyFileSync(
      path.join(repoRoot, "scripts", "verify-electron-smoke-result.cjs"),
      path.join(appPath, "verify-electron-smoke-result.cjs")
    );
  }
  if (target === "x86_64-pc-windows-msvc") {
    fs.copyFileSync(
      path.join(repoRoot, "scripts", "windows-electron-smoke.ps1"),
      path.join(appPath, "windows-electron-smoke.ps1")
    );
  }
  if (target === "x86_64-unknown-linux-gnu") {
    const helperPath = path.join(appPath, "linux-electron-smoke.sh");
    fs.copyFileSync(path.join(repoRoot, "scripts", "linux-electron-smoke.sh"), helperPath);
    fs.chmodSync(helperPath, 0o755);
  }
}

function compileMacSteamEnvLauncher(appPath) {
  const launcherPath = path.join(appPath, "SteamBridgeSmoke.app", "Contents", "MacOS", "SteamBridgeSmoke");
  run(
    process.execPath,
    [path.join(packageRoot, "bin", "prepare-macos-app.cjs"), "--app-exe", launcherPath],
    repoRoot
  );
}

function resolvePackageArtifactSources(target, fileNames) {
  const sources = new Map();

  for (const fileName of fileNames) {
    const filePath = path.join(packageRoot, fileName);
    if (isNonEmptyFile(filePath)) {
      sources.set(fileName, filePath);
      continue;
    }

    const localNativePath = path.join(packageRoot, "steam_bridge_native.local.node");
    if (fileName.endsWith(".node") && isCurrentHostTarget(target) && isNonEmptyFile(localNativePath)) {
      sources.set(fileName, localNativePath);
      continue;
    }

    throw new Error(
      [
        `Missing ${target} package artifact: ${fileName}`,
        "Run `npm run native:build` for the current host target, or run a Release workflow,",
        "download artifacts with `gh run download <run-id> --dir /tmp/steam-bridge-release`,",
        "then pass `--artifacts-dir /tmp/steam-bridge-release`."
      ].join("\n")
    );
  }

  return sources;
}

function copyStagePackageArtifacts(stageDir, artifactSources) {
  const bridgeDir = path.join(stageDir, "node_modules", "steam-bridge");
  for (const [fileName, source] of artifactSources) {
    const destination = path.join(bridgeDir, fileName);
    if (path.resolve(source) === path.resolve(destination)) {
      continue;
    }
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, fs.statSync(source).mode);
  }
}

function isCurrentHostTarget(target) {
  try {
    return currentTarget() === target;
  } catch {
    return false;
  }
}

function isNonEmptyFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0;
}

function cleanPackageArtifacts() {
  for (const entry of fs.readdirSync(packageRoot)) {
    if (isGeneratedPackageArtifact(entry)) {
      fs.rmSync(path.join(packageRoot, entry), { force: true });
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

  throw new Error(`Unsupported host ${process.platform}/${process.arch}. Pass --target explicitly.`);
}

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: options.encoding,
    stdio: options.encoding ? ["ignore", "pipe", "inherit"] : "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit status ${result.status ?? "unknown"}.`);
  }

  return result;
}
