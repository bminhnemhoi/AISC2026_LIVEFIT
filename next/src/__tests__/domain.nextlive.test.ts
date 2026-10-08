import { describe, it, expect } from "vitest";
import type { Session } from "@/contracts";
import {
  SCENARIO_START_MS,
  addDaysZoned,
  applyChangeOps,
  applyCommand,
  assessPlan,
  baselinePlan,
  buildReview,
  createNextSession,
  createScenarioSession,
  createSession,
  diffPlans,
  formatClock,
  newSegment,
  proposeChanges,
  runScript,
  type CommandBody,
} from "@/lib/domain";

const T0 = SCENARIO_START_MS;
const at = (m: number, s = 0): number => T0 + (m * 60 + s) * 1000;
const TZ = "Asia/Ho_Chi_Minh";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

const buffered = (): Session => runScript(createScenarioSession("buffered"));
const minimum = (): Session => runScript(createScenarioSession("minimum"));

describe("proposals come from this show's recorded facts", () => {
  it("buffered show: one observed duration and one clearly-labelled trade-off, nothing else", () => {
    const s = buffered();
    const proposals = proposeChanges(s);
    expect(proposals.map((p) => p.id).sort()).toEqual([`duration:${s.id}:a`, `tradeoff:${s.id}:open`].sort());
    const observed = proposals.find((p) => p.basis === "observed")!;
    expect(observed.title).toBe("Zip Hoodie: 6:00 → 9:00");
    expect(observed.detail).toContain("Ran 9:00 vs 6:00 planned");
    expect(observed.detail).toContain("not a recurring pattern");
    const tradeoff = proposals.find((p) => p.basis === "tradeoff")!;
    expect(tradeoff.title).toBe("Opening: 3:00 → 2:00");
    expect(tradeoff.detail).toContain("Trade-off, not an observation");
  });

  it("an active or planned show has nothing to propose", () => {
    expect(proposeChanges(createScenarioSession("buffered"))).toEqual([]);
    expect(proposeChanges(runScript(createScenarioSession("buffered"), 3))).toEqual([]);
  });

  it("a required segment that was skipped can be moved ahead of an optional one", () => {
    let s = createSession({
      id: "t-skip",
      title: "Skip test",
      environment: "REAL",
      timezone: TZ,
      plannedStartMs: T0,
      nowMs: T0,
      segments: [
        newSegment("open", { title: "Opening", kind: "opening", targetSec: 180, minSec: 120 }),
        newSegment("qa", { title: "Q&A", kind: "qa", optional: true, targetSec: 180, minSec: 120 }),
        newSegment("b", { title: "Product B", targetSec: 360, minSec: 240 }),
        newSegment("close", { title: "Closing", kind: "closing", targetSec: 180, minSec: 120 }),
      ],
    });
    const go = (now: number, body: CommandBody): void => {
      const r = applyCommand(s, { ...body, nowMs: now });
      if (r.receipt.outcome !== "committed") throw new Error(String(r.receipt.message));
      s = r.session;
    };
    go(at(0), { type: "start_live" });
    go(at(3), { type: "advance_segment" }); // Q&A starts
    go(at(3), { type: "skip_segment", segmentId: "b", acknowledgeCoverageLoss: true });
    go(at(6), { type: "advance_segment" }); // Closing starts (B was skipped)
    go(at(9), { type: "end_live" });

    const review = buildReview(s)!;
    expect(review.rows.find((r) => r.segmentId === "b")?.outcome).toBe("skipped");
    const earlier = proposeChanges(s).find((p) => p.id === "earlier:b")!;
    expect(earlier.op).toEqual({ op: "move_before", segmentId: "b", beforeSegmentId: "qa" });
    const moved = applyChangeOps(baselinePlan(s), [earlier.op]);
    expect(moved.segments.map((x) => x.id)).toEqual(["open", "b", "qa", "close"]);
  });
});

describe("infeasibility is shown, not hidden", () => {
  it("observed changes alone leave zero buffer; adding the trade-off returns one minute", () => {
    const s = buffered();
    const base = baselinePlan(s);
    const observed = proposeChanges(s).find((p) => p.basis === "observed")!;
    const tradeoff = proposeChanges(s).find((p) => p.basis === "tradeoff")!;

    const baseline = assessPlan(base, s.products, TZ);
    expect(baseline.anchors.map((a) => a.bufferSec)).toEqual([180, 0]);

    const one = assessPlan(applyChangeOps(base, [observed.op]), s.products, TZ);
    expect(one.feasible).toBe(true);
    expect(one.anchors[0]).toMatchObject({ bufferSec: 0, deficitSec: 0 });

    const both = assessPlan(applyChangeOps(base, [observed.op, tradeoff.op]), s.products, TZ);
    expect(both.feasible).toBe(true);
    expect(both.anchors[0]).toMatchObject({ bufferSec: 60, deficitSec: 0, committedMs: at(12) });
    expect(both.anchors[1]).toMatchObject({ committedMs: at(26) });
  });

  it("selected changes that conflict with a hard anchor are reported with the exact deficit", () => {
    const s = minimum();
    const proposals = proposeChanges(s);
    const durations = proposals.filter((p) => p.op.op === "set_target");
    expect(durations.map((p) => p.title).sort()).toEqual(["Opening: 5:00 → 7:00", "Zip Hoodie: 7:00 → 9:00"]);
    // Nothing in that block can give time back: both segments already carry observed proposals.
    expect(proposals.some((p) => p.basis === "tradeoff")).toBe(false);
    const a = assessPlan(applyChangeOps(baselinePlan(s), durations.map((p) => p.op)), s.products, TZ);
    expect(a.feasible).toBe(false);
    expect(a.anchors[0].deficitSec).toBe(240);
    expect(a.issues.some((i) => i.code === "anchor_infeasible")).toBe(true);
  });
});

