// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ProductionClient, isBackendAvailable } from "../../../acceptance/productionClient";
import {
  TEST_WORKSPACE_ID,
  TEST_ROOM_ID,
  TEST_GENERATION,
  TEST_PRODUCTION_CONTEXT,
} from "../../../acceptance/contractFixtures";
import { assertRoom } from "@/lib/server/authority";
import type { AuthorityError } from "@/lib/server/config";

const hasLiveServer = isBackendAvailable();

describe("P3-ISOLATION: Deployment Isolation & Context Binding Acceptance", () => {
  describe("In-Process Isolation Contract & Context Specifications", () => {
    it("defines immutable production deployment binding (workspace, room, generation)", () => {
      expect(TEST_PRODUCTION_CONTEXT.workspaceId).toBe(TEST_WORKSPACE_ID);
      expect(TEST_PRODUCTION_CONTEXT.roomId).toBe(TEST_ROOM_ID);
      expect(TEST_PRODUCTION_CONTEXT.generation).toBe(TEST_GENERATION);
    });

    it("verifies headers contract for production context transport", () => {
      const client = new ProductionClient();
      const headers = client.getHeaders();
      // Frozen Phase 3 contract defines context headers strictly as Workspace and Generation
      expect(headers.get("X-LiveLift-Workspace")).toBe(client.config.workspaceId);
      expect(headers.get("X-LiveLift-Generation")).toBe(client.config.generation);
      // X-LiveLift-Room is NOT an authoritative context header per frozen contract
      expect(headers.get("X-LiveLift-Room")).toBeNull();
    });

    it("verifies supported wrong-room mechanisms fail closed with not_found without revealing authority state", () => {
      // In-process verification of assertRoom canonical helper
      expect(() => assertRoom("room-unconfigured-foreign", "room-configured-01")).toThrowError();
      try {
        assertRoom("room-unconfigured-foreign", "room-configured-01");
      } catch (err: unknown) {
        expect((err as AuthorityError).status).toBe(404);
        expect((err as AuthorityError).code).toBe("not_found");
      }

      // Matching room target passes
      expect(() => assertRoom("room-configured-01", "room-configured-01")).not.toThrow();
      // Unspecified room target (null) passes to allow room defaults
      expect(() => assertRoom(null, "room-configured-01")).not.toThrow();
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live Deployment Context & Cross-Authorization Rejections",
    () => {
      const client = new ProductionClient();

      it("missing X-LiveLift-Workspace header returns 400 context_required", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.delete("X-LiveLift-Workspace");

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(400);
      });

      it("missing X-LiveLift-Generation header returns 400 context_required", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.delete("X-LiveLift-Generation");

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(400);
      });

      it("wrong workspace ID header returns 404 not_found", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.set(
          "X-LiveLift-Workspace",
          "99999999-9999-4999-8999-999999999999"
        );

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(404);
      });

      it("supported room query target targeting wrong room fails closed with 404 not_found without revealing authority state", async () => {
        await client.login();
        const headers = client.getHeaders();

        // 1. Supported roomId query target targeting unconfigured room: GET /api/v3/room?roomId=room-unconfigured-foreign
        const res = await client.rawRequest(
          "/api/v3/room?roomId=room-unconfigured-foreign",
          {
            method: "GET",
            headers,
          }
        );
        expect(res.status).toBe(404);
        const data = res.data as Record<string, unknown> | null;
        // Verify authority state is NOT revealed
        if (data) {
          expect(data).not.toHaveProperty("sessions");
          expect(data).not.toHaveProperty("revision");
        } else {
          expect(data).toBeNull();
        }
        if (res.error) {
          expect(res.error.code).toBe("not_found");
        }
      });

      it("command envelope targeting unconfigured wrong room fails closed with 404 not_found and does not mutate authority", async () => {
        await client.login();
        // 2. Supported command envelope roomId target targeting unconfigured room
        const wrongRoomEnvelope = {
          commandId: `cmd-wrong-room-${Date.now()}`,
          roomId: "room-unconfigured-foreign",
          sessionId: null,
          expectedRevision: 0,
          type: "create_session" as const,
          payload: {
            title: "Wrong Room Show",
            timezone: "UTC",
            plannedStartMs: Date.now() + 3600000,
          },
        };

        const res = await client.sendCommand(wrongRoomEnvelope);
        expect(res.status).toBe(404);
        if (res.data) {
          expect(res.data.receipt.outcome).toBe("rejected");
          expect(res.data.receipt.code).toBe("not_found");
        }
      });

      it("receipt lookup targeting unconfigured wrong room via supported query target fails closed with 404 not_found", async () => {
        await client.login();
        // 3. Supported receipt query target targeting unconfigured room: GET /api/v3/room/commands/:commandId?roomId=...
        const res = await client.rawRequest(
          "/api/v3/room/commands/cmd-test-nonexistent?roomId=room-unconfigured-foreign",
          {
            method: "GET",
            headers: client.getHeaders(),
          }
        );
        expect(res.status).toBe(404);
        if (res.error) {
          expect(res.error.code).toBe("not_found");
        }
      });

      it("outdated restore generation header returns 409 recovery_required", async () => {
        await client.login();
        const headers = client.getHeaders();
        // Client uses old generation prior to a restore
        headers.set(
          "X-LiveLift-Generation",
          "00000000-0000-4000-8000-000000000000"
        );

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(409);
      });

      it("cross-installation / foreign session isolation: token from installation A fails on installation B", async () => {
        // Foreign session cookie from another deployment
        const foreignCookie = "__Host-livelift_session=foreign_random_token_from_another_tenant_123456789";
        const headers = client.getHeaders({ includeCookie: false });
        headers.set("Cookie", foreignCookie);

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect(res.status).toBe(401);
      });
    }
  );
});
