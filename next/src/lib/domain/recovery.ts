import type { Segment, Session } from "@/contracts";
import { applyCommand, effectiveNowMs, type Command, type CommandBody } from "./engine";
import { currentPlan, forecastSession, formatAnchorLate, isAnchorDueNow, type Forecast, type SegmentForecast } from "./forecast";
import { effectiveMinSec, isCompressible } from "./plan";
import { formatClock, formatDuration, formatHuman } from "./time";

/**
 * Recovery analysis: transparent candidates, each previewed against the forecast.
 *
 * Rules (from the P0 policy):
 * - Hard anchors never move implicitly. Re-anchoring is an explicit commitment change.
 * - "Clean" options respect declared minimums and required coverage. Anything that needs a
 *   minimum or coverage exception is labelled as an exception and needs acknowledgement.
 * - Feasibility is decided by an actual compatible plan, not by adding up savings: each segment
 *   contributes at most ONE lever (skipping and shortening the same segment are alternatives), and
 *   a legal future end-by commitment counts even if the active segment has not reached its minimum yet.
 * - If no clean combination can protect the deadline we say so, and keep exception and
 *   commitment-change paths visibly separate.
 * - A recommendation is not acceptance: nothing here is executed.
 */

export type RecoveryKind =
  | "end_by"
  | "close_now"
  | "shorten_pending"
  | "skip_optional"
  | "skip_required"
  | "reanchor"
  | "cancel_commitment";

export interface RecoveryException {
  code: "below_minimum" | "required_coverage" | "commitment_change";
  message: string;
}

export interface RecoveryOption {
  id: string;
  kind: RecoveryKind;
  label: string;
  detail: string;
  /** Reduction of the critical deficit if only this option is applied. */
  savesSec: number;
  resultingDeficitSec: number;
  /** Keeps the critical anchor AND does not newly break another one. */
  protects: boolean;
  /** Respects minimums and required coverage. */
  clean: boolean;
  exception: RecoveryException | null;
  /** The command that would carry it out (acknowledgements already set for exceptions). */
  command: CommandBody;
}

export type SituationTone = "ok" | "watch" | "risk" | "missed";

export interface Situation {
  tone: SituationTone;
  headline: string;
  detail: string;
}

/**
 * recoverable          — a clean, compatible plan protects the anchor (one option or a combination)
 * no_feasible_recovery — no clean plan protects it; only exceptions or commitment changes remain
 * possible_risk        — the active end is unknown; the buffer may be consumed
 * already_missed       — the committed time has passed without a start
 */
export type RecoveryStatus =
  | "stable"
  | "possible_risk"
  | "recoverable"
  | "no_feasible_recovery"
  | "already_missed";

export interface RecoveryAnalysis {
  status: RecoveryStatus;
  criticalSegmentId: string | null;
  /** Current projected lateness of the critical anchor. */
  deficitSec: number;
  options: RecoveryOption[];
  /** Time the best compatible combination of clean levers frees before the critical anchor. */
  maxCleanSavingsSec: number;
  /**
   * When no single clean option protects the anchor but a combination of clean levers does, the levers
   * that together protect it (apply them one at a time; each is an explicit decision).
   */
  cleanPlan: string[];
  /** Some exception option (below minimum / required coverage) would protect it. Distinct from clean recovery. */
  exceptionProtects: boolean;
  situation: Situation;
}

const toSec = (ms: number): number => Math.round(ms / 1000);

function preview(session: Session, body: CommandBody, nowMs: number, key = "preview"): Session | null {
  const result = applyCommand(session, { ...body, nowMs, key } as Command);
  return result.receipt.outcome === "committed" ? result.session : null;
}

function brokenAnchorIds(forecast: Forecast): Set<string> {
  return new Set(
    forecast.segments
      .filter((s) => s.state === "pending" && s.anchor && (s.anchor.status === "at_risk" || s.anchor.status === "missed"))
      .map((s) => s.segmentId)
  );
}

interface Evaluation {
  resultingDeficitSec: number;
  newlyBroken: boolean;
}

