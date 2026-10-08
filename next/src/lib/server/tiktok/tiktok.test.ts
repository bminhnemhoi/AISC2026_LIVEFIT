// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { ProductionConfig } from "../config";
import { AuthorityError } from "../config";
import { initialize, deleteWorkspace } from "../operations";
import { addUser, updateUser, COOKIE } from "../auth";
import { exportWorkspace, openExisting } from "../database";
import { closeRuntime } from "../runtime";
import { POST as loginRoute } from "@/app/api/v3/auth/login/route";
import { GET as statusRoute } from "@/app/api/v3/integrations/tiktok/route";
import { POST as connectRoute } from "@/app/api/v3/integrations/tiktok/connect/route";
import { GET as callbackRoute } from "@/app/api/v3/integrations/tiktok/callback/route";
import { POST as refreshRoute } from "@/app/api/v3/integrations/tiktok/refresh/route";
import { POST as disconnectRoute } from "@/app/api/v3/integrations/tiktok/disconnect/route";
import { GET as avatarRoute } from "@/app/api/v3/integrations/tiktok/avatar/route";
import { beginConnect, completeCallback, disconnect, fetchAvatar, refreshConnection, tiktokStatus, type TikTokContext } from "./service";
import { ENV, loadTikTokConfig, providerStorePath } from "./config";
import { decryptField, encryptField } from "./crypto";
import { openProviderStore } from "./store";
import { BINDING_COOKIE } from "./http";
import { tiktokShopCatalog } from "./shop";
import { parseProductRows, toProductSnapshots } from "@/lib/domain/products";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- deterministic fixtures: no real credentials, no network -------------------------------------------------------
const ORIGIN = "https://livelift.example.com";
const CALLBACK_PATH = "/api/v3/integrations/tiktok/callback";
const CLIENT_KEY = "fixture-client-key-0001";
const CLIENT_SECRET = "fixture-client-secret-0123456789";
const ENC_KEY = randomBytes(32).toString("base64");
const PASSWORD = "a fixture password that is long";
const AVATAR_URL = "https://p16-sign.tiktokcdn.com/fixture-avatar.jpeg";
const DAY = 86_400_000;
const HOUR = 3_600_000;

type Call = { url: string; method: string; form: URLSearchParams | null; auth: string | null; contentType: string | null };
const reply = (status: number, body: unknown): Response => new Response(body === undefined ? "" : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokenBody = (n: number, scope: string) => ({ access_token: `act.fixture.${n}`, refresh_token: `rft.fixture.${n}`, open_id: "open-id-fixture-123", expires_in: 86400, refresh_expires_in: 31536000, scope, token_type: "Bearer" });
const FIXTURE_USER: Record<string, unknown> = { open_id: "open-id-fixture-123", avatar_url: AVATAR_URL, display_name: "Fixture Creator", username: "fixture.creator", is_verified: false };
const okUser = (_auth: string | null, fields: string[]): Response => reply(200, { data: { user: Object.fromEntries(fields.map((f) => [f, FIXTURE_USER[f]])) }, error: { code: "ok", message: "", log_id: "L3" } });
const invalidAccess = (): Response => reply(401, { data: {}, error: { code: "access_token_invalid", message: "x", log_id: "l" } });

function fakeTikTok() {
  const fake = {
    calls: [] as Call[],
    issued: 0,
    scope: "user.info.basic",
    validRefresh: "",
    delayMs: 0,
    onToken: (form: URLSearchParams): Response => {
      if (form.get("grant_type") === "authorization_code") {
        if (form.get("code") !== "good-code") return reply(400, { error: "invalid_grant", error_description: "bad code", log_id: "L1" });
      } else if (!(form.get("grant_type") === "refresh_token" && form.get("refresh_token") === fake.validRefresh)) {
        return reply(400, { error: "invalid_grant", error_description: "refresh token invalid", log_id: "L2" });
      }
      fake.issued++; fake.validRefresh = `rft.fixture.${fake.issued}`;
      return reply(200, tokenBody(fake.issued, fake.scope));
    },
    onUser: okUser,
    onRevoke: (): Response => reply(200, {}),
    onAvatar: (): Response => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { status: 200, headers: { "content-type": "image/jpeg" } }),
  };
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers);
    const form = typeof init?.body === "string" && headers.get("content-type")?.includes("x-www-form-urlencoded") ? new URLSearchParams(init.body) : null;
    fake.calls.push({ url, method: init?.method ?? "GET", form, auth: headers.get("authorization"), contentType: headers.get("content-type") });
    if (fake.delayMs) await new Promise((r) => setTimeout(r, fake.delayMs));
    if (url.startsWith("https://open.tiktokapis.com/v2/oauth/token/")) return fake.onToken(form!);
    if (url.startsWith("https://open.tiktokapis.com/v2/oauth/revoke/")) return fake.onRevoke();
    if (url.startsWith("https://open.tiktokapis.com/v2/user/info/")) return fake.onUser(headers.get("authorization"), new URL(url).searchParams.get("fields")!.split(","));
    if (url === AVATAR_URL) return fake.onAvatar();
    throw new TypeError(`unexpected fetch in test: ${url}`);
  });
  return fake;
}

// ---- a workspace per test ------------------------------------------------------------------------------------------
const folders: string[] = [];
type World = { cfg: ProductionConfig; db: DatabaseSync; operatorId: string; viewerId: string; ctx: TikTokContext; sidecar: string; clock: { t: number } };

