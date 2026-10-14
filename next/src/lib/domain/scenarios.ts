import type { Cue, Receipt, Segment, Session } from "@/contracts";
import { snapshotProducts } from "@/fixtures/library";
import { applyCommand, createSession, type CommandBody } from "./engine";
import { baselinePlan } from "./forecast";
import { newSegment } from "./plan";
import { DEFAULT_TIMEZONE } from "./time";

/**
 * Deterministic rehearsal scenarios.
 *
 * Same scenario + same actions = same outcomes. Everything derives from a fixed epoch and the
 * session's virtual clock; there is no system clock and no randomness. Scripted steps use
 * deterministic idempotency keys, so applying one twice cannot double-apply it.
 */

/** 2026-10-03 20:00 in Asia/Ho_Chi_Minh (UTC+7). */
export const SCENARIO_START_MS = Date.UTC(2026, 9, 3, 13, 0, 0);

export type ScenarioId = "buffered" | "missed" | "minimum";

interface ScriptCtx {
  sid: (name: string) => string;
  cue: (name: string) => string;
  /** Absolute instant for an offset in seconds from the planned start. */
  at: (sec: number) => number;
}

export interface ScriptStep {
  id: string;
  label: string;
  /** Virtual time of the step, seconds after the planned start. */
  atSec: number;
  /** When the step carries out a shown recovery option, the decision is recorded under this label. */
  recoveryLabel?: string;
  build: (ctx: ScriptCtx) => CommandBody;
}

export interface Scenario {
  id: ScenarioId;
  sessionId: string;
  title: string;
  summary: string;
  /** What a reviewer should see happen. */
  watchFor: string[];
  productIds: string[];
  buildPlan: (sessionId: string) => { segments: Segment[]; cues: Cue[] };
  script: ScriptStep[];
}

const min = (m: number, s = 0): number => m * 60 + s;

function segmentsAndCues(
  sessionId: string,
  durations: { open: [number, number]; a: [number, number]; flash: [number, number]; b: [number, number]; qa?: [number, number]; close: [number, number] },
  opts: { flashAnchorMin: number; closeAnchorMin: number | null; flashCueAtClock: boolean }
): { segments: Segment[]; cues: Cue[] } {
  const id = (name: string): string => `${sessionId}:${name}`;
  const segments: Segment[] = [
    newSegment(id("open"), {
      title: "Opening",
      kind: "opening",
      targetSec: durations.open[0],
      minSec: durations.open[1],
      cue: "Welcome + shop overview",
    }),
    newSegment(id("a"), {
      title: "Zip Hoodie",
      kind: "product",
      productId: "prod_m02",
      targetSec: durations.a[0],
      minSec: durations.a[1],
      cue: "Show zip + fit comparison",
    }),
    newSegment(id("flash"), {
      title: "Flash Sale announcement",
      kind: "promotion",
      targetSec: durations.flash[0],
      minSec: durations.flash[1],
      anchorOffsetSec: min(opts.flashAnchorMin),
      cue: "Announce code LIFT10",
    }),
    newSegment(id("b"), {
      title: "Cargo Pants",
      kind: "product",
      productId: "prod_m03",
      targetSec: durations.b[0],
      minSec: durations.b[1],
      cue: "Pocket detail + sizing",
    }),
  ];
  if (durations.qa) {
    segments.push(
      newSegment(id("qa"), {
        title: "Q&A",
        kind: "qa",
        optional: true,
        targetSec: durations.qa[0],
        minSec: durations.qa[1],
        cue: "Sizing questions",
      })
    );
  }
  segments.push(
    newSegment(id("close"), {
      title: "Closing",
      kind: "closing",
      targetSec: durations.close[0],
      minSec: durations.close[1],
      anchorOffsetSec: opts.closeAnchorMin === null ? null : min(opts.closeAnchorMin),
      cue: "Recap + next broadcast",
    })
  );

  const cues: Cue[] = [
    {
      id: id("cue-flash"),
      title: "Activate Flash Sale in TikTok",
      audience: "operator",
      action: "start_promotion",
      productId: null,
      timing: opts.flashCueAtClock
        ? { type: "at_offset", offsetSec: min(opts.flashAnchorMin) }
        : { type: "segment_start", segmentId: id("flash"), offsetSec: 0 },
      text: "Code LIFT10 · zero-duration: it does not use host time",
    },
    {
      id: id("cue-pin-b"),
      title: "Pin Cargo Pants",
      audience: "operator",
      action: "pin_product",
      productId: "prod_m03",
      timing: { type: "segment_start", segmentId: id("b"), offsetSec: 0 },
      text: null,
    },
    {
      id: id("cue-size"),
      title: "Show size chart overlay",
      audience: "presenter",
      action: "none",
      productId: "prod_m03",
      timing: { type: "segment_start", segmentId: id("b"), offsetSec: 60 },
      text: "Waist sizing first",
    },
    {
      id: id("cue-unpin-b"),
      title: "Unpin Cargo Pants",
      audience: "operator",
      action: "unpin_product",
      productId: "prod_m03",
      timing: { type: "segment_end", segmentId: id("b"), offsetSec: 0 },
      text: null,
    },
  ];
  return { segments, cues };
}

