import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isMainThread } from "node:worker_threads";
import { loadNativeBinding } from "./native";
import type { NativeBinding } from "./native";

export interface KWinWaylandOverlayHostSyncStatus {
  attempted: boolean;
  active: boolean;
  command?: "qdbus6" | "qdbus";
  interactiveResizeReceiverStarted?: boolean;
  /** Exact native/script presentation protocol negotiation succeeded. */
  presentationProtocolReady?: boolean;
  presentationProtocolVersion?: number;
  /** Native role markers remain usable independently of receipt transport. */
  hostIdentityMarkerReady?: boolean;
  receiverHealth?: "active" | "unavailable" | "closed";
  /** Exact script absence/retirement could not be proven; keep host fail-closed. */
  ownershipUncertain?: boolean;
  reason?:
    | "not-kde-wayland"
    | "kwin-controller-not-main-thread"
    | "runtime-file-unavailable"
    | "kwin-dbus-unavailable"
    | "receiver-closed"
    | "kwin-degraded-marker-unconfirmed"
    | "kwin-controller-owned-by-another-copy"
    | "kwin-script-retirement-unconfirmed";
}

export interface KWinWaylandOverlaySourceInteractiveResizeEvent {
  readonly sourceId: string;
  readonly sequence: number;
  readonly paired: boolean;
  readonly active: boolean;
}

export interface KWinWaylandOverlayGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface KWinWaylandOverlayPresentationStateBase {
  readonly generation: number;
  readonly pairId: string;
  readonly pairGeneration: number;
  readonly sequence: number;
}

export interface KWinWaylandOverlayPresentationConvergedState
  extends KWinWaylandOverlayPresentationStateBase {
  readonly kind: "converged";
  readonly epoch: number;
  readonly fullScreen: boolean;
  readonly sourceBounds: Readonly<KWinWaylandOverlayGeometry>;
  readonly target: Readonly<KWinWaylandOverlayGeometry>;
}

export interface KWinWaylandOverlayPresentationInvalidatedState
  extends KWinWaylandOverlayPresentationStateBase {
  readonly kind: "invalidated";
}

export type KWinWaylandOverlayPresentationState =
  | KWinWaylandOverlayPresentationConvergedState
  | KWinWaylandOverlayPresentationInvalidatedState;

export interface KWinWaylandOverlayContentInsets {
  top: number;
  right: number;
}

const MAX_KWIN_WAYLAND_CONTENT_INSET = 256;
const KWIN_WAYLAND_GEOMETRY_TOLERANCE = 0.51;

export function measureKWinWaylandOverlayContentInsets(
  hostGeometry: KWinWaylandOverlayGeometry,
  sourceClientGeometry: KWinWaylandOverlayGeometry
): KWinWaylandOverlayContentInsets | undefined {
  const rawTop = sourceClientGeometry.height - hostGeometry.height;
  const rawRight = sourceClientGeometry.width - hostGeometry.width;
  // KWin uses QRectF while an Xwayland host ultimately lands on integer
  // pixels. Treat sub-pixel edge disagreement as the same edge instead of
  // rejecting a valid seed (or repeatedly correcting it).
  const top = Math.abs(rawTop) <= KWIN_WAYLAND_GEOMETRY_TOLERANCE ? 0 : rawTop;
  const right = Math.abs(rawRight) <= KWIN_WAYLAND_GEOMETRY_TOLERANCE ? 0 : rawRight;
  if (
    !Number.isFinite(top) ||
    !Number.isFinite(right) ||
    top < 0 ||
    right < 0 ||
    top > MAX_KWIN_WAYLAND_CONTENT_INSET ||
    right > MAX_KWIN_WAYLAND_CONTENT_INSET ||
    top >= sourceClientGeometry.height ||
    right >= sourceClientGeometry.width
  ) {
    return undefined;
  }
  return { top, right };
}

/**
 * Place the Xwayland Steam surface over Electron's web content, not over the
 * whole Wayland client. KWin's client geometry includes Electron's in-window
 * menu bar, while the GLX host is created at Electron's smaller content size.
 * Preserve that content size and bottom-align it inside the client so the menu
 * remains above the overlay and the bottom edges stay coincident.
 */
export function resolveKWinWaylandOverlayHostGeometry(
  hostGeometry: KWinWaylandOverlayGeometry,
  sourceClientGeometry: KWinWaylandOverlayGeometry,
  contentInsets?: KWinWaylandOverlayContentInsets
): KWinWaylandOverlayGeometry {
  const right = contentInsets === undefined
    ? Math.max(0, sourceClientGeometry.width - Math.min(hostGeometry.width, sourceClientGeometry.width))
    : Math.max(0, Math.min(contentInsets.right, sourceClientGeometry.width - 1));
  const top = contentInsets === undefined
    ? Math.max(0, sourceClientGeometry.height - Math.min(hostGeometry.height, sourceClientGeometry.height))
    : Math.max(0, Math.min(contentInsets.top, sourceClientGeometry.height - 1));
  return {
    x: sourceClientGeometry.x,
    y: sourceClientGeometry.y + top,
    width: Math.max(1, sourceClientGeometry.width - right),
    height: Math.max(1, sourceClientGeometry.height - top)
  };
}

let kWinPresentationInstanceId = randomUUID().replace(/-/g, "").slice(0, 16);
// KWin script names are session-global. A fixed name lets a second Electron
// process unload the first process's live geometry owner, so scope lifecycle
// operations to this OS process. PID reuse intentionally cleans up only a
// dead predecessor that occupied the same identity.
const KWIN_SCRIPT_NAME = `steam-bridge-overlay-host-sync-v2-${process.pid}`;
const KWIN_PROCESS_CLEANUP_REGISTRY = Symbol.for(
  "steam-bridge.kwin-overlay-host-sync.process-cleanup.v2"
);
const KWIN_PROCESS_CONTROLLER_REGISTRY = Symbol.for(
  "steam-bridge.kwin-overlay-host-sync.controller-owner.v2"
);
const KWIN_HOST_CLASS = "steambridgenativeprobe";
const KWIN_DBUS_TIMEOUT_MS = 1500;
const KWIN_EXIT_UNLOAD_TIMEOUT_MS = 250;
const KWIN_SCRIPT_RUN_TIMEOUT_MS = 10000;
const KWIN_UNLOAD_POLL_ATTEMPTS = 20;
const KWIN_RESIZE_EVENT_OBJECT_PATH = "/com/steambridge/OverlayHostSync";
const KWIN_RESIZE_EVENT_INTERFACE = "com.steambridge.OverlayHostSync";
const KWIN_RESIZE_EVENT_METHOD = "NotifyResizeState";
const KWIN_PRESENTATION_EVENT_METHOD = "NotifyPresentationState";
const KWIN_PRESENTATION_INVALIDATED_EVENT_METHOD = "NotifyPresentationInvalidated";
let kWinResizeEventToken = randomUUID().replace(/-/g, "");
const MIN_KWIN_WAYLAND_GEOMETRY_COORDINATE = -2_147_483_648;
const MAX_KWIN_WAYLAND_GEOMETRY_COORDINATE = 2_147_483_647;
const MAX_KWIN_WAYLAND_GEOMETRY_SIZE = 2_147_483_647;
const MAX_KWIN_WAYLAND_PRESENTATION_EPOCH = 0xffff_ffff;
const KWIN_WAYLAND_PRESENTATION_PROTOCOL_VERSION = 1;
const kWinResizeEventListeners = new Set<
  (event: KWinWaylandOverlaySourceInteractiveResizeEvent) => void
>();
type KWinWaylandOverlayTransportSafetyPhase = "park" | "degraded";
const kWinTransportSafetyListeners = new Set<
  (phase: KWinWaylandOverlayTransportSafetyPhase) => boolean
>();
const kWinResizeEventBySource = new Map<
  string,
  KWinWaylandOverlaySourceInteractiveResizeEvent
>();
const kWinPresentationSequenceByPair = new Map<string, number>();
const kWinInvalidatedPresentationPairs = new Set<string>();
let kWinPresentationReceiptGeneration = 0;
let newestKWinPresentationPairGeneration = 0;
let kWinPresentationPairGenerationFloor = 0;
let latestKWinPresentationState: KWinWaylandOverlayPresentationState | undefined;
let kWinResizeEventTransportClosed = false;
let kWinResizeEventReceiverGeneration = 0;
let activeKWinResizeEventReceiverGeneration = 0;
let kWinStrictPresentationScriptLoaded = false;
let kWinHostIdentityMarkerCapabilityReady = false;
let kWinDegradedMarkerPending = false;

interface KWinProcessControllerRegistry {
  readonly ownerToken: object;
  readonly ownerModulePath: string;
}

const KWIN_PROCESS_CONTROLLER_INSTANCE_TOKEN = Object.freeze({});

function currentKWinControllerModulePath(): string {
  try {
    return fs.realpathSync(__filename);
  } catch {
    return path.resolve(__filename);
  }
}

function claimKWinProcessControllerOwnership(): boolean {
  const modulePath = currentKWinControllerModulePath();
  const existing = Reflect.get(process, KWIN_PROCESS_CONTROLLER_REGISTRY) as
    KWinProcessControllerRegistry | undefined;
  if (existing) {
    return existing.ownerToken === KWIN_PROCESS_CONTROLLER_INSTANCE_TOKEN;
  }
  Reflect.set(
    process,
    KWIN_PROCESS_CONTROLLER_REGISTRY,
    Object.freeze({
      ownerToken: KWIN_PROCESS_CONTROLLER_INSTANCE_TOKEN,
      ownerModulePath: modulePath
    })
  );
  return true;
}

function resetKWinTransportAttemptIdentity(): void {
  kWinPresentationPairGenerationFloor = Math.max(
    kWinPresentationPairGenerationFloor,
    newestKWinPresentationPairGeneration
  );
  kWinPresentationInstanceId = randomUUID().replace(/-/g, "").slice(0, 16);
  kWinResizeEventToken = randomUUID().replace(/-/g, "");
  kWinResizeEventBySource.clear();
  kWinPresentationSequenceByPair.clear();
  kWinInvalidatedPresentationPairs.clear();
  newestKWinPresentationPairGeneration = 0;
  latestKWinPresentationState = undefined;
  kWinStrictPresentationScriptLoaded = false;
  kWinHostIdentityMarkerCapabilityReady = false;
  kWinDegradedMarkerPending = false;
}

interface KWinResizeEventReceiver {
  serviceName: string;
  token: string;
}

