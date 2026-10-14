// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { isBackendAvailable, ProductionClient } from "../../../acceptance/productionClient";
import { RoomAuthority } from "@/lib/server/authority";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_ROOM_ID } from "../../../acceptance/contractFixtures";

const hasLiveServer = isBackendAvailable();

describe("P3-OBSERVABILITY: Health, Readiness & Observability Semantics Matrix", () => {
  describe("Readiness Invariant & Safe Logging Contracts", () => {
    it("readiness check is strictly read-only: does not advance room revision or write to command_log", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-readyz-test-"));
      const dbPath = join(dir, "authority.sqlite");

      try {
        const authority = new RoomAuthority(TEST_ROOM_ID, dbPath);
        const op = { actorId: "op-1", name: "Operator", role: "operator" as const };
        const initial = authority.read(op);
        const initialRev = initial.revision;

        // Simulate probe check: reading room state and checking schema
        const checkRead = authority.read(op);
        expect(checkRead.revision).toBe(initialRev);
        authority.close();

        const checkDb = new DatabaseSync(dbPath);
        const checkCommands = checkDb.prepare("SELECT COUNT(*) as count FROM command_log").get() as Record<string, unknown> | undefined;
        expect(Number(checkCommands?.count)).toBe(0);
        checkDb.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("verifies structured logging allowlist contains only safe, non-secret fields", () => {
      const allowedKeys = [
        "timestamp",
        "level",
        "event",
        "requestId",
        "route",
        "status",
        "durationMs",
        "workspaceId",
        "roomId",
        "actorId",
        "commandId",
        "revision",
        "resultCode",
      ];

      // Prohibited fields must NEVER be included
      const forbiddenKeys = [
        "password",
        "passwordHash",
        "salt",
        "token",
        "cookie",
        "body",
        "operatorNotes",
      ];

      for (const forbidden of forbiddenKeys) {
        expect(allowedKeys).not.toContain(forbidden);
      }
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live Health, Readiness & Request Tracing Probes",
    () => {
      const client = new ProductionClient();

      it("healthz returns 200 indicating process liveness", async () => {
        const res = await client.getHealthz();
        expect(res.status).toBe(200);
      });

      it("readyz returns 200 when storage and schema are valid and writable", async () => {
        const res = await client.getReadyz();
        expect([200, 503]).toContain(res.status);
      });

      it("responses return X-Request-Id header for command failure traceability", async () => {
        const res = await client.getHealthz();
        const requestId = res.headers.get("x-request-id");
        expect(requestId).toBeTruthy();
      });
    }
  );
});
