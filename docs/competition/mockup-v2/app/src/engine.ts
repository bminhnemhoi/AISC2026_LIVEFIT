// The assistant's rules, as pure functions of (time, operator actions, platform conditions).
// No randomness, no hidden state: the same inputs always give the same suggestion.
// Confidence comes from sample size only. The assistant reports signals, never causes.

import {
  CART,
  COMMENTS,
  PRODUCTS,
  SESSION_LENGTH,
  WINDOW,
  viewersAt,
  type Comment,
  type Intent,
  type Product,
  type ProductId,
} from "./data";

export type ActionKind = "pin" | "unpin" | "dismiss-pin" | "flash-run" | "flash-dismiss";
export type ActionSource = "suggestion" | "list";

export interface Action {
  t: number;
  kind: ActionKind;
  product: ProductId;
  source: ActionSource;
  /** "platform": SIMULATED platform showed it. "operator": the operator reported it by hand. */
  evidence: "platform" | "operator";
}

export interface Outage {
  from: number;
  to: number | null;
}

export interface World {
  t: number;
  actions: Action[];
  outages: Outage[];
}

export type Confidence = "low" | "medium" | "high";

export const MIN_MENTIONS = 4;
export const SWITCH_MARGIN = 4;
export const FLASH_MIN_CART = 10;
export const FLASH_MIN_STOCK = 10;
export const FLASH_LENGTH = 60;
export const DISMISS_COOLDOWN = 180;
/** seconds a suggestion must have been visible before an action counts as following it */
export const MIN_SEEN = 5;

