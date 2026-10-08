import type { AuthSession, RecoveryNotice, WorkspaceExport } from "@/contracts/production";
import {
  EXPORT_PATH,
  LOGIN_PATH,
  LOGOUT_PATH,
  SESSION_PATH,
  buildHeaders,
  classifyCode,
  readError,
  sendBounded,
  type RequestContext,
} from "./productionTransport";

/**
 * Typed client for the frozen production auth and export endpoints:
 *
 *   POST /api/v3/auth/login      { username, password }  → AuthSession, and the server sets the HttpOnly cookie
 *   GET  /api/v3/auth/session                            → AuthSession, or 401 `unauthenticated`
 *   POST /api/v3/auth/logout                             → ends the session; the server clears the cookie
 *   GET  /api/v3/workspace/export                        → WorkspaceExport (operator only)
 *
 * The cookie is the server's. This client never sees, stores or forwards a token. A password exists only in the
 * argument of `login` for the duration of the request.
 */

export type AuthFailureReason = "storage_unavailable" | "authority_unavailable" | "network" | "timeout" | "malformed" | "csrf_failed" | "unexpected";

export type SessionResult =
  | { kind: "authenticated"; session: AuthSession }
  /** 401: no session, or it expired / was revoked. The server does not say which. */
  | { kind: "signed_out" }
  | { kind: "unavailable"; reason: AuthFailureReason; message: string };

export type LoginResult =
  | { kind: "authenticated"; session: AuthSession }
  /** The same answer for an unknown user and a wrong password. */
  | { kind: "invalid_credentials" }
  | { kind: "rate_limited" }
  | { kind: "invalid_request"; message: string }
  | { kind: "unavailable"; reason: AuthFailureReason; message: string };

export type LogoutResult = { kind: "signed_out" } | { kind: "unconfirmed"; message: string };

export type ExportResult =
  | { kind: "ready"; json: string; exportedAtMs: number; filename: string }
  | { kind: "session_ended" }
  | { kind: "forbidden"; message: string }
  /** The export names a different workspace or generation than this session: it is not saved. */
  | { kind: "wrong_context"; code: string | null; message: string }
  | { kind: "rate_limited" }
  | { kind: "unavailable"; reason: AuthFailureReason; message: string };

export interface AuthClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  /** Exports are larger than a poll and get longer. */
  exportTimeoutMs?: number;
}

export interface AuthClient {
  getSession(): Promise<SessionResult>;
  login(credentials: { username: string; password: string }): Promise<LoginResult>;
  logout(): Promise<LogoutResult>;
  exportWorkspace(context: RequestContext): Promise<ExportResult>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseRecovery(v: unknown): RecoveryNotice | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isRecord(v) || !isNumber(v.restoredAtMs) || !isNumber(v.backupTakenAtMs) || !isNumber(v.backupRevision)) return undefined;
  return { restoredAtMs: v.restoredAtMs, backupTakenAtMs: v.backupTakenAtMs, backupRevision: v.backupRevision };
}

/** Accepts only what the frozen `AuthSession` type describes; anything else is "could not trust". */
export function parseAuthSession(body: unknown): AuthSession | null {
  if (!isRecord(body)) return null;
  const access = body.access;
  if (
    typeof body.workspaceId !== "string" ||
    body.workspaceId === "" ||
    typeof body.roomId !== "string" ||
    typeof body.generation !== "string" ||
    body.generation === "" ||
    !isNumber(body.expiresAtMs) ||
    !isRecord(access) ||
    typeof access.actorId !== "string" ||
    access.actorId === "" ||
    typeof access.name !== "string" ||
    (access.role !== "operator" && access.role !== "viewer")
  ) {
    return null;
  }
  const recoveryNotice = parseRecovery(body.recoveryNotice);
  if (recoveryNotice === undefined) return null;
  return {
    workspaceId: body.workspaceId,
    roomId: body.roomId,
    generation: body.generation,
    expiresAtMs: body.expiresAtMs,
    recoveryNotice,
    access: { actorId: access.actorId, name: access.name, role: access.role },
  };
}

function reasonFor(status: number, code: string | null): { reason: AuthFailureReason; message: string } {
  if (code === "storage_unavailable") return { reason: "storage_unavailable", message: "The server's storage is not available right now." };
  if (code === "authority_unavailable" || status >= 500) return { reason: "authority_unavailable", message: "The server is not available right now." };
  if (code === "csrf_failed") return { reason: "csrf_failed", message: "The server refused this browser request. Reload the page and try again." };
  return { reason: "unexpected", message: `The server answered ${status}.` };
}

