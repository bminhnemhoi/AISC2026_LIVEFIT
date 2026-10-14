"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { EnvironmentIdentity, SessionLifecycle } from "@/contracts";
import { StandardShell } from "@/components/shell";
import { EnvironmentBadge } from "@/components/ui";
import { RoomStatusPanel } from "@/components/ops/ConnectionStatus";
import { PlatformEvidencePanel } from "@/components/intelligence/PlatformEvidencePanel";
import { useSessions, useStoreState } from "@/lib/store/hooks";
import { deriveIntelligence, type SessionAnalytics } from "@/lib/domain/analytics";
import { formatDuration } from "@/lib/domain/time";

const panel = "rounded-[12px] border border-[#2A303A] bg-[#13161C] p-4 sm:p-6 min-w-0";
const select = "w-full min-h-11 rounded-[8px] border border-[#39414D] bg-[#1B1F27] px-2.5 sm:px-3 text-[16px] text-[#F5F7FC]";
const fieldLabel = "block text-[14px] font-medium text-[#CAD0DA]";
const note = "text-[14px] leading-relaxed text-[#B7C1CE]";
const linkButton = "min-h-11 inline-flex items-center gap-1.5 rounded-[8px] px-3.5 text-[15px] font-medium transition-colors";
const cell = "px-3 py-3 align-top";
const time = (seconds: number | null) => seconds === null ? "Not recorded" : formatDuration(seconds);
const variance = (seconds: number | null) => seconds === null ? "Unknown" : `${seconds > 0 ? "+" : seconds < 0 ? "−" : ""}${formatDuration(Math.abs(seconds))}`;
const date = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const outcome = (value: string) => value.replaceAll("_", " ");

type Tone = "on" | "over" | "under";
const TONE_FILL: Record<Tone, string> = { on: "#DFFF00", over: "#F6C875", under: "#5FD3C0" };

/**
 * Both series share a zero origin and maximum. A missing value has no bar and says so in words: an empty track would
 * read as zero. The words in the neighbouring table columns carry the same facts, so colour is never the only cue.
 */
function TimingBars({ planned, actual, max, tone = "on" }: { planned: number | null; actual: number | null; max: number; tone?: Tone }): React.ReactElement {
  const bar = (value: number | null, y: number, fill: string) => value === null
    ? <text x="0" y={y + 8} fontSize="9" fill="#9AA5B5">not recorded</text>
    : <rect x="0" y={y} width={Math.max(1.5, 200 * value / max)} height="10" rx="2" fill={fill} />;
  return <svg viewBox="0 0 200 28" className="w-full max-w-[240px] h-7" aria-hidden="true">
    <line x1="0.5" y1="0" x2="0.5" y2="28" stroke="#39414D" />
    {bar(planned, 2, "#7C8798")}
    {bar(actual, 16, TONE_FILL[tone])}
  </svg>;
}

