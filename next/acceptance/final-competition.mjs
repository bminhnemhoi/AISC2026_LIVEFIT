#!/usr/bin/env node
// Tooling only. All product interactions use the real UI and production routes.
/* global document, localStorage, getComputedStyle */
import assert from 'node:assert/strict';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { app, startRuntime } from './final-runtime.mjs';

export function assertUnchanged(before, after, message = 'Source session changed') {
  assert.deepEqual(after, before, message);
}

// The accessible table carries timing truth; zero does not need a non-zero-width visual mark.
export function assertTiming(rows) {
  assert(rows.some(row => row.missing), 'Fixture must exercise missing timing');
  assert(rows.some(row => row.zero), 'Fixture must exercise an actual zero');
  for (const row of rows) {
    assert(!(row.missing && row.zero), `${row.title}: missing cannot also be measured zero`);
    if (row.missing) {
      assert.equal(row.actual, 'Not recorded', `${row.title}: missing actual became a number`);
      assert.equal(row.variance, 'Unknown', `${row.title}: missing variance became a number`);
    } else if (row.zero) {
      assert.equal(row.actual, '0:00', `${row.title}: actual zero was hidden`);
      assert.match(row.variance, /^[+−]?\d+:\d{2}( · (overrun|underrun))?$/, `${row.title}: measured zero lost its numeric variance`);
    }
  }
}

export function assertNext(source, created, changes) {
  assert(created && created.id !== source.id, 'Next LIVE must be a new session');
  assert.equal(created.environment, source.environment);
  assert.equal(created.lifecycle, 'planned');
  assert.equal(created.derivedFrom.sessionId, source.id);
  assert.equal(created.derivedFrom.appliedChanges.length, changes);
  assert.deepEqual(created.events, [], 'Next LIVE copied source history');
  assert.equal(created.runtime.startedAtMs, null);
  assert.equal(created.runtime.endedAtMs, null);
  assert.equal(created.runtime.currentSegmentId, null);
  assert(Object.values(created.runtime.segments).every(run => run.state === 'pending' && run.startedAtMs === null && run.endedAtMs === null));
  assert(Object.values(created.runtime.cues).every(run => run.state === 'pending' && run.reportedAtMs === null));
  assert.deepEqual(created.runtime.actions, {}, 'Next LIVE copied source action reports');
}

