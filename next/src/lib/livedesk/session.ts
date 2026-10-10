/**
 * The Live Desk's state and every rule that changes it. SIMULATED from end to end.
 *
 * Pure functions: state in, state out. The hooks hold one state, persist it in the browser under its own key
 * (`livelift.livedesk.SIMULATED`, never the V3 key) and call these functions; the screens see only view models.
 *
 * Time is virtual. A live runs on its own clock that advances one second at a time (`advance`): each second the
 * platform is read every few seconds, the generator plays that second, and the Copilot re-reads its signals every few
 * seconds. Operator actions happen at the current second. So the log depends only on the seed, the products and the
 * actions with their seconds, never on how the seconds were batched (Run at any speed, Pause, Skip).
 */
import {
  addNotices, callLogDigest, fnv1a, hostAct, readsOf, withFault,
  type PlatformWorld, type ShopeeFault,
} from "@/lib/platform";
import { parseProductRows, toProductSnapshots } from "@/lib/domain/products";
import { PLATFORM_LABEL, PREPARED_LIVE_TITLE, simulatedShopeeAdapter as adapter, emptyPlatformWorld, type PlatformCondition, type PlatformOutcome } from "./adapter";
import {
  acceptSuggestion, aggregateSignals, dismissSuggestion, markPerformed, mergeCandidates, scoreRules, toSuggestionView, withPromotion,
  type SourcedCandidate, type SuggestionRecord,
} from "./copilot";
import { ASSUMPTIONS, type EngineComment, type EngineWorld } from "./engine";
import {
  COMMENT_INTENTS,
  type CommentIntent, type CopilotAiStatus, type DeskChart, type DeskMarkerKind, type DeskProduct, type LiveDeskViewModel,
  type ProductSyncState, type StartViewModel,
} from "./types";

export const STORAGE_KEY = "livelift.livedesk.SIMULATED";
export const SPEEDS: readonly number[] = [1, 5, 15, 60];
export const SKIPS: readonly number[] = [30, 60, 300];
/** 20:00 on 2026-10-09 in Vietnam (UTC+7): where every desk's virtual clock starts. */
export const DESK_EPOCH_MS = Date.UTC(2026, 9, 9, 13, 0, 0);
const UTC_OFFSET_MS = 7 * 3600 * 1000;
export const DEFAULT_SEED = 20261009;

/** How often the desk reads the platform, re-scores the Copilot and samples the viewer chart, in virtual seconds. */
export const OBSERVE_EVERY_SEC = 5;
export const COPILOT_EVERY_SEC = 15;
export const VIEWER_SAMPLE_SEC = 10;
const COMMENT_KEEP_SEC = 300;
const COMMENT_KEEP_MAX = 400;
const CART_KEEP_SEC = 240;
const MARKER_LIMIT = 200;
const VIEW_COMMENTS = 50;
const INTENT_WINDOW_SEC = 120;

// ---- State --------------------------------------------------------------------------------------------------------------

export interface DeskProductRecord {
  id: string;
  code: string;
  name: string;
  price: number | null;
  currency: string;
  stock: number | null;
  sync: { state: ProductSyncState; detail: string | null };
}

export interface MarkerRecord {
  atSec: number;
  kind: DeskMarkerKind;
  productId: string;
  label: string;
}

export interface Banner {
  tone: "info" | "warn" | "danger";
  text: string;
}

export interface LiveRecord {
  id: string;
  title: string;
  mode: "live" | "ended";
  startedAtMs: number;
  elapsedSec: number;
  running: boolean;
  speed: number;
  /** What the platform showed when LiveLift last read it. */
  showingProductId: string | null;
  showingSinceSec: number;
  lastShownAtSec: Record<string, number>;
  /** null before the first second: not simulated yet, never zero. */
  viewers: number | null;
  viewerPoints: Array<{ atSec: number; value: number }>;
  /** Add-to-carts for the product on show, per minute of the live. */
  cartsPerMinute: number[];
  comments: EngineComment[];
  carts: Array<{ atSec: number; productId: string }>;
  markers: MarkerRecord[];
  suggestions: SuggestionRecord[];
  nextSuggestionId: number;
  aiStatus: CopilotAiStatus;
  banner: Banner | null;
  /** A platform condition stopped the desk's own reads; an operator action that succeeds resumes them. */
  halted: boolean;
  /** Rolling digest of every simulated second and operator action. null before the first one. */
  digest: string | null;
  /** The platform and products the moment the live started, for Reset. */
  atStart: { world: PlatformWorld; products: DeskProductRecord[] };
}

