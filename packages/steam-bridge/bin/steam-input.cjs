#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// SteamInput006 limits from the bundled Steamworks SDK header. Valve's older
// SteamInput001 web reference still shows 128 digital and 16 analog actions.
const MAX_DIGITAL_ACTIONS = 256;
const MAX_ANALOG_ACTIONS = 24;
const ANALOG_CATEGORIES = new Set(["stickpadgyro", "analogtrigger"]);
const DIGITAL_CATEGORIES = new Set(["button"]);
const STICK_PAD_GYRO_INPUT_MODES = new Set(["joystick_move", "absolute_mouse"]);
const ACTION_CONTAINER_METADATA_KEYS = new Set(["title", "legacy_set", "set_layer", "parent_set_name"]);
const SUPPORTED_CONTROLLER_TYPES = new Set([
  "controller_neptune",
  "controller_steamcontroller_gordon",
  "controller_xbox360",
  "controller_xboxone",
  "controller_xboxelite",
  "controller_ps3",
  "controller_ps4",
  "controller_ps5",
  "controller_ps5_edge",
  "controller_switch_pro",
  "controller_switch2_pro",
  "controller_switch_joycon_left",
  "controller_switch_joycon_right",
  "controller_switch_joycon_pair",
  "controller_mobile_touch",
  "controller_generic"
]);

