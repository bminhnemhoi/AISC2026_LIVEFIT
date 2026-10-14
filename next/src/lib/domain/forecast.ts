import type { CueRun, PlanVersion, SegmentRun, Session } from "@/contracts";
import { anchorMs, planCueTimeMs, schedulePlan, type Schedule } from "./plan";
import { formatDuration, secToMs } from "./time";

/**
 * Forecast: a linear pass over the ordered rundown (established scheduling arithmetic).
 *
 * - Completed boundaries use recorded actuals; skipped segments have no performed interval.
 * - The active segment ends at an explicit host estimate, else its target, else it is an
 *   overrun with an UNKNOWN end (earliest possible end = now, a lower bound — never a promise).
 * - A hard anchor keeps its committed time. Early arrival shows a buffer; late arrival shows a
 *   deficit. The anchor is never silently moved.
 */

export const currentPlan = (session: Session): PlanVersion =>
  session.plans[session.plans.length - 1];

export const baselinePlan = (session: Session): PlanVersion => session.plans[0];

export const emptySegmentRun = (): SegmentRun => ({
  state: "pending",
  startedAtMs: null,
  endedAtMs: null,
  endedBy: null,
  coverage: null,
  followUp: null,
  remainingEstimate: null,
  remainingUnknownAtMs: null,
  belowMinimum: false,
  skipAcknowledged: false,
  deferred: false,
});

export const emptyCueRun = (): CueRun => ({
  state: "pending",
  occurredAtMs: null,
  reportedAtMs: null,
  reason: null,
});

export type AnchorStatus =
  | "on_track" // projected arrival at or before the commitment
  | "at_risk" // projected arrival later than the commitment (definite)
  | "possible_risk" // active end unknown: the buffer may be consumed
  | "missed" // the committed time has passed and the segment has not started
  | "met" // started at or before the commitment
  | "met_late"; // started after the commitment

export interface AnchorForecast {
  committedMs: number;
  /** The baseline's commitment for this segment (differs after an explicit re-anchor). */
  baselineCommittedMs: number | null;
  projectedStartMs: number;
  /** Idle time before the anchor if everything goes as projected. */
  bufferSec: number;
  /** Projected (or actual) lateness against the commitment. */
  deficitSec: number;
  status: AnchorStatus;
  /** true when the arrival is only a lower bound (active end unknown). */
  lowerBound: boolean;
}

/**
 * Unrounded lateness against the commitment, in ms. `deficitSec` is rounded to whole seconds, so it
 * reads 0 for up to 499 ms of real lateness. A pending anchor's projected start is never before now,
 * so for a missed anchor this is the exact lateness. Presentation only: no status or deficit uses it.
 */
export function anchorLateMs(anchor: AnchorForecast): number {
  return Math.max(0, anchor.projectedStartMs - anchor.committedMs);
}

/** The exact anchor instant: the commitment time has arrived, the segment has not started, nothing is late yet. */
export function isAnchorDueNow(anchor: AnchorForecast): boolean {
  return anchor.status === "missed" && anchor.deficitSec === 0 && anchorLateMs(anchor) === 0;
}

/** Lateness as m:ss. Real lateness under the rounded second reads "<1s", never "0:00". */
export function formatAnchorLate(anchor: AnchorForecast): string {
  return anchor.deficitSec === 0 && anchorLateMs(anchor) > 0 ? "<1s" : formatDuration(anchor.deficitSec);
}

export interface SegmentForecast {
  segmentId: string;
  state: SegmentRun["state"];
  /** Baseline schedule (immutable commitment). null if the segment is not in the baseline. */
  baselineStartMs: number | null;
  baselineEndMs: number | null;
  /** Actual for started segments, projected for pending ones. */
  startMs: number | null;
  endMs: number | null;
  /** true when endMs is only a lower bound (the active end is unknown, or downstream of it). */
  lowerBound: boolean;
  /** startMs - baselineStartMs in seconds (positive = later than committed). null if unknown. */
  driftSec: number | null;
  waitBeforeSec: number;
  anchor: AnchorForecast | null;
}

export interface ActiveEnd {
  segmentId: string;
  endMs: number;
  known: boolean;
  /**
   * estimate         — the host's explicit remaining estimate (0 allowed; it does not end the segment)
   * target           — no estimate entered: the allocation projects the end
   * declared_unknown — the host said the remaining time is unknown: no invented end, earliest = now
   * unknown_overrun  — past the target (or an expired estimate) with nothing newer: earliest = now
   */
  basis: "estimate" | "target" | "declared_unknown" | "unknown_overrun";
}

