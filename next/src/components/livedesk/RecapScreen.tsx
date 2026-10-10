"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveRecap } from "@/lib/livedesk/hooks";
import type { RecapRow, RecapViewModel } from "@/lib/livedesk/types";
import { DeskChart } from "./DeskChart";
import { IconQuestion, IconShield } from "./icons";
import { INTENT_ORDER, clock, duration, num } from "./i18n";
import { Shell, useShell } from "./Shell";
import { SimTag, TapeTitle } from "./ui";
import { EmptyArt, RecapArt, UnknownSticker } from "./art";

/**
 * The recap of a recorded live: a few numbers, the timeline with pinned products as bands, what the assistant
 * suggested and what the operator did, comments by intent, and what is still unknown. Built from the desk's own
 * record (`useLiveRecap`); a number the record does not hold is shown as unknown, never as zero.
 */

const OUTCOME_CLASS: Record<RecapRow["outcome"], string> = {
  open: "is-expired", no_response: "is-expired", accepted: "is-accepted", performed: "is-accepted", dismissed: "is-dismissed", self: "is-self", host: "is-self",
};

function Rows({ r }: { r: RecapViewModel }) {
  const { c } = useShell();
  return (
    <table className="dtable" data-testid="recap-decisions">
      <thead>
        <tr><th scope="col">{c.colAt}</th><th scope="col">{c.colWhat}</th><th scope="col">{c.colWhy}</th><th scope="col">{c.colYou}</th></tr>
      </thead>
      <tbody>
        {r.rows.map((row, i) => {
          const what = row.action === "flash_sale" ? c.rowFlash(row.productName) : row.action === "unpin" ? c.rowUnpin(row.productName) : c.rowPin(row.productName);
          const why = row.suggestion ? c.why(row.suggestion.sampleSize, c.confidence[row.suggestion.confidence], c.source[row.suggestion.source])
            : row.outcome === "host" ? c.hostWhy : c.noWhy;
          return (
            <tr key={`${row.atSec}-${i}`} data-testid={`recap-row-${row.outcome}`}>
              <td className="num">{clock(row.atSec)}</td>
              <td>{what}{row.suggestion && <span className="row-kind">{c.suggestedTag}</span>}</td>
              <td className="muted">{why}</td>
              <td>
                <span className={`outcome ${OUTCOME_CLASS[row.outcome]}`}>{c.outcome[row.outcome]}</span>
                {row.actedAtSec !== null && <span className="outcome-at num">{clock(row.actedAtSec)}</span>}
                {(row.outcome === "accepted" || row.outcome === "performed") && <span className="outcome-note">{c.outcomeNote[row.outcome]}</span>}
              </td>
            </tr>
          );
        })}
        {r.rows.length === 0 && <tr><td colSpan={4} className="muted">{c.noRows}</td></tr>}
      </tbody>
    </table>
  );
}

