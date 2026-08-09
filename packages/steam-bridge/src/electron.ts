import { ensureKWinWaylandOverlayHostSync } from "./kwin";
import type { SteamInputDefinition, SteamInputFrame, SteamInputSession } from "./index";
export {
  getKWinWaylandOverlayHostSyncStatus,
  onKWinWaylandOverlaySourceInteractiveResize
} from "./kwin";
export type {
  KWinWaylandOverlayHostSyncStatus,
  KWinWaylandOverlaySourceInteractiveResizeEvent
} from "./kwin";

export type ElectronSteamOverlayProfile = "off" | "diagnostic" | "repaint" | "compatibility";

export type ElectronSteamInputValue<T> = T extends bigint
  ? string
  : T extends readonly (infer TItem)[]
    ? ReadonlyArray<ElectronSteamInputValue<TItem>>
    : T extends object
      ? { [K in keyof T]: ElectronSteamInputValue<T[K]> }
      : T;

/** JSON-safe Steam Input frame delivered from Electron's main process to one renderer. */
export type ElectronSteamInputFrame<TDefinition extends SteamInputDefinition = SteamInputDefinition> =
  ElectronSteamInputValue<SteamInputFrame<TDefinition>>;

export interface ElectronSteamInputTransportOptions {
  /** Dedicated MessagePort bootstrap channel. Defaults to `steam-bridge:steam-input`. */
  channel?: string;
  /** Test/embedding hook. Normal Electron applications should omit this. */
  createMessageChannel?: () => ElectronSteamInputMessageChannel;
}

export interface ElectronSteamInputTransport<TDefinition extends SteamInputDefinition = SteamInputDefinition> {
  /** Poll Steam Input exactly once and publish the newest frame without an unbounded IPC queue. */
  update(): SteamInputFrame<TDefinition>;
  /** Publish an already-polled frame when the application owns the game-frame scheduler. */
  publish(frame: SteamInputFrame<TDefinition>): void;
  getDiagnostics(): ElectronSteamInputTransportDiagnostics;
  close(): void;
  readonly closed: boolean;
}

export interface ElectronSteamInputTransportDiagnostics {
  closed: boolean;
  inFlightSequence: string | null;
  pendingSequence: string | null;
  lastPublishedSequence: string | null;
  lastAcknowledgedSequence: string | null;
  publishedFrameCount: number;
  sentFrameCount: number;
  acknowledgedFrameCount: number;
  coalescedFrameCount: number;
}

export interface ElectronSteamInputRendererSubscription {
  close(): void;
  readonly closed: boolean;
}

export interface ElectronSteamInputMessagePortMain {
  postMessage(value: unknown): void;
  start(): void;
  close(): void;
  on(event: "message", listener: (event: { data?: unknown } | unknown) => void): unknown;
  on(event: "close", listener: () => void): unknown;
  off?(event: "message", listener: (event: { data?: unknown } | unknown) => void): unknown;
  off?(event: "close", listener: () => void): unknown;
}

export interface ElectronSteamInputMessageChannel {
  port1: ElectronSteamInputMessagePortMain;
  port2: ElectronSteamInputMessagePortMain;
}

export interface ElectronSteamInputWebContents {
  postMessage(channel: string, message: unknown, transfer?: ElectronSteamInputMessagePortMain[]): void;
  isDestroyed?(): boolean;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  off?(event: string, listener: (...args: unknown[]) => void): unknown;
}

export interface ElectronSteamInputRendererPort {
  postMessage(value: unknown): void;
  start?(): void;
  close(): void;
  onmessage: ((event: { data?: unknown }) => void) | null;
}

export interface ElectronSteamInputIpcRenderer {
  on(channel: string, listener: (event: { ports?: ElectronSteamInputRendererPort[] }) => void): unknown;
  off?(channel: string, listener: (event: { ports?: ElectronSteamInputRendererPort[] }) => void): unknown;
  removeListener?(channel: string, listener: (event: { ports?: ElectronSteamInputRendererPort[] }) => void): unknown;
}

const DEFAULT_ELECTRON_STEAM_INPUT_CHANNEL = "steam-bridge:steam-input";

/**
 * Create the main-process half of Steam Bridge's bounded Steam Input transport.
 *
 * Only one frame may be in flight. If the renderer is slow, intermediate frames
 * are replaced by the newest one and delivered after its acknowledgement.
 */
