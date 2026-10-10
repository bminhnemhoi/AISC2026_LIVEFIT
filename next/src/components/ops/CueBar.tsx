"use client";

import React from "react";
import type { Cue, CueRun, ManualActionRun } from "@/contracts";
import type { CueForecast } from "@/lib/domain";
import { formatClock, formatDuration } from "@/lib/domain";
import { Button } from "@/components/ui";
import { Signal } from "./StatusChips";

export const CUE_ACTION_LABEL: Record<Cue["action"], string> = {
  none: "Presenter note",
  pin_product: "Pin product",
  unpin_product: "Unpin product",
  start_promotion: "Start promotion",
};

export type ReportTarget = { kind: "cue"; id: string } | { kind: "action"; id: string } | { kind: "new" };

/**
 * The next operator cue. A cue is a zero-duration marker performed in TikTok by a human.
 * LiveLift records what the operator reports; it never executes or confirms the action.
 * An earlier attempt whose outcome is unknown stays unresolved but never blocks reporting the next cue:
 * the bar moves on to the next unreported cue, and unresolved attempts stay one click away.
 *
 * Sizing: every control is a 44px target; labels are 16px (the lime "I performed this" is 18px at all times,
 * so nothing moves when a cue becomes urgent). From 1280px wide the bar never wraps: the cue text yields first.
 */
export function CueBar({
  cues,
  forecasts,
  runs,
  actions,
  tz,
  onPerformed,
  onAttempted,
  onReport,
}: {
  cues: Cue[];
  forecasts: CueForecast[];
  runs: Record<string, CueRun>;
  actions: Record<string, ManualActionRun>;
  tz: string;
  onPerformed: (cueId: string) => void;
  onAttempted: (cueId: string) => void;
  onReport: (target: ReportTarget) => void;
}): React.ReactElement {
  const operator = cues
    .filter((c) => c.audience === "operator")
    .map((cue) => ({ cue, fc: forecasts.find((f) => f.cueId === cue.id), state: runs[cue.id]?.state ?? "pending", run: runs[cue.id] }))
    .filter((x) => x.fc);
  const byDue = (a: { fc?: CueForecast }, b: { fc?: CueForecast }): number => (a.fc!.timeMs ?? Infinity) - (b.fc!.timeMs ?? Infinity);
  const pending = operator.filter((x) => x.state === "pending" && !x.fc!.orphaned).sort(byDue);
  const attemptedCues = operator.filter((x) => x.state === "attempted").sort(byDue);
  const attemptedActions = Object.values(actions).filter((a) => a.state === "attempted");
  const unresolved = attemptedCues.length + attemptedActions.length;
  const first = pending[0] ?? null;
  const firstUnresolved: ReportTarget | null = attemptedCues[0]
    ? { kind: "cue", id: attemptedCues[0].cue.id }
    : attemptedActions[0]
      ? { kind: "action", id: attemptedActions[0].id }
      : null;

  const unresolvedButton =
    unresolved > 0 && firstUnresolved ? (
      <button
        type="button"
        onClick={() => onReport(firstUnresolved)}
        data-testid="cue-unresolved-btn"
        className="min-h-[44px] px-2 rounded-[8px] text-[16px] font-medium text-[#F6C875] hover:bg-[#1F1B12] cursor-pointer whitespace-nowrap shrink-0"
      >
        <i className="ri-question-line mr-1" aria-hidden="true" />
        {unresolved} attempt{unresolved === 1 ? "" : "s"} unresolved
      </button>
    ) : null;

  const reportButton = (
    <Button
      size="desk"
      variant="ghost"
      onClick={() => onReport(first ? { kind: "cue", id: first.cue.id } : { kind: "new" })}
      data-testid="cue-report-btn"
      className="shrink-0"
    >
      Report…
    </Button>
  );

  if (!first) {
    return (
        <div data-testid="cue-bar" className="flex flex-wrap items-center gap-2 min-h-[44px] min-w-0 flex-1">
        <Signal tone="muted" icon="ri-checkbox-multiple-line" size="desk">
          No operator cues waiting
        </Signal>
        {unresolvedButton}
        {reportButton}
      </div>
    );
  }

  const { cue, fc } = first;
  const due = fc!.dueInSec;
  const urgent = due !== null && due <= 60;
  const overdue = due !== null && due < 0;

  return (
    <div data-testid="cue-bar" className="flex items-center gap-3 min-w-0 flex-1 flex-wrap xl:flex-nowrap">
      <div className="min-w-0 flex-1 basis-[200px]">
        <p className="text-[16px] leading-5 font-medium text-[#F5F7FC] truncate" title={`${cue.title} · cue, no host time`}>
          <i className="ri-focus-3-line mr-1.5 text-[#AEB7C5]" aria-hidden="true" />
          <span data-testid="cue-title">{cue.title}</span>
          <span className="sr-only"> · cue, no host time</span>
        </p>
        <p className="text-[16px] leading-5 tabular-nums text-[#B7C1CE] truncate">
          {fc!.timeMs !== null ? (
            <>
              {fc!.lowerBound ? "Due ≥ " : "Due "}
              {formatClock(fc!.timeMs, tz, true)}
              {due !== null && (
                <span className={overdue ? "text-[#F6C875]" : urgent ? "text-[#DFFF00]" : ""}>
                  {" · "}
                  {overdue ? `${formatDuration(-due)} overdue` : `in ${formatDuration(due)}`}
                </span>
              )}
            </>
          ) : (
            "Due when its segment starts"
          )}
          {pending.length > 1 && ` · +${pending.length - 1} more`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="deskPrimary"
          variant={urgent ? "primary" : "secondary"}
          onClick={() => onPerformed(cue.id)}
          data-testid="cue-performed-btn"
          aria-label={`I performed this: ${cue.title}`}
        >
          I performed this
        </Button>
        <Button size="desk" variant="secondary" onClick={() => onAttempted(cue.id)} data-testid="cue-attempted-btn" aria-label={`Attempted: ${cue.title}`}>
          Attempted
        </Button>
        {reportButton}
        {unresolvedButton}
      </div>
    </div>
  );
}