function RecapBody({ liveId }: { liveId: string }) {
  const { c, lang } = useShell();
  const r = useLiveRecap(liveId);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!r || r.mode !== "ended") {
    const running = r !== null;
    return (
      <div className="desk-empty" data-testid="recap-empty">
        <div className="empty">
          <EmptyArt />
          <h1>{!mounted ? c.recapTitle : running ? c.recapRunning : c.recapNone}</h1>
          {mounted && <p>{running ? c.recapRunningHelp : c.recapNoneHelp}</p>}
          {mounted && (running
            ? <Link href={`/desk/${encodeURIComponent(liveId)}`} className="btn btn-primary btn-md">{c.desk}</Link>
            : <Link href="/start" className="btn btn-primary btn-md">{c.start}</Link>)}
        </div>
      </div>
    );
  }
  const suggestions = r.rows.filter((row) => row.suggestion !== null);
  const taken = suggestions.filter((row) => row.outcome === "accepted" || row.outcome === "performed").length;
  const maxIntent = Math.max(1, ...INTENT_ORDER.map((k) => r.intentCounts[k]));
  const firstBand = r.bands.find((b) => b.by === "operator") ?? r.bands[0];
  const noShow = r.cartsPerMinute.filter((v) => v === null).length;
  return (
    <div className="recap" data-testid="recap">
      <div className="recap-head">
        <div>
          <h1><TapeTitle text={c.recapTitle} mark={c.recapTitleMark} /></h1>
          <p className="recap-meta">{c.recapMeta(duration(r.durationSec, lang))} <SimTag quiet>{c.stamp}</SimTag></p>
        </div>
        <RecapArt />
        <Link href="/start" className="btn btn-primary btn-md" data-testid="recap-new">{c.newLive}</Link>
      </div>

      <dl className="kpis" data-testid="recap-kpis">
        <div>
          <dt>{c.kpiPeak}</dt>
          <dd className="num">{r.peakViewers === null ? c.unknownBig : num(r.peakViewers, lang)}</dd>
          <dd className="kpi-note">{c.kpiPeakNote(r.viewerSampleSec)}</dd>
        </div>
        <div className={r.cartsOnShow === null ? "kpi-unknown" : undefined}>
          <dt>{c.kpiCarts}</dt>
          <dd className="num">{r.cartsOnShow === null ? c.unknownBig : num(r.cartsOnShow, lang)}</dd>
        </div>
        <div>
          <dt>{c.kpiComments}</dt>
          <dd className="num">{num(r.commentsHeld.count, lang)}</dd>
          <dd className="kpi-note">{c.kpiCommentsNote(r.commentsHeld.fromSec === null ? null : clock(r.commentsHeld.fromSec), r.commentsHeld.masked)}</dd>
        </div>
        <div className="kpi-unknown" data-testid="recap-orders">
          <dt>{c.kpiOrders}</dt>
          <dd>{c.unknownBig}</dd>
          <dd className="kpi-note">{c.kpiOrdersNote}</dd>
        </div>
      </dl>

      <div className="recap-row">
        <section className="panel recap-chart" aria-labelledby="timeline-h">
          <div className="panel-head">
            <h2 id="timeline-h">{c.timeline}</h2>
            <p className="panel-note">{c.timelineNote}</p>
          </div>
          <DeskChart data={{ elapsedSec: r.durationSec, viewers: r.viewerPoints, carts: r.cartsPerMinute, marks: r.marks, bands: r.bands }} variant="recap" c={c} lang={lang} />
        </section>
        <section className="unknowns" aria-labelledby="unknown-h" data-testid="recap-unknowns">
          <UnknownSticker />
          <h2 id="unknown-h"><IconQuestion />{c.unknowns}</h2>
          <ul>
            {firstBand && <li><b>{c.unknownCause(firstBand.productName)}</b> {c.unknownCauseText}</li>}
            <li><b>{c.unknownOrders}</b> {c.unknownOrdersText}</li>
            <li><b>{c.unknownComments}</b> {c.unknownCommentsText(r.commentsHeld.fromSec === null ? null : clock(r.commentsHeld.fromSec))}</li>
            {noShow > 0 && <li><b>{c.unknownNoShow(noShow)}</b> {c.unknownNoShowText}</li>}
            {r.missing.map((m) => <li key={m.id}><b>{m.name}:</b> {c.unknownMissingText(c.missingWhat(m.price, m.stock))}</li>)}
          </ul>
        </section>
      </div>

      <div className="recap-grid">
        <section className="panel decisions" aria-labelledby="decisions-h">
          <div className="panel-head"><h2 id="decisions-h">{c.decisions}</h2><SimTag quiet>SIMULATED</SimTag></div>
          {/* What the operator did, in one line, where the decisions are: not as KPIs beside measured numbers. */}
          <p className="decisions-sum" data-testid="recap-decisions-summary">{c.decisionsSummary(num(r.operatorPins, lang), taken, suggestions.length)}</p>
          <Rows r={r} />
        </section>
        <section className="panel intents-recap" aria-labelledby="intents-h" data-testid="recap-intents">
          <div className="panel-head"><h2 id="intents-h">{c.byIntent}</h2></div>
          <ul className="hbars">
            {INTENT_ORDER.map((k) => (
              <li key={k}>
                <span className="hbar-label">{c.intent[k]}</span>
                <span className="hbar-track" aria-hidden="true"><span className="hbar" style={{ transform: `scaleX(${r.intentCounts[k] / maxIntent})` }} /></span>
                <span className="hbar-n num">{r.intentCounts[k]}</span>
              </li>
            ))}
          </ul>
          <p className="privacy"><IconShield size={16} /><span>{c.recapPrivacy(r.commentsHeld.masked, r.commentsHeld.count)}</span></p>
        </section>
      </div>
    </div>
  );
}

export function RecapScreen({ liveId }: { liveId: string }) {
  return (
    <Shell screen="recap">
      <RecapBody liveId={liveId} />
    </Shell>
  );
}