export function createElectronSteamInputTransport<TDefinition extends SteamInputDefinition>(
  session: SteamInputSession<TDefinition>,
  webContents: ElectronSteamInputWebContents,
  options: ElectronSteamInputTransportOptions = {}
): ElectronSteamInputTransport<TDefinition> {
  const channel = electronSteamInputChannel(options.channel);
  if (webContents.isDestroyed?.()) throw new Error("Cannot attach Steam Input to destroyed Electron webContents");
  const messageChannel = options.createMessageChannel?.() ?? createElectronSteamInputMessageChannel();
  const mainPort = messageChannel.port2;
  let isClosed = false;
  let inFlightSequence: string | null = null;
  let pendingFrame: ElectronSteamInputFrame<TDefinition> | null = null;
  let lastPublishedSequence: string | null = null;
  let lastAcknowledgedSequence: string | null = null;
  let publishedFrameCount = 0;
  let sentFrameCount = 0;
  let acknowledgedFrameCount = 0;
  let coalescedFrameCount = 0;

  const sendPendingFrame = (): void => {
    if (isClosed || inFlightSequence != null || pendingFrame == null) return;
    const frame = pendingFrame;
    pendingFrame = null;
    inFlightSequence = frame.sequence;
    try {
      mainPort.postMessage({ type: "frame", version: 1, frame });
      sentFrameCount += 1;
    } catch (error) {
      inFlightSequence = null;
      pendingFrame = frame;
      closeTransport();
      throw error;
    }
  };
  const onMessage = (event: { data?: unknown } | unknown): void => {
    const data = electronSteamInputMessageData(event);
    if (!data || typeof data !== "object") return;
    const value = data as { type?: unknown; sequence?: unknown };
    if (value.type !== "ack" || value.sequence !== inFlightSequence) return;
    lastAcknowledgedSequence = inFlightSequence;
    acknowledgedFrameCount += 1;
    inFlightSequence = null;
    try {
      sendPendingFrame();
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      process.emitWarning(`Electron Steam Input transport failed while sending a pending frame: ${cause.message}`, {
        code: "STEAM_INPUT_TRANSPORT_SEND_FAILED",
        detail: cause.stack
      });
    }
  };
  const closeTransport = (): void => {
    if (isClosed) return;
    isClosed = true;
    pendingFrame = null;
    inFlightSequence = null;
    webContents.off?.("destroyed", onDestroyed);
    webContents.off?.("render-process-gone", onDestroyed);
    webContents.off?.("did-start-navigation", onNavigation);
    mainPort.off?.("message", onMessage);
    mainPort.off?.("close", onPortClosed);
    try {
      mainPort.close();
    } catch {
      // The peer may already have closed or neutered the port. Lifecycle state
      // and listeners are still deterministically released above.
    }
  };
  const onDestroyed = (): void => closeTransport();
  const onPortClosed = (): void => closeTransport();
  const onNavigation = (...args: unknown[]): void => {
    const navigationDetails = args[1];
    const explicitIsMainFrame = args[3];
    if (explicitIsMainFrame === false) return;
    if (
      navigationDetails &&
      typeof navigationDetails === "object" &&
      "isMainFrame" in navigationDetails &&
      (navigationDetails as { isMainFrame?: unknown }).isMainFrame === false
    ) {
      return;
    }
    closeTransport();
  };
  try {
    mainPort.on("message", onMessage);
    mainPort.on("close", onPortClosed);
    mainPort.start();
    webContents.on?.("destroyed", onDestroyed);
    webContents.on?.("render-process-gone", onDestroyed);
    webContents.on?.("did-start-navigation", onNavigation);
    webContents.postMessage(channel, { type: "connect", version: 1 }, [messageChannel.port1]);
  } catch (error) {
    closeTransport();
    try {
      messageChannel.port1.close();
    } catch {
      // The transfer may already have consumed the renderer endpoint.
    }
    throw error;
  }

  const transport: ElectronSteamInputTransport<TDefinition> = {
    update(): SteamInputFrame<TDefinition> {
      const frame = session.update();
      transport.publish(frame);
      return frame;
    },
    publish(frame: SteamInputFrame<TDefinition>): void {
      if (isClosed) return;
      const serialized = serializeElectronSteamInputFrame(frame);
      if (!isElectronSteamInputFrame(serialized)) {
        throw new TypeError("Electron Steam Input transport requires a valid frame with an unsigned sequence");
      }
      if (lastPublishedSequence != null && BigInt(serialized.sequence) <= BigInt(lastPublishedSequence)) {
        throw new RangeError(
          `Electron Steam Input frame sequence must increase; received ${serialized.sequence} after ${lastPublishedSequence}`
        );
      }
      publishedFrameCount += 1;
      lastPublishedSequence = serialized.sequence;
      if (pendingFrame != null) coalescedFrameCount += 1;
      pendingFrame = serialized;
      sendPendingFrame();
    },
    getDiagnostics(): ElectronSteamInputTransportDiagnostics {
      return {
        closed: isClosed,
        inFlightSequence,
        pendingSequence: pendingFrame?.sequence ?? null,
        lastPublishedSequence,
        lastAcknowledgedSequence,
        publishedFrameCount,
        sentFrameCount,
        acknowledgedFrameCount,
        coalescedFrameCount
      };
    },
    close(): void {
      closeTransport();
    },
    get closed(): boolean {
      return isClosed;
    }
  };
  return transport;
}

/**
 * Install the preload/renderer half. Expose the resulting frame callback from a
 * context-isolated preload instead of exposing `ipcRenderer` itself.
 */
