// Tooling only: the certified app owns all product behavior and browser state.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, openSync, closeSync, chmodSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as util from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'next');
const expectedNode = JSON.parse(readFileSync(path.join(app, 'package.json'), 'utf8')).engines.node;
const state = path.join(app, '.competition-demo');
const [command, ...args] = process.argv.slice(2);
let real = false, autoOpen = true, port = 3130, suppliedUrl;
let cleanup = () => {};
const fail = message => { throw new Error(message); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const envFiles = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local'];
function fileEnv(directory, names) {
  return Object.assign({}, ...names.filter(name => existsSync(path.join(directory, name)))
    .map(name => util.parseEnv(readFileSync(path.join(directory, name), 'utf8'))));
}
async function request(url, json = false) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    return { status: response.status, body: json ? await response.json() : await response.text() };
  } catch { return { status: 0, body: null }; }
}
async function diagnostics(origin) {
  const [home, simulator, health, ready] = await Promise.all([
    request(origin + '/'), request(origin + '/simulator'), request(origin + '/api/healthz', true), request(origin + '/api/readyz', true),
  ]);
  const appOk = home.status === 200 && typeof home.body === 'string' && (home.body.includes('Your LIVE desk') || home.body.includes('data-testid="home-flow"')) && home.body.includes('data-testid="truth-panel"');
  const simOk = simulator.status === 200 && typeof simulator.body === 'string' && simulator.body.includes('All signals and evidence are simulated');
  const healthOk = health.status === 200 && health.body?.live === true;
  const readyOk = ready.status === 200 && ready.body?.ready === true;
  const expected = !real && ready.status === 503 && ready.body?.error?.code === 'authority_unavailable';
  let assetsOk = false;
  try {
    const read = suffix => readFileSync(path.join(root, 'docs/competition/v3-demo/sample-products.' + suffix), 'utf8');
    const rows = text => text.trim().split(/\r?\n/).map(row => row.split(/[,\t]/).map(cell => cell.trim()));
    const csv = rows(read('csv')), tsv = rows(read('tsv'));
    assetsOk = JSON.stringify(csv) === JSON.stringify(tsv) && csv.length === 4 && csv[3][0] === 'D04' && csv[3][2] === '—';
  } catch { /* Missing assets are reported below. */ }
  return { appOk, simOk, healthOk, readyOk, expected, assetsOk, ok: appOk && healthOk && assetsOk && (real ? readyOk : simOk && expected) };
}
async function waitReady(origin, alive = () => true) {
  const deadline = Date.now() + 120000;
  let result;
  do {
    result = await diagnostics(origin);
    if (result.ok || !alive()) return result;
    await pause(1000);
  } while (Date.now() < deadline);
  return result;
}
function report(result, origin) {
  const line = (name, ok, detail = '') => console.log(`${name.padEnd(20)} ${ok ? 'PASS' : 'FAIL'}${detail ? ' — ' + detail : ''}`);
  console.log(`Mode                 ${real ? 'configured REAL' : 'SIMULATED competition rehearsal'}`);
  line('LiveLift app', result.appOk);
  line('health endpoint', result.healthOk);
  line('ready endpoint', result.readyOk, result.expected ? 'expected 503: REAL authority is not configured; rehearsals work' : '');
  if (!real) line('Simulator path', result.simOk);
  line('demo assets', result.assetsOk);
  console.log(`browser URL          ${origin}/`);
  console.log(`Node version         ${process.version} (expected ${expectedNode}; certification: 22.23.3)`);
  const sha = spawnSync('git', ['-C', root, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' });
  const tag = spawnSync('git', ['-C', root, 'describe', '--tags', '--always'], { encoding: 'utf8' });
  console.log(`git SHA/tag          ${sha.stdout?.trim() || 'unavailable'} / ${tag.stdout?.trim() || 'unavailable'}`);
  line(real ? 'REAL startup' : 'Rehearsal startup', result.ok);
}
async function openBrowser(url) {
  if (!autoOpen) { console.log(`Browser              not opened (--no-open); open ${url}`); return; }
  const candidates = process.platform === 'darwin' ? [['open', [url]]] : [['xdg-open', [url]], ['gio', ['open', url]]];
  for (const [tool, parameters] of candidates) {
    const code = await new Promise(resolve => {
      const child = spawn(tool, parameters, { stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill('SIGTERM'); resolve(1); }, 5000);
      child.once('error', () => { clearTimeout(timer); resolve(1); });
      child.once('exit', code => { clearTimeout(timer); resolve(code); });
    });
    if (code === 0) { console.log('Browser              PASS — open request accepted'); return; }
  }
  console.log(`Browser              unavailable; open ${url}`);
}
function control(socket, action = 'status') {
  return new Promise(resolve => {
    const client = net.createConnection(socket);
    let data = '';
    client.setTimeout(1500, () => client.destroy());
    client.once('connect', () => client.end(action));
    client.on('data', chunk => { data += chunk; });
    client.once('error', () => resolve(null));
    client.once('close', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
  });
}
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', () => reject(new Error(`Port ${port} is occupied by an unmanaged process. Nothing was stopped. Use ./check-livelift-demo; inspect with lsof -nP -iTCP:${port} -sTCP:LISTEN or ss -ltnp.`)));
    // Check wildcard too: do not coexist with another process on a different loopback address.
    probe.listen({ port, host: '::', ipv6Only: false }, resolve);
  });
  await new Promise(resolve => probe.close(resolve));
}
function prerequisites() {
  if (spawnSync('npm', ['--version'], { stdio: 'ignore' }).status !== 0) fail('npm missing. Install Node 22.23.3 with npm.');
  if (!real) {
    const lock = JSON.parse(readFileSync(path.join(app, 'package-lock.json')));
    for (const name of Object.keys({ ...lock.packages[''].dependencies, ...lock.packages[''].devDependencies })) {
      const installed = path.join(app, 'node_modules', name, 'package.json');
      if (!existsSync(installed) || JSON.parse(readFileSync(installed)).version !== lock.packages['node_modules/' + name].version) {
        fail('Dependencies missing or differ from lockfile. Run: cd next && npm ci');
      }
    }
  }
}
async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!((major === 22 && minor >= 16) || major >= 24)) fail('Unsupported Node. Install Node 22.23.3; expected ' + expectedNode);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--real') real = true;
    else if (args[i] === '--no-open') autoOpen = false;
    else if (args[i] === '--port') { port = Number(args[++i]); if (!Number.isInteger(port) || port < 1024 || port > 65535) fail('Port must be between 1024 and 65535.'); }
    else if (args[i] === '--url') suppliedUrl = args[++i] || fail('--url needs an HTTPS origin.');
    else if (args[i] === '--help') {
      console.log('Usage: ./' + command + '-livelift-demo [--no-open] [--port 3130] [--real [--url https://your-host]]\nDefault: isolated browser-local SIMULATED rehearsals; no Docker or account needed.\nStart stays in this terminal; Ctrl+C or ./stop-livelift-demo stops only its child.\nREAL uses existing docker-compose.v3.yml configuration/images. Reset always requires confirmation in Simulator.');
      return;
    } else fail('Unknown option. Use --help.');
  }
  if (!['start', 'check', 'reset', 'stop'].includes(command)) fail('Unknown command.');
  if (suppliedUrl && !real) fail('--url requires --real; default rehearsal is localhost only.');
  const configured = { ...fileEnv(root, ['.env']), ...process.env };
  let origin = `http://localhost:${port}`;
  if (real) {
    const value = suppliedUrl || configured.LIVELIFT_APP_ORIGIN;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) fail('Invalid origin');
      origin = url.origin;
    } catch { fail('REAL requires the configured HTTPS origin: --real --url https://your-host (no credentials, path or query).'); }
  }
  const socket = path.join(state, `${port}.sock`);
  if (command === 'stop') {
    if (real) fail('Stop helper only stops the SIMULATED launcher. REAL deployment stays running.');
    const running = await control(socket, 'stop');
    if (!running || running.root !== root) fail('No managed rehearsal launcher is running. Nothing was stopped.');
    console.log('PASS Stop requested for this launcher only; browser state and REAL data retained.');
    return;
  }
  if (command === 'check' || command === 'reset') {
    const result = await diagnostics(origin);
    report(result, origin);
    if (!result.ok) { process.exitCode = 1; return; }
    if (command === 'reset') {
      console.log('Reset pending browser confirmation. In the SAME browser/profile used for the presentation:\nSimulator → Fall collection rehearsal → Reset this run → Reset this run.\nFor a completely fresh shipped demo: Delete all rehearsals… → Delete all rehearsals.\nOnly browser-local SIMULATED shows are affected. REAL shows, cookies and accounts are retained.');
      await openBrowser(origin + '/simulator');
    }
    return;
  }
  prerequisites();
  if (real) {
    let result = await diagnostics(origin);
    if (!result.ok) {
      if (origin !== configured.LIVELIFT_APP_ORIGIN) fail('REAL URL does not match local Docker deployment configuration. Use check --real for a remote deployment.');
      if (result.healthOk) { report(result, origin); fail('REAL authority is unhealthy. Follow the existing platform runbook; no restart or reset attempted.'); }
      if (spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' }).status !== 0) fail('Docker with Compose is required for the configured REAL deployment.');
      mkdirSync(state, { recursive: true, mode: 0o700 });
      const log = openSync(path.join(state, 'real-start.log'), 'a', 0o600);
      const docker = spawn('docker', ['compose', '-f', path.join(root, 'docker-compose.v3.yml'), 'up', '-d'], { cwd: root, stdio: ['ignore', log, log] });
      const code = await new Promise(resolve => { docker.once('error', () => resolve(1)); docker.once('exit', resolve); });
      closeSync(log);
      if (code !== 0) fail('Docker startup failed. Check Docker/configuration and the private next/.competition-demo/real-start.log. Existing data was retained.');
      result = await waitReady(origin);
    }
    report(result, origin);
    if (!result.ok) fail('REAL health/readiness failed. No data reset was attempted.');
    await openBrowser(origin + '/');
    return;
  }
  const running = await control(socket);
  if (running?.root === root) {
    console.log('Already running      PASS — reusing this launcher; no duplicate server');
    const result = await waitReady(origin);
    report(result, origin);
    if (!result.ok) fail('Existing rehearsal is not ready. Use ./stop-livelift-demo then ./start-livelift-demo.');
    await openBrowser(origin + '/');
    return;
  }
  await freePort();
  mkdirSync(state, { recursive: true, mode: 0o700 });
  // Never unlink here: another start may have acquired the socket after our probe.
  if (existsSync(socket)) fail(`Launcher socket already exists. Retry after startup; if stale, see EMERGENCY-DEMO.md. Nothing was stopped.`);
  let child, stopping = false;
  const server = net.createServer(connection => {
    let action = '';
    connection.setTimeout(1500, () => connection.destroy());
    connection.on('data', chunk => { action += chunk; if (action.length > 16) connection.destroy(); });
    connection.on('error', () => {});
    connection.on('end', () => {
      connection.end(JSON.stringify({ root, port }));
      if (action === 'stop') shutdown();
    });
  });
  function shutdown() {
    if (stopping) return;
    stopping = true;
    server.close();
    child?.kill('SIGTERM'); // Only the direct child created by this launcher.
  }
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
  cleanup = shutdown;
  chmodSync(socket, 0o600);
  const environment = { ...process.env, NODE_ENV: 'development' };
  const local = fileEnv(app, envFiles);
  for (const key of new Set([...Object.keys(environment), ...Object.keys(local), ...Object.keys(configured), 'LIVELIFT_WORKSPACE_ID', 'LIVELIFT_ROOM_ID', 'LIVELIFT_DB_PATH', 'LIVELIFT_CAPABILITIES', 'LIVELIFT_APP_ORIGIN', 'LIVELIFT_BACKUP_DIR'])) {
    if (key.startsWith('LIVELIFT_') || key.startsWith('NEXT_PUBLIC_')) environment[key] = '';
  }
  environment.NEXT_DIST_DIR = '.next';
  console.log('SIMULATED isolation  PASS — REAL authority configuration disabled for this child; no Docker');
  const log = openSync(path.join(state, 'app.log'), 'a', 0o600);
  child = spawn(process.execPath, [path.join(app, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: app, env: environment, stdio: ['ignore', log, log] });
  closeSync(log);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  child.once('error', () => { shutdown(); process.exitCode = 1; });
  child.once('exit', code => { if (!stopping) process.exitCode = code || 1; stopping = true; server.close(); });
  console.log('Starting             waiting for Home, health and Simulator (up to 120 seconds)');
  const result = await waitReady(origin, () => child.exitCode === null && !stopping);
  if (stopping) { if (process.exitCode) fail('Rehearsal server exited before readiness. Check private next/.competition-demo/app.log.'); return; }
  report(result || await diagnostics(origin), origin);
  if (!result?.ok) { shutdown(); fail('Startup failed. Check private next/.competition-demo/app.log; no data was reset.'); }
  await openBrowser(origin + '/');
  console.log('Keep this terminal open. Ctrl+C or ./stop-livelift-demo stops this rehearsal server.');
}
main().catch(error => { cleanup(); console.error('FAIL ' + error.message); process.exitCode = 1; });
