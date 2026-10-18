#!/usr/bin/env node
// Production UI only; reuse the disposable authenticated runtime without provider credentials.
/* global document, window, localStorage, getComputedStyle, Element, PerformanceObserver, structuredClone */
import assert from 'node:assert/strict';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { app, startRuntime } from './final-runtime.mjs';

const viewports = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 390, height: 844 }];
const surfaces = ['director', 'assumptions', 'lab-desk', 'lab-wire', 'host-app'];
const forbidden = /synced with Shopee|connected to Shopee|confirmed by Shopee|real-time from Shopee/i;

export function assertStableBoxes(before, after) {
  assert.deepEqual(Object.keys(after), Object.keys(before), 'Phone regions disappeared');
  for (const name of Object.keys(before)) for (const dimension of ['x', 'y', 'width', 'height']) {
    assert(Math.abs(after[name][dimension] - before[name][dimension]) <= 1,
      `${name}.${dimension}: ${before[name][dimension]} -> ${after[name][dimension]}`);
  }
}

export function assertInsideFrame(frame, trigger) {
  assert(trigger.width > 0 && trigger.height > 0 && trigger.x >= frame.x && trigger.y >= frame.y &&
    trigger.x + trigger.width <= frame.x + frame.width && trigger.y + trigger.height <= frame.y + frame.height,
  'Bag trigger lies outside the phone frame');
}

export function assertSimulatedSurfaces(texts) {
  const missing = Object.entries(texts).filter(([, text]) => !/\bSIMULATED\b/.test(text)).map(([name]) => name);
  assert.deepEqual(missing, [], 'Surfaces missing their own SIMULATED label');
}

function selfTest() {
  const box = { phone: { x: 0, y: 0, width: 200, height: 400 } };
  assertStableBoxes(box, structuredClone(box));
  assert.throws(() => assertStableBoxes(box, { phone: { ...box.phone, y: 2 } }));
  assert.throws(() => assertStableBoxes(box, {}));
  for (const dimension of ['x', 'y', 'width', 'height']) {
    assertStableBoxes(box, { phone: { ...box.phone, [dimension]: box.phone[dimension] + 1 } });
    assert.throws(() => assertStableBoxes(box, { phone: { ...box.phone, [dimension]: box.phone[dimension] + 2 } }));
  }
  assertInsideFrame(box.phone, { x: 10, y: 10, width: 44, height: 44 });
  for (const trigger of [{ x: -1, y: 10, width: 44, height: 44 }, { x: 10, y: -1, width: 44, height: 44 },
    { x: 190, y: 10, width: 44, height: 44 }, { x: 10, y: 390, width: 44, height: 44 },
    { x: 10, y: 10, width: 0, height: 44 }]) assert.throws(() => assertInsideFrame(box.phone, trigger));
  assertSimulatedSurfaces({ desk: 'SIMULATED clock', phone: 'SIMULATED' });
  assert.throws(() => assertSimulatedSurfaces({ phone: 'Shopee' }));
  assert(forbidden.test('connected to Shopee'));
  assert(!forbidden.test('SIMULATED Live'));
  console.log('LAB HARNESS SELF-CHECK: PASS');
}

