import {
  prepareLinuxSteamAppAfterPack,
  prepareMacosSteamAppAfterPack,
  verifyMacosSteamAppAfterSign,
  type ElectronBuilderAfterPackContext,
  type PrepareLinuxSteamAppAfterPackOptions,
  type PrepareLinuxSteamAppAfterPackResult,
  type PrepareMacosSteamAppAfterPackOptions,
  type PrepareMacosSteamAppAfterPackResult
} from "./electron-builder";

export type {
  ElectronBuilderAfterPackContext,
  PrepareLinuxSteamAppAfterPackOptions,
  PrepareLinuxSteamAppAfterPackResult,
  PrepareMacosSteamAppAfterPackOptions,
  PrepareMacosSteamAppAfterPackResult
} from "./electron-builder";

export interface SteamBuildHookOptions {
  linux?: PrepareLinuxSteamAppAfterPackOptions;
  macos?: PrepareMacosSteamAppAfterPackOptions;
}

export interface SteamBuildHooks {
  afterPack(
    context: ElectronBuilderAfterPackContext
  ): PrepareLinuxSteamAppAfterPackResult | PrepareMacosSteamAppAfterPackResult | undefined;
  afterSign(
    context: ElectronBuilderAfterPackContext
  ): PrepareMacosSteamAppAfterPackResult | undefined;
}

/** Create the complete electron-builder hook pair for Steam packages. */
export function createSteamBuildHooks(options: SteamBuildHookOptions = {}): SteamBuildHooks {
  return {
    afterPack(context) {
      const platform = context.electronPlatformName ?? context.packager?.platform?.name ?? process.platform;
      if (platform === "darwin") {
        return prepareMacosSteamAppAfterPack(context, options.macos);
      }
      if (platform === "linux") {
        return prepareLinuxSteamAppAfterPack(context, options.linux);
      }
      return undefined;
    },
    afterSign(context) {
      const platform = context.electronPlatformName ?? context.packager?.platform?.name ?? process.platform;
      return platform === "darwin"
        ? verifyMacosSteamAppAfterSign(context, options.macos)
        : undefined;
    }
  };
}
