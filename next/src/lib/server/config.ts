import { createHash, timingSafeEqual } from "node:crypto";
import { isAbsolute } from "node:path";
import { z } from "zod";
import type { RoomRead } from "@/contracts/authority";
import { idSchema } from "./validation";

export class AuthorityError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) { super(message); }
}
const capabilitySchema = z.object({
  token: z.string().min(1).regex(/^\S+$/), roomId: idSchema, actorId: idSchema,
  name: z.string().refine((name) => name.trim() !== ""), role: z.enum(["operator", "viewer"]),
}).strict();
export type Access = RoomRead["access"];
export type AuthorityConfig = { roomId: string; dbPath: string; capabilities: z.infer<typeof capabilitySchema>[] };
export type ProductionConfig = AuthorityConfig & { workspaceId: string; origin: string; backupDir: string; trustProxy: boolean };

export function loadProductionConfig(): ProductionConfig {
  try {
    const roomId = idSchema.refine((s) => s.length <= 128).parse(process.env.LIVELIFT_ROOM_ID);
    const workspaceId = z.string().uuid().parse(process.env.LIVELIFT_WORKSPACE_ID);
    const dbPath = z.string().min(1).parse(process.env.LIVELIFT_DB_PATH);
    const origin = z.string().url().parse(process.env.LIVELIFT_APP_ORIGIN);
    if (!isAbsolute(dbPath) || new URL(origin).origin !== origin || !origin.startsWith("https://")) throw new Error("Invalid deployment configuration");
    const backupDir = process.env.LIVELIFT_BACKUP_DIR ?? "/var/backups/livelift";
    if (!isAbsolute(backupDir)) throw new Error("Invalid backup directory");
    return { roomId, workspaceId, dbPath, origin, backupDir, trustProxy: process.env.LIVELIFT_TRUST_PROXY === "caddy", capabilities: [] };
  } catch { throw new AuthorityError(503, "authority_unavailable", "Deployment configuration is unavailable."); }
}
export function loadConfig(): AuthorityConfig | ProductionConfig {
  if (process.env.NODE_ENV === "production" || process.env.LIVELIFT_WORKSPACE_ID) return loadProductionConfig();
  try {
    const roomId = idSchema.parse(process.env.LIVELIFT_ROOM_ID);
    const dbPath = z.string().min(1).parse(process.env.LIVELIFT_DB_PATH);
    if (!isAbsolute(dbPath)) throw new Error("Absolute path required");
    const capabilities = z.array(capabilitySchema).min(1).parse(JSON.parse(process.env.LIVELIFT_CAPABILITIES ?? ""));
    if (capabilities.some((c) => c.roomId !== roomId) || new Set(capabilities.map((c) => c.token)).size !== capabilities.length) throw new Error("Invalid capabilities");
    return { roomId, dbPath, capabilities };
  } catch { throw new AuthorityError(503, "authority_unavailable", "Room authority configuration is unavailable."); }
}

/** Phase 2 harness only; production never falls back to bearer credentials. */
export function authenticate(request: Request, config: AuthorityConfig): Access {
  if (process.env.NODE_ENV === "production" || "workspaceId" in config) throw new AuthorityError(401, "unauthenticated", "A current login session is required.");
  const bearer = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (bearer) {
    const hash = (token: string) => createHash("sha256").update(token).digest();
    const capability = config.capabilities.find((c) => timingSafeEqual(hash(bearer[1]), hash(c.token)));
    if (capability) { const { actorId, name, role } = capability; return { actorId, name, role }; }
  }
  throw new AuthorityError(401, "unauthorized", "A valid room capability is required.");
}
