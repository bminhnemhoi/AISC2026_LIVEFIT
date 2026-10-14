import { existsSync, statSync } from "node:fs";
import { RoomAuthority } from "./authority";
import { AuthorityError, loadConfig, type AuthorityConfig, type ProductionConfig } from "./config";
import { deployment, schemaVersion, writableProbe } from "./database";
import { assertServiceReady, installationLock } from "./lifecycle";
import { log } from "./log";

export type Runtime = { authority: RoomAuthority; config: AuthorityConfig; production?: ProductionConfig; release?: () => Promise<void>; inode: number; device: number; probeAt: number; probeOk: boolean };
const state = globalThis as typeof globalThis & { liveLiftRuntime?: Promise<Runtime> };
export async function getRuntime(): Promise<Runtime> {
  if (!state.liveLiftRuntime) {
    const pending = (async () => {
      const config = loadConfig();
      const production = "workspaceId" in config ? config as ProductionConfig : undefined;
      let release: (() => Promise<void>) | undefined;
      if (production) {
        assertServiceReady(production);
        const serverRelease = await installationLock(production);
        try {
          const maintenanceRelease = await installationLock(production, true, ".livelift-maintenance.lock");
          release = async () => { await maintenanceRelease(); await serverRelease(); };
        } catch (error) { await serverRelease(); throw error; }
      }
      let authority: RoomAuthority | undefined;
      try {
        if (production) assertServiceReady(production);
        authority = new RoomAuthority(config.roomId, config.dbPath, production);
        const file = statSync(config.dbPath);
        const runtime: Runtime = { authority, config, production, release, inode: file.ino, device: file.dev, probeAt: 0, probeOk: false };
        if (production) { ensureAvailable(runtime); writableProbe(authority.db); }
        log("startup", { roomId: config.roomId, workspaceId: production?.workspaceId });
        return runtime;
      } catch (error) { try { authority?.close(); } finally { await release?.(); } throw error; }
    })();
    state.liveLiftRuntime = pending.catch((error) => { if (error instanceof AuthorityError) throw error; throw new AuthorityError(503, "storage_unavailable", "Managed storage or deployment is unavailable."); });
    const guarded = state.liveLiftRuntime;
    guarded.catch(() => { if (state.liveLiftRuntime === guarded) state.liveLiftRuntime = undefined; log("startup_failed", { resultCode: "storage_unavailable" }, "error"); });
  }
  return state.liveLiftRuntime;
}
export function ensureAvailable(runtime: Runtime): void {
  if (!runtime.production) return;
  assertServiceReady(runtime.production);
  if (!existsSync(runtime.config.dbPath)) throw new Error("Managed database missing");
  const file = statSync(runtime.config.dbPath);
  if (file.ino !== runtime.inode || file.dev !== runtime.device) throw new Error("Managed database replaced");
  if (schemaVersion(runtime.authority.db) !== 2) throw new Error("Unsupported schema version");
  const context = deployment(runtime.authority.db);
  if (context.workspaceId !== runtime.production.workspaceId || context.roomId !== runtime.production.roomId) throw new Error("Deployment identity mismatch");
}
export function ready(runtime: Runtime): boolean {
  try {
    ensureAvailable(runtime);
    if (Date.now() - runtime.probeAt > 5000) {
      runtime.probeAt = Date.now();
      runtime.probeOk = false;
      writableProbe(runtime.authority.db);
      runtime.probeOk = true;
    }
    return runtime.probeOk;
  } catch { runtime.probeOk = false; return false; }
}
export async function closeRuntime(): Promise<void> {
  const pending = state.liveLiftRuntime;
  state.liveLiftRuntime = undefined;
  if (pending) {
    const runtime = await pending.catch(() => undefined);
    if (runtime) { try { runtime.authority.close(); } finally { await runtime.release?.(); } log("shutdown", { workspaceId: runtime.production?.workspaceId, roomId: runtime.config.roomId }); }
  }
}