function main(args = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.error(error.message);
    printUsage(console);
    return 2;
  }

  if (options.help) {
    printUsage(console);
    return 0;
  }
  if (options.selfTest) {
    try {
      runSelfTest();
      console.log("Steam Input manifest self-test passed.");
      return 0;
    } catch (error) {
      console.error(error.stack || error.message);
      return 1;
    }
  }

  try {
    const result = inspectManifest(options.manifestPath, { checkFiles: true });
    if (result.errors.length > 0) {
      for (const issue of result.errors) console.error(formatIssue(options.manifestPath, issue));
      return 1;
    }
    for (const issue of result.warnings) console.warn(formatIssue(options.manifestPath, issue));

    if (options.command === "validate") {
      console.log(
        `Steam Input manifest valid: ${result.actionSets.length} sets, ${result.actionLayers.length} layers, ` +
          `${result.digitalActions.length} digital actions, ${result.analogActions.length} analog actions.`
      );
      return 0;
    }

    const generated = generateTypeScriptDefinition(result, options.manifestPath);
    if (options.check) {
      if (!fs.existsSync(options.outPath)) {
        console.error(`Generated Steam Input definition is missing: ${options.outPath}`);
        return 1;
      }
      if (fs.readFileSync(options.outPath, "utf8") !== generated) {
        console.error(
          `Generated Steam Input definition is stale: ${options.outPath}\n` +
            `Run: steam-bridge-input generate ${quoteArg(options.manifestPath)} --out ${quoteArg(options.outPath)}`
        );
        return 1;
      }
      console.log(`Steam Input definition is current: ${options.outPath}`);
      return 0;
    }

    fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
    writeFileAtomic(options.outPath, generated);
    console.log(`Generated Steam Input definition: ${options.outPath}`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

function parseArgs(args) {
  const options = {
    command: "",
    manifestPath: "",
    outPath: "",
    check: false,
    help: false,
    selfTest: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--check") {
      options.check = true;
    } else if (arg === "--out") {
      const value = args[++index];
      if (!value) throw new Error("--out requires a file path");
      options.outPath = path.resolve(value);
    } else if (!options.command) {
      if (arg !== "validate" && arg !== "generate") {
        throw new Error(`Unknown Steam Input command: ${arg}`);
      }
      options.command = arg;
    } else if (!options.manifestPath) {
      options.manifestPath = path.resolve(arg);
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (options.help || options.selfTest) return options;
  if (!options.command) throw new Error("A command is required: validate or generate");
  if (!options.manifestPath) throw new Error(`${options.command} requires a manifest path`);
  if (options.command === "validate" && options.outPath) throw new Error("validate does not accept --out");
  if (options.command === "validate" && options.check) throw new Error("validate does not accept --check");
  if (options.command === "generate" && !options.outPath) throw new Error("generate requires --out <file>");
  if (
    options.command === "generate" &&
    pathsReferToSameFile(options.manifestPath, options.outPath)
  ) {
    throw new Error("Generated definition output must not overwrite the Steam Input manifest");
  }
  return options;
}

function printUsage(io) {
  io.log(`Usage:
  steam-bridge-input validate <steam_input_manifest.vdf>
  steam-bridge-input generate <steam_input_manifest.vdf> --out <definition.ts> [--check]

Commands:
  validate  Validate action sets, layers, actions, localization, and referenced configuration files.
  generate  Validate and generate a deterministic typed definition for defineSteamInput().

Options:
  --check      Do not write; fail when the generated output is missing or stale.
  --out FILE   TypeScript output path for generate.
  --help       Show this help.`);
}

function inspectManifest(filename, options = {}) {
  const source = fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, "");
  const entries = parseKeyValues(source, filename);
  const errors = [];
  const warnings = [];
  const rootCandidates = entries.filter((entry) => {
    const name = lower(entry.key);
    return name === "action manifest" || name === "in game actions";
  });
  if (rootCandidates.length !== 1) {
    errors.push(issue(entries[0], `Expected exactly one \"Action Manifest\" or \"In Game Actions\" root, found ${rootCandidates.length}.`));
  }
  const root = rootCandidates[0];
  if (!root?.children) {
    return emptyInspection(filename, errors, warnings);
  }

  const actionSets = [];
  const actionLayers = [];
  const digital = new Map();
  const analog = new Map();
  const localizationReferences = [];
  const seenSetNames = new Map();
  const seenLayerNames = new Map();
  const actionsNodes = childrenNamed(root, "actions");
  if (actionsNodes.length !== 1) {
    errors.push(issue(root, `Expected exactly one actions block, found ${actionsNodes.length}.`));
  }
  const actionsNode = actionsNodes[0];
  if (!actionsNode?.children) {
    errors.push(issue(root, "Missing required actions block."));
  } else {
    for (const setNode of actionsNode.children) {
      validateUniqueName(setNode, seenSetNames, "action set", errors);
      if (!setNode.children) {
        errors.push(issue(setNode, `Action set \"${setNode.key}\" must be a block.`));
        continue;
      }
      actionSets.push(setNode.key);
      validateLocalizedTitle(setNode, `Action set \"${setNode.key}\"`, localizationReferences, errors);
      collectActions(setNode, digital, analog, localizationReferences, errors);
    }
  }
  if (actionSets.length === 0) errors.push(issue(actionsNode ?? root, "Manifest must define at least one action set."));

  const layerNodes = childrenNamed(root, "action_layers");
  if (layerNodes.length > 1) {
    errors.push(issue(layerNodes[1], `Expected at most one action_layers block, found ${layerNodes.length}.`));
  }
  const layersNode = layerNodes[0];
  if (layersNode?.children) {
    for (const layerNode of layersNode.children) {
      validateUniqueName(layerNode, seenLayerNames, "action layer", errors);
      if (seenSetNames.has(lower(layerNode.key))) {
        errors.push(issue(layerNode, `Action layer \"${layerNode.key}\" duplicates an action-set handle name.`));
      }
      if (!layerNode.children) {
        errors.push(issue(layerNode, `Action layer \"${layerNode.key}\" must be a block.`));
        continue;
      }
      actionLayers.push(layerNode.key);
      validateLocalizedTitle(layerNode, `Action layer \"${layerNode.key}\"`, localizationReferences, errors);
      const parent = childValue(layerNode, "parent_set_name");
      if (!parent) {
        errors.push(issue(layerNode, `Action layer \"${layerNode.key}\" is missing parent_set_name.`));
      } else if (!seenSetNames.has(lower(parent))) {
        errors.push(issue(layerNode, `Action layer \"${layerNode.key}\" references unknown parent action set \"${parent}\".`));
      }
      collectActions(layerNode, digital, analog, localizationReferences, errors);
    }
  }

  for (const [folded, action] of digital) {
    if (analog.has(folded)) {
      errors.push(issue(action.node, `Action \"${action.name}\" is declared as both digital and analog.`));
    }
  }
  if (digital.size > MAX_DIGITAL_ACTIONS) {
    errors.push(issue(actionsNode, `Manifest defines ${digital.size} digital actions; Valve's limit is ${MAX_DIGITAL_ACTIONS}.`));
  }
  if (analog.size > MAX_ANALOG_ACTIONS) {
    errors.push(issue(actionsNode, `Manifest defines ${analog.size} analog actions; Valve's limit is ${MAX_ANALOG_ACTIONS}.`));
  }

  validateLocalization(root, localizationReferences, errors, warnings);
  validateConfigurationFiles(root, filename, Boolean(options.checkFiles), errors, warnings);

  return {
    filename,
    rootKind: root.key,
    actionSets: sortedUnique(actionSets),
    actionLayers: sortedUnique(actionLayers),
    digitalActions: [...digital.values()].map((value) => value.name).sort(compareText),
    analogActions: [...analog.values()].map((value) => value.name).sort(compareText),
    errors,
    warnings
  };
}

function emptyInspection(filename, errors, warnings) {
  return {
    filename,
    rootKind: "",
    actionSets: [],
    actionLayers: [],
    digitalActions: [],
    analogActions: [],
    errors,
    warnings
  };
}

function collectActions(container, digital, analog, localizationReferences, errors) {
  if (!container.children) {
    errors.push(issue(container, `\"${container.key}\" must be a block.`));
    return;
  }
  const seenCategories = new Map();
  for (const category of container.children) {
    const categoryName = lower(category.key);
    const target = DIGITAL_CATEGORIES.has(categoryName)
      ? digital
      : ANALOG_CATEGORIES.has(categoryName)
        ? analog
        : undefined;
    if (!target) {
      if (ACTION_CONTAINER_METADATA_KEYS.has(categoryName)) {
        if (category.children) {
          errors.push(issue(category, `Steam Input metadata "${category.key}" must be a value, not a block.`));
        }
        continue;
      }
      errors.push(
        issue(
          category,
          `Unknown Steam Input entry "${category.key}" in "${container.key}"; expected Button, StickPadGyro, AnalogTrigger, or supported metadata.`
        )
      );
      continue;
    }
    const previousCategory = seenCategories.get(categoryName);
    if (previousCategory) {
      errors.push(
        issue(
          category,
          `Duplicate action category \"${category.key}\" in \"${container.key}\"; first declared at line ${previousCategory.line}.`
        )
      );
    } else {
      seenCategories.set(categoryName, category);
    }
    if (!category.children) {
      errors.push(issue(category, `Action category \"${category.key}\" must be a block.`));
      continue;
    }
    for (const actionNode of category.children) {
      const folded = lower(actionNode.key);
      let signature;
      if (categoryName === "stickpadgyro") {
        if (!actionNode.children) {
          errors.push(issue(actionNode, `StickPadGyro action \"${actionNode.key}\" must be a block with title and input_mode.`));
          continue;
        }
        const title = validateLocalizedTitle(
          actionNode,
          `StickPadGyro action \"${actionNode.key}\"`,
          localizationReferences,
          errors
        );
        const inputModeNodes = childrenNamed(actionNode, "input_mode");
        if (inputModeNodes.length !== 1 || inputModeNodes[0].value === undefined) {
          errors.push(issue(actionNode, `StickPadGyro action \"${actionNode.key}\" must contain exactly one scalar input_mode.`));
        }
        const inputMode = lower(inputModeNodes[0]?.value ?? "");
        if (inputMode && !STICK_PAD_GYRO_INPUT_MODES.has(inputMode)) {
          errors.push(issue(inputModeNodes[0], `Unsupported StickPadGyro input_mode \"${inputModeNodes[0].value}\".`));
        }
        const osMouseNodes = childrenNamed(actionNode, "os_mouse");
        if (osMouseNodes.length > 1 || (osMouseNodes.length === 1 && osMouseNodes[0].value === undefined)) {
          errors.push(issue(actionNode, `StickPadGyro action \"${actionNode.key}\" may contain at most one scalar os_mouse value.`));
        } else if (osMouseNodes.length === 1 && osMouseNodes[0].value !== "1") {
          errors.push(issue(osMouseNodes[0], `StickPadGyro os_mouse must be \"1\" when present.`));
        }
        for (const metadata of actionNode.children) {
          if (lower(metadata.key) !== "title" && lower(metadata.key) !== "input_mode" && lower(metadata.key) !== "os_mouse") {
            errors.push(issue(metadata, `Unknown StickPadGyro action metadata \"${metadata.key}\".`));
          }
        }
        signature = `${categoryName}\0${title ?? ""}\0${inputMode}\0${osMouseNodes[0]?.value ?? ""}`;
      } else {
        if (actionNode.value === undefined) {
          errors.push(issue(actionNode, `${category.key} action \"${actionNode.key}\" must be a scalar #localization reference.`));
          continue;
        }
        const reference = validateLocalizationReference(
          actionNode.value,
          actionNode,
          `${category.key} action \"${actionNode.key}\"`,
          localizationReferences,
          errors,
          categoryName === "button"
        );
        signature = `${categoryName}\0${reference?.key ?? ""}\0${reference?.nativeEvent ?? ""}`;
      }
      const previous = target.get(folded);
      if (previous && previous.name !== actionNode.key) {
        errors.push(
          issue(
            actionNode,
            `Action name \"${actionNode.key}\" differs only by case from \"${previous.name}\"; Steam action lookup is global.`
          )
        );
      } else if (previous?.container === container) {
        errors.push(issue(actionNode, `Action \"${actionNode.key}\" is declared more than once in \"${container.key}\".`));
      } else if (previous && previous.signature !== signature) {
        errors.push(issue(actionNode, `Global action \"${actionNode.key}\" has inconsistent category or action metadata.`));
      } else if (!previous) {
        target.set(folded, { name: actionNode.key, node: actionNode, container, signature });
      }
    }
  }
}

function validateLocalizedTitle(node, label, references, errors) {
  const titleNodes = childrenNamed(node, "title");
  if (titleNodes.length !== 1 || titleNodes[0].value === undefined) {
    errors.push(issue(node, `${label} must contain exactly one scalar title.`));
    return undefined;
  }
  return validateLocalizationReference(titleNodes[0].value, titleNodes[0], label, references, errors)?.key;
}

function validateLocalizationReference(value, node, label, references, errors, allowNativeEvent = false) {
  const match = /^#([^,\s]+)(?:,\s*(mouse_button\s+[A-Za-z0-9_]+))?$/i.exec(value.trim());
  if (!match) {
    errors.push(issue(node, `${label} title must be one #localization reference.`));
    return undefined;
  }
  if (match[2] && !allowNativeEvent) {
    errors.push(issue(node, `${label} may not declare a native mouse event.`));
    return undefined;
  }
  references.push({ key: match[1], node });
  return { key: match[1], nativeEvent: match[2]?.toLowerCase() };
}

function validateLocalization(root, references, errors, warnings) {
  const localizationNodes = childrenNamed(root, "localization");
  if (localizationNodes.length > 1) {
    errors.push(issue(localizationNodes[1], `Expected at most one localization block, found ${localizationNodes.length}.`));
  }
  const localization = localizationNodes[0];
  if (!localization?.children) {
    if (references.length > 0) errors.push(issue(root, "Localized titles are referenced but the localization block is missing."));
    return;
  }
  const seenLanguages = new Map();
  for (const language of localization.children) {
    validateUniqueName(language, seenLanguages, "localization language", errors);
    if (!language.children) {
      errors.push(issue(language, `Localization language \"${language.key}\" must be a block.`));
      continue;
    }
    const languageKeys = new Map();
    for (const entry of language.children) {
      validateUniqueName(entry, languageKeys, `${language.key} localization key`, errors);
      if (entry.value === undefined) {
        errors.push(issue(entry, `Localization key \"${entry.key}\" must be a scalar value.`));
      }
    }
  }
  const english = seenLanguages.get("english");
  if (!english?.children) {
    errors.push(issue(localization, "Localization must include an English fallback block."));
    return;
  }
  const keys = new Map();
  for (const entry of english.children) {
    const folded = lower(entry.key);
    if (!keys.has(folded)) keys.set(folded, entry);
  }
  for (const reference of references) {
    if (!keys.has(lower(reference.key))) {
      errors.push(issue(reference.node, `Missing English localization key \"${reference.key}\".`));
    }
  }
  if (references.length === 0) {
    warnings.push(issue(localization, "Manifest contains no #localization references."));
  }
}

function validateConfigurationFiles(root, filename, checkFiles, errors, warnings) {
  const configurationNodes = childrenNamed(root, "configurations");
  const singularConfigurationNodes = childrenNamed(root, "configuration");
  if (configurationNodes.length > 1) {
    errors.push(issue(configurationNodes[1], `Expected at most one configurations block, found ${configurationNodes.length}.`));
  }
  if (singularConfigurationNodes.length > 0) {
    errors.push(issue(
      singularConfigurationNodes[0],
      'Steam Input configuration blocks must use Valve\'s documented plural name "configurations", not "configuration".'
    ));
  }
  if (singularConfigurationNodes.length > 1) {
    errors.push(issue(
      singularConfigurationNodes[1],
      `Expected at most one configuration block, found ${singularConfigurationNodes.length}.`
    ));
  }
  if (configurationNodes.length > 0 && singularConfigurationNodes.length > 0) {
    errors.push(issue(
      singularConfigurationNodes[0],
      'Steam Input manifests must not mix "configurations" and "configuration" blocks.'
    ));
  }
  const configurationBlocks = [...configurationNodes, ...singularConfigurationNodes];
  if (lower(root.key) === "in game actions" && configurationBlocks.length > 0) {
    errors.push(issue(
      configurationBlocks[0],
      'Bundled controller configurations require an "Action Manifest" root; "In Game Actions" must not contain configuration blocks.'
    ));
  }
  if (configurationBlocks.length === 0) {
    if (lower(root.key) === "action manifest") {
      warnings.push(issue(root, "Action Manifest has no configurations block; no official bundled layouts can be verified."));
    }
    return;
  }
  const base = path.dirname(filename);
  const seenControllerTypes = new Map();
  for (const configurations of configurationBlocks) {
    validateConfigurationBlock(configurations, base, checkFiles, errors, seenControllerTypes);
  }
}

function validateConfigurationBlock(configurations, base, checkFiles, errors, seenControllerTypes) {
  if (!configurations.children) {
    errors.push(issue(configurations, `${configurations.key} must be a block.`));
    return;
  }
  for (const controllerType of configurations.children) {
    validateUniqueName(controllerType, seenControllerTypes, "controller configuration type", errors);
    if (!SUPPORTED_CONTROLLER_TYPES.has(lower(controllerType.key))) {
      errors.push(issue(controllerType, `Unsupported Steam Input controller type "${controllerType.key}".`));
    }
    if (!controllerType.children) {
      errors.push(issue(controllerType, `Controller configuration \"${controllerType.key}\" must be a block.`));
      continue;
    }
    const priorities = new Set();
    for (const configuration of controllerType.children) {
      if (!/^\d+$/.test(configuration.key)) {
        errors.push(issue(configuration, `Controller configuration priority "${configuration.key}" must be a non-negative integer.`));
      } else {
        const canonicalPriority = BigInt(configuration.key).toString();
        if (priorities.has(canonicalPriority)) {
          errors.push(issue(configuration, `Duplicate controller configuration priority "${configuration.key}".`));
        } else {
          priorities.add(canonicalPriority);
        }
      }
      if (!configuration.children) {
        errors.push(issue(configuration, `Configuration ${controllerType.key}/${configuration.key} must be a block.`));
        continue;
      }
      const pathNodes = childrenNamed(configuration, "path");
      const pathNode = pathNodes[0];
      if (pathNodes.length !== 1 || !pathNode?.value) {
        errors.push(issue(configuration, `Configuration ${controllerType.key}/${configuration.key} is missing path.`));
        continue;
      }
      if (path.isAbsolute(pathNode.value) || path.win32.isAbsolute(pathNode.value) || path.posix.isAbsolute(pathNode.value)) {
        errors.push(issue(pathNode, `Configuration path must be relative to the action manifest: ${pathNode.value}`));
        continue;
      }
      const resolved = path.resolve(base, pathNode.value.replace(/[\\/]+/g, path.sep));
      if (checkFiles) {
        if (!fs.existsSync(resolved)) {
          errors.push(issue(pathNode, `Referenced controller configuration does not exist: ${resolved}`));
        } else if (!fs.statSync(resolved).isFile()) {
          errors.push(issue(pathNode, `Referenced controller configuration is not a file: ${resolved}`));
        } else {
          validateControllerConfigurationFile(resolved, pathNode, controllerType.key, errors);
        }
      }
    }
  }
}

function validateControllerConfigurationFile(filename, sourceNode, expectedControllerType, errors) {
  try {
    const source = fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, "");
    const entries = parseKeyValues(source, filename);
    const roots = entries.filter((entry) => lower(entry.key) === "controller_mappings");
    if (roots.length !== 1 || !roots[0].children) {
      errors.push(issue(sourceNode, `Referenced controller configuration must contain exactly one controller_mappings root: ${filename}`));
      return;
    }
    const controllerTypes = childrenNamed(roots[0], "controller_type");
    if (controllerTypes.length !== 1 || controllerTypes[0].value === undefined) {
      errors.push(issue(
        controllerTypes[1] ?? controllerTypes[0] ?? sourceNode,
        `Referenced controller configuration must contain exactly one scalar controller_type: ${filename}`
      ));
      return;
    }
    if (lower(controllerTypes[0].value) !== lower(expectedControllerType)) {
      errors.push(issue(
        controllerTypes[0],
        `Referenced controller configuration controller_type "${controllerTypes[0].value}" does not match manifest controller family "${expectedControllerType}": ${filename}`
      ));
    }
  } catch (error) {
    errors.push(issue(sourceNode, `Referenced controller configuration is invalid: ${error.message}`));
  }
}

function generateTypeScriptDefinition(result, manifestPath) {
  const relativeHint = path.basename(manifestPath).replace(/\\/g, "/");
  const objectLines = (names, indent) => {
    if (names.length === 0) return [`${indent}{}`];
    return [
      `${indent}{`,
      ...names.map((name, index) => `${indent}  ${JSON.stringify(name)}: ${JSON.stringify(name)}${index + 1 === names.length ? "" : ","}`),
      `${indent}}`
    ];
  };
  const lines = [
    "// Generated by steam-bridge-input. Do not edit by hand.",
    `// Source: ${relativeHint}`,
    'import { defineSteamInput } from "steam-bridge";',
    "",
    "export const steamInputDefinition = defineSteamInput({"
  ];
  for (const [key, names] of [
    ["actionSets", result.actionSets],
    ["actionLayers", result.actionLayers],
    ["digital", result.digitalActions],
    ["analog", result.analogActions]
  ]) {
    const rendered = objectLines(names, "  ");
    lines.push(`  ${key}: ${rendered[0].trimStart()}`);
    lines.push(...rendered.slice(1));
    lines[lines.length - 1] += key === "analog" ? "" : ",";
  }
  lines.push("} as const);", "", "export type SteamInputDefinition = typeof steamInputDefinition;", "");
  return lines.join("\n");
}

function parseKeyValues(source, filename = "<input>") {
  const tokens = tokenizeKeyValues(source, filename);
  let index = 0;
  const parseEntries = (expectsClose) => {
    const entries = [];
    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === "close") {
        if (!expectsClose) throw syntaxError(filename, token, "Unexpected closing brace.");
        index += 1;
        return entries;
      }
      if (token.type !== "word") throw syntaxError(filename, token, "Expected a KeyValues key.");
      index += 1;
      const next = tokens[index];
      if (!next) throw syntaxError(filename, token, `Missing value or block for \"${token.value}\".`);
      if (next.type === "open") {
        index += 1;
        entries.push({ key: token.value, children: parseEntries(true), line: token.line, column: token.column });
      } else if (next.type === "word") {
        index += 1;
        entries.push({ key: token.value, value: next.value, line: token.line, column: token.column });
      } else {
        throw syntaxError(filename, next, `Expected a value or block for \"${token.value}\".`);
      }
    }
    if (expectsClose) {
      const last = tokens[tokens.length - 1] || { line: 1, column: 1 };
      throw syntaxError(filename, last, "Unclosed KeyValues block.");
    }
    return entries;
  };
  return parseEntries(false);
}

