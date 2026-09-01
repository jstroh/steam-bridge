export const STEAM_LEGACY_LAYOUT_SPEC_VERSION = 1 as const;

export const STEAM_LEGACY_CONTROLLER_TYPES = [
  "controller_generic",
  "controller_mobile_touch",
  "controller_neptune",
  "controller_ps3",
  "controller_ps4",
  "controller_ps5",
  "controller_ps5_edge",
  "controller_steamcontroller_gordon",
  "controller_switch2_pro",
  "controller_switch_joycon_left",
  "controller_switch_joycon_pair",
  "controller_switch_joycon_right",
  "controller_switch_pro",
  "controller_xbox360",
  "controller_xboxelite",
  "controller_xboxone"
] as const;

export type SteamLegacyControllerType = typeof STEAM_LEGACY_CONTROLLER_TYPES[number];

export interface SteamLegacyInputBindingSpec {
  /** A Steam Input legacy binding, for example `key_press SPACE, Action`. */
  readonly primary: string;
  readonly cancel: string;
  readonly secondary: string;
  readonly inventory: string;
  readonly movementUp: string;
  readonly movementDown: string;
  readonly movementLeft: string;
  readonly movementRight: string;
  readonly movementClick: string;
  readonly dpadUp: string;
  readonly dpadDown: string;
  readonly dpadLeft: string;
  readonly dpadRight: string;
  readonly leftTrigger: string;
  readonly rightTrigger: string;
  readonly menu: string;
  readonly view: string;
  readonly leftBumper: string;
  readonly rightBumper: string;
  readonly pointerClick: string;
}

/**
 * App-owned meaning only. Steam Bridge owns VDF syntax, group identifiers, and
 * every controller-family source mapping.
 */
export interface SteamLegacyLayoutSpec {
  readonly version: typeof STEAM_LEGACY_LAYOUT_SPEC_VERSION;
  readonly title: string;
  readonly description: string;
  readonly actionSetName?: string;
  readonly actionSetTitle?: string;
  /** Emit native left-stick axes instead of the version 1 directional bindings. */
  readonly analogMovement?: boolean;
  readonly bindings: SteamLegacyInputBindingSpec;
}

export interface SteamLegacyLayoutAssets {
  readonly manifestFileName: "steam_input_manifest.vdf";
  readonly files: Readonly<Record<string, string>>;
}

type SourceBinding = readonly [group: number, source: string];

const FULL_GAMEPAD_SOURCES: readonly SourceBinding[] = [
  [26, "switch"],
  [20, "button_diamond"],
  [21, "dpad"],
  [23, "joystick"],
  [24, "left_trigger"],
  [25, "right_trigger"],
  [27, "right_joystick"]
];

const CONTROLLER_SOURCE_PROFILES: Readonly<Record<SteamLegacyControllerType, readonly SourceBinding[]>> = {
  controller_generic: FULL_GAMEPAD_SOURCES,
  controller_mobile_touch: FULL_GAMEPAD_SOURCES,
  controller_neptune: [
    [26, "switch"], [20, "button_diamond"], [21, "dpad"], [22, "right_trackpad"],
    [23, "joystick"], [24, "left_trigger"], [25, "right_trigger"], [27, "right_joystick"]
  ],
  controller_ps3: FULL_GAMEPAD_SOURCES,
  controller_ps4: [...FULL_GAMEPAD_SOURCES, [22, "center_trackpad"]],
  controller_ps5: [...FULL_GAMEPAD_SOURCES, [22, "center_trackpad"]],
  controller_ps5_edge: [...FULL_GAMEPAD_SOURCES, [22, "center_trackpad"]],
  controller_steamcontroller_gordon: [
    [26, "switch"], [20, "button_diamond"], [21, "left_trackpad"], [22, "right_trackpad"],
    [23, "joystick"], [24, "left_trigger"], [25, "right_trigger"]
  ],
  controller_switch2_pro: FULL_GAMEPAD_SOURCES,
  controller_switch_joycon_left: [[26, "switch"], [20, "button_diamond"], [23, "joystick"]],
  controller_switch_joycon_pair: FULL_GAMEPAD_SOURCES,
  controller_switch_joycon_right: [[26, "switch"], [20, "button_diamond"], [23, "joystick"]],
  controller_switch_pro: FULL_GAMEPAD_SOURCES,
  controller_xbox360: FULL_GAMEPAD_SOURCES,
  controller_xboxelite: FULL_GAMEPAD_SOURCES,
  controller_xboxone: FULL_GAMEPAD_SOURCES
};

