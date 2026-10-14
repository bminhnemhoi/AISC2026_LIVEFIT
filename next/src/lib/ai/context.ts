import type { AiCandidateChange, AiCandidateOption, AiCueEvidence, AiFact, AiFactKind, AiPlatformEvidence, AiPriorSession, AiSegmentEvidence, AiUntrustedText, OperateAiContext, ReviewAiContext } from "@/contracts/ai";
import type { Session } from "@/contracts";
import {
  activeSegment,
  analyzeRecovery,
  baselinePlan,
  buildReview,
  currentPlan,
  emptySegmentRun,
  forecastSession,
  formatClock,
  formatDuration,
  formatHuman,
  formatSigned,
  proposeChanges,
  type Forecast,
  type ProposedChange,
  type RecoveryAnalysis,
  type RecoveryOption,
  type Review,
  VARIANCE_TOLERANCE_SEC,
} from "@/lib/domain";
import { sanitizeUntrusted } from "./redact";
import type { LiveIntelligenceSnapshot } from "@/contracts/liveIntelligence";
import { laterEvidenceFacts } from "./providerFacts";

/**
 * The AI context contract: the ONLY evidence a model is given.
 *
 * Built purely from one show's recorded commands and LiveLift's own schedule arithmetic. It carries no
 * credentials, no account data, no other workspace and no platform analytics (LiveLift has none). Every free-text
 * field a person wrote is sanitised and travels as data; the facts are sentences LiveLift itself composed.
 *
 * Frozen semantics are kept in the facts: missing is a "gap", never zero; planned and actual are separate; a
 * report is "operator_reported", never platform confirmation; no report is "unknown", never "failed".
 */

/** In this build no platform evidence is established, whatever is connected. Mirrors the TikTok status `limits`. */
export const PLATFORM_EVIDENCE: AiPlatformEvidence = { live: "not_established", shop: "not_established", analytics: "not_established", nativeActions: "not_established" };

const MAX_FACTS = 40;
const MAX_NOTES = 8;
const NOTE_CHARS = 240;
const TITLE_CHARS = 60;

const clip = (text: string, max = 420): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
const title = (text: string | null | undefined): string => sanitizeUntrusted(text, TITLE_CHARS) || "Untitled";
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

class Facts {
  readonly items: AiFact[] = [];
  add(topic: string, kind: AiFactKind, text: string, values?: Record<string, number>): void {
    if (this.items.length >= MAX_FACTS) return;
    this.items.push({ id: `f${this.items.length + 1}`, topic, kind, text: clip(text), ...(values ? { values } : {}) });
  }
}

const toSec = (ms: number): number => Math.round(ms / 1000);

function segmentEvidence(session: Session): AiSegmentEvidence[] {
  const plan = currentPlan(session);
  const productById = new Map(session.products.map((p) => [p.id, p]));
  return plan.segments.slice(0, 30).map((seg) => {
    const run = session.runtime.segments[seg.id] ?? emptySegmentRun();
    const started = run.startedAtMs;
    return {
      title: title(seg.title),
      kind: seg.kind,
      state: run.state,
      targetSec: seg.targetSec,
      minSec: seg.minSec,
      optional: seg.optional,
      hardAnchorAtSec: seg.anchorOffsetSec,
      actualStartSec: started !== null ? toSec(started - plan.plannedStartMs) : null,
      actualDurationSec: started !== null && run.endedAtMs !== null ? toSec(run.endedAtMs - started) : null,
      coverage: run.coverage,
      productCode: seg.productId ? sanitizeUntrusted(productById.get(seg.productId)?.code, 24) || null : null,
    };
  });
}

function cueEvidence(session: Session, forecast: Forecast): AiCueEvidence[] {
  const plan = currentPlan(session);
  return plan.cues.slice(0, 30).map((cue) => {
    const run = session.runtime.cues[cue.id];
    const cf = forecast.cues.find((c) => c.cueId === cue.id);
    const state: AiCueEvidence["state"] =
      cue.audience !== "operator" ? "informational" : !run || run.state === "pending" ? (forecast.running ? "pending" : "no_report") : run.state;
    return { title: title(cue.title), action: cue.action, audience: cue.audience, state, lateBySec: cf?.lateBySec ?? null };
  });
}

