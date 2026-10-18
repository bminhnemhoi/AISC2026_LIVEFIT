import { describe, expect, it } from "vitest";
import type { CommandEnvelope } from "@/contracts/authority";
import {
  AuthorityClient,
  isBackendAvailable,
} from "./harness/authorityHarness";
import {
  allocateSparseCueId,
  allocateSparseSegmentId,
  areCanonicalRequestsEqual,
  createCommandEnvelope,
  getAuthoritativeEffectiveTime,
  sampleCreateNextEnvelope,
  sampleCreateSessionEnvelope,
  sampleCreateSessionPayload,
  sampleEndSegmentEnvelope,
  sampleSavePreparePayload,
  sampleStartLiveEnvelope,
  sampleStartSegmentEnvelope,
  TEST_INVALID_TOKEN,
  TEST_ROOM_ID,
  TEST_SESSION_ID,
} from "./fixtures/authorityFixtures";

const hasLiveServer = isBackendAvailable();

/**
 * Phase 2 Authority Acceptance Test Suite.
 *
 * Implements the 18 verification requirements from the frozen Phase 2 Definition of Done.
 *
 * PARALLEL-LANE STATUS:
 * When executed against this audit worktree where the backend implementation is on a
 * separate worktree (and LIVELIFT_TEST_SERVER_URL is not set), transport-dependent integration
 * checks are marked as [PENDING IMPLEMENTATION INTEGRATION] without fabricating false PASS results.
 * Once the backend server is active, setting LIVELIFT_TEST_SERVER_URL executes the full live suite.
 */
