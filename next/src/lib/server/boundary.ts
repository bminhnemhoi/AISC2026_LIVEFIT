import { createHash } from "node:crypto";
import type { ProductionContext } from "@/contracts/production";
import { AuthorityError, type ProductionConfig } from "./config";

export function checkContext(request: Request, context: ProductionContext): void {
  const workspace = request.headers.get("x-livelift-workspace");
  const generation = request.headers.get("x-livelift-generation");
  if (!workspace || !generation) throw new AuthorityError(400, "context_required", "Workspace and generation headers are required.");
  if (workspace !== context.workspaceId) throw new AuthorityError(404, "not_found", "Workspace not found.");
  if (generation !== context.generation) throw new AuthorityError(409, "recovery_required", "Deployment was restored. Obtain a new session context and full snapshot; quarantine old pending commands.");
}
export function csrf(request: Request, config: ProductionConfig): void {
  if (request.headers.get("origin") !== config.origin || request.headers.get("x-livelift-request") !== "1" || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) throw new AuthorityError(403, "csrf_failed", "Same-origin JSON request marker is required.");
}
export async function readJson(request: Request, limit: number): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new AuthorityError(413, "payload_too_large", "Request body exceeds the permitted size.");
  if (!request.body) throw new AuthorityError(400, "invalid_request", "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        // Cancel without awaiting a peer-controlled stream cancellation promise.
        void reader.cancel().catch(() => {});
        throw new AuthorityError(413, "payload_too_large", "Request body exceeds the permitted size.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
  } catch (error) {
    if (error instanceof AuthorityError) throw error;
    throw new AuthorityError(400, "invalid_request", "Request body must be valid JSON.");
  } finally { reader.releaseLock(); }
}

/** Fixed-window, bounded in-process limiter for the frozen single-process deployment. */
export class Limiter {
  private entries = new Map<string, { count: number; until: number }>();
  constructor(readonly maximum = 10000) {}
  private key(value: string): string { return createHash("sha256").update(value).digest("hex"); }
  private entry(value: string, windowMs: number, now: number) {
    const key = this.key(value);
    const found = this.entries.get(key);
    if (found && found.until > now) return found;
    for (const [id, item] of this.entries) if (item.until <= now) this.entries.delete(id);
    if (this.entries.size >= this.maximum) throw new AuthorityError(429, "rate_limited", "Request limit reached.", Math.max(1, Math.ceil(windowMs / 1000)));
    const item = { count: 0, until: now + windowMs };
    this.entries.set(key, item);
    return item;
  }
  check(value: string, limit: number, windowMs: number, increment = true, now = Date.now()): void {
    const item = this.entry(value, windowMs, now);
    if (item.count >= limit) throw new AuthorityError(429, "rate_limited", "Request limit reached.", Math.max(1, Math.ceil((item.until - now) / 1000)));
    if (increment) item.count++;
  }
  success(value: string): void { const item = this.entries.get(this.key(value)); if (item) item.count = Math.max(0, item.count - 1); }
  failure(value: string, windowMs: number): void { this.entry(value, windowMs, Date.now()).count++; }
}
export const loginLimits = new Limiter();
export const commandLimits = new Limiter();
export function clientIp(request: Request, config: ProductionConfig): string {
  // Caddy overwrites this header; direct app ingress MUST be blocked by the deployment.
  return config.trustProxy ? request.headers.get("x-livelift-client-ip") ?? "unattributed" : "unattributed";
}
