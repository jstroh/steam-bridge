#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");

const resultPrefix = "STEAM_BRIDGE_SMOKE_RESULT ";
const clientHealthArtifactName = "steam-client-health-diagnostics.txt";
const clientLaunchArtifactName = "steam-client-launch-diagnostics.txt";
const overlayIpcArtifactName = "steam-overlay-ipc-diagnostics.txt";

main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  if (args.clientHealth) {
    const processListText = args.processListFile ? readOptionalText(args.processListFile) : readProcessList();
    const result = detectSteamClientHealth({
      processListText,
      consoleLog: args.consoleLog || defaultSteamLog("console_log.txt"),
      webhelperLog: args.webhelperLog || defaultSteamLog("webhelper.txt"),
      resourceSnapshot: collectClientHealthResourceSnapshot({ processListText })
    });

    if (args.writeArtifact && args.diagnosticDir) {
      fs.mkdirSync(args.diagnosticDir, { recursive: true });
      fs.writeFileSync(path.join(args.diagnosticDir, clientHealthArtifactName), result.message);
    }

    if (!args.quiet) {
      const stream = result.ok ? process.stdout : process.stderr;
      stream.write(result.message);
    }

    process.exit(result.ok ? 0 : 1);
  }

  const result = args.clientLaunch
    ? detectSteamClientLaunchFailure({
        consoleLog: args.consoleLog || defaultSteamLog("console_log.txt"),
        webhelperLog: args.webhelperLog || defaultSteamLog("webhelper.txt"),
        gameprocessLog: args.gameprocessLog || defaultSteamLog("gameprocess_log.txt"),
        consoleStartOffset: args.consoleStartOffset,
        webhelperStartOffset: args.webhelperStartOffset,
        gameprocessStartOffset: args.gameprocessStartOffset,
        gameId: args.gameId || "",
        appName: args.appName || "Steam Bridge Smoke"
      })
    : detectSteamOverlayIpcFailure({
        resultFile: requiredArg(args, "resultFile", "--result-file"),
        consoleLog: args.consoleLog || defaultSteamLog("console_log.txt"),
        appId: String(args.appId || "480")
      });

  if (!result.detected) {
    process.exit(1);
  }

  if (args.writeArtifact && args.diagnosticDir) {
    fs.mkdirSync(args.diagnosticDir, { recursive: true });
    const artifactName = args.clientLaunch ? clientLaunchArtifactName : overlayIpcArtifactName;
    fs.writeFileSync(path.join(args.diagnosticDir, artifactName), result.message);
  }

  if (!args.quiet) {
    process.stderr.write(result.message);
  }
}

function detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId }) {
  const smokeResult = readSmokeResult(resultFile);
  if (!smokeResult) {
    return { detected: false, message: "" };
  }

  const pid = smokeResult?.snapshot?.process?.pid;
  if (!Number.isInteger(pid) || pid <= 0 || !fs.existsSync(consoleLog)) {
    return { detected: false, message: "" };
  }

  const lines = fs.readFileSync(consoleLog, "utf8").split(/\r?\n/);
  const pidText = String(pid);
  const overlayEnabled = smokeResult?.snapshot?.steam?.overlayEnabled?.value;
  const overlayTargets = Array.isArray(smokeResult?.snapshot?.overlayProcesses?.gameoverlayui)
    ? smokeResult.snapshot.overlayProcesses.gameoverlayui
    : [];
  const firstPidLine = lines.findIndex((line) => line.includes(`ProcID ${pidText}`) || line.includes(`game process ${pidText}`));
  const scanStart = firstPidLine >= 0 ? Math.max(0, firstPidLine - 20) : Math.max(0, lines.length - 500);
  const steamGameStream = `SteamGameStream_${pidText}`;
  const steamOverlayRunning = `SteamOverlayRunning_${appId}`;
  const interesting = [];
  let overlayStartsForPid = 0;
  let hasIpcFailure = false;

  for (let index = scanStart; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes("GameOverlay: started") && line.includes(`game process ${pidText}`)) {
      overlayStartsForPid += 1;
      interesting.push(line);
      continue;
    }

    const relatedToCurrentProcess =
      line.includes(steamGameStream) ||
      line.includes(steamOverlayRunning) ||
      line.includes(`game process ${pidText}`) ||
      line.includes(`ProcID ${pidText}`);
    const isIpcFailure =
      /Failed to create (?:BinarySemaphore|Posix(?:Mutex|AutoResetEvent))/.test(line) ||
      /errno:\s*28\b/.test(line);
    if (relatedToCurrentProcess && isIpcFailure) {
      hasIpcFailure = true;
      interesting.push(line);
      const nextLine = lines[index + 1] || "";
      if (/errno:\s*28\b/.test(nextLine)) {
        interesting.push(nextLine);
      }
    }
  }

  const detected =
    hasIpcFailure ||
    (overlayStartsForPid > 1 && overlayTargets.length === 0 && overlayEnabled === false);

  if (!detected) {
    return { detected: false, message: "" };
  }

  const uniqueLines = [...new Set(interesting)].slice(-16);
  const messageLines = [
    `Steam overlay IPC/resource failure detected for smoke PID ${pidText}.`,
    `Steam overlay enabled=${format(overlayEnabled)}, live gameoverlayui targets=${overlayTargets.length}, gameoverlayui launches for this PID=${overlayStartsForPid}.`,
    "Steam started or attempted to start overlay UI, but its IPC resources failed or the helper exited before the smoke snapshot could observe a live overlay target.",
    "This is a Steam client state failure; recover by fully quitting Steam and clearing stale Steam IPC state or rebooting macOS before re-running overlay proof.",
    "",
    "Relevant Steam console log lines:",
    ...(uniqueLines.length > 0 ? uniqueLines.map((line) => `  ${line}`) : ["  (none captured)"])
  ];

  return { detected: true, message: `${messageLines.join("\n")}\n` };
}

