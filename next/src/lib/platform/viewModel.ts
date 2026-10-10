/**
 * The host's SIMULATED Shopee app, as a view model for the presentational components in `components/platform/host-app`.
 *
 * Pure: the same simulation, sync state, show and virtual time always give the same screen. Viewer counts and comments
 * are labelled inventions, derived from the virtual clock and the call log only (no `Date.now`, no randomness), so a
 * replay looks the same every time. Nothing here is a measurement and nothing here came from Shopee.
 */
import type { Session } from "@/contracts";
import type { HostAppBagItem, HostAppComment, HostAppPromotion, HostAppViewModel } from "@/components/platform/host-app/types";
import { fnv1a, ongoingSession, promotionStatus, type ShopeeFault, type ShopeeLiveSim, type SimItem, type SimSession } from "./shopeeLive";
import type { SyncState } from "./sync";

/** Every word the phone shows. The text lives with the rest of the Lab copy; this file only says what it needs. */
export interface HostAppWords {
  faults: Record<ShopeeFault, string>;
  /** "in 02:10" while a promotion is scheduled. */
  startsIn: (clock: string) => string;
  /** "ends in 04:30" while it runs. */
  endsIn: (clock: string) => string;
  /** The pool synthetic comments are drawn from. */
  comments: readonly string[];
  /** What synthetic viewers say right after something visible happens. A pin made in the app is logged without its item. */
  reactions: { pinned: (name: string) => string; pinnedInApp: string; promotion: (name: string) => string };
}

const FAULT_TONE: Record<ShopeeFault, "warn" | "danger"> = {
  token_expired: "danger",
  region_unsupported: "warn",
  rate_limited: "warn",
  server_error: "danger",
};

const COMMENT_EVERY_SEC = 6;
const COMMENTS_SHOWN = 12;
const REACTION_DELAY_MS = 3000;

/** mm:ss, or h:mm:ss from one hour: the phone's own clock style. */
function phoneClock(totalMs: number): string {
  const sec = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(sec / 3600);
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Formatted for vi-VN in the item's own currency. Never converted: a converted price would be invented. */
export function priceLabel(price: number | null, currency: string): string | null {
  if (price === null) return null;
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(price);
  } catch {
    // A currency code Intl does not know: show it as written rather than guess.
    return `${price} ${currency}`;
  }
}

const initialsOf = (name: string): string => {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "P") + (words[1]?.[0] ?? "")).toUpperCase();
};

const bagItem = (item: SimItem, pinned: boolean): HostAppBagItem => ({
  itemId: item.itemId,
  name: item.name,
  priceLabel: priceLabel(item.price, item.currency),
  initials: initialsOf(item.name),
  pinned,
});

const viewerName = (seed: string): string => `viewer_${1000 + (fnv1a(seed) % 9000)}`;

/** The live the phone is showing: the ongoing one, else the one that ended last (LiveLift's own first). */
function shownSession(sim: ShopeeLiveSim, sync: SyncState): SimSession | null {
  const live = ongoingSession(sim);
  if (live) return live;
  const linked = sync.providerSessionId !== null ? sim.sessions[sync.providerSessionId] : undefined;
  if (linked?.status === "ended") return linked;
  const ended = Object.values(sim.sessions).filter((s) => s.status === "ended");
  return ended.reduce<SimSession | null>((last, s) => (last === null || (s.endedAtMs ?? 0) > (last.endedAtMs ?? 0) ? s : last), null);
}

function promotionFor(sim: ShopeeLiveSim, nowMs: number, words: HostAppWords): HostAppPromotion | null {
  const withStatus = sim.promotions.map((p) => ({ p, status: promotionStatus(p, nowMs) }));
  const active = withStatus.find((x) => x.status === "active");
  if (active) return { name: active.p.name, status: "active", countdownLabel: words.endsIn(phoneClock(active.p.endMs - nowMs)) };
  const next = withStatus.filter((x) => x.status === "scheduled").sort((a, b) => a.p.startMs - b.p.startMs)[0];
  if (next) return { name: next.p.name, status: "scheduled", countdownLabel: words.startsIn(phoneClock(next.p.startMs - nowMs)) };
  const last = withStatus.filter((x) => x.status === "ended").sort((a, b) => b.p.endMs - a.p.endMs)[0];
  return last ? { name: last.p.name, status: "ended", countdownLabel: null } : null;
}

