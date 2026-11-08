// Build: copy SW/content + parser IIFE → dist/ (Pages-swappable, Chrome-loadable).
import { cp, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = new URL("./", import.meta.url).pathname;
const extractor = new URL("../../packages/extractor/dist/index.js", import.meta.url).pathname;

await mkdir(path.join(root, "dist"), { recursive: true });
await cp(path.join(root, "manifest.json"), path.join(root, "dist/manifest.json"));
await cp(path.join(root, "src/background.js"), path.join(root, "dist/background.js"));
await cp(path.join(root, "src/content.js"), path.join(root, "dist/content.js"));
await cp(new URL("../../apps/extension/popup.html", import.meta.url).pathname, path.join(root, "dist/popup.html"));

// Wrap ESM parser dist into SW-global IIFE (no <script type=module> needed in SW).
try {
  let esm = await readFile(extractor, "utf8");
  esm = esm
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s*\{[^}]*\}\s*;?/g, "");
  const iife = `globalThis.BOBExtractor = (() => {\n${esm}\nreturn { extractXigPolarisMedia, parseMedia };\n})();\n`;
  await writeFile(path.join(root, "dist/parser.js"), iife);
  console.log("dist: parser.js (IIFE) + background.js + content.js + manifest.json");
} catch (e) {
  console.log("parser bundle skipped — run packages/extractor build first:", e.message);
}
