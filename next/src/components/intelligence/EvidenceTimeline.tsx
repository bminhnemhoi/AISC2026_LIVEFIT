"use client";

import React, { useId, useMemo, useState } from "react";
import { formatClock } from "@/lib/domain";
import { cell, formatCount, METRIC_LABEL, METRIC_SHORT } from "@/lib/intelligence/format";
import type { LiveIntelligenceSnapshot, MetricKey, MinuteEvidenceBucket } from "@/lib/intelligence/types";
import { MINUTE_MS, chartValue, boundaryStarts, isInside, seriesStat, type RecordedWindow, type SeriesStat } from "@/lib/intelligence/windows";
import { ValueText } from "./EvidenceParts";

/** The six metrics worth a chart. Likes and shares stay in the data, out of the way. */
export const CHART_METRICS: readonly MetricKey[] = ["clicks", "orders", "gmv", "viewers", "impressions", "comments"];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function tickStepMs(spanMs: number): number {
  const min = spanMs / MINUTE_MS;
  const step = min <= 20 ? 2 : min <= 45 ? 5 : min <= 120 ? 10 : 15;
  return step * MINUTE_MS;
}

type MetricState = SeriesStat["state"] | "unsupported";

function metricState(snapshot: LiveIntelligenceSnapshot, key: MetricKey, stat: SeriesStat): MetricState {
  const unsupported =
    (snapshot.segmentAttributions.length > 0 && snapshot.segmentAttributions.every((a) => a.metrics.some((m) => m.key === key && m.availability === "unsupported")));
  return unsupported && stat.state === "all_missing" ? "unsupported" : stat.state;
}

const STATE_NOTE: Record<Exclude<MetricState, "values">, string> = {
  all_missing: "not recorded",
  all_zero: "all 0",
  unsupported: "not offered",
};

/** What each provider minute is, relative to the recorded segments. */
function minuteWhere(b: MinuteEvidenceBucket, windows: RecordedWindow[], boundary: Set<number>): string {
  if (b.timing === "unverified_bounds") return "Timing bounds unverified; not assigned";
  if (boundary.has(b.startMs)) {
    const titles = windows.filter((w) => b.startMs < w.endMs && w.startMs < b.endMs).map((w) => w.title);
    return titles.length >= 2 ? `Boundary: ${titles.join(" | ")}` : "Boundary minute";
  }
  return windows.find((w) => isInside(b, w))?.title ?? "Outside the recorded segments";
}