export function subscribeElectronSteamInput<TDefinition extends SteamInputDefinition>(
  ipcRenderer: ElectronSteamInputIpcRenderer,
  listener: (frame: ElectronSteamInputFrame<TDefinition>) => void,
  options: Pick<ElectronSteamInputTransportOptions, "channel"> = {}
): ElectronSteamInputRendererSubscription {
  if (typeof listener !== "function") {
    throw new TypeError("Electron Steam Input renderer listener must be a function");
  }
  const channel = electronSteamInputChannel(options.channel);
  let isClosed = false;
  let rendererPort: ElectronSteamInputRendererPort | null = null;
  const detachRendererPort = (port: ElectronSteamInputRendererPort, suppressCloseError = false): void => {
    port.onmessage = null;
    try {
      port.close();
    } catch (error) {
      if (!suppressCloseError) throw error;
    }
  };
  const onConnect = (event: { ports?: ElectronSteamInputRendererPort[] }): void => {
    const ports = event.ports ?? [];
    if (isClosed) {
      for (const port of ports) detachRendererPort(port, true);
      return;
    }
    const nextPort = ports[0];
    if (!nextPort) return;
    for (const extraPort of ports.slice(1)) detachRendererPort(extraPort, true);
    if (rendererPort) detachRendererPort(rendererPort, true);
    rendererPort = nextPort;
    nextPort.onmessage = (messageEvent): void => {
      if (isClosed || rendererPort !== nextPort) return;
      const message = messageEvent.data;
      if (!message || typeof message !== "object") return;
      const value = message as { type?: unknown; version?: unknown; frame?: unknown };
      if (value.type !== "frame" || value.version !== 1 || !isElectronSteamInputFrame(value.frame)) return;
      const frame = value.frame as ElectronSteamInputFrame<TDefinition>;
      try {
        const result = listener(frame) as unknown;
        if (result && typeof result === "object" && "then" in result) {
          Promise.resolve(result).catch((error: unknown) => {
            emitElectronSteamInputWarning(
              "STEAM_INPUT_RENDERER_LISTENER_FAILED",
              "Electron Steam Input renderer listener rejected",
              error
            );
          });
        }
      } catch (error) {
        emitElectronSteamInputWarning(
          "STEAM_INPUT_RENDERER_LISTENER_FAILED",
          "Electron Steam Input renderer listener failed",
          error
        );
      }
      try {
        nextPort.postMessage({ type: "ack", sequence: frame.sequence });
      } catch (error) {
        if (rendererPort === nextPort) rendererPort = null;
        detachRendererPort(nextPort, true);
        emitElectronSteamInputWarning(
          "STEAM_INPUT_RENDERER_ACK_FAILED",
          "Electron Steam Input renderer acknowledgement failed",
          error
        );
      }
    };
    try {
      nextPort.start?.();
    } catch (error) {
      if (rendererPort === nextPort) rendererPort = null;
      detachRendererPort(nextPort, true);
      emitElectronSteamInputWarning(
        "STEAM_INPUT_RENDERER_PORT_START_FAILED",
        "Electron Steam Input renderer port failed to start",
        error
      );
    }
  };
  ipcRenderer.on(channel, onConnect);
  return {
    close(): void {
      if (isClosed) return;
      isClosed = true;
      if (ipcRenderer.off) ipcRenderer.off(channel, onConnect);
      else ipcRenderer.removeListener?.(channel, onConnect);
      const currentPort = rendererPort;
      rendererPort = null;
      if (currentPort) detachRendererPort(currentPort, true);
    },
    get closed(): boolean {
      return isClosed;
    }
  };
}

export function serializeElectronSteamInputFrame<TDefinition extends SteamInputDefinition>(
  frame: SteamInputFrame<TDefinition>
): ElectronSteamInputFrame<TDefinition> {
  return JSON.parse(
    JSON.stringify(frame, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value))
  ) as ElectronSteamInputFrame<TDefinition>;
}

function electronSteamInputChannel(channel: string | undefined): string {
  const value = channel ?? DEFAULT_ELECTRON_STEAM_INPUT_CHANNEL;
  if (!value.trim()) throw new Error("Electron Steam Input channel must not be empty");
  return value;
}

function createElectronSteamInputMessageChannel(): ElectronSteamInputMessageChannel {
  const electron = require("electron") as { MessageChannelMain?: new () => ElectronSteamInputMessageChannel };
  if (!electron.MessageChannelMain) {
    throw new Error("Electron MessageChannelMain is unavailable; create the transport from Electron's main process");
  }
  return new electron.MessageChannelMain();
}

function electronSteamInputMessageData(event: { data?: unknown } | unknown): unknown {
  return event && typeof event === "object" && "data" in event
    ? (event as { data?: unknown }).data
    : event;
}

