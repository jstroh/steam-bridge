#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const WINDOWS_RUNTIME_FILES = Object.freeze([
  "steam_bridge_native.win32-x64-msvc.node",
  "steam_api64.dll",
  "sdkencryptedappticket64.dll"
]);
const WINDOWS_NATIVE_ADDON = WINDOWS_RUNTIME_FILES[0];
const WINDOWS_RUNTIME_DLLS = Object.freeze(WINDOWS_RUNTIME_FILES.slice(1));
const IMAGE_FILE_MACHINE_AMD64 = 0x8664;
const IMAGE_FILE_DLL = 0x2000;
const PE32_PLUS_MAGIC = 0x20b;
const SYSTEM_WINDOWS_DLLS = new Set([
  "advapi32.dll",
  "bcrypt.dll",
  "bcryptprimitives.dll",
  "comctl32.dll",
  "comdlg32.dll",
  "crypt32.dll",
  "d3d11.dll",
  "d3dcompiler_47.dll",
  "dwmapi.dll",
  "dxgi.dll",
  "gdi32.dll",
  "kernel32.dll",
  "ntdll.dll",
  "ole32.dll",
  "oleaut32.dll",
  "opengl32.dll",
  "rpcrt4.dll",
  "secur32.dll",
  "setupapi.dll",
  "shell32.dll",
  "shlwapi.dll",
  "user32.dll",
  "version.dll",
  "winmm.dll",
  "ws2_32.dll"
]);

if (require.main === module) {
  main();
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    console.log("Windows packaged-artifact verifier self-test passed.");
    return;
  }

  const appDirArg = readArg("--app-dir");
  const runtimeDirArg = readArg("--runtime-dir");
  const sourceDirArg = readArg("--source-dir");
  const manifestArg = readArg("--manifest");
  if (Boolean(appDirArg) === Boolean(runtimeDirArg)) {
    throw new Error("Pass exactly one of --app-dir <path> or --runtime-dir <path>.");
  }

  const appDir = appDirArg ? path.resolve(appDirArg) : undefined;
  const runtimeDir = runtimeDirArg
    ? path.resolve(runtimeDirArg)
    : resolvePackagedWindowsRuntimeDirectory(appDir);
  const runtime = inspectWindowsRuntimeDirectory(runtimeDir);
  const summary = {
    schemaVersion: 1,
    target: "x86_64-pc-windows-msvc",
    runtimeDirectory: appDir ? normalizeRelativePath(path.relative(appDir, runtimeDir)) : runtimeDir,
    files: runtime.files
  };

  if (sourceDirArg) {
    const sourceDir = path.resolve(sourceDirArg);
    const source = inspectWindowsRuntimeDirectory(sourceDir);
    assertMatchingRuntimeFiles(source, runtime, "source", "packaged");
    summary.sourceDirectory = sourceDir;
    summary.sourceMatchesPackaged = true;
  }

  if (manifestArg) {
    writeJson(path.resolve(manifestArg), summary);
  }
  console.log(JSON.stringify(summary, null, 2));
}

function resolvePackagedWindowsRuntimeDirectory(appDir) {
  assertDirectory(appDir, "Windows application directory");
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, "app.asar");
  const candidates = [
    path.join(resourcesDir, "app.asar.unpacked", "node_modules", "steam-bridge"),
    path.join(resourcesDir, "app", "node_modules", "steam-bridge")
  ];
  const inspected = candidates.map((candidate) => ({
    candidate,
    present: WINDOWS_RUNTIME_FILES.filter((fileName) => isNonEmptyFile(path.join(candidate, fileName)))
  }));

  for (const entry of inspected) {
    if (entry.present.length > 0 && entry.present.length !== WINDOWS_RUNTIME_FILES.length) {
      throw new Error(
        `Incomplete Steam Bridge Windows runtime at ${entry.candidate}; found ${entry.present.join(", ")}, ` +
          `required ${WINDOWS_RUNTIME_FILES.join(", ")}.`
      );
    }
  }

  const complete = inspected.filter((entry) => entry.present.length === WINDOWS_RUNTIME_FILES.length);
  if (complete.length !== 1) {
    throw new Error(
      complete.length === 0
        ? `No complete Steam Bridge Windows runtime found under ${resourcesDir}.`
        : `Ambiguous Steam Bridge Windows runtime layout; complete copies exist at ${complete
            .map((entry) => entry.candidate)
            .join(", ")}.`
    );
  }
  if (fs.existsSync(asarPath) && complete[0].candidate !== candidates[0]) {
    throw new Error(
      `ASAR package ${asarPath} must keep the Steam Bridge addon and both runtime DLLs in app.asar.unpacked.`
    );
  }

  return complete[0].candidate;
}

