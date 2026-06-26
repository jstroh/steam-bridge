#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const TYPE_OBJECT = 0;
const TYPE_STRING = 1;
const TYPE_UINT32 = 2;
const TYPE_END = 8;

const UINT32_FIELDS = [
  "appid",
  "IsHidden",
  "AllowDesktopConfig",
  "AllowOverlay",
  "OpenVR",
  "Devkit",
  "DevkitOverrideAppID",
  "LastPlayTime"
];
const SHORTCUT_FIELD_ORDER = [
  "appid",
  "appname",
  "Exe",
  "StartDir",
  "icon",
  "ShortcutPath",
  "LaunchOptions",
  "IsHidden",
  "AllowDesktopConfig",
  "AllowOverlay",
  "OpenVR",
  "Devkit",
  "DevkitGameID",
  "DevkitOverrideAppID",
  "LastPlayTime",
  "FlatpakAppID",
  "tags"
];

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.selfTest) {
  runSelfTest();
  process.exit(0);
}

main();

function main() {
  assertOption("shortcuts", options.shortcuts);
  assertOption("app-name", options.appName);
  assertOption("exe", options.exe);

  const shortcutsPath = path.resolve(options.shortcuts);
  const root = fs.existsSync(shortcutsPath)
    ? readBinaryKeyValues(fs.readFileSync(shortcutsPath))
    : { name: "shortcuts", value: {} };
  if (root.name !== "shortcuts") {
    throw new Error(`Expected root object "shortcuts", got "${root.name}".`);
  }

  const shortcuts = root.value;
  const entry = buildShortcutEntry(options);
  const existingKey = findShortcutKey(shortcuts, options.appName);
  const key = existingKey ?? nextShortcutKey(shortcuts);
  shortcuts[key] = entry;

  const outputPath = path.resolve(options.output || shortcutsPath);
  if (options.backup && fs.existsSync(shortcutsPath)) {
    const backupPath =
      typeof options.backup === "string" ? path.resolve(options.backup) : `${shortcutsPath}.bak-${timestamp()}`;
    fs.copyFileSync(shortcutsPath, backupPath);
    console.log(`Backed up ${shortcutsPath} to ${backupPath}`);
  }

  fs.writeFileSync(outputPath, writeBinaryKeyValues(root));
  const gameId = computeShortcutGameId(entry.appid);
  console.log(`${existingKey == null ? "Added" : "Updated"} Steam shortcut "${options.appName}" at index ${key}.`);
  console.log(`Steam shortcut app ID (internal): ${entry.appid}`);
  console.log(`Steam shortcut game ID (use with steam://rungameid): ${gameId}`);
  console.log(`Launch URL: steam://rungameid/${gameId}`);
  console.log("Restart or fully reload Steam before launching if Steam was running while this file was updated.");
}

function buildShortcutEntry(parsed) {
  const exe = quotePath(parsed.exe);
  const startDir = parsed.startDir || path.dirname(parsed.exe);
  const appid =
    parsed.appid == null ? computeShortcutAppId(exe, parsed.appName) : Number.parseInt(parsed.appid, 10) >>> 0;

  return {
    appid,
    appname: parsed.appName,
    Exe: exe,
    StartDir: ensureTrailingSlash(startDir),
    icon: parsed.icon || "",
    ShortcutPath: parsed.shortcutPath || "",
    LaunchOptions: parsed.launchOptions || "",
    IsHidden: parsed.hidden ? 1 : 0,
    AllowDesktopConfig: 1,
    AllowOverlay: parsed.allowOverlay ? 1 : 0,
    OpenVR: 0,
    Devkit: 0,
    DevkitGameID: "",
    DevkitOverrideAppID: 0,
    LastPlayTime: 0,
    FlatpakAppID: parsed.flatpakAppId || "",
    tags: {}
  };
}

