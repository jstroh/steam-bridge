import type { ElectronSteamInputFrame } from "./electron";
import type { SteamInputDefinition } from "./index";

export const INPUT_API_VERSION = 2 as const;
export const RENDERER_BRIDGE_VERSION = 1 as const;

export type InputSource = "keyboard" | "pointer" | "touch" | "pen" | "gamepad" | "steam-input";

export interface InputFocus {
  readonly active: boolean;
  readonly focused: boolean;
  readonly visible: boolean;
}

export interface InputModifiers {
  readonly alt: boolean;
  readonly control: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
}

export interface KeyState {
  readonly code: string;
  readonly key: string;
  readonly location: number;
}

export interface PointerState {
  readonly id: number;
  readonly type: "mouse" | "touch" | "pen";
  readonly primary: boolean;
  readonly x: number;
  readonly y: number;
  readonly buttons: number;
  readonly pressure: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist: number;
}

export interface GamepadButtonState {
  readonly available: boolean;
  readonly pressed: boolean;
  readonly touched: boolean;
  readonly value: number;
}

export interface GamepadStickState {
  readonly available: boolean;
  readonly x: number;
  readonly y: number;
}

export interface GamepadTouchState {
  readonly id: number;
  readonly surface: number;
  readonly position: readonly [number, number];
  readonly surfaceSize?: readonly [number, number];
}

export interface GamepadButtons {
  readonly south: GamepadButtonState;
  readonly east: GamepadButtonState;
  readonly west: GamepadButtonState;
  readonly north: GamepadButtonState;
  readonly leftBumper: GamepadButtonState;
  readonly rightBumper: GamepadButtonState;
  readonly leftTrigger: GamepadButtonState;
  readonly rightTrigger: GamepadButtonState;
  readonly view: GamepadButtonState;
  readonly menu: GamepadButtonState;
  readonly leftStick: GamepadButtonState;
  readonly rightStick: GamepadButtonState;
  readonly dpadUp: GamepadButtonState;
  readonly dpadDown: GamepadButtonState;
  readonly dpadLeft: GamepadButtonState;
  readonly dpadRight: GamepadButtonState;
  readonly home: GamepadButtonState;
  readonly touchpad: GamepadButtonState;
}

export interface GamepadState {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: true;
  readonly timestamp: number;
  readonly mappingSource: "standard" | "heuristic";
  readonly sticks: Readonly<{ left: GamepadStickState; right: GamepadStickState }>;
  readonly buttons: GamepadButtons;
  readonly touches: readonly GamepadTouchState[];
  /** Raw browser values for advanced bindings. Ordinary apps use `sticks` and `buttons`. */
  readonly raw: Readonly<{
    axes: readonly number[];
    buttons: readonly GamepadButtonState[];
  }>;
}

export interface GamepadStateCollection {
  readonly connected: readonly GamepadState[];
  readonly primary: GamepadState | null;
}

export type InputEvent =
  | { readonly type: "key-down" | "key-up"; readonly atMs: number; readonly code: string; readonly key: string; readonly location: number; readonly repeat: boolean; readonly composing: boolean; readonly modifiers: InputModifiers }
  | { readonly type: "pointer-down" | "pointer-up" | "pointer-move" | "pointer-cancel"; readonly atMs: number; readonly pointer: PointerState; readonly button: number; readonly modifiers: InputModifiers }
  | { readonly type: "wheel"; readonly atMs: number; readonly x: number; readonly y: number; readonly deltaX: number; readonly deltaY: number; readonly deltaZ: number; readonly deltaMode: number; readonly modifiers: InputModifiers }
  | { readonly type: "text"; readonly atMs: number; readonly inputType: string; readonly data: string | null; readonly composing: boolean }
  | { readonly type: "composition-start" | "composition-update" | "composition-end"; readonly atMs: number; readonly data: string }
  | { readonly type: "focus" | "blur" | "visibility"; readonly atMs: number; readonly focus: InputFocus }
  | { readonly type: "gamepad-connected" | "gamepad-disconnected"; readonly atMs: number; readonly index: number; readonly id: string; readonly mapping: string };

export interface InputFrame<TDefinition extends SteamInputDefinition = SteamInputDefinition> {
  readonly version: typeof INPUT_API_VERSION;
  readonly sequence: number;
  readonly timestampMs: number;
  readonly focus: InputFocus;
  readonly lastInput: Readonly<{ source: InputSource; atMs: number }> | null;
  readonly keyboard: Readonly<{ modifiers: InputModifiers; keys: readonly KeyState[] }>;
  readonly pointers: readonly PointerState[];
  readonly wheel: Readonly<{ x: number; y: number; z: number }>;
  readonly gamepads: GamepadStateCollection;
  readonly steamActions: ElectronSteamInputFrame<TDefinition> | null;
  readonly events: readonly InputEvent[];
  readonly droppedEvents: number;
}

export interface GamepadFrame<TDefinition extends SteamInputDefinition = SteamInputDefinition> {
  readonly version: typeof INPUT_API_VERSION;
  readonly sequence: number;
  readonly timestampMs: number;
  readonly focus: InputFocus;
  readonly connected: readonly GamepadState[];
  readonly primary: GamepadState | null;
  readonly steamActions: ElectronSteamInputFrame<TDefinition> | null;
}

export interface RendererInput<TDefinition extends SteamInputDefinition = SteamInputDefinition> {
  readonly version: typeof INPUT_API_VERSION;
  /** Complete keyboard, pointer, text, controller, focus, and Steam-action frame. */
  read(): InputFrame<TDefinition>;
  /** Allocation-minimal controller-only path for a game's frame loop. */
  readonly gamepads: Readonly<{ read(): GamepadFrame<TDefinition> }>;
}

export interface RendererBridge<TDefinition extends SteamInputDefinition = SteamInputDefinition> {
  readonly version: typeof RENDERER_BRIDGE_VERSION;
  readonly input: RendererInput<TDefinition>;
}

export interface RendererBridgeGlobal {
  steamBridge?: unknown;
}

export function getRendererBridge<TDefinition extends SteamInputDefinition = SteamInputDefinition>(
  target: RendererBridgeGlobal = globalThis as RendererBridgeGlobal
): RendererBridge<TDefinition> | null {
  const candidate = target.steamBridge;
  if (!candidate || typeof candidate !== "object") return null;
  const bridge = candidate as Partial<RendererBridge<TDefinition>>;
  if (bridge.version !== RENDERER_BRIDGE_VERSION || !bridge.input || typeof bridge.input !== "object") return null;
  const input = bridge.input as Partial<RendererInput<TDefinition>>;
  return input.version === INPUT_API_VERSION && typeof input.read === "function" &&
    Boolean(input.gamepads && typeof input.gamepads.read === "function")
    ? (bridge as RendererBridge<TDefinition>)
    : null;
}

export function getRendererInput<TDefinition extends SteamInputDefinition = SteamInputDefinition>(
  target: RendererBridgeGlobal = globalThis as RendererBridgeGlobal
): RendererInput<TDefinition> | null {
  return getRendererBridge<TDefinition>(target)?.input ?? null;
}

export function isInputFrame(value: unknown): value is InputFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Partial<InputFrame>;
  return frame.version === INPUT_API_VERSION && Number.isSafeInteger(frame.sequence) &&
    typeof frame.timestampMs === "number" && Boolean(frame.focus && typeof frame.focus === "object") &&
    Boolean(frame.keyboard && typeof frame.keyboard === "object") && Array.isArray(frame.pointers) &&
    Boolean(frame.gamepads && Array.isArray(frame.gamepads.connected)) && Array.isArray(frame.events);
}
