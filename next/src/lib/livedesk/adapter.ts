/**
 * The Live Desk's one door to a live platform, and its SIMULATED Live implementation.
 *
 * `LivePlatformAdapter` is platform-neutral: products in, live started, pin, unpin, what is showing, metrics. The
 * only implementation is `simulatedShopeeAdapter`, which wraps the existing simulated platform (`shopeeLive.ts`) and
 * sync bridge (`sync.ts`). It forks neither: every write is a `callShopee`, a pin is `pinFromLiveLift`, a read is
 * `pollPlatform` and a host change is found by `diffSnapshots`, exactly as the Lab and Operate use them.
 *
 * Pure functions: world in, world out. Every read is kept in the world's read log (`logReads`), never in the call log.
 *
 * What is shape inferred and what is a guess:
 * - `pin` uses `update_show_item`, the one call copied from Shopee's published reference.
 * - Every other call is shape inferred (`ENDPOINT_BASIS`).
 * - `unpin` uses `unpin_show_item`, which is LiveLift's guess: no Shopee page was found for it (`GUESSED_ENDPOINTS`).
 * - The SIMULATED shop's catalog holds every product the operator imports, the way the Lab's shop holds the show's
 *   pack. There is no catalog call in the simulation, so adding to it is not a platform call and is not logged.
 * - `add_item_list` needs a live, so the first product sync opens one (`create_session`, status "created", not on
 *   air). `startLive` then starts it, opening one first when none is waiting.
 * - `readMetrics` is the seeded generator (`engine.ts`). SIMULATED Live serves no live metrics of its own.
 */
import {
  SIM_SHOP_ID, callShopee, createShopeeLiveSim, diffSnapshots, logReads, pinFromLiveLift, pollPlatform,
  type PlatformSnapshot, type PlatformWorld, type ShopeeEndpoint, type ShopeeEnvelope, type ShopeeLiveSim, type SyncState,
} from "@/lib/platform";
import { simulateSecond, type EngineWorld, type SecondEvents } from "./engine";

export const PLATFORM_LABEL = "SIMULATED Live";
/** The title of the live the adapter opens while products sync, before Start live. */
export const PREPARED_LIVE_TITLE = "LiveLift Live Desk (SIMULATED)";

export interface AdapterProduct {
  productId: string;
  name: string;
  price: number | null;
  currency: string;
}

/** A platform condition the desk must stop for and say once. `refused` is any other refusal, in the platform's words. */
export type PlatformCondition = "auth_expired" | "rate_limited" | "server_error" | "region_unsupported" | "refused";

export type PlatformOutcome =
  | { ok: true; requestId: string | null }
  | { ok: false; condition: PlatformCondition; message: string; requestId: string | null };

export type ProductSyncResult = { productId: string; ok: true } | { productId: string; ok: false; detail: string };

export type ShowingNow = { state: "product"; productId: string } | { state: "none" } | { state: "unobservable" } | { state: "unknown_item"; itemId: number };

/** Something the host did in the app, found by reading the platform: provider observed, SIMULATED. */
export type HostChange = { kind: "host_pin"; productId: string } | { kind: "host_unpin"; productId: string };

export interface Observation {
  showing: ShowingNow;
  hostChanges: HostChange[];
  /** The live's status as read, null when there is no live or the read failed. */
  status: PlatformSnapshot["status"];
  promotions: PlatformSnapshot["promotions"];
  /** A failed read: nothing is known, nothing is reported as changed. */
  problem: { condition: PlatformCondition; message: string } | null;
}

export interface LivePlatformAdapter<W> {
  readonly label: string;
  syncProducts(world: W, products: readonly AdapterProduct[], nowMs: number): { world: W; results: ProductSyncResult[] };
  removeProduct(world: W, productId: string, nowMs: number): { world: W; outcome: PlatformOutcome };
  startLive(world: W, title: string, productIds: readonly string[], nowMs: number): { world: W; outcome: PlatformOutcome };
  endLive(world: W, nowMs: number): { world: W; outcome: PlatformOutcome };
  pin(world: W, productId: string, nowMs: number): { world: W; outcome: PlatformOutcome };
  unpin(world: W, nowMs: number): { world: W; outcome: PlatformOutcome };
  schedulePromotion(world: W, productId: string, startMs: number, endMs: number, name: string, nowMs: number): { world: W; outcome: PlatformOutcome; promotionId: number | null };
  observe(world: W, nowMs: number): { world: W; observation: Observation };
  readMetrics(seed: number, second: number, world: EngineWorld): SecondEvents;
}

// ---- Helpers ----------------------------------------------------------------------------------------------------------

const FIRST_ITEM_ID = 100001;

export function emptyPlatformWorld(): PlatformWorld {
  const sync: SyncState = { providerSessionId: null, openedByLiveLift: false, links: [], last: null, promotions: {}, promotionRefused: {}, problem: null };
  return { sim: createShopeeLiveSim(), sync, notices: [], nextNoticeId: 1, auto: true, readLog: { entries: [], next: 1 } };
}

