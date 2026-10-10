// Verification: axe-core on every key state in both themes, console errors, the whole story
// with every non-file request blocked, keyboard-only operation, reduced motion, phone width,
// first paint and layout shift, build size, and a scan for forbidden wording.
// Run after `npm run build`:  npm run verify
import { chromium } from "playwright-core";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SHOTS, chromiumPath } from "./shoot.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const url = pathToFileURL(join(root, "dist/index.html")).href;

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ executablePath: chromiumPath(), headless: true, args: ["--no-sandbox"] });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ...opts });
  const external = [];
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("file:") || u.startsWith("data:")) return route.continue();
    external.push(u);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors, external };
}

const settle = (page, ms = 900) => page.waitForTimeout(ms);
const text = (page) => page.evaluate(() => document.body.innerText);

// ---------- 1. axe on every key state, both themes ----------
{
  let total = 0;
  const detail = [];
  for (const theme of ["light", "dark"]) {
    for (const vp of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ]) {
      const { ctx, page } = await newPage({ viewport: vp });
      for (const [name, beat, extra] of SHOTS) {
        await page.goto(`${url}?beat=${beat}&theme=${theme}&motion=reduce`);
        await page.evaluate(() => document.fonts.ready);
        if (extra) await page.evaluate((x) => window.__lift.set(x), extra);
        await settle(page, 400);
        await page.addScriptTag({ content: axeSource });
        const v = await page.evaluate(async () => {
          const r = await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
            resultTypes: ["violations"],
          });
          return r.violations.map((x) => `${x.id}: ${x.nodes.length} (${x.nodes[0]?.target?.join(" ")})`);
        });
        total += v.length;
        if (v.length) detail.push(`${name} ${theme} ${vp.width}: ${v.join("; ")}`);
      }
      await ctx.close();
    }
  }
  record(`axe-core, ${SHOTS.length} states x 2 themes x 2 viewports, zero violations`, total === 0, total ? detail.slice(0, 8).join(" | ") : "0 violations");
}

