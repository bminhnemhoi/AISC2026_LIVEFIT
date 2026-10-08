import { DatabaseSync } from "node:sqlite";
import { constants, closeSync, existsSync, lstatSync, mkdirSync, openSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { z } from "zod";
import { LiveIntelligenceSnapshotSchema, ProviderFailureSchema, CreatorEvidenceSchema, type CreatorEvidence, type LiveIntelligenceSnapshot, type ProviderFailure } from "@/contracts/liveIntelligence";
import { AuthorityError } from "../config";

export interface EvidenceIdentity { workspaceId: string; generation: string; roomId: string }
export interface EvidenceScope extends EvidenceIdentity { sessionId: string; mode: "REAL" | "SIMULATED" }
export { CreatorEvidenceSchema, type CreatorEvidence } from "@/contracts/liveIntelligence";
export type RefreshResult = { state: "AVAILABLE"; snapshot?: LiveIntelligenceSnapshot; telemetry?: CreatorEvidence } | ProviderFailure;
export function parseRefreshResult(raw: unknown): RefreshResult {
  const result = z.union([z.object({ state: z.literal("AVAILABLE"), snapshot: LiveIntelligenceSnapshotSchema }).strict(), z.object({ state: z.literal("AVAILABLE"), telemetry: CreatorEvidenceSchema }).strict(), ProviderFailureSchema]).parse(raw);
  return result;
}
const SQL = `
CREATE TABLE evidence_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), workspace_id TEXT NOT NULL, room_id TEXT NOT NULL) STRICT;
CREATE TABLE session_mappings (generation TEXT NOT NULL, session_id TEXT NOT NULL, mode TEXT NOT NULL, provider_session_id TEXT NOT NULL, provider_binding TEXT NOT NULL,
  PRIMARY KEY(generation, session_id, mode), UNIQUE(generation, mode, provider_session_id, provider_binding)) STRICT;
CREATE TABLE snapshots (snapshot_id TEXT PRIMARY KEY, generation TEXT NOT NULL, session_id TEXT NOT NULL, mode TEXT NOT NULL, fetched_at INTEGER NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json))) STRICT;
CREATE INDEX snapshots_session ON snapshots(generation, session_id, mode, fetched_at);
CREATE TABLE creator_evidence (telemetry_id TEXT PRIMARY KEY, generation TEXT NOT NULL, session_id TEXT NOT NULL, mode TEXT NOT NULL, recorded_at INTEGER NOT NULL, evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json))) STRICT;
CREATE INDEX creator_session ON creator_evidence(generation, session_id, mode, recorded_at);
CREATE TABLE refresh_commands (command_id TEXT PRIMARY KEY, generation TEXT NOT NULL, actor_id TEXT NOT NULL, session_id TEXT NOT NULL, mode TEXT NOT NULL,
  intent_hash TEXT NOT NULL, created_at INTEGER NOT NULL, result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json))) STRICT;
PRAGMA user_version=1;
`;

/** Separate append-only analytics, no credential columns, no authority migrations or backup coupling. */
export class EvidenceStore {
  readonly db: DatabaseSync;
  constructor(path: string, readonly identity: EvidenceIdentity) {
    if (!isAbsolute(path)) throw new Error("Absolute evidence path required");
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    for (let p = dirname(path); ; p = dirname(p)) {
      if (lstatSync(p).isSymbolicLink()) throw new Error("Symlinked evidence directory");
      if (dirname(p) === p) break;
    }
    if (!existsSync(path)) { const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600); closeSync(fd); }
    const file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink() || file.nlink !== 1 || file.mode & 0o077 || file.uid !== process.getuid?.()) throw new Error("Unsafe evidence file permissions or ownership");
    const parent = lstatSync(dirname(path));
    if (parent.mode & 0o022 || parent.uid !== process.getuid?.()) throw new Error("Unsafe evidence directory");
    const db = new DatabaseSync(path); this.db = db;
    try {
      db.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
      const version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
      if (version === 0) {
        if (Number(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get()!.n)) throw new Error("Unknown evidence schema");
        this.transaction(() => {
          db.exec(SQL);
          db.prepare("INSERT INTO evidence_meta VALUES (1, ?, ?)").run(identity.workspaceId, identity.roomId);
          for (const table of ["evidence_meta", "session_mappings", "snapshots", "creator_evidence"]) {
            for (const op of ["UPDATE", "DELETE"]) db.exec(`CREATE TRIGGER immutable_${table}_${op} BEFORE ${op} ON ${table} BEGIN SELECT RAISE(ABORT, 'evidence is immutable'); END;`);
          }
        });
      } else if (version !== 1) throw new Error("Unsupported evidence schema");
      const meta = db.prepare("SELECT workspace_id, room_id FROM evidence_meta WHERE singleton=1").get();
      if (meta?.workspace_id !== identity.workspaceId || meta?.room_id !== identity.roomId) throw new Error("Evidence store identity mismatch");
    } catch (error) { db.close(); throw error; }
  }
  close(): void { this.db.close(); }
  transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const value = operation(); this.db.exec("COMMIT"); return value; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private check(scope: EvidenceScope): void {
    if (scope.workspaceId !== this.identity.workspaceId || scope.roomId !== this.identity.roomId || scope.generation !== this.identity.generation) throw new AuthorityError(404, "not_found", "Evidence context not found.");
  }
  claim(scope: EvidenceScope, commandId: string, actorId: string, hash: string, now: number, validateNew = () => {}): { duplicate: boolean; result?: RefreshResult } {
    this.check(scope);
    return this.transaction(() => {
      const row = this.db.prepare("SELECT * FROM refresh_commands WHERE command_id=?").get(commandId);
      if (row) {
        if (row.actor_id !== actorId || row.generation !== scope.generation || row.intent_hash !== hash || row.session_id !== scope.sessionId || row.mode !== scope.mode) throw new AuthorityError(409, "idempotency_conflict", "Command identifies another actor or intent.");
        return { duplicate: true, result: row.result_json ? parseRefreshResult(JSON.parse(String(row.result_json))) : { state: "UNAVAILABLE", code: "outcome_unknown" } };
      }
      validateNew();
      this.db.prepare("INSERT INTO refresh_commands VALUES (?, ?, ?, ?, ?, ?, ?, NULL)").run(commandId, scope.generation, actorId, scope.sessionId, scope.mode, hash, now);
      return { duplicate: false };
    });
  }
  bind(scope: EvidenceScope, providerSessionId: string, providerBinding: string): void {
    this.check(scope);
    const prior = this.db.prepare("SELECT provider_session_id, provider_binding FROM session_mappings WHERE generation=? AND session_id=? AND mode=?").get(scope.generation, scope.sessionId, scope.mode);
    if (prior) {
      if (prior.provider_session_id !== providerSessionId || prior.provider_binding !== providerBinding) throw new AuthorityError(409, "mapping_conflict", "This show is already bound to another provider session or shop.");
      return;
    }
    const other = this.db.prepare("SELECT session_id FROM session_mappings WHERE generation=? AND mode=? AND provider_session_id=? AND provider_binding=?").get(scope.generation, scope.mode, providerSessionId, providerBinding);
    if (other) throw new AuthorityError(409, "mapping_conflict", "Provider session is already mapped to another show.");
    this.db.prepare("INSERT INTO session_mappings VALUES (?, ?, ?, ?, ?)").run(scope.generation, scope.sessionId, scope.mode, providerSessionId, providerBinding);
  }
  finish(scope: EvidenceScope, commandId: string, result: RefreshResult): RefreshResult {
    this.check(scope); result = parseRefreshResult(result);
    return this.transaction(() => {
      if (result.state === "AVAILABLE" && result.snapshot) {
        const s = result.snapshot;
        if (s.sessionId !== scope.sessionId || s.mode !== scope.mode) throw new Error("Snapshot context mismatch");
        this.db.prepare("INSERT INTO snapshots VALUES (?, ?, ?, ?, ?, ?)").run(s.snapshotId, scope.generation, s.sessionId, s.mode, s.fetchedAt, JSON.stringify(s));
      }
      if (result.state === "AVAILABLE" && result.telemetry) {
        const e = result.telemetry;
        if (e.sessionId !== scope.sessionId || e.mode !== scope.mode) throw new Error("Telemetry context mismatch");
        this.db.prepare("INSERT INTO creator_evidence VALUES (?, ?, ?, ?, ?, ?)").run(e.telemetryId, scope.generation, e.sessionId, e.mode, e.recordedAt, JSON.stringify(e));
      }
      if (Number(this.db.prepare("UPDATE refresh_commands SET result_json=? WHERE command_id=? AND generation=? AND session_id=? AND mode=? AND result_json IS NULL").run(JSON.stringify(result), commandId, scope.generation, scope.sessionId, scope.mode).changes) !== 1) throw new Error("Command already completed or missing");
      return result;
    });
  }
  latest(scope: EvidenceScope, snapshotId?: string): LiveIntelligenceSnapshot | null {
    this.check(scope);
    const row = this.db.prepare(`SELECT snapshot_json FROM snapshots WHERE generation=? AND session_id=? AND mode=? ${snapshotId ? "AND snapshot_id=?" : ""} ORDER BY fetched_at DESC, rowid DESC LIMIT 1`).get(scope.generation, scope.sessionId, scope.mode, ...(snapshotId ? [snapshotId] : []));
    return row ? LiveIntelligenceSnapshotSchema.parse(JSON.parse(String(row.snapshot_json))) : null;
  }
  history(scope: EvidenceScope): { snapshotId: string; fetchedAt: number }[] {
    this.check(scope);
    return this.db.prepare("SELECT snapshot_id, fetched_at FROM snapshots WHERE generation=? AND session_id=? AND mode=? ORDER BY fetched_at DESC, rowid DESC LIMIT 100").all(scope.generation, scope.sessionId, scope.mode).map((r) => ({ snapshotId: String(r.snapshot_id), fetchedAt: Number(r.fetched_at) }));
  }
  knownTelemetry(scope: EvidenceScope, asOfMs: number): CreatorEvidence[] {
    this.check(scope);
    return this.db.prepare("SELECT evidence_json FROM creator_evidence WHERE generation=? AND session_id=? AND mode=? AND recorded_at<=? ORDER BY recorded_at, rowid LIMIT 1000").all(scope.generation, scope.sessionId, scope.mode, asOfMs)
      .map((r) => CreatorEvidenceSchema.parse(JSON.parse(String(r.evidence_json)))).filter((e) => e.observedAt <= asOfMs);
  }
  state(scope: EvidenceScope): RefreshResult["state"] | "FETCHING" | undefined {
    this.check(scope);
    const row = this.db.prepare("SELECT result_json FROM refresh_commands WHERE generation=? AND session_id=? AND mode=? ORDER BY rowid DESC LIMIT 1").get(scope.generation, scope.sessionId, scope.mode);
    return row ? row.result_json ? parseRefreshResult(JSON.parse(String(row.result_json))).state : "FETCHING" : undefined;
  }
}
