"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SessionSchema, type Cue, type PlanVersion, type Session } from "@/contracts";
import type { SavePreparePayload } from "@/contracts/authority";
import { StandardShell, SessionContextBar } from "@/components/shell";
import { Button, CommandStateContext, Dialog } from "@/components/ui";
import { SessionGate, type GateContext } from "@/components/ops/SessionGate";
import { PrepareRos, ProductPack } from "@/components/ops/PrepareRos";
import { CueEditorDialog, DetailsDialog, SegmentEditorDialog, type CueDraft, type SegmentDraft } from "@/components/ops/SegmentEditor";
import { Signal } from "@/components/ops/StatusChips";
import { afterResult } from "@/lib/client/commandText";
import {
  SCENARIO_BY_ID,
  addCue,
  addSegment,
  assessPlan,
  formatClock,
  formatDay,
  formatDuration,
  moveSegment,
  newSegment,
  removeCue,
  removeSegment,
  schedulePlan,
  setPlannedStart,
  updateCue,
  updateSegment,
  type ScenarioId,
} from "@/lib/domain";
import { sessionStore } from "@/lib/store/sessionStore";
import { useAuthorityClock, useNow, useRemoteCommands, useRemoteState, useStoreState, type SessionSource } from "@/lib/store/hooks";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function PreparePage({ params }: PageProps): React.ReactElement {
  const { sessionId } = use(params);
  return <SessionGate id={sessionId}>{(session, ctx) => <PrepareRoot session={session} source={ctx.source} />}</SessionGate>;
}

function PrepareRoot({ session, source }: { session: Session; source: GateContext["source"] }): React.ReactElement {
  if (session.lifecycle === "planned") return <PrepareDesk session={session} source={source} />;
  const ended = session.lifecycle === "ended";
  return (
    <StandardShell>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="prepare-locked">
        <h1 className="text-[28px] font-medium text-[#F5F7FC]">{ended ? "This show has ended" : "This show is live"}</h1>
        <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[520px]">
          The baseline plan was locked when LIVE started and is never rewritten. Changes during the show are explicit plan versions on the
          operating desk.
        </p>
        <Link href={`/live/${session.id}/${ended ? "review" : "operate"}`} className="mt-6">
          <Button variant="primary" size="lg" icon="ri-arrow-right-line">
            {ended ? "Open Review" : "Open the operating desk"}
          </Button>
        </Link>
      </div>
    </StandardShell>
  );
}

type Editing = { mode: "new" } | { mode: "edit"; id: string } | null;

type Alloc = { segmentId: () => string; cueId: () => string };