function notesOf(session: Session): AiUntrustedText[] {
  const plan = currentPlan(session);
  const start = session.runtime.startedAtMs;
  const at = (ms: number): number | null => (start === null ? null : toSec(ms - start));
  const out: AiUntrustedText[] = [];
  for (const e of session.events.filter((x) => x.type === "note_added").slice(-MAX_NOTES)) {
    out.push({ source: "operator_note", atSec: at(e.occurredAtMs), text: sanitizeUntrusted(String(e.data.text ?? ""), NOTE_CHARS) });
  }
  for (const e of session.events.filter((x) => x.type === "correction_added").slice(-3)) {
    out.push({ source: "correction", atSec: at(e.occurredAtMs), text: sanitizeUntrusted(String(e.data.text ?? ""), NOTE_CHARS) });
  }
  for (const seg of plan.segments) {
    const run = session.runtime.segments[seg.id];
    if (run?.followUp) out.push({ source: "follow_up", atSec: null, text: `${title(seg.title)}: ${sanitizeUntrusted(run.followUp, NOTE_CHARS)}` });
  }
  for (const cue of plan.cues) {
    const run = session.runtime.cues[cue.id];
    if (run?.reason) out.push({ source: "cue_reason", atSec: null, text: `${title(cue.title)}: ${sanitizeUntrusted(run.reason, NOTE_CHARS)}` });
  }
  for (const a of Object.values(session.runtime.actions ?? {})) {
    out.push({ source: "action_label", atSec: null, text: `${a.action} ${sanitizeUntrusted(a.targetLabel, TITLE_CHARS)}${a.reason ? `: ${sanitizeUntrusted(a.reason, NOTE_CHARS)}` : ""}` });
  }
  return out.filter((n) => n.text !== "").slice(0, 16);
}

// ---- Prior shows -----------------------------------------------------------------------------------------------------

/**
 * Compact summaries of up to `limit` earlier ENDED shows of the SAME environment as `current`. REAL and SIMULATED
 * never mix: a rehearsal is never learning for a real show, and the reverse.
 */
export function summarizePriorSessions(current: Session, all: Session[], limit = 3): AiPriorSession[] {
  const before = current.runtime.startedAtMs ?? current.createdAtMs;
  return all
    .filter((s) => s.id !== current.id && s.environment === current.environment && s.lifecycle === "ended" && (s.runtime.endedAtMs ?? Infinity) <= before)
    .sort((a, b) => (b.runtime.endedAtMs ?? 0) - (a.runtime.endedAtMs ?? 0))
    .slice(0, limit)
    .flatMap((s) => {
      const review = buildReview(s);
      if (!review) return [];
      return [
        {
          title: title(s.title),
          finishVarianceSec: review.summary.finishVarianceSec,
          overran: review.rows
            .filter((r) => r.overran && r.durationVarianceSec !== null)
            .sort((a, b) => (b.durationVarianceSec ?? 0) - (a.durationVarianceSec ?? 0))
            .slice(0, 5)
            .map((r) => ({ title: title(r.title), kind: r.kind, varianceSec: r.durationVarianceSec as number })),
          closedEarly: review.summary.counts.closedEarly,
          skipped: review.summary.counts.skipped,
          operatorCuesNoReport: review.summary.cues.noReport,
        },
      ];
    });
}

// ---- Operate ---------------------------------------------------------------------------------------------------------

const RECOVERY_TEXT: Record<string, string> = {
  recoverable: "Recovery status: a clean option, or a combination of clean options, protects the committed anchor without any exception.",
  no_feasible_recovery: "Recovery status: no clean option protects the committed anchor; only exceptions or commitment changes remain.",
  possible_risk: "Recovery status: the active segment has no known end, so the buffer before the next anchor may be consumed.",
  already_missed: "Recovery status: the committed time has passed without a start; the options only limit further delay.",
};

