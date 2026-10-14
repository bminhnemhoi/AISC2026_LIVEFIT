"use client";

import React, { useState } from "react";
import type { ProductSnapshot } from "@/contracts";
import type { HistoryItem, Review, ReviewAction, ReviewCue, ReviewRow } from "@/lib/domain";
import { MANUAL_ACTION_LABEL, formatClock, formatDuration, formatSigned } from "@/lib/domain";
import { Button, Dialog } from "@/components/ui";
import { afterResult } from "@/lib/client/commandText";
import { SegmentTile } from "./SegmentTile";
import { Signal, type Tone } from "./StatusChips";
import { CUE_ACTION_LABEL } from "./CueBar";

// ---------------------------------------------------------------------------------------------
// Summary strip — a few honest sentences, not a wall of KPI cards.
// ---------------------------------------------------------------------------------------------

export function ReviewSummary({ review, tz }: { review: Review; tz: string }): React.ReactElement {
  const s = review.summary;
  const a = s.anchors;
  const c = s.cues;
  const clock = (ms: number): string => formatClock(ms, tz, true);
  const groups: Array<{ label: string; tone: Tone; value: string; sub: string }> = [
    {
      label: "Tracked",
      tone: s.finishVarianceSec !== null && s.finishVarianceSec > 15 ? "warn" : "neutral",
      value: formatDuration(s.trackedSec),
      sub:
        s.baselineSpanSec !== null
          ? `plan ${formatDuration(s.baselineSpanSec)}${s.finishVarianceSec !== null ? ` · finish ${s.finishVarianceSec === 0 ? "on plan" : formatSigned(s.finishVarianceSec)}` : ""}`
          : "plan incomplete",
    },
    {
      label: "Hard anchors",
      tone: a.late + a.cancelled > 0 ? "warn" : "neutral",
      value: a.total === 0 ? "None" : `${a.onTime}/${a.total} on time`,
      sub:
        a.total === 0
          ? "every segment floated"
          : [a.late > 0 ? `${a.late} late` : "", a.cancelled > 0 ? `${a.cancelled} cancelled` : "", a.reAnchored > 0 ? `${a.reAnchored} re-anchored` : "", a.notReached > 0 ? `${a.notReached} not reached` : ""]
              .filter(Boolean)
              .join(" · ") || "no misses",
    },
    {
      label: "Segments",
      tone: s.counts.overran + s.counts.skipped + s.counts.notReached > 0 ? "warn" : "neutral",
      value: `${s.counts.completed + s.counts.closedEarly + s.counts.endedWithShow} ran`,
      sub:
        [
          s.counts.overran > 0 ? `${s.counts.overran} overran` : "",
          s.counts.closedEarly > 0 ? `${s.counts.closedEarly} closed early` : "",
          s.counts.skipped > 0 ? `${s.counts.skipped} skipped` : "",
          s.counts.notReached > 0 ? `${s.counts.notReached} not reached` : "",
          s.counts.incomplete > 0 ? `${s.counts.incomplete} incomplete record${s.counts.incomplete === 1 ? "" : "s"}` : "",
          s.counts.coveragePartial > 0 ? `${s.counts.coveragePartial} unfinished` : "",
          s.counts.deferred > 0 ? `${s.counts.deferred} deferred` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "all on plan",
    },
    {
      label: "Operator cues",
      tone: c.late + c.noReport + c.cancelled > 0 ? "warn" : "neutral",
      value: c.operatorTotal === 0 ? "None" : `${c.performed + c.attempted}/${c.operatorTotal} reported`,
      sub:
        c.operatorTotal === 0
          ? "no operator cues planned"
          : [
              c.attempted > 0 ? `${c.attempted} attempted, outcome unknown` : "",
              c.late > 0 ? `${c.late} late` : "",
              c.noReport > 0 ? `${c.noReport} no report (unknown)` : "",
              c.cancelled > 0 ? `${c.cancelled} cancelled` : "",
              s.actions.total > 0 ? `${s.actions.total} unplanned` : "",
              "unverified",
            ]
              .filter(Boolean)
              .join(" · "),
    },
  ];

  return (
    <div className="shrink-0" data-testid="review-summary">
      <p className="text-[14px] text-[#9AA5B5] tabular-nums">
        {clock(s.startedAtMs)} → {clock(s.endedAtMs)} · recorded from this show&apos;s commands only
      </p>
      <p className="text-[13px] text-[#9AA5B5] mt-0.5" data-testid="review-reading-note">
        How to read this: “reported” is the operator&apos;s word, not platform confirmation, and an attempt is not a performed action.
        Unknown or unverified means the outcome lacks confirmation. A report or attempt may still be recorded; no report means no operator report was recorded. These are not failures.
      </p>
      <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
        {groups.map((g) => (
          <div key={g.label} className="min-w-0">
            <p className="text-[12px] tracking-[1.2px] uppercase text-[#AEB7C5]">{g.label}</p>
            <p className={`text-[20px] leading-tight font-medium tabular-nums ${g.tone === "warn" ? "text-[#F6C875]" : "text-[#F5F7FC]"}`}>{g.value}</p>
            <p className="text-[13px] text-[#9AA5B5] line-clamp-2" title={g.sub}>{g.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Plan vs Actual rows
// ---------------------------------------------------------------------------------------------

const OUTCOME: Record<ReviewRow["outcome"], { text: string; tone: Tone; icon: string }> = {
  completed: { text: "Completed", tone: "neutral", icon: "ri-checkbox-circle-line" },
  closed_early: { text: "Closed early", tone: "warn", icon: "ri-skip-forward-line" },
  ended_with_show: { text: "Ended with show", tone: "muted", icon: "ri-stop-circle-line" },
  skipped: { text: "Skipped", tone: "warn", icon: "ri-skip-forward-line" },
  not_reached: { text: "Not reached", tone: "muted", icon: "ri-subtract-line" },
  incomplete: { text: "Incomplete record", tone: "warn", icon: "ri-question-line" },
};

export function PlanActualRows({
  rows,
  products,
  tz,
}: {
  rows: ReviewRow[];
  products: ProductSnapshot[];
  tz: string;
}): React.ReactElement {
  const productById = new Map(products.map((p) => [p.id, p]));
  const clock = (ms: number): string => formatClock(ms, tz, true);

  return (
    <div role="table" aria-label="Plan vs Actual" data-testid="plan-actual-table" className="text-[14px]">
      <div role="row" className="hidden md:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-3 px-2 pb-1 text-[12px] tracking-[1.2px] uppercase text-[#AEB7C5]">
        <span role="columnheader">Segment</span>
        <span role="columnheader">Plan (baseline)</span>
        <span role="columnheader">Actual</span>
        <span role="columnheader">Variance</span>
      </div>
      <div className="divide-y divide-[#1F2530]">
        {rows.map((r) => {
          const out = OUTCOME[r.outcome];
          const ranOutcome = r.outcome === "completed" || r.outcome === "closed_early";
          const product = r.productId ? (productById.get(r.productId) ?? null) : null;
          return (
            <div
              role="row"
              key={r.segmentId}
              data-testid={`review-row-${r.segmentId}`}
              data-outcome={r.outcome}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-x-3 gap-y-1 px-2 py-2.5"
            >
              <div role="cell" className="flex items-center gap-3 min-w-0">
                <SegmentTile segment={{ kind: r.kind, title: r.title }} product={product} size={36} />
                <div className="min-w-0">
                  <p className="text-[16px] font-medium text-[#F5F7FC] truncate">{r.title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Signal
                      tone={out.tone}
                      icon={out.icon}
                      title={ranOutcome ? "The segment ran and was closed. That does not mean everything planned was covered — coverage is declared separately." : undefined}
                    >
                      {out.text}
                      {ranOutcome && ` · ${r.coverage === "complete" ? "coverage complete (declared)" : r.coverage === "partial" ? "coverage partial" : "coverage not declared"}`}
                    </Signal>
                    {r.actualOrder !== null && r.plannedRank !== null && r.actualOrder !== r.plannedRank && (
                      <Signal tone="muted" className="text-[13px]" title="Order among the segments that ran">
                        ran #{r.actualOrder}, planned #{r.plannedRank}
                      </Signal>
                    )}
                  </div>
                </div>
              </div>

              <div role="cell" className="tabular-nums">
                {r.baseline ? (
                  <>
                    <p className="text-[#E4E8F0]">
                      {clock(r.baseline.startMs)}–{clock(r.baseline.endMs)}
                    </p>
                    <p className="text-[#9AA5B5]">{formatDuration(r.baseline.durSec)} planned</p>
                  </>
                ) : (
                  <p className="text-[#9AA5B5]">Not in baseline</p>
                )}
                {r.anchor && (
                  <Signal tone="neutral" icon="ri-lock-2-line" className="text-[13px]">
                    Hard anchor {clock(r.anchor.committedMs)}
                  </Signal>
                )}
              </div>

              <div role="cell" className="tabular-nums">
                {r.actual ? (
                  <>
                    <p className="text-[#E4E8F0]">
                      {clock(r.actual.startMs)}–{clock(r.actual.endMs)}
                    </p>
                    <p className="text-[#9AA5B5]">{formatDuration(r.actual.durSec)} actual</p>
                  </>
                ) : r.outcome === "incomplete" ? (
                  <p className="text-[#F6C875]" data-testid="incomplete-actual">
                    {r.recordedStartMs !== null ? `Started ${clock(r.recordedStartMs)} · end not recorded` : "Start not recorded"}
                  </p>
                ) : (
                  <p className="text-[#9AA5B5]" data-testid="no-actual">
                    {r.outcome === "skipped" ? "Skipped — nothing performed" : "Did not run"}
                  </p>
                )}
              </div>

              <div role="cell" className="space-y-0.5">
                {r.durationVarianceSec !== null ? (
                  <Signal tone={r.overran ? "warn" : "neutral"} className="tabular-nums font-medium">
                    {r.durationVarianceSec === 0 ? "on plan" : `${formatSigned(r.durationVarianceSec)} duration`}
                  </Signal>
                ) : (
                  <Signal tone="muted">{r.outcome === "incomplete" ? "duration unavailable" : "no actual to compare"}</Signal>
                )}
                {r.anchor && (
                  <div>
                    {r.anchor.status === "on_time" && <Signal tone="neutral" icon="ri-checkbox-circle-line">anchor met</Signal>}
                    {r.anchor.status === "late" && (
                      <Signal tone="warn" icon="ri-time-line">anchor late {formatDuration(r.anchor.lateBySec ?? 0)}</Signal>
                    )}
                    {r.anchor.status === "cancelled" && <Signal tone="warn" icon="ri-close-circle-line">commitment cancelled</Signal>}
                    {r.anchor.status === "not_reached" && <Signal tone="muted">anchor not reached</Signal>}
                    {r.anchor.reAnchored && (
                      <Signal tone="warn" icon="ri-lock-unlock-line" className="text-[13px]">
                        re-anchored {clock(r.anchor.committedMs)} → {clock(r.anchor.currentCommittedMs)}
                      </Signal>
                    )}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {r.belowMinimum && <Signal tone="warn" className="text-[13px]">below minimum</Signal>}
                  {r.coverage === "partial" && <Signal tone="warn" className="text-[14px]">coverage partial (declared)</Signal>}
                  {r.coverage === "complete" && <Signal tone="neutral" className="text-[14px]">coverage complete (declared)</Signal>}
                  {r.coverage === null && r.actual !== null && r.outcome !== "ended_with_show" && (
                    <Signal tone="muted" className="text-[14px]" title="The segment ended, but nobody declared whether everything planned was covered. That is unknown — not complete, not failed.">
                      coverage not declared · unknown
                    </Signal>
                  )}
                  {r.followUp && (
                    <Signal tone="warn" icon="ri-arrow-go-forward-line" className="text-[14px]" title="A manual follow-up the operator declared. Not moved anywhere automatically.">
                      follow-up: {r.followUp}
                    </Signal>
                  )}
                  {r.deferred && <Signal tone="muted" className="text-[13px]">deferred</Signal>}
                  {r.planChanges.length > 0 && (
                    <Signal tone="violet" icon="ri-file-edit-line" className="text-[13px]" title={r.planChanges.join("\n")}>
                      {r.planChanges.length} plan change{r.planChanges.length === 1 ? "" : "s"}
                    </Signal>
                  )}
                  {r.corrections.length > 0 && (
                    <Signal tone="violet" icon="ri-history-line" className="text-[13px]" title={r.corrections.map((c) => c.text).join("\n")}>
                      correction recorded
                    </Signal>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Cue results
// ---------------------------------------------------------------------------------------------

function cueStatus(c: ReviewCue): { tone: Tone; icon: string; text: string } {
  switch (c.state) {
    case "performed":
      return { tone: "neutral", icon: "ri-hand-heart-line", text: "Operator reported performed" };
    case "attempted":
      return { tone: "warn", icon: "ri-cursor-line", text: "Operator reported an attempt — outcome unknown" };
    case "cancelled":
      return { tone: "warn", icon: "ri-close-circle-line", text: `Cancelled${c.reason ? `: ${c.reason}` : ""}` };
    case "no_report":
      return { tone: "muted", icon: "ri-question-line", text: "No report recorded (unknown, not failed)" };
    case "informational":
      return { tone: "muted", icon: "ri-information-line", text: "Presenter cue — no report expected" };
  }
}

export function CueResults({ cues, tz }: { cues: ReviewCue[]; tz: string }): React.ReactElement {
  const clock = (ms: number): string => formatClock(ms, tz, true);
  if (cues.length === 0) return <p className="text-[14px] text-[#9AA5B5]">No cues were planned.</p>;
  return (
    <ul className="divide-y divide-[#1F2530]" data-testid="cue-results">
      {cues.map((c) => {
        const st = cueStatus(c);
        return (
          <li key={c.cueId} className="py-2 px-2 grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-0.5 items-start" data-testid={`cue-result-${c.state}`}>
            <div className="min-w-0">
              <p className="text-[15px] text-[#F5F7FC] truncate">
                <i className="ri-focus-3-line mr-1.5 text-[#8A95A5]" aria-hidden="true" />
                {c.title}
              </p>
              <p className="text-[13px] text-[#9AA5B5]">
                {c.audience === "operator" ? "Operator" : "Presenter"}
                {c.action !== "none" ? ` · ${CUE_ACTION_LABEL[c.action]}` : ""}
                {c.segmentTitle ? ` · ${c.segmentTitle}` : ""} · 0:00 host time
              </p>
            </div>
            <p className="text-[14px] tabular-nums text-[#CAD0DA]">
              {c.orphaned ? "segment skipped" : c.dueMs !== null ? `due ${clock(c.dueMs)}` : "due time unknown"}
              {c.occurredAtMs !== null && (
                <span className="text-[#9AA5B5]">
                  {" · "}happened {clock(c.occurredAtMs)}
                  {c.lateBySec !== null && Math.abs(c.lateBySec) >= 15 && (
                    <span className={c.lateBySec > 0 ? "text-[#F6C875]" : ""}> ({formatSigned(c.lateBySec)})</span>
                  )}
                </span>
              )}
            </p>
            <div>
              <Signal tone={st.tone} icon={st.icon}>{st.text}</Signal>
              {c.state === "performed" || c.state === "attempted" ? (
                <p className="text-[12px] text-[#9AA5B5]">Platform verification: Unknown — a report is not confirmation.</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ActionResults({ actions, tz }: { actions: ReviewAction[]; tz: string }): React.ReactElement {
  const clock = (ms: number): string => formatClock(ms, tz, true);
  return (
    <ul className="divide-y divide-[#1F2530]" data-testid="action-results">
      {actions.map((a) => (
        <li key={a.actionId} className="py-2 px-2 grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-0.5 items-start" data-testid={`action-result-${a.state}`}>
          <p className="text-[15px] text-[#F5F7FC] truncate">
            {MANUAL_ACTION_LABEL[a.action]} {a.targetLabel}
          </p>
          <p className="text-[14px] tabular-nums text-[#CAD0DA]">
            {a.occurredAtMs !== null ? `happened ${clock(a.occurredAtMs)}` : "did not happen"} · reported {clock(a.reportedAtMs)}
          </p>
          <div>
            <Signal tone={a.state === "attempted" ? "warn" : a.state === "cancelled" ? "muted" : "neutral"} icon={a.state === "attempted" ? "ri-cursor-line" : "ri-hand-heart-line"}>
              {a.state === "performed"
                ? "Operator reported performed"
                : a.state === "attempted"
                  ? "Attempted — outcome unknown (unresolved)"
                  : `Attempt withdrawn${a.reason ? `: ${a.reason}` : ""}`}
            </Signal>
            <p className="text-[13px] text-[#9AA5B5]">Platform verification: Unknown — a report is not confirmation.</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// History (append-only) with corrections
// ---------------------------------------------------------------------------------------------

export function HistoryList({
  items,
  tz,
  canAppend,
  onNote,
  onCorrect,
}: {
  items: HistoryItem[];
  tz: string;
  canAppend: boolean;
  /** A rehearsal answers at once; a REAL show answers when the room has (true = recorded, false = keep the input). */
  onNote: (text: string) => void | boolean | Promise<boolean>;
  onCorrect: (targetEventId: string, text: string) => void | boolean | Promise<boolean>;
}): React.ReactElement {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<HistoryItem | null>(null);
  const [correction, setCorrection] = useState("");

  return (
    <div className="flex flex-col min-h-0 flex-1" data-testid="review-history">
      <div className="flex items-center justify-between pb-2 shrink-0">
        <h3 className="text-[16px] font-medium text-[#F5F7FC]">Actual history</h3>
        {canAppend && (
          <Button variant="ghost" size="sm" icon="ri-edit-line" onClick={() => setNoteOpen(true)} data-testid="review-add-note-btn">
            Add note
          </Button>
        )}
      </div>
      <ol tabIndex={0} aria-label="Actual history records" className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#1F2530] pr-1 focus-visible:outline-2 focus-visible:outline-[#DFFF00]">
        {items.map((h) => (
          <li key={h.id} className="py-2 flex gap-3 items-start" data-testid={`history-${h.type}`}>
            <span className="text-[13px] tabular-nums font-mono text-[#AEB7C5] w-[64px] shrink-0 pt-0.5">{formatClock(h.occurredAtMs, tz, true)}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-[14px] leading-snug ${h.type === "correction_added" ? "text-[#C8B2FF]" : "text-[#F5F7FC]"}`}>{h.summary}</p>
              <div className="flex items-center gap-3 flex-wrap mt-0.5">
                <Signal tone="muted" className="text-[13px]">{h.actor} · {h.source === "simulator" ? "Simulator" : "Operator"}</Signal>
                {Math.abs(h.recordedAtMs - h.occurredAtMs) >= 1000 && (
                  <Signal tone="violet" icon="ri-history-line" className="text-[13px]">recorded {formatClock(h.recordedAtMs, tz, true)}</Signal>
                )}
                {h.correctedBy.length > 0 && <Signal tone="violet" className="text-[13px]">correction appended</Signal>}
                {canAppend && h.type !== "correction_added" && (
                  <button
                    type="button"
                    onClick={() => {
                      setTarget(h);
                      setCorrection("");
                    }}
                    className="min-h-[44px] inline-flex items-center text-[14px] text-[#CAD0DA] hover:text-[#DFFF00] underline decoration-[#4B5665] underline-offset-4 cursor-pointer"
                    data-testid={`correct-${h.id}`}
                  >
                    Record correction
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <Dialog
        isOpen={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add a note"
        confirmText="Save note"
        confirmDisabled={note.trim() === ""}
        onConfirm={() =>
          afterResult(onNote(note), () => {
            setNote("");
            setNoteOpen(false);
          })
        }
      >
        <textarea
          data-autofocus
          aria-label="Note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          className="w-full bg-[#13161C] border border-[#39414D] rounded-[8px] p-3 text-[15px] text-[#F5F7FC]"
        />
        <p className="text-[13px] text-[#9AA5B5] mt-2">Notes are appended after the show. They never rewrite what happened.</p>
      </Dialog>

      <Dialog
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        title="Record a correction"
        confirmText="Append correction"
        confirmDisabled={correction.trim().length < 3}
        onConfirm={() => {
          if (!target) return setTarget(null);
          afterResult(onCorrect(target.id, correction), () => setTarget(null));
        }}
      >
        <div className="space-y-3" data-testid="correction-dialog">
          <p className="text-[14px] text-[#CAD0DA]">
            Correcting: <span className="text-[#F5F7FC]">{target?.summary}</span>
          </p>
          <input
            data-autofocus
            aria-label="Correction: what was actually true"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="What was actually true?"
            className="w-full h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[16px] text-[#F5F7FC]"
            data-testid="correction-input"
          />
          <p className="text-[13px] text-[#9AA5B5]">The original record stays as recorded; the correction is added beside it with your name and time.</p>
        </div>
      </Dialog>
    </div>
  );
}