function createKWinOverlayHostSyncScript(
  resizeEvents: KWinResizeEventReceiver | undefined,
  strictPresentationProtocol: boolean
): string {
  return `
const steamBridgeHostClass = ${JSON.stringify(KWIN_HOST_CLASS)};
const steamBridgeExpectedPid = ${process.pid};
const steamBridgePresentationInstanceId = ${JSON.stringify(kWinPresentationInstanceId)};
let steamBridgeStrictPresentationProtocol = ${strictPresentationProtocol};
const MAX_KWIN_WAYLAND_PRESENTATION_EPOCH = ${MAX_KWIN_WAYLAND_PRESENTATION_EPOCH};
const MAX_KWIN_WAYLAND_CONTENT_INSET = ${MAX_KWIN_WAYLAND_CONTENT_INSET};
const KWIN_WAYLAND_GEOMETRY_TOLERANCE = ${KWIN_WAYLAND_GEOMETRY_TOLERANCE};
const steamBridgeMeasureContentInsets = ${measureKWinWaylandOverlayContentInsets.toString()};
const steamBridgeResolveHostGeometry = ${resolveKWinWaylandOverlayHostGeometry.toString()};
let steamBridgeResizeEventService = ${JSON.stringify(resizeEvents?.serviceName ?? "")};
const steamBridgeResizeEventPath = ${JSON.stringify(KWIN_RESIZE_EVENT_OBJECT_PATH)};
const steamBridgeResizeEventInterface = ${JSON.stringify(KWIN_RESIZE_EVENT_INTERFACE)};
const steamBridgeResizeEventMethod = ${JSON.stringify(KWIN_RESIZE_EVENT_METHOD)};
const steamBridgePresentationEventMethod = ${JSON.stringify(KWIN_PRESENTATION_EVENT_METHOD)};
const steamBridgePresentationInvalidatedEventMethod = ${JSON.stringify(KWIN_PRESENTATION_INVALIDATED_EVENT_METHOD)};
const steamBridgeResizeEventToken = ${JSON.stringify(resizeEvents?.token ?? "")};
const steamBridgePairs = [];
const steamBridgeConnectedWindows = [];
const steamBridgeSourceResizeStates = [];
let steamBridgeSyncing = false;
let steamBridgePresentationPairCounter = ${kWinPresentationPairGenerationFloor};
let steamBridgeRetired = false;
let steamBridgeReceiverOwnerObserved = false;
let steamBridgeReceiverOwnerMissingPolls = 0;
let steamBridgeReceiverOwnerNoReplyPolls = 0;
let steamBridgeReceiverOwnerPollPending = false;
let steamBridgeReceiverOwnerPollGeneration = 0;
let steamBridgeReceiverOwnerTimer = null;
let steamBridgeReceiverOwnerResponseTimer = null;
let steamBridgeReceiverlessRetirementTimer = null;

function steamBridgeDisconnectSignal(signal, listener) {
  if (!signal || typeof signal.disconnect !== "function") {
    return;
  }
  try {
    signal.disconnect(listener);
  } catch (_) {
    // A deleted KWin object can invalidate its signal wrapper before cleanup.
  }
}

function steamBridgeStopTimer(timer) {
  if (!timer || typeof timer.stop !== "function") {
    return;
  }
  try {
    timer.stop();
  } catch (_) {
    // Script teardown is best-effort once KWin has begun unloading us.
  }
}

function steamBridgeDisconnectWindow(window) {
  steamBridgeDisconnectSignal(window.frameGeometryChanged, steamBridgeSyncAll);
  steamBridgeDisconnectSignal(window.clientGeometryChanged, steamBridgeSyncAll);
  steamBridgeDisconnectSignal(window.fullScreenChanged, steamBridgeSyncAll);
  steamBridgeDisconnectSignal(window.minimizedChanged, steamBridgeSyncAll);
  steamBridgeDisconnectSignal(window.windowClassChanged, steamBridgeSyncAll);
  steamBridgeDisconnectSignal(window.windowRoleChanged, steamBridgeSyncAll);
  steamBridgeDisconnectSignal(window.opacityChanged, steamBridgeSyncAll);
  steamBridgeDisconnectSignal(window.stackingOrderChanged, steamBridgeSyncAll);
}

function steamBridgeRetire() {
  if (steamBridgeRetired) {
    return;
  }
  steamBridgeRetired = true;
  steamBridgeStopTimer(steamBridgeReceiverOwnerTimer);
  steamBridgeStopTimer(steamBridgeReceiverOwnerResponseTimer);
  steamBridgeStopTimer(steamBridgeReceiverlessRetirementTimer);
  steamBridgeReceiverOwnerPollGeneration += 1;
  steamBridgeReceiverOwnerPollPending = false;
  steamBridgeReceiverOwnerTimer = null;
  steamBridgeReceiverOwnerResponseTimer = null;
  steamBridgeReceiverlessRetirementTimer = null;
  steamBridgeDisconnectSignal(workspace.windowAdded, steamBridgeHandleWindowAdded);
  steamBridgeDisconnectSignal(workspace.windowRemoved, steamBridgeHandleWindowRemoved);
  steamBridgeDisconnectSignal(workspace.windowActivated, steamBridgeSyncAll);
  for (const window of steamBridgeConnectedWindows) {
    steamBridgeDisconnectWindow(window);
  }
  for (const state of steamBridgeSourceResizeStates) {
    if (
      state.source &&
      !state.source.deleted &&
      state.source.skipSwitcher !== state.originalSkipSwitcher
    ) {
      state.source.skipSwitcher = state.originalSkipSwitcher;
    }
    steamBridgeDisconnectSignal(
      state.source.interactiveMoveResizeStarted,
      state.startedHandler,
    );
    steamBridgeDisconnectSignal(
      state.source.interactiveMoveResizeFinished,
      state.finishedHandler,
    );
  }
  for (const pair of steamBridgePairs) {
    steamBridgeStopTimer(pair.restoreHostFocusTimer);
    pair.restoreHostFocusTimer = null;
    pair.restoreHostFocusPending = false;
  }
  for (const window of workspace.windowList()) {
    if (
      window.pid === steamBridgeExpectedPid &&
      steamBridgeHasHostClass(window) &&
      !window.deleted &&
      !window.skipSwitcher
    ) {
      window.skipSwitcher = true;
    }
  }
  steamBridgePairs.splice(0, steamBridgePairs.length);
  steamBridgeConnectedWindows.splice(0, steamBridgeConnectedWindows.length);
  steamBridgeSourceResizeStates.splice(0, steamBridgeSourceResizeStates.length);
  // Do not asynchronously unload our fixed per-PID name from inside the old
  // script. A later external fresh-lease transaction may already have loaded
  // a replacement under that name when this D-Bus call is delivered. The
  // Electron-side preflight/fresh-attach/exit paths own exact-name unload;
  // this retired script stays inert until one of those ordered transactions.
}

function steamBridgeHasExpectedPidWindow() {
  return workspace.windowList().some(
    (window) => window.pid === steamBridgeExpectedPid && !window.deleted
  );
}

function steamBridgeDowngradePairToReceiverless(pair) {
  const insets = pair.lastStableWindowedInsets ||
    pair.initialContentInsetsCandidate ||
    { top: 0, right: 0 };
  pair.contentInsets = { top: insets.top, right: insets.right };
  pair.awaitingIndependentWindowedContentInset = false;
  pair.windowedSeedEligibleSourceBounds = null;
  pair.windowedSeedEligibleReceiptSequence = 0;
  pair.lastPresentationSignature = null;
  pair.presentationInvalidated = true;
  pair.lastAppliedHostGeometry = null;
}

function steamBridgeHandleReceiverOwnerLoss() {
  if (steamBridgeRetired || !steamBridgeResizeEventService) {
    return;
  }
  steamBridgeStopTimer(steamBridgeReceiverOwnerTimer);
  steamBridgeStopTimer(steamBridgeReceiverOwnerResponseTimer);
  steamBridgeReceiverOwnerPollGeneration += 1;
  steamBridgeReceiverOwnerTimer = null;
  steamBridgeReceiverOwnerResponseTimer = null;
  steamBridgeReceiverOwnerPollPending = false;
  // The authenticated event endpoint is gone. Continue as the sole geometry
  // writer in receiverless legacy mode; JS simultaneously disables strict
  // holds but keeps this script's ownership active.
  steamBridgeResizeEventService = "";
  steamBridgeStrictPresentationProtocol = false;
  for (const pair of steamBridgePairs) {
    steamBridgeDowngradePairToReceiverless(pair);
  }
  steamBridgeSyncAll();
  steamBridgeUpdateReceiverlessRetirement();
}

function steamBridgeCancelReceiverlessRetirement() {
  steamBridgeStopTimer(steamBridgeReceiverlessRetirementTimer);
  steamBridgeReceiverlessRetirementTimer = null;
}

function steamBridgeUpdateReceiverlessRetirement() {
  if (steamBridgeRetired || steamBridgeResizeEventService) {
    return;
  }
  if (steamBridgeHasExpectedPidWindow()) {
    steamBridgeCancelReceiverlessRetirement();
    return;
  }
  if (
    steamBridgeReceiverlessRetirementTimer ||
    typeof QTimer !== "function"
  ) {
    return;
  }
  const timer = new QTimer();
  // Electron may destroy and recreate its BrowserWindow without replacing the
  // process. Keep a generous gap before retiring a receiverless compatibility
  // script so a normal same-process recreation can cancel this timer.
  timer.interval = 30000;
  timer.singleShot = true;
  timer.timeout.connect(function () {
    if (
      !steamBridgeRetired &&
      !steamBridgeResizeEventService &&
      !steamBridgeHasExpectedPidWindow()
    ) {
      steamBridgeRetire();
    }
  });
  steamBridgeReceiverlessRetirementTimer = timer;
  timer.start();
}

function steamBridgePollReceiverOwner() {
  if (
    steamBridgeRetired ||
    !steamBridgeResizeEventService ||
    steamBridgeReceiverOwnerPollPending
  ) {
    return;
  }
  steamBridgeReceiverOwnerPollGeneration += 1;
  const pollGeneration = steamBridgeReceiverOwnerPollGeneration;
  steamBridgeReceiverOwnerPollPending = true;
  const responseTimer = new QTimer();
  responseTimer.interval = 3000;
  responseTimer.singleShot = true;
  responseTimer.timeout.connect(function () {
    if (
      steamBridgeRetired ||
      !steamBridgeResizeEventService ||
      !steamBridgeReceiverOwnerPollPending ||
      pollGeneration !== steamBridgeReceiverOwnerPollGeneration
    ) {
      return;
    }
    steamBridgeReceiverOwnerPollPending = false;
    steamBridgeReceiverOwnerResponseTimer = null;
    // KWin's callDBus callback is omitted on a D-Bus error. That is not an
    // authoritative NameHasOwner=false response: while live windows exist,
    // keep strict mode and retry so JS and KWin cannot split ownership modes.
    // With no expected-PID windows, repeated silence may safely clean up a
    // crashed application's otherwise immortal script.
    steamBridgeReceiverOwnerMissingPolls = 0;
    if (steamBridgeHasExpectedPidWindow()) {
      steamBridgeReceiverOwnerNoReplyPolls = 0;
      return;
    }
    steamBridgeReceiverOwnerNoReplyPolls += 1;
    if (steamBridgeReceiverOwnerNoReplyPolls >= 10) {
      steamBridgeRetire();
    }
  });
  steamBridgeReceiverOwnerResponseTimer = responseTimer;
  responseTimer.start();
  callDBus(
    "org.freedesktop.DBus",
    "/org/freedesktop/DBus",
    "org.freedesktop.DBus",
    "NameHasOwner",
    steamBridgeResizeEventService,
    function (hasOwner) {
      if (
        steamBridgeRetired ||
        !steamBridgeResizeEventService ||
        !steamBridgeReceiverOwnerPollPending ||
        pollGeneration !== steamBridgeReceiverOwnerPollGeneration
      ) {
        return;
      }
      steamBridgeStopTimer(steamBridgeReceiverOwnerResponseTimer);
      steamBridgeReceiverOwnerResponseTimer = null;
      steamBridgeReceiverOwnerPollPending = false;
      if (hasOwner === true) {
        steamBridgeReceiverOwnerObserved = true;
        steamBridgeReceiverOwnerMissingPolls = 0;
        steamBridgeReceiverOwnerNoReplyPolls = 0;
        return;
      }
      if (hasOwner === false) {
        steamBridgeReceiverOwnerNoReplyPolls = 0;
        steamBridgeReceiverOwnerMissingPolls += 1;
        const missingOwnerLimit = steamBridgeReceiverOwnerObserved ? 2 : 10;
        if (steamBridgeReceiverOwnerMissingPolls >= missingOwnerLimit) {
          steamBridgeHandleReceiverOwnerLoss();
        }
        return;
      }
      // A malformed response is no more authoritative than no callback. It
      // breaks a run of explicit false replies and lets the next timer tick
      // retry without downgrading live pairs.
      steamBridgeReceiverOwnerMissingPolls = 0;
      if (steamBridgeHasExpectedPidWindow()) {
        steamBridgeReceiverOwnerNoReplyPolls = 0;
        return;
      }
      steamBridgeReceiverOwnerNoReplyPolls += 1;
      if (steamBridgeReceiverOwnerNoReplyPolls >= 10) {
        steamBridgeRetire();
      }
    },
  );
}

function steamBridgeStartLifecycleWatch() {
  if (steamBridgeResizeEventService) {
    if (typeof QTimer !== "function") {
      return;
    }
    const timer = new QTimer();
    timer.interval = 1000;
    timer.singleShot = false;
    timer.timeout.connect(steamBridgePollReceiverOwner);
    steamBridgeReceiverOwnerTimer = timer;
    steamBridgePollReceiverOwner();
    timer.start();
    return;
  }
  steamBridgeUpdateReceiverlessRetirement();
}

function steamBridgeHasHostClass(window) {
  return String(window.resourceClass || "").toLowerCase() === steamBridgeHostClass;
}

function steamBridgeParsePresentationCommand(window) {
  const prefix = "steam-bridge:" + steamBridgePresentationInstanceId + ":";
  const role = String(window.windowRole || "");
  if (role.indexOf(prefix) !== 0) {
    return null;
  }
  const parts = role.slice(prefix.length).split(":");
  if (parts[0] === "degraded" && parts.length === 1) {
    return { kind: "degraded", epoch: 0, seedBounds: null };
  }
  const epochIndex = parts[0] === "state" ? 1 : parts[0] === "seed" ? 1 : -1;
  if (
    epochIndex < 0 ||
    !/^(0|[1-9][0-9]*)$/.test(parts[epochIndex] || "")
  ) {
    return null;
  }
  const epoch = Number(parts[epochIndex]);
  if (!Number.isSafeInteger(epoch) || epoch > MAX_KWIN_WAYLAND_PRESENTATION_EPOCH) {
    return null;
  }
  if (parts[0] === "state" && parts.length === 2) {
    return { kind: "state", epoch: epoch, seedBounds: null };
  }
  if (parts[0] !== "seed" || parts.length !== 12) {
    return null;
  }
  const pairGeneration = Number(parts[2]);
  const receiptSequence = Number(parts[3]);
  const sourceX = Number(parts[4]);
  const sourceY = Number(parts[5]);
  const sourceWidth = Number(parts[6]);
  const sourceHeight = Number(parts[7]);
  const x = Number(parts[8]);
  const y = Number(parts[9]);
  const width = Number(parts[10]);
  const height = Number(parts[11]);
  if (
    !Number.isSafeInteger(pairGeneration) ||
    pairGeneration <= 0 ||
    pairGeneration > MAX_KWIN_WAYLAND_PRESENTATION_EPOCH ||
    !Number.isSafeInteger(receiptSequence) ||
    receiptSequence <= 0 ||
    receiptSequence > MAX_KWIN_WAYLAND_PRESENTATION_EPOCH ||
    !Number.isFinite(sourceX) ||
    !Number.isFinite(sourceY) ||
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceX < ${MIN_KWIN_WAYLAND_GEOMETRY_COORDINATE} ||
    sourceX > ${MAX_KWIN_WAYLAND_GEOMETRY_COORDINATE} ||
    sourceY < ${MIN_KWIN_WAYLAND_GEOMETRY_COORDINATE} ||
    sourceY > ${MAX_KWIN_WAYLAND_GEOMETRY_COORDINATE} ||
    sourceWidth <= 0 ||
    sourceWidth > ${MAX_KWIN_WAYLAND_GEOMETRY_SIZE} ||
    sourceHeight <= 0 ||
    sourceHeight > ${MAX_KWIN_WAYLAND_GEOMETRY_SIZE} ||
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    width > ${MAX_KWIN_WAYLAND_GEOMETRY_SIZE} ||
    height <= 0 ||
    height > ${MAX_KWIN_WAYLAND_GEOMETRY_SIZE}
  ) {
    return null;
  }
  return {
    kind: "seed",
    epoch: epoch,
    pairGeneration: pairGeneration,
    receiptSequence: receiptSequence,
    sourceBounds: {
      x: sourceX,
      y: sourceY,
      width: sourceWidth,
      height: sourceHeight,
    },
    seedBounds: { x: x, y: y, width: width, height: height },
  };
}

function steamBridgeIsHost(window) {
  return window.pid === steamBridgeExpectedPid &&
    steamBridgeHasHostClass(window) &&
    (
      !steamBridgeStrictPresentationProtocol ||
      steamBridgeParsePresentationCommand(window) !== null
    );
}

function steamBridgeSameGeometry(left, right) {
  return left && right &&
    Math.abs(left.x - right.x) <= KWIN_WAYLAND_GEOMETRY_TOLERANCE &&
    Math.abs(left.y - right.y) <= KWIN_WAYLAND_GEOMETRY_TOLERANCE &&
    Math.abs((left.x + left.width) - (right.x + right.width)) <=
      KWIN_WAYLAND_GEOMETRY_TOLERANCE &&
    Math.abs((left.y + left.height) - (right.y + right.height)) <=
      KWIN_WAYLAND_GEOMETRY_TOLERANCE;
}

function steamBridgeCopyGeometry(geometry) {
  return {
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
  };
}

function steamBridgeMeasureInitialContentInsets(host, source) {
  if (
    !host ||
    !source ||
    source.resize === true
  ) {
    return undefined;
  }
  const hostGeometry = steamBridgeCopyGeometry(host.frameGeometry);
  const sourceGeometry = steamBridgeCopyGeometry(source.clientGeometry);
  const leftAligned = Math.abs(hostGeometry.x - sourceGeometry.x) <=
    KWIN_WAYLAND_GEOMETRY_TOLERANCE;
  const bottomAligned = Math.abs(
    (hostGeometry.y + hostGeometry.height) -
    (sourceGeometry.y + sourceGeometry.height)
  ) <= KWIN_WAYLAND_GEOMETRY_TOLERANCE;
  return leftAligned && bottomAligned
    ? steamBridgeMeasureContentInsets(hostGeometry, sourceGeometry)
    : undefined;
}

function steamBridgeFindSource(host, preferredSource) {
  const candidates = workspace.windowList().filter(
    (window) => window !== host && window.pid === host.pid && !steamBridgeHasHostClass(window)
  );
  // Once a host has a live source, keep that relationship until the source is
  // actually removed. DevTools and auxiliary BrowserWindows share Electron's
  // PID and can be active with the same geometry; activation is only a useful
  // tie-breaker for the initial pairing.
  if (preferredSource && candidates.indexOf(preferredSource) >= 0) {
    return preferredSource;
  }
  const activeWindow = workspace.activeWindow;
  const hostGeometry = host.frameGeometry;
  const geometryMatches = candidates.map((window) => {
    const geometry = window.clientGeometry;
    const widthDelta = geometry.width - hostGeometry.width;
    const heightDelta = geometry.height - hostGeometry.height;
    return { window, widthDelta, heightDelta };
  }).filter((candidate) =>
    candidate.widthDelta >= -KWIN_WAYLAND_GEOMETRY_TOLERANCE &&
    candidate.widthDelta <= ${MAX_KWIN_WAYLAND_CONTENT_INSET} &&
    candidate.heightDelta >= -KWIN_WAYLAND_GEOMETRY_TOLERANCE &&
    candidate.heightDelta <= ${MAX_KWIN_WAYLAND_CONTENT_INSET}
  ).sort((left, right) =>
    (Math.max(0, left.widthDelta) + Math.max(0, left.heightDelta)) -
    (Math.max(0, right.widthDelta) + Math.max(0, right.heightDelta))
  );
  if (activeWindow && geometryMatches.some((candidate) => candidate.window === activeWindow)) {
    return activeWindow;
  }
  if (geometryMatches.length > 0) {
    return geometryMatches[0].window;
  }
  if (activeWindow && candidates.indexOf(activeWindow) >= 0) {
    return activeWindow;
  }
  return candidates[0] || null;
}

function steamBridgeExcludeHostFromShell(host) {
  if (!host.skipTaskbar) {
    host.skipTaskbar = true;
  }
  if (!host.skipPager) {
    host.skipPager = true;
  }
}

function steamBridgeReconcileSwitcherOwnership() {
  const liveWindows = workspace.windowList();
  const allHosts = liveWindows.filter((window) =>
    window.pid === steamBridgeExpectedPid &&
    steamBridgeHasHostClass(window) &&
    !window.deleted
  );
  const desiredHosts = [];
  const sourceOwners = [];
  for (const state of steamBridgeSourceResizeStates) {
    const source = state.source;
    if (!state.paired || !source || source.deleted) {
      continue;
    }
    const eligiblePairs = steamBridgePairs.filter((candidate) =>
      candidate.resizeState === state &&
      candidate.source === source &&
      candidate.host &&
      !candidate.host.deleted &&
      steamBridgeIsHost(candidate.host) &&
      !source.minimized &&
      !source.hidden &&
      !candidate.host.minimized &&
      !candidate.host.hidden &&
      Number(candidate.host.opacity) > 0
    );
    const desiredHost = !state.originalSkipSwitcher && eligiblePairs.length === 1
      ? eligiblePairs[0].host
      : null;
    if (desiredHost) {
      desiredHosts.push(desiredHost);
    }
    sourceOwners.push({ state: state, desiredHost: desiredHost });
  }
  // First add the desired logical entry. On an opacity edge this means the
  // host appears before its covered source is excluded; on park/ambiguity the
  // source returns before any old host disappears.
  for (const owner of sourceOwners) {
    if (owner.desiredHost) {
      if (owner.desiredHost.skipSwitcher) {
        owner.desiredHost.skipSwitcher = false;
      }
    } else if (owner.state.source.skipSwitcher !== owner.state.originalSkipSwitcher) {
      owner.state.source.skipSwitcher = owner.state.originalSkipSwitcher;
    }
  }
  // Then remove every non-owner. This includes invalid-role, unpaired,
  // replacement, and orphan presenters. Delta-only writes avoid churning
  // KWin's MRU/switcher model on ordinary geometry synchronization.
  for (const owner of sourceOwners) {
    const sourceShouldSkip = owner.state.originalSkipSwitcher ||
      owner.desiredHost !== null;
    if (owner.state.source.skipSwitcher !== sourceShouldSkip) {
      owner.state.source.skipSwitcher = sourceShouldSkip;
    }
  }
  for (const host of allHosts) {
    const hostShouldSkip = desiredHosts.indexOf(host) < 0;
    if (host.skipSwitcher !== hostShouldSkip) {
      host.skipSwitcher = hostShouldSkip;
    }
  }
}

function steamBridgeSyncActiveWindow(pair, hostBecameOpaque, hostBecameTransparent) {
  const host = pair.host;
  const source = pair.source;
  const activeWindow = workspace.activeWindow;
  if (hostBecameTransparent) {
    steamBridgeClearRestoreHostFocus(pair);
    if (
      activeWindow === host &&
      source &&
      !source.deleted &&
      !source.minimized &&
      !source.hidden
    ) {
      // The persistent host no longer needs XUnmap as a focus-release
      // workaround. Hand activation back through KWin only when the host still
      // owns it, so an unrelated Alt+Tab target is never stolen.
      workspace.activeWindow = source;
    }
    return;
  }
  const restoreHostFocus = pair.restoreHostFocusPending &&
    steamBridgeIsUniqueOpaquePair(pair) &&
    (
      workspace.activeWindow === source ||
      workspace.activeWindow === host ||
      !workspace.activeWindow
    ) &&
    !source.minimized &&
    !source.hidden &&
    !host.minimized &&
    !host.hidden &&
    source.move !== true &&
    source.resize !== true &&
    !(pair.resizeState && pair.resizeState.interactionActive === true);
  if (
    Number(host.opacity) <= 0 ||
    (
      !hostBecameOpaque &&
      activeWindow !== host &&
      activeWindow !== source &&
      !restoreHostFocus
    )
  ) {
    return;
  }
  const stackingOrder = workspace.stackingOrder;
  const sourceIndex = stackingOrder.indexOf(source);
  const hostIndex = stackingOrder.indexOf(host);
  if (sourceIndex >= 0 && hostIndex >= 0 && hostIndex <= sourceIndex) {
    workspace.raiseWindow(host);
  }
  if (
    (hostBecameOpaque || restoreHostFocus) &&
    workspace.activeWindow !== host &&
    !source.minimized &&
    !source.hidden &&
    !host.minimized &&
    !host.hidden
  ) {
    // KWin's scripting setter delegates to Workspace::activateWindow(). Keep
    // activation compositor-mediated; XSetInputFocus in the same redirected
    // XMap transaction races before the managed top-level is Viewable.
    workspace.activeWindow = host;
  }
  if (restoreHostFocus && workspace.activeWindow === host) {
    steamBridgeClearRestoreHostFocus(pair);
  } else if (restoreHostFocus) {
    steamBridgeScheduleRestoreHostFocus(pair);
  }
}

function steamBridgeIsUniqueOpaquePair(pair) {
  const source = pair.source;
  if (!source) {
    return false;
  }
  const eligiblePairs = steamBridgePairs.filter((candidate) =>
    candidate.source === source &&
    candidate.host &&
    !candidate.host.deleted &&
    steamBridgeIsHost(candidate.host) &&
    !source.minimized &&
    !source.hidden &&
    !candidate.host.minimized &&
    !candidate.host.hidden &&
    Number(candidate.host.opacity) > 0
  );
  return eligiblePairs.length === 1 && eligiblePairs[0] === pair;
}

function steamBridgeClearRestoreHostFocus(pair) {
  steamBridgeStopTimer(pair.restoreHostFocusTimer);
  pair.restoreHostFocusTimer = null;
  pair.restoreHostFocusPending = false;
  pair.restoreHostFocusAttempts = 0;
}

function steamBridgeScheduleRestoreHostFocus(pair) {
  if (
    steamBridgeRetired ||
    !pair.restoreHostFocusPending ||
    pair.restoreHostFocusTimer ||
    pair.restoreHostFocusAttempts >= 20 ||
    typeof QTimer !== "function"
  ) {
    return;
  }
  const timer = new QTimer();
  timer.interval = 50;
  timer.singleShot = true;
  timer.timeout.connect(function () {
    if (pair.restoreHostFocusTimer !== timer) {
      return;
    }
    pair.restoreHostFocusTimer = null;
    steamBridgeStopTimer(timer);
    if (!steamBridgeRetired && pair.restoreHostFocusPending) {
      steamBridgeSyncAll();
    }
  });
  pair.restoreHostFocusTimer = timer;
  pair.restoreHostFocusAttempts += 1;
  timer.start();
}

function steamBridgeNotifySourceResizeState(state) {
  if (!steamBridgeResizeEventService || !state.sourceId) {
    return;
  }
  state.sequence += 1;
  callDBus(
    steamBridgeResizeEventService,
    steamBridgeResizeEventPath,
    steamBridgeResizeEventInterface,
    steamBridgeResizeEventMethod,
    steamBridgeResizeEventToken,
    state.sourceId,
    String(state.sequence),
    state.paired,
    state.active,
  );
}

function steamBridgePresentationGeometrySignature(geometry) {
  return [geometry.x, geometry.y, geometry.width, geometry.height].join(",");
}

function steamBridgeNotifyPresentationState(pair, epoch, fullScreen, sourceBounds, target) {
  if (!steamBridgeStrictPresentationProtocol || !pair.presentationPairId) {
    return;
  }
  if (
    pair.host.fullScreen !== fullScreen ||
    (pair.source.fullScreen === true) !== fullScreen ||
    !steamBridgeSameGeometry(pair.source.clientGeometry, sourceBounds) ||
    !steamBridgeSameGeometry(pair.host.frameGeometry, target)
  ) {
    // A later return to the same target is a new convergence edge and must
    // produce a fresh receipt for a presenter waiting past its old baseline.
    pair.lastPresentationSignature = null;
    return;
  }
  const signature = [
    String(epoch),
    fullScreen ? "1" : "0",
    steamBridgePresentationGeometrySignature(sourceBounds),
    steamBridgePresentationGeometrySignature(target),
  ].join(":");
  if (pair.lastPresentationSignature === signature) {
    return;
  }
  pair.presentationSequence += 1;
  pair.lastPresentationSignature = signature;
  callDBus(
    steamBridgeResizeEventService,
    steamBridgeResizeEventPath,
    steamBridgeResizeEventInterface,
    steamBridgePresentationEventMethod,
    steamBridgeResizeEventToken,
    pair.presentationPairId,
    String(pair.presentationSequence),
    String(epoch),
    fullScreen,
    steamBridgePresentationGeometrySignature(sourceBounds),
    steamBridgePresentationGeometrySignature(target),
  );
  if (
    !fullScreen &&
    pair.awaitingIndependentWindowedContentInset
  ) {
    // Only a zero/provisional phase that was actually converged and reported
    // can authorize the following independent native content seed. Pin the
    // exact source geometry so an old script write cannot be learned against
    // a newer programmatic/live-resize source sample.
    pair.windowedSeedEligibleSourceBounds = steamBridgeCopyGeometry(sourceBounds);
    pair.windowedSeedEligibleReceiptSequence = pair.presentationSequence;
  }
}

function steamBridgeInvalidatePresentationState(pair) {
  if (
    !steamBridgeStrictPresentationProtocol ||
    !pair.presentationPairId ||
    pair.presentationInvalidated
  ) {
    return;
  }
  pair.presentationInvalidated = true;
  pair.lastPresentationSignature = null;
  pair.presentationSequence += 1;
  callDBus(
    steamBridgeResizeEventService,
    steamBridgeResizeEventPath,
    steamBridgeResizeEventInterface,
    steamBridgePresentationInvalidatedEventMethod,
    steamBridgeResizeEventToken,
    pair.presentationPairId,
    String(pair.presentationSequence),
  );
}

function steamBridgeEnsureSourceResizeLifecycle(source) {
  let state = steamBridgeSourceResizeStates.find((candidate) => candidate.source === source);
  if (state) {
    return state;
  }
  state = {
    source,
    sourceId: String(source.internalId || ""),
    originalSkipSwitcher: source.skipSwitcher === true,
    sequence: 0,
    pairCount: 0,
    paired: false,
    active: false,
    interactionActive: false,
    startedHandler: null,
    finishedHandler: null,
  };
  steamBridgeSourceResizeStates.push(state);
  state.startedHandler = function () {
    if (
      steamBridgeRetired ||
      !state.paired ||
      state.interactionActive
    ) {
      return;
    }
    // The KWin signal itself authoritatively brackets both interactive move
    // and resize. The move/resize properties can change on either side of the
    // signal; only resize=true is consulted for the renderer-only D-Bus hold.
    state.interactionActive = true;
    if (source.resize === true) {
      state.active = true;
      steamBridgeNotifySourceResizeState(state);
    }
  };
  state.finishedHandler = function () {
    if (steamBridgeRetired || !state.paired || !state.interactionActive) {
      return;
    }
    const focusCandidates = workspace.activeWindow === source &&
      !source.deleted &&
      !source.minimized &&
      !source.hidden
      ? steamBridgePairs.filter((pair) =>
          pair.resizeState === state &&
          pair.source === source &&
          pair.host &&
          !pair.host.deleted &&
          !pair.host.minimized &&
          !pair.host.hidden &&
          Number(pair.host.opacity) > 0
        )
      : [];
    const focusHost = focusCandidates.length === 1
      ? focusCandidates[0].host
      : null;
    state.interactionActive = false;
    if (state.active) {
      state.active = false;
      steamBridgeNotifySourceResizeState(state);
    }
    // A receipt-pinned state/seed command may have arrived while resize was
    // active and been intentionally ignored. Finishing the drag is itself
    // the authorization boundary; retry it even if no geometry signal follows.
    steamBridgeSyncAll();
    if (
      focusHost &&
      workspace.activeWindow === source &&
      !source.deleted &&
      !source.minimized &&
      !source.hidden &&
      source.move !== true &&
      source.resize !== true &&
      !focusHost.deleted &&
      !focusHost.minimized &&
      !focusHost.hidden &&
      Number(focusHost.opacity) > 0 &&
      steamBridgePairs.some((pair) =>
        pair.resizeState === state &&
        pair.source === source &&
        pair.host === focusHost
      ) &&
      workspace.stackingOrder.indexOf(focusHost) >
        workspace.stackingOrder.indexOf(source)
    ) {
      // KWin temporarily loans focus to the Electron source so its native
      // title drag/edge resize can run. Return that loan only after the real
      // compositor interaction ends and only while this exact opaque pair
      // still owns focus. An unrelated Alt+Tab target is never touched.
      workspace.activeWindow = focusHost;
    }
  };
  source.interactiveMoveResizeStarted.connect(state.startedHandler);
  source.interactiveMoveResizeFinished.connect(state.finishedHandler);
  return state;
}

function steamBridgeReleasePairSource(pair) {
  steamBridgeInvalidatePresentationState(pair);
  steamBridgeClearRestoreHostFocus(pair);
  const state = pair.resizeState;
  if (!state) {
    if (pair.host && !pair.host.deleted && !pair.host.skipSwitcher) {
      pair.host.skipSwitcher = true;
    }
    return;
  }
  pair.resizeState = null;
  state.pairCount = Math.max(0, state.pairCount - 1);
  if (state.pairCount === 0 && state.paired) {
    state.paired = false;
    state.active = false;
    state.interactionActive = false;
    if (
      state.source &&
      !state.source.deleted &&
      state.source.skipSwitcher !== state.originalSkipSwitcher
    ) {
      state.source.skipSwitcher = state.originalSkipSwitcher;
    }
    steamBridgeNotifySourceResizeState(state);
  }
  if (pair.host && !pair.host.deleted && !pair.host.skipSwitcher) {
    pair.host.skipSwitcher = true;
  }
}

function steamBridgeSetPairSource(pair, source) {
  const firstSource = pair.source === null;
  steamBridgeReleasePairSource(pair);
  if (!firstSource) {
    // A replacement source must never inherit inset provenance from the old
    // source. Its host geometry may already have been authored by KWin, so it
    // is not an independent candidate for a new measurement.
    pair.initialContentInsetsCandidate = undefined;
    pair.lastStableWindowedInsets = undefined;
  }
  pair.source = source;
  steamBridgePresentationPairCounter += 1;
  pair.presentationPairGeneration = steamBridgePresentationPairCounter;
  pair.presentationPairId =
    steamBridgeResizeEventToken + ":" + String(steamBridgePresentationPairCounter);
  pair.presentationSequence = 0;
  pair.presentationEpoch = null;
  pair.lastPresentationSignature = null;
  pair.presentationInvalidated = false;
  if (steamBridgeStrictPresentationProtocol) {
    // Every strict source lifetime starts provisional. Prefer the one
    // independently measured pre-write candidate so a lost receipt transport
    // cannot expose whole-client geometry; only a receipt-pinned Bridge seed
    // may promote or replace it as stable provenance.
    pair.contentInsets = source.fullScreen
      ? undefined
      : pair.initialContentInsetsCandidate || { top: 0, right: 0 };
    pair.awaitingIndependentWindowedContentInset = !source.fullScreen;
  } else {
    // Mixed/failed transport builds cannot complete the receipt-pinned
    // handshake. Use only the one pre-KWin-write candidate captured when this
    // pair was created. Never relearn an inset from KWin-authored geometry.
    pair.contentInsets = pair.initialContentInsetsCandidate || { top: 0, right: 0 };
    pair.awaitingIndependentWindowedContentInset = false;
  }
  pair.lastObservedHostGeometry = steamBridgeCopyGeometry(pair.host.frameGeometry);
  pair.lastAppliedHostGeometry = null;
  pair.windowedSeedEligibleSourceBounds = null;
  pair.windowedSeedEligibleReceiptSequence = 0;
  pair.sourceFullScreen = source.fullScreen === true;
  const state = steamBridgeEnsureSourceResizeLifecycle(source);
  pair.resizeState = state;
  state.pairCount += 1;
  if (!state.paired) {
    state.paired = true;
    state.active = source.resize === true;
    state.interactionActive = source.resize === true || source.move === true;
    steamBridgeNotifySourceResizeState(state);
  }
}

function steamBridgePairHost(host) {
  const existing = steamBridgePairs.find((pair) => pair.host === host);
  const source = steamBridgeFindSource(host, existing && existing.source);
  if (existing) {
    if (source && source !== existing.source) {
      steamBridgeSetPairSource(existing, source);
    }
    return existing;
  }
  if (!source) {
    return null;
  }
  const pair = {
    host,
    source: null,
    resizeState: null,
    contentInsets: undefined,
    initialContentInsetsCandidate: steamBridgeMeasureInitialContentInsets(host, source),
    lastStableWindowedInsets: undefined,
    awaitingIndependentWindowedContentInset: true,
    lastObservedHostGeometry: null,
    lastAppliedHostGeometry: null,
    windowedSeedEligibleSourceBounds: null,
    windowedSeedEligibleReceiptSequence: 0,
    // A newly managed window may have been made opaque before KWin delivered
    // its redirected MapRequest. Baseline the lifetime at transparent so its
    // first synchronization still gets exactly one compositor activation edge.
    lastHostOpacity: 0,
    sourceFullScreen: false,
    presentationPairId: "",
    presentationPairGeneration: 0,
    presentationSequence: 0,
    presentationEpoch: null,
    lastPresentationSignature: null,
    presentationInvalidated: false,
    restoreHostFocusPending: false,
    restoreHostFocusAttempts: 0,
    restoreHostFocusTimer: null,
  };
  steamBridgePairs.push(pair);
  steamBridgeSetPairSource(pair, source);
  return pair;
}

function steamBridgeSyncPair(pair) {
  const host = pair.host;
  const source = pair.source;
  if (!host || !source || host.deleted || source.deleted) {
    return;
  }
  const presentationCommand = steamBridgeStrictPresentationProtocol
    ? steamBridgeParsePresentationCommand(host)
    : { kind: "legacy", epoch: 0, seedBounds: null };
  if (!presentationCommand) {
    steamBridgeInvalidatePresentationState(pair);
    return;
  }
  if (
    steamBridgeStrictPresentationProtocol &&
    presentationCommand.kind === "degraded"
  ) {
    // This marker is authenticated by the per-process presentation instance
    // and written on the native host's own X connection. It is the ordered
    // compositor barrier that lets JS release strict opacity/input holds even
    // when KWin's D-Bus owner query itself stops producing callbacks.
    steamBridgeHandleReceiverOwnerLoss();
    if (!steamBridgeRetired) {
      steamBridgeSyncPair(pair);
    }
    return;
  }
  if (
    steamBridgeStrictPresentationProtocol &&
    pair.presentationEpoch !== presentationCommand.epoch
  ) {
    pair.presentationEpoch = presentationCommand.epoch;
    pair.lastPresentationSignature = null;
    if (!source.fullScreen && presentationCommand.kind === "state") {
      // A fresh authenticated state epoch is the same-state DPI/menu metric
      // refresh boundary. Retain the currently stable inset while publishing
      // a newly pinned receipt; only the matching seed may replace it.
      pair.awaitingIndependentWindowedContentInset = true;
      pair.windowedSeedEligibleSourceBounds = null;
      pair.windowedSeedEligibleReceiptSequence = 0;
    }
  }
  const hostOpacity = Number(host.opacity) > 0 ? Number(host.opacity) : 0;
  // Steam transfers focus to a separate steamwebhelper window before making
  // the persistent presenter opaque. That one transition is authoritative
  // enough to repair host/source stacking without making the host keep-above:
  // later focus changes elsewhere do not retrigger it.
  const hostBecameOpaque = pair.lastHostOpacity <= 0 && hostOpacity > 0;
  const hostBecameTransparent = pair.lastHostOpacity > 0 && hostOpacity <= 0;
  const sourceFullScreen = source.fullScreen === true;
  const sourceClientGeometry = steamBridgeCopyGeometry(source.clientGeometry);
  let targetGeometry = steamBridgeCopyGeometry(sourceClientGeometry);
  if (pair.sourceFullScreen !== sourceFullScreen) {
    // Never treat the pre-fullscreen inset as restored-state authority. Start
    // the windowed phase at the compositor's whole source client; the Bridge
    // can then derive a fresh content-sized native seed from this receipt, and
    // the independent host geometry change below replaces this provisional
    // zero inset before a post-seed receipt can be exposed.
    pair.sourceFullScreen = sourceFullScreen;
    pair.awaitingIndependentWindowedContentInset = steamBridgeStrictPresentationProtocol;
    pair.lastAppliedHostGeometry = null;
    pair.windowedSeedEligibleSourceBounds = null;
    pair.windowedSeedEligibleReceiptSequence = 0;
    if (!sourceFullScreen && steamBridgeStrictPresentationProtocol) {
      const fallbackInsets = pair.lastStableWindowedInsets ||
        pair.initialContentInsetsCandidate ||
        { top: 0, right: 0 };
      pair.contentInsets = {
        top: fallbackInsets.top,
        right: fallbackInsets.right,
      };
    }
  }
  if (host.fullScreen !== sourceFullScreen) {
    host.fullScreen = sourceFullScreen;
  }
  if (source.minimized) {
    if (hostOpacity > 0 && !pair.restoreHostFocusPending) {
      // Restoring a minimized Wayland owner activates Electron before KWin
      // unmasks its still-opaque Xwayland presenter. Arm one exact handoff;
      // ordinary source/menu/title activation remains untouched.
      pair.restoreHostFocusPending = true;
      pair.restoreHostFocusAttempts = 0;
    }
    // An inactive host is already transparent, input-empty, idle, and absent
    // from the shell. KWin intentionally classifies that skip-taskbar window
    // as non-minimizable. The active Steam surface is minimizable and must
    // follow its owner immediately.
    steamBridgeExcludeHostFromShell(host);
    if (host.active && !host.minimized) {
      host.minimized = true;
    }
  } else {
    if (hostOpacity <= 0) {
      steamBridgeClearRestoreHostFocus(pair);
    }
    if (host.minimized) {
      host.minimized = false;
    }
    // Unminimizing can clear skip-taskbar, so restore the exclusions after it.
    steamBridgeExcludeHostFromShell(host);
  }
  // The source and persistent Xwayland presenter are one logical application.
  // Exactly the currently visible surface owns the Alt+Tab entry: otherwise
  // KWin can cycle from an opaque Steam host onto the covered Electron source,
  // or restore focus to that source while the overlay still needs keyboard
  // input. Taskbar/pager ownership remains with Electron in both states.
  if (!sourceFullScreen) {
    const observedHostGeometry = steamBridgeCopyGeometry(host.frameGeometry);
    const seedSourceBounds = pair.windowedSeedEligibleSourceBounds;
    const seedCommandBounds = presentationCommand.kind === "seed"
      ? presentationCommand.seedBounds
      : null;
    const seedCommandSourceBounds = presentationCommand.kind === "seed"
      ? presentationCommand.sourceBounds
      : null;
    const sourceResizeActive = source.resize === true ||
      (pair.resizeState && pair.resizeState.active === true);
    const seedEdgesMatch = seedSourceBounds !== null &&
      steamBridgeSameGeometry(sourceClientGeometry, seedSourceBounds) &&
      seedCommandSourceBounds !== null &&
      steamBridgeSameGeometry(seedCommandSourceBounds, seedSourceBounds) &&
      seedCommandBounds !== null &&
      Math.abs(seedCommandBounds.x - sourceClientGeometry.x) <=
        KWIN_WAYLAND_GEOMETRY_TOLERANCE &&
      Math.abs(
        (seedCommandBounds.y + seedCommandBounds.height) -
        (sourceClientGeometry.y + sourceClientGeometry.height)
      ) <= KWIN_WAYLAND_GEOMETRY_TOLERANCE;
    if (
      steamBridgeStrictPresentationProtocol &&
      pair.awaitingIndependentWindowedContentInset &&
      seedSourceBounds !== null &&
      seedCommandBounds !== null &&
      presentationCommand.pairGeneration === pair.presentationPairGeneration &&
      presentationCommand.receiptSequence === pair.windowedSeedEligibleReceiptSequence &&
      !sourceResizeActive &&
      seedEdgesMatch
    ) {
      const measuredInsets = steamBridgeMeasureContentInsets(
        seedCommandBounds,
        sourceClientGeometry,
      );
      if (measuredInsets !== undefined) {
        pair.contentInsets = measuredInsets;
        pair.lastStableWindowedInsets = {
          top: measuredInsets.top,
          right: measuredInsets.right,
        };
        pair.awaitingIndependentWindowedContentInset = false;
        pair.windowedSeedEligibleSourceBounds = null;
        pair.windowedSeedEligibleReceiptSequence = 0;
        pair.lastAppliedHostGeometry = null;
      }
    }
    targetGeometry = steamBridgeResolveHostGeometry(
      observedHostGeometry,
      sourceClientGeometry,
      pair.contentInsets,
    );
    if (!steamBridgeSameGeometry(host.frameGeometry, targetGeometry)) {
      pair.lastAppliedHostGeometry = steamBridgeCopyGeometry(targetGeometry);
      host.frameGeometry = targetGeometry;
      pair.lastObservedHostGeometry = steamBridgeCopyGeometry(targetGeometry);
    } else {
      pair.lastObservedHostGeometry = observedHostGeometry;
    }
  } else {
    pair.lastObservedHostGeometry = steamBridgeCopyGeometry(host.frameGeometry);
  }
  steamBridgeNotifyPresentationState(
    pair,
    presentationCommand.epoch,
    sourceFullScreen,
    sourceClientGeometry,
    targetGeometry,
  );
  steamBridgeSyncActiveWindow(pair, hostBecameOpaque, hostBecameTransparent);
  pair.lastHostOpacity = hostOpacity;
}

function steamBridgeSyncAll() {
  if (steamBridgeRetired || steamBridgeSyncing) {
    return;
  }
  steamBridgeSyncing = true;
  try {
    for (const window of workspace.windowList()) {
      if (
        window.pid === steamBridgeExpectedPid &&
        steamBridgeHasHostClass(window)
      ) {
        steamBridgeExcludeHostFromShell(window);
      }
      if (steamBridgeIsHost(window)) {
        steamBridgePairHost(window);
      }
    }
    for (const pair of steamBridgePairs) {
      steamBridgeSyncPair(pair);
    }
    steamBridgeReconcileSwitcherOwnership();
  } finally {
    steamBridgeSyncing = false;
  }
}

function steamBridgeConnectWindow(window) {
  if (
    steamBridgeRetired ||
    window.pid !== steamBridgeExpectedPid ||
    steamBridgeConnectedWindows.indexOf(window) >= 0
  ) {
    return;
  }
  steamBridgeCancelReceiverlessRetirement();
  steamBridgeConnectedWindows.push(window);
  window.frameGeometryChanged.connect(steamBridgeSyncAll);
  window.clientGeometryChanged.connect(steamBridgeSyncAll);
  window.fullScreenChanged.connect(steamBridgeSyncAll);
  window.minimizedChanged.connect(steamBridgeSyncAll);
  window.windowClassChanged.connect(steamBridgeSyncAll);
  window.windowRoleChanged.connect(steamBridgeSyncAll);
  window.opacityChanged.connect(steamBridgeSyncAll);
  window.stackingOrderChanged.connect(steamBridgeSyncAll);
}

function steamBridgeHandleWindowAdded(window) {
  if (steamBridgeRetired) {
    return;
  }
  steamBridgeConnectWindow(window);
  steamBridgeSyncAll();
  steamBridgeUpdateReceiverlessRetirement();
}

function steamBridgeHandleWindowRemoved(window) {
  if (steamBridgeRetired) {
    return;
  }
  for (let index = steamBridgePairs.length - 1; index >= 0; index -= 1) {
    if (steamBridgePairs[index].host === window || steamBridgePairs[index].source === window) {
      steamBridgeReleasePairSource(steamBridgePairs[index]);
      steamBridgePairs.splice(index, 1);
    }
  }
  const connectedIndex = steamBridgeConnectedWindows.indexOf(window);
  if (connectedIndex >= 0) {
    steamBridgeDisconnectWindow(window);
    steamBridgeConnectedWindows.splice(connectedIndex, 1);
  }
  for (let index = steamBridgeSourceResizeStates.length - 1; index >= 0; index -= 1) {
    if (steamBridgeSourceResizeStates[index].source === window) {
      const state = steamBridgeSourceResizeStates[index];
      steamBridgeDisconnectSignal(
        state.source.interactiveMoveResizeStarted,
        state.startedHandler,
      );
      steamBridgeDisconnectSignal(
        state.source.interactiveMoveResizeFinished,
        state.finishedHandler,
      );
      steamBridgeSourceResizeStates.splice(index, 1);
    }
  }
  // The replacement source may already have been added/activated while the
  // sticky preferred source was still alive. Re-pair surviving hosts now;
  // no later compositor signal is guaranteed after the old source disappears.
  steamBridgeSyncAll();
  steamBridgeUpdateReceiverlessRetirement();
}

steamBridgeStartLifecycleWatch();
workspace.windowAdded.connect(steamBridgeHandleWindowAdded);
workspace.windowRemoved.connect(steamBridgeHandleWindowRemoved);
workspace.windowActivated.connect(steamBridgeSyncAll);

for (const window of workspace.windowList()) {
  steamBridgeConnectWindow(window);
}
steamBridgeSyncAll();
`;
}

