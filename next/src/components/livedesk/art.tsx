"use client";

import React from "react";
import { CardStack, CardTote, CommentChips, HostPhone, InkArrow, PaperClip, PriceTag, RingLight, UnknownNote } from "./brand";
import { useShell } from "./Shell";

/**
 * Decoration for the empty space on wide screens, in the manner of a printed spec sheet: registration marks at the
 * corners, a kicker, a tick ruler with its caption, a faint giant word, and the brand drawings (`brand.tsx`, generated
 * from docs/brand/assets) arranged on it. Words only, never numbers, so nothing reads as data. Hidden from assistive
 * tech, static, and every colour is a theme token.
 */

/** A registration mark, as on a printed spec sheet. */
export function Cross({ className }: { className: string }) {
  return (
    <svg className={`spec-cross ${className}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 1v14M1 8h14" fill="none" strokeWidth="1" />
      <circle cx="8" cy="8" r="3.4" fill="none" strokeWidth="1" />
    </svg>
  );
}

/** A tick ruler: a long tick every ten, a middle one every five; the brick pointer sits at `mark` (0 to 400). */
export function SpecRuler({ label, mark = 300 }: { label?: string; mark?: number }) {
  return (
    <div className="spec-ruler">
      <svg viewBox="0 0 400 22" preserveAspectRatio="none" width="100%" height="22" focusable="false" aria-hidden="true">
        {Array.from({ length: 41 }, (_, i) => (
          <line key={i} className="spec-tick" x1={i * 10} x2={i * 10} y1={22} y2={i % 10 === 0 ? 6 : i % 5 === 0 ? 12 : 17} />
        ))}
        <path className="spec-mark" d={`M${mark} 2 l6 0 l-3 7 z`} />
      </svg>
      {label && <span className="spec-kicker">{label}</span>}
    </div>
  );
}

/** Drawings shown small pass a `strokeScale` above 1, so their hairlines stay at least about 1.5 px on a 1x screen. */

/** One drawing placed on a sheet's stage: left, top and width in percent of the stage, and a tilt in degrees. */
function Spot({ left, top, width, tilt = 0, children }: { left: number; top: number; width: number; tilt?: number; children: React.ReactNode }) {
  return <span className="sheet-spot" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, rotate: `${tilt}deg` }}>{children}</span>;
}

function Sheet({ className, kicker, ruler, giant, children }: { className: string; kicker: string; ruler?: string; giant?: string; children: React.ReactNode }) {
  return (
    <div className={`sheet-art ${className}`} aria-hidden="true">
      <Cross className="tl" />
      <Cross className="tr" />
      <Cross className="bl" />
      <Cross className="br" />
      <span className="spec-kicker">{kicker}</span>
      <div className="sheet-stage">
        {giant && <svg className="sheet-giant" viewBox="0 0 300 100" focusable="false"><text x="0" y="86">{giant}</text></svg>}
        {children}
      </div>
      <SpecRuler label={ruler} />
    </div>
  );
}

/* The Start drawing keeps its die-cut stickers (the owner prefers them there): their own defs, sticker and ruler. */

/** Gradients and the dot pattern for one drawing; each drawing has its own ids, so one hidden drawing never blanks another. */
function ArtDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="stop-paper-a" />
        <stop offset="1" className="stop-paper-b" />
      </linearGradient>
      <linearGradient id={`${id}-kraft`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="stop-kraft-a" />
        <stop offset="1" className="stop-kraft-b" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0.6">
        <stop offset="0.2" className="stop-sheen" stopOpacity="0" />
        <stop offset="0.32" className="stop-sheen" stopOpacity="0.5" />
        <stop offset="0.44" className="stop-sheen" stopOpacity="0" />
      </linearGradient>
      <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" className="art-dot" /></pattern>
    </defs>
  );
}

function Sticker({ art, d, fill, children }: { art: string; d: string; fill: "paper" | "kraft"; children?: React.ReactNode }) {
  // die-cut: a soft cut line, a margin, then the body in the site's own paper or kraft, its ink outline and a sheen
  return (
    <g>
      <path d={d} className="stk-cut" />
      <path d={d} className="stk-margin" />
      <path d={d} fill={`url(#${art}-${fill})`} className="stk-ink" />
      <path d={d} fill={`url(#${art}-sheen)`} />
      {children}
    </g>
  );
}

const Reg = ({ x, y }: { x: number; y: number }) => (
  <g className="art-reg"><circle cx={x} cy={y} r="6" /><path d={`M${x} ${y - 10}v20M${x - 10} ${y}h20`} /></g>
);

/** A tick ruler: a tick every 10 units, a longer one every 50; `mark` puts a pointer that many units along. */
function Ruler({ x, y, ticks, width = ticks * 10, mark }: { x: number; y: number; ticks: number; width?: number; mark?: number }) {
  return (
    <g className="art-ruler">
      <path d={`M${x} ${y}H${x + width}`} />
      {Array.from({ length: ticks + 1 }, (_, i) => (<path key={i} d={`M${x + i * 10} ${y}v${i % 5 === 0 ? -8 : -4}`} />))}
      {mark !== undefined && <path d={`M${x + mark} ${y - 16}l6 8 6-8z`} className="art-mark" />}
    </g>
  );
}

/** Start: a phone on air and a shirt with a tag, under "prepare the show". */
export function StartArt() {
  return (
    <div className="start-art art" aria-hidden="true">
      <svg viewBox="0 0 440 320" focusable="false">
        <ArtDefs id="art" />

        <text x="0" y="96" className="art-giant">LIVE</text>
        <text x="236" y="262" className="art-giant">PIN</text>

        <Reg x={12} y={14} />
        <Reg x={424} y={300} />
        <text x="30" y="12" className="art-label">INSTRUCTIONS</text>
        <text x="30" y="26" className="art-label is-big">PREPARE THE SHOW</text>
        <text x="30" y="38" className="art-label is-big">PIN WHAT SELLS</text>
        <g className="art-chips">{["L", "I", "V", "E"].map((ch, i) => (<g key={ch} transform={`translate(${352 + i * 21} 12)`}><circle r="8" /><text y="3.5">{ch}</text></g>))}</g>
        <rect x="380" y="34" width="54" height="36" fill="url(#art-dots)" />
        <g className="art-pill"><rect x="300" y="86" width="64" height="18" rx="9" /><text x="332" y="98.5">ON AIR</text></g>
        <text x="226" y="312" className="art-label">SIMULATED · LIVE DESK</text>

        {/* a phone on air */}
        <g transform="translate(58 112) rotate(-8 60 96)">
          <Sticker art="art" fill="paper" d="M22 0h76a22 22 0 0 1 22 22v148a22 22 0 0 1 -22 22h-76a22 22 0 0 1 -22 -22v-148a22 22 0 0 1 22 -22z">
            <rect x="12" y="20" width="96" height="150" rx="12" className="stk-screen" />
            <rect x="46" y="8" width="28" height="6" rx="3" className="stk-line-fill" />
            <g transform="translate(22 32)"><rect width="38" height="16" rx="8" className="stk-live" /><circle cx="9" cy="8" r="3" className="stk-live-dot" /><text x="24" y="11.5" className="stk-live-text">LIVE</text></g>
            <path d="M74 126c0-6 8-9 11-3 3-6 11-3 11 3 0 7-11 13-11 13s-11-6-11-13z" className="stk-heart" />
            <path d="M84 104c0-4 5-6 7-2 2-4 7-2 7 2 0 4-7 8-7 8s-7-4-7-8z" className="stk-heart is-small" />
            <path d="M24 148h44M24 158h30" className="stk-line" />
          </Sticker>
        </g>

        {/* a shirt with a blank swing tag */}
        <g transform="translate(236 118) rotate(8 80 80)">
          <Sticker art="art" fill="kraft" d="M56 18q24 18 48 0l46 22-14 36-22-9v76h-68v-76l-22 9-14-36z">
            <path d="M56 18q24 18 48 0" className="stk-line" fill="none" />
            <path d="M58 70v70M102 70v70" className="stk-line is-soft" />
            <g transform="translate(108 92) rotate(14)"><path d="M0 6l6-6h18v28h-24z" className="stk-tag" /><circle cx="6" cy="7" r="2" className="stk-line-fill" /></g>
          </Sticker>
        </g>

        <Ruler x={226} y={294} ticks={20} width={204} mark={106} />
      </svg>
    </div>
  );
}

/** Recap: the products of the show and what the room said; "end of show". */
export function RecapArt() {
  const { c } = useShell();
  return (
    <Sheet className="recap-art" kicker={c.art.recap.kicker}>
      <Spot left={8} top={0} width={20}><CardStack strokeScale={1.6} /></Spot>
      <Spot left={36} top={26} width={22}><InkArrow strokeScale={1.4} /></Spot>
      <Spot left={66} top={2} width={26}><CommentChips strokeScale={1.6} /></Spot>
    </Sheet>
  );
}

/** Legacy: the earlier planning screens, kept on file. */
export function LegacyArt() {
  const { c } = useShell();
  return (
    <Sheet className="legacy-art" kicker={c.art.legacy.kicker} ruler={c.art.legacy.ruler} giant="PLAN">
      <Spot left={6} top={20} width={42} tilt={-3}><CardStack strokeScale={1.15} /></Spot>
      <Spot left={40} top={12} width={7}><PaperClip strokeScale={1.2} /></Spot>
      <Spot left={56} top={48} width={34} tilt={6}><PriceTag strokeScale={1.15} /></Spot>
    </Sheet>
  );
}

/** Home's four steps, each with its drawing: connect (the host's phone), products, go live (the ring light), the desk. */
export function StepArt({ step }: { step: number }) {
  const Drawing = [HostPhone, CardTote, RingLight, CommentChips][step] ?? CardStack;
  return <span className="flow-art" aria-hidden="true"><Drawing strokeScale={1.5} /></span>;
}

/** The recap's "what we do not know" box wears the brand's sticky note, in the reader's language. */
export function UnknownSticker() {
  const { c } = useShell();
  return <span className="unknown-sticker" aria-hidden="true"><UnknownNote label={c.unknownBig} strokeScale={1.3} /></span>;
}

/** Empty and not-found states: a stack of cards, nothing pinned yet. */
export function EmptyArt() {
  return <span className="empty-art" aria-hidden="true"><CardStack strokeScale={1.3} /></span>;
}
