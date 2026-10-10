import { spawn } from "node:child_process";
import { existsSync, openSync, writeSync, fsyncSync, closeSync, readFileSync, renameSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ProductionConfig } from "./config";

export function syncDirectory(path: string): void { const fd = openSync(path, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } }
export function durableJson(path: string, value: unknown): void {
  const temp = `${path}.${randomUUID()}.tmp`;
  const fd = openSync(temp, "wx", 0o600);
  try { writeSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path); syncDirectory(dirname(path));
}
export function markerPath(config: Pick<ProductionConfig, "dbPath">): string { return join(dirname(config.dbPath), ".livelift-maintenance.json"); }
export function retiredPath(config: Pick<ProductionConfig, "dbPath">): string { return join(dirname(config.dbPath), ".livelift-retired.json"); }
export function assertNotRetired(config: Pick<ProductionConfig, "dbPath" | "workspaceId">): void {
  const path = retiredPath(config);
  if (existsSync(path)) {
    const ids = z.array(z.string().uuid()).parse(JSON.parse(readFileSync(path, "utf8")));
    if (ids.includes(config.workspaceId)) throw new Error("Workspace has been retired");
  }
}
export function retire(config: ProductionConfig): void {
  const path = retiredPath(config);
  const ids = existsSync(path) ? z.array(z.string().uuid()).parse(JSON.parse(readFileSync(path, "utf8"))) : [];
  durableJson(path, [...new Set([...ids, config.workspaceId])]);
}
export function assertServiceReady(config: ProductionConfig): void {
  assertNotRetired(config);
  if (existsSync(markerPath(config))) throw new Error("Maintenance or interrupted operation requires administrator recovery");
}
export function beginMaintenance(config: ProductionConfig, operation: string, resume = false): void {
  const path = markerPath(config);
  if (existsSync(path)) {
    const previous = JSON.parse(readFileSync(path, "utf8"));
    if (!resume || previous.operation !== operation || previous.workspaceId !== config.workspaceId) throw new Error("Existing maintenance marker requires matching --resume operation");
  }
  durableJson(path, { operation, workspaceId: config.workspaceId, startedAtMs: Date.now() });
}
export function finishMaintenance(config: ProductionConfig): void { rmSync(markerPath(config)); syncDirectory(dirname(config.dbPath)); }

/** Linux flock is held by a child whose stdin closes if its Node parent dies, including SIGKILL. */
export async function installationLock(config: Pick<ProductionConfig, "dbPath">, shared = false, name = ".livelift.lock"): Promise<() => Promise<void>> {
  const lock = spawn("flock", ["-n", ...(shared ? ["-s"] : []), join(dirname(config.dbPath), name), "sh", "-c", "echo locked; cat >/dev/null"], { stdio: ["pipe", "pipe", "ignore"] });
  const exited = new Promise<void>((resolve) => lock.once("exit", () => resolve()));
  await new Promise<void>((resolve, reject) => {
    lock.once("error", () => reject(new Error("Linux flock is required")));
    lock.once("exit", () => reject(new Error("Installation is in use; stop the service for maintenance")));
    lock.stdout.once("data", () => resolve());
  });
  return async () => { lock.stdin.end(); await exited; };
}
export function managedDirectory(config: ProductionConfig, name: "staging" | "rollback" | "exports"): string {
  const path = join(dirname(config.dbPath), name);
  mkdirSync(path, { recursive: true, mode: 0o700 });
  return path;
}
export function removeDatabase(path: string): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(`${path}${suffix}`, { force: true });
  syncDirectory(dirname(path));
}
export function backupArtifacts(config: ProductionConfig): string[] {
  if (!existsSync(config.backupDir)) return [];
  return readdirSync(config.backupDir).filter((name) => /^backup-[\w-]+$/.test(name)).map((name) => join(config.backupDir, name));
}
export function assertManagedArtifact(config: ProductionConfig, path: string): void {
  if (dirname(resolve(path)) !== resolve(config.backupDir) || !/^backup-[\w-]+$/.test(basename(path))) throw new Error("Artifact must belong to the configured managed backup directory");
}