async function journey(browser, runtime, viewport, run, axePath, report, output) {
  const label = `${viewport.width}x${viewport.height}-run${run}`;
  const reduced = run === 2;
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport,
    reducedMotion: reduced ? 'reduce' : 'no-preference', locale: reduced ? 'vi-VN' : 'en-US',
    timezoneId: reduced ? 'Asia/Ho_Chi_Minh' : 'UTC' });
  await context.addInitScript(() => {
    window.__labScrollCalls = [];
    window.__labLayoutShifts = [];
    const original = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (...args) {
      if (this.getAttribute('data-testid') === 'wire-scroll') window.__labScrollCalls.push(args[0]?.behavior ?? 'unspecified');
      return original.apply(this, args);
    };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__labLayoutShifts.push({ value: entry.value, recentInput: entry.hadRecentInput });
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [], consoleErrors = [], httpErrors = [];
  let authenticated = false;
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => {
    const route = new URL(response.url()).pathname;
    if (response.status() >= 400 && !(route === '/api/v3/auth/session' && response.status() === 401 && !authenticated)) {
      httpErrors.push({ route, status: response.status() });
    }
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') httpErrors.push({ route: new URL(request.url()).pathname, error: request.failure()?.errorText });
  });
  const id = name => page.getByTestId(name);
  const check = async (name, action) => {
    try {
      const detail = await action();
      report.checks.push({ viewport, run, name, status: 'PASS', ...(detail === undefined ? {} : { detail }) });
      console.log(`PASS ${label} ${name}`);
      return detail;
    } catch (error) {
      report.checks.push({ viewport, run, name, status: 'FAIL', error: error.message });
      console.error(`FAIL ${label} ${name}: ${error.message}`);
    }
  };
  const tabTo = async control => {
    for (let n = 0; n < 100; n++) {
      if (await control.evaluate(element => document.activeElement === element)) return;
      await page.keyboard.press('Tab');
    }
    assert.fail('Control unreachable by Tab');
  };
  const progress = n => page.waitForFunction(n => {
    const numbers = document.querySelector('[data-testid="director-progress"]')?.textContent?.match(/\d+/g);
    return Number(numbers?.[0]) === n && Number(numbers?.[1]) === 12;
  }, n);
  const boxes = () => page.evaluate(() => {
    const regions = ['lab-phone-zone', 'host-app'].map(name => {
      const element = document.querySelector(`[data-testid="${name}"]`);
      if (!element) throw new Error(`Missing region ${name}`);
      return [name, element];
    });
    // The viewer row exists only on air; its pill can grow as the count changes.
    const viewerRow = document.querySelector('[data-testid="viewer-pill"]')?.closest('[data-testid="host-app-viewers"]')?.parentElement;
    if (viewerRow) regions.push(['viewer-row', viewerRow]);
    const bagTrigger = document.querySelector('[data-testid="host-app-bag-button"]');
    if (document.querySelector('[data-testid="host-app"]')?.getAttribute('data-mode') === 'live' && !bagTrigger) {
      throw new Error('Missing live bag trigger');
    }
    if (bagTrigger) regions.push(['bag-trigger', bagTrigger]);
    return Object.fromEntries(regions.map(([name, element]) => {
      const rect = element.getBoundingClientRect();
      return [name, { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height }];
    }));
  });
  const axe = async state => {
    const result = await page.evaluate(() => window.axe.run(document));
    const violations = result.violations.map(({ id, impact, description, helpUrl, nodes }) => ({ id, impact, description, helpUrl,
      nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })) }));
    report.axe.push({ viewport, run, state, violations, incomplete: result.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })) });
    assert.equal(violations.length, 0, `${violations.length} axe violations: ${violations.map(v => v.id).join(', ')}`);
    return { violations: 0 };
  };
  const audit = async state => {
    await check(`${state}-axe`, () => axe(state));
    await check(`${state}-simulation-labels`, async () => {
      const texts = Object.fromEntries(await Promise.all(surfaces.map(async name => [name, await id(name).innerText()])));
      report.surfaces.push({ viewport, run, state, texts });
      assertSimulatedSurfaces(texts);
    });
    await check(`${state}-honesty-overflow`, async () => {
      const text = await page.locator('body').innerText();
      runtime.assertNoSecrets(text);
      assert(!forbidden.test(text), 'Forbidden platform phrase in rendered text');
      const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert(size.scroll <= size.client + 1, `Horizontal page overflow ${size.scroll} > ${size.client}`);
      return size;
    });
  };
  let fingerprint;
  try {
    await page.goto(runtime.origin + '/');
    await id('loop-guide').waitFor();
    await page.goto(runtime.origin + '/login');
    await page.getByLabel('Username').fill(runtime.credentials.username);
    await page.getByLabel('Password', { exact: true }).fill(runtime.credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(url => url.pathname !== '/login');
    authenticated = true;
    await page.goto(runtime.origin + '/live/sim-buffered/lab');
    await id('platform-lab').waitFor();
    await check('keyboard-language-presenter-storage', async () => {
      await tabTo(id('lab-lang-vi'));
      await page.keyboard.press('Enter');
      assert.equal(await id('platform-lab').getAttribute('lang'), 'vi');
      assert(await id('lab-lang-vi').evaluate(element => document.activeElement === element));
      await tabTo(id('lab-presenter'));
      await page.keyboard.press('Space');
      assert.equal(await id('platform-lab').getAttribute('data-presenter'), 'on');
      await page.keyboard.press('p');
      assert.equal(await id('platform-lab').getAttribute('data-presenter'), 'off');
      await id(reduced ? 'lab-lang-vi' : 'lab-lang-en').click();
      if (reduced) await id('lab-presenter').click();
      await page.reload();
      await id('platform-lab').waitFor();
      await page.waitForFunction(({ lang, presenter }) => {
        const el = document.querySelector('[data-testid="platform-lab"]');
        return el?.getAttribute('lang') === lang && el?.getAttribute('data-presenter') === presenter;
      }, { lang: reduced ? 'vi' : 'en', presenter: reduced ? 'on' : 'off' });
      return { lang: reduced ? 'vi' : 'en', presenter: reduced, restoredAfterReload: true };
    });
    const storedBefore = await page.evaluate(() => localStorage.getItem('livelift.v3.SIMULATED'));
    await page.addScriptTag({ path: axePath });
    await audit('state0');
    let previousBoxes, viewerRowBox;
    await page.evaluate(() => { window.__labScrollCalls = []; window.__labLayoutShifts = []; });
    await check('keyboard-play-pause-focus', async () => {
      await tabTo(id('director-play'));
      await page.keyboard.press('Enter');
      await id('director-pause').waitFor();
      assert(await id('director-pause').evaluate(element => document.activeElement === element), 'Play lost focus instead of retaining it on Pause');
    });
    // The shipped 2× control still plays every timed step; no clock or reducer injection.
    await id('director').getByRole('button', { name: '2×', exact: true }).click();
    for (let state = 1; state <= 12; state++) {
      await progress(state);
      // Keep axe's asynchronous DOM/style snapshot within one state, then continue timed playback.
      if (state < 12) await id('director-pause').click();
      await audit(`state${state}`);
      await check(`state${state}-phone-layout`, async () => {
        const measured = await boxes();
        const { ['viewer-row']: viewerRow, ['bag-trigger']: bagTrigger, ...current } = measured;
        report.layout.push({ viewport, run, state, boxes: measured });
        previousBoxes ??= current;
        assertStableBoxes(previousBoxes, current);
        if (viewerRow) {
          viewerRowBox ??= viewerRow;
          assertStableBoxes({ 'viewer-row': viewerRowBox }, { 'viewer-row': viewerRow });
        }
        if (bagTrigger) assertInsideFrame(current['host-app'], bagTrigger);
      });
      if ([6, 7, 12].includes(state)) await page.screenshot({ path: path.join(output, `${label}-state${state}.png`) });
      if (state < 12) await id('director-play').click();
    }
    await id('director-play').waitFor();
    await check('director-completed-fingerprint', async () => {
      fingerprint = await id('wire-digest').getAttribute('data-digest');
      assert.match(fingerprint, /^[a-f0-9]{8}$/);
      assert.equal(await id('host-app').getAttribute('data-mode'), 'ended');
      assert.equal(await id('director-step').isDisabled(), true);
      return { fingerprint, display: await id('wire-digest').innerText() };
    });
    await check('reduced-motion', async () => {
      const motion = await page.evaluate(() => ({ reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        scrollCalls: window.__labScrollCalls,
        moving: [...document.querySelectorAll('[data-testid="platform-lab"] *')].filter(element => {
          const css = getComputedStyle(element);
          return [...css.animationDuration.split(','), ...css.transitionDuration.split(',')].some(duration => parseFloat(duration) > 0.00001);
        }).map(element => element.getAttribute('data-testid') ?? element.tagName),
        layoutShifts: window.__labLayoutShifts }));
      assert.equal(motion.reduce, reduced);
      if (reduced) {
        assert(motion.scrollCalls.length > 0, 'Reduced motion did not exercise wire scrolling');
        assert(motion.scrollCalls.every(behavior => behavior === 'auto'), 'Wire used smooth scrolling with reduced motion');
        assert.deepEqual(motion.moving, [], 'CSS motion remained active with reduced motion');
      }
      return motion;
    });
    await check('expanded-call-axe', async () => {
      await id('wire-call').filter({ has: page.locator('[aria-expanded="false"]') }).first().getByRole('button').click();
      await id('wire-json').waitFor();
      assert.match(await id('wire-json').innerText(), /request_id/);
      return axe('expanded-call');
    });
    await check('source-show-unchanged', async () => assert.equal(await page.evaluate(() => localStorage.getItem('livelift.v3.SIMULATED')), storedBefore));
    await check('phone-pin-keyboard-focus', async () => {
      await id('director-reset').click();
      await id('director-step').click();
      await id('director-step').click();
      await progress(2);
      await tabTo(id('host-app-bag-button'));
      await page.keyboard.press('Enter');
      const pin = page.locator('[data-testid^="host-app-pin-"]').first();
      await tabTo(pin);
      await page.keyboard.press('Enter');
      const active = await page.evaluate(() => ({ inPhone: !!document.activeElement?.closest('[data-testid="host-app"]'),
        disabled: document.activeElement?.matches(':disabled'), control: document.activeElement?.matches('button, input, select, textarea, a[href], [role="button"]'),
        target: document.activeElement?.getAttribute('data-testid'), tag: document.activeElement?.tagName }));
      report.focus.push({ viewport, run, active });
      assert(active.inPhone && active.control && !active.disabled, `Phone update lost usable focus: ${JSON.stringify(active)}`);
      return active;
    });
  } catch (error) {
    report.aborted.push({ viewport, run, error: error.message });
    console.error(`ABORT ${label}: ${error.message}`);
  } finally {
    await check('runtime-errors', () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(httpErrors, []);
      assert.deepEqual(consoleErrors.filter(text => !/^Failed to load resource: the server responded with a status of \d+/.test(text)), []);
    });
    report.browser.push({ viewport, run, errors, consoleErrors, httpErrors });
    await context.close();
  }
  return fingerprint;
}

