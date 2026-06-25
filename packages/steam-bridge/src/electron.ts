export type ElectronSteamOverlayProfile = "off" | "diagnostic" | "compatibility";

export interface ElectronOverlayOptions {
  enableInProcessGpu?: boolean;
  repaintIntervalMs?: number;
}

export interface ElectronSteamOverlayProfileOptions extends ElectronOverlayOptions {
  profile?: ElectronSteamOverlayProfile;
  forceHighPerformanceGpu?: boolean;
  disableBackgroundThrottling?: boolean;
  ignoreGpuBlocklist?: boolean;
}

export interface ElectronSteamOverlayConfigResult {
  profile: ElectronSteamOverlayProfile;
  switches: string[];
  repaintIntervalMs: number;
}

interface ElectronApp {
  commandLine: {
    appendSwitch(name: string, value?: string): void;
  };
  on(event: "browser-window-created", handler: (event: unknown, window: ElectronWindow) => void): void;
}

interface ElectronWindow {
  isDestroyed(): boolean;
  webContents: {
    once(event: "did-finish-load", handler: () => void): void;
    invalidate(): void;
    send(channel: string, ...args: unknown[]): void;
  };
}

interface ElectronApi {
  app: ElectronApp;
  BrowserWindow: {
    getAllWindows(): ElectronWindow[];
  };
}

let repaintTimer: NodeJS.Timeout | undefined;
let browserWindowCreatedListenerInstalled = false;
const appendedSwitches = new Set<string>();

export function electronEnableSteamOverlay(options: ElectronOverlayOptions = {}): void {
  electronConfigureSteamOverlay({
    profile: "compatibility",
    ...options
  });
}

export function electronConfigureSteamOverlay(
  options: ElectronSteamOverlayProfileOptions = {}
): ElectronSteamOverlayConfigResult {
  const profile = options.profile ?? "diagnostic";
  if (profile === "off") {
    electronDisableSteamOverlayRepaintLoop();
    return { profile, switches: [], repaintIntervalMs: 0 };
  }

  const compatibilityMode = profile === "compatibility";
  const {
    enableInProcessGpu = compatibilityMode,
    forceHighPerformanceGpu = true,
    disableBackgroundThrottling = true,
    ignoreGpuBlocklist = true,
    repaintIntervalMs = compatibilityMode ? 1000 : 0
  } = options;

  const electron = require("electron") as ElectronApi;
  const switches: string[] = [];

  if (enableInProcessGpu) {
    appendSwitchOnce(electron.app, switches, "in-process-gpu");
  }

  if (forceHighPerformanceGpu) {
    appendSwitchOnce(electron.app, switches, "force_high_performance_gpu");
  }

  if (ignoreGpuBlocklist) {
    appendSwitchOnce(electron.app, switches, "ignore-gpu-blocklist");
  }

  if (disableBackgroundThrottling) {
    appendSwitchOnce(electron.app, switches, "disable-renderer-backgrounding");
    appendSwitchOnce(electron.app, switches, "disable-background-timer-throttling");
  }

  if (!browserWindowCreatedListenerInstalled) {
    electron.app.on("browser-window-created", (_event, window) => {
      window.webContents.once("did-finish-load", () => {
        window.webContents.invalidate();
      });
    });
    browserWindowCreatedListenerInstalled = true;
  }

  if (!repaintTimer && repaintIntervalMs > 0) {
    repaintTimer = setInterval(() => {
      for (const window of electron.BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.invalidate();
        }
      }
    }, repaintIntervalMs);

    repaintTimer.unref?.();
  }

  return { profile, switches, repaintIntervalMs };
}

export function electronDisableSteamOverlayRepaintLoop(): void {
  if (repaintTimer) {
    clearInterval(repaintTimer);
    repaintTimer = undefined;
  }
}

function appendSwitchOnce(
  app: ElectronApp,
  switches: string[],
  name: string,
  value?: string
): void {
  const key = value === undefined ? name : `${name}=${value}`;
  if (appendedSwitches.has(key)) {
    return;
  }

  app.commandLine.appendSwitch(name, value);
  appendedSwitches.add(key);
  switches.push(key);
}
