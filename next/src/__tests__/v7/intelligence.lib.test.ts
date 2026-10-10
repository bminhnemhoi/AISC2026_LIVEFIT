import { wireSnapshot, wireBucket, wireProduct } from "./wireFixtures";
import { describe, expect, it } from "vitest";
import type { Session } from "@/contracts";
import { applyCommand, buildReview, createScenarioSession, lastRecordedMs, runScript, type Review } from "@/lib/domain";
import {
  FIXTURE_SCENARIOS,
  INTELLIGENCE_ROUTES,
  QUICK_CUES,
  buildLedger,
  buildProductRows,
  buildReplay,
  buildScenarioRaw,
  createLiveIntelligenceClient,
  deriveObservations,
  fixtureResultFor,
  interpretSnapshotResponse,
  matchProduct,
  parseQuickCue,
  parseSnapshot,
  quickCueNoteText,
  recordedWindows,
  seriesStat,
  type FixtureScenarioId,
  type LiveIntelligenceSnapshot,
} from "@/lib/intelligence";

const ended = (): Session => runScript(createScenarioSession("buffered"));
const reviewOf = (s: Session): Review => {
  const r = buildReview(s);
  if (!r) throw new Error("scenario session did not end");
  return r;
};

const res = (status: number, body: unknown, headers: Record<string, string> = {}) => ({ ok: true as const, status, body, text: "", headers: new Headers(headers) });

const base = wireSnapshot;

describe("missing != zero (parser)", () => {
  it("keeps a recorded 0 as 0 and an absent value as null, bucket by bucket", () => {
    const p = parseSnapshot(base({ minuteBuckets: [{ startMs: 0, endMs: 60_000, clicks: 0, orders: null, gmv: undefined, viewers: 12 }] }));
    if (!p.ok) throw new Error("should parse");
    const b = p.snapshot.minuteBuckets[0];
    expect(b.clicks).toBe(0);
    expect(b.orders).toBeNull();
    expect(b.gmv).toBeUndefined();
    expect(b.viewers).toBe(12);
    expect(b.comments).toBeUndefined();
  });

  it("rejects contradictions between value and availability instead of repairing provider evidence", () => {
    for (const metric of [
      { key: "clicks", value: 7, availability: "missing" },
      { key: "orders", availability: "available" },
      { key: "gmv", value: 5, availability: "unsupported" },
    ]) expect(parseSnapshot(base({ segmentAttributions: [{ segmentId: "a", coverage: "partial", metrics: [metric] }] }))).toEqual({ ok: false, reason: "malformed" });
    const p = parseSnapshot(base({ segmentAttributions: [{ segmentId: "a", coverage: "partial", metrics: [{ key: "comments", value: 0, availability: "available" }] }] }));
    expect(p.ok && p.snapshot.segmentAttributions[0].metrics[0]).toMatchObject({ value: 0, availability: "available" });
  });

  it("rejects a snapshot that is not later evidence, or uses an availability word it does not know", () => {
    expect(parseSnapshot(base({ perspective: "live" }))).toEqual({ ok: false, reason: "wrong_perspective" });
    expect(parseSnapshot(base({ segmentAttributions: [{ segmentId: "a", coverage: "great", metrics: [] }] }))).toEqual({ ok: false, reason: "malformed" });
    expect(parseSnapshot(base({ segmentAttributions: [{ segmentId: "a", coverage: "none", metrics: [{ key: "gmv", availability: "maybe" }] }] }))).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects ISO timestamps, numeric strings and negative counts outside the canonical contract", () => {
    for (const over of [{ fetchedAt: "2026-10-07T10:00:00Z" }, { minuteBuckets: [{ startMs: 0, endMs: 60_000, clicks: "5" }] }, { minuteBuckets: [{ startMs: 0, endMs: 60_000, orders: -3 }] }]) expect(parseSnapshot(base(over))).toEqual({ ok: false, reason: "malformed" });
  });

  it("a sum of nothing is not zero", () => {
    const stat = seriesStat([wireBucket({ clicks: null })], "clicks");
    expect(stat.sum).toBeNull();
    expect(stat.state).toBe("all_missing");
    const zero = seriesStat([wireBucket({ clicks: 0 })], "clicks");
    expect(zero.sum).toBe(0);
    expect(zero.state).toBe("all_zero");
  });
});