function detectSteamClientLaunchFailure({
  consoleLog,
  webhelperLog,
  gameprocessLog,
  consoleStartOffset,
  webhelperStartOffset,
  gameprocessStartOffset,
  gameId,
  appName
}) {
  const logs = [
    {
      name: "console_log.txt",
      lines: readLinesFromOffset(consoleLog, consoleStartOffset)
    },
    {
      name: "webhelper.txt",
      lines: readLinesFromOffset(webhelperLog, webhelperStartOffset)
    },
    {
      name: "gameprocess_log.txt",
      lines: readLinesFromOffset(gameprocessLog, gameprocessStartOffset)
    }
  ];
  const interesting = [];
  let hasSteamChromeIpcFailure = false;
  let hasLaunchGateFailure = false;
  let hasFatalPipe = false;
  let hasSteamIdZero = false;
  let hasGameprocessStart = false;

  for (const log of logs) {
    for (let index = 0; index < log.lines.length; index += 1) {
      const line = log.lines[index];
      const sourceLine = `${log.name}: ${line}`;

      if (
        /AppID .* adding PID/.test(line) ||
        /Game process added/.test(line) ||
        (appName && line.includes(appName) && /adding PID|Game process/.test(line))
      ) {
        hasGameprocessStart = true;
      }

      if (
        /SteamChrome_(?:MasterStream|ClientStream)/.test(line) &&
        (
          /Failed to create PosixAutoResetEvent/.test(line) ||
          /Failed creating (?:read|write) event/.test(line) ||
          /Collided with existing master response stream/.test(line)
        )
      ) {
        hasSteamChromeIpcFailure = true;
        interesting.push(sourceLine);
        const nextLine = log.lines[index + 1] || "";
        if (/errno:\s*28\b/.test(nextLine)) {
          interesting.push(`${log.name}: ${nextLine}`);
        }
        continue;
      }

      if (/m_pMasterMemStream->BCreatedStream/.test(line)) {
        hasSteamChromeIpcFailure = true;
        interesting.push(sourceLine);
        continue;
      }

      if (/fatal stalled cross-thread pipe|Fatal assert; application exiting/.test(line)) {
        hasFatalPipe = true;
        interesting.push(sourceLine);
        continue;
      }

      if (/rungameid\s*:\s*not allowed yet/i.test(line)) {
        hasLaunchGateFailure = true;
        interesting.push(sourceLine);
        continue;
      }

      if (/Startup - webhelper launched/.test(line) && /-steamid=0\b/.test(line)) {
        hasSteamIdZero = true;
        interesting.push(sourceLine);
      }
    }
  }

  const detected = !hasGameprocessStart && (hasSteamChromeIpcFailure || hasLaunchGateFailure || hasFatalPipe || hasSteamIdZero);
  if (!detected) {
    return { detected: false, message: "" };
  }

  const labels = [];
  if (hasSteamChromeIpcFailure) {
    labels.push("SteamChrome IPC resource creation failed");
  }
  if (hasLaunchGateFailure) {
    labels.push("Steam refused rungameid dispatch");
  }
  if (hasFatalPipe) {
    labels.push("Steam helper pipe disconnected");
  }
  if (hasSteamIdZero) {
    labels.push("Steam webhelper launched before a logged-in steamid was available");
  }

  const uniqueLines = [...new Set(interesting)].slice(-24);
  const messageLines = [
    "Steam client launch/bootstrap failure detected before the smoke app started.",
    `Detected: ${labels.join("; ")}.`,
    `Shortcut game ID: ${gameId || "unknown"}. App name: ${appName || "unknown"}.`,
    "Steam did not write a gameprocess tracking entry for the smoke app after the launch attempt, so this is not a native presenter or Electron overlay failure.",
    "Recover the local Steam client state before re-running live overlay proof: fully quit Steam, wait for helper processes to exit, and if the SteamChrome IPC errors continue, log out/reboot macOS to clear Steam's named IPC resources.",
    "",
    "Relevant Steam log lines captured during the launch attempt:",
    ...(uniqueLines.length > 0 ? uniqueLines.map((line) => `  ${line}`) : ["  (none captured)"])
  ];

  return { detected: true, message: `${messageLines.join("\n")}\n` };
}