function isElectronSteamInputFrame(value: unknown): value is ElectronSteamInputFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as { sequence?: unknown; controllers?: unknown; mergedController?: unknown };
  return (
    typeof frame.sequence === "string" &&
    /^(0|[1-9]\d*)$/.test(frame.sequence) &&
    Array.isArray(frame.controllers) &&
    "mergedController" in frame
  );
}

function emitElectronSteamInputWarning(code: string, message: string, error: unknown): void {
  const cause = error instanceof Error ? error : new Error(String(error));
  process.emitWarning(`${message}: ${cause.message}`, { code, detail: cause.stack });
}

export interface ElectronOverlayOptions {
  enableInProcessGpu?: boolean;
  disableDirectComposition?: boolean;
  repaintIntervalMs?: number;
}

export interface ElectronSteamOverlayProfileOptions extends ElectronOverlayOptions {
  profile?: ElectronSteamOverlayProfile;
  forceHighPerformanceGpu?: boolean;
  disableBackgroundThrottling?: boolean;
  ignoreGpuBlocklist?: boolean;
  /**
   * Opt in to Chromium's refresh-aware browser-process CADisplayLink.
   *
   * This startup-only experiment defaults to off and is eligible only on
   * macOS 14+ with Chromium 150+. Configure it before `app.isReady()`.
   */
  enableMacosBrowserDisplayLink?: boolean;
  scrubSteamOverlayChildProcessEnv?: boolean;
  isolateSteamOverlayChildProcesses?: boolean;
}

export type ElectronMacosBrowserDisplayLinkReason =
  | "configured"
  | "disabled"
  | "unsupported-platform"
  | "macos-version-unavailable"
  | "unsupported-macos-version"
  | "chromium-version-unavailable"
  | "unsupported-chromium-version";

export interface ElectronMacosBrowserDisplayLinkStatus {
  requested: boolean;
  supported: boolean;
  configured: boolean;
  reason: ElectronMacosBrowserDisplayLinkReason;
  platform: NodeJS.Platform;
  macosVersion?: string;
  chromiumVersion?: string;
}

export interface ElectronSteamOverlayConfigResult {
  profile: ElectronSteamOverlayProfile;
  switches: string[];
  disableDirectComposition: boolean;
  repaintIntervalMs: number;
  /** @deprecated Prefer `macosBrowserDisplayLinkStatus.configured`. */
  macosBrowserDisplayLink: boolean;
  macosBrowserDisplayLinkStatus: ElectronMacosBrowserDisplayLinkStatus;
  scrubSteamOverlayChildProcessEnv: boolean;
  isolateSteamOverlayChildProcesses: boolean;
  scrubbedEnvKeys: string[];
}

export interface ElectronOverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElectronNativeOverlaySessionOptions {
  title?: string;
  frameRate?: number;
  pumpIntervalMs?: number;
  continuousPresent?: boolean;
  nativeWindowHandle?: Buffer;
  getBounds?: () => ElectronOverlayBounds | undefined;
  getFullScreen?: () => boolean;
  useStandaloneLinuxHost?: boolean;
  restoreFocus?: () => void;
  restoreFocusDelayMs?: number;
  hideNativeHostOnOverlayDeactivate?: boolean;
}

export interface ElectronOverlayPresenterOptions {
  title?: string;
  nativeWindowHandle?: Buffer;
  getBounds?: () => ElectronOverlayBounds | undefined;
  getFullScreen?: () => boolean;
  useStandaloneLinuxHost?: boolean;
  captureFrame?: () => Promise<ElectronOverlayFrame | undefined>;
  restoreFocus?: () => void;
  restoreFocusDelayMs?: number;
  idleFps?: number;
  needsPresentFps?: number;
  activeOverlayFps?: number;
  /**
   * Idle presenter polling cadence. Persistent Windows presenters use
   * lightweight needs-present reads between full diagnostics refreshes and
   * default to 30 ms; other platforms default to 250 ms. Active presentation
   * follows the configured FPS instead.
   */
  pollIntervalMs?: number;
  activationBoostMs?: number;
  activeGraceMs?: number;
}

export interface ElectronOverlayFrame {
  data: Buffer;
  width: number;
  height: number;
}

interface ElectronNativeImage {
  getSize(): { width: number; height: number };
  toBitmap(): Buffer;
}

interface ElectronApp {
  commandLine: {
    appendSwitch(name: string, value?: string): void;
    getSwitchValue?(name: string): string;
  };
  isReady?(): boolean;
  on(event: "browser-window-created", handler: (event: unknown, window: ElectronWindow) => void): void;
}

interface ElectronWindow {
  isDestroyed(): boolean;
  isMinimized?(): boolean;
  restore?(): void;
  show?(): void;
  focus?(): void;
  getBounds?(): ElectronOverlayBounds;
  getContentBounds?(): ElectronOverlayBounds;
  isFullScreen?(): boolean;
  isSimpleFullScreen?(): boolean;
  getNativeWindowHandle?(): Buffer;
  webContents: {
    once(event: "did-finish-load", handler: () => void): void;
    focus?(): void;
    invalidate(): void;
    send(channel: string, ...args: unknown[]): void;
    capturePage?(): Promise<ElectronNativeImage>;
  };
}

