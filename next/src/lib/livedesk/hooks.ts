import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  VIEWER_SAMPLE_SEC, acceptSuggestionAction, advance, buildDeskView, buildStartView, connect, dismissSuggestionAction, endLive, importSamplePack,
  importText, pin, removeProduct, reset, setPlatformFault, setRunning, setSpeed, skip, startLive, unpin, type DeskState,
} from "./session";
import { getDeskState, getServerDeskState, setDeskState, subscribeDesk, updateDesk } from "./store";
import type {
  DeskMode, DeskPinBand, DeskPlatformFault, DeskTimelineMark, LiveDeskActions, LiveDeskViewModel, RecapRow, RecapViewModel, StartActions,
  StartViewModel,
} from "./types";

/**
 * The only door the screens use. Both hooks share one SIMULATED desk state (see store.ts) and hand the screens view
 * models built by session.ts; every action goes back through session.ts. The signatures are the contract.
 */

/** How often the running clock wakes, in real milliseconds, and the most virtual seconds one wake may play. */
const TICK_MS = 250;
const MAX_SECONDS_PER_TICK = 300;

const useDeskState = (): DeskState => useSyncExternalStore(subscribeDesk, getDeskState, getServerDeskState);

export function useStartFlow(): { view: StartViewModel; actions: StartActions } {
  const state = useDeskState();
  const view = useMemo(() => buildStartView(state), [state]);
  const actions = useMemo<StartActions>(() => ({
    onConnect: () => updateDesk(connect),
    onImportText: (text) => updateDesk((s) => importText(s, text)),
    onImportSamplePack: () => updateDesk(importSamplePack),
    onRemoveProduct: (productId) => updateDesk((s) => removeProduct(s, productId)),
    onStartLive: () => {
      const r = startLive(getDeskState());
      setDeskState(r.state);
      return r.liveId;
    },
  }), []);
  return { view, actions };
}

/** `null` view means the live id is unknown; the screen shows the usual not-found state. */
export function useLiveDesk(liveId: string): { view: LiveDeskViewModel | null; actions: LiveDeskActions } {
  const state = useDeskState();
  const view = useMemo(() => (liveId ? buildDeskView(state, liveId) : null), [state, liveId]);
  const mine = state.live !== null && state.live.id === liveId;
  const running = mine && state.live?.mode === "live" && state.live.running;
  const speed = mine ? state.live?.speed ?? 1 : 1;

  // The clock plays whole virtual seconds; how they are batched never changes what happens.
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let carry = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      carry += (now - last) * speed;
      last = now;
      const seconds = Math.min(MAX_SECONDS_PER_TICK, Math.floor(carry / 1000));
      if (seconds <= 0) return;
      carry = Math.min(carry - seconds * 1000, 1000);
      updateDesk((s) => (s.live?.id === liveId ? advance(s, seconds) : s));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, speed, liveId]);

  const actions = useMemo<LiveDeskActions>(() => {
    const onThis = (change: (s: DeskState) => DeskState): void => updateDesk((s) => (s.live?.id === liveId ? change(s) : s));
    return {
      onRun: () => onThis((s) => setRunning(s, true)),
      onPause: () => onThis((s) => setRunning(s, false)),
      onSpeed: (speed) => onThis((s) => setSpeed(s, speed)),
      onSkip: (seconds) => onThis((s) => skip(s, seconds)),
      onReset: () => onThis(reset),
      onPin: (productId) => onThis((s) => pin(s, productId)),
      onUnpin: () => onThis(unpin),
      onAcceptSuggestion: (id) => onThis((s) => acceptSuggestionAction(s, id)),
      onDismissSuggestion: (id) => onThis((s) => dismissSuggestionAction(s, id)),
      onEndLive: () => onThis(endLive),
    };
  }, [liveId]);
  return { view, actions };
}

// ---- Recap, timeline and the simulation's own controls (WP7, additive) --------------------------------------------------

/** Which live this browser holds, if any, so the navigation can offer the Live Desk and the recap. */
export function useCurrentLive(): { id: string; mode: Exclude<DeskMode, "idle"> } | null {
  const state = useDeskState();
  return useMemo(() => (state.live ? { id: state.live.id, mode: state.live.mode } : null), [state.live]);
}

/**
 * The recorded live as a recap: pins with their products, the stretches each product was on show, the suggestions
 * and what the operator did with them. Built from the desk's own record; nothing here is estimated. Where the record
 * has no value, the field is null (missing, not zero).
 *
 * Matching rule for "accepted" show_next suggestions: accepting pins the product at once, so an accepted show_next is
 * matched to the first operator pin of that product at or after the suggestion. Every other operator pin or unpin is
 * the operator's own ("self").
 */
