#!/usr/bin/env node
// V7 LIVE intelligence: browser acceptance. Tooling only; every product interaction uses the real UI and production routes.
// Needs: Node 22.23.3, npm ci, npm run build, an external Playwright (NODE_PATH), Chromium and OpenSSL.
//   node acceptance/live-intelligence-browser.mjs        (LIVELIFT_BROWSER_EVIDENCE=<dir> keeps screenshots, CHROMIUM_PATH picks Chromium)
// Both modes use actual Provider Core routes. REAL upstream requests are doubled only inside a disposable certification server.
/* global document, localStorage, window, crypto, fetch */
import assert from 'node:assert/strict';
import console from 'node:console';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL, URLSearchParams } from 'node:url';
import { app, startRuntime } from './final-runtime.mjs';

const WIDTHS = [[375, 667], [768, 900], [1440, 900]];

async function journey(browser, runtime, width, height, report, output) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height } });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors = [], httpErrors = [];
  let authenticated = false;
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', response => {
    if (response.status() < 400) return;
    const route = new URL(response.url()).pathname;
    const expected = !authenticated && route === '/api/v3/auth/session' && response.status() === 401;
    if (!expected) httpErrors.push({ route, status: response.status() });
  });
  const tid = id => page.getByTestId(id);
  const check = async (name, fn) => {
    try { await fn(); report.checks.push({ width, name, status: 'PASS' }); console.log(`PASS ${width} ${name}`); }
    catch (error) { report.checks.push({ width, name, status: 'FAIL', error: error.message }); console.error(`FAIL ${width} ${name}: ${error.message.split('\n')[0]}`); await page.screenshot({ path: path.join(output, `${width}-FAIL-${name.replace(/\W+/g, '-')}.png`) }).catch(() => {}); }
  };
  const noOverflow = async name => {
    const d = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.equal(d.scroll, d.client, `${name}: horizontal overflow ${d.scroll} > ${d.client}`);
    await page.screenshot({ path: path.join(output, `${width}-${name.replace(/\W+/g, '-')}.png`) });
  };
  const ready = () => page.waitForFunction(() => document.querySelector('[data-testid=later-evidence-view]')?.getAttribute('data-state') !== 'fetching', null, { timeout: 15_000 });

  await page.goto(runtime.origin + '/login');
  await page.getByLabel('Username').fill(runtime.credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(runtime.credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await tid('account-name').waitFor({ state: 'attached' });
  authenticated = true;

  // ---- SIMULATED: Review, both perspectives ------------------------------------------------------------------------
  const review = runtime.origin + '/live/sim-buffered-done/review';
  await check('known-then is the default and carries no provider data', async () => {
    await page.goto(review);
    await tid('perspective-switch').waitFor();
    assert.equal(await tid('perspective-known').getAttribute('aria-selected'), 'true');
    assert.equal(await tid('evidence-timeline').count(), 0);
    await page.waitForFunction(() => document.querySelector('[data-testid=provider-then-note]')?.textContent.includes('none recorded in LiveLift'));
    await tid('known-then-replay').waitFor();
    await noOverflow('review known');
  });
  let historyBefore = 0;
  await check('later evidence leads with the disclosure and is visibly a fixture', async () => {
    historyBefore = await page.locator('[data-testid="review-history"] li').count();
    await tid('perspective-known').focus();
    await page.keyboard.press('ArrowRight'); // keyboard: arrows switch
    await tid('later-evidence-view').waitFor();
    assert.equal(await tid('perspective-later').getAttribute('aria-selected'), 'true');
    assert.match(await tid('later-evidence-disclosure').textContent(), /This data was not available to the operator during the LIVE\./);
    assert.match(await tid('fixture-banner').textContent(), /FIXTURE PROVIDER EVIDENCE/);
    assert.equal(await tid('later-evidence-view').getAttribute('data-origin'), 'fixture');
    await noOverflow('review later');
  });
  await check('missing is not zero, in the chart and the attribution', async () => {
    await tid('fixture-select').selectOption('zero_clicks');
    await tid('metric-clicks').check({ force: true });
    const zero = await page.locator('[data-testid=evidence-chart] [data-minute]').evaluateAll(es => es.map(e => e.getAttribute('data-state')));
    assert(zero.length > 5 && zero.every(s => s === 'zero'), 'zero clicks must be drawn as zero');
    await tid('fixture-select').selectOption('missing_clicks');
    await tid('metric-clicks').check({ force: true });
    assert.match(await tid('metric-missing-note').textContent(), /This is not zero\./);
    assert.equal(await tid('evidence-chart').count(), 0, 'a missing metric must not draw an empty chart');
    const cells = await page.locator('[data-testid^="attribution-"][data-coverage] [data-metric="clicks"] [data-state]').evaluateAll(es => es.map(e => [e.getAttribute('data-state'), e.textContent]));
    assert(cells.length > 0 && cells.some(([s, t]) => s === 'missing' && t === 'Not recorded') && cells.every(([s]) => ['missing', 'unknown'].includes(s)));
    await noOverflow('missing clicks');
  });
  await check('zero GMV and missing GMV remain distinct in minutes and products', async () => {
    await tid('fixture-select').selectOption('zero_gmv'); await tid('metric-gmv').check({ force: true });
    const zero = await page.locator('[data-testid=evidence-chart] [data-minute]').evaluateAll(es => es.map(e => e.getAttribute('data-state')));
    assert(zero.length > 5 && zero.every(s => s === 'zero'));
    assert.match(await tid('product-performance').innerText(), /VND 0/);
    await noOverflow('zero GMV');
    await tid('fixture-select').selectOption('missing_gmv'); await tid('metric-gmv').check({ force: true });
    assert.equal(await tid('evidence-chart').count(), 0); assert.match(await tid('metric-missing-note').innerText(), /not zero/);
    assert(!/VND 0/.test(await tid('product-performance').innerText()));
    await noOverflow('missing GMV');
  });
  await check('an ambiguous boundary minute is shown and assigned to neither segment', async () => {
    await tid('fixture-select').selectOption('ambiguous');
    await tid('key-boundary').waitFor();
    assert((await page.locator('[data-minute][data-boundary="true"]').count()) > 0);
    const row = page.locator('[data-testid^="attribution-"][data-coverage="ambiguous"]').first();
    const id = (await row.getAttribute('data-testid')).replace('attribution-', '');
    await tid(`attribution-toggle-${id}`).click();
    assert.match(await tid(`ambiguous-${id}`).textContent(), /Not assigned to either/);
  });
  await check('every provider state is its own plain statement', async () => {
    for (const [scenario, kind] of [['not_configured', 'not_configured'], ['access_not_granted', 'access_not_granted'], ['auth_expired', 'auth_expired'], ['rate_limited', 'rate_limited'], ['unavailable', 'unavailable']]) {
      await tid('fixture-select').selectOption(scenario);
      assert.equal(await tid('provider-state').getAttribute('data-kind'), kind);
      assert.match(await tid('provider-state').textContent(), /never shown as 0/);
    }
    await noOverflow('provider states');
  });
  await check('switching perspectives never changes the recorded history', async () => {
    await tid('fixture-select').selectOption('rich');
    await tid('perspective-known').click();
    await tid('review-summary').waitFor();
    assert.equal(await page.locator('[data-testid="review-history"] li').count(), historyBefore);
  });

  // ---- SIMULATED: Operate quick report -----------------------------------------------------------------------------
  await check('a quick report is an operator-reported note, keyboard first', async () => {
    await page.goto(runtime.origin + '/live/sim-buffered/prepare');
    await tid('start-live-cta-btn').click();
    if (await tid('start-keep-planned').isVisible().catch(() => false)) await tid('start-keep-planned').click();
    await page.waitForURL(/operate/);
    await tid('quick-report-btn').click();
    await tid('quick-report-panel').waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await tid('command-ack-banner').waitFor();
    assert.match(await tid('command-ack-banner').textContent(), /CTA delivered \(operator-reported quick cue\)/);
    assert.equal(await tid('quick-report-panel').count(), 0, 'the panel closes after a report');
    await noOverflow('operate');
  });

  // ---- SIMULATED: Insights and Integrations ------------------------------------------------------------------------
  await check('Insights keeps operations and platform evidence apart; fixtures need an explicit opt-in', async () => {
    await page.goto(runtime.origin + '/insights');
    await tid('insights').waitFor();
    await page.getByLabel('Environment').selectOption('SIMULATED');
    assert.match(await tid('platform-evidence').textContent(), /Unavailable: no provider-observed/);
    assert.equal(await tid('fixture-banner').count(), 0);
    await tid('platform-evidence-request').click();
    await tid('fixture-banner').waitFor();
    await tid('segment-attribution').waitFor();
    await tid('product-performance').waitFor();
    await noOverflow('insights');
  });
  await check('Integrations states what TikTok does and does not offer', async () => {
    await page.goto(runtime.origin + '/integrations');
    await tid('provider-evidence-access').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid=capability-creator_realtime]')?.getAttribute('data-state') === 'not_configured');
    assert.equal(await tid('capability-raw_chat').getAttribute('data-state'), 'unsupported');
    assert.equal(await tid('capability-pin_control').getAttribute('data-state'), 'unsupported');
    assert.equal(await tid('capability-creator_realtime').getAttribute('data-state'), 'not_configured');
    await noOverflow('integrations');
  });

  // ---- REAL: created and ended through the UI; the actual core refuses fixture fallback ------------------------------
  await check('REAL show with no provider says so, and shows no fixture or numbers', async () => {
    await page.goto(runtime.origin + '/live/new');
    await tid('start-template').check({ force: true });
    await page.getByLabel(/Session title/).fill('REAL V7 acceptance');
    await tid('submit-create-live-btn').click();
    await page.waitForURL(/\/prepare/);
    await tid('start-live-cta-btn').click();
    if (await tid('start-keep-planned').isVisible().catch(() => false)) await tid('start-keep-planned').click();
    await page.waitForURL(/operate/);
    await tid('quick-report-btn').click();
    await tid('quick-cue-price_questions').click();
    await tid('command-ack-banner').waitFor();
    await page.waitForTimeout(1200);
    await tid('end-live-header-btn').click();
    await page.getByRole('button', { name: 'End tracking' }).click();
    await page.waitForURL(/review/);
    await tid('perspective-later').click();
    await tid('later-evidence-view').waitFor();
    await ready();
    assert.equal(await tid('later-evidence-view').getAttribute('data-state'), 'not_configured');
    assert.equal(await tid('fixture-banner').count() + await tid('fixture-select').count() + await tid('evidence-timeline').count(), 0);
    report.realUrl = page.url().replace(/\?.*$/, '');
    await noOverflow('real not configured');
  });
  await check('no runtime exceptions or unexpected HTTP errors', async () => { assert.deepEqual(errors, []); assert.deepEqual(httpErrors, []); });
  await context.close();
}

