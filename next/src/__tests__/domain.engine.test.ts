import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Session } from "@/contracts";
import {
  SCENARIO_START_MS,
  analyzeRecovery,
  anchorMs,
  applyCommand,
  baselinePlan,
  createScenarioSession,
  createSession,
  currentPlan,
  forecastSession,
  newSegment,
  runScript,
  type CommandBody,
} from "@/lib/domain";

const T0 = SCENARIO_START_MS;
const at = (m: number, s = 0): number => T0 + (m * 60 + s) * 1000;
const min = (m: number): number => m * 60;

function run(session: Session, nowMs: number, body: CommandBody): Session {
  const r = applyCommand(session, { ...body, nowMs });
  if (r.receipt.outcome !== "committed") throw new Error(`${body.type}: ${r.receipt.code} ${r.receipt.message}`);
  return r.session;
}

/** A REAL manual show with an operator cue and a pin/unpin pair. */
function realShow(): Session {
  return createSession({
    id: "t-real",
    title: "Manual show",
    environment: "REAL",
    timezone: "Asia/Ho_Chi_Minh",
    plannedStartMs: T0,
    nowMs: T0,
    segments: [
      newSegment("a", { title: "Product A", targetSec: min(6), minSec: min(4) }),
      newSegment("give", { title: "Giveaway", kind: "promotion", targetSec: min(3), minSec: min(2), anchorOffsetSec: min(12) }),
      newSegment("b", { title: "Product B", targetSec: min(8), minSec: min(6) }),
      newSegment("qa", { title: "Q&A", kind: "qa", optional: true, targetSec: min(3), minSec: min(2) }),
    ],
    // A pin/unpin cue must name a product in the pack (UI-13): the fixture carries one.
    products: [{ id: "prod_b", code: "B", name: "Product B", price: null, currency: "USD", priority: "normal", status: "enabled", talkingPoints: [], constraints: [], initials: "PB" }],
    cues: [
      { id: "pin", title: "Pin Product B", audience: "operator", action: "pin_product", productId: "prod_b", timing: { type: "segment_start", segmentId: "b", offsetSec: 0 }, text: null },
      { id: "unpin", title: "Unpin Product B", audience: "operator", action: "unpin_product", productId: "prod_b", timing: { type: "segment_end", segmentId: "b", offsetSec: 0 }, text: null },
      { id: "say", title: "Mention sizing", audience: "presenter", action: "none", productId: null, timing: { type: "segment_start", segmentId: "b", offsetSec: 30 }, text: null },
    ],
  });
}

function started(): Session {
  return run(realShow(), at(0), { type: "start_live" });
}

describe("command receipts", () => {
  it("a duplicate key returns the committed outcome and re-applies nothing", () => {
    const s0 = started();
    const first = applyCommand(s0, { type: "add_note", text: "Host mentioned restock", nowMs: at(1), key: "k-note" });
    expect(first.receipt.outcome).toBe("committed");
    const again = applyCommand(first.session, { type: "add_note", text: "Host mentioned restock", nowMs: at(2), key: "k-note" });
    expect(again.duplicate).toBe(true);
    expect(again.receipt).toEqual(first.receipt);
    expect(again.session.events.length).toBe(first.session.events.length);
    expect(again.session.revision).toBe(first.session.revision);
  });

  it("a stale expected revision is rejected and changes nothing", () => {
    const s0 = started();
    const s1 = run(s0, at(1), { type: "add_note", text: "n1" });
    const stale = applyCommand(s1, { type: "add_note", text: "n2", nowMs: at(2), expectedRevision: s0.revision });
    expect(stale.receipt.outcome).toBe("rejected");
    expect(stale.receipt.code).toBe("stale_revision");
    expect(stale.session).toBe(s1);
  });

  it("two conflicting 'next segment' requests: the second sees a moved revision and is rejected", () => {
    const s0 = started();
    const rev = s0.revision;
    const first = applyCommand(s0, { type: "advance_segment", nowMs: at(6), expectedRevision: rev });
    expect(first.receipt.outcome).toBe("committed");
    const second = applyCommand(first.session, { type: "advance_segment", nowMs: at(6), expectedRevision: rev });
    expect(second.receipt.code).toBe("stale_revision");
  });

  it("unknown segment and cue ids are not found, never silently mapped to something else", () => {
    const s0 = started();
    expect(applyCommand(s0, { type: "skip_segment", segmentId: "nope", nowMs: at(1) }).receipt.code).toBe("not_found");
    expect(applyCommand(s0, { type: "report_cue", cueId: "nope", report: "performed", nowMs: at(1) }).receipt.code).toBe("not_found");
  });
});

