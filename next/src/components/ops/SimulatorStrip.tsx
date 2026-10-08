"use client";

import React from "react";
import { formatClock } from "@/lib/domain";

/**
 * Rehearsal controls. Visibly SIMULATED. The clock only moves through recorded commands, so the
 * same scenario and the same actions always produce the same outcomes.
 *
 * Every control is a 44px target with a 16px label. The strip has no vertical padding of its own, so the
 * operator line stays exactly one 44px row and the controls cost the desk no extra height.
 */
export function SimulatorStrip({
  virtualNowMs,
  tz,
  nextAnchorMs,
  scripted,
  step,
  onAdvance,
  onToAnchor,
  onApplyStep,
  onSkipStep,
  disabled,
  message,
}: {
  virtualNowMs: number;
  tz: string;
  nextAnchorMs: number | null;
  /** The rehearsal has a scenario script. Free-form rehearsals only have the clock controls. */
  scripted: boolean;
  step: { index: number; total: number; label: string } | null;
  onAdvance: (sec: number) => void;
  onToAnchor: () => void;
  onApplyStep: () => void;
  onSkipStep: () => void;
  disabled?: boolean;
  message?: string | null;
}): React.ReactElement {
  const btn =
    "min-h-[44px] min-w-[44px] px-2.5 rounded-[8px] text-[16px] font-medium bg-[#2A2540] text-[#E4DAFF] hover:bg-[#363052] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0";
  return (
    <div
      data-testid="simulator-strip"
      className="flex items-center gap-x-3 min-w-0 flex-1 basis-full xl:basis-auto flex-wrap xl:flex-nowrap justify-end text-[16px]"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-[#C8B2FF] whitespace-nowrap">
        <i className="ri-flask-line" aria-hidden="true" />
        SIMULATED
      </span>
      <span
        className="tabular-nums text-[#E4DAFF] whitespace-nowrap"
        data-testid="virtual-clock"
        title="The virtual clock only moves when you move it, so the same actions always give the same result."
      >
        virtual clock {formatClock(virtualNowMs, tz, true)}
      </span>
      <span className="inline-flex flex-wrap max-w-full items-center gap-1" role="group" aria-label="Move the virtual clock">
        <button type="button" className={btn} disabled={disabled} onClick={() => onAdvance(30)} data-testid="sim-plus-30s">
          +30s
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => onAdvance(60)} data-testid="sim-plus-1m">
          +1m
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => onAdvance(300)} data-testid="sim-plus-5m">
          +5m
        </button>
        <button
          type="button"
          className={btn}
          disabled={disabled || nextAnchorMs === null || nextAnchorMs - 60_000 <= virtualNowMs}
          onClick={onToAnchor}
          data-testid="sim-to-anchor"
          title={nextAnchorMs === null ? "No upcoming hard anchor to jump to" : nextAnchorMs - 60_000 <= virtualNowMs ? "Already within one minute of the next anchor; use +30s or +1m to move forward" : "Jump to one minute before the next hard anchor"}
        >
          To anchor
        </button>
      </span>
      {scripted && step && (
        <span className="inline-flex items-center gap-2 min-w-0 flex-1 basis-full xl:basis-auto justify-end">
          <span className="text-[#C8B2FF] whitespace-nowrap tabular-nums">
            {step.index + 1}/{step.total}
          </span>
          <span className="truncate min-w-0 text-[#E4DAFF]" title={step.label} data-testid="sim-step-label">
            {step.label}
          </span>
          <button
            type="button"
            className={`${btn} !bg-[#C8B2FF] !text-[#1A1726] hover:!bg-[#D8C8FF]`}
            disabled={disabled}
            onClick={onApplyStep}
            data-testid="sim-apply-step"
          >
            Apply step
          </button>
          <button type="button" className={btn} disabled={disabled} onClick={onSkipStep} data-testid="sim-skip-step">
            Skip
          </button>
        </span>
      )}
      {scripted && !step && <span className="text-[#C8B2FF] whitespace-nowrap">Script finished</span>}
      {message && (
        <span role="status" className="basis-full text-right text-[#F6C875] text-[16px]" title={message}>
          {message}
        </span>
      )}
    </div>
  );
}
