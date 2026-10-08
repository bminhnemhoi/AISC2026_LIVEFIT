import { sumMoney } from "@/lib/domain/liveIntelligence";
import type { Money } from "@/contracts/liveIntelligence";
import type { Review } from "@/lib/domain";
import type { MetricKey, MinuteEvidenceBucket, TimeWindow } from "./types";

/**
 * Where provider minutes meet the recorded show. Everything here is geometry over two things LiveLift already
 * has: the segment windows the operator's commands recorded (the Review rows) and the provider's minute grid.
 * It decides nothing about which segment "owns" a minute: a minute that overlaps two segments stays unassigned.
 */

export interface RecordedWindow extends TimeWindow {
  segmentId: string;
  title: string;
  kind: string;
  productId: string | null;
  plannedSec: number | null;
  actualSec: number;
  varianceSec: number | null;
  overran: boolean;
  underran: boolean;
}

/** The segments that have a complete recorded interval, in the order they started. Skipped or incomplete ones have none. */
export function recordedWindows(review: Review): RecordedWindow[] {
  const out: RecordedWindow[] = [];
  for (const r of review.rows) {
    if (!r.actual) continue;
    out.push({
      segmentId: r.segmentId,
      title: r.title,
      kind: r.kind,
      productId: r.productId,
      startMs: r.actual.startMs,
      endMs: r.actual.endMs,
      plannedSec: r.baseline?.durSec ?? null,
      actualSec: r.actual.durSec,
      varianceSec: r.durationVarianceSec,
      overran: r.overran,
      underran: r.underran,
    });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

export const overlaps = (a: TimeWindow, b: TimeWindow): boolean => a.startMs < b.endMs && b.startMs < a.endMs;
export const isInside = (inner: TimeWindow, outer: TimeWindow): boolean => inner.startMs >= outer.startMs && inner.endMs <= outer.endMs;

/** Provider minutes lying entirely inside a window. Only these can be attributed to it without a judgement call. */
export const bucketsInside = (buckets: MinuteEvidenceBucket[], w: TimeWindow): MinuteEvidenceBucket[] => buckets.filter((b) => isInside(b, w));

/** Start times of provider minutes that overlap two or more recorded windows, plus any the server marked ambiguous. */
export function boundaryStarts(buckets: MinuteEvidenceBucket[], windows: TimeWindow[], serverMarked: Iterable<number> = []): Set<number> {
  const out = new Set<number>(serverMarked);
  for (const b of buckets) {
    if (b.timing === "unverified_bounds") out.add(b.startMs);
    let hits = 0;
    for (const w of windows) if (overlaps(b, w)) hits += 1;
    if (hits >= 2) out.add(b.startMs);
  }
  return out;
}

export interface SeriesStat {
  key: MetricKey;
  recorded: number;
  zero: number;
  missing: number;
  max: number | null;
  maxAtMs: number | null;
  /** Sum of the recorded minutes. null when none was recorded: a sum of nothing is not zero. */
  sum: number | Money | null;
  state: "values" | "all_zero" | "all_missing";
}

export function seriesStat(buckets: MinuteEvidenceBucket[], key: MetricKey): SeriesStat {
  let recorded = 0;
  let zero = 0;
  let sum = 0;
  let max: number | null = null;
  let maxAtMs: number | null = null;
  let maxExact = -1n;
  for (const b of buckets) {
    const raw = b[key];
    if (raw == null) continue;
    // ponytail: floating point is only bar geometry; monetary totals and cells stay exact.
    const v = typeof raw === "number" ? raw : Number(raw.amount);
    recorded += 1;
    if (v === 0) zero += 1;
    sum += v;
    // The shared wire permits at most six decimal places; compare exact fixed-point magnitudes.
    const [whole, fraction = ""] = typeof raw === "number" ? [String(raw)] : raw.amount.split(".");
    const exact = typeof raw === "number" ? BigInt(raw) : BigInt(whole + fraction.padEnd(6, "0"));
    if (exact > maxExact) {
      maxExact = exact;
      max = v;
      maxAtMs = b.startMs;
    }
  }
  const missing = buckets.length - recorded;
  return {
    key,
    recorded,
    zero,
    missing,
    max,
    maxAtMs,
    sum: recorded === 0 ? null : key === "gmv" ? sumMoney(buckets.flatMap(b => b.gmv ? [b.gmv] : [])) : Number.isSafeInteger(sum) ? sum : null,
    state: recorded === 0 ? "all_missing" : zero === recorded ? "all_zero" : "values",
  };
}

export const MINUTE_MS = 60_000;

/** Numeric geometry only. Mixed-currency series cannot share an axis. */
export function chartValue(buckets: MinuteEvidenceBucket[], bucket: MinuteEvidenceBucket, key: MetricKey): number | null {
  const raw = bucket[key];
  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  return new Set(buckets.flatMap(b => b.gmv ? [b.gmv.currency] : [])).size === 1 ? Number(raw.amount) : null;
}