interface ElectronApi {
  app: ElectronApp;
  BrowserWindow: {
    getAllWindows(): ElectronWindow[];
  };
  screen?: {
    dipToScreenRect?(window: ElectronWindow, bounds: ElectronOverlayBounds): ElectronOverlayBounds;
    dipToScreenPoint?(point: { x: number; y: number }): { x: number; y: number };
    getDisplayMatching?(bounds: ElectronOverlayBounds): {
      displayFrequency?: number;
    };
  };
}

let repaintTimer: NodeJS.Timeout | undefined;
let activeRepaintIntervalMs = 0;
let browserWindowCreatedListenerInstalled = false;
const appendedSwitches = new Set<string>();
let macosBrowserDisplayLinkStartupDecision:
  | ElectronMacosBrowserDisplayLinkStatus
  | undefined;

const MACOS_BROWSER_DISPLAY_LINK_FEATURE = "CADisplayLinkInBrowser";
const MACOS_GPU_THEN_BROWSER_DISPLAY_LINK_FEATURE =
  "CADisplayLinkInGpuThenBrowser";

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
    const macosBrowserDisplayLinkStatus =
      macosBrowserDisplayLinkStartupDecision ??
      inspectMacosBrowserDisplayLinkSupport(false);
    return {
      profile,
      switches: [],
      disableDirectComposition: false,
      repaintIntervalMs: 0,
      macosBrowserDisplayLink:
        macosBrowserDisplayLinkStatus.configured,
      macosBrowserDisplayLinkStatus: {
        ...macosBrowserDisplayLinkStatus
      },
      scrubSteamOverlayChildProcessEnv: false,
      isolateSteamOverlayChildProcesses: false,
      scrubbedEnvKeys: []
    };
  }

  const compatibilityMode = profile === "compatibility";
  const repaintMode = profile === "repaint" || compatibilityMode;
  const {
    enableInProcessGpu = compatibilityMode,
    disableDirectComposition = false,
    forceHighPerformanceGpu = true,
    disableBackgroundThrottling = true,
    ignoreGpuBlocklist = true,
    enableMacosBrowserDisplayLink = false,
    repaintIntervalMs: requestedRepaintIntervalMs = repaintMode ? 33 : 0,
    scrubSteamOverlayChildProcessEnv = true,
    isolateSteamOverlayChildProcesses = scrubSteamOverlayChildProcessEnv && process.platform === "linux"
  } = options;
  const repaintIntervalMs = normalizeElectronRepaintIntervalMs(requestedRepaintIntervalMs);

  const electron = require("electron") as ElectronApi;
  const switches: string[] = [];
  const macosBrowserDisplayLinkStatus =
    configureMacosBrowserDisplayLinkOnce(
      electron.app,
      switches,
      enableMacosBrowserDisplayLink
    );
  const scrubbedEnvKeys = scrubSteamOverlayChildProcessEnv ? electronScrubSteamOverlayChildProcessEnv() : [];

  if (isolateSteamOverlayChildProcesses) {
    // Electron 43 rejects --no-zygote while the Chromium sandbox is still
    // enabled. The paired switches keep Steam's overlay preload out of
    // Chromium zygote/renderer children on Linux instead of letting
    // gameoverlayrenderer crash inside the zygote at process startup.
    appendSwitchOnce(electron.app, switches, "no-zygote");
    appendSwitchOnce(electron.app, switches, "no-sandbox");
  }

  if (enableInProcessGpu) {
    appendSwitchOnce(electron.app, switches, "in-process-gpu");
  }

  if (disableDirectComposition) {
    appendSwitchOnce(electron.app, switches, "disable-direct-composition");
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

  if (repaintTimer && activeRepaintIntervalMs !== repaintIntervalMs) {
    electronDisableSteamOverlayRepaintLoop();
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
    activeRepaintIntervalMs = repaintIntervalMs;
  }

  return {
    profile,
    switches,
    disableDirectComposition,
    repaintIntervalMs,
    macosBrowserDisplayLink:
      macosBrowserDisplayLinkStatus.configured,
    macosBrowserDisplayLinkStatus: {
      ...macosBrowserDisplayLinkStatus
    },
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
  activeRepaintIntervalMs = 0;
}

function normalizeElectronRepaintIntervalMs(intervalMs: number): number {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 0 || intervalMs > 2_147_483_647) {
    throw new Error(
      "Steam Bridge repaintIntervalMs must be a non-negative integer no greater than 2147483647."
    );
  }
  return intervalMs;
}

export function electronScrubSteamOverlayChildProcessEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const scrubbedEnvKeys: string[] = [];
  for (const key of ["LD_PRELOAD", "DYLD_INSERT_LIBRARIES"]) {
    const value = env[key];
    if (!value || !/gameoverlayrenderer/i.test(value)) {
      continue;
    }

    const keptEntries = splitSteamOverlayPreloadEntries(key, value).filter(
      (entry) => entry && !/gameoverlayrenderer/i.test(entry)
    );

    if (keptEntries.length > 0) {
      env[key] = keptEntries.join(":");
    } else {
      delete env[key];
    }
    scrubbedEnvKeys.push(key);
  }

  return scrubbedEnvKeys;
}

function splitSteamOverlayPreloadEntries(key: string, value: string): string[] {
  if (key === "DYLD_INSERT_LIBRARIES") {
    return value.split(":").map((entry) => entry.trim());
  }

  return value.split(/[:\s]+/).map((entry) => entry.trim());
}

export function electronNativeOverlaySessionOptions(
  window: ElectronWindow,
  options: Omit<
    ElectronNativeOverlaySessionOptions,
    "nativeWindowHandle" | "getBounds" | "getFullScreen" | "useStandaloneLinuxHost" | "restoreFocus"
  > = {}
): ElectronNativeOverlaySessionOptions {
  return electronWindowNativeOverlayOptions(window, options);
}

export function electronOverlayPresenterOptions(
  window: ElectronWindow,
  options: Omit<
    ElectronOverlayPresenterOptions,
    "nativeWindowHandle" | "getBounds" | "getFullScreen" | "useStandaloneLinuxHost" | "restoreFocus"
  > = {}
): ElectronOverlayPresenterOptions {
  return electronWindowNativeOverlayOptions(window, options);
}

/** Read the refresh rate of the display that most closely intersects a BrowserWindow. */
export function electronWindowDisplayFrameRate(window: ElectronWindow): number | undefined {
  if (window.isDestroyed()) {
    return undefined;
  }

  const bounds = normalizeElectronOverlayBounds(
    typeof window.getBounds === "function"
      ? window.getBounds()
      : window.getContentBounds?.()
  );
  if (!bounds) {
    return undefined;
  }

  try {
    const electron = require("electron") as ElectronApi;
    const displayFrequency = electron.screen?.getDisplayMatching?.(bounds)?.displayFrequency;
    if (!Number.isFinite(displayFrequency) || Number(displayFrequency) <= 0) {
      return undefined;
    }
    return Number(displayFrequency);
  } catch {
    // Unit consumers can load the helper outside Electron. Preserve the raw
    // presenter default when no live Electron screen service is available.
    return undefined;
  }
}

function electronWindowNativeOverlayOptions<
  T extends {
    nativeWindowHandle?: Buffer;
    getBounds?: () => ElectronOverlayBounds | undefined;
    getFullScreen?: () => boolean;
    useStandaloneLinuxHost?: boolean;
    captureFrame?: () => Promise<ElectronOverlayFrame | undefined>;
    restoreFocus?: () => void;
  }
>(
  window: ElectronWindow,
  options: Omit<
    T,
    "nativeWindowHandle" | "getBounds" | "getFullScreen" | "useStandaloneLinuxHost" | "restoreFocus"
  >
): T {
  const standaloneLinuxHost = electronUsesStandaloneLinuxOverlayHost();
  if (standaloneLinuxHost) {
    ensureKWinWaylandOverlayHostSync();
  }
  if (!standaloneLinuxHost && typeof window.getNativeWindowHandle !== "function") {
    throw new Error("Electron BrowserWindow does not expose getNativeWindowHandle().");
  }

  const nativeWindowHandle = standaloneLinuxHost
    ? undefined
    : window.getNativeWindowHandle?.();

  return {
    ...options,
    ...(nativeWindowHandle ? { nativeWindowHandle } : {}),
    getBounds: () => readElectronWindowBounds(window),
    getFullScreen: () => window.isFullScreen?.() === true || window.isSimpleFullScreen?.() === true,
    ...(standaloneLinuxHost ? { useStandaloneLinuxHost: true } : {}),
    captureFrame: () => captureElectronWindowFrame(window),
    restoreFocus: () => {
      if (window.isDestroyed()) {
        return;
      }
      if (window.isMinimized?.()) {
        window.restore?.();
      }
      window.show?.();
      window.focus?.();
      window.webContents.focus?.();
      window.webContents.invalidate();
    }
  } as T;
}

export function electronUsesStandaloneLinuxOverlayHost(): boolean {
  if (process.platform !== "linux") {
    return false;
  }

  let requestedOzonePlatform: string | undefined;
  for (let index = 0; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument.startsWith("--ozone-platform=")) {
      requestedOzonePlatform = argument.slice("--ozone-platform=".length).trim().toLowerCase();
    } else if (argument === "--ozone-platform" && index + 1 < process.argv.length) {
      requestedOzonePlatform = process.argv[index + 1].trim().toLowerCase();
    }
  }
  if (requestedOzonePlatform === "x11") {
    return false;
  }
  if (requestedOzonePlatform === "wayland") {
    return true;
  }

  return (
    process.env.XDG_SESSION_TYPE?.trim().toLowerCase() === "wayland" &&
    Boolean(process.env.WAYLAND_DISPLAY?.trim())
  );
}