function env(cfg: ProductionConfig, tiktok: boolean): void {
  for (const [key, value] of Object.entries({ NODE_ENV: "production", LIVELIFT_WORKSPACE_ID: cfg.workspaceId, LIVELIFT_ROOM_ID: cfg.roomId, LIVELIFT_APP_ORIGIN: cfg.origin, LIVELIFT_DB_PATH: cfg.dbPath, LIVELIFT_BACKUP_DIR: cfg.backupDir })) vi.stubEnv(key, value);
  if (tiktok) {
    vi.stubEnv(ENV.clientKey, CLIENT_KEY); vi.stubEnv(ENV.clientSecret, CLIENT_SECRET);
    vi.stubEnv(ENV.redirectUri, `${cfg.origin}${CALLBACK_PATH}`); vi.stubEnv(ENV.encryptionKey, ENC_KEY);
  }
}
async function world(options: { tiktok?: boolean } = {}): Promise<World> {
  const folder = mkdtempSync(join(tmpdir(), "livelift-tiktok-")); folders.push(folder);
  const cfg: ProductionConfig = { dbPath: join(folder, "authority.sqlite"), backupDir: join(folder, "backups"), roomId: "studio", workspaceId: randomUUID(), origin: ORIGIN, trustProxy: false, capabilities: [] };
  initialize(cfg);
  const db = openExisting(cfg.dbPath);
  const operatorId = await addUser(db, "operator", "Lead", "operator", PASSWORD);
  const viewerId = await addUser(db, "viewer", "Watch", "viewer", PASSWORD);
  env(cfg, options.tiktok !== false);
  const clock = { t: Date.now() };
  return { cfg, db, operatorId, viewerId, clock, sidecar: providerStorePath(cfg), ctx: { production: cfg, authorityDb: db, now: () => clock.t } };
}

function url(path: string): string { return `${ORIGIN}${path}`; }
type Session = { cookie: string; context: { workspaceId: string; generation: string } };
async function signIn(username: string): Promise<Session> {
  const res = await loginRoute(new Request(url("/api/v3/auth/login"), { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, "X-LiveLift-Request": "1" }, body: JSON.stringify({ username, password: PASSWORD }) }));
  expect(res.status).toBe(200);
  const token = /__Host-livelift_session=([A-Za-z0-9_-]+)/.exec(res.headers.get("Set-Cookie")!)![1];
  const session = (await res.json()) as { workspaceId: string; generation: string };
  return { cookie: `${COOKIE}=${token}`, context: { workspaceId: session.workspaceId, generation: session.generation } };
}
function call(path: string, s: Session | null, method: "GET" | "POST" = "GET"): Request {
  const headers: Record<string, string> = s ? { Cookie: s.cookie, "X-LiveLift-Workspace": s.context.workspaceId, "X-LiveLift-Generation": s.context.generation } : {};
  if (method === "POST") Object.assign(headers, { Origin: ORIGIN, "X-LiveLift-Request": "1", "Content-Type": "application/json" });
  return new Request(url(path), { method, headers, ...(method === "POST" ? { body: "{}" } : {}) });
}
function stateOf(authorizeUrl: string): string { return new URL(authorizeUrl).searchParams.get("state")!; }
function bindingOf(res: Response): string { return new RegExp(`${BINDING_COOKIE}=([A-Za-z0-9_-]{43})`).exec(res.headers.get("Set-Cookie")!)![1]; }
function callbackUrl(params: Record<string, string>): URL { return new URL(`${url(CALLBACK_PATH)}?${new URLSearchParams(params)}`); }

/** Starts and completes a connection through the service, returning the final callback outcome. */
async function connect(w: World, opts: { code?: string } = {}) {
  const started = beginConnect(w.ctx, w.operatorId);
  const outcome = await completeCallback(w.ctx, callbackUrl({ code: opts.code ?? "good-code", state: stateOf(started.authorizeUrl) }), started.binding);
  return { outcome, started };
}
function rawRow(w: World): Record<string, unknown> | undefined {
  const raw = new DatabaseSync(w.sidecar, { readOnly: true });
  try { return raw.prepare("SELECT * FROM provider_connections").get(); } finally { raw.close(); }
}
const tokenCalls = (f: ReturnType<typeof fakeTikTok>) => f.calls.filter((c) => c.url.includes("/oauth/token/"));
const refreshCalls = (f: ReturnType<typeof fakeTikTok>) => tokenCalls(f).filter((c) => c.form!.get("grant_type") === "refresh_token");
const userCalls = (f: ReturnType<typeof fakeTikTok>) => f.calls.filter((c) => c.url.includes("/user/info/"));

let fake: ReturnType<typeof fakeTikTok>;
beforeEach(() => { fake = fakeTikTok(); });
afterEach(async () => { await closeRuntime(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true }); });

// ---- configuration -------------------------------------------------------------------------------------------------
describe("configuration", () => {
  test("not configured: variable names only, no OAuth can start, nothing is created", async () => {
    const w = await world({ tiktok: false });
    const s = await signIn("operator");
    const res = await statusRoute(call("/api/v3/integrations/tiktok", s));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.state).toBe("not_configured");
    expect(body.configIssues).toEqual(expect.arrayContaining([ENV.clientKey, ENV.clientSecret, ENV.redirectUri, ENV.encryptionKey]));
    expect(body.connection).toBeNull();
    const connectRes = await connectRoute(call("/api/v3/integrations/tiktok/connect", s, "POST"));
    expect(connectRes.status).toBe(409);
    expect((await connectRes.json()).error.code).toBe("provider_not_configured");
    expect(connectRes.headers.get("Set-Cookie")).toBeNull();
    expect(existsSync(w.sidecar)).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  test("an invalid value is reported by name and never echoed", async () => {
    const w = await world();
    vi.stubEnv(ENV.redirectUri, "http://evil.example.com/cb?x=1");
    vi.stubEnv(ENV.encryptionKey, "short-secret-value-that-is-wrong");
    vi.stubEnv(ENV.scopes, "user.info.basic,video.publish");
    const result = loadTikTokConfig(w.cfg);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([ENV.redirectUri, ENV.encryptionKey, ENV.scopes]));
    const text = JSON.stringify(tiktokStatus(w.ctx));
    for (const leaked of ["evil.example.com", "short-secret-value", "video.publish", CLIENT_SECRET]) expect(text).not.toContain(leaked);
  });

  test("the redirect URI must be exactly this deployment's callback", async () => {
    const w = await world();
    expect(loadTikTokConfig(w.cfg).ok).toBe(true);
    vi.stubEnv(ENV.redirectUri, `${ORIGIN}${CALLBACK_PATH}/`);
    expect(loadTikTokConfig(w.cfg).issues).toContain(ENV.redirectUri);
    vi.stubEnv(ENV.redirectUri, `https://other.example.com${CALLBACK_PATH}`);
    expect(loadTikTokConfig(w.cfg).issues).toContain(ENV.redirectUri);
  });

  test("scopes default to user.info.basic, may add user.info.profile, and exclude everything else", async () => {
    const w = await world();
    expect(loadTikTokConfig(w.cfg).scopes).toEqual(["user.info.basic"]);
    vi.stubEnv(ENV.scopes, "user.info.basic,user.info.profile");
    expect(loadTikTokConfig(w.cfg).scopes).toEqual(["user.info.basic", "user.info.profile"]);
    for (const bad of ["user.info.stats", "user.info.profile", "video.list", "user.info.basic,live.room.info"]) {
      vi.stubEnv(ENV.scopes, bad);
      expect(loadTikTokConfig(w.cfg).issues).toContain(ENV.scopes);
    }
  });
});

