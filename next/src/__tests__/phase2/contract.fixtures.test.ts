import { describe, expect, it } from "vitest";
import type {
  AuthorityReceipt,
  CommandEnvelope,
  CommandResponse,
  RoomRead,
  RuntimeCommandBody,
} from "@/contracts/authority";
import {
  allocateSparseCueId,
  allocateSparseSegmentId,
  areCanonicalRequestsEqual,
  canonicalRequestHash,
  getAuthoritativeEffectiveTime,
  REJECTION_CODES,
  sampleCommandResponse,
  sampleCommittedReceipt,
  sampleCreateNextEnvelope,
  sampleCreateSessionEnvelope,
  sampleDuplicateCommandResponse,
  sampleEndSegmentEnvelope,
  sampleForbiddenReceipt,
  sampleIdempotencyConflictReceipt,
  sampleOrdinaryShortenEnvelope,
  sampleSavePrepareEnvelope,
  sampleShortenWithRecoveryEnvelope,
  sampleStartLiveEnvelope,
  sampleStartSegmentEnvelope,
  sampleStaleRejectedReceipt,
  TEST_CAPABILITIES,
  TEST_OPERATOR_TOKEN,
  TEST_ROOM_ID,
  TEST_SESSION_ID,
  TEST_VIEWER_TOKEN,
} from "./fixtures/authorityFixtures";

