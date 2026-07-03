#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_API_KEY_ENVS = ["STEAM_WEB_API_KEY", "STEAM_API_KEY"];

async function main(args = process.argv.slice(2)) {
  const status = await runCli(args);
  if (status !== 0) {
    process.exit(status);
  }
}

async function runCli(args, io = console, deps = {}) {
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
      await runSelfTest();
    } catch (error) {
      io.error(error.message);
      return 1;
    }
    io.log("Steam InitTxn capture self-test passed.");
    return 0;
  }

  try {
    const result = await captureInitTxn(options, deps);
    if (!options.quiet) {
      io.log(JSON.stringify(result));
    }
  } catch (error) {
    io.error(`Unable to capture InitTxn (${redactedErrorMessage(error)})`);
    return 2;
  }

  return 0;
}

function parseArgs(args) {
  const options = {
    file: "",
    out: "",
    session: "",
    sandbox: undefined,
    apiKeyEnv: "",
    quiet: false,
    allowTestAppId: false,
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
      case "--out":
        index = readValueArg(args, index, arg, (value) => {
          options.out = value;
        });
        break;
      case "--session":
        index = readValueArg(args, index, arg, (value) => {
          options.session = parseSessionOption(value);
        });
        break;
      case "--sandbox":
        options.sandbox = true;
        break;
      case "--production":
        options.sandbox = false;
        break;
      case "--api-key-env":
        index = readValueArg(args, index, arg, (value) => {
          options.apiKeyEnv = parseEnvironmentName(value, arg);
        });
        break;
      case "--allow-test-app-id":
        options.allowTestAppId = true;
        break;
      case "--quiet":
        options.quiet = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`unknown option: ${arg}`);
        }
        if (!options.file) {
          options.file = arg;
        } else if (!options.out) {
          options.out = arg;
        } else {
          throw new Error(`unexpected argument: ${arg}`);
        }
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

function parseSessionOption(value) {
  if (value === "client" || value === "web") {
    return value;
  }
  throw new Error("invalid --session value");
}

function parseEnvironmentName(value, name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`invalid ${name} value`);
  }
  return value;
}

function printUsage(io = console) {
  io.error(`Usage:
  steam-bridge-init-client-txn --file REQUEST.json --out RESPONSE.json [options]
  steam-bridge-init-client-txn --self-test

Creates a Steam MicroTxn InitTxn response JSON file for private checkout proof.
The response file can be passed to the Windows matrix with -CheckoutJsonFile.
Publisher keys are read from environment variables, never from command-line
arguments.

Options:
  --file PATH       JSON request with appId, orderId, steamId64, language,
                    currency, and items.
  --out PATH        Private output file for the InitTxn JSON response.
  --session VALUE   client or web. Defaults to request.session or client.
  --sandbox         Use ISteamMicroTxnSandbox.
  --production      Use ISteamMicroTxn.
  --api-key-env ENV Read the publisher key from ENV. Defaults to
                    STEAM_WEB_API_KEY or STEAM_API_KEY.
  --allow-test-app-id
                    Allow App ID 480 for dry plumbing experiments. Real
                    purchase proof should use a configured app/product.
  --quiet           Do not print the sanitized result JSON.

Request JSON shape:
  {
    "appId": 123,
    "orderId": "9001",
    "steamId64": "76561198000000000",
    "language": "en",
    "currency": "USD",
    "sandbox": true,
    "items": [
      { "itemId": 100, "quantity": 1, "amount": 199, "description": "Item" }
    ]
  }
`);
}

