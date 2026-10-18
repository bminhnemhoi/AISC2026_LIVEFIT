import type { CopilotSuggestion, SuggestionKind } from "../types";
import type { ProductSignals } from "./signals";

/**
 * The rules scorer: deterministic, readable, and the fallback whenever no model is configured or a model fails.
 *
 * show_next  Among products that are not showing, the one with the most buying interest in the last two minutes:
 *            ready-to-buy comments count twice, ask-price, ask-size comments and add-to-carts once each. It needs at
 *            least MIN_SAMPLE events. Ties go to the product listed first.
 * flash_sale For the product showing: add-to-carts in the last two minutes are at least MIN_RISING and more than in
 *            the two minutes before (momentum rising), and stock was entered and is at least HEALTHY_STOCK. Unknown
 *            stock is not healthy stock.
 *
 * Confidence comes from the sample size alone (how many events the suggestion rests on), never from a model and never
 * as a probability. Wording says "signals suggest"; it never claims a cause or a result.
 */

export const MIN_SAMPLE = 3;
export const MIN_RISING = 4;
export const HEALTHY_STOCK = 10;

/** Below 10 events low, below 25 medium, else high. */
export function confidenceFor(sampleSize: number): CopilotSuggestion["confidence"] {
  return sampleSize < 10 ? "low" : sampleSize < 25 ? "medium" : "high";
}

/** A suggestion before it has an id, a state or a time. */
export interface CopilotCandidate {
  kind: SuggestionKind;
  productId: string;
  headline: string;
  signals: CopilotSuggestion["signals"];
  sampleSize: number;
  confidence: CopilotSuggestion["confidence"];
}

const comments = (n: number): string => `${n} comment${n === 1 ? "" : "s"}`;
const stockWords = (stock: number | null): string => (stock === null ? "Not entered" : String(stock));
const clock = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function showNext(all: readonly ProductSignals[]): CopilotCandidate | null {
  let best: { s: ProductSignals; score: number; sample: number } | null = null;
  for (const s of all) {
    if (s.showing) continue;
    const sample = s.readyToBuy + s.askPrice + s.askSize + s.addToCart;
    const score = 2 * s.readyToBuy + s.askPrice + s.askSize + s.addToCart;
    if (sample < MIN_SAMPLE) continue;
    if (!best || score > best.score) best = { s, score, sample };
  }
  if (!best) return null;
  const { s, sample } = best;
  return {
    kind: "show_next",
    productId: s.productId,
    headline: `Signals suggest showing ${s.name} next`,
    signals: [
      { label: "Ready to buy, last 2 min", value: comments(s.readyToBuy) },
      { label: "Ask price, last 2 min", value: comments(s.askPrice) },
      { label: "Ask size, last 2 min", value: comments(s.askSize) },
      { label: "Add to cart, last 2 min", value: String(s.addToCart) },
      { label: "Stock", value: stockWords(s.stock) },
      { label: "Last shown", value: s.sinceShownSec === null ? "Not shown yet" : `${clock(s.sinceShownSec)} ago` },
    ],
    sampleSize: sample,
    confidence: confidenceFor(sample),
  };
}

function flashSale(all: readonly ProductSignals[]): CopilotCandidate | null {
  const s = all.find((x) => x.showing);
  if (!s || s.addToCart < MIN_RISING || s.addToCart <= s.addToCartBefore || s.stock === null || s.stock < HEALTHY_STOCK) return null;
  const sample = s.addToCart + s.addToCartBefore;
  return {
    kind: "flash_sale",
    productId: s.productId,
    headline: `Signals suggest a flash sale on ${s.name} in the next minute`,
    signals: [
      { label: "Add to cart, last 2 min", value: String(s.addToCart) },
      { label: "Add to cart, 2 min before", value: String(s.addToCartBefore) },
      { label: "Stock", value: stockWords(s.stock) },
    ],
    sampleSize: sample,
    confidence: confidenceFor(sample),
  };
}

/** Rule candidates, show_next first. At most one of each kind. */
export function scoreRules(signals: readonly ProductSignals[]): CopilotCandidate[] {
  return [showNext(signals), flashSale(signals)].filter((c): c is CopilotCandidate => c !== null);
}
