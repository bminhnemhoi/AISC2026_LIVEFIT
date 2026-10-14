"use client";

import React, { useId, useState } from "react";
import type { Review, ReviewRow } from "@/lib/domain";
import { formatClock, formatDuration, formatSigned } from "@/lib/domain";
import { cell, METRIC_LABEL, METRIC_SHORT } from "@/lib/intelligence/format";
import type { AttributionCoverage, LiveIntelligenceSnapshot, MetricKey, ProviderMetric, SegmentAttribution } from "@/lib/intelligence/types";
import { ValueText } from "./EvidenceParts";

/**
 * How provider evidence lines up with the recorded show, one segment at a time.
 *
 * The recorded duration is the OPERATOR's record (known then). The provider columns are LATER evidence. A provider
 * minute that overlaps two segments is never given to either: it is listed as a boundary minute, on purpose.
 *
 * Layout: a phone stacks each segment; a tablet puts duration beside evidence; five columns only from `lg`.
 */

const COVERAGE: Record<AttributionCoverage, { text: string; icon: string }> = {
  complete: { text: "All minutes attributed", icon: "ri-check-line" },
  partial: { text: "Some minutes not recorded", icon: "ri-contrast-2-line" },
  ambiguous: { text: "Boundary minutes not assigned", icon: "ri-arrow-left-right-line" },
  none: { text: "No provider minutes", icon: "ri-subtract-line" },
};

const HEADLINE: readonly MetricKey[] = ["clicks", "orders", "gmv"];
const DETAIL_ORDER: readonly MetricKey[] = ["viewers", "impressions", "clicks", "orders", "gmv", "comments"];

function metricCell(m: ProviderMetric | undefined) {
  return cell(m?.value, m?.availability ?? "missing");
}
const findMetric = (a: SegmentAttribution | null, key: MetricKey): ProviderMetric | undefined => a?.metrics.find((m) => m.key === (key === "viewers" ? "peak_minute_viewers" : key));

function DurationCell({ row }: { row: ReviewRow }): React.ReactElement {
  if (!row.actual) {
    const text = row.outcome === "skipped" ? "Skipped" : row.outcome === "incomplete" ? "Incomplete record" : "Did not run";
    return (
      <>
        <p className="text-[#CAD0DA]">{text}</p>
        <p className="text-[14px] text-[#9AA5B5]">{row.baseline ? `${formatDuration(row.baseline.durSec)} planned` : "No planned duration"}</p>
      </>
    );
  }
  const v = row.durationVarianceSec;
  return (
    <>
      <p className="tabular-nums text-[#F5F7FC]">
        {formatDuration(row.actual.durSec)} <span className="text-[#9AA5B5]">actual</span>
      </p>
      <p className="text-[14px] tabular-nums text-[#9AA5B5]">
        {row.baseline ? `${formatDuration(row.baseline.durSec)} planned` : "Planned: not entered"}
        {v !== null && !row.overran && !row.underran && " · on plan"}
      </p>
      {v !== null && row.overran && (
        <p className="text-[14px] tabular-nums text-[#F6C875]">
          <i className="ri-arrow-up-line" aria-hidden="true" />
          {formatSigned(v)} overrun
        </p>
      )}
      {v !== null && row.underran && (
        <p className="text-[14px] tabular-nums text-[#5FD3C0]">
          <i className="ri-arrow-down-line" aria-hidden="true" />
          {formatSigned(v)} underrun
        </p>
      )}
    </>
  );
}