function evaluateAfter(after: Session, nowMs: number, criticalId: string, alreadyBroken: Set<string>): Evaluation {
  const f = forecastSession(after, nowMs);
  const c = f.segments.find((s) => s.segmentId === criticalId);
  const resulting = c && c.state === "pending" && c.anchor ? c.anchor.deficitSec : 0;
  const newlyBroken = [...brokenAnchorIds(f)].some((id) => !alreadyBroken.has(id));
  return { resultingDeficitSec: resulting, newlyBroken };
}

function evaluate(
  session: Session,
  body: CommandBody,
  nowMs: number,
  criticalId: string,
  alreadyBroken: Set<string>
): Evaluation | null {
  const after = preview(session, body, nowMs);
  return after ? evaluateAfter(after, nowMs, criticalId, alreadyBroken) : null;
}

/** One clean lever per segment, at its largest legal size. */
interface Lever {
  label: string;
  body: CommandBody;
}

/** Apply levers in order to a copy (pure). Levers the engine refuses are left out. */
function applyLevers(session: Session, levers: Lever[], nowMs: number): Session {
  let s = session;
  levers.forEach((lever, i) => {
    const after = preview(s, lever.body, nowMs, `preview:lever:${i}`);
    if (after) s = after;
  });
  return s;
}

/**
 * The most a compatible set of clean levers can do before the critical anchor:
 * - the active segment ends at the earliest instant its declared minimum allows (now, or a future end-by);
 * - each pending segment before the anchor contributes its single largest clean lever:
 *   skip if it is optional and floating, otherwise shorten to its declared minimum.
 * Moving work earlier can never make an anchor later, so this combination bounds every clean plan.
 */
function maxCleanLevers(
  session: Session,
  forecast: Forecast,
  activeSeg: Segment | null,
  criticalIndex: number,
  nowMs: number,
  clock: (ms: number) => string
): Lever[] {
  const plan = currentPlan(session);
  const levers: Lever[] = [];
  if (activeSeg && forecast.active?.known) {
    const run = session.runtime.segments[activeSeg.id];
    const start = run?.startedAtMs ?? nowMs;
    const floor = effectiveMinSec(activeSeg);
    const floorAt = floor === null ? nowMs : Math.max(nowMs, start + floor * 1000);
    if (floorAt < forecast.active.endMs) {
      levers.push(
        floorAt <= nowMs
          ? { label: `End ${activeSeg.title} now`, body: { type: "end_segment", segmentId: activeSeg.id, coverage: "partial" } }
          : { label: `End ${activeSeg.title} by ${clock(floorAt)}`, body: { type: "commit_end_by", segmentId: activeSeg.id, endByMs: floorAt } }
      );
    }
  }
  const fcById = new Map(forecast.segments.map((s) => [s.segmentId, s]));
  for (let i = 0; i < criticalIndex; i++) {
    const seg = plan.segments[i];
    if (fcById.get(seg.id)?.state !== "pending") continue;
    if (seg.anchorOffsetSec === null && seg.optional) {
      levers.push({ label: `Skip ${seg.title} (optional)`, body: { type: "skip_segment", segmentId: seg.id } });
    } else if (isCompressible(seg)) {
      const to = Math.max(seg.minSec!, 1);
      levers.push({
        label: `Shorten ${seg.title} to ${formatDuration(to)}`,
        body: { type: "shorten_segment", segmentId: seg.id, newTargetSec: to },
      });
    }
  }
  return levers;
}

