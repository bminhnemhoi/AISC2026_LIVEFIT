import type { EnvironmentIdentity, Session, SessionLifecycle } from "@/contracts";
import { baselinePlan, currentPlan } from "./forecast";
import { plannedTotalSec, schedulePlan } from "./plan";
import { buildReview, VARIANCE_TOLERANCE_SEC, type SegmentOutcome } from "./review";

/** Provider evidence is a separate future input, never inferred from operational records. */
export interface ProviderMetric {
  provider: "tiktok";
  sessionId: string;
  environment: EnvironmentIdentity;
  metric: "views" | "gmv" | "ctr" | "conversion" | "engagement" | "sales";
  value: number | null;
  unit: string;
  observedAtMs: number;
  sourceReference: string;
  evidence: "provider_observed" | "platform_confirmed";
}

export interface AnalyticsFilter {
  environment: EnvironmentIdentity;
  sessionId?: string;
  lifecycle?: SessionLifecycle;
  fromDate?: string;
  toDate?: string;
  order?: "newest" | "oldest";
}

function duration(start: number | null, end: number | null): number | null {
  return start !== null && end !== null && end >= start ? Math.round((end - start) / 1000) : null;
}

export function deriveSessionAnalytics(session: Session) {
  const base = baselinePlan(session);
  const current = currentPlan(session);
  const review = buildReview(session);
  const schedule = schedulePlan(base);
  const rows = base.segments.map((segment, i) => {
    const run = session.runtime.segments[segment.id];
    const actualSec = run?.state === "completed" ? duration(run.startedAtMs, run.endedAtMs) : null;
    const varianceSec = actualSec !== null && segment.targetSec !== null ? actualSec - segment.targetSec : null;
    const reviewed = review?.rows.find((row) => row.segmentId === segment.id);
    let outcome: SegmentOutcome | "pending" | "active" = reviewed?.outcome ?? "pending";
    if (!reviewed) {
      if (run?.state === "skipped") outcome = "skipped";
      else if (run?.state === "completed") outcome = actualSec === null ? "incomplete" : run.endedBy === "session_end" ? "ended_with_show" : "completed";
      else if (run?.state === "active") outcome = session.lifecycle === "ended" ? "incomplete" : "active";
      else outcome = session.lifecycle === "ended" ? "not_reached" : "pending";
    }
    const plannedStartMs = schedule.rows[i]?.startMs ?? null;
    const startedAtMs = run?.startedAtMs ?? null;
    return {
      id: segment.id, title: segment.title, kind: segment.kind,
      plannedSec: segment.targetSec, currentTargetSec: current.segments.find((s) => s.id === segment.id)?.targetSec ?? null,
      actualSec, varianceSec, plannedStartMs, startedAtMs,
      startVarianceSec: plannedStartMs !== null && startedAtMs !== null ? Math.round((startedAtMs - plannedStartMs) / 1000) : null,
      outcome, completed: run?.state === "completed", coverage: run?.coverage ?? null,
      followUp: run?.followUp ?? null,
      overran: varianceSec !== null && varianceSec >= VARIANCE_TOLERANCE_SEC,
      underran: varianceSec !== null && varianceSec <= -VARIANCE_TOLERANCE_SEC,
    };
  });
  const cues = current.cues.filter((cue) => cue.audience === "operator").map((cue) => {
    const run = session.runtime.cues[cue.id];
    return {
      id: cue.id, title: cue.title, state: run && run.state !== "pending" ? run.state : "no_report" as const,
      reportedAtMs: run?.reportedAtMs ?? null, occurredAtMs: run?.occurredAtMs ?? null,
      evidence: session.environment === "REAL" ? "operator_reported" as const : "simulated" as const,
      verification: "unknown" as const,
    };
  });
  const reports = cues.filter((cue) => cue.reportedAtMs !== null).length;
  const notes = session.events.filter((event) => event.type === "note_added");
  const recoveries = session.events.filter((event) => event.type === "recovery_selected");
  return {
    id: session.id, title: session.title, environment: session.environment, lifecycle: session.lifecycle,
    dateMs: session.runtime.startedAtMs ?? base.plannedStartMs,
    durationSec: session.lifecycle === "ended" ? duration(session.runtime.startedAtMs, session.runtime.endedAtMs) : null,
    plannedHostSec: plannedTotalSec(base), plannedSpanSec: schedule.finishMs === null ? null : duration(base.plannedStartMs, schedule.finishMs),
    rows, cues, reports, reportCoverage: cues.length === 0 ? null : reports / cues.length,
    completed: rows.filter((row) => row.completed).length,
    notReached: rows.filter((row) => row.outcome === "not_reached").length,
    notes: notes.map((event) => ({ id: event.id, text: typeof event.data.text === "string" ? event.data.text : event.summary, recordedAtMs: event.recordedAtMs })),
    // Notes have no structured category in the authoritative contract. Never classify their prose as fact.
    recoveries: recoveries.map((event) => ({ id: event.id, summary: event.summary, recordedAtMs: event.recordedAtMs })),
    actions: Object.values(session.runtime.actions).map((action) => ({ ...action, verification: "unknown" as const })),
    corrections: session.events.filter((event) => event.type === "correction_added").length,
    clockDiscontinuities: session.events.filter((event) => event.type === "clock_discontinuity").length,
  };
}

