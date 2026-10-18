import { formatClock, formatDuration } from "@/lib/domain";
import { formatCount } from "./format";
import type { LiveIntelligenceSnapshot, MetricKey, MinuteEvidenceBucket } from "./types";
import { boundaryStarts, bucketsInside, type RecordedWindow } from "./windows";

/**
 * Strategy observations: statements about what the provider's minutes show INSIDE a recorded segment window.
 *
 * They describe an association in time ("during this window"), never a cause. They use only provider minutes that
 * lie entirely inside the window (boundary minutes are excluded) and only when every such minute has a recorded
 * value, so each figure can be re-derived from the minute table. If that is not possible the observation is not
 * made; LiveLift says so instead of guessing.
 */

export interface Observation {
  id: string;
  text: string;
  /** Where the numbers come from, so the reader can check them against the minute table. */
  basis: string;
  segmentIds: string[];
}

export interface ObservationResult {
  observations: Observation[];
  /** Why there is nothing to say, when there is nothing. */
  reason: string | null;
}

interface Rate {
  perMin: number;
  minutes: number;
  fromMs: number;
  toMs: number;
  first: number;
  last: number;
}

function fullMinutes(buckets: MinuteEvidenceBucket[], window: RecordedWindow, boundary: Set<number>): MinuteEvidenceBucket[] {
  return bucketsInside(buckets, window).filter((b) => !boundary.has(b.startMs));
}

/** The mean per full minute of one metric inside a window, or null when it cannot be stated honestly. */
function rate(full: MinuteEvidenceBucket[], key: MetricKey, minMinutes: number): Rate | null {
  if (full.length < minMinutes) return null;
  const values: number[] = [];
  for (const b of full) {
    const v = b[key];
    if (typeof v !== "number") return null;
    values.push(v);
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return { perMin: sum / values.length, minutes: values.length, fromMs: full[0].startMs, toMs: full[full.length - 1].endMs, first: values[0], last: values[values.length - 1] };
}

const fmt = (n: number): string => (Number.isInteger(n) ? formatCount(n) : n.toFixed(1));

export const NO_OBSERVATION_REASON =
  "No observed pattern can be stated. It needs at least two full provider minutes with recorded values inside a segment window; boundary minutes are left out.";

export function deriveObservations(windows: RecordedWindow[], snapshot: LiveIntelligenceSnapshot, tz: string): ObservationResult {
  const buckets = snapshot.minuteBuckets;
  const serverAmbiguous = snapshot.segmentAttributions.flatMap((a) => a.ambiguousBuckets.map((b) => b.startMs));
  const boundary = boundaryStarts(buckets, windows, serverAmbiguous);
  const per = windows.map((w) => ({ w, full: fullMinutes(buckets, w, boundary) }));
  const clicks = per.map((p) => rate(p.full, "clicks", 2));

  const out: Array<Observation & { weight: number }> = [];
  const span = (r: Rate): string => `${formatClock(r.fromMs, tz)}–${formatClock(r.toMs, tz)}`;

  // 1. Clicks per minute higher in a window than in the segment before it.
  for (let i = 1; i < per.length; i += 1) {
    const cur = clicks[i];
    const prev = clicks[i - 1];
    if (!cur || !prev) continue;
    const higher = cur.perMin - prev.perMin >= 0.5 && cur.perMin >= prev.perMin * 1.25;
    if (!higher) continue;
    out.push({
      id: `clicks-${per[i].w.segmentId}`,
      weight: prev.perMin === 0 ? 1e6 : cur.perMin / prev.perMin,
      text: `Provider-observed product clicks per minute were higher during “${per[i].w.title}” (${fmt(cur.perMin)} per minute across ${cur.minutes} full minutes) than during the previous segment “${per[i - 1].w.title}” (${fmt(prev.perMin)} per minute across ${prev.minutes}).`,
      basis: `Provider minutes ${span(cur)} and ${span(prev)}, boundary minutes excluded.`,
      segmentIds: [per[i].w.segmentId, per[i - 1].w.segmentId],
    });
  }

  // 2. Viewers moved by at least 10% between the first and last full minute of a window.
  per.forEach((p, i) => {
    const v = rate(p.full, "viewers", 3);
    if (!v || v.first === 0) return;
    const change = (v.last - v.first) / v.first;
    if (Math.abs(change) < 0.1 || Math.abs(v.last - v.first) < 3) return;
    out.push({
      id: `viewers-${p.w.segmentId}-${i}`,
      weight: 1 + Math.abs(change),
      text: `Provider-observed viewers ${v.last > v.first ? "rose" : "fell"} from ${formatCount(v.first)} to ${formatCount(v.last)} between ${formatClock(v.fromMs, tz)} and ${formatClock(v.toMs, tz)}, during “${p.w.title}”.`,
      basis: `${v.minutes} full provider minutes ${span(v)}; viewers are a per-minute reading, not a sum.`,
      segmentIds: [p.w.segmentId],
    });
  });

  // 3. A segment overran while its click rate stayed at or above the previous segment's.
  for (let i = 1; i < per.length; i += 1) {
    const cur = clicks[i];
    const prev = clicks[i - 1];
    const w = per[i].w;
    if (!cur || !prev || !w.overran || w.varianceSec === null || cur.perMin < prev.perMin) continue;
    out.push({
      id: `overrun-${w.segmentId}`,
      weight: 1.5,
      text: `“${w.title}” overran its baseline by ${formatDuration(w.varianceSec)} while provider-observed clicks per minute during its window stayed at or above the previous segment’s (${fmt(cur.perMin)} vs ${fmt(prev.perMin)}).`,
      basis: `Overrun is from the operator’s recorded times; clicks are from ${cur.minutes} and ${prev.minutes} full provider minutes.`,
      segmentIds: [w.segmentId, per[i - 1].w.segmentId],
    });
  }

  const observations = out
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map(({ weight: _weight, ...o }) => o);
  return { observations, reason: observations.length === 0 ? NO_OBSERVATION_REASON : null };
}