/** Plain-language situation for NOW/NEXT. Generated from numbers, never from a model. */
export function describeSituation(session: Session, forecast: Forecast): Situation {
  const tz = session.timezone;
  const plan = currentPlan(session);
  if (!forecast.running) {
    return { tone: "ok", headline: "Not running", detail: "" };
  }
  const titleOf = (id: string): string => plan.segments.find((s) => s.id === id)?.title ?? "Segment";
  const clock = (ms: number): string => formatClock(ms, tz, true);

  const critical = forecast.criticalSegmentId
    ? forecast.segments.find((s) => s.segmentId === forecast.criticalSegmentId)
    : undefined;

  if (critical?.anchor) {
    const a = critical.anchor;
    const title = titleOf(critical.segmentId);
    const active = forecast.active;
    const cause =
      active?.basis === "estimate"
        ? `${titleOf(active.segmentId)} is projected to end ${clock(active.endMs)} (host estimate)`
        : active?.basis === "target"
          ? `${titleOf(active.segmentId)} is scheduled to end ${clock(active.endMs)}`
          : active?.basis === "declared_unknown"
            ? `the host cannot say when ${titleOf(active.segmentId)} ends`
            : active
              ? `${titleOf(active.segmentId)} is past its target`
              : "earlier work runs past it";
    const lower = a.lowerBound ? "at least " : "";
    if (a.status === "missed") {
      return {
        tone: "missed",
        headline: `${title} was committed for ${clock(a.committedMs)}`,
        detail:
          isAnchorDueNow(a)
            ? `The commitment time has arrived and it has not started. The commitment is not moved; ${cause}.`
            : `It can start no earlier than ${clock(a.projectedStartMs)} — ${lower}${formatAnchorLate(a)} late. The commitment is not moved; ${cause}.`,
      };
    }
    return {
      tone: "risk",
      headline: `${title} is committed for ${clock(a.committedMs)}`,
      detail: `${cause[0].toUpperCase()}${cause.slice(1)}. It would start ${a.lowerBound ? "no earlier than " : ""}${clock(a.projectedStartMs)} — ${lower}${formatDuration(a.deficitSec)} late.`,
    };
  }

  const nextId = forecast.nextAnchorSegmentId;
  const next = nextId ? forecast.segments.find((s) => s.segmentId === nextId) : undefined;
  if (next?.anchor) {
    const a = next.anchor;
    const title = titleOf(next.segmentId);
    if (a.status === "possible_risk") {
      const activeTitle = forecast.active ? titleOf(forecast.active.segmentId) : "The current segment";
      const declared = forecast.active?.basis === "declared_unknown";
      return {
        tone: "watch",
        headline: declared ? `The host cannot say how long ${activeTitle} needs` : `${activeTitle} has no end estimate`,
        detail: `${declared ? "Remaining time is unknown" : "It is past its target"}. At most ${formatDuration(a.bufferSec)} remain before ${title} at ${clock(a.committedMs)}; every extra minute uses that buffer. Set a host estimate or commit to an end time.`,
      };
    }
    return {
      tone: "ok",
      headline: `${title} is committed for ${clock(a.committedMs)}`,
      detail:
        a.bufferSec > 0
          ? `On track — ${formatDuration(a.bufferSec)} buffer after the projected arrival ${clock(a.committedMs - a.bufferSec * 1000)}.`
          : "On track — no buffer left; any overrun will miss it.",
    };
  }

  if (forecast.finishMs !== null) {
    const drift = forecast.finishDriftSec;
    return {
      tone: "ok",
      headline: "No hard anchors ahead",
      detail: `Projected finish ${clock(forecast.finishMs)}${forecast.finishLowerBound ? " or later" : ""}${
        drift !== null && drift !== 0 ? ` (${drift > 0 ? "+" : "-"}${formatDuration(Math.abs(drift))} vs plan)` : ""
      }.`,
    };
  }
  return { tone: "ok", headline: "On track", detail: "" };
}

