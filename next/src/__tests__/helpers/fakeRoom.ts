import type { Session } from "@/contracts";
import type { AuthorityReceipt, CommandEnvelope, RoomRead } from "@/contracts/authority";
import type { AuthSession, RecoveryNotice } from "@/contracts/production";
import { applyCommand, createNextSession, createSession, type CommandBody } from "@/lib/domain";

/**
 * A TEST-ONLY stand-in for the production server, speaking exactly the frozen wire contracts
 * (docs/phase2/contract.md and docs/phase3/contract.md) with the shared types and the Phase 1 engine. It exists so
 * client behaviour can be exercised end to end; it is not the backend and defines nothing the contract does not.
 *
 * Authentication is a cookie the SERVER owns: `signedIn` is "the browser holds a valid session cookie". A request is
 * accepted only with the CSRF marker, a JSON content type on POST and the session's workspace/generation context,
 * and any `Authorization` header is ignored (there is no bearer fallback).
 *
 * Fault injection: `offline` (nothing is reachable), `storageDown` / `backendDown` (503 `storage_unavailable` /
 * `authority_unavailable`), `loseNextResponses` (the command is COMMITTED but the response never arrives — the case
 * the client must treat as UNKNOWN), `dropNextPosts` (the request never reaches the room, so nothing is committed and
 * no receipt exists), `onPost` (observe the world at the moment a command arrives), `restore()` (a database restore:
 * new generation, every login session cleared) and `revokeSession()` (the cookie stops working).
 */

export interface FakeRoomOptions {
  roomId?: string;
  workspaceId?: string;
  generation?: string;
  role?: "operator" | "viewer";
  actor?: { id: string; name: string };
  nowMs?: number;
  /** The browser starts with a valid session cookie (default true). Pass false for the signed-out state. */
  signedIn?: boolean;
}

export interface FakeAccount {
  password: string;
  actor: { id: string; name: string };
  role: "operator" | "viewer";
}

export type FakeRequest = { method: string; path: string; body: unknown; headers: Record<string, string> };

type Logged = { fingerprint: string; receipt: AuthorityReceipt };

const fingerprint = (e: CommandEnvelope): string =>
  JSON.stringify([e.roomId, e.sessionId, e.expectedRevision, e.type, sortKeys(e.payload)]);

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, sortKeys(val)])
    );
  }
  return v;
}

export class FakeRoom {
  roomId: string;
  workspaceId: string;
  generation: string;
  /** The browser holds a valid session cookie. */
  signedIn: boolean;
  recoveryNotice: RecoveryNotice | null = null;
  accounts: Record<string, FakeAccount> = {
    mai: { password: "correct horse battery staple", actor: { id: "actor-1", name: "Mai" }, role: "operator" },
    linh: { password: "another long passphrase here", actor: { id: "actor-2", name: "Linh" }, role: "viewer" },
  };
  /** Login answers 429 while set. */
  loginThrottled = false;
  /** Login answers 503 `storage_unavailable` while set. */
  loginStorageDown = false;
  /** Milliseconds the session claims to last (any value; the client never computes with it). */
  sessionExpiresAtMs: number;
  storageDown = false;
  backendDown = false;
  /** Make the session endpoint describe a different context than the room enforces (a deployment mismatch). */
  sessionContext: { workspaceId?: string; generation?: string } | null = null;
  /** Answer every authenticated room read with this production error (e.g. 400 `context_required`). */
  failRoomWith: { status: number; code: string } | null = null;
  role: "operator" | "viewer";
  actor: { id: string; name: string };
  revision = 0;
  sessions: Session[] = [];
  nowMs: number;
  clockBehindByMs = 0;
  offline = false;
  loseNextResponses = 0;
  dropNextPosts = 0;
  onPost: ((envelope: CommandEnvelope) => void) | null = null;
  /** Every room / receipt / export request seen, in order, for assertions. Header names are lower-cased. */
  requests: FakeRequest[] = [];
  /** Every `/api/v3/auth/*` request seen, kept apart so room-traffic assertions stay about the room. */
  authRequests: FakeRequest[] = [];
  private log = new Map<string, Logged>();

