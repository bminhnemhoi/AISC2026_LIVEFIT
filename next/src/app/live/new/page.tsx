"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import type { Cue, ProductSnapshot, Segment } from "@/contracts";
import { PACK_LIBRARY, snapshotProducts } from "@/fixtures/library";
import type { AuthorityCommandBody } from "@/contracts/authority";
import { SCENARIO_BY_ID, DEFAULT_TIMEZONE, addDaysZoned, duplicateSession, msToZonedParts, zonedTimeToMs } from "@/lib/domain";
import { sessionStore, type StartingPoint } from "@/lib/store/sessionStore";
import { useRemoteCommands, useSessions } from "@/lib/store/hooks";

type StartType = StartingPoint["type"];

const TIMEZONES = ["Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Singapore", "Asia/Jakarta", "UTC"];
const INPUT =
  "w-full h-[48px] bg-[#1B1F27] border border-[#39414D] rounded-[8px] px-4 text-[16px] text-[#F5F7FC] focus:border-[#DFFF00]";

export default function CreateLivePage(): React.ReactElement {
  return (
    <Suspense fallback={<StandardShell><p className="p-8 text-[#CAD0DA]" role="status">Loading Create LIVE…</p></StandardShell>}>
      <CreateLiveForm />
    </Suspense>
  );
}

