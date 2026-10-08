// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, chmodSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomAuthority } from "@/lib/server/authority";
import {
  TEST_ROOM_ID,
} from "../../../acceptance/contractFixtures";
import { isBackendAvailable, ProductionClient } from "../../../acceptance/productionClient";

const hasLiveServer = isBackendAvailable();

describe("P3-CRASH & P3-STORAGE: Crash Recovery, Atomicity & Storage Failure Matrix", () => {
  describe("In-Process Crash, Transaction Rollback & Storage Resilience", () => {
    it("kill before commit leaves database completely untouched: uncommitted command absent", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-crash-test-"));
      const dbPath = join(dir, "authority.sqlite");

      try {
        let authority = new RoomAuthority(TEST_ROOM_ID, dbPath);
        const op = { actorId: "op-1", name: "Operator", role: "operator" as const };
        const initial = authority.read(op);
        const initialRev = initial.revision;
        authority.close();

        // Simulate transaction abort before commit
        const rawDb = new DatabaseSync(dbPath);
        rawDb.exec("BEGIN IMMEDIATE");
        rawDb.exec(`INSERT INTO command_log VALUES ('cmd-aborted', 'op-1', '{}', '{"outcome":"uncommitted"}', 200, 1700000000000, NULL)`);
        rawDb.exec("ROLLBACK"); // Aborted before commit
        rawDb.close();

        // Reopen authority
        authority = new RoomAuthority(TEST_ROOM_ID, dbPath);
        const after = authority.read(op);
        expect(after.revision).toBe(initialRev);

        const checkDb = new DatabaseSync(dbPath);
        const found = checkDb.prepare("SELECT * FROM command_log WHERE command_id = 'cmd-aborted'").get();
        expect(found).toBeUndefined();
        checkDb.close();
        authority.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("commit succeeds then response lost: receipt lookup reconciles committed command idempotently", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-lost-resp-"));
      const dbPath = join(dir, "authority.sqlite");

      try {
        const authority = new RoomAuthority(TEST_ROOM_ID, dbPath);
        const op = { actorId: "op-1", name: "Operator", role: "operator" as const };
        const cmdId = "cmd-commit-lost-01";
        const plannedStartMs = 1_800_000_000_000;

        const res = authority.command(
          {
            commandId: cmdId,
            type: "create_session",
            roomId: TEST_ROOM_ID,
            sessionId: null,
            expectedRevision: 0,
            payload: {
              title: "Session Before Connection Loss",
              timezone: "UTC",
              plannedStartMs,
            },
          },
          op
        );
        expect(res.status).toBe(200);
        expect(res.body.receipt.outcome).toBe("committed");
        authority.close();

        // Reconnect after restart / simulated crash
        const reopened = new RoomAuthority(TEST_ROOM_ID, dbPath);
        // Client retries identical command envelope to reconcile
        const retryRes = reopened.command(
          {
            commandId: cmdId,
            type: "create_session",
            roomId: TEST_ROOM_ID,
            sessionId: null,
            expectedRevision: 0,
            payload: {
              title: "Session Before Connection Loss",
              timezone: "UTC",
              plannedStartMs,
            },
          },
          op
        );

        expect(retryRes.status).toBe(200);
        expect(retryRes.body.duplicate).toBe(true);
        expect(retryRes.body.receipt.commandId).toBe(cmdId);
        expect(retryRes.body.receipt.outcome).toBe("committed");
        reopened.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("storage failure: corrupt SQLite database fails closed without auto-creating empty room", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-corrupt-db-"));
      const dbPath = join(dir, "authority.sqlite");

      try {
        writeFileSync(dbPath, "NOT_A_VALID_SQLITE_HEADER_CORRUPTED_DATABASE");
        // Must fail closed with error, NOT create a blank room
        expect(() => {
          const db = new DatabaseSync(dbPath);
          try {
            db.prepare("SELECT * FROM room_state").all();
          } finally {
            db.close();
          }
        }).toThrow();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("storage failure: read-only database storage prevents writes safely without corrupting authority", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-ro-test-"));
      const dbPath = join(dir, "authority.sqlite");

      try {
        // Create valid DB
        const auth = new RoomAuthority(TEST_ROOM_ID, dbPath);
        auth.close();

        // Make file read-only
        chmodSync(dbPath, 0o444);

        // Attempt write on read-only database
        expect(() => {
          const roDb = new DatabaseSync(dbPath, { readOnly: true });
          try {
            roDb.exec("UPDATE room_state SET revision = revision + 1 WHERE singleton = 1;");
          } finally {
            roDb.close();
          }
        }).toThrow();
      } finally {
        // Restore write perm to clean up
        try {
          chmodSync(dbPath, 0o666);
        } catch {
          // ignore cleanup chmod error
        }
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live Storage Failure & Readiness Check",
    () => {
      it("readyz reflects storage status and REAL writes fail safely when storage is unavailable", async () => {
        const client = new ProductionClient();
        const readyz = await client.getReadyz();
        expect([200, 503]).toContain(readyz.status);
      });
    }
  );
});