function detectSteamClientHealth({ processListText, consoleLog, webhelperLog, resourceSnapshot = null }) {
  const processLines = String(processListText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const steamProcess = findSteamProcess(processLines);
  const bootstrapHelpers = processLines.filter((line) => line.includes("Steam Helper") && line.includes("-nocrashdialog"));
  const helperSteamIds = bootstrapHelpers
    .map((line) => {
      const match = line.match(/-steamid=(\d+)\b/);
      return match ? match[1] : "";
    })
    .filter(Boolean);
  const currentSteamPid = steamProcess ? steamProcess.pid : "";
  const logMatches = findCurrentSteamClientLogFailures({
    consoleLog,
    webhelperLog,
    currentSteamPid
  });
  const failures = [];
  const observations = [];

  if (!steamProcess) {
    observations.push("Steam is not currently running; no unhealthy client process was detected.");
  } else {
    observations.push(`Steam process PID ${steamProcess.pid} is running.`);
  }

  if (helperSteamIds.length > 0) {
    observations.push(`Steam bootstrap helper steamid values: ${helperSteamIds.join(", ")}.`);
  } else if (steamProcess) {
    observations.push("No running Steam bootstrap helper with a steamid was found.");
  }

  if (steamProcess && helperSteamIds.length > 0 && helperSteamIds.every((steamId) => steamId === "0")) {
    failures.push("Steam bootstrap helper is running with steamid=0.");
  }

  if (logMatches.length > 0) {
    failures.push("Current Steam client logs contain SteamChrome IPC/bootstrap failures.");
  }

  const resourceLines = formatClientHealthResourceSnapshot(resourceSnapshot);

  if (failures.length === 0) {
    return {
      ok: true,
      message: [
        "macOS Steam client health check passed.",
        ...observations,
        "No running steamid=0 bootstrap helper or current SteamChrome IPC failure was detected.",
        ...resourceLines,
        ""
      ].join("\n")
    };
  }

  const messageLines = [
    "macOS Steam client health check failed.",
    ...failures.map((failure) => `- ${failure}`),
    "",
    ...observations,
    "Recover the local Steam client before running live overlay proof: fully quit Steam, wait for helper processes to exit, and if the SteamChrome IPC errors continue, log out/reboot macOS.",
    ...resourceLines,
    "",
    "Relevant current Steam log lines:",
    ...(logMatches.length > 0 ? logMatches.map((line) => `  ${line}`) : ["  (none captured)"])
  ];

  return { ok: false, message: `${messageLines.join("\n")}\n` };
}

function collectClientHealthResourceSnapshot({ processListText }) {
  const processLines = String(processListText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const steamProcess = findSteamProcess(processLines);
  const snapshot = {
    staleSteamChromeTempEntries: countSteamChromeTempEntries(),
    privateTmpDisk: readCommandLines("df", ["-k", "/private/tmp"], { timeoutMs: 3000, maxBuffer: 64 * 1024 }),
    launchctlMaxfiles: readCommandLines("launchctl", ["limit", "maxfiles"], { timeoutMs: 3000, maxBuffer: 64 * 1024 }),
    sysctlFiles: readCommandLines("sysctl", ["kern.num_files", "kern.maxfiles", "kern.maxfilesperproc"], {
      timeoutMs: 3000,
      maxBuffer: 64 * 1024
    }),
    allPosixIpc: countPosixIpcForCommand(["-nP"], { timeoutMs: 5000, maxBuffer: 4 * 1024 * 1024 }),
    steamProcess: null
  };

  if (steamProcess) {
    const steamLsof = readCommandLines("lsof", ["-nP", "-p", steamProcess.pid], {
      timeoutMs: 5000,
      maxBuffer: 4 * 1024 * 1024
    });
    snapshot.steamProcess = {
      pid: steamProcess.pid,
      openFileCount: steamLsof.ok ? Math.max(0, steamLsof.lines.length - 1) : null,
      posixIpc: countPosixIpcFromLines(steamLsof.ok ? steamLsof.lines : []),
      lsofError: steamLsof.ok ? "" : steamLsof.error
    };
  }

  return snapshot;
}

function formatClientHealthResourceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return [];
  }

  const lines = ["", "Local resource snapshot:"];
  if (Number.isInteger(snapshot.staleSteamChromeTempEntries)) {
    lines.push(`  stale SteamChrome temp entries in /private/tmp: ${snapshot.staleSteamChromeTempEntries}`);
  }
  if (snapshot.steamProcess) {
    const steam = snapshot.steamProcess;
    lines.push(`  Steam process open file count: ${formatNullableNumber(steam.openFileCount)}`);
    if (steam.posixIpc) {
      lines.push(
        `  Steam process POSIX IPC handles: semaphores=${formatNullableNumber(steam.posixIpc.semaphores)}, sharedMemory=${formatNullableNumber(steam.posixIpc.sharedMemory)}`
      );
    }
    if (steam.lsofError) {
      lines.push(`  Steam process lsof error: ${steam.lsofError}`);
    }
  }
  if (snapshot.allPosixIpc) {
    lines.push(
      `  all-process POSIX IPC handles visible to lsof: semaphores=${formatNullableNumber(snapshot.allPosixIpc.semaphores)}, sharedMemory=${formatNullableNumber(snapshot.allPosixIpc.sharedMemory)}`
    );
    if (snapshot.allPosixIpc.error) {
      lines.push(`  all-process lsof error: ${snapshot.allPosixIpc.error}`);
    }
  }
  appendCommandSummary(lines, "launchctl maxfiles", snapshot.launchctlMaxfiles);
  appendCommandSummary(lines, "kernel file counters", snapshot.sysctlFiles);
  appendCommandSummary(lines, "/private/tmp disk", snapshot.privateTmpDisk);

  const warnings = buildClientHealthResourceWarnings(snapshot);
  if (warnings.length > 0) {
    lines.push("", "Resource warnings:", ...warnings.map((warning) => `  - ${warning}`));
  }
  return lines;
}