/**
 * Observed facts for the operating desk. Deterministic product logic: it is shown to the operator whether or not a
 * model is configured, and it is the only thing a model's citations may point at.
 */
export function buildOperateFacts(session: Session, nowMs: number, forecast: Forecast, analysis: RecoveryAnalysis, priors: AiPriorSession[] = []): AiFact[] {
  const f = new Facts();
  const tz = session.timezone;
  const plan = currentPlan(session);
  const base = baselinePlan(session);
  const baseTarget = new Map(base.segments.map((s) => [s.id, s.targetSec]));

  f.add(
    "environment",
    session.environment === "SIMULATED" ? "simulated" : "recorded",
    session.environment === "SIMULATED"
      ? "This is a SIMULATED rehearsal. Every record is simulated and nothing was broadcast."
      : "This is a REAL show. LiveLift holds what the operator reported; it has no platform confirmation of any of it."
  );

  const active = activeSegment(session);
  const activeRun = active ? session.runtime.segments[active.id] : undefined;
  if (active && activeRun?.startedAtMs != null) {
    const elapsed = toSec(nowMs - activeRun.startedAtMs);
    const name = title(active.title);
    if (active.targetSec === null) {
      f.add("active_no_target", "gap", `${name} is running (${formatDuration(elapsed)} so far) and has no target duration entered.`, { elapsedSec: elapsed });
    } else if (elapsed > active.targetSec) {
      f.add(
        "active_over",
        "computed",
        `${name} has run ${formatDuration(elapsed)} against a ${formatDuration(active.targetSec)} target: ${formatHuman(elapsed - active.targetSec)} over.`,
        { elapsedSec: elapsed, targetSec: active.targetSec, overSec: elapsed - active.targetSec }
      );
    } else {
      f.add("active_progress", "computed", `${name} has run ${formatDuration(elapsed)} of a ${formatDuration(active.targetSec)} target.`, { elapsedSec: elapsed, targetSec: active.targetSec });
    }
    if (forecast.active?.basis === "estimate") {
      f.add("active_estimate", "operator_reported", `The host estimated that ${name} ends at ${formatClock(forecast.active.endMs, tz, true)}.`);
    } else if (forecast.active?.basis === "declared_unknown") {
      f.add("active_unknown", "operator_reported", `The host declared the remaining time of ${name} unknown. LiveLift does not invent an end time.`);
    } else if (forecast.active?.basis === "unknown_overrun") {
      f.add("active_unknown", "computed", `${name} is past its target with no valid estimate, so its end is unknown (the earliest it can end is now).`);
    }
  }

  if (forecast.finishDriftSec !== null && forecast.finishDriftSec !== 0) {
    f.add(
      "finish_drift",
      "computed",
      `The projected finish is ${formatHuman(Math.abs(forecast.finishDriftSec))} ${forecast.finishDriftSec > 0 ? "later" : "earlier"} than the baseline plan${forecast.finishLowerBound ? " (a lower bound: the active end is unknown)" : ""}.`,
      { finishDriftSec: forecast.finishDriftSec }
    );
  }
  const next = forecast.segments.find((s) => s.state === "pending");
  if (next && next.driftSec !== null && Math.abs(next.driftSec) >= VARIANCE_TOLERANCE_SEC) {
    const seg = plan.segments.find((s) => s.id === next.segmentId);
    f.add("next_drift", "computed", `${title(seg?.title)} is projected to start ${formatHuman(Math.abs(next.driftSec))} ${next.driftSec > 0 ? "later" : "earlier"} than the baseline plan.`, { nextDriftSec: next.driftSec });
  }

  if (analysis.situation.tone !== "ok" || analysis.situation.detail) {
    f.add("situation", "computed", `${analysis.situation.headline}. ${analysis.situation.detail}`.trim());
  }
  if (RECOVERY_TEXT[analysis.status]) {
    f.add("recovery_status", "computed", RECOVERY_TEXT[analysis.status], { deficitSec: analysis.deficitSec, maxCleanSavingsSec: analysis.maxCleanSavingsSec });
  }

  let cueFacts = 0;
  for (const cf of forecast.cues) {
    if (cueFacts >= 3 || cf.state !== "pending" || cf.dueInSec === null) continue;
    const cue = plan.cues.find((c) => c.id === cf.cueId);
    if (!cue || cue.audience !== "operator") continue;
    if (cf.dueInSec <= 0) {
      f.add("cue_overdue", "gap", `Cue "${title(cue.title)}" was due ${formatHuman(-cf.dueInSec)} ago and has no operator report yet (unknown, not missed).`, { overdueBySec: -cf.dueInSec });
      cueFacts++;
    } else if (cf.dueInSec <= 120) {
      f.add("cue_upcoming", "computed", `Cue "${title(cue.title)}" is due in ${formatHuman(cf.dueInSec)}.`, { dueInSec: cf.dueInSec });
      cueFacts++;
    }
  }

  const completed = plan.segments.filter((s) => session.runtime.segments[s.id]?.state === "completed").slice(-4);
  for (const seg of completed) {
    const run = session.runtime.segments[seg.id];
    if (run.startedAtMs === null || run.endedAtMs === null) continue;
    const dur = toSec(run.endedAtMs - run.startedAtMs);
    const target = baseTarget.get(seg.id) ?? null;
    if (target === null) f.add("completed", "gap", `${title(seg.title)} ran ${formatDuration(dur)}; no baseline target was entered to compare it with.`, { durationSec: dur });
    else f.add("completed", "recorded", `${title(seg.title)} ran ${formatDuration(dur)} against a ${formatDuration(target)} baseline target (${formatSigned(dur - target)}).`, { durationSec: dur, baselineTargetSec: target, varianceSec: dur - target });
  }
  const skipped = plan.segments.filter((s) => session.runtime.segments[s.id]?.state === "skipped");
  if (skipped.length > 0) {
    f.add("skipped", "recorded", `Skipped so far: ${skipped.slice(0, 4).map((s) => title(s.title)).join(", ")}${skipped.length > 4 ? ` and ${skipped.length - 4} more` : ""}.`, { skippedCount: skipped.length });
  }

  for (const prior of priors.filter((p) => p.overran.length > 0).slice(0, 2)) {
    const worst = prior.overran[0];
    f.add("prior_show", "recorded", `In the earlier ${session.environment} show "${prior.title}", ${worst.title} ran ${formatHuman(worst.varianceSec)} over its target.`, { priorOverSec: worst.varianceSec });
  }
  return f.items;
}

