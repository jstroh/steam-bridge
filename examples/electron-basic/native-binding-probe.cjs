const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const HASH_DOMAIN = "steam-bridge-native-binding-methods-v1";
const MANIFEST_KEYS = ["interfaceName", "methodCount", "methods", "methodsSha256", "schemaVersion"];

function validateNativeBindingManifest(manifest) {
  assert.ok(manifest && typeof manifest === "object" && !Array.isArray(manifest), "Manifest must be an object.");
  assert.deepEqual(Object.keys(manifest).sort(), MANIFEST_KEYS, "Manifest fields do not match schema 1.");
  assert.equal(manifest.schemaVersion, 1, "Unsupported native binding manifest schema.");
  assert.equal(manifest.interfaceName, "NativeBinding", "Unexpected native binding interface name.");
  assert.ok(Array.isArray(manifest.methods) && manifest.methods.length > 0, "Manifest methods must be non-empty.");
  assert.ok(
    manifest.methods.every((name) => typeof name === "string" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)),
    "Manifest contains an invalid method name."
  );
  const sortedMethods = [...manifest.methods].sort(compareOrdinal);
  assert.deepEqual(manifest.methods, sortedMethods, "Manifest methods must use ordinal sort order.");
  assert.equal(new Set(manifest.methods).size, manifest.methods.length, "Manifest methods must be unique.");
  assert.equal(manifest.methodCount, manifest.methods.length, "Manifest method count is inconsistent.");
  assert.equal(manifest.methodsSha256, hashMethodNames(manifest.methods), "Manifest method hash is inconsistent.");
  return manifest;
}

function inspectNativeBinding(binding, manifest) {
  validateNativeBindingManifest(manifest);
  assert.ok(binding && (typeof binding === "object" || typeof binding === "function"), "Native binding is absent.");
  const missingMethods = [];
  const nonFunctionMethods = [];
  const verifiedMethods = [];

  for (const methodName of manifest.methods) {
    const descriptor = Object.getOwnPropertyDescriptor(binding, methodName);
    if (!descriptor) {
      missingMethods.push(methodName);
    } else if (typeof descriptor.value !== "function") {
      nonFunctionMethods.push(methodName);
    } else {
      verifiedMethods.push(methodName);
    }
  }

  const required = new Set(manifest.methods);
  const extraFunctionCount = Object.entries(Object.getOwnPropertyDescriptors(binding)).filter(
    ([name, descriptor]) => !required.has(name) && typeof descriptor.value === "function"
  ).length;
  return {
    ok: missingMethods.length === 0 && nonFunctionMethods.length === 0,
    expectedMethodCount: manifest.methodCount,
    verifiedMethodCount: verifiedMethods.length,
    expectedMethodsSha256: manifest.methodsSha256,
    verifiedMethodsSha256: hashMethodNames(verifiedMethods),
    missingMethodCount: missingMethods.length,
    nonFunctionMethodCount: nonFunctionMethods.length,
    extraFunctionCount,
    missingMethods,
    nonFunctionMethods
  };
}

function verifyNativeBinding(binding, manifest) {
  const evidence = inspectNativeBinding(binding, manifest);
  assert.equal(
    evidence.ok,
    true,
    [
      `Native binding is incomplete: missing=${evidence.missingMethodCount} nonFunction=${evidence.nonFunctionMethodCount}.`,
      ...evidence.missingMethods.slice(0, 20).map((name) => `missing: ${name}`),
      ...evidence.nonFunctionMethods.slice(0, 20).map((name) => `non-function: ${name}`)
    ].join("\n")
  );
  const { missingMethods, nonFunctionMethods, ...sanitized } = evidence;
  return sanitized;
}

function hashMethodNames(methodNames) {
  const payload = `${HASH_DOMAIN}\n${methodNames.join("\n")}\n`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selfTest() {
  const methods = ["alpha", "zebra"];
  const manifest = {
    schemaVersion: 1,
    interfaceName: "NativeBinding",
    methodCount: methods.length,
    methodsSha256: hashMethodNames(methods),
    methods
  };
  let invocationCount = 0;
  const binding = {
    alpha() {
      invocationCount += 1;
    },
    zebra() {
      invocationCount += 1;
    },
    CallbackHandle() {}
  };
  const valid = verifyNativeBinding(binding, manifest);
  assert.equal(valid.ok, true);
  assert.equal(valid.verifiedMethodCount, 2);
  assert.equal(valid.extraFunctionCount, 1);
  assert.equal(invocationCount, 0, "Native binding inspection must not invoke any method.");

  const stale = inspectNativeBinding({ alpha() {}, AuthTicket() {}, CallbackHandle() {} }, manifest);
  assert.equal(stale.ok, false);
  assert.deepEqual(stale.missingMethods, ["zebra"]);
  assert.equal(stale.extraFunctionCount, 2);

  let getterCount = 0;
  const getterBinding = { alpha() {} };
  Object.defineProperty(getterBinding, "zebra", {
    enumerable: true,
    get() {
      getterCount += 1;
      return () => {};
    }
  });
  const getterEvidence = inspectNativeBinding(getterBinding, manifest);
  assert.equal(getterEvidence.nonFunctionMethodCount, 1);
  assert.equal(getterCount, 0, "Native binding inspection must not execute accessors.");
  assert.throws(
    () => validateNativeBindingManifest({ ...manifest, methodsSha256: "0".repeat(64) }),
    /method hash is inconsistent/
  );
}

if (require.main === module) {
  const nativeBindingModule = readArg("--native-binding-module");
  const manifestPath = readArg("--manifest");
  if (nativeBindingModule || manifestPath) {
    assert.ok(nativeBindingModule && manifestPath, "Runtime probe requires --native-binding-module and --manifest.");
    const { loadNativeBinding } = require(path.resolve(nativeBindingModule));
    const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), "utf8"));
    const evidence = verifyNativeBinding(loadNativeBinding(), manifest);
    console.log(`STEAM_BRIDGE_NATIVE_BINDING_PROBE ${JSON.stringify(evidence)}`);
  } else {
    selfTest();
    console.log("Native binding probe self-test passed.");
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

module.exports = {
  inspectNativeBinding,
  validateNativeBindingManifest,
  verifyNativeBinding
};
