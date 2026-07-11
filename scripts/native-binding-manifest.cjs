const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const HASH_DOMAIN = "steam-bridge-native-binding-methods-v1";
const INTERFACE_NAME = "NativeBinding";
const SCHEMA_VERSION = 1;

function readNativeBindingMethodNames(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(sourceFile.parseDiagnostics.length, 0, `Could not parse NativeBinding declaration in ${filePath}.`);
  const declarations = sourceFile.statements.filter(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === INTERFACE_NAME
  );
  assert.equal(declarations.length, 1, `Expected exactly one ${INTERFACE_NAME} interface in ${filePath}.`);
  assert.equal(
    declarations[0].heritageClauses?.length ?? 0,
    0,
    `${INTERFACE_NAME} must not inherit methods from another interface.`
  );

  const methodNames = declarations[0].members.map((member) => {
    assert.ok(ts.isMethodSignature(member), `${INTERFACE_NAME} may contain only method signatures.`);
    assert.equal(member.questionToken, undefined, `${INTERFACE_NAME} methods must not be optional.`);
    assert.ok(ts.isIdentifier(member.name), `${INTERFACE_NAME} method names must be identifiers.`);
    assert.match(
      member.name.text,
      /^[A-Za-z_$][A-Za-z0-9_$]*$/,
      `${INTERFACE_NAME} method names must be ASCII identifiers.`
    );
    return member.name.text;
  });
  assert.ok(methodNames.length > 0, `${INTERFACE_NAME} must declare at least one method.`);
  assert.equal(
    new Set(methodNames).size,
    methodNames.length,
    `${INTERFACE_NAME} must not contain duplicate method declarations.`
  );
  return methodNames.sort(compareOrdinal);
}

function createNativeBindingManifest(filePath) {
  const methods = readNativeBindingMethodNames(filePath);
  return {
    schemaVersion: SCHEMA_VERSION,
    interfaceName: INTERFACE_NAME,
    methodCount: methods.length,
    methodsSha256: hashMethodNames(methods),
    methods
  };
}

function assertMatchingNativeBindingManifests(left, right, leftLabel = "left", rightLabel = "right") {
  assert.equal(right.schemaVersion, left.schemaVersion, `${rightLabel} schema differs from ${leftLabel}`);
  assert.equal(right.interfaceName, left.interfaceName, `${rightLabel} interface differs from ${leftLabel}`);
  assert.equal(right.methodCount, left.methodCount, `${rightLabel} method count differs from ${leftLabel}`);
  assert.equal(right.methodsSha256, left.methodsSha256, `${rightLabel} method hash differs from ${leftLabel}`);
  assert.deepEqual(right.methods, left.methods, `${rightLabel} method names differ from ${leftLabel}`);
}

function hashMethodNames(methodNames) {
  const payload = `${HASH_DOMAIN}\n${methodNames.join("\n")}\n`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-native-binding-manifest-"));
  const tempFile = path.join(tempRoot, "native.ts");
  try {
    fs.writeFileSync(
      tempFile,
      [
        "export interface NativeBinding {",
        "  zebra(): void;",
        "  alpha(value: number): boolean;",
        "}",
        ""
      ].join("\n")
    );
    const manifest = createNativeBindingManifest(tempFile);
    assert.deepEqual(manifest.methods, ["alpha", "zebra"]);
    assert.equal(manifest.methodCount, 2);
    assert.match(manifest.methodsSha256, /^[a-f0-9]{64}$/);
    assertMatchingNativeBindingManifests(manifest, JSON.parse(JSON.stringify(manifest)));
    assert.throws(
      () => assertMatchingNativeBindingManifests(manifest, { ...manifest, methodCount: 1 }),
      /method count differs/
    );
    fs.writeFileSync(
      tempFile,
      ["export interface NativeBinding {", "  optional?(): void;", "}", ""].join("\n")
    );
    assert.throws(() => createNativeBindingManifest(tempFile), /must not be optional/);
    fs.writeFileSync(
      tempFile,
      [
        "interface Base { inherited(): void; }",
        "export interface NativeBinding extends Base {",
        "  own(): void;",
        "}",
        ""
      ].join("\n")
    );
    assert.throws(() => createNativeBindingManifest(tempFile), /must not inherit/);
    fs.writeFileSync(
      tempFile,
      ["export interface NativeBinding {", '  "hyphen-name"(): void;', "}", ""].join("\n")
    );
    assert.throws(() => createNativeBindingManifest(tempFile), /must be identifiers/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  selfTest();
  console.log("Native binding manifest self-test passed.");
}

module.exports = {
  assertMatchingNativeBindingManifests,
  createNativeBindingManifest,
  readNativeBindingMethodNames
};
