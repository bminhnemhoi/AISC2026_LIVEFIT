// Disposable production runtime. Reuses the shipped ops CLI and provider preloads.
/* global fetch, AbortSignal */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { parseEnv } from 'node:util';

export const app = path.resolve(import.meta.dirname, '..');
const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];

export function isolatedEnv(inherited, fileVariables = {}) {
  const env = { ...inherited, NODE_ENV: 'production', NODE_OPTIONS: '', NEXT_DIST_DIR: '.next' };
  for (const key of new Set([...Object.keys(env), ...Object.keys(fileVariables)])) {
    if (/^(LIVELIFT_|NEXT_PUBLIC_)/.test(key)) env[key] = '';
  }
  return env;
}

function command(args, env, log, input) {
  const result = spawnSync(process.execPath, args, { cwd: app, env, input, encoding: 'utf8', timeout: 60_000 });
  fs.appendFileSync(log, (result.stdout ?? '') + (result.stderr ?? ''));
  if (result.error || result.status !== 0) throw new Error(`Runtime setup failed (${path.basename(args[0])}); see ${log}`);
}

async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}

export async function startRuntime(mode, evidence, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'livelift-cert-runtime-'));
  const log = path.join(evidence, `${mode}-server.log`);
  fs.writeFileSync(log, '', { mode: 0o600 });
  let child, proxy;
  const stop = async () => {
    if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
    if (child && child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => {
        const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
        child.kill('SIGTERM');
      });
    }
    fs.rmSync(directory, { recursive: true, force: true });
  };
  try {
    const fileVariables = Object.assign({}, ...envFiles.filter(name => fs.existsSync(path.join(app, name)))
      .map(name => parseEnv(fs.readFileSync(path.join(app, name), 'utf8'))));
    const env = isolatedEnv(process.env, fileVariables);
    const key = path.join(directory, 'localhost.key'), cert = path.join(directory, 'localhost.pem');
    const tls = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert], { stdio: 'ignore', timeout: 30_000 });
    if (tls.error || tls.status !== 0) throw new Error('OpenSSL is required for the local HTTPS fixture.');
    const portProbe = net.createServer();
    const upstreamPort = await listen(portProbe);
    await new Promise(resolve => portProbe.close(resolve));
    proxy = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (request, response) => {
      const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, path: request.url, method: request.method,
        headers: { ...request.headers, 'x-forwarded-proto': 'https' } }, incoming => {
        response.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(response);
      });
      upstream.on('error', () => { response.writeHead(502); response.end('Fixture upstream unavailable'); });
      request.pipe(upstream);
    });
    const origin = `https://127.0.0.1:${await listen(proxy)}`;
    Object.assign(env, { LIVELIFT_WORKSPACE_ID: randomUUID(), LIVELIFT_ROOM_ID: 'final-cert', LIVELIFT_DB_PATH: path.join(directory, 'data', 'room.sqlite'),
      LIVELIFT_BACKUP_DIR: path.join(directory, 'backups'), LIVELIFT_APP_ORIGIN: origin });
    if (options.intelligenceFixture) Object.assign(env, { LIVELIFT_INTELLIGENCE_MODE: 'fixture',
      LIVELIFT_TIKTOK_SHOP_INTERVAL_POLICY: 'unverified', LIVELIFT_PROVIDER_EVIDENCE_DB_PATH: path.join(directory, 'data', 'provider-evidence.sqlite') });
    // Build the existing ops tooling in a private copy; never leave .ops or edit app source.
    const tooling = path.join(directory, 'tooling');
    for (const relative of ['src/contracts', 'src/fixtures', 'src/lib/domain', 'src/lib/server', 'src/lib/ai', 'src/app/api', 'scripts']) {
      fs.cpSync(path.join(app, relative), path.join(tooling, relative), { recursive: true });
    }
    fs.writeFileSync(path.join(tooling, 'package.json'), '{"type":"module"}');
    fs.symlinkSync(path.join(app, 'node_modules'), path.join(tooling, 'node_modules'), 'dir');
    command([path.join(tooling, 'scripts/build-ops.mjs')], env, log);
    const ops = path.join(tooling, '.ops/scripts/ops.js');
    command([ops, 'init', '--maintenance'], env, log);
    const credentials = { username: 'cert-operator', password: randomBytes(32).toString('hex') };
    command([ops, 'user', 'add', credentials.username, '--name', 'Certification operator', '--role', 'operator', '--password-stdin'], env, log, credentials.password + '\n');
    if (mode !== 'not-configured') {
      // The TikTok authorization page is intercepted in the browser; token/User Info use the shipped fixture.
      env.NODE_OPTIONS = `--import ${path.join(app, 'scripts/tiktok-fixture-preload.mjs')}`;
      Object.assign(env, { LIVELIFT_TIKTOK_CLIENT_KEY: randomBytes(16).toString('hex'), LIVELIFT_TIKTOK_CLIENT_SECRET: randomBytes(32).toString('hex'),
        LIVELIFT_PROVIDER_ENCRYPTION_KEY: randomBytes(32).toString('base64'), LIVELIFT_TIKTOK_REDIRECT_URI: origin + '/api/v3/integrations/tiktok/callback' });
      if (mode === 'fixture') {
        env.NODE_OPTIONS += ` --import ${path.join(app, 'scripts/ai-fixture-preload.mjs')}`;
        Object.assign(env, { LIVELIFT_AI_BASE_URL: 'https://ai.fixture.test/v1', LIVELIFT_AI_API_KEY: randomBytes(16).toString('hex'), LIVELIFT_AI_MODEL: 'fixture-model-1' });
      } else {
        for (const [name, value] of Object.entries(process.env)) if (name.startsWith('LIVELIFT_AI_')) env[name] = value;
      }
    }
    let intelligenceControl;
    if (options.intelligenceTransport) {
      intelligenceControl = path.join(directory, 'intelligence-control.json');
      fs.writeFileSync(intelligenceControl, JSON.stringify({ state: 'available', startMs: 1791000000000, endMs: 1791000120000 }), { mode: 0o600 });
      env.NODE_OPTIONS += ` --import ${path.join(app, 'scripts/live-intelligence-fixture-preload.mjs')}`;
      Object.assign(env, { LIVELIFT_INTELLIGENCE_MODE: 'real', LIVELIFT_TIKTOK_SHOP_APP_KEY: randomBytes(16).toString('hex'),
        LIVELIFT_TIKTOK_SHOP_APP_SECRET: randomBytes(32).toString('hex'), LIVELIFT_TIKTOK_SHOP_ACCESS_TOKEN: randomBytes(32).toString('hex'),
        LIVELIFT_TIKTOK_SHOP_CIPHER: randomBytes(16).toString('hex'), LIVELIFT_TIKTOK_SHOP_INTERVAL_POLICY: 'half_open_confirmed',
        LIVELIFT_PROVIDER_EVIDENCE_DB_PATH: path.join(directory, 'data', 'provider-evidence.sqlite'),
        LIVELIFT_CERT_INTELLIGENCE_FIXTURES: path.join(tooling, '.ops/src/lib/domain/liveIntelligenceFixtures.js'), LIVELIFT_CERT_INTELLIGENCE_CONTROL: intelligenceControl });
    }
    const privateValues = Object.entries(env).filter(([name, value]) => value && /(?:SECRET|ACCESS_TOKEN|ENCRYPTION_KEY|SHOP_CIPHER|SHOP_APP_KEY|AI_API_KEY)$/.test(name)).map(([, value]) => value);
    const assertNoSecrets = (...texts) => {
      for (const text of texts) if (privateValues.some(value => text.includes(value))) throw new Error('A certification credential appeared in a browser artifact or log');
    };
    const verifyPrivateArtifacts = () => {
      assertNoSecrets(fs.readFileSync(log, 'utf8'));
      const staticDir = path.join(app, '.next/static');
      for (const file of fs.readdirSync(staticDir, { recursive: true })) if (file.endsWith('.js')) assertNoSecrets(fs.readFileSync(path.join(staticDir, file), 'utf8'));
    };
    const fd = fs.openSync(log, 'a', 0o600);
    child = spawn(process.execPath, [path.join(app, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(upstreamPort)], { cwd: app, env, stdio: ['ignore', fd, fd] });
    fs.closeSync(fd);
    let spawnError;
    child.once('error', error => { spawnError = error; });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (spawnError || child.exitCode !== null) throw new Error(`App exited before readiness; see ${log}`);
      try {
        const response = await fetch(`http://127.0.0.1:${upstreamPort}/api/readyz`, { signal: AbortSignal.timeout(2000) });
        if (response.status === 200 && (await response.json()).ready === true) return { origin, credentials, stop,
          fixtureTools: path.join(tooling, '.ops/src'), intelligenceControl, assertNoSecrets, verifyPrivateArtifacts };
      } catch { /* Wait for this child only. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`App readiness timed out; run npm run build first. See ${log}`);
  } catch (error) { await stop(); throw error; }
}
