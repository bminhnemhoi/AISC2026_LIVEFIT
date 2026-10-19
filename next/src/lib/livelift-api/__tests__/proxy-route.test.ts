// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/ll/[...path]/route";

/** The desk proxy `/api/ll/...`: writes only from the desk's own origin, as JSON; GET unchanged. */

const SID = "3f2b8c1e-1d2a-4c5b-9e8f-0a1b2c3d4e5f";
const SAME = { origin: "http://localhost:3130", host: "localhost:3130" };

let upstream: ReturnType<typeof vi.fn>;

beforeEach(() => {
  upstream = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", upstream);
  vi.stubEnv("LIVELIFT_API_TOKEN", "operator-secret");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function ctx(path: string): { params: Promise<{ path: string[] }> } {
  return { params: Promise.resolve({ path: path.split("/") }) };
}

function post(path: string, headers: Record<string, string>, body?: BodyInit): NextRequest {
  return new NextRequest(`http://localhost:3130/api/ll/${path}`, { method: "POST", headers, body });
}

async function detail(res: Response): Promise<string> {
  return ((await res.json()) as { detail: string }).detail;
}

describe("desk proxy route", () => {
  it("refuses a write from a foreign origin with 403 and never reaches the API", async () => {
    const res = await POST(post(`sessions/${SID}/end`, { origin: "https://evil.example", host: "localhost:3130" }), ctx(`sessions/${SID}/end`));
    expect(res.status).toBe(403);
    expect(await detail(res)).toContain("cùng nguồn");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses a write with no Origin header (403)", async () => {
    const res = await POST(post("demo/seed-vang", { host: "localhost:3130" }), ctx("demo/seed-vang"));
    expect(res.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses a same-origin body that is not JSON with 415", async () => {
    const res = await POST(
      post(`sessions/${SID}/actions/execute`, { ...SAME, "content-type": "text/plain;charset=UTF-8" }, JSON.stringify({ product_id: "p1" })),
      ctx(`sessions/${SID}/actions/execute`),
    );
    expect(res.status).toBe(415);
    expect(await detail(res)).toContain("JSON");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses a body with no Content-Type at all (415)", async () => {
    const res = await POST(post("sessions", SAME, new TextEncoder().encode("{}")), ctx("sessions"));
    expect(res.status).toBe(415);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards a same-origin JSON write with the server-side token", async () => {
    const body = JSON.stringify({ product_id: "p1" });
    const res = await POST(
      post(`sessions/${SID}/actions/execute`, { ...SAME, "content-type": "application/json; charset=utf-8" }, body),
      ctx(`sessions/${SID}/actions/execute`),
    );
    expect(res.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toMatch(new RegExp(`/sessions/${SID}/actions/execute$`));
    expect(init.method).toBe("POST");
    expect(init.body).toBe(body);
    expect(init.headers.Authorization).toBe("Bearer operator-secret");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("forwards a same-origin write with no body and no Content-Type (end, seed-vang)", async () => {
    const res = await POST(post(`sessions/${SID}/end`, SAME), ctx(`sessions/${SID}/end`));
    expect(res.status).toBe(200);
    const [, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it("accepts the browser's host from X-Forwarded-Host when a proxy sits in front", async () => {
    const res = await POST(
      post("demo/seed-vang", { origin: "https://abc.trycloudflare.com", host: "127.0.0.1:3130", "x-forwarded-host": "abc.trycloudflare.com" }),
      ctx("demo/seed-vang"),
    );
    expect(res.status).toBe(200);
  });

  it("keeps GET unchanged: no Origin needed", async () => {
    const res = await GET(new NextRequest(`http://localhost:3130/api/ll/sessions/${SID}/bao-cao`), ctx(`sessions/${SID}/bao-cao`));
    expect(res.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("no longer opens /report (404 before any upstream call)", async () => {
    const res = await GET(new NextRequest(`http://localhost:3130/api/ll/sessions/${SID}/report`), ctx(`sessions/${SID}/report`));
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers a POST to a path outside the allowlist with 404, not 403, even from a foreign origin", async () => {
    // The allowlist decides first: a path the desk never opens looks the same from every origin.
    const res = await POST(post(`sessions/${SID}/cancel`, { origin: "https://evil.example", host: "localhost:3130" }), ctx(`sessions/${SID}/cancel`));
    expect(res.status).toBe(404);
    expect(await detail(res)).toContain("không mở");
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses a write whose Origin is the literal "null" (sandboxed iframe, file://) with 403', async () => {
    const res = await POST(post(`sessions/${SID}/end`, { origin: "null", host: "localhost:3130" }), ctx(`sessions/${SID}/end`));
    expect(res.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses a localhost Origin when X-Forwarded-Host names another host (403): the forwarded host wins", async () => {
    const res = await POST(
      post(`sessions/${SID}/end`, { origin: "http://localhost:3130", host: "localhost:3130", "x-forwarded-host": "abc.trycloudflare.com" }),
      ctx(`sessions/${SID}/end`),
    );
    expect(res.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  type Blocked = { name: string; method: "GET" | "POST"; path: string; headers?: Record<string, string>; body?: BodyInit; status: number };
  const BLOCKED: Blocked[] = [
    { name: "foreign Origin", method: "POST", path: `sessions/${SID}/end`, headers: { origin: "https://evil.example", host: "localhost:3130" }, status: 403 },
    { name: "no Origin", method: "POST", path: "demo/seed-vang", headers: { host: "localhost:3130" }, status: 403 },
    { name: 'Origin "null"', method: "POST", path: "demo/seed-vang", headers: { origin: "null", host: "localhost:3130" }, status: 403 },
    { name: "non-http Origin", method: "POST", path: "demo/seed-vang", headers: { origin: "chrome-extension://abcdef", host: "localhost:3130" }, status: 403 },
    {
      name: "localhost Origin, other X-Forwarded-Host",
      method: "POST",
      path: "demo/seed-vang",
      headers: { origin: "http://localhost:3130", host: "localhost:3130", "x-forwarded-host": "abc.trycloudflare.com" },
      status: 403,
    },
    { name: "same Origin, other port", method: "POST", path: "demo/seed-vang", headers: { origin: "http://localhost:3000", host: "localhost:3130" }, status: 403 },
    { name: "POST outside allowlist, foreign Origin", method: "POST", path: `sessions/${SID}/cancel`, headers: { origin: "https://evil.example", host: "localhost:3130" }, status: 404 },
    { name: "POST outside allowlist, same Origin", method: "POST", path: `sessions/${SID}/cancel`, headers: SAME, status: 404 },
    { name: "path traversal", method: "POST", path: "sessions/../demo/seed", headers: SAME, status: 404 },
    { name: "GET /report", method: "GET", path: `sessions/${SID}/report`, status: 404 },
    { name: "text/plain body", method: "POST", path: "sessions", headers: { ...SAME, "content-type": "text/plain" }, body: "{}", status: 415 },
    { name: "body without Content-Type", method: "POST", path: "sessions", headers: SAME, body: new TextEncoder().encode("{}"), status: 415 },
  ];

  it.each(BLOCKED)("never calls the API when a request is blocked: $name → $status", async ({ method, path, headers, body, status }) => {
    const req = new NextRequest(`http://localhost:3130/api/ll/${path}`, { method, headers: headers ?? {}, body });
    const res = await (method === "GET" ? GET : POST)(req, ctx(path));
    expect(res.status).toBe(status);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("never echoes the operator token to the browser", async () => {
    const res = await POST(post(`sessions/${SID}/end`, SAME), ctx(`sessions/${SID}/end`));
    const text = await res.text();
    expect(text).not.toContain("operator-secret");
    for (const [, v] of res.headers) expect(v).not.toContain("operator-secret");
  });
});
