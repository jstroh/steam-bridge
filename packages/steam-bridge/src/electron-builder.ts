import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface ElectronBuilderAfterPackContext {
  appOutDir: string;
  electronPlatformName?: string;
  arch?: string | number;
  packager?: {
    platform?: {
      name?: string;
    };
    appInfo?: {
      productFilename?: string;
      productName?: string;
      sanitizedProductName?: string;
      sanitizedName?: string;
      name?: string;
    };
    executableName?: string;
    config?: {
      mac?: {
        executableName?: string;
      };
    };
  };
}

export interface PrepareMacosSteamAppAfterPackOptions {
  appExe?: string;
  appPath?: string;
  appName?: string;
  appBundleName?: string;
  executableName?: string;
  signIdentity?: string;
  skipSign?: boolean;
  verify?: boolean;
  dryRun?: boolean;
  quiet?: boolean;
}

export interface PrepareMacosSteamAppAfterPackResult {
  skipped: boolean;
  reason?: string;
  appExe?: string;
  command?: string;
  args?: string[];
}

export interface PrepareLinuxSteamAppAfterPackOptions {
  appExe?: string;
  executableName?: string;
  launcherArgs?: string[];
}

export interface PrepareLinuxSteamAppAfterPackResult {
  skipped: boolean;
  reason?: string;
  appExe?: string;
  binaryExe?: string;
  launcherArgs?: string[];
}

export function prepareMacosSteamAppAfterPack(
  context: ElectronBuilderAfterPackContext,
  options: PrepareMacosSteamAppAfterPackOptions = {}
): PrepareMacosSteamAppAfterPackResult {
  const skipped = validateMacosArm64AfterPackContext(context);
  if (skipped) {
    return skipped;
  }
  const appExe = resolveMacAppExe(context, options);
  const args = [resolvePackageBin("prepare-macos-app.cjs"), "--app-exe", appExe];

  if (options.signIdentity) {
    args.push("--sign-identity", options.signIdentity);
  }
  if (options.skipSign) {
    args.push("--skip-sign");
  } else if (options.verify === false) {
    args.push("--no-verify");
  }
  if (options.dryRun) {
    args.push("--dry-run");
  }

  return runPackageCli("steam-bridge macOS app preparation", appExe, args, options.quiet);
}

export function verifyMacosSteamAppAfterSign(
  context: ElectronBuilderAfterPackContext,
  options: Pick<PrepareMacosSteamAppAfterPackOptions, "appExe" | "appPath" | "appName" | "appBundleName" | "executableName" | "quiet"> = {}
): PrepareMacosSteamAppAfterPackResult {
  const skipped = validateMacosArm64AfterPackContext(context);
  if (skipped) {
    return skipped;
  }
  const appExe = resolveMacAppExe(context, options);
  const args = [resolvePackageBin("verify-macos-signing.cjs"), "--app-exe", appExe];
  return runPackageCli("steam-bridge macOS signing verification", appExe, args, options.quiet);
}

export function prepareLinuxSteamAppAfterPack(
  context: ElectronBuilderAfterPackContext,
  options: PrepareLinuxSteamAppAfterPackOptions = {}
): PrepareLinuxSteamAppAfterPackResult {
  const platform = normalizePlatform(context) ?? process.platform;
  if (platform !== "linux") {
    return { skipped: true, reason: `non-linux-target:${platform}` };
  }

  const appExe = resolveLinuxAppExe(context, options);
  const binaryExe = `${appExe}.bin`;
  const launcherArgs = options.launcherArgs ?? ["--no-zygote", "--no-sandbox"];

  if (!fs.existsSync(binaryExe)) {
    if (!fs.existsSync(appExe)) {
      throw new Error(`prepareLinuxSteamAppAfterPack could not find the Linux executable at ${appExe}.`);
    }
    fs.renameSync(appExe, binaryExe);
  }

  const launcher = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'cd "$(dirname "${BASH_SOURCE[0]}")"',
    `exec ${shellSingleQuote(`./${path.basename(binaryExe)}`)} ${launcherArgs.map(shellSingleQuote).join(" ")} "$@"`,
    ""
  ].join("\n");

  fs.writeFileSync(appExe, launcher, { mode: 0o755 });
  fs.chmodSync(appExe, 0o755);
  fs.chmodSync(binaryExe, 0o755);

  return {
    skipped: false,
    appExe,
    binaryExe,
    launcherArgs
  };
}

