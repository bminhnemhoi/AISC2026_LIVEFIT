import React from "react";
import type { LiveDeskViewModel } from "@/lib/livedesk/types";
import type { DeskCopy } from "./copy";
import { IconEye } from "./icons";
import type { DeskLang } from "./prefs";
import { num } from "./i18n";
import { SimTag } from "./ui";

/**
 * A preview of the host's phone on SIMULATED Shopee Live, drawn from the desk's view: viewers, time, the two newest
 * comments and the product on show. Deliberately generic: no platform logo, colours or layout copied from any real
 * app. The video frame is a flat drawing (a host at a clothes rack), not a photo. It is a picture, not a control.
 */

function VideoFrame() {
  return (
    <svg className="phone-video" viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pv-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9cdbb" />
          <stop offset="0.58" stopColor="#b9a98f" />
          <stop offset="1" stopColor="#8d7c63" />
        </linearGradient>
      </defs>
      <rect width="180" height="320" fill="url(#pv-wall)" />
      <line x1="6" y1="40" x2="174" y2="40" stroke="#6f6252" strokeWidth="2" />
      {([[10, "#8a9a7b"], [52, "#c08a6a"], [94, "#7d8aa5"], [136, "#b8a06a"]] as const).map(([x, fill]) => (
        <g key={x}>
          <path d={`M${x + 16} 40 v4`} stroke="#6f6252" strokeWidth="1.5" />
          <rect x={x} y={44} width={34} height={52} fill={fill} />
        </g>
      ))}
      <ellipse cx="90" cy="120" rx="20" ry="24" fill="#e8cdb4" />
      <path d="M71 112 q0 -28 19 -28 q20 0 19 28 q-4 -12 -19 -12 q-15 0 -19 12 z" fill="#4a3a2e" />
      <path d="M46 320 v-120 q0 -46 44 -52 q44 6 44 52 v120 z" fill="#f5efe4" />
      <path d="M62 186 l16 -12 h24 l16 12 l-7 11 l-7 -4 v40 h-28 v-40 l-7 4 z" fill="#9e3b2b" opacity="0.92" />
      <ellipse cx="64" cy="192" rx="7" ry="6" fill="#e8cdb4" />
      <ellipse cx="116" cy="192" rx="7" ry="6" fill="#e8cdb4" />
    </svg>
  );
}

export function Phone({ view, c, lang }: { view: LiveDeskViewModel; c: DeskCopy; lang: DeskLang }) {
  const product = view.mode === "live" ? view.products.find((p) => p.id === view.showingProductId) ?? null : null;
  const recent = view.comments.slice(0, 2).reverse();
  return (
    <figure className="phone-wrap" data-testid="desk-phone">
      <figcaption className="phone-caption">
        <span>{c.phone}</span>
        <SimTag>SIMULATED</SimTag>
      </figcaption>
      <div className="phone" role="img" aria-label={c.phoneAria(product?.name ?? null)}>
        <div className="phone-screen" aria-hidden="true">
          <VideoFrame />
          <div className="phone-top">
            <span className="phone-live">LIVE</span>
            <span className="phone-viewers"><IconEye size={12} />{view.viewers === null ? "?" : num(view.viewers, lang)}</span>
            <span className="phone-time">{view.clock.elapsedLabel}</span>
          </div>
          <div className="phone-spacer" />
          <ul className="phone-chat">
            {recent.map((m) => <li key={m.id}><b>{m.user}</b> {m.text}</li>)}
          </ul>
          <div className={`phone-pin${product ? " is-on" : ""}`} key={product?.id ?? "none"}>
            {product ? (
              <>
                <span className="phone-pin-text">
                  <span className="phone-pin-flag">{c.phonePinned}</span>
                  <b>{product.name}</b>
                  <span className="phone-price">{product.priceLabel ?? c.phonePriceMissing}</span>
                </span>
                <span className="phone-cta">{c.phoneView}</span>
              </>
            ) : (
              <span className="phone-pin-empty">{view.mode === "ended" ? c.phoneEnded : c.phoneNoPin}</span>
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}