function buildClientHealthResourceWarnings(snapshot) {
  const warnings = [];
  const maxfilesSoft = parseLaunchctlMaxfilesSoft(snapshot.launchctlMaxfiles);
  const steamOpenFiles =
    snapshot.steamProcess && Number.isFinite(snapshot.steamProcess.openFileCount)
      ? snapshot.steamProcess.openFileCount
      : null;
  const steamOpenFileRatio =
    steamOpenFiles !== null && maxfilesSoft !== null && maxfilesSoft !== Infinity
      ? steamOpenFiles / maxfilesSoft
      : null;
  const privateTmpCapacity = parseDfCapacityPercent(snapshot.privateTmpDisk);

  if (maxfilesSoft !== null && maxfilesSoft !== Infinity && maxfilesSoft <= 512) {
    warnings.push(
      `launchctl maxfiles soft limit is low (${maxfilesSoft}); Steam GUI helpers inherit this limit.`
    );
  }
  if (steamOpenFileRatio !== null && steamOpenFileRatio >= 0.8) {
    warnings.push(
      `Steam process is using ${steamOpenFiles}/${maxfilesSoft} open files (${Math.round(steamOpenFileRatio * 100)}% of the soft maxfiles limit).`
    );
  }
  if (Number.isInteger(snapshot.staleSteamChromeTempEntries) && snapshot.staleSteamChromeTempEntries >= 100) {
    warnings.push(
      `${snapshot.staleSteamChromeTempEntries} stale SteamChrome temp entries remain in /private/tmp.`
    );
  }
  if (privateTmpCapacity !== null && privateTmpCapacity >= 95) {
    warnings.push(`/private/tmp volume is ${privateTmpCapacity}% full.`);
  }

  return warnings;
}