export function confidenceOf(n: number): Confidence {
  if (n >= 20) return "high";
  if (n >= 8) return "medium";
  return "low";
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = { low: "thấp", medium: "trung bình", high: "cao" };
export const CONFIDENCE_RULE = "Thấp: dưới 8 bình luận. Trung bình: 8 đến 19. Cao: từ 20.";

export const productById = (id: ProductId): Product => PRODUCTS.find((p) => p.id === id) as Product;

export function inOutage(outages: Outage[], t: number): boolean {
  return outages.some((o) => t > o.from && (o.to === null || t <= o.to));
}

export function activeOutage(w: World): Outage | null {
  return w.outages.find((o) => o.from <= w.t && (o.to === null || o.to > w.t)) ?? null;
}

/** Only data LiveLift actually received: nothing during a platform condition. */
export function visibleComments(w: World): Comment[] {
  return COMMENTS.filter((c) => c.t <= w.t && !inOutage(w.outages, c.t));
}

export function cartBetween(w: World, from: number, to: number, product?: ProductId): number {
  let n = 0;
  for (const c of CART) {
    if (c.t > from && c.t <= to && c.t <= w.t && !inOutage(w.outages, c.t) && (!product || c.product === product)) n++;
  }
  return n;
}

export function viewersNow(w: World): number | null {
  if (activeOutage(w)) return null;
  return viewersAt(w.t);
}

export interface PinState {
  product: ProductId;
  since: number;
  source: ActionSource;
  evidence: "platform" | "operator";
}

export function pinAt(actions: Action[], t: number): PinState | null {
  let pin: PinState | null = null;
  for (const a of actions) {
    if (a.t > t) break;
    if (a.kind === "pin") pin = { product: a.product, since: a.t, source: a.source, evidence: a.evidence };
    if (a.kind === "unpin" && pin?.product === a.product) pin = null;
  }
  return pin;
}

export interface Signals {
  product: ProductId;
  mentions: number;
  byIntent: Record<Intent, number>;
  cartNow: number;
  cartBefore: number;
}

export function signalsAt(w: World, at = w.t): Signals[] {
  const from = at - WINDOW;
  const recent = COMMENTS.filter((c) => c.t > from && c.t <= at && c.t <= w.t && !inOutage(w.outages, c.t));
  return PRODUCTS.map((p) => {
    const mine = recent.filter((c) => c.product === p.id);
    const byIntent: Record<Intent, number> = { price: 0, size: 0, order: 0, other: 0 };
    for (const c of mine) byIntent[c.intent]++;
    return {
      product: p.id,
      mentions: mine.length,
      byIntent,
      cartNow: cartBetween(w, from, at, p.id),
      cartBefore: cartBetween(w, from - WINDOW, from, p.id),
    };
  });
}

export function intentCounts(w: World): Record<Intent, number> {
  const out: Record<Intent, number> = { price: 0, size: 0, order: 0, other: 0 };
  for (const c of COMMENTS) {
    if (c.t > w.t - WINDOW && c.t <= w.t && !inOutage(w.outages, c.t)) out[c.intent]++;
  }
  return out;
}

export type Suggestion =
  | { kind: "waiting"; best: number }
  | { kind: "paused" }
  | { kind: "pin"; product: ProductId; signals: Signals; confidence: Confidence; since: number }
  | { kind: "keep"; product: ProductId; signals: Signals; confidence: Confidence };

function lastDismiss(actions: Action[], product: ProductId, t: number): number | null {
  let at: number | null = null;
  for (const a of actions) if (a.t <= t && a.kind === "dismiss-pin" && a.product === product) at = a.t;
  return at;
}

function rawSuggestion(w: World, t: number): Suggestion {
  if (activeOutage({ ...w, t })) return { kind: "paused" };
  const sig = signalsAt(w, t);
  const pin = pinAt(w.actions, t);
  const pinned = pin ? sig.find((s) => s.product === pin.product) ?? null : null;
  const ranked = sig
    .filter((s) => s.product !== pin?.product && s.mentions >= MIN_MENTIONS)
    .filter((s) => {
      const d = lastDismiss(w.actions, s.product, t);
      return d === null || t - d >= DISMISS_COOLDOWN;
    })
    .sort((a, b) => b.mentions - a.mentions || b.cartNow - a.cartNow);
  const top = ranked[0];
  if (top && (!pinned || top.mentions >= pinned.mentions + SWITCH_MARGIN)) {
    return { kind: "pin", product: top.product, signals: top, confidence: confidenceOf(top.mentions), since: t };
  }
  if (pinned && pin) return { kind: "keep", product: pin.product, signals: pinned, confidence: confidenceOf(pinned.mentions) };
  return { kind: "waiting", best: Math.max(0, ...sig.map((s) => s.mentions)) };
}

// Memo: the rules are pure, so cache by (actions, outages, time).
const memo = new Map<string, unknown>();
function worldKey(w: World): string {
  return JSON.stringify([w.actions, w.outages]);
}
function cached<T>(w: World, kind: string, t: number, f: () => T): T {
  const key = `${kind}|${t}|${worldKey(w)}`;
  if (memo.has(key)) return memo.get(key) as T;
  if (memo.size > 20000) memo.clear();
  const v = f();
  memo.set(key, v);
  return v;
}
function memoRaw(w: World, t: number): Suggestion {
  return cached(w, "s", t, () => rawSuggestion({ ...w, t }, t));
}
function memoFlash(w: World, t: number): Flash {
  return cached(w, "f", t, () => rawFlash({ ...w, t }, t));
}

/** The suggestion on screen at time t, with the moment it first appeared. */
export function suggestionAt(w: World, t = w.t): Suggestion {
  const s = memoRaw(w, t);
  if (s.kind !== "pin") return s;
  let since = t;
  for (let u = Math.floor((t - 1) / 5) * 5; u >= Math.max(0, t - 600); u -= 5) {
    const prev = memoRaw(w, u);
    if (prev.kind === "pin" && prev.product === s.product) since = u;
    else break;
  }
  return { ...s, since };
}

export type Flash =
  | { kind: "no-pin" }
  | { kind: "paused" }
  | { kind: "insufficient"; product: ProductId; cartNow: number; reason: "cart" | "falling" | "stock" | "young" }
  | { kind: "ready"; product: ProductId; cartNow: number; cartBefore: number; stock: number; pinnedFor: number; orders: number; since: number }
  | { kind: "running"; product: ProductId; endsAt: number }
  | { kind: "dismissed"; product: ProductId };

function rawFlash(w: World, t: number): Flash {
  if (activeOutage({ ...w, t })) return { kind: "paused" };
  const pin = pinAt(w.actions, t);
  if (!pin) return { kind: "no-pin" };
  const forThisPin = w.actions.filter((a) => a.t <= t && a.t >= pin.since && a.product === pin.product);
  const run = forThisPin.find((a) => a.kind === "flash-run");
  if (run && t < run.t + FLASH_LENGTH) return { kind: "running", product: pin.product, endsAt: run.t + FLASH_LENGTH };
  if (forThisPin.some((a) => a.kind === "flash-dismiss")) return { kind: "dismissed", product: pin.product };
  if (run) return { kind: "dismissed", product: pin.product };
  const s = signalsAt(w, t).find((x) => x.product === pin.product) as Signals;
  const stock = productById(pin.product).stock;
  if (t - pin.since < 60) return { kind: "insufficient", product: pin.product, cartNow: s.cartNow, reason: "young" };
  if (stock === null || stock < FLASH_MIN_STOCK) return { kind: "insufficient", product: pin.product, cartNow: s.cartNow, reason: "stock" };
  if (s.cartNow < FLASH_MIN_CART) return { kind: "insufficient", product: pin.product, cartNow: s.cartNow, reason: "cart" };
  if (s.cartNow <= s.cartBefore) return { kind: "insufficient", product: pin.product, cartNow: s.cartNow, reason: "falling" };
  return {
    kind: "ready",
    product: pin.product,
    cartNow: s.cartNow,
    cartBefore: s.cartBefore,
    stock,
    pinnedFor: t - pin.since,
    orders: s.byIntent.order,
    since: t,
  };
}

export function flashAt(w: World, t = w.t): Flash {
  const f = memoFlash(w, t);
  if (f.kind !== "ready") return f;
  let since = t;
  for (let u = Math.floor((t - 1) / 5) * 5; u >= Math.max(0, t - 600); u -= 5) {
    if (memoFlash(w, u).kind === "ready") since = u;
    else break;
  }
  return { ...f, since };
}

// ---------- series for charts ----------

export interface Point {
  t: number;
  v: number | null;
}

export function viewerSeries(w: World, end = w.t, step = 10): Point[] {
  const out: Point[] = [];
  for (let t = 0; t <= end; t += step) out.push({ t, v: inOutage(w.outages, t) ? null : viewersAt(t) });
  if (out.length && out[out.length - 1].t !== end) out.push({ t: end, v: inOutage(w.outages, end) ? null : viewersAt(end) });
  return out;
}

/** Add-to-cart per minute. A minute fully inside a platform condition is null, not 0. */
export function cartPerMinute(w: World, end = w.t): Point[] {
  const out: Point[] = [];
  for (let m = 0; m * 60 < end; m++) {
    const from = m * 60;
    const to = Math.min(end, from + 60);
    const blind = w.outages.some((o) => o.from <= from && (o.to === null || o.to >= to));
    out.push({ t: from, v: blind ? null : cartBetween(w, from, to) });
  }
  return out;
}

export interface PinBand {
  product: ProductId;
  from: number;
  to: number;
  evidence: "platform" | "operator";
}

export function pinBands(w: World, end = w.t): PinBand[] {
  const out: PinBand[] = [];
  let cur: PinBand | null = null;
  for (const a of w.actions) {
    if (a.t > end) break;
    if (a.kind === "pin") {
      if (cur) out.push({ ...cur, to: a.t });
      cur = { product: a.product, from: a.t, to: end, evidence: a.evidence };
    }
    if (a.kind === "unpin" && cur?.product === a.product) {
      out.push({ ...cur, to: a.t });
      cur = null;
    }
  }
  if (cur) out.push({ ...cur, to: end });
  return out;
}

// ---------- recap ----------

export type Outcome = "accepted" | "dismissed" | "self" | "expired" | "open";

export interface LogRow {
  t: number;
  what: string;
  why: string | null;
  outcome: Outcome;
  outcomeAt: number | null;
}

/** "What the assistant suggested and what you did", replayed from the action log. */
export function decisionLog(w: World, end = w.t): LogRow[] {
  const rows: LogRow[] = [];
  const handled = new Set<Action>();
  const STEP = 5;
  const ticks: number[] = [];
  for (let t = 0; t <= end; t += STEP) ticks.push(t);
  const pins = ticks.map((t) => memoRaw(w, t));
  const flashes = ticks.map((t) => memoFlash(w, t));

  // Runs of the same pin suggestion; runs of one product less than a minute apart are one row.
  const runs: { product: ProductId; from: number; to: number; i: number; j: number }[] = [];
  for (let i = 0; i < ticks.length; i++) {
    const s = pins[i];
    if (s.kind !== "pin") continue;
    const prev = pins[i - 1];
    if (prev && prev.kind === "pin" && prev.product === s.product) continue;
    let j = i;
    while (j + 1 < ticks.length && pins[j + 1].kind === "pin" && (pins[j + 1] as { product: ProductId }).product === s.product) j++;
    const last = runs[runs.length - 1];
    if (last && last.product === s.product && ticks[i] - last.to <= 60) {
      last.to = ticks[j];
      last.j = j;
    } else runs.push({ product: s.product, from: ticks[i], to: ticks[j], i, j });
  }
  for (const run of runs) {
    // An answer counts only if the suggestion had been on screen for at least MIN_SEEN seconds.
    const reply = w.actions.find(
      (a) =>
        a.t >= run.from + MIN_SEEN &&
        a.t <= run.to + STEP &&
        !handled.has(a) &&
        a.product === run.product &&
        (a.kind === "pin" || a.kind === "dismiss-pin"),
    );
    if (run.to - run.from < MIN_SEEN && !reply) continue;
    if (reply) handled.add(reply);
    // Show the reasons as they stood when the operator answered (or when the suggestion ended).
    const seen = reply ? rawSuggestion({ ...w, t: reply.t, actions: w.actions.filter((a) => a !== reply) }, reply.t) : pins[run.j];
    const shown = seen.kind === "pin" ? seen : pins[run.j];
    const sig = (shown as Extract<Suggestion, { kind: "pin" }>).signals;
    const conf = (shown as Extract<Suggestion, { kind: "pin" }>).confidence;
    rows.push({
      t: run.from,
      what: `Ghim ${productById(run.product).name}`,
      why: `${sig.mentions} bình luận về sản phẩm, độ tin cậy ${CONFIDENCE_LABEL[conf]}`,
      outcome: reply ? (reply.kind === "pin" ? "accepted" : "dismissed") : run.j === ticks.length - 1 ? "open" : "expired",
      outcomeAt: reply ? reply.t : null,
    });
  }
  for (let i = 0; i < ticks.length; i++) {
    const f = flashes[i];
    if (f.kind !== "ready") continue;
    const prev = flashes[i - 1];
    if (prev && prev.kind === "ready") continue;
    const t = ticks[i];
    const reply = w.actions.find((a) => a.t >= t - STEP && (a.kind === "flash-run" || a.kind === "flash-dismiss") && a.product === f.product);
    if (reply) handled.add(reply);
    const seen = reply ? rawFlash({ ...w, t: reply.t, actions: w.actions.filter((a) => a !== reply) }, reply.t) : f;
    const g = seen.kind === "ready" ? seen : f;
    rows.push({
      t,
      what: `Flash sale 1 phút cho ${productById(f.product).name}`,
      why: `${g.cartNow} lượt thêm giỏ trong 2 phút, trước đó ${g.cartBefore}`,
      outcome: reply ? (reply.kind === "flash-run" ? "accepted" : "dismissed") : "open",
      outcomeAt: reply ? reply.t : null,
    });
  }
  for (const a of w.actions) {
    if (a.t > end || handled.has(a)) continue;
    if (a.kind === "pin" || a.kind === "unpin") {
      rows.push({
        t: a.t,
        what: `${a.kind === "pin" ? "Ghim" : "Bỏ ghim"} ${productById(a.product).name}`,
        why: null,
        outcome: "self",
        outcomeAt: a.t,
      });
    }
  }
  return rows.sort((a, b) => a.t - b.t || (a.outcome === "self" ? 1 : -1));
}

export interface Recap {
  end: number;
  peakViewers: number;
  comments: number;
  masked: number;
  cart: number;
  pins: number;
  byIntent: Record<Intent, number>;
  blindSeconds: number;
  log: LogRow[];
  bands: PinBand[];
}

export function recapOf(w: World, end = Math.min(w.t, SESSION_LENGTH)): Recap {
  const ww = { ...w, t: end };
  const cs = visibleComments(ww);
  const byIntent: Record<Intent, number> = { price: 0, size: 0, order: 0, other: 0 };
  for (const c of cs) byIntent[c.intent]++;
  let peak = 0;
  for (let t = 0; t <= end; t += 10) if (!inOutage(w.outages, t)) peak = Math.max(peak, viewersAt(t));
  const blindSeconds = w.outages.reduce((sum, o) => sum + Math.max(0, Math.min(o.to ?? end, end) - o.from), 0);
  return {
    end,
    peakViewers: peak,
    comments: cs.length,
    masked: cs.filter((c) => c.masked).length,
    cart: cartBetween(ww, 0, end),
    pins: w.actions.filter((a) => a.kind === "pin" && a.t <= end).length,
    byIntent,
    blindSeconds,
    log: decisionLog(ww, end),
    bands: pinBands(ww, end),
  };
}