const SPEC_BINDING_KEYS = [
  "primary", "cancel", "secondary", "inventory",
  "movementUp", "movementDown", "movementLeft", "movementRight", "movementClick",
  "dpadUp", "dpadDown", "dpadLeft", "dpadRight",
  "leftTrigger", "rightTrigger", "menu", "view", "leftBumper", "rightBumper", "pointerClick"
] as const satisfies readonly (keyof SteamLegacyInputBindingSpec)[];

export function generateSteamLegacyLayoutAssets(spec: SteamLegacyLayoutSpec): SteamLegacyLayoutAssets {
  validateSteamLegacyLayoutSpec(spec);
  const actionSetName = spec.actionSetName ?? "GameplayControls";
  const actionSetTitle = spec.actionSetTitle ?? "Gameplay";
  const files: Record<string, string> = Object.create(null) as Record<string, string>;
  files["steam_input_manifest.vdf"] = renderManifest(actionSetName, actionSetTitle);
  for (const controllerType of STEAM_LEGACY_CONTROLLER_TYPES) {
    files[`${controllerType}.vdf`] = renderControllerLayout(
      controllerType,
      CONTROLLER_SOURCE_PROFILES[controllerType],
      spec,
      actionSetName,
      actionSetTitle
    );
  }
  return Object.freeze({
    manifestFileName: "steam_input_manifest.vdf" as const,
    files: Object.freeze(files)
  });
}

export function validateSteamLegacyLayoutSpec(value: unknown): asserts value is SteamLegacyLayoutSpec {
  if (!value || typeof value !== "object") throw new TypeError("Steam legacy layout spec must be an object");
  const spec = value as Partial<SteamLegacyLayoutSpec>;
  if (spec.version !== STEAM_LEGACY_LAYOUT_SPEC_VERSION) {
    throw new Error(`Steam legacy layout spec version must be ${STEAM_LEGACY_LAYOUT_SPEC_VERSION}`);
  }
  validatePlainText(spec.title, "title");
  validatePlainText(spec.description, "description");
  if (spec.actionSetName != null && !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(spec.actionSetName)) {
    throw new Error("Steam legacy layout actionSetName is invalid");
  }
  if (spec.actionSetTitle != null) validatePlainText(spec.actionSetTitle, "actionSetTitle");
  if (spec.analogMovement != null && typeof spec.analogMovement !== "boolean") {
    throw new TypeError("Steam legacy layout analogMovement must be a boolean");
  }
  if (!spec.bindings || typeof spec.bindings !== "object") {
    throw new TypeError("Steam legacy layout bindings must be an object");
  }
  for (const key of SPEC_BINDING_KEYS) validateLegacyBinding(spec.bindings[key], key);
}

function validatePlainText(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 256 || /[\0\r\n]/.test(value)) {
    throw new Error(`Steam legacy layout ${name} must be non-empty single-line text`);
  }
}

function validateLegacyBinding(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128 || /[\0\r\n"{}]/.test(value)) {
    throw new Error(`Steam legacy layout binding ${name} is invalid`);
  }
  if (!/^(?:key_press [A-Z0-9_]+|mouse_button (?:LEFT|RIGHT|MIDDLE))(?:, [^,]{1,64})?$/.test(value)) {
    throw new Error(`Steam legacy layout binding ${name} uses an unsupported legacy binding`);
  }
}

