#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  readCfBundleExecutable,
  resolveMacAppBundleExecutable,
  verifyMacAppBundleLauncher,
  verifyRenamedElectronIsNotLauncher,
  verifySignedExecutable,
  verifySteamLauncherIdentity
} = require("./verify-macos-signing.cjs");

const packageRoot = path.resolve(__dirname, "..");
const defaultLauncherSource = path.join(packageRoot, "templates", "macos-steam-env-launcher.c");
const defaultEntitlements = path.join(packageRoot, "templates", "entitlements.steam.macos.plist");

function main(args = process.argv.slice(2)) {
  const status = runCli(args);
  if (status !== 0) {
    process.exit(status);
  }
}

function runCli(args, io = console) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    io.error(error.message);
    printUsage(io);
    return 2;
  }

  if (options.help) {
    printUsage(io);
    return 0;
  }

  if (options.selfTest) {
    try {
      runSelfTest();
    } catch (error) {
      io.error(error.message);
      return 1;
    }
    io.log("macOS Steam app preparation self-test passed.");
    return 0;
  }

  if (process.platform !== "darwin") {
    io.error("macOS Steam app preparation must run on macOS.");
    return 1;
  }

  if (!options.appExe) {
    io.error("missing --app-exe value");
    printUsage(io);
    return 2;
  }

  try {
    prepareMacApp(options, io);
  } catch (error) {
    io.error(error.message);
    return 1;
  }

  return 0;
}

function parseArgs(args) {
  const options = {
    appExe: "",
    launcherSource: defaultLauncherSource,
    entitlements: defaultEntitlements,
    signIdentity: "-",
    sign: true,
    verify: true,
    dryRun: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--self-test":
        options.selfTest = true;
        break;
      case "--app-exe":
        index = readValueArg(args, index, arg, (value) => {
          options.appExe = value;
        });
        break;
      case "--launcher-source":
        index = readValueArg(args, index, arg, (value) => {
          options.launcherSource = value;
        });
        break;
      case "--entitlements":
        index = readValueArg(args, index, arg, (value) => {
          options.entitlements = value;
        });
        break;
      case "--sign-identity":
        index = readValueArg(args, index, arg, (value) => {
          options.signIdentity = value;
        });
        break;
      case "--skip-sign":
        options.sign = false;
        options.verify = false;
        break;
      case "--no-verify":
        options.verify = false;
        break;
      case "--verify":
        options.verify = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`unknown option: ${arg}`);
        }
        if (options.appExe) {
          throw new Error(`unexpected argument: ${arg}`);
        }
        options.appExe = arg;
        break;
    }
  }

  return options;
}

function readValueArg(args, index, name, assign) {
  const nextIndex = index + 1;
  if (!args[nextIndex]) {
    throw new Error(`missing ${name} value`);
  }
  assign(args[nextIndex]);
  return nextIndex;
}

function printUsage(io = console) {
  io.error(`Usage:
  steam-bridge-prepare-macos-app --app-exe PATH [options]
  steam-bridge-prepare-macos-app --self-test

Prepares an Electron macOS .app for Steam overlay injection by replacing the
bundle executable with Steam Bridge's native launcher, renaming Electron to
<AppExecutable>.electron, signing both executables with Steam-compatible
entitlements, and running the macOS signing verifier.

Options:
  --app-exe PATH            Path to YourApp.app/Contents/MacOS/YourApp.
  --launcher-source PATH    Native launcher source. Defaults to the package template.
  --entitlements PATH       Entitlements plist. Defaults to the package template.
  --sign-identity ID        codesign identity. Defaults to ad-hoc "-".
  --skip-sign               Compile/rename only; also disables verification.
  --no-verify               Do not run steam-bridge-verify-macos-signing after signing.
  --dry-run                 Print planned actions without changing files.
`);
}

function prepareMacApp(options, io = console) {
  const resolved = resolvePreparePaths(options.appExe);
  const launcherSource = path.resolve(options.launcherSource || defaultLauncherSource);
  const entitlements = path.resolve(options.entitlements || defaultEntitlements);

  assertNonEmptyFile(launcherSource, "launcher source");
  if (options.sign) {
    assertNonEmptyFile(entitlements, "entitlements");
  }
  if (!options.dryRun) {
    assertExecutable(resolved.appExe, "current app executable");
  }

  logStep(io, options, `prepare ${resolved.appExe}`);
  if (!fs.existsSync(resolved.electronExe)) {
    logStep(io, options, `rename ${resolved.appExe} -> ${resolved.electronExe}`);
    if (!options.dryRun) {
      fs.renameSync(resolved.appExe, resolved.electronExe);
    }
  } else {
    logStep(io, options, `reuse existing renamed Electron executable ${resolved.electronExe}`);
  }

  logStep(io, options, `set CFBundleExecutable=${resolved.bundle.executableName}`);
  if (!options.dryRun) {
    setCfBundleExecutable(resolved.bundle.infoPlist, resolved.bundle.executableName);
  }

  const compileArgs = launcherCompileArgs(launcherSource, resolved.appExe);
  logStep(io, options, `compile launcher: clang ${compileArgs.join(" ")}`);
  if (!options.dryRun) {
    run("clang", compileArgs, "native launcher compilation failed");
    fs.chmodSync(resolved.appExe, 0o755);
  }

  if (options.sign) {
    signExecutable(resolved.electronExe, entitlements, options.signIdentity, options, io);
    signExecutable(resolved.appExe, entitlements, options.signIdentity, options, io);
  }

  if (options.verify) {
    logStep(io, options, "verify prepared macOS Steam app shape");
    if (!options.dryRun) {
      verifyMacAppBundleLauncher(resolved.appExe, "native launcher");
      verifySteamLauncherIdentity(resolved.appExe, "native launcher");
      verifyRenamedElectronIsNotLauncher(resolved.electronExe, "renamed Electron executable");
      verifySignedExecutable(resolved.appExe, "native launcher");
      verifySignedExecutable(resolved.electronExe, "renamed Electron executable");
    }
  }

  logStep(io, options, `prepared macOS Steam app: ${resolved.appExe}`);
}