export interface CueForecast {
  cueId: string;
  timeMs: number | null;
  lowerBound: boolean;
  state: CueRun["state"];
  /** Seconds until due for a pending cue (negative = overdue). */
  dueInSec: number | null;
  /** Reported occurrence minus its due time (positive = late). */
  lateBySec: number | null;
  /** The segment it was timed to was skipped. */
  orphaned: boolean;
}

export interface AnchorGuard {
  segmentId: string;
  committedMs: number;
  /** Latest instant the host may become free of earlier work and still meet the anchor. */
  latestFreeMs: number | null;
}

export interface Forecast {
  nowMs: number;
  running: boolean;
  segments: SegmentForecast[];
  active: ActiveEnd | null;
  finishMs: number | null;
  finishLowerBound: boolean;
  baselineFinishMs: number | null;
  finishDriftSec: number | null;
  /** First pending anchored segment, whatever its status. */
  nextAnchorSegmentId: string | null;
  /** First pending anchored segment that is at risk or missed. */
  criticalSegmentId: string | null;
  anchorGuard: AnchorGuard | null;
  cues: CueForecast[];
}

const toSec = (ms: number): number => Math.round(ms / 1000);

function settledAnchor(committedMs: number, baselineCommittedMs: number | null, startMs: number): AnchorForecast {
  const late = startMs > committedMs;
  return {
    committedMs,
    baselineCommittedMs,
    projectedStartMs: startMs,
    bufferSec: 0,
    deficitSec: late ? toSec(startMs - committedMs) : 0,
    status: late ? "met_late" : "met",
    lowerBound: false,
  };
}