export function createAuthClient(options: AuthClientOptions = {}): AuthClient {
  const base = options.baseUrl ?? "";
  const timeoutMs = options.timeoutMs ?? 8000;
  const exportTimeoutMs = options.exportTimeoutMs ?? 60_000;

  async function getSession(): Promise<SessionResult> {
    const res = await sendBounded(options.fetchImpl, `${base}${SESSION_PATH}`, { method: "GET", headers: buildHeaders({ unsafe: false }) }, timeoutMs);
    if (!res.ok) return { kind: "unavailable", reason: res.kind, message: res.message };
    if (res.status === 401) return { kind: "signed_out" };
    if (res.status >= 200 && res.status < 300) {
      const session = parseAuthSession(res.body);
      return session
        ? { kind: "authenticated", session }
        : { kind: "unavailable", reason: "malformed", message: "The server sent a session LiveLift could not trust." };
    }
    return { kind: "unavailable", ...reasonFor(res.status, classifyCode(res.status, res.body)) };
  }

  return {
    getSession,

    async login(credentials) {
      const res = await sendBounded(
        options.fetchImpl,
        `${base}${LOGIN_PATH}`,
        { method: "POST", headers: buildHeaders({ unsafe: true }), body: JSON.stringify({ username: credentials.username, password: credentials.password }) },
        timeoutMs
      );
      if (!res.ok) return { kind: "unavailable", reason: res.kind, message: res.message };
      const code = classifyCode(res.status, res.body);
      if (res.status >= 200 && res.status < 300) {
        const session = parseAuthSession(res.body);
        if (session) return { kind: "authenticated", session };
        // The cookie was set but the body is not a session: ask for it rather than guess.
        const again = await getSession();
        if (again.kind === "authenticated") return again;
        return { kind: "unavailable", reason: "malformed", message: "Signed in, but the server did not describe the session LiveLift could trust." };
      }
      if (res.status === 401 || code === "invalid_credentials") return { kind: "invalid_credentials" };
      if (res.status === 429 || code === "rate_limited") return { kind: "rate_limited" };
      if (res.status === 400 || res.status === 413 || code === "invalid_request" || code === "payload_too_large") {
        return { kind: "invalid_request", message: readError(res.body).message ?? "The sign-in details were not accepted." };
      }
      return { kind: "unavailable", ...reasonFor(res.status, code) };
    },

    async logout() {
      const res = await sendBounded(options.fetchImpl, `${base}${LOGOUT_PATH}`, { method: "POST", headers: buildHeaders({ unsafe: true }), body: "{}" }, timeoutMs);
      if (!res.ok) return { kind: "unconfirmed", message: res.message };
      // 401 means there was no session left to end, which is the state we wanted.
      if ((res.status >= 200 && res.status < 300) || res.status === 401) return { kind: "signed_out" };
      return { kind: "unconfirmed", message: reasonFor(res.status, classifyCode(res.status, res.body)).message };
    },

    async exportWorkspace(context) {
      const res = await sendBounded(options.fetchImpl, `${base}${EXPORT_PATH}`, { method: "GET", headers: buildHeaders({ unsafe: false, context }) }, exportTimeoutMs);
      if (!res.ok) return { kind: "unavailable", reason: res.kind, message: res.message };
      const code = classifyCode(res.status, res.body);
      if (res.status >= 200 && res.status < 300) {
        const body = res.body;
        if (!isRecord(body) || body.formatVersion !== 1 || typeof body.workspaceId !== "string" || typeof body.generation !== "string" || !isNumber(body.exportedAtMs)) {
          return { kind: "unavailable", reason: "malformed", message: "The server sent an export LiveLift could not trust, so nothing was saved." };
        }
        const exported = body as unknown as WorkspaceExport;
        if (exported.workspaceId !== context.workspaceId || exported.generation !== context.generation) {
          return { kind: "wrong_context", code: null, message: "The export is for a different workspace or restore generation than this session, so it was not saved." };
        }
        return {
          kind: "ready",
          json: res.text,
          exportedAtMs: exported.exportedAtMs,
          filename: `livelift-workspace-${exported.workspaceId}-${new Date(exported.exportedAtMs).toISOString().replace(/[:.]/g, "-")}.json`.replace(/[^A-Za-z0-9._-]/g, "_"),
        };
      }
      if (res.status === 401) return { kind: "session_ended" };
      if (res.status === 403 && code !== "csrf_failed") return { kind: "forbidden", message: "Only operators can export the workspace." };
      if (res.status === 429) return { kind: "rate_limited" };
      if (code === "context_required" || code === "recovery_required" || code === "not_found") {
        return { kind: "wrong_context", code, message: readError(res.body).message ?? "The server does not recognise this session's workspace context." };
      }
      return { kind: "unavailable", ...reasonFor(res.status, code) };
    },
  };
}
