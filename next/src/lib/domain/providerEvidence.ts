import { z } from "zod";
import { CountSchema, MoneySchema, ProductPerformanceSchema, type EvidenceSource, type MinuteEvidenceBucket, type ProductPerformance, type ProviderFailure, type ProviderMetric } from "@/contracts/liveIntelligence";
import { exactRatio } from "./liveIntelligence";

const OPTIONAL_COUNT = CountSchema.nullable().optional();
const OPTIONAL_MONEY = MoneySchema.nullable().optional();
const SecondsSchema = z.number().int().min(1_000_000_000).max(9_999_999_999);
const IntervalSchema = z.object({ start_time: SecondsSchema, end_time: SecondsSchema,
  sales: z.object({ gmv: OPTIONAL_MONEY, sku_orders: OPTIONAL_COUNT }).optional(),
  traffic: z.object({ viewers: OPTIONAL_COUNT, product_impressions: OPTIONAL_COUNT, product_clicks: OPTIONAL_COUNT }).optional(),
  interactions: z.object({ comments: OPTIONAL_COUNT, likes: OPTIONAL_COUNT, shares: OPTIONAL_COUNT }).optional(),
});
const MinuteDataSchema = z.object({ performance: z.object({
  overall: z.object({ start_time: SecondsSchema, end_time: SecondsSchema }).optional(),
  intervals: z.array(IntervalSchema).max(3000),
}), next_page_token: z.string().max(2048).nullable().optional() });
const ProductDataSchema = z.object({ products: z.array(z.object({
  id: z.string().regex(/^\d{1,30}$/),
  sales: z.object({ direct_gmv: OPTIONAL_MONEY, sku_orders: OPTIONAL_COUNT }).optional(),
  traffic: z.object({ product_impressions: OPTIONAL_COUNT, produt_clicks: OPTIONAL_COUNT }).optional(),
})).max(1000) });
const CoreDataSchema = z.object({ stats: z.object({ current_visitor_count: OPTIONAL_COUNT, peak_concurrent_user_count: OPTIONAL_COUNT }) });

export class IntelligenceProviderError extends Error {
  constructor(readonly failure: ProviderFailure) { super(failure.code); }
}
export function fail(code: ProviderFailure["code"], retryAfterSec?: number): never {
  const state = code === "auth_expired" ? "AUTH_EXPIRED" : code === "rate_limited" ? "RATE_LIMITED" : code === "access_not_granted" ? "ACCESS_NOT_GRANTED" : code === "not_configured" ? "NOT_CONFIGURED" : code === "unsupported" ? "UNSUPPORTED" : "UNAVAILABLE";
  throw new IntelligenceProviderError({ state, code, ...(retryAfterSec ? { retryAfterSec } : {}) });
}

export function parseMinutePage(raw: unknown, observedAt: number, source: EvidenceSource, timing: MinuteEvidenceBucket["timing"]): { buckets: MinuteEvidenceBucket[]; window?: { startMs: number; endMs: number }; nextPage?: string } {
  const parsed = MinuteDataSchema.safeParse(raw);
  if (!parsed.success) fail("malformed_response");
  const { performance, next_page_token } = parsed.data;
  const buckets = performance.intervals.map((i): MinuteEvidenceBucket => {
    if (i.end_time < i.start_time || i.end_time - i.start_time > 60) fail("malformed_response");
    // The official sample uses equal start/end. Preserve uncertainty with a conservative 60s envelope.
    const unverified = timing === "unverified_bounds" || i.start_time === i.end_time;
    return { startMs: i.start_time * 1000, endMs: (unverified ? Math.max(i.end_time, i.start_time + 60) : i.end_time) * 1000, reportedEndMs: i.end_time * 1000,
      viewers: i.traffic?.viewers ?? null, impressions: i.traffic?.product_impressions ?? null, clicks: i.traffic?.product_clicks ?? null,
      orders: i.sales?.sku_orders ?? null, gmv: i.sales?.gmv ?? null, comments: i.interactions?.comments ?? null,
      likes: i.interactions?.likes ?? null, shares: i.interactions?.shares ?? null, source, observedAt, evidenceTier: "provider_observed", timing: unverified ? "unverified_bounds" : "half_open" };
  });
  const overall = performance.overall;
  if (overall && overall.end_time < overall.start_time) fail("malformed_response");
  return { buckets, ...(overall ? { window: { startMs: overall.start_time * 1000, endMs: overall.end_time * 1000 } } : {}), ...(next_page_token ? { nextPage: next_page_token } : {}) };
}
export function parseProducts(raw: unknown, observedAt: number, source: EvidenceSource): ProductPerformance[] {
  const parsed = ProductDataSchema.safeParse(raw);
  if (!parsed.success) fail("malformed_response");
  const seen = new Set<string>();
  return parsed.data.products.map((p) => {
    if (seen.has(p.id)) fail("malformed_response");
    seen.add(p.id);
    const impressions = p.traffic?.product_impressions ?? null, clicks = p.traffic?.produt_clicks ?? null;
    const orders = p.sales?.sku_orders ?? null, gmv = p.sales?.direct_gmv ?? null;
    return ProductPerformanceSchema.parse({ productId: p.id, impressions, clicks, orders, gmv, ctor: exactRatio(orders, clicks),
      availability: [impressions, clicks, orders, gmv].every((v) => v === null) ? "missing" : "available", source, observedAt,
      evidenceTier: "provider_observed", association: "session_only", limitations: ["Session-level product performance; not per-segment sales.", "CTOR: COMPUTED FROM PROVIDER-OBSERVED DATA (SKU orders / product clicks); undefined for missing or zero clicks.", "Orders are provider SKU orders. GMV is direct_gmv as defined by the provider; it is not interchangeable with minute GMV.", ...(clicks === 0 ? ["CTOR undefined: zero clicks."] : [])] });
  });
}

export function parseCreatorStats(raw: unknown, observedAt: number, source: "tiktok_creator" | "fixture"): ProviderMetric[] {
  const parsed = CoreDataSchema.safeParse(raw);
  if (!parsed.success) fail("malformed_response");
  return (["current_visitor_count", "peak_concurrent_user_count"] as const).map((key) => {
    const value = parsed.data.stats[key] ?? null;
    return { key, value, unit: "count", availability: value === null ? "missing" : "available", source, evidenceTier: "provider_observed", observedAt,
      ...(source === "fixture" ? { note: "SIMULATED / FIXTURE" } : {}) };
  });
}