export function onKWinWaylandOverlaySourceInteractiveResize(
  listener: (event: KWinWaylandOverlaySourceInteractiveResizeEvent) => void
): () => void {
  if (typeof listener !== "function") {
    throw new TypeError("KWin interactive resize listener must be a function");
  }
  const replayEvents = [...kWinResizeEventBySource.values()];
  kWinResizeEventListeners.add(listener);
  try {
    for (const event of replayEvents) {
      listener(event);
    }
  } catch (error) {
    kWinResizeEventListeners.delete(listener);
    throw error;
  }
  ensureKWinWaylandOverlayHostSync();
  return () => {
    kWinResizeEventListeners.delete(listener);
  };
}

export function onKWinWaylandOverlayTransportSafetyRequired(
  listener: (phase: KWinWaylandOverlayTransportSafetyPhase) => boolean
): () => void {
  if (typeof listener !== "function") {
    throw new TypeError("KWin transport safety listener must be a function");
  }
  kWinTransportSafetyListeners.add(listener);
  return () => {
    kWinTransportSafetyListeners.delete(listener);
  };
}

function startKWinResizeEventReceiver(): KWinResizeEventReceiver | undefined {
  try {
    const binding = loadNativeBinding();
    const start = binding.startKWinWaylandOverlayHostSyncEvents;
    if (typeof start !== "function") {
      return undefined;
    }
    kWinResizeEventReceiverGeneration += 1;
    const receiverGeneration = kWinResizeEventReceiverGeneration;
    activeKWinResizeEventReceiverGeneration = receiverGeneration;
    const serviceName = start.call(
      binding,
      kWinResizeEventToken,
      (value: unknown) => {
        if (receiverGeneration === activeKWinResizeEventReceiverGeneration) {
          dispatchKWinOverlayHostSyncEvent(value);
        }
      }
    );
    return serviceName ? { serviceName, token: kWinResizeEventToken } : undefined;
  } catch {
    return undefined;
  }
}