export interface OperateBuild {
  context: OperateAiContext;
  /** Alias -> the product's own recovery option. The model only ever names an alias. */
  optionByAlias: Map<string, RecoveryOption>;
  forecast: Forecast;
  analysis: RecoveryAnalysis;
}

export function buildOperateContext(
  session: Session,
  nowMs: number,
  opts: { priors?: AiPriorSession[]; forecast?: Forecast; analysis?: RecoveryAnalysis } = {}
): OperateBuild {
  const forecast = opts.forecast ?? forecastSession(session, nowMs);
  const analysis = opts.analysis ?? analyzeRecovery(session, nowMs);
  const priors = opts.priors ?? [];
  const optionByAlias = new Map<string, RecoveryOption>();
  const options: AiCandidateOption[] = analysis.options.slice(0, 6).map((o, i) => {
    const alias = `opt${i + 1}`;
    optionByAlias.set(alias, o);
    return {
      opt: alias,
      kind: o.kind,
      label: sanitizeUntrusted(o.label, 160),
      detail: sanitizeUntrusted(o.detail, 320),
      clean: o.clean,
      protects: o.protects,
      savesSec: o.savesSec,
      resultingDeficitSec: o.resultingDeficitSec,
      exception: o.exception?.code ?? null,
    };
  });
  const startedAt = session.runtime.startedAtMs;
  const context: OperateAiContext = {
    contract: "livelift.ai.operate.v1",
    environment: session.environment,
    show: { title: title(session.title), elapsedSec: startedAt === null ? 0 : Math.max(0, toSec(nowMs - startedAt)) },
    facts: buildOperateFacts(session, nowMs, forecast, analysis, priors),
    segments: segmentEvidence(session),
    cues: cueEvidence(session, forecast),
    options,
    untrustedText: notesOf(session),
    priorSessions: priors,
    platform: PLATFORM_EVIDENCE,
  };
  return { context, optionByAlias, forecast, analysis };
}

