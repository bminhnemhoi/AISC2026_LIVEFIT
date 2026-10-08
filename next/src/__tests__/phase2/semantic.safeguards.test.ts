import { describe, expect, it } from "vitest";
import {
  SCENARIO_START_MS,
  analyzeRecovery,
  anchorLateMs,
  applyCommand,
  createScenarioSession,
  createSession,
  forecastSession,
  isAnchorDueNow,
  newSegment,
  runScript,
} from "@/lib/domain";
import type { CueRun, Session } from "@/contracts/session";

const T0 = SCENARIO_START_MS;
const min = (m: number): number => m * 60;

function createTestRealSession(): Session {
  return createSession({
    id: "sess-semantic-01",
    title: "Semantic Safeguards Real Session",
    environment: "REAL",
    timezone: "Asia/Ho_Chi_Minh",
    plannedStartMs: T0,
    nowMs: T0,
    segments: [
      newSegment("seg-open", { title: "Opening", targetSec: min(3), minSec: min(2) }),
      newSegment("seg-anchor", {
        title: "Flash Sale",
        kind: "promotion",
        targetSec: min(5),
        minSec: min(3),
        anchorOffsetSec: min(8),
      }),
      newSegment("seg-close", { title: "Closing", targetSec: min(2), minSec: min(1) }),
    ],
    products: [
      {
        id: "p1",
        code: "SKU1",
        name: "Item 1",
        price: 10,
        currency: "USD",
        priority: "normal",
        status: "enabled",
        talkingPoints: [],
        constraints: [],
        initials: "I1",
      },
    ],
    cues: [
      {
        id: "cue-pin",
        title: "Pin SKU1",
        audience: "operator",
        action: "pin_product",
        productId: "p1",
        timing: { type: "segment_start", segmentId: "seg-anchor", offsetSec: 0 },
        text: null,
      },
    ],
  });
}

