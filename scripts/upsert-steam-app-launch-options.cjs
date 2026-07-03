#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT_KIND = "steam-bridge-windows-steam-app-launch-options";

main();

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === "self-test") {
    emitText(options, runSelfTest());
    return;
  }

  if (!options.appId) {
    throw new Error("Missing --app-id.");
  }

  if (options.mode === "print-wrapper") {
    const launchOptions = buildSmokeLaunchOptions(resolveSmokeExe(options), resolveSmokeEnvFile(options));
    emitText(options, launchOptions);
    return;
  }

  const localConfigPath = resolveLocalConfigPath(options);
  if (options.mode === "inspect") {
    const result = inspectLaunchOptions(localConfigPath, options.appId);
    emitJson(options, result);
    return;
  }

  if (options.mode === "set") {
    assertSteamStoppedUnlessAllowed(options);
    const smokeExe = resolveSmokeExe(options);
    const smokeEnvFile = resolveSmokeEnvFile(options);
    const launchOptions = buildSmokeLaunchOptions(smokeExe, smokeEnvFile);
    const result = setLaunchOptions(localConfigPath, options.appId, launchOptions, options);
    emitJson(options, result);
    return;
  }

  if (options.mode === "restore") {
    assertSteamStoppedUnlessAllowed(options);
    if (!options.backup) {
      throw new Error("Missing --backup for --mode restore.");
    }
    const backupPath = path.resolve(options.backup);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist: ${backupPath}`);
    }
    fs.copyFileSync(backupPath, localConfigPath);
    emitJson(options, {
      kind: SCRIPT_KIND,
      mode: "restore",
      restored: true,
      appIdPresent: true,
      localConfigPath,
      backupPath
    });
    return;
  }

  throw new Error(`Unsupported --mode ${options.mode}.`);
}

function parseArgs(args) {
  const options = {
    mode: "inspect",
    appId: "",
    localConfig: "",
    steamPath: "",
    steamUserId: "",
    smokeAppDir: "",
    smokeExe: "",
    smokeEnvFile: "",
    backup: "",
    resultFile: "",
    allowSteamRunning: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--mode":
        options.mode = readValue(args, ++index, arg);
        break;
      case "--app-id":
        options.appId = readValue(args, ++index, arg);
        break;
      case "--localconfig":
        options.localConfig = readValue(args, ++index, arg);
        break;
      case "--steam-path":
        options.steamPath = readValue(args, ++index, arg);
        break;
      case "--steam-user-id":
        options.steamUserId = readValue(args, ++index, arg);
        break;
      case "--smoke-app-dir":
        options.smokeAppDir = readValue(args, ++index, arg);
        break;
      case "--smoke-exe":
        options.smokeExe = readValue(args, ++index, arg);
        break;
      case "--smoke-env-file":
        options.smokeEnvFile = readValue(args, ++index, arg);
        break;
      case "--backup":
        options.backup = readValue(args, ++index, arg);
        break;
      case "--result-file":
        options.resultFile = readValue(args, ++index, arg);
        break;
      case "--allow-steam-running":
        options.allowSteamRunning = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["inspect", "print-wrapper", "set", "restore", "self-test"].includes(options.mode)) {
    throw new Error(`Invalid --mode ${options.mode}.`);
  }

  return options;
}

function readValue(args, index, flag) {
  if (index >= args.length || args[index].startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return args[index];
}

function printUsage() {
  console.log(`
Usage:
  node scripts/upsert-steam-app-launch-options.cjs --mode inspect --app-id APPID [--localconfig PATH]
  node scripts/upsert-steam-app-launch-options.cjs --mode print-wrapper --app-id APPID --smoke-app-dir PATH
  node scripts/upsert-steam-app-launch-options.cjs --mode set --app-id APPID --smoke-app-dir PATH [--backup PATH]
  node scripts/upsert-steam-app-launch-options.cjs --mode restore --app-id APPID --backup PATH [--localconfig PATH]

This is a Windows test utility for real Steam-app smoke proof. It edits the
current user's Steam localconfig.vdf only when Steam is stopped unless
--allow-steam-running is passed intentionally. Steam can overwrite that file
while it is running.
`.trim());
}

function emitJson(options, value) {
  emitText(options, JSON.stringify(value, null, 2));
}

function emitText(options, text) {
  const output = `${text}\n`;
  if (options.resultFile) {
    fs.mkdirSync(path.dirname(path.resolve(options.resultFile)), { recursive: true });
    fs.writeFileSync(options.resultFile, output);
    return;
  }
  process.stdout.write(output);
}

function resolveSmokeExe(options) {
  if (options.smokeExe) {
    return path.resolve(options.smokeExe);
  }
  if (options.smokeAppDir) {
    return path.resolve(options.smokeAppDir, "SteamBridgeSmoke.exe");
  }
  throw new Error("Missing --smoke-app-dir or --smoke-exe.");
}

function resolveSmokeEnvFile(options) {
  if (options.smokeEnvFile) {
    return path.resolve(options.smokeEnvFile);
  }
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "SteamBridgeSmoke", "steam-bridge-windows-smoke.env");
}

function buildSmokeLaunchOptions(smokeExe, smokeEnvFile) {
  return [
    quoteLaunchArg(smokeExe),
    quoteLaunchArg(`--steam-bridge-smoke-env-file=${smokeEnvFile}`),
    "%command%"
  ].join(" ");
}

function quoteLaunchArg(value) {
  const text = String(value);
  return `"${text.replace(/"/g, '\\"')}"`;
}