export function EvidenceTimeline({
  snapshot,
  windows,
  startedAtMs,
  endedAtMs,
  tz,
}: {
  snapshot: LiveIntelligenceSnapshot;
  windows: RecordedWindow[];
  startedAtMs: number;
  endedAtMs: number;
  tz: string;
}): React.ReactElement {
  const uid = useId();
  const buckets = snapshot.minuteBuckets;
  const stats = useMemo(() => Object.fromEntries(CHART_METRICS.map((k) => [k, seriesStat(buckets, k)])) as Record<MetricKey, SeriesStat>, [buckets]);
  const states = useMemo(() => Object.fromEntries(CHART_METRICS.map((k) => [k, metricState(snapshot, k, stats[k])])) as Record<MetricKey, MetricState>, [snapshot, stats]);
  const [chosen, setChosen] = useState<MetricKey | null>(null);
  const metric: MetricKey = chosen ?? CHART_METRICS.find((k) => states[k] === "values") ?? "clicks";
  const mixedMoney = metric === "gmv" && new Set(buckets.flatMap(b => b.gmv ? [b.gmv.currency] : [])).size > 1;
  const stat = stats[metric];
  const state = mixedMoney ? "all_missing" : states[metric];

  const serverAmbiguous = useMemo(() => snapshot.segmentAttributions.flatMap((a) => a.ambiguousBuckets.map((b) => b.startMs)), [snapshot.segmentAttributions]);
  const boundary = useMemo(() => boundaryStarts(buckets, windows, serverAmbiguous), [buckets, windows, serverAmbiguous]);

  if (buckets.length === 0) {
    return (
      <section className="rounded-[12px] bg-[#13161C] p-4" aria-label="Provider minutes" data-testid="evidence-timeline" data-empty="true">
        <h3 className="text-[18px] font-medium text-[#F5F7FC]">Provider evidence on the recorded show</h3>
        <p className="mt-1 text-[15px] text-[#CAD0DA]">The provider returned no minute-by-minute evidence for this show. That is not the same as no activity.</p>
      </section>
    );
  }

  const t0 = Math.min(startedAtMs, buckets[0].startMs);
  const t1 = Math.max(endedAtMs, buckets[buckets.length - 1].endMs);
  const span = Math.max(1, t1 - t0);
  const pct = (ms: number): number => ((ms - t0) / span) * 100;
  const max = stat.max ?? 0;
  const step = tickStepMs(span);
  const ticks: number[] = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t);
  const cuts = [...new Set(windows.flatMap((w) => [w.startMs, w.endMs]))];

  const counts = { value: stat.recorded - stat.zero, zero: stat.zero, missing: stat.missing, boundary: buckets.filter((b) => boundary.has(b.startMs)).length };
  const parts = [
    `${buckets.length} provider minutes`,
    stat.recorded > 0 ? `${stat.recorded} recorded${stat.zero > 0 ? ` (${stat.zero} as 0)` : ""}` : null,
    counts.missing > 0 ? `${counts.missing} not recorded` : null,
    counts.boundary > 0 ? `${counts.boundary} boundary` : null,
  ].filter(Boolean);
  const peakText = cell(buckets.find(b => b.startMs === stat.maxAtMs)?.[metric], "available").text;
  const summary = `${METRIC_LABEL[metric]} per provider minute, ${formatClock(t0, tz)} to ${formatClock(t1, tz)}. ${parts.join(", ")}.${stat.max !== null && stat.maxAtMs !== null ? ` Peak ${peakText} at ${formatClock(stat.maxAtMs, tz)}.` : ""}`;
  const unit = metric === "gmv" ? (new Set(buckets.flatMap(b => b.gmv ? [b.gmv.currency] : [])).size === 1 ? ` (${buckets.find(b => b.gmv)?.gmv?.currency})` : " (different currencies; see exact table)") : "";

  return (
    <section className="rounded-[12px] bg-[#13161C] p-4" aria-labelledby={`${uid}-h`} data-testid="evidence-timeline" data-metric={metric}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h3 id={`${uid}-h`} className="text-[18px] font-medium text-[#F5F7FC]">
            Provider evidence on the recorded show
          </h3>
          <p className="mt-0.5 max-w-[640px] text-[14px] leading-snug text-[#9AA5B5]">One bar per provider minute, drawn against the segments the operator recorded. Every bar starts at zero.</p>
        </div>
        <fieldset className="min-w-0">
          <legend className="sr-only">Metric shown in the chart</legend>
          <div className="flex flex-wrap gap-1" data-testid="metric-picker">
            {CHART_METRICS.map((k) => {
              const s = states[k];
              return (
                <label key={k} className="cursor-pointer">
                  <input type="radio" name={`${uid}-metric`} value={k} checked={metric === k} onChange={() => setChosen(k)} className="peer sr-only" data-testid={`metric-${k}`} />
                  <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[8px] px-3 text-[15px] text-[#CAD0DA] hover:bg-[#1E232B] peer-checked:bg-[#17202B] peer-checked:text-[#F5F7FC] peer-checked:shadow-[inset_0_0_0_1px_#2C3A4C] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#DFFF00]">
                    {METRIC_SHORT[k]}
                    {s !== "values" && <span className="text-[13px] text-[#9AA5B5]">· {STATE_NOTE[s]}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <p className="mt-3 text-[15px] font-medium text-[#F5F7FC]" data-testid="evidence-summary-line">
        {METRIC_LABEL[metric]}
        {unit} per minute · <span className="font-normal text-[#CAD0DA]">{parts.join(" · ")}</span>
      </p>

      {state === "all_missing" || state === "unsupported" ? (
        <p className="mt-3 rounded-[8px] bg-[#101319] px-3 py-3 text-[15px] text-[#CAD0DA]" data-testid="metric-missing-note" data-state={state}>
          {state === "unsupported"
            ? `${METRIC_LABEL[metric]} is not offered by the provider for this show.`
            : mixedMoney ? "GMV uses different currencies and cannot share a chart axis. Exact amounts remain in the table." : `${METRIC_LABEL[metric]} was not recorded for any provider minute.`}{" "}
          <strong className="font-medium text-[#F5F7FC]">This is not zero.</strong> The minute table below shows every minute exactly as received.
        </p>
      ) : (
        <div role="img" aria-label={summary} className="mt-3 select-none" data-testid="evidence-chart">
          <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 pr-3">
            <span className="text-[13px] text-[#9AA5B5]">Recorded</span>
            <div className="relative h-8 rounded-[6px] bg-[#101319]">
              {windows.map((w) => (
                <div
                  key={w.segmentId}
                  className={`@container absolute bottom-0.5 top-0.5 flex items-center justify-center overflow-hidden rounded-[4px] px-1 text-[12px] ${w.overran ? "bg-[#3A2F18] text-[#F6C875]" : "bg-[#27312B] text-[#DFFF00]"}`}
                  style={{ left: `${pct(w.startMs)}%`, width: `${Math.max(0.6, pct(w.endMs) - pct(w.startMs))}%` }}
                  title={`${w.title} · ${formatClock(w.startMs, tz, true)}–${formatClock(w.endMs, tz, true)}`}
                >
                  {/* A label that cannot fit is left out (the title is on hover and in the table), never cut to a letter. */}
                  <span className="hidden truncate @min-[56px]:block">{w.title}</span>
                </div>
              ))}
            </div>

            <div className="relative h-[112px] text-right text-[12px] tabular-nums text-[#9AA5B5]" aria-hidden="true">
              <span className="absolute right-0 top-0 -translate-y-0.5">{metric === "gmv" ? compact.format(max) : formatCount(max)}</span>
              <span className="absolute bottom-0 right-0">0</span>
            </div>
            <div className="relative h-[112px] border-b border-[#39414D] border-t border-t-[#232935]">
              {cuts.map((ms) => (
                <div key={ms} className="absolute bottom-0 top-0 w-px bg-[#2A303A]" style={{ left: `${pct(ms)}%` }} aria-hidden="true" />
              ))}
              {buckets.map((b) => {
                const v = chartValue(buckets, b, metric);
                const isBoundary = boundary.has(b.startMs);
                const clock = formatClock(b.startMs, tz);
                const label = `${clock} · ${cell(b[metric], b[metric] == null ? "missing" : "available").spoken}${isBoundary ? " · boundary minute, not assigned to a segment" : ""}`;
                return (
                  <div key={b.startMs} className="absolute bottom-0 top-0" style={{ left: `${pct(b.startMs)}%`, width: `${(MINUTE_MS / span) * 100}%` }} title={label} data-minute={b.startMs} data-state={v === null ? "missing" : v === 0 ? "zero" : "value"} data-boundary={isBoundary ? "true" : undefined}>
                    {v === null ? (
                      <span className="absolute bottom-0 left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full border border-[#B4C6DD] bg-[#13161C]" />
                    ) : v === 0 ? (
                      <span className="absolute inset-x-px bottom-0 h-[2px] bg-[#B4C6DD]" />
                    ) : (
                      <span
                        className={`absolute inset-x-px bottom-0 rounded-t-[3px] ${isBoundary ? "border border-dashed border-[#B4C6DD] bg-transparent" : "bg-[#B4C6DD]"}`}
                        style={{ height: `max(3px, ${(v / max) * 100}%)` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <span />
            <div className="relative h-5 text-[12px] tabular-nums text-[#9AA5B5]" aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pct(t)}%` }}>
                  {formatClock(t, tz)}
                </span>
              ))}
            </div>
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#9AA5B5]" aria-label="Chart key">
            {counts.value > 0 && (
              <li className="inline-flex items-center gap-1.5">
                <span className="h-3 w-2 rounded-t-[2px] bg-[#B4C6DD]" aria-hidden="true" />
                Recorded value
              </li>
            )}
            {counts.zero > 0 && (
              <li className="inline-flex items-center gap-1.5">
                <span className="h-[2px] w-3 bg-[#B4C6DD]" aria-hidden="true" />
                Recorded as 0 ({counts.zero})
              </li>
            )}
            {counts.missing > 0 && (
              <li className="inline-flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-full border border-[#B4C6DD]" aria-hidden="true" />
                Not recorded ({counts.missing})
              </li>
            )}
            {counts.boundary > 0 && (
              <li className="inline-flex items-center gap-1.5" data-testid="key-boundary">
                <span className="h-3 w-2 rounded-t-[2px] border border-dashed border-[#B4C6DD]" aria-hidden="true" />
                {buckets.some(b => b.timing === "unverified_bounds") ? "Ambiguous minute: timing bounds unverified, not assigned" : "Boundary minute: overlaps a segment edge, not assigned"} ({counts.boundary})
              </li>
            )}
          </ul>
        </div>
      )}

      {stat.max !== null && stat.maxAtMs !== null && state === "values" && (
        <p className="mt-2 text-[14px] text-[#B7C1CE]">
          Peak <span className="tabular-nums text-[#F5F7FC]">{peakText}</span> at <span className="tabular-nums">{formatClock(stat.maxAtMs, tz)}</span>.
        </p>
      )}

      <details className="mt-3 group" data-testid="minute-table-details">
        <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-[8px] px-2 text-[15px] font-medium text-[#CAD0DA] hover:bg-[#1E232B] hover:text-white">
          <i className="ri-table-line" aria-hidden="true" />
          Minute-by-minute table ({buckets.length} minutes)
          <i className="ri-arrow-down-s-line transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-2 max-h-[360px] overflow-auto rounded-[8px] border border-[#2A303A] focus-visible:outline-2 focus-visible:outline-[#DFFF00]" tabIndex={0} role="region" aria-label="Minute-by-minute provider evidence">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">Provider minutes as received. Not recorded means the provider sent no value; 0 means it sent zero.</caption>
            <thead className="sticky top-0 bg-[#1B1F27] text-[13px] text-[#CAD0DA]">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Minute</th>
                {CHART_METRICS.map((k) => (
                  <th key={k} scope="col" className={`px-3 py-2 font-medium ${k === metric ? "" : "hidden md:table-cell"}`}>
                    {METRIC_SHORT[k]}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium">Segment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232935]">
              {buckets.map((b) => (
                <tr key={b.startMs} data-testid="minute-row" data-boundary={boundary.has(b.startMs) ? "true" : undefined}>
                  <th scope="row" className="whitespace-nowrap px-3 py-1.5 font-normal tabular-nums text-[#CAD0DA]">{formatClock(b.startMs, tz)}</th>
                  {CHART_METRICS.map((k) => (
                    <td key={k} className={`px-3 py-1.5 ${k === metric ? "" : "hidden md:table-cell"}`}>
                      <ValueText cell={cell(b[k], null, { metric: k,  })} />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-[#B7C1CE]">{minuteWhere(b, windows, boundary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
