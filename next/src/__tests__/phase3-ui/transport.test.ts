import { describe, it, expect, vi } from "vitest";
import type { CommandEnvelope } from "@/contracts/authority";
import { createAuthClient, parseAuthSession } from "@/lib/client/authClient";
import { createAuthorityClient } from "@/lib/client/authorityClient";

/**
 * Wire behaviour of the production clients: what every request carries (cookie transport, the CSRF marker, the
 * session's context), what it must never carry (a token), and what each status the contract fixes is taken to mean.
 */

const ctx = { workspaceId: "ws-1", generation: "gen-1" };
const envelope = { commandId: "cmd-1", roomId: "room-1", sessionId: "real-1", expectedRevision: 3, type: "add_note", payload: { text: "hi" } } as CommandEnvelope;

type Call = { url: string; init: RequestInit; headers: Record<string, string> };

/** A fetch that records each call and answers from a queue (or throws for a `Error`). */
function stub(...answers: Array<{ status: number; body?: unknown; text?: string } | Error>): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...answers];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
    calls.push({ url: String(input), init: init ?? {}, headers });
    const next = queue.shift() ?? { status: 200, body: {} };
    if (next instanceof Error) throw next;
    const text = next.text ?? (next.body === undefined ? "" : JSON.stringify(next.body));
    return new Response(next.status === 204 ? null : text, { status: next.status });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const roomBody = { roomId: "room-1", revision: 4, serverNowMs: 1000, clockBehindByMs: 0, changed: false, access: { actorId: "actor-1", name: "Mai", role: "operator" } };
const sessionBody = {
  workspaceId: "ws-1",
  roomId: "room-1",
  generation: "gen-1",
  access: { actorId: "actor-1", name: "Mai", role: "operator" },
  expiresAtMs: 1_700_000_000_000,
  recoveryNotice: null,
};
const err = (status: number, code: string) => ({ status, body: { error: { code, message: `m:${code}` } } });

describe("authority requests: cookie transport, marker and the session's context", () => {
  it("a read carries the marker and the context, relies on the cookie, and has no token header", async () => {
    const { fetchImpl, calls } = stub({ status: 200, body: roomBody });
    const client = createAuthorityClient({ fetchImpl, getContext: () => ctx });
    const res = await client.getRoom({ afterRevision: 4 });
    expect(res.ok).toBe(true);
    const [call] = calls;
    expect(call.url).toBe("/api/v3/room?afterRevision=4");
    expect(call.headers["x-livelift-request"]).toBe("1");
    expect(call.headers["x-livelift-workspace"]).toBe("ws-1");
    expect(call.headers["x-livelift-generation"]).toBe("gen-1");
    expect(call.init.credentials).toBe("same-origin");
    expect(call.init.cache).toBe("no-store");
    expect(Object.keys(call.headers)).not.toContain("authorization");
    expect(Object.keys(call.headers)).not.toContain("cookie");
  });

  it("a command is JSON with the marker and the same context; the envelope itself carries no context or credential", async () => {
    const { fetchImpl, calls } = stub({ status: 200, body: { receipt: { commandId: "cmd-1", type: "add_note", outcome: "committed", roomRevisionAfter: 4, eventIds: [] } } });
    const client = createAuthorityClient({ fetchImpl, getContext: () => ctx });
    await client.postCommand(envelope);
    const [call] = calls;
    expect(call.init.method).toBe("POST");
    expect(call.headers["content-type"]).toBe("application/json");
    expect(call.headers["x-livelift-request"]).toBe("1");
    expect(call.headers["x-livelift-workspace"]).toBe("ws-1");
    expect(call.headers["x-livelift-generation"]).toBe("gen-1");
    expect(call.init.body).toBe(JSON.stringify(envelope));
    expect(String(call.init.body)).not.toMatch(/gen-1|ws-1/);
  });

  it("a receipt lookup carries the context too", async () => {
    const { fetchImpl, calls } = stub({ status: 404, body: err(404, "not_found") });
    const client = createAuthorityClient({ fetchImpl, getContext: () => ctx });
    expect(await client.getReceipt("cmd-9")).toEqual({ kind: "absent" });
    expect(calls[0].headers["x-livelift-workspace"]).toBe("ws-1");
    expect(calls[0].headers["x-livelift-generation"]).toBe("gen-1");
  });

  it("the context is read for each request, so a new session's generation is used at once", async () => {
    const { fetchImpl, calls } = stub({ status: 200, body: roomBody }, { status: 200, body: roomBody });
    let current = ctx;
    const client = createAuthorityClient({ fetchImpl, getContext: () => current });
    await client.getRoom();
    current = { workspaceId: "ws-1", generation: "gen-2" };
    await client.getRoom();
    expect(calls.map((c) => c.headers["x-livelift-generation"])).toEqual(["gen-1", "gen-2"]);
  });

  it("with no authenticated session nothing is sent: a read is 'unauthenticated', a command is refused as not sent", async () => {
    const { fetchImpl, calls } = stub();
    const client = createAuthorityClient({ fetchImpl, getContext: () => null });
    expect(await client.getRoom()).toMatchObject({ ok: false, kind: "unauthenticated" });
    expect(await client.postCommand(envelope)).toMatchObject({ kind: "refused", code: "unauthenticated" });
    expect(await client.getReceipt("cmd-1")).toMatchObject({ kind: "failed", reason: "unauthenticated" });
    expect(calls).toHaveLength(0);
  });
});

