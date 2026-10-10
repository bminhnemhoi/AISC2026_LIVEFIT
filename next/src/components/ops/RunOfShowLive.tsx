"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { Cue, ProductSnapshot, Segment, Session } from "@/contracts";
import type { Forecast, SegmentForecast } from "@/lib/domain";
import { currentPlan, emptyCueRun, emptySegmentRun, formatClock, formatDuration, formatSigned } from "@/lib/domain";
import { SegmentTile } from "./SegmentTile";
import { AnchorBadge, AnchorStatus, Drift, Signal } from "./StatusChips";
import { CUE_ACTION_LABEL } from "./CueBar";

type Item =
  | { type: "segment"; segment: Segment; index: number; fc: SegmentForecast }
  | { type: "cue"; cue: Cue };

/** Interleave cues beneath the segment they belong to (wall-clock cues go after the segment running then). */
function buildItems(session: Session, forecast: Forecast): Item[] {
  const plan = currentPlan(session);
  const items: Item[] = [];
  const placed = new Set<string>();
  const fcById = new Map(forecast.segments.map((s) => [s.segmentId, s]));

  plan.segments.forEach((segment, index) => {
    items.push({ type: "segment", segment, index, fc: fcById.get(segment.id)! });
    const attached = plan.cues.filter((c) => c.timing.type !== "at_offset" && c.timing.segmentId === segment.id);
    for (const cue of attached) {
      items.push({ type: "cue", cue });
      placed.add(cue.id);
    }
    // Wall-clock cues land after the last segment that starts at or before them.
    const next = plan.segments[index + 1];
    const nextStart = next ? (fcById.get(next.id)?.startMs ?? null) : null;
    for (const cue of plan.cues.filter((c) => c.timing.type === "at_offset" && !placed.has(c.id))) {
      const at = forecast.cues.find((f) => f.cueId === cue.id)?.timeMs ?? null;
      if (at !== null && (nextStart === null || at < nextStart)) {
        items.push({ type: "cue", cue });
        placed.add(cue.id);
      }
    }
  });
  for (const cue of plan.cues) if (!placed.has(cue.id)) items.push({ type: "cue", cue });
  return items;
}

/**
 * Bring the current row into view by scrolling ONLY the Run of Show container.
 * (`Element.scrollIntoView` scrolls every scrollable ancestor, which would shove the NOW/NEXT band off screen.)
 */
export function scrollCurrentRowIntoView(row: Element | null = document.querySelector('[aria-current="step"]')): void {
  const box = row?.closest<HTMLElement>("[data-ros-scroll]");
  if (!row || !box) return;
  const r = row.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (r.top < b.top) box.scrollTop -= b.top - r.top + 8;
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 8;
}

const STATE_LABEL: Record<string, { text: string; icon: string; tone: "lime" | "neutral" | "muted" | "warn" }> = {
  active: { text: "Current", icon: "ri-record-circle-line", tone: "lime" },
  completed: { text: "Completed", icon: "ri-checkbox-circle-line", tone: "neutral" },
  pending: { text: "Pending", icon: "ri-time-line", tone: "muted" },
  skipped: { text: "Skipped", icon: "ri-skip-forward-line", tone: "muted" },
};

