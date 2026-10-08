// @vitest-environment node
import { expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { FIXTURE_CASES, LiveIntelligenceSnapshotSchema } from "@/contracts/liveIntelligence";
import { reconcileLiveEvidence, exactRatio, sumMoney } from "@/lib/domain/liveIntelligence";
import { reconstructAsKnownThen } from "@/lib/domain/asKnownThen";
import { applyCommand } from "@/lib/domain/engine";
import { fixtureEvidence, fixtureCreatorMetrics } from "./fixtures";
import { providerFixtureSession, FIXTURE_START } from "./fixtureSession";

const fetchedAt = FIXTURE_START + 500_000;
function snapshot(kind: typeof FIXTURE_CASES[number] = "normal") {
  const session = providerFixtureSession(kind);
  return { session, snapshot: reconcileLiveEvidence(session, fixtureEvidence(session, fetchedAt, kind), { snapshotId: randomUUID(), providerSessionId: "100000001", fetchedAt, productMappings: [{ liveLiftProductId: "local-product-a", providerProductId: "100001" }] }) };
}
test.each(FIXTURE_CASES)("certifies official-shape fixture %s", (kind) => {
  if (["malformed", "rate_limit", "auth_expired", "not_configured", "access_not_granted", "unavailable", "unsupported"].includes(kind)) { expect(() => snapshot(kind)).toThrow(); return; }
  const result = snapshot(kind);
  expect(result.snapshot.mode).toBe("SIMULATED"); expect(result.snapshot.provider).toBe("fixture");
  expect(result.snapshot.evidenceLimits.join(" ")).toContain("SIMULATED / FIXTURE");
  expect(result.snapshot.minuteBuckets.every((b) => b.evidenceTier === "provider_observed")).toBe(true);
  if (kind === "realtime_viewers") expect(fixtureCreatorMetrics(fetchedAt)[0]).toMatchObject({ value: 123, source: "fixture" });
});
test.each([["zero_clicks", "clicks", 0, "available"], ["missing_clicks", "clicks", null, "missing"], ["zero_gmv", "gmv", { amount: "0.00", currency: "VND" }, "available"], ["missing_gmv", "gmv", null, "missing"]] as const)("%s preserves missing != zero", (kind, key, value, availability) => {
  const m = snapshot(kind).snapshot.segmentAttributions[0].metrics.find((m) => m.key === key);
  expect(m).toMatchObject({ value, availability, evidenceTier: "provider_observed" });
});
test("actual windows drive attribution, baseline target remains planned and nothing mutates history", () => {
  const { session, snapshot: s } = snapshot(); const original = JSON.stringify(session);
  expect(s.segmentAttributions[0]).toMatchObject({ plannedDurationMs: 120_000, actualStartMs: FIXTURE_START, actualEndMs: FIXTURE_START + 60_000, coverage: "complete" });
  expect(s.segmentAttributions[2]).toMatchObject({ coverage: "none" }); expect(s.segmentAttributions[2].actualStartMs).toBeUndefined();
  reconcileLiveEvidence(session, fixtureEvidence(session, fetchedAt), { snapshotId: randomUUID(), providerSessionId: "1", fetchedAt, productMappings: [] });
  expect(JSON.stringify(session)).toBe(original);
});
test("boundary minute is ambiguous for both segments, never proportionally allocated", () => {
  const s = snapshot("boundary").snapshot;
  expect(s.segmentAttributions[0].coverage).toBe("ambiguous"); expect(s.segmentAttributions[1].coverage).toBe("ambiguous");
  expect(s.segmentAttributions[0].ambiguousBuckets).toHaveLength(1);
  expect(s.segmentAttributions[0].metrics.find((m) => m.key === "clicks")!.value).toBe(10);
  expect(s.segmentAttributions[1].metrics.find((m) => m.key === "clicks")!.value).toBeNull();
  expect(s.segmentAttributions[0].metrics.find((m) => m.key === "clicks_per_minute")!.value).toBeNull();
});
test("partial evidence and censored windows stay partial", () => {
  const session = providerFixtureSession(); const data = fixtureEvidence(session, fetchedAt);
  session.runtime.segments["sim-v7:s1"].endedAtMs = null;
  const s = reconcileLiveEvidence(session, data, { snapshotId: randomUUID(), providerSessionId: "1", fetchedAt, productMappings: [] });
  expect(s.segmentAttributions[0].actualEndMs).toBeUndefined(); expect(s.segmentAttributions[0].coverage).toBe("ambiguous");
  session.runtime.segments["sim-v7:s1"].endedAtMs = FIXTURE_START + 120_000; data.minuteBuckets = data.minuteBuckets.slice(0, 1);
  session.runtime.segments["sim-v7:s2"].startedAtMs = null; session.runtime.segments["sim-v7:s2"].endedAtMs = null;
  expect(reconcileLiveEvidence(session, data, { snapshotId: randomUUID(), providerSessionId: "1", fetchedAt, productMappings: [] }).segmentAttributions[0].coverage).toBe("partial");
});
test("repeated products are ambiguous; unknown identity remains session-level; unique mapping is context only", () => {
  expect(snapshot().snapshot.productPerformance[0]).toMatchObject({ association: "contextual", segmentId: "sim-v7:s1" });
  expect(snapshot("repeated_product").snapshot.productPerformance[0]).toMatchObject({ association: "ambiguous" });
  expect(snapshot("repeated_product").snapshot.productPerformance[0].segmentId).toBeUndefined();
  expect(snapshot("unknown_product").snapshot.productPerformance[0].association).toBe("session_only");
});
test("money is exact across decimals, large amounts, currency separation and per-minute rational", () => {
  expect(sumMoney([{ amount: "0.10", currency: "USD" }, { amount: "0.20", currency: "USD" }])).toEqual({ amount: "0.30", currency: "USD" });
  expect(sumMoney([{ amount: "9007199254740993.1", currency: "VND" }, { amount: "0.20", currency: "VND" }])!.amount).toBe("9007199254740993.30");
  expect(sumMoney([{ amount: "1", currency: "VND" }, { amount: "1", currency: "USD" }])).toBeNull();
  const s = snapshot().snapshot;
  expect(s.segmentAttributions[0].metrics.find((m) => m.key === "gmv_per_minute")).toMatchObject({ value: { numerator: "600000", denominator: "6000000", currency: "VND" }, calculation: "COMPUTED FROM PROVIDER-OBSERVED DATA" });
  expect(exactRatio(0, 5)).toEqual({ numerator: "0", denominator: "5" }); expect(exactRatio(5, 0)).toBeNull(); expect(exactRatio(5, null)).toBeNull();
});
test("different currencies in a segment are unknown, never summed", () => {
  const session = providerFixtureSession(); session.runtime.segments["sim-v7:s1"].endedAtMs = FIXTURE_START + 120_000;
  session.runtime.segments["sim-v7:s2"].startedAtMs = null; session.runtime.segments["sim-v7:s2"].endedAtMs = null;
  const data = fixtureEvidence(session, fetchedAt); data.minuteBuckets[1].gmv!.currency = "USD";
  const s = reconcileLiveEvidence(session, data, { snapshotId: randomUUID(), providerSessionId: "1", fetchedAt, productMappings: [] });
  expect(s.segmentAttributions[0].metrics.find((m) => m.key === "gmv")).toMatchObject({ value: null, availability: "unknown" });
});
test("viewer counts are not summed; raw text and platform confirmation are absent", () => {
  const s = snapshot("comment_count").snapshot;
  expect(s.segmentAttributions[0].metrics.find((m) => m.key === "comments")!.value).toBe(5);
  expect(JSON.stringify(s)).not.toContain("commentText");
  expect(s.segmentAttributions[0].metrics.find((m) => m.key === "peak_minute_viewers")!.value).toBe(30);
  expect(LiveIntelligenceSnapshotSchema.safeParse({ ...s, mode: "REAL" }).success).toBe(false);
  expect(LiveIntelligenceSnapshotSchema.safeParse({ ...s, minuteBuckets: s.minuteBuckets.map((b) => ({ ...b, source: "tiktok_shop" })) }).success).toBe(false);
});
test("as-known-then uses recorded time, preserves attempts and never includes future plans or late reports", () => {
  const session = providerFixtureSession();
  const before = reconstructAsKnownThen(session, FIXTURE_START + 30_000);
  expect(before.runtime.segments["sim-v7:s1"].endedAtMs).toBeNull(); expect(before.runtime.segments["sim-v7:s2"].startedAtMs).toBeNull();
  expect(before.runtime.endedAtMs).toBeNull(); expect(before.events.some((e) => e.type === "session_ended")).toBe(false);
  const report = { ...session.events[0], id: "late", seq: 99, type: "cue_reported" as const, occurredAtMs: FIXTURE_START + 5_000, recordedAtMs: FIXTURE_START + 100_000,
    data: { cueId: "late-cue", report: "attempted", occurredAtMs: FIXTURE_START + 5_000 } };
  session.events.push(report);
  expect(reconstructAsKnownThen(session, FIXTURE_START + 30_000).runtime.cues["late-cue"]).toBeUndefined();
  expect(reconstructAsKnownThen(session, FIXTURE_START + 110_000).runtime.cues["late-cue"].state).toBe("attempted");
  const corrected = applyCommand(session, { type: "append_correction", targetEventId: session.events[0].id, text: "Later observation", nowMs: fetchedAt, key: "correction", actor: "Op" }).session;
  expect(reconstructAsKnownThen(corrected, FIXTURE_START + 30_000)).toEqual(before);
});
