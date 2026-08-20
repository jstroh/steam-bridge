#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { generateSteamLegacyLayoutAssets } = require("../dist/steam-input-layouts.js");

function main(args = process.argv.slice(2)) {
  try {
    const options = parseArgs(args);
    if (options.help) {
      printUsage();
      return 0;
    }
    const spec = JSON.parse(fs.readFileSync(options.specPath, "utf8"));
    const assets = generateSteamLegacyLayoutAssets(spec);
    const mismatches = [];
    for (const [name, content] of Object.entries(assets.files)) {
      const output = path.join(options.outputDirectory, name);
      if (options.check) {
        if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== content) mismatches.push(name);
      } else {
        fs.mkdirSync(options.outputDirectory, { recursive: true });
        writeAtomic(output, content);
      }
    }
    if (mismatches.length > 0) {
      throw new Error(
        `Generated Steam legacy layouts are missing or stale: ${mismatches.join(", ")}\n` +
        `Run: steam-bridge-generate-legacy-layouts ${quote(options.specPath)} --out ${quote(options.outputDirectory)}`
      );
    }
    console.log(options.check
      ? `Steam legacy layouts are current: ${options.outputDirectory}`
      : `Generated ${Object.keys(assets.files).length} Steam legacy layout files: ${options.outputDirectory}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function parseArgs(args) {
  let specPath = "";
  let outputDirectory = "";
  let check = false;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--check") check = true;
    else if (arg === "--out") {
      const value = args[++index];
      if (!value) throw new Error("--out requires a directory");
      outputDirectory = path.resolve(value);
    } else if (!specPath) specPath = path.resolve(arg);
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (help) return { help };
  if (!specPath) throw new Error("A JSON layout spec is required");
  if (!outputDirectory) throw new Error("--out <directory> is required");
  return { specPath, outputDirectory, check, help: false };
}

function writeAtomic(filename, content) {
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, "utf8");
  fs.renameSync(temporary, filename);
}

function quote(value) {
  return /[\s"]/u.test(value) ? JSON.stringify(value) : value;
}

function printUsage() {
  console.log(`Usage:
  steam-bridge-generate-legacy-layouts <spec.json> --out <directory> [--check]

The app supplies semantic legacy bindings. Steam Bridge owns controller-family
profiles, VDF syntax, filenames, and deterministic asset generation.`);
}

if (require.main === module) process.exitCode = main();

module.exports = { main, parseArgs };