function appendCommandSummary(lines, label, result) {
  if (!result || typeof result !== "object") {
    return;
  }
  if (!result.ok) {
    if (result.error) {
      lines.push(`  ${label}: ${result.error}`);
    }
    return;
  }
  const summary = result.lines.map((line) => line.trim()).filter(Boolean).join(" | ");
  if (summary) {
    lines.push(`  ${label}: ${summary}`);
  }
}

function countSteamChromeTempEntries() {
  const tmpRoot = "/private/tmp";
  let count = 0;
  try {
    for (const name of fs.readdirSync(tmpRoot)) {
      if (/^steam_chrome_(?:overlay|shmem)_uid\d+_spid\d+$/.test(name)) {
        count += 1;
      }
    }
  } catch {
    return null;
  }
  return count;
}

function countPosixIpcForCommand(args, { timeoutMs, maxBuffer }) {
  const result = readCommandLines("lsof", args, { timeoutMs, maxBuffer });
  if (!result.ok) {
    return { semaphores: null, sharedMemory: null, error: result.error };
  }
  return countPosixIpcFromLines(result.lines);
}

function countPosixIpcFromLines(lines) {
  let semaphores = 0;
  let sharedMemory = 0;
  for (const line of lines) {
    if (/\bPSXSEM\b/.test(line)) {
      semaphores += 1;
    }
    if (/\bPSXSHM\b/.test(line)) {
      sharedMemory += 1;
    }
  }
  return { semaphores, sharedMemory };
}

function readCommandLines(command, args, { timeoutMs, maxBuffer }) {
  try {
    const output = childProcess.execFileSync(command, args, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer
    });
    return {
      ok: true,
      lines: output.split(/\r?\n/).filter((line) => line.length > 0),
      error: ""
    };
  } catch (error) {
    return {
      ok: false,
      lines: [],
      error: error && error.message ? error.message : String(error)
    };
  }
}

function formatNullableNumber(value) {
  return Number.isFinite(value) ? String(value) : "unknown";
}

function parseLaunchctlMaxfilesSoft(result) {
  if (!result || !result.ok || !Array.isArray(result.lines)) {
    return null;
  }
  const line = result.lines.find((entry) => /\bmaxfiles\b/.test(entry));
  if (!line) {
    return null;
  }
  const match = line.match(/\bmaxfiles\s+(\d+|unlimited)\b/);
  if (!match) {
    return null;
  }
  return match[1] === "unlimited" ? Infinity : Number(match[1]);
}