// Extra checks use the same browser cookie, CSRF marker and authority context as the product.
async function integrated(browser, runtime, width, height, report, output, real) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height } });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors = [], httpErrors = [];
  page.on('pageerror', error => errors.push(String(error)));
  let signedIn = false;
  page.on('response', response => {
    if (response.status() < 400) return;
    const route = new URL(response.url()).pathname;
    if (!signedIn && route === '/api/v3/auth/session' && response.status() === 401) return;
    // The two deliberately invalid REAL injection attempts below must fail with 400.
    if (real && route === '/api/v3/intelligence/refresh' && response.status() === 400) return;
    httpErrors.push({ route, status: response.status() });
  });
  const tid = id => page.getByTestId(id);
  const check = async (name, action) => {
    try { await action(); report.checks.push({ width, name, status: 'PASS' }); console.log(`PASS ${width} ${name}`); }
    catch (error) { report.checks.push({ width, name, status: 'FAIL', error: error.message }); await page.screenshot({ path: path.join(output, `${width}-${real ? 'real' : 'fixture'}-FAIL.png`) }).catch(() => {}); throw error; }
  };
  const call = (route, body) => page.evaluate(async ({ route, body }) => {
    const auth = await (await fetch('/api/v3/auth/session', { headers: { 'X-LiveLift-Request': '1' } })).json();
    const response = await fetch(route, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-LiveLift-Request': '1', 'X-LiveLift-Workspace': auth.workspaceId, 'X-LiveLift-Generation': auth.generation, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }, { route, body }).then(result => { runtime.assertNoSecrets(JSON.stringify(result.body)); return result; });
  const inspectLayout = async name => {
    const d = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.equal(d.scroll, d.client, `${name}: horizontal overflow`);
    runtime.assertNoSecrets(await page.locator('body').innerText());
    await page.screenshot({ path: path.join(output, `${width}-${real ? 'real' : 'fixture'}-${name}.png`) });
    await page.evaluate(fs.readFileSync(process.env.AXE_PATH || '/tmp/livelift-competition-qa/node_modules/axe-core/axe.min.js', 'utf8'));
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations, [], `${name}: axe violations`);
  };
  try {
    await page.goto(runtime.origin + '/login');
    await page.getByLabel('Username').fill(runtime.credentials.username);
    await page.getByLabel('Password', { exact: true }).fill(runtime.credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await tid('account-name').waitFor({ state: 'attached' }); signedIn = true;
    let session;
    if (real) {
      await page.goto(runtime.origin + '/live/new');
      await tid('start-template').check({ force: true });
      await page.getByLabel(/Session title/).fill('REAL integrated provider transport certification');
      await tid('submit-create-live-btn').click(); await page.waitForURL(/\/prepare/);
      await tid('start-live-cta-btn').click();
      if (await tid('start-keep-planned').isVisible().catch(() => false)) await tid('start-keep-planned').click();
      await page.waitForURL(/operate/);
      await tid('quick-report-btn').click(); await tid('quick-cue-price_questions').click(); await tid('command-ack-banner').waitFor();
      const sessionId = new URL(page.url()).pathname.split('/')[2];
      await check('REAL Operate AI contains no future provider evidence', async () => {
        const result = await call('/api/v3/ai/operate', { sessionId });
        assert.equal(result.status, 200); assert.equal(result.body.status, 'available');
        assert(!result.body.facts.some(f => f.perspective === 'later_evidence' || f.evidenceTier === 'provider_observed'));
      });
      await page.waitForTimeout(1200);
      await tid('end-live-header-btn').click(); await page.getByRole('button', { name: 'End tracking' }).click(); await page.waitForURL(/review/);
      const auth = (await call('/api/v3/auth/session')).body;
      const room = await call(`/api/v3/room?roomId=${auth.roomId}`);
      session = room.body.sessions.find(s => s.id === sessionId);
      assert(session, 'authoritative REAL session');
      fs.writeFileSync(runtime.intelligenceControl, JSON.stringify({ state: 'available', startMs: session.runtime.startedAtMs, endMs: session.runtime.endedAtMs }), { mode: 0o600 });
    } else {
      await page.goto(runtime.origin + '/live/sim-buffered-done/review'); await tid('perspective-switch').waitFor();
      session = await page.evaluate(() => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions.find(s => s.id === 'sim-buffered-done'));
    }
    const auth = (await call('/api/v3/auth/session')).body;
    const read = (extra = {}) => real ? call(`/api/v3/intelligence/evidence?${new URLSearchParams({ roomId: auth.roomId, sessionId: session.id, ...extra })}`) : call('/api/v3/intelligence/evidence', { roomId: auth.roomId, sessionId: session.id, session, ...extra, ...(extra.asOfMs ? { asOfMs: Number(extra.asOfMs) } : {}) });
    const original = JSON.stringify(session);
    let first;
    await check(`${real ? 'REAL' : 'SIMULATED'} UI refresh persists canonical immutable evidence`, async () => {
      await tid('perspective-later').click();
      await tid('evidence-refresh-btn').waitFor();
      if (real) await page.getByLabel('Provider LIVE session ID').fill('123');
      const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === '/api/v3/intelligence/refresh'), tid('evidence-refresh-btn').click()]);
      assert.equal(response.status(), 200); first = (await response.json()).snapshot;
      assert(first, 'AVAILABLE must contain canonical snapshot');
      assert.equal(first.mode, real ? 'REAL' : 'SIMULATED'); assert.equal(first.provider, real ? 'tiktok_shop' : 'fixture');
      assert(first.minuteBuckets.every(b => b.source === first.provider && b.evidenceTier === 'provider_observed'));
      await page.waitForFunction(() => document.querySelector('[data-testid=later-evidence-view]')?.getAttribute('data-state') === 'available');
      assert.match(await tid('provenance').innerText(), new RegExp(first.snapshotId));
      assert.equal(await tid('fixture-banner').count(), real ? 0 : 1);
      assert.match(await tid('later-evidence-disclosure').innerText(), /not available to the operator during the LIVE/);
      await inspectLayout('later-evidence');
      const prior = await read({ snapshotId: first.snapshotId }); assert.equal(prior.status, 200); assert.deepEqual(prior.body.snapshot, first);
      await page.reload(); await tid('perspective-later').click();
      await tid('provenance').waitFor(); assert.match(await tid('provenance').innerText(), new RegExp(first.snapshotId));
    });
    await check(`${real ? 'REAL' : 'SIMULATED'} historical server path excludes later snapshots`, async () => {
      const known = await read({ perspective: 'as_known_then', asOfMs: String(session.runtime.endedAtMs) });
      assert.equal(known.status, 200); assert.equal(known.body.perspective, 'as_known_then');
      assert.equal(known.body.snapshot, undefined); assert.deepEqual(known.body.providerEvidence, []);
      assert(known.body.events.every(e => e.recordedAtMs <= session.runtime.endedAtMs));
    });
    await check(`${real ? 'REAL' : 'SIMULATED'} Review AI cites later evidence and hides it As Known Then`, async () => {
      const surface = tid('review-copilot');
      if (await surface.getByTestId('copilot-open-btn').isVisible().catch(() => false)) await surface.getByTestId('copilot-open-btn').click();
      await surface.getByTestId('copilot-ask-btn').waitFor();
      const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === '/api/v3/ai/review'), surface.getByTestId('copilot-ask-btn').click()]);
      const result = await response.json(); assert.equal(result.status, 'available');
      const later = result.facts.filter(f => f.perspective === 'later_evidence');
      assert(later.length > 0 && later.every(f => f.evidenceTier === 'provider_observed' && f.source === first.provider && f.fetchedAt === first.fetchedAt));
      assert(result.output.summary.cites.some(id => later.some(f => f.id === id)), 'AI actually received later evidence');
      await tid('ai-summary').waitFor();
      await tid('perspective-known').click(); await tid('ai-summary-withheld').waitFor();
      assert.equal(await tid('evidence-timeline').count(), 0);
      await inspectLayout('known-then');
    });
    await check(`${real ? 'REAL' : 'SIMULATED'} refetch keeps prior snapshot and original source record`, async () => {
      if (real) {
        fs.writeFileSync(runtime.intelligenceControl, JSON.stringify({ state: 'limited' }), { mode: 0o600 });
        await tid('perspective-later').click(); await tid('evidence-refresh-btn').click();
        await page.waitForFunction(() => document.querySelector('[data-testid=provider-state]')?.getAttribute('data-kind') === 'rate_limited');
        const prior = await read({ snapshotId: first.snapshotId }); assert.deepEqual(prior.body.snapshot, first); assert.equal(prior.body.status.state, 'RATE_LIMITED');
        const room = await call(`/api/v3/room?roomId=${auth.roomId}`); assert.equal(JSON.stringify(room.body.sessions.find(s => s.id === session.id)), original);
        const bad = { commandId: await page.evaluate(() => crypto.randomUUID()), roomId: auth.roomId, sessionId: session.id, expectedSessionRevision: session.revision, providerSessionId: '123', fixtureCase: 'normal' };
        assert.equal((await call('/api/v3/intelligence/refresh', bad)).status, 400);
        assert.equal((await call('/api/v3/intelligence/refresh', { ...bad, commandId: await page.evaluate(() => crypto.randomUUID()), session })).status, 400);
        await inspectLayout('rate-limited');
      } else {
        await tid('perspective-later').click(); await tid('fixture-select').selectOption('zero_clicks');
        const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === '/api/v3/intelligence/refresh'), tid('evidence-refresh-btn').click()]);
        const newer = (await response.json()).snapshot; assert(newer && newer.snapshotId !== first.snapshotId); assert(newer.minuteBuckets.every(b => b.clicks === 0));
        assert.deepEqual((await read({ snapshotId: first.snapshotId })).body.snapshot, first);
        const current = await page.evaluate(id => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions.find(s => s.id === id), session.id); assert.equal(JSON.stringify(current), original);
      }
    });
    if (!real) await check('canonical fixture exercises repeated products, not-reached and unknown mapping in the UI', async () => {
      const { providerFixtureSession } = await import(pathToFileURL(path.join(runtime.fixtureTools, 'lib/server/liveIntelligence/fixtureSession.js')));
      const repeated = providerFixtureSession('repeated_product');
      await page.evaluate(repeated => {
        const state = JSON.parse(localStorage.getItem('livelift.v3.SIMULATED'));
        state.sessions.push(repeated); localStorage.setItem('livelift.v3.SIMULATED', JSON.stringify(state));
      }, repeated);
      await page.goto(runtime.origin + `/live/${repeated.id}/review`); await tid('perspective-later').click();
      await tid('product-performance').waitFor();
      assert.match(await tid('product-performance').innerText(), /2 segments|several segments/);
      assert.match(await tid(`attribution-${repeated.id}:s3`).innerText(), /Did not run|Not reached/);
      const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === '/api/v3/intelligence/refresh'), tid('evidence-refresh-btn').click()]);
      const stored = (await response.json()).snapshot; assert.equal(stored.productPerformance[0].association, 'ambiguous'); assert.equal(stored.productPerformance[0].segmentId, undefined);
      await inspectLayout('repeated-product');
      const unknown = await call('/api/v3/intelligence/refresh', { commandId: await page.evaluate(() => crypto.randomUUID()), roomId: auth.roomId, sessionId: repeated.id, expectedSessionRevision: repeated.revision, session: repeated, fixtureCase: 'unknown_product', productMappings: [{ liveLiftProductId: repeated.products[0].id, providerProductId: '100001' }] });
      assert.equal(unknown.status, 200); assert.equal(unknown.body.snapshot.productPerformance[0].association, 'session_only');
      await page.reload(); await tid('perspective-later').click(); await tid('product-performance').waitFor();
      assert.match(await tid('product-performance').innerText(), /Not matched to a LiveLift product/);
      await inspectLayout('unknown-product');
      const retained = await page.evaluate(id => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions.find(s => s.id === id), repeated.id);
      assert.deepEqual(retained, repeated);
    });
    await check(`${real ? 'REAL' : 'SIMULATED'} integrated browser has no runtime or unexpected HTTP errors`, async () => { assert.deepEqual(errors, []); assert.deepEqual(httpErrors, []); runtime.verifyPrivateArtifacts(); });
  } finally { await context.close(); }
}
const integratedFixture = (...args) => integrated(...args, false);
const integratedReal = (...args) => integrated(...args, true);

