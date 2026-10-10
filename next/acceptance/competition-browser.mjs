// Run against a disposable demo runtime. Playwright comes from the audit environment,
// not the app dependencies: NODE_PATH=<installed Playwright parent> node acceptance/competition-browser.mjs.
/* global document, innerWidth, localStorage, getComputedStyle */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
const loadAuditDependency = createRequire(import.meta.url);
const { chromium } = loadAuditDependency('playwright');
const auditDirectory = path.dirname(fileURLToPath(import.meta.url));
const origin = process.env.LIVELIFT_BROWSER_URL || 'http://127.0.0.1:3130';
const output = process.env.LIVELIFT_BROWSER_EVIDENCE || fs.mkdtempSync('/tmp/livelift-browser-');
const credentials = process.env.LIVELIFT_BROWSER_AUTH_FILE
  ? JSON.parse(fs.readFileSync(process.env.LIVELIFT_BROWSER_AUTH_FILE, 'utf8')) : null;
const csv = fs.readFileSync(path.join(auditDirectory, '../../docs/competition/v3-demo/sample-products.csv'), 'utf8');
const tsv = fs.readFileSync(path.join(auditDirectory, '../../docs/competition/v3-demo/sample-products.tsv'), 'utf8');
const results = [], errors = [], pageErrors = [], links = new Set();
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  try {
    for (const width of [1440, 375, 768]) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: width === 375 ? 667 : 900 } });
      const page = await context.newPage();
      page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push({ width, url: page.url(), text: m.text() }); });
      page.on('pageerror', e => pageErrors.push(String(e)));
      const go = async (route, ready) => {
        const response = await page.goto(origin + route);
        assert.equal(response.status(), 200, route);
        await page.getByTestId(ready).waitFor();
      };
      const capture = async name => {
        const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.equal(dimensions.scroll, width, `${name} overflow at ${width}: ${dimensions.scroll}`);
        let rundown;
        if (['operate-start', 'operate-recovery'].includes(name)) {
          const rows = page.getByLabel('Run of Show rows', { exact: true });
          await rows.scrollIntoViewIfNeeded();
          rundown = await rows.evaluate(e => {
            const r = e.getBoundingClientRect(), main = e.closest('main').getBoundingClientRect();
            return {
              height: r.height,
              visibleHeight: Math.max(0, Math.min(r.bottom, main.bottom) - Math.max(r.top, main.top)),
              clientWidth: e.clientWidth, scrollWidth: e.scrollWidth,
              overflow: [...document.querySelectorAll('#main-content, #main-content *')].filter(el => {
                const style = getComputedStyle(el);
                return el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1
                  && ['visible', 'auto', 'scroll'].includes(style.overflowX) && !el.classList.contains('sr-only');
              }).map(el => el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.tagName),
            };
          });
          assert(rundown.height >= 160, `${name} rundown collapsed at ${width}: ${rundown.height}px`);
          assert(rundown.visibleHeight >= 160, `${name} rundown clipped at ${width}: ${rundown.visibleHeight}px`);
          assert.equal(rundown.scrollWidth, rundown.clientWidth, `${name} internal rundown overflow at ${width}`);
          assert.deepEqual(rundown.overflow, [], `${name} internal Operate overflow at ${width}`);
          // Inspect the current, next and final rows through the real nested scroll containers.
          const current = page.getByTestId('live-ros').locator('[aria-current="step"]');
          const next = page.getByTestId('live-ros').locator('[data-state="pending"]').first();
          const last = page.getByTestId('live-ros').locator('li').last();
          for (const row of [current, next, last]) {
            await row.scrollIntoViewIfNeeded();
            assert(await row.evaluate(e => {
              const r = e.getBoundingClientRect(), box = e.closest('[data-ros-scroll]').getBoundingClientRect();
              const main = e.closest('main').getBoundingClientRect();
              return r.top >= Math.max(box.top, main.top) - 1 && r.bottom <= Math.min(box.bottom, main.bottom) + 1;
            }), `${name} rundown row unreachable at ${width}`);
          }
          await page.getByRole('button', { name: 'Return to current', exact: true }).click();
          assert(await current.evaluate(e => {
            const r = e.getBoundingClientRect(), box = e.closest('[data-ros-scroll]').getBoundingClientRect();
            return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
          }), 'Return to current did not expose the current row');
          // Trial clicks check that primary actions can be scrolled to and receive input without changing the script.
          for (const id of ['estimate-open-btn', 'advance-btn', 'cue-performed-btn', 'quick-add-note-btn']) {
            await page.getByTestId(id).click({ trial: true });
          }
          if (name === 'operate-recovery') await page.locator('[data-testid^="apply-"]').first().click({ trial: true });
          rundown.primaryControlsUsable = true;
          rundown.rowsReachable = true;
          await rows.scrollIntoViewIfNeeded();
          await rows.focus();
          await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
          assert(await rows.evaluate(e => e === document.activeElement && getComputedStyle(e).outlineStyle !== 'none'), 'Rundown keyboard focus invisible');
        }
        for (const href of await page.locator('a[href]').evaluateAll(es => es.map(e => e.getAttribute('href')))) {
          if (href.startsWith('/') && !href.startsWith('//')) links.add(href);
        }
        await page.screenshot({ path: path.join(output, `${width}-${name}.png`) });
        results.push({ width, name, url: page.url(), ...dimensions, ...(rundown ? { rundown } : {}) });
        console.log(`PASS ${width} ${name}`);
      };
      const click = id => page.getByTestId(id).click();
      await go('/', 'loop-guide');
      await capture('home-signed-out');
      if (credentials) {
        await page.goto(origin + '/login');
        await page.getByLabel('Username').fill(credentials.username);
        await page.getByLabel('Password', { exact: true }).fill(credentials.password);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.getByTestId('account-name').waitFor();
        if (width === 1440) await page.getByTestId('first-run').waitFor();
        await capture('home-onboarding');
      }
      await go('/sessions', 'session-row-sim-buffered');
      await page.getByLabel('Find a session').fill('no matching competition show');
      await page.getByTestId('sessions-empty').waitFor();
      await capture('sessions-empty');
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      await page.getByTestId('session-row-sim-buffered').waitFor();
      await capture('sessions');
      await page.goto(origin + '/products');
      await page.getByRole('heading', { name: 'Product Library', exact: true }).waitFor();
      await capture('products');
      await page.getByRole('tab', { name: /Packs/ }).click();
      await click('inspect-pack-pack_02');
      await page.getByRole('dialog').waitFor();
      await capture('products-dialog');
      await page.getByRole('link', { name: 'Create LIVE with this sample pack' }).click();
      await page.getByTestId('start-pack').waitFor();
      assert(await page.getByTestId('start-pack').isChecked());
      assert.equal(await page.getByLabel('Pack', { exact: true }).inputValue(), 'pack_02');
      await capture('create-real-default');
      assert.equal(await page.getByTestId('simulated-toggle').isChecked(), false);
      assert.match(await page.locator('body').innerText(), /REAL records your show operations/);
      // Import both shipped assets into separate blank rehearsals, through the actual UI.
      for (const [format, rows] of [['csv', csv], ['tsv', tsv]]) {
        await go('/live/new?env=sim', 'simulated-toggle');
        await page.getByLabel('Session title', { exact: false }).fill(`Competition ${format} ${width}`);
        await page.getByTestId('submit-create-live-btn').click();
        await page.getByTestId('empty-pack').waitFor();
        await page.getByTestId('empty-ros').waitFor();
        await capture(`prepare-empty-${format}`);
        await click('import-btn');
        await page.getByTestId('import-text').fill(rows);
        assert.match(await page.getByTestId('import-preview').innerText(), /D04.*Not entered/);
        await capture(`import-dialog-${format}`);
        await page.getByRole('button', { name: /Import 4 products/ }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        assert.equal(await page.getByTestId('prepare-product-list').locator('li').count(), 4);
        await page.getByTestId('prepare-product-list').getByRole('button').filter({ hasText: 'D04' }).click();
        assert.equal(await page.getByLabel('Price (optional)', { exact: true }).inputValue(), '');
        await page.getByRole('button', { name: 'Close', exact: true }).last().click();
        await capture(`import-saved-${format}`);
      }
      await go('/simulator', 'scenario-list');
      await capture('simulator');
      await click('open-buffered');
      await page.getByTestId('start-live-cta-btn').waitFor();
      await capture('prepare');
      // All mobile reorder/edit controls must be inside the scrollable Run of Show.
      const clipped = await page.getByTestId('prepare-ros-list').locator('button').evaluateAll(es => es.filter(e => {
        const r = e.getBoundingClientRect(); return r.right > innerWidth || r.left < 0;
      }).map(e => e.getAttribute('aria-label')));
      assert.deepEqual(clipped, [], 'Prepare controls clipped');
      await click('start-live-cta-btn');
      await page.getByTestId('sim-apply-step').waitFor();
      await capture('operate-start');
      await click('sim-apply-step'); await click('sim-apply-step');
      assert.match(await page.getByTestId('now-title').innerText(), /Zip Hoodie/);
      assert.match(await page.getByTestId('next-title').innerText(), /Flash Sale/);
      assert.match(await page.getByTestId('why-box').innerText(), /late|deficit/i);
      await capture('operate-recovery');
      await page.goto(origin + '/');
      await page.getByTestId('active-live-card').waitFor();
      assert.equal(await page.getByTestId('first-run').count(), 0);
      assert.equal(await page.getByTestId('idle-card').count(), 0);
      await capture('home-active');
      await page.goto(origin + '/live/sim-buffered/operate');
      await page.getByTestId('sim-apply-step').waitFor();
      await click('quick-add-note-btn');
      await page.getByTestId('note-input').fill('Competition rehearsal operator note; not platform evidence.');
      await capture('operate-note-dialog');
      await page.keyboard.press('Tab');
      assert(await page.getByRole('dialog').evaluate(e => e.contains(document.activeElement)), 'Dialog focus escaped');
      await page.getByRole('button', { name: 'Save note', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await click('end-live-header-btn');
      await capture('end-dialog');
      await page.keyboard.press('Escape');
      assert(await page.getByTestId('end-live-header-btn').evaluate(e => e === document.activeElement));
      await page.getByTestId('end-live-header-btn').focus();
      await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
      assert(await page.getByTestId('end-live-header-btn').evaluate(e => getComputedStyle(e).outlineStyle !== 'none'), 'Keyboard focus invisible');
      for (let n = 0; n < 9; n++) await click('sim-apply-step');
      await page.getByRole('link', { name: /Open Review/ }).click();
      await page.getByTestId('review-reading-note').waitFor();
      assert.match(await page.getByTestId('review-reading-note').innerText(), /A report or attempt may still be recorded/);
      assert.match(await page.getByTestId('simulated-review-note').innerText(), /Every record.*SIMULATED/);
      assert.match(await page.locator('body').innerText(), /Platform verification: unknown/i);
      await capture('review');
      await page.goto(origin + '/live/sim-buffered/wrap');
      await page.waitForURL('**/live/sim-buffered/review');
      await page.getByTestId('review-reading-note').waitFor();
      await capture('wrap');
      await click('view-next-btn');
      await page.getByTestId('proposals-tradeoff').getByRole('checkbox').first().check();
      assert(await page.getByTestId('create-next-live-cta-btn').isEnabled(), 'Demo selection must be feasible');
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions.find(s => s.id === 'sim-buffered'));
      await capture('next-live');
      await click('create-next-live-cta-btn');
      await page.waitForURL(/\/prepare$/);
      await page.getByTestId('start-live-cta-btn').waitFor();
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions);
      assert.deepEqual(after.find(s => s.id === 'sim-buffered'), before, 'Next LIVE changed source history');
      const created = after.find(s => s.derivedFrom?.sessionId === 'sim-buffered');
      assert.equal(created.environment, 'SIMULATED'); assert.deepEqual(created.events, []);
      assert.equal(created.derivedFrom.appliedChanges.length, 1);
      await capture('next-prepare');
      await click('start-live-cta-btn');
      await page.getByTestId('now-panel').waitFor();
      await click('end-live-header-btn');
      await page.getByRole('button', { name: 'End tracking', exact: true }).click();
      await page.waitForURL(/\/review$/);
      await page.getByTestId('review-reading-note').waitFor();
      await capture('end-confirm-review');
      await go('/integrations', 'integrations-list');
      assert.equal(await page.getByRole('button', { name: /Configure|Connect account/ }).count(), 0);
      assert.match(await page.locator('body').innerText(), /No platform provider is connected/);
      await capture('capabilities');
      await page.getByRole('tab', { name: /Platform-Limited/ }).click();
      assert.equal(await page.getByText('Platform-limited', { exact: true }).count(), 4);
      await capture('capabilities-limited');
      await page.getByRole('tab', { name: /Unsupported/ }).click();
      await capture('capabilities-unsupported');
      await page.getByRole('tab', { name: /All Capabilities/ }).click();
      const ctas = await page.getByTestId('integrations-list').locator('a').evaluateAll(es => es.map(e => ({ text: e.textContent, href: e.getAttribute('href') })));
      for (const cta of ctas) {
        await page.getByTestId('integrations-list').getByRole('link', { name: cta.text.trim(), exact: true }).click();
        await page.waitForURL(origin + cta.href);
        await page.goto(origin + '/integrations'); await page.getByTestId('integrations-list').waitFor();
      }
      if (credentials) {
        await go('/live/new', 'simulated-toggle');
        await page.getByLabel('Session title', { exact: false }).fill(`REAL competition acceptance ${width}`);
        await page.getByText('30-minute show', { exact: true }).click();
        assert(await page.getByTestId('start-template').isChecked());
        await click('submit-create-live-btn');
        await page.waitForURL(/\/prepare$/);
        await page.getByTestId('start-live-cta-btn').waitFor();
        const realId = new URL(page.url()).pathname.split('/')[2];
        await capture('real-prepare');
        await click('start-live-cta-btn');
        await page.getByTestId('start-rebase-dialog').waitFor();
        await page.getByRole('button', { name: 'Shift the schedule to now' }).click();
        await page.getByTestId('now-panel').waitFor();
        assert.equal(await page.getByTestId('simulator-strip').count(), 0);
        assert.match(await page.locator('body').innerText(), /REAL/);
        await capture('real-operate');
        await click('cue-report-btn');
        await page.getByTestId('report-target').selectOption('new');
        await page.getByLabel('Action', { exact: true }).selectOption('other');
        await page.getByTestId('report-label').fill('Manual acceptance evidence');
        await page.getByRole('radio', { name: 'I tried — the outcome is unknown' }).check();
        await capture('real-report-attempt-dialog');
        await page.getByRole('button', { name: 'Record report' }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await page.getByTestId('cue-unresolved-btn').waitFor();
        await capture('real-attempt-unresolved');
        await click('cue-unresolved-btn');
        await page.getByRole('radio', { name: 'It went through (I performed it)' }).check();
        await page.getByRole('button', { name: 'Record report' }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await click('end-live-header-btn');
        assert.match(await page.getByTestId('end-live-dialog').innerText(), /does not stop your platform broadcast/);
        await page.getByRole('button', { name: 'End tracking', exact: true }).click();
        await page.waitForURL(/\/review$/);
        await page.getByTestId('review-reading-note').waitFor();
        assert.equal(await page.getByTestId('simulated-review-note').count(), 0);
        assert.match(await page.locator('body').innerText(), /Operator reported performed/);
        assert.match(await page.locator('body').innerText(), /Platform verification: unknown/i);
        await capture('real-review');
        await click('view-next-btn');
        await click('create-next-live-cta-btn');
        await page.waitForURL(/\/prepare$/);
        assert.notEqual(new URL(page.url()).pathname.split('/')[2], realId);
        await page.getByTestId('start-live-cta-btn').waitFor();
        await capture('real-next-prepare');
      }
      await context.close();
    }
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    for (const href of links) assert.equal((await page.goto(origin + href)).status(), 200, `Broken internal link: ${href}`);
    for (const route of ['/create', '/prepare', '/operate', '/review']) assert.equal((await page.goto(origin + route)).status(), 404, route);
    assert.deepEqual(pageErrors, [], 'Browser runtime exceptions');
    const expected = /Applying inline style|eval\(\) is not supported|Failed to load resource: the server responded with a status of (401|404|503)/;
    assert.deepEqual(errors.filter(e => !expected.test(e.text)), [], 'Unexpected browser console errors');
    console.log(JSON.stringify({ result: 'PASS', captures: results.length, internalLinks: links.size, pageErrors: pageErrors.length, output }));
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors, pageErrors, internalLinks: [...links] }, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
