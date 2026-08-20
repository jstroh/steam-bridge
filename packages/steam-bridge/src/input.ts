import type { ElectronSteamInputFrame } from "./electron";
import type { SteamInputDefinition } from "./index";

export const STEAM_BRIDGE_INPUT_API_VERSION = 1 as const;

export type SteamBridgeInputSource =
  | "keyboard"
  | "pointer"
  | "touch"
  | "pen"
  | "gamepad"
  | "steam-input"
  | null;

export interface SteamBridgeInputModifiers {
  readonly alt: boolean;
  readonly control: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
}

export interface SteamBridgeKeySnapshot {
  readonly code: string;
  readonly key: string;
  readonly location: number;
}

export interface SteamBridgePointerSnapshot {
  readonly pointerId: number;
  readonly pointerType: "mouse" | "touch" | "pen";
  readonly primary: boolean;
  readonly x: number;
  readonly y: number;
  readonly buttons: number;
  readonly pressure: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist: number;
}

export interface SteamBridgeGamepadButtonSnapshot {
  readonly pressed: boolean;
  readonly touched: boolean;
  readonly value: number;
}

export interface SteamBridgeGamepadStickSnapshot {
  readonly x: number;
  readonly y: number;
  /** `standard` is guaranteed by W3C; `heuristic` is Bridge-normalized raw hardware ordering. */
  readonly source: "standard" | "heuristic";
}

export interface SteamBridgeGamepadTouchSnapshot {
  readonly touchId: number;
  readonly surfaceId: number;
  readonly position: readonly [number, number];
  readonly surfaceDimensions?: readonly [number, number];
}

export interface SteamBridgeGamepadControlsSnapshot {
  readonly source: "standard" | "heuristic";
  readonly leftStick: SteamBridgeGamepadStickSnapshot | null;
  readonly rightStick: SteamBridgeGamepadStickSnapshot | null;
  readonly faceSouth: SteamBridgeGamepadButtonSnapshot | null;
  readonly faceEast: SteamBridgeGamepadButtonSnapshot | null;
  readonly faceWest: SteamBridgeGamepadButtonSnapshot | null;
  readonly faceNorth: SteamBridgeGamepadButtonSnapshot | null;
  readonly leftBumper: SteamBridgeGamepadButtonSnapshot | null;
  readonly rightBumper: SteamBridgeGamepadButtonSnapshot | null;
  readonly leftTrigger: SteamBridgeGamepadButtonSnapshot | null;
  readonly rightTrigger: SteamBridgeGamepadButtonSnapshot | null;
  readonly view: SteamBridgeGamepadButtonSnapshot | null;
  readonly menu: SteamBridgeGamepadButtonSnapshot | null;
  readonly leftStickPress: SteamBridgeGamepadButtonSnapshot | null;
  readonly rightStickPress: SteamBridgeGamepadButtonSnapshot | null;
  readonly dpadUp: SteamBridgeGamepadButtonSnapshot | null;
  readonly dpadDown: SteamBridgeGamepadButtonSnapshot | null;
  readonly dpadLeft: SteamBridgeGamepadButtonSnapshot | null;
  readonly dpadRight: SteamBridgeGamepadButtonSnapshot | null;
  readonly home: SteamBridgeGamepadButtonSnapshot | null;
  readonly touchpad: SteamBridgeGamepadButtonSnapshot | null;
}

export interface SteamBridgeGamepadSnapshot {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: true;
  readonly timestamp: number;
  /** Position-based controls. Apps never need raw axis/button indexes or model tables. */
  readonly controls: SteamBridgeGamepadControlsSnapshot;
  readonly axes: readonly number[];
  readonly buttons: readonly SteamBridgeGamepadButtonSnapshot[];
  readonly touches: readonly SteamBridgeGamepadTouchSnapshot[];
}

export type SteamBridgeInputEvent =
  | {
      readonly type: "key-down" | "key-up";
      readonly capturedAtMs: number;
      readonly code: string;
      readonly key: string;
      readonly location: number;
      readonly repeat: boolean;
      readonly composing: boolean;
      readonly modifiers: SteamBridgeInputModifiers;
    }
  | {
      readonly type: "pointer-down" | "pointer-up" | "pointer-move" | "pointer-cancel";
      readonly capturedAtMs: number;
      readonly pointer: SteamBridgePointerSnapshot;
      readonly button: number;
      readonly modifiers: SteamBridgeInputModifiers;
    }
  | {
      readonly type: "wheel";
      readonly capturedAtMs: number;
      readonly x: number;
      readonly y: number;
      readonly deltaX: number;
      readonly deltaY: number;
      readonly deltaZ: number;
      readonly deltaMode: number;
      readonly modifiers: SteamBridgeInputModifiers;
    }
  | {
      readonly type: "text";
      readonly capturedAtMs: number;
      readonly inputType: string;
      readonly data: string | null;
      readonly composing: boolean;
    }
  | {
      readonly type: "composition-start" | "composition-update" | "composition-end";
      readonly capturedAtMs: number;
      readonly data: string;
    }
  | {
      readonly type: "focus" | "blur" | "visibility";
      readonly capturedAtMs: number;
      readonly focused: boolean;
      readonly visible: boolean;
    }
  | {
      readonly type: "gamepad-connected" | "gamepad-disconnected";
      readonly capturedAtMs: number;
      readonly index: number;
      readonly id: string;
      readonly mapping: string;
    };