function markKWinResizeEventTransportClosed(): void {
  if (kWinResizeEventTransportClosed) {
    return;
  }
  // Fence the native callback generation before clearing any receipt/resize
  // state. Atomic polling can observe receiver shutdown while same-generation
  // TSFN callbacks are still queued on Node's main thread.
  kWinResizeEventReceiverGeneration += 1;
  activeKWinResizeEventReceiverGeneration = kWinResizeEventReceiverGeneration;
  kWinResizeEventTransportClosed = true;
  kWinDegradedMarkerPending = kWinStrictPresentationScriptLoaded;
  let degradedMarkerUncertain = false;
  let nativeSafetyBinding: NativeBinding | undefined;
  try {
    nativeSafetyBinding = loadNativeBinding();
  } catch {
    // The owning controller may still be able to fail closed. A strict marker
    // transition without a binding cannot be confirmed, though.
    degradedMarkerUncertain =
      kWinStrictPresentationScriptLoaded &&
      kWinHostIdentityMarkerCapabilityReady;
  }

  // Make the old strict surface non-interactive and transparent before the
  // one-way degraded role is visible to KWin. Publishing that role first can
  // let receiverless geometry synchronization run for one visible frame.
  let controllerConfirmedSafety = false;
  for (const listener of [...kWinTransportSafetyListeners]) {
    try {
      controllerConfirmedSafety = listener("park") || controllerConfirmedSafety;
    } catch {
      // The binding-level barrier below remains authoritative.
    }
  }
  if (!controllerConfirmedSafety && nativeSafetyBinding) {
    let failClosedPolicyConfirmed = true;
    try {
      nativeSafetyBinding.setNativeOverlayHostInputPassthrough(true);
    } catch {
      failClosedPolicyConfirmed = false;
    }
    if (failClosedPolicyConfirmed) {
      try {
        nativeSafetyBinding.setNativeOverlayHostOpacity(false);
      } catch {
        failClosedPolicyConfirmed = false;
      }
    }
    if (!failClosedPolicyConfirmed) {
      try {
        nativeSafetyBinding.hideNativeOverlayHostView();
      } catch {
        // The marker stays unconfirmed and every later owner remains held.
      }
    }
  }
  if (
    kWinStrictPresentationScriptLoaded &&
    kWinHostIdentityMarkerCapabilityReady
  ) {
    if (!nativeSafetyBinding) {
      degradedMarkerUncertain = true;
    } else try {
      const binding = nativeSafetyBinding;
      const hostOpen = binding.isNativeOverlayHostViewOpen();
      if (hostOpen === true) {
        const setter = binding.setNativeOverlayHostPresentationTransportClosed;
        if (typeof setter !== "function") {
          degradedMarkerUncertain = true;
        } else {
          setter.call(binding, kWinPresentationInstanceId);
          kWinDegradedMarkerPending = false;
        }
      } else if (hostOpen !== false) {
        degradedMarkerUncertain = true;
      }
    } catch {
      degradedMarkerUncertain = true;
    }
  }
  const staleResizeEvents = [...kWinResizeEventBySource.values()];
  kWinResizeEventBySource.clear();
  // No further receipt can arrive on this transport. Clear its pair-scoped
  // caches now; the global receipt generation stays monotonic for owners that
  // retain a baseline across a later script restart.
  kWinPresentationPairGenerationFloor = Math.max(
    kWinPresentationPairGenerationFloor,
    newestKWinPresentationPairGeneration
  );
  kWinPresentationSequenceByPair.clear();
  kWinInvalidatedPresentationPairs.clear();
  newestKWinPresentationPairGeneration = 0;
  latestKWinPresentationState = undefined;
  if (status.attempted && status.active) {
    const {
      ownershipUncertain: _previousOwnershipUncertain,
      reason: _previousReason,
      ...stableStatus
    } = status;
    status = {
      ...stableStatus,
      interactiveResizeReceiverStarted: false,
      presentationProtocolReady: false,
      // The degraded role is a one-way command for this host lifetime. Never
      // overwrite it with a later state/seed marker before KWin consumes the
      // PropertyNotify edge.
      hostIdentityMarkerReady: false,
      receiverHealth: "closed",
      ...(degradedMarkerUncertain
        ? {
            ownershipUncertain: true,
            reason: "kwin-degraded-marker-unconfirmed" as const
          }
        : { reason: "receiver-closed" as const })
    };
  }
  // The host is already parked. Publish the degraded status, then let the
  // owner replace its strict receipt hold with the two-sample native barrier.
  for (const listener of [...kWinTransportSafetyListeners]) {
    try {
      listener("degraded");
    } catch {
      // The already-inert host remains safe if its owner is tearing down.
    }
  }
  // Publish synthetic inactive edges only after the status and receipt caches
  // are degraded. A reentrant listener must never observe strict readiness
  // from the already-dead transport.
  for (const previous of staleResizeEvents) {
    const invalidated = Object.freeze({
      sourceId: previous.sourceId,
      sequence: previous.sequence < Number.MAX_SAFE_INTEGER
        ? previous.sequence + 1
        : previous.sequence,
      paired: false,
      active: false
    });
    for (const listener of [...kWinResizeEventListeners]) {
      try {
        listener(invalidated);
      } catch (error) {
        console.error("Steam Bridge KWin interactive resize listener failed:", error);
      }
    }
  }
}