describe("ended sessions are frozen", () => {
  function ended(): Session {
    let s = started();
    s = run(s, at(6), { type: "advance_segment" });
    return run(s, at(8), { type: "end_live" });
  }

  it("runtime commands are rejected after End; notes and corrections are still allowed", () => {
    const s = ended();
    for (const body of [
      { type: "advance_segment" },
      { type: "start_segment", segmentId: "b" },
      { type: "skip_segment", segmentId: "qa" },
      { type: "extend_segment", segmentId: "b", deltaSec: 60 },
      { type: "end_live" },
    ] as CommandBody[]) {
      const r = applyCommand(s, { ...body, nowMs: at(9) });
      expect(r.receipt.outcome).toBe("rejected");
      expect(r.receipt.code).toBe("invalid_state");
    }
    const note = applyCommand(s, { type: "add_note", text: "Reviewed", nowMs: at(30) });
    expect(note.receipt.outcome).toBe("committed");
  });

  it("history is append-only: a correction adds a record and leaves the original untouched", () => {
    const s = ended();
    const target = s.events.find((e) => e.type === "segment_ended")!;
    const before = structuredClone(s.events);
    const corrected = run(s, at(30), { type: "append_correction", targetEventId: target.id, text: "Host says it ended a minute later" });
    expect(corrected.events.slice(0, before.length)).toEqual(before);
    expect(corrected.events.length).toBe(before.length + 1);
    expect(corrected.events[corrected.events.length - 1].type).toBe("correction_added");
    expect(corrected.runtime).toEqual(s.runtime);
  });

  it("corrections are rejected before the show ends", () => {
    const s = started();
    const r = applyCommand(s, { type: "append_correction", targetEventId: s.events[0].id, text: "x y z", nowMs: at(1) });
    expect(r.receipt.code).toBe("invalid_state");
  });
});

describe("hard anchors never move silently", () => {
  const giveMs = at(12);

  it("shorten, extend, skip, advance and reorder leave every anchor where it was committed", () => {
    let s = started();
    s = run(s, at(1), { type: "extend_segment", segmentId: "a", deltaSec: 60 });
    s = run(s, at(2), { type: "shorten_segment", segmentId: "b", newTargetSec: min(7) });
    s = run(s, at(3), { type: "skip_segment", segmentId: "qa" });
    s = run(s, at(6), { type: "advance_segment" });
    const plan = currentPlan(s);
    const give = plan.segments.find((x) => x.id === "give")!;
    expect(anchorMs(plan, give)).toBe(giveMs);
  });

  it("an anchored segment cannot be started before its committed time", () => {
    let s = started();
    s = run(s, at(5), { type: "advance_segment" }); // A ends at 20:05; the giveaway waits for 20:12
    expect(s.runtime.currentSegmentId).toBeNull();
    const early = applyCommand(s, { type: "start_segment", segmentId: "give", nowMs: at(8) });
    expect(early.receipt.code).toBe("anchor_not_reached");
    const stillEarly = applyCommand(s, { type: "advance_segment", nowMs: at(9) });
    expect(stillEarly.receipt.code).toBe("anchor_not_reached");
    const onTime = run(s, at(12), { type: "advance_segment" });
    expect(onTime.runtime.currentSegmentId).toBe("give");
  });

  it("reordering cannot cross a hard anchor, and an anchored segment cannot be reordered", () => {
    const s = started();
    const cross = applyCommand(s, { type: "reorder_segment", segmentId: "qa", beforeSegmentId: "give", nowMs: at(1) });
    expect(cross.receipt.code).toBe("constraint_violation");
    expect(cross.receipt.message).toContain("hard anchor");
    const moveAnchor = applyCommand(s, { type: "reorder_segment", segmentId: "give", beforeSegmentId: "b", nowMs: at(1) });
    expect(moveAnchor.receipt.code).toBe("constraint_violation");
    // Within a block it is allowed and marks the displaced segment as deferred.
    const ok = run(s, at(1), { type: "reorder_segment", segmentId: "qa", beforeSegmentId: "b" });
    expect(currentPlan(ok).segments.map((x) => x.id)).toEqual(["a", "give", "qa", "b"]);
    expect(ok.runtime.segments["b"].deferred).toBe(true);
  });

  it("re-anchoring is explicit: a new plan version, with the baseline commitment intact", () => {
    let s = started();
    s = run(s, at(6), { type: "advance_segment" });
    const baselineBefore = structuredClone(baselinePlan(s));
    const re = run(s, at(7), { type: "reanchor_segment", segmentId: "give", anchorOffsetSec: min(14), reason: "Host needs two more minutes" });
    expect(re.plans.length).toBe(s.plans.length + 1);
    expect(currentPlan(re).kind).toBe("revision");
    expect(anchorMs(currentPlan(re), currentPlan(re).segments.find((x) => x.id === "give")!)).toBe(at(14));
    expect(baselinePlan(re)).toEqual(baselineBefore);
    expect(anchorMs(baselinePlan(re), baselinePlan(re).segments.find((x) => x.id === "give")!)).toBe(giveMs);
    const ev = re.events.find((e) => e.type === "anchor_changed")!;
    expect(ev.data.fromMs).toBe(giveMs);
    expect(ev.data.toMs).toBe(at(14));
  });

  it("the baseline is immutable for the whole show", () => {
    const base = structuredClone(realShow().plans[0]);
    let s = started();
    s = run(s, at(1), { type: "extend_segment", segmentId: "a", deltaSec: 120 });
    s = run(s, at(2), { type: "skip_segment", segmentId: "qa" });
    s = run(s, at(7), { type: "advance_segment" });
    s = run(s, at(13), { type: "end_live" });
    expect(baselinePlan(s)).toEqual({ ...base, kind: "baseline" });
    expect(s.baselineLocked).toBe(true);
  });
});

