// Preset thumbnail generator — `npm run thumbs`.
//
// Renders every preset through the real engine in real Chrome and writes
// public/thumbs/<id>.webp. Run it by hand and COMMIT the output: Netlify never
// runs this, because pulling Chromium into a deploy to regenerate eleven
// images that change a few times a year is a bad trade.
//
// Why Playwright and not a headless GL binding: the shader is `#version 300
// es`, so it needs WebGL2, and headless-gl is WebGL1 only. Driving real
// Chrome also means the thumbnails come out of exactly the code path the app
// uses, rather than a second renderer that can drift.
//
// Flags:
//   --only <id>   regenerate a single preset (fast iteration on framing)
//   --check       don't render; exit 1 if the stamp is stale

import { chromium } from "playwright";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const SIZE_W = 320;
const SIZE_H = 320;
// Supersample factor, applied as the page's deviceScaleFactor.
const SS = 4;
// Its own port: the dev server may well be running on the configured one.
const PORT = 5199;

const OUT_DIR = resolve(ROOT, "public/thumbs");
const STAMP = resolve(ROOT, "scripts/thumbs.stamp.json");

// Inputs that change what a thumbnail looks like. The shader is the one that
// bites: a committed image silently stops matching the app the next time
// pattern.frag.glsl changes, and nobody notices for months.
const SOURCES = [
  "src/engine/shaders/pattern.frag.glsl",
  "src/engine/shaders/pattern.vert.glsl",
  "src/presets.ts",
  "src/schema.ts",
];

async function stampNow() {
  const hash = createHash("sha256");
  for (const rel of SOURCES) hash.update(await readFile(resolve(ROOT, rel)));
  return {
    size: `${SIZE_W}x${SIZE_H}`,
    supersample: SS,
    sources: hash.digest("hex").slice(0, 16),
  };
}

async function stampOnDisk() {
  try {
    return JSON.parse(await readFile(STAMP, "utf8"));
  } catch {
    return null;
  }
}

const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;

const current = await stampNow();
const previous = await stampOnDisk();
const stale =
  !previous ||
  previous.sources !== current.sources ||
  previous.size !== current.size ||
  previous.supersample !== current.supersample;

if (argv.includes("--check")) {
  if (stale) {
    console.error(
      "Thumbnails are stale: the shader, schema or presets changed since they " +
        "were generated. Run `npm run thumbs`.",
    );
    process.exit(1);
  }
  console.log("Thumbnails are up to date.");
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });

// The dev server, not a build: it serves scripts/thumbs.html with real TS and
// real ?raw shader imports, and the production build never sees that file
// because vite.config.ts lists its entries explicitly.
const server = await createServer({
  configFile: resolve(ROOT, "vite.config.ts"),
  server: { port: PORT, strictPort: true },
  logLevel: "warn",
});
await server.listen();
const base = server.resolvedUrls.local[0];

// SwiftShader is Chromium's software GL. It is a conformant WebGL2
// implementation, so output matches a GPU render, and it makes the result
// independent of whatever card the machine running this happens to have.
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage({
  deviceScaleFactor: SS,
  viewport: { width: SIZE_W + 40, height: SIZE_H + 40 },
});

const failures = [];
page.on("pageerror", (err) => failures.push(err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") failures.push(msg.text());
});

await page.goto(new URL("scripts/thumbs.html", base).href, { waitUntil: "load" });
await page.waitForFunction(() => typeof window.renderThumb === "function");

const ids = await page.evaluate(() => window.thumbIds());
const targets = only ? ids.filter((id) => id === only) : ids;
if (only && targets.length === 0) {
  throw new Error(`No preset with id "${only}". Known: ${ids.join(", ")}`);
}

for (const id of targets) {
  const dataUrl = await page.evaluate(
    ([presetId, w, h]) => window.renderThumb(presetId, w, h),
    [id, SIZE_W, SIZE_H],
  );
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  await writeFile(resolve(OUT_DIR, `${id}.webp`), bytes);
  console.log(`${id.padEnd(18)} ${String(Math.round(bytes.length / 1024)).padStart(4)} kB`);
}

await browser.close();
await server.close();

if (failures.length > 0) {
  console.error("\nPage errors during generation:\n" + failures.join("\n"));
  process.exit(1);
}

// Only stamp a FULL run: a --only run leaves the other ten at whatever
// source revision they were generated from.
if (!only) {
  await writeFile(STAMP, JSON.stringify(current, null, 2) + "\n");
}
console.log(`\n${targets.length} thumbnail(s) -> ${OUT_DIR.replace(ROOT + "/", "")}/`);