// ---------- 2. whole story by keyboard only, network blocked ----------
{
  const { ctx, page, errors, external } = await newPage();
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  const beats = await page.evaluate(() => window.__lift.beats);
  const checkpoints = {
    3: ["Túi vải tote", "Chưa nhập"],
    5: ["Độ tin cậy thấp", "Nên ghim tiếp: Áo hoodie zip"],
    6: ["Độ tin cậy trung bình", "dựa trên 12 bình luận", "2 phút trước: 3"],
    7: ["ĐANG GHIM", "Giữ ghim Áo hoodie zip"],
    8: ["Flash sale: chưa đủ tín hiệu"],
    9: ["Nên chạy flash sale trong 1 phút"],
    11: ["Hết hạn quyền truy cập", "Trợ lý tạm dừng"],
    13: ["Quần cargo", "ĐANG GHIM"],
    14: ["Kết thúc buổi live lúc 29:40?"],
    15: ["Tổng kết buổi live", "Điều chưa biết", "Nhận", "Bỏ qua", "Tự làm"],
    16: ["Hành trình dữ liệu", "Thu thập", "Làm sạch", "Phân tích", "Khai thác insight", "Đề xuất giải pháp", "Đánh giá hiệu quả"],
  };
  const missing = [];
  for (let i = 1; i < beats; i++) {
    await page.keyboard.press("ArrowRight");
    await settle(page, 3400);
    const body = await text(page);
    for (const want of checkpoints[i] ?? []) if (!body.includes(want)) missing.push(`beat ${i}: "${want}"`);
  }
  const final = await page.evaluate(() => window.__lift.get());
  record(
    "story plays end to end with ArrowRight only",
    final.beat === beats - 1 && final.journey && missing.length === 0,
    missing.length ? missing.join(", ") : `${beats - 1} beats, every checkpoint text seen`,
  );
  // back one beat rebuilds the recap deterministically
  await page.keyboard.press("ArrowLeft");
  await settle(page, 600);
  record("ArrowLeft rebuilds the previous beat", (await page.evaluate(() => window.__lift.get().screen)) === "recap");
  record("network blocked: no request left the page", external.length === 0, external.length ? external.join(", ") : "0 external requests");
  record("no console errors or warnings during the story", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---------- 3. keyboard operation of the UI itself (Tab + Enter, Space, Escape) ----------
{
  const { ctx, page, errors } = await newPage();
  await page.goto(`${url}?beat=6`);
  await settle(page);
  let found = false;
  for (let i = 0; i < 60 && !found; i++) {
    await page.keyboard.press("Tab");
    found = await page.evaluate(() => document.activeElement?.textContent?.includes("Ghim Áo hoodie zip") ?? false);
  }
  const visibleRing = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none");
  await page.keyboard.press("Enter");
  await settle(page, 900);
  const pinned = (await text(page)).includes("ĐANG GHIM");
  record("Tab reaches the suggestion, focus ring visible, Enter pins", found && visibleRing && pinned, `found=${found} ring=${visibleRing} pinned=${pinned}`);

  await page.keyboard.press("j");
  await settle(page, 500);
  const journeyOpen = await page.evaluate(() => window.__lift.get().journey);
  await page.keyboard.press("Escape");
  await settle(page, 300);
  const journeyClosed = !(await page.evaluate(() => window.__lift.get().journey));
  await page.keyboard.press("?");
  await settle(page, 300);
  const helpOpen = await page.evaluate(() => window.__lift.get().help);
  await page.keyboard.press("Escape");
  await page.keyboard.press("t");
  const dark = await page.evaluate(() => document.documentElement.dataset.theme === "dark");
  await page.keyboard.press("p");
  const presenter = await page.evaluate(() => !document.querySelector(".dock"));
  await page.keyboard.press("p");
  await page.keyboard.press("3");
  await settle(page, 500);
  const recap = (await text(page)).includes("Điều chưa biết");
  await page.keyboard.press("1");
  await settle(page, 400);
  const setup = await page.evaluate(() => window.__lift.get().screen === "setup");
  await page.keyboard.press("r");
  await settle(page, 400);
  const reset = await page.evaluate(() => window.__lift.get().beat === 0);
  await page.keyboard.press(" ");
  await settle(page, 4200);
  const autoplayed = await page.evaluate(() => window.__lift.get().beat >= 1);
  await page.keyboard.press(" ");
  record(
    "keys J, Esc, ?, T, P, 1, 3, R, Space all work",
    journeyOpen && journeyClosed && helpOpen && dark && presenter && recap && setup && reset && autoplayed,
    JSON.stringify({ journeyOpen, journeyClosed, helpOpen, dark, presenter, recap, setup, reset, autoplayed }),
  );
  record("no console errors during keyboard checks", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---------- 3b. data journey: steps, rings, and covers nothing ----------
{
  const { ctx, page, errors } = await newPage();
  await page.goto(`${url}?beat=16&motion=reduce`);
  await settle(page, 700);
  const layout = await page.evaluate(() => {
    const panel = document.querySelector(".journey-panel")?.getBoundingClientRect();
    const stage = document.querySelector(".stage")?.getBoundingClientRect();
    const badges = [...document.querySelectorAll(".jbadge")].map((b) => b.textContent);
    return { overlap: panel && stage ? panel.left < stage.right - 0.5 : true, badges };
  });
  await page.keyboard.press("ArrowRight");
  const s1 = await page.evaluate(() => window.__lift.get().journeyStage);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await settle(page, 400);
  const s4 = await page.evaluate(() => window.__lift.get().journeyStage);
  const ring = await page.evaluate(() => !!document.querySelector(".journey-ring"));
  record(
    "journey: panel beside the desk (no overlap), six badges in place, → / ↓ step stages with a ring",
    !layout.overlap && [...layout.badges].sort().join("") === "123456" && s1 === 1 && s4 === 4 && ring,
    JSON.stringify({ overlap: layout.overlap, badges: [...layout.badges].sort().join(""), s1, s4, ring }),
  );
  record("no console errors in the journey", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---------- 3c. presenter mode: type at least 14 px, body text at least 16 px (1920x1080) ----------
{
  const { ctx, page } = await newPage();
  const small = [];
  for (const beat of [3, 6, 9, 11, 15, 16]) {
    await page.goto(`${url}?beat=${beat}&presenter=1&motion=reduce`);
    await settle(page, 600);
    const found = await page.evaluate(() => {
      const BODY = ".cmt-text, .answer-lede, .flash > p, .unknowns li, .lede, .step-body > p, .dtable td, .journey-text, .chart-note, .confidence"; // running sentences; labels (prices, ticks, chips) need 14
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const el = node.parentElement;
        if (!el || el.closest(".phone-screen, .sr-only, [aria-hidden='true'] .jbadge, noscript, style, script")) continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none") continue;
        const size = parseFloat(cs.fontSize);
        const isBody = !!el.closest(BODY) && !el.closest(".chip, .row-kind, .outcome, .outcome-at, .sim-tag, .sample-tag, .jbadge");
        if (size < 14 || (isBody && size < 16)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${size}px "${node.textContent.trim().slice(0, 24)}"`);
      }
      return out;
    });
    for (const f of found) small.push(`beat ${beat}: ${f}`);
  }
  record("presenter mode: no text under 14 px, body text at least 16 px (phone mock excluded)", small.length === 0, small.slice(0, 6).join(" | "));
  await ctx.close();
}

// ---------- 3d. Vietnamese render test: the self-hosted face draws every glyph ----------
{
  const SAMPLE = "Nên ghim tiếp: Quần cargo, ếệạữ ởầ";
  const { ctx, page } = await newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${url}?motion=reduce`);
  const res = await page.evaluate(async (text) => {
    const box = document.createElement("div");
    box.id = "font-test";
    box.style.cssText = "position:fixed;left:0;top:0;z-index:999;background:var(--bg);color:var(--ink);padding:48px;display:grid;gap:20px;align-content:start";
    const rows = [
      ["300", "56px"],
      ["400", "28px"],
      ["500", "16px"],
    ];
    for (const [w, s] of rows) {
      const p = document.createElement("p");
      p.textContent = text;
      p.style.cssText = `font:${w} ${s}/1.25 "Be Vietnam Pro";letter-spacing:-0.01em`;
      box.append(p);
    }
    const cap = document.createElement("p");
    cap.textContent = "Be Vietnam Pro 300 / 400 / 500, tự lưu trong gói (tập vietnamese), không tải từ mạng.";
    cap.style.cssText = "font:400 14px 'Be Vietnam Pro';color:var(--ink-2)";
    box.append(cap);
    document.body.append(box);
    await document.fonts.ready;
    await Promise.all(rows.map(([w, s]) => document.fonts.load(`${w} ${s} "Be Vietnam Pro"`, text)));
    const loaded = rows.every(([w, s]) => document.fonts.check(`${w} ${s} "Be Vietnam Pro"`, text));
    // the vietnamese subset face must be the one in use: a missing glyph would fall back and change widths
    const c = document.createElement("canvas").getContext("2d");
    c.font = '300 56px "Be Vietnam Pro"';
    const wBVP = c.measureText(text).width;
    c.font = "300 56px monospace";
    const wMono = c.measureText(text).width;
    const faces = [...document.fonts].filter((f) => f.family.includes("Be Vietnam Pro") && f.status === "loaded").map((f) => `${f.weight}:${f.unicodeRange.slice(0, 10)}`);
    return { loaded, differs: Math.abs(wBVP - wMono) > 10, faces: faces.length };
  }, SAMPLE);
  await page.locator("#font-test").screenshot({ path: join(root, "screens/00-font-render-test.png") });
  record(
    `Vietnamese render test "${SAMPLE}" at 300/400/500 (self-hosted face, no fallback)`,
    res.loaded && res.differs && res.faces >= 3,
    `fonts.check=${res.loaded}, loaded faces=${res.faces}; PNG: screens/00-font-render-test.png`,
  );
  await ctx.close();
}

// ---------- 4. reduced motion: calm and complete ----------
{
  const { ctx, page, errors } = await newPage({ reducedMotion: "reduce" });
  await page.goto(url);
  const beats = await page.evaluate(() => window.__lift.beats);
  for (let i = 1; i < beats; i++) {
    await page.keyboard.press("ArrowRight");
    await settle(page, 3000);
  }
  const st = await page.evaluate(() => window.__lift.get());
  const looping = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      for (const pseudo of [null, "::after", "::before"]) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.animationName !== "none" && cs.display !== "none" && cs.animationIterationCount === "infinite") out.push(el.className);
        if (cs.animationName !== "none" && cs.display !== "none" && parseFloat(cs.animationDuration) > 0.01) out.push(`${el.className}:${cs.animationDuration}`);
      }
    }
    return out;
  });
  record("reduced motion: story completes", st.beat === beats - 1 && errors.length === 0);
  record("reduced motion: no looping or timed animation left", looping.length === 0, looping.slice(0, 4).join(", "));
  await ctx.close();
}

// ---------- 5. phone width 390, no horizontal scroll ----------
{
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const over = [];
  for (const beat of [0, 3, 6, 9, 11, 15, 16]) {
    await page.goto(`${url}?beat=${beat}&motion=reduce`);
    await settle(page, 500);
    const w = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
    if (w > 390) over.push(`beat ${beat}: ${w}px`);
  }
  record("390 px phone: no horizontal page scroll on any screen", over.length === 0, over.join(", "));
  await ctx.close();
}

// ---------- 6. first paint and layout shift ----------
{
  const { ctx, page } = await newPage();
  await page.goto(url);
  await settle(page, 1500);
  const perf = await page.evaluate(
    () =>
      new Promise((resolveP) => {
        let cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1;
          resolveP({ fcp: Math.round(fcp), cls: Number(cls.toFixed(4)) });
        }, 300);
      }),
  );
  record("first contentful paint under 1 s", perf.fcp > 0 && perf.fcp < 1000, `${perf.fcp} ms`);
  record("cumulative layout shift on load under 0.01", perf.cls < 0.01, `CLS ${perf.cls}`);
  await ctx.close();
}

await browser.close();

// ---------- 7. build size and forbidden wording ----------
{
  const dist = join(root, "dist");
  const size = readdirSync(dist).reduce((s, f) => s + statSync(join(dist, f)).size, 0);
  record("dist under 5 MB", size < 5 * 1024 * 1024, `${(size / 1024).toFixed(0)} KB`);
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const banned = [/synced with Shopee/i, /connected to Shopee/i, /confirmed by Shopee/i, /đồng bộ với Shopee/i, /kết nối Shopee/i, /create live/i, /lorem/i, /sẽ tăng doanh số/i, /gây ra/i];
  const hits = banned.filter((r) => r.test(html)).map(String);
  record("no forbidden wording in the build", hits.length === 0, hits.join(", "));
  const external = html.match(/(src|href)=["']https?:/g) ?? [];
  record("no external src/href in the build", external.length === 0);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
