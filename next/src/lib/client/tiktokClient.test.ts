// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTikTokClient, parseStatus, TIKTOK_AUTHORIZE_PREFIX } from "./tiktokClient";

const HERE = dirname(fileURLToPath(import.meta.url));
const ctx = { workspaceId: "11111111-1111-4111-8111-111111111111", generation: "22222222-2222-4222-8222-222222222222" };
const LIMITS = { live: "not_established", shop: "not_established", analytics: "not_established", nativeActions: "not_established" };
const view = (over: Record<string, unknown> = {}) => ({ provider: "tiktok", state: "ready", configIssues: [], requestedScopes: ["user.info.basic"], connection: null, disconnectedAtMs: null, lastRevocation: null, limits: LIMITS, ...over });
const answer = (status: number, body: unknown) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("TikTok client", () => {
  test("every request carries the CSRF marker and the workspace context; unsafe ones are JSON; cookies stay same-origin", async () => {
    const fetchImpl = answer(200, view());
    const client = createTikTokClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.getStatus(ctx);
    await client.refresh(ctx);
    const [get, post] = fetchImpl.mock.calls;
    expect(get[0]).toBe("/api/v3/integrations/tiktok");
    expect(get[1]).toMatchObject({ method: "GET", credentials: "same-origin", cache: "no-store" });
    expect(get[1]!.headers).toMatchObject({ "X-LiveLift-Request": "1", "X-LiveLift-Workspace": ctx.workspaceId, "X-LiveLift-Generation": ctx.generation });
    expect(post[0]).toBe("/api/v3/integrations/tiktok/refresh");
    expect(post[1]).toMatchObject({ method: "POST", body: "{}" });
    expect((post[1]!.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  test("a status that carries a credential field is stripped to the documented shape", () => {
    const parsed = parseStatus({ ...view({ state: "connected", connection: { openId: "o", grantedScopes: ["user.info.basic"], notGrantedScopes: [], connectedAtMs: 1, authorizationValidUntilMs: 2, profile: null, profileState: "unknown", profileFetchedAtMs: null, lastCheckedAtMs: null, unavailableReason: null, accessToken: "act.leak", refresh_token: "rft.leak" } }), access_token: "act.leak2" });
    expect(parsed).not.toBeNull();
    expect(JSON.stringify(parsed)).not.toMatch(/act\.leak|rft\.leak|token/i);
  });

  test("an unrecognised state, or a claim that LIVE/Shop is established, is not trusted", () => {
    expect(parseStatus(view({ state: "live_connected" }))).toBeNull();
    expect(parseStatus(view({ limits: { ...LIMITS, live: "established" } }))).toBeNull();
    expect(parseStatus(null)).toBeNull();
    expect(parseStatus({ provider: "shopee" })).toBeNull();
  });

  test("connect only ever returns TikTok's own authorization URL", async () => {
    const good = createTikTokClient({ fetchImpl: answer(200, { authorizeUrl: `${TIKTOK_AUTHORIZE_PREFIX}client_key=k&state=s` }) as unknown as typeof fetch });
    expect(await good.connect(ctx)).toEqual({ kind: "ok", value: { authorizeUrl: `${TIKTOK_AUTHORIZE_PREFIX}client_key=k&state=s` } });
    for (const authorizeUrl of ["https://evil.example.com/v2/auth/authorize/?x=1", "http://www.tiktok.com/v2/auth/authorize/?x=1", "javascript:alert(1)", "https://www.tiktok.com.evil.example/v2/auth/authorize/?x=1", 7]) {
      const bad = createTikTokClient({ fetchImpl: answer(200, { authorizeUrl }) as unknown as typeof fetch });
      expect((await bad.connect(ctx)).kind).toBe("unavailable");
    }
  });

  test.each([
    [401, { error: { code: "unauthenticated", message: "x" } }, "signed_out"],
    [403, { error: { code: "forbidden", message: "x" } }, "forbidden"],
    [409, { error: { code: "provider_not_configured", message: "x" } }, "not_configured"],
    [429, { error: { code: "rate_limited", message: "x" } }, "rate_limited"],
    [503, { error: { code: "storage_unavailable", message: "TikTok credential storage is unavailable." } }, "unavailable"],
  ] as const)("status %i maps to %s", async (status, body, kind) => {
    const client = createTikTokClient({ fetchImpl: answer(status, body) as unknown as typeof fetch });
    expect((await client.getStatus(ctx)).kind).toBe(kind);
  });

  test("a CSRF refusal is not mistaken for a role refusal; transport failure and junk bodies are 'unavailable'", async () => {
    expect((await createTikTokClient({ fetchImpl: answer(403, { error: { code: "csrf_failed", message: "m" } }) as unknown as typeof fetch }).refresh(ctx)).kind).toBe("unavailable");
    expect((await createTikTokClient({ fetchImpl: (async () => { throw new TypeError("x"); }) as unknown as typeof fetch }).getStatus(ctx)).kind).toBe("unavailable");
    expect((await createTikTokClient({ fetchImpl: answer(200, { hello: 1 }) as unknown as typeof fetch }).getStatus(ctx)).kind).toBe("unavailable");
  });
});

describe("no token reaches client code", () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === "__tests__" ? [] : files(p)) : /\.tsx?$/.test(n) ? [p] : []; });
  test("TikTok browser modules never touch web storage, tokens, secrets or provider endpoints", () => {
    const sources = [join(HERE, "tiktokClient.ts"), join(HERE, "../../contracts/tiktok.ts"), ...files(join(HERE, "../../components/integrations"))];
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const path of sources) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
      expect(text, path).not.toMatch(/access_token|refresh_token|accessToken|refreshToken|client_secret|clientSecret|LIVELIFT_TIKTOK|PROVIDER_ENCRYPTION/);
      expect(text, path).not.toMatch(/open\.tiktokapis\.com/);
    }
  });
});
