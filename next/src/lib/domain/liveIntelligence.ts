import type { Session } from "@/contracts";
import { METRIC_KEYS, MoneySchema, LiveIntelligenceSnapshotSchema, type ExactRatio, type LiveIntelligenceSnapshot, type MinuteEvidenceBucket, type Money, type ProductMapping, type ProductPerformance, type ProviderMetric, type SegmentAttribution } from "@/contracts/liveIntelligence";
import { baselinePlan, currentPlan } from "./forecast";

function decimal(amount: string): { coefficient: bigint; scale: number } {
  const [whole, fraction = ""] = amount.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
}

export function sumMoney(values: Money[]): Money | null {
  if (!values.length || values.some((v) => v.currency !== values[0].currency)) return null;
  const parts = values.map((v) => decimal(v.amount));
  const scale = Math.max(...parts.map((p) => p.scale));
  const total = parts.reduce((sum, p) => sum + p.coefficient * 10n ** BigInt(scale - p.scale), 0n);
  const digits = total.toString().padStart(scale + 1, "0");
  const result = MoneySchema.safeParse({ amount: scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits, currency: values[0].currency });
  return result.success ? result.data : null;
}

export function exactRatio(numerator: number | null | undefined, denominator: number | null | undefined): ExactRatio | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return { numerator: String(numerator), denominator: String(denominator) };
}

export interface ProviderEvidenceData {
  minuteBuckets: MinuteEvidenceBucket[];
  productPerformance: ProductPerformance[];
  providerWindow?: { startMs: number; endMs: number };
  evidenceLimits: string[];
}

const overlaps = (a: number, b: number, c: number, d: number): boolean => a < d && c < b;

