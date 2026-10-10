import { z } from "zod";
import { parseWorld } from "@/lib/platform";
import { maskPii } from "./pii";
import { DESK_EPOCH_MS, STORAGE_KEY, initialDeskState, type DeskState } from "./session";
import { COMMENT_INTENTS, type CommentIntent } from "./types";

/**
 * The one Live Desk state the hooks share, kept in the browser under `livelift.livedesk.SIMULATED` and nowhere else
 * (never the V3 key `livelift.v3.SIMULATED`). A stored blob is checked field by field; anything that does not check
 * out is dropped and the desk starts afresh. Comment text is masked again on the way in, so even an edited blob
 * cannot put an unmasked phone number on screen.
 */

const int = z.number().int();
const count = int.nonnegative();
const product = z.object({
  id: z.string(), code: z.string(), name: z.string(), price: z.number().finite().nonnegative().nullable(), currency: z.string(),
  stock: count.nullable(), sync: z.object({ state: z.enum(["queued", "synced", "failed"]), detail: z.string().nullable() }),
});
const comment = z.object({
  id: z.string(), atSec: count, user: z.string(), text: z.string(), intent: z.string().refine((v) => (COMMENT_INTENTS as readonly string[]).includes(v)),
  piiMasked: z.boolean(), aboutProductId: z.string().nullable(),
});
const suggestion = z.object({
  id: z.string(), kind: z.enum(["show_next", "flash_sale"]), productId: z.string(), headline: z.string(),
  signals: z.array(z.object({ label: z.string(), value: z.string() })), sampleSize: count, confidence: z.enum(["low", "medium", "high"]),
  source: z.enum(["rules", "ai"]), state: z.enum(["proposed", "accepted", "dismissed", "performed"]), atSec: count, promotionId: int.nullable(),
});
const live = z.object({
  id: z.string(), title: z.string(), mode: z.enum(["live", "ended"]), startedAtMs: z.number().finite(), elapsedSec: count,
  running: z.boolean(), speed: z.number().positive(), showingProductId: z.string().nullable(), showingSinceSec: count,
  lastShownAtSec: z.record(count), viewers: count.nullable(), viewerPoints: z.array(z.object({ atSec: count, value: count })),
  cartsPerMinute: z.array(count), comments: z.array(comment), carts: z.array(z.object({ atSec: count, productId: z.string() })),
  markers: z.array(z.object({ atSec: count, kind: z.enum(["pin", "unpin", "host_pin", "host_unpin"]), productId: z.string(), label: z.string() })),
  suggestions: z.array(suggestion), nextSuggestionId: int.positive(), aiStatus: z.enum(["rules_only", "ai_ok", "ai_fallback"]),
  banner: z.object({ tone: z.enum(["info", "warn", "danger"]), text: z.string() }).nullable(), halted: z.boolean(), digest: z.string().nullable(),
  atStart: z.object({ world: z.unknown(), products: z.array(product) }),
});
const desk = z.object({
  version: z.literal(1), seed: int, connected: z.boolean(), nowMs: z.number().finite().min(DESK_EPOCH_MS), products: z.array(product),
  importNote: z.string().nullable(), world: z.unknown(), live: live.nullable(), nextLiveNumber: int.positive(),
});

/** A stored desk, checked, or null. Both platform worlds go through the platform's own validator. */
export function parseDeskState(raw: unknown): DeskState | null {
  const parsed = desk.safeParse(raw);
  if (!parsed.success) return null;
  const world = parseWorld(parsed.data.world);
  if (!world) return null;
  if (!parsed.data.live) return { ...parsed.data, world, live: null };
  const startWorld = parseWorld(parsed.data.live.atStart.world);
  if (!startWorld) return null;
  const comments = parsed.data.live.comments.map((c) => {
    const m = maskPii(c.text);
    return { ...c, intent: c.intent as CommentIntent, text: m.text, piiMasked: c.piiMasked || m.masked };
  });
  return { ...parsed.data, world, live: { ...parsed.data.live, comments, atStart: { world: startWorld, products: parsed.data.live.atStart.products } } };
}

export const serializeDeskState = (state: DeskState): string => JSON.stringify(state);

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadDeskState(from: Storage | null = storage()): DeskState {
  try {
    const raw = from?.getItem(STORAGE_KEY);
    if (raw) return parseDeskState(JSON.parse(raw)) ?? initialDeskState();
  } catch {
    // A blob that is not JSON, or storage that throws, is the same as nothing stored.
  }
  return initialDeskState();
}

export function saveDeskState(state: DeskState, to: Storage | null = storage()): void {
  try {
    to?.setItem(STORAGE_KEY, serializeDeskState(state));
  } catch {
    // Full or blocked storage: the desk keeps working in memory.
  }
}

// ---- The shared store ---------------------------------------------------------------------------------------------------

/** What the server renders: always the same object, so hydration has one snapshot to compare with. */
export const SERVER_DESK_STATE: DeskState = initialDeskState();

let current: DeskState | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DELAY_MS = 300;

export function getDeskState(): DeskState {
  if (current === null) current = loadDeskState();
  return current;
}

export const getServerDeskState = (): DeskState => SERVER_DESK_STATE;

export function setDeskState(next: DeskState): void {
  if (next === current) return;
  current = next;
  if (saveTimer === null) {
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (current) saveDeskState(current);
    }, SAVE_DELAY_MS);
  }
  for (const listener of listeners) listener();
}

export const updateDesk = (change: (state: DeskState) => DeskState): void => setDeskState(change(getDeskState()));

export function subscribeDesk(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Write any pending change now (tests, and before the page goes away). */
export function flushDeskState(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  if (current) saveDeskState(current);
}

/** Tests only: start the shared store from a given state (or from storage when null) without writing anything. */
export function replaceDeskStateForTests(state: DeskState | null): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  current = state;
}
