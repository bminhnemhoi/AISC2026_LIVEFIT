import { SessionSchema, type Session } from "@/contracts";
import type { AuthorityReceipt, CommandEnvelope, CommandResponse, RoomRead } from "@/contracts/authority";
import { authStore } from "./authStore";
import { buildHeaders, classifyCode, readError, sendBounded, type RequestContext } from "./productionTransport";

/**
 * Typed HTTP client for the frozen Phase 2 authority endpoints (docs/phase2/contract.md):
 *
 *   GET  /api/v3/room[?afterRevision=N]
 *   POST /api/v3/room/commands
 *   GET  /api/v3/room/commands/{commandId}
 *
 * Wire types come from `@/contracts/authority`; nothing is redefined here. The client never decides what
 * a failure MEANS for a command: it only reports what it saw. In particular a timeout, a dropped connection or
 * a 5xx during a POST is `unknown` — the server may or may not have committed — and is never reported as rejected.
 *
 * Phase 3: authentication is the server-managed HttpOnly session cookie, which the browser attaches to these
 * same-origin requests itself. Every request carries `X-LiveLift-Request: 1`, POSTs carry
 * `Content-Type: application/json`, and every request carries `X-LiveLift-Workspace` / `X-LiveLift-Generation` taken
 * from the CURRENT authenticated session (`getContext`), never from anything the user typed. With no authenticated
 * session nothing is sent: that is the `unauthenticated` state, reported as such rather than as a network failure.
 *
 * A 401, a timeout or a 503 after a command was submitted does NOT prove it failed (the session may have ended, or
 * the server may have committed before the answer was lost), so those are `unknown`.
 */

export const ROOM_PATH = "/api/v3/room";
export const COMMANDS_PATH = "/api/v3/room/commands";

export type TransportKind = "network" | "timeout" | "http" | "malformed" | "unauthenticated";

export interface TransportFailure {
  ok: false;
  kind: TransportKind;
  /** HTTP status when a response arrived. */
  status: number | null;
  /** The production error code the server named (`context_required`, `recovery_required`, `storage_unavailable`…), when it named one. */
  code: string | null;
  message: string;
}

export type ReadResult = { ok: true; read: RoomRead } | TransportFailure;

export type PostResult =
  /** The server answered with a receipt (committed, rejected or a duplicate of an earlier command). */
  | { kind: "response"; response: CommandResponse; status: number }
  /** The server (or this client) refused the request before executing anything (HTTP 4xx without a receipt, or no session to send under). */
  | { kind: "refused"; status: number; code: string | null; message: string }
  /** The request may or may not have been executed. The outcome is UNKNOWN, not failed. */
  | { kind: "unknown"; reason: TransportKind; status: number | null; message: string };

export type ReceiptResult =
  | { kind: "found"; receipt: AuthorityReceipt }
  /** No receipt on record. This is NOT evidence that the command failed. */
  | { kind: "absent" }
  | { kind: "failed"; reason: TransportKind; status: number | null; code: string | null; message: string };

export interface AuthorityClientOptions {
  fetchImpl?: typeof fetch;
  /** Abort a request after this long. Must be shorter than the 3 s staleness window to keep polling honest. */
  timeoutMs?: number;
  baseUrl?: string;
  /** The deployment context of the current authenticated session, or null when there is none. Defaults to the auth store. */
  getContext?: () => RequestContext | null;
}

export interface AuthorityClient {
  getRoom(opts?: { afterRevision?: number | null }): Promise<ReadResult>;
  postCommand(envelope: CommandEnvelope): Promise<PostResult>;
  getReceipt(commandId: string): Promise<ReceiptResult>;
}

const DEFAULT_TIMEOUT_MS = 2500;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function isReceipt(v: unknown): v is AuthorityReceipt {
  return (
    isRecord(v) &&
    typeof v.commandId === "string" &&
    typeof v.type === "string" &&
    (v.outcome === "committed" || v.outcome === "rejected") &&
    typeof v.roomRevisionAfter === "number" &&
    Array.isArray(v.eventIds)
  );
}

function parseRoomRead(body: unknown): RoomRead | null {
  if (!isRecord(body)) return null;
  const access = body.access;
  if (
    typeof body.roomId !== "string" ||
    typeof body.revision !== "number" ||
    typeof body.serverNowMs !== "number" ||
    typeof body.clockBehindByMs !== "number" ||
    typeof body.changed !== "boolean" ||
    !isRecord(access) ||
    typeof access.actorId !== "string" ||
    typeof access.name !== "string" ||
    (access.role !== "operator" && access.role !== "viewer")
  ) {
    return null;
  }
  const common = {
    roomId: body.roomId,
    revision: body.revision,
    serverNowMs: body.serverNowMs,
    clockBehindByMs: Math.max(0, body.clockBehindByMs),
    access: { actorId: access.actorId, name: access.name, role: access.role === "viewer" ? ("viewer" as const) : ("operator" as const) },
  };
  if (!body.changed) return { ...common, changed: false };
  const parsed = SessionSchema.array().safeParse(body.sessions);
  if (!parsed.success) return null;
  const sessions: Session[] = parsed.data;
  return { ...common, changed: true, sessions };
}