describe("what each production status means for a read", () => {
  it.each([
    [400, "context_required"],
    [404, "not_found"],
    [409, "recovery_required"],
    [403, "forbidden"],
    [503, "storage_unavailable"],
    [503, "authority_unavailable"],
    [429, "rate_limited"],
  ])("%i %s is reported with the status and the code the server named", async (status, code) => {
    const { fetchImpl } = stub(err(status, code));
    const res = await createAuthorityClient({ fetchImpl, getContext: () => ctx }).getRoom();
    expect(res).toMatchObject({ ok: false, kind: "http", status, code });
  });

  it("401 is reported as 401 (the store decides it means the session ended)", async () => {
    const { fetchImpl } = stub({ status: 401, body: err(401, "unauthenticated").body });
    expect(await createAuthorityClient({ fetchImpl, getContext: () => ctx }).getRoom()).toMatchObject({ ok: false, status: 401, code: "unauthenticated" });
  });
});

describe("what each production status means for a SUBMITTED command", () => {
  const post = async (answer: { status: number; body?: unknown; text?: string } | Error) =>
    createAuthorityClient({ fetchImpl: stub(answer).fetchImpl, getContext: () => ctx }).postCommand(envelope);

  it("401 after submission is UNKNOWN: the session may have ended after the server committed it", async () => {
    expect(await post(err(401, "unauthenticated"))).toMatchObject({ kind: "unknown", status: 401 });
  });
  it("503 (storage or authority unavailable) is UNKNOWN", async () => {
    expect(await post(err(503, "storage_unavailable"))).toMatchObject({ kind: "unknown", status: 503 });
    expect(await post(err(503, "authority_unavailable"))).toMatchObject({ kind: "unknown", status: 503 });
  });
  it("a timeout or dropped connection is UNKNOWN", async () => {
    expect(await post(new TypeError("Failed to fetch"))).toMatchObject({ kind: "unknown", reason: "network" });
  });
  it("a refusal before execution is a definite refusal with its code", async () => {
    expect(await post(err(403, "csrf_failed"))).toMatchObject({ kind: "refused", code: "csrf_failed" });
    expect(await post(err(403, "forbidden"))).toMatchObject({ kind: "refused", code: "forbidden" });
    expect(await post(err(400, "context_required"))).toMatchObject({ kind: "refused", code: "context_required" });
    expect(await post(err(409, "recovery_required"))).toMatchObject({ kind: "refused", code: "recovery_required" });
    expect(await post(err(404, "not_found"))).toMatchObject({ kind: "refused", status: 404 });
    expect(await post(err(429, "rate_limited"))).toMatchObject({ kind: "refused", code: "rate_limited" });
  });
  it("a 2xx without a receipt is UNKNOWN", async () => {
    expect(await post({ status: 200, body: { ok: true } })).toMatchObject({ kind: "unknown", reason: "malformed" });
  });
});