export function forecastSession(session: Session, nowMs: number): Forecast {
  const plan = currentPlan(session);
  const base = baselinePlan(session);
  const baseSchedule: Schedule = schedulePlan(base);
  const rt = session.runtime;
  const started = rt.startedAtMs !== null;
  const ended = rt.endedAtMs !== null;
  const now = ended && rt.endedAtMs !== null ? rt.endedAtMs : nowMs;

  const baseRowById = new Map(baseSchedule.rows.map((r) => [r.segmentId, r]));
  const baseSegById = new Map(base.segments.map((s) => [s.id, s]));

  let cursor: number | null = started && rt.startedAtMs !== null ? rt.startedAtMs : plan.plannedStartMs;
  let lowerBound = false;
  let active: ActiveEnd | null = null;
  let seenPending = false;
  const out: SegmentForecast[] = [];

  for (const seg of plan.segments) {
    const run = rt.segments[seg.id] ?? emptySegmentRun();
    const baseRow = baseRowById.get(seg.id) ?? null;
    const baseSeg = baseSegById.get(seg.id) ?? null;
    const a = anchorMs(plan, seg);
    const baseA = baseSeg ? anchorMs(base, baseSeg) : null;

    let startMs: number | null = null;
    let endMs: number | null = null;
    let segLowerBound = false;
    let wait = 0;
    let anchor: AnchorForecast | null = null;

    if (run.state === "completed") {
      startMs = run.startedAtMs;
      endMs = run.endedAtMs;
      if (endMs !== null) cursor = cursor === null ? endMs : Math.max(cursor, endMs);
      if (a !== null && startMs !== null) anchor = settledAnchor(a, baseA, startMs);
    } else if (run.state === "skipped") {
      // No performed interval and no cursor movement.
    } else if (run.state === "active" && run.startedAtMs !== null) {
      startMs = run.startedAtMs;
      const targetEnd = seg.targetSec === null ? null : startMs + secToMs(seg.targetSec);
      if (run.remainingEstimate && run.remainingEstimate.endsAtMs >= now) {
        active = { segmentId: seg.id, endMs: run.remainingEstimate.endsAtMs, known: true, basis: "estimate" };
      } else if (run.remainingUnknownAtMs !== null) {
        // Explicitly unknown: the target must not be used to invent an end. Earliest possible end = now.
        active = { segmentId: seg.id, endMs: now, known: false, basis: "declared_unknown" };
      } else if (targetEnd !== null && now <= targetEnd) {
        active = { segmentId: seg.id, endMs: targetEnd, known: true, basis: "target" };
      } else {
        // Overrun with no valid estimate: the end is unknown. Earliest possible end = now.
        active = { segmentId: seg.id, endMs: now, known: false, basis: "unknown_overrun" };
      }
      endMs = active.endMs;
      lowerBound = lowerBound || !active.known;
      segLowerBound = !active.known;
      cursor = active.endMs;
      if (a !== null) anchor = settledAnchor(a, baseA, startMs);
    } else if (!ended) {
      // Pending: project from the cursor.
      if (started && !seenPending && cursor !== null) cursor = Math.max(cursor, now);
      seenPending = true;

      if (cursor !== null) {
        if (a !== null) {
          startMs = Math.max(cursor, a);
          wait = Math.max(0, toSec(a - cursor));
        } else {
          startMs = cursor;
        }
      } else {
        startMs = a; // unknown arrival: only a hard anchor can fix the start
      }
      endMs = startMs !== null && seg.targetSec !== null ? startMs + secToMs(seg.targetSec) : null;
      segLowerBound = lowerBound;

      if (a !== null && cursor !== null) {
        const deficit = Math.max(0, toSec(cursor - a));
        const buffer = Math.max(0, toSec(a - cursor));
        let status: AnchorStatus;
        if (started && now >= a) status = "missed";
        else if (deficit > 0) status = "at_risk";
        else if (lowerBound) status = "possible_risk";
        else status = "on_track";
        anchor = {
          committedMs: a,
          baselineCommittedMs: baseA,
          projectedStartMs: startMs ?? a,
          bufferSec: buffer,
          deficitSec: status === "missed" ? Math.max(deficit, toSec(now - a)) : deficit,
          status,
          lowerBound,
        };
      }
      cursor = endMs;
    }

    out.push({
      segmentId: seg.id,
      state: run.state,
      baselineStartMs: baseRow?.startMs ?? null,
      baselineEndMs: baseRow?.endMs ?? null,
      startMs,
      endMs,
      lowerBound: segLowerBound,
      driftSec: startMs !== null && baseRow?.startMs != null ? toSec(startMs - baseRow.startMs) : null,
      waitBeforeSec: wait,
      anchor,
    });
  }

  // Finish: last segment that has (or will have) an interval.
  const finishSeg = [...out].reverse().find((s) => s.state !== "skipped" && s.endMs !== null);
  const finishMs = finishSeg?.endMs ?? null;
  const baselineFinishMs = baseSchedule.finishMs;

  const pendingAnchored = out.filter((s) => s.state === "pending" && s.anchor !== null);
  const critical = pendingAnchored.find((s) => s.anchor!.status === "at_risk" || s.anchor!.status === "missed");

  // Latest free instant for the first pending anchored segment.
  let anchorGuard: AnchorGuard | null = null;
  if (started && !ended && pendingAnchored.length > 0) {
    const first = pendingAnchored[0];
    const firstIndex = plan.segments.findIndex((s) => s.id === first.segmentId);
    let allocMs = 0;
    let unknown = false;
    for (let i = 0; i < firstIndex; i++) {
      const s = plan.segments[i];
      const sf = out[i];
      if (sf.state !== "pending") continue;
      if (s.targetSec === null) unknown = true;
      else allocMs += secToMs(s.targetSec);
    }
    anchorGuard = {
      segmentId: first.segmentId,
      committedMs: first.anchor!.committedMs,
      latestFreeMs: unknown ? null : first.anchor!.committedMs - allocMs,
    };
  }

  // Cues.
  const segById = new Map(out.map((s) => [s.segmentId, s]));
  const planSchedule = schedulePlan(plan);
  const cues: CueForecast[] = plan.cues.map((cue) => {
    const run = rt.cues[cue.id] ?? emptyCueRun();
    let timeMs: number | null = null;
    let lb = false;
    let orphaned = false;
    if (cue.timing.type === "at_offset") {
      timeMs = planCueTimeMs(plan, planSchedule, cue);
    } else {
      const sf = segById.get(cue.timing.segmentId);
      if (sf?.state === "skipped") {
        orphaned = true;
      } else if (sf) {
        const baseT = cue.timing.type === "segment_start" ? sf.startMs : sf.endMs;
        if (baseT !== null) {
          timeMs = baseT + secToMs(cue.timing.offsetSec);
          lb = sf.lowerBound;
        }
      }
    }
    return {
      cueId: cue.id,
      timeMs,
      lowerBound: lb,
      state: run.state,
      dueInSec: run.state === "pending" && timeMs !== null ? toSec(timeMs - now) : null,
      lateBySec: run.occurredAtMs !== null && timeMs !== null ? toSec(run.occurredAtMs - timeMs) : null,
      orphaned,
    };
  });

  return {
    nowMs: now,
    running: started && !ended,
    segments: out,
    active,
    finishMs,
    finishLowerBound: finishSeg?.lowerBound ?? false,
    baselineFinishMs,
    finishDriftSec: finishMs !== null && baselineFinishMs !== null ? toSec(finishMs - baselineFinishMs) : null,
    nextAnchorSegmentId: pendingAnchored[0]?.segmentId ?? null,
    criticalSegmentId: critical?.segmentId ?? null,
    anchorGuard,
    cues,
  };
}
