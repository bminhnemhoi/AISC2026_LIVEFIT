import { describe, it, expect } from "vitest";
import { SegmentSchema, SessionSchema, type Cue, type Segment, type Session } from "@/contracts";
import {
  SCENARIO_START_MS,
  advanceDeviceClock,
  analyzeRecovery,
  applyCommand,
  baselinePlan,
  buildReview,
  coverageDeclarationExpected,
  createNextSession,
  createScenarioSession,
  createSession,
  forecastSession,
  newSegment,
  parseDuration,
  parseProductRows,
  productReferences,
  proposeChanges,
  runScript,
  toProductSnapshots,
  validatePlan,
  type CommandBody,
} from "@/lib/domain";

/**
 * Regressions for the stage-2 audit findings UI-03 … UI-14. Every expected value is written out from the
 * audit's own vectors (minutes after 20:00 Asia/Ho_Chi_Minh), never copied from the implementation.
 */
const T0 = SCENARIO_START_MS;
const at = (m: number, s = 0): number => T0 + (m * 60 + s) * 1000;
const min = (m: number): number => m * 60;

function show(segments: Segment[], extra: { cues?: Cue[]; products?: Session["products"] } = {}): Session {
  return createSession({
    id: "t",
    title: "Audit vector",
    environment: "REAL",
    timezone: "Asia/Ho_Chi_Minh",
    plannedStartMs: T0,
    nowMs: T0,
    segments,
    cues: extra.cues,
    products: extra.products,
  });
}
/**
 * The audit's UI-03 vectors put the anchor earlier than the plan can reach, which Start now refuses (UI-05).
 * The same runtime state is reached legitimately: start a feasible plan, then explicitly re-anchor X.
 */
function startedWithAnchor(segments: Segment[], anchorMin: number): Session {
  let s = show(segments.map((seg) => (seg.id === "x" ? { ...seg, anchorOffsetSec: min(30) } : seg)));
  s = run(s, at(0), { type: "start_live" });
  return run(s, at(0), { type: "reanchor_segment", segmentId: "x", anchorOffsetSec: min(anchorMin), reason: "audit vector" });
}
function run(s: Session, nowMs: number, body: CommandBody): Session {
  const r = applyCommand(s, { ...body, nowMs });
  if (r.receipt.outcome !== "committed") throw new Error(`${body.type}: ${r.receipt.code} ${r.receipt.message}`);
  return r.session;
}

describe("UI-03 recovery feasibility agrees with actual compatible plans", () => {
  it("false positive: shortening and skipping the same optional segment are not added together", () => {
    // A 12m (min 12), optional O 5m (min 3), hard anchor X at 20:11, now 20:01.
    const s = startedWithAnchor(
      [
        newSegment("a", { title: "A", targetSec: min(12), minSec: min(12) }),
        newSegment("o", { title: "O", optional: true, targetSec: min(5), minSec: min(3) }),
        newSegment("x", { title: "X", kind: "promotion", targetSec: min(3), minSec: min(3), anchorOffsetSec: min(11) }),
      ],
      11
    );
    const a = analyzeRecovery(s, at(1));
    expect(a.deficitSec).toBe(min(6)); // projected 20:17 against 20:11
    expect(a.maxCleanSavingsSec).toBe(min(5)); // skip O, not 5 + 2
    expect(a.status).toBe("no_feasible_recovery");
    expect(a.options.some((o) => o.clean && o.protects)).toBe(false);
    const skip = a.options.find((o) => o.kind === "skip_optional")!;
    const shorten = a.options.find((o) => o.kind === "shorten_pending")!;
    expect(skip.resultingDeficitSec).toBe(min(1));
    expect(shorten.resultingDeficitSec).toBe(min(4));
    expect(a.exceptionProtects).toBe(true); // ending A below its minimum would — as a labelled exception
  });

  it("false negative: a legal future end-by is a clean recovery even before the minimum is reached", () => {
    // A 10m (min 8) from 20:00, hard anchor X at 20:09, now 20:02.
    const s = startedWithAnchor(
      [
        newSegment("a", { title: "A", targetSec: min(10), minSec: min(8) }),
        newSegment("x", { title: "X", kind: "promotion", targetSec: min(3), minSec: min(3), anchorOffsetSec: min(9) }),
      ],
      9
    );
    const a = analyzeRecovery(s, at(2));
    expect(a.deficitSec).toBe(min(1));
    expect(a.status).toBe("recoverable");
    const first = a.options[0];
    expect(first.kind).toBe("end_by");
    expect(first.clean && first.protects).toBe(true);
    expect(first.command).toMatchObject({ type: "commit_end_by", endByMs: at(9) });
  });

  it("a combination of clean levers counts when no single one protects, and is named", () => {
    const s = startedWithAnchor(
      [
        newSegment("a", { title: "A", targetSec: min(6), minSec: min(6) }),
        newSegment("o1", { title: "O1", optional: true, targetSec: min(2), minSec: min(1) }),
        newSegment("o2", { title: "O2", optional: true, targetSec: min(3), minSec: min(2) }),
        newSegment("x", { title: "X", kind: "promotion", targetSec: min(3), minSec: min(3), anchorOffsetSec: min(7) }),
      ],
      7
    );
    const a = analyzeRecovery(s, at(1));
    expect(a.deficitSec).toBe(min(4));
    expect(a.options.some((o) => o.clean && o.protects)).toBe(false);
    expect(a.status).toBe("recoverable");
    expect(a.cleanPlan).toEqual(["Skip O1 (optional)", "Skip O2 (optional)"]);
  });

  it("no recovery option claims unfinished points are carried anywhere automatically", () => {
    const s = runScript(createScenarioSession("buffered"), 3);
    const a = analyzeRecovery(s, at(7));
    expect(a.options.map((o) => o.detail).join(" ")).not.toMatch(/carr(y|ied)/i);
  });
});

