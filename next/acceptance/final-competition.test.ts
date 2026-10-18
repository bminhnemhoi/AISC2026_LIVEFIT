import { describe, expect, it } from 'vitest';
import { assertNext, assertTiming, assertUnchanged } from './final-competition.mjs';
import { isolatedEnv } from './final-runtime.mjs';

describe('final certification guards', () => {
  it('isolates inherited and dotenv deployment configuration before creating its room', () => {
    const input = { PATH: '/bin', LIVELIFT_DB_PATH: '/existing/room.sqlite', LIVELIFT_AI_API_KEY: 'inherited', NODE_OPTIONS: '--import external.mjs' };
    const env = isolatedEnv(input, { LIVELIFT_PROVIDER_DB_PATH: '/existing/provider.sqlite', NEXT_PUBLIC_API_URL: 'https://external.test' });
    expect(env.PATH).toBe('/bin');
    for (const name of ['LIVELIFT_DB_PATH', 'LIVELIFT_AI_API_KEY', 'LIVELIFT_PROVIDER_DB_PATH', 'NEXT_PUBLIC_API_URL', 'NODE_OPTIONS']) expect(env[name]).toBe('');
    expect(input.LIVELIFT_DB_PATH).toBe('/existing/room.sqlite');
  });

  it('detects actual/history/plan mutation even when the source id stays the same', () => {
    const before = { id: 'source', revision: 4, plans: [{ targetSec: 180 }], events: [{ type: 'start' }] };
    assertUnchanged(before, structuredClone(before));
    for (const after of [{ ...before, revision: 5 }, { ...before, plans: [{ targetSec: 120 }] }, { ...before, events: [] }]) expect(() => assertUnchanged(before, after)).toThrow();
  });

  it('rejects missing-as-zero and zero-as-missing while accepting a zero without a visual mark', () => {
    const missing = { title: 'Unreached', missing: true, zero: false, actual: 'Not recorded', variance: 'Unknown', actualBars: 0 };
    const zero = { title: 'Opening', missing: false, zero: true, actual: '0:00', variance: '−3:00 · underrun', actualBars: 0 };
    assertTiming([missing, zero]);
    for (const bad of [{ ...missing, actual: '0:00' }, { ...missing, variance: '0:00' }, { ...missing, zero: true }]) expect(() => assertTiming([bad, zero])).toThrow();
    for (const bad of [{ ...zero, actual: 'Not recorded' }, { ...zero, variance: 'Unknown' }, { ...zero, variance: 'Unavailable' }]) expect(() => assertTiming([missing, bad])).toThrow();
    expect(() => assertTiming([missing])).toThrow();
    expect(() => assertTiming([zero])).toThrow();
  });

  it('rejects copied runtime/history, wrong provenance, environment and change count', () => {
    const source = { id: 'source', environment: 'SIMULATED' };
    const next = { id: 'next', environment: 'SIMULATED', lifecycle: 'planned', derivedFrom: { sessionId: 'source', appliedChanges: [{}] }, events: [],
      runtime: { startedAtMs: null, endedAtMs: null, currentSegmentId: null, segments: { opening: { state: 'pending', startedAtMs: null, endedAtMs: null } },
        cues: { pin: { state: 'pending', reportedAtMs: null } }, actions: {} } };
    assertNext(source, next, 1);
    for (const bad of [{ ...next, id: 'source' }, { ...next, environment: 'REAL' }, { ...next, events: [{}] },
      { ...next, derivedFrom: { sessionId: 'other', appliedChanges: [{}] } }, { ...next, runtime: { ...next.runtime, startedAtMs: 0 } },
      { ...next, runtime: { ...next.runtime, cues: { pin: { state: 'performed', reportedAtMs: 0 } } } },
      { ...next, runtime: { ...next.runtime, actions: { manual: {} } } }]) expect(() => assertNext(source, bad, 1)).toThrow();
    expect(() => assertNext(source, next, 0)).toThrow();
  });
});
