// @vitest-environment node
import { expect, test, vi } from "vitest";
import { signTikTokShopRequest } from "./signing";
import { TikTokShopProvider, parseMinutePage, parseProducts, SHOP_ORIGIN } from "./provider";
import { intelligenceStatus, loadIntelligenceConfig, ENV, type IntelligenceConfig } from "./config";
import { officialFixturePayloads } from "./fixtures";
import { FIXTURE_START } from "./fixtureSession";

const config: IntelligenceConfig = { mode: "real", dbPath: "/tmp/v7/evidence.sqlite", appKey: "fixture-app-key", appSecret: "fixture-app-secret", accessToken: "fixture-access-token", shopCipher: "fixture-shop-cipher", creatorToken: "fixture-creator-token", intervalPolicy: "unverified" };
const data = officialFixturePayloads(FIXTURE_START, FIXTURE_START + 120_000);
const reply = (data: unknown, status = 200, headers: Record<string, string> = {}): Response => Response.json(data, { status, headers });
const provider = (f: typeof fetch, timeout = 100) => new TikTokShopProvider(config, f, () => FIXTURE_START, timeout, 0);

test("official published signing vector and exact-body / multipart rules", () => {
  expect(signTikTokShopRequest("/authorization/202309/shops", { app_key: "29a39d", timestamp: "1623812664" }, "e59af819cc")).toBe("b596b73e0cc6de07ac26f036364178ab16b0a907af13d43f0a0cd2345f582dc8");
  const query = { timestamp: "1623812664", app_key: "29a39d", sign: "ignored", access_token: "excluded" };
  expect(signTikTokShopRequest("/authorization/202309/shops", query, "e59af819cc")).toBe("b596b73e0cc6de07ac26f036364178ab16b0a907af13d43f0a0cd2345f582dc8");
  expect(signTikTokShopRequest("/x", query, "example", Buffer.from('{"x": 1}'))).not.toBe(signTikTokShopRequest("/x", query, "example", Buffer.from('{"x":1}')));
  expect(signTikTokShopRequest("/x", query, "example", Buffer.from("body"), "multipart/form-data; boundary=a")).toBe(signTikTokShopRequest("/x", query, "example"));
});
test("fixed official origin, seller headers, no token URL, signed decoded query values", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ code: 0, data: data.minutes }));
  await provider(fetcher).getMinuteEvidence("123", FIXTURE_START);
  const [url, init] = fetcher.mock.calls[0]; const u = new URL(String(url));
  expect(u.origin).toBe(SHOP_ORIGIN); expect(u.pathname).toBe("/analytics/202510/shop_lives/123/performance_per_minutes");
  expect(u.searchParams.get("timestamp")).toBe(String(FIXTURE_START / 1000)); expect(u.searchParams.has("access_token")).toBe(false);
  expect(init).toMatchObject({ redirect: "error", headers: { "x-tts-access-token": config.accessToken } });
  expect(String(url)).not.toContain(config.accessToken);
  expect(u.searchParams.get("sign")).toBe(signTikTokShopRequest(u.pathname, Object.fromEntries(u.searchParams), config.appSecret!));
});
test("Creator data.stats shape, separate creator token, never shop cipher; unsupported is_live is discarded", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ code: 0, data: data.creator }));
  const metrics = await provider(fetcher).getCreatorSnapshot("123", FIXTURE_START);
  expect(metrics[0]).toMatchObject({ key: "current_visitor_count", value: 123, evidenceTier: "provider_observed" });
  expect(String(fetcher.mock.calls[0][0])).not.toContain("shop_cipher"); expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ "x-tts-access-token": config.creatorToken });
  await expect(provider(vi.fn<typeof fetch>().mockResolvedValue(reply({ code: 0, data: { current_visitor_count: 123, is_live: true } }))).getCreatorSnapshot("123", FIXTURE_START)).rejects.toMatchObject({ failure: { code: "malformed_response" } });
});
test.each([[429, 0, "rate_limited"], [401, 0, "auth_expired"], [403, 0, "access_not_granted"], [404, 0, "unsupported"], [200, 105002, "auth_expired"], [200, 105005, "access_not_granted"], [200, 66009315, "access_not_granted"], [200, 36009002, "rate_limited"], [200, 36009007, "timeout"], [503, 0, "upstream_unavailable"], [200, 36009004, "upstream_unavailable"]] as const)("normalizes status %s/code %s, discards upstream secrets", async (status, code, expected) => {
  await expect(provider(vi.fn<typeof fetch>().mockResolvedValue(reply({ code, message: config.appSecret, access_token: config.accessToken, data: null }, status, { "retry-after": "9" }))).getProductPerformance("123", FIXTURE_START)).rejects.toMatchObject({ failure: { code: expected } });
});
test("timeout bounds both upstream headers and a stalled response stream", async () => {
  await expect(provider(vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {})), 10).getProductPerformance("123", FIXTURE_START)).rejects.toMatchObject({ failure: { code: "timeout" } });
  const stream = new ReadableStream<Uint8Array>({ start() {} });
  await expect(provider(vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, { headers: { "content-type": "application/json" } })), 10).getProductPerformance("123", FIXTURE_START)).rejects.toMatchObject({ failure: { code: "timeout" } });
});
test.each([
  new Response("<html>secret</html>", { headers: { "content-type": "text/html" } }),
  new Response("{broken", { headers: { "content-type": "application/json" } }),
  reply({ code: "0", data: {} }), reply({ code: 0, data: { products: "evil" } }),
])( "malicious unexpected response is normalized without error-body leakage", async (response) => {
  await expect(provider(vi.fn<typeof fetch>().mockResolvedValue(response)).getProductPerformance("123", FIXTURE_START)).rejects.toMatchObject({ failure: { code: "malformed_response" } });
});
test("oversized header and chunked body are bounded", async () => {
  for (const response of [new Response("{}", { headers: { "content-type": "application/json", "content-length": "2097153" } }), new Response("x".repeat(2_097_153), { headers: { "content-type": "application/json" } })]) {
    await expect(provider(vi.fn<typeof fetch>().mockResolvedValue(response)).getProductPerformance("123", FIXTURE_START)).rejects.toMatchObject({ failure: { code: "response_too_large" } });
  }
});
test("real network redirect cannot leak credentials to a second origin", async () => {
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("redirect to https://evil.invalid/ with fixture-access-token"));
  try { await provider(fetcher).getProductPerformance("123", FIXTURE_START); } catch (error) { expect(JSON.stringify(error)).not.toContain(config.accessToken); }
  expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
});
test("timestamps are UTC seconds; unknown bounds retain reported end, never establish precise attribution", () => {
  const m = parseMinutePage(data.minutes, FIXTURE_START, "tiktok_shop", "unverified_bounds");
  expect(m.buckets[0]).toMatchObject({ startMs: FIXTURE_START, endMs: FIXTURE_START + 60_000, timing: "unverified_bounds", reportedEndMs: FIXTURE_START + 60_000 });
  const equal = { performance: { intervals: [{ start_time: FIXTURE_START / 1000, end_time: FIXTURE_START / 1000 }] } };
  expect(parseMinutePage(equal, FIXTURE_START, "tiktok_shop", "half_open").buckets[0]).toMatchObject({ timing: "unverified_bounds", endMs: FIXTURE_START + 60_000, reportedEndMs: FIXTURE_START });
});
test.each([Infinity, Number.MAX_SAFE_INTEGER, -1, "1791000000", 1.5])("rejects malformed/overflow timestamp %s", (value) => {
  expect(() => parseMinutePage({ performance: { intervals: [{ start_time: value, end_time: value }] } }, FIXTURE_START, "tiktok_shop", "unverified_bounds")).toThrow("malformed_response");
});
test.each(["NaN", "1e9", "-1.00", "Infinity", "1.1234567", "0xFF", 1.1])("rejects malformed GMV %s", (amount) => {
  expect(() => parseProducts({ products: [{ id: "1", sales: { direct_gmv: { amount, currency: "VND" } } }] }, FIXTURE_START, "tiktok_shop")).toThrow("malformed_response");
});
test("official product traffic typo is honored; alternative guessed field isn't treated as a click", () => {
  expect(parseProducts(data.products, FIXTURE_START, "tiktok_shop")[0].clicks).toBe(21);
  expect(parseProducts({ products: [{ id: "1", traffic: { product_clicks: 21 } }] }, FIXTURE_START, "tiktok_shop")[0].clicks).toBeNull();
});
test("pagination deduplicates identical buckets and rejects conflicting replay, overlaps and looping tokens", async () => {
  const page = { performance: { intervals: [{ start_time: FIXTURE_START / 1000, end_time: FIXTURE_START / 1000 + 60, traffic: { product_clicks: 0 } }] } };
  let n = 0;
  const f = vi.fn<typeof fetch>().mockImplementation(async () => reply({ code: 0, data: n++ === 0 ? { ...page, next_page_token: "next" } : page }));
  expect((await provider(f).getMinuteEvidence("123", FIXTURE_START)).minuteBuckets).toHaveLength(1);
  expect(String(f.mock.calls[1][0])).toContain("page_token=next");
  const looping = vi.fn<typeof fetch>().mockResolvedValue(reply({ code: 0, data: { ...page, next_page_token: "same" } }));
  await expect(provider(looping).getMinuteEvidence("123", FIXTURE_START)).rejects.toMatchObject({ failure: { code: "malformed_response" } });
  n = 0;
  const conflict = vi.fn<typeof fetch>().mockImplementation(async () => reply({ code: 0, data: n++ === 0 ? { ...page, next_page_token: "next" } : { performance: { intervals: [{ ...page.performance.intervals[0], traffic: { product_clicks: 99 } }] } } }));
  await expect(provider(conflict).getMinuteEvidence("123", FIXTURE_START)).rejects.toMatchObject({ failure: { code: "malformed_response" } });
});
test("configuration and capability matrix are truthful; Login Kit isn't Shop configuration", () => {
  const off = intelligenceStatus("/tmp/v7/authority.sqlite", { LIVELIFT_TIKTOK_CLIENT_KEY: "login-key" });
  expect(off.state).toBe("NOT_CONFIGURED");
  for (const key of ["raw_comment_text", "product_pin_state", "pin_unpin_control", "giveaway_control"]) expect(off.capabilities.find((c) => c.key === key)!.state).toBe("UNSUPPORTED");
  expect(off.capabilities.find((c) => c.key === "audience_concurrency")!.support).toBe("REALTIME");
  expect(loadIntelligenceConfig("/tmp/v7/authority.sqlite", { [ENV.dbPath]: "relative.sqlite" }).issues).toContain(ENV.dbPath);
  expect(loadIntelligenceConfig("/tmp/v7/authority.sqlite", { [ENV.dbPath]: "/tmp/v7/authority.sqlite" }).issues).toContain(ENV.dbPath);
  const incomplete = intelligenceStatus("/tmp/v7/authority.sqlite", { [ENV.mode]: "real" }); expect(incomplete.state).toBe("NOT_CONFIGURED"); expect(JSON.stringify(incomplete)).not.toContain("fixture-access-token");
  // Opaque official examples include a six-character app key: do not invent a minimum length.
  expect(loadIntelligenceConfig("/tmp/v7/authority.sqlite", { [ENV.mode]: "real", [ENV.appKey]: "29a39d", [ENV.appSecret]: "public-example", [ENV.accessToken]: "public-example", [ENV.shopCipher]: "123" }).issues).toEqual([]);
  expect(loadIntelligenceConfig("/tmp/v7/authority.sqlite", { [ENV.mode]: "", [ENV.dbPath]: "", [ENV.intervalPolicy]: "" }).issues).toEqual([]);
});