async function captureInitTxn(options, deps = {}) {
  if (!options.file) {
    throw new Error("missing --file value");
  }
  if (!options.out) {
    throw new Error("missing --out value");
  }

  const request = normalizeInitTxnRequest(readJsonFile(options.file));
  if (request.appId === 480 && !options.allowTestAppId) {
    throw new Error("App ID 480 only proves generic checkout routing; use a configured Steam app/product");
  }

  const env = deps.env ?? process.env;
  const apiKey = resolveApiKey(options, env);
  if (!apiKey) {
    throw new Error("missing publisher Web API key environment variable");
  }

  const steamBridge = deps.steamBridge ?? require(path.join(__dirname, "..", "dist", "index.js"));
  const client = steamBridge.createSteamWebApiClient({
    apiKey,
    fetch: deps.fetch
  });
  const sandbox = typeof options.sandbox === "boolean" ? options.sandbox : request.sandbox !== false;
  const session = options.session || request.session || "client";
  const facade = sandbox ? client.microTxnSandbox : client.microTxn;
  const response = session === "web"
    ? await facade.initWebTxn(request)
    : await facade.initClientTxn(request);

  if (!response.ok) {
    throw new Error("Steam Web API request failed");
  }

  const target = steamBridge.overlay.checkoutTargetFromResult(response.data, { expectedAppId: request.appId });
  const targetSnapshot = steamBridge.overlay.snapshotSteamOverlayTarget(target);
  if (
    targetSnapshot.type !== "checkout" ||
    !(
      targetSnapshot.hasSteamUrl === true ||
      targetSnapshot.hasUrl === true ||
      targetSnapshot.hasTransactionId === true
    )
  ) {
    throw new Error("InitTxn response did not resolve to a checkout target");
  }

  writePrivateJson(options.out, response.data);
  return {
    ok: true,
    endpoint: sandbox ? "ISteamMicroTxnSandbox" : "ISteamMicroTxn",
    session,
    appId: { present: true, checked: true },
    http: { status: response.status, ok: response.ok },
    targetSnapshot
  };
}

function resolveApiKey(options, env) {
  if (options.apiKeyEnv) {
    return env[options.apiKeyEnv] || "";
  }
  for (const name of DEFAULT_API_KEY_ENVS) {
    if (env[name]) {
      return env[name];
    }
  }
  return "";
}

function normalizeInitTxnRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("request JSON must be an object");
  }
  const appId = parsePositiveInteger(value.appId ?? value.appid, "appId");
  const request = {
    appId,
    orderId: parseRequiredScalar(value.orderId ?? value.orderid, "orderId"),
    steamId64: parseRequiredScalar(value.steamId64 ?? value.steamid ?? value.steamId, "steamId64"),
    language: parseRequiredString(value.language, "language"),
    currency: parseRequiredString(value.currency, "currency"),
    sandbox: typeof value.sandbox === "boolean" ? value.sandbox : undefined,
    session: value.session === undefined ? undefined : parseSessionOption(String(value.session)),
    ipAddress: value.ipAddress === undefined ? undefined : parseRequiredString(value.ipAddress, "ipAddress"),
    items: normalizeItems(value.items),
    bundles: value.bundles === undefined ? undefined : normalizeBundles(value.bundles)
  };
  return withoutUndefined(request);
}

function normalizeItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("items must be a non-empty array");
  }
  return value.map((item, index) => normalizeItem(item, index));
}

function normalizeItem(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`items[${index}] must be an object`);
  }
  return withoutUndefined({
    itemId: parseRequiredScalar(item.itemId ?? item.itemid, `items[${index}].itemId`),
    quantity: parsePositiveInteger(item.quantity ?? item.qty, `items[${index}].quantity`),
    amount: parseRequiredScalar(item.amount, `items[${index}].amount`),
    description: parseRequiredString(item.description, `items[${index}].description`),
    category: optionalString(item.category, `items[${index}].category`),
    associatedBundle: optionalPositiveInteger(
      item.associatedBundle ?? item.associated_bundle,
      `items[${index}].associatedBundle`
    ),
    billingType: optionalString(item.billingType ?? item.billingtype, `items[${index}].billingType`),
    period: optionalString(item.period, `items[${index}].period`),
    frequency: optionalPositiveInteger(item.frequency, `items[${index}].frequency`),
    recurringAmount: optionalScalar(item.recurringAmount ?? item.recurringamt, `items[${index}].recurringAmount`)
  });
}

function normalizeBundles(value) {
  if (!Array.isArray(value)) {
    throw new Error("bundles must be an array");
  }
  return value.map((bundle, index) => normalizeBundle(bundle, index));
}

function normalizeBundle(bundle, index) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new Error(`bundles[${index}] must be an object`);
  }
  return withoutUndefined({
    bundleId: parseRequiredScalar(bundle.bundleId ?? bundle.bundleid, `bundles[${index}].bundleId`),
    quantity: parsePositiveInteger(bundle.quantity ?? bundle.qty, `bundles[${index}].quantity`),
    description: parseRequiredString(bundle.description, `bundles[${index}].description`),
    category: optionalString(bundle.category, `bundles[${index}].category`)
  });
}

function parsePositiveInteger(value, name) {
  const stringValue = parseRequiredScalar(value, name);
  if (!/^\d+$/.test(stringValue)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const numberValue = Number(stringValue);
  if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return numberValue;
}

function optionalPositiveInteger(value, name) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return parsePositiveInteger(value, name);
}