function resolveLocalConfigPath(options) {
  if (options.localConfig) {
    return path.resolve(options.localConfig);
  }

  const steamPath = resolveSteamPath(options);
  const userdataPath = path.join(steamPath, "userdata");
  if (options.steamUserId) {
    return path.join(userdataPath, options.steamUserId, "config", "localconfig.vdf");
  }

  const candidates = [];
  if (fs.existsSync(userdataPath)) {
    for (const entry of fs.readdirSync(userdataPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const candidate = path.join(userdataPath, entry.name, "config", "localconfig.vdf");
      if (fs.existsSync(candidate)) {
        candidates.push(candidate);
      }
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length > 1) {
    throw new Error("Multiple Steam localconfig.vdf files found; pass --steam-user-id or --localconfig.");
  }
  throw new Error("Could not find Steam localconfig.vdf; pass --localconfig.");
}

function resolveSteamPath(options) {
  if (options.steamPath) {
    return path.resolve(options.steamPath);
  }

  if (process.platform === "win32") {
    const registry = spawnSync("reg.exe", ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"], {
      encoding: "utf8"
    });
    if (registry.status === 0) {
      const match = registry.stdout.match(/SteamPath\s+REG_\w+\s+(.+)\r?$/m);
      if (match) {
        return match[1].trim();
      }
    }
    return path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Steam");
  }

  throw new Error("Steam path auto-discovery is only supported on Windows; pass --localconfig.");
}

function assertSteamStoppedUnlessAllowed(options) {
  if (options.allowSteamRunning || process.platform !== "win32") {
    return;
  }

  const tasklist = spawnSync("tasklist.exe", ["/FI", "IMAGENAME eq steam.exe"], {
    encoding: "utf8"
  });
  if (tasklist.status === 0 && /\bsteam\.exe\b/i.test(tasklist.stdout)) {
    throw new Error(
      "Steam is running. Fully quit Steam before editing localconfig.vdf, or pass --allow-steam-running intentionally."
    );
  }
}

function inspectLaunchOptions(localConfigPath, appId) {
  const text = readText(localConfigPath);
  const appNode = findAppNode(text, appId);
  const pair = appNode ? findPair(appNode, "LaunchOptions") : null;
  const launchOptions = pair ? pair.value.value : "";
  return {
    kind: SCRIPT_KIND,
    mode: "inspect",
    appIdPresent: Boolean(appId),
    appSectionFound: Boolean(appNode),
    hasLaunchOptions: Boolean(pair),
    launchOptionsLength: launchOptions.length,
    containsSmokeExe: /SteamBridgeSmoke(?:\.exe)?/i.test(launchOptions),
    containsEnvFileArg: /steam-bridge-smoke-env-file/i.test(launchOptions),
    containsCommandToken: /%command%/i.test(launchOptions),
    localConfigPath,
    steamRunning: isSteamRunning()
  };
}

function setLaunchOptions(localConfigPath, appId, launchOptions, options) {
  const text = readText(localConfigPath);
  const appNode = findAppNode(text, appId);
  if (!appNode) {
    throw new Error("Could not find an app section in localconfig.vdf. Launch the app once or set launch options in Steam once, then retry.");
  }

  const pair = findPair(appNode, "LaunchOptions");
  const current = pair ? pair.value.value : "";
  const changed = current !== launchOptions;
  const backupPath = options.backup
    ? path.resolve(options.backup)
    : `${localConfigPath}.steam-bridge-${timestamp()}.bak`;

  if (changed) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(localConfigPath, backupPath);
    fs.writeFileSync(localConfigPath, replaceOrInsertLaunchOptions(text, appNode, pair, launchOptions));
  }

  return {
    kind: SCRIPT_KIND,
    mode: "set",
    changed,
    appIdPresent: true,
    appSectionFound: true,
    hasLaunchOptions: true,
    containsSmokeExe: true,
    containsEnvFileArg: true,
    containsCommandToken: true,
    localConfigPath,
    backupPath: changed ? backupPath : "",
    steamRunning: isSteamRunning()
  };
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function findAppNode(text, appId) {
  const root = parseTextVdf(text);
  const store = root.children.find((node) => node.type === "object" && node.name === "UserLocalConfigStore") || root.children[0];
  if (!store) {
    return null;
  }
  const apps = findPath(store, ["Software", "Valve", "Steam", "apps"]);
  if (!apps) {
    return null;
  }
  return findChildObject(apps, String(appId));
}

function findPath(node, names) {
  let current = node;
  for (const name of names) {
    current = findChildObject(current, name);
    if (!current) {
      return null;
    }
  }
  return current;
}

function findChildObject(node, name) {
  return node.children.find((child) => child.type === "object" && child.name === name) || null;
}

function findPair(node, name) {
  return node.children.find((child) => child.type === "pair" && child.key.value === name) || null;
}

function replaceOrInsertLaunchOptions(text, appNode, pair, launchOptions) {
  const escaped = escapeVdfString(launchOptions);
  if (pair) {
    const lineStart = text.lastIndexOf("\n", pair.key.start) + 1;
    const lineEndIndex = text.indexOf("\n", pair.value.end);
    const lineEnd = lineEndIndex === -1 ? pair.value.end : lineEndIndex;
    const indent = text.slice(lineStart, pair.key.start).match(/^[ \t]*/)?.[0] || "";
    return `${text.slice(0, lineStart)}${indent}"LaunchOptions"\t\t"${escaped}"${text.slice(lineEnd)}`;
  }

  const childIndent = inferChildIndent(text, appNode);
  const insertion = `\n${childIndent}"LaunchOptions"\t\t"${escaped}"`;
  return `${text.slice(0, appNode.open.end)}${insertion}${text.slice(appNode.open.end)}`;
}

function inferChildIndent(text, node) {
  const firstChild = node.children.find((child) => child.type === "object" || child.type === "pair");
  if (firstChild) {
    const token = firstChild.type === "object" ? firstChild.nameToken : firstChild.key;
    const lineStart = text.lastIndexOf("\n", token.start) + 1;
    return text.slice(lineStart, token.start).match(/^[ \t]*/)?.[0] || "\t";
  }

  const parentLineStart = text.lastIndexOf("\n", node.nameToken.start) + 1;
  const parentIndent = text.slice(parentLineStart, node.nameToken.start).match(/^[ \t]*/)?.[0] || "";
  return `${parentIndent}\t`;
}

function parseTextVdf(text) {
  const tokens = tokenizeTextVdf(text);
  let index = 0;
  const root = { type: "root", children: [] };
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.type !== "string") {
      throw new Error(`Unexpected token while parsing VDF at ${token.start}.`);
    }
    const next = tokens[index + 1];
    if (!next || next.type !== "brace" || next.value !== "{") {
      throw new Error(`Expected object after key "${token.value}".`);
    }
    const parsed = parseObject(tokens, index);
    root.children.push(parsed.node);
    index = parsed.nextIndex;
  }
  return root;
}