function inspectWindowsRuntimeDirectory(runtimeDir) {
  assertDirectory(runtimeDir, "Steam Bridge Windows runtime directory");
  const files = {};
  for (const fileName of WINDOWS_RUNTIME_FILES) {
    const filePath = path.join(runtimeDir, fileName);
    assertNonEmptyFile(filePath, fileName);
    const bytes = fs.readFileSync(filePath);
    const pe = inspectPeBuffer(bytes, fileName);
    const imports = readPeImports(bytes, fileName);
    const delayImports = readPeDelayImports(bytes, fileName);
    assertSupportedWindowsImports(imports, fileName);
    assertSupportedWindowsImports(delayImports, `${fileName} delay imports`);
    files[fileName] = {
      size: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      authenticodeContentSha256: authenticodeContentSha256(bytes, fileName),
      pe: { ...pe, imports, delayImports }
    };
  }

  const addonBytes = fs.readFileSync(path.join(runtimeDir, WINDOWS_NATIVE_ADDON));
  const addonText = addonBytes.toString("latin1");
  if (!addonText.includes("napi_register_module_v1")) {
    throw new Error(`${WINDOWS_NATIVE_ADDON} does not contain the N-API module registration symbol.`);
  }
  for (const dllName of WINDOWS_RUNTIME_DLLS) {
    const allImports = [
      ...files[WINDOWS_NATIVE_ADDON].pe.imports,
      ...files[WINDOWS_NATIVE_ADDON].pe.delayImports
    ];
    if (!allImports.includes(dllName.toLowerCase())) {
      throw new Error(`${WINDOWS_NATIVE_ADDON} does not name required dependency ${dllName}.`);
    }
  }
  files[WINDOWS_NATIVE_ADDON].napiRegistration = "napi_register_module_v1";
  files[WINDOWS_NATIVE_ADDON].requiredRuntimeDlls = [...WINDOWS_RUNTIME_DLLS];

  return {
    runtimeDir,
    files
  };
}

function inspectPeBuffer(bytes, label = "PE file") {
  if (!Buffer.isBuffer(bytes) || bytes.length < 0x40) {
    throw new Error(`${label} is truncated before the DOS header.`);
  }
  if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    throw new Error(`${label} does not have an MZ header.`);
  }

  const peOffset = bytes.readUInt32LE(0x3c);
  if (peOffset < 0x40 || peOffset + 26 > bytes.length) {
    throw new Error(`${label} has an invalid or truncated PE header offset.`);
  }
  if (bytes.toString("latin1", peOffset, peOffset + 4) !== "PE\0\0") {
    throw new Error(`${label} does not have a PE signature.`);
  }

  const machine = bytes.readUInt16LE(peOffset + 4);
  const characteristics = bytes.readUInt16LE(peOffset + 22);
  const optionalHeaderSize = bytes.readUInt16LE(peOffset + 20);
  if (optionalHeaderSize < 2 || peOffset + 24 + optionalHeaderSize > bytes.length) {
    throw new Error(`${label} has a truncated optional header.`);
  }
  const optionalHeaderMagic = bytes.readUInt16LE(peOffset + 24);

  if (machine !== IMAGE_FILE_MACHINE_AMD64) {
    throw new Error(`${label} must be AMD64 (machine 0x8664), found 0x${machine.toString(16)}.`);
  }
  if (optionalHeaderMagic !== PE32_PLUS_MAGIC) {
    throw new Error(`${label} must be PE32+ (optional-header magic 0x20b), found 0x${optionalHeaderMagic.toString(16)}.`);
  }
  if ((characteristics & IMAGE_FILE_DLL) === 0) {
    throw new Error(`${label} must carry the PE DLL characteristic.`);
  }

  return {
    format: "PE32+",
    machine: "AMD64",
    machineCode: "0x8664",
    dll: true
  };
}