describe("client adapter states", () => {
  const id = "s1";
  it("names every way the evidence can be absent", () => {
    expect(interpretSnapshotResponse(res(200, { state: "NOT_CONFIGURED" }), id)).toEqual({ kind: "not_configured" });
    expect(interpretSnapshotResponse(res(200, { state: "ACCESS_NOT_GRANTED" }), id)).toEqual({ kind: "access_not_granted" });
    expect(interpretSnapshotResponse(res(200, { state: "AUTH_EXPIRED" }), id)).toEqual({ kind: "auth_expired" });
    expect(interpretSnapshotResponse(res(200, { state: "UNSUPPORTED" }), id)).toEqual({ kind: "unsupported" });
    expect(interpretSnapshotResponse(res(200, { state: "RATE_LIMITED", retryAfterSec: 30 }), id)).toEqual({ kind: "rate_limited", retryAfterSec: 30 });
    expect(interpretSnapshotResponse(res(429, null, { "retry-after": "120" }), id)).toEqual({ kind: "rate_limited", retryAfterSec: 120 });
    expect(interpretSnapshotResponse(res(401, null), id)).toEqual({ kind: "signed_out" });
    expect(interpretSnapshotResponse(res(403, { error: { code: "forbidden" } }), id)).toEqual({ kind: "forbidden" });
    expect(interpretSnapshotResponse(res(501, null), id)).toMatchObject({ kind: "unavailable", reason: "server" });
    expect(interpretSnapshotResponse(res(404, undefined), id)).toMatchObject({ kind: "unavailable", reason: "not_found" }); // a server without the route
    expect(interpretSnapshotResponse(res(404, { error: { code: "not_found", message: "x" } }), id)).toMatchObject({ kind: "unavailable", reason: "not_found" });
    expect(interpretSnapshotResponse(res(503, { error: { code: "authority_unavailable" } }), id)).toMatchObject({ kind: "unavailable", reason: "server" });
    expect(interpretSnapshotResponse(res(200, { state: "UNAVAILABLE" }), id)).toMatchObject({ kind: "unavailable", reason: "server" });
    expect(interpretSnapshotResponse({ ok: false, kind: "timeout", message: "slow" }, id)).toEqual({ kind: "unavailable", reason: "timeout", message: "slow" });
  });

  it("accepts a real provider snapshot, in an envelope or bare", () => {
    for (const body of [{ state: "AVAILABLE", snapshot: base() }, { snapshot: base(), status: { state: "AVAILABLE" } }]) {
      const r = interpretSnapshotResponse(res(200, body), id);
      expect(r).toMatchObject({ kind: "available", origin: "provider" });
    }
  });

  it("refuses fixture or SIMULATED evidence for a REAL show, and evidence for a different show", () => {
    expect(interpretSnapshotResponse(res(200, { state: "AVAILABLE", snapshot: base({ provider: "fixture" }) }), id)).toMatchObject({ kind: "unavailable", reason: "rejected_fixture" });
    expect(interpretSnapshotResponse(res(200, { state: "AVAILABLE", snapshot: base({ fixture: true }) }), id)).toMatchObject({ kind: "unavailable", reason: "rejected_fixture" });
    expect(interpretSnapshotResponse(res(200, { state: "AVAILABLE", snapshot: base({ mode: "SIMULATED" }) }), id)).toMatchObject({ kind: "unavailable", reason: "rejected_fixture" });
    expect(interpretSnapshotResponse(res(200, { state: "AVAILABLE", snapshot: base({ sessionId: "other" }) }), id)).toMatchObject({ kind: "unavailable", reason: "session_mismatch" });
    expect(interpretSnapshotResponse(res(200, { state: "AVAILABLE", snapshot: base({ perspective: "live" }) }), id)).toMatchObject({ kind: "unavailable", reason: "wrong_perspective" });
  });

  it("sends the canonical routes, identity/revision, CSRF and workspace context", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const status = { provider: "tiktok_shop", state: "READY", mode: "real", configIssues: [], fixtureLabel: null, capabilities: [{ key: "product_clicks", support: "POST_LIVE", state: "ACCESS_REQUIRED", scope: "data.shop_analytics.public.read", note: "Seller access required." }] };
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(String(url).endsWith("/status") ? status : { state: "AVAILABLE", snapshot: base() }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const client = createLiveIntelligenceClient({ fetchImpl });
    const ctx = { workspaceId: "ws-1", generation: "g1" };
    expect((await client.getSnapshot(ctx, { roomId: "room-1", sessionId: "s 1", environment: "REAL" })).kind).toBe("unavailable");
    expect(calls[0].url).toBe(`${INTELLIGENCE_ROUTES.evidence}?roomId=room-1&sessionId=s+1&perspective=later_evidence`);
    expect(calls[0].init.method).toBe("GET");
    expect((calls[0].init.headers as Record<string, string>)["X-LiveLift-Request"]).toBe("1");
    expect((calls[0].init.headers as Record<string, string>)["X-LiveLift-Workspace"]).toBe("ws-1");
    expect((await client.requestRefresh(ctx, { commandId: "00000000-0000-4000-8000-000000000001", roomId: "room-1", sessionId: "s1", expectedSessionRevision: 7, providerSessionId: "123", productMappings: [], action: "post_live" }, "REAL")).kind).toBe("available");
    expect(calls[1].url).toBe(INTELLIGENCE_ROUTES.refresh);
    expect(calls[1].init.method).toBe("POST");
    expect(JSON.parse(String(calls[1].init.body))).toMatchObject({ expectedSessionRevision: 7, roomId: "room-1", providerSessionId: "123" });
    expect(await client.getCapabilities(ctx)).toEqual({ kind: "ok", capabilities: status.capabilities, status });
  });
});