function readBinaryKeyValues(buffer) {
  let offset = 0;

  const rootType = readByte();
  if (rootType !== TYPE_OBJECT) {
    throw new Error(`Expected binary VDF root object, got type ${rootType}.`);
  }

  const name = readCString();
  return { name, value: readObject() };

  function readObject() {
    const object = {};
    while (offset < buffer.length) {
      const type = readByte();
      if (type === TYPE_END) {
        break;
      }

      const fieldName = readCString();
      switch (type) {
        case TYPE_OBJECT:
          object[fieldName] = readObject();
          break;
        case TYPE_STRING:
          object[fieldName] = readCString();
          break;
        case TYPE_UINT32:
          object[fieldName] = readUInt32();
          break;
        default:
          throw new Error(`Unsupported binary VDF field type ${type} for "${fieldName}".`);
      }
    }

    return object;
  }

  function readByte() {
    if (offset >= buffer.length) {
      throw new Error("Unexpected end of binary VDF.");
    }
    return buffer[offset++];
  }

  function readCString() {
    const start = offset;
    while (offset < buffer.length && buffer[offset] !== 0) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      throw new Error("Unterminated binary VDF string.");
    }
    const value = buffer.toString("utf8", start, offset);
    offset += 1;
    return value;
  }

  function readUInt32() {
    if (offset + 4 > buffer.length) {
      throw new Error("Unexpected end of binary VDF uint32.");
    }
    const value = buffer.readUInt32LE(offset);
    offset += 4;
    return value;
  }
}

function writeBinaryKeyValues(root) {
  const chunks = [];
  writeByte(TYPE_OBJECT);
  writeCString(root.name);
  writeObject(root.value, false);
  writeByte(TYPE_END);
  writeByte(TYPE_END);
  return Buffer.concat(chunks);

  function writeObject(object, includeEnd = true) {
    for (const [key, value] of orderedEntries(object)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        writeByte(TYPE_OBJECT);
        writeCString(key);
        writeObject(value);
      } else if (UINT32_FIELDS.includes(key) || Number.isInteger(value)) {
        writeByte(TYPE_UINT32);
        writeCString(key);
        writeUInt32(value);
      } else {
        writeByte(TYPE_STRING);
        writeCString(key);
        writeCString(value == null ? "" : String(value));
      }
    }
    if (includeEnd) {
      writeByte(TYPE_END);
    }
  }

  function orderedEntries(object) {
    const keys = Object.keys(object);
    const numericKeys = keys.filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
    if (numericKeys.length === keys.length) {
      return numericKeys.map((key) => [key, object[key]]);
    }

    const ordered = SHORTCUT_FIELD_ORDER.filter((key) => Object.hasOwn(object, key));
    for (const key of keys) {
      if (!ordered.includes(key)) {
        ordered.push(key);
      }
    }
    return ordered.map((key) => [key, object[key]]);
  }

  function writeByte(value) {
    chunks.push(Buffer.from([value]));
  }

  function writeCString(value) {
    chunks.push(Buffer.from(String(value), "utf8"), Buffer.from([0]));
  }

  function writeUInt32(value) {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(Number(value) >>> 0, 0);
    chunks.push(buffer);
  }
}

function findShortcutKey(shortcuts, appName) {
  return Object.keys(shortcuts).find((key) => shortcuts[key] && shortcuts[key].appname === appName);
}

function nextShortcutKey(shortcuts) {
  const keys = Object.keys(shortcuts)
    .filter((key) => /^\d+$/.test(key))
    .map(Number);
  return String(keys.length > 0 ? Math.max(...keys) + 1 : 0);
}

function computeShortcutAppId(exe, appName) {
  return (crc32(`${exe}${appName}`) | 0x80000000) >>> 0;
}

function computeShortcutGameId(appid) {
  return String((BigInt(appid >>> 0) << 32n) | 0x02000000n);
}