function readPeImports(bytes, label = "PE file") {
  inspectPeBuffer(bytes, label);
  const peOffset = bytes.readUInt32LE(0x3c);
  const sectionCount = bytes.readUInt16LE(peOffset + 6);
  const optionalHeaderSize = bytes.readUInt16LE(peOffset + 20);
  const optionalHeaderOffset = peOffset + 24;
  const sectionTableOffset = optionalHeaderOffset + optionalHeaderSize;
  const importDirectoryOffset = optionalHeaderOffset + 112 + 8;
  if (importDirectoryOffset + 8 > sectionTableOffset) {
    throw new Error(`${label} does not contain a complete PE import-directory entry.`);
  }
  const importRva = bytes.readUInt32LE(importDirectoryOffset);
  const importSize = bytes.readUInt32LE(importDirectoryOffset + 4);
  if (importRva === 0 && importSize === 0) {
    return [];
  }
  if (importRva === 0 || importSize < 20) {
    throw new Error(`${label} has an invalid PE import directory.`);
  }

  const sections = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionTableOffset + index * 40;
    if (offset + 40 > bytes.length) {
      throw new Error(`${label} has a truncated PE section table.`);
    }
    sections.push({
      virtualSize: bytes.readUInt32LE(offset + 8),
      virtualAddress: bytes.readUInt32LE(offset + 12),
      rawSize: bytes.readUInt32LE(offset + 16),
      rawOffset: bytes.readUInt32LE(offset + 20)
    });
  }

  const imports = [];
  const descriptorRange = peRvaToFileRange(importRva, sections, bytes.length, label);
  let descriptorOffset = descriptorRange.offset;
  const maximumDescriptors = Math.max(1, Math.ceil(importSize / 20));
  for (let index = 0; index < maximumDescriptors; index += 1, descriptorOffset += 20) {
    if (descriptorOffset + 20 > descriptorRange.end) {
      throw new Error(`${label} has a truncated PE import descriptor.`);
    }
    let empty = true;
    for (let byteIndex = 0; byteIndex < 20; byteIndex += 1) {
      if (bytes[descriptorOffset + byteIndex] !== 0) {
        empty = false;
        break;
      }
    }
    if (empty) {
      return [...new Set(imports)].sort();
    }
    const nameRva = bytes.readUInt32LE(descriptorOffset + 12);
    const nameRange = peRvaToFileRange(nameRva, sections, bytes.length, label);
    imports.push(readAsciiCString(bytes, nameRange.offset, nameRange.end, label).toLowerCase());
  }
  throw new Error(`${label} PE import directory has no terminating descriptor.`);
}

