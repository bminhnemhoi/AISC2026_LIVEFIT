// One small observable store. The world (time, actions, platform conditions) is the only
// thing the engine reads; everything else here is presentation state.

import { useEffect, useState } from "preact/hooks";
import { PRODUCTS, SESSION_LENGTH, SAMPLE_CSV, type Intent, type ProductId } from "./data";
import { activeOutage, pinAt, type Action, type ActionKind, type ActionSource, type Outage, type World } from "./engine";

export type Screen = "setup" | "desk" | "recap";
export type RowStatus = "queued" | "syncing" | "synced";

export interface State {
  screen: Screen;
  theme: "light" | "dark";
  presenter: boolean;
  journey: boolean;
  /** stage highlighted in the data journey, 0 = none */
  journeyStage: number;
  help: boolean;
  drawer: boolean;
  confirmEnd: boolean;
  lockNote: boolean;
  mode: "observe" | "suggest";
  // setup
  connect: "idle" | "connecting" | "done";
  csv: string;
  importing: boolean;
  rows: { id: ProductId; status: RowStatus }[];
  // live
  started: boolean;
  ended: boolean;
  deskLoading: boolean;
  t: number;
  playing: boolean;
  speed: 15 | 60;
  actions: Action[];
  outages: Outage[];
  sending: ProductId | null;
  filter: Intent | null;
  saving: boolean;
  // story
  beat: number;
  autoplay: boolean;
  instant: boolean;
}

export const initialState = (): State => ({
  screen: "setup",
  theme: "light",
  presenter: false,
  journey: false,
  journeyStage: 0,
  help: false,
  drawer: false,
  confirmEnd: false,
  lockNote: false,
  mode: "suggest",
  connect: "idle",
  csv: "",
  importing: false,
  rows: [],
  started: false,
  ended: false,
  deskLoading: false,
  t: 0,
  playing: false,
  speed: 15,
  actions: [],
  outages: [],
  sending: null,
  filter: null,
  saving: false,
  beat: 0,
  autoplay: false,
  instant: false,
});

let state: State = initialState();
const listeners = new Set<() => void>();

export const getState = () => state;

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(select: (s: State) => T): T {
  const [, force] = useState(0);
  const value = select(state);
  useEffect(() => {
    let last = select(state);
    return subscribe(() => {
      const next = select(state);
      if (!Object.is(next, last)) {
        last = next;
        force((n) => n + 1);
      }
    });
  }, []);
  return value;
}

export const worldOf = (s: State): World => ({ t: s.t, actions: s.actions, outages: s.outages });

// ---------- timers (all cancelled on reset so a replay is deterministic) ----------

const timers = new Set<number>();
const cosmetic = new Set<number>();
/** Run f after ms. During an instant replay it runs at once. Cosmetic timers do not count as busy. */
export function later(ms: number, f: () => void, isCosmetic = false) {
  if (getState().instant) {
    f();
    return;
  }
  const set = isCosmetic ? cosmetic : timers;
  const id = window.setTimeout(() => {
    set.delete(id);
    f();
  }, ms);
  set.add(id);
}
/** True while a story step is still playing out (timers or a clock fast-forward). */
export const isBusy = () => timers.size > 0 || fast !== null;
export function clearTimers() {
  timers.forEach((id) => window.clearTimeout(id));
  cosmetic.forEach((id) => window.clearTimeout(id));
  timers.clear();
  cosmetic.clear();
}

function markSaved() {
  if (getState().instant) return;
  setState({ saving: true });
  later(700, () => setState({ saving: false }), true);
}

// ---------- setup ----------

export function connect() {
  if (getState().connect !== "idle") return;
  setState({ connect: "connecting" });
  later(900, () => {
    setState({ connect: "done" });
    markSaved();
  });
}

export function useSampleCsv() {
  setState({ csv: SAMPLE_CSV });
}

export function importProducts() {
  const s = getState();
  if (!s.csv.trim() || s.importing || s.rows.length) return;
  setState({ importing: true });
  later(650, () => {
    setState({ importing: false, rows: PRODUCTS.map((p) => ({ id: p.id, status: "queued" as RowStatus })) });
    PRODUCTS.forEach((p, i) => {
      later(420 + i * 380, () => setRow(p.id, "syncing"));
      later(720 + i * 380, () => setRow(p.id, "synced"));
    });
    later(720 + PRODUCTS.length * 380, markSaved);
  });
}

