#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function main(args = process.argv.slice(2)) {
  const status = runCli(args);
  if (status !== 0) {
    process.exit(status);
  }
}

function runCli(args, io = console) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    io.error(error.message);
    printUsage(io);
    return 2;
  }

  if (options.help) {
    printUsage(io);
    return 0;
  }

  if (options.selfTest) {
    try {
      runSelfTest();
    } catch (error) {
      io.error(error.message);
      return 1;
    }
    io.log("Steam checkout target validator self-test passed.");
    return 0;
  }

  if (!options.file) {
    io.error("missing --file value");
    printUsage(io);
    return 2;
  }

  try {
    const result = validateCheckoutTargetFile(options);
    if (!options.quiet) {
      io.log(JSON.stringify(result));
    }
  } catch (error) {
    io.error(`Invalid checkout target JSON (${error.message})`);
    return 2;
  }

  return 0;
}

function parseArgs(args) {
  const options = {
    file: "",
    modal: undefined,
    returnUrl: "",
    quiet: false,
    selfTest: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--self-test":
        options.selfTest = true;
        break;
      case "--file":
        index = readValueArg(args, index, arg, (value) => {
          options.file = value;
        });
        break;
      case "--modal":
        index = readValueArg(args, index, arg, (value) => {
          options.modal = parseBooleanOption(value, arg);
        });
        break;
      case "--return-url":
        index = readValueArg(args, index, arg, (value) => {
          options.returnUrl = value;
        });
        break;
      case "--quiet":
        options.quiet = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`unknown option: ${arg}`);
        }
        if (options.file) {
          throw new Error(`unexpected argument: ${arg}`);
        }
        options.file = arg;
        break;
    }
  }

  return options;
}

function readValueArg(args, index, name, assign) {
  const nextIndex = index + 1;
  if (!args[nextIndex]) {
    throw new Error(`missing ${name} value`);
  }
  assign(args[nextIndex]);
  return nextIndex;
}

function parseBooleanOption(value, name) {
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  throw new Error(`invalid ${name} value`);
}

function printUsage(io = console) {
  io.error(`Usage:
  steam-bridge-validate-checkout-target --file PATH [options]
  steam-bridge-validate-checkout-target --self-test

Validates that a private Steam InitTxn/checkout response JSON file can be
resolved into a Steam Bridge checkout target without printing private checkout
values.

Options:
  --file PATH       JSON file containing an InitTxn response, checkout URL,
                    transaction ID, or checkout target object.
  --modal VALUE     Default modal flag for the resolved checkout target:
                    true, false, 1, or 0.
  --return-url URL  Default return URL used only for target resolution.
  --quiet           Validate without printing the sanitized target snapshot.
`);
}

function validateCheckoutTargetFile(options) {
  const parsed = readCheckoutTargetJson(options.file);
  const steamBridge = require(path.join(__dirname, "..", "dist", "index.js"));
  const defaults = {};
  if (typeof options.modal === "boolean") {
    defaults.modal = options.modal;
  }
  if (typeof options.returnUrl === "string" && options.returnUrl.length > 0) {
    defaults.returnUrl = options.returnUrl;
  }

  let snapshot;
  try {
    const target = steamBridge.overlay.checkoutTargetFromResult(parsed, defaults);
    snapshot = steamBridge.overlay.snapshotSteamOverlayTarget(target);
  } catch {
    throw new Error(
      "checkout JSON must contain a checkout URL, Steam checkout URL, transaction ID, or InitTxn response envelope"
    );
  }

  if (
    snapshot.type !== "checkout" ||
    !(
      snapshot.hasSteamUrl === true ||
      snapshot.hasUrl === true ||
      snapshot.hasTransactionId === true
    )
  ) {
    throw new Error(
      "checkout JSON must contain a checkout URL, Steam checkout URL, transaction ID, or InitTxn response envelope"
    );
  }

  return {
    ok: true,
    targetSnapshot: snapshot
  };
}

function readCheckoutTargetJson(filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    throw new Error("file is missing or unreadable");
  }
  if (!stat.isFile()) {
    throw new Error("not a regular file");
  }

  let contents;
  try {
    contents = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new Error("file is unreadable");
  }

  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("file must contain valid JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON root must be an object");
  }

  return parsed;
}

function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-checkout-target-validator-"));
  try {
    const validFile = path.join(tempDir, "valid.json");
    const invalidFile = path.join(tempDir, "invalid.json");
    const rawTransactionId = "246813579";
    const rawReturnUrl = "steam://return-from-private-proof";
    fs.writeFileSync(
      validFile,
      JSON.stringify({
        response: {
          result: "OK",
          params: {
            transid: rawTransactionId,
            steamurl: `https://checkout.steampowered.com/checkout/approvetxn/${rawTransactionId}/`,
            returnurl: rawReturnUrl
          }
        }
      })
    );
    fs.writeFileSync(
      invalidFile,
      JSON.stringify({
        response: {
          params: {
            returnurl: rawReturnUrl
          }
        }
      })
    );

    const valid = captureRun(["--file", validFile, "--modal", "false"]);
    assert.equal(valid.status, 0);
    const validOutput = valid.output.join("\n");
    assert.equal(validOutput.includes(rawTransactionId), false);
    assert.equal(validOutput.includes(rawReturnUrl), false);
    assert.equal(validOutput.includes(validFile), false);
    assert.deepEqual(JSON.parse(validOutput), {
      ok: true,
      targetSnapshot: {
        type: "checkout",
        modal: false,
        hasSteamUrl: true,
        hasTransactionId: true,
        hasReturnUrl: true
      }
    });

    const validQuiet = captureRun(["--file", validFile, "--quiet"]);
    assert.equal(validQuiet.status, 0);
    assert.equal(validQuiet.output.length, 0);

    const invalid = captureRun(["--file", invalidFile]);
    assert.equal(invalid.status, 2);
    assert.equal(invalid.errorOutput.join("\n").includes(rawReturnUrl), false);
    assert.equal(invalid.errorOutput.join("\n").includes(invalidFile), false);
    assert.match(invalid.errorOutput.join("\n"), /checkout JSON must contain a checkout URL/);

    const missingPath = path.join(tempDir, "missing-private-file.json");
    const missing = captureRun(["--file", missingPath]);
    assert.equal(missing.status, 2);
    assert.equal(missing.errorOutput.join("\n").includes(missingPath), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function captureRun(args) {
  const output = [];
  const errorOutput = [];
  const status = runCli(args, {
    log(message) {
      output.push(String(message));
    },
    error(message) {
      errorOutput.push(String(message));
    }
  });
  return { status, output, errorOutput };
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  runCli,
  validateCheckoutTargetFile
};
