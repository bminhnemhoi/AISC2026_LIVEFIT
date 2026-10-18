"use client";

import React, { useId } from "react";
import type { ProductSnapshot } from "@/contracts";
import type { Review } from "@/lib/domain";
import { cell, type CellText } from "@/lib/intelligence/format";
import { MATCH_BASIS_WORDS, buildProductRows, type ProductRowModel } from "@/lib/intelligence/products";
import type { EvidenceOrigin, LiveIntelligenceSnapshot } from "@/lib/intelligence/types";
import { TierLabel, ValueText } from "./EvidenceParts";

/**
 * Per-product provider performance, for the whole LIVE.
 *
 * Never invented: a provider row is only tied to a LiveLift product through the explicit canonical identity mapping
 * and only when exactly one product qualifies. Otherwise it says "not matched" or "ambiguous".
 * A product that ran in several segments is a session-level figure; it is not split. Amounts always carry their own
 * currency and are never added across rows.
 */

const GRID = "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,0.65fr)_minmax(0,0.85fr)_minmax(0,0.65fr)_minmax(0,1.25fr)_minmax(0,0.9fr)]";

function Metric({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div role="cell" className="flex items-baseline justify-between gap-3 lg:block">
      <span className="text-[13px] text-[#9AA5B5] lg:hidden">{label}</span>
      <span className="text-right lg:text-left">{children}</span>
    </div>
  );
}

function ctorCell(row: ProductRowModel["row"]): CellText {
  if (row.ctor == null && row.clicks === 0) return { state: "unknown", text: "Not defined (0 clicks)", spoken: "Not defined, zero clicks" };
  return cell(row.ctor, row.ctor == null ? "missing" : "available", { rate: true });
}

function matchLine(m: ProductRowModel["match"]): string {
  if (m.kind === "matched") return `Matched to ${m.product.code} · ${MATCH_BASIS_WORDS[m.basis]}`;
  if (m.kind === "ambiguous") return `Ambiguous: could be ${m.candidates.map((p) => p.code).join(" or ")}. Not assigned to any.`;
  return "Not matched to a LiveLift product.";
}