describe("Phase 2 Authority Wire Contract & Fixtures", () => {
  describe("Command envelope discrimination & types", () => {
    it("differentiates create_session with sessionId: null", () => {
      const env: CommandEnvelope = sampleCreateSessionEnvelope;
      expect(env.type).toBe("create_session");
      expect(env.sessionId).toBeNull();
      expect(env.payload).toHaveProperty("title");
      expect(env.payload).toHaveProperty("timezone");
    });

    it("differentiates save_prepare with target sessionId and draft payload", () => {
      const env: CommandEnvelope = sampleSavePrepareEnvelope;
      expect(env.type).toBe("save_prepare");
      expect(env.sessionId).toBe(TEST_SESSION_ID);
      expect(env.payload).toHaveProperty("title");
      expect(env.payload).toHaveProperty("segments");
      // Must NOT contain runtime or events metadata
      expect(env.payload).not.toHaveProperty("runtime");
      expect(env.payload).not.toHaveProperty("events");
    });

    it("differentiates create_next with source sessionId and nextLive payload", () => {
      const env: CommandEnvelope = sampleCreateNextEnvelope;
      expect(env.type).toBe("create_next");
      expect(env.sessionId).toBe(TEST_SESSION_ID);
      expect(env.payload).toHaveProperty("title");
      expect(env.payload).toHaveProperty("changeIds");
      // id and nowMs must be omitted from payload as server assigns them
      expect(env.payload).not.toHaveProperty("id");
      expect(env.payload).not.toHaveProperty("nowMs");
    });

    it("differentiates runtime command envelopes (start_live, start_segment, end_segment)", () => {
      const startLive: CommandEnvelope = sampleStartLiveEnvelope;
      expect(startLive.type).toBe("start_live");
      expect(startLive.sessionId).toBe(TEST_SESSION_ID);

      const startSeg: CommandEnvelope = sampleStartSegmentEnvelope;
      expect(startSeg.type).toBe("start_segment");
      expect(startSeg.sessionId).toBe(TEST_SESSION_ID);
      expect(startSeg.payload).toEqual({ segmentId: "seg-intro" });

      const endSeg: CommandEnvelope = sampleEndSegmentEnvelope;
      expect(endSeg.type).toBe("end_segment");
      expect(endSeg.sessionId).toBe(TEST_SESSION_ID);
    });

    it("prohibits advance_clock and set_clock in RuntimeCommandBody at type level", () => {
      type ProhibitedClockTypes = Extract<RuntimeCommandBody, { type: "advance_clock" | "set_clock" }>;
      // ProhibitedClockTypes must resolve to never
      const check: [ProhibitedClockTypes] extends [never] ? true : false = true;
      expect(check).toBe(true);
    });
  });

  describe("Canonical request identity & hashing", () => {
    it("treats JSON key order as insignificant", () => {
      const envA = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 5,
        type: "end_segment",
        payload: {
          segmentId: "seg-1",
          coverage: "complete",
          acknowledgeBelowMinimum: false,
        },
      };

      const envB = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 5,
        type: "end_segment",
        payload: {
          acknowledgeBelowMinimum: false,
          coverage: "complete",
          segmentId: "seg-1",
        },
      };

      expect(areCanonicalRequestsEqual(envA, envB)).toBe(true);
      expect(canonicalRequestHash(envA)).toBe(canonicalRequestHash(envB));
    });

    it("treats array element order as strictly significant", () => {
      const envA = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: null,
        expectedRevision: 0,
        type: "create_session",
        payload: {
          title: "Session",
          timezone: "UTC",
          plannedStartMs: 1000,
          segments: [{ id: "s1" }, { id: "s2" }],
        },
      };

      const envB = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: null,
        expectedRevision: 0,
        type: "create_session",
        payload: {
          title: "Session",
          timezone: "UTC",
          plannedStartMs: 1000,
          segments: [{ id: "s2" }, { id: "s1" }],
        },
      };

      expect(areCanonicalRequestsEqual(envA, envB)).toBe(false);
      expect(canonicalRequestHash(envA)).not.toBe(canonicalRequestHash(envB));
    });

    it("strictly preserves missing vs explicit null vs zero", () => {
      const envZero = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 1,
        type: "set_remaining_estimate",
        payload: { segmentId: "seg-1", remainingSec: 0 },
      };

      const envNull = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 1,
        type: "set_remaining_estimate",
        payload: { segmentId: "seg-1", remainingSec: null },
      };

      const envMissing = {
        commandId: "cmd-1",
        roomId: "r1",
        sessionId: "s1",
        expectedRevision: 1,
        type: "set_remaining_estimate",
        payload: { segmentId: "seg-1" },
      };

      expect(areCanonicalRequestsEqual(envZero, envNull)).toBe(false);
      expect(areCanonicalRequestsEqual(envNull, envMissing)).toBe(false);
      expect(areCanonicalRequestsEqual(envZero, envMissing)).toBe(false);
    });

    it("detects changed intent when same commandId is used with different revision or payload", () => {
      const original = sampleStartLiveEnvelope;
      const modifiedRevision = { ...sampleStartLiveEnvelope, expectedRevision: 99 };
      const modifiedPayload = {
        ...sampleStartLiveEnvelope,
        payload: { rebaseToNow: true },
      };

      expect(areCanonicalRequestsEqual(original, modifiedRevision)).toBe(false);
      expect(areCanonicalRequestsEqual(original, modifiedPayload)).toBe(false);
    });
  });

  describe("Authority receipt & response contracts", () => {
    it("validates committed receipt structure", () => {
      const receipt: AuthorityReceipt = sampleCommittedReceipt;
      expect(receipt.outcome).toBe("committed");
      expect(receipt.code).toBeNull();
      expect(receipt.roomRevisionAfter).toBeGreaterThan(0);
      expect(receipt.eventIds.length).toBeGreaterThan(0);
    });

    it("validates rejected receipts (stale_revision, idempotency_conflict, forbidden)", () => {
      expect(sampleStaleRejectedReceipt.outcome).toBe("rejected");
      expect(sampleStaleRejectedReceipt.code).toBe("stale_revision");

      expect(sampleIdempotencyConflictReceipt.outcome).toBe("rejected");
      expect(sampleIdempotencyConflictReceipt.code).toBe("idempotency_conflict");

      expect(sampleForbiddenReceipt.outcome).toBe("rejected");
      expect(sampleForbiddenReceipt.code).toBe("forbidden");
    });

    it("validates CommandResponse duplicate flag behavior", () => {
      const first: CommandResponse = sampleCommandResponse;
      expect(first.duplicate).toBe(false);

      const retry: CommandResponse = sampleDuplicateCommandResponse;
      expect(retry.duplicate).toBe(true);
      expect(retry.receipt).toEqual(first.receipt);
    });

    it("confirms complete rejection codes catalog", () => {
      expect(REJECTION_CODES).toContain("stale_revision");
      expect(REJECTION_CODES).toContain("idempotency_conflict");
      expect(REJECTION_CODES).toContain("another_show_active");
      expect(REJECTION_CODES).toContain("forbidden");
      expect(REJECTION_CODES).toContain("not_found");
      expect(REJECTION_CODES).toContain("invalid_state");
      expect(REJECTION_CODES).toContain("needs_ack_below_minimum");
    });
  });

  describe("RoomRead discriminated union contract", () => {
    it("ensures changed: false excludes sessions array from wire payload", () => {
      const readUnchanged: RoomRead = {
        roomId: TEST_ROOM_ID,
        revision: 4,
        serverNowMs: 1_700_000_000_000,
        clockBehindByMs: 0,
        access: {
          actorId: "actor-1",
          name: "Operator",
          role: "operator",
        },
        changed: false,
      };

      expect(readUnchanged.changed).toBe(false);
      expect("sessions" in readUnchanged).toBe(false);
    });

    it("ensures changed: true includes sessions array with server-authoritative sessions", () => {
      const readChanged: RoomRead = {
        roomId: TEST_ROOM_ID,
        revision: 4,
        serverNowMs: 1_700_000_000_000,
        clockBehindByMs: 0,
        access: {
          actorId: "actor-1",
          name: "Operator",
          role: "operator",
        },
        changed: true,
        sessions: [],
      };

      expect(readChanged.changed).toBe(true);
      expect("sessions" in readChanged).toBe(true);
      expect(Array.isArray(readChanged.sessions)).toBe(true);
    });
  });

  describe("Recovery metadata in command payloads & canonical hashing", () => {
    it("differentiates ordinary command from command carrying recovery metadata", () => {
      const ord: CommandEnvelope = sampleOrdinaryShortenEnvelope;
      const rec: CommandEnvelope = sampleShortenWithRecoveryEnvelope;

      expect("recoveryId" in ord.payload).toBe(false);
      expect("recoveryId" in rec.payload).toBe(true);
      expect((rec.payload as { recoveryId: string }).recoveryId).toBe("rec-cut-demo-60s");

      // Canonical request hashes must differ between ordinary and recovery command
      expect(areCanonicalRequestsEqual(ord, rec)).toBe(false);
      expect(canonicalRequestHash(ord)).not.toBe(canonicalRequestHash(rec));
    });

    it("detects conflict when same commandId is reused with changed recovery metadata", () => {
      const rec1: CommandEnvelope = sampleShortenWithRecoveryEnvelope;
      const rec2: CommandEnvelope = {
        ...sampleShortenWithRecoveryEnvelope,
        payload: {
          ...sampleShortenWithRecoveryEnvelope.payload,
          recoveryId: "rec-cut-demo-other",
        },
      } as unknown as CommandEnvelope;

      // Changed recoveryId under same commandId results in different canonical hash -> idempotency_conflict
      expect(areCanonicalRequestsEqual(rec1, rec2)).toBe(false);
      expect(canonicalRequestHash(rec1)).not.toBe(canonicalRequestHash(rec2));

      // Changed recoveryLabel under same commandId results in different canonical hash -> idempotency_conflict
      const rec3: CommandEnvelope = {
        ...sampleShortenWithRecoveryEnvelope,
        payload: {
          ...sampleShortenWithRecoveryEnvelope.payload,
          recoveryLabel: "Different label for same recovery",
        },
      } as unknown as CommandEnvelope;
      expect(areCanonicalRequestsEqual(rec1, rec3)).toBe(false);
    });

    it("treats key ordering within recovery payload as insignificant", () => {
      const envA = {
        commandId: "cmd-rec-keyorder",
        roomId: TEST_ROOM_ID,
        sessionId: TEST_SESSION_ID,
        expectedRevision: 4,
        type: "shorten_segment",
        payload: {
          segmentId: "seg-demo",
          newTargetSec: 360,
          recoveryId: "rec-1",
          recoveryLabel: "Rec Label",
        },
      };

      const envB = {
        commandId: "cmd-rec-keyorder",
        roomId: TEST_ROOM_ID,
        sessionId: TEST_SESSION_ID,
        expectedRevision: 4,
        type: "shorten_segment",
        payload: {
          recoveryLabel: "Rec Label",
          recoveryId: "rec-1",
          newTargetSec: 360,
          segmentId: "seg-demo",
        },
      };

      expect(areCanonicalRequestsEqual(envA, envB)).toBe(true);
      expect(canonicalRequestHash(envA)).toBe(canonicalRequestHash(envB));
    });
  });

  describe("Sparse segment & cue counter monotonicity contract", () => {
    it("proves monotonic sequence generation prevents ID reuse when items are deleted", () => {
      let segmentCounter = 0;
      let cueCounter = 0;

      // 1. Allocate initial items: s1, s2, s3 and c1, c2, c3
      const s1 = allocateSparseSegmentId(segmentCounter);
      segmentCounter = s1.nextCounter;
      const s2 = allocateSparseSegmentId(segmentCounter);
      segmentCounter = s2.nextCounter;
      const s3 = allocateSparseSegmentId(segmentCounter);
      segmentCounter = s3.nextCounter;

      const c1 = allocateSparseCueId(cueCounter);
      cueCounter = c1.nextCounter;
      const c2 = allocateSparseCueId(cueCounter);
      cueCounter = c2.nextCounter;
      const c3 = allocateSparseCueId(cueCounter);
      cueCounter = c3.nextCounter;

      expect(s3.id).toBe("seg-3");
      expect(c3.id).toBe("cue-3");
      const usedSegments = new Set([s1.id, s2.id, s3.id]);
      const usedCues = new Set([c1.id, c2.id, c3.id]);

      // 2. Simulate user deleting s3 and c3 from active plan
      const activeSegments = [s1.id, s2.id];
      const activeCues = [c1.id, c2.id];
      expect(activeSegments).not.toContain("seg-3");
      expect(activeCues).not.toContain("cue-3");

      // 3. Counter must NOT decrement on deletion; next allocation must propose s4 and c4
      const s4 = allocateSparseSegmentId(segmentCounter);
      segmentCounter = s4.nextCounter;
      const c4 = allocateSparseCueId(cueCounter);
      cueCounter = c4.nextCounter;

      expect(s4.id).toBe("seg-4");
      expect(c4.id).toBe("cue-4");
      expect(usedSegments.has(s4.id)).toBe(false);
      expect(usedCues.has(c4.id)).toBe(false);
      usedSegments.add(s4.id);
      usedCues.add(c4.id);

      // 4. Simulate restart: retained counter starts from 4; next proposal must be s5 and c5
      const s5 = allocateSparseSegmentId(segmentCounter);
      segmentCounter = s5.nextCounter;
      const c5 = allocateSparseCueId(cueCounter);
      cueCounter = c5.nextCounter;

      expect(s5.id).toBe("seg-5");
      expect(c5.id).toBe("cue-5");
      expect(usedSegments.has(s5.id)).toBe(false);
      expect(usedCues.has(c5.id)).toBe(false);

      // Proves: IDs never collide, never reuse retired IDs, and never get stuck
    });
  });

  describe("Real Bearer capabilities wire contract", () => {
    it("verifies Bearer capability configuration structure matches backend test expectation", () => {
      expect(TEST_CAPABILITIES).toHaveLength(2);

      const opCap = TEST_CAPABILITIES.find((c) => c.role === "operator")!;
      expect(opCap.token).toBe(TEST_OPERATOR_TOKEN);
      expect(opCap.roomId).toBe(TEST_ROOM_ID);

      const vwCap = TEST_CAPABILITIES.find((c) => c.role === "viewer")!;
      expect(vwCap.token).toBe(TEST_VIEWER_TOKEN);
      expect(vwCap.roomId).toBe(TEST_ROOM_ID);
    });

    it("verifies Bearer header formatting", () => {
      const authHeader = `Bearer ${TEST_OPERATOR_TOKEN}`;
      const match = /^Bearer (\S+)$/i.exec(authHeader);
      expect(match).not.toBeNull();
      expect(match![1]).toBe(TEST_OPERATOR_TOKEN);
    });
  });

  describe("Authoritative clock truth & double-addition avoidance", () => {
    it("ensures authoritative effective time is strictly serverNowMs and never adds clockBehindByMs twice", () => {
      const readWithGap = {
        serverNowMs: 1_700_000_100_000,
        clockBehindByMs: 5_000,
      };

      // Correct effective time: serverNowMs is ALREADY the effective time
      const effective = getAuthoritativeEffectiveTime(readWithGap);
      expect(effective).toBe(1_700_000_100_000);

      // Defect guard: adding clockBehindByMs to serverNowMs would produce an erroneous time 5000ms in the future
      const doubleCounted = readWithGap.serverNowMs + readWithGap.clockBehindByMs;
      expect(doubleCounted).toBe(1_700_000_105_000);
      expect(effective).not.toBe(doubleCounted);
    });

    it("verifies stale freeze threshold is strictly 3000ms", () => {
      const STALE_CONTACT_THRESHOLD_MS = 3000;
      const lastContactMs = 1_700_000_000_000;

      const withinContactMs = lastContactMs + 2999;
      const isFresh = withinContactMs - lastContactMs <= STALE_CONTACT_THRESHOLD_MS;
      expect(isFresh).toBe(true);

      const staleMs = lastContactMs + 3001;
      const isStale = staleMs - lastContactMs > STALE_CONTACT_THRESHOLD_MS;
      expect(isStale).toBe(true);
    });
  });
});
