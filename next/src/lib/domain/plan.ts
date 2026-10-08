import type { Cue, PlanVersion, ProductSnapshot, Segment } from "@/contracts";
import { formatClock, formatDuration, secToMs } from "./time";

/**
 * Plan arithmetic: schedule, validation and pure draft-editing helpers.
 * Nothing here reads the system clock or generates random values.
 */

/** Absolute committed instant of a hard-anchored segment, or null for a floating one. */
export function anchorMs(plan: PlanVersion, segment: Segment): number | null {
  return segment.anchorOffsetSec === null
    ? null
    : plan.plannedStartMs + secToMs(segment.anchorOffsetSec);
}

export interface ScheduleRow {
  segmentId: string;
  /** null = unknown because an earlier duration is missing. Never zero. */
  startMs: number | null;
  endMs: number | null;
  anchorMs: number | null;
  /** Idle wait before an anchored start when the host arrives early. */
  waitBeforeSec: number;
  /** Arrival later than the committed anchor. */
  deficitSec: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  finishMs: number | null;
  /** false when any duration is missing, so downstream floating starts are unknown. */
  complete: boolean;
}

/**
 * The planned schedule, ignoring execution.
 * A hard anchor keeps its committed time: an early arrival waits, a late arrival shows a deficit.
 */
export function schedulePlan(plan: PlanVersion): Schedule {
  let cursor: number | null = plan.plannedStartMs;
  const rows: ScheduleRow[] = [];

  for (const seg of plan.segments) {
    const a = anchorMs(plan, seg);
    let start: number | null;
    let wait = 0;
    let deficit = 0;

    if (cursor !== null) {
      if (a !== null) {
        start = Math.max(cursor, a);
        wait = Math.max(0, Math.round((a - cursor) / 1000));
        deficit = Math.max(0, Math.round((cursor - a) / 1000));
      } else {
        start = cursor;
      }
    } else {
      // An earlier duration is missing; only a hard anchor can still fix the start.
      start = a;
    }

    const end: number | null =
      start !== null && seg.targetSec !== null ? start + secToMs(seg.targetSec) : null;
    rows.push({ segmentId: seg.id, startMs: start, endMs: end, anchorMs: a, waitBeforeSec: wait, deficitSec: deficit });
    cursor = end;
  }

  return {
    rows,
    finishMs: rows.length > 0 ? rows[rows.length - 1].endMs : plan.plannedStartMs,
    complete: plan.segments.every((s) => s.targetSec !== null),
  };
}

/** Planned instant of a cue under a schedule, or null if it cannot be determined. */
export function planCueTimeMs(plan: PlanVersion, schedule: Schedule, cue: Cue): number | null {
  const t = cue.timing;
  if (t.type === "at_offset") return plan.plannedStartMs + secToMs(t.offsetSec);
  const row = schedule.rows.find((r) => r.segmentId === t.segmentId);
  if (!row) return null;
  const base = t.type === "segment_start" ? row.startMs : row.endMs;
  return base === null ? null : base + secToMs(t.offsetSec);
}

export type PlanIssueCode =
  | "plan_empty"
  | "title_missing"
  | "duration_missing"
  | "min_exceeds_target"
  | "anchor_order"
  | "anchor_infeasible"
  | "cue_orphaned"
  | "cue_title_missing"
  | "cue_product_missing"
  | "product_missing"
  | "product_disabled";

export interface PlanIssue {
  code: PlanIssueCode;
  /** Blockers prevent Start LIVE. Warnings are disclosed but do not block. */
  severity: "blocker" | "warning";
  segmentId: string | null;
  cueId: string | null;
  message: string;
  deficitSec?: number;
}