export async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node acceptance/lab-browser.mjs [--self-test]\nRun npm run build first. Uses external Playwright and axe-core (NODE_PATH); optional AXE_PATH, CHROMIUM_PATH.\nEvidence: docs/orchestration/reviews/02-lab-browser/. All temporary writes stay inside this worktree.\nTwo timed Director plays at each viewport: EN/UTC, then VI/Asia/Ho_Chi_Minh with presenter and reduced motion.');
    return;
  }
  assert(args.every(arg => arg === '--self-test'), 'Unknown argument; use --help');
  selfTest();
  if (args.includes('--self-test')) return;
  assert(fs.existsSync(path.join(app, '.next/BUILD_ID')), 'Run npm run build first');
  const dependency = createRequire(import.meta.url);
  const { chromium } = dependency('playwright');
  const axePath = process.env.AXE_PATH || dependency.resolve('axe-core/axe.min.js');
  const output = path.resolve(app, '../docs/orchestration/reviews/02-lab-browser');
  const temporary = path.join(output, '.private');
  fs.mkdirSync(temporary, { recursive: true, mode: 0o700 });
  const previousTmpdir = process.env.TMPDIR;
  process.env.TMPDIR = temporary;
  const report = { result: 'FAIL', sha: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).stdout.trim(),
    buildId: fs.readFileSync(path.join(app, '.next/BUILD_ID'), 'utf8').trim(), node: process.version,
    tools: { playwright: dependency('playwright/package.json').version, axe: fs.readFileSync(axePath, 'utf8').match(/axe v([\d.]+)/)?.[1], chromium: null },
    startedAt: new Date().toISOString(), checks: [], axe: [], layout: [], surfaces: [], focus: [], browser: [], aborted: [], blockers: [],
    visualRegression: 'INCONCLUSIVE: no screenshot baseline; geometry and screenshots checked', output };
  let browser, runtime;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
    report.tools.chromium = browser.version();
    runtime = await startRuntime('not-configured', temporary);
    for (const viewport of viewports) {
      const first = await journey(browser, runtime, viewport, 1, axePath, report, output);
      const second = await journey(browser, runtime, viewport, 2, axePath, report, output);
      const equal = typeof first === 'string' && first === second;
      report.checks.push({ viewport, name: 'two-run-fingerprint', status: equal ? 'PASS' : 'FAIL', detail: { first, second } });
      console.log(`${equal ? 'PASS' : 'FAIL'} ${viewport.width}x${viewport.height} two-run-fingerprint: ${first} / ${second}`);
    }
    runtime.verifyPrivateArtifacts();
    report.result = report.checks.length > 0 && !report.checks.some(check => check.status === 'FAIL') && !report.aborted.length ? 'PASS' : 'FAIL';
  } catch (error) {
    report.blockers.push(error.message);
    console.error(`BLOCKER: ${error.message}`);
  } finally {
    await runtime?.stop();
    await browser?.close();
    if (previousTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTmpdir;
    fs.rmSync(temporary, { recursive: true, force: true });
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
  const passed = report.checks.filter(check => check.status === 'PASS').length;
  console.log(`LAB BROWSER HARNESS: ${report.result}; ${passed} passed, ${report.checks.length - passed} failed; ${report.axe.length} axe states; ${report.aborted.length} aborted\nEvidence: ${output}`);
  if (report.result !== 'PASS') process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