// ---- OAuth start + state/CSRF + callback ---------------------------------------------------------------------------
describe("OAuth start and callback", () => {
  test("start: official authorize URL, exact parameters, hashed pending state, Lax HttpOnly binding cookie", async () => {
    const w = await world();
    const s = await signIn("operator");
    const res = await connectRoute(call("/api/v3/integrations/tiktok/connect", s, "POST"));
    expect(res.status).toBe(200);
    const { authorizeUrl } = await res.json();
    const parsed = new URL(authorizeUrl);
    expect(`${parsed.origin}${parsed.pathname}`).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(parsed.searchParams.get("client_key")).toBe(CLIENT_KEY);
    expect(parsed.searchParams.get("scope")).toBe("user.info.basic");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe(`${ORIGIN}${CALLBACK_PATH}`);
    expect(stateOf(authorizeUrl)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(authorizeUrl).not.toContain(CLIENT_SECRET);
    expect(res.headers.get("Set-Cookie")).toMatch(/^__Host-livelift_tiktok_bind=[A-Za-z0-9_-]{43}; Secure; HttpOnly; SameSite=Lax; Path=\/; Max-Age=600$/);
    // The state is stored only as a hash.
    const raw = new DatabaseSync(w.sidecar, { readOnly: true });
    const row = raw.prepare("SELECT * FROM oauth_pending").get()!;
    raw.close();
    expect(row.state_hash).toBe(createHash("sha256").update(stateOf(authorizeUrl)).digest("hex"));
    expect(readFileSync(w.sidecar).includes(stateOf(authorizeUrl))).toBe(false);
    expect(readFileSync(w.sidecar).includes(bindingOf(res))).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  test("start requires an operator, a session and the CSRF marker", async () => {
    await world();
    const viewer = await signIn("viewer");
    expect((await connectRoute(call("/api/v3/integrations/tiktok/connect", viewer, "POST"))).status).toBe(403);
    expect((await connectRoute(call("/api/v3/integrations/tiktok/connect", null, "POST"))).status).toBe(401);
    const operator = await signIn("operator");
    const noMarker = new Request(url("/api/v3/integrations/tiktok/connect"), { method: "POST", headers: { Cookie: operator.cookie, "X-LiveLift-Workspace": operator.context.workspaceId, "X-LiveLift-Generation": operator.context.generation, "Content-Type": "application/json", Origin: ORIGIN }, body: "{}" });
    const res = await connectRoute(noMarker);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("csrf_failed");
  });

  test("callback success over HTTP: exchange is server-side with the official request shape; the session cookie is NOT needed", async () => {
    const w = await world();
    const s = await signIn("operator");
    const start = await connectRoute(call("/api/v3/integrations/tiktok/connect", s, "POST"));
    const state = stateOf((await start.json()).authorizeUrl);
    // Cross-site navigation from tiktok.com: only the Lax binding cookie is sent.
    const res = await callbackRoute(new Request(url(`${CALLBACK_PATH}?code=good-code&scopes=user.info.basic&state=${state}`), { headers: { Cookie: `${BINDING_COOKIE}=${bindingOf(start)}` } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/integrations?tiktok=connected`);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");

    const [exchange] = tokenCalls(fake);
    expect(exchange.url).toBe("https://open.tiktokapis.com/v2/oauth/token/");
    expect(exchange.method).toBe("POST");
    expect(exchange.contentType).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(exchange.form!)).toEqual({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, code: "good-code", grant_type: "authorization_code", redirect_uri: `${ORIGIN}${CALLBACK_PATH}` });
    const [profile] = userCalls(fake);
    expect(profile.auth).toBe("Bearer act.fixture.1");
    expect(new URL(profile.url).searchParams.get("fields")).toBe("open_id,avatar_url,display_name");

    for (const who of [s, await signIn("viewer")]) {
      const body = await (await statusRoute(call("/api/v3/integrations/tiktok", who))).json();
      expect(body.state).toBe("connected");
      expect(body.connection.openId).toBe("open-id-fixture-123");
      expect(body.connection.grantedScopes).toEqual(["user.info.basic"]);
      expect(body.connection.notGrantedScopes).toEqual([]);
      expect(body.connection.profile).toEqual({ displayName: "Fixture Creator", avatarAvailable: true, username: null, isVerified: null });
      expect(body.connection.profileState).toBe("ok");
      expect(body.connection.authorizationValidUntilMs).toBeGreaterThan(Date.now() + 360 * DAY);
      expect(body.limits).toEqual({ live: "not_established", shop: "not_established", analytics: "not_established", nativeActions: "not_established" });
    }
    expect(rawRow(w)!.status).toBe("connected");
  });

  test("avatar is relayed from TikTok's CDN only, behind a session, with locked-down headers", async () => {
    const w = await world();
    await connect(w);
    const s = await signIn("viewer");
    const ok = await avatarRoute(call("/api/v3/integrations/tiktok/avatar", s));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Type")).toBe("image/jpeg");
    expect(ok.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(ok.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    expect((await avatarRoute(call("/api/v3/integrations/tiktok/avatar", null))).status).toBe(401);
    // A non-image answer, or a non-TikTok host, yields nothing rather than being relayed.
    fake.onAvatar = () => new Response("<svg onload=alert(1)>", { headers: { "content-type": "image/svg+xml" } });
    expect(await fetchAvatar(w.ctx)).toBeNull();
    const raw = new DatabaseSync(w.sidecar);
    raw.prepare("UPDATE provider_connections SET profile_json = ?").run(JSON.stringify({ displayName: "x", avatarUrl: "https://evil.example.com/a.jpg" }));
    raw.close();
    fake.calls.length = 0;
    expect(await fetchAvatar(w.ctx)).toBeNull();
    expect(fake.calls).toHaveLength(0);
    expect(tiktokStatus(w.ctx).connection!.profile!.avatarAvailable).toBe(false);
  });

  test("state validation: tampered, missing, wrong binding, replay, expiry and wrong path all fail closed without calling TikTok", async () => {
    const w = await world();
    const a = beginConnect(w.ctx, w.operatorId);
    const state = stateOf(a.authorizeUrl);
    const flipped = state.slice(0, -1) + (state.endsWith("A") ? "B" : "A");
    expect(await completeCallback(w.ctx, callbackUrl({ code: "good-code", state: flipped }), a.binding)).toBe("state_invalid");
    expect(await completeCallback(w.ctx, callbackUrl({ code: "good-code" }), a.binding)).toBe("state_invalid");
    expect(await completeCallback(w.ctx, callbackUrl({ code: "good-code", state: "short" }), a.binding)).toBe("state_invalid");
    // Another browser (no binding cookie, or somebody else's) cannot complete this flow, and the attempt burns the state.
    expect(await completeCallback(w.ctx, callbackUrl({ code: "good-code", state }), null)).toBe("state_invalid");
    expect(await completeCallback(w.ctx, callbackUrl({ code: "good-code", state }), a.binding)).toBe("state_invalid");
    const b = beginConnect(w.ctx, w.operatorId);
    expect(await completeCallback(w.ctx, callbackUrl({ code: "good-code", state: stateOf(b.authorizeUrl) }), a.binding)).toBe("state_invalid");
    // Expiry (10 minutes).
    const c = beginConnect(w.ctx, w.operatorId);
    w.clock.t += 10 * 60_000 + 1;
    expect(await completeCallback(w.ctx, callbackUrl({ code: "good-code", state: stateOf(c.authorizeUrl) }), c.binding)).toBe("state_invalid");
    // The callback path must be the registered one.
    const d = beginConnect(w.ctx, w.operatorId);
    expect(await completeCallback(w.ctx, new URL(`${ORIGIN}/api/v3/integrations/tiktok/other?code=good-code&state=${stateOf(d.authorizeUrl)}`), d.binding)).toBe("state_invalid");
    expect(fake.calls).toHaveLength(0);
    expect(tiktokStatus(w.ctx).state).toBe("ready");
  });

  test("a state is single use: replaying a successful callback does not exchange again", async () => {
    const w = await world();
    const { started } = await connect(w);
    const replay = await completeCallback(w.ctx, callbackUrl({ code: "good-code", state: stateOf(started.authorizeUrl) }), started.binding);
    expect(replay).toBe("state_invalid");
    expect(tokenCalls(fake)).toHaveLength(1);
  });

  test("provider callback failure: user denial and provider errors connect nothing and call no token endpoint", async () => {
    const w = await world();
    for (const [error, expected] of [["access_denied", "denied"], ["server_error", "exchange_failed"]] as const) {
      const started = beginConnect(w.ctx, w.operatorId);
      expect(await completeCallback(w.ctx, callbackUrl({ error, error_description: "provider text is never shown", state: stateOf(started.authorizeUrl) }), started.binding)).toBe(expected);
    }
    const started = beginConnect(w.ctx, w.operatorId);
    expect(await completeCallback(w.ctx, callbackUrl({ state: stateOf(started.authorizeUrl) }), started.binding)).toBe("exchange_failed");
    expect(fake.calls).toHaveLength(0);
    expect(tiktokStatus(w.ctx).state).toBe("ready");
  });

  test("the callback route always lands on a page with a fixed outcome code, never echoing input, even when storage is wrong", async () => {
    const w = await world();
    const bad = await callbackRoute(new Request(url(`${CALLBACK_PATH}?code=secret-code-value&state=nope`)));
    expect(bad.status).toBe(303);
    expect(bad.headers.get("Location")).toBe(`${ORIGIN}/integrations?tiktok=state_invalid`);
    // A provider store belonging to another workspace is refused; the browser still gets a redirect.
    const other = await world();
    await connect(other);
    fake.calls.length = 0;
    env(w.cfg, true);
    vi.stubEnv(ENV.providerDbPath, other.sidecar);
    const refused = await callbackRoute(new Request(url(`${CALLBACK_PATH}?code=secret-code-value&state=${"A".repeat(43)}`)));
    expect(refused.status).toBe(303);
    expect(refused.headers.get("Location")).toBe(`${ORIGIN}/integrations?tiktok=provider_unavailable`);
    expect(fake.calls).toHaveLength(0);
  });

  test.each([
    ["invalid_grant", 400, { error: "invalid_grant", error_description: "x", log_id: "l" }, "exchange_failed"],
    ["invalid_request", 400, { error: "invalid_request", error_description: "x", log_id: "l" }, "exchange_failed"],
    ["invalid_client", 401, { error: "invalid_client", error_description: "x", log_id: "l" }, "credentials_rejected"],
    ["server_error", 500, { error: "server_error", error_description: "x", log_id: "l" }, "provider_unavailable"],
    ["temporarily_unavailable", 503, { error: "temporarily_unavailable" }, "provider_unavailable"],
    ["rate limit", 429, { error: "rate_limit_exceeded" }, "provider_unavailable"],
    ["unknown error code", 400, { error: "something_new" }, "provider_unavailable"],
    ["malformed success", 200, { nothing: "useful" }, "exchange_failed"],
    ["not JSON", 200, undefined, "exchange_failed"],
  ] as const)("token exchange failure (%s) stores nothing", async (_name, status, body, expected) => {
    const w = await world();
    fake.onToken = () => (body === undefined ? new Response("<html>oops</html>", { status }) : reply(status, body));
    expect((await connect(w)).outcome).toBe(expected);
    expect(tiktokStatus(w.ctx).state).toBe("ready");
    expect(existsSync(w.sidecar) ? rawRow(w) : undefined).toBeUndefined();
  });

  test("token exchange network failure or timeout is 'provider unavailable', not a refusal", async () => {
    const w = await world();
    for (const error of [new TypeError("fetch failed"), Object.assign(new Error("t"), { name: "TimeoutError" })]) {
      fake.onToken = () => { throw error; };
      expect((await connect(w)).outcome).toBe("provider_unavailable");
    }
    expect(tiktokStatus(w.ctx).state).toBe("ready");
  });

  test("an operator who is disabled before the callback finishes connects nothing", async () => {
    const w = await world();
    const started = beginConnect(w.ctx, w.operatorId);
    await updateUser(w.db, "operator", "disable");
    expect(await completeCallback(w.ctx, callbackUrl({ code: "good-code", state: stateOf(started.authorizeUrl) }), started.binding)).toBe("forbidden");
    expect(tokenCalls(fake)).toHaveLength(0);
    expect(tiktokStatus(w.ctx).state).toBe("ready");
  });
});

// ---- profile -------------------------------------------------------------------------------------------------------
describe("profile (User Info)", () => {
  test("partial grant: only fields the granted scopes allow are requested; the missing scope is shown", async () => {
    const w = await world();
    vi.stubEnv(ENV.scopes, "user.info.basic,user.info.profile");
    fake.scope = "user.info.basic";
    expect((await connect(w)).outcome).toBe("connected");
    expect(new URL(userCalls(fake)[0].url).searchParams.get("fields")).toBe("open_id,avatar_url,display_name");
    const view = tiktokStatus(w.ctx);
    expect(view.requestedScopes).toEqual(["user.info.basic", "user.info.profile"]);
    expect(view.connection!.grantedScopes).toEqual(["user.info.basic"]);
    expect(view.connection!.notGrantedScopes).toEqual(["user.info.profile"]);
    expect(view.connection!.profile!.username).toBeNull();
  });

  test("full grant adds username and verification", async () => {
    const w = await world();
    vi.stubEnv(ENV.scopes, "user.info.basic,user.info.profile");
    fake.scope = "user.info.basic,user.info.profile";
    await connect(w);
    expect(new URL(userCalls(fake)[0].url).searchParams.get("fields")).toBe("open_id,avatar_url,display_name,username,is_verified");
    expect(tiktokStatus(w.ctx).connection!.profile).toMatchObject({ username: "fixture.creator", isVerified: false });
  });

  test("missing fields stay unknown: partial profile, no avatar, never an empty string or zero", async () => {
    const w = await world();
    fake.onUser = () => reply(200, { data: { user: { open_id: "open-id-fixture-123", display_name: "  " } }, error: { code: "ok", message: "", log_id: "l" } });
    await connect(w);
    const c = tiktokStatus(w.ctx).connection!;
    expect(c.profileState).toBe("partial");
    expect(c.profile).toEqual({ displayName: null, avatarAvailable: false, username: null, isVerified: null });
    expect(c.openId).toBe("open-id-fixture-123");
  });

  test("a grant without user.info.basic reads no profile at all", async () => {
    const w = await world();
    fake.scope = "user.info.profile";
    await connect(w);
    expect(userCalls(fake)).toHaveLength(0);
    expect(tiktokStatus(w.ctx).connection!.profileState).toBe("scope_missing");
  });

  test("scope_not_authorized from TikTok is a scope problem, not an outage", async () => {
    const w = await world();
    fake.onUser = () => reply(401, { data: {}, error: { code: "scope_not_authorized", message: "x", log_id: "l" } });
    await connect(w);
    const view = tiktokStatus(w.ctx);
    expect(view.state).toBe("connected");
    expect(view.connection!.profileState).toBe("scope_missing");
  });

  test("provider outage on the profile read leaves the connection 'unavailable' (unknown), keeps tokens, and recovers", async () => {
    const w = await world();
    await connect(w);
    const good = fake.onUser;
    fake.onUser = () => reply(503, { error: { code: "internal_error" } });
    let view = await refreshConnection(w.ctx);
    expect(view.state).toBe("unavailable");
    expect(view.connection!.unavailableReason).toBe("provider_error");
    expect(view.connection!.profile!.displayName).toBe("Fixture Creator");
    expect(rawRow(w)!.access_token_enc).not.toBeNull();
    fake.onUser = () => reply(429, { data: {}, error: { code: "rate_limit_exceeded", message: "x", log_id: "l" } });
    expect((await refreshConnection(w.ctx)).connection!.unavailableReason).toBe("rate_limited");
    fake.onUser = () => { throw new TypeError("fetch failed"); };
    expect((await refreshConnection(w.ctx)).connection!.unavailableReason).toBe("network");
    fake.onUser = () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); };
    expect((await refreshConnection(w.ctx)).connection!.unavailableReason).toBe("timeout");
    fake.onUser = () => reply(200, { garbage: true });
    expect((await refreshConnection(w.ctx)).connection!.unavailableReason).toBe("provider_error");
    fake.onUser = good;
    view = await refreshConnection(w.ctx);
    expect(view.state).toBe("connected");
    expect(view.connection!.unavailableReason).toBeNull();
  });

  test("an access token TikTok refuses is renewed once and retried; a second refusal ends the authorization", async () => {
    const w = await world();
    await connect(w);
    let first = true;
    fake.onUser = (auth, fields) => { if (first) { first = false; return invalidAccess(); } return okUser(auth, fields); };
    expect((await refreshConnection(w.ctx)).state).toBe("connected");
    expect(refreshCalls(fake)).toHaveLength(1);
    expect(userCalls(fake).at(-1)!.auth).toBe("Bearer act.fixture.2");
    fake.onUser = invalidAccess;
    expect((await refreshConnection(w.ctx)).state).toBe("expired");
    expect(rawRow(w)!.access_token_enc).toBeNull();
  });
});

// ---- token lifecycle -----------------------------------------------------------------------------------------------
describe("token refresh lifecycle", () => {
  test("a fresh access token is used as is; no refresh happens", async () => {
    const w = await world();
    await connect(w);
    w.clock.t += HOUR;
    await refreshConnection(w.ctx);
    expect(refreshCalls(fake)).toHaveLength(0);
    expect(userCalls(fake).at(-1)!.auth).toBe("Bearer act.fixture.1");
  });

  test.each([["inside the 5 minute window", 24 * HOUR - 4 * 60_000], ["after expiry", 25 * HOUR]])("refresh %s rotates both tokens", async (_name, advance) => {
    const w = await world();
    await connect(w);
    w.clock.t += advance;
    expect((await refreshConnection(w.ctx)).state).toBe("connected");
    expect(refreshCalls(fake)).toHaveLength(1);
    expect(Object.fromEntries(refreshCalls(fake)[0].form!)).toEqual({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, grant_type: "refresh_token", refresh_token: "rft.fixture.1" });
    expect(userCalls(fake).at(-1)!.auth).toBe("Bearer act.fixture.2");
    const store = openProviderStore(w.sidecar, w.cfg.workspaceId, Buffer.from(ENC_KEY, "base64"), false)!;
    expect(store.readTokens(store.get()!)).toEqual({ accessToken: "act.fixture.2", refreshToken: "rft.fixture.2" });
    store.close();
  });

  test("refresh failure: a refused refresh token ends the authorization, erases tokens, and nothing is tried again", async () => {
    const w = await world();
    await connect(w);
    fake.validRefresh = "revoked-elsewhere";
    w.clock.t += 25 * HOUR;
    const view = await refreshConnection(w.ctx);
    expect(view.state).toBe("expired");
    expect(view.connection!.authorizationValidUntilMs).toBeNull();
    expect(view.connection!.profile!.displayName).toBe("Fixture Creator"); // last known; the UI labels it as not current
    const row = rawRow(w)!;
    expect(row.status).toBe("expired");
    expect(row.access_token_enc).toBeNull();
    expect(row.refresh_token_enc).toBeNull();
    fake.calls.length = 0;
    expect((await refreshConnection(w.ctx)).state).toBe("expired");
    expect(fake.calls).toHaveLength(0);
  });

  test("a transient refresh failure is 'unavailable', keeps the tokens, and a later success recovers", async () => {
    const w = await world();
    await connect(w);
    w.clock.t += 25 * HOUR;
    const real = fake.onToken;
    fake.onToken = () => reply(503, { error: "temporarily_unavailable" });
    let view = await refreshConnection(w.ctx);
    expect(view.state).toBe("unavailable");
    expect(view.connection!.unavailableReason).toBe("provider_error");
    expect(rawRow(w)!.refresh_token_enc).not.toBeNull();
    fake.onToken = () => reply(401, { error: "invalid_client" });
    expect((await refreshConnection(w.ctx)).connection!.unavailableReason).toBe("app_credentials_rejected");
    fake.onToken = real;
    view = await refreshConnection(w.ctx);
    expect(view.state).toBe("connected");
    expect(view.connection!.unavailableReason).toBeNull();
  });

  test("the refresh token expiring by the clock ends the authorization locally, with no network call", async () => {
    const w = await world();
    await connect(w);
    fake.calls.length = 0;
    w.clock.t += 366 * DAY;
    expect(tiktokStatus(w.ctx).state).toBe("expired");
    expect(rawRow(w)!.access_token_enc).toBeNull();
    expect(fake.calls).toHaveLength(0);
  });

  test("concurrent checks share one refresh", async () => {
    const w = await world();
    await connect(w);
    w.clock.t += 25 * HOUR;
    fake.delayMs = 20;
    await Promise.all([refreshConnection(w.ctx), refreshConnection(w.ctx), refreshConnection(w.ctx)]);
    expect(refreshCalls(fake)).toHaveLength(1);
  });

  test("the check route is operator-only", async () => {
    const w = await world();
    await connect(w);
    const viewer = await signIn("viewer");
    expect((await refreshRoute(call("/api/v3/integrations/tiktok/refresh", viewer, "POST"))).status).toBe(403);
    const operator = await signIn("operator");
    const res = await refreshRoute(call("/api/v3/integrations/tiktok/refresh", operator, "POST"));
    expect(res.status).toBe(200);
    expect((await res.json()).state).toBe("connected");
  });
});

// ---- disconnect ----------------------------------------------------------------------------------------------------
describe("disconnect", () => {
  test("revokes at TikTok, then erases every credential, identity and profile field", async () => {
    const w = await world();
    await connect(w);
    const view = await disconnect(w.ctx, w.operatorId);
    expect(view).toMatchObject({ state: "disconnected", lastRevocation: "confirmed", connection: null });
    const revoke = fake.calls.find((c) => c.url.includes("/oauth/revoke/"))!;
    expect(Object.fromEntries(revoke.form!)).toEqual({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, token: "act.fixture.1" });
    expect(rawRow(w)).toMatchObject({ status: "disconnected", open_id: null, access_token_enc: null, refresh_token_enc: null, profile_json: null, granted_scopes: "", revocation: "confirmed" });
    const bytes = readFileSync(w.sidecar);
    for (const s of ["act.fixture", "rft.fixture", "Fixture Creator", "open-id-fixture-123"]) expect(bytes.includes(s)).toBe(false);
  });

  test("if TikTok cannot confirm revocation, credentials are still erased and the answer says 'unconfirmed'", async () => {
    for (const failing of [() => reply(500, { error: "server_error" }), () => { throw new TypeError("fetch failed"); }]) {
      const w = await world();
      await connect(w);
      fake.onRevoke = failing;
      expect(await disconnect(w.ctx, w.operatorId)).toMatchObject({ state: "disconnected", lastRevocation: "unconfirmed" });
      expect(rawRow(w)!.access_token_enc).toBeNull();
    }
  });

  test("local erasure works even when TikTok settings were removed from the environment", async () => {
    const w = await world();
    await connect(w);
    vi.stubEnv(ENV.clientSecret, "");
    fake.calls.length = 0;
    expect((await disconnect(w.ctx, w.operatorId)).state).toBe("not_configured");
    expect(fake.calls).toHaveLength(0);
    expect(rawRow(w)).toMatchObject({ status: "disconnected", access_token_enc: null, refresh_token_enc: null, open_id: null, revocation: "unconfirmed" });
  });

  test("disconnect is idempotent, an expired connection needs no revoke, and reconnecting works", async () => {
    const w = await world();
    await connect(w);
    await disconnect(w.ctx, w.operatorId);
    const before = fake.calls.length;
    expect((await disconnect(w.ctx, w.operatorId)).state).toBe("disconnected");
    expect(fake.calls).toHaveLength(before);
    expect((await connect(w)).outcome).toBe("connected");
    expect(tiktokStatus(w.ctx)).toMatchObject({ state: "connected", disconnectedAtMs: null, lastRevocation: null });

    w.clock.t += 366 * DAY;
    expect(tiktokStatus(w.ctx).state).toBe("expired");
    fake.calls.length = 0;
    expect(await disconnect(w.ctx, w.operatorId)).toMatchObject({ state: "disconnected", lastRevocation: null });
    expect(fake.calls).toHaveLength(0);
  });

  test("an expired access token is renewed first, so the revocation TikTok is asked for targets a valid token", async () => {
    const w = await world();
    await connect(w);
    w.clock.t += 25 * HOUR;
    fake.calls.length = 0;
    expect(await disconnect(w.ctx, w.operatorId)).toMatchObject({ state: "disconnected", lastRevocation: "confirmed" });
    expect(refreshCalls(fake)).toHaveLength(1);
    const revoke = fake.calls.find((c) => c.url.includes("/oauth/revoke/"))!;
    expect(revoke.form!.get("token")).toBe("act.fixture.2");
    expect(fake.calls.findIndex((c) => c.url.includes("/oauth/revoke/"))).toBeGreaterThan(fake.calls.findIndex((c) => c.url.includes("/oauth/token/")));
  });

  test("if TikTok already refuses the grant, there is nothing to revoke: no revoke call, 'unconfirmed', credentials erased", async () => {
    const w = await world();
    await connect(w);
    w.clock.t += 25 * HOUR;
    fake.validRefresh = "revoked-elsewhere";
    fake.calls.length = 0;
    expect(await disconnect(w.ctx, w.operatorId)).toMatchObject({ state: "disconnected", lastRevocation: "unconfirmed" });
    expect(fake.calls.some((c) => c.url.includes("/oauth/revoke/"))).toBe(false);
    expect(rawRow(w)).toMatchObject({ status: "disconnected", access_token_enc: null, refresh_token_enc: null, open_id: null });
  });

  test("viewers cannot disconnect; an operator can; a refused attempt leaves the connection untouched", async () => {
    const w = await world();
    await connect(w);
    const viewer = await signIn("viewer");
    expect((await disconnectRoute(call("/api/v3/integrations/tiktok/disconnect", viewer, "POST"))).status).toBe(403);
    expect(tiktokStatus(w.ctx).state).toBe("connected");
    const operator = await signIn("operator");
    const res = await disconnectRoute(call("/api/v3/integrations/tiktok/disconnect", operator, "POST"));
    expect(res.status).toBe(200);
    expect((await res.json()).state).toBe("disconnected");
  });
});

// ---- secrets, encryption, isolation --------------------------------------------------------------------------------
describe("secrets, encryption and isolation", () => {
  test("no secret, token, code, state or binding reaches logs, responses or the workspace export", async () => {
    const w = await world();
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => { lines.push(args.join(" ")); });
    const bodies: string[] = [];
    const operator = await signIn("operator");
    const start = await connectRoute(call("/api/v3/integrations/tiktok/connect", operator, "POST"));
    const startBody = await start.text();
    const state = stateOf(JSON.parse(startBody).authorizeUrl);
    const binding = bindingOf(start);
    const cb = await callbackRoute(new Request(url(`${CALLBACK_PATH}?code=good-code&state=${state}`), { headers: { Cookie: `${BINDING_COOKIE}=${binding}` } }));
    bodies.push(cb.headers.get("Location")!);
    for (const [route, method] of [[statusRoute, "GET"], [refreshRoute, "POST"], [disconnectRoute, "POST"]] as const) {
      bodies.push(await (await route(call("/api/v3/integrations/tiktok", operator, method))).text());
    }
    // Failure paths log too: a refused exchange whose provider text echoes the code.
    fake.onToken = () => reply(400, { error: "invalid_grant", error_description: "echoes good-code", log_id: "l" });
    await connect(w, { code: "leaky-code" });
    bodies.push(JSON.stringify(exportWorkspace(w.db)));
    const haystack = [...lines, ...bodies].join("\n");
    expect(lines.length).toBeGreaterThan(0);
    for (const secret of [CLIENT_SECRET, ENC_KEY, "act.fixture", "rft.fixture", "good-code", "leaky-code", binding, state, "provider-credentials"]) expect(haystack).not.toContain(secret);
  });

  test("tokens are AES-256-GCM sealed, bound to workspace and column, and a wrong key fails closed as 'unavailable'", async () => {
    const w = await world();
    await connect(w);
    const row = rawRow(w)!;
    expect(String(row.access_token_enc)).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(readFileSync(w.sidecar).includes("act.fixture")).toBe(false);
    expect(statSync(w.sidecar).mode & 0o777).toBe(0o600);
    const key = Buffer.from(ENC_KEY, "base64");
    expect(decryptField(key, w.cfg.workspaceId, "access_token", String(row.access_token_enc))).toBe("act.fixture.1");
    expect(() => decryptField(key, randomUUID(), "access_token", String(row.access_token_enc))).toThrow("credential_unreadable");
    expect(() => decryptField(key, w.cfg.workspaceId, "refresh_token", String(row.access_token_enc))).toThrow("credential_unreadable");
    expect(() => decryptField(randomBytes(32), w.cfg.workspaceId, "access_token", String(row.access_token_enc))).toThrow("credential_unreadable");
    const parts = encryptField(key, "w", "f", "secret").split(".");
    parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
    expect(() => decryptField(key, "w", "f", parts.join("."))).toThrow("credential_unreadable");
    expect(encryptField(key, "w", "f", "secret")).not.toBe(encryptField(key, "w", "f", "secret"));

    vi.stubEnv(ENV.encryptionKey, randomBytes(32).toString("base64"));
    fake.calls.length = 0;
    const view = await refreshConnection(w.ctx);
    expect(view.state).toBe("unavailable");
    expect(view.connection!.unavailableReason).toBe("credential_unreadable");
    expect(fake.calls).toHaveLength(0);
  });

  test("workspaces are isolated: separate stores, a foreign store is refused, and a foreign pending state is useless", async () => {
    const a = await world();
    await connect(a);
    const b = await world();
    expect(a.sidecar).not.toBe(b.sidecar);
    expect(tiktokStatus(b.ctx).state).toBe("ready");
    // Pointing workspace B at workspace A's credential file must fail closed, not reveal A's account.
    expect(() => openProviderStore(a.sidecar, b.cfg.workspaceId, Buffer.alloc(32), true)).toThrow("another workspace");
    vi.stubEnv(ENV.providerDbPath, a.sidecar);
    expect(() => tiktokStatus(b.ctx)).toThrow(AuthorityError);
    vi.stubEnv(ENV.providerDbPath, undefined);
    // A flow started in A cannot complete in B, even once B has a store of its own.
    const started = beginConnect(a.ctx, a.operatorId);
    beginConnect(b.ctx, b.operatorId);
    expect(await completeCallback(b.ctx, callbackUrl({ code: "good-code", state: stateOf(started.authorizeUrl) }), started.binding)).toBe("state_invalid");
    expect(tiktokStatus(a.ctx).state).toBe("connected");
    expect(tiktokStatus(b.ctx).state).toBe("ready");
  });

  test("the provider store has an explicit v1 migration and refuses unknown files and versions", async () => {
    const w = await world();
    await connect(w);
    const raw = new DatabaseSync(w.sidecar, { readOnly: true });
    expect(Number(raw.prepare("PRAGMA user_version").get()!.user_version)).toBe(1);
    expect(raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name)).toEqual(["oauth_pending", "provider_connections", "provider_meta"]);
    raw.close();
    const writable = new DatabaseSync(w.sidecar);
    writable.exec("PRAGMA user_version = 2");
    writable.close();
    expect(() => tiktokStatus(w.ctx)).toThrow(AuthorityError);
    const stranger = join(folders[0], "stranger.sqlite");
    const s = new DatabaseSync(stranger); s.exec("CREATE TABLE t (x)"); s.close();
    expect(() => openProviderStore(stranger, w.cfg.workspaceId, Buffer.alloc(32), true)).toThrow("Unrecognised");
  });

  test("the authority database is untouched: schema version, tables and exports carry no provider data", async () => {
    const w = await world();
    const tablesBefore = w.db.prepare("SELECT name FROM sqlite_master ORDER BY name").all().map((r) => r.name);
    await connect(w);
    expect(Number(w.db.prepare("PRAGMA user_version").get()!.user_version)).toBe(2);
    expect(w.db.prepare("SELECT name FROM sqlite_master ORDER BY name").all().map((r) => r.name)).toEqual(tablesBefore);
    expect(JSON.stringify(exportWorkspace(w.db))).not.toMatch(/tiktok|open-id-fixture|act\.fixture/i);
  });

  test("deleting a workspace also erases its provider credentials", async () => {
    const w = await world();
    await connect(w);
    w.db.close();
    expect(existsSync(w.sidecar)).toBe(true);
    deleteWorkspace(w.cfg, w.cfg.workspaceId, false);
    expect(existsSync(w.sidecar)).toBe(false);
  });
});

// ---- abuse limits (keep last: the limiter is module state shared by every callback test above) ---------------------
describe("callback abuse limits", () => {
  test("repeated failed callbacks are throttled, yet only failures count and a refused one still lands on a page", async () => {
    const w = await world();
    const s = await signIn("operator");
    const bad = () => callbackRoute(new Request(url(`${CALLBACK_PATH}?code=x&state=${"B".repeat(43)}`)));
    for (let i = 0; i < 32; i++) expect((await bad()).headers.get("Location")).toMatch(/tiktok=(state_invalid|provider_unavailable)$/);
    // The quota is now spent: even a perfectly valid callback is refused (and TikTok is never called).
    const start = await connectRoute(call("/api/v3/integrations/tiktok/connect", s, "POST"));
    const state = stateOf((await start.json()).authorizeUrl);
    fake.calls.length = 0;
    const refused = await callbackRoute(new Request(url(`${CALLBACK_PATH}?code=good-code&state=${state}`), { headers: { Cookie: `${BINDING_COOKIE}=${bindingOf(start)}` } }));
    expect(refused.status).toBe(303);
    expect(refused.headers.get("Location")).toBe(`${ORIGIN}/integrations?tiktok=state_invalid`);
    expect(fake.calls).toHaveLength(0);
    expect(tiktokStatus(w.ctx).state).toBe("ready");
  });
});

// ---- non-interference ----------------------------------------------------------------------------------------------
describe("existing behaviour is unaffected", () => {
  test("manual CSV and TSV product import still works, and the Shop boundary refuses to pretend", async () => {
    const root = join(HERE, "../../../../..", "docs/competition/v3-demo");
    for (const file of ["sample-products.csv", "sample-products.tsv"]) {
      const rows = parseProductRows(readFileSync(join(root, file), "utf8"), []);
      expect(rows.length).toBeGreaterThan(0);
      expect(toProductSnapshots(rows, "2026-10-07T00:00:00.000Z").length).toBeGreaterThan(0);
    }
    expect(tiktokShopCatalog.availability()).toEqual({ state: "requires_partner_authorization" });
    expect(await tiktokShopCatalog.listProducts()).toEqual({ ok: false, reason: "not_connected" });
  });

  test("provider data cannot become show evidence: no TikTok module touches the domain, stores or session contracts", async () => {
    for (const name of ["config", "crypto", "provider", "service", "shop", "store", "http"]) {
      expect(readFileSync(join(HERE, `${name}.ts`), "utf8")).not.toMatch(/from "(@\/(lib\/domain|lib\/store|contracts(?!\/tiktok))|\.\.\/database)/);
    }
    const { EnvironmentIdentitySchema } = await import("@/contracts");
    expect(EnvironmentIdentitySchema.options).toEqual(["REAL", "SIMULATED"]);
  });
});