describe("auth requests", () => {
  it.each(["headers", "body"])("bounds a session check stalled on %s, including implementations that ignore abort", async (phase) => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | null | undefined;
      const fetchImpl: typeof fetch = async (_input, init) => {
        signal = init?.signal;
        if (phase === "headers") return new Promise(() => {});
        const response = Response.json(sessionBody);
        vi.spyOn(response, "text").mockImplementation(() => new Promise(() => {}));
        return response;
      };
      const result = createAuthClient({ fetchImpl, timeoutMs: 100 }).getSession();
      await vi.advanceTimersByTimeAsync(100);
      expect(await result).toMatchObject({ kind: "unavailable", reason: "timeout" });
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("login sends JSON with the marker, the two fields and no context or token", async () => {
    const { fetchImpl, calls } = stub({ status: 200, body: sessionBody });
    const res = await createAuthClient({ fetchImpl }).login({ username: "mai", password: "a long passphrase" });
    expect(res).toMatchObject({ kind: "authenticated" });
    const [call] = calls;
    expect(call.url).toBe("/api/v3/auth/login");
    expect(call.init.method).toBe("POST");
    expect(call.init.credentials).toBe("same-origin");
    expect(call.headers["content-type"]).toBe("application/json");
    expect(call.headers["x-livelift-request"]).toBe("1");
    expect(call.headers["x-livelift-workspace"]).toBeUndefined();
    expect(call.headers.authorization).toBeUndefined();
    expect(JSON.parse(String(call.init.body))).toEqual({ username: "mai", password: "a long passphrase" });
  });

  it("session and logout carry the marker (logout is unsafe, so it is JSON too)", async () => {
    const { fetchImpl, calls } = stub({ status: 200, body: sessionBody }, { status: 204 });
    const client = createAuthClient({ fetchImpl });
    await client.getSession();
    await client.logout();
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([["GET", "/api/v3/auth/session"], ["POST", "/api/v3/auth/logout"]]);
    for (const c of calls) expect(c.headers["x-livelift-request"]).toBe("1");
    expect(calls[1].headers["content-type"]).toBe("application/json");
  });

  it("login answers map to generic, honest results", async () => {
    const login = async (answer: { status: number; body?: unknown } | Error) =>
      createAuthClient({ fetchImpl: stub(answer).fetchImpl }).login({ username: "u", password: "p" });
    expect(await login(err(401, "invalid_credentials"))).toEqual({ kind: "invalid_credentials" });
    expect(await login(err(429, "rate_limited"))).toEqual({ kind: "rate_limited" });
    expect(await login(err(400, "invalid_request"))).toMatchObject({ kind: "invalid_request" });
    expect(await login(err(503, "storage_unavailable"))).toMatchObject({ kind: "unavailable", reason: "storage_unavailable" });
    expect(await login(err(503, "authority_unavailable"))).toMatchObject({ kind: "unavailable", reason: "authority_unavailable" });
    expect(await login(err(403, "csrf_failed"))).toMatchObject({ kind: "unavailable", reason: "csrf_failed" });
    expect(await login(new TypeError("Failed to fetch"))).toMatchObject({ kind: "unavailable", reason: "network" });
  });

  it("a login that succeeded but whose body is not a session asks the server for the session instead of guessing", async () => {
    const { fetchImpl, calls } = stub({ status: 204 }, { status: 200, body: sessionBody });
    const res = await createAuthClient({ fetchImpl }).login({ username: "u", password: "p" });
    expect(res).toMatchObject({ kind: "authenticated" });
    expect(calls.map((c) => c.url)).toEqual(["/api/v3/auth/login", "/api/v3/auth/session"]);
  });

  it("session: 401 is signed out, 503 is unavailable (never signed out), and a malformed body is not trusted", async () => {
    const get = async (answer: { status: number; body?: unknown } | Error) => createAuthClient({ fetchImpl: stub(answer).fetchImpl }).getSession();
    expect(await get(err(401, "unauthenticated"))).toEqual({ kind: "signed_out" });
    expect(await get(err(503, "storage_unavailable"))).toMatchObject({ kind: "unavailable", reason: "storage_unavailable" });
    expect(await get({ status: 200, body: { workspaceId: "ws-1" } })).toMatchObject({ kind: "unavailable", reason: "malformed" });
  });

  it("logout that cannot be confirmed says so; 401 means it was already ended", async () => {
    const out = async (answer: { status: number; body?: unknown } | Error) => createAuthClient({ fetchImpl: stub(answer).fetchImpl }).logout();
    expect(await out({ status: 204 })).toEqual({ kind: "signed_out" });
    expect(await out(err(401, "unauthenticated"))).toEqual({ kind: "signed_out" });
    expect(await out(new TypeError("Failed to fetch"))).toMatchObject({ kind: "unconfirmed" });
    expect(await out(err(503, "authority_unavailable"))).toMatchObject({ kind: "unconfirmed" });
  });
});

describe("session shape", () => {
  it("accepts exactly the frozen AuthSession and rejects anything else", () => {
    expect(parseAuthSession(sessionBody)).toEqual(sessionBody);
    expect(parseAuthSession({ ...sessionBody, recoveryNotice: { restoredAtMs: 2, backupTakenAtMs: 1, backupRevision: 7 } })?.recoveryNotice).toEqual({ restoredAtMs: 2, backupTakenAtMs: 1, backupRevision: 7 });
    expect(parseAuthSession({ ...sessionBody, access: { ...sessionBody.access, role: "admin" } })).toBeNull(); // exactly two roles
    expect(parseAuthSession({ ...sessionBody, generation: "" })).toBeNull();
    expect(parseAuthSession({ ...sessionBody, recoveryNotice: { restoredAtMs: "x" } })).toBeNull();
    expect(parseAuthSession(null)).toBeNull();
  });

  it("never carries anything beyond the described session (no token field survives parsing)", () => {
    const parsed = parseAuthSession({ ...sessionBody, token: "secret", sessionToken: "secret" });
    expect(JSON.stringify(parsed)).not.toContain("secret");
  });
});

describe("workspace export transport", () => {
  const exported = (over: object = {}) => ({
    ...sessionBody,
    formatVersion: 1,
    exportedAtMs: Date.UTC(2026, 9, 7, 1, 2, 3),
    snapshot: { roomId: "room-1", revision: 4, sessions: [] },
    receipts: [],
    ...over,
  });

  it("sends the context and marker, and hands back the exact JSON with a safe file name", async () => {
    const { fetchImpl, calls } = stub({ status: 200, body: exported() });
    const res = await createAuthClient({ fetchImpl }).exportWorkspace(ctx);
    expect(calls[0].url).toBe("/api/v3/workspace/export");
    expect(calls[0].headers["x-livelift-workspace"]).toBe("ws-1");
    expect(calls[0].headers["x-livelift-generation"]).toBe("gen-1");
    expect(calls[0].headers["x-livelift-request"]).toBe("1");
    expect(res).toMatchObject({ kind: "ready", filename: "livelift-workspace-ws-1-2026-10-07T01-02-03-000Z.json" });
    if (res.kind === "ready") expect(JSON.parse(res.json)).toMatchObject({ formatVersion: 1 });
  });

  it("an export for another generation or workspace is not saved", async () => {
    const other = await createAuthClient({ fetchImpl: stub({ status: 200, body: exported({ generation: "gen-2" }) }).fetchImpl }).exportWorkspace(ctx);
    expect(other).toMatchObject({ kind: "wrong_context" });
  });

  it("maps the failures the contract names", async () => {
    const run = async (answer: { status: number; body?: unknown } | Error) => createAuthClient({ fetchImpl: stub(answer).fetchImpl }).exportWorkspace(ctx);
    expect(await run(err(401, "unauthenticated"))).toEqual({ kind: "session_ended" });
    expect(await run(err(403, "forbidden"))).toMatchObject({ kind: "forbidden" });
    expect(await run(err(409, "recovery_required"))).toMatchObject({ kind: "wrong_context", code: "recovery_required" });
    expect(await run(err(404, "not_found"))).toMatchObject({ kind: "wrong_context" });
    expect(await run(err(400, "context_required"))).toMatchObject({ kind: "wrong_context" });
    expect(await run(err(503, "storage_unavailable"))).toMatchObject({ kind: "unavailable", reason: "storage_unavailable" });
    expect(await run(err(429, "rate_limited"))).toEqual({ kind: "rate_limited" });
    expect(await run({ status: 200, body: { formatVersion: 2 } })).toMatchObject({ kind: "unavailable", reason: "malformed" });
  });
});