/** Which condition a refusal is. The words are the platform's own; the condition only decides the banner's tone. */
export function conditionOf(error: string, message: string): PlatformCondition {
  if (error === "error_auth") return "auth_expired";
  if (error === "error_server" && /too many requests/i.test(message)) return "rate_limited";
  if (error === "error_server" && /region/i.test(message)) return "region_unsupported";
  if (error === "error_server") return "server_error";
  return "refused";
}

const outcomeOf = (envelope: ShopeeEnvelope): PlatformOutcome =>
  envelope.error === ""
    ? { ok: true, requestId: envelope.request_id }
    : { ok: false, condition: conditionOf(envelope.error, envelope.message), message: envelope.message, requestId: envelope.request_id };

/** The platform's words for a failed call, as a product's sync detail shows them. */
const detailOf = (envelope: ShopeeEnvelope): string => `${envelope.error}: ${envelope.message}`;

/** Re-read the platform and make that the baseline, so LiveLift's own changes are never reported back as observed. */
function rebase(world: PlatformWorld, nowMs: number): PlatformWorld {
  const polled = pollPlatform(world.sim, world.sync, nowMs);
  const sync = polled.snapshot.problem ? world.sync : { ...world.sync, last: polled.snapshot };
  return logReads({ ...world, sim: polled.sim, sync }, polled.reads);
}

const liveStatus = (sim: ShopeeLiveSim, sessionId: number | null) => (sessionId === null ? null : sim.sessions[sessionId]?.status ?? null);

function call(world: PlatformWorld, nowMs: number, endpoint: ShopeeEndpoint, params: Record<string, unknown>): { world: PlatformWorld; envelope: ShopeeEnvelope } {
  const r = callShopee(world.sim, nowMs, endpoint, params);
  return { world: { ...world, sim: r.sim }, envelope: r.envelope };
}

/** Open a live in its "created" state when there is none waiting, so products can be added to it. */
function ensurePreparedLive(world: PlatformWorld, title: string, nowMs: number): { world: PlatformWorld; failure: ShopeeEnvelope | null } {
  const status = liveStatus(world.sim, world.sync.providerSessionId);
  if (status === "created" || status === "ongoing") return { world, failure: null };
  const r = call(world, nowMs, "create_session", { title });
  if (r.envelope.error !== "" || typeof r.envelope.response.session_id !== "number") return { world: r.world, failure: r.envelope };
  // A new live has nothing in it: the old baseline belongs to the previous live.
  return { world: { ...r.world, sync: { ...r.world.sync, providerSessionId: r.envelope.response.session_id, openedByLiveLift: true, last: null } }, failure: null };
}

function linkFor(world: PlatformWorld, product: AdapterProduct): PlatformWorld {
  if (world.sync.links.some((l) => l.productId === product.productId)) return world;
  const itemId = Math.max(FIRST_ITEM_ID - 1, ...world.sync.links.map((l) => l.itemId)) + 1;
  const links = [...world.sync.links, { productId: product.productId, itemId, shopId: SIM_SHOP_ID }];
  const catalog = [...world.sim.catalog, { itemId, shopId: SIM_SHOP_ID, name: product.name, price: product.price, currency: product.currency }];
  return { ...world, sim: { ...world.sim, catalog }, sync: { ...world.sync, links } };
}

const productOfItem = (sync: SyncState, itemId: number): string | null => sync.links.find((l) => l.itemId === itemId)?.productId ?? null;

function showingOf(snapshot: PlatformSnapshot, sync: SyncState): ShowingNow {
  if (snapshot.showing.state === "none") return { state: "none" };
  if (snapshot.showing.state === "unobservable") return { state: "unobservable" };
  const productId = productOfItem(sync, snapshot.showing.itemId);
  return productId ? { state: "product", productId } : { state: "unknown_item", itemId: snapshot.showing.itemId };
}

const noLive: PlatformOutcome = { ok: false, condition: "refused", message: "No SIMULATED live is open yet.", requestId: null };

// ---- The SIMULATED Live adapter ----------------------------------------------------------------------------------