function crc32(value) {
  const bytes = Buffer.from(value, "utf8");
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crc32Table()[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crc32Table() {
  if (crc32Table.cache) {
    return crc32Table.cache;
  }

  crc32Table.cache = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
  return crc32Table.cache;
}

function quotePath(value) {
  const text = String(value);
  return text.startsWith("\"") && text.endsWith("\"") ? text : `"${text}"`;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
}

function parseArgs(args) {
  const parsed = {
    allowOverlay: true,
    backup: true
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--self-test":
        parsed.selfTest = true;
        break;
      case "--shortcuts":
        parsed.shortcuts = args[++index];
        break;
      case "--output":
        parsed.output = args[++index];
        break;
      case "--backup":
        if (args[index + 1] && !args[index + 1].startsWith("--")) {
          parsed.backup = args[++index];
        } else {
          parsed.backup = true;
        }
        break;
      case "--no-backup":
        parsed.backup = false;
        break;
      case "--app-name":
        parsed.appName = args[++index];
        break;
      case "--exe":
        parsed.exe = args[++index];
        break;
      case "--start-dir":
        parsed.startDir = args[++index];
        break;
      case "--launch-options":
        parsed.launchOptions = args[++index];
        break;
      case "--shortcut-path":
        parsed.shortcutPath = args[++index];
        break;
      case "--icon":
        parsed.icon = args[++index];
        break;
      case "--flatpak-app-id":
        parsed.flatpakAppId = args[++index];
        break;
      case "--appid":
        parsed.appid = args[++index];
        break;
      case "--hidden":
        parsed.hidden = true;
        break;
      case "--no-overlay":
        parsed.allowOverlay = false;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function assertOption(name, value) {
  if (!value) {
    throw new Error(`Missing required --${name}.`);
  }
}

function runSelfTest() {
  const root = {
    name: "shortcuts",
    value: {
      0: {
        appid: 123,
        appname: "Example",
        Exe: "\"/tmp/example\"",
        StartDir: "/tmp/",
        icon: "",
        ShortcutPath: "",
        LaunchOptions: "",
        IsHidden: 0,
        AllowDesktopConfig: 1,
        AllowOverlay: 1,
        OpenVR: 0,
        Devkit: 0,
        DevkitGameID: "",
        DevkitOverrideAppID: 0,
        LastPlayTime: 0,
        FlatpakAppID: "",
        tags: {}
      }
    }
  };
  const roundTrip = readBinaryKeyValues(writeBinaryKeyValues(root));
  const encoded = writeBinaryKeyValues(root);
  const terminator = encoded.slice(-2);
  const shortcut = roundTrip.value[0];
  if (
    !shortcut ||
    shortcut.appname !== "Example" ||
    shortcut.AllowOverlay !== 1 ||
    terminator[0] !== TYPE_END ||
    terminator[1] !== TYPE_END
  ) {
    throw new Error("Binary VDF self-test failed.");
  }
  console.log("Binary VDF self-test passed.");
}

function printHelp() {
  console.log(`Usage:
  node scripts/upsert-steam-shortcut.cjs \\
    --shortcuts /path/to/shortcuts.vdf \\
    --app-name "Steam Bridge Smoke" \\
    --exe /path/to/SteamBridgeSmoke \\
    [--start-dir /path/to] [--launch-options "..."] [--output /path/to/shortcuts.vdf]

Options:
  --shortcuts PATH       Existing Steam shortcuts.vdf file, or path to create.
  --output PATH          Write to a different file. Defaults to --shortcuts.
  --backup [PATH]        Back up the source file before writing. Enabled by default.
  --no-backup            Disable backup creation.
  --app-name NAME        Steam shortcut display name.
  --exe PATH             Executable path. The helper stores it with Steam-style quotes.
  --start-dir PATH       Start directory. Defaults to dirname(--exe).
  --launch-options TEXT  Launch options string.
  --shortcut-path PATH   Optional desktop shortcut path.
  --icon PATH            Optional icon path.
  --appid ID            Optional explicit unsigned 32-bit internal shortcut app ID.
  --hidden              Mark shortcut hidden.
  --no-overlay          Set AllowOverlay to 0.
  --self-test           Run a binary VDF round-trip check.`);
}