describe("recommendation != acceptance != performed", () => {
  it("analysing recovery changes nothing; choosing an option records the decision, then the transition", () => {
    const s = runScript(createScenarioSession("buffered"), 3);
    const revisionBefore = s.revision;
    const analysis = analyzeRecovery(s, at(7));
    expect(s.revision).toBe(revisionBefore);
    const option = analysis.options[0];
    const r = applyCommand(s, { ...option.command, nowMs: at(7), recoveryId: option.id, recoveryLabel: option.label });
    expect(r.receipt.outcome).toBe("committed");
    const types = r.session.events.slice(s.events.length).map((e) => e.type);
    expect(types[0]).toBe("recovery_selected");
    expect(types).toContain("plan_changed");
    // Accepting a recovery is not proof anything was announced on the platform.
    expect(Object.values(r.session.runtime.cues).every((c) => c.state === "pending")).toBe(true);
  });
});

describe("cue reports", () => {
  it("attempted != performed, and neither is platform confirmation", () => {
    let s = started();
    s = run(s, at(6), { type: "advance_segment" }); // wait: A ends, giveaway anchored; use b instead
    const s2 = run(s, at(12), { type: "advance_segment" });
    const s3 = run(s2, at(15), { type: "advance_segment" }); // B starts
    const attempted = run(s3, at(15, 10), { type: "report_cue", cueId: "pin", report: "attempted" });
    expect(attempted.runtime.cues["pin"].state).toBe("attempted");
    const performed = run(attempted, at(15, 20), { type: "report_cue", cueId: "pin", report: "performed", occurredAtMs: at(15, 15) });
    expect(performed.runtime.cues["pin"].state).toBe("performed");
    const ev = performed.events.filter((e) => e.type === "cue_reported");
    expect(ev.every((e) => e.data.verification === "unknown")).toBe(true);
    expect(ev[ev.length - 1].occurredAtMs).toBe(at(15, 15));
    expect(ev[ev.length - 1].recordedAtMs).toBe(at(15, 20));
  });

  it("a performed cue cannot be silently overwritten", () => {
    let s = started();
    s = run(s, at(6), { type: "advance_segment" });
    s = run(s, at(12), { type: "advance_segment" });
    s = run(s, at(15), { type: "advance_segment" });
    s = run(s, at(16), { type: "report_cue", cueId: "pin", report: "performed" });
    const again = applyCommand(s, { type: "report_cue", cueId: "pin", report: "cancelled", reason: "changed my mind", nowMs: at(17) });
    expect(again.receipt.code).toBe("already_reported");
  });

  it("cancelling a cue needs a reason; presenter cues cannot be reported", () => {
    const s = started();
    const noReason = applyCommand(s, { type: "report_cue", cueId: "pin", report: "cancelled", nowMs: at(1) });
    expect(noReason.receipt.code).toBe("invalid_payload");
    const presenter = applyCommand(s, { type: "report_cue", cueId: "say", report: "performed", nowMs: at(1) });
    expect(presenter.receipt.code).toBe("invalid_payload");
  });

  it("pin and unpin are distinct enum values, never matched by substring", () => {
    const plan = currentPlan(started());
    const pin = plan.cues.find((c) => c.id === "pin")!;
    const unpin = plan.cues.find((c) => c.id === "unpin")!;
    expect(pin.action).toBe("pin_product");
    expect(unpin.action).toBe("unpin_product");
    expect(pin.action === unpin.action).toBe(false);
  });
});