function readPeDelayImports(bytes, label = "PE file") {
  inspectPeBuffer(bytes, label);
  const peOffset = bytes.readUInt32LE(0x3c);
  const sectionCount = bytes.readUInt16LE(peOffset + 6);
  const optionalHeaderSize = bytes.readUInt16LE(peOffset + 20);
  const optionalHeaderOffset = peOffset + 24;
  const sectionTableOffset = optionalHeaderOffset + optionalHeaderSize;
  const delayDirectoryOffset = optionalHeaderOffset + 112 + 8 * 13;
  if (delayDirectoryOffset + 8 > sectionTableOffset) {
    throw new Error(`${label} does not contain a complete PE delay-import-directory entry.`);
  }
  const delayRva = bytes.readUInt32LE(delayDirectoryOffset);
  const delaySize = bytes.readUInt32LE(delayDirectoryOffset + 4);
  if (delayRva === 0 && delaySize === 0) {
    return [];
  }
  if (delayRva === 0 || delaySize < 32) {
    throw new Error(`${label} has an invalid PE delay-import directory.`);
  }

  const sections = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionTableOffset + index * 40;
    if (offset + 40 > bytes.length) {
      throw new Error(`${label} has a truncated PE section table.`);
    }
    sections.push({
      virtualSize: bytes.readUInt32LE(offset + 8),
      virtualAddress: bytes.readUInt32LE(offset + 12),
      rawSize: bytes.readUInt32LE(offset + 16),
      rawOffset: bytes.readUInt32LE(offset + 20)
    });
  }

  const imports = [];
  const descriptorRange = peRvaToFileRange(delayRva, sections, bytes.length, label);
  let descriptorOffset = descriptorRange.offset;
  const maximumDescriptors = Math.max(1, Math.ceil(delaySize / 32));
  const imageBase = bytes.readBigUInt64LE(optionalHeaderOffset + 24);
  for (let index = 0; index < maximumDescriptors; index += 1, descriptorOffset += 32) {
    if (descriptorOffset + 32 > descriptorRange.end) {
      throw new Error(`${label} has a truncated PE delay-import descriptor.`);
    }
    let empty = true;
    for (let byteIndex = 0; byteIndex < 32; byteIndex += 1) {
      if (bytes[descriptorOffset + byteIndex] !== 0) {
        empty = false;
        break;
      }
    }
    if (empty) {
      return [...new Set(imports)].sort();
    }
    const attributes = bytes.readUInt32LE(descriptorOffset);
    const nameValue = bytes.readUInt32LE(descriptorOffset + 4);
    let nameRva;
    if ((attributes & 1) !== 0) {
      nameRva = nameValue;
    } else {
      const nameAddress = BigInt(nameValue);
      if (nameAddress < imageBase || nameAddress - imageBase > 0xffffffffn) {
        throw new Error(`${label} has an unsupported PE delay-import name address.`);
      }
      nameRva = Number(nameAddress - imageBase);
    }
    const nameRange = peRvaToFileRange(nameRva, sections, bytes.length, label);
    imports.push(readAsciiCString(bytes, nameRange.offset, nameRange.end, label).toLowerCase());
  }
  throw new Error(`${label} PE delay-import directory has no terminating descriptor.`);
}

function peRvaToFileRange(rva, sections, fileSize, label) {
  for (const section of sections) {
    const delta = rva - section.virtualAddress;
    if (delta >= 0 && delta < section.rawSize) {
      const offset = section.rawOffset + delta;
      const end = section.rawOffset + section.rawSize;
      if (offset >= fileSize || end > fileSize) {
        throw new Error(`${label} contains a PE section whose raw range exceeds the file.`);
      }
      return { offset, end };
    }
  }
  throw new Error(`${label} contains an import RVA outside its file-backed PE sections.`);
}

function readAsciiCString(bytes, offset, sectionEnd, label) {
  const limit = Math.min(bytes.length, sectionEnd, offset + 512);
  let end = offset;
  while (end < limit && bytes[end] !== 0) {
    end += 1;
  }
  if (end === offset || end === limit) {
    throw new Error(`${label} contains an invalid PE import name.`);
  }
  return bytes.toString("ascii", offset, end);
}