function resolvePreparePaths(appExe) {
  const resolvedAppExe = path.resolve(appExe);
  const bundle = resolveMacAppBundleExecutable(resolvedAppExe);
  if (!bundle) {
    throw new Error(`--app-exe must point inside YourApp.app/Contents/MacOS: ${appExe}`);
  }
  return {
    appExe: resolvedAppExe,
    electronExe: `${resolvedAppExe}.electron`,
    bundle
  };
}

function launcherCompileArgs(launcherSource, appExe) {
  return ["-Wall", "-Wextra", "-O2", "-arch", "arm64", "-o", appExe, launcherSource];
}

function signExecutable(filePath, entitlements, identity, options, io = console) {
  const signArgs = ["--force", "--sign", identity || "-", "--entitlements", entitlements, filePath];
  logStep(io, options, `sign ${filePath}`);
  if (!options.dryRun) {
    run("codesign", signArgs, `codesign failed for ${filePath}`);
  }
}

function setCfBundleExecutable(infoPlistPath, executableName) {
  run(
    "/usr/bin/plutil",
    ["-replace", "CFBundleExecutable", "-string", executableName, infoPlistPath],
    `failed to update CFBundleExecutable in ${infoPlistPath}`
  );

  const actual = readCfBundleExecutable(infoPlistPath);
  if (actual !== executableName) {
    throw new Error(
      `failed to update CFBundleExecutable in ${infoPlistPath}: expected ${executableName}, got ${actual}`
    );
  }
}

function logStep(io, options, message) {
  io.log(`${options.dryRun ? "DRY-RUN " : ""}${message}`);
}

function assertExecutable(filePath, label) {
  const stats = statNonEmptyFile(filePath, label);
  if ((stats.mode & 0o111) === 0) {
    throw new Error(`${label} is not executable: ${filePath}`);
  }
}

function assertNonEmptyFile(filePath, label) {
  statNonEmptyFile(filePath, label);
}

function statNonEmptyFile(filePath, label) {
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    throw new Error(`${label} is missing: ${filePath}`);
  }
  if (!stats.isFile()) {
    throw new Error(`${label} is not a file: ${filePath}`);
  }
  if (stats.size <= 0) {
    throw new Error(`${label} is empty: ${filePath}`);
  }
  return stats;
}

function run(command, args, errorPrefix) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(detail ? `${errorPrefix}:\n${detail}` : errorPrefix);
  }

  return result;
}

function runSelfTest() {
  assert.equal(
    parseArgs(["--app-exe", "/tmp/Game.app/Contents/MacOS/Game"]).appExe,
    "/tmp/Game.app/Contents/MacOS/Game"
  );
  assert.equal(parseArgs(["--skip-sign", "--verify"]).verify, true);
  assert.equal(parseArgs(["--skip-sign"]).verify, false);
  assert.equal(parseArgs(["--sign-identity", "Developer ID Application: Example"]).signIdentity, "Developer ID Application: Example");
  assert.throws(() => parseArgs(["--unknown"]), /unknown option/);

  const paths = resolvePreparePaths("/tmp/My Game.app/Contents/MacOS/My Game");
  assert.equal(paths.appExe, "/tmp/My Game.app/Contents/MacOS/My Game");
  assert.equal(paths.electronExe, "/tmp/My Game.app/Contents/MacOS/My Game.electron");
  assert.equal(paths.bundle.executableName, "My Game");
  assert.throws(() => resolvePreparePaths("/tmp/My Game"), /Contents\/MacOS/);

  assert.deepEqual(launcherCompileArgs("/tmp/launcher.c", "/tmp/App.app/Contents/MacOS/App"), [
    "-Wall",
    "-Wextra",
    "-O2",
    "-arch",
    "arm64",
    "-o",
    "/tmp/App.app/Contents/MacOS/App",
    "/tmp/launcher.c"
  ]);
}

if (require.main === module) {
  main();
}

module.exports = {
  defaultEntitlements,
  defaultLauncherSource,
  launcherCompileArgs,
  main,
  parseArgs,
  prepareMacApp,
  resolvePreparePaths,
  runCli,
  runSelfTest
};