describe("fixture provider evidence", () => {
  it("never exists for a REAL show, whatever the scenario", () => {
    const s = ended();
    const real = { ...s, environment: "REAL" as const };
    for (const sc of FIXTURE_SCENARIOS) expect(fixtureResultFor(real, reviewOf(s), sc.id)).toBeNull();
  });

  it("is deterministic and reads back through the same parser as real data", () => {
    const s = ended();
    const r = reviewOf(s);
    const a = fixtureResultFor(s, r, "rich");
    const b = fixtureResultFor(s, r, "rich");
    expect(a).toEqual(b);
    expect(a).toMatchObject({ kind: "available", origin: "fixture" });
    if (a?.kind !== "available") throw new Error("not available");
    expect(a.snapshot.provider).toBe("fixture");
    expect(a.snapshot.perspective).toBe("later_evidence");
    expect(a.snapshot.minuteBuckets.length).toBeGreaterThan(5);
    expect(a.snapshot.fetchedAt).toBeGreaterThan(r.summary.endedAtMs); // fetched afterwards, never during
  });

  const snap = (id: FixtureScenarioId): LiveIntelligenceSnapshot => {
    const s = ended();
    const r = fixtureResultFor(s, reviewOf(s), id);
    if (r?.kind !== "available") throw new Error(`${id} is not a snapshot scenario`);
    return r.snapshot;
  };
  const metric = (snapshot: LiveIntelligenceSnapshot, key: string) => snapshot.segmentAttributions.flatMap((a) => a.metrics.filter((m) => m.key === key));

  it("zero clicks is a recorded 0; missing clicks is not recorded; the two never look alike in the data", () => {
    const zero = snap("zero_clicks");
    expect(zero.minuteBuckets.every((b) => b.clicks === 0)).toBe(true);
    expect(metric(zero, "clicks").filter((m) => m.availability === "available").every((m) => m.value === 0)).toBe(true);
    expect(zero.productPerformance.every((p) => p.clicks === 0 && p.ctor === null)).toBe(true);
    const missing = snap("missing_clicks");
    expect(missing.minuteBuckets.every((b) => b.clicks === null)).toBe(true);
    expect(metric(missing, "clicks").every((m) => m.value === null && m.availability === "missing")).toBe(true);
    expect(missing.productPerformance.every((p) => p.clicks === null)).toBe(true);
  });

  it("zero GMV is a recorded 0 and missing GMV is not recorded (orders can still be recorded)", () => {
    const zero = snap("zero_gmv");
    expect(zero.minuteBuckets.every((b) => b.gmv?.amount === "0.00" && b.orders === 0)).toBe(true);
    const missing = snap("missing_gmv");
    expect(missing.minuteBuckets.every((b) => b.gmv === null)).toBe(true);
    expect(missing.minuteBuckets.some((b) => (b.orders ?? 0) > 0)).toBe(true);
    expect(missing.productPerformance.every((p) => p.gmv === null)).toBe(true);
  });

  it("comments can be unsupported, and raw chat text is always stated as unavailable", () => {
    const s = snap("unsupported_comments");
    expect(s.minuteBuckets.every((b) => b.comments === null)).toBe(true);
    expect(metric(s, "comments").every((m) => m.availability === "unsupported" && m.value === null)).toBe(true);
    expect(s.evidenceLimits.some((l) => /unsupported.*fixture/.test(l))).toBe(true);
    expect(snap("rich").evidenceLimits.some((l) => /raw live chat text/i.test(l))).toBe(true);
  });

  it("a minute that overlaps two segments is listed as ambiguous and is NOT counted for either", () => {
    const s = ended();
    const r = reviewOf(s);
    const rawSnapshot = buildScenarioRaw(s, r, "ambiguous");
    const parsed = parseSnapshot(rawSnapshot);
    if (!parsed.ok) throw new Error("should parse");
    const snapshot = parsed.snapshot;
    const withAmbiguity = snapshot.segmentAttributions.filter((a) => a.ambiguousBuckets.length > 0);
    expect(withAmbiguity.length).toBeGreaterThan(0);
    for (const a of withAmbiguity) {
      expect(a.coverage).toBe("ambiguous");
      const window = recordedWindows(r).find((w) => w.segmentId === a.segmentId)!;
      const inside = snapshot.minuteBuckets.filter((b) => b.startMs >= window.startMs && b.endMs <= window.endMs);
      const expected = inside.reduce((n, b) => n + (b.orders ?? 0), 0);
      const reported = a.metrics.find((m) => m.key === "orders")!;
      expect(reported.value).toBe(inside.length ? expected : null); // only full minutes: the boundary minute is not added
      for (const amb of a.ambiguousBuckets) {
        expect(inside.some((b) => b.startMs === amb.startMs)).toBe(false);
        expect(amb.reason).toBe("segment_boundary");
      }
    }
  });

  it("covers every scenario the brief asks for, and the five state-only ones are not snapshots", () => {
    const s = ended();
    const r = reviewOf(s);
    const kinds = Object.fromEntries(FIXTURE_SCENARIOS.map((sc) => [sc.id, fixtureResultFor(s, r, sc.id)?.kind]));
    expect(kinds).toMatchObject({ not_configured: "not_configured", access_not_granted: "access_not_granted", auth_expired: "auth_expired", rate_limited: "rate_limited", unavailable: "unavailable" });
    for (const id of ["rich", "ambiguous", "repeated_product", "zero_clicks", "missing_clicks", "zero_gmv", "missing_gmv", "unsupported_comments"] as const) expect(kinds[id]).toBe("available");
  });
});

