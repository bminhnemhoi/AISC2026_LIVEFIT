"use client";

import React, { useState } from "react";
import type { ProductSnapshot, Segment, SegmentRun } from "@/contracts";
import type { ActiveEnd, AnchorGuard, SegmentForecast } from "@/lib/domain";
import { formatClock, formatDuration } from "@/lib/domain";
import { Button } from "@/components/ui";
import { SegmentTile } from "./SegmentTile";
import { Signal } from "./StatusChips";

/** NOW: operational truth as recorded — what is running, for how long, and when it can end. */
export function NowPanel({
  segment,
  run,
  product,
  position,
  active,
  guard,
  nowMs,
  tz,
  nextSegment,
  nextForecast,
  onSetEstimate,
  onMarkUnknown,
}: {
  segment: Segment | null;
  run: SegmentRun | null;
  product: ProductSnapshot | null;
  position: { index: number; total: number };
  active: ActiveEnd | null;
  guard: AnchorGuard | null;
  nowMs: number;
  tz: string;
  nextSegment: Segment | null;
  nextForecast: SegmentForecast | null;
  onSetEstimate: (remainingSec: number | null) => void;
  /** The host explicitly does not know how long is left. */
  onMarkUnknown: () => void;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState("");

  const clock = (ms: number): string => formatClock(ms, tz, true);

  // ---- Between segments or finished ------------------------------------------------------
  if (!segment || !run || run.startedAtMs === null) {
    const waitingFor = nextSegment && nextForecast?.anchor && nextForecast.startMs !== null && nextForecast.startMs > nowMs;
    return (
      <section data-testid="now-panel" aria-label="Now" className="rounded-[12px] bg-[#13161C] p-3 [@media(min-height:740px)]:p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[16px] leading-5 font-semibold tracking-[1.5px] text-[#DFFF00] uppercase">NOW</span>
          <Signal tone="muted" icon="ri-time-line" size="desk">Between segments</Signal>
        </div>
        {nextSegment ? (
          <div className="mt-4 flex-1 flex flex-col justify-center">
            <p className="text-[16px] text-[#B7C1CE]">No segment is running.</p>
            {waitingFor ? (
              <>
                <p className="text-[34px] leading-tight font-medium text-[#F5F7FC] tabular-nums mt-1" data-testid="now-waiting-countdown">
                  {formatDuration(Math.max(0, Math.round((nextForecast!.startMs! - nowMs) / 1000)))}
                </p>
                <p className="text-[16px] text-[#CAD0DA]">
                  until {nextSegment.title} at {clock(nextForecast!.startMs!)}. The host is waiting for a committed time; the
                  broadcast clock keeps running.
                </p>
              </>
            ) : (
              <p className="text-[20px] font-medium text-[#F5F7FC] mt-1">Ready to start {nextSegment.title}.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 flex-1 flex flex-col justify-center">
            <p className="text-[22px] font-medium text-[#F5F7FC]">Every segment has run or been skipped.</p>
            <p className="text-[16px] text-[#B7C1CE] mt-1">End LIVE to freeze the record and open Review.</p>
          </div>
        )}
      </section>
    );
  }

  // ---- A segment is running ----------------------------------------------------------------
  const startedAt = run.startedAtMs;
  const elapsedSec = Math.max(0, Math.round((nowMs - startedAt) / 1000));
  const targetSec = segment.targetSec ?? 0;
  const minSec = segment.minSec;
  const over = elapsedSec - targetSec;
  const estimateSec = run.remainingEstimate ? Math.round((run.remainingEstimate.endsAtMs - startedAt) / 1000) : null;
  const guardSec = guard && guard.latestFreeMs !== null ? Math.round((guard.latestFreeMs - startedAt) / 1000) : null;

  const scale = Math.max(targetSec, elapsedSec, estimateSec ?? 0, guardSec ?? 0, minSec ?? 0, 1) * 1.06;
  const pct = (sec: number): string => `${Math.min(100, Math.max(0, (sec / scale) * 100))}%`;

  const endLine =
    active?.basis === "estimate"
      ? {
          tone: "violet" as const,
          text:
            run.remainingEstimate && run.remainingEstimate.endsAtMs === run.remainingEstimate.reportedAtMs
              ? `Host: wrapping up now (0:00 left) · not ended until you record it`
              : `Ends ${clock(active.endMs)} · host estimate`,
        }
      : active?.basis === "target"
        ? { tone: "neutral" as const, text: `Ends ${clock(active.endMs)} · planned target` }
        : active?.basis === "declared_unknown"
          ? { tone: "warn" as const, text: `Host: remaining time unknown · earliest end ${clock(nowMs)}` }
          : { tone: "warn" as const, text: `End unknown · earliest possible ${clock(nowMs)}` };
  const hasHostInput = run.remainingEstimate !== null || run.remainingUnknownAtMs !== null;

  const submitEstimate = (): void => {
    if (minutes.trim() === "") return; // nothing entered is not zero
    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 0 || m > 60) return;
    onSetEstimate(Math.round(m * 60)); // 0 = wrapping up now; it does not end the segment
    setEditing(false);
    setMinutes("");
  };

  return (
    <section data-testid="now-panel" aria-label="Now" className="rounded-[12px] bg-[#13161C] p-3 [@media(min-height:740px)]:p-4 flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[16px] leading-5 font-semibold tracking-[1.5px] text-[#DFFF00] uppercase">NOW</span>
        <Signal tone="lime" icon="ri-record-circle-line" size="desk">
          Segment {position.index} of {position.total} · started {clock(startedAt)}
        </Signal>
      </div>

      <div key={segment.id} className="mt-3 [@media(max-height:800px)]:mt-2 flex items-center gap-4 min-w-0 motion-safe:animate-content-in">
        <SegmentTile segment={segment} product={product} size={64} active />
        <div className="min-w-0">
          <h2 className="text-[24px] leading-tight font-medium tracking-tight text-[#F5F7FC] truncate" data-testid="now-title">
            {segment.title}
          </h2>
          {segment.cue && <p className="text-[16px] leading-6 text-[#B7C1CE] truncate">Cue: {segment.cue}</p>}
        </div>
      </div>

      <div className="mt-3 [@media(max-height:800px)]:mt-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-[16px] leading-5 text-[#AEB7C5]" title="Time this segment has actually been running — not the planned target, and not the whole show.">
            Segment elapsed
          </p>
          <p
            data-testid="now-actual-elapsed"
            className={`text-[44px] leading-none font-medium tabular-nums tracking-tight mt-1 ${over > 0 ? "text-[#F6C875]" : "text-[#F5F7FC]"}`}
          >
            {formatDuration(elapsedSec)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[16px] font-medium tabular-nums text-[#F5F7FC]">
            {over > 0 ? `${formatDuration(over)} over target` : `${formatDuration(-over)} to target`}
          </p>
          <p className="text-[16px] leading-6 text-[#B7C1CE] tabular-nums">
            Planned target {formatDuration(targetSec)}
            {minSec !== null ? ` · min ${formatDuration(minSec)}` : " · no minimum set"}
          </p>
        </div>
      </div>

      <div className="mt-3 [@media(max-height:800px)]:mt-2" aria-hidden="true">
        <div className="relative h-3 rounded-full bg-[#232935] overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-[#DFFF00]" style={{ width: pct(Math.min(elapsedSec, targetSec)) }} />
          {over > 0 && (
            <div
              className="absolute inset-y-0 bg-[#F6C875]"
              style={{ left: pct(targetSec), width: `calc(${pct(elapsedSec)} - ${pct(targetSec)})` }}
            />
          )}
        </div>
        <div className="relative h-3">
          {minSec !== null && <span className="absolute -top-3 w-px h-3 bg-[#8A95A5]" style={{ left: pct(minSec) }} />}
          <span className="absolute -top-3 w-0.5 h-3 bg-[#F5F7FC]" style={{ left: pct(targetSec) }} />
          {guardSec !== null && <span className="absolute -top-3 w-1 h-3 rounded-sm bg-[#F4A4A4]" style={{ left: pct(guardSec) }} />}
        </div>
      </div>

      <div className="mt-1.5 space-y-0.5">
        {editing ? (
          <div className="flex items-center gap-2 min-h-[44px]">
            <label htmlFor="host-estimate" className="text-[16px] text-[#CAD0DA] whitespace-nowrap">
              Host needs
            </label>
            <input
              id="host-estimate"
              data-testid="estimate-input"
              type="number"
              min={0}
              max={60}
              step={0.5}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEstimate();
              }}
              data-autofocus
              className="w-[76px] h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-2 text-[16px] text-[#F5F7FC] tabular-nums"
            />
            <span className="text-[16px] text-[#CAD0DA]">more min</span>
            <Button size="deskPrimary" variant="primary" onClick={submitEstimate} data-testid="estimate-set-btn" disabled={minutes.trim() === ""}>
              Set
            </Button>
            <Button
              size="desk"
              variant="secondary"
              onClick={() => {
                onMarkUnknown();
                setEditing(false);
              }}
              data-testid="estimate-unknown-btn"
              title="The host cannot say how long is left. LiveLift stops projecting the end from the target."
            >
              Unknown
            </Button>
            <Button size="desk" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 min-h-[44px]">
            <Signal tone={endLine.tone} icon={endLine.tone === "warn" ? "ri-question-line" : "ri-flag-line"} className="tabular-nums" size="desk" title={endLine.text}>
              <span data-testid="now-end-line">{`${endLine.text}${run.remainingEstimate && run.remainingEstimate.endsAtMs !== run.remainingEstimate.reportedAtMs ? ` (set ${clock(run.remainingEstimate.reportedAtMs)})` : ""}`}</span>
            </Signal>
            <span className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid="estimate-open-btn"
                title="Enter how long the host says is left. It is the host's own estimate: it does not change the planned target or the plan (use Extend for that)."
                className="min-h-[44px] px-2.5 rounded-[8px] text-[16px] font-medium text-[#CAD0DA] hover:text-[#DFFF00] hover:bg-[#1B2028] cursor-pointer"
              >
                {hasHostInput ? "Edit host time" : "Host time left"}
              </button>
              {hasHostInput && (
                <button
                  type="button"
                  onClick={() => onSetEstimate(null)}
                  data-testid="estimate-clear-btn"
                  className="min-h-[44px] px-2.5 rounded-[8px] text-[16px] font-medium text-[#CAD0DA] hover:text-[#DFFF00] hover:bg-[#1B2028] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </span>
          </div>
        )}
        {guard && guard.latestFreeMs !== null && (
          <Signal tone="neutral" icon="ri-lock-2-line" className="tabular-nums" size="desk">
            Must end by {clock(guard.latestFreeMs)} to keep its {clock(guard.committedMs)} commitment
          </Signal>
        )}
      </div>
    </section>
  );
}
