import type { Cue, PlanVersion, ProductSnapshot, Segment, Session } from "@/contracts";
import { createSession } from "./engine";
import { baselinePlan } from "./forecast";
import { isCompressible, schedulePlan, updateSegment, validatePlan, type PlanIssue } from "./plan";
import { buildReview } from "./review";
import { formatClock, formatDuration, msToZonedParts, zonedTimeToMs } from "./time";

/**
 * Next LIVE: turn selected, concrete adjustments into a genuinely NEW plan.
 *
 * - Never mutates the source session: the clone starts from the source's immutable BASELINE,
 *   gets new session/segment/cue ids and an empty runtime.
 * - Proposals come only from this show's recorded facts. One show supports a selected manual
 *   change; it is not a recurring pattern and says nothing about sales.
 * - Infeasibility is shown, not hidden: the assessment reports every anchor's buffer or deficit.
 */

export type ChangeOp =
  | { op: "set_target"; segmentId: string; targetSec: number }
  | { op: "move_before"; segmentId: string; beforeSegmentId: string };

export interface ProposedChange {
  id: string;
  /** "observed" comes from this show's actuals; "tradeoff" is an explicit give-and-take, not a fact. */
  basis: "observed" | "tradeoff";
  segmentId: string;
  title: string;
  detail: string;
  op: ChangeOp;
}

const MINUTE = 60;

/** Apply operations to a plan copy. Pure; segment ids are preserved. */
export function applyChangeOps(plan: PlanVersion, ops: ChangeOp[]): PlanVersion {
  let next = structuredClone(plan);
  for (const op of ops) {
    if (op.op === "set_target") {
      next = updateSegment(next, op.segmentId, { targetSec: op.targetSec });
    } else {
      const from = next.segments.findIndex((s) => s.id === op.segmentId);
      if (from < 0) continue;
      const [moved] = next.segments.splice(from, 1);
      const at = next.segments.findIndex((s) => s.id === op.beforeSegmentId);
      next.segments.splice(at < 0 ? next.segments.length : at, 0, moved);
    }
  }
  return next;
}

export function proposeChanges(session: Session): ProposedChange[] {
  const review = buildReview(session);
  if (!review) return [];
  const base = baselinePlan(session);
  const tz = session.timezone;
  const segById = new Map(base.segments.map((s) => [s.id, s]));
  const proposals: ProposedChange[] = [];

  // 1. Observed durations (this show only).
  for (const row of review.rows) {
    if (!row.actual || row.baselineTargetSec === null) continue;
    if (row.outcome !== "completed" && row.outcome !== "closed_early") continue;
    const diff = row.actual.durSec - row.baselineTargetSec;
    if (Math.abs(diff) < MINUTE) continue;
    const seg = segById.get(row.segmentId) as Segment;
    let suggested = Math.max(MINUTE, Math.round(row.actual.durSec / MINUTE) * MINUTE);
    if (seg.minSec !== null && suggested < seg.minSec) suggested = seg.minSec;
    if (suggested === row.baselineTargetSec) continue;
    proposals.push({
      id: `duration:${seg.id}`,
      basis: "observed",
      segmentId: seg.id,
      title: `${seg.title}: ${formatDuration(row.baselineTargetSec)} → ${formatDuration(suggested)}`,
      detail: `Ran ${formatDuration(row.actual.durSec)} vs ${formatDuration(row.baselineTargetSec)} planned${
        row.outcome === "closed_early" ? " (closed early to protect an anchor)" : ""
      }. One observation in this show — not a recurring pattern.`,
      op: { op: "set_target", segmentId: seg.id, targetSec: suggested },
    });
  }

  // 2. Required coverage that did not happen: move it ahead of an optional segment.
  for (const row of review.rows) {
    if ((row.outcome !== "skipped" && row.outcome !== "not_reached") || row.optional) continue;
    const idx = base.segments.findIndex((s) => s.id === row.segmentId);
    const seg = base.segments[idx];
    if (seg.anchorOffsetSec !== null) continue;
    const optionalIdx = base.segments.findIndex((s, i) => i < idx && s.optional && s.anchorOffsetSec === null);
    if (optionalIdx < 0) continue;
    const crossesAnchor = base.segments.slice(optionalIdx, idx).some((s) => s.anchorOffsetSec !== null);
    if (crossesAnchor) continue;
    const before = base.segments[optionalIdx];
    proposals.push({
      id: `earlier:${seg.id}`,
      basis: "observed",
      segmentId: seg.id,
      title: `${seg.title}: run before ${before.title}`,
      detail: `${seg.title} was ${row.outcome === "skipped" ? "skipped" : "not reached"} in this show. Moving it ahead of optional ${before.title} covers it first.`,
      op: { op: "move_before", segmentId: seg.id, beforeSegmentId: before.id },
    });
  }

  // 3. Trade-offs: where the observed changes eat an anchor's buffer, offer segments that can give time back.
  const observedOps = proposals.filter((p) => p.op.op === "set_target").map((p) => p.op);
  const withObserved = applyChangeOps(base, observedOps);
  const baseRows = schedulePlan(base).rows;
  const obsRows = schedulePlan(withObserved).rows;
  const hasProposal = new Set(proposals.map((p) => p.segmentId));
  let blockStart = 0;
  base.segments.forEach((seg, k) => {
    if (seg.anchorOffsetSec === null) return;
    const baseMargin = baseRows[k].waitBeforeSec - baseRows[k].deficitSec;
    const obsMargin = obsRows[k].waitBeforeSec - obsRows[k].deficitSec;
    if (obsMargin < baseMargin && obsMargin < MINUTE) {
      // A next plan never schedules a zero-length host segment: a declared minimum of 0 trades down to one minute.
      const floorOf = (s: Segment): number => Math.max(s.minSec ?? 0, MINUTE);
      const block = base.segments
        .slice(blockStart, k)
        .filter((s) => s.anchorOffsetSec === null && isCompressible(s) && floorOf(s) < s.targetSec! && !hasProposal.has(s.id))
        .sort((a, b) => b.targetSec! - floorOf(b) - (a.targetSec! - floorOf(a)));
      for (const s of block) {
        const to = floorOf(s);
        hasProposal.add(s.id);
        proposals.push({
          id: `tradeoff:${s.id}`,
          basis: "tradeoff",
          segmentId: s.id,
          title: `${s.title}: ${formatDuration(s.targetSec!)} → ${formatDuration(to)}`,
          detail: `Trade-off, not an observation: uses the declared minimum to return ${formatDuration(
            s.targetSec! - to
          )} of buffer before ${seg.title} (${formatClock(base.plannedStartMs + seg.anchorOffsetSec * 1000, tz)}).`,
          op: { op: "set_target", segmentId: s.id, targetSec: to },
        });
      }
    }
    blockStart = k + 1;
  });

  return proposals;
}