/** Pure overlay. The authority session is only read; no provider value is ever written into it. */
export function reconcileLiveEvidence(session: Session, data: ProviderEvidenceData, opts: {
  snapshotId: string; providerSessionId: string; fetchedAt: number; productMappings: ProductMapping[];
}): LiveIntelligenceSnapshot {
  const plan = currentPlan(session);
  const baseline = baselinePlan(session);
  const source = session.environment === "SIMULATED" ? "fixture" : "tiktok_shop";
  const windows = plan.segments.map((s) => {
    const run = session.runtime.segments[s.id];
    return { segment: s, start: run?.startedAtMs ?? null, end: run?.endedAtMs ?? null };
  });
  const intersecting = new Map(data.minuteBuckets.map((b) => [b, windows.filter((w) => w.start !== null && overlaps(w.start, w.end ?? session.runtime.endedAtMs ?? w.start, b.startMs, b.endMs))]));
  const segmentAttributions: SegmentAttribution[] = windows.map(({ segment, start, end }) => {
    const limitations: string[] = [];
    const bounded = start !== null && end !== null && end > start;
    const touching = start === null ? [] : data.minuteBuckets.filter((b) => overlaps(start, end ?? session.runtime.endedAtMs ?? start, b.startMs, b.endMs));
    const ambiguousBuckets: SegmentAttribution["ambiguousBuckets"] = [];
    const contained: MinuteEvidenceBucket[] = [];
    for (const bucket of touching) {
      const competing = intersecting.get(bucket)!;
      const reason = bucket.timing === "unverified_bounds" || !bounded ? "unknown_timing"
        : competing.length > 1 ? (competing.some((w) => w.segment.id !== segment.id && overlaps(start!, end!, w.start!, w.end ?? end!)) ? "overlapping_actual_windows" : "segment_boundary")
        : bucket.startMs < start! || bucket.endMs > end! ? "segment_boundary" : null;
      if (reason) ambiguousBuckets.push({ startMs: bucket.startMs, endMs: bucket.endMs, reason });
      else contained.push(bucket);
    }
    let cursor = start;
    let contiguous = bounded;
    for (const b of contained) { if (b.startMs !== cursor) contiguous = false; cursor = b.endMs; }
    contiguous = contiguous && cursor === end;
    const coverage: SegmentAttribution["coverage"] = ambiguousBuckets.length ? "ambiguous" : start === null ? "none"
      : !bounded ? "partial" : !touching.length ? "none" : contiguous ? "complete" : "partial";
    if (!bounded) limitations.push(start === null ? "No actual window was recorded; planned timing is not actual timing." : "Actual timing is incomplete; no end was invented.");
    if (coverage !== "complete") limitations.push("Metrics cover only unambiguous, wholly contained provider buckets; they are not segment totals.");
    if (ambiguousBuckets.length) limitations.push("Minute buckets crossing a boundary or with unverified timing are retained, never split or allocated proportionally.");
    const metric = (key: string, value: ProviderMetric["value"], unit: string, note?: string, availability?: ProviderMetric["availability"]): ProviderMetric => ({
      key, value, unit, availability: availability ?? (value === null ? "missing" : "available"), source, evidenceTier: "provider_observed", observedAt: opts.fetchedAt,
      ...(start !== null ? { providerWindowStart: start } : {}), ...(end !== null ? { providerWindowEnd: end } : {}), ...(note ? { note } : {}),
    });
    const metrics: ProviderMetric[] = METRIC_KEYS.map((key) => {
      if (!contained.length) return metric(key === "viewers" ? "peak_minute_viewers" : key, null, key === "gmv" ? "money" : "count", "No unambiguous bucket evidence.", touching.length ? "unknown" : "missing");
      if (key === "viewers") {
        // Per-minute unique viewers are not additive across minutes.
        const values = contained.map((b) => b.viewers);
        return { ...metric("peak_minute_viewers", values.some((v) => v == null) ? null : Math.max(...values as number[]), "count", "Maximum minute viewers, not concurrency or total unique viewers."), calculation: "COMPUTED FROM PROVIDER-OBSERVED DATA" };
      }
      const values = contained.map((b) => b[key]);
      if (values.some((v) => v == null)) return metric(key, null, key === "gmv" ? "money" : "count", "At least one contained bucket is missing this metric; missing is not zero.");
      const value = key === "gmv" ? sumMoney(values as Money[]) : (values as number[]).reduce((a, b) => a + b, 0);
      if (typeof value === "number" && !Number.isSafeInteger(value)) return metric(key, null, "count", "Sum exceeds safe integer range.", "unknown");
      return metric(key, value, key === "gmv" ? "money" : "count", key === "gmv" && value === null ? "Different currencies or an out-of-range money sum cannot be combined." : key === "orders" ? "Provider SKU orders; observation, not causal attribution." : "Whole contained buckets only; observation, not causation.", value === null ? "unknown" : undefined);
    });
    for (const key of ["clicks", "orders", "impressions", "gmv"] as const) {
      const base = metrics.find((m) => m.key === key)!;
      let value: ExactRatio | null = null;
      if (coverage === "complete" && bounded && base.value !== null) {
        if (typeof base.value === "number") value = { numerator: (BigInt(base.value) * 60_000n).toString(), denominator: String(end! - start!) };
        else if ("amount" in base.value) {
          const p = decimal(base.value.amount);
          value = { numerator: (p.coefficient * 60_000n).toString(), denominator: (BigInt(end! - start!) * 10n ** BigInt(p.scale)).toString(), currency: base.value.currency };
        }
      }
      metrics.push({ ...metric(`${key}_per_minute`, value, key === "gmv" ? "money_per_minute" : "count_per_minute", "Requires complete temporal coverage and a nonzero actual duration.", value ? "available" : base.availability === "missing" ? "missing" : "unknown"), calculation: "COMPUTED FROM PROVIDER-OBSERVED DATA" });
    }
    const clicks = metrics.find((m) => m.key === "clicks")!;
    const impressions = metrics.find((m) => m.key === "impressions")!;
    const ctr = coverage === "complete" ? exactRatio(typeof clicks.value === "number" ? clicks.value : null, typeof impressions.value === "number" ? impressions.value : null) : null;
    metrics.push({ ...metric("click_through_ratio", ctr, "ratio", "Undefined for zero impressions; requires complete coverage.", ctr ? "available" : clicks.availability === "missing" || impressions.availability === "missing" ? "missing" : "unknown"), calculation: "COMPUTED FROM PROVIDER-OBSERVED DATA" });
    const target = baseline.segments.find((s) => s.id === segment.id)?.targetSec ?? null;
    return { segmentId: segment.id, title: segment.title, plannedDurationMs: target === null ? null : target * 1000,
      ...(start !== null ? { actualStartMs: start } : {}), ...(end !== null ? { actualEndMs: end } : {}), coverage, metrics, ambiguousBuckets, limitations };
  });
  const productPerformance = data.productPerformance.map((p): ProductPerformance => {
    const mapping = opts.productMappings.find((m) => m.providerProductId === p.productId);
    const occurrences = mapping ? windows.filter((w) => w.segment.productId === mapping.liveLiftProductId) : [];
    const single = occurrences.length === 1 && occurrences[0].start !== null && occurrences[0].end !== null;
    return { ...p, association: single ? "contextual" : occurrences.length ? "ambiguous" : "session_only",
      ...(single ? { segmentId: occurrences[0].segment.id } : {}), limitations: [...p.limitations,
        single ? "Explicit identity mapping occurs once: session-level context only, not proof of segment sales." : occurrences.length > 1 ? "Product repeats; session-level performance cannot be assigned to one occurrence." : "No unique timed occurrence with an explicit stable identity mapping; session-level only."] };
  });
  return LiveIntelligenceSnapshotSchema.parse({ ...opts, sessionId: session.id, sessionRevision: session.revision, mode: session.environment,
    perspective: "later_evidence", provider: source, providerWindow: data.providerWindow, minuteBuckets: data.minuteBuckets, segmentAttributions, productPerformance,
    evidenceLimits: [...data.evidenceLimits, "Provider observed is not platform confirmed. Observation is not causation.", "Later evidence never rewrites what the operator knew during LIVE.", ...(source === "fixture" ? ["SIMULATED / FIXTURE: synthetic demonstration, never real TikTok evidence."] : [])], reconciliationVersion: "livelift.attribution.v1" });
}
