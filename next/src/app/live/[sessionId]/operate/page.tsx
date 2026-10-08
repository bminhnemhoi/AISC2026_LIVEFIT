"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@/contracts";
import { FocusedShell, StandardShell } from "@/components/shell";
import { Button, CommandStateContext, InlineNotice } from "@/components/ui";
import { SessionGate, type GateContext } from "@/components/ops/SessionGate";
import { NowPanel } from "@/components/ops/NowPanel";
import { NextPanel } from "@/components/ops/NextPanel";
import { CueBar, type ReportTarget } from "@/components/ops/CueBar";
import { RunOfShowLive, scrollCurrentRowIntoView } from "@/components/ops/RunOfShowLive";
import { SupportTabs } from "@/components/ops/SupportTabs";
import { QuickReports } from "@/components/ops/QuickReports";
import { OperateCopilot } from "@/components/ai/OperateCopilot";
import { useOperateCopilot } from "@/components/ai/useAiCopilot";
import { SimulatorStrip } from "@/components/ops/SimulatorStrip";
import { Drift } from "@/components/ops/StatusChips";
import {
  AckDialog,
  AllOptionsDialog,
  ChooseNextDialog,
  CoverageDialog,
  EndLiveDialog,
  NoteDialog,
  ReanchorDialog,
  ReportActionDialog,
  SkipDialog,
} from "@/components/ops/OperateDialogs";
import {
  SCENARIO_BY_ID,
  activeSegment,
  analyzeRecovery,
  applyCommand,
  coverageDeclarationExpected,
  currentPlan,
  effectiveNowMs,
  forecastSession,
  formatAnchorLate,
  formatClock,
  formatDuration,
  isAnchorDueNow,
  nextPendingSegment,
  type RecoveryOption,
  type ScenarioId,
} from "@/lib/domain";
import { sessionStore, type DispatchInput, type DispatchResult } from "@/lib/store/sessionStore";
import { remoteRoomStore, type CommandOutcome } from "@/lib/store/remoteRoomStore";
import { toRuntimeBody } from "@/lib/client/commandText";
import {
  useAuthorityClock,
  useDeskClock,
  useRemoteCommands,
  useRemoteState,
  useSessionActions,
  useStoreState,
  type ClockDiscontinuity,
  type SessionSource,
} from "@/lib/store/hooks";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function OperatePage({ params }: PageProps): React.ReactElement {
  const { sessionId } = use(params);
  return <SessionGate id={sessionId}>{(session, ctx) => <OperateRoot session={session} source={ctx.source} />}</SessionGate>;
}

/** The desk only exists while a show is running. Other lifecycles point to where the work is. */
function OperateRoot({ session, source }: { session: Session; source: GateContext["source"] }): React.ReactElement {
  if (session.lifecycle === "active") return <LiveClock session={session} source={source} />;
  const ended = session.lifecycle === "ended";
  return (
    <StandardShell>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="operate-not-running">
        <h1 className="text-[28px] font-medium text-[#F5F7FC]">{ended ? "This show has ended" : "This show has not started"}</h1>
        <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[520px]">
          {ended
            ? "The runtime is frozen. Plan vs Actual, the history and Next LIVE adjustments are in Review."
            : session.environment === "SIMULATED"
              ? "Prepare the Run of Show, then start the simulated session to open the rehearsal desk. Nothing is broadcast."
              : "Prepare the Run of Show, then start LIVE to open the operating desk."}
        </p>
        <Link href={`/live/${session.id}/${ended ? "review" : "prepare"}`} className="mt-6">
          <Button variant="primary" size="lg" icon="ri-arrow-right-line">
            {ended ? "Open Review" : "Open Prepare"}
          </Button>
        </Link>
      </div>
    </StandardShell>
  );
}