export function ProductPerformanceTable({
  snapshot,
  products,
  review,
  origin,
}: {
  snapshot: LiveIntelligenceSnapshot;
  products: ProductSnapshot[];
  review: Review;
  origin: EvidenceOrigin;
}): React.ReactElement {
  const uid = useId();
  const rows = buildProductRows(snapshot.productPerformance, products, review, snapshot.productMappings);
  const currencies = new Set(rows.flatMap((r) => (r.row.gmv ? [r.row.gmv.currency] : [])));

  return (
    <section className="rounded-[12px] bg-[#13161C] p-3 sm:p-4" aria-labelledby={`${uid}-h`} data-testid="product-performance">
      <h3 id={`${uid}-h`} className="text-[18px] font-medium text-[#F5F7FC]">
        Product performance
      </h3>
      <p className="mt-0.5 max-w-[760px] text-[14px] leading-snug text-[#9AA5B5]">
        Provider figures for the whole LIVE, per product. They are not split by segment, and a product is only tied to one of yours on an exact identifier.
      </p>
      {currencies.size > 1 && (
        <p className="mt-2 text-[14px] text-[#B4C6DD]" data-testid="mixed-currency-note">
          <i className="ri-information-line mr-1" aria-hidden="true" />
          These rows use different currencies. Each amount stays in its own currency and none are added together.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-3 rounded-[8px] bg-[#101319] px-3 py-3 text-[15px] text-[#CAD0DA]" data-testid="no-product-rows">
          The provider returned no product rows for this show. That is not the same as no product activity.
        </p>
      ) : (
        <div role="table" aria-label="Product performance" className="mt-3 text-[15px]">
          <div role="row" className={`hidden gap-3 px-2 pb-1 text-[13px] text-[#9AA5B5] lg:grid ${GRID}`}>
            <span role="columnheader">Product</span>
            <span role="columnheader">Impressions</span>
            <span role="columnheader">Clicks</span>
            <span role="columnheader">CTOR</span>
            <span role="columnheader">Orders</span>
            <span role="columnheader">GMV</span>
            <span role="columnheader">Evidence</span>
          </div>
          <div className="divide-y divide-[#1F2530]">
            {rows.map((m) => {
              const r = m.row;
              const currency = r.gmv?.currency;
              const matched = m.match.kind === "matched" ? m.match.product : null;
              return (
                <div role="rowgroup" key={m.key} data-testid="product-row" data-match={m.match.kind}>
                  <div role="row" className={`grid grid-cols-1 gap-x-3 gap-y-1.5 px-2 py-3 ${GRID}`}>
                    <div role="cell" className="min-w-0">
                      <p className="text-[16px] font-medium leading-snug text-[#F5F7FC]">
                        {matched ? (
                          <>
                            <span className="mr-2 font-mono text-[14px] text-[#AEB7C5]">{matched.code}</span>
                            {matched.name}
                          </>
                        ) : (
                          (r.productLabel ?? "Unlabelled provider listing")
                        )}
                      </p>
                      <p className={`text-[14px] ${m.match.kind === "matched" ? "text-[#9AA5B5]" : "text-[#B4C6DD]"}`} data-testid="match-line">
                        {matchLine(m.match)}
                      </p>
                      {(r.productId || r.skuId) && (
                        <p className="font-mono text-[12px] text-[#8A95A5]">
                          {[r.productId ? `provider id ${r.productId}` : null, r.skuId ? `SKU ${r.skuId}` : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:contents">
                      <Metric label="Impressions">
                        <ValueText cell={cell(r.impressions, r.impressions == null ? "missing" : "available")} />
                      </Metric>
                      <Metric label="Clicks">
                        <ValueText cell={cell(r.clicks, r.clicks == null ? "missing" : "available")} />
                      </Metric>
                      <Metric label="CTOR">
                        <ValueText cell={ctorCell(r)} />
                      </Metric>
                      <Metric label="Orders">
                        <ValueText cell={cell(r.orders, r.orders == null ? "missing" : "available")} />
                      </Metric>
                      <Metric label="GMV">
                        <ValueText cell={cell(r.gmv, r.gmv == null ? "missing" : "available", { metric: "gmv", money: currency })} className="whitespace-nowrap" />
                        {r.gmv != null && !currency && <span className="block text-[12px] text-[#9AA5B5]">currency not stated</span>}
                      </Metric>
                      <Metric label="Evidence">
                        {r.availability === "available" ? <TierLabel origin={origin} compact /> : <ValueText cell={cell(null, r.availability)} />}
                      </Metric>
                    </div>
                  </div>
                  {(m.segmentTitles.length > 0 || m.siblingRows > 1 || r.limitations.length > 0 || m.match.kind === "ambiguous") && (
                    <div role="row">
                      <div role="cell" className="space-y-0.5 px-2 pb-3 text-[14px] text-[#B7C1CE]" data-testid="product-notes">
                        {m.segmentTitles.length > 1 && (
                          <p data-testid="session-level-note">
                            <i className="ri-stack-line mr-1.5 text-[#B4C6DD]" aria-hidden="true" />
                            Session-level figure: this product ran in {m.segmentTitles.length} segments ({m.segmentTitles.map((t) => `“${t}”`).join(", ")}). The provider reports it once for the whole LIVE, so it is not split by segment.
                          </p>
                        )}
                        {m.segmentTitles.length === 1 && <p>Ran in “{m.segmentTitles[0]}”. The provider reports it for the whole LIVE.</p>}
                        {m.siblingRows > 1 && (
                          <p data-testid="sibling-note">
                            <i className="ri-file-copy-line mr-1.5 text-[#B4C6DD]" aria-hidden="true" />
                            {m.siblingRows} provider rows map to this product. They are shown separately and never merged.
                          </p>
                        )}
                        {r.limitations.map((l) => (
                          <p key={l}>{l}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