function PrepareDesk({ session, source }: { session: Session; source: SessionSource }): React.ReactElement {
  const router = useRouter();
  const isRemote = source === "remote";
  const localNow = useNow(isRemote ? null : session);
  const authorityClock = useAuthorityClock();
  const nowMs = isRemote ? authorityClock.nowMs : localNow;
  const storeState = useStoreState();
  const remote = useRemoteState();
  const commands = useRemoteCommands();
  // REAL plans are saved to the room: the controls work only while it is reachable and this browser is an operator.
  const editable = !isRemote || commands.canWrite || commands.pending !== null;
  const [busy, setBusy] = useState(false);
  const [cmdError, setCmdError] = useState<string | null>(null);
  const plan = session.plans[0];
  const tz = session.timezone;

  const [segmentEditing, setSegmentEditing] = useState<Editing>(null);
  const [cueEditing, setCueEditing] = useState<Editing>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const schedule = useMemo(() => schedulePlan(plan), [plan]);
  const assessment = useMemo(() => assessPlan(plan, session.products, tz), [plan, session.products, tz]);
  const blockers = assessment.issues.filter((i) => i.severity === "blocker");
  const warnings = assessment.issues.filter((i) => i.severity === "warning");
  const scenario = session.scenarioId ? SCENARIO_BY_ID[session.scenarioId as ScenarioId] : undefined;
  const clock = (ms: number): string => formatClock(ms, tz, true);
  // "Planned" is the span from start to finish. Idle buffers before anchors are part of it.
  const spanSec = assessment.finishMs !== null ? Math.round((assessment.finishMs - plan.plannedStartMs) / 1000) : null;

  // An error shown inside a dialog belongs to that dialog only.
  useEffect(() => {
    setCmdError(null);
  }, [segmentEditing, cueEditing, detailsOpen, startOpen]);

  /** One operator intent -> one `save_prepare` command carrying the complete editable draft. Nothing is installed until the room answers. */
  const editRemote = async (fn: (draft: Session, alloc: Alloc) => void): Promise<boolean> => {
    setMessage(null);
    setCmdError(null);
    setSavedFeedback(null);
    const draft = structuredClone(session);
    fn(draft, {
      segmentId: () => `${draft.id}:s${++draft.seq.segment}`,
      cueId: () => `${draft.id}:c${++draft.seq.cue}`,
    });
    const checked = SessionSchema.safeParse(draft);
    if (!checked.success) {
      const why = `That change is not valid and was not saved: ${checked.error.issues[0]?.message ?? "invalid plan"}.`;
      setMessage(why);
      setCmdError(why);
      return false;
    }
    const d = checked.data;
    const payload: SavePreparePayload = {
      title: d.title,
      timezone: d.timezone,
      objective: d.objective,
      accountLabel: d.accountLabel,
      products: d.products,
      plannedStartMs: d.plans[0].plannedStartMs,
      segments: d.plans[0].segments,
      cues: d.plans[0].cues,
    };
    setBusy(true);
    try {
      const outcome = await commands.submit({ body: { type: "save_prepare", ...payload }, sessionId: session.id });
      if (outcome.status === "committed") {
        setSavedFeedback("Change saved to this show's plan.");
        return true;
      }
      if (outcome.status === "unknown") {
        // The exact request is kept (see the banner above); the dialog may close without losing it.
        setMessage(`${outcome.message} Your change is held exactly as sent; use the banner to check it.`);
        return true;
      }
      setMessage(outcome.message);
      setCmdError(outcome.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Returns false when the change was not saved; the caller keeps the operator's input open for a retry.
   * A rehearsal answers immediately; a REAL show answers when the room has.
   */
  const edit = (fn: (draft: Session, alloc: Alloc) => void): boolean | Promise<boolean> => {
    if (isRemote) return editRemote(fn);
    const r = sessionStore.editDraft(session.id, fn);
    setMessage(r.ok ? null : r.reason);
    setCmdError(r.ok ? null : r.reason);
    setSavedFeedback(r.ok ? "Change saved to this rehearsal's plan." : null);
    return r.ok;
  };
  const editPlan = (fn: (p: PlanVersion, alloc: Alloc) => PlanVersion): boolean | Promise<boolean> =>
    edit((d, alloc) => {
      d.plans[0] = fn(d.plans[0], alloc);
    });

  // A dialog closes only when its change was actually saved; otherwise the operator's input stays for a retry.
  const saveSegment = (draft: SegmentDraft): void => {
    const ok =
      segmentEditing?.mode === "edit"
        ? editPlan((p) => updateSegment(p, segmentEditing.id, draft))
        : editPlan((p, alloc) => addSegment(p, newSegment(alloc.segmentId(), draft)));
    afterResult(ok, () => setSegmentEditing(null));
  };

  const saveCue = (draft: CueDraft): void => {
    const ok =
      cueEditing?.mode === "edit"
        ? editPlan((p) => updateCue(p, cueEditing.id, draft))
        : editPlan((p, alloc) => addCue(p, { id: alloc.cueId(), ...draft }));
    afterResult(ok, () => setCueEditing(null));
  };

  const startLive = async (rebaseToNow: boolean): Promise<void> => {
    if (!isRemote) {
      const res = sessionStore.dispatch(session.id, { type: "start_live", rebaseToNow, expectedRevision: session.revision });
      if (res?.receipt.outcome === "committed") router.push(`/live/${session.id}/operate`);
      else setMessage(res?.receipt.message ?? "Could not start.");
      return;
    }
    setMessage(null);
    setCmdError(null);
    setSavedFeedback(null);
    setBusy(true);
    try {
      const outcome = await commands.submit({ body: { type: "start_live", rebaseToNow }, sessionId: session.id });
      if (outcome.status === "committed") router.push(`/live/${session.id}/operate`);
      else {
        setMessage(outcome.message);
        setCmdError(outcome.message);
        if (outcome.status !== "unknown") setStartOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  // One active REAL show per room: another running REAL show blocks Start and links back to it. (The room enforces it too.)
  const otherActiveReal =
    session.environment === "REAL"
      ? ((isRemote ? (remote.snapshot?.sessions ?? []) : storeState.sessions).find(
          (s) => s.environment === "REAL" && s.lifecycle === "active" && s.id !== session.id
        ) ?? null)
      : null;
  const sampleProducts = session.environment === "REAL" ? session.products.filter((p) => p.source === "sample_library").length : 0;

  const onStartClick = (): void => {
    const far = session.environment === "REAL" && nowMs !== null && Math.abs(nowMs - plan.plannedStartMs) > 5 * 60_000;
    if (far) setStartOpen(true);
    else void startLive(false);
  };

  const editingSegment = segmentEditing?.mode === "edit" ? (plan.segments.find((s) => s.id === segmentEditing.id) ?? null) : null;
  const editingCue: Cue | null = cueEditing?.mode === "edit" ? (plan.cues.find((c) => c.id === cueEditing.id) ?? null) : null;
  const saved = isRemote
    ? busy || commands.pending !== null
      ? { tone: "warn" as const, icon: "ri-time-line", text: "Waiting for confirmation…" }
      : remote.unresolved.length > 0
        ? { tone: "warn" as const, icon: "ri-question-line", text: "Action outcome unknown — check above" }
        : commands.role === "viewer"
          ? { tone: "warn" as const, icon: "ri-eye-line", text: "Read-only — viewing" }
          : commands.stale
            ? { tone: "warn" as const, icon: "ri-wifi-off-line", text: "Not connected — changes paused" }
            : { tone: "neutral" as const, icon: "ri-save-line", text: "Saved to the room" }
    : storeState.storage === "ok"
      ? { tone: "neutral" as const, icon: "ri-save-line", text: "Saved on this device" }
      : { tone: "warn" as const, icon: "ri-alert-line", text: "Not saved — storage unavailable" };

  return (
    <StandardShell>
      <CommandStateContext.Provider value={{ busy, error: cmdError }}>
      <div className="flex-1 flex flex-col min-h-0 bg-[#090B0F]">
        <SessionContextBar
          eyebrow="Prepare"
          title={session.title}
          environment={session.environment}
          metaText={`${formatDay(plan.plannedStartMs, tz)} · ${formatClock(plan.plannedStartMs, tz)} · ${tz}${
            spanSec !== null ? ` · ${formatDuration(spanSec)} planned` : ""
          }`}
          rightAction={
            <div className="flex items-center gap-4">
              <Signal tone={saved.tone} icon={saved.icon}>
                <span data-testid="save-status">{saved.text}</span>
              </Signal>
              <Button variant="ghost" size="sm" icon="ri-edit-line" disabled={!editable || busy} onClick={() => setDetailsOpen(true)} data-testid="edit-details-btn">
                Edit details
              </Button>
            </div>
          }
        />

        {message && (
          <div role="alert" className="mx-6 lg:mx-8 mt-3 rounded-[8px] bg-[#302025] text-[#F4A4A4] px-4 py-2 text-[14px]">
            {message}
          </div>
        )}
        {savedFeedback && <p role="status" className="mx-6 lg:mx-8 mt-3 text-[14px] text-[#DFFF00]">{savedFeedback}</p>}
        {isRemote && !commands.canWrite && commands.blockedReason && (
          <p className="mx-6 lg:mx-8 mt-3 text-[14px] text-[#F6C875]" data-testid="prepare-readonly-note">
            <i className="ri-lock-line mr-1.5" aria-hidden="true" />
            {commands.blockedReason}
          </p>
        )}

        <div className="px-4 lg:px-6 py-4 max-w-[1720px] w-full mx-auto">
          <fieldset
            disabled={!editable || busy}
            className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_310px] gap-4 lg:h-[calc(100dvh-222px)] lg:min-h-[480px] border-0 p-0 m-0 min-w-0"
          >
            {/* Product Pack */}
            <section className="rounded-[12px] bg-[#13161C] p-4 flex flex-col min-h-0" aria-label="Product Pack">
              <div className="flex items-center justify-between mb-1 shrink-0">
                <h2 className="text-[20px] font-medium text-[#F5F7FC]">Product Pack</h2>
              </div>
              <p className="text-[14px] text-[#AEB7C5] mb-2 shrink-0">{session.products.length} products · For this show</p>
              <ProductPack
                products={session.products}
                plan={plan}
                onAdd={(items) => {
                  // Every requested product is added or the whole change is refused with a reason — never silently fewer.
                  const clash = items.filter((item) => session.products.some((p) => p.id === item.id || p.code.toLowerCase() === item.code.toLowerCase()));
                  if (clash.length > 0) {
                    const why = `Not added: ${clash.map((c) => c.code).join(", ")} already ${clash.length === 1 ? "exists" : "exist"} in this pack. Nothing was changed.`;
                    setMessage(why);
                    setCmdError(why);
                    setSavedFeedback(null);
                    return false;
                  }
                  return edit((d) => {
                    d.products.push(...items);
                  });
                }}
                onPatch={(id, patch) =>
                  edit((d) => {
                    d.products = d.products.map((p) => (p.id === id ? { ...p, ...patch } : p));
                  })
                }
                onRemove={(id) =>
                  edit((d) => {
                    d.products = d.products.filter((p) => p.id !== id);
                  })
                }
              />
            </section>

            {/* Run of Show — the dominant surface */}
            <section className="rounded-[12px] bg-[#13161C] p-4 flex flex-col min-h-0" aria-label="Run of Show">
              <div className="mb-1 shrink-0">
                <h2 className="text-[24px] font-medium tracking-[-0.6px] text-[#F5F7FC]">Run of Show</h2>
              </div>
              {session.derivedFrom && (
                <div className="mb-2 rounded-[8px] bg-[#1A1E26] px-3 py-2 text-[14px] shrink-0" data-testid="derived-from">
                  <p className="text-[#F5F7FC]">
                    <i className="ri-file-copy-line mr-1.5 text-[#C8B2FF]" aria-hidden="true" />
                    Planned from{" "}
                    <Link href={`/live/${session.derivedFrom.sessionId}/review`} className="underline decoration-[#4B5665] hover:text-[#DFFF00]">
                      {session.derivedFrom.sessionTitle}
                    </Link>
                    {session.derivedFrom.appliedChanges.length > 0
                      ? ` with ${session.derivedFrom.appliedChanges.length} selected change${session.derivedFrom.appliedChanges.length === 1 ? "" : "s"}:`
                      : " with no changes."}
                  </p>
                  {session.derivedFrom.appliedChanges.length > 0 && (
                    <ul className="mt-1 list-disc list-inside text-[#CAD0DA]">
                      {session.derivedFrom.appliedChanges.map((c) => (
                        <li key={c.id}>{c.summary}</li>
                      ))}
                    </ul>
                  )}
                  {session.derivedFrom.changeNote && <p className="mt-1 text-[#9AA5B5]">Note: {session.derivedFrom.changeNote}</p>}
                  <p className="mt-1 text-[14px] text-[#B7C1CE]" data-testid="derived-not-copied">
                    <i className="ri-shield-check-line mr-1.5 text-[#9AA5B5]" aria-hidden="true" />
                    A fresh plan: only the changes listed above were carried over. Actual runtime, reports and history were not copied from the
                    earlier show — nothing there counts as done here.
                  </p>
                </div>
              )}
              <PrepareRos
                plan={plan}
                schedule={schedule}
                issues={assessment.issues}
                products={session.products}
                tz={tz}
                onEdit={(id) => editable && setSegmentEditing({ mode: "edit", id })}
                onMove={(id, delta) => {
                  if (editable) void editPlan((p) => moveSegment(p, id, delta));
                }}
                onAddSegment={() => editable && setSegmentEditing({ mode: "new" })}
                onAddCue={() => editable && setCueEditing({ mode: "new" })}
                onEditCue={(id) => editable && setCueEditing({ mode: "edit", id })}
              />
            </section>

            {/* Readiness and schedule impact */}
            <aside className="rounded-[12px] bg-[#1B1F27] p-5 flex flex-col min-h-0 md:col-span-2 xl:col-span-1" aria-label="Readiness">
              {/* Static text that scrolls on a short screen: focusable so a keyboard user can scroll it (WCAG 2.1.1). */}
              <div
                className="flex-1 min-h-0 overflow-y-auto pr-1 rounded-[8px] focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2"
                role="region"
                aria-label="Readiness and schedule impact"
                tabIndex={0}
              >
              <p className="text-[13px] font-semibold tracking-[1.5px] uppercase text-[#AEB7C5] mb-2">Readiness</p>
              {otherActiveReal && (
                <p className="mb-2 text-[15px] text-[#F6C875]" data-testid="other-show-active">
                  <i className="ri-error-warning-line mr-1" aria-hidden="true" />
                  {otherActiveReal.title} is running {isRemote ? "in this room" : "on this device"}. End it before starting another REAL show.{" "}
                  <Link href={`/live/${otherActiveReal.id}/operate`} className="underline hover:text-[#DFFF00]">
                    Open the running show
                  </Link>
                </p>
              )}
              {blockers.length === 0 ? (
                <p className="inline-flex items-center gap-2 text-[17px] font-medium text-[#DFFF00]" data-testid="plan-ready">
                  <i className="ri-checkbox-circle-line text-[20px]" aria-hidden="true" />
                  Plan ready
                </p>
              ) : (
                <p className="inline-flex items-center gap-2 text-[17px] font-medium text-[#F6C875]" data-testid="plan-blocked">
                  <i className="ri-error-warning-line text-[20px]" aria-hidden="true" />
                  Resolve {blockers.length} blocker{blockers.length === 1 ? "" : "s"}
                </p>
              )}
              <ul className="mt-2 space-y-1.5 text-[14px]" data-testid="readiness-issues">
                {blockers.map((i) => (
                  <li key={i.code + i.message} className="text-[#F6C875]">{i.message}</li>
                ))}
                {warnings.map((i) => (
                  <li key={i.code + i.message} className="text-[#CAD0DA]">
                    <i className="ri-error-warning-line mr-1 text-[#F6C875]" aria-hidden="true" />
                    {i.message}
                  </li>
                ))}
                {sampleProducts > 0 && (
                  <li className="text-[#CAD0DA]" data-testid="sample-products-note">
                    <i className="ri-information-line mr-1 text-[#F6C875]" aria-hidden="true" />
                    {sampleProducts} product{sampleProducts === 1 ? "" : "s"} came from the sample library. Check names and prices before going live.
                  </li>
                )}
                {blockers.length === 0 && warnings.length === 0 && sampleProducts === 0 && (
                  <li className="text-[#B7C1CE]">Manual operation is available.</li>
                )}
              </ul>

              <div className="mt-3 pt-3 border-t border-[#2A313E]" data-testid="schedule-impact">
                <p className="text-[13px] font-semibold tracking-[1.5px] uppercase text-[#AEB7C5] mb-2">Schedule impact</p>
                <p className="text-[14px] text-[#CAD0DA] tabular-nums">
                  Start {clock(plan.plannedStartMs)}
                  {assessment.finishMs !== null ? ` → finish ${clock(assessment.finishMs)}` : " → finish unknown"}
                </p>
                {assessment.anchors.length === 0 ? (
                  <p className="text-[14px] text-[#9AA5B5] mt-1">No hard anchors. Every segment floats.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {assessment.anchors.map((a) => (
                      <li key={a.segmentId} className="text-[14px]" data-testid={`anchor-impact-${a.segmentId}`}>
                        <span className="text-[#F5F7FC]">{a.title}</span>
                        <span className="text-[#9AA5B5] tabular-nums"> · {clock(a.committedMs)}</span>
                        <br />
                        {a.deficitSec > 0 ? (
                          <Signal tone="danger" icon="ri-error-warning-line">arrives {formatDuration(a.deficitSec)} late</Signal>
                        ) : a.bufferSec === 0 ? (
                          <Signal tone="warn" icon="ri-hourglass-line">no buffer</Signal>
                        ) : (
                          <Signal tone="neutral" icon="ri-checkbox-circle-line">{formatDuration(a.bufferSec)} buffer</Signal>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-[#2A313E] space-y-2 text-[14px]">
                <CapabilityLine icon="ri-hand-heart-line" label="Manual operation" status="Available" tone="lime" />
                <CapabilityLine icon="ri-shopping-bag-3-line" label="Product snapshot" status="Session copy" tone="neutral" />
                <CapabilityLine icon="ri-wifi-off-line" label="Realtime engagement" status="Unavailable" tone="muted" />
                <CapabilityLine icon="ri-question-line" label="Action verification" status="Unknown" tone="muted" />
              </div>

              {scenario && (
                <div className="mt-4 pt-4 border-t border-[#2A313E]" data-testid="rehearsal-guide">
                  <p className="text-[13px] font-semibold tracking-[1.5px] uppercase text-[#C8B2FF] mb-1">Rehearsal guide</p>
                  <ul className="list-disc list-inside space-y-1 text-[13px] text-[#CAD0DA]">
                    {scenario.watchFor.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              </div>

              <div className="shrink-0 pt-4 mt-3 border-t border-[#2A313E]">
                <Button
                  variant="primary"
                  size="lg"
                  icon="ri-play-line"
                  onClick={onStartClick}
                  disabled={blockers.length > 0 || otherActiveReal !== null || !editable || busy}
                  className="w-full min-h-[52px] text-[19px]"
                  data-testid="start-live-cta-btn"
                >
                  {busy ? "Waiting for confirmation…" : session.environment === "SIMULATED" ? "Start SIMULATED session" : "Start LIVE"}
                </Button>
                <p className="text-[13px] leading-5 text-[#AEB7C5] mt-2 text-center" data-testid="start-helper">
                  {session.environment === "SIMULATED"
                    ? "Starts a rehearsal on a virtual clock and locks this baseline. Nothing is broadcast and TikTok is not involved."
                    : "Starts LiveLift tracking and locks this baseline. Start your broadcast in the platform separately."}
                </p>
                <p className="mt-2 text-center">
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#9AA5B5]">
                    <i className={session.environment === "SIMULATED" ? "ri-flask-line text-[#C8B2FF]" : "ri-broadcast-line"} aria-hidden="true" />
                    {session.environment}
                    {session.environment === "SIMULATED" ? " · uses a virtual clock" : " · uses the room's clock"}
                  </span>
                </p>
              </div>
            </aside>
          </fieldset>
        </div>

        <SegmentEditorDialog
          key={segmentEditing ? (segmentEditing.mode === "edit" ? segmentEditing.id : "new") : "closed"}
          isOpen={segmentEditing !== null}
          onClose={() => setSegmentEditing(null)}
          onSave={saveSegment}
          onDelete={
            editingSegment
              ? () => {
                  afterResult(editPlan((p) => removeSegment(p, editingSegment.id)), () => setSegmentEditing(null));
                }
              : undefined
          }
          segment={editingSegment}
          plan={plan}
          products={session.products}
          tz={tz}
        />
        <CueEditorDialog
          key={cueEditing ? (cueEditing.mode === "edit" ? cueEditing.id : "new-cue") : "closed-cue"}
          isOpen={cueEditing !== null}
          onClose={() => setCueEditing(null)}
          onSave={saveCue}
          onDelete={
            editingCue
              ? () => {
                  afterResult(editPlan((p) => removeCue(p, editingCue.id)), () => setCueEditing(null));
                }
              : undefined
          }
          cue={editingCue}
          plan={plan}
          products={session.products}
          tz={tz}
        />
        <DetailsDialog
          key={`${session.revision}-${detailsOpen}`}
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title={session.title}
          objective={session.objective}
          plannedStartMs={plan.plannedStartMs}
          tz={tz}
          onSave={(input) => {
            const ok = edit((d) => {
              d.title = input.title;
              d.objective = input.objective;
              d.plans[0] = setPlannedStart(d.plans[0], input.plannedStartMs);
              if (d.environment === "SIMULATED") d.virtualNowMs = input.plannedStartMs;
            });
            afterResult(ok, () => setDetailsOpen(false));
          }}
        />

        <Dialog
          isOpen={startOpen}
          onClose={() => setStartOpen(false)}
          title="Start away from the planned time?"
          confirmText="Shift the schedule to now"
          onConfirm={() => {
            if (!isRemote) setStartOpen(false);
            void startLive(true);
          }}
        >
          <div className="space-y-3 text-[15px] text-[#CAD0DA]" data-testid="start-rebase-dialog">
            <p>
              This show is planned for{" "}
              <strong className="text-[#F5F7FC]">
                {formatDay(plan.plannedStartMs, tz)} {formatClock(plan.plannedStartMs, tz)}
              </strong>
              {nowMs !== null && (
                <>
                  , but it is{" "}
                  <strong className="text-[#F5F7FC]">
                    {formatDay(nowMs, tz)} {formatClock(nowMs, tz)}
                  </strong>
                </>
              )}
              . Hard anchors are wall-clock commitments.
            </p>
            <p className="text-[14px]">
              <strong className="text-[#F5F7FC]">Shift to now</strong> keeps every anchor at the same offset from the start. Choosing{" "}
              <strong className="text-[#F5F7FC]">keep planned times</strong> leaves the anchors where they are, so some may already be missed.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!isRemote) setStartOpen(false);
                void startLive(false);
              }}
              className="text-[14px] text-[#CAD0DA] underline hover:text-[#DFFF00] cursor-pointer"
              data-testid="start-keep-planned"
            >
              Keep planned times and start
            </button>
          </div>
        </Dialog>
      </div>
      </CommandStateContext.Provider>
    </StandardShell>
  );
}

function CapabilityLine({
  icon,
  label,
  status,
  tone,
}: {
  icon: string;
  label: string;
  status: string;
  tone: "lime" | "neutral" | "muted";
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#CAD0DA]">{label}</span>
      <Signal tone={tone} icon={icon}>
        {status}
      </Signal>
    </div>
  );
}
