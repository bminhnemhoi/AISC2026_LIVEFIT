import { describe, it, expect } from "vitest";
import type { Cue, Segment, Session } from "@/contracts";
import {
  SCENARIO_START_MS,
  analyzeRecovery,
  applyCommand,
  createSession,
  createScenarioSession,
  forecastSession,
  newSegment,
  plannedTotalSec,
  runScript,
  schedulePlan,
  validatePlan,
  type CommandBody,
} from "@/lib/domain";

const T0 = SCENARIO_START_MS; // 20:00 Asia/Ho_Chi_Minh
const at = (m: number, s = 0): number => T0 + (m * 60 + s) * 1000;
const min = (m: number, s = 0): number => m * 60 + s;

/** The P0 spec's required example: Opening 5m, A 7m, hard-anchored Giveaway 20:12 (3m), B 8m. */
function p0Session(): Session {
  const segs: Segment[] = [
    newSegment("open", { title: "Opening", kind: "opening", targetSec: min(5), minSec: min(4) }),
    newSegment("a", { title: "Product A", targetSec: min(7), minSec: min(6) }),
    newSegment("give", { title: "Giveaway", kind: "promotion", targetSec: min(3), minSec: min(2), anchorOffsetSec: min(12) }),
    newSegment("b", { title: "Product B", targetSec: min(8), minSec: min(6) }),
  ];
  return createSession({
    id: "t-p0",
    title: "P0 example",
    environment: "REAL",
    timezone: "Asia/Ho_Chi_Minh",
    plannedStartMs: T0,
    nowMs: T0,
    segments: segs,
  });
}

function run(session: Session, nowMs: number, body: CommandBody): Session {
  const r = applyCommand(session, { ...body, nowMs });
  if (r.receipt.outcome !== "committed") {
    throw new Error(`${body.type} rejected: ${r.receipt.code} ${r.receipt.message}`);
  }
  return r.session;
}

describe("planned schedule", () => {
  it("lays out the P0 baseline with the hard anchor on its committed time", () => {
    const s = p0Session();
    const sch = schedulePlan(s.plans[0]);
    expect(sch.rows.map((r) => r.startMs)).toEqual([at(0), at(5), at(12), at(15)]);
    expect(sch.rows.map((r) => r.endMs)).toEqual([at(5), at(12), at(15), at(23)]);
    expect(sch.rows[2].waitBeforeSec).toBe(0);
    expect(sch.rows[2].deficitSec).toBe(0);
    expect(sch.complete).toBe(true);
  });

  it("an early arrival waits for the anchor instead of pulling it forward", () => {
    const s = p0Session();
    // Shorten A to 4m: arrival 20:09, anchor stays 20:12.
    const plan = { ...s.plans[0], segments: s.plans[0].segments.map((x) => (x.id === "a" ? { ...x, targetSec: min(4) } : x)) };
    const row = schedulePlan(plan).rows[2];
    expect(row.waitBeforeSec).toBe(min(3));
    expect(row.startMs).toBe(at(12));
  });

  it("MISSING != ZERO: a missing duration makes downstream floating starts unknown", () => {
    const s = p0Session();
    const plan = { ...s.plans[0], segments: s.plans[0].segments.map((x) => (x.id === "a" ? { ...x, targetSec: null } : x)) };
    const sch = schedulePlan(plan);
    expect(sch.complete).toBe(false);
    expect(sch.rows[1].endMs).toBeNull();
    // The hard anchor still fixes its own start; the floating segment after it is known again.
    expect(sch.rows[2].startMs).toBe(at(12));
    expect(plannedTotalSec(plan)).toBeNull();
    const issues = validatePlan(plan, [], "Asia/Ho_Chi_Minh");
    expect(issues.some((i) => i.code === "duration_missing" && i.severity === "blocker")).toBe(true);
  });

  it("a missing duration blocks Start LIVE", () => {
    const s = p0Session();
    const broken = { ...s, plans: [{ ...s.plans[0], segments: s.plans[0].segments.map((x) => (x.id === "a" ? { ...x, targetSec: null } : x)) }] };
    const r = applyCommand(broken, { type: "start_live", nowMs: T0 });
    expect(r.receipt.outcome).toBe("rejected");
    expect(r.receipt.code).toBe("plan_invalid");
  });

  it("a baseline that cannot meet its own anchor is a Start blocker, not a warning (UI-05)", () => {
    const s = p0Session();
    const plan = { ...s.plans[0], segments: s.plans[0].segments.map((x) => (x.id === "open" ? { ...x, targetSec: min(7) } : x)) };
    const issues = validatePlan(plan, [], "Asia/Ho_Chi_Minh");
    const infeasible = issues.find((i) => i.code === "anchor_infeasible");
    expect(infeasible?.deficitSec).toBe(min(2));
    expect(infeasible?.severity).toBe("blocker");
    // The domain refuses to start it — a disabled button is not the only guard.
    const r = applyCommand({ ...s, plans: [plan] }, { type: "start_live", nowMs: T0 });
    expect(r.receipt.code).toBe("plan_invalid");
    expect(r.session.lifecycle).toBe("planned");
  });
});

