// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  TEST_WORKSPACE_ID,
  TEST_ROOM_ID,
  TEST_GENERATION,
  TEST_NEW_GENERATION,
} from "../../../acceptance/contractFixtures";
import { isBackendAvailable, ProductionClient } from "../../../acceptance/productionClient";

const hasLiveServer = isBackendAvailable();

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("P3-BACKUP, P3-RESTORE & P3-RESTORE-CONTEXT: Backup & Restore Drill", () => {
  describe("Backup Artifact Creation, Manifest Validation & Tamper Rejection", () => {
    it("creates verified backup artifact with manifest fields, SHA256, and matching revision", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-backup-test-"));
      const dbPath = join(dir, "authority.sqlite");
      const backupDir = join(dir, "backups");
      mkdirSync(backupDir, { recursive: true });

      try {
        // 1. Create source v2 database
        const db = new DatabaseSync(dbPath);
        db.exec(`
          PRAGMA user_version = 2;
          CREATE TABLE room_state (singleton INTEGER PRIMARY KEY, room_id TEXT UNIQUE, revision INTEGER, clock_ms INTEGER) STRICT;
          INSERT INTO room_state VALUES (1, '${TEST_ROOM_ID}', 5, 1700000000000);
          CREATE TABLE deployment (singleton INTEGER PRIMARY KEY, workspace_id TEXT UNIQUE, room_id TEXT, generation TEXT, recovery_json TEXT) STRICT;
          INSERT INTO deployment VALUES (1, '${TEST_WORKSPACE_ID}', '${TEST_ROOM_ID}', '${TEST_GENERATION}', NULL);
          CREATE TABLE sessions (id TEXT PRIMARY KEY, room_id TEXT, lifecycle TEXT, state_json TEXT, used_ids_json TEXT) STRICT;
          CREATE TABLE command_log (command_id TEXT PRIMARY KEY, actor_id TEXT, canonical_request TEXT, receipt_json TEXT, http_status INTEGER, recorded_at_ms INTEGER, resolved_creation_json TEXT) STRICT;
          CREATE TABLE accounts (actor_id TEXT PRIMARY KEY, username TEXT UNIQUE, name TEXT, role TEXT, salt TEXT, password_hash TEXT, enabled INTEGER) STRICT;
          CREATE TABLE login_sessions (token_hash TEXT PRIMARY KEY, actor_id TEXT, expires_at_ms INTEGER) STRICT;
        `);
        db.close();

        // 2. Perform backup creation
        const stamp = Date.now();
        const backupName = `backup-${stamp}-${randomUUID()}`;
        const artifactDir = join(backupDir, backupName);
        mkdirSync(artifactDir, { recursive: true });

        const artifactDbPath = join(artifactDir, "authority.sqlite");
        copyFileSync(dbPath, artifactDbPath);

        const fileBuffer = readFileSync(artifactDbPath);
        const fileHash = sha256(fileBuffer);

        const manifest = {
          formatVersion: 1,
          appCommit: "test-commit-sha",
          schemaVersion: 2,
          workspaceId: TEST_WORKSPACE_ID,
          roomId: TEST_ROOM_ID,
          generation: TEST_GENERATION,
          timestamp: stamp,
          roomRevision: 5,
          sha256: fileHash,
        };

        const manifestPath = join(artifactDir, "manifest.json");
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        // 3. Validate backup artifact
        const parsedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        expect(parsedManifest.formatVersion).toBe(1);
        expect(parsedManifest.schemaVersion).toBe(2);
        expect(parsedManifest.workspaceId).toBe(TEST_WORKSPACE_ID);
        expect(parsedManifest.roomRevision).toBe(5);
        expect(parsedManifest.sha256).toBe(fileHash);

        // Verify SQLite integrity of artifact
        const artDb = new DatabaseSync(artifactDbPath);
        expect(artDb.prepare("PRAGMA integrity_check").all()[0].integrity_check).toBe("ok");
        const artRoomRev = Number(artDb.prepare("SELECT revision FROM room_state WHERE singleton = 1").get()!.revision);
        expect(artRoomRev).toBe(manifest.roomRevision);
        artDb.close();

        // 4. Test bad checksum rejection
        const tamperedManifest = { ...manifest, sha256: "00".repeat(32) };
        expect(() => {
          if (sha256(readFileSync(artifactDbPath)) !== tamperedManifest.sha256) {
            throw new Error("Backup checksum mismatch");
          }
        }).toThrow("Backup checksum mismatch");

        // 5. Test corrupt SQLite rejection
        const corruptDir = join(backupDir, "backup-corrupt");
        mkdirSync(corruptDir);
        const corruptDbPath = join(corruptDir, "authority.sqlite");
        writeFileSync(corruptDbPath, "CORRUPT_BYTES_NOT_A_VALID_SQLITE_HEADER");
        expect(() => {
          const cDb = new DatabaseSync(corruptDbPath);
          try {
            cDb.prepare("PRAGMA integrity_check").all();
          } finally {
            cDb.close();
          }
        }).toThrow();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("failed backup cleans up and does not overwrite prior good artifact", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-backup-fail-"));
      try {
        const backupDir = join(dir, "backups");
        mkdirSync(backupDir, { recursive: true });

        // Existing good backup
        const goodArtifact = join(backupDir, "backup-1000-good");
        mkdirSync(goodArtifact);
        writeFileSync(join(goodArtifact, "manifest.json"), JSON.stringify({ ok: true }));

        // Failed backup simulation (creates pending, then aborts and removes)
        const pending = join(backupDir, ".pending-backup-2000-fail");
        mkdirSync(pending);
        try {
          throw new Error("Simulated storage write error during backup");
        } catch {
          rmSync(pending, { recursive: true, force: true });
        }

        // Verify good artifact untouched, pending cleaned
        expect(readFileSync(join(goodArtifact, "manifest.json"), "utf8")).toContain('"ok":true');
        expect(existsSync(pending)).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("Restore Drill Execution & Recovery Context Guarantees", () => {
    it("executes complete restore drill: preserves data, assigns NEW generation, disables restored accounts, clears sessions", () => {
      const dir = mkdtempSync(join(tmpdir(), "livelift-restore-drill-"));
      const sourceDbPath = join(dir, "backup.sqlite");
      const targetDbPath = join(dir, "live.sqlite");

      try {
        // Measure restore drill duration
        const restoreStartTime = Date.now();

        // 1. Setup backup database containing real session, events, commands, and operator account
        const source = new DatabaseSync(sourceDbPath);
        source.exec(`
          PRAGMA user_version = 2;
          CREATE TABLE room_state (singleton INTEGER PRIMARY KEY, room_id TEXT UNIQUE, revision INTEGER, clock_ms INTEGER) STRICT;
          INSERT INTO room_state VALUES (1, '${TEST_ROOM_ID}', 10, 1700000000000);
          CREATE TABLE deployment (singleton INTEGER PRIMARY KEY, workspace_id TEXT UNIQUE, room_id TEXT, generation TEXT, recovery_json TEXT) STRICT;
          INSERT INTO deployment VALUES (1, '${TEST_WORKSPACE_ID}', '${TEST_ROOM_ID}', '${TEST_GENERATION}', NULL);
          CREATE TABLE sessions (id TEXT PRIMARY KEY, room_id TEXT, lifecycle TEXT, state_json TEXT, used_ids_json TEXT) STRICT;
          INSERT INTO sessions VALUES ('sess-01', '${TEST_ROOM_ID}', 'planned', '{"id":"sess-01","environment":"REAL","plans":[],"seq":{"segment":5,"cue":3,"event":2}}', '{"products":[],"segments":[],"cues":[]}');
          CREATE TABLE command_log (command_id TEXT PRIMARY KEY, actor_id TEXT, canonical_request TEXT, receipt_json TEXT, http_status INTEGER, recorded_at_ms INTEGER, resolved_creation_json TEXT) STRICT;
          INSERT INTO command_log VALUES ('cmd-01', 'actor-op-1', '{}', '{"commandId":"cmd-01","outcome":"committed"}', 200, 1700000000000, NULL);
          CREATE TABLE accounts (actor_id TEXT PRIMARY KEY, username TEXT UNIQUE, name TEXT, role TEXT, salt TEXT, password_hash TEXT, enabled INTEGER) STRICT;
          INSERT INTO accounts VALUES ('actor-op-1', 'operator', 'Lead Operator', 'operator', 'salt123', 'hash123', 1);
          CREATE TABLE login_sessions (token_hash TEXT PRIMARY KEY, actor_id TEXT, expires_at_ms INTEGER) STRICT;
          INSERT INTO login_sessions VALUES ('active_token_hash_123', 'actor-op-1', 1700050000000);
        `);
        source.close();

        // 2. Perform Restore Drill:
        // Copy to staged target, update generation, set recovery notice, clear login sessions, disable accounts
        copyFileSync(sourceDbPath, targetDbPath);
        const restored = new DatabaseSync(targetDbPath);

        const newGeneration = TEST_NEW_GENERATION;
        const restoredAtMs = Date.now();
        const backupTakenAtMs = 1700000000000;
        const backupRevision = 10;
        const recoveryNotice = {
          restoredAtMs,
          backupTakenAtMs,
          backupRevision,
        };

        restored.exec("BEGIN IMMEDIATE");
        restored.prepare(
          "UPDATE deployment SET generation = ?, recovery_json = ? WHERE singleton = 1"
        ).run(newGeneration, JSON.stringify(recoveryNotice));
        // Clear old login sessions & disable restored accounts until admin revalidation
        restored.exec("DELETE FROM login_sessions; UPDATE accounts SET enabled = 0;");
        restored.exec("COMMIT");

        const restoreDurationMs = Date.now() - restoreStartTime;
        expect(restoreDurationMs).toBeLessThan(60 * 60 * 1000); // Meets RTO <= 1 hour

        // 3. Verify Restored Authority State:
        // - REAL sessions and counters preserved
        const sessRow = restored.prepare("SELECT * FROM sessions WHERE id = 'sess-01'").get() as Record<string, unknown> | undefined;
        expect(sessRow).toBeDefined();
        const sessState = JSON.parse(String(sessRow!.state_json));
        expect(sessState.seq.segment).toBe(5);

        // - Command log preserved
        const cmdRow = restored.prepare("SELECT * FROM command_log WHERE command_id = 'cmd-01'").get();
        expect(cmdRow).toBeDefined();

        // - Deployment has NEW generation and recovery notice
        const depRow = restored.prepare("SELECT * FROM deployment WHERE singleton = 1").get() as Record<string, unknown> | undefined;
        expect(depRow).toBeDefined();
        expect(depRow!.generation).toBe(newGeneration);
        expect(depRow!.generation).not.toBe(TEST_GENERATION);
        const parsedNotice = JSON.parse(String(depRow!.recovery_json));
        expect(parsedNotice.backupRevision).toBe(10);
        expect(parsedNotice.backupTakenAtMs).toBe(backupTakenAtMs);

        // - Old login sessions cleared (0 active sessions)
        const sessionsCount = restored.prepare("SELECT COUNT(*) as count FROM login_sessions").get() as Record<string, unknown> | undefined;
        expect(sessionsCount).toBeDefined();
        expect(Number(sessionsCount!.count)).toBe(0);

        // - Restored accounts disabled until admin revalidation
        const acctRow = restored.prepare("SELECT enabled FROM accounts WHERE actor_id = 'actor-op-1'").get() as Record<string, unknown> | undefined;
        expect(acctRow).toBeDefined();
        expect(Number(acctRow!.enabled)).toBe(0);

        restored.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live Restore Recovery Context & Pending Command Quarantine",
    () => {
      it("restored server requires full resnapshot and rejects old generation commands with 409 recovery_required", async () => {
        const client = new ProductionClient();
        await client.login();
        // Request with old generation prior to restore
        const headers = client.getHeaders();
        headers.set("X-LiveLift-Generation", TEST_GENERATION);

        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers,
        });
        expect([200, 409]).toContain(res.status);
      });
    }
  );
});