export function analyzeRecovery(session: Session, deviceNowMs: number): RecoveryAnalysis {
  const now = effectiveNowMs(session, deviceNowMs);
  const forecast = forecastSession(session, now);
  const plan = currentPlan(session);
  const tz = session.timezone;

  const stable = (status: RecoveryStatus = "stable"): RecoveryAnalysis => ({
    status,
    criticalSegmentId: null,
    deficitSec: 0,
    options: [],
    maxCleanSavingsSec: 0,
    cleanPlan: [],
    exceptionProtects: false,
    situation: describeSituation(session, forecast),
  });

  if (!forecast.running) return stable();

  const segById = new Map(plan.segments.map((s) => [s.id, s]));
  const fcById = new Map<string, SegmentForecast>(forecast.segments.map((s) => [s.segmentId, s]));
  const guard = forecast.anchorGuard;
  const activeSeg = forecast.active ? (segById.get(forecast.active.segmentId) ?? null) : null;
  const clock = (ms: number): string => formatClock(ms, tz, true);

  // ---- Possible risk: the active segment has no known end ----------------------------------
  const criticalFc = forecast.criticalSegmentId ? fcById.get(forecast.criticalSegmentId) : undefined;
  if (!criticalFc) {
    const nextFc = forecast.nextAnchorSegmentId ? fcById.get(forecast.nextAnchorSegmentId) : undefined;
    if (nextFc?.anchor?.status === "possible_risk" && activeSeg && guard?.latestFreeMs && guard.latestFreeMs > now) {
      const run = session.runtime.segments[activeSeg.id];
      const start = run?.startedAtMs ?? now;
      const floor = effectiveMinSec(activeSeg);
      const newTarget = toSec(guard.latestFreeMs - start);
      const belowMin = floor !== null && newTarget < floor;
      const body: CommandBody = {
        type: "commit_end_by",
        segmentId: activeSeg.id,
        endByMs: guard.latestFreeMs,
        acknowledgeBelowMinimum: belowMin ? true : undefined,
      };
      const targetTitle = segById.get(guard.segmentId)?.title ?? "the anchor";
      const options: RecoveryOption[] = [
        {
          id: `end_by:${activeSeg.id}`,
          kind: "end_by",
          label: `End ${activeSeg.title} by ${clock(guard.latestFreeMs)}`,
          detail: `Commit to a ${formatDuration(newTarget)} total so ${targetTitle} keeps its ${clock(guard.committedMs)} commitment. Declare coverage when it ends.`,
          savesSec: 0,
          resultingDeficitSec: 0,
          protects: true,
          clean: !belowMin,
          exception: belowMin
            ? { code: "below_minimum", message: `A ${formatDuration(newTarget)} total is below the ${formatDuration(floor!)} minimum.` }
            : null,
          command: body,
        },
      ];
      return {
        status: "possible_risk",
        criticalSegmentId: null,
        deficitSec: 0,
        options,
        maxCleanSavingsSec: 0,
        cleanPlan: [],
        exceptionProtects: belowMin,
        situation: describeSituation(session, forecast),
      };
    }
    return stable();
  }

  // ---- Definite risk or missed -----------------------------------------------------------
  const critical = segById.get(criticalFc.segmentId) as Segment;
  const anchor = criticalFc.anchor!;
  const deficit = anchor.deficitSec;
  const alreadyBroken = brokenAnchorIds(forecast);
  const criticalIndex = plan.segments.findIndex((s) => s.id === critical.id);
  const options: RecoveryOption[] = [];
  const missed = anchor.status === "missed";

  const add = (opt: Omit<RecoveryOption, "savesSec" | "resultingDeficitSec" | "protects">, ev: Evaluation | null): void => {
    if (!ev) return;
    const saves = Math.max(0, deficit - ev.resultingDeficitSec);
    options.push({
      ...opt,
      savesSec: saves,
      resultingDeficitSec: ev.resultingDeficitSec,
      protects: !missed && ev.resultingDeficitSec === 0 && !ev.newlyBroken,
    });
  };

  // Active segment levers.
  if (activeSeg && forecast.active) {
    const run = session.runtime.segments[activeSeg.id];
    const start = run?.startedAtMs ?? now;
    const elapsed = toSec(now - start);
    const floor = effectiveMinSec(activeSeg);
    const belowMinBySec = floor !== null && elapsed < floor ? floor - elapsed : 0;
    const beforeTarget = activeSeg.targetSec !== null && elapsed < activeSeg.targetSec;

    // Close now. Ending before the allocation is recorded as partial coverage — stated in the option, not inferred later.
    const closeBody: CommandBody = {
      type: "end_segment",
      segmentId: activeSeg.id,
      coverage: beforeTarget ? "partial" : undefined,
      acknowledgeBelowMinimum: belowMinBySec > 0 ? true : undefined,
    };
    add(
      {
        id: `close_now:${activeSeg.id}`,
        kind: "close_now",
        label: `End ${activeSeg.title} now`,
        detail:
          belowMinBySec > 0
            ? `Below its ${formatDuration(floor!)} minimum by ${formatDuration(belowMinBySec)} · coverage recorded as partial. Needs a minimum exception.`
            : `Frees the host at ${clock(now)}.${beforeTarget ? " Coverage is recorded as partial." : ""}`,
        clean: belowMinBySec === 0,
        exception:
          belowMinBySec > 0
            ? { code: "below_minimum", message: `${activeSeg.title} would end ${formatDuration(belowMinBySec)} below its minimum.` }
            : null,
        command: closeBody,
      },
      evaluate(session, closeBody, now, critical.id, alreadyBroken)
    );

    // End by the latest instant that still protects the first pending anchor (a legal future commitment).
    if (guard && guard.segmentId === critical.id && guard.latestFreeMs !== null && guard.latestFreeMs > now) {
      const newTarget = toSec(guard.latestFreeMs - start);
      const belowMin = floor !== null && newTarget < floor;
      const endBody: CommandBody = {
        type: "commit_end_by",
        segmentId: activeSeg.id,
        endByMs: guard.latestFreeMs,
        acknowledgeBelowMinimum: belowMin ? true : undefined,
      };
      add(
        {
          id: `end_by:${activeSeg.id}`,
          kind: "end_by",
          label: `End ${activeSeg.title} by ${clock(guard.latestFreeMs)}`,
          detail: `Commit to ${formatDuration(newTarget)} total${
            activeSeg.targetSec !== null ? ` (was ${formatDuration(activeSeg.targetSec)})` : ""
          } · keeps ${critical.title} at ${clock(anchor.committedMs)}. Declare coverage when it ends.`,
          clean: !belowMin,
          exception: belowMin
            ? { code: "below_minimum", message: `A ${formatDuration(newTarget)} total is below the ${formatDuration(floor!)} minimum.` }
            : null,
          command: endBody,
        },
        evaluate(session, endBody, now, critical.id, alreadyBroken)
      );
    }
  }

  // Pending levers before the critical anchor.
  for (let i = 0; i < criticalIndex; i++) {
    const seg = plan.segments[i];
    const sf = fcById.get(seg.id);
    if (!sf || sf.state !== "pending") continue;

    if (isCompressible(seg)) {
      const maxSave = seg.targetSec! - Math.max(seg.minSec!, 1);
      const delta = Math.min(maxSave, Math.max(60, Math.ceil(deficit / 30) * 30));
      const newTarget = seg.targetSec! - delta;
      const body: CommandBody = { type: "shorten_segment", segmentId: seg.id, newTargetSec: newTarget };
      add(
        {
          id: `shorten:${seg.id}`,
          kind: "shorten_pending",
          label: `Shorten ${seg.title} by ${formatHuman(delta)}`,
          detail: `${formatDuration(seg.targetSec!)} → ${formatDuration(newTarget)} (minimum ${formatDuration(seg.minSec!)}) · frees ${formatHuman(delta)}.`,
          clean: true,
          exception: null,
          command: body,
        },
        evaluate(session, body, now, critical.id, alreadyBroken)
      );
    }

    if (seg.anchorOffsetSec === null) {
      if (seg.optional) {
        const body: CommandBody = { type: "skip_segment", segmentId: seg.id };
        add(
          {
            id: `skip:${seg.id}`,
            kind: "skip_optional",
            label: `Skip ${seg.title} (optional)`,
            detail: `Frees ${formatHuman(seg.targetSec ?? 0)} · no required coverage is lost.`,
            clean: true,
            exception: null,
            command: body,
          },
          evaluate(session, body, now, critical.id, alreadyBroken)
        );
      } else {
        const body: CommandBody = { type: "skip_segment", segmentId: seg.id, acknowledgeCoverageLoss: true };
        add(
          {
            id: `skip_required:${seg.id}`,
            kind: "skip_required",
            label: `Skip ${seg.title} (required)`,
            detail: `Frees ${formatHuman(seg.targetSec ?? 0)} but loses required coverage. Needs acknowledgement.`,
            clean: false,
            exception: { code: "required_coverage", message: `${seg.title} is required coverage.` },
            command: body,
          },
          evaluate(session, body, now, critical.id, alreadyBroken)
        );
      }
    }
  }

  // Commitment changes — always explicit, never recommended automatically.
  const plannedStart = plan.plannedStartMs;
  const newOffset = Math.max(0, Math.ceil((anchor.projectedStartMs - plannedStart) / 1000));
  const reanchorBody: CommandBody = {
    type: "reanchor_segment",
    segmentId: critical.id,
    anchorOffsetSec: newOffset,
    reason: `Moved to projected start after overrun`,
  };
  add(
    {
      id: `reanchor:${critical.id}`,
      kind: "reanchor",
      label: `Re-anchor ${critical.title} to ${clock(anchor.projectedStartMs)}`,
      detail: `Changes the commitment from ${clock(anchor.committedMs)}. The original time stays in the baseline and in Review.`,
      clean: false,
      exception: { code: "commitment_change", message: "This changes a commitment; it does not recover it." },
      command: reanchorBody,
    },
    evaluate(session, reanchorBody, now, critical.id, alreadyBroken)
  );
  const cancelBody: CommandBody = { type: "skip_segment", segmentId: critical.id, acknowledgeCoverageLoss: true };
  add(
    {
      id: `cancel:${critical.id}`,
      kind: "cancel_commitment",
      label: `Cancel ${critical.title}`,
      detail: "Drops this commitment (acknowledged). It is recorded as skipped, never as performed.",
      clean: false,
      exception: { code: "commitment_change", message: "This cancels a commitment." },
      command: cancelBody,
    },
    evaluate(session, cancelBody, now, critical.id, alreadyBroken)
  );

  // Order: clean + protecting, clean partial, exceptions, commitment changes.
  const rank = (o: RecoveryOption): number => {
    if (o.kind === "reanchor") return 90;
    if (o.kind === "cancel_commitment") return 91;
    if (!o.clean) return 50 + (o.protects ? 0 : 1);
    if (o.protects) return o.kind === "end_by" ? 0 : o.kind === "shorten_pending" ? 1 : o.kind === "skip_optional" ? 2 : 3;
    return 20;
  };
  const useful = options.filter((o) => o.savesSec > 0 || o.kind === "reanchor" || o.kind === "cancel_commitment");
  useful.sort((a, b) => rank(a) - rank(b) || b.savesSec - a.savesSec);

  // ---- Feasibility from the best compatible clean plan --------------------------------------
  const levers = missed ? [] : maxCleanLevers(session, forecast, activeSeg, criticalIndex, now, clock);
  const best = evaluateAfter(applyLevers(session, levers, now), now, critical.id, alreadyBroken);
  const cleanFeasible = !missed && levers.length > 0 && best.resultingDeficitSec === 0 && !best.newlyBroken;
  const maxCleanSavingsSec = missed ? 0 : Math.max(0, deficit - best.resultingDeficitSec);

  // If no single clean option protects the anchor but the combination does, name a minimal combination.
  let cleanPlan: string[] = [];
  if (cleanFeasible && !useful.some((o) => o.clean && o.protects)) {
    let kept = [...levers];
    // Prefer keeping the active-segment lever; drop the others while the combination still protects.
    for (let i = kept.length - 1; i >= 0; i--) {
      const without = kept.filter((_, j) => j !== i);
      if (without.length === 0) continue;
      const ev = evaluateAfter(applyLevers(session, without, now), now, critical.id, alreadyBroken);
      if (ev.resultingDeficitSec === 0 && !ev.newlyBroken) kept = without;
    }
    cleanPlan = kept.map((l) => l.label);
  }

  const status: RecoveryStatus = missed ? "already_missed" : cleanFeasible ? "recoverable" : "no_feasible_recovery";

  return {
    status,
    criticalSegmentId: critical.id,
    deficitSec: deficit,
    options: useful,
    maxCleanSavingsSec,
    cleanPlan,
    exceptionProtects: useful.some((o) => o.exception !== null && o.exception.code !== "commitment_change" && o.protects),
    situation: describeSituation(session, forecast),
  };
}