describe("P0 example: Product A overruns by four minutes", () => {
  function atRisk(): Session {
    let s = run(p0Session(), at(0), { type: "start_live" });
    s = run(s, at(5), { type: "advance_segment" });
    // 20:09 — the host revises: A ends 20:16.
    s = run(s, at(9), { type: "set_remaining_estimate", segmentId: "a", remainingSec: min(7) });
    return s;
  }

  it("shows a four-minute deficit and keeps the committed time at 20:12", () => {
    const s = atRisk();
    const f = forecastSession(s, at(9));
    const give = f.segments.find((x) => x.segmentId === "give")!;
    expect(give.anchor?.status).toBe("at_risk");
    expect(give.anchor?.committedMs).toBe(at(12));
    expect(give.anchor?.deficitSec).toBe(min(4));
    expect(give.startMs).toBe(at(16));
    expect(f.criticalSegmentId).toBe("give");
    // B projects after the giveaway: 20:19–20:27.
    const b = f.segments.find((x) => x.segmentId === "b")!;
    expect(b.startMs).toBe(at(19));
    expect(b.endMs).toBe(at(27));
  });

  it("if A actually ends 20:16 the anchor stays 20:12 and is recorded as late, not moved", () => {
    let s = atRisk();
    s = run(s, at(16), { type: "advance_segment" });
    const f = forecastSession(s, at(16));
    const give = f.segments.find((x) => x.segmentId === "give")!;
    expect(give.anchor?.status).toBe("met_late");
    expect(give.anchor?.deficitSec).toBe(min(4));
    expect(give.anchor?.committedMs).toBe(at(12));
    expect(give.startMs).toBe(at(16));
    // The baseline is unchanged: the original commitment is still 20:12.
    expect(f.segments.find((x) => x.segmentId === "give")?.baselineStartMs).toBe(at(12));
  });
});

describe("unknown remaining time", () => {
  function buffered(): Session {
    return runScript(createScenarioSession("buffered"), 2); // start, Opening ends, Zip Hoodie running from 20:03
  }

  it("past the target with no estimate the end is UNKNOWN: earliest possible end = now, never a promise", () => {
    const s = buffered();
    const f = forecastSession(s, at(10)); // target ended 20:09
    expect(f.active?.known).toBe(false);
    expect(f.active?.basis).toBe("unknown_overrun");
    expect(f.active?.endMs).toBe(at(10));
    const flash = f.segments.find((x) => x.segmentId.endsWith(":flash"))!;
    expect(flash.anchor?.status).toBe("possible_risk");
    expect(flash.anchor?.lowerBound).toBe(true);
    expect(flash.anchor?.bufferSec).toBe(min(2));
    expect(f.criticalSegmentId).toBeNull(); // possible risk is not a definite one
  });

  it("an unknown end is never labelled on-track, and offers a committed end time", () => {
    // Simulated sessions use their virtual clock, so move it to 20:10 explicitly.
    const s = run(buffered(), at(10), { type: "set_clock", toMs: at(10) });
    const a = analyzeRecovery(s, at(10));
    expect(a.status).toBe("possible_risk");
    expect(a.situation.tone).toBe("watch");
    expect(a.options[0].kind).toBe("end_by");
  });

  it("once the committed time passes without a start, the anchor is MISSED and still not moved", () => {
    const s = buffered();
    const f = forecastSession(s, at(12, 30));
    const flash = f.segments.find((x) => x.segmentId.endsWith(":flash"))!;
    expect(flash.anchor?.status).toBe("missed");
    expect(flash.anchor?.deficitSec).toBeGreaterThanOrEqual(30);
    expect(flash.anchor?.committedMs).toBe(at(12));
  });

  it("an expired host estimate falls back to unknown, not to zero remaining", () => {
    let s = buffered();
    s = run({ ...s }, at(7), { type: "set_remaining_estimate", segmentId: `${s.id}:a`, remainingSec: min(1) });
    const f = forecastSession(s, at(9, 30)); // estimate ended 20:08, target ended 20:09
    expect(f.active?.basis).toBe("unknown_overrun");
    expect(f.active?.known).toBe(false);
  });
});

describe("buffered recovery (demo story)", () => {
  it("the host estimate consumes the buffer and puts Flash Sale 1:00 late; a clean option protects it", () => {
    const s = runScript(createScenarioSession("buffered"), 3); // ... + host estimate at 20:07
    const f = forecastSession(s, at(7));
    const flash = f.segments.find((x) => x.segmentId.endsWith(":flash"))!;
    expect(flash.anchor?.status).toBe("at_risk");
    expect(flash.anchor?.deficitSec).toBe(min(1));
    expect(flash.anchor?.committedMs).toBe(at(12));

    const a = analyzeRecovery(s, at(7));
    expect(a.status).toBe("recoverable");
    const first = a.options[0];
    expect(first.kind).toBe("end_by");
    expect(first.clean).toBe(true);
    expect(first.protects).toBe(true);
    expect(first.exception).toBeNull();
    expect(first.resultingDeficitSec).toBe(0);
  });

  it("committing to end by 20:12 makes the anchor on-track at exactly its committed time", () => {
    let s = runScript(createScenarioSession("buffered"), 3);
    s = runScript(s, 1); // end-by step
    const f = forecastSession(s, at(7));
    const flash = f.segments.find((x) => x.segmentId.endsWith(":flash"))!;
    expect(flash.anchor?.status).toBe("on_track");
    expect(flash.startMs).toBe(at(12));
    expect(flash.anchor?.bufferSec).toBe(0);
  });
});

