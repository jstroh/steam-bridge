import { getRendererInput as getAdvancedRendererInput } from "./input";

/** Read the simple, normalized renderer input API installed by Steam Bridge. */
export function getRendererInput(): ReturnType<typeof getAdvancedRendererInput> {
  return getAdvancedRendererInput();
}

export type {
  GamepadButtonState,
  GamepadButtons,
  GamepadFrame,
  GamepadState,
  GamepadStateCollection,
  GamepadStickState,
  GamepadTouchState,
  InputEvent,
  InputFocus,
  InputFrame,
  InputModifiers,
  InputSource,
  KeyState,
  PointerState,
  RendererInput
} from "./input";
