// Run after opening the local or fixture landing URL:
// playwright-cli run-code --filename=acceptance/landing-layout.playwright.js
/* global URL, document, getComputedStyle */
async function _landingLayout(page) {
  const origin = new URL(page.url()).origin;
  if (origin === "null") throw new Error("Open the landing URL before running this check.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const report = [];
  const measure = () => page.locator(".lp .brand").evaluateAll(elements => elements.map(element => ({
    name: element.getAttribute("class"),
    width: parseFloat(getComputedStyle(element).width),
    height: parseFloat(getComputedStyle(element).height),
  })));
  const typography = () => page.locator(".lp h1, .lp h2, .lp h3, .lp button").evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return { text: element.textContent, fontWeight: style.fontWeight, fontSize: style.fontSize, lineHeight: style.lineHeight };
  }));
  const check = async (label, baseline, typeBaseline) => {
    await page.evaluate(() => document.fonts.ready);
    const current = await measure();
    const changed = current.filter((item, index) => !baseline[index] || item.name !== baseline[index].name
      || Math.abs(item.width - baseline[index].width) > 1 || Math.abs(item.height - baseline[index].height) > 1);
    if (changed.length || current.length !== baseline.length) throw new Error(`${label}: SVG dimensions changed: ${JSON.stringify({ baseline, current })}`);
    if (JSON.stringify(await typography()) !== JSON.stringify(typeBaseline)) throw new Error(`${label}: typography changed after navigation`);
    const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    if (size.scroll > size.client + 1) throw new Error(`${label}: horizontal overflow ${JSON.stringify(size)}`);
    const pinWidth = current.find(item => item.name.includes("lp-final-pin"))?.width;
    if (!(pinWidth > 0 && pinWidth <= 110)) throw new Error(`${label}: oversized pin (${pinWidth}px)`);
    report.push({ label, pinWidth, status: "PASS" });
  };
  try {
    for (const width of [320, 390, 640, 768, 959, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/`);
      await page.evaluate(() => document.fonts.ready);
      const baseline = await measure();
      const typeBaseline = await typography();
      await check(`${width}/fresh`, baseline, typeBaseline);
      for (const [name, route] of [["Mở LiveLift", "/home"], ["Trải nghiệm bản demo", "/start"]]) {
        await page.getByRole("link", { name, exact: true }).click();
        await page.waitForURL(`${origin}${route}`);
        await page.goBack();
        await page.waitForURL(`${origin}/`);
        await check(`${width}/back-from-${route.slice(1)}`, baseline, typeBaseline);
      }
      const cta = page.locator(".lp-final .btn");
      await cta.scrollIntoViewIfNeeded();
      const reachable = await cta.evaluate(element => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return !!hit && element.contains(hit);
      });
      if (!reachable) throw new Error(`${width}: final CTA is covered`);
    }
    return report;
  } finally {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
}
