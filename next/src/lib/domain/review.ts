import type { Cue, Segment, Session, SessionEvent } from "@/contracts";
import { baselinePlan, currentPlan, emptyCueRun, emptySegmentRun, forecastSession } from "./forecast";
import { anchorMs, plannedTotalSec, schedulePlan } from "./plan";

/**
 * Review: Plan vs Actual, derived only from this session's recorded commands.
 *
 * - Planned != actual. The baseline commitment is never rewritten; re-anchors appear beside it.
 * - Missing != zero. A segment that never ran has no actual interval (null), not 0:00.
 * - Unknown != failed. An operator cue with no report is "no report", not "missed".
 * - A censored interval (start without end) is "incomplete", never "did not run" and never given an end.
 * - Coverage is what the operator declared; "not declared" is shown as such.
 * - A report is never platform confirmation: verification is always "unknown" here.
 */

/** Variance below this many seconds is not flagged as an overrun or underrun. */
export const VARIANCE_TOLERANCE_SEC = 15;

/**
 * incomplete — a start was recorded but its end was not (or the reverse): the interval is censored.
 * It is shown as such, never as "did not run" and never with an invented end.
 */
export type SegmentOutcome = "completed" | "closed_early" | "ended_with_show" | "skipped" | "not_reached" | "incomplete";

export interface Interval {
  startMs: number;
  endMs: number;
  durSec: number;
}

export interface ReviewAnchor {
  /** The baseline commitment. */
  committedMs: number;
  /** The commitment at the end of the show (differs after an explicit re-anchor). */
  currentCommittedMs: number;
  reAnchored: boolean;
  actualStartMs: number | null;
  /** Lateness against the BASELINE commitment. null if it never started. */
  lateBySec: number | null;
  status: "on_time" | "late" | "cancelled" | "not_reached";
}

export interface ReviewCorrection {
  eventId: string;
  text: string;
  recordedAtMs: number;
}

export interface ReviewRow {
  segmentId: string;
  title: string;
  kind: Segment["kind"];
  productId: string | null;
  optional: boolean;
  baselineOrder: number;
  /** 1-based rank among the segments that ran, by actual start; null if it never ran. */
  actualOrder: number | null;
  /** 1-based rank the same segment had among the segments that ran, in baseline order. */
  plannedRank: number | null;
  baseline: Interval | null;
  baselineTargetSec: number | null;
  currentTargetSec: number | null;
  actual: Interval | null;
  /** Recorded start even when the interval is incomplete (end missing). */
  recordedStartMs: number | null;
  outcome: SegmentOutcome;
  startVarianceSec: number | null;
  durationVarianceSec: number | null;
  overran: boolean;
  underran: boolean;
  belowMinimum: boolean;
  /** Operator-declared coverage. null = not declared (never inferred from duration). */
  coverage: "complete" | "partial" | null;
  /** Unfinished work the operator declared; kept as a manual follow-up, not transferred automatically. */
  followUp: string | null;
  deferred: boolean;
  anchor: ReviewAnchor | null;
  /** Plan revisions during the show that touched this segment. */
  planChanges: string[];
  corrections: ReviewCorrection[];
}

export interface ReviewCue {
  cueId: string;
  title: string;
  audience: Cue["audience"];
  action: Cue["action"];
  segmentTitle: string | null;
  dueMs: number | null;
  state: "performed" | "attempted" | "cancelled" | "no_report" | "informational";
  occurredAtMs: number | null;
  reportedAtMs: number | null;
  lateBySec: number | null;
  reason: string | null;
  orphaned: boolean;
  /** There is no platform integration, so verification is always unknown. */
  verification: "unknown";
  corrections: ReviewCorrection[];
}

/** A native action the operator reported that was not planned as a cue. */
export interface ReviewAction {
  actionId: string;
  action: "pin_product" | "unpin_product" | "start_promotion" | "other";
  targetLabel: string;
  state: "performed" | "attempted" | "cancelled";
  occurredAtMs: number | null;
  reportedAtMs: number;
  reason: string | null;
  verification: "unknown";
}

export interface HistoryItem {
  id: string;
  type: SessionEvent["type"];
  occurredAtMs: number;
  recordedAtMs: number;
  summary: string;
  actor: string;
  source: SessionEvent["source"];
  /** The record this correction refers to, if any. */
  correctsEventId: string | null;
  correctedBy: string[];
}

