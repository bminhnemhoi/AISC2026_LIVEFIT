// Builds the offline mockup: one self-contained dist/index.html (script, styles and the
// Be Vietnam Pro font inlined), plus dist/style-tiles.html. No network at runtime, and the
// page also works when opened straight from disk (file://), where module scripts and
// cross-file font loads are blocked.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(root, "dist");
const fontDir = join(root, "node_modules/@fontsource/be-vietnam-pro/files");

const RANGES = {
  vietnamese:
    "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
  "latin-ext":
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  latin:
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
};
const WEIGHTS = [300, 400, 500, 600];

function fontFaces() {
  const out = [];
  for (const weight of WEIGHTS) {
    for (const [subset, range] of Object.entries(RANGES)) {
      const file = join(fontDir, `be-vietnam-pro-${subset}-${weight}-normal.woff2`);
      const b64 = readFileSync(file).toString("base64");
      out.push(
        `@font-face{font-family:'Be Vietnam Pro';font-style:normal;font-display:block;font-weight:${weight};` +
          `src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`,
      );
    }
  }
  return out.join("\n");
}

const minify = !process.argv.includes("--dev");
const fonts = fontFaces();

const js = await build({
  entryPoints: [join(here, "src/main.tsx")],
  bundle: true,
  format: "iife",
  target: ["chrome110", "firefox110", "safari16"],
  jsx: "automatic",
  jsxImportSource: "preact",
  minify,
  write: false,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});
const css = await build({
  entryPoints: [join(here, "src/app.css")],
  bundle: true,
  minify,
  write: false,
  loader: { ".css": "css" },
});

const escapeScript = (s) => s.replace(/<\/script/gi, "<\\/script");
const html = readFileSync(join(here, "index.html"), "utf8")
  .replace("/*FONTS*/", () => fonts)
  .replace("/*STYLES*/", () => css.outputFiles[0].text)
  .replace("/*SCRIPT*/", () => escapeScript(js.outputFiles[0].text));
const tiles = readFileSync(join(here, "style-tiles.html"), "utf8").replace("/*FONTS*/", () => fonts);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "index.html"), html);
writeFileSync(join(dist, "style-tiles.html"), tiles);

const kb = (p) => (statSync(p).size / 1024).toFixed(0);
console.log(`dist/index.html ${kb(join(dist, "index.html"))} KB, dist/style-tiles.html ${kb(join(dist, "style-tiles.html"))} KB`);
