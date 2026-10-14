import { randomUUID } from "node:crypto";
import type { RoomAuthority } from "./authority";
import { authenticate, AuthorityError, type Access } from "./config";
import { currentSession } from "./auth";
import { checkContext, csrf, commandLimits } from "./boundary";
import { ensureAvailable, getRuntime, type Runtime } from "./runtime";
import { log } from "./log";

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()", "Content-Security-Policy": "default-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" } });
}
export async function boundary(request: Request, operation: (requestId: string) => Response | Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  const started = performance.now();
  // Never log attacker-controlled paths, queries, errors or request headers.
  const path = new URL(request.url).pathname;
  const route = path.startsWith("/api/v3/room/commands/") ? "/api/v3/room/commands/:id" : ["/api/v3/room", "/api/v3/room/commands", "/api/v3/auth/login", "/api/v3/auth/session", "/api/v3/auth/logout", "/api/v3/workspace/export", "/api/v3/integrations/tiktok", "/api/v3/integrations/tiktok/connect", "/api/v3/integrations/tiktok/callback", "/api/v3/integrations/tiktok/refresh", "/api/v3/integrations/tiktok/disconnect", "/api/v3/integrations/tiktok/avatar", "/api/v3/ai/status", "/api/v3/ai/operate", "/api/v3/ai/review", "/api/v3/intelligence/status", "/api/v3/intelligence/evidence", "/api/v3/intelligence/refresh", "/api/healthz", "/api/readyz"].includes(path) ? path : "/api/unknown";
  let response: Response;
  try { response = await operation(requestId); }
  catch (error) {
    if (error instanceof AuthorityError) {
      const code = ["malformed_request", "malformed_envelope"].includes(error.code) ? "invalid_request" : error.code;
      response = json({ error: { code, message: error.message } }, error.status);
      if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
      if (response.status === 401) log("auth_failure", { requestId, route, status: response.status, resultCode: code }, "warn");
    } else {
      response = json({ error: { code: "storage_unavailable", message: "Storage is unavailable. Submitted command outcome may be unknown; reconcile through receipt lookup." } }, 503);
      log("storage_error", { requestId, route, resultCode: "storage_unavailable" }, "error");
    }
  }
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("Cache-Control", "no-store");
  if (request.method !== "GET" || response.status >= 400) log("http_request", { requestId, route, status: response.status, durationMs: Math.round(performance.now() - started) }, response.status >= 500 ? "error" : "info");
  return response;
}
export async function authorized(request: Request, operation: (authority: RoomAuthority, access: Access, requestId: string, currentAccess: () => Access) => Response | Promise<Response>): Promise<Response> {
  return boundary(request, async (requestId) => {
    const runtime = await getRuntime();
    ensureAvailable(runtime);
    let access: Access;
    if (runtime.production) {
      const session = currentSession(runtime.authority.db, request);
      access = session.access;
      checkContext(request, session);
      if (request.method !== "GET" && request.method !== "HEAD") {
        if (access.role !== "operator") throw new AuthorityError(403, "forbidden", "Viewer accounts cannot write.");
        csrf(request, runtime.production);
        commandLimits.check(access.actorId, 120, 60000);
      }
    } else access = authenticate(request, runtime.config);
    const currentAccess = () => {
      ensureAvailable(runtime);
      if (!runtime.production) return access;
      const session = currentSession(runtime.authority.db, request);
      checkContext(request, session);
      if (request.method !== "GET" && session.access.role !== "operator") throw new AuthorityError(403, "forbidden", "Viewer accounts cannot write.");
      return session.access;
    };
    return operation(runtime.authority, access, requestId, currentAccess);
  });
}
export async function productionRuntime(): Promise<Runtime & { production: NonNullable<Runtime["production"]> }> {
  const runtime = await getRuntime();
  if (!runtime.production) throw new AuthorityError(503, "authority_unavailable", "Production deployment configuration is required.");
  ensureAvailable(runtime);
  return runtime as Runtime & { production: NonNullable<Runtime["production"]> };
}
