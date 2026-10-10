"use client";

import React from "react";
import { useShell } from "./Shell";
import { SimTag } from "./ui";
import { Cross, SpecRuler } from "./art";

/**
 * Home's one decoration: the anatomy of a suggestion as a spec sheet. The labels are the real things the desk shows with
 * every suggestion (sample size, confidence, source, state). The values are an EXAMPLE and say so; nothing here is a result.
 */
export function HeroSpec() {
  const { c } = useShell();
  const h = c.heroSpec;
  return (
    <aside className="spec" aria-hidden="true" data-testid="hero-spec">
      <Cross className="tl" />
      <Cross className="tr" />
      <Cross className="bl" />
      <Cross className="br" />
      <div className="spec-head">
        <span className="spec-kicker">{h.kicker}</span>
        <SimTag quiet>{h.simTag}</SimTag>
      </div>
      <div className="spec-body">
        <svg className="spec-card" viewBox="0 0 112 118" width="168" height="177" focusable="false">
          <rect className="lm-back" x="7" y="24" width="64" height="82" fill="none" strokeWidth="1.6" transform="rotate(3 39 65)" />
          <g transform="rotate(-5 54 58)">
            <rect className="lm-card" x="20" y="12" width="68" height="88" strokeWidth="3" />
            <rect className="lm-photo" x="28" y="22" width="52" height="40" />
            <path className="spec-garment" d="M43 34 L38 38 L40 44 L43 43 L43 53 L65 53 L65 43 L68 44 L70 38 L65 34 Q54 42 43 34 Z" />
            <circle className="lm-live" cx="35" cy="29" r="3.6" />
            <rect className="lm-bar" x="28" y="72" width="52" height="4.4" />
            <rect className="lm-bar" x="28" y="82" width="26" height="4.4" />
          </g>
          <rect className="lm-tape" x="37" y="3" width="34" height="15" transform="rotate(4 54 10)" />
        </svg>
        <dl className="spec-rows">
          {h.rows.map(([label, value], i) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {i === 1 && (
                  <span className="spec-meter">
                    <i className="on" />
                    <i className="on" />
                    <i />
                  </span>
                )}
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <SpecRuler label={h.ruler} />
      <p className="spec-fine">{h.fine}</p>
    </aside>
  );
}