function setRow(id: ProductId, status: RowStatus) {
  setState((s) => ({ rows: s.rows.map((r) => (r.id === id ? { ...r, status } : r)) }));
}

export const setupReady = (s: State) => s.connect === "done" && s.rows.length > 0 && s.rows.every((r) => r.status === "synced");

export function startLive() {
  const s = getState();
  if (!setupReady(s) || s.started) return;
  setState({ started: true, screen: "desk", t: 0, deskLoading: true });
  later(700, () => setState({ deskLoading: false }));
  markSaved();
}

// ---------- live actions ----------

function record(kind: ActionKind, product: ProductId, source: ActionSource) {
  const s = getState();
  const evidence = activeOutage(worldOf(s)) ? "operator" : "platform";
  setState({ actions: [...s.actions, { t: s.t, kind, product, source, evidence }] });
  markSaved();
}

export function pin(product: ProductId, source: ActionSource) {
  const s = getState();
  if (!s.started || s.ended || s.sending) return;
  if (pinAt(s.actions, s.t)?.product === product) return;
  const manual = !!activeOutage(worldOf(s));
  if (manual) {
    record("pin", product, source);
    return;
  }
  // The request goes to the SIMULATED platform first; the row says "ĐANG GHIM" only once it shows.
  setState({ sending: product });
  later(450, () => {
    setState({ sending: null });
    record("pin", product, source);
  });
}

export function unpin(product: ProductId) {
  const s = getState();
  if (!s.started || s.ended || s.sending) return;
  record("unpin", product, "list");
}

export function dismissPin(product: ProductId) {
  record("dismiss-pin", product, "suggestion");
}

export function runFlash(product: ProductId) {
  record("flash-run", product, "suggestion");
}

export function dismissFlash(product: ProductId) {
  record("flash-dismiss", product, "suggestion");
}

export function platformCondition() {
  const s = getState();
  if (!s.started || s.ended || activeOutage(worldOf(s))) return;
  setState({ outages: [...s.outages, { from: s.t, to: null }] });
}

export function reconnect() {
  const s = getState();
  setState({ outages: s.outages.map((o) => (o.to === null ? { ...o, to: s.t } : o)) });
  markSaved();
}

export function endLive() {
  const s = getState();
  if (!s.started) return;
  setState({
    ended: true,
    playing: false,
    confirmEnd: false,
    screen: "recap",
    outages: s.outages.map((o) => (o.to === null ? { ...o, to: s.t } : o)),
  });
  markSaved();
}

// ---------- clock ----------

let fast: { from: number; to: number; start: number; ms: number } | null = null;
let raf = 0;
let lastFrame = 0;
let carry = 0;

export function clockTo(target: number, ms = 1600) {
  const s = getState();
  const to = Math.min(SESSION_LENGTH, Math.max(s.t, target));
  if (s.instant || ms === 0) {
    fast = null;
    setState({ t: to });
    return;
  }
  fast = { from: s.t, to, start: performance.now(), ms };
  loop();
}

export function skipMinute() {
  const s = getState();
  if (!s.started || s.ended) return;
  clockTo(s.t + 60, 500);
}

export function setPlaying(playing: boolean) {
  const s = getState();
  if (!s.started || s.ended) return;
  setState({ playing });
  lastFrame = performance.now();
  carry = 0;
  loop();
}

function loop() {
  if (raf) return;
  raf = requestAnimationFrame(frame);
}

function frame(now: number) {
  raf = 0;
  const s = getState();
  if (fast) {
    const k = Math.min(1, (now - fast.start) / fast.ms);
    const eased = 1 - Math.pow(1 - k, 2);
    const t = Math.round(fast.from + (fast.to - fast.from) * eased);
    if (t !== s.t) setState({ t });
    if (k >= 1) fast = null;
    loop();
    return;
  }
  if (s.playing && s.started && !s.ended) {
    carry += ((now - lastFrame) / 1000) * s.speed;
    lastFrame = now;
    const whole = Math.floor(carry);
    if (whole > 0) {
      carry -= whole;
      const t = Math.min(SESSION_LENGTH, s.t + whole);
      setState({ t, playing: t < SESSION_LENGTH });
    }
    loop();
  }
}

export function stopClock() {
  fast = null;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}
