// Disposable production HTTPS/API certification. No TikTok credentials or external provider requests.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { startRuntime } from './final-runtime.mjs';

const evidence = resolve(process.argv[2] ?? '/tmp/livelift-v7-certification');
mkdirSync(evidence, { recursive: true, mode: 0o700 });
const runtime = await startRuntime('not-configured', evidence, { intelligenceFixture: true });
try {
  const modules = runtime.fixtureTools;
  const { providerFixtureSession, FIXTURE_START } = await import(pathToFileURL(join(modules, 'lib/server/liveIntelligence/fixtureSession.js')));
  const { fixtureEvidence, fixtureCreatorMetrics } = await import(pathToFileURL(join(modules, 'lib/server/liveIntelligence/fixtures.js')));
  const { reconcileLiveEvidence } = await import(pathToFileURL(join(modules, 'lib/domain/liveIntelligence.js')));
  const { FIXTURE_CASES } = await import(pathToFileURL(join(modules, 'contracts/liveIntelligence.js')));
  let headers = { 'Content-Type': 'application/json', Origin: runtime.origin, 'X-LiveLift-Request': '1' };
  const call = (path, body, authenticated = true) => new Promise((resolveCall, reject) => {
    const req = https.request(runtime.origin + path, { method: body === undefined ? 'GET' : 'POST', rejectUnauthorized: false,
      headers: authenticated ? headers : {} }, response => {
      let text = '';
      response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        try { resolveCall({ status: response.statusCode, headers: response.headers, body: JSON.parse(text) }); }
        catch { reject(new Error(`Non-JSON certification response: ${response.statusCode}`)); }
      });
    });
    req.on('error', reject); req.setTimeout(15_000, () => req.destroy(new Error('Certification request timeout')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  assert.equal((await call('/api/v3/intelligence/status', undefined, false)).status, 401);
  const login = await call('/api/v3/auth/login', runtime.credentials);
  assert.equal(login.status, 200);
  headers = { ...headers, Cookie: login.headers['set-cookie'][0].split(';')[0], 'X-LiveLift-Workspace': login.body.workspaceId, 'X-LiveLift-Generation': login.body.generation };
  const roomId = login.body.roomId;
  const status = await call('/api/v3/intelligence/status');
  assert.equal(status.body.fixtureLabel, 'SIMULATED / FIXTURE');
  assert.equal(status.body.capabilities.find(c => c.key === 'raw_comment_text').state, 'UNSUPPORTED');
  const session = providerFixtureSession();
  const command = { commandId: randomUUID(), roomId, sessionId: session.id, expectedSessionRevision: session.revision, session,
    productMappings: [{ liveLiftProductId: 'local-product-a', providerProductId: '100001' }] };
  const first = await call('/api/v3/intelligence/refresh', command);
  assert.equal(first.status, 200); assert.equal(first.body.state, 'AVAILABLE'); assert.equal(first.body.snapshot.provider, 'fixture');
  const duplicate = await call('/api/v3/intelligence/refresh', command);
  assert.equal(duplicate.body.duplicate, true); assert.equal(duplicate.body.snapshot.snapshotId, first.body.snapshot.snapshotId);
  const second = await call('/api/v3/intelligence/refresh', { ...command, commandId: randomUUID(), fixtureCase: 'zero_clicks' });
  assert.equal(second.body.snapshot.segmentAttributions[0].metrics.find(m => m.key === 'clicks').value, 0);
  const read = await call('/api/v3/intelligence/evidence', { roomId, sessionId: session.id, session, perspective: 'later_evidence' });
  assert.equal(read.body.priorSnapshots.length, 2);
  const then = await call('/api/v3/intelligence/evidence', { roomId, sessionId: session.id, session, perspective: 'as_known_then', asOfMs: FIXTURE_START + 30_000 });
  assert.deepEqual(then.body.providerEvidence, []); assert.equal(then.body.runtime.endedAtMs, null); assert.equal(then.body.snapshot, undefined);
  const limited = await call('/api/v3/intelligence/refresh', { ...command, commandId: randomUUID(), fixtureCase: 'rate_limit' });
  assert.equal(limited.body.state, 'RATE_LIMITED'); assert.equal(limited.headers['retry-after'], '60');
  const before = await call('/api/v3/room');
  assert.equal(before.body.sessions.length, 0); // Browser-local fixtures never entered the REAL authority.
  const create = await call('/api/v3/room/commands', { commandId: randomUUID(), roomId, sessionId: null, expectedRevision: before.body.revision, type: 'create_session',
    payload: { title: 'REAL no-fallback certification', timezone: 'Asia/Ho_Chi_Minh', plannedStartMs: Date.now() } });
  assert.equal(create.status, 200);
  const realRoom = await call('/api/v3/room'); const real = realRoom.body.sessions[0];
  const blocked = await call('/api/v3/intelligence/refresh', { commandId: randomUUID(), roomId, sessionId: real.id, expectedSessionRevision: real.revision, providerSessionId: '123' });
  assert.equal(blocked.body.state, 'NOT_CONFIGURED'); assert.equal(blocked.body.snapshot, undefined);
  assert.equal((await call('/api/v3/intelligence/evidence?roomId=wrong&sessionId=' + real.id)).status, 404);

  const fixtures = FIXTURE_CASES.map(kind => {
    const fixture = providerFixtureSession(kind);
    if (['malformed', 'rate_limit', 'auth_expired', 'not_configured', 'access_not_granted', 'unavailable', 'unsupported'].includes(kind)) {
      assert.throws(() => fixtureEvidence(fixture, FIXTURE_START + 500_000, kind));
    } else {
      const snapshot = reconcileLiveEvidence(fixture, fixtureEvidence(fixture, FIXTURE_START + 500_000, kind), {
        snapshotId: randomUUID(), providerSessionId: '123', fetchedAt: FIXTURE_START + 500_000, productMappings: command.productMappings });
      assert.equal(snapshot.mode, 'SIMULATED'); assert.equal(snapshot.provider, 'fixture');
      if (kind === 'realtime_viewers') assert.equal(fixtureCreatorMetrics(FIXTURE_START)[0].value, 123);
    }
    return { case: kind, result: 'PASS', source: 'SIMULATED / FIXTURE' };
  });
  const result = { result: 'PASS', runtime: process.version, transport: 'disposable production HTTPS', fixtures,
    checks: ['existing cookie/context/CSRF authentication', 'official-shape fixtures', 'idempotency', 'zero preserved', 'append-only history', 'historical isolation', 'normalized rate limit', 'REAL refuses fixture fallback', 'wrong room refused', 'REAL authority remains separate'] };
  writeFileSync(join(evidence, 'provider-certification.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} finally { await runtime.stop(); }