interface NativeKWinPresentationProtocolCapability {
  version?: number;
  markerMethodsPresent: boolean;
}

function readNativeKWinPresentationProtocolCapability():
  NativeKWinPresentationProtocolCapability {
  try {
    const binding = loadNativeBinding();
    const readVersion = binding.getKWinWaylandOverlayPresentationProtocolVersion;
    const reportedVersion = typeof readVersion === "function"
      ? readVersion.call(binding)
      : undefined;
    const version = typeof reportedVersion === "number" &&
      Number.isSafeInteger(reportedVersion) &&
      reportedVersion >= 0
      ? reportedVersion
      : undefined;
    return {
      ...(version !== undefined ? { version } : {}),
      markerMethodsPresent:
      typeof binding.setNativeOverlayHostPresentationEpoch === "function" &&
      typeof binding.setNativeOverlayHostPresentationTransportClosed === "function" &&
      typeof binding.setNativeOverlayHostContentSeed === "function"
    };
  } catch {
    return { markerMethodsPresent: false };
  }
}

function stopKWinResizeEventReceiver(): void {
  // Fence the callback before asking the native runtime to stop. A queued
  // event from this generation must not mutate a replacement transport.
  kWinResizeEventReceiverGeneration += 1;
  activeKWinResizeEventReceiverGeneration = kWinResizeEventReceiverGeneration;
  try {
    const binding = loadNativeBinding();
    binding.stopKWinWaylandOverlayHostSyncEvents?.();
  } catch {
    // Mixed native builds and process teardown are best-effort.
  }
}

