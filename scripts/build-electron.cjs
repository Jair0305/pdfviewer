// @ts-check
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");

async function build() {
  // Ensure output dir exists
  fs.mkdirSync(path.join(root, "electron/dist"), { recursive: true });

  // Main process → ESM (Electron 28+ supports ESM, root package.json has "type":"module")
  await esbuild.build({
    entryPoints: [path.join(root, "electron/main.ts")],
    bundle: true,
    platform: "node",
    target: ["node20"],
    format: "esm",
    outfile: path.join(root, "electron/dist/main.js"),
    // better-sqlite3 is a native module — must stay external (not bundled)
    external: ["electron", "chokidar", "better-sqlite3"],
    sourcemap: process.env.NODE_ENV === "development",
  });

  // Preload → CJS (.cjs extension bypasses "type":"module")
  await esbuild.build({
    entryPoints: [path.join(root, "electron/preload.ts")],
    bundle: true,
    platform: "node",
    target: ["node20"],
    format: "cjs",
    outfile: path.join(root, "electron/dist/preload.cjs"),
    external: ["electron"],
    sourcemap: process.env.NODE_ENV === "development",
  });

  console.log("✓ Electron compiled");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
