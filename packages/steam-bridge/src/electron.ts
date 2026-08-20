import { ensureKWinWaylandOverlayHostSync } from "./kwin";
import type { NativeOverlayInputEvent, SteamInputDefinition, SteamInputFrame, SteamInputSession } from "./index";
import { isAbsolute, resolve } from "node:path";
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

export interface ElectronSteamInputPreloadSession {
  registerPreloadScript?(script: { type: "frame"; filePath: string; id?: string }): string;
  unregisterPreloadScript?(id: string): void;
  /** Electron 24-34 compatibility; deprecated by Electron 35. */
  getPreloads?(): string[];
  /** Electron 24-34 compatibility; deprecated by Electron 35. */
  setPreloads?(preloads: string[]): void;
}

export interface ElectronSteamInputPreloadRegistration {
  readonly id: string;
  readonly filePath: string;
  unregister(): void;
  readonly unregistered: boolean;
}

export interface ElectronSteamInputPreloadOptions {
  /** Stable registration ID. Defaults to `steam-bridge:universal-input`. */
  id?: string;
  /** Test/embedding override. Normal applications use the packaged standalone preload. */
  filePath?: string;
}

export interface ElectronSteamInputIpcMain {
  on(channel: string, listener: (event: ElectronSteamInputRequestEvent) => void): unknown;
  off?(channel: string, listener: (event: ElectronSteamInputRequestEvent) => void): unknown;
  removeListener?(channel: string, listener: (event: ElectronSteamInputRequestEvent) => void): unknown;
}

export interface ElectronSteamInputRequestEvent {
  sender: ElectronSteamInputServiceWebContents;
}

export interface ElectronSteamInputServiceWebContents extends ElectronSteamInputWebContents {
  send(channel: string, ...args: unknown[]): void;
  getURL?(): string;
}

export interface ElectronSteamInputServiceOptions extends ElectronSteamInputTransportOptions {
  /** Renderer-to-main poll request channel used by Steam Bridge's packaged preload. */
  requestChannel?: string;
  /** Main-to-renderer completion channel used to release a failed/skipped request. */
  completionChannel?: string;
  /** Refuse requests when the app's visible native surface is inactive. */
  isActive?: () => boolean;
  /** Additional renderer identity/origin policy. Sender identity is always required. */
  isTrusted?: (webContents: ElectronSteamInputServiceWebContents) => boolean;
  /** Dispose the supplied Steam Input session when the service closes. */
  disposeSession?: boolean;
}

export interface ElectronSteamInputServiceDiagnostics {
  closed: boolean;
  attached: boolean;
  requestInProgress: boolean;
  requestCount: number;
  skippedRequestCount: number;
  failedRequestCount: number;
  transport: ElectronSteamInputTransportDiagnostics | null;
}

export interface ElectronSteamInputService<TDefinition extends SteamInputDefinition = SteamInputDefinition> {
  /** Attach/re-attach transport after the renderer's main-frame preload has loaded. */
  attach(): void;
  /** Poll once without renderer IPC, for applications that own their own frame scheduler. */
  update(): SteamInputFrame<TDefinition> | null;
  getDiagnostics(): ElectronSteamInputServiceDiagnostics;
  close(): void;
  readonly closed: boolean;
}

export type ElectronNativeInputModifier =
  | "shift"
  | "control"
  | "alt"
  | "meta"
  | "capslock"
  | "numlock"
  | "iskeypad";

export interface ElectronNativeInputWebContents {
  focus(): void;
  sendInputEvent(event: Record<string, unknown>): void;
  /** Used only for browser-unsupported native edges such as mouse buttons 4/5. */
  send?(channel: string, ...args: unknown[]): void;
  isDestroyed?(): boolean;
}