describe("product matching never invents a match", () => {
  const product = (id: string, code: string, name: string) => ({ id, code, name, price: null, currency: "USD", priority: "normal" as const, status: "enabled" as const, talkingPoints: [], constraints: [], initials: "PR" });
  const row = wireProduct;

  it("matches only on an exact identifier, or an exact name when there is no identifier", () => {
    const ps = [product("p1", "A01", "Zip Hoodie"), product("p2", "A02", "Tee")];
    expect(matchProduct(row({ productId: "p1" }), ps, [{ liveLiftProductId: "p1", providerProductId: "p1" }])).toMatchObject({ kind: "matched", basis: "server" });
    expect(matchProduct(row({ productId: "a02" }), ps)).toEqual({ kind: "unmatched" });
    expect(matchProduct(row({ productLabel: " zip hoodie " }), ps)).toEqual({ kind: "unmatched" });
    expect(matchProduct(row({ productId: "tt-1", productLabel: "Zip Hoodie" }), ps)).toEqual({ kind: "unmatched" }); // a foreign id is never rescued by a similar name
    expect(matchProduct(row({ productLabel: "Zip Hoodies" }), ps)).toEqual({ kind: "unmatched" });
  });

  it("requires an explicit mapping even for a unique name, and rejects ambiguous mappings", () => {
    const ps = [product("p1", "A01", "Same"), product("p2", "A02", "Same")];
    expect(matchProduct(row({ productLabel: "same" }), ps)).toEqual({ kind: "unmatched" });
    expect(matchProduct(row({ productId: "123" }), ps, [{ liveLiftProductId: "p1", providerProductId: "123" }, { liveLiftProductId: "p2", providerProductId: "123" }])).toMatchObject({ kind: "ambiguous", basis: "server" });
    expect(matchProduct(row({ productId: "123" }), ps, [{ liveLiftProductId: "p2", providerProductId: "123" }])).toMatchObject({ kind: "matched", basis: "server" });
  });

  it("flags a product that ran in several segments as session-level, and two provider rows for one product as siblings", () => {
    const ps = [product("p1", "A01", "Zip Hoodie")];
    const review = {
      rows: [
        { productId: "p1", title: "Hoodie pitch", actual: { startMs: 0, endMs: 1, durSec: 1 }, outcome: "completed" },
        { productId: "p1", title: "Hoodie recap", actual: { startMs: 2, endMs: 3, durSec: 1 }, outcome: "completed" },
        { productId: "p1", title: "Hoodie skipped", actual: null, outcome: "skipped" },
      ],
    } as unknown as Review;
    const rows = buildProductRows([row({ productId: "p1", skuId: "A" }), row({ productId: "p1", skuId: "B" })], ps, review, [{ liveLiftProductId: "p1", providerProductId: "p1" }]);
    expect(rows[0].segmentTitles).toEqual(["Hoodie pitch", "Hoodie recap"]); // a skipped segment did not run
    expect(rows.every((r) => r.siblingRows === 2)).toBe(true);
  });
});