export const simulatedShopeeAdapter: LivePlatformAdapter<PlatformWorld> = {
  label: PLATFORM_LABEL,

  syncProducts(worldIn, products, nowMs) {
    let world = worldIn;
    const results: ProductSyncResult[] = [];
    for (const product of products) {
      world = linkFor(world, product);
      const prepared = ensurePreparedLive(world, PREPARED_LIVE_TITLE, nowMs);
      world = prepared.world;
      if (prepared.failure) {
        results.push({ productId: product.productId, ok: false, detail: detailOf(prepared.failure) });
        continue;
      }
      const link = world.sync.links.find((l) => l.productId === product.productId)!;
      const r = call(world, nowMs, "add_item_list", { session_id: world.sync.providerSessionId, item_list: [{ item_id: link.itemId, shop_id: link.shopId }] });
      world = r.world;
      results.push(r.envelope.error === "" ? { productId: product.productId, ok: true } : { productId: product.productId, ok: false, detail: detailOf(r.envelope) });
    }
    return { world: products.length > 0 ? rebase(world, nowMs) : world, results };
  },

  removeProduct(world, productId, nowMs) {
    const link = world.sync.links.find((l) => l.productId === productId);
    const status = liveStatus(world.sim, world.sync.providerSessionId);
    if (!link || (status !== "created" && status !== "ongoing")) return { world, outcome: { ok: true, requestId: null } };
    const r = call(world, nowMs, "delete_item_list", { session_id: world.sync.providerSessionId, item_list: [{ item_id: link.itemId, shop_id: link.shopId }] });
    return { world: rebase(r.world, nowMs), outcome: outcomeOf(r.envelope) };
  },

  startLive(worldIn, title, productIds, nowMs) {
    let world = worldIn;
    const waiting = liveStatus(world.sim, world.sync.providerSessionId) === "created";
    if (!waiting) {
      const prepared = ensurePreparedLive(world, title, nowMs);
      world = prepared.world;
      if (prepared.failure) return { world: rebase(world, nowMs), outcome: outcomeOf(prepared.failure) };
      const items = world.sync.links.filter((l) => productIds.includes(l.productId)).map((l) => ({ item_id: l.itemId, shop_id: l.shopId }));
      if (items.length > 0) {
        const added = call(world, nowMs, "add_item_list", { session_id: world.sync.providerSessionId, item_list: items });
        world = added.world;
        if (added.envelope.error !== "") return { world: rebase(world, nowMs), outcome: outcomeOf(added.envelope) };
      }
    }
    const r = call(world, nowMs, "start_session", { session_id: world.sync.providerSessionId });
    return { world: rebase(r.world, nowMs), outcome: outcomeOf(r.envelope) };
  },

  endLive(world, nowMs) {
    if (world.sync.providerSessionId === null) return { world, outcome: noLive };
    const r = call(world, nowMs, "end_session", { session_id: world.sync.providerSessionId });
    return { world: rebase(r.world, nowMs), outcome: outcomeOf(r.envelope) };
  },

  pin(world, productId, nowMs) {
    const r = pinFromLiveLift(world.sim, world.sync, productId, nowMs);
    const next = logReads({ ...world, sim: r.sim, sync: r.sync }, r.reads);
    if (r.outcome.ok) return { world: next, outcome: { ok: true, requestId: r.outcome.requestId } };
    const requestId = r.outcome.requestId ?? null;
    const refused = requestId === null ? undefined : next.sim.ledger.find((e) => e.kind === "api" && e.envelope.request_id === requestId);
    const condition = refused?.kind === "api" ? conditionOf(refused.envelope.error, refused.envelope.message) : "refused";
    return { world: next, outcome: { ok: false, condition, message: r.outcome.message, requestId } };
  },

  unpin(world, nowMs) {
    if (world.sync.providerSessionId === null) return { world, outcome: noLive };
    const r = call(world, nowMs, "unpin_show_item", { session_id: world.sync.providerSessionId });
    return { world: rebase(r.world, nowMs), outcome: outcomeOf(r.envelope) };
  },

  schedulePromotion(world, productId, startMs, endMs, name, nowMs) {
    const link = world.sync.links.find((l) => l.productId === productId);
    if (!link) return { world, outcome: { ok: false, condition: "refused", message: "This product is not on SIMULATED Live.", requestId: null }, promotionId: null };
    const r = call(world, nowMs, "create_promotion", {
      name, start_time: Math.floor(startMs / 1000), end_time: Math.floor(endMs / 1000), item_list: [{ item_id: link.itemId, shop_id: link.shopId }],
    });
    const id = r.envelope.response.promotion_id;
    return { world: rebase(r.world, nowMs), outcome: outcomeOf(r.envelope), promotionId: typeof id === "number" ? id : null };
  },

  observe(world, nowMs) {
    const polled = pollPlatform(world.sim, world.sync, nowMs);
    const logged = logReads({ ...world, sim: polled.sim }, polled.reads);
    const snap = polled.snapshot;
    if (snap.problem) {
      const problem = { condition: conditionOf(snap.problem.error, snap.problem.message), message: snap.problem.message };
      return { world: logged, observation: { showing: { state: "unobservable" }, hostChanges: [], status: null, promotions: [], problem } };
    }
    const hostChanges: HostChange[] = [];
    for (const o of diffSnapshots(world.sync.last, snap)) {
      if (o.kind !== "showing_changed") continue;
      const from = o.from.state === "item" ? productOfItem(world.sync, o.from.itemId) : null;
      const to = o.to.state === "item" ? productOfItem(world.sync, o.to.itemId) : null;
      // A new pin replaces the old one: that is one host pin, not an unpin and a pin.
      if (to) hostChanges.push({ kind: "host_pin", productId: to });
      else if (from) hostChanges.push({ kind: "host_unpin", productId: from });
    }
    const next = { ...logged, sync: { ...logged.sync, last: snap } };
    return { world: next, observation: { showing: showingOf(snap, world.sync), hostChanges, status: snap.status, promotions: snap.promotions, problem: null } };
  },

  readMetrics: simulateSecond,
};