export interface DeskState {
  version: 1;
  seed: number;
  connected: boolean;
  /** The desk's virtual clock. */
  nowMs: number;
  products: DeskProductRecord[];
  importNote: string | null;
  world: PlatformWorld;
  live: LiveRecord | null;
  nextLiveNumber: number;
}

export function initialDeskState(seed: number = DEFAULT_SEED): DeskState {
  return { version: 1, seed, connected: false, nowMs: DESK_EPOCH_MS, products: [], importNote: null, world: emptyPlatformWorld(), live: null, nextLiveNumber: 1 };
}

// ---- Words --------------------------------------------------------------------------------------------------------------

const nameOf = (state: DeskState, productId: string): string => state.products.find((p) => p.id === productId)?.name ?? productId;

export function priceLabel(price: number | null, currency: string): string | null {
  if (price === null) return null;
  if (currency === "VND") return `${Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
  return `${price.toFixed(2)} ${currency}`;
}

const two = (n: number): string => String(n).padStart(2, "0");
export function elapsedLabel(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}
export function clockLabel(ms: number): string {
  const d = new Date(ms + UTC_OFFSET_MS);
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`;
}

function bannerFor(condition: PlatformCondition, message: string): Banner {
  switch (condition) {
    case "auth_expired":
      return { tone: "danger", text: `Authorisation expired on SIMULATED Live: "${message}". The Live Desk stopped calling it. Carry on in the app by hand.` };
    case "rate_limited":
      return { tone: "warn", text: `SIMULATED Live is rate limiting: "${message}". The Live Desk stopped calling it. Carry on in the app by hand.` };
    case "region_unsupported":
    case "server_error":
      return { tone: "danger", text: `SIMULATED Live server error: "${message}". The Live Desk stopped calling it. Carry on in the app by hand.` };
    case "refused":
      return { tone: "warn", text: `SIMULATED Live refused: "${message}".` };
  }
}
const RECOVERED: Banner = { tone: "info", text: "SIMULATED Live is answering again." };

const fold = (digest: string | null, text: string): string => fnv1a(`${digest ?? ""}|${text}`).toString(16).padStart(8, "0");

// ---- Start flow -------------------------------------------------------------------------------------------------------

export const SAMPLE_PACK = [
  "HD-01, Zip Hoodie, 199000 VND, 24",
  "CP-02, Cargo Pants, 249000 VND, 9",
  "CT-03, Canvas Tote, , ",
  "LS-04, Linen Shirt, 289000 VND, 30",
].join("\n");

/** The fourth column, stock: blank is "not entered", anything else must be a whole number. */
function stockCell(raw: string): { ok: boolean; stock: number | null; token: string } {
  const cells = (raw.includes("\t") ? raw.split("\t") : raw.split(",")).map((c) => c.trim());
  const token = cells[3] ?? "";
  if (token === "" || token === "-") return { ok: true, stock: null, token };
  return /^\d{1,6}$/.test(token) ? { ok: true, stock: Number(token), token } : { ok: false, stock: null, token };
}

function skipWords(reason: string | null): string {
  if (reason?.startsWith("A code and a name")) return "no code or name";
  if (reason?.startsWith("That code already exists")) return "code already imported";
  return (reason ?? "invalid row").replace(/\.$/, "").replace(/^Price/, "price");
}

function syncNow(state: DeskState, ids: readonly string[]): DeskState {
  const todo = state.products.filter((p) => ids.includes(p.id));
  if (!state.connected || todo.length === 0) return state;
  const r = adapter.syncProducts(state.world, todo.map((p) => ({ productId: p.id, name: p.name, price: p.price, currency: p.currency })), state.nowMs);
  const results = new Map(r.results.map((x) => [x.productId, x]));
  return {
    ...state,
    world: r.world,
    products: state.products.map((p) => {
      const res = results.get(p.id);
      if (!res) return p;
      return { ...p, sync: res.ok ? { state: "synced", detail: null } : { state: "failed", detail: res.detail } };
    }),
  };
}

