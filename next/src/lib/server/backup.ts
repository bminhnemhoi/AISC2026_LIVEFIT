import { backup, type DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, openSync, fsyncSync, closeSync, lstatSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";
import type { ProductionConfig } from "./config";
import { deployment, migrateV1, openExisting, schemaVersion, verifyDatabase, writableProbe, transaction } from "./database";
import { assertManagedArtifact, assertNotRetired, beginMaintenance, durableJson, finishMaintenance, managedDirectory, syncDirectory, backupArtifacts } from "./lifecycle";
import { log } from "./log";

const manifestSchema = z.object({
  formatVersion: z.literal(1), appCommit: z.string().min(1).max(128), schemaVersion: z.union([z.literal(1), z.literal(2)]),
  workspaceId: z.string().uuid(), roomId: z.string().min(1), generation: z.string().uuid(), timestamp: z.number().int().nonnegative(),
  roomRevision: z.number().int().safe().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type BackupManifest = z.infer<typeof manifestSchema>;
export async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
function syncFile(path: string): void { const fd = openSync(path, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } }

export async function createBackup(db: DatabaseSync, config: ProductionConfig, appCommit: string): Promise<string> {
  assertNotRetired(config);
  const version = schemaVersion(db);
  verifyDatabase(db, config, true);
  mkdirSync(config.backupDir, { recursive: true, mode: 0o700 });
  const stamp = Date.now();
  const name = `backup-${stamp}-${randomUUID()}`;
  const pending = join(config.backupDir, `.pending-${name}`);
  const published = join(config.backupDir, name);
  mkdirSync(pending, { mode: 0o700 });
  try {
    const path = join(pending, "authority.sqlite");
    await backup(db, path);
    const destination = openExisting(path);
    let meta: Pick<BackupManifest, "workspaceId" | "roomId" | "generation" | "roomRevision">;
    try {
      verifyDatabase(destination, config, true);
      const context = version === 2 ? deployment(destination) : { workspaceId: config.workspaceId, roomId: config.roomId, generation: randomUUID() };
      meta = { workspaceId: context.workspaceId, roomId: context.roomId, generation: context.generation, roomRevision: Number(destination.prepare("SELECT revision FROM room_state WHERE singleton = 1").get()!.revision) };
      // Closing the destination before hashing ensures the artifact has no attached WAL.
      destination.exec("PRAGMA journal_mode = DELETE");
    } finally { destination.close(); }
    syncFile(path);
    const manifest: BackupManifest = { formatVersion: 1, appCommit, schemaVersion: version as 1 | 2, ...meta, timestamp: stamp, sha256: await sha256(path) };
    durableJson(join(pending, "manifest.json"), manifest);
    syncDirectory(pending);
    renameSync(pending, published); syncDirectory(config.backupDir);
    log("backup_published", { workspaceId: config.workspaceId, roomId: config.roomId, revision: meta.roomRevision });
    return published;
  } catch (error) { rmSync(pending, { recursive: true, force: true }); log("backup_failed", { resultCode: "storage_unavailable" }, "error"); throw error; }
}
export async function validateArtifact(artifact: string, config: ProductionConfig): Promise<BackupManifest> {
  assertManagedArtifact(config, artifact);
  for (const path of [artifact, join(artifact, "authority.sqlite"), join(artifact, "manifest.json")]) if (lstatSync(path).isSymbolicLink()) throw new Error("Backup symlinks are not permitted");
  if (lstatSync(join(artifact, "manifest.json")).size > 4096) throw new Error("Invalid backup manifest size");
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(artifact, "manifest.json"), "utf8")));
  assertNotRetired(config);
  if (manifest.workspaceId !== config.workspaceId || manifest.roomId !== config.roomId) throw new Error("Backup identity mismatch");
  const path = join(artifact, "authority.sqlite");
  for (const sidecar of ["-wal", "-shm", "-journal"]) if (existsSync(path + sidecar)) throw new Error("Artifact must be a closed standalone database");
  if (await sha256(path) !== manifest.sha256) throw new Error("Backup checksum mismatch");
  const db = openExisting(path, true);
  try {
    verifyDatabase(db, config, true);
    if (schemaVersion(db) !== manifest.schemaVersion || Number(db.prepare("SELECT revision FROM room_state").get()!.revision) !== manifest.roomRevision) throw new Error("Backup metadata mismatch");
    if (manifest.schemaVersion === 2 && deployment(db).generation !== manifest.generation) throw new Error("Backup generation mismatch");
  } finally { db.close(); }
  return manifest;
}

export async function restoreBackup(artifact: string, config: ProductionConfig, resume = false): Promise<void> {
  const manifest = await validateArtifact(artifact, config);
  beginMaintenance(config, "restore", resume);
  const staging = join(managedDirectory(config, "staging"), `${randomUUID()}.sqlite`);
  const rollback = join(managedDirectory(config, "rollback"), `${Date.now()}-${randomUUID()}`);
  try {
    const source = openExisting(join(artifact, "authority.sqlite"), true);
    try { await backup(source, staging); } finally { source.close(); }
    const staged = openExisting(staging);
    try {
      if (schemaVersion(staged) === 1) migrateV1(staged, config);
      transaction(staged, () => {
        staged.prepare("UPDATE deployment SET generation = ?, recovery_json = ? WHERE singleton = 1").run(randomUUID(), JSON.stringify({ restoredAtMs: Date.now(), backupTakenAtMs: manifest.timestamp, backupRevision: manifest.roomRevision }));
        staged.exec("DELETE FROM login_sessions; UPDATE accounts SET enabled = 0;");
      });
      verifyDatabase(staged, config); writableProbe(staged);
      staged.exec("PRAGMA journal_mode = DELETE");
    } finally { staged.close(); }
    syncFile(staging);
    // The CLI holds exclusive maintenance flock; all service connections are closed.
    // Move the offline installation and sidecars together, even when SQLite cannot open corruption.
    mkdirSync(rollback, { mode: 0o700 });
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      if (existsSync(config.dbPath + suffix)) renameSync(config.dbPath + suffix, join(rollback, "authority.sqlite" + suffix));
    }
    syncDirectory(rollback); syncDirectory(dirname(rollback)); syncDirectory(dirname(config.dbPath));
    renameSync(staging, config.dbPath); syncDirectory(dirname(config.dbPath));
    const installed = openExisting(config.dbPath);
    try { verifyDatabase(installed, config); writableProbe(installed); } finally { installed.close(); }
    finishMaintenance(config);
    log("restore_completed", { workspaceId: config.workspaceId, roomId: config.roomId, revision: manifest.roomRevision });
  } catch (error) { log("restore_interrupted", { resultCode: "storage_unavailable" }, "error"); throw error; }
}

/** Only verified, aged snapshots of this workspace are pruned. */
export async function pruneBackups(config: ProductionConfig, retentionDays = 14): Promise<void> {
  for (const artifact of backupArtifacts(config)) {
    const raw = JSON.parse(readFileSync(join(artifact, "manifest.json"), "utf8"));
    if (raw.workspaceId !== config.workspaceId) continue;
    const manifest = await validateArtifact(artifact, config);
    if (manifest.timestamp < Date.now() - retentionDays * 86400000) rmSync(artifact, { recursive: true });
  }
  if (existsSync(config.backupDir)) syncDirectory(config.backupDir);
}