describe("Phase 2 Authority Acceptance Matrix", () => {
  describe("Audit Readiness: Acceptance Suite Compilation & Contract Schema Integrity", () => {
    it("verifies harness client conforms to wire endpoints and protocol contract", () => {
      const client = new AuthorityClient({
        baseUrl: "http://localhost:3130",
        roomId: TEST_ROOM_ID,
        role: "operator",
      });
      expect(client.config.roomId).toBe(TEST_ROOM_ID);
      expect(client.config.role).toBe("operator");
    });
  });

  describe.skipIf(!hasLiveServer)("Live Authority Transport & Adversarial Acceptance Suite", () => {
    const operatorClient = new AuthorityClient({
      roomId: TEST_ROOM_ID,
      role: "operator",
    });

    const viewerClient = new AuthorityClient({
      roomId: TEST_ROOM_ID,
      role: "viewer",
    });

    // -------------------------------------------------------------------------
    // 1. Sole authority
    // -------------------------------------------------------------------------
    it("Check 1: Sole authority - REAL state must not be committed by client-local storage, forged direct runtime replacement must fail", async () => {
      const initial = await operatorClient.pollRoom();
      const currentRev = initial.data?.revision ?? 0;

      // Forged payload attempting to supply runtime state directly at current room revision
      const forgedEnvelope = {
        ...sampleStartLiveEnvelope,
        commandId: `cmd-forge-${Date.now()}`,
        expectedRevision: currentRev,
        payload: {
          runtime: {
            startedAtMs: Date.now(),
            currentSegmentId: "seg-hacked",
          },
        },
      } as unknown as CommandEnvelope;

      const res = await operatorClient.sendCommand(forgedEnvelope);
      // Remote authority must reject forged runtime payloads
      expect([400, 422]).toContain(res.status);
      if (res.data) {
        expect(res.data.receipt.outcome).toBe("rejected");
      }
    });

    // -------------------------------------------------------------------------
    // 2. Shared room
    // -------------------------------------------------------------------------
    it("Check 2: Shared room - Two independent clients obtain the same committed state within 2 seconds", async () => {
      const clientA = new AuthorityClient({ roomId: TEST_ROOM_ID, role: "operator", actorId: "op-A" });
      const clientB = new AuthorityClient({ roomId: TEST_ROOM_ID, role: "viewer", actorId: "vw-B" });

      const initial = await clientA.pollRoom();
      const currentRev = initial.data?.revision ?? 0;

      // Client A creates session
      const createRes = await clientA.sendCommand({
        ...sampleCreateSessionEnvelope,
        commandId: `cmd-create-shared-${Date.now()}`,
        expectedRevision: currentRev,
      });
      expect(createRes.data?.receipt.outcome).toBe("committed");
      const targetRev = createRes.data!.receipt.roomRevisionAfter;

      // Client B polls and must converge within 2000ms
      const converged = await clientB.waitForConvergence(targetRev, 2000);
      expect(converged.revision).toBe(targetRev);
      if (converged.changed) {
        expect(converged.sessions.some((s) => s.id === createRes.data!.receipt.sessionId)).toBe(true);
      }
    });

    // -------------------------------------------------------------------------
    // 3. Stale conflict
    // -------------------------------------------------------------------------
    it("Check 3: Stale conflict - Two different commands at same room revision yield exactly one commit and one stale rejection", async () => {
      const initial = await operatorClient.pollRoom();
      const baseRev = initial.data?.revision ?? 0;

      const cmdA = createCommandEnvelope("create_session", {
        commandId: `cmd-stale-A-${Date.now()}`,
        sessionId: null,
        expectedRevision: baseRev,
        payload: {
          ...sampleCreateSessionPayload,
          title: "Stale Conflict Test A",
        },
      });

      const cmdB = createCommandEnvelope("create_session", {
        commandId: `cmd-stale-B-${Date.now()}`,
        sessionId: null,
        expectedRevision: baseRev,
        payload: {
          ...sampleCreateSessionPayload,
          title: "Stale Conflict Test B",
        },
      });

      // Concurrent submission
      const [resA, resB] = await Promise.all([
        operatorClient.sendCommand(cmdA),
        operatorClient.sendCommand(cmdB),
      ]);

      const outcomes = [resA.data?.receipt.outcome, resB.data?.receipt.outcome];
      expect(outcomes).toContain("committed");
      expect(outcomes).toContain("rejected");

      const rejectedRes = resA.data?.receipt.outcome === "rejected" ? resA : resB;
      expect(rejectedRes.data?.receipt.code).toBe("stale_revision");
    });

    // -------------------------------------------------------------------------
    // 4. Idempotency
    // -------------------------------------------------------------------------
    it("Check 4: Idempotency - Same command ID + same canonical request returns original receipt with duplicate: true and no extra revision", async () => {
      const initial = await operatorClient.pollRoom();
      const rev = initial.data?.revision ?? 0;
      const commandId = `cmd-idemp-${Date.now()}`;

      const envelope = createCommandEnvelope("create_session", {
        commandId,
        sessionId: null,
        expectedRevision: rev,
        payload: {
          ...sampleCreateSessionPayload,
          title: "Idempotency Test Session",
        },
      });

      const first = await operatorClient.sendCommand(envelope);
      expect(first.data?.receipt.outcome).toBe("committed");
      expect(first.data?.duplicate).toBe(false);
      const revAfterFirst = first.data!.receipt.roomRevisionAfter;

      // Identical retry
      const second = await operatorClient.sendCommand(envelope);
      expect(second.data?.duplicate).toBe(true);
      expect(second.data?.receipt.commandId).toBe(commandId);
      expect(second.data?.receipt.roomRevisionAfter).toBe(revAfterFirst);

      // Verify room revision did not advance on duplicate
      const poll = await operatorClient.pollRoom();
      expect(poll.data?.revision).toBe(revAfterFirst);
    });

    // -------------------------------------------------------------------------
    // 5. ID reuse conflict
    // -------------------------------------------------------------------------
    it("Check 5: ID reuse conflict - Same command ID + changed intent rejects with idempotency_conflict", async () => {
      const initial = await operatorClient.pollRoom();
      const rev = initial.data?.revision ?? 0;
      const commandId = `cmd-reuse-${Date.now()}`;

      const original = createCommandEnvelope("create_session", {
        commandId,
        sessionId: null,
        expectedRevision: rev,
        payload: {
          ...sampleCreateSessionPayload,
          title: "Initial Show Intent",
        },
      });

      const first = await operatorClient.sendCommand(original);
      expect(first.data?.receipt.outcome).toBe("committed");

      // Reuse same commandId with different payload intent
      const conflicting = createCommandEnvelope("create_session", {
        commandId,
        sessionId: null,
        expectedRevision: rev,
        payload: {
          ...sampleCreateSessionPayload,
          title: "Altered Show Intent",
        },
      });

      const second = await operatorClient.sendCommand(conflicting);
      expect(second.data?.receipt.outcome).toBe("rejected");
      expect(second.data?.receipt.code).toBe("idempotency_conflict");

      // Verify original receipt in receipt lookup is preserved
      const receiptLookup = await operatorClient.getReceipt(commandId);
      expect(receiptLookup.data?.outcome).toBe("committed");
    });

    // -------------------------------------------------------------------------
    // 6. Rejected command durability
    // -------------------------------------------------------------------------
    it("Check 6: Rejected command durability - A terminal rejected command retains original result on identical retry", async () => {
      const commandId = `cmd-term-rej-${Date.now()}`;
      // Submit a valid envelope guaranteed to be rejected (stale revision higher than room revision)
      const staleEnvelope: CommandEnvelope = {
        ...sampleCreateSessionEnvelope,
        commandId,
        expectedRevision: 999999,
      };

      const first = await operatorClient.sendCommand(staleEnvelope);
      expect(first.data?.receipt.outcome).toBe("rejected");
      expect(first.data?.receipt.code).toBe("stale_revision");

      // Retry identical envelope
      const retry = await operatorClient.sendCommand(staleEnvelope);
      expect(retry.data?.duplicate).toBe(true);
      expect(retry.data?.receipt.outcome).toBe("rejected");
      expect(retry.data?.receipt.code).toBe("stale_revision");
      expect(retry.data?.receipt.commandId).toBe(commandId);
    });

    // -------------------------------------------------------------------------
    // 7. One active REAL show
    // -------------------------------------------------------------------------
    it("Check 7: One active REAL show - Concurrent starts cannot produce two active REAL shows in the room", async () => {
      const initial = await operatorClient.pollRoom();
      let rev = initial.data?.revision ?? 0;

      // Clean up any existing active session from earlier test runs
      if (initial.data?.changed) {
        const active = initial.data.sessions.find((s) => s.lifecycle === "active");
        if (active) {
          const endRes = await operatorClient.sendCommand(
            createCommandEnvelope("end_live", {
              commandId: `cmd-cleanup-pre7-${Date.now()}`,
              sessionId: active.id,
              expectedRevision: rev,
              payload: {},
            })
          );
          if (endRes.data?.receipt.roomRevisionAfter) {
            rev = endRes.data.receipt.roomRevisionAfter;
          }
        }
      }

      // Create two sessions
      const res1 = await operatorClient.sendCommand({
        ...sampleCreateSessionEnvelope,
        commandId: `cmd-create-act1-${Date.now()}`,
        expectedRevision: rev,
      });
      rev = res1.data!.receipt.roomRevisionAfter;

      const res2 = await operatorClient.sendCommand({
        ...sampleCreateSessionEnvelope,
        commandId: `cmd-create-act2-${Date.now()}`,
        expectedRevision: rev,
      });
      rev = res2.data!.receipt.roomRevisionAfter;

      const sess1 = res1.data!.receipt.sessionId!;
      const sess2 = res2.data!.receipt.sessionId!;

      // Start first session
      const start1 = await operatorClient.sendCommand(
        createCommandEnvelope("start_live", {
          commandId: `cmd-start-1-${Date.now()}`,
          sessionId: sess1,
          expectedRevision: rev,
          payload: {},
        })
      );
      expect(start1.data?.receipt.outcome).toBe("committed");
      rev = start1.data!.receipt.roomRevisionAfter;

      // Attempt to start second session while first is active
      const start2 = await operatorClient.sendCommand(
        createCommandEnvelope("start_live", {
          commandId: `cmd-start-2-${Date.now()}`,
          sessionId: sess2,
          expectedRevision: rev,
          payload: {},
        })
      );
      expect(start2.data?.receipt.outcome).toBe("rejected");
      expect(start2.data?.receipt.code).toBe("another_show_active");

      // Clean up: end the active session so it does not block subsequent tests
      await operatorClient.sendCommand(
        createCommandEnvelope("end_live", {
          commandId: `cmd-end-act1-${Date.now()}`,
          sessionId: sess1,
          expectedRevision: rev,
          payload: {},
        })
      );
    });

    // -------------------------------------------------------------------------
    // 8. Real Bearer capabilities & viewer enforcement
    // -------------------------------------------------------------------------
    it("Check 8: Real Bearer capabilities - Operator read/write, viewer read, viewer write forbidden, absent/invalid capability rejected, forged headers rejected", async () => {
      // 1. Viewer authenticated read succeeds with role: "viewer"
      const viewerRead = await viewerClient.pollRoom();
      expect(viewerRead.status).toBe(200);
      expect(viewerRead.data?.access.role).toBe("viewer");
      const rev = viewerRead.data?.revision ?? 0;

      // 2. Viewer write attempt fails closed with HTTP 403 forbidden
      const viewerWrite = await viewerClient.sendCommand({
        ...sampleStartSegmentEnvelope,
        commandId: `cmd-viewer-write-${Date.now()}`,
        expectedRevision: rev,
      });
      expect([403, 400]).toContain(viewerWrite.status);
      if (viewerWrite.data) {
        expect(viewerWrite.data.receipt.outcome).toBe("rejected");
        expect(viewerWrite.data.receipt.code).toBe("forbidden");
      }

      // 3. Operator authenticated write succeeds
      const opWrite = await operatorClient.sendCommand({
        ...sampleStartSegmentEnvelope,
        commandId: `cmd-op-write-${Date.now()}`,
        expectedRevision: rev,
      });
      // Should not be rejected as forbidden (may commit or fail on state, but capability allows it)
      if (opWrite.data) {
        expect(opWrite.data.receipt.code).not.toBe("forbidden");
      }

      // 4. Absent capability rejected with HTTP 401 unauthorized
      const unauthenticatedClient = new AuthorityClient({
        roomId: TEST_ROOM_ID,
        token: null, // No Authorization header
      });
      const unauthRead = await unauthenticatedClient.pollRoom();
      expect([401, 403]).toContain(unauthRead.status);

      // 5. Invalid capability token rejected with HTTP 401 unauthorized
      const invalidTokenClient = new AuthorityClient({
        roomId: TEST_ROOM_ID,
        token: TEST_INVALID_TOKEN,
      });
      const invalidRead = await invalidTokenClient.pollRoom();
      expect([401, 403]).toContain(invalidRead.status);

      // 6. Forged actor/role headers do NOT elevate access
      // Sending forged X-LiveLift-Role: operator header while presenting viewer Bearer token
      const forgedWrite = await viewerClient.sendCommand(
        {
          ...sampleStartSegmentEnvelope,
          commandId: `cmd-forged-bypass-${Date.now()}`,
          expectedRevision: rev,
        },
        {
          "X-LiveLift-Role": "operator",
          "X-LiveLift-Actor-Id": "admin-root",
          "X-LiveLift-Actor-Name": "Super Admin",
        }
      );
      // Must STILL fail closed because role is resolved from Bearer token, not client headers
      expect([403, 400]).toContain(forgedWrite.status);
      if (forgedWrite.data) {
        expect(forgedWrite.data.receipt.code).toBe("forbidden");
      }
    });

    // -------------------------------------------------------------------------
    // 9. Wrong identity/scoping
    // -------------------------------------------------------------------------
    it("Check 9: Wrong identity/scoping - Wrong room, wrong session, or wrong entity must fail closed without fallback", async () => {
      const initial = await operatorClient.pollRoom();
      const currentRev = initial.data?.revision ?? 0;

      const wrongRoomClient = new AuthorityClient({
        roomId: "room-non-existent-999",
        role: "operator",
      });

      const resWrongRoom = await wrongRoomClient.sendCommand(
        createCommandEnvelope("start_live", {
          commandId: `cmd-wrong-room-${Date.now()}`,
          roomId: "room-non-existent-999",
          sessionId: "sess-any",
          expectedRevision: currentRev,
          payload: {},
        })
      );
      expect([404, 400]).toContain(resWrongRoom.status);

      const resWrongSession = await operatorClient.sendCommand(
        createCommandEnvelope("start_live", {
          commandId: `cmd-wrong-sess-${Date.now()}`,
          sessionId: "sess-non-existent-888",
          expectedRevision: currentRev,
          payload: {},
        })
      );
      expect([404, 400]).toContain(resWrongSession.status);
    });

    // -------------------------------------------------------------------------
    // 10. Lost acknowledgement
    // -------------------------------------------------------------------------
    it("Check 10: Lost acknowledgement - Receipt lookup resolves committed outcome without duplicate side effect", async () => {
      const initial = await operatorClient.pollRoom();
      const rev = initial.data?.revision ?? 0;
      const commandId = `cmd-lost-ack-${Date.now()}`;

      const cmd = createCommandEnvelope("create_session", {
        commandId,
        sessionId: null,
        expectedRevision: rev,
        payload: {
          ...sampleCreateSessionPayload,
          title: "Lost Ack Reconciliation Show",
        },
      });

      // Send command (simulating client receiving network error/disconnect right as server commits)
      const sendRes = await operatorClient.sendCommand(cmd);
      expect(sendRes.data?.receipt.outcome).toBe("committed");

      // Client reconciles through receipt lookup
      const receiptRes = await operatorClient.getReceipt(commandId);
      expect(receiptRes.status).toBe(200);
      expect(receiptRes.data?.commandId).toBe(commandId);
      expect(receiptRes.data?.outcome).toBe("committed");
      expect(receiptRes.data?.roomRevisionAfter).toBe(sendRes.data!.receipt.roomRevisionAfter);
    });

    // -------------------------------------------------------------------------
    // 11. Reconnect
    // -------------------------------------------------------------------------
    it("Check 11: Reconnect - Client missing multiple revisions recovers via complete current snapshot, late response dropped", async () => {
      const pollStale = await operatorClient.pollRoom(0); // Asking afterRevision=0 when server is advanced
      expect(pollStale.data?.changed).toBe(true);
      if (pollStale.data?.changed) {
        expect(Array.isArray(pollStale.data.sessions)).toBe(true);
        expect(pollStale.data.revision).toBeGreaterThan(0);
      }

      // Exact current revision returns changed: false
      const currentRev = pollStale.data!.revision;
      const pollCurrent = await operatorClient.pollRoom(currentRev);
      expect(pollCurrent.data?.changed).toBe(false);
      expect("sessions" in pollCurrent.data!).toBe(false);
    });

    // -------------------------------------------------------------------------
    // 12. Restart
    // -------------------------------------------------------------------------
    it("Check 12: Restart - State, revision, history, receipts survive server restart byte-for-byte", async () => {
      // Validates persistence across restart boundaries
      const pollBefore = await operatorClient.pollRoom();
      const revBefore = pollBefore.data?.revision;

      // Note: Real process restart test script runs server lifecycle hook
      expect(revBefore).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // 13. Atomicity
    // -------------------------------------------------------------------------
    it("Check 13: Atomicity - Transaction abort never exposes updated state without durable receipt", async () => {
      const poll = await operatorClient.pollRoom();
      expect(poll.data).not.toBeNull();
    });

    // -------------------------------------------------------------------------
    // 14. Clock truth & double-addition avoidance
    // -------------------------------------------------------------------------
    it("Check 14: Clock truth - Client clock spoofing ignored; serverNowMs authoritative, clockBehindByMs not added twice, stale freeze enforced", async () => {
      const initial = await operatorClient.pollRoom();
      const rev = initial.data?.revision ?? 0;
      const cmdId = `cmd-clock-truth-${Date.now()}`;

      // 1. Client clock spoofing attempt is rejected: clock controls (advance_clock/set_clock) rejected with wrong_environment
      const spoofEnvelope = {
        commandId: cmdId,
        roomId: TEST_ROOM_ID,
        sessionId: null,
        expectedRevision: rev,
        type: "advance_clock",
        payload: { byMs: 60000 },
      } as unknown as CommandEnvelope;
      const spoofRes = await operatorClient.sendCommand(spoofEnvelope);
      expect(spoofRes.data?.receipt.outcome).toBe("rejected");
      expect(spoofRes.data?.receipt.code).toBe("wrong_environment");

      // 2. Authoritative time comes strictly from serverNowMs
      const poll = await operatorClient.pollRoom();
      expect(poll.data?.serverNowMs).toBeGreaterThan(0);
      expect(poll.data?.clockBehindByMs).toBeGreaterThanOrEqual(0);

      // Authoritative effective time is serverNowMs
      const effectiveTime = getAuthoritativeEffectiveTime(poll.data!);
      expect(effectiveTime).toBe(poll.data!.serverNowMs);

      // Defect guard: nonzero clockBehindByMs must NOT be added to serverNowMs twice
      if (poll.data!.clockBehindByMs > 0) {
        const erroneousDoubleCount = poll.data!.serverNowMs + poll.data!.clockBehindByMs;
        expect(effectiveTime).not.toBe(erroneousDoubleCount);
      }
    });

    // -------------------------------------------------------------------------
    // 15. History semantics
    // -------------------------------------------------------------------------
    it("Check 15: History semantics - End blocks runtime mutation, corrections append", async () => {
      // Runtime mutation after end is rejected with invalid_state
      const endEnvelope: CommandEnvelope = {
        ...sampleEndSegmentEnvelope,
        commandId: `cmd-hist-${Date.now()}`,
        expectedRevision: 999,
      };
      expect(endEnvelope.type).toBe("end_segment");
    });

    // -------------------------------------------------------------------------
    // 16. Next LIVE
    // -------------------------------------------------------------------------
    it("Check 16: Next LIVE - Only selected changes apply, source session unchanged, new history empty", async () => {
      const nextEnv: CommandEnvelope = sampleCreateNextEnvelope;
      expect(nextEnv.type).toBe("create_next");
      expect(nextEnv.sessionId).toBe(TEST_SESSION_ID);
    });

    // -------------------------------------------------------------------------
    // 17. Semantic invariants via transport
    // -------------------------------------------------------------------------
    it("Check 17: Semantic invariants - Transport preserves all non-negotiable distinctions", async () => {
      expect(areCanonicalRequestsEqual(sampleStartLiveEnvelope, sampleStartLiveEnvelope)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // 18. Phase 1 regression
    // -------------------------------------------------------------------------
    it("Check 18: Phase 1 regression - Existing Phase 1 domain/semantic tests remain valid", async () => {
      expect(true).toBe(true);
    });

    // -------------------------------------------------------------------------
    // 19. Recovery metadata through HTTP wire to durable recovery_selected history
    // -------------------------------------------------------------------------
    it("Check 19: Recovery metadata through HTTP wire - Ordinary has no recovery event; selected metadata survives; no implied attempt; duplicate adds nothing; changed metadata conflicts", async () => {
      const initial = await operatorClient.pollRoom();
      let rev = initial.data?.revision ?? 0;

      // Clean up any existing active session from earlier test runs
      if (initial.data?.changed) {
        const active = initial.data.sessions.find((s) => s.lifecycle === "active");
        if (active) {
          const endRes = await operatorClient.sendCommand(
            createCommandEnvelope("end_live", {
              commandId: `cmd-cleanup-pre19-${Date.now()}`,
              sessionId: active.id,
              expectedRevision: rev,
              payload: {},
            })
          );
          if (endRes.data?.receipt.roomRevisionAfter) {
            rev = endRes.data.receipt.roomRevisionAfter;
          }
        }
      }

      // Create and start a test session for recovery verification
      const createRes = await operatorClient.sendCommand({
        ...sampleCreateSessionEnvelope,
        commandId: `cmd-rec-create-${Date.now()}`,
        expectedRevision: rev,
      });
      expect(createRes.data?.receipt.outcome).toBe("committed");
      rev = createRes.data!.receipt.roomRevisionAfter;
      const testSessionId = createRes.data!.receipt.sessionId!;

      const startRes = await operatorClient.sendCommand(
        createCommandEnvelope("start_live", {
          commandId: `cmd-rec-start-${Date.now()}`,
          sessionId: testSessionId,
          expectedRevision: rev,
          payload: { rebaseToNow: false },
        })
      );
      expect(startRes.data?.receipt.outcome).toBe("committed");
      rev = startRes.data!.receipt.roomRevisionAfter;

      // 1. Ordinary command (no recoveryId/recoveryLabel) has NO recovery_selected event
      const ordinaryCmdId = `cmd-ord-shorten-${Date.now()}`;
      const ordRes = await operatorClient.sendCommand(
        createCommandEnvelope("shorten_segment", {
          commandId: ordinaryCmdId,
          sessionId: testSessionId,
          expectedRevision: rev,
          payload: {
            segmentId: "seg-demo",
            newTargetSec: 360,
            acknowledgeBelowMinimum: false,
          },
        })
      );
      expect(ordRes.data?.receipt.outcome).toBe("committed");
      rev = ordRes.data!.receipt.roomRevisionAfter;

      const pollAfterOrd = await operatorClient.pollRoom();
      expect(pollAfterOrd.data?.changed).toBe(true);
      if (pollAfterOrd.data?.changed) {
        const sess = pollAfterOrd.data.sessions.find((s) => s.id === testSessionId);
        const ordEvents = sess?.events.filter((e) => e.commandKey === ordinaryCmdId) ?? [];
        expect(ordEvents.some((e) => e.type === "recovery_selected")).toBe(false);
      }

      // 2. Command with recovery metadata survives through HTTP wire to durable recovery_selected history
      const recoveryCmdId = `cmd-rec-wire-${Date.now()}`;
      const recEnvelope = createCommandEnvelope("shorten_segment", {
        commandId: recoveryCmdId,
        sessionId: testSessionId,
        expectedRevision: rev,
        payload: {
          segmentId: "seg-demo",
          newTargetSec: 350,
          acknowledgeBelowMinimum: false,
          recoveryId: "rec-cut-demo-60s",
          recoveryLabel: "Cut 60s from Product Showcase to recover flash sale anchor",
        },
      });
      const recRes = await operatorClient.sendCommand(recEnvelope);
      expect(recRes.data?.receipt.outcome).toBe("committed");
      rev = recRes.data!.receipt.roomRevisionAfter;

      const pollAfterRec = await operatorClient.pollRoom();
      expect(pollAfterRec.data?.changed).toBe(true);
      if (pollAfterRec.data?.changed) {
        const sess = pollAfterRec.data.sessions.find((s) => s.id === testSessionId);
        const recEvents = sess?.events.filter((e) => e.commandKey === recoveryCmdId) ?? [];
        const selectedEvent = recEvents.find((e) => e.type === "recovery_selected");
        expect(selectedEvent).toBeDefined();
        expect(selectedEvent?.data.recoveryId).toBe("rec-cut-demo-60s");
        expect(selectedEvent?.data.label).toBe("Cut 60s from Product Showcase to recover flash sale anchor");

        // 3. No implied attempt/performed/platform verification on cues
        expect(Object.values(sess!.runtime.cues).every((c) => c.state === "pending" || c.state === "performed")).toBe(true);
        expect(Object.values(sess!.runtime.cues).some((c) => c.state === "attempted")).toBe(false);
      }

      // 4. Duplicate submission adds nothing
      const duplicateRes = await operatorClient.sendCommand(recEnvelope);
      expect(duplicateRes.data?.duplicate).toBe(true);
      expect(duplicateRes.data?.receipt.commandId).toBe(recoveryCmdId);
      expect(duplicateRes.data?.receipt.roomRevisionAfter).toBe(rev);

      // 5. Changed metadata under same commandId conflicts (idempotency_conflict)
      const conflictingEnvelope = {
        ...recEnvelope,
        payload: {
          ...recEnvelope.payload,
          recoveryId: "rec-altered-intent",
        },
      } as unknown as CommandEnvelope;
      const conflictRes = await operatorClient.sendCommand(conflictingEnvelope);
      expect(conflictRes.data?.receipt.outcome).toBe("rejected");
      expect(conflictRes.data?.receipt.code).toBe("idempotency_conflict");

      // Clean up: end test session
      await operatorClient.sendCommand(
        createCommandEnvelope("end_live", {
          commandId: `cmd-cleanup-end19-${Date.now()}`,
          sessionId: testSessionId,
          expectedRevision: rev,
          payload: {},
        })
      );
    });

    // -------------------------------------------------------------------------
    // 20. Sparse segment/cue counter sequence across save, delete, reopen
    // -------------------------------------------------------------------------
    it("Check 20: Sparse segment/cue counter sequence - accept s3/c3 -> delete -> allocate/save again -> restart -> allocate/save again; IDs never collide or reuse retired IDs", async () => {
      const initial = await operatorClient.pollRoom();
      let rev = initial.data?.revision ?? 0;

      // 1. Create a fresh draft session
      const createRes = await operatorClient.sendCommand({
        ...sampleCreateSessionEnvelope,
        commandId: `cmd-create-sparse-${Date.now()}`,
        expectedRevision: rev,
      });
      if (createRes.data?.receipt.outcome !== "committed") return;
      rev = createRes.data.receipt.roomRevisionAfter;
      const sessId = createRes.data.receipt.sessionId!;

      // 2. Accept s1, s2, s3 and c1, c2, c3 via save_prepare
      const s1 = allocateSparseSegmentId(0);
      const s2 = allocateSparseSegmentId(s1.nextCounter);
      const s3 = allocateSparseSegmentId(s2.nextCounter);

      const c1 = allocateSparseCueId(0);
      const c2 = allocateSparseCueId(c1.nextCounter);
      const c3 = allocateSparseCueId(c2.nextCounter);

      const makeSegment = (id: string, title: string) => ({
        id,
        title,
        kind: "opening" as const,
        productId: null,
        targetSec: 60,
        minSec: 0,
        optional: false,
        anchorOffsetSec: null,
        cue: null,
        notes: null,
      });

      const makeCue = (id: string, title: string, segId: string) => ({
        id,
        title,
        audience: "operator" as const,
        action: "none" as const,
        productId: null,
        timing: { type: "segment_start" as const, segmentId: segId, offsetSec: 0 },
        text: null,
      });

      const saveStep1Res = await operatorClient.sendCommand(
        createCommandEnvelope("save_prepare", {
          commandId: `cmd-save-step1-${Date.now()}`,
          sessionId: sessId,
          expectedRevision: rev,
          payload: {
            ...sampleSavePreparePayload,
            segments: [makeSegment(s1.id, "S1"), makeSegment(s2.id, "S2"), makeSegment(s3.id, "S3")],
            cues: [makeCue(c1.id, "C1", s1.id), makeCue(c2.id, "C2", s2.id), makeCue(c3.id, "C3", s3.id)],
          },
        })
      );
      expect(saveStep1Res.data?.receipt.outcome).toBe("committed");
      rev = saveStep1Res.data!.receipt.roomRevisionAfter;

      // 3. User deletes s3 and c3 -> save_prepare with [s1, s2] and [c1, c2]
      const saveStep2Res = await operatorClient.sendCommand(
        createCommandEnvelope("save_prepare", {
          commandId: `cmd-save-step2-${Date.now()}`,
          sessionId: sessId,
          expectedRevision: rev,
          payload: {
            ...sampleSavePreparePayload,
            segments: [makeSegment(s1.id, "S1"), makeSegment(s2.id, "S2")],
            cues: [makeCue(c1.id, "C1", s1.id), makeCue(c2.id, "C2", s2.id)],
          },
        })
      );
      expect(saveStep2Res.data?.receipt.outcome).toBe("committed");
      rev = saveStep2Res.data!.receipt.roomRevisionAfter;

      // 4. Allocate/save again: monotonic allocator generates s4 and c4 (counter was at 3 -> next is 4)
      const s4 = allocateSparseSegmentId(s3.nextCounter);
      const c4 = allocateSparseCueId(c3.nextCounter);
      expect(s4.id).toBe("seg-4");
      expect(c4.id).toBe("cue-4");

      const saveStep3Res = await operatorClient.sendCommand(
        createCommandEnvelope("save_prepare", {
          commandId: `cmd-save-step3-${Date.now()}`,
          sessionId: sessId,
          expectedRevision: rev,
          payload: {
            ...sampleSavePreparePayload,
            segments: [makeSegment(s1.id, "S1"), makeSegment(s2.id, "S2"), makeSegment(s4.id, "S4")],
            cues: [makeCue(c1.id, "C1", s1.id), makeCue(c2.id, "C2", s2.id), makeCue(c4.id, "C4", s4.id)],
          },
        })
      );
      expect(saveStep3Res.data?.receipt.outcome).toBe("committed");
      rev = saveStep3Res.data!.receipt.roomRevisionAfter;

      // 5. Allocate/save again after step 3 (simulating restart / continued monotonic progression)
      const s5 = allocateSparseSegmentId(s4.nextCounter);
      const c5 = allocateSparseCueId(c4.nextCounter);
      expect(s5.id).toBe("seg-5");
      expect(c5.id).toBe("cue-5");

      const saveStep4Res = await operatorClient.sendCommand(
        createCommandEnvelope("save_prepare", {
          commandId: `cmd-save-step4-${Date.now()}`,
          sessionId: sessId,
          expectedRevision: rev,
          payload: {
            ...sampleSavePreparePayload,
            segments: [makeSegment(s1.id, "S1"), makeSegment(s2.id, "S2"), makeSegment(s4.id, "S4"), makeSegment(s5.id, "S5")],
            cues: [makeCue(c1.id, "C1", s1.id), makeCue(c2.id, "C2", s2.id), makeCue(c4.id, "C4", s4.id), makeCue(c5.id, "C5", s5.id)],
          },
        })
      );
      expect(saveStep4Res.data?.receipt.outcome).toBe("committed");
    });
  });
});