/** Products waiting for the platform: queued ones, and failed ones are tried again. */
const unsynced = (state: DeskState): string[] => state.products.filter((p) => p.sync.state !== "synced").map((p) => p.id);

export function connect(state: DeskState): DeskState {
  if (state.connected) return state;
  return syncNow({ ...state, connected: true }, unsynced(state));
}

export function importText(state: DeskState, text: string): DeskState {
  const rows = parseProductRows(text, state.products.map((p) => p.code));
  if (rows.length === 0) return { ...state, importNote: "Nothing to import: the text has no rows." };
  const skipped: string[] = [];
  const valid = rows.filter((r) => {
    if (r.status !== "valid") { skipped.push(skipWords(r.reason)); return false; }
    const stock = stockCell(r.raw);
    if (!stock.ok) { skipped.push(`stock "${stock.token}" is not a whole number`); return false; }
    return true;
  });
  const snapshots = toProductSnapshots(valid, new Date(state.nowMs).toISOString(), state.products.map((p) => p.id));
  const added: DeskProductRecord[] = snapshots.map((s, i) => ({
    id: s.id, code: s.code, name: s.name, price: s.price, currency: s.currency, stock: stockCell(valid[i].raw).stock,
    sync: { state: "queued", detail: null },
  }));
  const reasons = [...new Set(skipped)];
  const note = `${added.length} imported, ${skipped.length} row${skipped.length === 1 ? "" : "s"} skipped${reasons.length ? `: ${reasons.join("; ")}` : ""}`;
  const next = { ...state, products: [...state.products, ...added], importNote: note };
  return syncNow(next, unsynced(next));
}

export const importSamplePack = (state: DeskState): DeskState => importText(state, SAMPLE_PACK);

export function removeProduct(state: DeskState, productId: string): DeskState {
  if (state.live?.mode === "live" || !state.products.some((p) => p.id === productId)) return state;
  const r = adapter.removeProduct(state.world, productId, state.nowMs);
  // The import note describes an earlier import; after a removal it would contradict the list ("no products" beside
  // "4 rows skipped: code already imported"), so it goes.
  return { ...state, world: r.world, products: state.products.filter((p) => p.id !== productId), importNote: null };
}

export function startBlockedReason(state: DeskState): string | null {
  if (state.live?.mode === "live") return "A SIMULATED live is already running. Open the Live Desk.";
  if (!state.connected) return "Connect SIMULATED Live first.";
  if (state.products.length === 0) return "Import at least one product first.";
  if (!state.products.some((p) => p.sync.state === "synced")) return "No product has synced to SIMULATED Live yet.";
  return null;
}

export function startLive(state: DeskState): { state: DeskState; liveId: string | null } {
  if (startBlockedReason(state) !== null) return { state, liveId: null };
  const synced = state.products.filter((p) => p.sync.state === "synced").map((p) => p.id);
  const r = adapter.startLive(state.world, PREPARED_LIVE_TITLE, synced, state.nowMs);
  if (!r.outcome.ok) return { state: { ...state, world: r.world, importNote: `Start live: SIMULATED Live refused: "${r.outcome.message}"` }, liveId: null };
  const id = `live-${state.nextLiveNumber}`;
  const live: LiveRecord = {
    id, title: PREPARED_LIVE_TITLE, mode: "live", startedAtMs: state.nowMs, elapsedSec: 0, running: false, speed: 1,
    showingProductId: null, showingSinceSec: 0, lastShownAtSec: {}, viewers: null, viewerPoints: [], cartsPerMinute: [],
    comments: [], carts: [], markers: [], suggestions: [], nextSuggestionId: 1, aiStatus: "rules_only", banner: null, halted: false,
    digest: null, atStart: { world: r.world, products: state.products },
  };
  return { state: { ...state, world: r.world, live, nextLiveNumber: state.nextLiveNumber + 1 }, liveId: id };
}

// ---- One virtual second --------------------------------------------------------------------------------------------------

type LiveState = DeskState & { live: LiveRecord };
const isLive = (state: DeskState): state is LiveState => state.live !== null && state.live.mode === "live";

