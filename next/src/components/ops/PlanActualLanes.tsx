import React from "react";
import type { ReviewRow } from "@/lib/domain";
import { formatClock, formatDuration } from "@/lib/domain";

/**
 * Baseline vs Actual on one shared time axis. The baseline lane is the immutable commitment;
 * the actual lane is only what was recorded. Hard anchors are drawn at their committed time and,
 * if explicitly re-anchored, again at the new commitment — the original is never erased.
 */
export function PlanActualLanes({
  rows,
  tz,
}: {
  rows: ReviewRow[];
  tz: string;
}): React.ReactElement {
  const intervals = rows.flatMap((r) => [r.baseline, r.actual].filter((x): x is NonNullable<typeof x> => x !== null));
  if (intervals.length === 0) {
    return <p className="text-[14px] text-[#9AA5B5]">No intervals were recorded.</p>;
  }
  const anchorTimes = rows.flatMap((r) => (r.anchor ? [r.anchor.committedMs, r.anchor.currentCommittedMs] : []));
  const t0 = Math.min(...intervals.map((i) => i.startMs), ...anchorTimes);
  const t1 = Math.max(...intervals.map((i) => i.endMs), ...anchorTimes);
  const span = Math.max(1, t1 - t0);
  const pct = (ms: number): number => ((ms - t0) / span) * 100;
  const left = (ms: number): string => `${pct(ms)}%`;
  const width = (a: number, b: number): string => `${Math.max(0.6, ((b - a) / span) * 100)}%`;

  // Ticks every 5 minutes from the start.
  const ticks: number[] = [];
  for (let t = t0; t <= t1; t += 300_000) ticks.push(t);

  const summary = `Baseline and actual timelines from ${formatClock(t0, tz)} to ${formatClock(t1, tz)}`;

  return (
    <div role="img" aria-label={summary} data-testid="plan-actual-lanes" className="select-none">
      <div className="relative h-5 text-[12px] text-[#9AA5B5] tabular-nums ml-[72px]">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: left(t) }}>
            {formatClock(t, tz)}
          </span>
        ))}
      </div>

      <div className="relative">
      <div className="flex items-center gap-2 mt-1">
        <span className="w-[64px] text-[13px] text-[#C8CDD6] shrink-0">Baseline</span>
        <div className="relative flex-1 h-8 rounded-[6px] bg-[#101319]">
          {rows.map((r) =>
            r.baseline ? (
              <div
                key={r.segmentId}
                className="absolute top-0.5 bottom-0.5 rounded-[4px] bg-[#2B313C] text-[12px] text-[#E4E8F0] flex items-center justify-center overflow-hidden px-1 border-r border-[#101319]"
                style={{ left: left(r.baseline.startMs), width: width(r.baseline.startMs, r.baseline.endMs) }}
                title={`${r.title} · planned ${formatClock(r.baseline.startMs, tz, true)}–${formatClock(r.baseline.endMs, tz, true)} (${formatDuration(r.baseline.durSec)})`}
              >
                <span className="truncate">{r.title}</span>
              </div>
            ) : null
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        <span className="w-[64px] text-[13px] text-[#C8CDD6] shrink-0">Actual</span>
        <div className="relative flex-1 h-8 rounded-[6px] bg-[#101319]">
          {rows.map((r) => {
            if (r.actual) {
              const over = r.overran;
              return (
                <div
                  key={r.segmentId}
                  className={`absolute top-0.5 bottom-0.5 rounded-[4px] text-[12px] flex items-center justify-center overflow-hidden px-1 border-r border-[#101319] ${
                    over ? "bg-[#3A2F18] text-[#F6C875]" : "bg-[#27312B] text-[#DFFF00]"
                  } ${r.outcome === "closed_early" ? "outline outline-1 outline-dashed outline-[#8A95A5] -outline-offset-2" : ""}`}
                  style={{ left: left(r.actual.startMs), width: width(r.actual.startMs, r.actual.endMs) }}
                  title={`${r.title} · actual ${formatClock(r.actual.startMs, tz, true)}–${formatClock(r.actual.endMs, tz, true)} (${formatDuration(r.actual.durSec)})`}
                >
                  <span className="truncate">{r.title}</span>
                </div>
              );
            }
            if (r.baseline && (r.outcome === "skipped" || r.outcome === "not_reached")) {
              return (
                <div
                  key={r.segmentId}
                  className="absolute top-1 bottom-1 rounded-[4px] border border-dashed border-[#4B5665] text-[11px] text-[#8A95A5] flex items-center justify-center overflow-hidden px-1"
                  style={{ left: left(r.baseline.startMs), width: width(r.baseline.startMs, r.baseline.endMs) }}
                  title={`${r.title} · ${r.outcome === "skipped" ? "skipped" : "not reached"} — no performed interval`}
                >
                  <span className="truncate">{r.outcome === "skipped" ? "skipped" : "not reached"}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* Hard anchors cross both lanes */}
      <div className="absolute inset-y-0 left-[72px] right-0 pointer-events-none">
        {rows.map((r) =>
          r.anchor ? (
            <React.Fragment key={`a-${r.segmentId}`}>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#F5F7FC]/70"
                style={{ left: left(r.anchor.committedMs) }}
                title={`Hard anchor ${r.title} · committed ${formatClock(r.anchor.committedMs, tz, true)}`}
              />
              {r.anchor.reAnchored && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-[#F6C875]"
                  style={{ left: left(r.anchor.currentCommittedMs) }}
                  title={`Re-anchored to ${formatClock(r.anchor.currentCommittedMs, tz, true)}`}
                />
              )}
            </React.Fragment>
          ) : null
        )}
      </div>
      </div>
      <div className="mt-3 ml-[72px] flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[#9AA5B5]">
        <span><i className="ri-lock-2-line mr-1" aria-hidden="true" />solid line = baseline hard anchor</span>
        <span className="text-[#F6C875]">dashed line = explicit re-anchor</span>
        <span className="text-[#F6C875]">amber = ran over its baseline duration</span>
        <span>dashed outline = closed early · dashed box = skipped / not reached</span>
      </div>
    </div>
  );
}