function isKWinResizeEventReceiverRunning(): boolean {
  try {
    const binding = loadNativeBinding();
    const isRunning = binding.isKWinWaylandOverlayHostSyncEventsRunning;
    return typeof isRunning === "function" && isRunning.call(binding) === true;
  } catch {
    return false;
  }
}

function dispatchKWinOverlayHostSyncEvent(value: unknown): void {
  try {
    const kind = value && typeof value === "object"
      ? Reflect.get(value, "kind")
      : undefined;
    if (kind === "presentationState") {
      dispatchKWinPresentationState(value);
      return;
    }
    if (kind === "presentationStateInvalidated") {
      dispatchKWinPresentationInvalidation(value);
      return;
    }
    if (kind === "transportClosed") {
      markKWinResizeEventTransportClosed();
      return;
    }
    // Older native builds did not tag resize events. Preserve that internal
    // wire compatibility while rejecting unknown tagged event families.
    if (kind === undefined || kind === "resizeState") {
      dispatchKWinResizeEvent(value);
    }
  } catch {
    // Treat proxy/getter failures like any other malformed native payload.
  }
}

function readKWinPresentationGeometry(
  value: unknown
): Readonly<KWinWaylandOverlayGeometry> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const x = Reflect.get(value, "x");
  const y = Reflect.get(value, "y");
  const width = Reflect.get(value, "width");
  const height = Reflect.get(value, "height");
  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    x < MIN_KWIN_WAYLAND_GEOMETRY_COORDINATE ||
    x > MAX_KWIN_WAYLAND_GEOMETRY_COORDINATE ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    y < MIN_KWIN_WAYLAND_GEOMETRY_COORDINATE ||
    y > MAX_KWIN_WAYLAND_GEOMETRY_COORDINATE ||
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width <= 0 ||
    width > MAX_KWIN_WAYLAND_GEOMETRY_SIZE ||
    typeof height !== "number" ||
    !Number.isFinite(height) ||
    height <= 0 ||
    height > MAX_KWIN_WAYLAND_GEOMETRY_SIZE
  ) {
    return undefined;
  }
  return Object.freeze({ x, y, width, height });
}

function readKWinPresentationPairGeneration(pairId: string): number | undefined {
  const prefix = `${kWinResizeEventToken}:`;
  if (!pairId.startsWith(prefix)) {
    return undefined;
  }
  const value = pairId.slice(prefix.length);
  if (!/^[1-9][0-9]*$/.test(value)) {
    return undefined;
  }
  const generation = Number(value);
  return Number.isSafeInteger(generation) &&
    generation <= MAX_KWIN_WAYLAND_PRESENTATION_EPOCH
    ? generation
    : undefined;
}

function dispatchKWinPresentationState(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }
  const pairId = Reflect.get(value, "pairId");
  const sequence = Reflect.get(value, "sequence");
  const epoch = Reflect.get(value, "epoch");
  const fullScreen = Reflect.get(value, "fullScreen");
  if (
    typeof pairId !== "string" ||
    pairId.length === 0 ||
    pairId.length > 128 ||
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    sequence > MAX_KWIN_WAYLAND_PRESENTATION_EPOCH ||
    typeof epoch !== "number" ||
    !Number.isSafeInteger(epoch) ||
    epoch < 0 ||
    epoch > MAX_KWIN_WAYLAND_PRESENTATION_EPOCH ||
    typeof fullScreen !== "boolean"
  ) {
    return;
  }
  const pairGeneration = readKWinPresentationPairGeneration(pairId);
  if (
    pairGeneration === undefined ||
    pairGeneration < newestKWinPresentationPairGeneration
  ) {
    return;
  }
  const sourceBounds = readKWinPresentationGeometry(Reflect.get(value, "sourceBounds"));
  const target = readKWinPresentationGeometry(Reflect.get(value, "target"));
  if (!sourceBounds || !target) {
    return;
  }
  const previousSequence = kWinPresentationSequenceByPair.get(pairId);
  if (
    kWinInvalidatedPresentationPairs.has(pairId) ||
    (previousSequence !== undefined && sequence <= previousSequence) ||
    kWinPresentationReceiptGeneration >= Number.MAX_SAFE_INTEGER
  ) {
    return;
  }
  newestKWinPresentationPairGeneration = pairGeneration;
  kWinPresentationPairGenerationFloor = Math.max(
    kWinPresentationPairGenerationFloor,
    pairGeneration
  );
  kWinPresentationSequenceByPair.set(pairId, sequence);
  kWinPresentationReceiptGeneration += 1;
  latestKWinPresentationState = Object.freeze({
    kind: "converged",
    generation: kWinPresentationReceiptGeneration,
    pairId,
    pairGeneration,
    sequence,
    epoch,
    fullScreen,
    sourceBounds,
    target,
  });
}

function dispatchKWinPresentationInvalidation(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }
  const pairId = Reflect.get(value, "pairId");
  const sequence = Reflect.get(value, "sequence");
  if (
    typeof pairId !== "string" ||
    pairId.length === 0 ||
    pairId.length > 128 ||
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    sequence > MAX_KWIN_WAYLAND_PRESENTATION_EPOCH
  ) {
    return;
  }
  const pairGeneration = readKWinPresentationPairGeneration(pairId);
  if (
    pairGeneration === undefined ||
    pairGeneration < newestKWinPresentationPairGeneration ||
    kWinPresentationReceiptGeneration >= Number.MAX_SAFE_INTEGER
  ) {
    return;
  }
  const previousSequence = kWinPresentationSequenceByPair.get(pairId);
  if (
    kWinInvalidatedPresentationPairs.has(pairId) ||
    (previousSequence !== undefined && sequence <= previousSequence)
  ) {
    return;
  }
  newestKWinPresentationPairGeneration = pairGeneration;
  kWinPresentationPairGenerationFloor = Math.max(
    kWinPresentationPairGenerationFloor,
    pairGeneration
  );
  kWinPresentationSequenceByPair.set(pairId, sequence);
  kWinInvalidatedPresentationPairs.add(pairId);
  kWinPresentationReceiptGeneration += 1;
  latestKWinPresentationState = Object.freeze({
    kind: "invalidated",
    generation: kWinPresentationReceiptGeneration,
    pairId,
    pairGeneration,
    sequence,
  });
}