function tokenizeKeyValues(source, filename) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let column = 1;
  const advance = () => {
    const char = source[index++];
    if (char === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return char;
  };
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      advance();
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      while (index < source.length && advance() !== "\n") {}
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const startLine = line;
      const startColumn = column;
      advance();
      advance();
      let closed = false;
      while (index < source.length) {
        if (source[index] === "*" && source[index + 1] === "/") {
          advance();
          advance();
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) throw syntaxError(filename, { line: startLine, column: startColumn }, "Unclosed block comment.");
      continue;
    }
    const tokenLine = line;
    const tokenColumn = column;
    if (char === "{") {
      advance();
      tokens.push({ type: "open", line: tokenLine, column: tokenColumn });
      continue;
    }
    if (char === "}") {
      advance();
      tokens.push({ type: "close", line: tokenLine, column: tokenColumn });
      continue;
    }
    if (char === '"') {
      advance();
      let value = "";
      let closed = false;
      while (index < source.length) {
        const current = advance();
        if (current === "\\") {
          const escaped = source[index];
          if (escaped === '"' || escaped === "\\") {
            advance();
            value += escaped;
            continue;
          }
          // Preserve unknown escapes so Windows-relative paths such as
          // configs\xbox.vdf retain their literal backslash.
          value += current;
          continue;
        }
        if (current === '"') {
          closed = true;
          break;
        }
        value += current;
      }
      if (!closed) throw syntaxError(filename, { line: tokenLine, column: tokenColumn }, "Unclosed quoted string.");
      tokens.push({ type: "word", value, line: tokenLine, column: tokenColumn });
      continue;
    }
    let value = "";
    while (index < source.length && !/[\s{}]/.test(source[index])) value += advance();
    if (!value) throw syntaxError(filename, { line, column }, `Unexpected character ${JSON.stringify(source[index])}.`);
    tokens.push({ type: "word", value, line: tokenLine, column: tokenColumn });
  }
  return tokens;
}

