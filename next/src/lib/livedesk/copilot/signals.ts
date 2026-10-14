import type { CommentIntent } from "../types";

/**
 * Copilot signals: per product, what the recent window of SIMULATED events contains. Counts only, nothing inferred.
 * A comment counts for the product it reads as being about (`attributeComment`: named, else the one showing).
 */

/** The window the Copilot reads, in seconds. Momentum compares it with the window before it. */
export const SIGNAL_WINDOW_SEC = 120;

export interface SignalComment {
  atSec: number;
  intent: CommentIntent;
  aboutProductId: string | null;
}

export interface SignalCart {
  atSec: number;
  productId: string;
}

export interface SignalProduct {
  id: string;
  name: string;
  stock: number | null;
  /** Second of the live this product was last showing, null when it has not been shown. */
  lastShownAtSec: number | null;
}

export interface SignalInput {
  nowSec: number;
  products: readonly SignalProduct[];
  showingProductId: string | null;
  comments: readonly SignalComment[];
  addToCart: readonly SignalCart[];
}

export interface ProductSignals {
  productId: string;
  name: string;
  askPrice: number;
  askSize: number;
  readyToBuy: number;
  /** Add-to-carts in the last window. */
  addToCart: number;
  /** Add-to-carts in the window before it. */
  addToCartBefore: number;
  stock: number | null;
  /** Seconds since it was last showing; null when it has never been shown. 0 while it is showing. */
  sinceShownSec: number | null;
  showing: boolean;
}

export function aggregateSignals(input: SignalInput): ProductSignals[] {
  const from = input.nowSec - SIGNAL_WINDOW_SEC;
  const before = from - SIGNAL_WINDOW_SEC;
  const recent = input.comments.filter((c) => c.atSec > from && c.atSec <= input.nowSec);
  return input.products.map((p) => {
    const mine = recent.filter((c) => c.aboutProductId === p.id);
    const count = (intent: CommentIntent): number => mine.filter((c) => c.intent === intent).length;
    const carts = input.addToCart.filter((a) => a.productId === p.id);
    const showing = input.showingProductId === p.id;
    return {
      productId: p.id,
      name: p.name,
      askPrice: count("ask_price"),
      askSize: count("ask_size"),
      readyToBuy: count("ready_to_buy"),
      addToCart: carts.filter((a) => a.atSec > from && a.atSec <= input.nowSec).length,
      addToCartBefore: carts.filter((a) => a.atSec > before && a.atSec <= from).length,
      stock: p.stock,
      sinceShownSec: showing ? 0 : p.lastShownAtSec === null ? null : input.nowSec - p.lastShownAtSec,
      showing,
    };
  });
}
