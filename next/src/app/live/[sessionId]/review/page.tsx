"use client";

import React, { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Session } from "@/contracts";
import { SessionContextBar, StandardShell } from "@/components/shell";
import { Button, CommandStateContext } from "@/components/ui";
import { SessionGate, type GateContext } from "@/components/ops/SessionGate";
import { PlanActualLanes } from "@/components/ops/PlanActualLanes";
import { ActionResults, CueResults, HistoryList, PlanActualRows, ReviewSummary } from "@/components/ops/ReviewTable";
import { NextLivePanel } from "@/components/ops/NextLivePanel";
import { Signal } from "@/components/ops/StatusChips";
import { ReviewCopilot } from "@/components/ai/ReviewCopilot";
import { useReviewCopilot } from "@/components/ai/useAiCopilot";
import { LaterEvidenceView } from "@/components/intelligence/LaterEvidenceView";
import { PerspectiveTabs, type Perspective } from "@/components/intelligence/PerspectiveTabs";
import { ReplayTimeline } from "@/components/intelligence/ReplayTimeline";
import { useLiveIntelligence, useHistoricalEvidence } from "@/components/intelligence/useLiveIntelligence";
import { DEFAULT_FIXTURE_SCENARIO, isFixtureScenario, type FixtureScenarioId } from "@/lib/intelligence/fixtures";
import { reconstructAsKnownThen } from "@/lib/domain/asKnownThen";
import { buildReplay } from "@/lib/intelligence/replay";
import { buildReviewFacts } from "@/lib/ai/context";
import { buildReview,formatClock, formatDay, formatDuration, proposeChanges } from "@/lib/domain";
import { useRemoteCommands, useSessionActions } from "@/lib/store/hooks";
import type { RuntimeCommandBody } from "@/contracts/authority";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ReviewPage({ params }: PageProps): React.ReactElement {
  const { sessionId } = use(params);
  return (
    <Suspense fallback={<StandardShell><p className="p-8 text-[#CAD0DA]" role="status">Loading Review…</p></StandardShell>}>
      <SessionGate id={sessionId} allowArchive>
        {(session, ctx) => <ReviewRoot session={session} ctx={ctx} />}
      </SessionGate>
    </Suspense>
  );
}

function ReviewRoot({ session, ctx }: { session: Session; ctx: GateContext }): React.ReactElement {
  if (session.lifecycle === "ended") return <ReviewDesk session={session} ctx={ctx} />;
  const live = session.lifecycle === "active";
  return (
    <StandardShell>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="review-unavailable">
        <h1 className="text-[28px] font-medium text-[#F5F7FC]">Review opens after the show ends</h1>
        <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[520px]">
          {live
            ? "This show is still running. End LIVE on the operating desk to freeze the record, then compare plan and actual here."
            : "This show has not started, so there is no actual history to review yet."}
        </p>
        <Link href={`/live/${session.id}/${live ? "operate" : "prepare"}`} className="mt-6">
          <Button variant="primary" size="lg" icon="ri-arrow-right-line">
            {live ? "Back to the desk" : "Open Prepare"}
          </Button>
        </Link>
      </div>
    </StandardShell>
  );
}