/** Move "what is showing" to a new product (or none), remembering when the old one was last on show. */
function showing(live: LiveRecord, productId: string | null, atSec: number): LiveRecord {
  if (live.showingProductId === productId) return live;
  const lastShownAtSec = live.showingProductId ? { ...live.lastShownAtSec, [live.showingProductId]: atSec } : live.lastShownAtSec;
  return { ...live, showingProductId: productId, showingSinceSec: atSec, lastShownAtSec };
}

/** What the platform shows according to LiveLift's latest good read; undefined when that is not known. */
function readShowing(state: DeskState): string | null | undefined {
  const s = state.world.sync.last?.showing;
  if (!s || s.state === "unobservable") return undefined;
  if (s.state === "none") return null;
  return state.world.sync.links.find((l) => l.itemId === s.itemId)?.productId;
}

/** After any read: follow what the platform shows, and move accepted suggestions it shows done to performed. */
function afterPlatform(state: LiveState, at: number): LiveState {
  const shown = readShowing(state);
  const live = shown === undefined ? state.live : showing(state.live, shown, at);
  return { ...state, live: { ...live, suggestions: markPerformed(live.suggestions, { showingProductId: live.showingProductId, promotions: state.world.sync.last?.promotions ?? [], nowMs: state.nowMs }) } };
}

function marker(state: DeskState, live: LiveRecord, kind: DeskMarkerKind, productId: string, atSec: number): LiveRecord {
  const name = nameOf(state, productId);
  const label = kind === "pin" ? `You pinned ${name} (SIMULATED)`
    : kind === "unpin" ? `You unpinned ${name} (SIMULATED)`
    : kind === "host_pin" ? `Provider observed (SIMULATED): the host pinned ${name}`
    : `Provider observed (SIMULATED): the host unpinned ${name}`;
  return { ...live, markers: [...live.markers, { atSec, kind, productId, label }].slice(-MARKER_LIMIT) };
}

/** The outcome of an operator's platform call: a refusal is said once; a success after a stop resumes reading. */
function settle(live: LiveRecord, outcome: PlatformOutcome): LiveRecord {
  if (outcome.ok) return live.halted ? { ...live, halted: false, banner: RECOVERED } : live;
  return { ...live, banner: bannerFor(outcome.condition, outcome.message), halted: live.halted || outcome.condition !== "refused" };
}

function observe(state: LiveState, sec: number): LiveState {
  const r = adapter.observe(state.world, state.nowMs);
  if (r.observation.problem) {
    const { condition, message } = r.observation.problem;
    return { ...state, world: r.world, live: { ...state.live, banner: bannerFor(condition, message), halted: condition !== "refused" } };
  }
  let live = state.live;
  for (const change of r.observation.hostChanges) live = marker(state, live, change.kind, change.productId, sec);
  // The host's change is the platform's news; it also lands in the platform's notices, as in the Lab.
  const notes = r.observation.hostChanges.map((c) => ({ code: "observed", summary: `Provider observed (SIMULATED): the host ${c.kind === "host_pin" ? "pinned" : "unpinned"} ${nameOf(state, c.productId)}` }));
  return afterPlatform({ ...state, world: addNotices(r.world, state.nowMs, notes), live }, sec);
}

function scoreCopilot(state: LiveState, sec: number): LiveState {
  const live = state.live;
  const candidates: SourcedCandidate[] = scoreRules(aggregateSignals({
    nowSec: sec,
    products: state.products.filter((p) => p.sync.state === "synced").map((p) => ({ id: p.id, name: p.name, stock: p.stock, lastShownAtSec: live.lastShownAtSec[p.id] ?? null })),
    showingProductId: live.showingProductId,
    comments: live.comments,
    addToCart: live.carts,
  })).map((c) => ({ ...c, source: "rules" }));
  const merged = mergeCandidates(live.suggestions, candidates, sec, live.nextSuggestionId);
  return { ...state, live: { ...live, suggestions: merged.list, nextSuggestionId: merged.nextId } };
}

export function engineWorld(state: DeskState): EngineWorld {
  const live = state.live;
  return {
    products: state.products.filter((p) => p.sync.state === "synced").map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    showingProductId: live?.showingProductId ?? null,
    shownForSec: live?.showingProductId ? live.elapsedSec - live.showingSinceSec : 0,
  };
}