describe("Phase 2 Semantic Invariant Safeguards", () => {
  describe("Invariant 1: Missing != zero", () => {
    it("distinguishes missing estimate from 0 seconds remaining estimate", () => {
      let session = createTestRealSession();
      session = applyCommand(session, { type: "start_live", nowMs: T0 }).session;
      session = applyCommand(session, { type: "start_segment", segmentId: "seg-open", nowMs: T0 }).session;

      // 1. Initial state: remaining estimate is missing (null)
      expect(session.runtime.segments["seg-open"].remainingEstimate).toBeNull();

      // 2. Host says 0 seconds left: explicit 0 remaining estimate
      const withZero = applyCommand(session, {
        type: "set_remaining_estimate",
        segmentId: "seg-open",
        remainingSec: 0,
        nowMs: T0 + 10_000,
      }).session;

      expect(withZero.runtime.segments["seg-open"].remainingEstimate).not.toBeNull();
      expect(withZero.runtime.segments["seg-open"].remainingEstimate?.endsAtMs).toBe(T0 + 10_000);

      // 3. Clear estimate: explicitly null again, not 0
      const cleared = applyCommand(withZero, {
        type: "set_remaining_estimate",
        segmentId: "seg-open",
        remainingSec: null,
        nowMs: T0 + 15_000,
      }).session;
      expect(cleared.runtime.segments["seg-open"].remainingEstimate).toBeNull();
    });
  });

  describe("Invariant 2: Planned != actual", () => {
    it("preserves baseline plan immutable across runtime execution", () => {
      const initial = createTestRealSession();
      const baselineStart = initial.plans[0].plannedStartMs;
      const baselineTarget = initial.plans[0].segments[0].targetSec;

      // Run live and advance segments
      let live = applyCommand(initial, { type: "start_live", nowMs: T0 + 50_000 }).session;
      live = applyCommand(live, { type: "start_segment", segmentId: "seg-open", nowMs: T0 + 50_000 }).session;

      // Baseline plan remains untouched
      expect(live.plans[0].plannedStartMs).toBe(baselineStart);
      expect(live.plans[0].segments[0].targetSec).toBe(baselineTarget);

      // Actual runtime timestamps record the actual start
      expect(live.runtime.startedAtMs).toBe(T0 + 50_000);
      expect(live.runtime.startedAtMs).not.toBe(baselineStart);
    });
  });

  describe("Invariant 3: Recommendation != acceptance", () => {
    it("generating recovery options causes zero mutation to session state", () => {
      const session = runScript(createScenarioSession("buffered"), 3);
      const snapshotBefore = JSON.stringify(session);

      const recovery = analyzeRecovery(session, T0 + 7 * 60_000);
      expect(recovery.options.length).toBeGreaterThan(0);

      // Pure read: session was not altered
      expect(JSON.stringify(session)).toBe(snapshotBefore);
    });
  });

  describe("Invariant 4: Acceptance != attempt (Recovery Metadata Invariant)", () => {
    it("ordinary command produces no recovery_selected event", () => {
      let session = createTestRealSession();
      session = applyCommand(session, { type: "start_live", nowMs: T0 }).session;
      session = applyCommand(session, { type: "start_segment", segmentId: "seg-open", nowMs: T0 }).session;

      const eventCountBefore = session.events.length;
      const res = applyCommand(session, {
        type: "shorten_segment",
        segmentId: "seg-open",
        newTargetSec: min(2),
        nowMs: T0 + 10_000,
      });

      expect(res.receipt.outcome).toBe("committed");
      const newEvents = res.session.events.slice(eventCountBefore);
      // Ordinary command produces plan_changed, NOT recovery_selected
      expect(newEvents.some((e) => e.type === "recovery_selected")).toBe(false);
      expect(newEvents.some((e) => e.type === "plan_changed")).toBe(true);
    });

    it("choosing recovery records durable recovery_selected event with preserved metadata without marking cues attempted", () => {
      const session = runScript(createScenarioSession("buffered"), 3);
      const recovery = analyzeRecovery(session, T0 + 7 * 60_000);
      const selectedOption = recovery.options[0];
      const commandKey = "cmd-rec-meta-test";

      const firstApply = applyCommand(session, {
        ...selectedOption.command,
        key: commandKey,
        nowMs: T0 + 7 * 60_000,
        recoveryId: selectedOption.id,
        recoveryLabel: selectedOption.label,
      });
      const applied = firstApply.session;

      const newEvents = applied.events.slice(session.events.length);
      expect(newEvents[0].type).toBe("recovery_selected");
      expect(newEvents[0].data.recoveryId).toBe(selectedOption.id);
      expect(newEvents[0].data.label).toBe(selectedOption.label);

      // Cues are not marked attempted merely because a recovery option was accepted
      const allCuesPendingOrPerformed = Object.values(applied.runtime.cues).every(
        (c: CueRun) => c.state === "pending" || c.state === "performed"
      );
      expect(allCuesPendingOrPerformed).toBe(true);
      expect(Object.values(applied.runtime.cues).some((c: CueRun) => c.state === "attempted")).toBe(false);

      // Duplicate delivery of same command adds nothing
      const secondApply = applyCommand(applied, {
        ...selectedOption.command,
        key: commandKey,
        nowMs: T0 + 7 * 60_000,
        recoveryId: selectedOption.id,
        recoveryLabel: selectedOption.label,
      });

      expect(secondApply.receipt.outcome).toBe("committed");
      expect(secondApply.session.events.length).toBe(applied.events.length);
      expect(secondApply.session.revision).toBe(applied.revision);
    });
  });

  describe("Invariant 5: Attempt != performed", () => {
    it("operator reported cue is distinct from performed and never platform confirmed", () => {
      let session = createTestRealSession();
      session = applyCommand(session, { type: "start_live", nowMs: T0 }).session;
      session = applyCommand(session, { type: "start_segment", segmentId: "seg-open", nowMs: T0 }).session;

      // Operator reports cue action as performed
      const reported = applyCommand(session, {
        type: "report_cue",
        cueId: "cue-pin",
        report: "performed",
        occurredAtMs: T0 + 12_000,
        nowMs: T0 + 13_000,
      }).session;

      const cue = reported.runtime.cues["cue-pin"];
      expect(cue.state).toBe("performed");
      expect(cue.occurredAtMs).toBe(T0 + 12_000);
      expect(cue.reportedAtMs).toBe(T0 + 13_000);

      // Model does not possess any platform-confirmed state
      expect(JSON.stringify(reported)).not.toMatch(/platform_confirmed|confirmed_by_platform/i);
    });
  });

  describe("Invariant 6: Unknown != failed", () => {
    it("mark_remaining_unknown suppresses target end without failing segment", () => {
      let session = createTestRealSession();
      session = applyCommand(session, { type: "start_live", nowMs: T0 }).session;
      session = applyCommand(session, { type: "start_segment", segmentId: "seg-open", nowMs: T0 }).session;

      const unknownResult = applyCommand(session, {
        type: "mark_remaining_unknown",
        segmentId: "seg-open",
        nowMs: T0 + 60_000,
      });

      expect(unknownResult.receipt.outcome).toBe("committed");
      const seg = unknownResult.session.runtime.segments["seg-open"];
      expect(seg.remainingUnknownAtMs).toBe(T0 + 60_000);
      expect(seg.state).toBe("active"); // Segment is still active, not failed
    });
  });

  describe("Invariant 7: REAL != SIMULATED", () => {
    it("REAL session rejects simulation clock mutation commands", () => {
      const real = createTestRealSession();
      expect(real.environment).toBe("REAL");

      // advance_clock and set_clock are prohibited on REAL sessions
      const advanceResult = applyCommand(real, {
        type: "advance_clock",
        byMs: 5000,
        nowMs: T0,
      });
      expect(advanceResult.receipt.outcome).toBe("rejected");
      expect(advanceResult.receipt.code).toBe("wrong_environment");

      const setClockResult = applyCommand(real, {
        type: "set_clock",
        toMs: T0 + 10_000,
        nowMs: T0,
      });
      expect(setClockResult.receipt.outcome).toBe("rejected");
      expect(setClockResult.receipt.code).toBe("wrong_environment");
    });
  });

  describe("Invariant 8: Completed != coverage complete", () => {
    it("ending a segment after minimum duration never automatically implies complete coverage", () => {
      let session = createTestRealSession();
      session = applyCommand(session, { type: "start_live", nowMs: T0 }).session;
      session = applyCommand(session, { type: "start_segment", segmentId: "seg-open", nowMs: T0 }).session;

      // Ended after target duration without declaring coverage
      const endedNoCoverage = applyCommand(session, {
        type: "end_segment",
        segmentId: "seg-open",
        nowMs: T0 + min(4) * 1000, // 4 mins, well past minSec (2 mins)
      }).session;

      const segRun = endedNoCoverage.runtime.segments["seg-open"];
      expect(segRun.state).toBe("completed");
      // Duration never implies coverage: coverage must stay null if not explicitly declared!
      expect(segRun.coverage).toBeNull();

      // Ending with explicit partial coverage retains partial
      const endedPartial = applyCommand(session, {
        type: "end_segment",
        segmentId: "seg-open",
        coverage: "partial",
        followUp: "Did not finish intro remarks",
        nowMs: T0 + min(4) * 1000,
      }).session;

      expect(endedPartial.runtime.segments["seg-open"].coverage).toBe("partial");
      expect(endedPartial.runtime.segments["seg-open"].followUp).toBe("Did not finish intro remarks");
    });
  });

  describe("Invariant 9: Hard-anchor truth", () => {
    it("hard-anchor commitment time does not move silently and strictly enforces 0ms boundary", () => {
      const session = runScript(createScenarioSession("buffered"), 2);
      const anchorTimeMs = T0 + 12 * 60_000;
      const forecastAtExact = forecastSession(session, anchorTimeMs);
      const flash = forecastAtExact.segments.find((s) => s.segmentId.endsWith(":flash"))!;

      expect(flash.anchor).toBeDefined();
      expect(flash.anchor!.committedMs).toBe(anchorTimeMs);

      // Exactly at anchor instant (0 ms late): status is missed, but isAnchorDueNow is true
      expect(isAnchorDueNow(flash.anchor!)).toBe(true);
      expect(anchorLateMs(flash.anchor!)).toBe(0);

      // +1 ms late: never due now, missed
      const forecastLate = forecastSession(session, anchorTimeMs + 1);
      const flashLate = forecastLate.segments.find((s) => s.segmentId.endsWith(":flash"))!;
      expect(isAnchorDueNow(flashLate.anchor!)).toBe(false);
      expect(anchorLateMs(flashLate.anchor!)).toBe(1);
    });
  });
});
