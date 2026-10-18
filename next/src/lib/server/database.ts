import { DatabaseSync } from "node:sqlite";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SessionSchema } from "@/contracts";
import type { ProductionContext, RecoveryNotice, WorkspaceExport } from "@/contracts/production";
import type { ProductionConfig } from "./config";
import { AuthorityError } from "./config";
import { V2_SQL } from "./schema";
import { canonicalJson, envelopeSchema } from "./validation";

export function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const value = operation(); db.exec("COMMIT"); return value; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function openExisting(path: string, readOnly = false): DatabaseSync {
  if (!existsSync(path) || !statSync(path).isFile()) throw new AuthorityError(503, "storage_unavailable", "Managed database is missing.");
  accessSync(path, readOnly ? constants.R_OK : constants.R_OK | constants.W_OK);
  const db = new DatabaseSync(path, { readOnly });
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  return db;
}
export function schemaVersion(db: DatabaseSync): number { return Number(db.prepare("PRAGMA user_version").get()!.user_version); }
const recoverySchema = z.object({ restoredAtMs: z.number().int().nonnegative(), backupTakenAtMs: z.number().int().nonnegative(), backupRevision: z.number().int().safe().nonnegative() }).strict();
export function deployment(db: DatabaseSync): ProductionContext & { recoveryNotice: RecoveryNotice | null } {
  const row = db.prepare("SELECT * FROM deployment WHERE singleton = 1").get();
  if (!row) throw new Error("Deployment metadata missing");
  return { workspaceId: z.string().uuid().parse(row.workspace_id), roomId: z.string().min(1).parse(row.room_id), generation: z.string().uuid().parse(row.generation), recoveryNotice: row.recovery_json === null ? null : recoverySchema.parse(JSON.parse(String(row.recovery_json))) };
}
const receiptSchema = z.object({
  commandId: z.string().min(1), type: z.string().min(1), outcome: z.enum(["committed", "rejected"]),
  code: z.string().nullable(), message: z.string().nullable(), roomRevisionAfter: z.number().int().safe().nonnegative(),
  sessionId: z.string().nullable(), sessionRevisionAfter: z.number().int().safe().nonnegative().nullable(), eventIds: z.array(z.string()),
}).strict();
const usedSchema = z.object({ products: z.array(z.string()), segments: z.array(z.string()), cues: z.array(z.string()) }).strict();

