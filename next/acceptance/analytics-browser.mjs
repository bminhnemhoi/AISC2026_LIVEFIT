// Uses the audit environment's Playwright; no app dependency is added.
/* global document, localStorage, getComputedStyle, window */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const origin = process.env.LIVELIFT_BROWSER_URL || 'http://127.0.0.1:3130';
const output = process.env.LIVELIFT_BROWSER_EVIDENCE || fs.mkdtempSync('/tmp/livelift-analytics-');
const credentials = process.env.LIVELIFT_BROWSER_AUTH_FILE ? JSON.parse(fs.readFileSync(process.env.LIVELIFT_BROWSER_AUTH_FILE, 'utf8')) : null;
const results = [], errors = [], consoleErrors = [];
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: width === 375 ? 667 : 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    const capture = async name => {
      const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.equal(size.scroll, width, `${name}: page overflow`);
      for (const table of await page.getByRole('table').all()) {
        assert(await table.getByRole('caption').count(), 'Table equivalent needs a caption');
        const container = table.locator('..');
        await container.scrollIntoViewIfNeeded();
        await page.keyboard.press('Tab');
        await container.focus();
        assert(await container.evaluate(e => e === document.activeElement && getComputedStyle(e).outlineStyle !== 'none'), 'Table scroll region needs visible keyboard focus');
        if (await container.evaluate(e => e.scrollWidth > e.clientWidth)) {
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(() => document.activeElement.scrollLeft > 0);
          await container.evaluate(e => { e.scrollLeft = 0; });
        }
      }
      for (const control of await page.locator('main select, main input, main button').all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= width + 1 && box.height >= 44, 'Analytics control clipped or too small');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true });
      results.push({ width, height: width === 375 ? 667 : 900, name, ...size });
      console.log(`PASS ${width} ${name}`);
    };
    await page.goto(origin + '/insights');
    await page.getByTestId('insights-empty').waitFor();
    assert.match(await page.getByTestId('insights-empty').innerText(), /REAL history is unavailable/);
    await capture('real-unavailable');
    await page.getByLabel('Environment', { exact: true }).selectOption('SIMULATED');
    await page.getByLabel('Session', { exact: true }).selectOption('sim-minimum');
    await page.getByTestId('insights-empty').waitFor();
    await capture('empty');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();

    const finish = async id => {
      await page.goto(`${origin}/live/${id}/prepare`);
      await page.getByTestId('start-live-cta-btn').click();
      for (let n = 0; n < 20; n++) {
        const ended = await page.evaluate(id => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions.find(s => s.id === id).lifecycle === 'ended', id);
        if (ended) return;
        await page.getByTestId('sim-apply-step').click();
      }
      throw new Error('Rehearsal did not finish');
    };
    await finish('sim-buffered');
    await page.goto(origin + '/live/sim-buffered/review');
    await page.getByTestId('view-next-btn').click();
    await page.getByTestId('proposals-tradeoff').getByRole('checkbox').first().check();
    await page.getByTestId('create-next-live-cta-btn').click();
    await page.waitForURL(/\/prepare$/);
    await finish('sim-missed');
    const before = await page.evaluate(() => localStorage.getItem('livelift.v3.SIMULATED'));
    await page.goto(origin + '/insights');
    await page.getByLabel('Environment', { exact: true }).selectOption('SIMULATED');
    await page.getByTestId('analytics-summaries').waitFor();
    assert.equal(await page.getByLabel('Session summaries').getByRole('article').count(), 3);
    assert.match(await page.locator('main').innerText(), /product segments overran in 3 \/ 3 sessions/);
    assert.match(await page.getByTestId('next-live-history').innerText(), /Opening: 3:00 → 2:00/);
    assert.match(await page.locator('main').innerText(), /Platform verification: unknown/);
    assert.match(await page.locator('main').innerText(), /no provider-observed TikTok/);
    await capture('trends');
    await page.getByRole('button', { name: 'Inspect timing · Fall collection rehearsal', exact: true }).click();
    await capture('timing');
    await page.getByLabel('Session', { exact: true }).selectOption('sim-minimum');
    await page.getByTestId('insights-empty').waitFor();
    await capture('filtered-empty');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByLabel('Order', { exact: true }).selectOption('oldest');
    await page.getByLabel('From date (UTC)', { exact: true }).fill('2027-01-01');
    await page.getByTestId('insights-empty').waitFor();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('livelift.v3.SIMULATED')), before, 'Analytics mutated source history');
    await page.getByRole('link', { name: 'Insights', exact: true }).focus();
    assert.equal(await page.getByRole('link', { name: 'Insights', exact: true }).getAttribute('aria-current'), 'page');

    if (credentials) {
      await page.goto(origin + '/login');
      await page.getByLabel('Username').fill(credentials.username);
      await page.getByLabel('Password', { exact: true }).fill(credentials.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByTestId('account-name').waitFor();
      await page.goto(origin + '/live/new');
      await page.getByLabel('Session title', { exact: false }).fill(`Analytics REAL ${width}`);
      await page.getByText('30-minute show', { exact: true }).click();
      await page.getByTestId('submit-create-live-btn').click();
      await page.waitForURL(/\/prepare$/);
      const realId = new URL(page.url()).pathname.split('/')[2];
      await page.getByTestId('start-live-cta-btn').click();
      await page.getByTestId('start-rebase-dialog').waitFor();
      await page.getByRole('button', { name: 'Shift the schedule to now' }).click();
      await page.getByTestId('now-panel').waitFor();
      await page.getByTestId('end-live-header-btn').click();
      await page.getByRole('button', { name: 'End tracking', exact: true }).click();
      await page.waitForURL(/\/review$/);
      await page.goto(origin + '/insights');
      await page.getByTestId('analytics-summaries').waitFor();
      await page.getByLabel('Session', { exact: true }).selectOption(realId);
      assert.match(await page.getByTestId('analytics-detail').innerText(), /not reached/);
      assert.match(await page.getByTestId('analytics-detail').innerText(), /Not recorded/);
      assert.doesNotMatch(await page.getByTestId('analytics-summaries').innerText(), /Fall collection rehearsal/);
      await capture('real-operations');
    }
    await context.close();
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  assert.deepEqual(consoleErrors.filter(e => !/Failed to load resource: the server responded with a status of (401|503)/.test(e)), [], 'Unexpected console or CSP errors');
  console.log(JSON.stringify({ result: 'PASS', captures: results.length, realVerified: Boolean(credentials), output }));
} finally {
  fs.writeFileSync(path.join(output, 'analytics-results.json'), JSON.stringify({ results, errors, consoleErrors }, null, 2));
  await browser.close();
}