export interface ElectronNativeInputForwarderOptions {
  /** Current renderer content size in DIPs. */
  getContentSize(): { width: number; height: number } | readonly [number, number];
  /** Called before an ordinary input edge is dispatched. Return true when handled. */
  onBeforeDispatch?: (
    event: NativeOverlayInputEvent,
    modifiers: readonly ElectronNativeInputModifier[]
  ) => boolean;
  onFocusChanged?: (focused: boolean) => void;
  onWindowChanged?: (event: NativeOverlayInputEvent) => void;
  onClose?: () => void;
  onMenuCommand?: (commandId: number | undefined) => void;
  onOverlayShortcut?: (event: NativeOverlayInputEvent) => void;
  onPointerMove?: (event: NativeOverlayInputEvent) => void;
}

export interface ElectronNativeInputForwarderDiagnostics {
  active: boolean;
  heldKeyCount: number;
  heldMouseButtonCount: number;
  modifiers: readonly ElectronNativeInputModifier[];
  forwardedEventCount: number;
  rejectedEventCount: number;
}

export interface ElectronNativeInputForwarder {
  forward(event: NativeOverlayInputEvent): boolean;
  /** External overlay/minimize lifecycle may release input without fabricating a blur event. */
  setActive(active: boolean): void;
  release(): void;
  getDiagnostics(): ElectronNativeInputForwarderDiagnostics;
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
const DEFAULT_ELECTRON_STEAM_INPUT_REQUEST_CHANNEL = "steam-bridge:steam-input-request";
const DEFAULT_ELECTRON_STEAM_INPUT_COMPLETION_CHANNEL = "steam-bridge:steam-input-complete";
const ELECTRON_NATIVE_INPUT_CHANNEL = "steam-bridge:native-input";

/**
 * Install Steam Bridge's standalone, sandbox-compatible input preload before
 * creating application BrowserWindows for this Electron session.
 */
export function registerElectronSteamInputPreload(
  electronSession: ElectronSteamInputPreloadSession,
  options: ElectronSteamInputPreloadOptions = {}
): ElectronSteamInputPreloadRegistration {
  const modern = typeof electronSession?.registerPreloadScript === "function" &&
    typeof electronSession?.unregisterPreloadScript === "function";
  const legacy = typeof electronSession?.getPreloads === "function" &&
    typeof electronSession?.setPreloads === "function";
  if (!modern && !legacy) {
    throw new TypeError("Electron Steam Input preload registration requires an Electron Session");
  }
  const filePath = options.filePath ?? resolve(__dirname, "..", "templates", "electron-input-preload.cjs");
  if (!isAbsolute(filePath)) throw new Error("Electron Steam Input preload path must be absolute");
  const requestedId = options.id ?? "steam-bridge:universal-input";
  const legacyPreloads = legacy && !modern ? electronSession.getPreloads!() : null;
  const legacyAdded = legacyPreloads != null && !legacyPreloads.includes(filePath);
  const id = modern
    ? electronSession.registerPreloadScript!({ type: "frame", filePath, id: requestedId })
    : requestedId;
  if (legacyAdded) electronSession.setPreloads!([...legacyPreloads!, filePath]);
  let isUnregistered = false;
  return {
    id,
    filePath,
    unregister(): void {
      if (isUnregistered) return;
      isUnregistered = true;
      if (modern) {
        electronSession.unregisterPreloadScript!(id);
      } else if (legacyAdded) {
        const current = electronSession.getPreloads!();
        const addedIndex = current.lastIndexOf(filePath);
        if (addedIndex >= 0) {
          const next = current.slice();
          next.splice(addedIndex, 1);
          electronSession.setPreloads!(next);
        }
      }
    },
    get unregistered(): boolean {
      return isUnregistered;
    }
  };
}

/**
 * Own Steam Input polling, renderer lifecycle, bounded MessagePort delivery,
 * and IPC identity checks for one Electron renderer.
 */
export function createElectronSteamInputService<TDefinition extends SteamInputDefinition>(
  session: SteamInputSession<TDefinition>,
  ipcMain: ElectronSteamInputIpcMain,
  webContents: ElectronSteamInputServiceWebContents,
  options: ElectronSteamInputServiceOptions = {}
): ElectronSteamInputService<TDefinition> {
  if (!session || typeof session.update !== "function") {
    throw new TypeError("Electron Steam Input service requires a started SteamInputSession");
  }
  if (!ipcMain || typeof ipcMain.on !== "function") {
    throw new TypeError("Electron Steam Input service requires ipcMain");
  }
  if (!webContents || typeof webContents.postMessage !== "function" || typeof webContents.send !== "function") {
    throw new TypeError("Electron Steam Input service requires webContents");
  }
  const requestChannel = electronSteamInputChannelValue(
    options.requestChannel,
    DEFAULT_ELECTRON_STEAM_INPUT_REQUEST_CHANNEL,
    "request"
  );
  const completionChannel = electronSteamInputChannelValue(
    options.completionChannel,
    DEFAULT_ELECTRON_STEAM_INPUT_COMPLETION_CHANNEL,
    "completion"
  );
  let transport: ElectronSteamInputTransport<TDefinition> | null = null;
  let isClosed = false;
  let requestInProgress = false;
  let requestCount = 0;
  let skippedRequestCount = 0;
  let failedRequestCount = 0;

  const trusted = (): boolean => !webContents.isDestroyed?.() && (options.isTrusted?.(webContents) ?? true);
  const active = (): boolean => options.isActive?.() ?? true;
  const complete = (published: boolean): void => {
    if (webContents.isDestroyed?.()) return;
    try {
      webContents.send(completionChannel, published);
    } catch (error) {
      failedRequestCount += 1;
      emitElectronSteamInputWarning(
        "STEAM_INPUT_SERVICE_COMPLETION_FAILED",
        "Electron Steam Input completion notification failed",
        error
      );
    }
  };
  const closeTransport = (): void => {
    try {
      transport?.close();
    } finally {
      transport = null;
      requestInProgress = false;
    }
  };
  const attach = (): void => {
    if (isClosed) throw new Error("Electron Steam Input service is closed");
    closeTransport();
    if (!trusted()) return;
    transport = createElectronSteamInputTransport(session, webContents, {
      channel: options.channel,
      createMessageChannel: options.createMessageChannel
    });
  };
  const update = (): SteamInputFrame<TDefinition> | null => {
    if (isClosed || requestInProgress || !trusted() || !active() || !transport || transport.closed) return null;
    requestInProgress = true;
    try {
      return transport.update();
    } finally {
      requestInProgress = false;
    }
  };
  const onRequest = (event: ElectronSteamInputRequestEvent): void => {
    if (event.sender !== webContents) return;
    requestCount += 1;
    let published = false;
    try {
      published = update() != null;
      if (!published) skippedRequestCount += 1;
    } catch (error) {
      failedRequestCount += 1;
      emitElectronSteamInputWarning("STEAM_INPUT_SERVICE_UPDATE_FAILED", "Electron Steam Input poll failed", error);
    } finally {
      // A published MessagePort frame clears renderer backpressure directly.
      // The fallback IPC is needed only when no frame was delivered.
      if (!published) complete(false);
    }
  };
  const onFinishedLoad = (): void => {
    try {
      attach();
    } catch (error) {
      failedRequestCount += 1;
      emitElectronSteamInputWarning("STEAM_INPUT_SERVICE_ATTACH_FAILED", "Electron Steam Input attach failed", error);
    }
  };
  const close = (): void => {
    if (isClosed) return;
    isClosed = true;
    closeTransport();
    if (ipcMain.off) ipcMain.off(requestChannel, onRequest);
    else ipcMain.removeListener?.(requestChannel, onRequest);
    webContents.off?.("did-finish-load", onFinishedLoad);
    webContents.off?.("destroyed", close);
    webContents.off?.("render-process-gone", closeTransport);
    if (options.disposeSession) session.dispose();
  };

  ipcMain.on(requestChannel, onRequest);
  webContents.on?.("did-finish-load", onFinishedLoad);
  webContents.on?.("destroyed", close);
  webContents.on?.("render-process-gone", closeTransport);

  return {
    attach,
    update,
    getDiagnostics(): ElectronSteamInputServiceDiagnostics {
      return {
        closed: isClosed,
        attached: transport != null && !transport.closed,
        requestInProgress,
        requestCount,
        skippedRequestCount,
        failedRequestCount,
        transport: transport?.getDiagnostics() ?? null
      };
    },
    close,
    get closed(): boolean {
      return isClosed;
    }
  };
}

/**
 * Translate the standalone native host's normalized input events into Electron
 * renderer events, including aspect-fit coordinates and deterministic release
 * on blur, minimize, capture loss, overlay activation, and shutdown.
 */
export function createElectronNativeInputForwarder(
  webContents: ElectronNativeInputWebContents,
  options: ElectronNativeInputForwarderOptions
): ElectronNativeInputForwarder {
  if (!webContents || typeof webContents.sendInputEvent !== "function" || typeof webContents.focus !== "function") {
    throw new TypeError("Electron native input forwarding requires webContents");
  }
  if (!options || typeof options.getContentSize !== "function") {
    throw new TypeError("Electron native input forwarding requires getContentSize");
  }
  const modifiers = new Set<ElectronNativeInputModifier>();
  let modifierSnapshot: readonly ElectronNativeInputModifier[] = [];
  const heldKeys = new Map<string, readonly ElectronNativeInputModifier[]>();
  const heldMouseButtons = new Set<"left" | "right" | "middle">();
  const heldAuxiliaryMouseButtons = new Set<3 | 4>();
  const lastMousePosition = { x: 0, y: 0 };
  let active = false;
  let forwardedEventCount = 0;
  let rejectedEventCount = 0;

  const usable = (): boolean => !webContents.isDestroyed?.();
  const send = (event: Record<string, unknown>): boolean => {
    if (!usable()) {
      rejectedEventCount += 1;
      return false;
    }
    webContents.sendInputEvent(event);
    forwardedEventCount += 1;
    return true;
  };
  const releaseMouse = (): void => {
    if (usable()) {
      for (const button of heldMouseButtons) {
        send({
          type: "mouseUp",
          button,
          ...lastMousePosition,
          clickCount: 1,
          modifiers: modifierSnapshot
        });
      }
    }
    heldMouseButtons.clear();
    if (usable() && webContents.send) {
      for (const button of heldAuxiliaryMouseButtons) {
        webContents.send(ELECTRON_NATIVE_INPUT_CHANNEL, {
          version: 1,
          type: "pointer-up",
          button,
          x: lastMousePosition.x,
          y: lastMousePosition.y,
          modifiers: modifierSnapshot
        });
        forwardedEventCount += 1;
      }
    }
    heldAuxiliaryMouseButtons.clear();
  };
  const release = (): void => {
    releaseMouse();
    const keysToRelease = Array.from(heldKeys.keys());
    heldKeys.clear();
    modifiers.clear();
    modifierSnapshot = [];
    if (usable()) {
      // Release ordinary keys before modifiers so blur/minimize/overlay
      // transitions cannot leave a chord latched in Chromium.
      for (const modifierKey of [false, true]) {
        for (const keyCode of keysToRelease) {
          if (electronNativeModifierKeyCode(keyCode) === modifierKey) {
            send({ type: "keyUp", keyCode, modifiers: modifierSnapshot });
          }
        }
      }
    }
  };
  const setActive = (next: boolean): void => {
    active = next === true;
    if (!active) release();
  };
  const forward = (event: NativeOverlayInputEvent): boolean => {
    if (!event || typeof event !== "object" || typeof event.kind !== "string") {
      rejectedEventCount += 1;
      return false;
    }
    if (event.kind === "close") {
      release();
      options.onClose?.();
      return true;
    }
    if (event.kind === "windowChanged") {
      if (event.minimized === true) {
        setActive(false);
        options.onFocusChanged?.(false);
      }
      options.onWindowChanged?.(event);
      return true;
    }
    if (event.kind === "menuCommand") {
      options.onMenuCommand?.(event.commandId);
      return true;
    }
    if (event.kind === "overlayShortcut") {
      options.onOverlayShortcut?.(event);
      return true;
    }
    if (event.kind === "blur") {
      setActive(false);
      options.onFocusChanged?.(false);
      return true;
    }
    if (event.kind === "captureLost") {
      releaseMouse();
      return true;
    }
    if (event.kind === "focus") {
      if (!active) {
        active = true;
        options.onFocusChanged?.(true);
        if (usable()) webContents.focus();
      }
      return true;
    }

    const mouse = electronNativeMouseEvent(event.kind);
    const auxiliaryMouse = electronNativeAuxiliaryMouseEvent(event.kind);
    const pointerEvent = event.kind === "mouseMove" || event.kind === "mouseWheel" || mouse != null || auxiliaryMouse != null;
    const keyboardEvent = event.kind === "char" || event.kind === "keyDown" || event.kind === "keyUp";
    if (!pointerEvent && !keyboardEvent) {
      rejectedEventCount += 1;
      return false;
    }
    if (!active && heldMouseButtons.size === 0 && (event.kind === "mouseMove" || event.kind === "mouseWheel")) {
      rejectedEventCount += 1;
      return false;
    }
    if (updateElectronNativeModifiers(modifiers, event)) modifierSnapshot = Array.from(modifiers);
    const eventModifiers = modifierSnapshot;
    if (!active) {
      active = true;
      options.onFocusChanged?.(true);
      if (usable()) webContents.focus();
    }
    if (options.onBeforeDispatch?.(event, eventModifiers) === true) return true;

    if (event.kind === "char") {
      if (!Number.isSafeInteger(event.wparam) || event.wparam < 0 || event.wparam > 0x10ffff) {
        rejectedEventCount += 1;
        return false;
      }
      return send({ type: "char", keyCode: String.fromCodePoint(event.wparam), modifiers: eventModifiers });
    }
    if (event.kind === "keyDown" || event.kind === "keyUp") {
      const keyCode = electronNativeKeyCode(event.wparam);
      if (!keyCode) {
        rejectedEventCount += 1;
        return false;
      }
      const keyModifiers = electronNativeNumpadKey(keyCode)
        ? [...new Set<ElectronNativeInputModifier>([...eventModifiers, "iskeypad"])]
        : eventModifiers;
      if (event.kind === "keyDown") heldKeys.set(keyCode, keyModifiers);
      else heldKeys.delete(keyCode);
      return send({
        type: event.kind,
        keyCode,
        modifiers: keyModifiers,
        isAutoRepeat: event.kind === "keyDown" && Boolean(event.lparam & 0x40000000)
      });
    }

    const size = options.getContentSize();
    const contentWidth = "width" in size ? size.width : size[0];
    const contentHeight = "height" in size ? size.height : size[1];
    if (
      !Number.isFinite(contentWidth) || !Number.isFinite(contentHeight) || contentWidth <= 0 || contentHeight <= 0 ||
      !Number.isFinite(event.clientWidth) || !Number.isFinite(event.clientHeight) ||
      event.clientWidth <= 0 || event.clientHeight <= 0 ||
      !Number.isFinite(event.x) || !Number.isFinite(event.y)
    ) {
      rejectedEventCount += 1;
      return false;
    }
    const hostX = event.x as number;
    const hostY = event.y as number;
    const scale = Math.min(event.clientWidth / contentWidth, event.clientHeight / contentHeight);
    const drawWidth = contentWidth * scale;
    const drawHeight = contentHeight * scale;
    const offsetX = (event.clientWidth - drawWidth) / 2;
    const offsetY = (event.clientHeight - drawHeight) / 2;
    const capturedPointer = (heldMouseButtons.size > 0 || heldAuxiliaryMouseButtons.size > 0) &&
      (event.kind === "mouseMove" || event.kind.endsWith("MouseUp"));
    const outside = hostX < offsetX || hostY < offsetY ||
      hostX >= offsetX + drawWidth || hostY >= offsetY + drawHeight;
    if (outside && !capturedPointer) {
      rejectedEventCount += 1;
      return false;
    }
    const x = Math.max(0, Math.min(contentWidth - 1, Math.round((hostX - offsetX) / scale)));
    const y = Math.max(0, Math.min(contentHeight - 1, Math.round((hostY - offsetY) / scale)));
    if (event.kind === "mouseMove") {
      lastMousePosition.x = x;
      lastMousePosition.y = y;
      options.onPointerMove?.(event);
      return send({ type: "mouseMove", x, y, modifiers: eventModifiers });
    }
    if (event.kind === "mouseWheel") {
      if (!Number.isFinite(event.deltaX ?? 0) || !Number.isFinite(event.deltaY ?? 0)) {
        rejectedEventCount += 1;
        return false;
      }
      return send({
        type: "mouseWheel", x, y, deltaX: event.deltaX ?? 0, deltaY: event.deltaY ?? 0, canScroll: true,
        modifiers: eventModifiers
      });
    }
    if (auxiliaryMouse) {
      if (!webContents.send) {
        rejectedEventCount += 1;
        return false;
      }
      lastMousePosition.x = x;
      lastMousePosition.y = y;
      if (auxiliaryMouse.type === "pointer-down") heldAuxiliaryMouseButtons.add(auxiliaryMouse.button);
      else heldAuxiliaryMouseButtons.delete(auxiliaryMouse.button);
      webContents.send(ELECTRON_NATIVE_INPUT_CHANNEL, {
        version: 1,
        type: auxiliaryMouse.type,
        button: auxiliaryMouse.button,
        x,
        y,
        modifiers: eventModifiers
      });
      forwardedEventCount += 1;
      return true;
    }
    if (!mouse) return false;
    lastMousePosition.x = x;
    lastMousePosition.y = y;
    if (mouse.type === "mouseDown") heldMouseButtons.add(mouse.button);
    else heldMouseButtons.delete(mouse.button);
    return send({ ...mouse, x, y, clickCount: 1, modifiers: eventModifiers });
  };

  return {
    forward,
    setActive,
    release,
    getDiagnostics(): ElectronNativeInputForwarderDiagnostics {
      return {
        active,
        heldKeyCount: heldKeys.size,
        heldMouseButtonCount: heldMouseButtons.size + heldAuxiliaryMouseButtons.size,
        modifiers: Array.from(modifiers),
        forwardedEventCount,
        rejectedEventCount
      };
    }
  };
}

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
    const navigationDetails = args[0];
    const deprecatedIsInPlace = args[2];
    const explicitIsMainFrame = args[3];
    if (deprecatedIsInPlace === true || explicitIsMainFrame === false) return;
    if (
      navigationDetails &&
      typeof navigationDetails === "object" &&
      (("isSameDocument" in navigationDetails &&
        (navigationDetails as { isSameDocument?: unknown }).isSameDocument === true) ||
        ("isMainFrame" in navigationDetails &&
          (navigationDetails as { isMainFrame?: unknown }).isMainFrame === false))
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
  listener: (frame: ElectronSteamInputFrame<TDefinition>) => void | PromiseLike<void>,
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
      const acknowledge = (): void => {
        if (isClosed || rendererPort !== nextPort) return;
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
      let result: void | PromiseLike<void>;
      let isThenable = false;
      try {
        result = listener(frame);
        isThenable = Boolean(result && typeof result.then === "function");
      } catch (error) {
        emitElectronSteamInputWarning(
          "STEAM_INPUT_RENDERER_LISTENER_FAILED",
          "Electron Steam Input renderer listener failed",
          error
        );
        acknowledge();
        return;
      }
      if (isThenable) {
        Promise.resolve(result).then(
          acknowledge,
          (error: unknown) => {
            emitElectronSteamInputWarning(
              "STEAM_INPUT_RENDERER_LISTENER_FAILED",
              "Electron Steam Input renderer listener rejected",
              error
            );
            acknowledge();
          }
        );
        return;
      }
      acknowledge();
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
  return electronSteamInputChannelValue(channel, DEFAULT_ELECTRON_STEAM_INPUT_CHANNEL, "transport");
}

function electronSteamInputChannelValue(channel: string | undefined, fallback: string, label: string): string {
  const value = channel ?? fallback;
  if (!value.trim()) throw new Error(`Electron Steam Input ${label} channel must not be empty`);
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

const ELECTRON_NATIVE_NAMED_KEYS: Readonly<Record<number, string>> = Object.freeze({
  0x08: "Backspace", 0x09: "Tab", 0x0c: "Clear", 0x0d: "Enter", 0x10: "Shift", 0x11: "Control", 0x12: "Alt",
  0x13: "Pause", 0x14: "Capslock", 0x1b: "Escape", 0x20: "Space", 0x21: "PageUp", 0x22: "PageDown",
  0x23: "End", 0x24: "Home", 0x25: "Left", 0x26: "Up", 0x27: "Right", 0x28: "Down",
  0x2c: "PrintScreen", 0x2d: "Insert", 0x2e: "Delete", 0x5b: "Super", 0x5c: "Super", 0x5d: "Menu",
  0x6a: "nummult", 0x6b: "numadd", 0x6c: "numdec", 0x6d: "numsub", 0x6e: "numdec",
  0x6f: "numdiv", 0x90: "Numlock", 0x91: "Scrolllock", 0xa0: "Shift", 0xa1: "Shift",
  0xa2: "Control", 0xa3: "Control", 0xa4: "Alt", 0xa5: "Alt",
  0xa6: "BrowserBack", 0xa7: "BrowserForward", 0xa8: "BrowserRefresh", 0xa9: "BrowserStop",
  0xaa: "BrowserSearch", 0xab: "BrowserFavorites", 0xac: "BrowserHome", 0xad: "VolumeMute",
  0xae: "VolumeDown", 0xaf: "VolumeUp", 0xb0: "MediaNextTrack", 0xb1: "MediaPreviousTrack",
  0xb2: "MediaStop", 0xb3: "MediaPlayPause", 0xb4: "MediaLaunchMail", 0xb5: "MediaSelect"
});

const ELECTRON_NATIVE_OEM_KEYS: Readonly<Record<number, string>> = Object.freeze({
  0xba: ";", 0xbb: "=", 0xbc: ",", 0xbd: "-", 0xbe: ".", 0xbf: "/", 0xc0: "`",
  0xdb: "[", 0xdc: "\\", 0xdd: "]", 0xde: "'", 0xe2: "\\"
});

function electronNativeKeyCode(virtualKey: number): string | null {
  if (ELECTRON_NATIVE_NAMED_KEYS[virtualKey]) return ELECTRON_NATIVE_NAMED_KEYS[virtualKey];
  if (ELECTRON_NATIVE_OEM_KEYS[virtualKey]) return ELECTRON_NATIVE_OEM_KEYS[virtualKey];
  if ((virtualKey >= 0x30 && virtualKey <= 0x39) || (virtualKey >= 0x41 && virtualKey <= 0x5a)) {
    return String.fromCharCode(virtualKey);
  }
  if (virtualKey >= 0x60 && virtualKey <= 0x69) return `num${virtualKey - 0x60}`;
  if (virtualKey >= 0x70 && virtualKey <= 0x87) return `F${virtualKey - 0x6f}`;
  return null;
}

function electronNativeNumpadKey(keyCode: string): boolean {
  return /^num(?:[0-9]|dec|add|sub|mult|div)$/.test(keyCode);
}

function electronNativeModifierKeyCode(keyCode: string): boolean {
  return keyCode === "Shift" || keyCode === "Control" || keyCode === "Alt" || keyCode === "Super";
}

function electronNativeMouseEvent(kind: NativeOverlayInputEvent["kind"]):
  { type: "mouseDown" | "mouseUp"; button: "left" | "right" | "middle" } | null {
  switch (kind) {
    case "leftMouseDown": return { type: "mouseDown", button: "left" };
    case "leftMouseUp": return { type: "mouseUp", button: "left" };
    case "rightMouseDown": return { type: "mouseDown", button: "right" };
    case "rightMouseUp": return { type: "mouseUp", button: "right" };
    case "middleMouseDown": return { type: "mouseDown", button: "middle" };
    case "middleMouseUp": return { type: "mouseUp", button: "middle" };
    default: return null;
  }
}

function electronNativeAuxiliaryMouseEvent(kind: NativeOverlayInputEvent["kind"]):
  { type: "pointer-down" | "pointer-up"; button: 3 | 4 } | null {
  switch (kind) {
    case "backMouseDown": return { type: "pointer-down", button: 3 };
    case "backMouseUp": return { type: "pointer-up", button: 3 };
    case "forwardMouseDown": return { type: "pointer-down", button: 4 };
    case "forwardMouseUp": return { type: "pointer-up", button: 4 };
    default: return null;
  }
}

function updateElectronNativeModifiers(
  modifiers: Set<ElectronNativeInputModifier>,
  event: NativeOverlayInputEvent
): boolean {
  let changed = false;
  const update = (name: ElectronNativeInputModifier, captured: boolean): void => {
    if (captured) {
      if (!modifiers.has(name)) {
        modifiers.add(name);
        changed = true;
      }
    } else if (modifiers.delete(name)) {
      changed = true;
    }
  };
  if (event.kind === "keyDown" || event.kind === "keyUp") {
    for (const [name, captured] of [
      ["shift", event.shift], ["control", event.control], ["alt", event.alt]
    ] as const) {
      update(name, captured);
    }
  }
  for (const [name, captured] of [["capslock", event.capsLock], ["numlock", event.numLock]] as const) {
    if (captured !== undefined) update(name, captured);
  }
  const modifier: ElectronNativeInputModifier | undefined = [0x10, 0xa0, 0xa1].includes(event.wparam)
    ? "shift"
    : [0x11, 0xa2, 0xa3].includes(event.wparam)
      ? "control"
      : [0x12, 0xa4, 0xa5].includes(event.wparam)
        ? "alt"
        : [0x5b, 0x5c].includes(event.wparam)
          ? "meta"
          : undefined;
  if (modifier && event.kind === "keyDown") update(modifier, true);
  else if (modifier && event.kind === "keyUp") update(modifier, false);
  if (event.kind.includes("Mouse") || event.kind === "mouseMove" || event.kind === "mouseWheel") {
    update("shift", Boolean(event.wparam & 0x0004));
    update("control", Boolean(event.wparam & 0x0008));
  }
  return changed;
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
  /** @deprecated Automatic frame-rate downshifts are disabled. */
  adaptiveFrameRate?: boolean;
  /** @deprecated Retained for source compatibility; it is no longer called. */
  onFrameRateChanged?: (event: {
    reason: "sustained-overload";
    requestedFrameRate: number;
    previousFrameRate: number;
    frameRate: number;
    displayRefreshRate: number;
    presentSyncInterval: number;
    sourceFrameRate: number;
    presentFrameRate: number;
  }) => void;
  nativeWindowHandle?: Buffer;
  getBounds?: () => ElectronOverlayBounds | undefined;
  getFullScreen?: () => boolean;
  useStandaloneLinuxHost?: boolean;
  restoreFocus?: () => void;
  restoreFocusDelayMs?: number;
  windowsSharedTextureResumeDelayMs?: number;
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
  windowsSharedTextureResumeDelayMs?: number;
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
