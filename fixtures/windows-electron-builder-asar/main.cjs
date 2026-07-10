const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const resultPrefix = "--steam-bridge-package-probe-result=";
const resultPath = process.argv.find((argument) => argument.startsWith(resultPrefix))?.slice(resultPrefix.length);

if (!resultPath) {
  require("./smoke/main.js");
} else {
  let finished = false;

  function finish(result, exitCode) {
    if (finished) {
      return;
    }
    finished = true;
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    app.exit(exitCode);
  }

  process.on("uncaughtException", (error) => {
    finish({ ok: false, error: error instanceof Error ? error.message : String(error) }, 1);
  });
  process.on("unhandledRejection", (error) => {
    finish({ ok: false, error: error instanceof Error ? error.message : String(error) }, 1);
  });

  app.whenReady().then(() => {
    if (process.env.STEAM_BRIDGE_NATIVE_PATH) {
      throw new Error("STEAM_BRIDGE_NATIVE_PATH must be unset for the production package probe.");
    }

    const packageEntry = require.resolve("steam-bridge");
    const packageDistDir = path.dirname(packageEntry);
    const packageRoot = path.dirname(packageDistDir);
    const logicalAddonPath = path.join(packageRoot, "steam_bridge_native.win32-x64-msvc.node");
    const physicalAddonPath = logicalAddonPath.replace(/([/\\][^/\\]+\.asar)([/\\])/, "$1.unpacked$2");
    if (!packageEntry.includes("app.asar")) {
      throw new Error("steam-bridge JavaScript was not loaded from app.asar.");
    }
    if (!fs.existsSync(physicalAddonPath)) {
      throw new Error("The physical ASAR-unpacked Steam Bridge addon is missing.");
    }

    const { loadNativeBinding } = require(path.join(packageDistDir, "native.js"));
    const binding = loadNativeBinding();
    if (typeof binding.isSteamRunning !== "function") {
      throw new Error("Native binding is missing isSteamRunning().");
    }
    if (typeof binding.isOverlayNeedsPresentPollingEnabled !== "function") {
      throw new Error("Native binding is missing isOverlayNeedsPresentPollingEnabled().");
    }

    finish(
      {
        ok: true,
        appPackaged: app.isPackaged,
        platform: process.platform,
        arch: process.arch,
        napi: process.versions.napi,
        electron: process.versions.electron,
        packageEntryInAsar: packageEntry.includes("app.asar"),
        physicalAddonPresent: true,
        nativeOverridePresent: false,
        steamRunningType: typeof binding.isSteamRunning(),
        needsPresentPollingEnabledType: typeof binding.isOverlayNeedsPresentPollingEnabled()
      },
      0
    );
  });
}
