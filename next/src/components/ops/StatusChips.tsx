import React from "react";
import type { AnchorForecast } from "@/lib/domain";
import { formatAnchorLate, formatClock, formatDuration, formatSigned, isAnchorDueNow } from "@/lib/domain";

/**
 * Status signals: text + icon + colour (colour is secondary). No pill ladder.
 * Amber warns, red is controlled, violet marks SIMULATED/evidence, lime marks the one live action, cyan marks AI assistance.
 */

export type Tone = "neutral" | "lime" | "warn" | "danger" | "violet" | "muted" | "ai" | "ink";

/**
 * `desk` is the operating-desk reading size: operational status and metadata are 16px there, on a
 * 20px line so single-line chips stay compact. Other screens keep the compact default.
 * Desk callers must not add their own text-size class: two `text-[Npx]` utilities on one element
 * resolve by stylesheet order, not by their order in the class list.
 */
export type SignalSize = "default" | "desk";
const SIGNAL_SIZE: Record<SignalSize, string> = {
  default: "text-[14px] leading-5",
  desk: "text-[16px] leading-5",
};

const TONE: Record<Tone, string> = {
  neutral: "text-[#CAD0DA]",
  lime: "text-[#DFFF00]",
  warn: "text-[#F6C875]",
  danger: "text-[#F4A4A4]",
  violet: "text-[#C8B2FF]",
  muted: "text-[#9AA5B5]",
  ai: "text-[#7DD8EA]",
  /** Provider-observed evidence (V7 later evidence): a quiet cool ink, never lime, cyan or violet. */
  ink: "text-[#B4C6DD]",
};

export function Signal({
  tone = "neutral",
  icon,
  children,
  className = "",
  title,
  size = "default",
}: {
  tone?: Tone;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  size?: SignalSize;
}): React.ReactElement {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 ${SIGNAL_SIZE[size]} ${TONE[tone]} ${className}`}>
      {icon && <i className={icon} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

/** The hard-anchor commitment, always shown as a lock + committed clock time. */
export function AnchorBadge({
  committedMs,
  tz,
  className = "",
  size = "default",
}: {
  committedMs: number;
  tz: string;
  className?: string;
  size?: SignalSize;
}): React.ReactElement {
  return (
    <Signal tone="neutral" icon="ri-lock-2-line" className={className} size={size} title="Hard anchor: this commitment does not move unless you re-anchor it explicitly">
      <span className="tabular-nums">Hard anchor {formatClock(committedMs, tz, true)}</span>
    </Signal>
  );
}

export function anchorSignal(
  anchor: AnchorForecast,
  tz: string
): { tone: Tone; icon: string; text: string } {
  const late = formatAnchorLate(anchor);
  switch (anchor.status) {
    case "on_track":
      return {
        tone: "neutral",
        icon: "ri-checkbox-circle-line",
        text: anchor.bufferSec > 0 ? `On track · ${formatDuration(anchor.bufferSec)} buffer` : "On track · no buffer",
      };
    case "at_risk":
      return { tone: "warn", icon: "ri-error-warning-line", text: `At risk · ${late} late` };
    case "possible_risk":
      return {
        tone: "warn",
        icon: "ri-question-line",
        text: `Possible risk · up to ${formatDuration(anchor.bufferSec)} buffer, end unknown`,
      };
    case "missed":
      // At the exact anchor instant nothing is late yet. The commitment time has arrived and the segment
      // has not started — say that. Any real lateness, even under a second, is a miss. The forecast is unchanged.
      if (isAnchorDueNow(anchor)) return { tone: "warn", icon: "ri-time-line", text: "Due now · not started yet" };
      return { tone: "danger", icon: "ri-time-line", text: `Missed · ${late} late` };
    case "met":
      return { tone: "neutral", icon: "ri-checkbox-circle-line", text: `Met at ${formatClock(anchor.projectedStartMs, tz, true)}` };
    case "met_late":
      return { tone: "warn", icon: "ri-history-line", text: `Met late · ${late}` };
  }
}

export function AnchorStatus({ anchor, tz, size = "default" }: { anchor: AnchorForecast; tz: string; size?: SignalSize }): React.ReactElement {
  const s = anchorSignal(anchor, tz);
  return (
    <Signal tone={s.tone} icon={s.icon} size={size}>
      {s.text}
    </Signal>
  );
}

/** Drift against the immutable baseline. Positive = later than committed. */
export function Drift({
  seconds,
  lowerBound = false,
  className = "",
  size = "default",
}: {
  seconds: number | null;
  lowerBound?: boolean;
  className?: string;
  size?: SignalSize;
}): React.ReactElement | null {
  if (seconds === null) return null;
  if (seconds === 0) return <Signal tone="muted" className={className} size={size}>on plan</Signal>;
  return (
    <Signal tone={seconds > 0 ? "warn" : "neutral"} className={`tabular-nums ${className}`} size={size}>
      {lowerBound && seconds > 0 ? "≥ " : ""}
      {formatSigned(seconds)}
    </Signal>
  );
}