async function captureElectronWindowFrame(window: ElectronWindow): Promise<ElectronOverlayFrame | undefined> {
  if (window.isDestroyed() || typeof window.webContents.capturePage !== "function") {
    return undefined;
  }

  const image = await window.webContents.capturePage();
  const data = image.toBitmap();
  const size = image.getSize();
  const dimensions = resolveElectronBitmapDimensions(data.length, size.width, size.height);
  if (!dimensions) {
    throw new Error(
      `Electron capturePage() returned ${data.length} bytes for an invalid ${size.width}x${size.height} bitmap.`
    );
  }

  return { data, ...dimensions };
}

function resolveElectronBitmapDimensions(
  byteLength: number,
  reportedWidth: number,
  reportedHeight: number
): { width: number; height: number } | undefined {
  if (byteLength <= 0 || byteLength % 4 !== 0) {
    return undefined;
  }

  const width = Math.max(1, Math.round(reportedWidth));
  const height = Math.max(1, Math.round(reportedHeight));
  const pixelCount = byteLength / 4;
  if (width * height === pixelCount) {
    return { width, height };
  }

  const aspect = width / height;
  const estimatedWidth = Math.max(1, Math.round(Math.sqrt(pixelCount * aspect)));
  for (let candidateWidth = Math.max(1, estimatedWidth - 4); candidateWidth <= estimatedWidth + 4; candidateWidth += 1) {
    if (pixelCount % candidateWidth === 0) {
      return { width: candidateWidth, height: pixelCount / candidateWidth };
    }
  }
  return undefined;
}

function readElectronWindowBounds(window: ElectronWindow): ElectronOverlayBounds | undefined {
  if (window.isDestroyed()) {
    return undefined;
  }

  if (typeof window.getContentBounds === "function") {
    const contentBounds = normalizeElectronOverlayBounds(window.getContentBounds());
    if (!contentBounds) {
      return contentBounds;
    }

    if (process.platform === "win32") {
      const electron = require("electron") as ElectronApi;
      if (typeof electron.screen?.dipToScreenRect === "function") {
        return normalizeElectronOverlayBounds(electron.screen.dipToScreenRect(window, contentBounds));
      }

      // Win32 HWND and D3D coordinates are physical pixels. Falling back to
      // native client bounds is safer than treating Electron DIP as pixels.
      return undefined;
    }

    if (process.platform === "linux" && !electronUsesStandaloneLinuxOverlayHost()) {
      const electron = require("electron") as ElectronApi;
      const convertPoint = electron.screen?.dipToScreenPoint;
      if (typeof convertPoint === "function") {
        const topLeft = convertPoint({ x: contentBounds.x, y: contentBounds.y });
        const bottomRight = convertPoint({
          x: contentBounds.x + contentBounds.width,
          y: contentBounds.y + contentBounds.height
        });
        return normalizeElectronOverlayBounds({
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y
        });
      }
    }

    return contentBounds;
  }
  if (typeof window.getBounds === "function") {
    return normalizeElectronOverlayBounds(window.getBounds());
  }
  return undefined;
}

function normalizeElectronOverlayBounds(bounds: ElectronOverlayBounds | undefined): ElectronOverlayBounds | undefined {
  if (!bounds) {
    return undefined;
  }

  const { x, y, width, height } = bounds;
  if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) {
    return undefined;
  }

  return { x, y, width, height };
}