function ChartLegend({ items }: { items: Array<{ color: string; label: string }> }): React.ReactElement {
  return <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-[#CAD0DA]" aria-label="Chart key">
    {items.map((i) => <li key={i.label} className="inline-flex items-center gap-2"><span className="h-2.5 w-5 rounded-[2px]" style={{ backgroundColor: i.color }} aria-hidden="true" />{i.label}</li>)}
  </ul>;
}

const rowTone = (row: { overran: boolean; underran: boolean }): Tone => row.overran ? "over" : row.underran ? "under" : "on";

function Table({ caption, headings, children }: { caption: string; headings: string[]; children: React.ReactNode }): React.ReactElement {
  return <div className="overflow-x-auto rounded-[8px] border border-[#2A303A] focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2" tabIndex={0} role="region" aria-label={caption}>
    <table className="w-full text-left text-[15px]">
      <caption className="text-left p-3 text-[14px] font-medium text-[#CAD0DA]">{caption}</caption>
      <thead className="bg-[#1B1F27] text-[14px] text-[#CAD0DA]"><tr>{headings.map((h) => <th key={h} scope="col" className={`${cell} font-medium`}>{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#2A303A]">{children}</tbody>
    </table>
  </div>;
}

function SessionDetail({ session }: { session: SessionAnalytics }): React.ReactElement {
  const max = Math.max(1, ...session.rows.flatMap((r) => [r.plannedSec ?? 0, r.actualSec ?? 0]));
  return <section className={`${panel} space-y-4`} aria-labelledby="timing-title" data-testid="analytics-detail">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="timing-title" className="text-[22px] font-medium tracking-[-0.3px] break-words min-w-0">Planned vs actual · {session.title}</h2>
      <Link className={`${linkButton} bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944]`} href={`/live/${session.id}/${session.lifecycle === "ended" ? "review" : session.lifecycle === "active" ? "operate" : "prepare"}`}>Open {session.lifecycle === "ended" ? "Review" : "session"}<i className="ri-arrow-right-line" aria-hidden="true" /></Link>
    </div>
    <p className={note}>Baseline stays fixed. Gray = planned target; the second bar = recorded duration. All bars start at zero, with the same maximum ({time(max)}). Missing values have no bar. Overrun / underrun flags use a 15-second threshold.</p>
    <ChartLegend items={[{ color: "#7C8798", label: "Planned target" }, { color: TONE_FILL.on, label: "Recorded, within threshold" }, { color: TONE_FILL.over, label: "Recorded, overrun" }, { color: TONE_FILL.under, label: "Recorded, underrun" }]} />
    <Table caption="Segment timing and operator-declared coverage" headings={["Segment / outcome", "Baseline / current target", "Actual", "Duration difference", "Start difference", "Coverage", "Timing"]}>
      {session.rows.map((row) => <tr key={row.id}>
        <th scope="row" className={`${cell} min-w-[150px] font-normal`}><span className="font-medium">{row.title}</span><div className="text-[#B7C1CE]">{outcome(row.outcome)}</div>{row.followUp && <p>Follow-up: {row.followUp}</p>}</th>
        <td className={cell}>{row.plannedSec === null ? "Not entered" : time(row.plannedSec)} / {row.currentTargetSec === null ? "Not entered" : time(row.currentTargetSec)}</td>
        <td className={cell}>{time(row.actualSec)}</td>
        <td className={`${cell} tabular-nums font-medium ${row.overran ? "text-[#F6C875]" : row.underran ? "text-[#5FD3C0]" : ""}`}>{variance(row.varianceSec)}{row.overran ? " · overrun" : row.underran ? " · underrun" : ""}</td>
        <td className={cell}>{variance(row.startVarianceSec)}</td>
        <td className={cell}>{row.coverage ?? "Not declared"}</td>
        <td className={`${cell} min-w-[140px]`}><TimingBars planned={row.plannedSec} actual={row.actualSec} max={max} tone={rowTone(row)} /></td>
      </tr>)}
    </Table>
    <h3 className="text-[18px] font-medium pt-2">Cue / report coverage</h3>
    <p className="text-[#CAD0DA]">{session.reports} / {session.cues.length} operator cues have a recorded report · {session.reportCoverage === null ? "Not applicable: no operator cues" : `${Math.round(session.reportCoverage * 100)}% report coverage`}.</p>
    <p className={note}>{session.environment === "SIMULATED" ? "SIMULATED reports are rehearsal evidence." : "Operator reported performed is an operator claim."} Attempted stays unresolved. No report means unknown. Platform verification: unknown. Segment completion does not prove coverage.</p>
    {session.cues.length > 0 && <Table caption="Operator cues; reports are not provider confirmation" headings={["Cue", "Report state", "Reported at", "Evidence", "Verification"]}>
      {session.cues.map((cue) => <tr key={cue.id}><th scope="row" className={`${cell} font-normal`}>{cue.title}</th><td className={cell}>{cue.state === "performed" ? "Reported performed" : outcome(cue.state)}</td><td className={cell}>{cue.reportedAtMs === null ? "Not recorded" : date(cue.reportedAtMs)}</td><td className={cell}>{outcome(cue.evidence)}</td><td className={cell}>{cue.verification}</td></tr>)}
    </Table>}
    <div className="grid md:grid-cols-2 gap-4">
      <div><h3 className="text-[18px] font-medium">Operator notes · {session.notes.length}</h3><p className="text-sm text-[#B7C1CE]">No structured categories recorded.</p><ul className="space-y-2 mt-2">{session.notes.map((n) => <li key={n.id} className="break-words">{n.text}<div className="text-xs text-[#B7C1CE]">Recorded {date(n.recordedAtMs)}</div></li>)}</ul></div>
      <div><h3 className="text-[18px] font-medium">Recovery selections · {session.recoveries.length}</h3><p className="text-sm text-[#B7C1CE]">Recorded decisions; no claim that they caused an outcome.</p><ul className="space-y-2 mt-2">{session.recoveries.map((r) => <li key={r.id} className="break-words">{r.summary}<div className="text-xs text-[#B7C1CE]">{date(r.recordedAtMs)}</div></li>)}</ul></div>
    </div>
    <p className="text-sm text-[#B7C1CE]">Unplanned action reports: {session.actions.length} ({session.actions.filter((a) => a.state === "performed").length} reported performed, {session.actions.filter((a) => a.state === "attempted").length} attempted, {session.actions.filter((a) => a.state === "cancelled").length} cancelled). Platform verification: unknown.</p>
    {(session.corrections > 0 || session.clockDiscontinuities > 0) && <p className="text-[#F6C875]">{session.corrections} appended corrections; {session.clockDiscontinuities} recorded clock discontinuities. Read Review for context; corrections do not overwrite original measurements.</p>}
  </section>;
}

export default function InsightsPage(): React.ReactElement {
  const [environment, setEnvironment] = useState<EnvironmentIdentity>("REAL");
  const [sessionId, setSessionId] = useState("");
  const [lifecycle, setLifecycle] = useState<SessionLifecycle | "all">("ended");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [detailId, setDetailId] = useState("");
  const { hydrated, sessions, remote } = useSessions(environment);
  const local = useStoreState();
  const intelligence = deriveIntelligence(sessions, { environment, sessionId: sessionId || undefined, lifecycle: lifecycle === "all" ? undefined : lifecycle, fromDate, toDate, order });
  const detail = intelligence.sessions.find((s) => s.id === detailId) ?? intelligence.sessions[0];
  const unavailable = environment === "REAL" && remote.snapshot === null;
  const loading = unavailable && remote.connection === "connecting" && remote.problem === null;
  const trendMax = Math.max(1, ...intelligence.ended.flatMap((s) => [s.plannedSpanSec ?? 0, s.durationSec ?? 0]));
  const clear = () => { setSessionId(""); setLifecycle("ended"); setFromDate(""); setToDate(""); setOrder("newest"); };

  return <StandardShell><div className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" data-testid="insights">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="text-[34px] leading-[1.15] font-semibold tracking-[-0.8px]">Insights</h1><p className="mt-2 text-[17px] text-[#CAD0DA]">What happened, where the plan shifted, and what you chose for the next LIVE.</p></div><EnvironmentBadge environment={environment} /></div>
    <p className="flex items-start gap-2 rounded-[8px] bg-[#101319] px-3.5 py-2.5 text-[14px] leading-relaxed text-[#B7C1CE]"><i className="ri-information-line mt-0.5 text-[#CAD0DA]" aria-hidden="true" /><span>LiveLift operational analytics · saved tracking records only. Observation does not establish causation. Dates below use UTC.</span></p>
    {environment === "REAL" && <RoomStatusPanel />}
    {environment === "REAL" && remote.snapshot && (remote.connection !== "connected" || remote.problem !== null) && <p role="status" className="text-[#F6C875]" data-testid="insights-stale">Last confirmed room history; connection is stale. These insights may be incomplete.</p>}
    {environment === "SIMULATED" && <p className="rounded-[8px] border border-[#44385C] p-4 bg-[#211F2B] text-[#C8B2FF]"><i className="ri-flask-line mr-2" aria-hidden="true" />SIMULATED · browser rehearsals only. These are not REAL show results or TikTok analytics.</p>}
    {environment === "SIMULATED" && (local.storage === "unavailable" || local.notices.length > 0) && <p role="status" className="text-[#F6C875]">Browser history may be unavailable or incomplete. {local.notices.join(" ")}</p>}
    <div className={`${panel} grid grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-3.5`} role="group" aria-label="Analytics filters">
      <div className="col-span-2 sm:col-span-1"><label htmlFor="analytics-environment" className={fieldLabel}>Environment</label><select id="analytics-environment" className={`${select} mt-1`} value={environment} onChange={(e) => { setEnvironment(e.target.value as EnvironmentIdentity); setSessionId(""); setDetailId(""); }}><option>REAL</option><option>SIMULATED</option></select></div>
      <div className="col-span-2 sm:col-span-1"><label htmlFor="analytics-session" className={fieldLabel}>Session</label><select id="analytics-session" className={`${select} mt-1`} value={sessionId} onChange={(e) => setSessionId(e.target.value)}><option value="">All loaded sessions</option>{sessions.filter((s) => s.environment === environment).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
      <div className="col-span-2 sm:col-span-1"><label htmlFor="analytics-state" className={fieldLabel}>Show state</label><select id="analytics-state" className={`${select} mt-1`} value={lifecycle} onChange={(e) => setLifecycle(e.target.value as SessionLifecycle | "all")}><option value="ended">Ended tracking</option><option value="all">All states</option><option value="planned">Planned</option><option value="active">Active</option></select></div>
      <div><label htmlFor="analytics-from" className={fieldLabel}>From date (UTC)</label><input id="analytics-from" type="date" className={`${select} mt-1`} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
      <div><label htmlFor="analytics-to" className={fieldLabel}>To date (UTC)</label><input id="analytics-to" type="date" className={`${select} mt-1`} value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
      <div className="col-span-2 sm:col-span-1"><label htmlFor="analytics-order" className={fieldLabel}>Order</label><select id="analytics-order" className={`${select} mt-1`} value={order} onChange={(e) => setOrder(e.target.value as "newest" | "oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
      <div className="flex items-end col-span-2 sm:col-span-1"><button type="button" className={`${linkButton} text-[#CAD0DA] hover:bg-[#1E232B] hover:text-white`} onClick={clear}><i className="ri-filter-off-line" aria-hidden="true" />Clear filters</button></div>
    </div>
    {fromDate && toDate && fromDate > toDate && <p role="alert" className="text-[#F6C875]">From date must be on or before To date.</p>}
    <div className="min-w-0" data-testid="band-operations"><h2 className="text-[22px] font-medium tracking-[-0.3px]">LiveLift operations</h2><p className="mt-1 max-w-[760px] text-[15px] leading-relaxed text-[#B7C1CE]">Provider-independent analytics from LiveLift&apos;s own tracking records: what was planned, what was recorded and what the operator reported.</p></div>
    {!hydrated || loading ? <div aria-busy="true"><p role="status" className="text-[#CAD0DA]">Loading history…</p><div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-[12px] bg-[#13161C] border border-[#232935] motion-safe:animate-pulse" />)}</div></div> : <>
      {intelligence.sessions.length === 0 ? <section className={`${panel} flex gap-4 items-start`} data-testid="insights-empty">
        <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#1B1F27] text-[22px] text-[#CAD0DA]"><i className={unavailable ? "ri-cloud-off-line" : "ri-inbox-line"} aria-hidden="true" /></span>
        <div className="min-w-0"><h2 className="text-[20px] font-medium">{unavailable ? "REAL history is unavailable" : "No sessions match"}</h2><p className="mt-2 text-[#CAD0DA] leading-relaxed">{unavailable ? "The room has not supplied history. This does not mean there were no REAL shows." : "End tracking to see completed-session trends, or choose another state or date range. Missing history is never a zero result."}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Link href="/simulator" className={`${linkButton} text-[#C8B2FF] hover:bg-[#211F2B]`}><i className="ri-flask-line" aria-hidden="true" />Open Simulator</Link></div></div>
      </section> : <>
        <section aria-label="Session summaries" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="analytics-summaries">
          {intelligence.sessions.map((s) => {
            const overrunCount = s.rows.filter((r) => r.overran).length;
            const selected = detail?.id === s.id;
            return <article key={s.id} className={`${panel} space-y-4 flex flex-col ${selected ? "border-[#DFFF00]" : ""}`}>
              <div className="flex items-center justify-between gap-2"><EnvironmentBadge environment={s.environment} size="sm" />{overrunCount > 0 && <span className="text-[14px] font-medium text-[#F6C875]">{overrunCount} segment{overrunCount === 1 ? "" : "s"} overran</span>}</div>
              <div><h2 className="text-[20px] leading-snug font-medium break-words">{s.title}</h2><p className="mt-1 text-[14px] text-[#B7C1CE]">{date(s.dateMs)} · {s.lifecycle === "ended" ? "Ended tracking" : s.lifecycle}</p></div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
                <div><dt className="text-[#B7C1CE]">Tracked duration</dt><dd className="text-[28px] leading-tight font-medium tabular-nums text-[#F5F7FC]">{time(s.durationSec)}</dd></div>
                <div><dt className="text-[#B7C1CE]">Planned host time</dt><dd className="text-[28px] leading-tight font-medium tabular-nums text-[#CAD0DA]">{s.plannedHostSec === null ? "Not entered" : time(s.plannedHostSec)}</dd></div>
                <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#232935] pt-3">
                  <div><dt className="text-[#B7C1CE]">Recorded completed</dt><dd className="text-[16px] tabular-nums">{s.completed} / {s.rows.length} segments</dd></div>
                  <div><dt className="text-[#B7C1CE]">Not reached</dt><dd className="text-[16px] tabular-nums">{s.notReached} segments</dd></div>
                  <div><dt className="text-[#B7C1CE]">Cue reports</dt><dd className="text-[16px] tabular-nums">{s.reports} / {s.cues.length}</dd></div>
                  <div><dt className="text-[#B7C1CE]">Notes / recoveries</dt><dd className="text-[16px] tabular-nums">{s.notes.length} / {s.recoveries.length}</dd></div>
                </div>
              </dl>
              <button type="button" className={`${linkButton} mt-auto justify-center ${selected ? "bg-[#242A22] text-[#DFFF00]" : "bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944]"}`} onClick={() => setDetailId(s.id)} aria-pressed={selected}><i className={selected ? "ri-checkbox-circle-line" : "ri-bar-chart-horizontal-line"} aria-hidden="true" /><span className="min-w-0 truncate">Inspect timing · {s.title}</span></button>
            </article>;
          })}
        </section>
        {detail && <SessionDetail session={detail} />}
      </>}
      <section className={`${panel} space-y-4`} aria-labelledby="trend-title"><h2 id="trend-title" className="text-[22px] font-medium tracking-[-0.3px]">Trend across ended sessions</h2><p className={note}>{intelligence.ended.length} loaded {environment} sessions with ended tracking. Gray = baseline show span including anchor waits; lime = recorded tracking duration. Zero origin; shared maximum {time(trendMax)}. Incomplete durations have no mark. Session date is recorded start, or planned start if missing.</p>
        {intelligence.ended.length > 0 ? <><ChartLegend items={[{ color: "#7C8798", label: "Baseline show span" }, { color: TONE_FILL.on, label: "Tracked duration" }]} /><Table caption="Ended-session timing trend; ordered by the selected date order" headings={["Session", "Baseline show span", "Tracked duration", "Cue reports", "Timing"]}>{intelligence.ended.map((s) => <tr key={s.id}><th scope="row" className={`${cell} font-normal min-w-[140px]`}><span className="font-medium">{s.title}</span><div className="text-[#B7C1CE]">{date(s.dateMs)}</div></th><td className={`${cell} tabular-nums`}>{time(s.plannedSpanSec)}</td><td className={`${cell} tabular-nums`}>{time(s.durationSec)}</td><td className={`${cell} tabular-nums`}>{s.reports} / {s.cues.length}{s.reportCoverage === null ? " · N/A" : ` · ${Math.round(s.reportCoverage * 100)}%`}</td><td className={`${cell} min-w-[140px]`}><TimingBars planned={s.plannedSpanSec} actual={s.durationSec} max={trendMax} /></td></tr>)}</Table></> : <p className="text-[#CAD0DA]">No ended sessions available for this selection.</p>}
        <h3 className="text-[18px] font-medium pt-2">Repeated deviations</h3>{intelligence.patterns.length > 0 ? <ul className="space-y-2">{intelligence.patterns.map((p) => <li key={p.kind} className="text-[#E4E8F0]">{outcome(p.kind)} segments overran in {p.overrunSessions} / {p.observedSessions} sessions with comparable timing. Segment kind is recorded; this does not show a cause.</li>)}</ul> : <p className="text-[#B7C1CE]">No segment kind has recorded overruns in two or more selected sessions.</p>}
      </section>
      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <section className={`${panel} space-y-4`} aria-labelledby="overrun-title"><h2 id="overrun-title" className="text-[22px] font-medium tracking-[-0.3px]">Overrun ranking</h2><p className={note}>Largest 10 recorded overruns against baseline targets, among selected ended sessions.</p>{intelligence.overruns.length > 0 ? <ol className="space-y-4">{intelligence.overruns.slice(0, 10).map((r, i) => <li key={`${r.sessionId}:${r.id}`}><div className="flex justify-between gap-3"><span className="min-w-0 break-words"><span className="font-medium">{i + 1}. {r.title}</span><span className="block text-[14px] text-[#B7C1CE]">{r.sessionTitle} · planned {time(r.plannedSec)} / actual {time(r.actualSec)}</span></span><span className="shrink-0 font-medium tabular-nums text-[#F6C875]">{variance(r.varianceSec)}</span></div><svg viewBox="0 0 200 6" className="mt-2 block h-1.5 w-full" preserveAspectRatio="none" aria-hidden="true"><rect width="200" height="6" rx="3" fill="#1E232B" /><rect width={Math.max(4, 200 * Math.max(0, r.varianceSec ?? 0) / Math.max(1, ...intelligence.overruns.slice(0, 10).map((o) => o.varianceSec ?? 0)))} height="6" rx="3" fill={TONE_FILL.over} /></svg></li>)}</ol> : <p className="text-[#B7C1CE]">No recorded overruns in the available comparable timing.</p>}</section>
        <section className={`${panel} space-y-4`} data-testid="next-live-history" aria-labelledby="history-title"><h2 id="history-title" className="text-[22px] font-medium tracking-[-0.3px]">Next LIVE change history</h2><p className={note}>Selected adjustments saved on the destination plan. Date filters use when that plan was created; show state applies to session summaries above. A selected change is not proof of an improved outcome.</p>{intelligence.nextLive.length > 0 ? <ul className="space-y-4">{intelligence.nextLive.map((n) => <li key={n.destinationId} className="border-t border-[#2A303A] pt-3 break-words"><EnvironmentBadge environment={n.environment} size="sm" /><p className="mt-2">From {n.sessionTitle} → <Link className="text-[#DFFF00] underline underline-offset-4" href={`/live/${n.destinationId}/${n.lifecycle === "ended" ? "review" : n.lifecycle === "active" ? "operate" : "prepare"}`}>{n.destinationTitle}</Link></p><p className="text-[14px] text-[#B7C1CE]">{date(n.createdAtMs)} · {n.lifecycle} · source baseline {n.planVersionId}</p>{n.appliedChanges.length > 0 ? <ul className="list-disc pl-5 mt-2">{n.appliedChanges.map((c) => <li key={c.id}>{c.summary}</li>)}</ul> : <p>No adjustments selected; copied baseline.</p>}{n.changeNote && <p className="mt-2">Operator change note: {n.changeNote}</p>}</li>)}</ul> : <p className="text-[#B7C1CE]">No saved Next LIVE plans in this selection. Unselected suggestions are not counted as changes.</p>}</section>
      </div>
    </>}
    <PlatformEvidencePanel session={sessions.find((s) => s.id === detail?.id) ?? null} sameEnvironmentSessions={sessions.filter((s) => s.environment === environment)} />
  </div></StandardShell>;
}