it("GMV peak selection and sums retain decimal differences beyond Number precision", () => {
  const buckets = [
    wireBucket({ gmv: { amount: "9007199254740992.1", currency: "VND" } }),
    wireBucket({ startMs: 60_000, endMs: 120_000, gmv: { amount: "9007199254740992.2", currency: "VND" } }),
  ];
  expect(Number(buckets[0].gmv!.amount)).toBe(Number(buckets[1].gmv!.amount));
  expect(seriesStat(buckets, "gmv")).toMatchObject({ maxAtMs: 60_000, sum: { amount: "18014398509481984.3", currency: "VND" } });
});

describe("observations are associations, never causes", () => {
  it("uses only association language across every scenario", () => {
    const s = ended();
    const r = reviewOf(s);
    const windows = recordedWindows(r);
    let seen = 0;
    for (const sc of FIXTURE_SCENARIOS) {
      const result = fixtureResultFor(s, r, sc.id);
      if (result?.kind !== "available") continue;
      const { observations, reason } = deriveObservations(windows, result.snapshot, s.timezone);
      for (const o of observations) {
        seen += 1;
        expect(`${o.text} ${o.basis}`).not.toMatch(/\b(caus\w*|because|led to|drove|driven|generated|resulted in|due to|thanks to|boosted|lifted)\b/i);
        expect(o.text).toMatch(/provider-observed|overran/i);
      }
      if (observations.length === 0) expect(reason).toMatch(/no observed pattern/i);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("leaves boundary minutes out and refuses to state a rate over a hole", () => {
    const w = (id: string, startMs: number, endMs: number) => ({ segmentId: id, title: id, kind: "product", productId: null, startMs, endMs, plannedSec: null, actualSec: (endMs - startMs) / 1000, varianceSec: null, overran: false, underran: false });
    const windows = [w("A", 0, 180_000), w("B", 180_000, 360_000)];
    const bucket = (i: number, clicks: number | null) => ({ startMs: i * 60_000, endMs: (i + 1) * 60_000, viewers: null, impressions: null, clicks, orders: null, gmv: null, comments: null, likes: null, shares: null });
    const snapshot = (clicks: Array<number | null>): LiveIntelligenceSnapshot => {
      const parsed = parseSnapshot(base({ minuteBuckets: clicks.map((c, i) => bucket(i, c)) }));
      if (!parsed.ok) throw new Error("bad fixture");
      return parsed.snapshot;
    };
    // A is 2 clicks/min, B is 10 clicks/min.
    const ok = deriveObservations(windows, snapshot([2, 2, 2, 10, 10, 10]), "UTC");
    expect(ok.observations[0].text).toContain("“B” (10 per minute across 3 full minutes)");
    expect(ok.observations[0].text).toContain("“A” (2 per minute across 3)");
    // A hole inside B means no rate can be stated for B.
    const hole = deriveObservations(windows, snapshot([2, 2, 2, 10, null, 10]), "UTC");
    expect(hole.observations).toHaveLength(0);
    expect(hole.reason).toMatch(/no observed pattern/i);
    // Marked as ambiguous by the server: a huge boundary minute inside A is not used.
    const withBoundary = parseSnapshot(
      base({
        minuteBuckets: [2, 2, 900, 10, 10, 10].map((c, i) => bucket(i, c)),
        segmentAttributions: [{ segmentId: "A", coverage: "ambiguous", metrics: [], ambiguousBuckets: [{ startMs: 120_000, endMs: 180_000, reason: "segment_boundary" }] }],
      })
    );
    if (!withBoundary.ok) throw new Error("bad fixture");
    const text = deriveObservations(windows, withBoundary.snapshot, "UTC").observations.map((o) => o.text).join(" ");
    expect(text).toContain("previous segment “A” (2 per minute across 2)"); // 2 full minutes; the 900-click boundary minute is excluded
    expect(text).not.toContain("900");
  });
});

describe("As known then: the replay never contains later knowledge", () => {
  const withQuickCue = (): Session => {
    let s = runScript(createScenarioSession("buffered"), 2);
    const cue = QUICK_CUES[0];
    const at = (lastRecordedMs(s) ?? 0) + 1000;
    const noted = applyCommand(s, { type: "add_note", text: quickCueNoteText(cue), nowMs: at });
    expect(noted.receipt.outcome).toBe("committed");
    s = runScript(noted.session);
    return s;
  };

  it("replays a quick cue as an operator report, and keeps notes appended after the LIVE out of the timeline", () => {
    const s = withQuickCue();
    const r = reviewOf(s);
    const afterEnd = applyCommand(s, { type: "add_note", text: "Reviewed the next morning", nowMs: r.summary.endedAtMs + 60_000 }).session;
    const replay = buildReplay(afterEnd, reviewOf(afterEnd));
    expect(replay.appendedAfterEnd).toBe(1);
    expect(replay.entries.some((e) => /next morning/.test(e.summary))).toBe(false);
    const cue = replay.entries.find((e) => e.quickCue !== null);
    expect(cue?.lane).toBe("operator");
    expect(cue?.summary).toBe("Operator reported: Price questions rising");
    expect(cue?.context).not.toBeNull();
    // The cut is the end of the LIVE.
    expect(Math.max(...replay.entries.map((e) => e.atMs))).toBeLessThanOrEqual(r.summary.endedAtMs);
  });

  it("round-trips every quick cue and ignores a look-alike note", () => {
    for (const cue of QUICK_CUES) expect(parseQuickCue(quickCueNoteText(cue))).toBe(cue);
    expect(parseQuickCue("Price questions rising")).toBeNull();
    expect(parseQuickCue("Something else (operator-reported quick cue)")).toBeNull();
  });
});

describe("capability ledger", () => {
  const row = (rows: ReturnType<typeof buildLedger>, key: string) => rows.find((r) => r.key === key)!;
  it("states unsupported things as fixed facts that no server answer can change", () => {
    const rows = buildLedger({ loginKit: "connected", server: [{ key: "raw_comment_text", state: "POST_LIVE", support: "POST_LIVE", scope: null, note: "" }, { key: "pin_unpin_control", state: "POST_LIVE", support: "POST_LIVE", scope: null, note: "" }] });
    expect(row(rows, "raw_chat")).toMatchObject({ state: "unsupported", fixed: true });
    expect(row(rows, "pin_control")).toMatchObject({ state: "unsupported", fixed: true });
    expect(row(rows, "login_kit").state).toBe("connected");
  });

  it("does not claim shop analytics are configured or missing before the server has been asked", () => {
    expect(row(buildLedger({ loginKit: null, server: null }), "shop_analytics").state).toBe("unknown");
    expect(row(buildLedger({ loginKit: null, server: "unreachable" }), "shop_analytics").state).toBe("unknown");
    expect(row(buildLedger({ loginKit: null, server: [] }), "shop_analytics").state).toBe("not_configured");
    expect(row(buildLedger({ loginKit: null, server: [{ key: "product_clicks", state: "ACCESS_REQUIRED", support: "POST_LIVE", scope: null, note: "" }] }), "shop_analytics").state).toBe("access_required");
    expect(row(buildLedger({ loginKit: null, server: null }), "creator_realtime").state).toBe("partner_access_required");
  });
});