// ---------------------------------------------------------------------------
// 1. Buffered recovery (the demo story)
// ---------------------------------------------------------------------------

const BUFFERED: Scenario = {
  id: "buffered",
  sessionId: "sim-buffered",
  title: "Fall collection rehearsal",
  summary:
    "A 30-minute show with two hard anchors. Zip Hoodie overruns; a clean recovery protects the 20:12 Flash Sale.",
  watchFor: [
    "At 20:07 the host says Zip Hoodie needs 6 more minutes: Flash Sale would start 1:00 late.",
    "A clean option exists: end Zip Hoodie by 20:12. The 20:12 commitment never moves.",
    "Review shows Zip Hoodie +3:00, the buffer consumed, and reported cues. Select changes to create a different next show.",
  ],
  productIds: ["prod_m02", "prod_m03"],
  buildPlan: (sid) =>
    segmentsAndCues(
      sid,
      { open: [min(3), min(2)], a: [min(6), min(4)], flash: [min(3), min(2)], b: [min(8), min(6)], qa: [min(3), min(2)], close: [min(4), min(3)] },
      { flashAnchorMin: 12, closeAnchorMin: 26, flashCueAtClock: true }
    ),
  script: [
    { id: "start", label: "Start the simulated session at 20:00", atSec: 0, build: () => ({ type: "start_live" }) },
    { id: "a-start", label: "Opening ends · Zip Hoodie starts (20:03)", atSec: min(3), build: () => ({ type: "advance_segment" }) },
    {
      id: "estimate",
      label: "Host: Zip Hoodie needs 6 more minutes (ends 20:13)",
      atSec: min(7),
      build: (c) => ({ type: "set_remaining_estimate", segmentId: c.sid("a"), remainingSec: min(6) }),
    },
    {
      id: "end-by",
      label: "Operator: end Zip Hoodie by 20:12",
      atSec: min(7),
      recoveryLabel: "End Zip Hoodie by 20:12:00",
      build: (c) => ({ type: "commit_end_by", segmentId: c.sid("a"), endByMs: c.at(min(12)) }),
    },
    {
      id: "flash-start",
      label: "Zip Hoodie ends (operator: unfinished points, follow up in Q&A) · Flash Sale starts at its anchor (20:12)",
      atSec: min(12),
      // The operator's declaration, not an automatic transfer: the remaining points are a manual follow-up.
      build: () => ({ type: "advance_segment", coverage: "partial", followUp: "Remaining Zip Hoodie points — cover in Q&A" }),
    },
    {
      id: "flash-cue",
      label: "Operator reports Flash Sale activated in TikTok",
      atSec: min(12, 10),
      build: (c) => ({ type: "report_cue", cueId: c.cue("cue-flash"), report: "performed", occurredAtMs: c.at(min(12, 5)) }),
    },
    { id: "b-start", label: "Flash Sale ends · Cargo Pants starts (20:15)", atSec: min(15), build: () => ({ type: "advance_segment" }) },
    {
      id: "pin-cue",
      label: "Operator reports Cargo Pants pinned",
      atSec: min(15, 20),
      build: (c) => ({ type: "report_cue", cueId: c.cue("cue-pin-b"), report: "performed", occurredAtMs: c.at(min(15, 20)) }),
    },
    { id: "qa-start", label: "Cargo Pants ends · Q&A starts (20:23)", atSec: min(23), build: () => ({ type: "advance_segment" }) },
    {
      id: "unpin-cue",
      label: "Operator reports Cargo Pants unpinned",
      atSec: min(23, 10),
      build: (c) => ({ type: "report_cue", cueId: c.cue("cue-unpin-b"), report: "performed", occurredAtMs: c.at(min(23, 5)) }),
    },
    { id: "close-start", label: "Q&A ends · Closing starts at its anchor (20:26)", atSec: min(26), build: () => ({ type: "advance_segment" }) },
    { id: "end", label: "End the simulated session at 20:30", atSec: min(30), build: () => ({ type: "end_live" }) },
  ],
};