async function journey(browser, runtime, mode, width, report, output) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: width === 375 ? 667 : 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [], consoleErrors = [], httpErrors = [];
  let authenticated = false, phase = 'home';
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => {
    if (response.status() >= 400) {
      const route = new URL(response.url()).pathname;
      const expected = !authenticated && route === '/api/v3/auth/session' && response.status() === 401;
      if (!expected) httpErrors.push({ route, status: response.status() });
    }
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') httpErrors.push({ route: new URL(request.url()).pathname, error: request.failure()?.errorText });
  });
  const id = testId => page.getByTestId(testId);
  const click = testId => id(testId).click();
  const tabTo = async control => {
    for (let n = 0; n < 20; n++) {
      if (await control.evaluate(element => element === document.activeElement)) return;
      await page.keyboard.press('Tab');
    }
    assert.fail('Header control is unreachable by Tab');
  };
  const session = sessionId => page.evaluate(sessionId => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions.find(s => s.id === sessionId), sessionId);
  const snapshot = () => page.evaluate(() => localStorage.getItem('livelift.v3.SIMULATED'));
  const check = async (name, action, required = true) => {
    phase = name;
    try {
      const detail = await action();
      report.checks.push({ mode, width, name, status: 'PASS', ...(detail ? { detail } : {}) });
      console.log(`PASS ${mode} ${width} ${name}`);
    } catch (error) {
      report.checks.push({ mode, width, name, status: 'FAIL', error: error.message });
      await page.screenshot({ path: path.join(output, `${mode}-${width}-${name}-FAIL.png`) }).catch(() => {});
      console.error(`FAIL ${mode} ${width} ${name}: ${error.message}`);
      if (required) throw error;
    }
  };
  const go = async (route, ready) => {
    const response = await page.goto(runtime.origin + route);
    assert.equal(response.status(), 200, route);
    if (ready) await id(ready).waitFor();
  };
  const capture = async name => check(`${name}-layout`, async () => {
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert(dimensions.scroll <= dimensions.client + 1, `Horizontal page overflow: ${dimensions.scroll} > ${dimensions.client}`);
    await page.screenshot({ path: path.join(output, `${mode}-${width}-${name}.png`) });
    return dimensions;
  }, false);
  const copilot = async (testId, sessionId) => {
    const surface = id(testId);
    const expected = mode === 'not-configured' ? 'not_configured' : 'ready';
    await page.waitForFunction(({ testId, expected }) => document.querySelector(`[data-testid="${testId}"]`)?.getAttribute('data-phase') === expected, { testId, expected });
    const before = await session(sessionId);
    if (mode === 'not-configured') {
      assert.match(await surface.innerText(), /Not configured/);
      assert.match(await surface.getByTestId('layer-product').innerText(), /not AI/i);
      assert.equal(await surface.getByTestId('copilot-ask-btn').count(), 0);
      assert(await surface.getByTestId('fact-list').locator('li').count() > 0, 'Product facts must remain available');
    } else {
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().endsWith(`/api/v3/ai/${testId === 'operate-copilot' ? 'operate' : 'review'}`), { timeout: 70_000 }),
        surface.getByTestId('copilot-ask-btn').click(),
      ]);
      assert.equal(response.status(), 200);
      const result = await response.json();
      assert.equal(result.status, 'available', `Provider returned ${result.status}`);
      assert.equal(result.environment, 'SIMULATED');
      await surface.getByTestId('copilot-result').waitFor({ timeout: 70_000 });
      assert.equal(await surface.getAttribute('data-phase'), 'available');
      for (const layer of ['observed', 'interpretation', 'recommendation']) assert(await surface.getByTestId(`layer-${layer}`).count() > 0);
      if (testId === 'operate-copilot') {
        assert(await surface.getByTestId('ai-recommendation').count() > 0, 'Configured provider must exercise a recommendation');
        assert.match(await surface.getByTestId('ai-recommendation-state').first().innerText(), /Recommended · not applied/);
        await surface.getByTestId('ai-apply-btn').first().click({ trial: true });
      }
    }
    assertUnchanged(before, await session(sessionId), 'Opening/analysing the Copilot auto-applied a change');
  };
  try {
    await check('home', async () => { await go('/', 'loop-guide'); assert.match(await id('truth-panel').innerText(), /REAL|SIMULATED/); });
    await capture('home');
    await check('login', async () => {
      await go('/login');
      await page.getByLabel('Username').fill(runtime.credentials.username);
      await page.getByLabel('Password', { exact: true }).fill(runtime.credentials.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL(url => url.pathname !== '/login');
      authenticated = true;
      const menu = id('nav-menu-btn');
      if (width < 1024) {
        await page.getByRole('button', { name: 'Menu', exact: true, expanded: false }).waitFor();
        assert(await menu.evaluate(button => document.getElementById(button.getAttribute('aria-controls'))?.contains(document.querySelector('[data-testid="account-control"]'))), 'Menu must disclose the account');
        await tabTo(menu);
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Close', exact: true, expanded: true }).waitFor();
      } else {
        assert.equal(await menu.isVisible(), false);
      }
      await id('account-name').waitFor();
      assert.equal(await id('account-name').innerText(), 'Certification operator');
      assert.equal(await id('account-name').getAttribute('title'), 'Signed in as Certification operator');
      const signOut = page.getByRole('button', { name: 'Sign out', exact: true });
      await signOut.waitFor();
      await tabTo(signOut);
      assert(await signOut.evaluate(element => getComputedStyle(element).outlineStyle !== 'none'), 'Sign out keyboard focus is invisible');
      const account = await id('account-control').ariaSnapshot();
      assert.match(account, /Certification operator/);
      assert.match(account, /button "Sign out"/);
      await capture('authenticated-account');
      if (width < 1024) {
        await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        assert(await menu.evaluate(element => element === document.activeElement), 'Escape did not restore menu focus');
        assert.equal(await signOut.isVisible(), false);
        // Space also operates the disclosure; leave it closed for the rest of the journey.
        await page.keyboard.press('Space');
        await signOut.waitFor();
        await page.keyboard.press('Escape');
      }
      return { account, navigation: width < 1024 ? 'keyboard disclosure; Enter/Space/Escape' : 'visible desktop account', signOut: 'reachable by Tab with visible focus' };
    });
    let zeroId;
    await check('create-labels', async () => {
      await go('/live/new', 'simulated-toggle');
      assert.equal(await id('simulated-toggle').isChecked(), false);
      assert.match(await page.locator('main').innerText(), /REAL records your show operations/);
      await id('simulated-toggle').check();
      await page.getByLabel('Session title', { exact: false }).fill(`Certification zero and missing ${width}`);
      await page.getByText('30-minute show', { exact: true }).click();
      await capture('create');
      await click('submit-create-live-btn');
      await page.waitForURL(/\/prepare$/);
      await id('start-live-cta-btn').waitFor();
      zeroId = new URL(page.url()).pathname.split('/')[2];
      assert.equal((await session(zeroId)).environment, 'SIMULATED');
    });
    // UI-generated evidence with a measured zero and unreached segments, without inventing records.
    await check('zero-timing-fixture', async () => {
      await click('start-live-cta-btn'); await id('now-panel').waitFor();
      await click('end-live-header-btn');
      await page.getByRole('button', { name: 'End tracking', exact: true }).click();
      await page.waitForURL(/\/review$/);
      const run = await session(zeroId);
      assert.equal(run.runtime.endedAtMs, run.runtime.startedAtMs);
    });
    await check('simulator', async () => { await go('/simulator', 'scenario-list'); assert.match(await id('sim-explainer').innerText(), /virtual clock|REAL history/); });
    await capture('simulator');
    const sourceId = 'sim-buffered', savedTitle = `Fall collection rehearsal · certified ${width}`;
    await check('prepare-save', async () => {
      await click('open-buffered'); await id('start-live-cta-btn').waitFor();
      await click('edit-details-btn');
      await page.getByLabel('Title', { exact: true }).fill(savedTitle);
      await page.getByRole('button', { name: 'Save details', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal((await session(sourceId)).title, savedTitle);
      await page.reload(); await id('start-live-cta-btn').waitFor();
      assert.equal((await session(sourceId)).title, savedTitle, 'Prepare save did not survive reload');
      assert.match(await id('save-status').innerText(), /Saved on this device/);
    });
    await capture('prepare');
    await check('operate-now-next-why-action', async () => {
      await click('start-live-cta-btn'); await id('now-panel').waitFor();
      await click('sim-apply-step'); await click('sim-apply-step');
      assert.match(await id('now-title').innerText(), /Zip Hoodie/);
      assert.match(await id('next-title').innerText(), /Flash Sale/);
      assert.match(await id('why-box').innerText(), /late|deficit/i);
      assert.match(await id('simulator-strip').innerText(), /SIMULATED.*virtual clock/s);
      for (const testId of ['now-panel', 'next-panel', 'why-box']) { await id(testId).scrollIntoViewIfNeeded(); assert(await id(testId).isVisible()); }
      await page.locator('[data-testid^="apply-"]').first().click({ trial: true });
      for (const testId of ['estimate-open-btn', 'advance-btn', 'cue-performed-btn', 'quick-add-note-btn']) await id(testId).click({ trial: true });
    });
    await check('rundown', async () => {
      const rows = page.getByLabel('Run of Show rows', { exact: true });
      await rows.scrollIntoViewIfNeeded();
      const box = await rows.evaluate(element => {
        const r = element.getBoundingClientRect(), main = element.closest('main').getBoundingClientRect();
        return { height: r.height, visible: Math.max(0, Math.min(r.bottom, main.bottom) - Math.max(r.top, main.top)), client: element.clientWidth, scroll: element.scrollWidth };
      });
      assert(box.height >= 160 && box.visible >= 160, `Rundown collapsed/clipped: ${JSON.stringify(box)}`);
      assert(box.scroll <= box.client + 1, 'Rundown overflows horizontally');
      for (const row of [id('live-ros').locator('[aria-current="step"]'), id('live-ros').locator('[data-state="pending"]').first(), id('live-ros').locator('li').last()]) {
        await row.scrollIntoViewIfNeeded();
        assert(await row.evaluate(element => {
          const r = element.getBoundingClientRect(), scroll = element.closest('[data-ros-scroll]').getBoundingClientRect(), main = element.closest('main').getBoundingClientRect();
          return r.top >= Math.max(scroll.top, main.top) - 1 && r.bottom <= Math.min(scroll.bottom, main.bottom) + 1;
        }), 'Rundown row is unreachable');
      }
      await page.getByRole('button', { name: 'Return to current', exact: true }).click();
      await rows.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
      assert(await rows.evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle !== 'none'), 'Rundown keyboard focus is invisible');
      return box;
    }, false);
    await capture('operate');
    await check('keyboard-focus', async () => {
      await click('end-live-header-btn');
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      for (let n = 0; n < 8; n++) { await page.keyboard.press('Tab'); assert(await dialog.evaluate(element => element.contains(document.activeElement)), 'Dialog focus escaped'); }
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert(await id('end-live-header-btn').evaluate(element => element === document.activeElement), 'Escape did not restore focus');
      await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
      assert(await id('end-live-header-btn').evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle !== 'none'), 'Keyboard focus is invisible');
    }, false);
    await check('operate-copilot', async () => { await page.getByRole('tab', { name: 'AI Copilot', exact: true }).click(); await copilot('operate-copilot', sourceId); });
    await capture('operate-copilot');
    await check('copilot-reload-no-auto-apply', async () => {
      const before = await session(sourceId);
      await page.reload(); await id('now-panel').waitFor();
      assertUnchanged(before, await session(sourceId), 'Reload auto-applied a recommendation');
    });
    await check('full-simulated-rehearsal', async () => {
      for (let n = 0; n < 20 && (await session(sourceId)).lifecycle !== 'ended'; n++) await click('sim-apply-step');
      assert.equal((await session(sourceId)).lifecycle, 'ended', 'Rehearsal did not finish');
      await page.getByRole('link', { name: /Open Review/ }).click();
      await id('review-reading-note').waitFor();
      assert.match(await id('simulated-review-note').innerText(), /Every record.*SIMULATED/);
      assert.match(await page.locator('main').innerText(), /Platform verification: unknown/i);
    });
    const source = await session(sourceId);
    await capture('review');
    await check('review-copilot', async () => { await click('copilot-open-btn'); await copilot('review-copilot', sourceId); });
    await capture('review-copilot');
    await check('insights-missing-not-zero', async () => {
      const before = await snapshot();
      await go('/insights', 'insights');
      await page.getByLabel('Environment', { exact: true }).selectOption('SIMULATED');
      await page.getByLabel('Session', { exact: true }).selectOption(zeroId);
      await id('analytics-detail').waitFor();
      const zero = await session(zeroId);
      const table = id('analytics-detail').getByRole('table', { name: 'Segment timing and operator-declared coverage', exact: true });
      await table.waitFor();
      const headings = await table.getByRole('columnheader').allTextContents();
      const actualColumn = headings.indexOf('Actual') - 1, varianceColumn = headings.indexOf('Duration difference') - 1;
      assert(actualColumn >= 0 && varianceColumn >= 0, 'Accessible timing columns are missing');
      const observed = await table.locator('tbody tr').evaluateAll((rows, { actualColumn, varianceColumn }) => rows.map(row => {
        const cells = row.querySelectorAll('td');
        return { title: row.querySelector('th').innerText.split('\n')[0], actual: cells[actualColumn].innerText, variance: cells[varianceColumn].innerText };
      }), { actualColumn, varianceColumn });
      assert.equal(observed.length, zero.plans[0].segments.length, 'Timing table omitted fixture segments');
      const expected = zero.plans[0].segments.map((segment, index) => {
        assert.equal(observed[index].title, segment.title, 'Timing row does not match its recorded segment');
        const run = zero.runtime.segments[segment.id];
        const missing = run.state !== 'completed' || run.startedAtMs === null || run.endedAtMs === null;
        return { ...observed[index], missing, zero: !missing && run.startedAtMs === run.endedAtMs };
      });
      assertTiming(expected);
      assert.match(await page.locator('main').innerText(), /Views, GMV, CTR, conversion, engagement, and sales remain unavailable/);
      assert.match(await id('analytics-detail').innerText(), /Platform verification: unknown/);
      assertUnchanged(before, await snapshot(), 'Insights changed session storage');
      return expected;
    });
    await capture('insights');
    await check('next-live-explicit-selection', async () => {
      await go(`/live/${sourceId}/review`, 'review-reading-note');
      if (mode !== 'not-configured') { await click('copilot-open-btn'); await copilot('review-copilot', sourceId); }
      await click('view-next-btn'); await id('next-live').waitFor();
      const boxes = id('next-live').getByRole('checkbox');
      for (const box of await boxes.all()) assert.equal(await box.isChecked(), false, 'Next LIVE auto-selected a change');
      const beforeSelection = await snapshot();
      if (mode !== 'not-configured') {
        assert(await id('select-ai-suggested-btn').isVisible(), 'Provider must exercise Next LIVE suggestions');
        await click('select-ai-suggested-btn');
        assert(await id('next-live').locator('input[type="checkbox"]:checked').count() > 0);
        assertUnchanged(beforeSelection, await snapshot(), 'Selecting suggestions mutated history or created a show');
        for (const box of await boxes.all()) if (await box.isChecked()) await box.uncheck();
      }
      await id('proposals-tradeoff').getByRole('checkbox').first().check();
      assert.equal(await id('next-live').locator('input[type="checkbox"]:checked').count(), 1);
      assert(await id('create-next-live-cta-btn').isEnabled(), 'Selected proposal must be feasible');
      assertUnchanged(source, await session(sourceId));
    });
    await capture('next-live');
    await check('next-live-source-unchanged', async () => {
      await click('create-next-live-cta-btn'); await page.waitForURL(/\/prepare$/); await id('start-live-cta-btn').waitFor();
      const newId = new URL(page.url()).pathname.split('/')[2];
      assertUnchanged(source, await session(sourceId));
      assertNext(source, await session(newId), 1);
      await page.reload(); await id('start-live-cta-btn').waitFor();
      assertUnchanged(source, await session(sourceId), 'Source changed after reload');
    });
    await capture('next-prepare');
    await check('integrations-tiktok-truth', async () => {
      await go('/integrations', 'integrations-list');
      if (mode === 'not-configured') {
        await id('tiktok-not-configured').waitFor();
        assert.equal(await id('tiktok-state').innerText(), 'Not configured');
        assert.equal(await id('tiktok-connect').count(), 0);
      } else {
        await id('tiktok-connect').waitFor();
        // Do not contact the real authorize page: redirect its real state/binding to the fixture callback.
        await context.route('https://www.tiktok.com/v2/auth/authorize/**', route => {
          const authorize = new URL(route.request().url());
          const callback = new URL('/api/v3/integrations/tiktok/callback', runtime.origin);
          callback.searchParams.set('state', authorize.searchParams.get('state'));
          callback.searchParams.set('code', 'fixture-code');
          return route.fulfill({ status: 302, headers: { location: callback.href }, body: '' });
        });
        await click('tiktok-connect'); await id('tiktok-profile').waitFor();
        assert.equal(await id('tiktok-state').innerText(), 'Connected');
        assert.match(await id('tiktok-display-name').innerText(), /Fixture Creator \(not TikTok\)/);
      }
      assert.match(await id('tiktok-connection').innerText(), /does not start,\s*read or control a LIVE/);
      const limits = await id('tiktok-limits').innerText();
      for (const capability of ['TikTok LIVE eligibility', 'TikTok Shop', 'LIVE chat, engagement and analytics', 'Pin / unpin or promotion verification']) assert(limits.includes(capability));
      assert.equal((limits.match(/not established/g) ?? []).length, 4);
      assert.match(limits, /not platform-confirmed evidence about any show/);
      assert.equal(await id('tiktok-actions').getByRole('button', { name: /start.*LIVE|control.*LIVE|pin|promot/i }).count(), 0);
    });
    await capture('integrations');
    if (mode !== 'not-configured') await check('v7-login-kit-connected-capability', async () => {
      await page.waitForFunction(() => document.querySelector('[data-testid=capability-login_kit]')?.getAttribute('data-state') === 'connected');
      assert.equal(await id('capability-login_kit').getAttribute('data-state'), 'connected');
    });
    if (mode !== 'not-configured') await check('tiktok-fixture-disconnect', async () => {
      await click('tiktok-disconnect'); await click('tiktok-disconnect-confirm');
      await id('tiktok-disconnected').waitFor();
      assert.equal(await id('tiktok-profile').count(), 0);
    });
    for (const route of ['/terms', '/privacy']) {
      await check(route.slice(1), async () => { await go(route); assert(await page.getByRole('heading', { level: 1 }).isVisible()); });
      await capture(route.slice(1));
    }
    await check('responsive-sign-out', async () => {
      await go('/', 'loop-guide');
      if (width < 1024) {
        await tabTo(id('nav-menu-btn'));
        await page.keyboard.press('Enter');
      }
      const signOut = page.getByRole('button', { name: 'Sign out', exact: true });
      await signOut.waitFor();
      await tabTo(signOut);
      authenticated = false;
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/api/v3/auth/logout')),
        page.keyboard.press('Enter'),
      ]);
      assert.equal(response.status(), 200);
      await id('account-control').waitFor({ state: 'detached' });
      await go('/login');
      await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
      assert.equal(await id('login-already').count(), 0, 'Sign out did not end the session');
      return { keyboardActivation: 'Enter', logoutStatus: response.status(), signedOut: true };
    });
  } catch {
    report.aborted.push({ mode, width, after: phase });
  } finally {
    await check('browser-runtime-exceptions', () => assert.deepEqual(errors, []), false);
    await check('browser-http-errors', () => assert.deepEqual(httpErrors, []), false);
    // Resource messages are checked against exact route/status observations above; CSP/JS errors always fail.
    await check('browser-console-errors', () => assert.deepEqual(consoleErrors.filter(text => !/^Failed to load resource: the server responded with a status of \d+/.test(text)), []), false);
    report.browser.push({ mode, width, runtimeExceptions: errors, httpErrors, consoleErrors });
    await context.close();
  }
}