export interface SteamBridgeInputSnapshot<
  TDefinition extends SteamInputDefinition = SteamInputDefinition
> {
  readonly version: typeof STEAM_BRIDGE_INPUT_API_VERSION;
  readonly sequence: number;
  readonly capturedAtMs: number;
  readonly focused: boolean;
  readonly visible: boolean;
  readonly active: boolean;
  readonly lastActiveSource: SteamBridgeInputSource;
  readonly lastActivityAtMs: number | null;
  readonly modifiers: SteamBridgeInputModifiers;
  readonly keys: readonly SteamBridgeKeySnapshot[];
  readonly pointers: readonly SteamBridgePointerSnapshot[];
  readonly wheel: Readonly<{ deltaX: number; deltaY: number; deltaZ: number }>;
  readonly gamepads: readonly SteamBridgeGamepadSnapshot[];
  /** Most recently meaningfully active connected pad, selected inside Steam Bridge. */
  readonly primaryGamepadIndex: number | null;
  readonly steamInput: ElectronSteamInputFrame<TDefinition> | null;
  /** Ordered, bounded DOM input edges since the previous `readSnapshot()`. */
  readonly events: readonly SteamBridgeInputEvent[];
  /** Events dropped because the consumer did not read within the bounded queue. */
  readonly droppedEventCount: number;
}

export interface SteamBridgeGamepadInputSnapshot<
  TDefinition extends SteamInputDefinition = SteamInputDefinition
> {
  readonly version: typeof STEAM_BRIDGE_INPUT_API_VERSION;
  readonly sequence: number;
  readonly capturedAtMs: number;
  readonly focused: boolean;
  readonly visible: boolean;
  readonly active: boolean;
  readonly gamepads: readonly SteamBridgeGamepadSnapshot[];
  readonly primaryGamepadIndex: number | null;
  readonly steamInput: ElectronSteamInputFrame<TDefinition> | null;
}

export interface SteamBridgeInputApi<
  TDefinition extends SteamInputDefinition = SteamInputDefinition
> {
  /** Enable autonomous once-per-animation-frame Steam polling for apps without their own input loop. */
  start(): void;
  /** Stop autonomous polling and release all held state before the next read. */
  stop(): void;
  /** Read current state, request the next Steam frame, and consume accumulated wheel/text/edge events. */
  readSnapshot(): SteamBridgeInputSnapshot<TDefinition>;
  /** Controller-only read for frame-critical game loops; it does not run DOM event capture or another rAF loop. */
  readGamepads(): SteamBridgeGamepadInputSnapshot<TDefinition>;
}

export interface SteamBridgeInputGlobal {
  steamBridgeInput?: unknown;
}

/**
 * Return the secure preload API when a Steam Bridge Electron host installed it.
 * Browser-only applications receive `null` and can keep using ordinary DOM and
 * Gamepad APIs without a platform branch at module-load time.
 */
export function getSteamBridgeInput<
  TDefinition extends SteamInputDefinition = SteamInputDefinition
>(target: SteamBridgeInputGlobal = globalThis as SteamBridgeInputGlobal): SteamBridgeInputApi<TDefinition> | null {
  const candidate = target.steamBridgeInput;
  if (!candidate || typeof candidate !== "object") return null;
  const api = candidate as Partial<SteamBridgeInputApi<TDefinition>>;
  return typeof api.start === "function" && typeof api.stop === "function" &&
    typeof api.readSnapshot === "function" && typeof api.readGamepads === "function"
    ? (api as SteamBridgeInputApi<TDefinition>)
    : null;
}

export function isSteamBridgeInputSnapshot(value: unknown): value is SteamBridgeInputSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<SteamBridgeInputSnapshot>;
  return (
    snapshot.version === STEAM_BRIDGE_INPUT_API_VERSION &&
    Number.isSafeInteger(snapshot.sequence) &&
    typeof snapshot.capturedAtMs === "number" &&
    typeof snapshot.focused === "boolean" &&
    typeof snapshot.visible === "boolean" &&
    typeof snapshot.active === "boolean" &&
    Array.isArray(snapshot.keys) &&
    Array.isArray(snapshot.pointers) &&
    Array.isArray(snapshot.gamepads) &&
    Array.isArray(snapshot.events)
  );
}
