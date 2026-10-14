import { describe, expect, it } from "vitest";
import type { Session } from "@/contracts";
import { applyCommand, createNextSession, createScenarioSession, createSession, newSegment, runScript } from "@/lib/domain";
import { deriveIntelligence, deriveSessionAnalytics } from "@/lib/domain/analytics";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

function shortShow(): Session {
  const initial = createSession({ id: "short", title: "Short show", environment: "REAL", timezone: "UTC", plannedStartMs: 0, nowMs: 0,
    segments: [newSegment("first", { title: "Opening", kind: "opening", targetSec: 60, minSec: 0 }), newSegment("second", { title: "Closing", kind: "closing", targetSec: 60 })],
    cues: [1, 2].map((i) => ({ id: `cue${i}`, title: `Operator cue ${i}`, audience: "operator", action: "none", productId: null, timing: { type: "at_offset", offsetSec: 0 }, text: null })),
  });
  const started = applyCommand(initial, { type: "start_live", nowMs: 0 });
  expect(started.receipt.outcome).toBe("committed");
  const ended = applyCommand(started.session, { type: "end_live", nowMs: 0 });
  expect(ended.receipt.outcome).toBe("committed");
  return ended.session;
}

describe("operational analytics truth", () => {
  it("preserves a real zero interval and never substitutes zero for not reached or undeclared coverage", () => {
    const result = deriveSessionAnalytics(shortShow());
    expect(result.durationSec).toBe(0);
    expect(result.rows[0]).toMatchObject({ plannedSec: 60, actualSec: 0, varianceSec: -60, coverage: null, completed: true });
    expect(result.rows[1]).toMatchObject({ outcome: "not_reached", actualSec: null, varianceSec: null });
    expect(result.notReached).toBe(1);
  });

  it("keeps missing session boundaries, incomplete segments and unknown plans missing", () => {
    const session = shortShow();
    session.runtime.startedAtMs = null;
    session.runtime.segments.first.endedAtMs = null;
    session.plans[0].segments[0].targetSec = null;
    const result = deriveSessionAnalytics(session);
    expect(result.durationSec).toBeNull();
    expect(result.plannedHostSec).toBeNull();
    expect(result.rows[0]).toMatchObject({ actualSec: null, plannedSec: null, varianceSec: null, outcome: "incomplete", overran: false });
    expect(result.rows[1].plannedSec).toBe(60);
    expect(result.rows[1].plannedStartMs).toBeNull();
  });

  it("compares durations even if an upstream missing target prevents a scheduled start", () => {
    const session = runScript(createScenarioSession("buffered"));
    session.plans[0].segments[0].targetSec = null;
    const hoodie = deriveSessionAnalytics(session).rows.find((r) => r.title === "Zip Hoodie")!;
    expect(hoodie).toMatchObject({ plannedSec: 360, actualSec: 540, varianceSec: 180, plannedStartMs: null, startVarianceSec: null, overran: true });
  });

  it("records partial cue coverage and operator claims without confirmation or failure inference", () => {
    const session = shortShow();
    session.runtime.cues.cue1 = { state: "performed", reportedAtMs: 0, occurredAtMs: 0, reason: null };
    const result = deriveSessionAnalytics(session);
    expect(result.reportCoverage).toBe(0.5);
    expect(result.cues[0]).toMatchObject({ state: "performed", evidence: "operator_reported", verification: "unknown" });
    expect(result.cues[1]).toMatchObject({ state: "no_report", verification: "unknown", reportedAtMs: null });
    session.runtime.cues.cue1.state = "attempted";
    expect(deriveSessionAnalytics(session).cues[0].state).toBe("attempted");
    session.plans[0].cues = [];
    expect(deriveSessionAnalytics(session).reportCoverage).toBeNull();
  });

  it("uses append-only note and recovery facts and preserves partial content coverage", () => {
    const started = runScript(createScenarioSession("buffered"), 1);
    const clock = applyCommand(started, { type: "advance_clock", byMs: 180_000, nowMs: started.createdAtMs }).session;
    const advanced = applyCommand(clock, { type: "advance_segment", coverage: "partial", nowMs: clock.virtualNowMs!, recoveryId: "manual-recovery", recoveryLabel: "Close opening with partial coverage" });
    expect(advanced.receipt.outcome).toBe("committed");
    const session = applyCommand(advanced.session, { type: "end_live", nowMs: started.createdAtMs + 180_000 }).session;
    const noted = applyCommand(session, { type: "add_note", text: "Host follow-up", nowMs: session.runtime.endedAtMs! }).session;
    const result = deriveSessionAnalytics(noted);
    expect(result.notes.at(-1)?.text).toBe("Host follow-up");
    expect(result.recoveries).toHaveLength(1);
    expect(result.recoveries[0].summary).toContain("Close opening with partial coverage");
    const row = result.rows.find((r) => r.coverage === "partial");
    expect(row).toBeDefined();
    expect(row?.completed).toBe(true);
  });

  it("separates REAL and SIMULATED summaries, rankings, recurring patterns, and change history", () => {
    const rehearsal = runScript(createScenarioSession("buffered"));
    const real = { ...structuredClone(rehearsal), environment: "REAL" as const, id: "real" };
    const second = { ...structuredClone(rehearsal), id: "second" };
    const sim = deriveIntelligence([real, rehearsal, second], { environment: "SIMULATED", order: "oldest" });
    expect(sim.sessions.map((s) => s.id).sort()).toEqual([rehearsal.id, "second"].sort());
    expect(sim.patterns).toContainEqual({ kind: "product", observedSessions: 2, overrunSessions: 2 });
    expect(sim.overruns.every((r) => r.sessionId !== "real")).toBe(true);
    expect(deriveIntelligence([real, rehearsal], { environment: "REAL" }).patterns).toEqual([]);
  });

  it("reads saved Next LIVE selections without mutation; proposals are not selections", () => {
    const source = runScript(createScenarioSession("buffered"));
    const next = createNextSession(source, { id: "next", title: "Next show", plannedStartMs: source.createdAtMs + 86_400_000, nowMs: source.createdAtMs + 1000, changeIds: [`duration:${source.id}:a`], note: "Chosen timing adjustment" });
    expect(next.ok).toBe(true);
    if (!next.ok) throw new Error(next.reason);
    const input = freeze([source, next.session]);
    const before = JSON.stringify(input);
    const result = deriveIntelligence(input, { environment: "SIMULATED", sessionId: source.id, lifecycle: "ended" });
    expect(result.nextLive).toHaveLength(1);
    expect(result.nextLive[0]).toMatchObject({ destinationId: "next", lifecycle: "planned", appliedChanges: [{ id: `duration:${source.id}:a`, summary: "Zip Hoodie: 6:00 → 9:00" }], changeNote: "Chosen timing adjustment" });
    expect(result.ended).toHaveLength(1);
    expect(deriveIntelligence([source], { environment: "SIMULATED" }).nextLive).toEqual([]);
    expect(deriveIntelligence(input, { environment: "REAL" }).nextLive).toEqual([]);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("filters by state, session and inclusive UTC dates without counting active sessions as completed trends", () => {
    const ended = runScript(createScenarioSession("buffered"));
    const planned = createScenarioSession("minimum");
    const active = runScript(createScenarioSession("missed"), 1);
    const input = [ended, planned, active];
    expect(deriveIntelligence(input, { environment: "SIMULATED" }).ended).toHaveLength(1);
    expect(deriveIntelligence(input, { environment: "SIMULATED", lifecycle: "planned" }).sessions.map((s) => s.id)).toEqual([planned.id]);
    expect(deriveIntelligence(input, { environment: "SIMULATED", fromDate: "2026-10-03", toDate: "2026-10-03", sessionId: ended.id }).sessions).toHaveLength(1);
    expect(deriveIntelligence(input, { environment: "SIMULATED", fromDate: "2026-10-04" }).sessions).toEqual([]);
    expect(deriveSessionAnalytics(active).durationSec).toBeNull();
    expect(deriveSessionAnalytics(planned).rows.every((r) => r.outcome === "pending" && r.actualSec === null)).toBe(true);
    expect(deriveIntelligence([], { environment: "REAL" })).toMatchObject({ sessions: [], ended: [], patterns: [], overruns: [], nextLive: [] });
  });
});