export async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Node 22.23.3: node acceptance/final-competition.mjs [--provider]\nRequires npm ci, npm run build, external Playwright, Chromium and OpenSSL.\nDefault: disposable not-configured + deterministic AI/TikTok fixtures at 375/768/1440.\n--provider adds a real AI run using LIVELIFT_AI_* from the shell (TikTok stays a fixture).\nLIVELIFT_BROWSER_EVIDENCE selects the private evidence directory; CHROMIUM_PATH selects Chromium.');
    return;
  }
  assert.equal(process.versions.node, '22.23.3', 'Use Node 22.23.3 for certification');
  assert(args.every(arg => arg === '--provider'), 'Unknown argument; use --help');
  if (args.includes('--provider')) for (const name of ['LIVELIFT_AI_BASE_URL', 'LIVELIFT_AI_API_KEY', 'LIVELIFT_AI_MODEL']) assert(process.env[name], `--provider requires ${name}`);
  assert(fs.existsSync(path.join(app, '.next/BUILD_ID')), 'Run npm run build first');
  const auditDependency = createRequire(import.meta.url);
  const { chromium } = auditDependency('playwright');
  const output = process.env.LIVELIFT_BROWSER_EVIDENCE || fs.mkdtempSync(path.join(os.tmpdir(), 'livelift-final-cert-'));
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).stdout.trim();
  const report = { result: 'FAIL', sha, buildId: fs.readFileSync(path.join(app, '.next/BUILD_ID'), 'utf8').trim(), node: process.version,
    tools: { playwright: auditDependency('playwright/package.json').version, chromium: null }, startedAt: new Date().toISOString(), checks: [], browser: [], aborted: [], blockers: [],
    provider: args.includes('--provider') ? 'requested' : 'NOT RUN: use --provider with server credentials', visualRegression: 'INCONCLUSIVE: no screenshot baseline', output };
  let browser, runtime;
  const interrupted = () => { report.blockers.push('Interrupted'); void browser?.close(); };
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
    report.tools.chromium = browser.version();
    for (const mode of ['not-configured', 'fixture', ...(args.includes('--provider') ? ['provider'] : [])]) {
      runtime = await startRuntime(mode, output);
      try { for (const width of [375, 768, 1440]) await journey(browser, runtime, mode, width, report, output); }
      finally { await runtime.stop(); runtime = null; }
    }
    report.result = report.checks.length > 0 && !report.checks.some(check => check.status === 'FAIL') && report.aborted.length === 0 && report.blockers.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) { report.blockers.push(error.message); }
  finally {
    await runtime?.stop(); await browser?.close();
    process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  }
  console.log(`FINAL CERT HARNESS: ${report.result}\nEvidence: ${output}`);
  if (report.result !== 'PASS') process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