function CreateLiveForm(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params.get("from");
  const { hydrated, sessions, remote } = useSessions();
  const commands = useRemoteCommands();
  const requestedPack = PACK_LIBRARY.find((p) => p.id === params.get("pack"));

  const [title, setTitle] = useState("October collection · Evening LIVE");
  const [startType, setStartType] = useState<StartType>(requestedPack ? "pack" : "blank");
  const [packId, setPackId] = useState(requestedPack?.id ?? PACK_LIBRARY[0].id);
  const [sourceId, setSourceId] = useState("");
  const [simulated, setSimulated] = useState(params.get("env") === "sim");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("20:00");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [objective, setObjective] = useState("");
  const [showObjective, setShowObjective] = useState(false);
  const [account, setAccount] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Defaults that depend on the clock are set after mount, so server and client renders agree.
  useEffect(() => {
    setDate(msToZonedParts(addDaysZoned(Date.now(), 1, DEFAULT_TIMEZONE), DEFAULT_TIMEZONE).date);
  }, []);

  // Duplicating from the Sessions list pre-fills the form once the show's data has loaded (a REAL show comes from the room).
  useEffect(() => {
    if (seeded || !hydrated || !fromId) return;
    const source = sessions.find((s) => s.id === fromId);
    if (!source) {
      if (remote.snapshot || remote.connection === "disconnected") setSeeded(true);
      return;
    }
    setSeeded(true);
    setStartType("previous");
    setSourceId(source.id);
    setSimulated(source.environment === "SIMULATED");
    setTitle(`${source.title} · copy`);
  }, [hydrated, fromId, sessions, seeded, remote.snapshot, remote.connection]);

  const environment = simulated ? "SIMULATED" : "REAL";
  const sources = useMemo(() => sessions.filter((s) => s.environment === environment), [sessions, environment]);
  const effectiveSourceId = sources.some((s) => s.id === sourceId) ? sourceId : (sources[0]?.id ?? "");
  const copySource = startType === "previous" ? sources.find((s) => s.id === effectiveSourceId) : undefined;
  const inheritsDetails = !simulated && copySource?.lifecycle === "ended";
  const planTimezone = inheritsDetails ? copySource.timezone : timezone;
  const plannedStartMs = date ? zonedTimeToMs(date, time, planTimezone) : null;
  const ready = hydrated && title.trim() !== "" && plannedStartMs !== null && (startType !== "previous" || effectiveSourceId !== "");

  /** REAL shows are created by the room: the server assigns the id, time and operator. */
  const createRemote = async (start: StartingPoint, at: number): Promise<void> => {
    let body: AuthorityCommandBody;
    let targetSessionId: string | null = null;
    const source = start.type === "previous" ? sources.find((s) => s.id === start.sourceId) : undefined;
    if (start.type === "previous" && !source) {
      setError("The session to copy no longer exists.");
      return;
    }
    if (source && source.lifecycle === "ended") {
      // An ended show is carried forward through the room's own Next LIVE command, which keeps the "planned from" link.
      targetSessionId = source.id;
      body = { type: "create_next", title: title.trim(), plannedStartMs: at, changeIds: [], note: `Duplicated from ${source.title}` };
    } else {
      // Segment and cue ids are scoped to this plan; the room assigns the session id.
      let products: ProductSnapshot[] = [];
      let segments: Segment[] | undefined;
      let cues: Cue[] | undefined;
      if (start.type === "template") {
        const template = SCENARIO_BY_ID.buffered;
        ({ segments, cues } = template.buildPlan("draft"));
        products = snapshotProducts(template.productIds);
      } else if (start.type === "pack") {
        products = snapshotProducts(PACK_LIBRARY.find((p) => p.id === start.packId)?.productIds ?? []);
      } else if (source) {
        const copy = duplicateSession(source, { id: "draft", title: title.trim(), plannedStartMs: at, nowMs: at });
        products = copy.products;
        segments = copy.plans[0].segments;
        cues = copy.plans[0].cues;
      }
      body = {
        type: "create_session",
        title: title.trim(),
        timezone,
        plannedStartMs: at,
        objective: objective.trim() || (source?.objective ?? null),
        accountLabel: account.trim() || (source?.accountLabel ?? null),
        products,
        ...(segments && cues ? { segments, cues } : {}),
      };
    }
    const outcome = await commands.submit({ body, sessionId: targetSessionId });
    if (outcome.status === "committed" && outcome.receipt.sessionId) router.push(`/live/${outcome.receipt.sessionId}/prepare`);
    else if (outcome.status === "committed") setError("The room recorded the show but did not say which one. Open it from Sessions.");
    else if (outcome.status === "unknown") setError(`${outcome.message} It is shown above; check it before creating the show again.`);
    else setError(outcome.message);
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!ready || plannedStartMs === null || submitting) return;
    const start: StartingPoint =
      startType === "pack"
        ? { type: "pack", packId }
        : startType === "previous"
          ? { type: "previous", sourceId: effectiveSourceId }
          : { type: startType };
    setError(null);
    if (environment === "REAL") {
      setSubmitting(true);
      try {
        await createRemote(start, plannedStartMs);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const result = sessionStore.createSession({
      title,
      environment,
      timezone,
      plannedStartMs,
      objective: objective.trim() || null,
      accountLabel: account.trim() || null,
      start,
    });
    if (result.ok) router.push(`/live/${result.session.id}/prepare`);
    else setError(result.reason);
  };

  const cards: Array<{ type: StartType; icon: string; name: string; hint: string }> = [
    { type: "blank", icon: "ri-file-add-line", name: "Blank", hint: "A clean rundown" },
    { type: "template", icon: "ri-time-line", name: "30-minute show", hint: "Opening, two products, a Flash Sale anchor, Q&A, Closing" },
    { type: "pack", icon: "ri-shopping-bag-3-line", name: "Sample pack", hint: "Start with an example lineup" },
    { type: "previous", icon: "ri-file-copy-line", name: "Previous session", hint: "Copy a baseline plan" },
  ];

  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1040px] mx-auto px-6 lg:px-8 py-8">
        <h1 className="text-[34px] leading-[1.2] font-medium tracking-[-0.6px] text-[#F5F7FC]">Create LIVE</h1>
        <p className="text-[16px] leading-6 text-[#B7C1CE] mt-1.5">Start small. You can refine everything in Prepare.</p>

        <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-6">
          <div>
            <label htmlFor="session-title" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">
              Session title <span className="text-[#F4A4A4]">*</span>
            </label>
            <input id="session-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={`${INPUT} text-[17px]`} />
          </div>

          <fieldset>
            <legend className="text-[13px] font-semibold tracking-[1.5px] uppercase text-[#AEB7C5] mb-3">Starting point</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" role="radiogroup">
              {cards.map((c) => (
                <label
                  key={c.type}
                  className={`rounded-[12px] p-4 space-y-2 cursor-pointer transition-colors border focus-within:outline focus-within:outline-2 focus-within:outline-[#DFFF00] ${
                    startType === c.type ? "bg-[#1B1F27] border-[#DFFF00]" : "bg-[#13161C] border-[#2A303A] hover:bg-[#1A1E26]"
                  }`}
                >
                  <input
                    type="radio"
                    name="starting-point"
                    className="sr-only"
                    checked={startType === c.type}
                    onChange={() => setStartType(c.type)}
                    data-testid={`start-${c.type}`}
                  />
                  <span className="w-[44px] h-[44px] bg-[#2B313C] rounded-[8px] flex items-center justify-center text-[#DFFF00]">
                    <i className={`${c.icon} text-[22px]`} aria-hidden="true" />
                  </span>
                  <span className="block text-[18px] font-medium text-[#F5F7FC]">{c.name}</span>
                  <span className="block text-[14px] text-[#B7C1CE]">{c.hint}</span>
                </label>
              ))}
            </div>

            {startType === "pack" && (
              <div className="mt-3">
                <label htmlFor="pack" className="block text-[14px] text-[#CAD0DA] mb-1">Pack</label>
                <select id="pack" className={INPUT} value={packId} onChange={(e) => setPackId(e.target.value)}>
                  {PACK_LIBRARY.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.productIds.length} products</option>
                  ))}
                </select>
              </div>
            )}
            {startType === "previous" && (
              <div className="mt-3" data-testid="previous-picker">
                <label htmlFor="previous" className="block text-[14px] text-[#CAD0DA] mb-1">
                  Copy the baseline plan of ({environment} sessions only)
                </label>
                {sources.length === 0 ? (
                  <p className="text-[14px] text-[#F6C875]">
                    {!hydrated || (!simulated && !remote.snapshot)
                      ? `Previous ${environment} shows have not loaded. Check the connection above, or choose Blank or 30-minute show.`
                      : `There is no ${environment} session to copy yet. Choose Blank or 30-minute show to get started.`}
                  </p>
                ) : (
                  <select id="previous" className={INPUT} value={effectiveSourceId} onChange={(e) => setSourceId(e.target.value)}>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>{s.title} · {s.lifecycle}</option>
                    ))}
                  </select>
                )}
                <p className="text-[13px] text-[#9AA5B5] mt-1">Runtime, reports and history are never copied.</p>
                {inheritsDetails && <p className="text-[14px] text-[#CAD0DA] mt-1">This completed REAL show's timezone, objective and account label carry forward. Edit the new show's objective in Prepare.</p>}
              </div>
            )}
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="session-date" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">Planned date</label>
              <input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="session-time" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">Planned start</label>
              <input id="session-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="session-tz" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">Timezone</label>
              <select id="session-tz" value={planTimezone} disabled={inheritsDetails} onChange={(e) => setTimezone(e.target.value)} className={INPUT}>
                {!TIMEZONES.includes(planTimezone) && <option value={planTimezone}>{planTimezone}</option>}
                {TIMEZONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {!showObjective && !inheritsDetails && (
              <button type="button" onClick={() => setShowObjective(true)} className="min-h-[44px] text-[15px] text-[#CAD0DA] hover:text-[#DFFF00] inline-flex items-center gap-1.5 cursor-pointer">
                <i className="ri-add-line" aria-hidden="true" />
                <span>Add an objective</span>
              </button>
            )}
            {!showAccount && !inheritsDetails && (
              <button type="button" onClick={() => setShowAccount(true)} className="min-h-[44px] text-[15px] text-[#CAD0DA] hover:text-[#DFFF00] inline-flex items-center gap-1.5 cursor-pointer">
                <i className="ri-add-line" aria-hidden="true" />
                <span>Add an account label (optional)</span>
              </button>
            )}
          </div>
          {showObjective && !inheritsDetails && (
            <div>
              <label htmlFor="session-obj" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">Objective</label>
              <input id="session-obj" value={objective} onChange={(e) => setObjective(e.target.value)} className={INPUT} placeholder="e.g. Launch the fall line and test the sizing cue" />
            </div>
          )}
          {showAccount && !inheritsDetails && (
            <div>
              <label htmlFor="session-acc" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">Account label</label>
              <input id="session-acc" value={account} onChange={(e) => setAccount(e.target.value)} className={INPUT} placeholder="e.g. @livelift.shop · Room 8412" />
              <p className="text-[13px] text-[#9AA5B5] mt-1">A label only. LiveLift is not connected to any platform account.</p>
            </div>
          )}

          {!simulated && (startType === "template" || startType === "pack") && (
            <p className="text-[15px] text-[#F6C875] -mt-2" data-testid="sample-data-notice">
              <i className="ri-information-line mr-1.5" aria-hidden="true" />
              This starting point uses the sample product library shipped with LiveLift — example names and prices, not your catalog. Check and edit
              every product in Prepare before a real show.
            </p>
          )}

          {!simulated && (
            <p className="text-[14px] text-[#9AA5B5]" data-testid="recorded-as">
              <i className="ri-user-line mr-1.5" aria-hidden="true" />
              {remote.access
                ? `Actions are recorded as ${remote.access.name}, the account you are signed in with.`
                : "Actions are recorded under the account you sign in with, once the room is connected."}
            </p>
          )}

          <div className="pt-2 border-t border-[#232935]">
            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={simulated}
                onChange={(e) => setSimulated(e.target.checked)}
                className="w-5 h-5 accent-[#DFFF00]"
                data-testid="simulated-toggle"
              />
              <span className="text-[16px] font-medium text-[#F5F7FC]">Create as SIMULATED rehearsal</span>
            </label>
            <p className="text-[14px] text-[#B7C1CE] mt-1.5 ml-8">
              REAL records your show operations in the shared room. SIMULATED is a rehearsal saved in this browser; use the clock buttons to advance time. Neither option starts a TikTok broadcast.
            </p>
          </div>

          {error && <p role="alert" className="text-[14px] text-[#F4A4A4]">{error}</p>}
          {!hydrated && <p role="status" className="text-[14px] text-[#CAD0DA]">Loading saved shows and rehearsals…</p>}
          {hydrated && (title.trim() === "" || plannedStartMs === null) && (
            <p className="text-[14px] text-[#F6C875]">Enter a title, planned date and valid start time to create this LIVE.</p>
          )}
          {!simulated && !commands.canWrite && commands.blockedReason && !submitting && (
            <p className="text-[14px] text-[#F6C875]" data-testid="create-blocked">
              <i className="ri-lock-line mr-1.5" aria-hidden="true" />
              {commands.blockedReason}
              {(remote.problem === "signed_out" || remote.problem === "session_ended") && (
                <>
                  {" "}
                  <Link href="/login?next=%2Flive%2Fnew" className="underline underline-offset-4 text-[#F5F7FC]" data-testid="create-sign-in-link">
                    Sign in
                  </Link>
                  .
                </>
              )}
            </p>
          )}

          <div className="flex items-center gap-4 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon="ri-arrow-right-line"
              disabled={!ready || submitting || (!simulated && !commands.canWrite)}
              data-testid="submit-create-live-btn"
            >
              {submitting ? "Waiting for the room…" : "Create LIVE"}
            </Button>
            <Link href="/">
              <Button variant="ghost" size="lg" type="button">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </StandardShell>
  );
}