  /** The room assigns session ids; never one that is already in use. */
  private nextSessionId(): string {
    const used = this.sessions.map((s) => Number(/^real-(\d+)$/.exec(s.id)?.[1] ?? 0));
    return `real-${Math.max(0, ...used) + 1}`;
  }

  constructor(opts: FakeRoomOptions = {}) {
    this.roomId = opts.roomId ?? "room-1";
    this.workspaceId = opts.workspaceId ?? "ws-1";
    this.generation = opts.generation ?? "gen-1";
    this.signedIn = opts.signedIn ?? true;
    this.role = opts.role ?? "operator";
    this.actor = opts.actor ?? { id: "actor-1", name: "Mai" };
    this.nowMs = opts.nowMs ?? Date.UTC(2026, 9, 6, 13, 0, 0);
    this.sessionExpiresAtMs = this.nowMs + 12 * 3_600_000;
  }

  /** What the server tells a signed-in browser about its session. */
  session(): AuthSession {
    return {
      workspaceId: this.sessionContext?.workspaceId ?? this.workspaceId,
      roomId: this.roomId,
      generation: this.sessionContext?.generation ?? this.generation,
      access: { actorId: this.actor.id, name: this.actor.name, role: this.role },
      expiresAtMs: this.sessionExpiresAtMs,
      recoveryNotice: this.recoveryNotice,
    };
  }

  /** The session ends server-side (expiry, revocation, a role change, a disabled account). */
  revokeSession(): void {
    this.signedIn = false;
  }

  /** A database restore: a NEW generation, every login session cleared, and a notice for whoever signs in next. */
  restore(opts: { generation: string; notice?: RecoveryNotice | null; keepReceipts?: boolean }): void {
    this.generation = opts.generation;
    this.recoveryNotice = opts.notice ?? null;
    this.signedIn = false;
    if (!opts.keepReceipts) this.log.clear();
  }

  posts(): CommandEnvelope[] {
    return this.requests.filter((r) => r.method === "POST").map((r) => r.body as CommandEnvelope);
  }