function step(stateIn: LiveState): LiveState {
  const sec = stateIn.live.elapsedSec + 1;
  let state: LiveState = { ...stateIn, nowMs: stateIn.live.startedAtMs + sec * 1000, live: { ...stateIn.live, elapsedSec: sec } };
  if (sec % OBSERVE_EVERY_SEC === 0 && !state.live.halted) state = observe(state, sec);

  const ev = adapter.readMetrics(state.seed, sec, engineWorld(state));
  const live = state.live;
  const minute = Math.floor((sec - 1) / 60);
  const perMinute = [...live.cartsPerMinute];
  while (perMinute.length <= minute) perMinute.push(0);
  if (live.showingProductId) perMinute[minute] += ev.addToCart.filter((id) => id === live.showingProductId).length;

  const keepFrom = sec - COMMENT_KEEP_SEC;
  const products = ev.purchases.length === 0 ? state.products : state.products.map((p) => {
    const sold = ev.purchases.filter((id) => id === p.id).length;
    return sold === 0 || p.stock === null ? p : { ...p, stock: Math.max(0, p.stock - sold) };
  });
  state = {
    ...state,
    products,
    live: {
      ...live,
      viewers: ev.viewers,
      viewerPoints: sec % VIEWER_SAMPLE_SEC === 0 || sec === 1 ? [...live.viewerPoints, { atSec: sec, value: ev.viewers }] : live.viewerPoints,
      cartsPerMinute: perMinute,
      comments: [...live.comments.filter((c) => c.atSec > keepFrom), ...ev.comments].slice(-COMMENT_KEEP_MAX),
      carts: [...live.carts.filter((c) => c.atSec > sec - CART_KEEP_SEC), ...ev.addToCart.map((productId) => ({ atSec: sec, productId }))],
      digest: fold(live.digest, `${sec}:${ev.viewers}:${ev.comments.map((c) => `${c.intent}/${c.text}`).join(",")}:${ev.addToCart.join(",")}:${ev.purchases.join(",")}`),
    },
  };
  return sec % COPILOT_EVERY_SEC === 0 ? scoreCopilot(state, sec) : state;
}

/** Play `seconds` virtual seconds, one at a time. Batching never changes the result. */
export function advance(state: DeskState, seconds: number): DeskState {
  let s = state;
  for (let i = 0; i < Math.max(0, Math.floor(seconds)); i++) {
    if (!isLive(s)) break;
    s = step(s);
  }
  return s;
}

// ---- Operator actions -----------------------------------------------------------------------------------------------------

const act = (live: LiveRecord, what: string): LiveRecord => ({ ...live, digest: fold(live.digest, `act:${live.elapsedSec}:${what}`) });

export function setRunning(state: DeskState, running: boolean): DeskState {
  return isLive(state) ? { ...state, live: { ...state.live, running } } : state;
}

export function setSpeed(state: DeskState, speed: number): DeskState {
  return isLive(state) && SPEEDS.includes(speed) ? { ...state, live: { ...state.live, speed } } : state;
}

export const skip = (state: DeskState, seconds: number): DeskState => (SKIPS.includes(seconds) ? advance(state, seconds) : state);

/** Back to second 0 of this live: the platform and products as they were when it started. */
export function reset(state: DeskState): DeskState {
  if (!isLive(state)) return state;
  const { live } = state;
  const fresh: LiveRecord = {
    ...live, elapsedSec: 0, running: false, showingProductId: null, showingSinceSec: 0, lastShownAtSec: {}, viewers: null, viewerPoints: [],
    cartsPerMinute: [], comments: [], carts: [], markers: [], suggestions: [], nextSuggestionId: 1, aiStatus: "rules_only", banner: null,
    halted: false, digest: null,
  };
  return { ...state, nowMs: live.startedAtMs, world: live.atStart.world, products: live.atStart.products, live: fresh };
}

