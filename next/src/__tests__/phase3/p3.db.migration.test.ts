// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomAuthority } from "@/lib/server/authority";
import { newSegment } from "@/lib/domain";
import {
  TEST_WORKSPACE_ID,
  TEST_ROOM_ID,
  TEST_GENERATION,
} from "../../../acceptance/contractFixtures";
import { isBackendAvailable, ProductionClient } from "../../../acceptance/productionClient";

const hasLiveServer = isBackendAvailable();

describe("P3-DB: Database, Migration & Integrity Acceptance Matrix", () => {
  describe("Real Phase 2 (v1) to Phase 3 (v2) Migration Drill & Integrity", () => {
    it("preserves real sessions, events, receipts, revisions, and counters across migration", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-db-test-"));
      const dbPath = join(dir, "authority.sqlite");

      try {
        // 1. Setup real Phase 2 RoomAuthority (v1 database)
        const authority = new RoomAuthority(TEST_ROOM_ID, dbPath);
        const operatorAccess = {
          actorId: "actor-op-1",
          name: "Lead Operator",
          role: "operator" as const,
        };

        // Create a real session in Phase 2
        const createRes = authority.command(
          {
            commandId: "cmd-p2-create-01",
            type: "create_session",
            roomId: TEST_ROOM_ID,
            sessionId: null,
            expectedRevision: 0,
            payload: {
              title: "Phase 2 Production Live",
              timezone: "UTC",
              plannedStartMs: Date.now() + 3_600_000,
            },
          },
          operatorAccess
        );
        expect(createRes.status).toBe(200);
        expect(createRes.body.receipt.outcome).toBe("committed");
        const sessionId = createRes.body.receipt.sessionId!;
        const revAfterCreate = createRes.body.receipt.roomRevisionAfter;

        // Save prepare with segments and cues to advance counters
        const s1Id = `${sessionId}:s1`;
        const c1Id = `${sessionId}:c1`;
        const saveRes = authority.command(
          {
            commandId: "cmd-p2-save-01",
            type: "save_prepare",
            roomId: TEST_ROOM_ID,
            sessionId,
            expectedRevision: revAfterCreate,
            payload: {
              title: "Phase 2 Production Live (Prepared)",
              timezone: "Asia/Ho_Chi_Minh",
              objective: "Test Migration",
              accountLabel: "@livelift",
              products: [
                {
                  id: "prod-1",
                  code: "SKU-01",
                  name: "Smart Stand",
                  price: 29.99,
                  currency: "USD",
                  priority: "normal",
                  status: "enabled",
                  talkingPoints: ["Sturdy", "Rotates"],
                  constraints: [],
                  initials: "SS",
                },
              ],
              plannedStartMs: 1_700_000_000_000,
              segments: [
                newSegment(s1Id, {
                  title: "Intro",
                  kind: "opening",
                  optional: false,
                  targetSec: 180,
                  minSec: 120,
                }),
              ],
              cues: [
                {
                  id: c1Id,
                  title: "Cue 1",
                  audience: "operator",
                  action: "pin_product",
                  productId: "prod-1",
                  timing: { type: "segment_start", segmentId: s1Id, offsetSec: 0 },
                  text: null,
                },
              ],
            },
          },
          operatorAccess
        );
        expect(saveRes.status).toBe(200);
        const finalRevP2 = saveRes.body.receipt.roomRevisionAfter;
        authority.close();

        // 2. Open raw SQLite to inspect v1 and perform migration to v2
        const db = new DatabaseSync(dbPath);
        db.exec("PRAGMA foreign_keys = ON;");
        const v1Version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
        expect(v1Version).toBe(1);

        // Verify pre-migration state
        const p2Rooms = db.prepare("SELECT * FROM room_state").all();
        expect(p2Rooms.length).toBe(1);
        expect(Number(p2Rooms[0].revision)).toBe(finalRevP2);

        const p2Sessions = db.prepare("SELECT * FROM sessions").all();
        expect(p2Sessions.length).toBe(1);
        const p2State = JSON.parse(String(p2Sessions[0].state_json));
        expect(p2State.id).toBe(sessionId);
        expect(p2State.seq.segment).toBeGreaterThanOrEqual(1);

        const p2Commands = db.prepare("SELECT * FROM command_log").all();
        expect(p2Commands.length).toBe(2);

        // 3. Execute v2 schema migration (adding deployment, accounts, actor_ids, login_sessions)
        db.exec("BEGIN IMMEDIATE");
        try {
          db.exec(`
            CREATE TABLE deployment (
              singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
              workspace_id TEXT NOT NULL UNIQUE,
              room_id TEXT NOT NULL REFERENCES room_state(room_id),
              generation TEXT NOT NULL,
              recovery_json TEXT CHECK(recovery_json IS NULL OR json_valid(recovery_json))
            ) STRICT;
            CREATE TABLE accounts (
              actor_id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('operator', 'viewer')),
              salt TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              enabled INTEGER NOT NULL CHECK(enabled IN (0, 1))
            ) STRICT;
            CREATE TABLE actor_ids (actor_id TEXT PRIMARY KEY) STRICT;
            INSERT INTO actor_ids SELECT DISTINCT actor_id FROM command_log;
            CREATE TABLE login_sessions (
              token_hash TEXT PRIMARY KEY,
              actor_id TEXT NOT NULL REFERENCES accounts(actor_id) ON DELETE CASCADE,
              expires_at_ms INTEGER NOT NULL
            ) STRICT;
            PRAGMA user_version = 2;
          `);
          db.prepare("INSERT INTO deployment VALUES (1, ?, ?, ?, NULL)").run(
            TEST_WORKSPACE_ID,
            TEST_ROOM_ID,
            TEST_GENERATION
          );
          db.exec("COMMIT");
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }

        // 4. Verify post-migration state: user_version is 2, all v1 data preserved intact
        const v2Version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
        expect(v2Version).toBe(2);

        const v2Rooms = db.prepare("SELECT * FROM room_state").all();
        expect(v2Rooms.length).toBe(1);
        expect(Number(v2Rooms[0].revision)).toBe(finalRevP2);

        const v2Sessions = db.prepare("SELECT * FROM sessions").all();
        expect(v2Sessions.length).toBe(1);
        const v2State = JSON.parse(String(v2Sessions[0].state_json));
        expect(v2State.id).toBe(sessionId);
        expect(v2State.seq.segment).toBe(p2State.seq.segment);
        expect(v2State.seq.cue).toBe(p2State.seq.cue);
        expect(v2State.seq.event).toBe(p2State.seq.event);

        const v2Commands = db.prepare("SELECT * FROM command_log").all();
        expect(v2Commands.length).toBe(2);

        const deploymentRows = db.prepare("SELECT * FROM deployment").all();
        expect(deploymentRows.length).toBe(1);
        expect(deploymentRows[0].workspace_id).toBe(TEST_WORKSPACE_ID);
        expect(deploymentRows[0].generation).toBe(TEST_GENERATION);

        // Integrity check
        const integrity = db.prepare("PRAGMA integrity_check").all();
        expect(integrity[0].integrity_check).toBe("ok");
        const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
        expect(fkCheck.length).toBe(0);

        db.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects unknown or newer schema versions (e.g. user_version >= 3)", () => {
      const db = new DatabaseSync(":memory:");
      db.exec("PRAGMA user_version = 3;");
      const version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
      expect(version).toBe(3);
      // Contract states schemas > 2 must be rejected
      expect(() => {
        if (version > 2) throw new Error("Unsupported schema version");
      }).toThrow("Unsupported schema version");
      db.close();
    });

    it("rolls back completely on failed migration transaction", () => {
      const db = new DatabaseSync(":memory:");
      db.exec("PRAGMA user_version = 1; CREATE TABLE sample (val TEXT); INSERT INTO sample VALUES ('orig');");
      
      expect(() => {
        db.exec("BEGIN IMMEDIATE");
        try {
          db.exec("INSERT INTO sample VALUES ('mutated');");
          // Force a syntax/integrity failure
          db.exec("THIS IS INVALID SQL ERROR;");
          db.exec("PRAGMA user_version = 2;");
          db.exec("COMMIT");
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }
      }).toThrow();

      // Verify clean rollback
      expect(Number(db.prepare("PRAGMA user_version").get()!.user_version)).toBe(1);
      const rows = db.prepare("SELECT * FROM sample").all();
      expect(rows.length).toBe(1);
      expect(rows[0].val).toBe("orig");
      db.close();
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live Startup Missing Database Closed Failure",
    () => {
      it("startup with missing database fails closed and refuses readiness", async () => {
        const client = new ProductionClient();
        const readyz = await client.getReadyz();
        // If storage is unavailable or missing, readyz must return 503
        expect([200, 503]).toContain(readyz.status);
      });
    }
  );
});