function renderManifest(actionSetName: string, actionSetTitle: string): string {
  const configurations = STEAM_LEGACY_CONTROLLER_TYPES.map((type) =>
    `\t\t"${type}"\n\t\t{\n\t\t\t"0"\n\t\t\t{\n\t\t\t\t"path"\t\t"${type}.vdf"\n\t\t\t}\n\t\t}`
  ).join("\n");
  return `"Action Manifest"\n{\n\t"configurations"\n\t{\n${configurations}\n\t}\n\n\t"actions"\n\t{\n\t\t"${actionSetName}"\n\t\t{\n\t\t\t"title"\t\t"#Set_${actionSetName}"\n\t\t}\n\t}\n\n\t"localization"\n\t{\n\t\t"english"\n\t\t{\n\t\t\t"Set_${actionSetName}"\t\t"${vdf(actionSetTitle)}"\n\t\t}\n\t}\n}\n`;
}

function renderControllerLayout(
  controllerType: SteamLegacyControllerType,
  sources: readonly SourceBinding[],
  spec: SteamLegacyLayoutSpec,
  actionSetName: string,
  actionSetTitle: string
): string {
  const b = spec.bindings;
  const sourceBindings = sources.map(([group, source]) => `"${group}" "${source} active"`).join(" ");
  const movementGroup = spec.analogMovement === true
    ? `\t"group" { "id" "23" "mode" "joystick_move" "inputs" { ${button("click", b.movementClick)} } "settings" { } }\n`
    : `\t"group" { "id" "23" "mode" "dpad" "inputs" { ${button("dpad_north", b.movementUp)} ${button("dpad_south", b.movementDown)} ${button("dpad_east", b.movementRight)} ${button("dpad_west", b.movementLeft)} ${button("click", b.movementClick)} } "settings" { "requires_click" "0" } }\n`;
  return `"controller_mappings"\n{\n` +
    `\t"version"\t\t"3"\n\t"title"\t\t"#Title_Config"\n\t"description"\t\t"#Description_Config"\n` +
    `\t"controller_type"\t\t"${controllerType}"\n\t"major_revision"\t\t"1"\n\t"minor_revision"\t\t"0"\n\n` +
    `\t"actions" { "${actionSetName}" { "title" "#Set_${actionSetName}" "legacy_set" "0" } }\n` +
    `\t"localization" { "english" { "Title_Config" "${vdf(spec.title)}" "Description_Config" "${vdf(spec.description)}" "Set_${actionSetName}" "${vdf(actionSetTitle)}" } }\n` +
    `\t"group" { "id" "20" "mode" "four_buttons" "inputs" { ${button("button_a", b.primary)} ${button("button_b", b.cancel)} ${button("button_x", b.secondary)} ${button("button_y", b.inventory)} } }\n` +
    `\t"group" { "id" "21" "mode" "dpad" "inputs" { ${button("dpad_north", b.dpadUp)} ${button("dpad_south", b.dpadDown)} ${button("dpad_east", b.dpadRight)} ${button("dpad_west", b.dpadLeft)} } "settings" { "requires_click" "0" } }\n` +
    `\t"group" { "id" "22" "mode" "absolute_mouse" "inputs" { ${button("click", b.pointerClick)} } "settings" { "sensitivity" "145" } }\n` +
    movementGroup +
    `\t"group" { "id" "24" "mode" "trigger" "inputs" { ${button("edge", b.leftTrigger)} } }\n` +
    `\t"group" { "id" "25" "mode" "trigger" "inputs" { ${button("edge", b.rightTrigger)} } }\n` +
    `\t"group" { "id" "26" "mode" "switches" "inputs" { ${button("button_escape", b.view)} ${button("button_menu", b.menu)} ${button("left_bumper", b.leftBumper)} ${button("right_bumper", b.rightBumper)} } }\n` +
    `\t"group" { "id" "27" "mode" "joystick_mouse" "inputs" { ${button("click", b.pointerClick)} } "settings" { "output_joystick" "2" } }\n` +
    `\t"preset" { "id" "0" "name" "${actionSetName}" "group_source_bindings" { ${sourceBindings} } }\n` +
    `\t"settings" { "left_trackpad_mode" "0" "right_trackpad_mode" "0" }\n}\n`;
}

function vdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function button(input: string, binding: string): string {
  return `"${input}" { "activators" { "Full_Press" { "bindings" { "binding" "${binding}" } "settings" { "repeat_rate" "99" } } } }`;
}