export interface ReviewSummary {
  startedAtMs: number;
  endedAtMs: number;
  trackedSec: number;
  /** Sum of baseline durations: host time, excluding idle buffers before anchors. */
  baselineHostSec: number | null;
  /** Baseline finish minus planned start: what "on plan" means for the tracked time. */
  baselineSpanSec: number | null;
  baselineFinishMs: number | null;
  actualFinishMs: number | null;
  finishVarianceSec: number | null;
  counts: {
    completed: number;
    closedEarly: number;
    endedWithShow: number;
    skipped: number;
    notReached: number;
    incomplete: number;
    overran: number;
    deferred: number;
    coveragePartial: number;
    coverageNotDeclared: number;
  };
  anchors: { total: number; onTime: number; late: number; cancelled: number; notReached: number; reAnchored: number };
  cues: { operatorTotal: number; performed: number; attempted: number; cancelled: number; noReport: number; late: number };
  /** Unplanned actions reported during the show. Attempts stay unresolved unless the operator resolved them. */
  actions: { total: number; performed: number; attempted: number; cancelled: number };
  planRevisions: number;
}

export interface PlanRevisionItem {
  planId: string;
  version: number;
  reason: string | null;
  createdAtMs: number;
}

export interface Review {
  sessionId: string;
  rows: ReviewRow[];
  cues: ReviewCue[];
  actions: ReviewAction[];
  history: HistoryItem[];
  revisions: PlanRevisionItem[];
  summary: ReviewSummary;
}

const toSec = (ms: number): number => Math.round(ms / 1000);

