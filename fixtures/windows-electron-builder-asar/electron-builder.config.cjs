const { electron: electronVersion } = require("../../examples/electron-basic/package.json").dependencies;

module.exports = {
  appId: "dev.steambridge.asar-gate",
  productName: "SteamBridgeSmoke",
  electronVersion,
  asar: {
    smartUnpack: false
  },
  asarUnpack: [
    "node_modules/steam-bridge/steam_bridge_native.win32-x64-msvc.node",
    "node_modules/steam-bridge/steam_api64.dll",
    "node_modules/steam-bridge/sdkencryptedappticket64.dll"
  ],
  npmRebuild: false,
  nodeGypRebuild: false,
  compression: "store",
  files: [
    "main.cjs",
    "smoke/**/*",
    "native-binding-manifest.json",
    "steam-bridge-package-provenance.json",
    "package.json",
    "node_modules/steam-bridge/**/*"
  ],
  extraResources: [
    {
      from: "node_modules/steam-bridge/bin/validate-checkout-target.cjs",
      to: "steam-bridge-tools/bin/validate-checkout-target.cjs"
    },
    {
      from: "node_modules/steam-bridge/dist",
      to: "steam-bridge-tools/dist",
      filter: ["**/*"]
    }
  ],
  extraFiles: [
    {
      from: "windows-tools",
      to: ".",
      filter: ["**/*"]
    }
  ],
  win: {
    target: "dir",
    signExts: [".node"]
  }
};