function dispatchKWinResizeEvent(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }
  const sourceId = Reflect.get(value, "sourceId");
  const sequence = Reflect.get(value, "sequence");
  const paired = Reflect.get(value, "paired");
  const active = Reflect.get(value, "active");
  if (
    typeof sourceId !== "string" ||
    sourceId.length === 0 ||
    sourceId.length > 128 ||
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    typeof paired !== "boolean" ||
    (active === true && paired === false) ||
    typeof active !== "boolean"
  ) {
    return;
  }
  const previous = kWinResizeEventBySource.get(sourceId);
  if (previous && sequence <= previous.sequence) {
    return;
  }
  const event = Object.freeze({ sourceId, sequence, paired, active });
  if (paired) {
    kWinResizeEventBySource.set(sourceId, event);
  } else {
    kWinResizeEventBySource.delete(sourceId);
  }
  if (previous?.paired === paired && previous.active === active) {
    return;
  }
  for (const listener of [...kWinResizeEventListeners]) {
    try {
      listener(event);
    } catch (error) {
      console.error("Steam Bridge KWin interactive resize listener failed:", error);
    }
  }
}

export function getKWinWaylandOverlayPresentationState():
  KWinWaylandOverlayPresentationState | undefined {
  return latestKWinPresentationState;
}

export function getKWinWaylandOverlayPresentationInstanceId(): string {
  return kWinPresentationInstanceId;
}

export function isKWinWaylandOverlayStrictPresentationScriptLoaded(): boolean {
  getKWinWaylandOverlayHostSyncStatus();
  return status.active && kWinStrictPresentationScriptLoaded;
}

export function isKWinWaylandOverlaySourceInteractiveResizeActive(): boolean {
  for (const event of kWinResizeEventBySource.values()) {
    if (event.paired && event.active) {
      return true;
    }
  }
  return false;
}

let status: KWinWaylandOverlayHostSyncStatus = {
  attempted: false,
  active: false
};

export type KWinWaylandPresentationMarkerWriteResult =
  | "strict"
  | "degraded"
  | "blocked"
  | "unmanaged";

function setKWinDegradedMarkerPublicationStatus(confirmed: boolean): void {
  const {
    ownershipUncertain: _previousOwnershipUncertain,
    reason: _previousReason,
    ...stableStatus
  } = status;
  status = {
    ...stableStatus,
    interactiveResizeReceiverStarted: false,
    presentationProtocolReady: false,
    hostIdentityMarkerReady: false,
    receiverHealth: "closed",
    ...(confirmed
      ? { reason: "receiver-closed" as const }
      : {
          ownershipUncertain: true,
          reason: "kwin-degraded-marker-unconfirmed" as const
        })
  };
}

function acceptKWinDegradedMarkerPublication(): void {
  // A transport-aware native epoch/seed setter can discover closure before
  // JavaScript observes its TSFN event. Run the normal close path first so its
  // receipt/resize caches and listeners are invalidated in the same order.
  if (!kWinResizeEventTransportClosed) {
    markKWinResizeEventTransportClosed();
  }
  kWinDegradedMarkerPending = false;
  setKWinDegradedMarkerPublicationStatus(true);
}

function publishPendingKWinDegradedMarker(
  binding: NativeBinding
): KWinWaylandPresentationMarkerWriteResult {
  if (!kWinStrictPresentationScriptLoaded) {
    return "degraded";
  }
  if (!status.active) {
    return "unmanaged";
  }
  const setter = binding.setNativeOverlayHostPresentationTransportClosed;
  if (typeof setter !== "function") {
    kWinDegradedMarkerPending = true;
    setKWinDegradedMarkerPublicationStatus(false);
    return "blocked";
  }
  try {
    if (binding.isNativeOverlayHostViewOpen() !== true) {
      kWinDegradedMarkerPending = true;
      setKWinDegradedMarkerPublicationStatus(false);
      return "blocked";
    }
    setter.call(binding, kWinPresentationInstanceId);
    acceptKWinDegradedMarkerPublication();
    return "degraded";
  } catch {
    kWinDegradedMarkerPending = true;
    setKWinDegradedMarkerPublicationStatus(false);
    return "blocked";
  }
}

/**
 * Route an X11 role write against receiver health at the actual write edge.
 * A strict native setter returns false when its final native-side health check
 * atomically substitutes the one-way degraded marker for state/seed.
 */
export function writeKWinWaylandOverlayHostPresentationMarker(
  binding: NativeBinding,
  writeStrictMarker: (instanceId: string) => boolean | void
): KWinWaylandPresentationMarkerWriteResult {
  const current = getKWinWaylandOverlayHostSyncStatus();
  if (!current.active) {
    return "unmanaged";
  }
  if (!kWinStrictPresentationScriptLoaded) {
    return "degraded";
  }
  if (
    current.ownershipUncertain === true &&
    current.reason !== "kwin-degraded-marker-unconfirmed"
  ) {
    return "blocked";
  }
  try {
    if (binding.isNativeOverlayHostViewOpen() !== true) {
      kWinDegradedMarkerPending = true;
      setKWinDegradedMarkerPublicationStatus(false);
      return "blocked";
    }
  } catch {
    kWinDegradedMarkerPending = true;
    setKWinDegradedMarkerPublicationStatus(false);
    return "blocked";
  }
  if (
    current.presentationProtocolReady !== true ||
    current.receiverHealth !== "active" ||
    kWinDegradedMarkerPending
  ) {
    return publishPendingKWinDegradedMarker(binding);
  }

  try {
    const nativeWriteResult = writeStrictMarker(kWinPresentationInstanceId);
    if (nativeWriteResult === false) {
      acceptKWinDegradedMarkerPublication();
      return "degraded";
    }
  } catch (error) {
    const afterFailure = getKWinWaylandOverlayHostSyncStatus();
    if (
      afterFailure.presentationProtocolReady !== true ||
      afterFailure.receiverHealth !== "active"
    ) {
      return publishPendingKWinDegradedMarker(binding);
    }
    throw error;
  }

  // Fence a close that raced the native marker call itself. Native also checks
  // health immediately before writing, while this second read guarantees that
  // a close immediately afterward queues degraded as the final role marker.
  const afterWrite = getKWinWaylandOverlayHostSyncStatus();
  return afterWrite.presentationProtocolReady === true &&
    afterWrite.receiverHealth === "active"
    ? "strict"
    : publishPendingKWinDegradedMarker(binding);
}

function publishKWinScriptRetirementUnconfirmed(
  command: "qdbus6" | "qdbus" | undefined,
  capability: NativeKWinPresentationProtocolCapability =
    readNativeKWinPresentationProtocolCapability()
): KWinWaylandOverlayHostSyncStatus {
  stopKWinResizeEventReceiver();
  kWinResizeEventTransportClosed = true;
  const presentationProtocolVersion = capability.version;
  status = {
    attempted: true,
    active: true,
    ...(command ? { command } : {}),
    interactiveResizeReceiverStarted: false,
    presentationProtocolReady: false,
    hostIdentityMarkerReady:
      presentationProtocolVersion === KWIN_WAYLAND_PRESENTATION_PROTOCOL_VERSION &&
      capability.markerMethodsPresent,
    receiverHealth: "closed",
    ownershipUncertain: true,
    reason: "kwin-script-retirement-unconfirmed",
    ...(presentationProtocolVersion !== undefined
      ? { presentationProtocolVersion }
      : {})
  };
  if (command) {
    installKWinOverlayHostSyncProcessCleanup(command);
  }
  return status;
}

