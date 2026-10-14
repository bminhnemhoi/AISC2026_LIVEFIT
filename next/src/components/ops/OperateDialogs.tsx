"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Session } from "@/contracts";
import {
  MANUAL_ACTION_LABEL,
  applyCommand,
  baselinePlan,
  currentPlan,
  emptyCueRun,
  emptySegmentRun,
  forecastSession,
  formatClock,
  formatDuration,
  msToZonedParts,
  zonedTimeToMs,
  type CommandBody,
  type ManualActionKind,
  type RecoveryAnalysis,
  type RecoveryOption,
} from "@/lib/domain";
import { Dialog } from "@/components/ui";
import { Signal } from "./StatusChips";
import type { ReportTarget } from "./CueBar";

export type DispatchBody = CommandBody;

const INPUT =
  "w-full h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[16px] text-[#F5F7FC] tabular-nums";

// ---------------------------------------------------------------------------------------------

export function EndLiveDialog({
  isOpen,
  onClose,
  onConfirm,
  session,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  session: Session;
}): React.ReactElement {
  const plan = currentPlan(session);
  const notReached = plan.segments.filter((s) => (session.runtime.segments[s.id] ?? emptySegmentRun()).state === "pending");
  const unreported = plan.cues.filter(
    (c) => c.audience === "operator" && (session.runtime.cues[c.id] ?? emptyCueRun()).state === "pending"
  );
  const unresolvedAttempts =
    plan.cues.filter((c) => (session.runtime.cues[c.id] ?? emptyCueRun()).state === "attempted").length +
    Object.values(session.runtime.actions ?? {}).filter((a) => a.state === "attempted").length;
  const running = session.runtime.currentSegmentId !== null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={session.environment === "SIMULATED" ? "End the simulated session?" : "End LIVE tracking?"}
      confirmText="End tracking"
      confirmSize="lg"
      cancelText="Keep operating"
      onConfirm={onConfirm}
    >
      <div className="space-y-3 text-[16px] leading-relaxed text-[#CAD0DA]" data-testid="end-live-dialog">
        {session.environment === "SIMULATED" ? (
          <p>
            This stops the <strong className="text-[#F5F7FC]">SIMULATED rehearsal</strong>. Nothing was broadcast, so there is nothing to end
            in TikTok.
          </p>
        ) : (
          <p>
            This stops <strong className="text-[#F5F7FC]">LiveLift tracking</strong>. It does not stop your platform broadcast — end that in
            TikTok LIVE Manager separately.
          </p>
        )}
        <ul className="space-y-1.5 text-[16px]">
          {running && <li>The running segment will be closed with the show; its coverage stays undeclared.</li>}
          <li>
            {notReached.length === 0
              ? "Every segment has run or been skipped."
              : `${notReached.length} segment${notReached.length === 1 ? "" : "s"} not reached (${notReached.map((s) => s.title).join(", ")}) will be recorded as "not reached" — not as zero-length.`}
          </li>
          <li>
            {unreported.length === 0
              ? "Every operator cue has a report."
              : `${unreported.length} operator cue${unreported.length === 1 ? " has" : "s have"} no report (${unreported.map((c) => c.title).join(", ")}). They will be recorded as "no report" — unknown, not failed.`}
          </li>
          {unresolvedAttempts > 0 && (
            <li>
              {unresolvedAttempts} attempt{unresolvedAttempts === 1 ? "" : "s"} still {unresolvedAttempts === 1 ? "has" : "have"} an unknown outcome. {unresolvedAttempts === 1 ? "It stays" : "They stay"} unresolved — never counted as performed or failed.
            </li>
          )}
        </ul>
        <p className="text-[16px] text-[#9AA5B5]">After ending, the runtime is frozen. Review can append notes and corrections but never rewrites what happened.</p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function AckDialog({
  isOpen,
  title,
  message,
  confirmText,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  onClose: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} confirmText={confirmText} confirmSize="lg" onConfirm={onConfirm} size="sm">
      <p className="text-[16px] leading-relaxed text-[#CAD0DA]" data-testid="ack-message">
        {message}
      </p>
      <p className="text-[16px] text-[#9AA5B5] mt-3">The exception is recorded in the history. Nothing is hidden or rewritten.</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function ReanchorDialog({
  isOpen,
  onClose,
  onConfirm,
  session,
  nowMs,
  segmentId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (input: { segmentId: string; anchorOffsetSec: number; reason: string }) => void;
  session: Session;
  nowMs: number;
  segmentId: string | null;
}): React.ReactElement | null {
  const plan = currentPlan(session);
  const tz = session.timezone;
  const segment = plan.segments.find((s) => s.id === segmentId);
  const committed = segment ? plan.plannedStartMs + (segment.anchorOffsetSec ?? 0) * 1000 : nowMs;
  const projected = useMemo(() => {
    if (!segment) return committed;
    const f = forecastSession(session, nowMs).segments.find((x) => x.segmentId === segment.id);
    return f?.startMs ?? committed;
  }, [session, nowMs, segment, committed]);

  const [timeText, setTimeText] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const text = timeText ?? formatClock(Math.max(projected, committed), tz, true);

  const parsed = useMemo(() => {
    const date = msToZonedParts(committed, tz).date;
    let ms = zonedTimeToMs(date, text.length === 5 ? `${text}:00` : text, tz);
    if (ms !== null && ms < plan.plannedStartMs) ms += 86_400_000;
    return ms;
  }, [text, committed, tz, plan.plannedStartMs]);

  const offset = parsed === null ? null : Math.round((parsed - plan.plannedStartMs) / 1000);
  const preview = useMemo(() => {
    if (!segment || offset === null || reason.trim().length < 3) return null;
    const res = applyCommand(session, {
      type: "reanchor_segment",
      segmentId: segment.id,
      anchorOffsetSec: offset,
      reason: reason.trim(),
      nowMs,
      key: "preview",
    });
    if (res.receipt.outcome !== "committed") {
      return { error: res.receipt.message ?? "Not allowed.", stillBroken: [] as Array<{ segmentId: string }> };
    }
    const f = forecastSession(res.session, nowMs);
    const stillBroken = f.segments.filter(
      (s) => s.state === "pending" && s.anchor && (s.anchor.status === "at_risk" || s.anchor.status === "missed")
    );
    return { error: null, stillBroken };
  }, [session, nowMs, segment, offset, reason]);

  if (!segment) return null;
  const valid = offset !== null && offset >= 0 && offset !== segment.anchorOffsetSec && reason.trim().length >= 3 && !preview?.error;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Re-anchor ${segment.title}`}
      confirmText="Record new commitment"
      confirmSize="lg"
      onConfirm={() => offset !== null && onConfirm({ segmentId: segment.id, anchorOffsetSec: offset, reason: reason.trim() })}
      confirmDisabled={!valid}
    >
      <div className="space-y-4" data-testid="reanchor-dialog">
        <p className="text-[16px] text-[#CAD0DA] leading-relaxed">
          A hard anchor is a commitment. Changing it is a <strong className="text-[#F5F7FC]">new plan version</strong>, not a recovery:
          the original <span className="tabular-nums">{formatClock(baselinePlanAnchor(session, segment.id) ?? committed, tz, true)}</span>{" "}
          stays in the baseline and in Review.
        </p>
        <div>
          <label htmlFor="reanchor-time" className="block text-[16px] text-[#CAD0DA] mb-1">
            New committed start ({tz})
          </label>
          <input
            id="reanchor-time"
            data-testid="reanchor-time"
            data-autofocus
            type="time"
            step={1}
            value={text}
            onChange={(e) => setTimeText(e.target.value)}
            className={INPUT}
          />
          <p className="text-[16px] text-[#9AA5B5] mt-1">
            Currently {formatClock(committed, tz, true)} · earliest projected arrival {formatClock(projected, tz, true)}
          </p>
        </div>
        <div>
          <label htmlFor="reanchor-reason" className="block text-[16px] text-[#CAD0DA] mb-1">
            Reason (recorded with the change)
          </label>
          <input
            id="reanchor-reason"
            data-testid="reanchor-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Host needs two more minutes on the current product"
            className={INPUT}
          />
        </div>
        {preview?.error && <Signal tone="danger" icon="ri-error-warning-line">{preview.error}</Signal>}
        {preview && !preview.error && (
          <div className="text-[16px] text-[#CAD0DA]" data-testid="reanchor-preview">
            {preview.stillBroken.length === 0 ? (
              <Signal tone="neutral" icon="ri-checkbox-circle-line">After this change no other commitment is at risk.</Signal>
            ) : (
              <Signal tone="warn" icon="ri-error-warning-line">
                Still at risk after this change:{" "}
                {preview.stillBroken.map((s) => currentPlan(session).segments.find((x) => x.id === s.segmentId)?.title).join(", ")}.
              </Signal>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function baselinePlanAnchor(session: Session, segmentId: string): number | null {
  const base = baselinePlan(session);
  const seg = base.segments.find((s) => s.id === segmentId);
  return seg && seg.anchorOffsetSec !== null ? base.plannedStartMs + seg.anchorOffsetSec * 1000 : null;
}

// ---------------------------------------------------------------------------------------------

export function ChooseNextDialog({
  isOpen,
  onClose,
  onChoose,
  session,
  nowMs,
}: {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (segmentId: string) => void;
  session: Session;
  nowMs: number;
}): React.ReactElement {
  const plan = currentPlan(session);
  const pending = plan.segments.filter((s) => (session.runtime.segments[s.id] ?? emptySegmentRun()).state === "pending");
  const next = pending[0];

  const rows = pending.map((seg, i) => {
    if (i === 0) return { seg, blocked: "Already next" };
    const res = applyCommand(session, {
      type: "reorder_segment",
      segmentId: seg.id,
      beforeSegmentId: next.id,
      nowMs,
      key: "preview",
    });
    return { seg, blocked: res.receipt.outcome === "committed" ? null : (res.receipt.message ?? "Not allowed") };
  });

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Choose next" cancelText="Close" size="md"
      description="Reordering is an explicit plan change. It cannot cross a hard anchor or work that already ran.">
      <ul className="space-y-2 pb-1" data-testid="choose-next-list">
        {rows.map(({ seg, blocked }) => (
          <li key={seg.id} className="p-3 rounded-[8px] bg-[#14171E] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-medium text-[#F5F7FC] truncate">{seg.title}</p>
              <p className="text-[16px] text-[#9AA5B5]">
                {seg.targetSec !== null ? formatDuration(seg.targetSec) : "no duration"}
                {seg.anchorOffsetSec !== null ? " · hard anchor" : ""}
                {seg.optional ? " · optional" : ""}
              </p>
              {blocked && blocked !== "Already next" && <p className="text-[16px] text-[#F6C875] mt-0.5">{blocked}</p>}
            </div>
            <button
              type="button"
              disabled={blocked !== null}
              onClick={() => onChoose(seg.id)}
              data-testid={`choose-next-${seg.id}`}
              className="min-h-[44px] px-3 rounded-[8px] text-[16px] font-medium bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {blocked === "Already next" ? "Already next" : "Run next"}
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="text-[16px] text-[#9AA5B5]">No pending segments.</li>}
      </ul>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function SkipDialog({
  isOpen,
  onClose,
  onSkip,
  session,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSkip: (segmentId: string) => void;
  session: Session;
}): React.ReactElement {
  const plan = currentPlan(session);
  const pending = plan.segments.filter((s) => (session.runtime.segments[s.id] ?? emptySegmentRun()).state === "pending");
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Skip a segment" cancelText="Close"
      description="Skipped segments are recorded as skipped — never as performed. Required coverage needs acknowledgement.">
      <ul className="space-y-2 pb-1" data-testid="skip-list">
        {pending.map((seg) => (
          <li key={seg.id} className="p-3 rounded-[8px] bg-[#14171E] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-medium text-[#F5F7FC] truncate">{seg.title}</p>
              <p className="text-[16px] text-[#9AA5B5]">
                {seg.optional ? "Optional" : "Required coverage"}
                {seg.anchorOffsetSec !== null ? " · hard anchor (a commitment)" : ""}
                {seg.targetSec !== null ? ` · frees ${formatDuration(seg.targetSec)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSkip(seg.id)}
              data-testid={`skip-${seg.id}`}
              className="min-h-[44px] px-3 rounded-[8px] text-[16px] font-medium bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944] cursor-pointer whitespace-nowrap"
            >
              Skip
            </button>
          </li>
        ))}
        {pending.length === 0 && <li className="text-[16px] text-[#9AA5B5]">No pending segments.</li>}
      </ul>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