  /** Install this room as the global fetch for the duration of a test. Returns a restore function. */
  install(): () => void {
    // A fresh callable lets tests independently spy on pending requests (Vitest 4 reuses existing spies).
    const previous = globalThis.fetch;
    globalThis.fetch = async (input, init) => this.handle(String(input), init);
    return () => { globalThis.fetch = previous; };
  }

  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }

  private err(status: number, code: string, message: string): Response {
    return this.json({ error: { code, message } }, status);
  }

  private async handle(url: string, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    const parsed = new URL(url, "http://room.test");
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : null;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    (parsed.pathname.startsWith("/api/v3/auth/") ? this.authRequests : this.requests).push({ method, path: parsed.pathname + parsed.search, body, headers });
    if (this.offline) throw new TypeError("Failed to fetch");
    const unsafe = method !== "GET" && method !== "HEAD";

    // Unsafe browser requests need the marker and JSON; same-origin credentials are what carries the cookie.
    if (unsafe && (headers["x-livelift-request"] !== "1" || !(headers["content-type"] ?? "").includes("application/json"))) {
      return this.err(403, "csrf_failed", "Unsafe request without the required marker.");
    }

    if (method === "POST" && parsed.pathname === "/api/v3/auth/login") {
      if (this.loginStorageDown) return this.err(503, "storage_unavailable", "Storage is unavailable.");
      if (this.loginThrottled) return this.err(429, "rate_limited", "Too many attempts.");
      const creds = body as { username?: string; password?: string } | null;
      const account = creds?.username ? this.accounts[creds.username] : undefined;
      if (!account || account.password !== creds?.password) return this.err(401, "invalid_credentials", "Invalid credentials.");
      this.actor = account.actor;
      this.role = account.role;
      this.signedIn = true;
      return this.json(this.session());
    }
    if (method === "POST" && parsed.pathname === "/api/v3/auth/logout") {
      this.signedIn = false;
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && parsed.pathname === "/api/v3/auth/session") {
      if (this.storageDown) return this.err(503, "storage_unavailable", "Storage is unavailable.");
      if (this.backendDown) return this.err(503, "authority_unavailable", "Authority is unavailable.");
      return this.signedIn ? this.json(this.session()) : this.err(401, "unauthenticated", "No valid session.");
    }

    // Everything below is authenticated and carries the deployment context.
    if (!this.signedIn) return this.err(401, "unauthenticated", "No valid session.");
    if (!headers["x-livelift-workspace"] || !headers["x-livelift-generation"]) return this.err(400, "context_required", "Workspace and generation are required.");
    if (headers["x-livelift-workspace"] !== this.workspaceId) return this.err(404, "not_found", "No such workspace.");
    if (headers["x-livelift-generation"] !== this.generation) return this.err(409, "recovery_required", "The room was restored; reload the session.");
    if (this.storageDown) return this.err(503, "storage_unavailable", "Storage is unavailable.");
    if (this.backendDown) return this.err(503, "authority_unavailable", "Authority is unavailable.");

    if (method === "GET" && parsed.pathname === "/api/v3/workspace/export") {
      if (this.role !== "operator") return this.err(403, "forbidden", "Operators only.");
      return this.json({
        workspaceId: this.workspaceId,
        roomId: this.roomId,
        generation: this.generation,
        formatVersion: 1,
        exportedAtMs: this.nowMs,
        snapshot: { roomId: this.roomId, revision: this.revision, sessions: this.sessions },
        receipts: [...this.log.values()].map((l) => ({ actorId: this.actor.id, recordedAtMs: this.nowMs, receipt: l.receipt })),
      });
    }

    if (method === "GET" && parsed.pathname === "/api/v3/room") {
      if (this.failRoomWith) return this.err(this.failRoomWith.status, this.failRoomWith.code, "Injected failure.");
      const after = parsed.searchParams.get("afterRevision");
      const common = {
        roomId: this.roomId,
        revision: this.revision,
        serverNowMs: this.nowMs,
        clockBehindByMs: this.clockBehindByMs,
        access: { actorId: this.actor.id, name: this.actor.name, role: this.role },
      };
      const read: RoomRead = after !== null && Number(after) === this.revision ? { ...common, changed: false } : { ...common, changed: true, sessions: this.sessions };
      return this.json(read);
    }

    const receiptMatch = /^\/api\/v3\/room\/commands\/(.+)$/.exec(parsed.pathname);
    if (method === "GET" && receiptMatch) {
      const found = this.log.get(decodeURIComponent(receiptMatch[1]));
      return found ? this.json({ receipt: found.receipt }) : this.json({ error: { code: "not_found", message: "No such command." } }, 404);
    }

    if (method === "POST" && parsed.pathname === "/api/v3/room/commands") {
      if (this.role !== "operator") return this.json({ error: { code: "forbidden", message: "Viewers cannot record commands." } }, 403);
      const envelope = body as CommandEnvelope;
      this.onPost?.(envelope);
      if (this.dropNextPosts > 0) {
        this.dropNextPosts -= 1;
        throw new TypeError("Failed to fetch"); // never arrived: nothing committed, no receipt
      }
      const res = this.execute(envelope);
      if (this.loseNextResponses > 0) {
        this.loseNextResponses -= 1;
        throw new TypeError("Failed to fetch"); // committed, but the answer never arrived
      }
      return this.json(res);
    }
    return this.json({ error: { message: "not found" } }, 404);
  }

  private reject(e: CommandEnvelope, code: string, message: string): AuthorityReceipt {
    return {
      commandId: e.commandId,
      type: e.type,
      outcome: "rejected",
      code,
      message,
      roomRevisionAfter: this.revision,
      sessionId: e.sessionId,
      sessionRevisionAfter: null,
      eventIds: [],
    };
  }

  /** One command transaction: duplicate check, revision check, domain transition, receipt. */
  private execute(e: CommandEnvelope): { receipt: AuthorityReceipt; duplicate: boolean } {
    const fp = fingerprint(e);
    const prior = this.log.get(e.commandId);
    if (prior) {
      return prior.fingerprint === fp
        ? { receipt: prior.receipt, duplicate: true }
        : { receipt: this.reject(e, "idempotency_conflict", "That command id was used for a different request."), duplicate: false };
    }
    const remember = (receipt: AuthorityReceipt): { receipt: AuthorityReceipt; duplicate: boolean } => {
      this.log.set(e.commandId, { fingerprint: fp, receipt });
      return { receipt, duplicate: false };
    };
    if (e.expectedRevision !== this.revision) return remember(this.reject(e, "stale_revision", "The room moved on since this was prepared."));

    const operator = { id: this.actor.id, name: this.actor.name, role: "lead" as const, isLead: true };
    const payload = e.payload as Record<string, unknown>;
    const commit = (session: Session, eventIds: string[] = []): { receipt: AuthorityReceipt; duplicate: boolean } => {
      this.revision += 1;
      this.sessions = this.sessions.some((s) => s.id === session.id) ? this.sessions.map((s) => (s.id === session.id ? session : s)) : [...this.sessions, session];
      return remember({
        commandId: e.commandId,
        type: e.type,
        outcome: "committed",
        code: null,
        message: null,
        roomRevisionAfter: this.revision,
        sessionId: session.id,
        sessionRevisionAfter: session.revision,
        eventIds,
      });
    };

    if (e.type === "create_session") {
      const p = payload as { title: string; timezone: string; plannedStartMs: number; objective?: string | null; accountLabel?: string | null; products?: Session["products"]; segments?: Session["plans"][0]["segments"]; cues?: Session["plans"][0]["cues"] };
      return commit(createSession({ id: this.nextSessionId(), environment: "REAL", operator, nowMs: this.nowMs, ...p }));
    }
    if (e.type === "create_next") {
      const source = this.sessions.find((s) => s.id === e.sessionId);
      if (!source) return remember(this.reject(e, "not_found", "No such show."));
      const p = payload as { title: string; plannedStartMs: number; changeIds: string[]; note: string };
      const made = createNextSession(source, { id: this.nextSessionId(), nowMs: this.nowMs, ...p });
      return made.ok ? commit({ ...made.session, operator }) : remember(this.reject(e, "invalid_state", made.reason));
    }

    const target = this.sessions.find((s) => s.id === e.sessionId);
    if (!target) return remember(this.reject(e, "not_found", "No such show."));
    if (e.type === "save_prepare") {
      if (target.lifecycle !== "planned" || target.baselineLocked) return remember(this.reject(e, "invalid_state", "The baseline is locked."));
      const p = payload as { title: string; timezone: string; objective: string | null; accountLabel: string | null; products: Session["products"]; plannedStartMs: number; segments: Session["plans"][0]["segments"]; cues: Session["plans"][0]["cues"] };
      const next: Session = {
        ...target,
        title: p.title,
        timezone: p.timezone,
        objective: p.objective,
        accountLabel: p.accountLabel,
        products: p.products,
        plans: [{ ...target.plans[0], plannedStartMs: p.plannedStartMs, segments: p.segments, cues: p.cues }, ...target.plans.slice(1)],
        revision: target.revision + 1,
        updatedAtMs: this.nowMs,
      };
      return commit(next);
    }
    if (e.type === "start_live" && this.sessions.some((s) => s.id !== target.id && s.lifecycle === "active")) {
      return remember(this.reject(e, "another_show_active", "Another REAL show is already running in this room."));
    }
    const result = applyCommand(target, { ...(payload as object), type: e.type, key: e.commandId, nowMs: this.nowMs } as CommandBody & { key: string; nowMs: number });
    if (result.receipt.outcome !== "committed") return remember(this.reject(e, result.receipt.code ?? "rejected", result.receipt.message ?? "Rejected."));
    return commit(result.session, result.receipt.eventIds);
  }

  /** Test setup: put an ended or running REAL show in the room without going through the wire. */
  seed(session: Session): void {
    this.sessions = [...this.sessions, session];
    this.revision += 1;
  }
}
