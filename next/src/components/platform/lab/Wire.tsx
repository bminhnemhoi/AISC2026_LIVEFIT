"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatClock } from "@/lib/domain";
import { callJson, callKey, callLogDigest, wireRows, type LabTrace, type LedgerEntry, type ReadEntry, type WireRow } from "@/lib/platform";
import type { LabLang, LabWords } from "./labCopy";
import { usePrefersReducedMotion } from "./useLabPreferences";

const GRID = "grid grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]";

/** A horizontal arrow between two lane centres. `span` is which pair of lanes it joins; direction is a glyph, not a colour. */
function Arrow({ dir, tone, dashed = false }: { dir: "right" | "left"; tone: string; dashed?: boolean }): React.ReactElement {
  return (
    <span className={`relative block mx-[25%] h-[10px] ${tone}`} aria-hidden="true">
      <span className={`absolute inset-x-0 top-1/2 border-t-2 ${dashed ? "border-dashed" : ""} border-current`} />
      <i className={`absolute top-1/2 -translate-y-1/2 text-[14px] leading-none ${dir === "right" ? "ri-arrow-right-s-fill -right-[7px]" : "ri-arrow-left-s-fill -left-[7px]"}`} />
    </span>
  );
}

export function Wire({
  ledger,
  reads,
  trace,
  tz,
  words,
  lang,
  presenter,
}: {
  ledger: readonly LedgerEntry[];
  reads: readonly ReadEntry[];
  trace: readonly LabTrace[];
  tz: string;
  words: LabWords;
  lang: LabLang;
  presenter: boolean;
}): React.ReactElement {
  const w = words.wire;
  const [showReads, setShowReads] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => wireRows(ledger, reads, trace, { showReads }), [ledger, reads, trace, showReads]);
  const calls = ledger.filter((e) => e.kind === "api").length + reads.length;
  const digest = callLogDigest(ledger, reads);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const text = presenter ? "text-[17px]" : "text-[14px]";
  const small = presenter ? "text-[15px]" : "text-[12px]";

  // Follow the newest call, unless the viewer is reading one.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || open !== null || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [rows.length, open, reduced]);

  const time = (ms: number): React.ReactElement => (
    <span className={`${small} font-mono tabular-nums text-[#9AA5B5] self-start pt-1`}>{formatClock(ms, tz, true)}</span>
  );

  const row = (r: WireRow, newest: boolean): React.ReactElement => {
    const base = `${GRID} gap-y-1 py-2 px-1 rounded-[8px] ${newest ? "bg-[#1A1F28]" : ""}`;
    if (r.kind === "host") {
      const e = r.entry;
      const what = lang === "en" ? e.summary.replace(/ \(not possible right now\)$/, "") : w.hostActions[e.action];
      return (
        <li key={r.key} className={base} data-testid="wire-host">
          {time(e.atMs)}
          <div className="col-start-3 col-span-2 min-w-0">
            <p className={`${text} text-center text-[#E4DAFF] truncate`} title={e.summary}>
              <i className="ri-smartphone-line mr-1" aria-hidden="true" />
              <span className="sr-only">{w.lanes.host} → {w.lanes.platform}: </span>
              {what}
              {!e.ok && <span className="text-[#F6C875]"> · {w.notPossible}</span>}
            </p>
            <Arrow dir="left" tone="text-[#C8B2FF]" />
          </div>
        </li>
      );
    }
    if (r.kind === "record") {
      const t = r.trace;
      const tone = t.source === "provider_observed" ? "text-[#B4C6DD]" : t.source === "request_refused" ? "text-[#F6C875]" : "text-[#CAD0DA]";
      return (
        <li key={r.key} className={base} data-testid="wire-record" data-source={t.source}>
          {time(t.atMs)}
          <div className="col-start-2 col-span-2 min-w-0">
            <Arrow dir="left" tone={tone} />
            <p className={`${text} text-center ${tone}`}>
              <i className="ri-corner-down-left-line mr-1" aria-hidden="true" />
              <span className="sr-only">{w.lanes.platform} → {w.lanes.livelift}: </span>
              {w.recorded} · {words.source[t.source]}
            </p>
            {!presenter && <p className={`${small} text-center text-[#9AA5B5] truncate`} title={t.summary}>{t.summary}</p>}
          </div>
        </li>
      );
    }
    const e = r.entry;
    const id = `wire-json-${callKey(e)}`;
    const isOpen = open === r.key;
    return (
      <li key={r.key} className={base} data-testid="wire-call" data-endpoint={e.endpoint} data-outcome={r.ok ? "ok" : e.envelope.error}>
        {time(e.atMs)}
        <div className="col-start-2 col-span-2 min-w-0">
          <button
            type="button"
            className="w-full rounded-[6px] cursor-pointer hover:bg-[#1E232B] focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2"
            aria-expanded={isOpen}
            aria-controls={id}
            aria-label={`${w.showJson(e.endpoint)}. ${w.lanes.livelift} → ${w.lanes.platform}: ${e.endpoint}, ${w.basis[e.basis]}. ${r.ok ? w.ok : `${e.envelope.error}: ${e.envelope.message}`}, request_id ${e.envelope.request_id}`}
            onClick={() => setOpen(isOpen ? null : r.key)}
          >
            <span className={`block ${text} text-center truncate`}>
              <span className="font-mono text-[#F5F7FC]">{e.endpoint}</span>{" "}
              <span className={e.basis === "documented" ? "text-[#B4C6DD]" : "text-[#F6C875]"}>{w.basis[e.basis]}</span>
              {e.readOnly && <span className="text-[#9AA5B5]"> · {w.read}</span>}
            </span>
            <Arrow dir="right" tone="text-[#7F8A9C]" />
            <Arrow dir="left" tone={r.ok ? "text-[#7F8A9C]" : "text-[#F4A4A4]"} dashed />
            <span className={`block ${small} text-center truncate ${r.ok ? "text-[#CAD0DA]" : "text-[#F4A4A4]"}`}>
              {r.ok ? (
                <><i className="ri-check-line mr-0.5" aria-hidden="true" />{w.ok}</>
              ) : (
                <><i className="ri-close-line mr-0.5" aria-hidden="true" />{e.envelope.error}: {e.envelope.message}</>
              )}
              {!presenter && <span className="font-mono text-[#9AA5B5]"> · request_id {e.envelope.request_id.slice(0, 12)}…</span>}
            </span>
          </button>
        </div>
        {isOpen && (
          <pre id={id} className="col-span-4 mt-1 p-2 rounded-[8px] bg-[#0F1218] border border-[#232935] text-[12px] text-[#CAD0DA] overflow-x-auto whitespace-pre-wrap break-all" data-testid="wire-json">
            {callJson(e)}
          </pre>
        )}
      </li>
    );
  };

  return (
    <section aria-label={w.region} className="flex flex-col min-h-0 h-full rounded-[12px] bg-[#13161C] p-3" data-testid="lab-wire">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2 className={`${presenter ? "text-[22px]" : "text-[18px]"} font-medium text-[#F5F7FC]`}>{w.region}</h2>
        {!presenter && (
          <label className="inline-flex items-center gap-2 min-h-[44px] text-[14px] text-[#CAD0DA] cursor-pointer">
            <input type="checkbox" checked={showReads} onChange={(e) => setShowReads(e.target.checked)} className="w-4 h-4 accent-[#DFFF00]" data-testid="wire-show-reads" />
            {w.showReads}
          </label>
        )}
      </div>
      <div className={`${GRID} shrink-0 border-b border-[#232935] pb-1.5 ${small} font-medium`} aria-hidden="true">
        <span />
        <span className="text-center text-[#F5F7FC]">{w.lanes.livelift}</span>
        <span className="text-center text-[#C8B2FF]"><i className="ri-flask-line mr-1" />{w.lanes.platform}</span>
        <span className="text-center text-[#C8B2FF]"><i className="ri-smartphone-line mr-1" />{w.lanes.host}</span>
      </div>
      <div ref={scrollRef} className="relative flex-1 min-h-[220px] overflow-y-auto" tabIndex={0} role="region" aria-label={w.scrollName} data-testid="wire-scroll">
        <div className="relative min-h-full">
          <div className={`${GRID} absolute inset-0 pointer-events-none`} aria-hidden="true">
            <span />
            <span className="mx-auto w-px bg-[#232935]" />
            <span className="mx-auto w-px bg-[#44385C]" />
            <span className="mx-auto w-px bg-[#2B2640]" />
          </div>
          <ol className="relative" data-testid="wire-rows">
            {rows.length === 0 && <li className={`${text} text-[#9AA5B5] p-3 text-center`}>{w.empty}</li>}
            {rows.map((r, i) => row(r, i === rows.length - 1))}
          </ol>
        </div>
      </div>
      <p className={`shrink-0 pt-2 ${small} text-[#9AA5B5] flex flex-wrap gap-x-2`}>
        <span className="font-mono" data-testid="wire-digest" data-digest={digest}>{w.digest(digest, calls)}</span>
        {!presenter && <span>{w.digestHint}</span>}
      </p>
    </section>
  );
}