// ---- Review ----------------------------------------------------------------------------------------------------------

const normTitle = (t: string): string => t.toLowerCase().replace(/\s+/g, " ").trim();

export function buildReviewFacts(session: Session, review: Review, priors: AiPriorSession[] = []): AiFact[] {
  const f = new Facts();
  const s = review.summary;
  const plan = currentPlan(session);
  const productById = new Map(session.products.map((p) => [p.id, p]));

  f.add(
    "environment",
    session.environment === "SIMULATED" ? "simulated" : "recorded",
    session.environment === "SIMULATED"
      ? "This show is a SIMULATED rehearsal. Every record is simulated; it is never counted as real learning."
      : "This show is REAL. Records are what the operator reported to LiveLift."
  );
  f.add("tracked", "recorded", `The show was tracked for ${formatDuration(s.trackedSec)}.`, { trackedSec: s.trackedSec });
  if (s.finishVarianceSec !== null) {
    f.add(
      "finish",
      "computed",
      s.finishVarianceSec === 0
        ? "The last recorded segment ended at the baseline finish."
        : `The last recorded segment ended ${formatHuman(Math.abs(s.finishVarianceSec))} ${s.finishVarianceSec > 0 ? "after" : "before"} the baseline finish.`,
      { finishVarianceSec: s.finishVarianceSec }
    );
  } else {
    f.add("finish", "gap", "No finish variance can be computed: a baseline finish or an actual finish is missing.");
  }

  const c = s.counts;
  f.add(
    "outcomes",
    "recorded",
    `Segments: ${c.completed} completed, ${c.closedEarly} closed early, ${c.skipped} skipped, ${c.notReached} not reached, ${c.incomplete} incomplete.`,
    { completed: c.completed, closedEarly: c.closedEarly, skipped: c.skipped, notReached: c.notReached, incomplete: c.incomplete }
  );
  if (c.incomplete > 0) {
    f.add("incomplete", "gap", `${plural(c.incomplete, "segment")} ${c.incomplete === 1 ? "has" : "have"} a recorded start without an end (or the reverse). Their interval is unknown; it is not "did not run".`, { incomplete: c.incomplete });
  }

  const overran = review.rows.filter((r) => r.overran && r.actual && r.baselineTargetSec !== null).sort((a, b) => (b.durationVarianceSec ?? 0) - (a.durationVarianceSec ?? 0)).slice(0, 5);
  for (const r of overran) {
    f.add("overran", "computed", `${title(r.title)} ran ${formatDuration(r.actual!.durSec)} against a ${formatDuration(r.baselineTargetSec!)} baseline target (${formatSigned(r.durationVarianceSec!)}).`, {
      durationSec: r.actual!.durSec, baselineTargetSec: r.baselineTargetSec!, varianceSec: r.durationVarianceSec!,
    });
  }
  const under = review.rows.filter((r) => r.underran && r.actual && r.baselineTargetSec !== null).sort((a, b) => (a.durationVarianceSec ?? 0) - (b.durationVarianceSec ?? 0)).slice(0, 2);
  for (const r of under) {
    f.add("underran", "computed", `${title(r.title)} ran ${formatDuration(r.actual!.durSec)} against a ${formatDuration(r.baselineTargetSec!)} baseline target (${formatSigned(r.durationVarianceSec!)}).`, {
      durationSec: r.actual!.durSec, baselineTargetSec: r.baselineTargetSec!, varianceSec: r.durationVarianceSec!,
    });
  }
  const skipped = review.rows.filter((r) => r.outcome === "skipped" || r.outcome === "not_reached");
  if (skipped.length > 0) f.add("not_run", "recorded", `Did not run: ${skipped.slice(0, 5).map((r) => `${title(r.title)} (${r.outcome === "skipped" ? "skipped" : "not reached"})`).join(", ")}.`, { notRunCount: skipped.length });

  if (s.anchors.total > 0) {
    f.add("anchors", "computed", `Hard anchors: ${s.anchors.late} late, ${s.anchors.onTime} on time, ${s.anchors.cancelled} cancelled, ${s.anchors.notReached} not reached${s.anchors.reAnchored > 0 ? `; ${s.anchors.reAnchored} explicitly re-anchored` : ""}.`, {
      anchorsLate: s.anchors.late, anchorsOnTime: s.anchors.onTime, anchorsCancelled: s.anchors.cancelled, anchorsNotReached: s.anchors.notReached,
    });
    for (const r of review.rows.filter((x) => x.anchor?.status === "late").slice(0, 3)) {
      f.add("anchor_late", "computed", `${title(r.title)} started ${formatHuman(r.anchor!.lateBySec ?? 0)} after its hard anchor.`, { lateBySec: r.anchor!.lateBySec ?? 0 });
    }
  }

  const operatorCues = review.cues.filter((q) => q.audience === "operator");
  const noReport = operatorCues.filter((q) => q.state === "no_report");
  f.add("cues", "operator_reported", `Operator cues: ${s.cues.performed} reported performed, ${s.cues.attempted} reported attempted, ${s.cues.cancelled} cancelled, ${s.cues.noReport} with no report.`, {
    cuesPerformed: s.cues.performed, cuesAttempted: s.cues.attempted, cuesCancelled: s.cues.cancelled, cuesNoReport: s.cues.noReport,
  });
  if (noReport.length > 0) {
    f.add("cue_gap", "gap", `No report was recorded for: ${noReport.slice(0, 5).map((q) => `"${title(q.title)}"`).join(", ")}${noReport.length > 5 ? ` and ${noReport.length - 5} more` : ""}. That is unknown, not failed.`, { noReportCount: noReport.length });
  }
  const attempted = operatorCues.filter((q) => q.state === "attempted");
  if (attempted.length > 0) {
    f.add("cue_unresolved", "operator_reported", `Reported as attempted and never resolved: ${attempted.slice(0, 5).map((q) => `"${title(q.title)}"`).join(", ")}. An attempt is not a performed action.`, { attemptedCount: attempted.length });
  }
  for (const q of operatorCues.filter((x) => x.lateBySec !== null && x.lateBySec >= VARIANCE_TOLERANCE_SEC).slice(0, 3)) {
    f.add("cue_late", "operator_reported", `Cue "${title(q.title)}" was reported ${formatHuman(q.lateBySec!)} after its due time.`, { lateBySec: q.lateBySec! });
  }

  if (c.coverageNotDeclared > 0) {
    f.add("coverage_gap", "gap", `Coverage was not declared for ${plural(c.coverageNotDeclared, "segment")} that ran. That is unknown: not complete, and not failed.`, { coverageNotDeclared: c.coverageNotDeclared });
  }
  if (c.coveragePartial > 0) f.add("coverage_partial", "operator_reported", `${plural(c.coveragePartial, "segment")} declared partial coverage by the operator.`, { coveragePartial: c.coveragePartial });
  if (s.actions.total > 0) {
    f.add("actions", "operator_reported", `${plural(s.actions.total, "unplanned action")} reported: ${s.actions.performed} performed, ${s.actions.attempted} attempted, ${s.actions.cancelled} cancelled.`, { actionsTotal: s.actions.total });
  }

  // Product outcomes. LiveLift holds the operator's reports and nothing from the platform.
  const byProduct = new Map<string, string[]>();
  for (const cue of plan.cues) {
    if (!cue.productId || cue.audience !== "operator" || cue.action === "none") continue;
    const q = review.cues.find((x) => x.cueId === cue.id);
    const what = cue.action === "pin_product" ? "pin" : cue.action === "unpin_product" ? "unpin" : "promotion";
    const state = !q || q.state === "no_report" ? "no operator report" : q.state === "performed" ? "operator reported performed" : q.state === "attempted" ? "operator reported attempted" : "cancelled";
    byProduct.set(cue.productId, [...(byProduct.get(cue.productId) ?? []), `${what} cue: ${state}`]);
  }
  for (const [productId, entries] of [...byProduct.entries()].slice(0, 6)) {
    const p = productById.get(productId);
    const code = sanitizeUntrusted(p?.code, 24) || "product";
    f.add("product_platform", "gap", `Product ${code}: ${entries.join("; ")}. The platform outcome is not established: LiveLift has no platform confirmation for it.`);
  }

  f.add("platform_limits", "gap", "LiveLift holds no platform confirmation, viewer, sales or analytics data from TikTok for this show. Cue and action reports are operator statements, and observation is not causation.");
  if (s.planRevisions > 0) f.add("plan_revisions", "recorded", `${plural(s.planRevisions, "plan revision")} ${s.planRevisions === 1 ? "was" : "were"} recorded during the show; the baseline is unchanged.`, { planRevisions: s.planRevisions });

  // Recurrence is only claimed from recorded, same-environment shows.
  if (priors.length > 0) {
    const seen = new Map<string, { name: string; count: number }>();
    for (const r of overran) {
      const key = normTitle(r.title);
      const n = priors.filter((p) => p.overran.some((o) => normTitle(o.title) === key)).length;
      if (n > 0) seen.set(key, { name: title(r.title), count: n });
    }
    for (const { name, count } of [...seen.values()].slice(0, 3)) {
      f.add("recurring_overrun", "computed", `${name} ran over its target in this show and in ${count} of ${priors.length} earlier ${session.environment} shows. This describes the schedule only; it does not explain why.`, { earlierShowsWithOverrun: count, earlierShowsReviewed: priors.length });
    }
  }
  return f.items;
}