function assertSupportedWindowsImports(imports, label) {
  for (const importedName of imports) {
    if (
      /^(?:vcruntime|msvcp|concrt)[^/\\]*\.dll$/i.test(importedName) ||
      /^ucrtbase\.dll$/i.test(importedName) ||
      /^api-ms-win-crt-/i.test(importedName)
    ) {
      throw new Error(
        `${label} dynamically imports ${importedName}; Windows release artifacts must link the MSVC/UCRT runtime statically.`
      );
    }
    if (
      WINDOWS_RUNTIME_DLLS.map((name) => name.toLowerCase()).includes(importedName) ||
      SYSTEM_WINDOWS_DLLS.has(importedName) ||
      importedName.startsWith("api-ms-win-") ||
      importedName.startsWith("ext-ms-win-")
    ) {
      continue;
    }
    throw new Error(`${label} imports unbundled non-system dependency ${importedName}.`);
  }
}

function assertMatchingRuntimeFiles(left, right, leftLabel = "left", rightLabel = "right", options = {}) {
  for (const fileName of WINDOWS_RUNTIME_FILES) {
    const leftFile = left.files[fileName];
    const rightFile = right.files[fileName];
    const matches = options.allowAuthenticodeChanges
      ? leftFile.authenticodeContentSha256 === rightFile.authenticodeContentSha256
      : leftFile.size === rightFile.size && leftFile.sha256 === rightFile.sha256;
    if (!matches) {
      throw new Error(
        `${fileName} differs between ${leftLabel} and ${rightLabel}: ` +
          `${leftFile.size}/${leftFile.sha256}/${leftFile.authenticodeContentSha256} != ` +
          `${rightFile.size}/${rightFile.sha256}/${rightFile.authenticodeContentSha256}.`
      );
    }
  }
}

function authenticodeContentSha256(bytes, label = "PE file") {
  inspectPeBuffer(bytes, label);
  const normalized = Buffer.from(bytes);
  const peOffset = normalized.readUInt32LE(0x3c);
  const optionalHeaderOffset = peOffset + 24;
  const optionalHeaderSize = normalized.readUInt16LE(peOffset + 20);
  const checksumOffset = optionalHeaderOffset + 64;
  const securityDirectoryOffset = optionalHeaderOffset + 112 + 8 * 4;
  if (securityDirectoryOffset + 8 > optionalHeaderOffset + optionalHeaderSize) {
    throw new Error(`${label} does not contain a complete PE32+ security directory entry.`);
  }

  const certificateOffset = normalized.readUInt32LE(securityDirectoryOffset);
  const certificateSize = normalized.readUInt32LE(securityDirectoryOffset + 4);
  normalized.fill(0, checksumOffset, checksumOffset + 4);
  normalized.fill(0, securityDirectoryOffset, securityDirectoryOffset + 8);
  const hash = crypto.createHash("sha256");
  if (certificateOffset === 0 && certificateSize === 0) {
    return hash.update(normalized).digest("hex");
  }
  if (
    certificateOffset < optionalHeaderOffset + optionalHeaderSize ||
    certificateSize === 0 ||
    certificateOffset + certificateSize > normalized.length
  ) {
    throw new Error(`${label} has an invalid Authenticode certificate table range.`);
  }
  hash.update(normalized.subarray(0, certificateOffset));
  hash.update(normalized.subarray(certificateOffset + certificateSize));
  return hash.digest("hex");
}

function selfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "steam-bridge-windows-pe-self-test-"));
  try {
    const validAddon = fakePeBuffer(
      ["napi_register_module_v1", ...WINDOWS_RUNTIME_DLLS].join("\0"),
      WINDOWS_RUNTIME_DLLS
    );
    const validDll = fakePeBuffer("runtime", ["KERNEL32.dll"]);
    const runtimeDir = path.join(tempRoot, "runtime");
    fs.mkdirSync(runtimeDir);
    fs.writeFileSync(path.join(runtimeDir, WINDOWS_NATIVE_ADDON), validAddon);
    for (const dllName of WINDOWS_RUNTIME_DLLS) {
      fs.writeFileSync(path.join(runtimeDir, dllName), validDll);
    }

    const inspected = inspectWindowsRuntimeDirectory(runtimeDir);
    assert.equal(inspected.files[WINDOWS_NATIVE_ADDON].pe.machine, "AMD64");
    assert.equal(inspected.files[WINDOWS_NATIVE_ADDON].pe.format, "PE32+");
    assert.deepEqual(inspected.files[WINDOWS_NATIVE_ADDON].requiredRuntimeDlls, WINDOWS_RUNTIME_DLLS);

    assert.throws(() => inspectPeBuffer(Buffer.alloc(12), "short.node"), /truncated before the DOS header/);
    const badMachine = Buffer.from(validDll);
    badMachine.writeUInt16LE(0x14c, 0x84);
    assert.throws(() => inspectPeBuffer(badMachine, "x86.dll"), /must be AMD64/);
    const badMagic = Buffer.from(validDll);
    badMagic.writeUInt16LE(0x10b, 0x98);
    assert.throws(() => inspectPeBuffer(badMagic, "pe32.dll"), /must be PE32\+/);
    const dynamicCrtAddon = fakePeBuffer(
      "napi_register_module_v1",
      WINDOWS_RUNTIME_DLLS,
      ["VCRUNTIME140.dll"]
    );
    assert.throws(
      () =>
        assertSupportedWindowsImports(
          readPeDelayImports(dynamicCrtAddon, "dynamic.node"),
          "dynamic.node delay imports"
        ),
      /must link the MSVC\/UCRT runtime statically/
    );
    assert.doesNotThrow(() =>
      assertSupportedWindowsImports(
        ["comctl32.dll", "d3dcompiler_47.dll"],
        "native host system imports"
      )
    );
    assert.throws(
      () => assertSupportedWindowsImports(["third-party-renderer.dll"], "native host imports"),
      /imports unbundled non-system dependency third-party-renderer\.dll/
    );

    const otherDir = path.join(tempRoot, "other");
    fs.cpSync(runtimeDir, otherDir, { recursive: true });
    const changed = fs.readFileSync(path.join(otherDir, WINDOWS_RUNTIME_DLLS[0]));
    changed[changed.length - 1] ^= 1;
    fs.writeFileSync(path.join(otherDir, WINDOWS_RUNTIME_DLLS[0]), changed);
    assert.throws(
      () => assertMatchingRuntimeFiles(inspected, inspectWindowsRuntimeDirectory(otherDir), "source", "packaged"),
      /differs between source and packaged/
    );

    const signedDir = path.join(tempRoot, "signed");
    fs.cpSync(runtimeDir, signedDir, { recursive: true });
    for (const fileName of WINDOWS_RUNTIME_FILES) {
      const original = fs.readFileSync(path.join(signedDir, fileName));
      const certificate = Buffer.alloc(32, 0xa5);
      const signed = Buffer.concat([original, certificate]);
      signed.writeUInt32LE(1234, 0x80 + 24 + 64);
      signed.writeUInt32LE(original.length, 0x80 + 24 + 112 + 8 * 4);
      signed.writeUInt32LE(certificate.length, 0x80 + 24 + 112 + 8 * 4 + 4);
      fs.writeFileSync(path.join(signedDir, fileName), signed);
    }
    assertMatchingRuntimeFiles(
      inspected,
      inspectWindowsRuntimeDirectory(signedDir),
      "source",
      "signed",
      { allowAuthenticodeChanges: true }
    );

    const appDir = path.join(tempRoot, "app");
    const unpackedDir = path.join(appDir, "resources", "app.asar.unpacked", "node_modules", "steam-bridge");
    fs.mkdirSync(path.dirname(path.join(appDir, "resources", "app.asar")), { recursive: true });
    fs.writeFileSync(path.join(appDir, "resources", "app.asar"), "archive");
    fs.cpSync(runtimeDir, unpackedDir, { recursive: true });
    assert.equal(resolvePackagedWindowsRuntimeDirectory(appDir), unpackedDir);

    const legacyDir = path.join(appDir, "resources", "app", "node_modules", "steam-bridge");
    fs.cpSync(runtimeDir, legacyDir, { recursive: true });
    assert.throws(() => resolvePackagedWindowsRuntimeDirectory(appDir), /Ambiguous/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function fakePeBuffer(trailer, imports = [], delayImports = []) {
  const trailerBytes = Buffer.from(String(trailer), "latin1");
  const bytes = Buffer.alloc(0x800 + trailerBytes.length);
  bytes.write("MZ", 0, "latin1");
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write("PE\0\0", 0x80, "latin1");
  bytes.writeUInt16LE(IMAGE_FILE_MACHINE_AMD64, 0x84);
  bytes.writeUInt16LE(1, 0x86);
  bytes.writeUInt16LE(0xf0, 0x94);
  bytes.writeUInt16LE(IMAGE_FILE_DLL, 0x96);
  bytes.writeUInt16LE(PE32_PLUS_MAGIC, 0x98);
  const sectionOffset = 0x80 + 24 + 0xf0;
  bytes.write(".rdata\0\0", sectionOffset, "latin1");
  bytes.writeUInt32LE(0x600, sectionOffset + 8);
  bytes.writeUInt32LE(0x1000, sectionOffset + 12);
  bytes.writeUInt32LE(0x600, sectionOffset + 16);
  bytes.writeUInt32LE(0x200, sectionOffset + 20);
  if (imports.length > 0) {
    const optionalHeaderOffset = 0x80 + 24;
    bytes.writeUInt32LE(0x1000, optionalHeaderOffset + 112 + 8);
    bytes.writeUInt32LE((imports.length + 1) * 20, optionalHeaderOffset + 112 + 12);
    let nameOffset = 0x200 + (imports.length + 1) * 20;
    for (let index = 0; index < imports.length; index += 1) {
      const descriptorOffset = 0x200 + index * 20;
      bytes.writeUInt32LE(0x1000 + (nameOffset - 0x200), descriptorOffset + 12);
      nameOffset += bytes.write(`${imports[index]}\0`, nameOffset, "ascii");
    }
  }
  if (delayImports.length > 0) {
    const optionalHeaderOffset = 0x80 + 24;
    bytes.writeUInt32LE(0x1200, optionalHeaderOffset + 112 + 8 * 13);
    bytes.writeUInt32LE((delayImports.length + 1) * 32, optionalHeaderOffset + 112 + 8 * 13 + 4);
    let nameOffset = 0x400 + (delayImports.length + 1) * 32;
    for (let index = 0; index < delayImports.length; index += 1) {
      const descriptorOffset = 0x400 + index * 32;
      bytes.writeUInt32LE(1, descriptorOffset);
      bytes.writeUInt32LE(0x1000 + (nameOffset - 0x200), descriptorOffset + 4);
      nameOffset += bytes.write(`${delayImports[index]}\0`, nameOffset, "ascii");
    }
  }
  trailerBytes.copy(bytes, 0x700);
  return bytes;
}

function assertDirectory(directory, label) {
  if (!directory || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`${label} is missing: ${directory || "<unset>"}.`);
  }
}

function assertNonEmptyFile(filePath, label) {
  if (!isNonEmptyFile(filePath)) {
    throw new Error(`Missing or empty ${label}: ${filePath}.`);
  }
}

function isNonEmptyFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0;
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

module.exports = {
  WINDOWS_NATIVE_ADDON,
  WINDOWS_RUNTIME_DLLS,
  WINDOWS_RUNTIME_FILES,
  assertMatchingRuntimeFiles,
  authenticodeContentSha256,
  inspectPeBuffer,
  inspectWindowsRuntimeDirectory,
  readPeImports,
  readPeDelayImports,
  resolvePackagedWindowsRuntimeDirectory
};
