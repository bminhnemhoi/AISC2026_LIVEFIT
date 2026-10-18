import type { Runtime, Session } from "@/contracts";
import { InstantSchema } from "@/contracts/liveIntelligence";
import { emptyCueRun, emptySegmentRun } from "./forecast";

import type { AsKnownThen } from "@/contracts/liveIntelligence";
export type { AsKnownThen } from "@/contracts/liveIntelligence";

/** Record-time replay: late reports are invisible until recorded, even when their occurredAtMs is earlier. */
export function reconstructAsKnownThen(session: Session, asOfMs: number): AsKnownThen {
  InstantSchema.parse(asOfMs);
  if (session.runtime.startedAtMs === null || asOfMs < session.runtime.startedAtMs) throw new Error("Historical replay begins at recorded LIVE start");
  const events = session.events.filter((e) => e.recordedAtMs <= asOfMs).sort((a, b) => a.seq - b.seq);
  const plans = session.plans.filter((p) => p.kind === "baseline" || events.some((e) => e.planVersionId === p.id));
  const plan = structuredClone(plans.at(-1) ?? session.plans[0]);
  const runtime: Runtime = { startedAtMs: null, endedAtMs: null, currentSegmentId: null,
    segments: Object.fromEntries(plan.segments.map((s) => [s.id, emptySegmentRun()])),
    cues: Object.fromEntries(plan.cues.map((c) => [c.id, emptyCueRun()])), actions: {} };
  for (const e of events) {
    const d = e.data;
    const id = typeof d.segmentId === "string" ? d.segmentId : null;
    const run = id ? runtime.segments[id] ?? emptySegmentRun() : null;
    if (e.type === "session_started") runtime.startedAtMs = e.occurredAtMs;
    if (e.type === "session_ended") { runtime.endedAtMs = e.occurredAtMs; runtime.currentSegmentId = null; }
    if (id && run) {
      if (e.type === "segment_started") { run.state = "active"; run.startedAtMs = e.occurredAtMs; run.endedAtMs = null; runtime.currentSegmentId = id; }
      if (e.type === "segment_ended") {
        run.state = "completed"; run.endedAtMs = e.occurredAtMs;
        run.endedBy = d.endedBy === "advance" || d.endedBy === "close" || d.endedBy === "session_end" ? d.endedBy : null;
        run.coverage = d.coverage === "complete" || d.coverage === "partial" ? d.coverage : null;
        run.followUp = typeof d.followUp === "string" ? d.followUp : null; run.belowMinimum = d.belowMinimum === true;
        run.remainingEstimate = null; run.remainingUnknownAtMs = null;
        if (runtime.currentSegmentId === id) runtime.currentSegmentId = null;
      }
      if (e.type === "segment_skipped") { run.state = "skipped"; run.skipAcknowledged = d.optional === false || d.anchorCancelled === true; }
      if (e.type === "segment_reordered") run.deferred = true;
      if (e.type === "remaining_estimated") {
        run.remainingEstimate = typeof d.endsAtMs === "number" ? { endsAtMs: d.endsAtMs, reportedAtMs: e.recordedAtMs } : null;
        run.remainingUnknownAtMs = d.unknown === true ? e.recordedAtMs : null;
      }
      runtime.segments[id] = run;
    }
    if (e.type === "cue_reported" && typeof d.cueId === "string" && ["attempted", "performed", "cancelled"].includes(String(d.report))) {
      runtime.cues[d.cueId] = { state: d.report as "attempted" | "performed" | "cancelled", occurredAtMs: typeof d.occurredAtMs === "number" ? d.occurredAtMs : null,
        reportedAtMs: e.recordedAtMs, reason: typeof d.reason === "string" ? d.reason : null };
    }
    if (e.type === "action_reported" && typeof d.actionId === "string" && ["attempted", "performed", "cancelled"].includes(String(d.report)) && ["pin_product", "unpin_product", "start_promotion", "other"].includes(String(d.action))) {
      const prior = runtime.actions[d.actionId];
      runtime.actions[d.actionId] = { id: d.actionId, action: d.action as "pin_product" | "unpin_product" | "start_promotion" | "other",
        productId: typeof d.productId === "string" ? d.productId : null, targetLabel: String(d.targetLabel ?? ""), state: d.report as "attempted" | "performed" | "cancelled",
        occurredAtMs: typeof d.occurredAtMs === "number" ? d.occurredAtMs : prior?.occurredAtMs ?? null,
        reportedAtMs: e.recordedAtMs, reason: typeof d.reason === "string" ? d.reason : prior?.reason ?? null };
    }
  }
  return { sessionId: session.id, mode: session.environment, perspective: "as_known_then", asOfMs, plan, runtime, events: structuredClone(events),
    evidenceLimits: ["Reconstructed from append-only records known by recordedAtMs; corrections do not rewrite originals.", "Replay begins at recorded LIVE start; pre-LIVE draft edits are not an event-sourced history.", "Later post-LIVE snapshots are excluded regardless of their provider time window."] };
}