export interface AnchorFeasibility {
  segmentId: string;
  title: string;
  committedMs: number;
  startMs: number | null;
  /** Idle time before the anchor (>= 0). */
  bufferSec: number;
  /** How late the plan itself would arrive (>= 0). */
  deficitSec: number;
}

export interface PlanAssessment {
  issues: PlanIssue[];
  anchors: AnchorFeasibility[];
  /** No blockers and no anchor arrives late, even with zero overruns. */
  feasible: boolean;
  totalSec: number | null;
  finishMs: number | null;
}

export function assessPlan(plan: PlanVersion, products: ProductSnapshot[], timeZone: string): PlanAssessment {
  const issues = validatePlan(plan, products, timeZone);
  const schedule = schedulePlan(plan);
  const anchors: AnchorFeasibility[] = [];
  plan.segments.forEach((seg, i) => {
    if (seg.anchorOffsetSec === null) return;
    const row = schedule.rows[i];
    anchors.push({
      segmentId: seg.id,
      title: seg.title,
      committedMs: plan.plannedStartMs + seg.anchorOffsetSec * 1000,
      startMs: row.startMs,
      bufferSec: row.waitBeforeSec,
      deficitSec: row.deficitSec,
    });
  });
  const total = plan.segments.every((s) => s.targetSec !== null)
    ? plan.segments.reduce((sum, s) => sum + (s.targetSec as number), 0)
    : null;
  return {
    issues,
    anchors,
    feasible: !issues.some((i) => i.severity === "blocker") && anchors.every((a) => a.deficitSec === 0),
    totalSec: total,
    finishMs: schedule.finishMs,
  };
}

export interface PlanDiffRow {
  segmentId: string;
  title: string;
  change: "unchanged" | "duration" | "moved" | "duration_and_moved";
  fromTargetSec: number | null;
  toTargetSec: number | null;
  fromStartMs: number | null;
  toStartMs: number | null;
  fromIndex: number;
  toIndex: number;
}

