"use client";

import React from "react";
import type { ProductSnapshot, Segment } from "@/contracts";
import type { RecoveryAnalysis, RecoveryOption, SegmentForecast, SituationTone } from "@/lib/domain";
import { formatClock, formatDuration, isAnchorDueNow } from "@/lib/domain";
import { Button } from "@/components/ui";
import { SegmentTile } from "./SegmentTile";
import { AnchorBadge, Drift, Signal } from "./StatusChips";

const WHY_STYLE: Record<SituationTone, string> = {
  ok: "bg-[#14171E] border-[#3A4350]",
  watch: "bg-[#1F1B12] border-[#F6C875]",
  risk: "bg-[#2A2316] border-[#F6C875]",
  missed: "bg-[#302025] border-[#F4A4A4]",
};

const WHY_ICON: Record<SituationTone, string> = {
  ok: "ri-information-line",
  watch: "ri-question-line",
  risk: "ri-error-warning-line",
  missed: "ri-time-line",
};

/** Spoken prefix for the situation's tone, so a change from "on track" to "at risk" is heard as one. */
const WHY_SPOKEN: Record<SituationTone, string> = {
  ok: "",
  watch: "Watch: ",
  risk: "At risk: ",
  missed: "Missed: ",
};

const MAX_VISIBLE_OPTIONS = 2;

