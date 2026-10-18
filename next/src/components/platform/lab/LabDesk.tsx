"use client";

import React from "react";
import { activeSegment, currentPlan, formatClock, nextPendingSegment, type Forecast } from "@/lib/domain";
import { labRecords, plannedProductIds, type LabCommand, type LabState, type RecordSource, type ShopeeFault } from "@/lib/platform";
import { Button } from "@/components/ui";
import type { SimulatorStrip } from "@/components/ops/SimulatorStrip";
import type { LabLang, LabWords } from "./labCopy";

const SOURCE_STYLE: Record<RecordSource, { icon: string; tone: string }> = {
  request_accepted: { icon: "ri-send-plane-line", tone: "text-[#CAD0DA]" },
  request_refused: { icon: "ri-close-circle-line", tone: "text-[#F6C875]" },
  provider_observed: { icon: "ri-eye-line", tone: "text-[#B4C6DD]" },
  operator_reported: { icon: "ri-hand-heart-line", tone: "text-[#CAD0DA]" },
};

/**
 * LiveLift's side of the Lab: where the show is, the clock, one-tap pins, and every record with where it came from.
 * Pin states are what LiveLift last read, not what the phone shows: the two can differ until the next read.
 */
export function LabDesk({
  lab,
  forecast,
  strip,
  words,
  lang,
  presenter,
  act,
}: {
  lab: LabState;
  forecast: Forecast;
  strip: React.ComponentProps<typeof SimulatorStrip>;
  words: LabWords;
  lang: LabLang;
  presenter: boolean;
  act: (cmds: LabCommand[]) => void;
}): React.ReactElement {
  const w = words.desk;
  const { session, world } = lab;
  const tz = session.timezone;
  const text = presenter ? "text-[19px]" : "text-[16px]";
  const small = presenter ? "text-[16px]" : "text-[14px]";
  const heading = `${presenter ? "text-[22px]" : "text-[18px]"} font-medium text-[#F5F7FC]`;

  const active = activeSegment(session);
  const next = session.lifecycle === "ended" ? null : nextPendingSegment(session);
  const nextStart = next ? (forecast.segments.find((s) => s.segmentId === next.id)?.startMs ?? null) : null;
  const guard = forecast.anchorGuard;
  const guardTitle = guard ? (currentPlan(session).segments.find((s) => s.id === guard.segmentId)?.title ?? "") : "";
  const now = session.lifecycle === "planned" ? w.notStarted : session.lifecycle === "ended" ? w.ended : (active?.title ?? "—");

  const snapshot = world.sync.last;
  const showing = snapshot?.showing.state === "item" ? snapshot.showing.itemId : null;
  const canPin = snapshot?.status === "ongoing";
  const products = plannedProductIds(session).flatMap((id) => {
    const p = session.products.find((x) => x.id === id);
    const l = world.sync.links.find((x) => x.productId === id);
    return p && l ? [{ product: p, link: l }] : [];
  });
  const ended = session.lifecycle === "ended";
  const clockBtn =
    "min-h-[44px] min-w-[44px] px-2.5 rounded-[8px] text-[15px] font-medium bg-[#2A2540] text-[#E4DAFF] hover:bg-[#363052] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2";
  const records = labRecords(session, lab.trace);
  const notices = presenter ? world.notices.slice(0, 3) : world.notices;

  return (
    <section aria-label={w.region} tabIndex={0} data-testid="lab-desk" className="h-full min-h-0 xl:overflow-y-auto rounded-[12px] bg-[#13161C] p-3 flex flex-col gap-3 outline-none focus-visible:outline-2 focus-visible:outline-[#DFFF00]">
      <h2 className={heading}>{w.region}</h2>

      <dl className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 ${text}`} data-testid="lab-now-next-why">
        <dt className="text-[#9AA5B5]">{w.now}</dt>
        <dd className="text-[#F5F7FC] truncate" data-testid="lab-now">{now}</dd>
        <dt className="text-[#9AA5B5]">{w.next}</dt>
        <dd className="text-[#F5F7FC] truncate" title={next?.title}>
          {next ? <>{next.title}{nextStart !== null && <span className="text-[#9AA5B5] tabular-nums"> · {formatClock(nextStart, tz)}</span>}</> : w.nothingNext}
        </dd>
        <dt className="text-[#9AA5B5]">{w.why}</dt>
        <dd className="text-[#F5F7FC] truncate" title={guard ? w.anchor(guardTitle, formatClock(guard.committedMs, tz)) : undefined}>
          {guard ? (
            <><i className="ri-lock-line text-[#9AA5B5] mr-1" aria-hidden="true" />{w.anchor(guardTitle, formatClock(guard.committedMs, tz))}</>
          ) : w.noAnchor}
        </dd>
      </dl>

      {/* The row keeps its height after the show ends, so the clock and the pins below never move up. */}
      <div className="flex flex-wrap items-center gap-2 min-h-[44px]">
        {session.lifecycle === "planned" && (
          <Button variant="secondary" size="desk" icon="ri-play-line" onClick={() => act([{ kind: "show", body: { type: "start_live" } }])} data-testid="lab-start">{w.startShow}</Button>
        )}
        {session.lifecycle === "active" && (
          <>
            <Button variant="secondary" size="desk" icon="ri-skip-forward-line" onClick={() => act([{ kind: "show", body: { type: "advance_segment" } }])} data-testid="lab-next-segment">{w.nextSegment}</Button>
            <Button variant="danger" size="desk" icon="ri-stop-circle-line" onClick={() => act([{ kind: "show", body: { type: "end_live" } }])} data-testid="lab-end">{w.endShow}</Button>
          </>
        )}
      </div>
      {/* The same clock commands as the Operate desk (useSimulatorControls), laid out for a narrow column. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1" role="group" aria-label={w.clock} data-testid="lab-clock">
        <span className={`${text} tabular-nums text-[#E4DAFF] mr-1`} data-testid="virtual-clock">
          <i className="ri-flask-line text-[#C8B2FF] mr-1" aria-hidden="true" />
          {w.virtualClock(formatClock(strip.virtualNowMs, tz, true))}
        </span>
        {([[30, "+30s"], [60, "+1m"], [300, "+5m"]] as const).map(([sec, label]) => (
          <button key={sec} type="button" className={clockBtn} disabled={ended} onClick={() => strip.onAdvance(sec)} data-testid={`lab-clock-${sec}`}>
            {label}
          </button>
        ))}
        <button
          type="button"
          className={clockBtn}
          disabled={ended || strip.nextAnchorMs === null || strip.nextAnchorMs - 60_000 <= strip.virtualNowMs}
          onClick={strip.onToAnchor}
          title={w.toAnchorHint}
          data-testid="lab-clock-anchor"
        >
          {w.toAnchor}
        </button>
      </div>

      {world.sync.problem && (
        <p role="status" className={`rounded-[8px] px-3 py-2 bg-[#2A2316] text-[#F6C875] ${small}`} data-testid="lab-manual">
          <i className="ri-hand-coin-line mr-1.5" aria-hidden="true" />
          {w.manual}
          <span className="block text-[#CAD0DA] mt-0.5" lang="en">{world.sync.problem}</span>
        </p>
      )}

      <section aria-label={w.products} className="min-w-0">
        <h3 className={`${small} font-medium text-[#C8B2FF]`}><i className="ri-flask-line mr-1" aria-hidden="true" />{w.products}</h3>
        <ul className="mt-1 divide-y divide-[#1F2530]" data-testid="lab-products">
          {products.length === 0 && <li className={`py-2 ${small} text-[#9AA5B5]`}>{w.noProducts}</li>}
          {products.map(({ product, link }) => {
            const pinned = showing === link.itemId;
            const inBag = snapshot?.itemIds.includes(link.itemId) ?? false;
            return (
              <li key={product.id} className="py-1.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`${text} text-[#F5F7FC] truncate`}>{product.name}</p>
                  <p className={`${small} text-[#9AA5B5] truncate`}>{pinned ? w.pinnedOnShopee : inBag ? w.inBag : w.notInBag}</p>
                </div>
                <Button
                  variant={pinned ? "ghost" : "secondary"}
                  size="desk"
                  icon="ri-pushpin-line"
                  disabled={!canPin || pinned}
                  onClick={() => act([{ kind: "pin", productId: product.id }])}
                  data-testid={`lab-pin-${product.id}`}
                >
                  {pinned ? w.pinned : w.pin}
                </Button>
              </li>
            );
          })}
        </ul>
        {!presenter && (
          <div className="mt-1 flex items-center gap-3">
            <Button variant="ghost" size="desk" icon="ri-pushpin-2-line" onClick={() => act([{ kind: "unpin" }])} data-testid="lab-unpin">{w.unpin}</Button>
            <p className="text-[14px] text-[#9AA5B5] min-w-0">{w.unpinNote}</p>
          </div>
        )}
      </section>

      <section aria-label={w.records} className="min-w-0">
        <h3 className={`${small} font-medium text-[#CAD0DA]`}>{w.records}</h3>
        <ul className="mt-1 space-y-1.5" data-testid="lab-records">
          {records.length === 0 && <li className={`${small} text-[#9AA5B5]`}>{w.noRecords}</li>}
          {records.map((r) => {
            const s = SOURCE_STYLE[r.source];
            return (
              <li key={r.id} className="rounded-[8px] bg-[#0F1218] border border-[#232935] px-2.5 py-1.5" data-source={r.source}>
                <p className={`${text} text-[#F5F7FC] flex items-baseline justify-between gap-2`}>
                  <span className="truncate">{r.title}</span>
                  <span className={`${small} tabular-nums text-[#9AA5B5] shrink-0`}>{formatClock(r.atMs, tz, true)}</span>
                </p>
                <p className={`${small} ${s.tone}`}>
                  <span className="font-medium">{words.state[r.state]}</span> · <i className={`${s.icon} mr-0.5`} aria-hidden="true" />{words.source[r.source]}
                </p>
                {!presenter && r.reason && <p className="text-[13px] text-[#9AA5B5] break-all" lang="en">{r.reason}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label={w.notices} className="min-w-0">
        <h3 className={`${small} font-medium text-[#CAD0DA]`}>{w.notices}</h3>
        <ul className="mt-1 divide-y divide-[#1F2530]" data-testid="lab-notices" aria-live="polite">
          {notices.length === 0 && <li className={`py-1.5 ${small} text-[#9AA5B5]`}>{w.noNotices}</li>}
          {notices.map((n) => {
            const line = lang === "vi" ? words.noticeLine(n.code, n.data) : null;
            return (
            <li key={n.id} className="py-1.5 flex gap-3 items-start">
              <span className={`${small} font-mono tabular-nums text-[#9AA5B5] shrink-0`}>{formatClock(n.atMs, tz, true)}</span>
              <p className={`${small} text-[#F5F7FC] min-w-0`}>
                {lang === "vi" && words.noticeTitles[n.code] && <span className="block font-medium">{words.noticeTitles[n.code]}</span>}
                {line ? (
                  <span className="text-[#CAD0DA]">
                    {line.lead}
                    {line.original && <> <span lang="en">{line.original}</span></>}
                    {line.tail && <> {line.tail}</>}
                  </span>
                ) : (
                  <span lang="en" className={lang === "vi" ? "text-[#CAD0DA]" : undefined}>{n.summary}</span>
                )}
              </p>
            </li>
            );
          })}
        </ul>
      </section>

      {!presenter && (
        <div className="flex items-center gap-3 flex-wrap mt-auto pt-1">
          <label className="inline-flex items-center gap-2 min-h-[44px] text-[15px] text-[#F5F7FC] cursor-pointer">
            <input type="checkbox" checked={world.auto} onChange={(e) => act([{ kind: "auto", on: e.target.checked }])} className="w-5 h-5 accent-[#DFFF00]" data-testid="lab-auto" />
            {w.autoSync}
          </label>
          <Button variant="secondary" size="desk" icon="ri-refresh-line" onClick={() => act([{ kind: "sync" }])} data-testid="lab-sync-now">{w.syncNow}</Button>
          <label className="inline-flex items-center gap-2 min-h-[44px] text-[15px] text-[#CAD0DA]">
            {words.assumptions.condition}
            <select
              value={world.sim.fault ?? "none"}
              onChange={(e) => act([{ kind: "fault", fault: e.target.value === "none" ? null : (e.target.value as ShopeeFault) }])}
              className="min-h-[40px] rounded-[8px] bg-[#0F1218] border border-[#2C3340] px-2 text-[15px] text-[#F5F7FC]"
              data-testid="lab-fault"
            >
              {(Object.keys(words.faults) as Array<ShopeeFault | "none">).map((k) => (
                <option key={k} value={k}>{words.faults[k]}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}
