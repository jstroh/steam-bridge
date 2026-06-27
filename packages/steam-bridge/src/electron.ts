export type ElectronSteamOverlayProfile = "off" | "diagnostic" | "repaint" | "compatibility";

export interface ElectronOverlayOptions {
  enableInProcessGpu?: boolean;
  repaintIntervalMs?: number;
}

export interface ElectronSteamOverlayProfileOptions extends ElectronOverlayOptions {
  profile?: ElectronSteamOverlayProfile;
  forceHighPerformanceGpu?: boolean;
  disableBackgroundThrottling?: boolean;
  ignoreGpuBlocklist?: boolean;
  scrubSteamOverlayChildProcessEnv?: boolean;
  isolateSteamOverlayChildProcesses?: boolean;
}

export interface ElectronSteamOverlayConfigResult {
  profile: ElectronSteamOverlayProfile;
  switches: string[];
  repaintIntervalMs: number;
  scrubSteamOverlayChildProcessEnv: boolean;
  isolateSteamOverlayChildProcesses: boolean;
  scrubbedEnvKeys: string[];
}

export interface ElectronNativeOverlaySessionOptions {
  title?: string;
  pumpIntervalMs?: number;
  nativeWindowHandle?: Buffer;
  restoreFocus?: () => void;
  restoreFocusDelayMs?: number;
  hideNativeHostOnOverlayDeactivate?: boolean;
}

export interface ElectronOverlayPresenterOptions {
  title?: string;
  nativeWindowHandle?: Buffer;
  restoreFocus?: () => void;
  restoreFocusDelayMs?: number;
  idleFps?: number;
  needsPresentFps?: number;
  activeOverlayFps?: number;
  pollIntervalMs?: number;
  activationBoostMs?: number;
  activeGraceMs?: number;
}

interface ElectronApp {
  commandLine: {
    appendSwitch(name: string, value?: string): void;
  };
  on(event: "browser-window-created", handler: (event: unknown, window: ElectronWindow) => void): void;
}

interface ElectronWindow {
  isDestroyed(): boolean;
  isMinimized?(): boolean;
  restore?(): void;
  show?(): void;
  focus?(): void;
  getNativeWindowHandle?(): Buffer;
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
    return {
      profile,
      switches: [],
      repaintIntervalMs: 0,
      scrubSteamOverlayChildProcessEnv: false,
      isolateSteamOverlayChildProcesses: false,
      scrubbedEnvKeys: []
    };
  }

  const compatibilityMode = profile === "compatibility";
  const repaintMode = profile === "repaint" || compatibilityMode;
  const {
    enableInProcessGpu = compatibilityMode,
    forceHighPerformanceGpu = true,
    disableBackgroundThrottling = true,
    ignoreGpuBlocklist = true,
    repaintIntervalMs = repaintMode ? 33 : 0,
    scrubSteamOverlayChildProcessEnv = true,
    isolateSteamOverlayChildProcesses = scrubSteamOverlayChildProcessEnv && process.platform === "linux"
  } = options;

  const electron = require("electron") as ElectronApi;
  const switches: string[] = [];
  const scrubbedEnvKeys = scrubSteamOverlayChildProcessEnv ? electronScrubSteamOverlayChildProcessEnv() : [];

  if (isolateSteamOverlayChildProcesses) {
    appendSwitchOnce(electron.app, switches, "no-zygote");
  }

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

  return {
    profile,
    switches,
    repaintIntervalMs,
    scrubSteamOverlayChildProcessEnv,
    isolateSteamOverlayChildProcesses,
    scrubbedEnvKeys
  };
}

export function electronDisableSteamOverlayRepaintLoop(): void {
  if (repaintTimer) {
    clearInterval(repaintTimer);
    repaintTimer = undefined;
  }
}

export function electronScrubSteamOverlayChildProcessEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const scrubbedEnvKeys: string[] = [];
  for (const key of ["LD_PRELOAD", "DYLD_INSERT_LIBRARIES"]) {
    const value = env[key];
    if (!value || !/gameoverlayrenderer/i.test(value)) {
      continue;
    }

    const keptEntries = value
      .split(":")
      .flatMap((entry) => entry.split(/\s+/))
      .filter((entry) => entry && !/gameoverlayrenderer/i.test(entry));

    if (keptEntries.length > 0) {
      env[key] = keptEntries.join(":");
    } else {
      delete env[key];
    }
    scrubbedEnvKeys.push(key);
  }

  return scrubbedEnvKeys;
}

export function electronNativeOverlaySessionOptions(
  window: ElectronWindow,
  options: Omit<ElectronNativeOverlaySessionOptions, "nativeWindowHandle" | "restoreFocus"> = {}
): ElectronNativeOverlaySessionOptions {
  return electronWindowNativeOverlayOptions(window, options);
}

export function electronOverlayPresenterOptions(
  window: ElectronWindow,
  options: Omit<ElectronOverlayPresenterOptions, "nativeWindowHandle" | "restoreFocus"> = {}
): ElectronOverlayPresenterOptions {
  return electronWindowNativeOverlayOptions(window, options);
}

function electronWindowNativeOverlayOptions<T extends { nativeWindowHandle?: Buffer; restoreFocus?: () => void }>(
  window: ElectronWindow,
  options: Omit<T, "nativeWindowHandle" | "restoreFocus">
): T {
  if (typeof window.getNativeWindowHandle !== "function") {
    throw new Error("Electron BrowserWindow does not expose getNativeWindowHandle().");
  }

  return {
    ...options,
    nativeWindowHandle: window.getNativeWindowHandle(),
    restoreFocus: () => {
      if (window.isDestroyed()) {
        return;
      }
      if (window.isMinimized?.()) {
        window.restore?.();
      }
      window.show?.();
      window.focus?.();
      window.webContents.invalidate();
    }
  } as T;
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
