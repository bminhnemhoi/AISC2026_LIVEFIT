// Run against disposable HTTPS installations; Playwright comes from the audit environment.
/* global document, localStorage, innerWidth, fetch */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const origin = process.env.LIVELIFT_BROWSER_URL;
const phase = process.env.LIVELIFT_BROWSER_AI_PHASE || 'ai';
const output = process.env.LIVELIFT_BROWSER_EVIDENCE;
assert(origin && output && process.env.LIVELIFT_BROWSER_AUTH_FILE, 'URL, evidence directory and protected credentials file required');
assert(['ai', 'noai'].includes(phase), 'Use ai or noai phase');
assert(phase === 'noai' || process.env.LIVELIFT_AI_FIXTURE_CONTROL, 'AI phase requires the disposable runtime fixture control');
const credentials = JSON.parse(fs.readFileSync(process.env.LIVELIFT_BROWSER_AUTH_FILE, 'utf8'));
const results = [], runtimeErrors = [], consoleErrors = [];
fs.mkdirSync(output, { recursive: true });
const mode = value => fs.writeFileSync(process.env.LIVELIFT_AI_FIXTURE_CONTROL, JSON.stringify({ mode: value }));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: width === 375 ? 667 : 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => runtimeErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const t = id => page.getByTestId(id);
    const state = label => t('copilot-state').filter({ hasText: label }).waitFor();
    const capture = async name => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${name}: page overflow`);
      const root = name.startsWith('operate-ai') ? t('operate-copilot') : name.startsWith('review-ai') ? t('review-copilot') : null;
      if (root) {
        await root.scrollIntoViewIfNeeded();
        assert.deepEqual(await root.evaluate(e => [...e.querySelectorAll('*')].filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
        }).map(el => el.getAttribute('data-testid') || el.tagName)), [], `${name}: Copilot content overflow`);
        for (const button of await root.getByRole('button').all()) {
          await button.scrollIntoViewIfNeeded();
          assert((await button.boundingBox()).height >= 44, `${name}: small Copilot control`);
          if (await button.isEnabled()) await button.click({ trial: true });
        }
      }
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: !name.startsWith('operate') });
      results.push({ width, height: width === 375 ? 667 : 900, name, phase });
      console.log(`PASS ${phase} ${width} ${name}`);
    };
    const source = () => page.evaluate(() => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions.find(s => s.id === 'sim-buffered'));
    await page.goto(origin + '/');
    await t('loop-guide').waitFor();
    await capture('home');
    await page.getByRole('link', { name: 'Insights', exact: true }).click();
    await t('insights-empty').waitFor();
    assert.match(await t('insights-empty').innerText(), /unavailable/);
    await capture('analytics-unavailable');
    await page.goto(origin + '/login');
    await page.getByLabel('Username').fill(credentials.username);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await t('account-name').waitFor();
    await page.goto(origin + '/live/new');
    await t('simulated-toggle').waitFor();
    assert.equal(await t('simulated-toggle').isChecked(), false);
    await capture('create-real-default');
    await page.goto(origin + '/simulator');
    await t('sim-explainer').waitFor();
    await capture('simulator');
    await page.goto(origin + '/live/sim-buffered/prepare');
    await t('start-live-cta-btn').waitFor();
    await capture('prepare');
    let aiRequests = 0;
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/v3/ai/')) aiRequests++; });
    await t('start-live-cta-btn').click();
    await t('now-panel').waitFor();
    for (let i = 0; i < 2; i++) await t('sim-apply-step').click();
    for (const id of ['now-panel', 'next-panel', 'why-box', 'recovery-list']) assert.equal(await t(id).count(), 1);
    assert.equal(aiRequests, 0, 'Rehearsal must not contact AI before opening its tab');
    await capture('operate');
    const beforeAnalysis = await source();
    await t('support-tab-copilot').click();
    if (phase === 'noai') {
      await state('Not configured');
      assert.equal(await t('copilot-ask-btn').count(), 0);
      assert.match(await t('layer-product').innerText(), /not AI/);
      await capture('operate-ai-not-configured');
    } else {
      mode('ok');
      await state('Ready');
      await t('copilot-ask-btn').click();
      await state('Available');
      assert.match(await t('ai-recommendation-state').innerText(), /Recommended · not applied/);
      assert.deepEqual(await source(), beforeAnalysis, 'An AI recommendation changed show state');
      await capture('operate-ai-available');
      if (width === 375) {
        for (const [failure, label] of [['500', 'Unavailable'], ['timeout', 'Unavailable'], ['429', 'Rate limited'], ['401', 'Unavailable'], ['malformed', 'Invalid response'], ['injected', 'Invalid response'], ['claim', 'Invalid response'], ['number', 'Invalid response']]) {
          mode(failure);
          await t('copilot-ask-btn').click();
          await state(label);
          assert.equal(await t('copilot-result').count(), 0, 'Failed answer remained visible');
          assert.equal(await t('apply-end_by').count(), 1, 'AI failure removed the product recovery action');
          assert.deepEqual(await source(), beforeAnalysis, 'AI failure changed show state');
          await capture(`operate-ai-${failure}`);
        }
        mode('ok');
        await t('copilot-ask-btn').click();
        await state('Available');
        await t('ai-apply-btn').click();
        await t('copilot-stale').waitFor();
        assert(await t('ai-apply-btn').isDisabled(), 'Stale advice can be accepted again');
        const accepted = await source();
        assert.equal(accepted.events.filter(e => e.type === 'recovery_selected').length, beforeAnalysis.events.filter(e => e.type === 'recovery_selected').length + 1);
        assert.deepEqual(accepted.runtime.actions, beforeAnalysis.runtime.actions, 'Recovery acceptance invented a performed action');
        await capture('operate-ai-accepted-stale');
      }
    }
    await page.goto(origin + '/live/sim-buffered/operate');
    for (let n = 0; n < 20 && (await source()).lifecycle !== 'ended'; n++) {
      const before = await t('sim-step-label').innerText();
      await t('sim-apply-step').click();
      if ((await source()).lifecycle !== 'ended' && before === await t('sim-step-label').innerText()) await t('sim-skip-step').click();
    }
    assert.equal((await source()).lifecycle, 'ended');
    await page.goto(origin + '/live/sim-buffered/review');
    await t('review-copilot').waitFor();
    assert.match(await t('simulated-review-note').innerText(), /Every record.*SIMULATED/);
    assert.match(await page.locator('main').innerText(), /Platform verification: unknown/i);
    await capture('review');
    const reviewed = await source();
    await t('copilot-open-btn').click();
    await state(phase === 'ai' ? 'Ready' : 'Not configured');
    if (phase === 'ai') {
      mode('ok');
      await t('copilot-ask-btn').click();
      await state('Available');
      assert.match(await t('review-copilot').innerText(), /not established/);
      assert.deepEqual(await source(), reviewed, 'AI review changed recorded history');
    }
    await capture(`review-ai-${phase === 'ai' ? 'available' : 'not-configured'}`);
    await page.getByRole('link', { name: 'Insights', exact: true }).click();
    await page.getByLabel('Environment', { exact: true }).selectOption('SIMULATED');
    await page.getByLabel('Session', { exact: true }).selectOption('sim-minimum');
    await t('insights-empty').waitFor();
    await capture('analytics-empty');
    await page.getByLabel('Session', { exact: true }).selectOption('sim-buffered');
    await t('analytics-detail').waitFor();
    assert.match(await t('analytics-detail').innerText(), /6:00/);
    assert.match(await t('analytics-detail').innerText(), /9:00/);
    assert.match(await page.locator('main').innerText(), /Observation does not establish causation/);
    assert.match(await page.locator('main').innerText(), /no provider-observed TikTok/);
    assert.deepEqual(await source(), reviewed, 'Analytics changed recorded history');
    await capture('analytics-populated');
    // Return to Review; analysis is transient and must be requested again.
    await page.goBack();
    await t('review-copilot').waitFor();
    if (phase === 'ai') {
      // A full navigation drops the transient answer, so explicitly ask again.
      if (await t('copilot-open-btn').count()) await t('copilot-open-btn').click();
      await state('Ready');
      await t('copilot-ask-btn').click();
      await state('Available');
      await t('ai-open-next-live-btn').click();
      assert.equal(await page.locator('[data-testid^="ai-suggests-"]').count(), 1);
      assert.equal(await t('next-live').locator('input[type="checkbox"]:checked').count(), 0);
      await capture('next-live-recommended');
      await t('select-ai-suggested-btn').click();
      assert.equal(await t('next-live').locator('input[type="checkbox"]:checked').count(), 1);
      if (await t('ack-infeasible').count()) await t('ack-infeasible').check();
    } else {
      await t('view-next-btn').click();
      await t('proposals-tradeoff').getByRole('checkbox').first().check();
    }
    await capture('next-live-selected');
    await t('create-next-live-cta-btn').click();
    await page.waitForURL(/\/prepare$/);
    assert.deepEqual(await source(), reviewed, 'Next LIVE changed source history');
    const nextId = new URL(page.url()).pathname.split('/')[2];
    const destination = await page.evaluate(id => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions.find(s => s.id === id), nextId);
    assert.equal(destination.environment, 'SIMULATED');
    assert.equal(destination.derivedFrom.appliedChanges.length, 1);
    assert.deepEqual(destination.events, []);
    assert.equal(destination.runtime.startedAtMs, null);
    await capture('next-live-created');
    await page.goto(origin + '/insights');
    await page.getByLabel('Environment', { exact: true }).selectOption('SIMULATED');
    await t('analytics-summaries').waitFor();
    assert.match(await t('next-live-history').innerText(), /Fall collection rehearsal · Next LIVE/);
    await capture('analytics-selected-history');
    await page.goto(origin + '/integrations');
    await t('tiktok-connection').waitFor();
    if (phase === 'ai') {
      if (width === 375) {
        await t('tiktok-connect').waitFor();
        await page.route('https://www.tiktok.com/v2/auth/authorize/**', async route => {
          const authorization = new URL(route.request().url());
          const callback = new URL(authorization.searchParams.get('redirect_uri'));
          callback.searchParams.set('state', authorization.searchParams.get('state'));
          callback.searchParams.set('code', 'fixture-code');
          await route.fulfill({ status: 302, headers: { location: callback.toString() }, body: '' });
        });
        await t('tiktok-connect').click();
        await page.waitForURL(/\/integrations\?tiktok=connected/);
      }
      await t('tiktok-state').filter({ hasText: 'Connected' }).waitFor();
      assert.equal(await t('tiktok-display-name').innerText(), 'Fixture Creator (not TikTok)');
      assert.match(await t('tiktok-limits').innerText(), /not platform-confirmed evidence/);
      await t('tiktok-refresh').click();
      await t('tiktok-refresh').filter({ hasText: 'Check connection' }).waitFor();
      await capture('integrations-connected-fixture');
      if (width === 1440) {
        await t('tiktok-disconnect').click();
        await t('tiktok-disconnect-confirm').click();
        await t('tiktok-state').filter({ hasText: 'Disconnected' }).waitFor();
        await capture('integrations-disconnected-fixture');
        await page.goto(origin + '/live/new');
        await page.getByLabel('Session title', { exact: false }).fill('Integrated REAL tracking acceptance');
        await page.getByText('30-minute show', { exact: true }).click();
        await t('submit-create-live-btn').click();
        await page.waitForURL(/\/prepare$/);
        await t('start-live-cta-btn').click();
        await t('start-rebase-dialog').waitFor();
        await page.getByRole('button', { name: 'Shift the schedule to now' }).click();
        await t('now-panel').waitFor();
        assert.equal(await t('simulator-strip').count(), 0);
        await t('end-live-header-btn').click();
        await page.getByRole('button', { name: 'End tracking', exact: true }).click();
        await page.waitForURL(/\/review$/);
        await state('Ready');
        const room = () => page.evaluate(async () => {
          const session = await (await fetch('/api/v3/auth/session')).json();
          const response = await fetch('/api/v3/room', { headers: { 'X-LiveLift-Request': '1', 'X-LiveLift-Workspace': session.workspaceId, 'X-LiveLift-Generation': session.generation } });
          if (!response.ok) throw new Error(`Room read failed: ${response.status}`);
          const snapshot = await response.json();
          delete snapshot.serverNowMs; // The read clock advances; recorded state must stay identical.
          return snapshot;
        });
        const before = await room();
        await t('copilot-ask-btn').click();
        await state('Available');
        assert.match(await t('ai-footer').innerText(), /from REAL evidence/);
        assert.equal(await t('simulated-review-note').count(), 0);
        assert.deepEqual(await room(), before, 'AI review mutated REAL room history');
        await capture('review-ai-real-fixture');
        await page.getByRole('link', { name: 'Insights', exact: true }).click();
        await t('analytics-summaries').waitFor();
        assert.doesNotMatch(await t('analytics-summaries').innerText(), /Fall collection rehearsal/);
        await capture('analytics-real');
      }
    } else {
      await t('tiktok-not-configured').waitFor();
      await capture('integrations-unconfigured');
    }
    assert.doesNotMatch(await page.locator('body').innerText(), /fixture-key-0123456789|fixture-secret/);
    await context.close();
  }
  assert.deepEqual(runtimeErrors, [], 'Browser runtime exceptions');
  assert.deepEqual(consoleErrors.filter(e => !/Failed to load resource: the server responded with a status of (401|429|502|503)/.test(e)), [], 'Unexpected browser/CSP errors');
  console.log(JSON.stringify({ result: 'PASS', phase, captures: results.length, runtimeErrors: runtimeErrors.length, output }));
} finally {
  fs.writeFileSync(path.join(output, 'intelligence-results.json'), JSON.stringify({ results, runtimeErrors, consoleErrors }, null, 2));
  await browser.close();
}
