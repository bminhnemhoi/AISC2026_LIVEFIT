// Runnable integration check; uses the audit environment's Playwright, no app dependency added.
// NODE_PATH=<Playwright parent> node scripts/competition/launcher.check.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = mkdtempSync(path.join(os.tmpdir(), 'livelift-launcher-check-'));
const port = 3130, origin = `http://localhost:${port}`;
const sentinel = path.join(temporary, 'authority.sqlite');
writeFileSync(sentinel, 'REAL authority safety sentinel; never open or modify');
const environment = { ...process.env, LIVELIFT_DB_PATH: sentinel, LIVELIFT_WORKSPACE_ID: '11111111-1111-4111-8111-111111111111', LIVELIFT_ROOM_ID: 'real-sentinel', LIVELIFT_APP_ORIGIN: 'https://real.invalid', LIVELIFT_CAPABILITIES: 'secret-must-not-print' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function launch(name, args = [], env = environment) {
  const child = spawn(path.join(root, name + '-livelift-demo'), args, { cwd: temporary, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const finished = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve({ code, output })); });
  return { child, finished, output: () => output };
}
async function run(name, args = [], env) {
  const process = launch(name, args, env);
  let timer;
  try {
    return await Promise.race([process.finished, new Promise((_, reject) => {
      timer = setTimeout(() => { process.child.kill('SIGTERM'); reject(new Error(name + ' timed out')); }, 150000);
    })]);
  } finally { clearTimeout(timer); }
}
async function waitFor(condition, label) {
  const deadline = Date.now() + 150000;
  while (!condition()) { assert(Date.now() < deadline, label); await sleep(200); }
}
function safe(result) {
  assert(!result.output.includes('secret-must-not-print'));
  assert.equal(readFileSync(sentinel, 'utf8'), 'REAL authority safety sentinel; never open or modify');
}
let launcher, browser, unrelated;
try {
  // An unrelated listener is deliberately started first; no test ever kills an unknown PID.
  unrelated = http.createServer((_req, res) => { res.end('unrelated listener'); });
  await new Promise((resolve, reject) => { unrelated.once('error', reject); unrelated.listen(port, '127.0.0.1', resolve); });
  const conflict = await run('start', ['--no-open']);
  assert.equal(conflict.code, 1); assert.match(conflict.output, /occupied by an unmanaged process/);
  assert.equal(await (await fetch(origin)).text(), 'unrelated listener'); safe(conflict);
  await new Promise(resolve => unrelated.close(resolve)); unrelated = null;
  console.log('PASS occupied port: unrelated listener retained');

  launcher = launch('start', ['--no-open']);
  await waitFor(() => /Rehearsal startup\s+PASS/.test(launcher.output()), 'fresh startup');
  assert.equal(launcher.child.exitCode, null); safe({ output: launcher.output() });
  const second = await run('start', ['--no-open']);
  assert.equal(second.code, 0); assert.match(second.output, /Already running\s+PASS/); safe(second);
  const health = await run('check');
  assert.equal(health.code, 0);
  assert.match(health.output, /health endpoint\s+PASS/);
  assert.match(health.output, /ready endpoint\s+FAIL.*expected 503/);
  assert.match(health.output, /browser URL\s+http:\/\/localhost:3130\//);
  safe(health);
  console.log('PASS fresh start, repeat start, health and honest readiness, canonical browser URL');

  // Exercise accepted auto-open and unsupported desktop fallback without opening the user's desktop.
  for (const tool of ['xdg-open', 'gio']) writeFileSync(path.join(temporary, tool), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  let env = { ...environment, PATH: temporary + path.delimiter + environment.PATH };
  const fallback = await run('start', [], env);
  assert.equal(fallback.code, 0); assert.match(fallback.output, /Browser\s+unavailable; open/);
  writeFileSync(path.join(temporary, 'xdg-open'), '#!/bin/sh\nprintf "%s" "$1" > "' + path.join(temporary, 'browser-url') + '"\n', { mode: 0o700 });
  const opened = await run('start', [], env);
  assert.equal(opened.code, 0); assert.match(opened.output, /open request accepted/);
  assert.equal(readFileSync(path.join(temporary, 'browser-url'), 'utf8'), origin + '/');
  const reset = await run('reset', ['--no-open']);
  assert.equal(reset.code, 0); assert.match(reset.output, /Reset pending browser confirmation/); safe(reset);
  console.log('PASS browser-open dispatch/fallback and explicit reset instructions');

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const writes = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method()) && request.url().includes('/api/')) writes.push(request.url()); });
  await context.addCookies([{ name: 'real-safety-sentinel', value: 'retained', url: origin }]);
  await page.goto(origin);
  await page.getByTestId('loop-guide').waitFor();
  await page.evaluate(() => localStorage.setItem('livelift.v3.REAL', JSON.stringify({ v: 1, sessions: [], safetyMarker: 'retain exact bytes' })));
  const realBefore = await page.evaluate(() => localStorage.getItem('livelift.v3.REAL'));
  await page.goto(origin + '/live/new');
  assert.equal(await page.getByTestId('simulated-toggle').isChecked(), false, 'product default remains REAL');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  for (const suffix of ['csv', 'tsv']) {
    await page.goto(origin + '/live/new?env=sim');
    await page.getByLabel('Session title', { exact: false }).fill('Launcher import check ' + suffix);
    await page.getByTestId('submit-create-live-btn').click();
    await page.getByTestId('import-btn').click();
    await page.getByTestId('import-text').fill(readFileSync(path.join(root, 'docs/competition/v3-demo/sample-products.' + suffix), 'utf8'));
    assert.match(await page.getByTestId('import-preview').innerText(), /D04.*Not entered/);
    await page.getByRole('button', { name: /Import 4 products/ }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByTestId('prepare-product-list').locator('li').count(), 4);
    await page.getByTestId('prepare-product-list').getByRole('button').filter({ hasText: 'D04' }).click();
    assert.equal(await page.getByLabel('Price (optional)', { exact: true }).inputValue(), '');
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  }
  await page.goto(origin + '/simulator');
  await page.getByTestId('open-buffered').click();
  await page.getByTestId('start-live-cta-btn').click();
  await page.getByTestId('sim-apply-step').click();
  await page.reload();
  await page.getByTestId('sim-apply-step').waitFor();
  const simBeforeReset = await page.evaluate(() => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions);
  assert.equal(simBeforeReset.find(s => s.id === 'sim-buffered').lifecycle, 'active');
  await page.goto(origin + '/simulator');
  await page.getByTestId('reset-buffered').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset this run', exact: true }).click();
  const oneReset = await page.evaluate(() => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions);
  assert.equal(oneReset.find(s => s.id === 'sim-buffered').lifecycle, 'planned');
  assert.deepEqual(oneReset.filter(s => s.id !== 'sim-buffered'), simBeforeReset.filter(s => s.id !== 'sim-buffered'));
  await page.getByTestId('purge-rehearsals-btn').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete all rehearsals', exact: true }).click();
  const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem('livelift.v3.SIMULATED')).sessions);
  assert.equal(fresh.length, 4);
  assert.equal(fresh.find(s => s.id === 'sim-buffered').lifecycle, 'planned');
  assert.equal(fresh.find(s => s.id === 'sim-buffered-done').lifecycle, 'ended');
  assert.equal(await page.evaluate(() => localStorage.getItem('livelift.v3.REAL')), realBefore);
  assert((await context.cookies()).some(c => c.name === 'real-safety-sentinel' && c.value === 'retained'));
  assert.deepEqual(writes, [], 'rehearsal commands and resets must not write to server authority');
  safe(reset);
  await page.getByTestId('open-buffered').click();
  await page.getByTestId('start-live-cta-btn').waitFor();
  console.log('PASS Home/Create/Cancel, CSV+TSV imports, missing price, refresh, single reset, full reset, fresh demo start, REAL storage/cookie retention, zero authority writes');
  await browser.close(); browser = null;

  // Reuse the certified walkthrough check for Operate → Review → Next LIVE → Capability Center.
  const walkthrough = spawn(process.execPath, [path.join(root, 'next/acceptance/competition-browser.mjs')], {
    cwd: root, env: { ...environment, LIVELIFT_BROWSER_URL: origin, LIVELIFT_BROWSER_AUTH_FILE: '' }, stdio: ['ignore', 'inherit', 'inherit'],
  });
  assert.equal(await new Promise((resolve, reject) => { walkthrough.once('error', reject); walkthrough.once('exit', resolve); }), 0);
  console.log('PASS full existing competition browser walkthrough (desktop, tablet, mobile)');

  const stopped = await run('stop'); assert.equal(stopped.code, 0);
  const firstExit = await launcher.finished; assert.equal(firstExit.code, 0); launcher = null;
  assert(!existsSync(path.join(root, 'next/.competition-demo/3130.sock')));
  const offline = await run('check'); assert.equal(offline.code, 1);
  launcher = launch('start', ['--no-open']);
  await waitFor(() => /Rehearsal startup\s+PASS/.test(launcher.output()), 'restart');
  launcher.child.kill('SIGINT');
  assert.equal((await launcher.finished).code, 0); launcher = null;
  assert(!existsSync(path.join(root, 'next/.competition-demo/3130.sock')));
  const invalidReal = await run('start', ['--real', '--url', 'http://unsafe.invalid']);
  assert.equal(invalidReal.code, 1); assert.match(invalidReal.output, /requires the configured HTTPS origin/); safe(invalidReal);
  console.log('PASS stop, offline failure, restart, Ctrl+C, invalid REAL config rejected');
  console.log('COMPETITION LAUNCHER CHECK: PASS');
} finally {
  await browser?.close();
  if (launcher) { launcher.child.kill('SIGTERM'); await launcher.finished; }
  if (unrelated) await new Promise(resolve => unrelated.close(resolve));
  rmSync(temporary, { recursive: true, force: true }); // Only this check's freshly created temporary directory.
}