export type SessionAnalytics = ReturnType<typeof deriveSessionAnalytics>;

/** Pure read model. A single environment is mandatory, including for trends and provenance. */
export function deriveIntelligence(sessions: readonly Session[], filter: AnalyticsFilter) {
  const scoped = sessions.filter((s) => s.environment === filter.environment);
  const withinDates = (ms: number) => {
    const date = new Date(ms).toISOString().slice(0, 10);
    return (!filter.fromDate || date >= filter.fromDate) && (!filter.toDate || date <= filter.toDate);
  };
  const selected = scoped.filter((s) => (!filter.sessionId || s.id === filter.sessionId) && (!filter.lifecycle || s.lifecycle === filter.lifecycle));
  const summaries = selected.map(deriveSessionAnalytics).filter((s) => withinDates(s.dateMs))
    .sort((a, b) => (filter.order === "oldest" ? 1 : -1) * (a.dateMs - b.dateMs) || a.id.localeCompare(b.id));
  const ended = summaries.filter((s) => s.lifecycle === "ended");
  const overruns = ended.flatMap((s) => s.rows.filter((row) => row.overran).map((row) => ({ sessionId: s.id, sessionTitle: s.title, ...row })))
    .sort((a, b) => b.varianceSec! - a.varianceSec!);
  const kinds = [...new Set(ended.flatMap((s) => s.rows.map((r) => r.kind)))];
  const patterns = kinds.map((kind) => {
    const observedSessions = ended.filter((s) => s.rows.some((r) => r.kind === kind && r.varianceSec !== null)).length;
    const overrunSessions = ended.filter((s) => s.rows.some((r) => r.kind === kind && r.overran)).length;
    return { kind, observedSessions, overrunSessions };
  }).filter((p) => p.overrunSessions >= 2);
  const nextLive = scoped.filter((s) => s.derivedFrom && withinDates(s.derivedFrom.createdAtMs)
    && (!filter.sessionId || s.id === filter.sessionId || s.derivedFrom.sessionId === filter.sessionId))
    .map((s) => ({ destinationId: s.id, destinationTitle: s.title, environment: s.environment, lifecycle: s.lifecycle, ...s.derivedFrom! }))
    .sort((a, b) => (filter.order === "oldest" ? 1 : -1) * (a.createdAtMs - b.createdAtMs));
  return { environment: filter.environment, sessions: summaries, ended, overruns, patterns, nextLive };
}