/** Free pin: any time during the live, any synced product, no schedule, no cooldown, no confirmation. */
export function pin(state: DeskState, productId: string): DeskState {
  if (!isLive(state) || !state.products.some((p) => p.id === productId && p.sync.state === "synced")) return state;
  const r = adapter.pin(state.world, productId, state.nowMs);
  let live = settle(act(state.live, `pin:${productId}`), r.outcome);
  if (r.outcome.ok) live = marker(state, live, "pin", productId, live.elapsedSec);
  return afterPlatform({ ...state, world: r.world, live }, live.elapsedSec);
}

/** Free unpin: a normal button. The call behind it is LiveLift's guess (unpin_show_item), labelled so everywhere. */
export function unpin(state: DeskState): DeskState {
  if (!isLive(state)) return state;
  const was = state.live.showingProductId;
  const r = adapter.unpin(state.world, state.nowMs);
  let live = settle(act(state.live, "unpin"), r.outcome);
  if (r.outcome.ok && was) live = marker(state, live, "unpin", was, live.elapsedSec);
  return afterPlatform({ ...state, world: r.world, live }, live.elapsedSec);
}

/** Accepting is the operator's click. A show_next pins the product; a flash sale schedules a promotion a minute out. */
export function acceptSuggestionAction(state: DeskState, suggestionId: string): DeskState {
  if (!isLive(state)) return state;
  const moved = acceptSuggestion(state.live.suggestions, suggestionId);
  if (!moved.moved) return state;
  const accepted = moved.moved;
  const base: LiveState = { ...state, live: act({ ...state.live, suggestions: moved.list }, `accept:${suggestionId}`) };
  if (accepted.kind === "show_next") return pin(base, accepted.productId);
  const startMs = base.nowMs + 60_000;
  const r = adapter.schedulePromotion(base.world, accepted.productId, startMs, startMs + 600_000, `Flash sale ${nameOf(base, accepted.productId)} (SIMULATED)`, base.nowMs);
  let live = settle(base.live, r.outcome);
  if (r.promotionId !== null) live = { ...live, suggestions: withPromotion(live.suggestions, suggestionId, r.promotionId) };
  return afterPlatform({ ...base, world: r.world, live }, live.elapsedSec);
}

export function dismissSuggestionAction(state: DeskState, suggestionId: string): DeskState {
  if (!isLive(state)) return state;
  const moved = dismissSuggestion(state.live.suggestions, suggestionId);
  return moved.moved ? { ...state, live: act({ ...state.live, suggestions: moved.list }, `dismiss:${suggestionId}`) } : state;
}

/** A model's reworded ranking (copilot/ai, server side) applied to the proposed suggestions. */
export function applyCopilotAi(state: DeskState, result: { aiStatus: CopilotAiStatus; candidates: SourcedCandidate[] }): DeskState {
  if (!isLive(state)) return state;
  const merged = mergeCandidates(state.live.suggestions, result.candidates, state.live.elapsedSec, state.live.nextSuggestionId);
  return { ...state, live: { ...state.live, aiStatus: result.aiStatus, suggestions: merged.list, nextSuggestionId: merged.nextId } };
}

export function endLive(state: DeskState): DeskState {
  if (!isLive(state)) return state;
  const r = adapter.endLive(state.world, state.nowMs);
  if (!r.outcome.ok) return { ...state, world: r.world, live: settle(state.live, r.outcome) };
  return { ...state, world: r.world, live: { ...showing(act(state.live, "end"), null, state.live.elapsedSec), mode: "ended", running: false } };
}

// ---- The simulation's own controls (not operator actions) ----------------------------------------------------------------

/** The host's hands in the SIMULATED host app. LiveLift learns of it only by reading the platform. */
export function hostAction(state: DeskState, action: { type: "pin"; productId: string } | { type: "unpin" }): DeskState {
  if (action.type === "unpin") return { ...state, world: { ...state.world, sim: hostAct(state.world.sim, state.nowMs, { type: "unpin_item" }).sim } };
  const link = state.world.sync.links.find((l) => l.productId === action.productId);
  if (!link) return state;
  return { ...state, world: { ...state.world, sim: hostAct(state.world.sim, state.nowMs, { type: "pin_item", itemId: link.itemId }).sim } };
}

