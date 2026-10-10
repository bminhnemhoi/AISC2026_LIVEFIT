// Hand-built SVG chart: viewers (line) over add-to-cart per minute (bars), one shared time axis,
// direct labels instead of a legend, axes from zero, pin markers or pinned-product bands,
// and an explicit "no data" band where a platform condition left a gap (gap, not zero).

import { useEffect, useRef, useState } from "preact/hooks";
import { fmtClock, fmtNum } from "../format";
import { cartPerMinute, pinBands, productById, viewerSeries, type World } from "../engine";
import { viewersAt } from "../data";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function niceMax(v: number, steps: number[]): number {
  for (const s of steps) if (v <= s) return s;
  return Math.ceil(v / 100) * 100;
}

export function LiveChart({ world, variant = "live" }: { world: World; variant?: "live" | "recap" }) {
  const [ref, size] = useWidth<HTMLDivElement>();
  const end = world.t;
  // The axis fits the time that has elapsed (rounded up to the next half minute): no empty future.
  const domain = variant === "recap" ? Math.max(60, end) : Math.max(120, Math.ceil(end / 30) * 30);
  const W = Math.max(280, size.w);
  const H = Math.max(120, size.h);
  const pad = { l: 40, r: 52, t: variant === "recap" ? 30 : 34, b: 26 };
  const gap = H < 220 ? 30 : 40;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b - gap;
  const topH = Math.round(plotH * 0.6);
  const botH = plotH - topH;
  const topY = pad.t;
  const botY = pad.t + topH + gap;
  const x = (t: number) => pad.l + (t / domain) * plotW;

  const series = viewerSeries(world, end, variant === "recap" ? 20 : 10);
  const vMax = niceMax(Math.max(...series.map((p) => p.v ?? 0), 200), [200, 300, 400, 500, 600]);
  const yV = (v: number) => topY + topH - (v / vMax) * topH;

  const bars = cartPerMinute(world, end);
  const bMax = niceMax(Math.max(...bars.map((b) => b.v ?? 0), 4), [4, 8, 12, 16, 20]);
  const yB = (v: number) => botY + botH - (v / bMax) * botH;
  const barW = Math.max(2, (60 / domain) * plotW - (domain > 1200 ? 2 : 4));

  // line, broken at gaps
  const segs: string[] = [];
  let cur = "";
  for (const p of series) {
    if (p.v === null) {
      if (cur) segs.push(cur);
      cur = "";
      continue;
    }
    cur += `${cur ? "L" : "M"}${x(p.t).toFixed(1)},${yV(p.v).toFixed(1)}`;
  }
  if (cur) segs.push(cur);
  const areas = segs.map((d) => {
    const pts = d.slice(1).split("L").map((s) => s.split(",").map(Number));
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${d}L${last[0]},${topY + topH}L${first[0]},${topY + topH}Z`;
  });

  const last = [...series].reverse().find((p) => p.v !== null);
  const maxTicks = Math.max(3, Math.floor(plotW / 110));
  const xTickStep = [30, 60, 120, 300, 600].find((s) => domain / s <= maxTicks) ?? 600;
  const xTicks: number[] = [];
  for (let t = 0; t <= domain + 0.5; t += xTickStep) xTicks.push(t);
  const vTicks = topH > 90 ? [0, vMax / 2, vMax] : [0, vMax];
  const bTicks = botH > 60 ? [0, bMax / 2, bMax] : [0, bMax];

  const markers = world.actions.filter((a) => a.kind === "pin" && a.t <= end);
  const bands = variant === "recap" ? pinBands(world, end) : [];
  const gaps = world.outages.map((o) => ({ from: o.from, to: o.to ?? end })).filter((g) => g.from < end);

  const summary =
    `Biểu đồ: người xem từ ${fmtNum(viewersAt(0))} lên ${last?.v ? fmtNum(last.v) : "không rõ"} sau ${fmtClock(end)}. ` +
    `Thêm giỏ mỗi phút cao nhất ${Math.max(0, ...bars.map((b) => b.v ?? 0))}. ` +
    (markers.length ? `Ghim: ${markers.map((m) => `${productById(m.product).name} lúc ${fmtClock(m.t)}`).join(", ")}. ` : "Chưa ghim sản phẩm nào. ") +
    (gaps.length ? `Không có dữ liệu từ ${gaps.map((g) => `${fmtClock(g.from)} đến ${fmtClock(g.to)}`).join(", ")}.` : "");

  const bandFill = ["var(--band-a)", "var(--band-b)", "var(--band-c)"];
  const bandIndex = new Map<string, number>();

  return (
    <div class="chart" ref={ref}>
      {size.w > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
          <defs>
            <pattern id={`hatch-${variant}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="var(--bg)" />
              <path d="M0 0v8" stroke="var(--hatch)" stroke-width="1" />
            </pattern>
          </defs>

          {bands.map((b) => {
            if (!bandIndex.has(b.product)) bandIndex.set(b.product, bandIndex.size);
            const i = bandIndex.get(b.product) as number;
            const w = Math.max(1, x(b.to) - x(b.from));
            return (
              <g key={`${b.product}-${b.from}`} class="band">
                <rect x={x(b.from)} y={topY - 22} width={w} height={H - pad.b - topY + 22} fill={bandFill[i % 3]} rx="4" />
                {w > 70 && (
                  <text x={x(b.from) + 8} y={topY - 7} class="band-label">
                    {productById(b.product).name}
                  </text>
                )}
              </g>
            );
          })}

          {/* gridlines */}
          {vTicks.map((v) => (
            <g key={`v${v}`}>
              <line x1={pad.l} x2={pad.l + plotW} y1={yV(v)} y2={yV(v)} class={v === 0 ? "axis" : "grid"} />
              <text x={pad.l - 8} y={yV(v) + 4} class="tick" text-anchor="end">
                {fmtNum(v)}
              </text>
            </g>
          ))}
          {bTicks.map((v) => (
            <g key={`b${v}`}>
              <line x1={pad.l} x2={pad.l + plotW} y1={yB(v)} y2={yB(v)} class={v === 0 ? "axis" : "grid"} />
              <text x={pad.l - 8} y={yB(v) + 4} class="tick" text-anchor="end">
                {fmtNum(v)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={x(t)} y={H - 6} class="tick" text-anchor={t === 0 ? "start" : t + xTickStep > domain ? "end" : "middle"}>
              {fmtClock(t)}
            </text>
          ))}

          {/* band titles, written on the chart instead of a legend */}
          <text x={pad.l} y={topY - (variant === "recap" ? 26 : 14)} class="series-title">
            Người xem cùng lúc
          </text>
          <text x={pad.l} y={botY - 8} class="series-title">
            Lượt thêm giỏ mỗi phút
          </text>

          {/* gaps: no data, not zero */}
          {gaps.map((g) => (
            <g key={`gap${g.from}`} class="gap">
              <rect x={x(g.from)} y={topY} width={Math.max(2, x(g.to) - x(g.from))} height={botY + botH - topY} fill={`url(#hatch-${variant})`} />
              {x(g.to) - x(g.from) > 40 && (
                <text x={(x(g.from) + x(g.to)) / 2} y={topY + topH / 2} class="gap-label" text-anchor="middle">
                  <tspan x={(x(g.from) + x(g.to)) / 2}>Không có</tspan>
                  <tspan x={(x(g.from) + x(g.to)) / 2} dy="15">dữ liệu</tspan>
                </text>
              )}
            </g>
          ))}

          {areas.map((d, i) => (
            <path key={`a${i}`} d={d} class="area" />
          ))}
          {segs.map((d, i) => (
            <path key={`l${i}`} d={d} class="line" pathLength={variant === "recap" ? 1 : undefined} />
          ))}

          {bars.map((b) =>
            b.v === null || b.v === 0 ? null : (
              <rect
                key={`bar${b.t}`}
                x={x(b.t) + 2}
                y={yB(b.v)}
                width={Math.max(2, Math.min(barW, x(Math.min(end, b.t + 60)) - x(b.t) - 4))}
                height={botY + botH - yB(b.v)}
                rx="2"
                class="bar"
              />
            ),
          )}

          {last && last.v !== null && (
            <g class="end-label">
              <circle cx={x(last.t)} cy={yV(last.v)} r="4" class="dot" />
              <text x={x(last.t) + 10} y={yV(last.v) + 5} class="direct">
                {fmtNum(last.v)}
              </text>
            </g>
          )}

          {variant === "live" &&
            markers.map((m) => {
              const pillW = productById(m.product).short.length * 7.6 + 50;
              const px = Math.max(pad.l + 4, Math.min(x(m.t) - 4, W - pillW - 2));
              return (
              <g key={`m${m.t}${m.product}`} class="marker">
                <line x1={x(m.t)} x2={x(m.t)} y1={topY - 4} y2={botY + botH} />
                <text class="marker-label" x={px + 4} y={topY - 10}>
                  Ghim {productById(m.product).short}
                </text>
              </g>
              );
            })}
        </svg>
      )}
    </div>
  );
}