// ---------------------------------------------------------------------------
// 2. Missed anchor — the commitment is not moved
// ---------------------------------------------------------------------------

const MISSED: Scenario = {
  id: "missed",
  sessionId: "sim-missed",
  title: "Fall collection rehearsal · missed anchor",
  summary:
    "Same show, but Zip Hoodie is not closed in time. The 20:12 anchor is missed by 1:00 and stays 20:12 in Review.",
  watchFor: [
    "Flash Sale starts 20:13:00 — 1:00 after its 20:12 commitment. The anchor is shown as missed, not moved.",
    "Skipping optional Q&A protects the 20:26 Closing anchor.",
    "Review lists the late anchor and the late cue report; nothing is relabelled as recovered.",
  ],
  productIds: ["prod_m02", "prod_m03"],
  buildPlan: BUFFERED.buildPlan,
  script: [
    { id: "start", label: "Start the simulated session at 20:00", atSec: 0, build: () => ({ type: "start_live" }) },
    { id: "a-start", label: "Opening ends · Zip Hoodie starts (20:03)", atSec: min(3), build: () => ({ type: "advance_segment" }) },
    {
      id: "estimate",
      label: "Host: Zip Hoodie needs 6 more minutes (ends 20:13)",
      atSec: min(7),
      build: (c) => ({ type: "set_remaining_estimate", segmentId: c.sid("a"), remainingSec: min(6) }),
    },
    { id: "flash-start", label: "Zip Hoodie ends 20:13 · Flash Sale starts 1:00 late", atSec: min(13), build: () => ({ type: "advance_segment" }) },
    {
      id: "flash-cue",
      label: "Operator reports Flash Sale activated (late)",
      atSec: min(13, 30),
      build: (c) => ({ type: "report_cue", cueId: c.cue("cue-flash"), report: "performed", occurredAtMs: c.at(min(13, 30)) }),
    },
    {
      id: "skip-qa",
      label: "Operator: skip optional Q&A to protect Closing",
      atSec: min(13, 30),
      recoveryLabel: "Skip Q&A (optional)",
      build: (c) => ({ type: "skip_segment", segmentId: c.sid("qa") }),
    },
    { id: "b-start", label: "Flash Sale ends · Cargo Pants starts (20:16)", atSec: min(16), build: () => ({ type: "advance_segment" }) },
    {
      id: "pin-cue",
      label: "Operator reports Cargo Pants pinned",
      atSec: min(16, 20),
      build: (c) => ({ type: "report_cue", cueId: c.cue("cue-pin-b"), report: "performed", occurredAtMs: c.at(min(16, 20)) }),
    },
    { id: "b-end", label: "Cargo Pants ends 20:24 · host waits for the Closing anchor", atSec: min(24), build: () => ({ type: "advance_segment" }) },
    {
      id: "unpin-cue",
      label: "Operator reports Cargo Pants unpinned",
      atSec: min(24, 10),
      build: (c) => ({ type: "report_cue", cueId: c.cue("cue-unpin-b"), report: "performed", occurredAtMs: c.at(min(24, 5)) }),
    },
    { id: "close-start", label: "Closing starts at its anchor (20:26)", atSec: min(26), build: () => ({ type: "advance_segment" }) },
    { id: "end", label: "End the simulated session at 20:30", atSec: min(30), build: () => ({ type: "end_live" }) },
  ],
};

