import type { LiveIntelligenceSnapshot, MinuteEvidenceBucket, ProductPerformance, SegmentAttribution } from "@/contracts/liveIntelligence";

/** Required wire metadata for small test examples. Values are never repaired or coerced. */
export function wireSnapshot(over: Record<string, unknown> = {}): Record<string, unknown> {
  const source = over.provider === "fixture" ? "fixture" : "tiktok_shop";
  return {
    snapshotId: "00000000-0000-4000-8000-000000000007", sessionId: "s1", sessionRevision: 1,
    mode: source === "fixture" ? "SIMULATED" : "REAL", perspective: "later_evidence", provider: source,
    providerSessionId: "123", fetchedAt: 1_000_000, reconciliationVersion: "livelift.attribution.v1", productMappings: [],
    minuteBuckets: [], segmentAttributions: [], productPerformance: [], evidenceLimits: [], ...over,
    ...(Array.isArray(over.minuteBuckets) ? { minuteBuckets: over.minuteBuckets.map(b => ({ source, evidenceTier: "provider_observed", observedAt: 1_000_000, timing: "half_open", ...b })) } : {}),
    ...(Array.isArray(over.segmentAttributions) ? { segmentAttributions: over.segmentAttributions.map(a => ({ title: a.segmentId, plannedDurationMs: null, limitations: [], ambiguousBuckets: [], ...a,
      metrics: (a.metrics ?? []).map((m: unknown) => ({ source, evidenceTier: "provider_observed", observedAt: 1_000_000, unit: "count", ...m as object })) })) } : {}),
    ...(Array.isArray(over.productPerformance) ? { productPerformance: over.productPerformance.map(p => ({ source, evidenceTier: "provider_observed", observedAt: 1_000_000, association: "session_only", limitations: [], ...p })) } : {}),
  };
}
export const wireBucket = (over: Partial<MinuteEvidenceBucket> = {}): MinuteEvidenceBucket => ({ startMs: 0, endMs: 60_000, source: "tiktok_shop", evidenceTier: "provider_observed", observedAt: 1_000_000, timing: "half_open", ...over });
export const wireProduct = (over: Partial<ProductPerformance> = {}): ProductPerformance => ({ availability: "available", source: "tiktok_shop", evidenceTier: "provider_observed", observedAt: 1_000_000, association: "session_only", limitations: [], ...over });
export const wireAttribution = (over: Partial<SegmentAttribution> = {}): SegmentAttribution => ({ segmentId: "a", title: "a", plannedDurationMs: null, coverage: "none", metrics: [], ambiguousBuckets: [], limitations: [], ...over });
export function providerSnapshot(fixture: unknown): LiveIntelligenceSnapshot {
  const s = structuredClone(fixture) as LiveIntelligenceSnapshot;
  s.mode = "REAL"; s.provider = "tiktok_shop";
  [...s.minuteBuckets, ...s.productPerformance, ...s.segmentAttributions.flatMap(a => a.metrics)].forEach(e => { e.source = "tiktok_shop"; });
  return s;
}