export function buildRecapView(state: DeskState, liveId: string): RecapViewModel | null {
  const live = state.live;
  const desk = buildDeskView(state, liveId);
  if (!live || !desk) return null;
  const nameOf = (id: string): string => state.products.find((p) => p.id === id)?.name ?? live.atStart.products.find((p) => p.id === id)?.name ?? id;
  const marks: DeskTimelineMark[] = [...live.markers]
    .sort((a, b) => a.atSec - b.atSec)
    .map((m) => ({ atSec: m.atSec, kind: m.kind, productId: m.productId, productName: nameOf(m.productId) }));

  const bands: DeskPinBand[] = [];
  let open: DeskPinBand | null = null;
  const close = (at: number): void => {
    if (open && at > open.fromSec) bands.push({ ...open, toSec: at });
    open = null;
  };
  for (const m of marks) {
    close(m.atSec);
    if (m.kind === "pin" || m.kind === "host_pin") {
      open = { productId: m.productId, productName: m.productName, fromSec: m.atSec, toSec: m.atSec, by: m.kind === "pin" ? "operator" : "host" };
    }
  }
  close(live.elapsedSec);

  const cartsPerMinute = live.cartsPerMinute.map((value, minute) =>
    bands.some((b) => b.fromSec < (minute + 1) * 60 && b.toSec > minute * 60) ? value : null);
  const onShow = cartsPerMinute.filter((v): v is number => v !== null);

  const used = new Set<number>();
  const rows: RecapRow[] = [];
  for (const s of [...live.suggestions].sort((a, b) => a.atSec - b.atSec)) {
    const taken = s.state === "accepted" || s.state === "performed";
    let actedAtSec: number | null = null;
    if (taken && s.kind === "show_next") {
      const i = marks.findIndex((m, index) => !used.has(index) && m.kind === "pin" && m.productId === s.productId && m.atSec >= s.atSec);
      if (i >= 0) {
        used.add(i);
        actedAtSec = marks[i].atSec;
      }
    }
    const outcome = s.state === "proposed" ? (live.mode === "ended" ? "no_response" : "open") : s.state;
    rows.push({
      atSec: s.atSec, action: s.kind, productId: s.productId, productName: nameOf(s.productId), outcome,
      suggestion: { id: s.id, signals: s.signals.map((x) => ({ ...x })), sampleSize: s.sampleSize, confidence: s.confidence, source: s.source },
      actedAtSec,
    });
  }
  marks.forEach((m, index) => {
    if (used.has(index)) return;
    const host = m.kind === "host_pin" || m.kind === "host_unpin";
    rows.push({
      atSec: m.atSec, action: m.kind === "pin" || m.kind === "host_pin" ? "pin" : "unpin", productId: m.productId, productName: m.productName,
      outcome: host ? "host" : "self", suggestion: null, actedAtSec: null,
    });
  });
  rows.sort((a, b) => a.atSec - b.atSec);

  const values = live.viewerPoints.map((p) => p.value);
  return {
    liveId: live.id,
    mode: live.mode,
    title: live.title,
    platformLabel: desk.platformLabel,
    durationSec: live.elapsedSec,
    peakViewers: values.length ? Math.max(...values) : null,
    viewerSampleSec: VIEWER_SAMPLE_SEC,
    viewerPoints: live.viewerPoints.map((p) => ({ ...p })),
    cartsPerMinute,
    cartsOnShow: onShow.length ? onShow.reduce((a, b) => a + b, 0) : null,
    operatorPins: marks.filter((m) => m.kind === "pin").length,
    hostPins: marks.filter((m) => m.kind === "host_pin").length,
    marks,
    bands,
    rows,
    intentCounts: desk.intentCounts,
    commentsHeld: { count: live.comments.length, masked: live.comments.filter((c) => c.piiMasked).length, fromSec: live.comments[0]?.atSec ?? null },
    missing: state.products.filter((p) => p.price === null || p.stock === null).map((p) => ({ id: p.id, name: p.name, price: p.price === null, stock: p.stock === null })),
    fingerprint: desk.fingerprint,
  };
}

/** The recap (or, while the live runs, the record so far) for this live id; null when this browser has no such live. */
export function useLiveRecap(liveId: string): RecapViewModel | null {
  const state = useDeskState();
  return useMemo(() => (liveId ? buildRecapView(state, liveId) : null), [state, liveId]);
}

/**
 * The simulation's own control, not an operator action: put the SIMULATED platform into a condition to rehearse it,
 * or clear it. LiveLift's reads stay stopped after a condition until the operator's next platform call succeeds.
 */
export function useDeskSimulation(liveId: string): { fault: DeskPlatformFault | null; setFault: (fault: DeskPlatformFault | null) => void } {
  const state = useDeskState();
  const raw = state.world.sim.fault;
  const fault = raw === "token_expired" || raw === "rate_limited" || raw === "server_error" ? raw : null;
  const setFault = useMemo(() => (next: DeskPlatformFault | null): void => updateDesk((s) => (s.live?.id === liveId ? setPlatformFault(s, next) : s)), [liveId]);
  return { fault, setFault };
}
