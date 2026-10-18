"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/contracts";
import {
  addDaysZoned,
  applyChangeOps,
  assessPlan,
  baselinePlan,
  buildReview,
  diffPlans,
  formatClock,
  formatDay,
  formatDuration,
  msToZonedParts,
  proposeChanges,
  setPlannedStart,
  zonedTimeToMs,
  type ProposedChange,
} from "@/lib/domain";
import { Button } from "@/components/ui";
import { Signal } from "./StatusChips";
import type { GateContext } from "./SessionGate";
import { sessionStore } from "@/lib/store/sessionStore";
import { useRemoteCommands } from "@/lib/store/hooks";
import type { ReviewAvailable } from "@/contracts/ai";
import { LayerLabel, StateChip, phaseMessage } from "@/components/ai/CopilotParts";
import type { AiCopilot } from "@/components/ai/useAiCopilot";

const INPUT = "w-full h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[16px] text-[#F5F7FC]";

/**
 * Next LIVE. Selected adjustments become a NEW plan with new ids and an empty actual history.
 * The source show is never edited. Infeasible selections are shown, not hidden.
 */
export function NextLivePanel({
  session,
  ctx,
  aiCopilot,
  onAskAi,
}: {
  session: Session;
  ctx?: GateContext;
  /** The Review Copilot, when this show can have one. It only ANNOTATES proposals: it never selects, applies or creates anything. */
  aiCopilot?: AiCopilot<ReviewAvailable>;
  onAskAi?: () => void;
}): React.ReactElement {
  const router = useRouter();
  const commands = useRemoteCommands();
  const isRemote = ctx?.source === "remote";
  const archive = ctx?.archive === true;
  const [submitting, setSubmitting] = useState(false);
  const tz = session.timezone;
  const base = baselinePlan(session);
  const proposals = useMemo(() => proposeChanges(session), [session]);
  // Coverage and follow-ups the operator declared in THIS show. Shown beside proposals for context only:
  // they are never selectable, never copied, and never turned into a change on the operator's behalf.
  const rowBySegment = useMemo(() => new Map((buildReview(session)?.rows ?? []).map((r) => [r.segmentId, r])), [session]);
  const openNotes = [...rowBySegment.values()].filter((r) => r.followUp || r.coverage === "partial");
  const coverageNote = (segmentId: string): string | null => {
    const r = rowBySegment.get(segmentId);
    if (!r) return null;
    if (r.coverage === "partial") return `Coverage partial${r.followUp ? ` · follow-up: ${r.followUp}` : ""}`;
    if (r.followUp) return `Follow-up: ${r.followUp}`;
    if (r.coverage === "complete") return "Coverage declared complete";
    if (r.outcome === "completed" || r.outcome === "closed_early") return "Coverage not declared (unknown, not a failure)";
    return null;
  };

  const defaultStart = useMemo(() => addDaysZoned(base.plannedStartMs, 1, tz), [base.plannedStartMs, tz]);
  const startParts = msToZonedParts(defaultStart, tz);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState(`${session.title} · Next LIVE`);
  const [date, setDate] = useState(startParts.date);
  const [time, setTime] = useState(startParts.time);
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI suggestions: recommendations only. A suggestion for something that is no longer proposed, or an answer about an
  // older record of this show, is ignored. Selecting is the operator's own act (the button below, or the checkboxes).
  const aiResult = aiCopilot?.result && aiCopilot.result.basis.revision === session.revision ? aiCopilot.result : null;
  const aiById = new Map((aiResult?.output.nextLive ?? []).filter((s) => proposals.some((p) => p.id === s.change.id)).map((s) => [s.change.id, s]));
  const aiMessage = aiCopilot ? phaseMessage(aiCopilot.phase, aiCopilot.failure) : null;
  const selectSuggested = (): void => {
    setAcknowledged(false);
    setSelected((prev) => new Set([...prev, ...aiById.keys()]));
  };

  const chosen: ProposedChange[] = proposals.filter((p) => selected.has(p.id));
  const plannedStartMs = zonedTimeToMs(date, time, tz);
  const previewBase = useMemo(() => setPlannedStart(base, plannedStartMs ?? base.plannedStartMs), [base, plannedStartMs]);
  const preview = useMemo(() => applyChangeOps(previewBase, chosen.map((c) => c.op)), [previewBase, chosen]);
  const baseAssess = useMemo(() => assessPlan(base, session.products, tz), [base, session.products, tz]);
  const assess = useMemo(() => assessPlan(preview, session.products, tz), [preview, session.products, tz]);
  const diff = useMemo(() => diffPlans(previewBase, preview), [previewBase, preview]);
  const late = assess.anchors.filter((a) => a.deficitSec > 0);
  const clock = (ms: number): string => formatClock(ms, tz, true);

  const toggle = (id: string): void => {
    setAcknowledged(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // A pre-Phase-2 archive is never turned into a room show here (nothing is uploaded or merged silently).
  const writable = archive ? false : isRemote ? commands.canWrite : true;
  const canCreate = title.trim() !== "" && plannedStartMs !== null && (late.length === 0 || acknowledged) && writable && !submitting;

  const create = async (): Promise<void> => {
    if (!canCreate || plannedStartMs === null) return;
    setError(null);
    if (isRemote) {
      // The room creates the next show (new id, its own clock, no runtime copied) and answers with a receipt.
      setSubmitting(true);
      try {
        const outcome = await commands.submit({
          body: { type: "create_next", title, plannedStartMs, changeIds: chosen.map((c) => c.id), note },
          sessionId: session.id,
        });
        if (outcome.status === "committed" && outcome.receipt.sessionId) router.push(`/live/${outcome.receipt.sessionId}/prepare`);
        else if (outcome.status === "committed") setError("The room recorded the next show but did not say which one. Open it from Sessions.");
        else setError(outcome.status === "unknown" ? `${outcome.message} Check it above before creating the next show again.` : outcome.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const result = sessionStore.createNext(session.id, {
      title,
      plannedStartMs,
      changeIds: chosen.map((c) => c.id),
      note,
    });
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    router.push(`/live/${result.session.id}/prepare`);
  };

  const groups: Array<{ key: ProposedChange["basis"]; label: string; hint: string }> = [
    { key: "observed", label: "Observed in this show", hint: "What actually happened, from the recorded commands." },
    { key: "tradeoff", label: "Trade-offs", hint: "Not observations — a give-and-take you choose to make." },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4" data-testid="next-live">
      <section className="rounded-[12px] bg-[#13161C] p-5" aria-label="Adjustments">
        <h2 className="text-[20px] font-medium text-[#F5F7FC]">Next LIVE adjustments</h2>
        <p className="text-[14px] text-[#B7C1CE] mt-1">
          Select the concrete changes to carry forward. One show supports a manual choice; it is not a recurring pattern and says nothing about
          sales. Nothing is applied until you create the next show.
        </p>
        <p className="text-[14px] text-[#CAD0DA] mt-2" data-testid="only-selected-note">
          <i className="ri-checkbox-circle-line mr-1.5 text-[#DFFF00]" aria-hidden="true" />
          Only the boxes you tick change the next plan. Everything else stays as in the original baseline.
        </p>

        {aiCopilot && proposals.length > 0 && (
          <div className="mt-4 rounded-[8px] bg-[#14171E] border border-dashed border-[#25505F] px-3 py-2 space-y-1.5" data-testid="next-live-ai">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LayerLabel kind="recommendation" extra="AI suggestions · you choose" />
              <StateChip phase={aiCopilot.phase} testId="next-live-ai-state" />
            </div>
            {aiMessage && aiCopilot.phase !== "available" && <p className="text-[14px] text-[#CAD0DA]" data-testid="next-live-ai-message">{aiMessage}</p>}
            {aiById.size > 0 ? (
              <>
                <p className="text-[14px] text-[#CAD0DA]" data-testid="next-live-ai-count">
                  The AI Copilot suggests {aiById.size} of these {aiById.size === 1 ? "adjustment" : "adjustments"}. Nothing is selected until you select it, and the AI cannot create the next show.
                </p>
                <Button variant="assist" size="md" icon="ri-checkbox-multiple-line" onClick={selectSuggested} data-testid="select-ai-suggested-btn">
                  Select the {aiById.size} suggested
                </Button>
              </>
            ) : (
              aiCopilot.canAsk &&
              onAskAi && (
                <Button variant="assist" size="md" icon="ri-sparkling-2-line" onClick={onAskAi} data-testid="next-live-ask-ai-btn">
                  {aiCopilot.phase === "generating" ? "Asking the AI Copilot…" : "Ask the AI Copilot"}
                </Button>
              )
            )}
          </div>
        )}

        {proposals.length === 0 && (
          <p className="mt-4 text-[15px] text-[#CAD0DA]" data-testid="no-proposals">
            Nothing in this show justifies a change. You can still carry the plan forward unchanged.
          </p>
        )}

        {openNotes.length > 0 && (
          <div className="mt-4 rounded-[8px] bg-[#1A1E26] px-3 py-2" data-testid="coverage-followups">
            <p className="text-[12px] font-semibold tracking-[1.4px] uppercase text-[#AEB7C5]">Declared in this show — for your reference</p>
            <ul className="mt-1 space-y-0.5 text-[14px] text-[#CAD0DA]">
              {openNotes.map((r) => (
                <li key={r.segmentId}>
                  <span className="text-[#F5F7FC]">{r.title}</span> — {r.coverage === "partial" ? "coverage partial" : "follow-up noted"}
                  {r.followUp ? `: ${r.followUp}` : ""}
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-[#9AA5B5] mt-1">
              These are your own notes. They are not copied into the next plan and nothing is moved for you — add a segment in Prepare if one should be
              covered next time.
            </p>
          </div>
        )}

        {groups.map((g) => {
          const items = proposals.filter((p) => p.basis === g.key);
          if (items.length === 0) return null;
          return (
            <div key={g.key} className="mt-4">
              <p className="text-[12px] font-semibold tracking-[1.4px] uppercase text-[#AEB7C5]">{g.label}</p>
              <p className="text-[13px] text-[#9AA5B5] mb-1.5">{g.hint}</p>
              <ul className="space-y-2" data-testid={`proposals-${g.key}`}>
                {items.map((p) => (
                  <li key={p.id}>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-[10px] cursor-pointer transition-colors border ${
                        selected.has(p.id) ? "bg-[#1B1F27] border-[#DFFF00]" : "bg-[#101319] border-[#252C38] hover:bg-[#161A22]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="w-5 h-5 mt-0.5 accent-[#DFFF00]"
                        data-testid={`select-${p.id}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-[16px] font-medium text-[#F5F7FC]">{p.title}</span>
                        <span className="block text-[13px] text-[#B7C1CE] mt-0.5">{p.detail}</span>
                        {aiById.has(p.id) && (
                          <span className="block text-[14px] text-[#E4E8F0] mt-1" data-testid={`ai-suggests-${p.id}`}>
                            <i className="ri-sparkling-2-line mr-1 text-[#7DD8EA]" aria-hidden="true" />
                            <span className="font-semibold text-[#7DD8EA]">AI suggests</span> · Why (AI): {aiById.get(p.id)!.why}
                          </span>
                        )}
                        {coverageNote(p.segmentId) && (
                          <span className="block text-[13px] text-[#9AA5B5] mt-0.5" data-testid={`proposal-context-${p.id}`}>
                            <i className="ri-information-line mr-1" aria-hidden="true" />
                            In this show: {coverageNote(p.segmentId)}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="rounded-[12px] bg-[#1B1F27] p-5" aria-label="Resulting plan">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-medium text-[#F5F7FC]">Resulting next plan</h2>
          <Signal tone={session.environment === "SIMULATED" ? "violet" : "neutral"} icon={session.environment === "SIMULATED" ? "ri-flask-line" : "ri-broadcast-line"}>
            created as {session.environment}
            {session.environment === "REAL" ? " in the room" : ""}
          </Signal>
        </div>

        <p className="mt-2 text-[14px] text-[#CAD0DA]" data-testid="next-plan-start">
          {plannedStartMs !== null
            ? `Planned for ${formatDay(plannedStartMs, tz)} · ${clock(plannedStartMs)} · ${tz}. Anchors keep their offset from this new start.`
            : "Choose a valid date and start time to preview the next schedule."}
        </p>

        <ol className="mt-3 divide-y divide-[#262C38]" data-testid="clone-preview">
          {preview.segments.map((seg, i) => {
            const d = diff[i];
            const changed = d.change !== "unchanged";
            const anchorInfo = assess.anchors.find((a) => a.segmentId === seg.id);
            return (
              <li
                key={seg.id}
                data-changed={changed}
                className={`py-2 px-2 flex items-center gap-3 ${changed ? "bg-[#1E2418] border-l-2 border-[#DFFF00]" : ""}`}
              >
                <span className="w-[64px] text-[13px] tabular-nums text-[#AEB7C5] shrink-0">{d.toStartMs !== null ? clock(d.toStartMs) : "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-[#F5F7FC] truncate">{seg.title}</span>
                  {anchorInfo && (
                    <span className="text-[13px] text-[#9AA5B5] tabular-nums">
                      <i className="ri-lock-2-line mr-1" aria-hidden="true" />
                      anchor {clock(anchorInfo.committedMs)} ·{" "}
                      {anchorInfo.deficitSec > 0 ? (
                        <span className="text-[#F4A4A4]">arrives {formatDuration(anchorInfo.deficitSec)} late</span>
                      ) : (
                        <span>{formatDuration(anchorInfo.bufferSec)} buffer</span>
                      )}
                    </span>
                  )}
                </span>
                <span className="text-[15px] tabular-nums text-right shrink-0">
                  {d.change === "duration" || d.change === "duration_and_moved" ? (
                    <span className="text-[#DFFF00]">
                      <span className="text-[#9AA5B5] line-through mr-1">{d.fromTargetSec !== null ? formatDuration(d.fromTargetSec) : "—"}</span>
                      {d.toTargetSec !== null ? formatDuration(d.toTargetSec) : "Not entered"}
                    </span>
                  ) : (
                    <span className="text-[#E4E8F0]">{seg.targetSec !== null ? formatDuration(seg.targetSec) : "Not entered"}</span>
                  )}
                  {(d.change === "moved" || d.change === "duration_and_moved") && (
                    <span className="block text-[12px] text-[#DFFF00]">moved from #{d.fromIndex + 1}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-3" data-testid="clone-feasibility">
          {late.length > 0 ? (
            <div className="rounded-[8px] bg-[#302025] border-l-[3px] border-[#F4A4A4] px-3 py-2">
              <p className="text-[15px] font-medium text-[#F4A4A4]">
                <i className="ri-error-warning-line mr-1.5" aria-hidden="true" />
                Infeasible with these changes
              </p>
              <ul className="text-[14px] text-[#CAD0DA] mt-1 space-y-0.5">
                {late.map((a) => (
                  <li key={a.segmentId}>
                    {a.title} is committed for {clock(a.committedMs)} but would arrive {formatDuration(a.deficitSec)} late even with no overruns.
                  </li>
                ))}
              </ul>
              <p className="text-[14px] text-[#9AA5B5] mt-1">
                Deselect a change, choose a trade-off that gives time back, or fix it in Prepare. Anchors are never moved to make it fit.
              </p>
              <label className="flex items-center gap-2 mt-2 min-h-[44px] text-[15px] text-[#F5F7FC] cursor-pointer">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="w-5 h-5 accent-[#DFFF00]" data-testid="ack-infeasible" />
                Create it as an unresolved draft to fix in Prepare — it cannot start until the conflict is resolved
              </label>
            </div>
          ) : (
            <p className="text-[14px] text-[#CAD0DA]" data-testid="feasible-note">
              <i className="ri-checkbox-circle-line mr-1.5 text-[#DFFF00]" aria-hidden="true" />
              {assess.anchors.length === 0
                ? "No hard anchors to protect."
                : `Every hard anchor is feasible: ${assess.anchors.map((a) => `${a.title} ${formatDuration(a.bufferSec)} buffer`).join(" · ")}.`}
              {baseAssess.anchors.length > 0 && chosen.length === 0 && " (unchanged from the baseline)"}
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_170px_150px] gap-3">
          <div>
            <label htmlFor="next-title" className="block text-[14px] text-[#CAD0DA] mb-1">Title</label>
            <input id="next-title" className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="next-title-input" />
          </div>
          <div>
            <label htmlFor="next-date" className="block text-[14px] text-[#CAD0DA] mb-1">Planned date</label>
            <input id="next-date" type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="next-time" className="block text-[14px] text-[#CAD0DA] mb-1">Start</label>
            <input id="next-time" type="time" className={INPUT} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="next-note" className="block text-[14px] text-[#CAD0DA] mb-1">Change note (kept with the new plan)</label>
            <input id="next-note" className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why these changes?" data-testid="next-note-input" />
          </div>
        </div>

        {error && <p role="alert" className="mt-3 text-[14px] text-[#F4A4A4]">{error}</p>}
        {(title.trim() === "" || plannedStartMs === null) && (
          <p className="mt-3 text-[14px] text-[#F6C875]">Enter a title, planned date and valid start time to create the next LIVE.</p>
        )}
        {!writable && (
          <p className="mt-3 text-[14px] text-[#F6C875]" data-testid="next-live-blocked">
            <i className="ri-lock-line mr-1.5" aria-hidden="true" />
            {archive
              ? "This is a local archive. It is not uploaded or turned into a room show; plan the next LIVE from a show in the room."
              : (commands.blockedReason ?? "The next show cannot be created right now.")}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-[#2A313E] flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[13px] text-[#9AA5B5] max-w-[360px]">
            Products and planned segments are copied from this show&apos;s baseline, plus only the changes you ticked. Actual runtime, reports,
            coverage, follow-ups, history and verification are not copied.
          </p>
          <Button variant="primary" size="lg" icon="ri-arrow-right-line" onClick={() => void create()} disabled={!canCreate} data-testid="create-next-live-cta-btn">
            {submitting ? "Waiting for the room…" : `Create next LIVE${chosen.length > 0 ? ` · ${chosen.length} change${chosen.length === 1 ? "" : "s"}` : ""}`}
          </Button>
        </div>
      </section>
    </div>
  );
}