export function SegmentAttributionTable({ review, snapshot, tz }: { review: Review; snapshot: LiveIntelligenceSnapshot; tz: string }): React.ReactElement {
  const uid = useId();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const byId = new Map(snapshot.segmentAttributions.map((a) => [a.segmentId, a]));
  const toggle = (id: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const grid = "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1fr)_auto]";

  // How complete is the attribution, in one sentence, before any row is opened.
  const tally = (c: AttributionCoverage): number => snapshot.segmentAttributions.filter((a) => a.coverage === c).length;
  const summary = [
    tally("complete") > 0 ? `${tally("complete")} fully attributed` : null,
    tally("ambiguous") > 0 ? `${tally("ambiguous")} with boundary minutes not assigned` : null,
    tally("partial") > 0 ? `${tally("partial")} with minutes not recorded` : null,
    tally("none") > 0 ? `${tally("none")} with no provider minutes` : null,
  ].filter(Boolean);

  return (
    <section className="rounded-[12px] bg-[#13161C] p-3 sm:p-4" aria-labelledby={`${uid}-h`} data-testid="segment-attribution">
      <h3 id={`${uid}-h`} className="text-[18px] font-medium text-[#F5F7FC]">
        Segment attribution
      </h3>
      <p className="mt-0.5 max-w-[760px] text-[14px] leading-snug text-[#9AA5B5]">
        Durations are the operator&apos;s record. Provider columns are later evidence for the minutes that lie fully inside the recorded segment. A minute that overlaps two segments is not
        given to either.
      </p>
      {summary.length > 0 && (
        <p className="mt-2 text-[15px] text-[#CAD0DA]" data-testid="attribution-summary">
          {review.rows.length} segment{review.rows.length === 1 ? "" : "s"}: {summary.join(" · ")}.
        </p>
      )}

      <div role="table" aria-label="Segment attribution" className="mt-3 text-[15px]">
        <div role="row" className={`hidden gap-3 px-2 pb-1 text-[13px] text-[#9AA5B5] lg:grid ${grid}`}>
          <span role="columnheader">Segment</span>
          <span role="columnheader">Duration (recorded)</span>
          <span role="columnheader">Provider evidence in its window</span>
          <span role="columnheader">Attribution</span>
          <span role="columnheader" className="w-[116px]">
            <span className="sr-only">Details</span>
          </span>
        </div>
        <div className="divide-y divide-[#1F2530]">
          {review.rows.map((row) => {
            const a = byId.get(row.segmentId) ?? null;
            const isOpen = open.has(row.segmentId);
            const panelId = `${uid}-p-${row.segmentId}`;
            const ran = row.actual !== null;
            const ambiguousCount = a?.ambiguousBuckets.length ?? 0;
            const cov = a ? COVERAGE[a.coverage] : null;
            // A segment with no recorded window has nothing to line evidence up with: one quiet line, not a row of dashes.
            if (!ran && (row.outcome !== "incomplete" || !a)) {
              const what = row.outcome === "skipped" ? "Skipped" : row.outcome === "incomplete" ? "Incomplete record" : "Did not run";
              return (
                <div role="rowgroup" key={row.segmentId} data-testid={`attribution-${row.segmentId}`} data-coverage="unattributed">
                  <div role="row" className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-2 py-2.5">
                    <div role="cell" className="min-w-[160px] break-words text-[16px] font-medium leading-snug text-[#CAD0DA]">
                      {row.title}
                    </div>
                    <div role="cell" className="min-w-0 text-[14px] leading-snug text-[#9AA5B5]" data-testid="not-attributed">
                      {what}
                      {row.baseline ? ` · ${formatDuration(row.baseline.durSec)} planned` : ""}.{" "}
                      {row.outcome === "incomplete" ? "Its end was not recorded, so its window is unknown and nothing can be attributed." : "Nothing to attribute: it has no recorded window."}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div role="rowgroup" key={row.segmentId} data-testid={`attribution-${row.segmentId}`} data-coverage={a?.coverage ?? "unattributed"}>
                <div role="row" className={`grid grid-cols-1 gap-x-4 gap-y-1.5 px-2 py-3 sm:grid-cols-2 ${grid}`}>
                  <div role="cell" className="min-w-0 sm:col-span-2 lg:col-span-1">
                    <p className="break-words text-[16px] font-medium leading-snug text-[#F5F7FC]">{row.title}</p>
                  </div>
                  <div role="cell">
                    <DurationCell row={row} />
                  </div>
                  <div role="cell" className="min-w-0">
                    {!a ? (
                      <p className="text-[#9AA5B5]" data-testid="not-attributed">
                        Not attributed in the provider evidence.
                      </p>
                    ) : (
                      <dl className="flex flex-wrap gap-x-5 gap-y-1">
                        {HEADLINE.map((key) => {
                          const m = findMetric(a, key);
                          return (
                            <div key={key} className="flex items-baseline gap-1.5 whitespace-nowrap" data-metric={key}>
                              <dt className="text-[14px] text-[#9AA5B5]">{METRIC_SHORT[key]}</dt>
                              <dd>
                                <ValueText cell={metricCell(m)} />
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                  </div>
                  <div role="cell" className="text-[14px]">
                    {cov ? (
                      <p className={a?.coverage === "complete" ? "text-[#CAD0DA]" : "text-[#B4C6DD]"}>
                        <i className={`${cov.icon} mr-1`} aria-hidden="true" />
                        {cov.text}
                        {ambiguousCount > 0 && <span className="tabular-nums"> · {ambiguousCount}</span>}
                      </p>
                    ) : (
                      <p className="text-[#9AA5B5]">—</p>
                    )}
                  </div>
                  <div role="cell" className="sm:text-right lg:w-[116px]">
                    {a && (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggle(row.segmentId)}
                        data-testid={`attribution-toggle-${row.segmentId}`}
                        className="-ml-2.5 inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[15px] text-[#CAD0DA] hover:bg-[#1E232B] hover:text-white sm:ml-0"
                      >
                        {isOpen ? "Hide" : "Details"}
                        <span className="sr-only"> for {row.title}</span>
                        <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                {a && isOpen && (
                  <div role="row" id={panelId}>
                    <div role="cell" className="px-2 pb-4 pt-1" data-testid={`attribution-details-${row.segmentId}`}>
                      <div className="rounded-[10px] bg-[#101319] px-4 py-3">
                        <p className="text-[13px] text-[#9AA5B5]">
                          Window {a.actualStartMs !== undefined && a.actualEndMs !== undefined ? `${formatClock(a.actualStartMs, tz, true)}–${formatClock(a.actualEndMs, tz, true)}` : "not recorded"} · evidence tier: provider observed
                        </p>
                        <dl className="mt-2 grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                          {DETAIL_ORDER.map((key) => {
                            const m = findMetric(a, key);
                            const unit = m && key !== "gmv" && m.unit && m.unit !== "count" ? m.unit : null;
                            return (
                              <div key={key} className="flex items-start justify-between gap-4" data-metric={key}>
                                <dt className="min-w-0 text-[14px] leading-snug text-[#9AA5B5]">
                                  {METRIC_LABEL[key]}
                                  {unit && <span className="block text-[12px]">{unit}</span>}
                                  {m?.note && <span className="block text-[12px]">{m.note}</span>}
                                </dt>
                                <dd className="shrink-0 text-right">
                                  <ValueText cell={metricCell(m)} className="whitespace-nowrap" />
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                        {a.ambiguousBuckets.length > 0 && (
                          <div className="mt-3 border-t border-[#232935] pt-3" data-testid={`ambiguous-${row.segmentId}`}>
                            <p className="flex items-center gap-1.5 text-[14px] font-medium text-[#B4C6DD]">
                              <i className="ri-arrow-left-right-line" aria-hidden="true" />
                              Attribution ambiguous at {a.ambiguousBuckets.length === 1 ? "this boundary" : "these boundaries"}
                            </p>
                            <ul className="mt-1 space-y-0.5 text-[14px] text-[#B7C1CE]">
                              {a.ambiguousBuckets.map((b) => {
                                return (
                                  <li key={b.startMs}>
                                    <span className="tabular-nums text-[#CAD0DA]">
                                      {formatClock(b.startMs, tz)}–{formatClock(b.endMs, tz)}
                                    </span>{" "}
                                    {b.reason === "unknown_timing" ? "Timing bounds are unverified. Not assigned to a segment." : b.reason === "overlapping_actual_windows" ? "Actual windows overlap. Not assigned to either." : "Boundary minute overlaps a segment edge. Not assigned to either."}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                        {a.limitations.length > 0 && (
                          <ul className="mt-3 list-disc space-y-0.5 border-t border-[#232935] pl-5 pt-3 text-[14px] text-[#B7C1CE]">
                            {a.limitations.map((l) => (
                              <li key={l}>{l}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
