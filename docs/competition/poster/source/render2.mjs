import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/user/LiveLift/next/acceptance/lab-browser.mjs')('playwright');
const dir = import.meta.dirname;
const scale = Number(process.argv[2] || 1);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1233, height: 1275 }, deviceScaleFactor: scale })).newPage();
await page.goto('file://' + path.join(dir, 'poster2.html'));
await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600);
const issues = await page.evaluate(() => {
  const out = [];
  for (const c of document.querySelectorAll('.card')) { if (c.scrollHeight > c.clientHeight + 1) out.push(['card overflow', c.querySelector('.hd span')?.textContent, c.scrollHeight, c.clientHeight]); }
  const lo = document.querySelector('.foot').getBoundingClientRect();
  out.push(['foot', Math.round(lo.top), Math.round(lo.bottom)]);
  return out;
});
console.log(JSON.stringify(issues));
await page.screenshot({ path: path.join(dir, scale === 1 ? 'poster2-preview.png' : 'poster2-content.png') });
await browser.close();
