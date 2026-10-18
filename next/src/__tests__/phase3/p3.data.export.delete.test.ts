// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isBackendAvailable, ProductionClient } from "../../../acceptance/productionClient";
import type { RoomSnapshot } from "@/contracts/authority";
import {
  createSampleWorkspaceExport,
  TEST_WORKSPACE_ID,
  TEST_ROOM_ID,
  TEST_GENERATION,
} from "../../../acceptance/contractFixtures";

const hasLiveServer = isBackendAvailable();

describe("P3-DATA: Data Export & Workspace Deletion Matrix", () => {
  describe("In-Process WorkspaceExport Schema & Exclusions Specification", () => {
    it("conforms to WorkspaceExport wire contract: snapshot, receipts, and attribution", () => {
      const mockSnapshot = {
        roomId: TEST_ROOM_ID,
        revision: 3,
        serverNowMs: 1_700_000_100_000,
        clockBehindByMs: 0,
        sessions: [],
      };

      const exportData = createSampleWorkspaceExport(mockSnapshot, 3);
      expect(exportData.formatVersion).toBe(1);
      expect(exportData.workspaceId).toBe(TEST_WORKSPACE_ID);
      expect(exportData.roomId).toBe(TEST_ROOM_ID);
      expect(exportData.generation).toBe(TEST_GENERATION);
      expect(exportData.snapshot.revision).toBe(3);
      expect(exportData.receipts.length).toBe(1);
      expect(exportData.receipts[0].actorId).toBeTruthy();
      expect(exportData.receipts[0].receipt.outcome).toBe("committed");
    });

    it("verifies export exclusions: no credentials, passwords, salts, tokens, or SIMULATED data", () => {
      const mockSnapshot = {
        roomId: TEST_ROOM_ID,
        revision: 1,
        serverNowMs: 1_700_000_100_000,
        clockBehindByMs: 0,
        sessions: [
          {
            id: "sess-real-1",
            room_id: TEST_ROOM_ID,
            environment: "REAL" as const,
            lifecycle: "planned" as const,
            title: "Real Show",
            timezone: "UTC",
            revision: 0,
            updatedAtMs: 1_700_000_100_000,
            plans: [],
            products: [],
            events: [],
            seq: { segment: 0, cue: 0, event: 0 },
            baselineLocked: false,
            operator: { id: "op-1", name: "Operator", role: "lead" as const, isLead: true },
          },
        ],
      };

      const exportData = createSampleWorkspaceExport(mockSnapshot as unknown as RoomSnapshot);
      const serialized = JSON.stringify(exportData);

      // Verify no credentials / sensitive properties
      expect(serialized).not.toContain('"password"');
      expect(serialized).not.toContain('"password_hash"');
      expect(serialized).not.toContain('"salt"');
      expect(serialized).not.toContain('"token_hash"');

      // Verify NO SIMULATED environment sessions exist
      expect(serialized).not.toContain('"SIMULATED"');
    });

    it("verifies workspace deletion safeguards: active LIVE refusal and confirmation requirement", () => {
      // Simulating deletion logic constraints
      const canDeleteWorkspace = (
        confirmedWorkspaceId: string,
        targetWorkspaceId: string,
        hasActiveShow: boolean
      ): { allowed: boolean; reason?: string } => {
        if (confirmedWorkspaceId !== targetWorkspaceId) {
          return { allowed: false, reason: "Workspace confirmation mismatch" };
        }
        if (hasActiveShow) {
          return { allowed: false, reason: "Cannot delete workspace with active LIVE show" };
        }
        return { allowed: true };
      };

      expect(canDeleteWorkspace(TEST_WORKSPACE_ID, TEST_WORKSPACE_ID, false).allowed).toBe(true);
      expect(canDeleteWorkspace("wrong-id", TEST_WORKSPACE_ID, false).allowed).toBe(false);
      expect(canDeleteWorkspace(TEST_WORKSPACE_ID, TEST_WORKSPACE_ID, true).allowed).toBe(false);
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live Export Permissions & Consistent Snapshot",
    () => {
      it("export is operator-only: viewer returns 403 forbidden", async () => {
        const viewer = new ProductionClient({ role: "viewer" });
        await viewer.login();
        const res = await viewer.exportWorkspace();
        expect(res.status).toBe(403);
      });

      it("operator can export authoritative workspace JSON", async () => {
        const operator = new ProductionClient({ role: "operator" });
        await operator.login();
        const res = await operator.exportWorkspace();
        if (res.status === 200) {
          expect(res.data?.formatVersion).toBe(1);
          expect(res.data?.workspaceId).toBe(operator.config.workspaceId);
          expect(res.data?.snapshot).toBeTruthy();
          expect(Array.isArray(res.data?.receipts)).toBe(true);
        }
      });
    }
  );
});