/** Full validation shared by startup, migration, backup and restore. */
export function verifyDatabase(db: DatabaseSync, identity?: Pick<ProductionConfig, "roomId" | "workspaceId">, allowV1 = false): void {
  const version = schemaVersion(db);
  if (version !== 2 && !(allowV1 && version === 1)) throw new Error("Unsupported schema version");
  if (db.prepare("PRAGMA integrity_check").all().some((row) => row.integrity_check !== "ok")) throw new Error("Integrity check failed");
  if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Foreign key check failed");
  const rooms = db.prepare("SELECT * FROM room_state").all();
  if (rooms.length !== 1 || rooms[0].singleton !== 1 || !Number.isSafeInteger(rooms[0].revision) || Number(rooms[0].revision) < 0 || !Number.isSafeInteger(rooms[0].clock_ms)) throw new Error("Invalid room record");
  if (identity && rooms[0].room_id !== identity.roomId) throw new Error("Database belongs to another room");
  if (version === 2) {
    const meta = deployment(db);
    if (meta.roomId !== rooms[0].room_id || (identity && meta.workspaceId !== identity.workspaceId)) throw new Error("Deployment identity mismatch");
    for (const row of db.prepare("SELECT * FROM accounts").all()) {
      if (!/^[0-9a-f]{32,}$/.test(String(row.salt)) || String(row.salt).length % 2 || !/^[0-9a-f]{128}$/.test(String(row.password_hash))) throw new Error("Invalid credential record");
      if (!db.prepare("SELECT 1 FROM actor_ids WHERE actor_id = ?").get(row.actor_id)) throw new Error("Missing actor identity");
    }
    for (const row of db.prepare("SELECT * FROM login_sessions").all()) {
      if (!/^[0-9a-f]{64}$/.test(String(row.token_hash)) || !Number.isSafeInteger(row.expires_at_ms)) throw new Error("Invalid login session");
    }
  }
  const sessions = new Map<string, z.infer<typeof SessionSchema>>();
  for (const row of db.prepare("SELECT * FROM sessions").all()) {
    const session = SessionSchema.parse(JSON.parse(String(row.state_json)));
    const used = usedSchema.parse(JSON.parse(String(row.used_ids_json)));
    if (session.id !== row.id || session.lifecycle !== row.lifecycle || session.environment !== "REAL" || row.room_id !== rooms[0].room_id) throw new Error("Invalid persisted session binding");
    if (!Object.values(session.seq).every((n) => Number.isSafeInteger(n) && n >= 0 && n < Number.MAX_SAFE_INTEGER)) throw new Error("Invalid allocation counters");
    const present = { products: session.products.map((p) => p.id), segments: session.plans.flatMap((p) => p.segments.map((s) => s.id)), cues: session.plans.flatMap((p) => p.cues.map((c) => c.id)) };
    for (const kind of ["products", "segments", "cues"] as const) {
      if (new Set(used[kind]).size !== used[kind].length || present[kind].some((id) => !used[kind].includes(id))) throw new Error("Invalid used ID allocation record");
    }
    for (const [kind, prefix] of [["segments", "s"], ["cues", "c"]] as const) {
      for (const id of used[kind]) {
        const start = `${session.id}:${prefix}`;
        const suffix = id.slice(start.length);
        if (id.startsWith(start) && /^\d+$/.test(suffix) && Number(suffix) > session.seq[kind === "segments" ? "segment" : "cue"]) throw new Error("Allocation floor violated");
      }
    }
    for (const [key, action] of Object.entries(session.runtime.actions)) {
      const prefix = `${session.id}:x`;
      const suffix = key.slice(prefix.length);
      if (action.id !== key || (key.startsWith(prefix) && /^\d+$/.test(suffix) && Number(suffix) > session.seq.action)) throw new Error("Invalid action allocation record");
    }
    if (session.events.some((event) => event.seq > session.seq.event) || new Set(session.events.map((event) => event.id)).size !== session.events.length) throw new Error("Invalid event allocation record");
    sessions.set(session.id, session);
  }
  for (const row of db.prepare("SELECT * FROM command_log").all()) {
    const receipt = receiptSchema.parse(JSON.parse(String(row.receipt_json)));
    const input = JSON.parse(String(row.canonical_request));
    envelopeSchema.parse({ ...input, commandId: row.command_id });
    if (canonicalJson(input) !== row.canonical_request || receipt.commandId !== row.command_id || receipt.type !== input.type || receipt.roomRevisionAfter > Number(rooms[0].revision) || !String(row.actor_id) || !Number.isSafeInteger(row.recorded_at_ms)) throw new Error("Invalid durable receipt");
    if (receipt.outcome === "committed" && (!receipt.sessionId || !sessions.has(receipt.sessionId))) throw new Error("Missing receipt session");
    if (receipt.sessionId && receipt.eventIds.some((id) => !sessions.get(receipt.sessionId!)?.events.some((event) => event.id === id))) throw new Error("Missing receipt event");
    if (row.resolved_creation_json !== null) {
      const initial = SessionSchema.parse(JSON.parse(String(row.resolved_creation_json)));
      if (initial.environment !== "REAL" || initial.id !== receipt.sessionId) throw new Error("Invalid resolved creation");
    }
  }
}
export function migrateV1(db: DatabaseSync, identity: Pick<ProductionConfig, "workspaceId" | "roomId">): void {
  if (schemaVersion(db) !== 1) throw new Error("Migration requires schema version 1");
  verifyDatabase(db, identity, true);
  transaction(db, () => {
    db.exec(V2_SQL);
    db.prepare("INSERT INTO deployment VALUES (1, ?, ?, ?, NULL)").run(identity.workspaceId, identity.roomId, randomUUID());
    verifyDatabase(db, identity);
  });
}
export function writableProbe(db: DatabaseSync): void {
  db.exec("PRAGMA busy_timeout = 250");
  try {
    db.exec("BEGIN IMMEDIATE");
    try { db.exec("UPDATE room_state SET clock_ms = clock_ms WHERE singleton = 1"); }
    finally { db.exec("ROLLBACK"); }
  } finally { db.exec("PRAGMA busy_timeout = 5000"); }
}
export function exportWorkspace(db: DatabaseSync): WorkspaceExport {
  return transaction(db, () => {
    const { recoveryNotice: _notice, ...context } = deployment(db);
    const revision = Number(db.prepare("SELECT revision FROM room_state WHERE singleton = 1").get()!.revision);
    return { ...context, formatVersion: 1, exportedAtMs: Date.now(), snapshot: { roomId: context.roomId, revision, sessions: db.prepare("SELECT state_json FROM sessions ORDER BY rowid").all().map((r) => SessionSchema.parse(JSON.parse(String(r.state_json)))) }, receipts: db.prepare("SELECT actor_id, recorded_at_ms, receipt_json FROM command_log ORDER BY rowid").all().map((r) => ({ actorId: String(r.actor_id), recordedAtMs: Number(r.recorded_at_ms), receipt: receiptSchema.parse(JSON.parse(String(r.receipt_json))) })) };
  });
}
