import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ProductionConfig } from "./config";
import { V1_SQL } from "./schema";
import { deployment, migrateV1, openExisting, schemaVersion, verifyDatabase, writableProbe } from "./database";
import { createBackup, validateArtifact } from "./backup";
import { assertNotRetired, beginMaintenance, finishMaintenance, markerPath, retire, removeDatabase, backupArtifacts, syncDirectory } from "./lifecycle";
import { pruneOffHostWorkspace } from "./offhost";
import { providerStorePath } from "./tiktok/config";
import { removeProviderStoreFiles } from "./tiktok/store";
import { loadIntelligenceConfig } from "./liveIntelligence/config";
import { EvidenceStore } from "./liveIntelligence/store";
import { log } from "./log";

export function initialize(config: ProductionConfig): void {
  assertNotRetired(config);
  if (existsSync(config.dbPath) || ["-wal", "-shm", "-journal"].some((s) => existsSync(config.dbPath + s))) throw new Error("Installation already exists or has sidecars");
  beginMaintenance(config, "init");
  const db = new DatabaseSync(config.dbPath);
  try {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
    db.exec(V1_SQL);
    db.prepare("INSERT INTO room_state VALUES(1, ?, 0, ?)").run(config.roomId, Date.now());
    migrateV1(db, config);
    verifyDatabase(db, config); writableProbe(db);
  } finally { db.close(); }
  finishMaintenance(config);
  log("installation_initialized", { workspaceId: config.workspaceId, roomId: config.roomId });
}
export async function migrateInstallation(config: ProductionConfig, appCommit: string, resume = false): Promise<void> {
  assertNotRetired(config);
  beginMaintenance(config, "migrate", resume);
  const db = openExisting(config.dbPath);
  try {
    if (schemaVersion(db) !== 1) throw new Error("Only the ordered v1 -> v2 migration is supported");
    const artifact = await createBackup(db, config, appCommit);
    await validateArtifact(artifact, config);
    migrateV1(db, config);
    verifyDatabase(db, config); writableProbe(db);
  } catch (error) { log("migration_failed", { resultCode: "storage_unavailable" }, "error"); throw error; }
  finally { db.close(); }
  finishMaintenance(config);
  log("migration_completed", { workspaceId: config.workspaceId, roomId: config.roomId });
}
export function status(config: ProductionConfig): Record<string, unknown> {
  const base = { nodeVersion: process.version, appCommit: process.env.LIVELIFT_APP_COMMIT ?? "unknown", supportedSchema: 2, maintenance: existsSync(markerPath(config)) };
  let db: DatabaseSync | undefined;
  try {
    assertNotRetired(config);
    db = openExisting(config.dbPath);
    const version = schemaVersion(db);
    verifyDatabase(db, config, true);
    let writable = false;
    if (version === 2 && !base.maintenance) { writableProbe(db); writable = true; }
    return { ...base, schemaVersion: version, sqliteVersion: String(db.prepare("SELECT sqlite_version() AS version").get()!.version), integrity: "ok", ready: writable, context: version === 2 ? deployment(db) : { workspaceId: config.workspaceId, roomId: config.roomId }, roomRevision: Number(db.prepare("SELECT revision FROM room_state").get()!.revision), counts: { sessions: Number(db.prepare("SELECT count(*) AS n FROM sessions").get()!.n), receipts: Number(db.prepare("SELECT count(*) AS n FROM command_log").get()!.n), accounts: version === 2 ? Number(db.prepare("SELECT count(*) AS n FROM accounts").get()!.n) : 0 } };
  } catch { return { ...base, ready: false, integrity: "unavailable", errors: ["storage_schema_or_identity_unavailable"] }; }
  finally { db?.close(); }
}
export function deleteWorkspace(config: ProductionConfig, confirmation: string, prune: boolean, resume = false): void {
  if (confirmation !== config.workspaceId) throw new Error("Type the exact workspace UUID to confirm deletion");
  if (!resume) {
    const db = openExisting(config.dbPath);
    try {
      verifyDatabase(db, config);
      if (db.prepare("SELECT 1 FROM sessions WHERE lifecycle = 'active'").get()) throw new Error("End the active LIVE before ordinary deletion");
    } finally { db.close(); }
  }
  beginMaintenance(config, "delete-workspace", resume);
  // Retirement protection remains outside backups and all workspace-owned folders.
  retire(config);
  try {
    if (prune) {
      pruneOffHostWorkspace(config);
      for (const artifact of backupArtifacts(config)) {
        const manifest = JSON.parse(readFileSync(join(artifact, "manifest.json"), "utf8"));
        if (manifest.workspaceId === config.workspaceId) rmSync(artifact, { recursive: true });
      }
      if (existsSync(config.backupDir)) syncDirectory(config.backupDir);
    }
    const evidence = loadIntelligenceConfig(config.dbPath);
    if (evidence.issues.includes("LIVELIFT_PROVIDER_EVIDENCE_DB_PATH")) throw new Error("Unsafe provider evidence path");
    if (existsSync(evidence.config.dbPath)) {
      // Verify workspace/room ownership before the existing explicit administrator erase.
      new EvidenceStore(evidence.config.dbPath, { workspaceId: config.workspaceId, roomId: config.roomId, generation: "delete" }).close();
      removeDatabase(evidence.config.dbPath);
    }
    removeDatabase(config.dbPath);
    // Provider credentials belong to the workspace and are never backed up, so deletion must erase them here.
    removeProviderStoreFiles(providerStorePath(config));
    for (const name of ["exports", "staging", "rollback"]) rmSync(join(dirname(config.dbPath), name), { recursive: true, force: true });
    syncDirectory(dirname(config.dbPath));
    finishMaintenance(config);
    log("workspace_deleted", { workspaceId: config.workspaceId, roomId: config.roomId });
  } catch (error) { log("workspace_deletion_incomplete", { workspaceId: config.workspaceId, resultCode: "cleanup_failed" }, "error"); throw error; }
}
export function prepareStorage(config: ProductionConfig): void { mkdirSync(dirname(config.dbPath), { recursive: true, mode: 0o700 }); }
