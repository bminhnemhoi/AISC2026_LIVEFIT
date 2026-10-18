import type { ProductSnapshot } from "@/contracts";
import type { Review } from "@/lib/domain";
import type { ProductMapping } from "@/contracts/liveIntelligence";
import type { ProductPerformance } from "./types";

/** Provider product rows resolve only through the canonical explicit identity mapping. */
export type MatchBasis = "server";

export type ProductMatch =
  | { kind: "matched"; product: ProductSnapshot; basis: MatchBasis }
  | { kind: "ambiguous"; candidates: ProductSnapshot[]; basis: MatchBasis }
  | { kind: "unmatched" };

/** Only the server's explicit stable identity mapping can associate provider performance with a local product. */
export function matchProduct(row: ProductPerformance, products: ProductSnapshot[], mappings: ProductMapping[] = []): ProductMatch {
  const ids = mappings.filter(m => m.providerProductId === row.productId).map(m => m.liveLiftProductId);
  const found = products.filter(p => ids.includes(p.id));
  return found.length === 1 ? { kind: "matched", product: found[0], basis: "server" } : found.length > 1 ? { kind: "ambiguous", candidates: found, basis: "server" } : { kind: "unmatched" };
}

export interface ProductRowModel {
  /** Stable React key: provider ids when there are any, otherwise the row's position. */
  key: string;
  row: ProductPerformance;
  match: ProductMatch;
  /** Titles of the segments that ran this product. More than one => the provider's figure is for the whole LIVE. */
  segmentTitles: string[];
  /** How many provider rows resolve to the same LiveLift product (2+ => shown separately, never merged). */
  siblingRows: number;
}

export function buildProductRows(rows: ProductPerformance[], products: ProductSnapshot[], review: Review, mappings: ProductMapping[] = []): ProductRowModel[] {
  const matches = rows.map((r) => matchProduct(r, products, mappings));
  const perProduct = new Map<string, number>();
  for (const m of matches) if (m.kind === "matched") perProduct.set(m.product.id, (perProduct.get(m.product.id) ?? 0) + 1);
  return rows.map((row, i) => {
    const match = matches[i];
    const segmentTitles =
      match.kind === "matched" ? review.rows.filter((r) => r.productId === match.product.id && (r.actual !== null || r.outcome === "incomplete")).map((r) => r.title) : [];
    return {
      key: [row.productId ?? "", row.skuId ?? "", i].join("|"),
      row,
      match,
      segmentTitles,
      siblingRows: match.kind === "matched" ? (perProduct.get(match.product.id) ?? 1) : 1,
    };
  });
}

export const MATCH_BASIS_WORDS: Record<MatchBasis, string> = { server: "mapped by the server" };