// ---------------------------------------------------------------------------
// 3. Minimum exhaustion — no feasible recovery, explicit re-anchor
// ---------------------------------------------------------------------------

const MINIMUM: Scenario = {
  id: "minimum",
  sessionId: "sim-minimum",
  title: "Fall collection rehearsal · minimum exhausted",
  summary:
    "The opening runs 2:00 long and Zip Hoodie cannot reach its minimum before 20:12. No clean recovery exists.",
  watchFor: [
    "At 20:07 the app says: No feasible recovery under current constraints — and offers explicit commitment changes only.",
    "Re-anchoring Flash Sale is recorded as a new plan version. The baseline 20:12 stays visible in Review.",
    "The original commitment is shown as missed by 4:00; it is never relabelled as recovered.",
  ],
  productIds: ["prod_m02", "prod_m03"],
  buildPlan: (sid) => {
    const built = segmentsAndCues(
      sid,
      { open: [min(5), min(4)], a: [min(7), min(6)], flash: [min(3), min(2)], b: [min(8), min(6)], close: [min(3), min(2)] },
      { flashAnchorMin: 12, closeAnchorMin: null, flashCueAtClock: false }
    );
    return built;
  },
  script: [
    { id: "start", label: "Start the simulated session at 20:00", atSec: 0, build: () => ({ type: "start_live" }) },
    { id: "a-start", label: "Opening ran 7:00 · Zip Hoodie starts 20:07", atSec: min(7), build: () => ({ type: "advance_segment" }) },
    {
      id: "estimate",
      label: "Host: Zip Hoodie needs 9 more minutes (ends 20:16)",
      atSec: min(7),
      build: (c) => ({ type: "set_remaining_estimate", segmentId: c.sid("a"), remainingSec: min(9) }),
    },
    {
      id: "reanchor",
      label: "Operator: re-anchor Flash Sale to 20:16 (commitment change)",
      atSec: min(9, 30),
      recoveryLabel: "Re-anchor Flash Sale to 20:16:00",
      build: (c) => ({
        type: "reanchor_segment",
        segmentId: c.sid("flash"),
        anchorOffsetSec: min(16),
        reason: "Host cannot close Zip Hoodie before 20:16 without breaking its minimum",
      }),
    },
    { id: "flash-start", label: "Zip Hoodie ends 20:16 · Flash Sale starts at its new anchor", atSec: min(16), build: () => ({ type: "advance_segment" }) },
    {
      id: "flash-cue",
      label: "Operator reports Flash Sale activated",
      atSec: min(16, 20),
      build: (c) => ({ type: "report_cue", cueId: c.cue("cue-flash"), report: "performed", occurredAtMs: c.at(min(16, 20)) }),
    },
    { id: "b-start", label: "Flash Sale ends · Cargo Pants starts (20:19)", atSec: min(19), build: () => ({ type: "advance_segment" }) },
    { id: "close-start", label: "Cargo Pants ends · Closing starts (20:27)", atSec: min(27), build: () => ({ type: "advance_segment" }) },
    { id: "end", label: "End the simulated session at 20:30", atSec: min(30), build: () => ({ type: "end_live" }) },
  ],
};