export interface ReviewBuild {
  context: ReviewAiContext;
  /** Alias -> the Next LIVE adjustment LiveLift already proposes. The model only ever names an alias. */
  changeByAlias: Map<string, ProposedChange>;
  review: Review;
}

export function buildReviewContext(session: Session, opts: { priors?: AiPriorSession[]; laterEvidence?: LiveIntelligenceSnapshot | null } = {}): ReviewBuild | null {
  const review = buildReview(session);
  if (!review) return null;
  const priors = opts.priors ?? [];
  const changeByAlias = new Map<string, ProposedChange>();
  const changes: AiCandidateChange[] = proposeChanges(session).slice(0, 8).map((p, i) => {
    const alias = `chg${i + 1}`;
    changeByAlias.set(alias, p);
    return { chg: alias, basis: p.basis, title: sanitizeUntrusted(p.title, 160), detail: sanitizeUntrusted(p.detail, 320) };
  });
  const forecast = forecastSession(session, review.summary.endedAtMs);
  const context: ReviewAiContext = {
    contract: "livelift.ai.review.v1",
    environment: session.environment,
    show: { title: title(session.title), trackedSec: review.summary.trackedSec },
    facts: buildReviewFacts(session, review, priors),
    segments: segmentEvidence(session),
    cues: cueEvidence(session, forecast),
    changes,
    untrustedText: [...notesOf(session), ...review.revisions.filter((r) => r.reason).slice(0, 3).map((r): AiUntrustedText => ({ source: "plan_revision", atSec: null, text: sanitizeUntrusted(r.reason, NOTE_CHARS) }))],
    priorSessions: priors,
    platform: PLATFORM_EVIDENCE,
  };
  const later = opts.laterEvidence;
  if (later && later.sessionId === session.id && later.mode === session.environment && later.sessionRevision === session.revision && (later.mode !== "REAL" || later.provider === "tiktok_shop")) {
    context.facts = context.facts.filter((f) => f.topic !== "platform_limits").slice(0, 36);
    context.facts.push(...laterEvidenceFacts(later, Math.max(0, ...context.facts.map((f) => Number(f.id.slice(1)))) + 1));
    context.laterEvidence = { snapshotId: later.snapshotId, fetchedAt: later.fetchedAt, perspective: "later_evidence", source: later.provider, evidenceTier: "provider_observed" };
  }
  return { context, changeByAlias, review };
}