describe("clocks", () => {
  it("REAL sessions never accept a virtual clock command", () => {
    const r = applyCommand(started(), { type: "advance_clock", byMs: 1000, nowMs: at(1) });
    expect(r.receipt.code).toBe("wrong_environment");
  });

  it("SIMULATED sessions use their virtual clock and ignore the device time", () => {
    const sim = createScenarioSession("buffered");
    const r = applyCommand(sim, { type: "start_live", nowMs: Date.UTC(2031, 0, 1) });
    expect(r.session.runtime.startedAtMs).toBe(SCENARIO_START_MS);
    expect(r.session.events.every((e) => e.source === "simulator")).toBe(true);
  });

  it("the virtual clock only moves forward", () => {
    const sim = createScenarioSession("buffered");
    const fwd = run(sim, 0, { type: "advance_clock", byMs: 60_000 });
    expect(fwd.virtualNowMs).toBe(SCENARIO_START_MS + 60_000);
    expect(applyCommand(fwd, { type: "set_clock", toMs: SCENARIO_START_MS, nowMs: 0 }).receipt.code).toBe("invalid_payload");
  });

  it("a device clock that goes backwards is clamped to the last recorded time", () => {
    let s = started();
    s = run(s, at(5), { type: "add_note", text: "later" });
    const back = run(s, at(2), { type: "add_note", text: "earlier clock" });
    expect(back.events[back.events.length - 1].recordedAtMs).toBe(at(5));
  });
});

describe("forecast purity", () => {
  it("does not mutate the session", () => {
    const s = started();
    const snapshot = structuredClone(s);
    forecastSession(s, at(3));
    analyzeRecovery(s, at(3));
    expect(s).toEqual(snapshot);
  });

  it("domain source never reads the system clock or randomness", () => {
    const dir = path.resolve(__dirname, "../lib/domain");
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const text = readFileSync(path.join(dir, file), "utf8");
      if (/Math\.random\s*\(|Date\.now\s*\(|new Date\(\s*\)/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("committing an end time", () => {
  it("one that changes nothing is rejected instead of recorded as a plan revision", () => {
    let s = runScript(createScenarioSession("buffered"), 3); // host estimate at 20:07
    const id = `${s.id}:a`;
    s = run(s, at(7), { type: "commit_end_by", segmentId: id, endByMs: at(12) });
    const plans = s.plans.length;
    const again = applyCommand(s, { type: "commit_end_by", segmentId: id, endByMs: at(12), nowMs: at(7) });
    expect(again.receipt.outcome).toBe("rejected");
    expect(again.receipt.message).toContain("already committed");
    expect(again.session.plans.length).toBe(plans);
  });

  it("the same end time still counts when it clears a standing host estimate", () => {
    const s = runScript(createScenarioSession("buffered"), 3); // target 6:00, host estimate to 20:13
    const r = applyCommand(s, { type: "commit_end_by", segmentId: `${s.id}:a`, endByMs: at(9), nowMs: at(7) });
    // 20:09 equals the existing 6:00 target, but the estimate (20:13) is being superseded: that is a real change.
    expect(r.receipt.outcome).toBe("committed");
    expect(r.session.runtime.segments[`${s.id}:a`].remainingEstimate).toBeNull();
  });
});