export async function main() {
  if (process.argv.includes('--help')) {
    console.log('Node 22.23.3: node acceptance/live-intelligence-browser.mjs\nRequires npm ci, npm run build, external Playwright (NODE_PATH), Chromium and OpenSSL.\nLIVELIFT_BROWSER_EVIDENCE selects the evidence directory; CHROMIUM_PATH selects Chromium.');
    return;
  }
  assert.equal(process.versions.node, '22.23.3', 'Use Node 22.23.3');
  assert(fs.existsSync(path.join(app, '.next/BUILD_ID')), 'Run npm run build first');
  const { chromium } = createRequire(import.meta.url)('playwright');
  const output = process.env.LIVELIFT_BROWSER_EVIDENCE || fs.mkdtempSync(path.join(os.tmpdir(), 'livelift-v7-ui-'));
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const report = { result: 'FAIL', node: process.version, checks: [], output, provenance: 'All LiveLift routes are actual production routes; REAL transport certification uses an explicitly isolated upstream double.', visualRegression: 'INCONCLUSIVE: no committed screenshot baseline' };
  let browser, runtime;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
    for (const [width, height] of WIDTHS) {
      runtime = await startRuntime('fixture', output, { intelligenceFixture: true });
      try { await journey(browser, runtime, width, height, report, output); await integratedFixture(browser, runtime, width, height, report, output); }
      finally { await runtime.stop(); runtime = null; }
      runtime = await startRuntime('fixture', output, { intelligenceTransport: true });
      try { await integratedReal(browser, runtime, width, height, report, output); }
      finally { await runtime.stop(); runtime = null; }
    }
    report.result = report.checks.length > 0 && report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
  } finally {
    await runtime?.stop(); await browser?.close();
    fs.writeFileSync(path.join(output, 'v7-results.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  }
  console.log(`V7 LIVE INTELLIGENCE BROWSER ACCEPTANCE: ${report.result} (${report.checks.filter(c => c.status === 'PASS').length}/${report.checks.length})\nEvidence: ${output}`);
  if (report.result !== 'PASS') process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