describe("the next show is genuinely new", () => {
  function clone(source: Session, ids: string[]) {
    const result = createNextSession(source, {
      id: "sim-next-1",
      title: "Fall collection rehearsal · Next LIVE",
      plannedStartMs: addDaysZoned(baselinePlan(source).plannedStartMs, 1, TZ),
      nowMs: at(40),
      changeIds: ids,
      note: "Zip Hoodie needs nine minutes; give Opening the minimum.",
    });
    if (!result.ok) throw new Error(result.reason);
    return result;
  }

  it("applies exactly the selected changes and nothing else", () => {
    const source = buffered();
    const ids = proposeChanges(source).map((p) => p.id);
    const { session, applied } = clone(source, ids);
    expect(applied.length).toBe(2);
    const targets = Object.fromEntries(session.plans[0].segments.map((x) => [x.title, x.targetSec]));
    expect(targets).toMatchObject({ Opening: 120, "Zip Hoodie": 540, "Flash Sale announcement": 180, "Cargo Pants": 480, "Q&A": 180, Closing: 240 });
    // Anchors keep their offsets, so they shift with the new date but never drift relative to the start.
    expect(session.plans[0].segments.filter((x) => x.anchorOffsetSec !== null).map((x) => x.anchorOffsetSec)).toEqual([720, 1560]);
    expect(session.plans[0].plannedStartMs).toBe(at(0) + 86_400_000);
    expect(formatClock(session.plans[0].plannedStartMs, TZ)).toBe("20:00");
  });

  it("an empty selection yields an unchanged but still new plan", () => {
    const source = buffered();
    const { session } = clone(source, []);
    expect(session.plans[0].segments.map((x) => x.targetSec)).toEqual(baselinePlan(source).segments.map((x) => x.targetSec));
    expect(session.id).not.toBe(source.id);
    expect(session.derivedFrom?.appliedChanges).toEqual([]);
  });

  it("differs from the source plan and clears all actual state", () => {
    const source = buffered();
    const { session } = clone(source, proposeChanges(source).map((p) => p.id));
    expect(session.lifecycle).toBe("planned");
    expect(session.baselineLocked).toBe(false);
    expect(session.runtime).toEqual({ startedAtMs: null, endedAtMs: null, currentSegmentId: null, segments: {}, cues: {}, actions: {} });
    expect(session.events).toEqual([]);
    expect(session.receipts).toEqual({});
    expect(session.scriptCursor).toBe(0);
    expect(session.revision).toBe(0);
    expect(session.plans.length).toBe(1);

    const sourceIds = new Set(baselinePlan(source).segments.map((x) => x.id));
    expect(session.plans[0].segments.every((x) => !sourceIds.has(x.id) && x.id.startsWith("sim-next-1:"))).toBe(true);
    const segIds = new Set(session.plans[0].segments.map((x) => x.id));
    expect(session.plans[0].cues.every((c) => c.timing.type === "at_offset" || segIds.has(c.timing.segmentId))).toBe(true);

    const diff = diffPlans(
      applyChangeOps(baselinePlan(source), proposeChanges(source).map((p) => p.op)),
      baselinePlan(source)
    ).filter((r) => r.change !== "unchanged");
    expect(diff.map((r) => r.title).sort()).toEqual(["Opening", "Zip Hoodie"]);
  });

  it("is feasible with the trade-off, and records where it came from", () => {
    const source = buffered();
    const { session } = clone(source, proposeChanges(source).map((p) => p.id));
    expect(assessPlan(session.plans[0], session.products, TZ).feasible).toBe(true);
    expect(session.derivedFrom).toMatchObject({ sessionId: source.id, planVersionId: baselinePlan(source).id });
    expect(session.derivedFrom?.appliedChanges.map((c) => c.summary).sort()).toEqual(["Opening: 3:00 → 2:00", "Zip Hoodie: 6:00 → 9:00"]);
    expect(session.derivedFrom?.changeNote).toContain("nine minutes");
  });

  it("keeps REAL and SIMULATED apart", () => {
    const source = buffered();
    expect(clone(source, []).session.environment).toBe("SIMULATED");
    expect(clone(source, []).session.virtualNowMs).toBe(addDaysZoned(baselinePlan(source).plannedStartMs, 1, TZ));
  });

  it("never mutates the source session or its history", () => {
    const source = deepFreeze(buffered());
    const before = JSON.stringify(source);
    const ids = proposeChanges(source).map((p) => p.id);
    const { session } = clone(source, ids);
    expect(JSON.stringify(source)).toBe(before);
    // The clone owns its products: editing it cannot reach back into the source.
    session.products[0].name = "Edited";
    expect(source.products[0].name).not.toBe("Edited");
  });

  it("refuses unknown adjustments, unfinished shows and untitled shows", () => {
    const source = buffered();
    const base = { id: "x", title: "T", plannedStartMs: at(0), nowMs: at(1), note: "" };
    expect(createNextSession(source, { ...base, changeIds: ["bogus"] }).ok).toBe(false);
    expect(createNextSession(source, { ...base, title: "  ", changeIds: [] }).ok).toBe(false);
    expect(createNextSession(createScenarioSession("buffered"), { ...base, changeIds: [] }).ok).toBe(false);
  });
});

describe("time helpers", () => {
  it("adds calendar days in the session timezone", () => {
    expect(addDaysZoned(at(0), 1, TZ)).toBe(at(0) + 86_400_000);
    expect(addDaysZoned(at(0), 7, TZ)).toBe(at(0) + 7 * 86_400_000);
  });
});