describe("minimum exhaustion", () => {
  it("says there is no feasible recovery and offers only exceptions and commitment changes", () => {
    const s = runScript(createScenarioSession("minimum"), 2); // Opening ran 7:00; Zip Hoodie started 20:07
    const a = analyzeRecovery(s, at(7));
    expect(a.status).toBe("no_feasible_recovery");
    expect(a.situation.tone).toBe("risk");
    expect(a.situation.detail).toContain("late");
    expect(a.options.some((o) => o.clean && o.protects)).toBe(false);
    const close = a.options.find((o) => o.kind === "close_now");
    expect(close?.clean).toBe(false);
    expect(close?.exception?.code).toBe("below_minimum");
    const reanchor = a.options.find((o) => o.kind === "reanchor");
    expect(reanchor?.exception?.code).toBe("commitment_change");
  });

  it("ending below the minimum without acknowledgement is rejected, with acknowledgement it is recorded", () => {
    const s = runScript(createScenarioSession("minimum"), 2);
    const id = `${s.id}:a`;
    const denied = applyCommand(s, { type: "end_segment", segmentId: id, nowMs: at(8) });
    expect(denied.receipt.outcome).toBe("rejected");
    expect(denied.receipt.code).toBe("needs_ack_below_minimum");
    // Coverage is declared by the operator; ending below the minimum does not invent a coverage value (UI-07).
    const undeclared = applyCommand(s, { type: "end_segment", segmentId: id, acknowledgeBelowMinimum: true, nowMs: at(8) });
    expect(undeclared.session.runtime.segments[id].belowMinimum).toBe(true);
    expect(undeclared.session.runtime.segments[id].coverage).toBeNull();
    const ok = applyCommand(s, { type: "end_segment", segmentId: id, coverage: "partial", acknowledgeBelowMinimum: true, nowMs: at(8) });
    expect(ok.receipt.outcome).toBe("committed");
    const rowRun = ok.session.runtime.segments[id];
    expect(rowRun.belowMinimum).toBe(true);
    expect(rowRun.coverage).toBe("partial");
  });
});

describe("cues vs segments", () => {
  it("a zero-duration cue never consumes host time", () => {
    const s = p0Session();
    const cue: Cue = {
      id: "c1",
      title: "Pin Product B",
      audience: "operator",
      action: "pin_product",
      productId: null,
      timing: { type: "segment_start", segmentId: "b", offsetSec: 0 },
      text: null,
    };
    const withCue = { ...s.plans[0], cues: [cue] };
    expect(schedulePlan(withCue).rows.map((r) => r.endMs)).toEqual(schedulePlan(s.plans[0]).rows.map((r) => r.endMs));
  });

  it("a segment-relative cue follows the projected start of its segment", () => {
    const s = createScenarioSession("buffered");
    let running = runScript(s, 3); // estimate at 20:07 -> Flash 20:12 at risk; Cargo Pants projected later
    const f = forecastSession(running, at(7));
    const pin = f.cues.find((c) => c.cueId.endsWith("cue-pin-b"))!;
    const b = f.segments.find((x) => x.segmentId.endsWith(":b"))!;
    expect(pin.timeMs).toBe(b.startMs);
    running = runScript(running, 1);
    expect(forecastSession(running, at(7)).cues.find((c) => c.cueId.endsWith("cue-pin-b"))!.timeMs).toBe(at(15));
  });
});

describe("skip coverage", () => {
  it("skipping required coverage needs acknowledgement; skipping an optional segment frees its time", () => {
    const base = createScenarioSession("buffered");
    const s = runScript(base, 1);
    const must = applyCommand(s, { type: "skip_segment", segmentId: `${s.id}:b`, nowMs: at(1) });
    expect(must.receipt.code).toBe("needs_ack_required_coverage");
    const optional = applyCommand(s, { type: "skip_segment", segmentId: `${s.id}:qa`, nowMs: at(1) });
    expect(optional.receipt.outcome).toBe("committed");
    const before = forecastSession(s, at(1)).finishMs;
    const after = forecastSession(optional.session, at(1)).finishMs;
    // Closing is hard-anchored, so skipping Q&A turns its time into buffer; finish stays at the anchor.
    expect(after).toBe(before);
    const closing = forecastSession(optional.session, at(1)).segments.find((x) => x.segmentId.endsWith(":close"))!;
    expect(closing.anchor?.bufferSec).toBe(min(3));
  });
});
