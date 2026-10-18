"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DeskPinBand, DeskTimelineMark } from "@/lib/livedesk/types";
import type { DeskCopy } from "./copy";
import { clock, num } from "./i18n";
import type { DeskLang } from "./prefs";

/**
 * One hand-built SVG chart: viewers (line) over add-to-carts per minute for the pinned product (bars), on one time
 * axis, axes from zero, direct labels instead of a legend. Pins and unpins are dashed markers (live) or shaded bands
 * (recap); they say when, never why. A minute with nothing pinned has no "pinned product" to count, so it is hatched,
 * never drawn as zero. The figure's text alternative is a full sentence built from the same numbers.
 */

export interface ChartData {
  elapsedSec: number;
  viewers: { atSec: number; value: number }[];
  /** Per minute; null where nothing was pinned. */
  carts: Array<number | null>;
  marks: DeskTimelineMark[];
  bands: DeskPinBand[];
}

function useSize<T extends HTMLElement>(): [React.RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

const niceMax = (v: number, steps: number[]): number => steps.find((s) => v <= s) ?? Math.ceil(v / 100) * 100;

/** Runs of minutes with nothing pinned, as [fromSec, toSec). */
function noShowRuns(carts: Array<number | null>, end: number): Array<{ from: number; to: number }> {
  const runs: Array<{ from: number; to: number }> = [];
  carts.forEach((v, m) => {
    if (v !== null) return;
    const from = m * 60, to = Math.min(end, (m + 1) * 60);
    if (to <= from) return;
    const last = runs[runs.length - 1];
    if (last && last.to === from) last.to = to;
    else runs.push({ from, to });
  });
  return runs;
}

export function markLabel(m: DeskTimelineMark, c: DeskCopy): string {
  return m.kind === "pin" ? c.markPin(m.productName) : m.kind === "unpin" ? c.markUnpin(m.productName)
    : m.kind === "host_pin" ? c.markHostPin(m.productName) : c.markHostUnpin(m.productName);
}

export function chartSummary(data: ChartData, c: DeskCopy, lang: DeskLang): string {
  if (data.viewers.length === 0) return c.chartEmpty;
  const values = data.viewers.map((p) => p.value);
  const carts = data.carts.filter((v): v is number => v !== null);
  return c.chartSummary({
    span: clock(data.elapsedSec),
    first: num(values[0], lang),
    last: num(values[values.length - 1], lang),
    peak: num(Math.max(...values), lang),
    cartPeak: carts.length ? num(Math.max(...carts), lang) : c.unknown,
    marks: c.chartMarks(data.marks.map((m) => `${markLabel(m, c)} ${clock(m.atSec)}`).join(", ")),
    noShow: data.carts.filter((v) => v === null).length,
  });
}

export function DeskChart({ data, variant, c, lang }: { data: ChartData; variant: "live" | "recap"; c: DeskCopy; lang: DeskLang }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const end = data.elapsedSec;
  const summary = chartSummary(data, c, lang);
  const domain = variant === "recap" ? Math.max(60, end) : Math.max(120, Math.ceil(end / 30) * 30);
  const W = Math.max(280, size.w);
  const H = Math.max(120, size.h);
  const short = H < 240;
  const pad = { l: 40, r: 52, t: variant === "recap" ? 30 : short ? 28 : 34, b: 24 };
  const gap = short ? 26 : 40;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b - gap;
  const topH = Math.round(plotH * 0.6);
  const botH = plotH - topH;
  const topY = pad.t;
  const botY = pad.t + topH + gap;
  const x = (t: number): number => pad.l + (Math.min(t, domain) / domain) * plotW;

  const vMax = niceMax(Math.max(...data.viewers.map((p) => p.value), 200), [200, 300, 400, 500, 600]);
  const yV = (v: number): number => topY + topH - (v / vMax) * topH;
  const bMax = niceMax(Math.max(...data.carts.map((b) => b ?? 0), 4), [4, 8, 12, 16, 20]);
  const yB = (v: number): number => botY + botH - (v / bMax) * botH;
  const barW = Math.max(2, (60 / domain) * plotW - (domain > 1200 ? 2 : 4));

  const line = data.viewers.map((p, i) => `${i ? "L" : "M"}${x(p.atSec).toFixed(1)},${yV(p.value).toFixed(1)}`).join("");
  const first = data.viewers[0];
  const last = data.viewers[data.viewers.length - 1];
  const area = first && last ? `${line}L${x(last.atSec).toFixed(1)},${topY + topH}L${x(first.atSec).toFixed(1)},${topY + topH}Z` : "";

  const maxTicks = Math.max(3, Math.floor(plotW / 110));
  const xStep = [30, 60, 120, 300, 600, 900, 1800].find((s) => domain / s <= maxTicks) ?? 1800;
  const xTicks: number[] = [];
  for (let t = 0; t <= domain + 0.5; t += xStep) xTicks.push(t);
  const vTicks = topH > 90 ? [0, vMax / 2, vMax] : [0, vMax];
  const bTicks = botH > 60 ? [0, bMax / 2, bMax] : [0, bMax];
  const runs = noShowRuns(data.carts, end);
  const bandFill = ["var(--band-a)", "var(--band-b)", "var(--band-c)"];
  const bandIndex = new Map<string, number>();

  // Marker labels: the newest wins when two would collide.
  const labelled = new Set<number>();
  let lastX = Infinity;
  for (let i = data.marks.length - 1; i >= 0; i--) {
    const mx = x(data.marks[i].atSec);
    if (lastX - mx > 120) {
      labelled.add(i);
      lastX = mx;
    }
  }

  return (
    <div className="chart" ref={ref} role="img" aria-label={summary} data-testid={`desk-chart-${variant}`}>
      {size.w > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
          <defs>
            <pattern id={`hatch-${variant}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="var(--bg)" />
              <path d="M0 0v8" stroke="var(--hatch)" strokeWidth="1" />
            </pattern>
          </defs>
          {variant === "recap" && data.bands.map((b) => {
            if (!bandIndex.has(b.productId)) bandIndex.set(b.productId, bandIndex.size);
            const i = bandIndex.get(b.productId) ?? 0;
            const w = Math.max(1, x(b.toSec) - x(b.fromSec));
            return (
              <g key={`${b.productId}-${b.fromSec}`} className="band">
                <rect x={x(b.fromSec)} y={topY - 22} width={w} height={H - pad.b - topY + 22} fill={bandFill[i % 3]} />
                {w > 70 && <text x={x(b.fromSec) + 8} y={topY - 7} className="band-label">{b.productName}</text>}
              </g>
            );
          })}
          {vTicks.map((v) => (
            <g key={`v${v}`}>
              <line x1={pad.l} x2={pad.l + plotW} y1={yV(v)} y2={yV(v)} className={v === 0 ? "axis" : "gridline"} />
              <text x={pad.l - 8} y={yV(v) + 4} className="tick" textAnchor="end">{num(v, lang)}</text>
            </g>
          ))}
          {bTicks.map((v) => (
            <g key={`b${v}`}>
              <line x1={pad.l} x2={pad.l + plotW} y1={yB(v)} y2={yB(v)} className={v === 0 ? "axis" : "gridline"} />
              <text x={pad.l - 8} y={yB(v) + 4} className="tick" textAnchor="end">{num(v, lang)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={x(t)} y={H - 6} className="tick" textAnchor={t === 0 ? "start" : t + xStep > domain ? "end" : "middle"}>{clock(t)}</text>
          ))}
          <text x={pad.l} y={topY - (variant === "recap" ? 26 : 14)} className="series-title">{c.seriesViewers}</text>
          <text x={pad.l} y={botY - 8} className="series-title">{c.seriesCarts}</text>
          {runs.map((r) => {
            const w = Math.max(2, x(r.to) - x(r.from));
            return (
              <g key={`gap${r.from}`} className="gap">
                <rect x={x(r.from)} y={botY} width={w} height={botH} fill={`url(#hatch-${variant})`} />
                {w > 64 && <text x={x(r.from) + w / 2} y={botY + botH / 2 + 4} className="gap-label" textAnchor="middle">{c.noShow}</text>}
              </g>
            );
          })}
          {area && <path d={area} className="area" />}
          {line && <path d={line} className="line" pathLength={variant === "recap" ? 1 : undefined} />}
          {data.carts.map((v, m) => (v === null || v === 0 ? null : (
            <rect key={`bar${m}`} x={x(m * 60) + 2} y={yB(v)} width={Math.max(2, Math.min(barW, x(Math.min(end, m * 60 + 60)) - x(m * 60) - 4))}
              height={botY + botH - yB(v)} className="bar" />
          )))}
          {last && (
            <g className="end-label">
              <circle cx={x(last.atSec)} cy={yV(last.value)} r="4" className="dot" />
              <text x={x(last.atSec) + 10} y={yV(last.value) + 5} className="direct">{num(last.value, lang)}</text>
            </g>
          )}
          {variant === "live" && data.marks.map((m, i) => {
            const label = markLabel(m, c);
            // Labels start clear of the series title on the left and never run off the right edge.
            const px = Math.max(pad.l + 160, Math.min(x(m.atSec) - 4, W - label.length * 7.4 - 8));
            return (
              <g key={`m${m.atSec}-${i}`} className={`marker is-${m.kind}`}>
                <line x1={x(m.atSec)} x2={x(m.atSec)} y1={topY - 4} y2={botY + botH} />
                {labelled.has(i) && <text className="marker-label" x={px + 4} y={topY - 10}>{label}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {data.viewers.length === 0 && <p className="chart-empty">{c.chartEmpty}</p>}
    </div>
  );
}
