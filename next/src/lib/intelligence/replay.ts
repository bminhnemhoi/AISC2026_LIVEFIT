import type { Session, SessionEvent } from "@/contracts";
import { formatClock, type Review } from "@/lib/domain";
import { parseQuickCue, type QuickCue } from "./quickCues";

/**
 * "As known then": the operational record as the operator could have seen it while the LIVE was running.
 *
 * The cut is strict: only records written up to and including the `session_ended` event are replayed. Notes and
 * corrections appended afterwards are later knowledge, so they are counted but never placed on this timeline.
 * Nothing from a provider appears here: LiveLift recorded no provider evidence while the show ran.
 */

export type ReplayLane = "plan" | "actual" | "decision" | "operator";

export const LANE_LABEL: Record<ReplayLane, string> = {
  plan: "Plan",
  actual: "Actual",
  decision: "Decision",
  operator: "Operator report",
};

const LANE_BY_TYPE: Partial<Record<SessionEvent["type"], ReplayLane>> = {
  session_started: "actual",
  segment_started: "actual",
  segment_ended: "actual",
  segment_skipped: "actual",
  remaining_estimated: "actual",
  clock_discontinuity: "actual",
  session_ended: "actual",
  plan_changed: "decision",
  anchor_changed: "decision",
  segment_reordered: "decision",
  recovery_selected: "decision",
  cue_reported: "operator",
  action_reported: "operator",
  note_added: "operator",
  correction_added: "operator",
};

export interface ReplayEntry {
  id: string;
  atMs: number;
  lane: ReplayLane;
  type: SessionEvent["type"] | "baseline_plan";
  summary: string;
  actor: string;
  /** Set when this note is one of the operator's quick cues. */
  quickCue: QuickCue | null;
  /** What the plan expected and what was actually running at that moment (decisions and operator reports only). */
  context: { planned: string | null; actual: string | null } | null;
}

export interface ReplayModel {
  entries: ReplayEntry[];
  /** Notes and corrections recorded after the LIVE ended. Not part of the replay. */
  appendedAfterEnd: number;
  startedAtMs: number;
  endedAtMs: number;
}

export function buildReplay(session: Session, review: Review): ReplayModel {
  const tz = session.timezone;
  const endedSeq = session.events.find((e) => e.type === "session_ended")?.seq ?? Number.POSITIVE_INFINITY;
  const planAt = (ms: number): string | null => review.rows.find((r) => r.baseline && ms >= r.baseline.startMs && ms < r.baseline.endMs)?.title ?? null;
  const actualAt = (ms: number): string | null => review.rows.find((r) => r.actual && ms >= r.actual.startMs && ms < r.actual.endMs)?.title ?? null;

  const entries: ReplayEntry[] = [];
  const baselineStarts = review.rows.flatMap((r) => (r.baseline ? [r.baseline.startMs] : []));
  if (baselineStarts.length > 0 && review.summary.baselineFinishMs !== null) {
    const start = Math.min(...baselineStarts);
    entries.push({
      id: "baseline-plan",
      atMs: start,
      lane: "plan",
      type: "baseline_plan",
      summary: `Baseline plan: ${review.rows.length} segment${review.rows.length === 1 ? "" : "s"}, ${formatClock(start, tz)}–${formatClock(review.summary.baselineFinishMs, tz)}. This commitment is never rewritten.`,
      actor: "Plan",
      quickCue: null,
      context: null,
    });
  }

  let appendedAfterEnd = 0;
  for (const e of session.events) {
    if (e.type === "clock_advanced") continue;
    if (e.seq > endedSeq || e.recordedAtMs > review.summary.endedAtMs) {
      if (e.type === "note_added" || e.type === "correction_added") appendedAfterEnd += 1;
      continue;
    }
    const lane = LANE_BY_TYPE[e.type] ?? "actual";
    const quickCue = e.type === "note_added" ? parseQuickCue(String(e.data.text ?? "")) : null;
    entries.push({
      id: e.id,
      atMs: e.occurredAtMs,
      lane,
      type: e.type,
      summary: quickCue ? `Operator reported: ${quickCue.label}` : e.summary,
      actor: e.actor,
      quickCue,
      context: lane === "decision" || lane === "operator" ? { planned: planAt(e.occurredAtMs), actual: actualAt(e.occurredAtMs) } : null,
    });
  }
  entries.sort((a, b) => a.atMs - b.atMs);
  return { entries, appendedAfterEnd, startedAtMs: review.summary.startedAtMs, endedAtMs: review.summary.endedAtMs };
}