function parseObject(tokens, startIndex) {
  const nameToken = tokens[startIndex];
  const open = tokens[startIndex + 1];
  const node = {
    type: "object",
    name: nameToken.value,
    nameToken,
    open,
    close: null,
    children: []
  };

  let index = startIndex + 2;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.type === "brace" && token.value === "}") {
      node.close = token;
      return { node, nextIndex: index + 1 };
    }
    if (token.type !== "string") {
      throw new Error(`Unexpected token inside object "${node.name}" at ${token.start}.`);
    }
    const next = tokens[index + 1];
    if (!next) {
      throw new Error(`Unexpected end of VDF after key "${token.value}".`);
    }
    if (next.type === "brace" && next.value === "{") {
      const parsed = parseObject(tokens, index);
      node.children.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }
    if (next.type === "string") {
      node.children.push({
        type: "pair",
        key: token,
        value: next
      });
      index += 2;
      continue;
    }
    throw new Error(`Unexpected token after key "${token.value}" at ${next.start}.`);
  }

  throw new Error(`Object "${node.name}" is missing a closing brace.`);
}

function tokenizeTextVdf(text) {
  const tokens = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (char === "/" && text[index + 1] === "/") {
      const end = text.indexOf("\n", index + 2);
      index = end === -1 ? text.length : end + 1;
      continue;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "{" || char === "}") {
      tokens.push({ type: "brace", value: char, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === '"') {
      const start = index;
      index += 1;
      let value = "";
      while (index < text.length) {
        const current = text[index];
        if (current === "\\") {
          const next = text[index + 1];
          if (next == null) {
            throw new Error(`Unterminated escape in VDF string at ${start}.`);
          }
          value += unescapeVdfChar(next);
          index += 2;
          continue;
        }
        if (current === '"') {
          index += 1;
          tokens.push({ type: "string", value, start, end: index });
          break;
        }
        value += current;
        index += 1;
      }
      if (tokens.length === 0 || tokens[tokens.length - 1].start !== start) {
        throw new Error(`Unterminated VDF string at ${start}.`);
      }
      continue;
    }
    throw new Error(`Unexpected character in VDF at ${index}.`);
  }

  return tokens;
}

function unescapeVdfChar(char) {
  switch (char) {
    case "n":
      return "\n";
    case "t":
      return "\t";
    case "r":
      return "\r";
    default:
      return char;
  }
}

function escapeVdfString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function isSteamRunning() {
  if (process.platform !== "win32") {
    return false;
  }
  const tasklist = spawnSync("tasklist.exe", ["/FI", "IMAGENAME eq steam.exe"], {
    encoding: "utf8"
  });
  return tasklist.status === 0 && /\bsteam\.exe\b/i.test(tasklist.stdout);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function runSelfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-launch-options-"));
  try {
    const localConfig = path.join(temp, "localconfig.vdf");
    const backup = path.join(temp, "localconfig.backup.vdf");
    const smokeDir = path.join(temp, "Smoke App");
    fs.mkdirSync(smokeDir);
    fs.writeFileSync(path.join(smokeDir, "SteamBridgeSmoke.exe"), "");
    fs.writeFileSync(
      localConfig,
      [
        '"UserLocalConfigStore"',
        "{",
        '\t"Software"',
        "\t{",
        '\t\t"Valve"',
        "\t\t{",
        '\t\t\t"Steam"',
        "\t\t\t{",
        '\t\t\t\t"apps"',
        "\t\t\t\t{",
        '\t\t\t\t\t"12345"',
        "\t\t\t\t\t{",
        '\t\t\t\t\t\t"LastPlayed"\t\t"1"',
        "\t\t\t\t\t}",
        "\t\t\t\t}",
        "\t\t\t}",
        "\t\t}",
        "\t}",
        "}",
        ""
      ].join("\n")
    );

    const firstInspect = inspectLaunchOptions(localConfig, "12345");
    assert.equal(firstInspect.appSectionFound, true);
    assert.equal(firstInspect.hasLaunchOptions, false);

    const envFile = path.join(temp, "steam bridge smoke.env");
    const launchOptions = buildSmokeLaunchOptions(path.join(smokeDir, "SteamBridgeSmoke.exe"), envFile);
    assert.match(launchOptions, /SteamBridgeSmoke\.exe/);
    assert.match(launchOptions, /steam-bridge-smoke-env-file/);
    assert.match(launchOptions, /%command%/);
    assert.doesNotMatch(launchOptions, /\\\\/);
    assert.equal(
      buildSmokeLaunchOptions("C:\\Smoke App\\SteamBridgeSmoke.exe", "C:\\Smoke App\\smoke.env"),
      '"C:\\Smoke App\\SteamBridgeSmoke.exe" "--steam-bridge-smoke-env-file=C:\\Smoke App\\smoke.env" %command%'
    );

    const setResult = setLaunchOptions(localConfig, "12345", launchOptions, { backup });
    assert.equal(setResult.changed, true);
    assert.equal(fs.existsSync(backup), true);

    const secondInspect = inspectLaunchOptions(localConfig, "12345");
    assert.equal(secondInspect.hasLaunchOptions, true);
    assert.equal(secondInspect.containsSmokeExe, true);
    assert.equal(secondInspect.containsEnvFileArg, true);
    assert.equal(secondInspect.containsCommandToken, true);

    const idempotent = setLaunchOptions(localConfig, "12345", launchOptions, { backup });
    assert.equal(idempotent.changed, false);

    fs.copyFileSync(backup, localConfig);
    const restored = inspectLaunchOptions(localConfig, "12345");
    assert.equal(restored.hasLaunchOptions, false);

    return "Windows Steam app launch options self-test passed.";
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