/** NEXT · WHY · ACTION: the next executable segment, one reason, and explicit choices. */
export function NextPanel({
  nextSegment,
  nextForecast,
  nextProduct,
  activeSegment,
  analysis,
  nowMs,
  tz,
  onAdvance,
  onApply,
  onShowAll,
  onReanchorNext,
  onEndLive,
  simulated = false,
}: {
  nextSegment: Segment | null;
  nextForecast: SegmentForecast | null;
  nextProduct: ProductSnapshot | null;
  activeSegment: Segment | null;
  analysis: RecoveryAnalysis;
  nowMs: number;
  tz: string;
  onAdvance: () => void;
  onApply: (option: RecoveryOption) => void;
  onShowAll: () => void;
  onReanchorNext: () => void;
  onEndLive: () => void;
  /** A SIMULATED rehearsal: the end action names the mode instead of saying "LIVE". */
  simulated?: boolean;
}): React.ReactElement {
  const clock = (ms: number): string => formatClock(ms, tz, true);
  const tone = analysis.situation.tone;
  const showRecovery = analysis.options.length > 0;
  const visible = analysis.options.slice(0, MAX_VISIBLE_OPTIONS);

  if (!nextSegment) {
    return (
      <section data-testid="next-panel" aria-label="Next" className="rounded-[12px] bg-[#1B1F27] p-5 flex flex-col justify-between min-h-0">
        <div>
          <span className="text-[16px] leading-5 font-semibold tracking-[1.5px] text-[#DFFF00] uppercase">NEXT</span>
          <p className="text-[22px] font-medium text-[#F5F7FC] mt-3">Nothing left in the Run of Show</p>
          <p className="text-[16px] text-[#B7C1CE] mt-1">
            {activeSegment ? `${activeSegment.title} is the last segment.` : "All segments have run or been skipped."}{" "}
            {simulated ? "End the simulated session when the rehearsal is over." : "End LIVE when the show is over."}
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={onEndLive} data-testid="end-live-primary-btn" className="w-full mt-4">
          {simulated ? "End simulated session" : "End LIVE"}
        </Button>
      </section>
    );
  }

  const anchor = nextForecast?.anchor ?? null;
  const startMs = nextForecast?.startMs ?? null;
  const waitingForAnchor = !activeSegment && anchor !== null && startMs !== null && nowMs < anchor.committedMs;
  const primaryLabel = waitingForAnchor
    ? `Starts ${clock(anchor!.committedMs)} · in ${formatDuration(Math.max(0, Math.round((anchor!.committedMs - nowMs) / 1000)))}`
    : activeSegment
      ? `Next segment · ${nextSegment.title}`
      : `Start ${nextSegment.title}`;
  const primaryHint = waitingForAnchor
    ? "A hard anchor is never pulled forward."
    : activeSegment
      ? anchor && nowMs < anchor.committedMs
        ? `Ends ${activeSegment.title} now; ${nextSegment.title} starts at its ${clock(anchor.committedMs)} anchor.`
        : `Ends ${activeSegment.title} now and starts ${nextSegment.title}.`
      : null;

  return (
    <section data-testid="next-panel" aria-label="Next" className="rounded-[12px] bg-[#1B1F27] p-3 [@media(min-height:740px)]:p-4 flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[16px] leading-5 font-semibold tracking-[1.5px] text-[#DFFF00] uppercase">NEXT</span>
        {startMs !== null && (
          <span className="inline-flex items-center gap-3">
            <Signal tone="neutral" icon="ri-time-line" className="tabular-nums" size="desk">
              Starts {nextForecast?.lowerBound ? "≥ " : "≈ "}
              {clock(startMs)}
            </Signal>
            <Drift seconds={nextForecast?.driftSec ?? null} lowerBound={nextForecast?.lowerBound} size="desk" />
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 min-w-0">
        <SegmentTile segment={nextSegment} product={nextProduct} size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] leading-tight font-medium tracking-tight text-[#F5F7FC] truncate" data-testid="next-title">
            {nextSegment.title}
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            {anchor && <AnchorBadge committedMs={anchor.committedMs} tz={tz} size="desk" />}
            {nextSegment.targetSec !== null && (
              <Signal tone="muted" className="tabular-nums" size="desk">
                {formatDuration(nextSegment.targetSec)}
                {nextSegment.optional ? " · optional" : ""}
              </Signal>
            )}
          </div>
        </div>
      </div>

      {/*
        The box's detail counts down (remaining buffer, minutes late), so the box itself must not be a live region: it
        would be read out every second. Screen readers hear only when the situation itself changes: its tone and headline.
      */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="why-announce">
        {WHY_SPOKEN[tone]}
        {analysis.situation.headline}
      </p>
      <div data-testid="why-box" className={`mt-2 rounded-[8px] border-l-[3px] px-3 py-1.5 ${WHY_STYLE[tone]}`}>
        <p className="text-[16px] leading-snug text-[#F5F7FC]">
          <i className={`${WHY_ICON[tone]} mr-1.5 ${tone === "missed" ? "text-[#F4A4A4]" : tone === "ok" ? "text-[#9AA5B5]" : "text-[#F6C875]"}`} aria-hidden="true" />
          <span className="font-semibold">WHY · </span>
          <span className="font-medium">{analysis.situation.headline}</span>
        </p>
        {analysis.situation.detail && (
          <p className="text-[16px] leading-snug text-[#CAD0DA] mt-0.5">{analysis.situation.detail}</p>
        )}
      </div>

      <div className="mt-2 flex-1 min-h-0">
        {showRecovery ? (
          <div data-testid="recovery-list">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[16px] leading-5 font-semibold tracking-[1.5px] text-[#AEB7C5] uppercase">Action</span>
              {analysis.status === "no_feasible_recovery" && (
                <Signal
                  tone="warn"
                  icon="ri-error-warning-line"
                  className="font-medium"
                  size="desk"
                  title={
                    analysis.exceptionProtects
                      ? "Only an exception (below a minimum or dropping required coverage) or a commitment change protects it."
                      : "Even with exceptions it cannot be protected; only a commitment change remains."
                  }
                >
                  <span data-testid="no-feasible-recovery">No feasible recovery under current constraints</span>
                </Signal>
              )}
              {analysis.status === "recoverable" && analysis.cleanPlan.length > 1 && (
                <Signal tone="neutral" icon="ri-checkbox-circle-line" className="truncate" size="desk" title={analysis.cleanPlan.join(" + ")}>
                  <span data-testid="clean-plan">Together: {analysis.cleanPlan.join(" + ")}</span>
                </Signal>
              )}
              {analysis.status === "already_missed" && (
                <Signal tone="danger" icon="ri-time-line" size="desk">
                  {analysis.criticalSegmentId === nextSegment.id && anchor !== null && isAnchorDueNow(anchor)
                    ? "Commitment due now — options limit further delay"
                    : "Commitment missed — options limit further delay"}
                </Signal>
              )}
              {analysis.status === "possible_risk" && (
                <Signal tone="warn" icon="ri-question-line" size="desk">End unknown</Signal>
              )}
            </div>
            <ul className="mt-1 divide-y divide-[#262C38]">
              {visible.map((o, i) => (
                <li key={o.id} className={`flex items-center gap-3 py-1.5 [@media(max-height:800px)]:py-1 ${i > 0 ? "[@media(max-height:800px)]:hidden" : ""}`} data-testid={`recovery-option-${o.kind}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] leading-5 font-medium text-[#F5F7FC] truncate">{o.label}</p>
                    <p className={`text-[16px] leading-snug text-[#B7C1CE] ${i === 0 ? "truncate [@media(min-height:860px)]:whitespace-normal [@media(min-height:860px)]:line-clamp-2" : "truncate"}`} title={o.detail}>
                      {o.exception && (
                        <span className={`mr-1.5 font-medium ${o.exception.code === "commitment_change" ? "text-[#CAD0DA]" : "text-[#F6C875]"}`}>
                          {o.exception.code === "commitment_change" ? "Commitment change ·" : "Exception ·"}
                        </span>
                      )}
                      {o.detail}
                    </p>
                  </div>
                  <Button
                    size={o.clean && o.protects && i === 0 ? "deskPrimary" : "desk"}
                    variant={o.clean && o.protects && i === 0 ? "primary" : "secondary"}
                    onClick={() => onApply(o)}
                    data-testid={`apply-${o.kind}`}
                    aria-label={`${o.exception?.code === "commitment_change" ? "Review" : "Apply"}: ${o.label}`}
                    className="shrink-0"
                  >
                    {o.exception?.code === "commitment_change" ? "Review" : o.exception ? "Apply exception" : "Apply"}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-0.5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onShowAll}
                  className="min-h-[44px] px-1 text-[16px] text-[#CAD0DA] hover:text-[#DFFF00] cursor-pointer whitespace-nowrap"
                  data-testid="all-options-btn"
                >
                  {analysis.options.length > 1 ? `All options (${analysis.options.length})` : "Explain options"}
                </button>
                {anchor && analysis.status !== "possible_risk" && (
                  <button type="button" onClick={onReanchorNext} className="min-h-[44px] px-1 text-[16px] text-[#CAD0DA] hover:text-[#DFFF00] cursor-pointer whitespace-nowrap">
                    Re-anchor…
                  </button>
                )}
              </div>
              <Button variant="secondary" size="desk" onClick={onAdvance} disabled={waitingForAnchor} data-testid="advance-btn" title={primaryHint ?? undefined} className="max-w-full !whitespace-normal">
                {primaryLabel}
              </Button>
              {primaryHint && <p className="text-[16px] leading-5 text-[#B7C1CE]">{primaryHint}</p>}
            </div>
          </div>
        ) : (
          <div>
            <span className="text-[16px] leading-5 font-semibold tracking-[1.5px] text-[#AEB7C5] uppercase">Action</span>
            <Button
              variant="primary"
              size="lg"
              onClick={onAdvance}
              disabled={waitingForAnchor}
              data-testid="advance-btn"
              className="w-full mt-1.5 !whitespace-normal"
            >
              {primaryLabel}
            </Button>
            <div className="flex items-center justify-between gap-3 mt-1.5 min-h-[20px]">
              {primaryHint && <p className="text-[16px] leading-5 text-[#B7C1CE]">{primaryHint}</p>}
              {waitingForAnchor && (
                <button type="button" onClick={onReanchorNext} className="min-h-[44px] px-1 text-[16px] text-[#CAD0DA] hover:text-[#DFFF00] cursor-pointer whitespace-nowrap">
                  Re-anchor…
                </button>
              )}
            </div>
          </div>
        )}
      </div>

    </section>
  );
}