function LiveClock({ session, source }: { session: Session; source: SessionSource }): React.ReactElement {
  // REAL shows tell time by the room's clock (interpolated, frozen while stale); rehearsals use their virtual clock.
  const isRemote = source === "remote";
  const localClock = useDeskClock(isRemote ? null : session);
  const authorityClock = useAuthorityClock();
  const clock = isRemote ? authorityClock : localClock;
  if (clock.nowMs === null) {
    return (
      <FocusedShell
        sessionTitle={session.title}
        environment={session.environment}
        elapsedLabel={null}
        tracking="active"
        operator={session.operator}
        accountLabel={session.accountLabel}
      >
        <div className="p-8 text-[#9AA5B5]" role="status">
          Loading desk…
        </div>
      </FocusedShell>
    );
  }
  return <Desk session={session} source={source} nowMs={clock.nowMs} readNow={clock.read} discontinuity={clock.discontinuity} />;
}

type DialogId = "end" | "reanchor" | "choose" | "skip" | "note" | "options" | "report" | "coverage" | null;

interface AckState {
  title: string;
  message: string;
  confirmText: string;
  body: DispatchInput;
}

/**
 * How one desk command ended.
 * committed: recorded. unknown: sent but the answer was lost (see the banner). ack: needs an explicit exception.
 * rejected: the authority refused it. refused: never sent. unsaved: a local save failed (rehearsals).
 */
type RunKind = "committed" | "unknown" | "ack" | "rejected" | "refused" | "unsaved";

/** Local actions answer at once; REAL actions answer when the room has. */
function settle(result: RunKind | Promise<RunKind>, then: (kind: RunKind) => void): void {
  if (typeof result === "string") then(result);
  else void result.then(then);
}

/** A command that could not be durably recorded. Kept so the operator can retry it explicitly — never replayed silently. */
interface Unsaved {
  intent: DispatchInput;
  message: string;
}