export const SCENARIOS: Scenario[] = [BUFFERED, MISSED, MINIMUM];
export const SCENARIO_BY_ID: Record<ScenarioId, Scenario> = {
  buffered: BUFFERED,
  missed: MISSED,
  minimum: MINIMUM,
};

export function createScenarioSession(
  scenarioId: ScenarioId,
  opts: { id?: string; title?: string; nowMs?: number } = {}
): Session {
  const scenario = SCENARIO_BY_ID[scenarioId];
  const id = opts.id ?? scenario.sessionId;
  const { segments, cues } = scenario.buildPlan(id);
  return createSession({
    id,
    title: opts.title ?? scenario.title,
    environment: "SIMULATED",
    timezone: DEFAULT_TIMEZONE,
    plannedStartMs: SCENARIO_START_MS,
    nowMs: opts.nowMs ?? SCENARIO_START_MS,
    objective: scenario.summary,
    products: snapshotProducts(scenario.productIds),
    segments,
    cues,
    scenarioId,
  });
}

export interface ScriptStepResult {
  session: Session;
  /** null when there is no next step. */
  receipt: Receipt | null;
  step: ScriptStep | null;
}

/** Apply the next scripted step (advancing the virtual clock first). A rejected step does not advance the cursor. */
export function applyScriptStep(session: Session): ScriptStepResult {
  const scenario = session.scenarioId ? SCENARIO_BY_ID[session.scenarioId as ScenarioId] : undefined;
  const step = scenario?.script[session.scriptCursor];
  if (!scenario || !step) return { session, receipt: null, step: null };

  const plannedStart = baselinePlan(session).plannedStartMs;
  const ctx: ScriptCtx = {
    sid: (name) => `${session.id}:${name}`,
    cue: (name) => `${session.id}:${name}`,
    at: (sec) => plannedStart + sec * 1000,
  };

  let s = session;
  const targetMs = ctx.at(step.atSec);
  const now = s.virtualNowMs ?? plannedStart;
  if (targetMs > now) {
    const clock = applyCommand(s, {
      type: "set_clock",
      toMs: targetMs,
      nowMs: targetMs,
      key: `${s.id}:script:${s.scriptCursor}:clock`,
    });
    if (clock.receipt.outcome === "rejected") return { session: s, receipt: clock.receipt, step };
    s = clock.session;
  }

  const body = step.build(ctx);
  const result = applyCommand(s, {
    ...body,
    nowMs: s.virtualNowMs ?? targetMs,
    key: `${s.id}:script:${s.scriptCursor}`,
    recoveryId: step.recoveryLabel ? `script:${step.id}` : undefined,
    recoveryLabel: step.recoveryLabel,
  });
  if (result.receipt.outcome === "rejected") return { session: s, receipt: result.receipt, step };
  return { session: { ...result.session, scriptCursor: session.scriptCursor + 1 }, receipt: result.receipt, step };
}

/** Skip a scripted step without applying it (used when the operator already did something different). */
export function skipScriptStep(session: Session): Session {
  return { ...session, scriptCursor: session.scriptCursor + 1 };
}

/** Apply scripted steps until `maxSteps` have run or one is rejected. */
export function runScript(session: Session, maxSteps = Number.POSITIVE_INFINITY): Session {
  let s = session;
  for (let i = 0; i < maxSteps; i++) {
    const r = applyScriptStep(s);
    if (!r.step || !r.receipt || r.receipt.outcome === "rejected") return r.session;
    s = r.session;
  }
  return s;
}

/**
 * Simulator seed data. Every record here is SIMULATED, generated by running the engine with a
 * virtual clock — never hand-written history, and never placed in the REAL namespace.
 */
export function seedSimulatorSessions(): Session[] {
  const completed = runScript(
    createScenarioSession("buffered", {
      id: "sim-buffered-done",
      title: "Collection launch · rehearsal (completed)",
    })
  );
  return [
    createScenarioSession("buffered"),
    createScenarioSession("missed"),
    createScenarioSession("minimum"),
    completed,
  ];
}