/** Things viewers react to while the live is on: a pin that took effect, and a promotion that started. */
function reactions(sim: ShopeeLiveSim, live: SimSession, untilMs: number, words: HostAppWords): Array<{ atMs: number; comment: HostAppComment }> {
  const from = live.startedAtMs ?? untilMs;
  const seen = (atMs: number): boolean => atMs >= from && atMs + REACTION_DELAY_MS <= untilMs;
  const out: Array<{ atMs: number; comment: HostAppComment }> = [];
  for (const e of sim.ledger) {
    if (!seen(e.atMs)) continue;
    let text: string | null = null;
    if (e.kind === "api" && e.endpoint === "update_show_item" && e.envelope.error === "") {
      const name = sim.catalog.find((c) => c.itemId === e.params.item_id)?.name;
      text = name ? words.reactions.pinned(name) : words.reactions.pinnedInApp;
    } else if (e.kind === "host_app" && e.action === "pin_item" && e.ok) {
      text = words.reactions.pinnedInApp;
    }
    if (text !== null) out.push({ atMs: e.atMs + REACTION_DELAY_MS, comment: { id: `r${e.seq}`, user: viewerName(`r:${e.seq}`), text } });
  }
  for (const p of sim.promotions) {
    if (!seen(p.startMs)) continue;
    out.push({ atMs: p.startMs + REACTION_DELAY_MS, comment: { id: `p${p.id}`, user: viewerName(`p:${p.id}`), text: words.reactions.promotion(p.name) } });
  }
  return out;
}

/** One synthetic comment every few virtual seconds, chosen by hash, plus reactions; only the latest few are shown. */
function commentsFor(sim: ShopeeLiveSim, live: SimSession, untilMs: number, words: HostAppWords): HostAppComment[] {
  if (live.startedAtMs === null || words.comments.length === 0) return [];
  const last = Math.floor((untilMs - live.startedAtMs) / 1000 / COMMENT_EVERY_SEC);
  const stream: Array<{ atMs: number; comment: HostAppComment }> = [];
  for (let k = Math.max(1, last - COMMENTS_SHOWN + 1); k <= last; k++) {
    stream.push({
      atMs: live.startedAtMs + k * COMMENT_EVERY_SEC * 1000,
      comment: { id: `c${k}`, user: viewerName(`u:${live.sessionId}:${k}`), text: words.comments[fnv1a(`c:${live.sessionId}:${k}`) % words.comments.length] },
    });
  }
  return [...stream, ...reactions(sim, live, untilMs, words)]
    .sort((a, b) => a.atMs - b.atMs || a.comment.id.localeCompare(b.comment.id))
    .slice(-COMMENTS_SHOWN)
    .map((x) => x.comment);
}

/** A smooth climb, a small hashed wobble, and a lift while something is pinned or on sale. Never zero while live. */
function viewersFor(sim: ShopeeLiveSim, live: SimSession, nowMs: number): number {
  const t = Math.max(0, (nowMs - (live.startedAtMs ?? nowMs)) / 1000);
  const climb = 60 + 540 * (1 - Math.exp(-t / 300));
  const wobble = (fnv1a(`v:${live.sessionId}:${Math.floor(t / 5)}`) % 31) - 15;
  const pinned = live.showingItemId !== null ? 40 : 0;
  const onSale = sim.promotions.some((p) => promotionStatus(p, nowMs) === "active") ? 160 : 0;
  return Math.max(1, Math.round(climb + wobble + pinned + onSale));
}

export function toHostAppViewModel(
  sim: ShopeeLiveSim,
  sync: SyncState,
  session: Pick<Session, "title">,
  nowMs: number,
  words: HostAppWords
): HostAppViewModel {
  const banner = sim.fault ? { tone: FAULT_TONE[sim.fault], text: words.faults[sim.fault] } : null;
  const shown = shownSession(sim, sync);

  if (!shown) {
    return {
      mode: "idle",
      title: session.title,
      sessionId: null,
      viewers: null,
      elapsedLabel: null,
      bag: sim.catalog.map((c) => bagItem(c, false)),
      promotion: null,
      comments: [],
      banner,
    };
  }

  const live = shown.status === "ongoing";
  const untilMs = live ? nowMs : (shown.endedAtMs ?? nowMs);
  const bag = shown.items.flatMap((i) => {
    const item = sim.catalog.find((c) => c.itemId === i.itemId);
    return item ? [bagItem(item, shown.showingItemId === item.itemId)] : [];
  });
  return {
    mode: live ? "live" : "ended",
    title: shown.title,
    sessionId: shown.sessionId,
    viewers: live ? viewersFor(sim, shown, nowMs) : null,
    elapsedLabel: shown.startedAtMs === null ? null : phoneClock(untilMs - shown.startedAtMs),
    bag,
    promotion: live ? promotionFor(sim, nowMs, words) : null,
    comments: commentsFor(sim, shown, untilMs, words),
    banner,
  };
}
