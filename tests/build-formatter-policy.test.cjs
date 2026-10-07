const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const builderRequire = createRequire(require.resolve("app-builder-lib"));
const getPath = builderRequire.resolve("@electron/get");
const getRequire = createRequire(getPath);
const globalAgentPath = getRequire.resolve("global-agent");
const globalAgentRequire = createRequire(globalAgentPath);
const roarrPath = globalAgentRequire.resolve("roarr");
const roarrRequire = createRequire(roarrPath);
const formatterPath = roarrRequire.resolve("sprintf-js");
const { sprintf, vsprintf } = require(formatterPath);

test("the actual builder downloader retains its compatible major", () => {
  assert.equal(builderRequire("@electron/get/package.json").version, "3.1.0");
});

test("the actual builder proxy chain uses the explicit local formatter derivative", () => {
  assert.equal(getRequire("global-agent/package.json").version, "3.0.0");
  assert.equal(globalAgentRequire("roarr/package.json").version, "2.15.4");
  assert.equal(roarrRequire("sprintf-js/package.json").version, "1.1.3-steam-bridge.1");
  assert.deepEqual(fs.readFileSync(formatterPath),
    fs.readFileSync(path.join(__dirname, "../vendor/sprintf-js/src/sprintf.js")));
  assert.equal(createHash("sha256").update(fs.readFileSync(formatterPath)).digest("hex"),
    "3b794a3e3e6ded7aca3cda9b434e080148c261f8bf2ed4d7136c23181ec937b5");
});

for (const type of ["e", "f", "g"]) {
  test(`numeric formatter bounds oversized precision for %${type}`, () => {
    const expected = sprintf(`%.100${type}`, 1.25);
    for (const precision of ["101", "1000", "000101", "9".repeat(400)]) {
      const format = `%.${precision}${type}`;
      assert.equal(sprintf(format, 1.25), expected);
      assert.equal(vsprintf(format, [1.25]), expected);
      assert.equal(sprintf(`%2$.${precision}${type}`, "unused", 1.25), expected);
      assert.equal(sprintf(`%(value).${precision}${type}`, { value: 1.25 }), expected);
    }
  });
}

test("zero precision retains fixed/exponential behavior and bounds general precision", () => {
  assert.equal(sprintf("%.0f", 1.25), "1");
  assert.equal(sprintf("%.0e", 1.25), "1e+0");
  assert.equal(sprintf("%.0g", 1.25), sprintf("%.1g", 1.25));
  assert.equal(sprintf("%.000g", 1.25), sprintf("%.1g", 1.25));
});

test("all supported numeric precisions retain valid outputs", () => {
  for (const value of [-123.456, -0, 0, 1.25, 1e21, -1e-20]) {
    for (let precision = 0; precision <= 100; precision++) {
      assert.equal(sprintf(`%.${precision}e`, value), parseFloat(value).toExponential(precision));
      assert.equal(sprintf(`%.${precision}f`, value), parseFloat(value).toFixed(precision));
      if (precision > 0) assert.equal(sprintf(`%.${precision}g`, value), String(Number(value.toPrecision(precision))));
    }
  }
  for (const type of ["e", "f", "g"]) {
    assert.equal(sprintf(`%.101${type}`, Infinity), "Infinity");
    assert.equal(sprintf(`%.101${type}`, -Infinity), "-Infinity");
    assert.equal(sprintf(`%.101${type}`, NaN), "-NaN");
  }
});

test("other formatter contracts and invalid-input errors remain intact", () => {
  assert.equal(sprintf("%.0s/%.2s", "hello", "world"), "/wo");
  assert.equal(sprintf("%05d %2$s", -2, "value"), "-0002 value");
  assert.equal(vsprintf("%s:%d:%%", ["value", 2]), "value:2:%");
  assert.equal(sprintf("%s", () => "callback"), "callback");
  assert.equal(sprintf("%.2f", "1.25"), "1.25");
  assert.throws(() => sprintf("%.2g", "1.25"), TypeError);
  assert.throws(() => sprintf("%.101g", "1.25"), TypeError);
  assert.throws(() => sprintf("%.101f", "not-a-number"), TypeError);
  assert.throws(() => sprintf("%q", 1), SyntaxError);
  assert.throws(() => sprintf("%(value)s %s", { value: "value" }, "other"), /mixing positional and named/);
});

test("real asynchronous Roarr formatting survives advisory inputs without exception handlers", () => {
  const factoryPath = roarrRequire.resolve("./factories/createLogger.js");
  const child = spawnSync(process.execPath, ["-e", `
    const createLogger = require(${JSON.stringify(factoryPath)}).default;
    global.ROARR = { sequence: 0 };
    const log = createLogger(message => process.stdout.write(JSON.stringify(message) + "\\n"));
    setImmediate(() => {
      for (const format of ["%.101f", "%.101e", "%.101g", "%.0g"]) {
        log({ synthetic: true, value: "%.101f" }, format, 1.25);
      }
      log("normal %s", "control");
    });
  `], { encoding: "utf8", timeout: 10000, windowsHide: true });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  const messages = child.stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(messages.length, 5);
  for (let index = 0; index < 4; index++) {
    assert.deepEqual(messages[index].context, { synthetic: true, value: "%.101f" });
    assert.equal(messages[index].sequence, index);
  }
  assert.equal(messages[0].message, sprintf("%.100f", 1.25));
  assert.equal(messages[1].message, sprintf("%.100e", 1.25));
  assert.equal(messages[2].message, sprintf("%.100g", 1.25));
  assert.equal(messages[3].message, sprintf("%.1g", 1.25));
  assert.equal(messages[4].message, "normal control");
});