describe("UI-04 zero, missing and explicitly unknown are distinct", () => {
  it("a declared minimum of 0 is valid, parsed and persisted; a zero host duration is not", () => {
    expect(SegmentSchema.safeParse(newSegment("qa", { title: "Q&A", optional: true, targetSec: min(3), minSec: 0 })).success).toBe(true);
    expect(SegmentSchema.safeParse(newSegment("qa", { title: "Q&A", targetSec: 0 })).success).toBe(false);
    expect(parseDuration("0:00", { allowZero: true })).toBe(0);
    expect(parseDuration("0:00")).toBeNull();
    expect(parseDuration("", { allowZero: true })).toBeNull(); // nothing entered is not zero
    const s = show([newSegment("qa", { title: "Q&A", optional: true, targetSec: min(3), minSec: 0 })]);
    const reloaded = SessionSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(reloaded.plans[0].segments[0].minSec).toBe(0);
    expect(validatePlan(reloaded.plans[0], [], "UTC").filter((i) => i.severity === "blocker")).toEqual([]);
  });

  const d01 = (): Session => {
    let s = show([
      newSegment("open", { title: "Opening", kind: "opening", targetSec: min(5), minSec: min(4) }),
      newSegment("a", { title: "A", targetSec: min(7), minSec: min(4) }),
      newSegment("give", { title: "Giveaway", kind: "promotion", targetSec: min(3), minSec: min(3), anchorOffsetSec: min(12) }),
      newSegment("b", { title: "B", targetSec: min(8), minSec: min(5) }),
    ]);
    s = run(s, at(0), { type: "start_live" });
    return run(s, at(5), { type: "advance_segment" }); // A from 20:05
  };

  it("remaining 0 is a valid estimate and does not end the segment", () => {
    const s = run(d01(), at(9), { type: "set_remaining_estimate", segmentId: "a", remainingSec: 0 });
    expect(s.runtime.currentSegmentId).toBe("a");
    expect(s.runtime.segments["a"].state).toBe("active");
    expect(s.runtime.segments["a"].endedAtMs).toBeNull();
    const f = forecastSession(s, at(9));
    expect(f.active).toMatchObject({ basis: "estimate", endMs: at(9), known: true });
    // A second later the host has not finished: no end was recorded and the projection never lies in the past.
    const later = forecastSession(s, at(9, 1)).active!;
    expect(later.basis).not.toBe("estimate");
    expect(later.endMs).toBeGreaterThanOrEqual(at(9, 1));
    expect(s.runtime.segments["a"].endedAtMs).toBeNull();
  });

  it("explicitly unknown suppresses the target-derived end and shows possible risk, not on-track (D07 at 20:11)", () => {
    const base = d01();
    // No estimate entered: the target projects A to 20:12, so Giveaway is on track with no buffer.
    expect(forecastSession(base, at(11)).active).toMatchObject({ basis: "target", endMs: at(12) });
    const s = run(base, at(11), { type: "mark_remaining_unknown", segmentId: "a" });
    const f = forecastSession(s, at(11));
    expect(f.active).toMatchObject({ basis: "declared_unknown", known: false, endMs: at(11) });
    const give = f.segments.find((x) => x.segmentId === "give")!;
    expect(give.anchor?.status).toBe("possible_risk");
    expect(give.anchor?.lowerBound).toBe(true);
    // Persisted and reloaded as the same distinct state.
    const reloaded = SessionSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(reloaded.runtime.segments["a"].remainingUnknownAtMs).toBe(at(11));
    expect(reloaded.runtime.segments["a"].remainingEstimate).toBeNull();
    // Clearing returns to "no estimate entered".
    const cleared = run(s, at(11, 5), { type: "set_remaining_estimate", segmentId: "a", remainingSec: null });
    expect(forecastSession(cleared, at(11, 5)).active?.basis).toBe("target");
  });
});