/** Put the SIMULATED platform into a condition (authorisation expired, rate limit, server error), or clear it. */
export const setPlatformFault = (state: DeskState, fault: ShopeeFault | null): DeskState => ({ ...state, world: { ...state.world, sim: withFault(state.world.sim, fault) } });

// ---- View models ----------------------------------------------------------------------------------------------------------

function productViews(state: DeskState): DeskProduct[] {
  const showingId = state.live?.mode === "live" ? state.live.showingProductId : null;
  return state.products.map((p) => ({
    id: p.id, name: p.name, priceLabel: priceLabel(p.price, p.currency), stock: p.stock,
    sync: { ...p.sync }, showing: p.id === showingId,
  }));
}

export function buildStartView(state: DeskState): StartViewModel {
  return { platformLabel: PLATFORM_LABEL, connected: state.connected, products: productViews(state), startBlockedReason: startBlockedReason(state), importNote: state.importNote };
}

function chart(title: string, unit: string, points: Array<{ atSec: number; value: number }>, markers: DeskChart["markers"], span: string): DeskChart {
  const values = points.map((p) => p.value);
  const summary = points.length === 0
    ? `${title}: nothing yet. Markers show when you acted, not what caused a change.`
    : `${title}: ${points.length} point${points.length === 1 ? "" : "s"} over ${span}, from ${values[0]} to ${values[values.length - 1]} ${unit}, highest ${Math.max(...values)}. ${markers.length} marker${markers.length === 1 ? "" : "s"}. Markers show when you acted, not what caused a change.`;
  return { title, unit, points, markers, summary };
}

const AI_STATUS_LABEL: Record<CopilotAiStatus, string> = {
  rules_only: "Rules only (SIMULATED data)",
  ai_ok: "AI model, rules as fallback (SIMULATED data)",
  ai_fallback: "AI model unavailable, showing rules (SIMULATED data)",
};

/** Like the Lab's: the generated events and both platform logs, folded into eight hex characters. */
export function fingerprintOf(state: DeskState): string | null {
  if (!state.live?.digest) return null;
  return fold(state.live.digest, callLogDigest(state.world.sim.ledger, readsOf(state.world)));
}

/** The Live Desk view for this live id, or null when the id is not this desk's live. */
export function buildDeskView(state: DeskState, liveId: string): LiveDeskViewModel | null {
  const live = state.live;
  if (!live || live.id !== liveId) return null;
  const markers = live.markers.map((m) => ({ atSec: m.atSec, kind: m.kind, label: m.label }));
  const recent = live.comments.filter((c) => c.atSec > live.elapsedSec - INTENT_WINDOW_SEC);
  const intentCounts = Object.fromEntries(COMMENT_INTENTS.map((i) => [i, recent.filter((c) => c.intent === i).length])) as Record<CommentIntent, number>;
  const span = elapsedLabel(live.elapsedSec);
  return {
    mode: live.mode,
    title: live.title,
    platformLabel: PLATFORM_LABEL,
    clock: { running: live.running, speed: live.speed, speeds: SPEEDS, elapsedLabel: elapsedLabel(live.elapsedSec), virtualNowLabel: clockLabel(live.startedAtMs + live.elapsedSec * 1000) },
    products: productViews(state),
    showingProductId: live.mode === "live" ? live.showingProductId : null,
    viewers: live.viewers,
    comments: live.comments.slice(-VIEW_COMMENTS).reverse().map((c) => ({ id: c.id, atSec: c.atSec, user: c.user, text: c.text, intent: c.intent, piiMasked: c.piiMasked })),
    intentCounts,
    charts: {
      viewers: chart("Viewers (SIMULATED)", "viewers", live.viewerPoints.map((p) => ({ ...p })), markers, span),
      addToCart: chart("Add to cart per minute, product on show (SIMULATED)", "per minute", live.cartsPerMinute.map((value, m) => ({ atSec: m * 60, value })), markers, span),
    },
    copilot: {
      aiStatus: live.aiStatus,
      statusLabel: AI_STATUS_LABEL[live.aiStatus],
      suggestions: [...live.suggestions].sort((a, b) => b.atSec - a.atSec).map(toSuggestionView),
    },
    banner: live.banner ? { ...live.banner } : null,
    fingerprint: fingerprintOf(state),
    assumptions: [...ASSUMPTIONS],
  };
}