function child(node, name) {
  return node?.children?.find((entry) => lower(entry.key) === lower(name));
}

function childrenNamed(node, name) {
  const folded = lower(name);
  return node?.children?.filter((entry) => lower(entry.key) === folded) ?? [];
}

function childValue(node, name) {
  return child(node, name)?.value;
}

function validateUniqueName(node, seen, label, errors) {
  const folded = lower(node.key);
  const previous = seen.get(folded);
  if (previous) {
    errors.push(issue(node, `Duplicate ${label} name \"${node.key}\"; first declared at line ${previous.line}.`));
  } else {
    seen.set(folded, node);
  }
}

function issue(node, message) {
  return { line: node?.line || 1, column: node?.column || 1, message };
}

function formatIssue(filename, value) {
  return `${filename}:${value.line}:${value.column}: ${value.message}`;
}

function syntaxError(filename, token, message) {
  return new Error(`${filename}:${token.line}:${token.column}: ${message}`);
}

function lower(value) {
  return String(value).toLowerCase();
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareText);
}

function quoteArg(value) {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

function canonicalPathForComparison(filename) {
  let resolved = path.resolve(filename);
  try {
    resolved = fs.realpathSync.native(resolved);
  } catch {
    try {
      resolved = path.join(fs.realpathSync.native(path.dirname(resolved)), path.basename(resolved));
    } catch {
      // The normalized absolute path still catches an identical not-yet-created output.
    }
  }
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function pathsReferToSameFile(left, right) {
  if (canonicalPathForComparison(left) === canonicalPathForComparison(right)) return true;
  try {
    const leftStat = fs.statSync(left, { bigint: true });
    const rightStat = fs.statSync(right, { bigint: true });
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
  } catch {
    return false;
  }
}

function writeFileAtomic(filename, content) {
  const directory = path.dirname(filename);
  const basename = path.basename(filename);
  const existingMode = fs.existsSync(filename) ? fs.statSync(filename).mode : 0o666;
  let temporaryPath;
  let descriptor;
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      temporaryPath = path.join(directory, `.${basename}.${process.pid}.${Date.now()}.${attempt}.tmp`);
      try {
        descriptor = fs.openSync(temporaryPath, "wx", existingMode);
        break;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
    }
    if (descriptor === undefined || !temporaryPath) {
      throw new Error(`Could not allocate a temporary output beside ${filename}`);
    }
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filename);
    temporaryPath = undefined;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (temporaryPath) fs.rmSync(temporaryPath, { force: true });
  }
}

function runSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-input-"));
  try {
    const manifest = path.join(root, "steam_input_manifest.vdf");
    const config = path.join(root, "xbox.vdf");
    const validConfig = '"controller_mappings" { "controller_type" "controller_xboxone" "version" "3" }\n';
    fs.writeFileSync(config, validConfig);
    fs.writeFileSync(
      manifest,
      `"Action Manifest"
{
  "configurations" { "controller_xboxone" { "0" { "path" "xbox.vdf" } } }
  "actions"
  {
    "Menu" { "title" "#Set_Menu" "Button" { "Accept" "#Action_Accept, mouse_button LEFT" } }
    "Gameplay"
    {
      "title" "#Set_Gameplay"
      "StickPadGyro" { "Move" { "title" "#Action_Move" "input_mode" "joystick_move" "os_mouse" "1" } }
      "Button" { "Jump" "#Action_Jump" }
    }
  }
  "action_layers"
  {
    "Inventory" { "title" "#Layer_Inventory" "parent_set_name" "Gameplay" "Button" { "Accept" "#Action_Accept, mouse_button LEFT" } }
  }
  "localization"
  {
    "english"
    {
      "Set_Menu" "Menu" "Set_Gameplay" "Gameplay" "Layer_Inventory" "Inventory"
      "Action_Accept" "Accept" "Action_Move" "Move" "Action_Jump" "Jump"
    }
  }
}\n`
    );
    const inspected = inspectManifest(manifest, { checkFiles: true });
    assert.deepEqual(inspected.errors, []);
    assert.deepEqual(inspected.actionSets, ["Gameplay", "Menu"]);
    assert.deepEqual(inspected.actionLayers, ["Inventory"]);
    assert.deepEqual(inspected.digitalActions, ["Accept", "Jump"]);
    assert.deepEqual(inspected.analogActions, ["Move"]);

    fs.writeFileSync(config, '"controller_mappings" { "version" "3" }\n');
    assert.ok(inspectManifest(manifest, { checkFiles: true }).errors.some((entry) =>
      /exactly one scalar controller_type/.test(entry.message)
    ));
    fs.writeFileSync(
      config,
      '"controller_mappings" { "controller_type" "controller_xboxone" "controller_type" "controller_xboxone" "version" "3" }\n'
    );
    assert.ok(inspectManifest(manifest, { checkFiles: true }).errors.some((entry) =>
      /exactly one scalar controller_type/.test(entry.message)
    ));
    fs.writeFileSync(config, '"controller_mappings" { "controller_type" "controller_neptune" "version" "3" }\n');
    assert.ok(inspectManifest(manifest, { checkFiles: true }).errors.some((entry) =>
      /does not match manifest controller family "controller_xboxone"/.test(entry.message)
    ));
    fs.writeFileSync(config, '"controller_mappings" { "controller_type" "CONTROLLER_XBOXONE" "version" "3" }\n');
    assert.deepEqual(inspectManifest(manifest, { checkFiles: true }).errors, []);
    fs.writeFileSync(config, validConfig);

    const generated = generateTypeScriptDefinition(inspected, manifest);
    assert.match(generated, /defineSteamInput/);
    assert.match(generated, /"Jump": "Jump"/);
    assert.equal(generated, generateTypeScriptDefinition(inspected, manifest));

    const bad = path.join(root, "bad.vdf");
    fs.writeFileSync(
      bad,
      '"In Game Actions" { "actions" { "Game" { "Button" { "Fire" "#Missing" } } } "localization" { "german" { "Missing" "Feuer" } } }'
    );
    const badResult = inspectManifest(bad, { checkFiles: true });
    assert.ok(badResult.errors.some((entry) => /English fallback/.test(entry.message)));

    const misspelledCategory = path.join(root, "misspelled-category.vdf");
    fs.writeFileSync(
      misspelledCategory,
      '"In Game Actions" { "actions" { "Game" { "Buttons" { "Fire" "Fire" } } } }'
    );
    const misspelledCategoryResult = inspectManifest(misspelledCategory, { checkFiles: true });
    assert.ok(misspelledCategoryResult.errors.some((entry) => /Unknown Steam Input entry "Buttons"/.test(entry.message)));

    const badConfiguration = path.join(root, "bad-configuration.vdf");
    fs.writeFileSync(
      badConfiguration,
      '"Action Manifest" { "configurations" { "controller_xboxon" { "first" { "path" "." } } } "actions" { "Game" { "Button" { "Fire" "Fire" } } } }'
    );
    const badConfigurationResult = inspectManifest(badConfiguration, { checkFiles: true });
    assert.ok(badConfigurationResult.errors.some((entry) => /Unsupported Steam Input controller type/.test(entry.message)));
    assert.ok(badConfigurationResult.errors.some((entry) => /must be a non-negative integer/.test(entry.message)));
    assert.ok(badConfigurationResult.errors.some((entry) => /is not a file/.test(entry.message)));

    const singularConfiguration = path.join(root, "singular-configuration.vdf");
    fs.writeFileSync(
      singularConfiguration,
      '"Action Manifest" { "configuration" { "controller_xboxone" { "0" { "path" "missing.vdf" } } } "actions" { "Game" { "Button" { "Fire" "Fire" } } } }'
    );
    const singularConfigurationResult = inspectManifest(singularConfiguration, { checkFiles: true });
    assert.ok(singularConfigurationResult.errors.some((entry) => /documented plural name "configurations"/.test(entry.message)));
    assert.ok(singularConfigurationResult.errors.some((entry) => /does not exist/.test(entry.message)));

    const hybridConfiguration = path.join(root, "hybrid-configuration.vdf");
    fs.writeFileSync(
      hybridConfiguration,
      `"Action Manifest" {
        "configurations" { "controller_xboxone" { "0" { "path" "xbox.vdf" } } }
        "configuration" { "controller_ps5" { "0" { "path" "xbox.vdf" } } }
        "actions" { "Game" { "Button" { "Fire" "Fire" } } }
      }`
    );
    const hybridConfigurationResult = inspectManifest(hybridConfiguration, { checkFiles: true });
    assert.ok(hybridConfigurationResult.errors.some((entry) => /must not mix "configurations" and "configuration"/.test(entry.message)));

    const hybridRoot = path.join(root, "hybrid-root.vdf");
    fs.writeFileSync(
      hybridRoot,
      `"In Game Actions" {
        "configurations" { "controller_xboxone" { "0" { "path" "xbox.vdf" } } }
        "actions" { "Game" { "Button" { "Fire" "Fire" } } }
      }`
    );
    const hybridRootResult = inspectManifest(hybridRoot, { checkFiles: true });
    assert.ok(hybridRootResult.errors.some((entry) => /require an "Action Manifest" root/.test(entry.message)));

    const ordinaryInGameActions = path.join(root, "ordinary-in-game-actions.vdf");
    fs.writeFileSync(
      ordinaryInGameActions,
      '"In Game Actions" { "actions" { "Game" { "title" "#Set_Game" "Button" { "Fire" "#Action_Fire" } } } "localization" { "english" { "Set_Game" "Game" "Action_Fire" "Fire" } } }'
    );
    assert.deepEqual(inspectManifest(ordinaryInGameActions, { checkFiles: true }).errors, []);

    const malformedActions = path.join(root, "malformed-actions.vdf");
    fs.writeFileSync(
      malformedActions,
      `"In Game Actions" {
        "actions" { "Game" {
          "title" "Game"
          "Button" { "Fire" { "title" "#Action_Fire" } }
          "StickPadGyro" { "Move" { "title" "#Action_Move" "input_mode" "trackball" } }
        } }
        "localization" { "english" { "Action_Fire" "Fire" "Action_Move" "Move" } }
      }`
    );
    const malformedActionsResult = inspectManifest(malformedActions);
    assert.ok(malformedActionsResult.errors.some((entry) => /title must be one #localization reference/.test(entry.message)));
    assert.ok(malformedActionsResult.errors.some((entry) => /Button action .* must be a scalar/.test(entry.message)));
    assert.ok(malformedActionsResult.errors.some((entry) => /Unsupported StickPadGyro input_mode/.test(entry.message)));

    const invalidNativeMetadata = path.join(root, "invalid-native-metadata.vdf");
    fs.writeFileSync(
      invalidNativeMetadata,
      `"In Game Actions" {
        "actions" { "Game" {
          "Button" { "Fire" "#Action_Fire, keyboard SPACE" }
          "AnalogTrigger" { "Throttle" "#Action_Throttle, mouse_button LEFT" }
          "StickPadGyro" { "Move" { "title" "#Action_Move" "input_mode" "joystick_move" "os_mouse" "yes" } }
        } }
        "localization" { "english" {
          "Action_Fire" "Fire" "Action_Throttle" "Throttle" "Action_Move" "Move"
        } }
      }`
    );
    const invalidNativeMetadataResult = inspectManifest(invalidNativeMetadata);
    assert.ok(invalidNativeMetadataResult.errors.some((entry) => /title must be one #localization reference/.test(entry.message)));
    assert.ok(invalidNativeMetadataResult.errors.some((entry) => /may not declare a native mouse event/.test(entry.message)));
    assert.ok(invalidNativeMetadataResult.errors.some((entry) => /os_mouse must be "1" when present/.test(entry.message)));

    const duplicatePriority = path.join(root, "duplicate-priority.vdf");
    fs.writeFileSync(
      duplicatePriority,
      `"Action Manifest" {
        "configurations" { "controller_xboxone" {
          "1" { "path" "xbox.vdf" }
          "01" { "path" "xbox.vdf" }
        } }
        "actions" { "Game" { "title" "#Set_Game" "Button" { "Fire" "#Action_Fire" } } }
        "localization" { "english" { "Set_Game" "Game" "Action_Fire" "Fire" } }
      }`
    );
    const duplicatePriorityResult = inspectManifest(duplicatePriority, { checkFiles: true });
    assert.ok(duplicatePriorityResult.errors.some((entry) => /Duplicate controller configuration priority/.test(entry.message)));

    const invalidConfig = path.join(root, "invalid-controller.vdf");
    fs.writeFileSync(invalidConfig, '"not_controller_mappings" { "version" "3" }');
    const invalidConfigManifest = path.join(root, "invalid-controller-manifest.vdf");
    fs.writeFileSync(
      invalidConfigManifest,
      `"Action Manifest" {
        "configurations" { "controller_xboxone" { "0" { "path" "invalid-controller.vdf" } } }
        "actions" { "Game" { "title" "#Set_Game" "Button" { "Fire" "#Action_Fire" } } }
        "localization" { "english" { "Set_Game" "Game" "Action_Fire" "Fire" } }
      }`
    );
    const invalidConfigResult = inspectManifest(invalidConfigManifest, { checkFiles: true });
    assert.ok(invalidConfigResult.errors.some((entry) => /exactly one controller_mappings root/.test(entry.message)));

    const windowsAbsolutePath = path.join(root, "windows-absolute-path.vdf");
    fs.writeFileSync(
      windowsAbsolutePath,
      String.raw`"Action Manifest" {
        "configurations" { "controller_xboxone" { "0" { "path" "C:\\configs\\xbox.vdf" } } }
        "actions" { "Game" { "title" "#Set_Game" "Button" { "Fire" "#Action_Fire" } } }
        "localization" { "english" { "Set_Game" "Game" "Action_Fire" "Fire" } }
      }`
    );
    const windowsAbsolutePathResult = inspectManifest(windowsAbsolutePath);
    assert.ok(windowsAbsolutePathResult.errors.some((entry) => /path must be relative/.test(entry.message)));

    assert.equal(
      parseKeyValues(String.raw`"path" "configs\xbox.vdf"`, "windows-path.vdf")[0].value,
      String.raw`configs\xbox.vdf`
    );
    const escapedStrings = parseKeyValues(
      String.raw`"root" { "title" "\"Point and click\" with mouse" "escaped" "A\\B" "path" "configs\xbox.vdf" }`,
      "escaped-strings.vdf"
    )[0];
    assert.equal(childValue(escapedStrings, "title"), '"Point and click" with mouse');
    assert.equal(childValue(escapedStrings, "escaped"), String.raw`A\B`);
    assert.equal(childValue(escapedStrings, "path"), String.raw`configs\xbox.vdf`);

    const nestedConfigDirectory = path.join(root, "configs");
    fs.mkdirSync(nestedConfigDirectory);
    fs.writeFileSync(
      path.join(nestedConfigDirectory, "xbox.vdf"),
      '"controller_mappings" { "controller_type" "controller_xboxone" "version" "3" }\n'
    );
    const windowsRelativePath = path.join(root, "windows-relative-path.vdf");
    fs.writeFileSync(
      windowsRelativePath,
      String.raw`"Action Manifest" {
        "configurations" { "controller_xboxone" { "0" { "path" "configs\xbox.vdf" } } }
        "actions" { "Game" { "title" "#Set_Game" "Button" { "Fire" "#Action_Fire" } } }
        "localization" { "english" { "Set_Game" "Game" "Action_Fire" "Fire" } }
      }`
    );
    assert.deepEqual(inspectManifest(windowsRelativePath, { checkFiles: true }).errors, []);

    assert.throws(
      () => parseKeyValues('"broken" { "x"', "broken.vdf"),
      /Missing value or block|Unclosed KeyValues block/
    );

    const output = path.join(root, "generated.ts");
    assert.equal(mainForTest(["generate", manifest, "--out", output]), 0);
    assert.equal(mainForTest(["generate", manifest, "--out", output, "--check"]), 0);
    fs.appendFileSync(output, "// stale\n");
    assert.equal(mainForTest(["generate", manifest, "--out", output, "--check"]), 1);
    assert.equal(mainForTest(["generate", manifest, "--out", output]), 0);
    assert.equal(mainForTest(["generate", manifest, "--out", output, "--check"]), 0);
    assert.throws(
      () => parseArgs(["generate", manifest, "--out", manifest]),
      /must not overwrite the Steam Input manifest/
    );
    const hardLinkedManifest = path.join(root, "hard-linked-manifest.vdf");
    fs.linkSync(manifest, hardLinkedManifest);
    assert.throws(
      () => parseArgs(["generate", manifest, "--out", hardLinkedManifest]),
      /must not overwrite the Steam Input manifest/
    );
    assert.deepEqual(
      fs.readdirSync(root).filter((entry) => entry.endsWith(".tmp")),
      []
    );

    const exampleDirectory = path.resolve(__dirname, "../../../examples/steam-input");
    const exampleManifest = path.join(exampleDirectory, "steam_input_manifest.vdf");
    if (fs.existsSync(exampleManifest)) {
      const exampleResult = inspectManifest(exampleManifest, { checkFiles: true });
      assert.deepEqual(exampleResult.errors, []);
      assert.equal(
        normalizeLineEndings(
          fs.readFileSync(path.join(exampleDirectory, "steam-input.generated.ts"), "utf8")
        ),
        normalizeLineEndings(generateTypeScriptDefinition(exampleResult, exampleManifest)),
        "the checked-in generated example definition must match its manifest"
      );
      const commonJsDefinition = require(path.join(exampleDirectory, "definition.cjs"));
      assert.deepEqual(Object.values(commonJsDefinition.actionSets).sort(compareText), exampleResult.actionSets);
      assert.deepEqual(Object.values(commonJsDefinition.actionLayers).sort(compareText), exampleResult.actionLayers);
      assert.deepEqual(Object.values(commonJsDefinition.digital).sort(compareText), exampleResult.digitalActions);
      assert.deepEqual(Object.values(commonJsDefinition.analog).sort(compareText), exampleResult.analogActions);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, "\n");
}

function mainForTest(args) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return main(args);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

module.exports = {
  generateTypeScriptDefinition,
  inspectManifest,
  main,
  parseArgs,
  parseKeyValues,
  tokenizeKeyValues
};

if (require.main === module) {
  process.exitCode = main();
}