function parseDfCapacityPercent(result) {
  if (!result || !result.ok || !Array.isArray(result.lines)) {
    return null;
  }
  for (const line of [...result.lines].reverse()) {
    const match = line.match(/\b(\d+)%\b/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

function findSteamProcess(processLines) {
  for (const line of processLines) {
    if (!/Steam\.AppBundle\/Steam\/Contents\/MacOS\/steam_osx\b/.test(line)) {
      continue;
    }
    const pid = readProcessLinePid(line);
    if (pid) {
      return { pid, line };
    }
  }
  return null;
}

function findCurrentSteamClientLogFailures({ consoleLog, webhelperLog, currentSteamPid }) {
  if (!currentSteamPid) {
    return [];
  }
  const pidPattern = new RegExp(`spid${escapeRegExp(currentSteamPid)}(?:\\b|_)`);
  const logs = [
    { name: "console_log.txt", lines: readLastLines(consoleLog, 400) },
    { name: "webhelper.txt", lines: readLastLines(webhelperLog, 400) }
  ];
  const matches = [];

  for (const log of logs) {
    for (let index = 0; index < log.lines.length; index += 1) {
      const line = log.lines[index];
      if (
        pidPattern.test(line) &&
        (
          /SteamChrome_(?:MasterStream|ClientStream)/.test(line) ||
          /m_pMasterMemStream->BCreatedStream/.test(line)
        )
      ) {
        matches.push(`${log.name}: ${line}`);
        const nextLine = log.lines[index + 1] || "";
        if (/errno:\s*28\b/.test(nextLine)) {
          matches.push(`${log.name}: ${nextLine}`);
        }
      }
    }
  }

  return [...new Set(matches)].slice(-24);
}

function readSmokeResult(file) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const line = text
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.startsWith(resultPrefix));
  if (!line) {
    return null;
  }
  try {
    return JSON.parse(line.slice(resultPrefix.length));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--result-file":
        args.resultFile = argv[++index];
        break;
      case "--diagnostic-dir":
        args.diagnosticDir = argv[++index];
        break;
      case "--console-log":
        args.consoleLog = argv[++index];
        break;
      case "--webhelper-log":
        args.webhelperLog = argv[++index];
        break;
      case "--gameprocess-log":
        args.gameprocessLog = argv[++index];
        break;
      case "--process-list-file":
        args.processListFile = argv[++index];
        break;
      case "--console-start-offset":
        args.consoleStartOffset = Number(argv[++index] || "0");
        break;
      case "--webhelper-start-offset":
        args.webhelperStartOffset = Number(argv[++index] || "0");
        break;
      case "--gameprocess-start-offset":
        args.gameprocessStartOffset = Number(argv[++index] || "0");
        break;
      case "--game-id":
        args.gameId = argv[++index];
        break;
      case "--app-name":
        args.appName = argv[++index];
        break;
      case "--app-id":
        args.appId = argv[++index];
        break;
      case "--quiet":
        args.quiet = true;
        break;
      case "--write-artifact":
        args.writeArtifact = true;
        break;
      case "--client-launch":
        args.clientLaunch = true;
        break;
      case "--client-health":
        args.clientHealth = true;
        break;
      case "--self-test":
        args.selfTest = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

function requiredArg(args, key, flag) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing ${flag}`);
  }
  return value;
}

function defaultSteamLog(name) {
  return path.join(os.homedir(), "Library", "Application Support", "Steam", "logs", name);
}

function readOptionalText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readProcessList() {
  try {
    return childProcess.execFileSync("ps", ["ax", "-o", "pid=,args="], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
  } catch {
    return "";
  }
}

function readLinesFromOffset(file, startOffset) {
  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch {
    return [];
  }
  const offset = Number.isFinite(startOffset) && startOffset > 0 ? Math.floor(startOffset) : 0;
  const boundedOffset = offset <= buffer.length ? offset : 0;
  return buffer
    .subarray(boundedOffset)
    .toString("utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

function readLastLines(file, limit) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).slice(-limit);
  } catch {
    return [];
  }
}

function readProcessLinePid(line) {
  const match = String(line || "").match(/^(\d+)\s+/);
  return match ? match[1] : "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function format(value) {
  return value == null ? "unknown" : JSON.stringify(value);
}

function runSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-macos-ipc-detector-"));
  try {
    const resultFile = path.join(tempRoot, "result.log");
    const consoleLog = path.join(tempRoot, "console_log.txt");
    const webhelperLog = path.join(tempRoot, "webhelper.txt");
    const gameprocessLog = path.join(tempRoot, "gameprocess_log.txt");
    const diagnosticDir = path.join(tempRoot, "diagnostics");

    writeResult(resultFile, {
      snapshot: {
        process: { pid: 4242 },
        steam: { overlayEnabled: { value: false } },
        overlayProcesses: { gameoverlayui: [] }
      }
    });
    fs.writeFileSync(
      consoleLog,
      [
        "[2026-06-30 18:07:56] Game process added : AppID 480 \"\", ProcID 4242, IP 0.0.0.0:0",
        "[2026-06-30 18:07:56] Failed to create PosixMutex: SteamGameStream_4242_mutex - /MTX/5a1c8ccf",
        "[2026-06-30 18:07:57] GameOverlay: started '/Steam/gameoverlayui' (pid 5001) for game process 4242"
      ].join("\n")
    );
    let result = detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId: "480" });
    assert(result.detected, "detects per-process PosixMutex failures");
    assert(result.message.includes("SteamGameStream_4242_mutex"), "includes matched SteamGameStream line");

    fs.writeFileSync(
      consoleLog,
      [
        "[2026-06-30 18:07:57] GameOverlay: started '/Steam/gameoverlayui' (pid 5001) for game process 4242",
        "[2026-06-30 18:07:58] GameOverlay: started '/Steam/gameoverlayui' (pid 5002) for game process 4242"
      ].join("\n")
    );
    result = detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId: "480" });
    assert(result.detected, "detects repeated overlay launches with no live target");

    writeResult(resultFile, {
      snapshot: {
        process: { pid: 4242 },
        steam: { overlayEnabled: { value: true } },
        overlayProcesses: { gameoverlayui: [{ pid: 5001, targetPid: 4242, gameId: "480" }] }
      }
    });
    result = detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId: "480" });
    assert(!result.detected, "does not flag a live overlay target");

    writeResult(resultFile, {
      snapshot: {
        process: { pid: 4242 },
        steam: { overlayEnabled: { value: false } },
        overlayProcesses: { gameoverlayui: [] }
      }
    });
    fs.writeFileSync(
      consoleLog,
      [
        "[2026-06-30 18:07:56] Game process added : AppID 480 \"\", ProcID 4242, IP 0.0.0.0:0",
        "[2026-06-30 18:07:56] Failed to create BinarySemaphore: SteamOverlayRunning_480.BinSemLock - /BSem/cca47a3f",
        "[2026-06-30 18:07:56]\terrno: 28, bCreator: false"
      ].join("\n")
    );
    result = detectSteamOverlayIpcFailure({ resultFile, consoleLog, appId: "480" });
    assert(result.detected, "detects app overlay semaphore failures");

    const artifactMessage = result.message;
    fs.mkdirSync(diagnosticDir, { recursive: true });
    fs.writeFileSync(path.join(diagnosticDir, "steam-overlay-ipc-diagnostics.txt"), artifactMessage);
    assert(
      fs.readFileSync(path.join(diagnosticDir, overlayIpcArtifactName), "utf8").includes("Steam overlay IPC"),
      "writes artifact-compatible message"
    );

    const stalePrefix = "[2026-06-30 18:00:00] harmless old line\n";
    fs.writeFileSync(consoleLog, stalePrefix + "[2026-06-30 19:17:08] src/common/html/chrome_ipc_server.cpp (75) : m_pMasterMemStream->BCreatedStream()\n");
    fs.writeFileSync(
      webhelperLog,
      stalePrefix +
        [
          "[2026-06-30 19:17:08] Startup - webhelper launched pid: 9913 commandline: Steam Helper -steamid=0",
          "[2026-06-30 19:17:08] Failed to create PosixAutoResetEvent: SteamChrome_MasterStream_uid501_spid9706_avail - /Evt/5c7dd281",
          "[2026-06-30 19:17:08] \terrno: 28, bCreator: true",
          "[2026-06-30 19:17:19] src/common/pipes.cpp (900) : fatal stalled cross-thread pipe (pipe is disconnected)."
        ].join("\n")
    );
    fs.writeFileSync(gameprocessLog, stalePrefix);
    result = detectSteamClientLaunchFailure({
      consoleLog,
      webhelperLog,
      gameprocessLog,
      consoleStartOffset: Buffer.byteLength(stalePrefix),
      webhelperStartOffset: Buffer.byteLength(stalePrefix),
      gameprocessStartOffset: Buffer.byteLength(stalePrefix),
      gameId: "15338446133907161088",
      appName: "Steam Bridge Smoke"
    });
    assert(result.detected, "detects SteamChrome IPC failure before gameprocess launch");
    assert(result.message.includes("SteamChrome_MasterStream"), "includes matched SteamChrome line");
    assert(result.message.includes("steamid"), "includes login/bootstrap hint");

    fs.writeFileSync(
      gameprocessLog,
      stalePrefix + '[2026-06-30 19:17:09] AppID 480 adding PID 12345 as a tracked process "SteamBridgeSmoke"\n'
    );
    result = detectSteamClientLaunchFailure({
      consoleLog,
      webhelperLog,
      gameprocessLog,
      consoleStartOffset: Buffer.byteLength(stalePrefix),
      webhelperStartOffset: Buffer.byteLength(stalePrefix),
      gameprocessStartOffset: Buffer.byteLength(stalePrefix),
      gameId: "15338446133907161088",
      appName: "Steam Bridge Smoke"
    });
    assert(!result.detected, "does not report client-launch failure after Steam tracks the smoke process");

    fs.writeFileSync(consoleLog, stalePrefix + "[2026-06-30 19:17:08] rungameid : not allowed yet\n");
    fs.writeFileSync(webhelperLog, stalePrefix);
    fs.writeFileSync(gameprocessLog, stalePrefix);
    result = detectSteamClientLaunchFailure({
      consoleLog,
      webhelperLog,
      gameprocessLog,
      consoleStartOffset: Buffer.byteLength(stalePrefix),
      webhelperStartOffset: Buffer.byteLength(stalePrefix),
      gameprocessStartOffset: Buffer.byteLength(stalePrefix),
      gameId: "15338446133907161088",
      appName: "Steam Bridge Smoke"
    });
    assert(result.detected, "detects rungameid launch-gate failures");

    fs.writeFileSync(
      webhelperLog,
      [
        "[2026-06-30 19:23:09] Failed to create PosixAutoResetEvent: SteamChrome_MasterStream_uid501_spid9706_avail - /Evt/5c7dd281",
        "[2026-06-30 19:23:09] \terrno: 28, bCreator: true"
      ].join("\n")
    );
    result = detectSteamClientHealth({
      processListText: [
        " 9706 /Users/example/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steam_osx",
        " 9913 /Users/example/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/Frameworks/Steam Helper.app/Contents/MacOS/Steam Helper -nocrashdialog -steamid=0 -steampid=9706"
      ].join("\n"),
      consoleLog,
      webhelperLog,
      resourceSnapshot: {
        staleSteamChromeTempEntries: 12,
        privateTmpDisk: { ok: true, lines: ["Filesystem 1024-blocks Used Available Capacity Mounted on", "/dev/disk3s5 100 80 20 80% /System/Volumes/Data"] },
        launchctlMaxfiles: { ok: true, lines: ["maxfiles    256            unlimited"] },
        sysctlFiles: { ok: true, lines: ["kern.num_files: 100", "kern.maxfiles: 1000", "kern.maxfilesperproc: 512"] },
        allPosixIpc: { semaphores: 122, sharedMemory: 22 },
        steamProcess: {
          pid: "9706",
          openFileCount: 213,
          posixIpc: { semaphores: 100, sharedMemory: 10 },
          lsofError: ""
        }
      }
    });
    assert(!result.ok, "detects running steamid=0 helper health failure");
    assert(result.message.includes("steamid=0"), "health failure names steamid=0");
    assert(result.message.includes("SteamChrome_MasterStream"), "health failure includes current IPC evidence");
    assert(result.message.includes("Local resource snapshot"), "health failure includes resource snapshot");
    assert(result.message.includes("stale SteamChrome temp entries"), "health failure includes stale SteamChrome temp count");
    assert(result.message.includes("launchctl maxfiles"), "health failure includes launchctl maxfiles");
    assert(result.message.includes("Resource warnings"), "health failure includes derived resource warnings");
    assert(result.message.includes("213/256 open files"), "health failure warns on near-soft-limit file usage");

    result = detectSteamClientHealth({
      processListText: "",
      consoleLog,
      webhelperLog
    });
    assert(result.ok, "closed Steam is not an unhealthy running client state");

    result = detectSteamClientHealth({
      processListText: [
        " 9706 /Users/example/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steam_osx",
        " 9913 /Users/example/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/Frameworks/Steam Helper.app/Contents/MacOS/Steam Helper -nocrashdialog -steamid=123456 -steampid=9706"
      ].join("\n"),
      consoleLog: path.join(tempRoot, "missing-console-log.txt"),
      webhelperLog: path.join(tempRoot, "missing-webhelper-log.txt")
    });
    assert(result.ok, "logged-in helper without current IPC logs is healthy");

    console.log("macOS Steam overlay IPC detector self-test passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeResult(file, payload) {
  fs.writeFileSync(file, `${resultPrefix}${JSON.stringify(payload)}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
