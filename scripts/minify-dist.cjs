const fs = require("node:fs/promises");
const path = require("node:path");
const { minify } = require("terser");

async function main() {
  const dist = path.resolve(__dirname, "..", "packages", "steam-bridge", "dist");
  // kwin.js serializes selected functions with Function#toString and injects
  // them into KWin's independent JavaScript runtime. Top-level mangling can
  // leave those function bodies referring to renamed module-scope constants,
  // so that code-generation boundary must remain exactly as TypeScript emits
  // it. The large public API and ordinary helper modules are safe to minify.
  const sourceSerializationBoundaries = new Set(["kwin.js"]);
  const entries = await fs.readdir(dist, { withFileTypes: true });
  const javascriptFiles = entries
    .filter(entry => entry.isFile()
      && entry.name.endsWith(".js")
      && !sourceSerializationBoundaries.has(entry.name))
    .map(entry => entry.name)
    .sort();

  for (const filename of javascriptFiles) {
    const sourcePath = path.join(dist, filename);
    const mapPath = `${sourcePath}.map`;
    const [source, sourceMap] = await Promise.all([
      fs.readFile(sourcePath, "utf8"),
      fs.readFile(mapPath, "utf8"),
    ]);
    const result = await minify({ [filename]: source }, {
      compress: { passes: 2 },
      ecma: 2020,
      mangle: true,
      module: false,
      toplevel: true,
      sourceMap: {
        content: sourceMap,
        filename,
        url: `${filename}.map`,
      },
    });
    if (typeof result.code !== "string" || typeof result.map !== "string") {
      throw new Error(`Terser did not emit code and a source map for ${filename}`);
    }
    await Promise.all([
      fs.writeFile(sourcePath, `${result.code}\n`),
      fs.writeFile(mapPath, result.map),
    ]);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
