// Screenshots of every key state, straight from dist/index.html over file:// (no server, no network).
//   npm run shots                                  -> screens/, 1920x1080 at 4/3 scale = 2560x1440 PNG, both themes
//   npm run shots:presenter                        -> screens/presenter/, same states in presenter mode (P) for slides
//   node app/scripts/shoot.mjs --out DIR --vp 1280x720 --scale 1 --themes light,dark --only 02-
// Chromium: $CHROMIUM_PATH, else /opt/pw-browsers/chromium*, else /usr/bin/chromium.
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const presenter = process.argv.includes("--presenter");
const out = resolve(arg("out", join(root, presenter ? "screens/presenter" : "screens")));
const [vw, vh] = arg("vp", "1920x1080").split("x").map(Number);
const scale = Number(arg("scale", String(2560 / 1920)));
const themes = arg("themes", "light,dark").split(",");
const only = arg("only", "");

export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync("/opt/pw-browsers")) {
    for (const d of readdirSync("/opt/pw-browsers")) {
      for (const sub of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
        const p = join("/opt/pw-browsers", d, sub);
        if (d.startsWith("chromium") && existsSync(p)) return p;
      }
    }
  }
  return "/usr/bin/chromium";
}

// name, beat, extra state applied after the beat is rebuilt
export const SHOTS = [
  ["01-setup-empty", 0],
  ["01-setup-connected", 2],
  ["01-setup-products", 3],
  ["02-live-desk-loading", 4, { deskLoading: true }],
  ["02-live-desk-low-confidence", 5],
  ["02-live-desk-suggestion", 6],
  ["02-live-desk-pinned", 7],
  ["02-live-desk-flash-not-enough", 8],
  ["02-live-desk-flash-ready", 9],
  ["02-live-desk-platform-condition", 11],
  ["02-live-desk-two-pins", 13],
  ["02-live-desk-observe-mode", 7, { mode: "observe" }],
  ["02-live-desk-experiment-locked", 6, { lockNote: true }],
  ["02-live-desk-end-confirm", 14],
  ["02-live-desk-about-data", 6, { drawer: true }],
  ["02-live-desk-keys", 6, { help: true }],
  ["03-recap", 15],
  ["04-data-journey", 16],
  ["04-data-journey-stage-4", 16, { journeyStage: 4 }],
];

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath(), headless: true, args: ["--no-sandbox"] });
  const url = pathToFileURL(join(root, "dist/index.html")).href;
  const problems = [];
  for (const theme of themes) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && problems.push(`${theme}: ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`${theme}: ${e.message}`));
    for (const [name, beat, extra] of SHOTS) {
      if (only && !name.startsWith(only)) continue;
      await page.goto(`${url}?beat=${beat}&theme=${theme}${presenter ? "&presenter=1" : ""}`);
      await page.evaluate(() => document.fonts.ready);
      if (extra) await page.evaluate((x) => window.__lift.set(x), extra);
      await page.mouse.move(vw - 2, vh - 2);
      await page.waitForTimeout(1100);
      const file = join(out, `${name}-${theme}.png`);
      await page.screenshot({ path: file });
      console.log(file.replace(root + "/", ""));
    }
    if (!presenter && (!only || "00-style-tiles".startsWith(only))) {
      if (theme === themes[0]) {
        await page.goto(pathToFileURL(join(root, "dist/style-tiles.html")).href);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: join(out, "00-style-tiles.png"), fullPage: true });
        console.log(join(out, "00-style-tiles.png").replace(root + "/", ""));
      }
    }
    await ctx.close();
  }
  await browser.close();
  if (problems.length) {
    console.error("console problems:\n" + problems.join("\n"));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