function parseRequiredScalar(value, name) {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "bigint"
  ) {
    throw new Error(`${name} is required`);
  }
  const stringValue = String(value).trim();
  if (!stringValue) {
    throw new Error(`${name} is required`);
  }
  return stringValue;
}

function optionalScalar(value, name) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return parseRequiredScalar(value, name);
}

function parseRequiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function optionalString(value, name) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return parseRequiredString(value, name);
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

function readJsonFile(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error("input JSON file was not found");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("input JSON is not valid JSON");
  }
}

function writePrivateJson(file, value) {
  let fd;
  try {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fd = fs.openSync(file, "w", 0o600);
    fs.fchmodSync(fd, 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
  } catch {
    throw new Error("failed to write output JSON");
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd);
    }
  }
}

function redactedErrorMessage(error) {
  if (!error || typeof error.message !== "string") {
    return "unknown error";
  }
  return error.message
    .replace(/https?:\/\/\S+/g, "REDACTED_URL")
    .replace(/[A-Za-z]:\\[^\s]+/g, "REDACTED_PATH")
    .replace(/\/[^\s]+/g, "REDACTED_PATH");
}

async function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-init-txn-"));
  try {
    const inputFile = path.join(tempDir, "request.json");
    const outputFile = path.join(tempDir, "response.json");
    fs.writeFileSync(
      inputFile,
      JSON.stringify({
        appId: 480,
        orderId: "9001",
        steamId64: "76561198000000000",
        language: "en",
        currency: "USD",
        sandbox: true,
        items: [{ itemId: 100, quantity: 1, amount: 199, description: "Credits" }]
      })
    );
    fs.writeFileSync(outputFile, "old response\n");
    if (process.platform !== "win32") {
      fs.chmodSync(outputFile, 0o666);
    }

    const calls = [];
    const fetch = async (url, init = {}) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        headers: {
          forEach(callback) {
            callback("application/json", "content-type");
          }
        },
        async text() {
          return JSON.stringify({
            response: {
              result: "OK",
              params: {
                appid: 480,
                transid: "123456789",
                steamurl: "https://checkout.steampowered.com/checkout/approvetxn/123456789/"
              }
            }
          });
        }
      };
    };

    const capture = await captureRun(
      ["--file", inputFile, "--out", outputFile, "--allow-test-app-id"],
      { env: { STEAM_WEB_API_KEY: "publisher-secret" }, fetch }
    );
    assert.equal(capture.status, 0);
    const stdout = capture.output.join("\n");
    const output = JSON.parse(stdout);
    assert.equal(output.ok, true);
    assert.equal(output.endpoint, "ISteamMicroTxnSandbox");
    assert.equal(output.session, "client");
    assert.equal(output.targetSnapshot.hasSteamUrl, true);
    assert.equal(stdout.includes("publisher-secret"), false);
    assert.equal(stdout.includes(inputFile), false);
    assert.equal(stdout.includes(outputFile), false);
    assert.equal(stdout.includes("123456789"), false);
    assert.equal(fs.existsSync(outputFile), true);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(outputFile).mode & 0o777, 0o600);
    }
    assert.equal(JSON.parse(fs.readFileSync(outputFile, "utf8")).response.params.transid, "123456789");
    assert.match(calls[0].url, /ISteamMicroTxnSandbox\/InitTxn/);
    assert.match(String(calls[0].init.body), /usersession=client/);

    const blockedTestApp = await captureRun(["--file", inputFile, "--out", outputFile], {
      env: { STEAM_WEB_API_KEY: "publisher-secret" },
      fetch
    });
    assert.equal(blockedTestApp.status, 2);
    assert.match(blockedTestApp.errorOutput.join("\n"), /App ID 480 only proves generic checkout routing/);

    const missingKey = await captureRun(["--file", inputFile, "--out", outputFile, "--allow-test-app-id"], {
      env: {},
      fetch
    });
    assert.equal(missingKey.status, 2);
    assert.match(missingKey.errorOutput.join("\n"), /missing publisher Web API key/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function captureRun(args, deps = {}) {
  const output = [];
  const errorOutput = [];
  const status = await runCli(args, {
    log(message) {
      output.push(String(message));
    },
    error(message) {
      errorOutput.push(String(message));
    }
  }, deps);
  return { status, output, errorOutput };
}

if (require.main === module) {
  main();
}

module.exports = {
  captureInitTxn,
  normalizeInitTxnRequest,
  parseArgs,
  runCli
};