describe("UI-05 a known-infeasible next plan can be kept as a draft but never starts", () => {
  it("Start is rejected in the domain while an anchor conflict is unresolved", () => {
    const source = runScript(createScenarioSession("minimum"));
    const durations = proposeChanges(source).filter((p) => p.op.op === "set_target").map((p) => p.id);
    const r = createNextSession(source, { id: "sim-next-x", title: "Draft", plannedStartMs: at(0) + 86_400_000, nowMs: at(40), changeIds: durations, note: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const issues = validatePlan(r.session.plans[0], r.session.products, "Asia/Ho_Chi_Minh");
    expect(issues.find((i) => i.code === "anchor_infeasible")?.severity).toBe("blocker");
    const start = applyCommand(r.session, { type: "start_live", nowMs: 0 });
    expect(start.receipt.code).toBe("plan_invalid");
    expect(start.session.lifecycle).toBe("planned");
    // The anchor was not moved to make it fit.
    expect(r.session.plans[0].segments.find((x) => x.title.startsWith("Flash"))!.anchorOffsetSec).toBe(
      baselinePlan(source).segments.find((x) => x.title.startsWith("Flash"))!.anchorOffsetSec
    );
  });
});

describe("UI-06 independent manual action reporting", () => {
  it("an unresolved attempt does not block reporting a later cue, and stays unresolved", () => {
    let s = runScript(createScenarioSession("buffered"), 5); // 20:12 — Flash Sale running
    s = run(s, 0, { type: "report_cue", cueId: `${s.id}:cue-flash`, report: "attempted" });
    s = run(s, 0, { type: "set_clock", toMs: at(15) });
    s = run(s, 0, { type: "advance_segment" }); // Cargo Pants starts
    s = run(s, 0, { type: "report_cue", cueId: `${s.id}:cue-pin-b`, report: "performed" });
    expect(s.runtime.cues[`${s.id}:cue-pin-b`].state).toBe("performed");
    expect(s.runtime.cues[`${s.id}:cue-flash`].state).toBe("attempted");
  });

  it("an unplanned action records target, action, occurred and report time, and outcome; attempts stay open until resolved", () => {
    let s = runScript(createScenarioSession("buffered"), 2); // 20:03 — Zip Hoodie running
    s = run(s, 0, { type: "set_clock", toMs: at(5) });
    s = run(s, 0, { type: "report_manual_action", action: "pin_product", productId: "prod_m02", report: "attempted", occurredAtMs: at(4, 50) });
    const [first] = Object.values(s.runtime.actions);
    expect(first).toMatchObject({ action: "pin_product", productId: "prod_m02", targetLabel: "M02 Zip Hoodie", state: "attempted", occurredAtMs: at(4, 50), reportedAtMs: at(5) });
    // A second, independent unplanned action does not resolve the first.
    s = run(s, 0, { type: "report_manual_action", action: "start_promotion", targetLabel: "Free shipping banner", report: "performed" });
    expect(s.runtime.actions[first.id].state).toBe("attempted");
    // The operator resolves it explicitly.
    s = run(s, 0, { type: "report_manual_action", actionId: first.id, report: "performed" });
    expect(s.runtime.actions[first.id].state).toBe("performed");
    const ev = s.events.filter((e) => e.type === "action_reported");
    expect(ev.every((e) => e.data.verification === "unknown")).toBe(true);
    // An unknown product is refused, not guessed.
    const bad = applyCommand(s, { type: "report_manual_action", action: "pin_product", productId: "nope", report: "performed", nowMs: 0 });
    expect(bad.receipt.code).toBe("invalid_payload");
  });
});

describe("UI-07 coverage is declared, never inferred from duration", () => {
  it("end-by then an ordinary transition records coverage as not declared — not complete", () => {
    let s = runScript(createScenarioSession("buffered"), 3); // 20:07 host estimate
    s = run(s, 0, { type: "commit_end_by", segmentId: `${s.id}:a`, endByMs: at(12) });
    s = run(s, 0, { type: "set_clock", toMs: at(12) });
    expect(coverageDeclarationExpected(s, `${s.id}:a`, 0)).toBe(true);
    const plain = run(s, 0, { type: "advance_segment" });
    expect(plain.runtime.segments[`${s.id}:a`].coverage).toBeNull();
    const declared = run(s, 0, { type: "advance_segment", coverage: "partial", followUp: "Fit comparison not shown" });
    expect(declared.runtime.segments[`${s.id}:a`]).toMatchObject({ coverage: "partial", followUp: "Fit comparison not shown" });
  });

  it("the scripted rehearsal declares its unfinished points as a manual follow-up, and Review shows it", () => {
    const review = buildReview(runScript(createScenarioSession("buffered")))!;
    const hoodie = review.rows.find((r) => r.title === "Zip Hoodie")!;
    expect(hoodie.coverage).toBe("partial");
    expect(hoodie.followUp).toContain("cover in Q&A");
    expect(hoodie.outcome).toBe("completed"); // ran its committed 9:00 — not "closed early"
    const qa = review.rows.find((r) => r.title === "Q&A")!;
    expect(qa.coverage).toBeNull(); // never declared, never assumed complete
  });
});

describe("UI-09 a backward device clock never moves time or risk backwards", () => {
  it("keeps counting from the latest time and reports the gap", () => {
    const first = advanceDeviceClock(null, at(13), 1000);
    expect(first.behindByMs).toBe(0);
    const back = advanceDeviceClock(first.state, at(11), 2000); // wall clock jumped back two minutes
    expect(back.state.nowMs).toBe(at(13) + 1000);
    expect(back.behindByMs).toBe(at(13) + 1000 - at(11));
    const forward = advanceDeviceClock(back.state, at(14), 62_000); // caught up
    expect(forward.behindByMs).toBe(0);
    expect(forward.state.nowMs).toBe(at(14));

    // With the kept time, a missed anchor stays missed (D11: queried at 13 then 11).
    let s = show([
      newSegment("a", { title: "A", targetSec: min(7), minSec: min(4) }),
      newSegment("give", { title: "Giveaway", kind: "promotion", targetSec: min(3), minSec: min(3), anchorOffsetSec: min(12) }),
    ]);
    s = run(s, at(5), { type: "start_live", rebaseToNow: false });
    expect(forecastSession(s, at(13)).segments.find((x) => x.segmentId === "give")!.anchor?.status).toBe("missed");
    expect(forecastSession(s, back.state.nowMs).segments.find((x) => x.segmentId === "give")!.anchor?.status).toBe("missed");
  });

  it("a REAL discontinuity can be recorded in history; rehearsals have no device clock", () => {
    let s = show([newSegment("a", { title: "A", targetSec: min(7), minSec: min(4) })]);
    s = run(s, at(0), { type: "start_live" });
    s = run(s, at(13), { type: "acknowledge_clock_discontinuity", deviceNowMs: at(11), keptNowMs: at(13) });
    expect(s.events[s.events.length - 1]).toMatchObject({ type: "clock_discontinuity", data: { behindSec: 120 } });
    const sim = runScript(createScenarioSession("buffered"), 1);
    expect(applyCommand(sim, { type: "acknowledge_clock_discontinuity", deviceNowMs: 1, keptNowMs: 2, nowMs: 0 }).receipt.code).toBe("wrong_environment");
  });
});

describe("UI-11 invalid numbers are rejected receipts, never exceptions", () => {
  const active = (): Session => {
    const s = show([
      newSegment("a", { title: "A", targetSec: min(6), minSec: min(4) }),
      newSegment("x", { title: "X", kind: "promotion", targetSec: min(3), minSec: min(3), anchorOffsetSec: min(12) }),
    ]);
    return run(s, at(0), { type: "start_live" });
  };
  it.each([
    { type: "commit_end_by", segmentId: "a", endByMs: Number.NaN },
    { type: "commit_end_by", segmentId: "a", endByMs: Number.POSITIVE_INFINITY },
    { type: "reanchor_segment", segmentId: "x", anchorOffsetSec: Number.POSITIVE_INFINITY, reason: "test" },
    { type: "set_remaining_estimate", segmentId: "a", remainingSec: Number.NaN },
    { type: "extend_segment", segmentId: "a", deltaSec: Number.NEGATIVE_INFINITY },
    { type: "report_manual_action", action: "other", targetLabel: "x", report: "performed", occurredAtMs: Number.NaN },
  ] as CommandBody[])("%o", (body) => {
    const s = active();
    let result: ReturnType<typeof applyCommand> | null = null;
    expect(() => (result = applyCommand(s, { ...body, nowMs: at(1) }))).not.toThrow();
    expect(result!.receipt.outcome).toBe("rejected");
    expect(result!.receipt.code).toBe("invalid_payload");
    expect(result!.session).toBe(s);
  });

  it("a non-finite device time and out-of-range values are rejected too", () => {
    const s = active();
    expect(applyCommand(s, { type: "add_note", text: "x", nowMs: Number.NaN }).receipt.code).toBe("invalid_payload");
    expect(applyCommand(s, { type: "commit_end_by", segmentId: "a", endByMs: at(60 * 48), nowMs: at(1) }).receipt.code).toBe("invalid_payload");
    expect(applyCommand(s, { type: "reanchor_segment", segmentId: "x", anchorOffsetSec: 10 * 86_400, reason: "test", nowMs: at(1) }).receipt.code).toBe("invalid_payload");
    const sim = createScenarioSession("buffered");
    expect(applyCommand(sim, { type: "set_clock", toMs: Number.POSITIVE_INFINITY, nowMs: 0 }).receipt.code).toBe("invalid_payload");
  });
});

describe("UI-12 import never promises N products and creates fewer", () => {
  it("distinct codes that normalise alike keep distinct identities", () => {
    const rows = parseProductRows("A-B\tFirst item\t0\nA_B\tSecond item\t", []);
    expect(rows.map((r) => r.status)).toEqual(["valid", "valid"]);
    const products = toProductSnapshots(rows, "Imported");
    expect(products.length).toBe(2);
    expect(new Set(products.map((p) => p.id)).size).toBe(2);
    expect(products.map((p) => p.price)).toEqual([0, null]); // zero and missing stay distinct
    const again = toProductSnapshots(rows, "Imported", products.map((p) => p.id));
    expect(again.map((p) => p.id)).toEqual(["prod_a_b_3", "prod_a_b_4"]);
  });

  it("a duplicate code is reported in the preview, not silently dropped", () => {
    const rows = parseProductRows("M02, Zip Hoodie again, 30", ["M02"]);
    expect(rows[0].status).toBe("duplicate");
  });
});

describe("UI-13 cue product references stay valid", () => {
  const pin: Cue = { id: "c1", title: "Pin P", audience: "operator", action: "pin_product", productId: "p1", timing: { type: "segment_start", segmentId: "s1", offsetSec: 0 }, text: null };
  const seg = newSegment("s1", { title: "Intro", kind: "opening", targetSec: min(5), minSec: min(4) });
  const p1 = { id: "p1", code: "P1", name: "Product one", price: 10, currency: "USD", priority: "normal" as const, status: "enabled" as const, talkingPoints: [], constraints: [], initials: "P1" };

  it("removing a product a cue targets is visible as a reference, and a dangling cue blocks Start", () => {
    const withProduct = show([seg], { cues: [pin], products: [p1] });
    expect(productReferences(withProduct.plans[0], "p1").cues.map((c) => c.id)).toEqual(["c1"]);
    const dangling = show([seg], { cues: [pin], products: [] });
    const issue = validatePlan(dangling.plans[0], [], "UTC").find((i) => i.code === "cue_product_missing");
    expect(issue?.severity).toBe("blocker");
    expect(applyCommand(dangling, { type: "start_live", nowMs: T0 }).receipt.code).toBe("plan_invalid");
    const noProduct = show([seg], { cues: [{ ...pin, productId: null }], products: [p1] });
    expect(validatePlan(noProduct.plans[0], [p1], "UTC").some((i) => i.code === "cue_product_missing")).toBe(true);
  });
});

describe("UI-14 an incomplete actual is never shown as 'did not run'", () => {
  it("a recorded start without an end is incomplete, with no invented end", () => {
    const done = runScript(createScenarioSession("buffered"));
    const broken = structuredClone(done);
    broken.runtime.segments[`${done.id}:a`].endedAtMs = null;
    const row = buildReview(broken)!.rows.find((r) => r.title === "Zip Hoodie")!;
    expect(row.outcome).toBe("incomplete");
    expect(row.actual).toBeNull();
    expect(row.recordedStartMs).toBe(at(3));
    expect(row.durationVarianceSec).toBeNull();
    expect(buildReview(broken)!.summary.counts.incomplete).toBe(1);
    expect(buildReview(broken)!.summary.counts.notReached).toBe(0);
  });
});