type ReportKind = "performed" | "attempted" | "cancelled";

/**
 * Report any operator action: a planned cue (pending or with an unresolved attempt), an earlier unplanned
 * attempt, or a native action that was never planned. Every report is independent — reporting one never
 * resolves, cancels or confirms another. Verification always stays unknown.
 */
export function ReportActionDialog({
  isOpen,
  onClose,
  onConfirm,
  session,
  initial,
  nowMs,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (body: DispatchBody) => void;
  session: Session;
  initial: ReportTarget;
  nowMs: number;
}): React.ReactElement {
  const plan = currentPlan(session);
  const cueChoices = plan.cues.filter((c) => {
    const st = (session.runtime.cues[c.id] ?? emptyCueRun()).state;
    return c.audience === "operator" && (st === "pending" || st === "attempted");
  });
  const actionChoices = Object.values(session.runtime.actions ?? {}).filter((a) => a.state === "attempted");
  const keyOf = (t: ReportTarget): string => (t.kind === "new" ? "new" : `${t.kind}:${t.id}`);
  const [choice, setChoice] = useState<string>(keyOf(initial));
  const [report, setReport] = useState<ReportKind>("performed");
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<ManualActionKind>("pin_product");
  const [productId, setProductId] = useState(session.products[0]?.id ?? "");
  const [label, setLabel] = useState("");

  const isNew = choice === "new";
  const cue = choice.startsWith("cue:") ? (plan.cues.find((c) => `cue:${c.id}` === choice) ?? null) : null;
  const unplanned = choice.startsWith("action:") ? (actionChoices.find((a) => `action:${a.id}` === choice) ?? null) : null;
  const cueState = cue ? (session.runtime.cues[cue.id] ?? emptyCueRun()).state : null;
  const needsProduct = isNew && (action === "pin_product" || action === "unpin_product");
  const startedAt = session.runtime.startedAtMs ?? nowMs;
  const occurredAtMs = Math.max(startedAt, nowMs - secondsAgo * 1000);

  const kinds: Array<[ReportKind, string]> = isNew
    ? [
        ["performed", "I did it in TikTok"],
        ["attempted", "I tried — the outcome is unknown"],
      ]
    : unplanned
      ? [
          ["performed", "It went through (I performed it)"],
          ["cancelled", "Withdraw the attempt — it did not happen"],
        ]
      : [
          ["performed", "I performed this in TikTok"],
          ...(cueState === "attempted" ? [] : ([["attempted", "I attempted it — the outcome is unknown"]] as Array<[ReportKind, string]>)),
          ["cancelled", "We decided not to do it (cancel the cue)"],
        ];
  const effectiveReport: ReportKind = kinds.some(([k]) => k === report) ? report : kinds[0][0];

  const valid =
    (effectiveReport !== "cancelled" || reason.trim().length >= 3) &&
    (!isNew || (needsProduct ? productId !== "" : label.trim().length >= 2 || productId !== ""));

  const build = (): DispatchBody | null => {
    const when = effectiveReport === "cancelled" ? undefined : occurredAtMs;
    if (cue) return { type: "report_cue", cueId: cue.id, report: effectiveReport, occurredAtMs: when, reason: reason.trim() || undefined };
    if (unplanned) return { type: "report_manual_action", actionId: unplanned.id, report: effectiveReport, occurredAtMs: when, reason: reason.trim() || undefined };
    if (isNew)
      return {
        type: "report_manual_action",
        action,
        productId: productId || null,
        targetLabel: label.trim() || undefined,
        report: effectiveReport,
        occurredAtMs: when,
      };
    return null;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Report an action"
      confirmText="Record report"
      confirmSize="lg"
      onConfirm={() => {
        const body = build();
        if (body) onConfirm(body);
      }}
      confirmDisabled={!valid}
    >
      <div className="space-y-4" data-testid="cue-report-dialog">
        <div>
          <label htmlFor="report-target" className="block text-[16px] text-[#CAD0DA] mb-1">
            What are you reporting?
          </label>
          <select id="report-target" data-testid="report-target" value={choice} onChange={(e) => setChoice(e.target.value)} className={INPUT}>
            {cueChoices.map((c) => {
              const st = (session.runtime.cues[c.id] ?? emptyCueRun()).state;
              return (
                <option key={c.id} value={`cue:${c.id}`}>
                  Cue · {c.title}
                  {st === "attempted" ? " · attempted, outcome unknown" : ""}
                </option>
              );
            })}
            {actionChoices.map((a) => (
              <option key={a.id} value={`action:${a.id}`}>
                Unplanned · {MANUAL_ACTION_LABEL[a.action]} {a.targetLabel} · attempted, outcome unknown
              </option>
            ))}
            <option value="new">Something that was not planned…</option>
          </select>
        </div>

        {isNew && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="unplanned-fields">
            <div>
              <label htmlFor="report-action" className="block text-[16px] text-[#CAD0DA] mb-1">Action</label>
              <select id="report-action" value={action} onChange={(e) => setAction(e.target.value as ManualActionKind)} className={INPUT}>
                <option value="pin_product">Pin product</option>
                <option value="unpin_product">Unpin product</option>
                <option value="start_promotion">Start promotion</option>
                <option value="other">Other action</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-product" className="block text-[16px] text-[#CAD0DA] mb-1">
                Product{needsProduct ? "" : " (optional)"}
              </label>
              <select id="report-product" value={productId} onChange={(e) => setProductId(e.target.value)} className={INPUT}>
                {!needsProduct && <option value="">No product</option>}
                {session.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </div>
            {!needsProduct && (
              <div className="sm:col-span-2">
                <label htmlFor="report-label" className="block text-[16px] text-[#CAD0DA] mb-1">Target (e.g. the promotion name)</label>
                <input id="report-label" data-testid="report-label" value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT} />
              </div>
            )}
          </div>
        )}

        <fieldset>
          <legend className="text-[16px] text-[#CAD0DA] mb-1.5">What happened?</legend>
          <div className="space-y-1">
            {kinds.map(([value, text]) => (
              <label key={value} className="flex items-center gap-2 min-h-[44px] cursor-pointer text-[16px] text-[#F5F7FC]">
                <input type="radio" name="report-kind" checked={effectiveReport === value} onChange={() => setReport(value)} className="w-5 h-5 accent-[#DFFF00]" />
                {text}
              </label>
            ))}
          </div>
        </fieldset>
        {effectiveReport !== "cancelled" ? (
          <div>
            <label htmlFor="cue-when" className="block text-[16px] text-[#CAD0DA] mb-1">
              It happened
            </label>
            <select id="cue-when" value={secondsAgo} onChange={(e) => setSecondsAgo(Number(e.target.value))} className={INPUT}>
              <option value={0}>just now</option>
              <option value={15}>15 seconds ago</option>
              <option value={30}>30 seconds ago</option>
              <option value={60}>1 minute ago</option>
              <option value={120}>2 minutes ago</option>
              <option value={300}>5 minutes ago</option>
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="cue-reason" className="block text-[16px] text-[#CAD0DA] mb-1">
              Reason (recorded; never relabelled as performed)
            </label>
            <input id="cue-reason" data-testid="cue-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT} />
          </div>
        )}
        <p className="text-[16px] text-[#9AA5B5]">
          A report records what you say happened. It is not platform confirmation; verification stays unknown. Other unresolved attempts stay unresolved.
        </p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

/**
 * Coverage is declared, never inferred: reaching a minimum is not proof every point was covered.
 * Asked only when a segment was cut short by a commitment or ends before its allocation.
 */
export function CoverageDialog({
  isOpen,
  onClose,
  onConfirm,
  segmentTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (input: { coverage: "complete" | "partial" | null; followUp: string }) => void;
  segmentTitle: string;
}): React.ReactElement {
  const [coverage, setCoverage] = useState<"complete" | "partial" | "unknown">("partial");
  const [followUp, setFollowUp] = useState("");
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Did the host cover everything in ${segmentTitle}?`}
      confirmText="Record and continue"
      confirmSize="lg"
      onConfirm={() => onConfirm({ coverage: coverage === "unknown" ? null : coverage, followUp: coverage === "partial" ? followUp.trim() : "" })}
    >
      <div className="space-y-3" data-testid="coverage-dialog">
        <fieldset className="space-y-1">
          <legend className="sr-only">Coverage</legend>
          {(
            [
              ["complete", "Yes — everything planned was covered"],
              ["partial", "No — some points are unfinished"],
              ["unknown", "Not sure — leave coverage undeclared"],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 min-h-[44px] cursor-pointer text-[16px] text-[#F5F7FC]">
              <input
                type="radio"
                name="coverage"
                checked={coverage === value}
                onChange={() => setCoverage(value)}
                className="w-5 h-5 accent-[#DFFF00]"
                data-testid={`coverage-${value}`}
              />
              {text}
            </label>
          ))}
        </fieldset>
        {coverage === "partial" && (
          <div>
            <label htmlFor="coverage-followup" className="block text-[16px] text-[#CAD0DA] mb-1">
              What still needs covering? (optional, kept as a follow-up)
            </label>
            <input id="coverage-followup" data-testid="coverage-followup" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={INPUT} />
          </div>
        )}
        <p className="text-[16px] text-[#9AA5B5]">
          Ending a segment records that it ran, not that everything in it was covered. “Not sure” is recorded as undeclared — never as complete
          and never as failed. LiveLift does not move unfinished points anywhere automatically; a follow-up is a note for you, shown in
          Coverage and Review.
        </p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function NoteDialog({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
}): React.ReactElement {
  const [text, setText] = useState("");
  // The text stays until the dialog closes: a REAL note the room has not accepted must not lose what was typed.
  useEffect(() => {
    if (!isOpen) setText("");
  }, [isOpen]);
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add a note"
      confirmText="Save note"
      confirmSize="lg"
      onConfirm={() => onSave(text)}
      confirmDisabled={text.trim() === ""}
    >
      <textarea
        data-testid="note-input"
        aria-label="Note"
        data-autofocus
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        placeholder="e.g. Viewers keep asking about waist sizing."
        className="w-full bg-[#13161C] border border-[#39414D] rounded-[8px] p-3 text-[16px] text-[#F5F7FC]"
      />
      <p className="text-[16px] text-[#9AA5B5] mt-2">Notes are timestamped and attributed. They never change the plan.</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function AllOptionsDialog({
  isOpen,
  onClose,
  analysis,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  analysis: RecoveryAnalysis;
  onApply: (option: RecoveryOption) => void;
}): React.ReactElement {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Recovery options" cancelText="Close" size="lg"
      description="Each option shows what it frees and what it costs. Nothing runs until you choose it, and a hard anchor never moves unless you re-anchor it.">
      <div className="pb-1" data-testid="all-options-dialog">
        {analysis.status === "no_feasible_recovery" && (
          <p className="mb-3 text-[16px] font-medium text-[#F6C875]" data-testid="all-options-infeasible">
            <i className="ri-error-warning-line mr-1.5" aria-hidden="true" />
            No feasible recovery under current constraints. The best compatible combination of clean options frees{" "}
            {formatDuration(analysis.maxCleanSavingsSec)}; the deficit is {formatDuration(analysis.deficitSec)}.{" "}
            {analysis.exceptionProtects
              ? "Only an exception or a commitment change protects it."
              : "Only a commitment change remains."}
          </p>
        )}
        {analysis.status === "recoverable" && analysis.cleanPlan.length > 1 && (
          <p className="mb-3 text-[16px] text-[#CAD0DA]" data-testid="all-options-clean-plan">
            <i className="ri-checkbox-circle-line mr-1.5 text-[#DFFF00]" aria-hidden="true" />
            No single change protects it, but these clean changes together do: {analysis.cleanPlan.join(" + ")}. Apply them one at a time.
          </p>
        )}
        <ul className="divide-y divide-[#262C38]">
          {analysis.options.map((o) => (
            <li key={o.id} className="py-3 [@media(max-height:800px)]:py-2 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[16px] font-medium text-[#F5F7FC]">{o.label}</p>
                <p className="text-[16px] text-[#B7C1CE] mt-0.5">{o.detail}</p>
                <p className="text-[16px] mt-1 text-[#9AA5B5] tabular-nums">
                  Frees {formatDuration(o.savesSec)} · leaves {formatDuration(o.resultingDeficitSec)} late ·{" "}
                  {o.exception ? (o.exception.code === "commitment_change" ? "commitment change" : "needs an exception") : "respects minimums and required coverage"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onApply(o)}
                className="min-h-[44px] px-3 rounded-[8px] text-[16px] font-medium bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944] cursor-pointer whitespace-nowrap"
              >
                {o.exception?.code === "commitment_change" ? "Review" : "Apply"}
              </button>
            </li>
          ))}
          {analysis.options.length === 0 && <li className="py-3 text-[16px] text-[#9AA5B5]">Nothing needs recovering.</li>}
        </ul>
      </div>
    </Dialog>
  );
}