function validateMacosArm64AfterPackContext(
  context: ElectronBuilderAfterPackContext
): PrepareMacosSteamAppAfterPackResult | undefined {
  const platform = normalizePlatform(context) ?? process.platform;
  if (platform !== "darwin") {
    return { skipped: true, reason: `non-macos-target:${platform}` };
  }

  const arch = normalizeArch(context.arch) ?? process.arch;
  if (arch !== "arm64") {
    throw new Error(
      `Steam Bridge supports macOS Apple Silicon arm64 apps only; electron-builder target arch ${formatValue(arch)} is unsupported. ` +
        "Remove Intel macOS, darwin-x64, and universal macOS targets before preparing the Steam overlay launcher."
    );
  }

  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error(
      `Steam Bridge macOS app preparation must run on native Apple Silicon macOS; current host is ${process.platform}/${process.arch}.`
    );
  }

  return undefined;
}

function runPackageCli(
  label: string,
  appExe: string,
  args: string[],
  quiet: boolean | undefined
): PrepareMacosSteamAppAfterPackResult {
  const command = process.execPath;
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit"
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      `${label} failed with status ${result.status ?? "unknown"} for ${appExe}${details ? `\n${details}` : ""}`
    );
  }

  return {
    skipped: false,
    appExe,
    command,
    args
  };
}

function resolvePackageBin(fileName: string): string {
  return path.join(__dirname, "..", "bin", fileName);
}

function normalizePlatform(context: ElectronBuilderAfterPackContext): string | undefined {
  return context.electronPlatformName || context.packager?.platform?.name;
}

function normalizeArch(arch: string | number | undefined): string | undefined {
  if (arch == null) {
    return undefined;
  }

  const value = String(arch).toLowerCase();
  const electronBuilderArchByNumber: Record<string, string> = {
    "0": "ia32",
    "1": "x64",
    "2": "armv7l",
    "3": "arm64",
    "4": "universal"
  };
  return electronBuilderArchByNumber[value] ?? value;
}

function resolveMacAppExe(
  context: ElectronBuilderAfterPackContext,
  options: PrepareMacosSteamAppAfterPackOptions
): string {
  if (options.appExe) {
    return path.resolve(options.appExe);
  }

  if (!context.appOutDir) {
    throw new Error("prepareMacosSteamAppAfterPack requires electron-builder context.appOutDir.");
  }

  const appPath = options.appPath ? path.resolve(options.appPath) : path.join(context.appOutDir, appBundleName(context, options));
  const executableName =
    options.executableName ||
    options.appName ||
    context.packager?.config?.mac?.executableName ||
    basenameWithoutAppSuffix(appPath);

  if (!executableName) {
    throw new Error(
      "prepareMacosSteamAppAfterPack could not determine the macOS executable name. Pass options.executableName or options.appExe."
    );
  }

  return path.join(appPath, "Contents", "MacOS", executableName);
}

function resolveLinuxAppExe(
  context: ElectronBuilderAfterPackContext,
  options: PrepareLinuxSteamAppAfterPackOptions
): string {
  if (options.appExe) {
    return path.resolve(options.appExe);
  }

  if (!context.appOutDir) {
    throw new Error("prepareLinuxSteamAppAfterPack requires electron-builder context.appOutDir.");
  }

  const candidates = [
    options.executableName,
    context.packager?.executableName,
    context.packager?.appInfo?.productFilename,
    context.packager?.appInfo?.productName,
    context.packager?.appInfo?.sanitizedProductName,
    context.packager?.appInfo?.sanitizedName,
    context.packager?.appInfo?.name
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const appExe = path.isAbsolute(candidate) ? candidate : path.join(context.appOutDir, candidate);
    if (fs.existsSync(appExe) || fs.existsSync(`${appExe}.bin`)) {
      return path.resolve(appExe);
    }
  }

  throw new Error(
    "prepareLinuxSteamAppAfterPack could not determine the Linux executable name. " +
      "Pass options.executableName or options.appExe."
  );
}

function appBundleName(context: ElectronBuilderAfterPackContext, options: PrepareMacosSteamAppAfterPackOptions): string {
  const configuredName =
    options.appBundleName ||
    options.appName ||
    context.packager?.appInfo?.productFilename ||
    context.packager?.appInfo?.productName ||
    context.packager?.appInfo?.sanitizedProductName ||
    context.packager?.appInfo?.name;

  if (!configuredName) {
    throw new Error(
      "prepareMacosSteamAppAfterPack could not determine the macOS .app bundle name. Pass options.appBundleName, options.appName, or options.appExe."
    );
  }

  return configuredName.endsWith(".app") ? configuredName : `${configuredName}.app`;
}

function basenameWithoutAppSuffix(appPath: string): string {
  const basename = path.basename(appPath);
  return basename.endsWith(".app") ? basename.slice(0, -4) : basename;
}

function formatValue(value: unknown): string {
  return value == null ? "<unknown>" : String(value);
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