export function RunOfShowLive({
  session,
  forecast,
  products,
  tz,
  onReportCue,
}: {
  session: Session;
  forecast: Forecast;
  products: ProductSnapshot[];
  tz: string;
  /** Any unresolved operator cue can be reported from its row — an earlier attempt never blocks a later cue. */
  onReportCue?: (cueId: string) => void;
}): React.ReactElement {
  const items = useMemo(() => buildItems(session, forecast), [session, forecast]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const currentRef = useRef<HTMLLIElement | null>(null);
  const currentId = session.runtime.currentSegmentId;

  useEffect(() => {
    scrollCurrentRowIntoView(currentRef.current);
  }, [currentId]);

  return (
    <ol aria-label="Run of Show" className="divide-y divide-[#1F2530]" data-testid="live-ros">
      {items.map((item) => {
        if (item.type === "cue") {
          const cue = item.cue;
          const fc = forecast.cues.find((f) => f.cueId === cue.id);
          const run = session.runtime.cues[cue.id] ?? emptyCueRun();
          const reportable = cue.audience === "operator" && (run.state === "pending" || run.state === "attempted") && Boolean(onReportCue);
          const tag =
            cue.audience !== "operator" ? "Presenter cue" : cue.action !== "none" ? CUE_ACTION_LABEL[cue.action] : "Operator cue";
          return (
            <li key={cue.id} className="flex items-center gap-3 py-1 pl-3 sm:pl-[88px] pr-2" data-testid={`ros-cue-${cue.id}`}>
              <i className="ri-focus-3-line text-[18px] text-[#8A95A5] shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] leading-6 text-[#E4E8F0] break-words sm:truncate" title={cue.title}>
                  {cue.title}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 min-w-0 text-[16px] leading-5 text-[#9AA5B5]">
                  <span className="truncate min-w-0" title={`${tag} · no host time`}>
                    {tag}
                  </span>
                  <span className="tabular-nums whitespace-nowrap shrink-0">
                    {fc?.orphaned ? "segment skipped" : fc?.timeMs != null ? `${fc.lowerBound ? "≥ " : ""}${formatClock(fc.timeMs, tz, true)}` : "—"}
                  </span>
                  <span className="min-w-0">
                    {cue.audience !== "operator" ? (
                      <Signal tone="muted" size="desk">informational</Signal>
                    ) : run.state === "performed" ? (
                      <Signal tone="neutral" icon="ri-hand-heart-line" size="desk">Reported performed · unverified</Signal>
                    ) : run.state === "attempted" ? (
                      <Signal tone="warn" icon="ri-cursor-line" size="desk">Attempted · outcome unknown</Signal>
                    ) : run.state === "cancelled" ? (
                      <Signal tone="muted" icon="ri-close-circle-line" size="desk">Cancelled</Signal>
                    ) : fc?.dueInSec != null && fc.dueInSec < 0 ? (
                      <Signal tone="warn" icon="ri-time-line" size="desk">Not reported · {formatDuration(-fc.dueInSec)} overdue</Signal>
                    ) : (
                      <Signal tone="muted" size="desk">Not reported</Signal>
                    )}
                  </span>
                </p>
              </div>
              {reportable && (
                <button
                  type="button"
                  onClick={() => onReportCue?.(cue.id)}
                  data-testid={`ros-cue-report-${cue.id}`}
                  aria-label={`Report ${cue.title}`}
                  className="min-h-[44px] min-w-[44px] px-3 rounded-[8px] text-[16px] font-medium text-[#CAD0DA] hover:text-[#DFFF00] hover:bg-[#1B2028] cursor-pointer shrink-0"
                >
                  Report
                </button>
              )}
            </li>
          );
        }

        const { segment, index, fc } = item;
        const run = session.runtime.segments[segment.id] ?? emptySegmentRun();
        const isActive = run.state === "active";
        const state = STATE_LABEL[run.state];
        const product = segment.productId ? (productById.get(segment.productId) ?? null) : null;
        const actualSec =
          run.state === "completed" && run.startedAtMs !== null && run.endedAtMs !== null
            ? Math.round((run.endedAtMs - run.startedAtMs) / 1000)
            : null;
        const baseTarget =
          fc.baselineStartMs !== null && fc.baselineEndMs !== null ? Math.round((fc.baselineEndMs - fc.baselineStartMs) / 1000) : null;

        return (
          <li
            key={segment.id}
            ref={isActive ? currentRef : undefined}
            aria-current={isActive ? "step" : undefined}
            data-testid={`ros-row-${segment.id}`}
            data-state={run.state}
            className={`grid grid-cols-[minmax(0,1fr)_auto] sm:flex items-center gap-3 py-2 px-3 rounded-[8px] ${isActive ? "bg-[#1F2A22] border-l-2 border-[#DFFF00]" : ""} ${
              run.state === "skipped" ? "opacity-60" : ""
            }`}
          >
            <div className="w-[100px] shrink-0">
              <span className="block text-[16px] leading-5 font-mono text-[#AEB7C5]">{String(index + 1).padStart(2, "0")}</span>
              <p className="text-[16px] leading-6 tabular-nums text-[#E4E8F0]">
                {fc.startMs !== null ? `${fc.lowerBound && run.state === "pending" ? "≥ " : ""}${formatClock(fc.startMs, tz, true)}` : "—"}
              </p>
            </div>
            <SegmentTile segment={segment} product={product} size={40} active={isActive} />
            <div className="col-span-2 min-w-0 flex-1">
              <p className={`text-[16px] font-medium break-words sm:truncate ${isActive ? "text-[#DFFF00]" : "text-[#F5F7FC]"}`}>{segment.title}</p>
              <div className="flex items-center gap-3 flex-wrap">
                {fc.anchor && run.state !== "skipped" && (
                  <>
                    <AnchorBadge committedMs={fc.anchor.committedMs} tz={tz} size="desk" />
                    <AnchorStatus anchor={fc.anchor} tz={tz} size="desk" />
                  </>
                )}
                {fc.anchor && run.state === "skipped" && <Signal tone="warn" icon="ri-lock-2-line" size="desk">Commitment cancelled</Signal>}
                {segment.optional && <Signal tone="muted" size="desk">optional</Signal>}
                {run.deferred && run.state === "pending" && <Signal tone="muted" icon="ri-arrow-down-line" size="desk">deferred</Signal>}
                {run.belowMinimum && <Signal tone="warn" size="desk">below minimum</Signal>}
                {run.coverage === "partial" && <Signal tone="warn" size="desk">coverage partial</Signal>}
                {!fc.anchor && !segment.optional && segment.cue && (
                  <span className="text-[16px] leading-6 text-[#9AA5B5] truncate">{segment.cue}</span>
                )}
              </div>
            </div>
            <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:block sm:w-[150px] shrink-0 sm:text-right">
              {run.state === "completed" && actualSec !== null && (
                <p className="text-[16px] leading-6 font-medium tabular-nums text-[#F5F7FC]">
                  {formatDuration(actualSec)}
                  {baseTarget !== null && actualSec - baseTarget !== 0 && (
                    <span className={`ml-1.5 text-[16px] ${actualSec - baseTarget > 0 ? "text-[#F6C875]" : "text-[#9AA5B5]"}`}>
                      {formatSigned(actualSec - baseTarget)}
                    </span>
                  )}
                </p>
              )}
              {run.state === "active" && (
                <p className="text-[16px] leading-6 font-medium tabular-nums text-[#F5F7FC]">
                  {segment.targetSec !== null ? formatDuration(segment.targetSec) : "—"}
                  <span className="text-[16px] font-normal text-[#9AA5B5]"> target</span>
                </p>
              )}
              {run.state === "pending" && (
                <p className="text-[16px] leading-6 font-medium tabular-nums text-[#F5F7FC]">
                  {segment.targetSec !== null ? formatDuration(segment.targetSec) : "Not entered"}
                  <Drift seconds={fc.driftSec} lowerBound={fc.lowerBound} className="ml-1.5" size="desk" />
                </p>
              )}
              <Signal tone={state.tone} icon={state.icon} className="justify-end" size="desk">
                {state.text}
              </Signal>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