function ReviewDesk({ session, ctx }: { session: Session; ctx: GateContext }): React.ReactElement {
  const params = useSearchParams();
  const initial = params.get("view") === "next" || params.get("view") === "learn" ? "next" : "plan";
  const [view, setView] = useState<"plan" | "next">(initial);
  const { dispatch } = useSessionActions(session);
  const commands = useRemoteCommands();
  const isRemote = ctx.source === "remote";
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cmdError, setCmdError] = useState<string | null>(null);
  // History is appended after the show: a REAL show only through the room, a pre-Phase-2 archive never.
  const canAppend = ctx.archive ? false : isRemote ? commands.canWrite || commands.pending !== null : true;
  const tz = session.timezone;
  const historicalSession = useMemo(() => {
    if (session.runtime.startedAtMs === null || session.runtime.endedAtMs === null) return session;
    const known = reconstructAsKnownThen(session, session.runtime.endedAtMs);
    // Missing timing in a retained archive remains missing; replay must not repair an incomplete record.
    for (const [id, run] of Object.entries(known.runtime.segments)) {
      const retained = session.runtime.segments[id];
      if (retained?.startedAtMs === null) run.startedAtMs = null;
      if (retained?.endedAtMs === null) run.endedAtMs = null;
    }
    return { ...session, events: known.events, runtime: known.runtime, plans: session.plans.filter(p => p.kind === "baseline" || known.events.some(e => e.planVersionId === p.id)) };
  }, [session]);
  const review = useMemo(() => buildReview(historicalSession), [historicalSession]);
  const fullReview = useMemo(() => buildReview(session), [session]);
  const proposals = useMemo(() => proposeChanges(session), [session]);
  // Advisory only. A pre-Phase-2 archive is not in the room, so the server cannot read it and the Copilot stays off.
  // REAL shows already sync with the room; a rehearsal's Review stays offline until the operator opens the Copilot.
  const [copilotOpened, setCopilotOpened] = useState(isRemote);
  const copilot = useReviewCopilot({ enabled: copilotOpened && !ctx.archive, resetKey: session.id });
  const productFacts = useMemo(() => (review ? buildReviewFacts(historicalSession, review) : []), [historicalSession, review]);
  const askAi = (): void => copilot.ask(isRemote ? { sessionId: session.id } : { sessionId: session.id, session });

  // Perspective is view state only. "As known then" is the default; later evidence is fetched only once it is opened.
  const [perspective, setPerspective] = useState<Perspective>(params.get("perspective") === "later" ? "later" : "known");
  const [laterOpened, setLaterOpened] = useState(params.get("perspective") === "later");
  const wantedScenario = params.get("evidence");
  const [scenario, setScenario] = useState<FixtureScenarioId>(isFixtureScenario(wantedScenario) ? wantedScenario : DEFAULT_FIXTURE_SCENARIO);
  const intelligence = useLiveIntelligence({ session, review, enabled: laterOpened, archive: ctx.archive, scenario });
  const historical = useHistoricalEvidence(session, perspective === "known" && !ctx.archive);
  const replay = useMemo(() => (review ? buildReplay(session, review) : null), [session, review]);
  const rememberInUrl = (key: string, value: string | null): void => {
    try {
      const url = new URL(window.location.href);
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* the address bar keeps its old value; harmless */
    }
  };
  const choosePerspective = (next: Perspective): void => {
    setPerspective(next);
    if (next === "later") setLaterOpened(true);
    rememberInUrl("perspective", next === "later" ? "later" : null);
  };
  const chooseScenario = (next: FixtureScenarioId): void => {
    setScenario(next);
    rememberInUrl("evidence", next === DEFAULT_FIXTURE_SCENARIO ? null : next);
  };

  if (!review) {
    return (
      <StandardShell>
        <div className="p-8 space-y-4">
          <p className="text-[#F4A4A4]" role="alert">This show ended without a recorded start. A plan vs actual comparison is unavailable.</p>
          <Link href="/sessions" className="text-[#DFFF00] underline">Return to Sessions</Link>
        </div>
      </StandardShell>
    );
  }

  /** Rehearsals append at once. A REAL note or correction is only recorded when the room says so. */
  const append = (body: RuntimeCommandBody): boolean | Promise<boolean> => {
    if (!isRemote) {
      const res = dispatch(body);
      setMessage(res && res.receipt.outcome === "rejected" ? (res.receipt.message ?? "Not accepted.") : null);
      return !(res && res.receipt.outcome === "rejected");
    }
    setMessage(null);
    setCmdError(null);
    setBusy(true);
    return commands
      .submit({ body, sessionId: session.id })
      .then((outcome) => {
        if (outcome.status === "committed") return true;
        if (outcome.status === "unknown") {
          setMessage(`${outcome.message} It is held exactly as sent; use the banner to check it.`);
          return true;
        }
        setMessage(outcome.message);
        setCmdError(outcome.message);
        return false;
      })
      .finally(() => setBusy(false));
  };

  return (
    <StandardShell>
      <CommandStateContext.Provider value={{ busy, error: cmdError }}>
      <div className="flex-1 flex flex-col min-h-0 bg-[#090B0F]">
        <SessionContextBar
          eyebrow={ctx.archive ? "Review · local archive" : "Review"}
          title={session.title}
          environment={session.environment}
          metaText={`${formatDay(review.summary.startedAtMs, tz)} · ${formatClock(review.summary.startedAtMs, tz)}–${formatClock(review.summary.endedAtMs, tz)} · ${formatDuration(review.summary.trackedSec)} tracked`}
          rightAction={
              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Review view">
              <Button
                variant={view === "plan" ? "secondary" : "ghost"}
                size="sm"
                icon="ri-time-line"
                role="tab"
                aria-selected={view === "plan"}
                onClick={() => setView("plan")}
                data-testid="view-plan-btn"
              >
                Plan vs Actual
              </Button>
              <Button
                variant={view === "next" ? "primary" : "ghost"}
                size="sm"
                icon="ri-arrow-right-line"
                role="tab"
                aria-selected={view === "next"}
                onClick={() => setView("next")}
                data-testid="view-next-btn"
              >
                Next LIVE{proposals.length > 0 ? ` · ${proposals.length} proposed` : ""}
              </Button>
            </div>
          }
        />

        {session.environment === "SIMULATED" && (
          <p className="px-6 lg:px-8 pt-3 text-[14px] text-[#C8B2FF]" data-testid="simulated-review-note">
            <i className="ri-flask-line mr-1.5" aria-hidden="true" />
            Every record on this page is SIMULATED. It is never mixed with REAL history and never counts as real learning.
          </p>
        )}
        {ctx.archive && (
          <p className="px-6 lg:px-8 pt-3 text-[14px] text-[#F6C875]" data-testid="archive-note">
            <i className="ri-archive-line mr-1.5" aria-hidden="true" />
            Local archive. This REAL show was recorded in this browser before LiveLift moved REAL shows to the shared room. It is history only: it is
            read-only here and was never uploaded or merged into the room.
          </p>
        )}
        {isRemote && commands.role === "viewer" && (
          <p className="px-6 lg:px-8 pt-3 text-[14px] text-[#F6C875]" data-testid="review-readonly-note">
            <i className="ri-eye-line mr-1.5" aria-hidden="true" />
            You are viewing this room read-only. Notes, corrections and Next LIVE need an operator.
          </p>
        )}
        {message && (
          <div role="alert" className="mx-6 lg:mx-8 mt-3 rounded-[8px] bg-[#302025] text-[#F4A4A4] px-4 py-2 text-[14px]">
            {message}
          </div>
        )}

        {view === "plan" ? (
          <div className="px-4 lg:px-6 py-4 max-w-[1760px] w-full mx-auto space-y-4">
            <PerspectiveTabs value={perspective} onChange={choosePerspective} panelId="review-perspective-panel" />
            <div role="tabpanel" id="review-perspective-panel" aria-labelledby={`perspective-tab-${perspective}`} data-perspective={perspective} data-testid="review-perspective-panel" className="space-y-4">
            {perspective === "later" ? (
              <>
                {/* The provider sections below start at h3; this keeps the outline h1 > h2 > h3 for screen-reader navigation. */}
                <h2 className="sr-only">With later evidence</h2>
                <LaterEvidenceView session={session} review={review} intelligence={intelligence} scenario={scenario} onScenario={chooseScenario} onRetry={intelligence.reload} />
                <HistoryList items={fullReview?.history ?? []} tz={tz} canAppend={canAppend}
                  onNote={text => append({ type: "add_note", text })} onCorrect={(targetEventId, text) => append({ type: "append_correction", targetEventId, text })} />

                <div id="ai-review-copilot" className="scroll-mt-4">
                  <ReviewCopilot copilot={copilot} perspective="later" session={session} source={isRemote ? "remote" : "local"} archive={ctx.archive} facts={productFacts} opened={copilotOpened} onOpen={() => setCopilotOpened(true)} onOpenNextLive={() => setView("next")} />
                </div>
              </>
            ) : (
            <>
            <p className="text-[14px] leading-snug text-[#9AA5B5]" data-testid="known-then-note">
              <i className="ri-eye-line mr-1.5" aria-hidden="true" />
              This is what the operator could see while the LIVE ran: the plan, what was recorded, and what the operator reported. No provider data is mixed in.
            </p>
            <ReviewSummary review={review} tz={tz} />

            <a href="#ai-review-copilot" className="inline-flex min-h-[44px] items-center gap-2 text-[15px] text-[#7DD8EA] hover:underline underline-offset-4" data-testid="jump-to-copilot">
              <i className="ri-sparkling-2-line" aria-hidden="true" />
              AI Review Copilot: a second reading of this evidence
              <i className="ri-arrow-down-line" aria-hidden="true" />
            </a>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
              <div className="space-y-4 min-w-0">
                <section className="rounded-[12px] bg-[#13161C] p-4" aria-label="Plan vs Actual timeline">
                  <h2 className="text-[18px] font-medium text-[#F5F7FC] mb-2">Plan vs Actual</h2>
                  <PlanActualLanes rows={review.rows} tz={tz} />
                </section>

                {replay && <ReplayTimeline replay={replay} tz={tz} historical={historical} />}

                <section className="rounded-[12px] bg-[#13161C] p-3" aria-label="Segments">
                  <h2 className="text-[18px] font-medium text-[#F5F7FC] px-2 mb-1">Segments</h2>
                  <p className="text-[13px] text-[#9AA5B5] px-2 mb-1" data-testid="segments-coverage-note">
                    Completed means the segment ran and was closed — not that everything planned was covered. Coverage is shown only when the operator
                    declared it; otherwise it is unknown, not complete and not failed.
                  </p>
                  <PlanActualRows rows={review.rows} products={session.products} tz={tz} />
                </section>

                <section className="rounded-[12px] bg-[#13161C] p-3" aria-label="Cues">
                  <h2 className="text-[18px] font-medium text-[#F5F7FC] px-2 mb-1">Cues</h2>
                  <p className="text-[13px] text-[#9AA5B5] px-2 mb-1">
                    Zero-duration markers. Reports are the operator&apos;s word, not platform confirmation.
                  </p>
                  <CueResults cues={review.cues} tz={tz} />
                </section>

                {review.actions.length > 0 && (
                  <section className="rounded-[12px] bg-[#13161C] p-3" aria-label="Unplanned actions">
                    <h2 className="text-[18px] font-medium text-[#F5F7FC] px-2 mb-1">Unplanned actions</h2>
                    <p className="text-[14px] text-[#9AA5B5] px-2 mb-1">
                      Native actions the operator reported that were not planned as cues. Reports, not platform confirmation.
                    </p>
                    <ActionResults actions={review.actions} tz={tz} />
                  </section>
                )}

                {review.revisions.length > 0 && (
                  <section className="rounded-[12px] bg-[#13161C] p-4" aria-label="Plan changes during the show" data-testid="plan-revisions">
                    <h2 className="text-[18px] font-medium text-[#F5F7FC] mb-1">Plan changes during the show</h2>
                    <p className="text-[13px] text-[#9AA5B5] mb-2">
                      The baseline above is the original commitment. These are explicit, recorded revisions beside it.
                    </p>
                    <ol className="divide-y divide-[#1F2530]">
                      {review.revisions.map((r) => (
                        <li key={r.planId} className="py-1.5 flex gap-3 text-[14px]">
                          <span className="tabular-nums font-mono text-[13px] text-[#AEB7C5] w-[64px] shrink-0">
                            {formatClock(r.createdAtMs, tz, true)}
                          </span>
                          <span className="text-[#E4E8F0]">{r.reason ?? "Plan revision"}</span>
                          <Signal tone="muted" className="ml-auto text-[13px]">
                            v{r.version}
                          </Signal>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {/* Interpretation comes after every recorded fact it reads, and before the next-LIVE decision. */}
                <div id="ai-review-copilot" className="scroll-mt-4">
                  <ReviewCopilot copilot={copilot} perspective="known" session={session} source={isRemote ? "remote" : "local"} archive={ctx.archive} facts={productFacts} opened={copilotOpened} onOpen={() => setCopilotOpened(true)} onOpenNextLive={() => setView("next")} />
                </div>
              </div>

              <aside
                className="rounded-[12px] bg-[#13161C] p-4 flex flex-col xl:sticky xl:top-4 xl:max-h-[calc(100dvh-140px)] min-h-[320px]"
                aria-label="Actual history"
              >
                <HistoryList
                  items={review.history}
                  tz={tz}
                  canAppend={false}
                  onNote={(text) => append({ type: "add_note", text })}
                  onCorrect={(targetEventId, text) => append({ type: "append_correction", targetEventId, text })}
                />
              </aside>
            </div>
            </>
            )}
            </div>

            <div className="rounded-[12px] bg-[#101319] px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[14px] text-[#B7C1CE] max-w-[760px]">
                {proposals.length > 0
                  ? `${proposals.length} concrete adjustment${proposals.length === 1 ? " is" : "s are"} ready to select for the next show.`
                  : "Nothing in this show justifies a change; you can still carry the plan forward."}{" "}
                {perspective === "later"
                  ? "Provider evidence is later evidence: it informs your choice, it does not choose for you. Association with viewer or sales activity is not causation."
                  : "This page shows operational facts only. Association with viewer or sales activity is not causation, and platform analytics stay in TikTok."}
              </p>
              <Button variant="primary" icon="ri-arrow-right-line" onClick={() => setView("next")} data-testid="goto-next-live-btn">
                Plan the next LIVE
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-4 lg:px-6 py-4 max-w-[1760px] w-full mx-auto">
            <NextLivePanel key={session.id} session={session} ctx={ctx} aiCopilot={ctx.archive || !copilotOpened ? undefined : copilot} onAskAi={askAi} />
          </div>
        )}
      </div>
      </CommandStateContext.Provider>
    </StandardShell>
  );
}