export function diffPlans(from: PlanVersion, to: PlanVersion): PlanDiffRow[] {
  const fromRows = schedulePlan(from).rows;
  const toRows = schedulePlan(to).rows;
  return to.segments.map((seg, toIndex) => {
    const fromIndex = from.segments.findIndex((s) => s.id === seg.id);
    const before = fromIndex >= 0 ? from.segments[fromIndex] : null;
    const durationChanged = before !== null && before.targetSec !== seg.targetSec;
    const moved = before !== null && fromIndex !== toIndex;
    return {
      segmentId: seg.id,
      title: seg.title,
      change: durationChanged && moved ? "duration_and_moved" : durationChanged ? "duration" : moved ? "moved" : "unchanged",
      fromTargetSec: before?.targetSec ?? null,
      toTargetSec: seg.targetSec,
      fromStartMs: fromIndex >= 0 ? fromRows[fromIndex].startMs : null,
      toStartMs: toRows[toIndex].startMs,
      fromIndex,
      toIndex,
    };
  });
}

/** Same wall-clock time, N days later, in the session's timezone. */
export function addDaysZoned(ms: number, days: number, timeZone: string): number {
  const { date, time } = msToZonedParts(ms, timeZone);
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  const nextDate = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
  return zonedTimeToMs(nextDate, time, timeZone) ?? ms + days * 86_400_000;
}

export interface NextSessionInput {
  id: string;
  title: string;
  plannedStartMs: number;
  nowMs: number;
  changeIds: string[];
  note: string;
}

export type NextSessionResult =
  | { ok: true; session: Session; applied: ProposedChange[] }
  | { ok: false; reason: string };

/**
 * Build a brand-new session from a source session's immutable BASELINE plus chosen operations.
 * Nothing from the source's runtime, events or receipts is carried over; every id is new.
 */
function buildClone(
  source: Session,
  chosen: ProposedChange[],
  input: Pick<NextSessionInput, "id" | "title" | "plannedStartMs" | "nowMs" | "note">
): Session {
  const base = baselinePlan(source);
  const changed = applyChangeOps(base, chosen.map((c) => c.op));

  const segIds = new Map(changed.segments.map((s, i) => [s.id, `${input.id}:s${i + 1}`]));
  const segments: Segment[] = changed.segments.map((s) => ({ ...s, id: segIds.get(s.id)! }));
  const cues: Cue[] = changed.cues.map((c, i) => ({
    ...c,
    id: `${input.id}:c${i + 1}`,
    timing:
      c.timing.type === "at_offset"
        ? c.timing
        : { ...c.timing, segmentId: segIds.get(c.timing.segmentId) ?? c.timing.segmentId },
  }));

  return createSession({
    id: input.id,
    title: input.title.trim(),
    environment: source.environment,
    timezone: source.timezone,
    plannedStartMs: input.plannedStartMs,
    nowMs: input.nowMs,
    objective: source.objective,
    accountLabel: source.accountLabel,
    products: structuredClone(source.products),
    segments,
    cues,
    scenarioId: null,
    derivedFrom: {
      sessionId: source.id,
      sessionTitle: source.title,
      planVersionId: base.id,
      appliedChanges: chosen.map((c) => ({ id: c.id, summary: c.title })),
      changeNote: input.note.trim(),
      createdAtMs: input.nowMs,
    },
    operator: source.operator,
  });
}

export function createNextSession(source: Session, input: NextSessionInput): NextSessionResult {
  if (source.lifecycle !== "ended") {
    return { ok: false, reason: "Next LIVE can only be planned from a show that has ended." };
  }
  if (input.title.trim() === "") return { ok: false, reason: "Give the next show a title." };

  const proposals = proposeChanges(source);
  const chosen: ProposedChange[] = [];
  for (const id of input.changeIds) {
    const p = proposals.find((x) => x.id === id);
    if (!p) return { ok: false, reason: `Unknown adjustment: ${id}` };
    chosen.push(p);
  }
  const touched = chosen.map((c) => `${c.op.op}:${c.segmentId}`);
  if (new Set(touched).size !== touched.length) {
    return { ok: false, reason: "Two selected adjustments change the same segment." };
  }
  return { ok: true, session: buildClone(source, chosen, input), applied: chosen };
}

/** Start a new show from any session's baseline plan, with no adjustments (Create LIVE → Previous session). */
export function duplicateSession(
  source: Session,
  input: Pick<NextSessionInput, "id" | "title" | "plannedStartMs" | "nowMs">
): Session {
  return buildClone(source, [], { ...input, note: `Duplicated from ${source.title}` });
}