export function buildReview(session: Session): Review | null {
  const rt = session.runtime;
  if (session.lifecycle !== "ended" || rt.startedAtMs === null || rt.endedAtMs === null) return null;

  const base = baselinePlan(session);
  const cur = currentPlan(session);
  const baseSchedule = schedulePlan(base);
  const baseRowById = new Map(baseSchedule.rows.map((r) => [r.segmentId, r]));
  const curSegById = new Map(cur.segments.map((s) => [s.id, s]));
  const forecast = forecastSession(session, rt.endedAtMs);

  // Corrections: appended records that refer to earlier ones. Originals are never edited.
  const correctionsByTarget = new Map<string, ReviewCorrection[]>();
  for (const e of session.events) {
    if (e.type !== "correction_added") continue;
    const target = String(e.data.targetEventId ?? "");
    const list = correctionsByTarget.get(target) ?? [];
    list.push({ eventId: e.id, text: String(e.data.text ?? ""), recordedAtMs: e.recordedAtMs });
    correctionsByTarget.set(target, list);
  }
  const correctionsFor = (predicate: (e: SessionEvent) => boolean): ReviewCorrection[] =>
    session.events.filter(predicate).flatMap((e) => correctionsByTarget.get(e.id) ?? []);

  // Order of execution = order of recorded segment starts. Skipped or unreached segments do not count,
  // so a skipped predecessor never makes a later segment look "out of order".
  const startOrder = session.events
    .filter((e) => e.type === "segment_started")
    .map((e) => String(e.data.segmentId));
  const ranSet = new Set(startOrder);
  const plannedExecutedOrder = base.segments.map((s) => s.id).filter((id) => ranSet.has(id));

  const revisionEvents = session.events.filter(
    (e) => e.type === "plan_changed" || e.type === "segment_reordered" || e.type === "anchor_changed"
  );

  const rows: ReviewRow[] = base.segments.map((baseSeg, index) => {
    const run = rt.segments[baseSeg.id] ?? emptySegmentRun();
    const baseRow = baseRowById.get(baseSeg.id);
    const curSeg = curSegById.get(baseSeg.id) ?? baseSeg;

    const baseline: Interval | null =
      baseRow && baseRow.startMs !== null && baseRow.endMs !== null && baseSeg.targetSec !== null
        ? { startMs: baseRow.startMs, endMs: baseRow.endMs, durSec: baseSeg.targetSec }
        : null;

    const actual: Interval | null =
      run.state === "completed" && run.startedAtMs !== null && run.endedAtMs !== null
        ? { startMs: run.startedAtMs, endMs: run.endedAtMs, durSec: toSec(run.endedAtMs - run.startedAtMs) }
        : null;

    const startRecorded = run.startedAtMs !== null;
    const endRecorded = run.endedAtMs !== null;
    let outcome: SegmentOutcome;
    if (run.state === "skipped") outcome = "skipped";
    else if ((run.state === "completed" || run.state === "active") && (!startRecorded || !endRecorded)) {
      // Evidence of execution with a missing boundary: censored, not "did not run".
      outcome = "incomplete";
    } else if (run.state === "completed") {
      const ranShortOfPlan = actual !== null && curSeg.targetSec !== null && actual.durSec < curSeg.targetSec - VARIANCE_TOLERANCE_SEC;
      if (run.endedBy === "session_end") outcome = "ended_with_show";
      else if (run.belowMinimum || (run.coverage === "partial" && ranShortOfPlan)) outcome = "closed_early";
      else outcome = "completed";
    } else outcome = "not_reached";

    const durationVarianceSec = actual && baseline ? actual.durSec - baseline.durSec : null;
    const startVarianceSec = actual && baseline ? toSec(actual.startMs - baseline.startMs) : null;

    const baseA = anchorMs(base, baseSeg);
    const curA = anchorMs(cur, curSeg);
    let anchor: ReviewAnchor | null = null;
    if (baseA !== null) {
      const lateBy = actual ? toSec(actual.startMs - baseA) : null;
      anchor = {
        committedMs: baseA,
        currentCommittedMs: curA ?? baseA,
        reAnchored: curA !== null && curA !== baseA,
        actualStartMs: actual?.startMs ?? null,
        lateBySec: lateBy,
        status:
          run.state === "skipped"
            ? "cancelled"
            : actual
              ? lateBy !== null && lateBy > 0
                ? "late"
                : "on_time"
              : "not_reached",
      };
    }

    const changeEvents = revisionEvents.filter((e) => String(e.data.segmentId) === baseSeg.id);
    const orderIndex = startOrder.indexOf(baseSeg.id);

    return {
      segmentId: baseSeg.id,
      title: baseSeg.title,
      kind: baseSeg.kind,
      productId: baseSeg.productId,
      optional: baseSeg.optional,
      baselineOrder: index + 1,
      actualOrder: orderIndex >= 0 ? orderIndex + 1 : null,
      plannedRank: ranSet.has(baseSeg.id) ? plannedExecutedOrder.indexOf(baseSeg.id) + 1 : null,
      baseline,
      baselineTargetSec: baseSeg.targetSec,
      currentTargetSec: curSeg.targetSec,
      actual,
      recordedStartMs: run.startedAtMs,
      outcome,
      startVarianceSec,
      durationVarianceSec,
      overran: durationVarianceSec !== null && durationVarianceSec >= VARIANCE_TOLERANCE_SEC,
      underran: durationVarianceSec !== null && durationVarianceSec <= -VARIANCE_TOLERANCE_SEC,
      belowMinimum: run.belowMinimum,
      coverage: run.coverage,
      followUp: run.followUp ?? null,
      deferred: run.deferred,
      anchor,
      planChanges: changeEvents.map((e) => e.summary),
      corrections: correctionsFor(
        (e) => String(e.data.segmentId) === baseSeg.id && e.type !== "correction_added"
      ),
    };
  });

  const cueRows: ReviewCue[] = cur.cues.map((cue) => {
    const run = rt.cues[cue.id] ?? emptyCueRun();
    const cf = forecast.cues.find((c) => c.cueId === cue.id);
    const segTitle = cue.timing.type === "at_offset" ? null : (curSegById.get(cue.timing.segmentId)?.title ?? null);
    let state: ReviewCue["state"];
    if (cue.audience !== "operator") state = "informational";
    else if (run.state === "pending") state = "no_report";
    else state = run.state;
    return {
      cueId: cue.id,
      title: cue.title,
      audience: cue.audience,
      action: cue.action,
      segmentTitle: segTitle,
      dueMs: cf?.timeMs ?? null,
      state,
      occurredAtMs: run.occurredAtMs,
      reportedAtMs: run.reportedAtMs,
      lateBySec: cf?.lateBySec ?? null,
      reason: run.reason,
      orphaned: cf?.orphaned ?? false,
      verification: "unknown",
      corrections: correctionsFor((e) => String(e.data.cueId) === cue.id && e.type !== "correction_added"),
    };
  });

  const actions: ReviewAction[] = Object.values(rt.actions ?? {})
    .slice()
    .sort((a, b) => (a.occurredAtMs ?? a.reportedAtMs) - (b.occurredAtMs ?? b.reportedAtMs))
    .map((a) => ({
      actionId: a.id,
      action: a.action,
      targetLabel: a.targetLabel,
      state: a.state,
      occurredAtMs: a.occurredAtMs,
      reportedAtMs: a.reportedAtMs,
      reason: a.reason,
      verification: "unknown" as const,
    }));

  const history: HistoryItem[] = session.events
    .filter((e) => e.type !== "clock_advanced")
    .map((e) => ({
      id: e.id,
      type: e.type,
      occurredAtMs: e.occurredAtMs,
      recordedAtMs: e.recordedAtMs,
      summary: e.summary,
      actor: e.actor,
      source: e.source,
      correctsEventId: e.type === "correction_added" ? String(e.data.targetEventId ?? "") : null,
      correctedBy: (correctionsByTarget.get(e.id) ?? []).map((c) => c.eventId),
    }));

  const revisions: PlanRevisionItem[] = session.plans.slice(1).map((p) => ({
    planId: p.id,
    version: p.version,
    reason: p.reason,
    createdAtMs: p.createdAtMs,
  }));

  const actualRows = rows.filter((r) => r.actual);
  const lastActual = actualRows.reduce<number | null>(
    (acc, r) => (acc === null || r.actual!.endMs > acc ? r.actual!.endMs : acc),
    null
  );
  const anchoredRows = rows.filter((r) => r.anchor);
  const operatorCues = cueRows.filter((c) => c.audience === "operator");

  const summary: ReviewSummary = {
    startedAtMs: rt.startedAtMs,
    endedAtMs: rt.endedAtMs,
    trackedSec: toSec(rt.endedAtMs - rt.startedAtMs),
    baselineHostSec: plannedTotalSec(base),
    baselineSpanSec: baseSchedule.finishMs !== null ? toSec(baseSchedule.finishMs - base.plannedStartMs) : null,
    baselineFinishMs: baseSchedule.finishMs,
    actualFinishMs: lastActual,
    finishVarianceSec:
      lastActual !== null && baseSchedule.finishMs !== null ? toSec(lastActual - baseSchedule.finishMs) : null,
    counts: {
      completed: rows.filter((r) => r.outcome === "completed").length,
      closedEarly: rows.filter((r) => r.outcome === "closed_early").length,
      endedWithShow: rows.filter((r) => r.outcome === "ended_with_show").length,
      skipped: rows.filter((r) => r.outcome === "skipped").length,
      notReached: rows.filter((r) => r.outcome === "not_reached").length,
      incomplete: rows.filter((r) => r.outcome === "incomplete").length,
      overran: rows.filter((r) => r.overran).length,
      deferred: rows.filter((r) => r.deferred).length,
      coveragePartial: rows.filter((r) => r.coverage === "partial").length,
      coverageNotDeclared: rows.filter((r) => r.actual !== null && r.outcome !== "ended_with_show" && r.coverage === null).length,
    },
    anchors: {
      total: anchoredRows.length,
      onTime: anchoredRows.filter((r) => r.anchor!.status === "on_time").length,
      late: anchoredRows.filter((r) => r.anchor!.status === "late").length,
      cancelled: anchoredRows.filter((r) => r.anchor!.status === "cancelled").length,
      notReached: anchoredRows.filter((r) => r.anchor!.status === "not_reached").length,
      reAnchored: anchoredRows.filter((r) => r.anchor!.reAnchored).length,
    },
    cues: {
      operatorTotal: operatorCues.length,
      performed: operatorCues.filter((c) => c.state === "performed").length,
      attempted: operatorCues.filter((c) => c.state === "attempted").length,
      cancelled: operatorCues.filter((c) => c.state === "cancelled").length,
      noReport: operatorCues.filter((c) => c.state === "no_report").length,
      late: operatorCues.filter((c) => c.lateBySec !== null && c.lateBySec >= VARIANCE_TOLERANCE_SEC).length,
    },
    actions: {
      total: actions.length,
      performed: actions.filter((a) => a.state === "performed").length,
      attempted: actions.filter((a) => a.state === "attempted").length,
      cancelled: actions.filter((a) => a.state === "cancelled").length,
    },
    planRevisions: revisions.length,
  };

  return { sessionId: session.id, rows, cues: cueRows, actions, history, revisions, summary };
}