function configureMacosBrowserDisplayLinkOnce(
  app: ElectronApp,
  switches: string[],
  requested: boolean
): ElectronMacosBrowserDisplayLinkStatus {
  if (macosBrowserDisplayLinkStartupDecision) {
    if (macosBrowserDisplayLinkStartupDecision.requested !== requested) {
      throw new Error(
        "steam-bridge: enableMacosBrowserDisplayLink is a startup-only decision and cannot be reconfigured after the first overlay configuration."
      );
    }
    return macosBrowserDisplayLinkStartupDecision;
  }

  const support = inspectMacosBrowserDisplayLinkSupport(requested);
  if (!requested || !support.supported) {
    macosBrowserDisplayLinkStartupDecision = support;
    return support;
  }

  if (app.isReady?.() === true) {
    throw new Error(
      "steam-bridge: enableMacosBrowserDisplayLink must be configured before Electron app.isReady()."
    );
  }

  const getSwitchValue = app.commandLine.getSwitchValue;
  if (typeof getSwitchValue !== "function") {
    throw new Error(
      "steam-bridge: Electron app.commandLine.getSwitchValue() is required to configure enableMacosBrowserDisplayLink safely."
    );
  }

  const enabledFeatures = readCommaSeparatedSwitchValues(
    getSwitchValue.call(app.commandLine, "enable-features")
  );
  const disabledFeatures = readCommaSeparatedSwitchValues(
    getSwitchValue.call(app.commandLine, "disable-features")
  );

  if (disabledFeatures.includes(MACOS_BROWSER_DISPLAY_LINK_FEATURE)) {
    throw new Error(
      `steam-bridge: cannot enable ${MACOS_BROWSER_DISPLAY_LINK_FEATURE} because it is already present in --disable-features.`
    );
  }
  if (enabledFeatures.includes(MACOS_GPU_THEN_BROWSER_DISPLAY_LINK_FEATURE)) {
    throw new Error(
      `steam-bridge: cannot disable ${MACOS_GPU_THEN_BROWSER_DISPLAY_LINK_FEATURE} because it is already present in --enable-features.`
    );
  }

  // Chromium 150's browser-only field-trial arm fixes same-display refresh
  // transitions without enabling the separate GPU-startup experiment that
  // previously produced intermittent hangs after power resume.
  appendCommaSeparatedSwitchValueOnce(
    app,
    switches,
    "enable-features",
    MACOS_BROWSER_DISPLAY_LINK_FEATURE
  );
  appendCommaSeparatedSwitchValueOnce(
    app,
    switches,
    "disable-features",
    MACOS_GPU_THEN_BROWSER_DISPLAY_LINK_FEATURE
  );

  const configuredEnabledFeatures = readCommaSeparatedSwitchValues(
    getSwitchValue.call(app.commandLine, "enable-features")
  );
  const configuredDisabledFeatures = readCommaSeparatedSwitchValues(
    getSwitchValue.call(app.commandLine, "disable-features")
  );
  if (
    !configuredEnabledFeatures.includes(MACOS_BROWSER_DISPLAY_LINK_FEATURE) ||
    !configuredDisabledFeatures.includes(
      MACOS_GPU_THEN_BROWSER_DISPLAY_LINK_FEATURE
    )
  ) {
    throw new Error(
      "steam-bridge: Electron did not retain the requested macOS browser-display-link startup switches."
    );
  }

  macosBrowserDisplayLinkStartupDecision = {
    ...support,
    configured: true,
    reason: "configured"
  };
  return macosBrowserDisplayLinkStartupDecision;
}

function inspectMacosBrowserDisplayLinkSupport(
  requested: boolean
): ElectronMacosBrowserDisplayLinkStatus {
  const platform = process.platform;
  if (platform !== "darwin") {
    return {
      requested,
      supported: false,
      configured: false,
      reason: "unsupported-platform",
      platform
    };
  }

  const macosVersion = readMacosSystemVersion();
  const chromiumVersion = process.versions.chrome?.trim();
  const macosMajorVersion = parseMajorVersion(macosVersion);
  if (macosMajorVersion === undefined) {
    return {
      requested,
      supported: false,
      configured: false,
      reason: "macos-version-unavailable",
      platform,
      ...(macosVersion ? { macosVersion } : {}),
      ...(chromiumVersion ? { chromiumVersion } : {})
    };
  }
  if (macosMajorVersion < 14) {
    return {
      requested,
      supported: false,
      configured: false,
      reason: "unsupported-macos-version",
      platform,
      macosVersion,
      ...(chromiumVersion ? { chromiumVersion } : {})
    };
  }

  const chromiumMajorVersion = parseMajorVersion(chromiumVersion);
  if (chromiumMajorVersion === undefined) {
    return {
      requested,
      supported: false,
      configured: false,
      reason: "chromium-version-unavailable",
      platform,
      macosVersion
    };
  }
  if (chromiumMajorVersion < 150) {
    return {
      requested,
      supported: false,
      configured: false,
      reason: "unsupported-chromium-version",
      platform,
      macosVersion,
      chromiumVersion
    };
  }

  return {
    requested,
    supported: true,
    configured: false,
    reason: "disabled",
    platform,
    macosVersion,
    chromiumVersion
  };
}

function readMacosSystemVersion(): string | undefined {
  const electronProcess = process as NodeJS.Process & {
    getSystemVersion?: () => string;
  };
  try {
    return electronProcess.getSystemVersion?.().trim() || undefined;
  } catch {
    return undefined;
  }
}

function parseMajorVersion(version: string | undefined): number | undefined {
  const match = version?.match(/^(\d+)(?:\.|$)/);
  if (!match) {
    return undefined;
  }
  const majorVersion = Number(match[1]);
  return Number.isSafeInteger(majorVersion) ? majorVersion : undefined;
}

function readCommaSeparatedSwitchValues(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function appendCommaSeparatedSwitchValueOnce(
  app: ElectronApp,
  switches: string[],
  name: string,
  requiredValue: string
): void {
  const existingValues = readCommaSeparatedSwitchValues(
    app.commandLine.getSwitchValue?.(name) ?? ""
  );
  if (existingValues.includes(requiredValue)) {
    return;
  }

  appendSwitchOnce(
    app,
    switches,
    name,
    [...existingValues, requiredValue].join(",")
  );
}