const messageOf = (body: unknown, fallback: string): string => readError(body).message ?? fallback;

export function createAuthorityClient(options: AuthorityClientOptions = {}): AuthorityClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = options.baseUrl ?? "";

  /** One bounded request under the current session context. Never throws: transport trouble is a value. */
  async function send(path: string, init: RequestInit & { unsafe: boolean }): Promise<{ ok: true; status: number; body: unknown } | TransportFailure> {
    const context = (options.getContext ?? authStore.getContext)();
    if (!context) {
      return { ok: false, kind: "unauthenticated", status: null, code: null, message: "There is no signed-in session, so nothing was sent." };
    }
    const { unsafe, ...rest } = init;
    const res = await sendBounded(options.fetchImpl, `${base}${path}`, { ...rest, headers: buildHeaders({ unsafe, context }) }, timeoutMs);
    if (!res.ok) return { ok: false, kind: res.kind, status: null, code: null, message: res.kind === "timeout" ? "The room server did not answer in time." : "The room server could not be reached." };
    return { ok: true, status: res.status, body: res.body };
  }

  return {
    async getRoom(opts = {}) {
      const after = opts.afterRevision;
      const query = after === null || after === undefined ? "" : `?afterRevision=${encodeURIComponent(String(after))}`;
      const res = await send(`${ROOM_PATH}${query}`, { method: "GET", unsafe: false });
      if (!res.ok) return res;
      if (res.status < 200 || res.status >= 300) {
        return { ok: false, kind: "http", status: res.status, code: classifyCode(res.status, res.body), message: messageOf(res.body, `The room server answered ${res.status}.`) };
      }
      const read = parseRoomRead(res.body);
      if (!read) return { ok: false, kind: "malformed", status: res.status, code: null, message: "The room server sent a response LiveLift could not trust." };
      return { ok: true, read };
    },

    async postCommand(envelope) {
      const res = await send(COMMANDS_PATH, { method: "POST", unsafe: true, body: JSON.stringify(envelope) });
      // Never transmitted without a session: a definite "not sent", not an unknown outcome.
      if (!res.ok && res.kind === "unauthenticated") return { kind: "refused", status: 401, code: "unauthenticated", message: res.message };
      if (!res.ok) return { kind: "unknown", reason: res.kind, status: res.status, message: res.message };
      const body = res.body;
      if (isRecord(body) && isReceipt(body.receipt)) {
        return { kind: "response", status: res.status, response: { receipt: body.receipt, duplicate: body.duplicate === true } };
      }
      // 401 is NOT a refusal here: the session may have ended while the command was already on its way, and a server
      // that committed it cannot tell this browser so. 408 and 5xx (503 storage/authority unavailable) are the same.
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 401) {
        return { kind: "refused", status: res.status, code: classifyCode(res.status, body), message: messageOf(body, `The room server refused the request (${res.status}).`) };
      }
      // 2xx without a receipt, 401, 5xx, 408 or an unreadable body: the server may have committed. UNKNOWN.
      const ok2xx = res.status >= 200 && res.status < 300;
      return {
        kind: "unknown",
        reason: ok2xx ? "malformed" : "http",
        status: res.status,
        message: ok2xx
          ? "The room server answered without a receipt."
          : res.status === 401
            ? "Your session ended before the room confirmed the command."
            : messageOf(body, `The room server answered ${res.status} before confirming the command.`),
      };
    },

    async getReceipt(commandId) {
      const res = await send(`${COMMANDS_PATH}/${encodeURIComponent(commandId)}`, { method: "GET", unsafe: false });
      if (!res.ok) return { kind: "failed", reason: res.kind, status: res.status, code: res.code, message: res.message };
      if (res.status === 404) return { kind: "absent" };
      if (res.status >= 200 && res.status < 300) {
        const body = res.body;
        const receipt = isRecord(body) && isReceipt(body.receipt) ? body.receipt : isReceipt(body) ? body : null;
        if (receipt) return { kind: "found", receipt };
        return { kind: "failed", reason: "malformed", status: res.status, code: null, message: "The receipt lookup answered with something LiveLift could not trust." };
      }
      return { kind: "failed", reason: "http", status: res.status, code: classifyCode(res.status, res.body), message: messageOf(res.body, `The receipt lookup answered ${res.status}.`) };
    },
  };
}