export function validatePlan(
  plan: PlanVersion,
  products: ProductSnapshot[],
  timeZone: string
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const schedule = schedulePlan(plan);

  if (plan.segments.length === 0) {
    issues.push({
      code: "plan_empty",
      severity: "blocker",
      segmentId: null,
      cueId: null,
      message: "Add at least one segment with a duration before starting.",
    });
  }

  let previousAnchor: { ms: number; title: string } | null = null;

  plan.segments.forEach((seg, index) => {
    const label = seg.title.trim() || `Segment ${index + 1}`;

    if (seg.title.trim() === "") {
      issues.push({ code: "title_missing", severity: "blocker", segmentId: seg.id, cueId: null, message: `Segment ${index + 1} needs a title.` });
    }
    if (seg.targetSec === null) {
      issues.push({ code: "duration_missing", severity: "blocker", segmentId: seg.id, cueId: null, message: `${label} needs a duration.` });
    }
    if (seg.minSec !== null && seg.targetSec !== null && seg.minSec > seg.targetSec) {
      issues.push({
        code: "min_exceeds_target",
        severity: "blocker",
        segmentId: seg.id,
        cueId: null,
        message: `${label}: minimum ${formatDuration(seg.minSec)} exceeds duration ${formatDuration(seg.targetSec)}.`,
      });
    }

    if (seg.productId !== null) {
      const product = productById.get(seg.productId);
      if (!product) {
        issues.push({ code: "product_missing", severity: "blocker", segmentId: seg.id, cueId: null, message: `${label} references a product that is not in the pack.` });
      } else if (product.status === "disabled") {
        issues.push({ code: "product_disabled", severity: "warning", segmentId: seg.id, cueId: null, message: `${label} uses ${product.code}, which is disabled for this show.` });
      }
    }

    const a = anchorMs(plan, seg);
    if (a !== null) {
      if (previousAnchor && a <= previousAnchor.ms) {
        issues.push({
          code: "anchor_order",
          severity: "blocker",
          segmentId: seg.id,
          cueId: null,
          message: `${label} (${formatClock(a, timeZone, true)}) must be anchored after ${previousAnchor.title} (${formatClock(previousAnchor.ms, timeZone, true)}).`,
        });
      }
      previousAnchor = { ms: a, title: label };

      const row = schedule.rows[index];
      if (row.deficitSec > 0) {
        // A hard constraint the plan itself cannot meet. A draft may hold it while it is being repaired,
        // but it is never runnable: Start stays blocked until the plan or the commitment changes.
        issues.push({
          code: "anchor_infeasible",
          severity: "blocker",
          segmentId: seg.id,
          cueId: null,
          deficitSec: row.deficitSec,
          message: `${label} cannot start at ${formatClock(a, timeZone, true)} even with no overruns: earlier segments run ${formatDuration(row.deficitSec)} past it. Shorten earlier segments or change the commitment before Start.`,
        });
      }
    }
  });

  const segmentIds = new Set(plan.segments.map((s) => s.id));
  for (const cue of plan.cues) {
    if (cue.title.trim() === "") {
      issues.push({ code: "cue_title_missing", severity: "blocker", segmentId: null, cueId: cue.id, message: "A cue needs a title." });
    }
    if (cue.timing.type !== "at_offset" && !segmentIds.has(cue.timing.segmentId)) {
      issues.push({ code: "cue_orphaned", severity: "blocker", segmentId: null, cueId: cue.id, message: `Cue "${cue.title}" refers to a segment that no longer exists.` });
    }
    if (cue.productId !== null && !productById.has(cue.productId)) {
      issues.push({
        code: "cue_product_missing",
        severity: "blocker",
        segmentId: null,
        cueId: cue.id,
        message: `Cue "${cue.title}" targets a product that is no longer in the pack. Choose its product again or delete the cue.`,
      });
    }
    if ((cue.action === "pin_product" || cue.action === "unpin_product") && cue.productId === null) {
      issues.push({
        code: "cue_product_missing",
        severity: "blocker",
        segmentId: null,
        cueId: cue.id,
        message: `Cue "${cue.title}" is a ${cue.action === "pin_product" ? "pin" : "unpin"} action without a product.`,
      });
    }
  }

  return issues;
}

/** Products referenced by the plan (segments and cues). A referenced product cannot be removed silently. */
export function productReferences(plan: PlanVersion, productId: string): { segments: Segment[]; cues: Cue[] } {
  return {
    segments: plan.segments.filter((s) => s.productId === productId),
    cues: plan.cues.filter((c) => c.productId === productId),
  };
}

export const hasBlockers = (issues: PlanIssue[]): boolean =>
  issues.some((i) => i.severity === "blocker");

/** Sum of allocated durations, or null if any is missing (missing is not zero). */
export function plannedTotalSec(plan: PlanVersion): number | null {
  let total = 0;
  for (const seg of plan.segments) {
    if (seg.targetSec === null) return null;
    total += seg.targetSec;
  }
  return total;
}

/** A segment can be shortened only down to a declared minimum below its allocation. */
export function isCompressible(seg: Segment): boolean {
  return seg.minSec !== null && seg.targetSec !== null && seg.minSec < seg.targetSec;
}

/** The smallest the segment may run without an exception: its declared minimum, else its full allocation. */
export function effectiveMinSec(seg: Segment): number | null {
  return seg.minSec ?? seg.targetSec;
}

// ---------------------------------------------------------------------------
// Pure draft-editing helpers (used by Prepare before the baseline locks).
// ---------------------------------------------------------------------------

export function newSegment(id: string, partial: Partial<Omit<Segment, "id">> = {}): Segment {
  return {
    id,
    title: "",
    kind: "product",
    productId: null,
    targetSec: null,
    minSec: null,
    optional: false,
    anchorOffsetSec: null,
    cue: null,
    notes: null,
    ...partial,
  };
}

export function updateSegment(
  plan: PlanVersion,
  segmentId: string,
  patch: Partial<Omit<Segment, "id">>
): PlanVersion {
  return {
    ...plan,
    segments: plan.segments.map((s) => (s.id === segmentId ? { ...s, ...patch } : s)),
  };
}

export function addSegment(plan: PlanVersion, segment: Segment, index?: number): PlanVersion {
  const segments = [...plan.segments];
  segments.splice(index === undefined ? segments.length : index, 0, segment);
  return { ...plan, segments };
}

/** Removing a segment also removes the cues that were timed to it. */
export function removeSegment(plan: PlanVersion, segmentId: string): PlanVersion {
  return {
    ...plan,
    segments: plan.segments.filter((s) => s.id !== segmentId),
    cues: plan.cues.filter((c) => c.timing.type === "at_offset" || c.timing.segmentId !== segmentId),
  };
}

export function moveSegment(plan: PlanVersion, segmentId: string, delta: -1 | 1): PlanVersion {
  const from = plan.segments.findIndex((s) => s.id === segmentId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= plan.segments.length) return plan;
  const segments = [...plan.segments];
  const [moved] = segments.splice(from, 1);
  segments.splice(to, 0, moved);
  return { ...plan, segments };
}

export function addCue(plan: PlanVersion, cue: Cue): PlanVersion {
  return { ...plan, cues: [...plan.cues, cue] };
}

export function updateCue(plan: PlanVersion, cueId: string, patch: Partial<Omit<Cue, "id">>): PlanVersion {
  return { ...plan, cues: plan.cues.map((c) => (c.id === cueId ? { ...c, ...patch } : c)) };
}

export function removeCue(plan: PlanVersion, cueId: string): PlanVersion {
  return { ...plan, cues: plan.cues.filter((c) => c.id !== cueId) };
}

export function setPlannedStart(plan: PlanVersion, plannedStartMs: number): PlanVersion {
  return { ...plan, plannedStartMs };
}