function Desk({
  session,
  source,
  nowMs,
  readNow,
  discontinuity,
}: {
  session: Session;
  source: SessionSource;
  nowMs: number;
  readNow: () => number;
  discontinuity: ClockDiscontinuity | null;
}): React.ReactElement {
  const router = useRouter();
  const { dispatch } = useSessionActions(session);
  const storeState = useStoreState();
  const isRemote = source === "remote";
  const remote = useRemoteState();
  const commands = useRemoteCommands();
  // REAL controls work only while the room is reachable, this browser is an operator, and nothing is waiting on an answer.
  const locked = isRemote && !commands.canWrite;
  const [busy, setBusy] = useState(false);
  const [cmdError, setCmdError] = useState<string | null>(null);

  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [unsaved, setUnsaved] = useState<Unsaved | null>(null);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogId>(null);
  const [ack, setAck] = useState<AckState | null>(null);
  const [reanchorId, setReanchorId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget>({ kind: "new" });
  const [reportKey, setReportKey] = useState(0);

  // A recorded-command acknowledgement is routine: it fades after a few seconds. Errors stay until dismissed.
  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tz = session.timezone;
  const plan = currentPlan(session);
  const simulated = session.environment === "SIMULATED";
  const forecast = useMemo(() => forecastSession(session, nowMs), [session, nowMs]);
  const analysis = useMemo(() => analyzeRecovery(session, nowMs), [session, nowMs]);
  // The AI Copilot only asks the server anything once its tab has been opened, and only advises: it has no way to command.
  const [copilotOpened, setCopilotOpened] = useState(false);
  const copilot = useOperateCopilot({ enabled: copilotOpened, resetKey: session.id });

  const active = activeSegment(session);
  const activeRun = active ? (session.runtime.segments[active.id] ?? null) : null;
  const next = nextPendingSegment(session);
  const nextFc = next ? (forecast.segments.find((s) => s.segmentId === next.id) ?? null) : null;
  const productById = useMemo(() => new Map(session.products.map((p) => [p.id, p])), [session.products]);
  const position = {
    index: active ? plan.segments.findIndex((s) => s.id === active.id) + 1 : 0,
    total: plan.segments.length,
  };
  const startedAt = session.runtime.startedAtMs ?? nowMs;
  const elapsedLabel = formatDuration(Math.max(0, Math.round((nowMs - startedAt) / 1000)));

  // ---- Command plumbing -------------------------------------------------------------------

  /** An exception the operator must explicitly accept (below-minimum, required coverage): ask, then resend with the flag. */
  const askAck = useCallback(
    (code: string, message: string | null, body: DispatchInput, opts: { ackTitle?: string }): void => {
      setAck({
        title: opts.ackTitle ?? (code === "needs_ack_below_minimum" ? "Below the declared minimum" : "Required coverage"),
        message: message ?? "This needs an explicit exception.",
        confirmText: "Proceed with exception",
        body:
          code === "needs_ack_below_minimum"
            ? ({ ...body, acknowledgeBelowMinimum: true } as DispatchInput)
            : ({ ...body, acknowledgeCoverageLoss: true } as DispatchInput),
      });
    },
    []
  );

  const handle = useCallback(
    (res: DispatchResult | null, body: DispatchInput, opts: { ackTitle?: string } = {}): RunKind => {
      if (!res) return "refused";
      if (res.receipt.outcome === "committed") {
        setUnsaved(null);
        const events = res.session.events;
        const last = events[events.length - 1];
        setNotice({ tone: "ok", text: last ? last.summary : "Recorded." });
        return "committed";
      }
      const code = res.receipt.code;
      if (code === "not_persisted") {
        // Nothing was recorded. Keep the exact intent (with its time) for an explicit retry.
        setNotice(null);
        setUnsaved({ intent: res.intent, message: res.receipt.message ?? "Not saved. Nothing was recorded." });
        return "unsaved";
      }
      if (code === "needs_ack_below_minimum" || code === "needs_ack_required_coverage") {
        askAck(code, res.receipt.message, body, opts);
        return "ack";
      }
      setNotice({ tone: "error", text: res.receipt.message ?? "That was not accepted." });
      return "rejected";
    },
    [askAck]
  );

  /** What the room answered: nothing here is shown as done until the room said so. */
  const handleRemote = useCallback(
    (outcome: CommandOutcome, body: DispatchInput, opts: { ackTitle?: string }): RunKind => {
      if (outcome.status === "committed") {
        const latest = remoteRoomStore.getSnapshot().snapshot?.sessions.find((s) => s.id === session.id);
        const event = latest?.events.find((e) => outcome.receipt.eventIds.includes(e.id)) ?? latest?.events[latest.events.length - 1];
        const text = `${event ? event.summary : "Recorded by the room."}${outcome.viewCurrent ? "" : " The latest view is still loading."}`;
        setNotice({ tone: "ok", text });
        return "committed";
      }
      if (outcome.status === "unknown") {
        // The banner above the desk carries the exact action and the ways to resolve it.
        setNotice(null);
        return "unknown";
      }
      if (outcome.status === "rejected" && (outcome.code === "needs_ack_below_minimum" || outcome.code === "needs_ack_required_coverage")) {
        askAck(outcome.code, outcome.message, body, opts);
        return "ack";
      }
      setNotice({ tone: "error", text: outcome.message });
      setCmdError(outcome.message);
      return outcome.status === "refused" ? "refused" : "rejected";
    },
    [askAck, session.id]
  );

  const runRemote = useCallback(
    async (body: DispatchInput, opts: { ackTitle?: string }): Promise<RunKind> => {
      const runtime = toRuntimeBody(body);
      if (!runtime) {
        setNotice({ tone: "error", text: "Simulation clock controls do not apply to a REAL show." });
        return "refused";
      }
      setCmdError(null);
      setBusy(true);
      try {
        return handleRemote(await commands.submit({ body: runtime, sessionId: session.id }), body, opts);
      } finally {
        setBusy(false);
      }
    },
    [commands, handleRemote, session.id]
  );

  /**
   * Every rehearsal command carries the virtual clock. A REAL command carries NO time and no revision of its own:
   * the room stamps it and checks it against the room revision this screen was built from.
   */
  const run = useCallback(
    (body: DispatchInput, opts: { ackTitle?: string } = {}): RunKind | Promise<RunKind> => {
      if (isRemote) return runRemote(body, opts);
      const withTime = body.nowMs === undefined && !simulated ? ({ ...body, nowMs: readNow() } as DispatchInput) : body;
      return handle(dispatch(withTime), withTime, opts);
    },
    [dispatch, handle, isRemote, readNow, runRemote, simulated]
  );

  /** A dialog's confirm. Rehearsals close it at once; a REAL dialog stays open, busy, until the room has answered. */
  const runFromDialog = (body: DispatchInput, opts: { ackTitle?: string } = {}): void => {
    if (!isRemote) {
      setDialog(null);
      run(body, opts);
      return;
    }
    settle(run(body, opts), (kind) => {
      if (kind !== "rejected" && kind !== "refused") setDialog(null);
    });
  };

  const retryUnsaved = (): void => {
    if (!unsaved) return;
    // Same intent, same time, same expected revision: if the show moved on meanwhile it is rejected as stale, never replayed blindly.
    handle(sessionStore.dispatch(session.id, unsaved.intent), unsaved.intent);
  };

  const applyOption = (o: RecoveryOption): void => {
    setDialog(null);
    if (o.kind === "reanchor") {
      setReanchorId(o.command.type === "reanchor_segment" ? o.command.segmentId : null);
      setDialog("reanchor");
      return;
    }
    const body: DispatchInput = { ...o.command, recoveryId: o.id, recoveryLabel: o.label };
    if (o.exception) {
      setAck({
        title: o.exception.code === "commitment_change" ? "Change a commitment" : "Needs an exception",
        message: `${o.exception.message} ${o.detail}`,
        confirmText: "Apply with exception",
        body,
      });
      return;
    }
    void run(body);
  };

  const confirmAck = (): void => {
    if (!ack) return;
    const body = ack.body;
    if (!isRemote) {
      setAck(null);
      run(body);
      return;
    }
    settle(run(body), (kind) => {
      if (kind !== "rejected" && kind !== "refused") setAck(null);
    });
  };

  // An error shown inside a dialog belongs to that dialog only.
  useEffect(() => {
    setCmdError(null);
  }, [dialog, ack]);

  const onAdvance = (): void => {
    // Coverage is declared, not inferred: ask when the segment was cut short by a commitment or is ending early.
    if (active && coverageDeclarationExpected(session, active.id, nowMs)) {
      setDialog("coverage");
      return;
    }
    void run({ type: "advance_segment" }, { ackTitle: "Ending below the declared minimum" });
  };

  const openReport = (target: ReportTarget): void => {
    if (locked) return;
    setReportTarget(target);
    setReportKey((k) => k + 1);
    setDialog("report");
  };

  const openReanchorForNext = (): void => {
    const id = forecast.nextAnchorSegmentId ?? analysis.criticalSegmentId;
    if (!id) {
      setNotice({ tone: "error", text: "There is no hard-anchored segment ahead to re-anchor." });
      return;
    }
    setReanchorId(id);
    setDialog("reanchor");
  };

  // Extension cost, shown BEFORE the operator commits.
  const extendHint = useMemo(() => {
    if (!active) return null;
    const res = applyCommand(session, { type: "extend_segment", segmentId: active.id, deltaSec: 60, nowMs, key: "preview" });
    if (res.receipt.outcome !== "committed") return null;
    const anchorId = forecast.nextAnchorSegmentId;
    if (!anchorId) return { tone: "muted" as const, text: "no anchor affected", full: "No hard anchor ahead is affected" };
    const before = forecast.segments.find((s) => s.segmentId === anchorId)?.anchor;
    const after = forecastSession(res.session, nowMs).segments.find((s) => s.segmentId === anchorId)?.anchor;
    if (!before || !after) return null;
    const title = plan.segments.find((s) => s.id === anchorId)?.title ?? "anchor";
    const extra = after.deficitSec - before.deficitSec;
    if (extra > 0) return { tone: "warn" as const, text: `+${formatDuration(extra)} late`, full: `+${formatDuration(extra)} late for ${title}` };
    if (before.status === "at_risk" || before.status === "missed") {
      // At the exact anchor instant nothing is late yet: say it is due, not "0:00 late".
      if (isAnchorDueNow(before)) {
        return { tone: "warn" as const, text: "anchor due now", full: `${title} is due now and has not started; this does not change the forecast` };
      }
      return {
        tone: "warn" as const,
        text: `already ${formatAnchorLate(before)} late`,
        full: `${title} is already ${formatAnchorLate(before)} late; this does not change the forecast`,
      };
    }
    if (after.bufferSec < before.bufferSec) {
      return { tone: "muted" as const, text: `uses buffer · ${formatDuration(after.bufferSec)} left`, full: `Uses 1:00 of the buffer before ${title}` };
    }
    return { tone: "muted" as const, text: "forecast unchanged", full: "Does not change the forecast" };
  }, [session, nowMs, active, forecast, plan.segments]);

  // ---- Simulator --------------------------------------------------------------------------

  const scenario = session.scenarioId ? SCENARIO_BY_ID[session.scenarioId as ScenarioId] : undefined;
  const stepDef = scenario?.script[session.scriptCursor];
  const virtualNow = effectiveNowMs(session, nowMs);
  const nextAnchorMs = forecast.anchorGuard?.committedMs ?? null;

  const simApplyStep = (): void => {
    const r = sessionStore.applyNextScriptStep(session.id);
    if (!r) return;
    if (r.receipt?.code === "not_persisted") setSimMessage(r.receipt.message);
    else if (r.receipt?.outcome === "rejected") setSimMessage(`${r.receipt.message ?? "Step rejected"} Skip it if you already did this by hand.`);
    else {
      setSimMessage(null);
      if (r.receipt) setNotice({ tone: "ok", text: r.step?.label ?? "Step applied." });
    }
  };

  // ---- Render ------------------------------------------------------------------------------

  return (
    <FocusedShell
      sessionTitle={session.title}
      environment={session.environment}
      elapsedLabel={elapsedLabel}
      tracking="active"
      operator={session.operator}
      accountLabel={session.accountLabel}
      viewer={isRemote && commands.role === "viewer" ? { name: remote.access?.name ?? "viewer" } : null}
      onEndLiveClick={() => setDialog("end")}
      endLiveDisabled={locked}
      contextExtra={
        simulated ? (
          <SimulatorStrip
            virtualNowMs={virtualNow}
            tz={tz}
            nextAnchorMs={nextAnchorMs}
            scripted={Boolean(scenario)}
            step={
              scenario && stepDef
                ? { index: session.scriptCursor, total: scenario.script.length, label: stepDef.label }
                : null
            }
            onAdvance={(sec) => void run({ type: "advance_clock", byMs: sec * 1000 })}
            onToAnchor={() => nextAnchorMs !== null && void run({ type: "set_clock", toMs: nextAnchorMs - 60_000 })}
            onApplyStep={simApplyStep}
            onSkipStep={() => {
              const r = sessionStore.skipNextScriptStep(session.id);
              setSimMessage(r.ok ? null : r.reason);
            }}
            message={simMessage}
          />
        ) : undefined
      }
    >
      <CommandStateContext.Provider value={{ busy, error: cmdError }}>
        <div className="min-h-full lg:h-full flex flex-col gap-2 p-3 [@media(min-height:860px)]:gap-3 [@media(min-height:860px)]:lg:p-4 max-w-[1720px] w-full mx-auto">
        {isRemote && locked && commands.blockedReason && (
          <p className="text-[16px] text-[#F6C875] shrink-0 px-1" data-testid="desk-readonly-note">
            <i className="ri-lock-line mr-1.5" aria-hidden="true" />
            {commands.blockedReason}
          </p>
        )}
        {!isRemote && storeState.storage !== "ok" && storeState.hydrated && !unsaved && (
          <InlineNotice
            variant="warning"
            title={storeState.storage === "write_failed" ? "The last change could not be saved" : "Not being saved"}
            message="Browser storage is not accepting writes. LiveLift will not acknowledge anything it cannot store; commands are refused until storage works again."
          />
        )}

        {!isRemote && unsaved && (
          <div
            role="alert"
            data-testid="unsaved-banner"
            className="rounded-[8px] px-3 py-1 text-[16px] flex items-center justify-between gap-3 shrink-0 bg-[#302025] text-[#F4A4A4]"
          >
            <span className="flex items-center gap-2 min-w-0">
              <i className="ri-error-warning-line" aria-hidden="true" />
              <span className="truncate" title={unsaved.message}>{unsaved.message}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <Button size="desk" variant="secondary" onClick={retryUnsaved} data-testid="unsaved-retry-btn">
                Retry
              </Button>
              <Button size="desk" variant="ghost" onClick={() => setUnsaved(null)} data-testid="unsaved-discard-btn">
                Discard
              </Button>
            </span>
          </div>
        )}

        {discontinuity && (
          <div
            role="alert"
            data-testid="clock-discontinuity"
            className="rounded-[8px] px-3 py-1 text-[16px] flex items-center justify-between gap-3 shrink-0 bg-[#2A2316] text-[#F6C875]"
          >
            <span className="min-w-0">
              <i className="ri-time-line mr-1.5" aria-hidden="true" />
              {discontinuity.source === "server" ? "The room's clock is" : "Device clock moved back"}{" "}
              {discontinuity.source === "server" ? "behind recorded time by" : ""} {formatDuration(Math.round(discontinuity.behindByMs / 1000))} (it reads{" "}
              {formatClock(discontinuity.deviceNowMs, tz, true)}). LiveLift keeps counting from {formatClock(discontinuity.keptNowMs, tz, true)};
              alignment is uncertain until the clock catches up. Anchors and recorded times are unchanged.
            </span>
            <Button
              size="desk"
              variant="secondary"
              disabled={locked}
              onClick={() =>
                void run({ type: "acknowledge_clock_discontinuity", deviceNowMs: discontinuity.deviceNowMs, keptNowMs: discontinuity.keptNowMs })
              }
              data-testid="clock-discontinuity-record-btn"
            >
              Record in history
            </Button>
          </div>
        )}

        {notice && (
          <div
            // A REAL command's final answer is spoken once by the shared announcer; a rehearsal's is spoken here.
            role={isRemote ? undefined : "status"}
            data-testid="command-ack-banner"
            className={`rounded-[8px] px-3 py-1 text-[16px] flex items-center justify-between gap-3 shrink-0 ${
              notice.tone === "ok"
                ? "fixed bottom-4 right-4 z-40 max-w-[min(560px,calc(100vw-2rem))] bg-[#161B22] text-[#DFFF00] border border-[#2B3324] shadow-2xl"
                : "bg-[#302025] text-[#F4A4A4]"
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <i className={notice.tone === "ok" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} aria-hidden="true" />
              <span className="truncate" title={notice.text}>{notice.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="min-h-[44px] min-w-[44px] text-[#CAD0DA] hover:text-white cursor-pointer"
              aria-label="Dismiss"
            >
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* NOW · NEXT · WHY · ACTION */}
        <fieldset disabled={locked} className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-3 shrink-0 border-0 p-0 m-0 min-w-0">
          <NowPanel
            segment={active}
            run={activeRun}
            product={active?.productId ? (productById.get(active.productId) ?? null) : null}
            position={position}
            active={forecast.active}
            guard={forecast.anchorGuard}
            nowMs={nowMs}
            tz={tz}
            nextSegment={next}
            nextForecast={nextFc}
            onSetEstimate={(sec) => {
              if (active) void run({ type: "set_remaining_estimate", segmentId: active.id, remainingSec: sec });
            }}
            onMarkUnknown={() => {
              if (active) void run({ type: "mark_remaining_unknown", segmentId: active.id });
            }}
          />
          <NextPanel
            nextSegment={next}
            nextForecast={nextFc}
            nextProduct={next?.productId ? (productById.get(next.productId) ?? null) : null}
            activeSegment={active}
            analysis={analysis}
            nowMs={nowMs}
            tz={tz}
            onAdvance={onAdvance}
            onApply={applyOption}
            onShowAll={() => setDialog("options")}
            onReanchorNext={openReanchorForNext}
            onEndLive={() => setDialog("end")}
            simulated={simulated}
          />
        </fieldset>

        {/* Operator toolbar: the next cue, then routine runtime actions */}
        <fieldset disabled={locked} className="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap xl:flex-nowrap shrink-0 px-1 min-h-[44px] border-0 m-0 min-w-0" data-testid="operator-toolbar">
          <CueBar
            cues={plan.cues}
            forecasts={forecast.cues}
            runs={session.runtime.cues}
            actions={session.runtime.actions ?? {}}
            tz={tz}
            onPerformed={(id) => void run({ type: "report_cue", cueId: id, report: "performed" })}
            onAttempted={(id) => void run({ type: "report_cue", cueId: id, report: "attempted" })}
            onReport={openReport}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="desk"
              disabled={!active}
              aria-describedby={!active ? "extend-disabled-reason" : undefined}
              onClick={() => active && void run({ type: "extend_segment", segmentId: active.id, deltaSec: 60 })}
              data-testid="extend-plus-one-btn"
              className="!py-0.5 flex-col !gap-0 leading-tight"
              title={`Adds 1:00 to ${active?.title ?? "the segment"}'s planned target (recorded as a plan change; the baseline stays untouched). It is not the host's estimate.${extendHint ? ` · ${extendHint.full}` : ""}`}
            >
              <span>Extend target +1m</span>
              {extendHint && (
                <span className={`text-[16px] font-normal max-w-[230px] truncate ${extendHint.tone === "warn" ? "text-[#F6C875]" : "text-[#AEB7C5]"}`} data-testid="extend-hint" title={extendHint.full}>
                  {extendHint.text}
                </span>
              )}
            </Button>
            {!active && <span id="extend-disabled-reason" className="text-[16px] text-[#AEB7C5]">Start a segment before extending its target.</span>}
            <Button variant="secondary" size="desk" onClick={() => setDialog("choose")} data-testid="choose-next-btn">
              Choose next
            </Button>
            <Button variant="secondary" size="desk" onClick={() => setDialog("skip")} data-testid="skip-segment-btn">
              Skip…
            </Button>
            <Button variant="ghost" size="desk" icon="ri-edit-line" onClick={() => setDialog("note")} data-testid="quick-add-note-btn">
              Note
            </Button>
            {/* One-tap OPERATOR REPORTS, recorded through the ordinary note command (no new authority state). */}
            <QuickReports onReport={(text) => void run({ type: "add_note", text })} />
          </div>
        </fieldset>

        {/* Stacked panels grow with content; desktop panels share the remaining desk height. */}
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-3 lg:flex-1 min-h-[200px]">
          <section className="rounded-[12px] bg-[#13161C] p-3 pb-1 flex flex-col min-h-0" aria-label="Run of Show panel">
            <div className="flex items-center justify-between gap-3 pb-1 shrink-0 flex-wrap">
              <h2 className="text-[18px] font-medium text-[#F5F7FC]">Run of Show</h2>
              <div className="flex flex-wrap items-center gap-3 min-w-0 text-[16px]">
                {forecast.finishMs !== null && (
                  <span className="text-[#CAD0DA] tabular-nums" data-testid="projected-finish">
                    Projected finish {forecast.finishLowerBound ? "≥ " : ""}
                    {formatClock(forecast.finishMs, tz, true)}
                  </span>
                )}
                {forecast.baselineFinishMs !== null && (
                  <span className="inline-flex items-center gap-1.5 text-[#AEB7C5]" title={`Downstream drift against the immutable baseline (finish ${formatClock(forecast.baselineFinishMs, tz, true)})`}>
                    drift <Drift seconds={forecast.finishDriftSec} lowerBound={forecast.finishLowerBound} size="desk" />
                  </span>
                )}
                <Button variant="ghost" size="desk" icon="ri-focus-3-line" onClick={() => scrollCurrentRowIntoView()}>
                  Return to current
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-[12rem] max-h-[50dvh] lg:min-h-0 lg:max-h-none overflow-y-auto pr-1" data-ros-scroll tabIndex={0} aria-label="Run of Show rows">
              <RunOfShowLive
                session={session}
                forecast={forecast}
                products={session.products}
                tz={tz}
                onReportCue={(id) => openReport({ kind: "cue", id })}
              />
            </div>
          </section>

          <SupportTabs
            session={session}
            products={session.products}
            tz={tz}
            copilotAvailable={copilot.phase === "available"}
            onCopilotOpen={() => setCopilotOpened(true)}
            copilot={
              <OperateCopilot
                copilot={copilot}
                session={session}
                source={source}
                nowMs={nowMs}
                forecast={forecast}
                analysis={analysis}
                locked={locked}
                onApplyOption={applyOption}
              />
            }
          />
        </div>
      </div>

      <EndLiveDialog
        isOpen={dialog === "end"}
        onClose={() => setDialog(null)}
        session={session}
        onConfirm={() => {
          if (!isRemote) setDialog(null);
          settle(run({ type: "end_live" }), (kind) => {
            if (kind === "committed") {
              setDialog(null);
              router.push(`/live/${session.id}/review`);
            } else if (kind !== "rejected" && kind !== "refused") setDialog(null);
          });
        }}
      />
      <AckDialog
        isOpen={ack !== null}
        title={ack?.title ?? ""}
        message={ack?.message ?? ""}
        confirmText={ack?.confirmText ?? "Proceed"}
        onClose={() => setAck(null)}
        onConfirm={confirmAck}
      />
      <ReanchorDialog
        key={`reanchor-${reanchorId ?? "none"}`}
        isOpen={dialog === "reanchor"}
        onClose={() => setDialog(null)}
        session={session}
        nowMs={virtualNow}
        segmentId={reanchorId}
        onConfirm={(input) =>
          runFromDialog({
            type: "reanchor_segment",
            segmentId: input.segmentId,
            anchorOffsetSec: input.anchorOffsetSec,
            reason: input.reason,
            recoveryId: `reanchor:${input.segmentId}`,
            recoveryLabel: "Re-anchor (commitment change)",
          })
        }
      />
      <ChooseNextDialog
        isOpen={dialog === "choose"}
        onClose={() => setDialog(null)}
        session={session}
        nowMs={virtualNow}
        onChoose={(id) => {
          if (!next) return;
          settle(run({ type: "reorder_segment", segmentId: id, beforeSegmentId: next.id }), (kind) => {
            if (kind === "committed") setDialog(null);
          });
        }}
      />
      <SkipDialog
        isOpen={dialog === "skip"}
        onClose={() => setDialog(null)}
        session={session}
        onSkip={(id) => runFromDialog({ type: "skip_segment", segmentId: id }, { ackTitle: "Skipping required coverage" })}
      />
      <NoteDialog
        isOpen={dialog === "note"}
        onClose={() => setDialog(null)}
        onSave={(text) => runFromDialog({ type: "add_note", text })}
      />
      <ReportActionDialog
        key={`report-${reportKey}`}
        isOpen={dialog === "report"}
        session={session}
        initial={reportTarget}
        nowMs={simulated ? virtualNow : nowMs}
        onClose={() => setDialog(null)}
        onConfirm={(body) => runFromDialog(body)}
      />
      <CoverageDialog
        key={`coverage-${active?.id ?? "none"}`}
        isOpen={dialog === "coverage"}
        segmentTitle={active?.title ?? "this segment"}
        onClose={() => setDialog(null)}
        onConfirm={({ coverage, followUp }) =>
          runFromDialog({ type: "advance_segment", coverage, followUp: followUp || undefined }, { ackTitle: "Ending below the declared minimum" })
        }
      />
      <AllOptionsDialog isOpen={dialog === "options"} onClose={() => setDialog(null)} analysis={analysis} onApply={applyOption} />
      </CommandStateContext.Provider>
    </FocusedShell>
  );
}