export function ensureKWinWaylandOverlayHostSync(): KWinWaylandOverlayHostSyncStatus {
  if (!isMainThread) {
    status = {
      attempted: true,
      active: true,
      interactiveResizeReceiverStarted: false,
      presentationProtocolReady: false,
      hostIdentityMarkerReady: false,
      receiverHealth: "closed",
      ownershipUncertain: true,
      reason: "kwin-controller-not-main-thread"
    };
    return status;
  }
  if (!claimKWinProcessControllerOwnership()) {
    status = {
      attempted: true,
      active: true,
      interactiveResizeReceiverStarted: false,
      presentationProtocolReady: false,
      hostIdentityMarkerReady: false,
      receiverHealth: "closed",
      ownershipUncertain: true,
      reason: "kwin-controller-owned-by-another-copy"
    };
    return status;
  }
  if (status.attempted) {
    // Generic capability/status callers must never recycle a script while a
    // native host may still be mapped. Lease reconciliation is deliberately
    // restricted to ensureFreshKWinWaylandOverlayHostSyncLease(), which the
    // attach path calls only after proving that no native host is open.
    if (
      status.active &&
      status.interactiveResizeReceiverStarted === true &&
      !isKWinResizeEventReceiverRunning()
    ) {
      markKWinResizeEventTransportClosed();
    }
    return status;
  }
  if (!isKdeWaylandSession()) {
    status = { attempted: true, active: false, reason: "not-kde-wayland" };
    return status;
  }

  // A first capability check is allowed after raw native-host use. It is not
  // allowed to unload the fixed per-PID KWin writer beneath that live window.
  // Require a literal no-host proof before any D-Bus mutation or receiver start.
  try {
    if (loadNativeBinding().isNativeOverlayHostViewOpen() !== false) {
      status = {
        attempted: true,
        active: true,
        interactiveResizeReceiverStarted: false,
        presentationProtocolReady: false,
        hostIdentityMarkerReady: false,
        receiverHealth: "closed",
        ownershipUncertain: true,
        reason: "kwin-script-retirement-unconfirmed"
      };
      return status;
    }
  } catch {
    status = {
      attempted: true,
      active: true,
      interactiveResizeReceiverStarted: false,
      presentationProtocolReady: false,
      hostIdentityMarkerReady: false,
      receiverHealth: "closed",
      ownershipUncertain: true,
      reason: "kwin-script-retirement-unconfirmed"
    };
    return status;
  }

  const presentationCapability = readNativeKWinPresentationProtocolCapability();
  const presentationProtocolVersion = presentationCapability.version;
  const hostIdentityMarkerReady =
    presentationProtocolVersion === KWIN_WAYLAND_PRESENTATION_PROTOCOL_VERSION &&
      presentationCapability.markerMethodsPresent;
  const publishUnconfirmedRetirement = (
    command?: "qdbus6" | "qdbus"
  ): KWinWaylandOverlayHostSyncStatus =>
    publishKWinScriptRetirementUnconfirmed(command, presentationCapability);

  const availableCommands: Array<"qdbus6" | "qdbus"> = [];
  let unconfirmedCommand: "qdbus6" | "qdbus" | undefined;
  for (const command of ["qdbus6", "qdbus"] as const) {
    const existingScriptLoaded = isKWinScriptLoaded(command);
    if (existingScriptLoaded === undefined) {
      continue;
    }
    if (existingScriptLoaded && !unloadKWinScriptAndWait(command)) {
      unconfirmedCommand ??= command;
      continue;
    }
    availableCommands.push(command);
  }
  if (availableCommands.length === 0) {
    return publishUnconfirmedRetirement(unconfirmedCommand);
  }

  resetKWinTransportAttemptIdentity();
  kWinHostIdentityMarkerCapabilityReady = hostIdentityMarkerReady;
  kWinResizeEventTransportClosed = false;
  const resizeEvents = startKWinResizeEventReceiver();
  const receiverHealthy =
    resizeEvents !== undefined &&
    !kWinResizeEventTransportClosed &&
    isKWinResizeEventReceiverRunning();
  const presentationProtocolReady =
    receiverHealthy &&
    presentationProtocolVersion === KWIN_WAYLAND_PRESENTATION_PROTOCOL_VERSION &&
    presentationCapability.markerMethodsPresent;
  const syncScript = createKWinOverlayHostSyncScript(
    receiverHealthy ? resizeEvents : undefined,
    presentationProtocolReady
  );

  const scriptPath = path.join(
    process.env.XDG_RUNTIME_DIR?.trim() || os.tmpdir(),
    `${KWIN_SCRIPT_NAME}-${process.pid}-${randomUUID()}.js`
  );
  try {
    fs.writeFileSync(scriptPath, syncScript, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
  } catch {
    stopKWinResizeEventReceiver();
    status = { attempted: true, active: false, reason: "runtime-file-unavailable" };
    return status;
  }

  try {
    const retirePotentiallyLoadedScript = (
      command: "qdbus6" | "qdbus"
    ): KWinWaylandOverlayHostSyncStatus | undefined => {
      const retirement = retireKWinScriptWithClientFallback(command);
      return retirement.confirmed
        ? undefined
        : publishUnconfirmedRetirement(retirement.unconfirmedCommand ?? command);
    };

    for (const command of availableCommands) {
      const baselineResult = runKWinDbus(command, []);
      if (!baselineResult.ok) {
        continue;
      }
      const baselinePaths = parseKWinScriptObjectPaths(baselineResult.stdout);

      const loaded = runKWinDbus(command, [
        "/Scripting",
        "org.kde.kwin.Scripting.loadScript",
        scriptPath,
        KWIN_SCRIPT_NAME
      ]);
      const scriptId = loaded.ok ? parseKWinScriptId(loaded.stdout) : undefined;
      if (scriptId === undefined) {
        // loadScript may have registered the fixed-name script even when its
        // returned object id is malformed. We cannot safely address an object
        // path, but we still own the fixed name and must retire it before
        // trying another D-Bus client or abandoning startup.
        const uncertain = retirePotentiallyLoadedScript(command);
        if (uncertain) {
          return uncertain;
        }
        continue;
      }

      const scriptObjectPath = `/Scripting/Script${scriptId}`;
      // A returned object path that existed before this load cannot safely be
      // assumed to belong to Steam Bridge. In particular, never run or stop a
      // path that may be another client's persistent KWin script.
      if (baselinePaths.has(scriptObjectPath)) {
        const uncertain = retirePotentiallyLoadedScript(command);
        if (uncertain) {
          return uncertain;
        }
        continue;
      }

      const introspection = runKWinDbus(command, [scriptObjectPath]);
      if (!introspection.ok || !hasKWinScriptRunMethod(introspection.stdout)) {
        const uncertain = retirePotentiallyLoadedScript(command);
        if (uncertain) {
          return uncertain;
        }
        continue;
      }

      // Script.run is synchronous over D-Bus. Keep the source file alive until
      // it returns so KWin cannot race our runtime-file cleanup while reading
      // and evaluating the script.
      const started = runKWinDbus(
        command,
        [scriptObjectPath, "org.kde.kwin.Script.run"],
        KWIN_SCRIPT_RUN_TIMEOUT_MS
      );
      if (started.ok) {
        const loadedAfterRun = isKWinScriptLoaded(command);
        if (loadedAfterRun !== true) {
          if (loadedAfterRun === undefined) {
            const uncertain = retirePotentiallyLoadedScript(command);
            if (uncertain) {
              return uncertain;
            }
          }
          // KWin can acknowledge Script.run even when evaluating the file
          // throws and schedules the script for deletion. A separate loaded
          // query catches that failure before we publish a geometry owner.
          continue;
        }
        if (receiverHealthy && !isKWinResizeEventReceiverRunning()) {
          kWinStrictPresentationScriptLoaded = presentationProtocolReady;
          kWinDegradedMarkerPending = presentationProtocolReady;
          markKWinResizeEventTransportClosed();
        }
        kWinStrictPresentationScriptLoaded = presentationProtocolReady;
        kWinDegradedMarkerPending =
          presentationProtocolReady && kWinResizeEventTransportClosed;
        status = {
          attempted: true,
          active: true,
          command,
          interactiveResizeReceiverStarted:
            receiverHealthy && !kWinResizeEventTransportClosed,
          presentationProtocolReady:
            presentationProtocolReady && !kWinResizeEventTransportClosed,
          hostIdentityMarkerReady:
            hostIdentityMarkerReady && !kWinResizeEventTransportClosed,
          receiverHealth: kWinResizeEventTransportClosed
            ? "closed"
            : receiverHealthy
              ? "active"
              : "unavailable",
          ...(presentationProtocolVersion !== undefined
            ? { presentationProtocolVersion }
            : {}),
          ...(kWinResizeEventTransportClosed
            ? { receiverHealth: "closed" as const, reason: "receiver-closed" as const }
            : {})
        };
        installKWinOverlayHostSyncProcessCleanup(command);
        return status;
      }
      const uncertain = retirePotentiallyLoadedScript(command);
      if (uncertain) {
        return uncertain;
      }
    }
  } finally {
    try {
      fs.rmSync(scriptPath, { force: true });
    } catch {
      // XDG_RUNTIME_DIR is session-scoped, so a failed best-effort cleanup is bounded.
    }
  }

  stopKWinResizeEventReceiver();
  status = { attempted: true, active: false, reason: "kwin-dbus-unavailable" };
  return status;
}

/**
 * Reconcile a receiverless or uncertain KWin script immediately before a new
 * standalone native host is attached. The binding check is intentional: this
 * function must never unload KWin's sole geometry writer while a host is live.
 */
export function ensureFreshKWinWaylandOverlayHostSyncLease():
  KWinWaylandOverlayHostSyncStatus {
  const wasAttempted = status.attempted;
  ensureKWinWaylandOverlayHostSync();
  const current = getKWinWaylandOverlayHostSyncStatus();
  if (!current.active) {
    return current;
  }
  if (
    current.reason === "kwin-controller-owned-by-another-copy" ||
    current.reason === "kwin-controller-not-main-thread"
  ) {
    // An unowned/uncertain controller may not even query the process-global
    // native host, much less recycle the fixed KWin script or receiver.
    return current;
  }

  try {
    const binding = loadNativeBinding();
    if (binding.isNativeOverlayHostViewOpen() !== false) {
      return {
        ...current,
        presentationProtocolReady: false,
        ownershipUncertain: true,
        reason: "kwin-script-retirement-unconfirmed"
      };
    }
  } catch {
    // Without a trustworthy no-host proof, preserve the current sole writer.
    return {
      ...current,
      presentationProtocolReady: false,
      ownershipUncertain: true,
      reason: "kwin-script-retirement-unconfirmed"
    };
  }

  if (wasAttempted === false && current.ownershipUncertain !== true) {
    // The initial ensure immediately above already performed absence preflight,
    // receiver startup, script load, and synchronous Script.run completion.
    return current;
  }

  const commands = [current.command, "qdbus6", "qdbus"].filter(
    (command, index, values): command is "qdbus6" | "qdbus" =>
      command !== undefined && values.indexOf(command) === index
  );
  let unconfirmedCommand: "qdbus6" | "qdbus" | undefined;
  let restartFromConfirmedAbsence = false;
  for (const command of commands) {
    const loaded = isKWinScriptLoaded(command);
    if (loaded === undefined) {
      continue;
    }
    if (loaded === false) {
      restartFromConfirmedAbsence = true;
      break;
    }
    if (unloadKWinScriptAndWait(command)) {
      restartFromConfirmedAbsence = true;
      break;
    }
    unconfirmedCommand ??= command;
  }
  if (!restartFromConfirmedAbsence) {
    return publishKWinScriptRetirementUnconfirmed(
      unconfirmedCommand ?? current.command
    );
  }

  // Exact absence is now proven. Fence callbacks from the previous receiver,
  // rotate its authentication token, and establish a fresh script lease before
  // the new native host can be created or mapped.
  stopKWinResizeEventReceiver();
  kWinResizeEventTransportClosed = false;
  status = { attempted: false, active: false };
  return ensureKWinWaylandOverlayHostSync();
}

export function getKWinWaylandOverlayHostSyncStatus(): KWinWaylandOverlayHostSyncStatus {
  if (
    status.active &&
    status.interactiveResizeReceiverStarted === true &&
    !isKWinResizeEventReceiverRunning()
  ) {
    markKWinResizeEventTransportClosed();
  }
  return status;
}

function isKdeWaylandSession(): boolean {
  if (
    process.platform !== "linux" ||
    process.env.XDG_SESSION_TYPE?.trim().toLowerCase() !== "wayland" ||
    !process.env.WAYLAND_DISPLAY?.trim()
  ) {
    return false;
  }
  if (process.env.KDE_FULL_SESSION?.trim().toLowerCase() === "true") {
    return true;
  }
  return (process.env.XDG_CURRENT_DESKTOP || "")
    .split(":")
    .some((desktop) => desktop.trim().toLowerCase() === "kde");
}

interface KWinDbusResult {
  ok: boolean;
  stdout: string;
}

function runKWinDbus(
  command: "qdbus6" | "qdbus",
  args: string[],
  timeout = KWIN_DBUS_TIMEOUT_MS
): KWinDbusResult {
  const result = spawnSync(
    command,
    ["org.kde.KWin", ...args],
    { encoding: "utf8", timeout, windowsHide: true }
  );
  return {
    ok: result.status === 0 && !result.error,
    stdout: typeof result.stdout === "string" ? result.stdout : ""
  };
}

function unloadKWinScriptAndWait(command: "qdbus6" | "qdbus"): boolean {
  const unloaded = runKWinDbus(command, [
    "/Scripting",
    "org.kde.kwin.Scripting.unloadScript",
    KWIN_SCRIPT_NAME
  ]);
  if (!unloaded.ok) {
    return false;
  }
  for (let attempt = 0; attempt < KWIN_UNLOAD_POLL_ATTEMPTS; attempt += 1) {
    const loaded = runKWinDbus(command, [
      "/Scripting",
      "org.kde.kwin.Scripting.isScriptLoaded",
      KWIN_SCRIPT_NAME
    ]);
    if (!loaded.ok) {
      return false;
    }
    const isLoaded = parseKWinDbusBoolean(loaded.stdout);
    if (isLoaded === false) {
      return true;
    }
    if (isLoaded === undefined) {
      return false;
    }
  }
  return false;
}

function retireKWinScriptWithClientFallback(
  preferred: "qdbus6" | "qdbus"
): {
  confirmed: boolean;
  unconfirmedCommand?: "qdbus6" | "qdbus";
} {
  const commands = [preferred, preferred === "qdbus6" ? "qdbus" : "qdbus6"] as const;
  let unconfirmedCommand: "qdbus6" | "qdbus" | undefined;
  for (const command of commands) {
    const loaded = isKWinScriptLoaded(command);
    if (loaded === false) {
      return { confirmed: true };
    }
    if (loaded === true) {
      if (unloadKWinScriptAndWait(command)) {
        return { confirmed: true };
      }
      unconfirmedCommand ??= command;
    }
  }
  return {
    confirmed: false,
    ...(unconfirmedCommand ? { unconfirmedCommand } : {})
  };
}

function isKWinScriptLoaded(command: "qdbus6" | "qdbus"): boolean | undefined {
  const loaded = runKWinDbus(command, [
    "/Scripting",
    "org.kde.kwin.Scripting.isScriptLoaded",
    KWIN_SCRIPT_NAME
  ]);
  return loaded.ok ? parseKWinDbusBoolean(loaded.stdout) : undefined;
}

interface KWinProcessCleanupRegistry {
  listenerInstalled: boolean;
  cleanup?: () => void;
}

function installKWinOverlayHostSyncProcessCleanup(
  command: "qdbus6" | "qdbus"
): void {
  let registry = Reflect.get(process, KWIN_PROCESS_CLEANUP_REGISTRY) as
    KWinProcessCleanupRegistry | undefined;
  if (!registry) {
    registry = { listenerInstalled: false };
    Reflect.set(process, KWIN_PROCESS_CLEANUP_REGISTRY, registry);
  }
  if (!registry.listenerInstalled) {
    registry.listenerInstalled = true;
    process.once("exit", () => {
      const current = Reflect.get(process, KWIN_PROCESS_CLEANUP_REGISTRY) as
        KWinProcessCleanupRegistry | undefined;
      const cleanup = current?.cleanup;
      if (current) {
        current.cleanup = undefined;
      }
      cleanup?.();
    });
  }
  let cleaned = false;
  registry.cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    // Stop first so the in-script owner heartbeat can also retire us. Process
    // exit must remain bounded even when KWin or the session bus is sick: make
    // one short exact-name unload attempt and never enter the startup poll loop.
    stopKWinResizeEventReceiver();
    runKWinDbus(
      command,
      [
        "/Scripting",
        "org.kde.kwin.Scripting.unloadScript",
        KWIN_SCRIPT_NAME
      ],
      KWIN_EXIT_UNLOAD_TIMEOUT_MS
    );
  };
}

function parseKWinDbusBoolean(stdout: string): boolean | undefined {
  const value = stdout.trim().toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function parseKWinScriptObjectPaths(stdout: string): Set<string> {
  return new Set(
    stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\/Scripting\/Script[0-9]+$/.test(line))
  );
}

function parseKWinScriptId(stdout: string): number | undefined {
  const value = stdout.trim();
  if (!/^[0-9]+$/.test(value)) {
    return undefined;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

function hasKWinScriptRunMethod(stdout: string): boolean {
  return /^\s*method\s+\S+\s+org\.kde\.kwin\.Script\.run(?:\(\))?\s*$/m.test(stdout);
}
