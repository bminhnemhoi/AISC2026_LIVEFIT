/**
 * The two-way bridge between a LiveLift show and a platform live.
 *
 * Outbound (LiveLift -> platform): open the live, put the show's products in it, pin, schedule promotions.
 * Inbound  (platform -> LiveLift): read what the platform now shows and turn each change into an ordinary,
 * labelled LiveLift record, so a pin the host made in the app lands in Review like any other action.
 *
 * Rules this file keeps:
 * - It only issues a call the capability table allows. Where there is no API the answer is `unsupported`, and the
 *   operator acts natively and reports it as before.
 * - An accepted API call is recorded as "performed" with the request id, and the existing record keeps saying
 *   `platform verification unknown`: an accepted request is not the platform confirming what viewers see.
 * - A refused call is recorded as "attempted" with the platform's own message, never as performed.
 * - What LiveLift changes itself is never reported back to it as "observed": every outbound step re-reads the platform
 *   and stores that as the new baseline.
 * - Reads are traffic, not changes. They never touch the platform's call log; every function returns its reads so the
 *   caller can keep them in a separate, bounded read log.
 * - Pure functions only. State in, state out; the caller persists it and dispatches the commands.
 */
import type { ProductSnapshot, Session } from "@/contracts";
import { currentPlan, type CommandBody } from "@/lib/domain";
import { canCallApi } from "./capabilities";
import {
  SIM_SHOP_ID, callShopee, promotionStatus, readShopee,
  type ShopeeEndpoint, type ShopeeLiveSim, type ShopeeRead, type SimItem, type SimSessionStatus,
} from "./shopeeLive";

// ---- Product links ---------------------------------------------------------------------------------------------------

export interface ProductLink {
  productId: string;
  itemId: number;
  shopId: number;
}

export interface SyncState {
  /** The platform's live that this show is tied to. null until one is opened or linked. */
  providerSessionId: number | null;
  /** True when LiveLift opened that live itself (create_session). A live linked by hand is the host's, never assumed ours. */
  openedByLiveLift: boolean;
  links: ProductLink[];
  /** What LiveLift last read. The next read is compared with this. */
  last: PlatformSnapshot | null;
  /** LiveLift segment id -> platform promotion id, so a promotion is scheduled once. */
  promotions: Record<string, number>;
  /** LiveLift segment id -> the platform's refusal. A refused promotion is not retried silently. */
  promotionRefused: Record<string, string>;
  /** The platform's latest refusal or read failure, so a repeated one is told to the operator once, not every cycle. */
  problem: string | null;
}

const FIRST_ITEM_ID = 100001;

/** Deterministic links for a show's pack: the demo shop sells exactly the products the show plans to use. */
export function linkProducts(products: readonly ProductSnapshot[], shopId: number = SIM_SHOP_ID): ProductLink[] {
  return products.map((p, i) => ({ productId: p.id, itemId: FIRST_ITEM_ID + i, shopId }));
}

export function catalogFromProducts(products: readonly ProductSnapshot[], links: readonly ProductLink[]): SimItem[] {
  return links.flatMap((link) => {
    const p = products.find((x) => x.id === link.productId);
    return p ? [{ itemId: link.itemId, shopId: link.shopId, name: p.name, price: p.price, currency: p.currency }] : [];
  });
}

export function initialSyncState(session: Pick<Session, "products">): SyncState {
  return { providerSessionId: null, openedByLiveLift: false, links: linkProducts(session.products), last: null, promotions: {}, promotionRefused: {}, problem: null };
}

/** A platform item that LiveLift has no product for: shown as an offer to import, never imported silently. */
export function importableItems(catalog: readonly SimItem[], links: readonly ProductLink[]): SimItem[] {
  const known = new Set(links.map((l) => l.itemId));
  return catalog.filter((c) => !known.has(c.itemId));
}

export function productFromItem(item: SimItem): ProductSnapshot {
  const words = item.name.split(/\s+/).filter(Boolean);
  return {
    id: `shopee_${item.itemId}`,
    code: `SHP-${item.itemId}`,
    name: item.name,
    price: item.price,
    currency: item.currency,
    priority: "normal",
    status: "enabled",
    talkingPoints: [],
    constraints: [],
    initials: (words[0]?.[0] ?? "P") + (words[1]?.[0] ?? ""),
    source: "import",
  };
}

const linkOfProduct = (sync: SyncState, productId: string): ProductLink | undefined => sync.links.find((l) => l.productId === productId);
const linkOfItem = (sync: SyncState, itemId: number): ProductLink | undefined => sync.links.find((l) => l.itemId === itemId);

/** The enabled products the current plan actually uses, in pack order. */
export function plannedProductIds(session: Session): string[] {
  const plan = currentPlan(session);
  const used = new Set<string>();
  for (const s of plan.segments) if (s.productId) used.add(s.productId);
  for (const c of plan.cues) if (c.productId) used.add(c.productId);
  return session.products.filter((p) => p.status === "enabled" && used.has(p.id)).map((p) => p.id);
}

// ---- Reading the platform --------------------------------------------------------------------------------------------

export type Showing = { state: "item"; itemId: number } | { state: "none" } | { state: "unobservable" };

export interface PlatformSnapshot {
  takenAtMs: number;
  providerSessionId: number | null;
  status: SimSessionStatus | null;
  itemIds: number[];
  showing: Showing;
  promotions: Array<{ id: number; name: string; startMs: number; endMs: number }>;
  /** The first read that failed. A failed read is "unknown", never "nothing changed". */
  problem: { error: string; message: string } | null;
}

/** Read what the platform shows now. Reads change nothing, so `sim` comes back as it went in; the reads are returned for the read log. */
export function pollPlatform(sim: ShopeeLiveSim, sync: SyncState, nowMs: number): { sim: ShopeeLiveSim; snapshot: PlatformSnapshot; reads: ShopeeRead[] } {
  const reads: ShopeeRead[] = [];
  let problem: PlatformSnapshot["problem"] = null;
  const read = (endpoint: ShopeeEndpoint, params: Record<string, unknown>): Record<string, unknown> | null => {
    const r = readShopee(sim, nowMs, endpoint, params);
    reads.push(r.read);
    if (!r.ok) {
      problem ??= { error: r.read.error, message: r.read.message };
      return null;
    }
    return r.read.response;
  };

  const promo = read("get_promotion_list", {});
  const promotions = Array.isArray(promo?.promotion_list)
    ? (promo.promotion_list as Array<Record<string, unknown>>).map((p) => ({
        id: Number(p.promotion_id), name: String(p.name), startMs: Number(p.start_time) * 1000, endMs: Number(p.end_time) * 1000,
      }))
    : [];

  let status: SimSessionStatus | null = null;
  let itemIds: number[] = [];
  let showing: Showing = { state: "none" };
  if (sync.providerSessionId !== null) {
    const detail = read("get_session_detail", { session_id: sync.providerSessionId });
    const items = read("get_item_list", { session_id: sync.providerSessionId });
    if (detail) {
      status = detail.status as SimSessionStatus;
      showing = "showing_item_id" in detail
        ? detail.showing_item_id === null ? { state: "none" } : { state: "item", itemId: Number(detail.showing_item_id) }
        : { state: "unobservable" };
    } else {
      showing = { state: "unobservable" };
    }
    if (items && Array.isArray(items.item_list)) itemIds = (items.item_list as Array<Record<string, unknown>>).map((i) => Number(i.item_id));
  }
  return { sim, snapshot: { takenAtMs: nowMs, providerSessionId: sync.providerSessionId, status, itemIds, showing, promotions, problem }, reads };
}

/**
 * Re-read the platform and make that the baseline, so LiveLift's own changes are not echoed back as "observed".
 * A read that fails is unknown, not empty: the last good baseline stays, and the next good read is compared with it.
 */
function rebase(sim: ShopeeLiveSim, sync: SyncState, nowMs: number): { sim: ShopeeLiveSim; sync: SyncState; reads: ShopeeRead[] } {
  const polled = pollPlatform(sim, sync, nowMs);
  return { sim: polled.sim, sync: polled.snapshot.problem ? sync : { ...sync, last: polled.snapshot }, reads: polled.reads };
}

// ---- Outbound --------------------------------------------------------------------------------------------------------

export interface SyncCall {
  endpoint: ShopeeEndpoint;
  ok: boolean;
  message: string;
  requestId: string;
  why: string;
}

export interface OutboundResult {
  sim: ShopeeLiveSim;
  sync: SyncState;
  calls: SyncCall[];
  /** The call that stopped the sequence, if any. Later steps are not attempted after a refusal. */
  blocked: SyncCall | null;
  /** The re-read after the calls, for the read log. */
  reads: ShopeeRead[];
}

/**
 * Make the platform match the show's lifecycle: open the live and load its products when the show starts, load products
 * that were added later, and end the live when the show ends. It never removes anything the host added in the app.
 */
export function reconcileOutbound(sim: ShopeeLiveSim, session: Session, syncIn: SyncState, nowMs: number): OutboundResult {
  let cur = sim;
  let sync = syncIn;
  const calls: SyncCall[] = [];
  let blocked: SyncCall | null = null;

  const step = (endpoint: ShopeeEndpoint, params: Record<string, unknown>, why: string): Record<string, unknown> | null => {
    if (blocked) return null;
    const r = callShopee(cur, nowMs, endpoint, params);
    cur = r.sim;
    const call: SyncCall = { endpoint, ok: r.ok, message: r.envelope.message, requestId: r.envelope.request_id, why };
    calls.push(call);
    if (!r.ok) {
      blocked = call;
      return null;
    }
    return r.envelope.response;
  };

  const wanted = plannedProductIds(session).flatMap((id) => {
    const link = linkOfProduct(sync, id);
    return link ? [{ item_id: link.itemId, shop_id: link.shopId }] : [];
  });

  if (session.lifecycle === "active") {
    if (!canCallApi("shopee_live", "start_live")) return { sim: cur, sync, calls, blocked, reads: [] };
    let createdNow = false;
    if (sync.providerSessionId === null) {
      const created = step("create_session", { title: session.title }, "The show started: open a live on the platform");
      if (created && typeof created.session_id === "number") {
        sync = { ...sync, providerSessionId: created.session_id, openedByLiveLift: true };
        createdNow = true;
      }
    }
    if (sync.providerSessionId !== null && !blocked) {
      const sid = sync.providerSessionId;
      const have = new Set((sync.last?.itemIds ?? []) as number[]);
      const missing = createdNow ? wanted : wanted.filter((w) => !have.has(w.item_id));
      const loaded = missing.length > 0 && step("add_item_list", { session_id: sid, item_list: missing }, `Load ${missing.length} product${missing.length === 1 ? "" : "s"} from the run of show`) !== null;
      // A live LiveLift opened whose product load was refused is resumed once the load succeeds. Never a live it did not
      // open, never one that ended, and never every cycle: only when this cycle's load is what was missing.
      const resume = loaded && sync.openedByLiveLift && sync.last?.status === "created";
      if (createdNow || resume) step("start_session", { session_id: sid }, createdNow ? "Go live" : "Products loaded: go live");
    }
  } else if (session.lifecycle === "ended" && sync.providerSessionId !== null && sync.last?.status === "ongoing") {
    step("end_session", { session_id: sync.providerSessionId }, "The show ended: end the live on the platform");
  }

  // Nothing was changed, so there is nothing to re-read: the baseline stays as the last poll left it.
  if (calls.length === 0) return { sim: cur, sync, calls, blocked, reads: [] };
  const based = rebase(cur, sync, nowMs);
  return { sim: based.sim, sync: based.sync, calls, blocked, reads: based.reads };
}

/**
 * Schedule one promotion per hard-anchored promotion segment (a "flash sale at 20:12"). Shopee promotions are scheduled
 * ahead of time, so this is what an anchor can honestly map to; nothing found fires one inside a live.
 */
export function schedulePromotions(sim: ShopeeLiveSim, session: Session, syncIn: SyncState, nowMs: number): OutboundResult {
  let cur = sim;
  let sync = syncIn;
  const calls: SyncCall[] = [];
  let blocked: SyncCall | null = null;
  if (!canCallApi("shopee_live", "promotion")) return { sim, sync, calls, blocked, reads: [] };
  const plan = currentPlan(session);
  for (const seg of plan.segments) {
    if (blocked || seg.kind !== "promotion" || seg.anchorOffsetSec === null) continue;
    if (sync.promotions[seg.id] !== undefined || sync.promotionRefused[seg.id] !== undefined) continue;
    const link = (seg.productId ? linkOfProduct(sync, seg.productId) : undefined) ?? sync.links[0];
    if (!link) continue;
    const startMs = plan.plannedStartMs + seg.anchorOffsetSec * 1000;
    const r = callShopee(cur, nowMs, "create_promotion", {
      name: seg.title,
      start_time: Math.floor(startMs / 1000),
      end_time: Math.floor(startMs / 1000) + (seg.targetSec ?? 900),
      item_list: [{ item_id: link.itemId, shop_id: link.shopId }],
    });
    cur = r.sim;
    const call: SyncCall = { endpoint: "create_promotion", ok: r.ok, message: r.envelope.message, requestId: r.envelope.request_id, why: `Anchor "${seg.title}"` };
    calls.push(call);
    if (!r.ok) {
      blocked = call;
      sync = { ...sync, promotionRefused: { ...sync.promotionRefused, [seg.id]: r.envelope.message } };
    } else if (typeof r.envelope.response.promotion_id === "number") {
      sync = { ...sync, promotions: { ...sync.promotions, [seg.id]: r.envelope.response.promotion_id } };
    }
  }
  if (calls.length === 0) return { sim: cur, sync, calls, blocked, reads: [] };
  const based = rebase(cur, sync, nowMs);
  return { sim: based.sim, sync: based.sync, calls, blocked, reads: based.reads };
}

export type PinOutcome =
  | { ok: true; requestId: string }
  | { ok: false; reason: "unsupported" | "not_linked" | "no_live" | "api_error"; message: string; requestId?: string };

/** Pin a product on the platform. Adds it to the live first when the live does not have it yet. */
export function pinFromLiveLift(sim: ShopeeLiveSim, syncIn: SyncState, productId: string, nowMs: number): { sim: ShopeeLiveSim; sync: SyncState; outcome: PinOutcome; reads: ShopeeRead[] } {
  const fail = (cur: ShopeeLiveSim, sync: SyncState, reason: Extract<PinOutcome, { ok: false }>["reason"], message: string, requestId?: string, reads: ShopeeRead[] = []) =>
    ({ sim: cur, sync, outcome: { ok: false, reason, message, ...(requestId ? { requestId } : {}) } as PinOutcome, reads });
  if (!canCallApi("shopee_live", "pin")) return fail(sim, syncIn, "unsupported", "This platform has no pin API. Pin it in the app and report it.");
  const link = linkOfProduct(syncIn, productId);
  if (!link) return fail(sim, syncIn, "not_linked", "This product is not in the platform catalog.");
  if (syncIn.providerSessionId === null) return fail(sim, syncIn, "no_live", "No platform live is linked to this show yet.");
  const sid = syncIn.providerSessionId;
  let cur = sim;
  if (!syncIn.last?.itemIds.includes(link.itemId)) {
    const add = callShopee(cur, nowMs, "add_item_list", { session_id: sid, item_list: [{ item_id: link.itemId, shop_id: link.shopId }] });
    cur = add.sim;
    if (!add.ok) {
      const based = rebase(cur, syncIn, nowMs);
      return fail(based.sim, based.sync, "api_error", add.envelope.message, add.envelope.request_id, based.reads);
    }
  }
  const pin = callShopee(cur, nowMs, "update_show_item", { session_id: sid, item_id: link.itemId, shop_id: link.shopId });
  const based = rebase(pin.sim, syncIn, nowMs);
  return pin.ok
    ? { sim: based.sim, sync: based.sync, outcome: { ok: true, requestId: pin.envelope.request_id }, reads: based.reads }
    : fail(based.sim, based.sync, "api_error", pin.envelope.message, pin.envelope.request_id, based.reads);
}

/** Tie the show to a live the host started in the app, by the session ID the host reads out. It is the host's live. */
export const linkSession = (sync: SyncState, sessionId: number): SyncState => ({ ...sync, providerSessionId: sessionId, openedByLiveLift: false, last: null });

/** Unpinning has no documented endpoint, so the answer is always the operator-assisted path. */
export function unpinFromLiveLift(): PinOutcome {
  return canCallApi("shopee_live", "unpin")
    ? { ok: false, reason: "api_error", message: "Unpin is not implemented." }
    : { ok: false, reason: "unsupported", message: "No endpoint clears the pinned product. Unpin it in the app, then report it here." };
}

// ---- Turning outcomes into LiveLift records --------------------------------------------------------------------------

/** The pending planned cue for this product and action, if the show has one. */
function openCue(session: Session, action: "pin_product" | "unpin_product", productId: string): string | null {
  const cue = currentPlan(session).cues.find((c) => {
    if (c.audience !== "operator" || c.action !== action || c.productId !== productId) return false;
    const state = session.runtime.cues[c.id]?.state ?? "pending";
    return state === "pending" || state === "attempted";
  });
  return cue?.id ?? null;
}

/** Record a pin/unpin as the planned cue when one is waiting, otherwise as an unplanned action. */
export function reportCommand(
  session: Session,
  action: "pin_product" | "unpin_product",
  productId: string,
  report: "performed" | "attempted",
  reason: string
): CommandBody {
  const cueId = openCue(session, action, productId);
  if (cueId) return { type: "report_cue", cueId, report, reason };
  return { type: "report_manual_action", action, productId, report, reason };
}

const ACCEPTED_PREFIX = "SIMULATED Live accepted the request";
const REFUSED_PREFIX = "SIMULATED Live refused";
// Rehearsals saved before the platform was renamed still carry these; they keep their source when read back.
const LEGACY_ACCEPTED_PREFIX = "Shopee (SIMULATED) accepted the request";
const LEGACY_REFUSED_PREFIX = "Shopee (SIMULATED) refused";
/** How a record of something the host did in the app begins. */
export const OBSERVED_PREFIX = "Provider observed (SIMULATED)";

export const acceptedReason = (requestId: string): string => `${ACCEPTED_PREFIX} · request_id ${requestId}`;
export const refusedReason = (message: string, requestId?: string): string => `${REFUSED_PREFIX}: ${message}${requestId ? ` · request_id ${requestId}` : ""}`;

/** Where a pin/unpin record came from, read back from the reason the bridge wrote. Anything else is the operator's own report. */
export type RecordSource = "request_accepted" | "request_refused" | "provider_observed" | "operator_reported";

export function recordSource(reason: string | null): RecordSource {
  if (reason?.startsWith(ACCEPTED_PREFIX) || reason?.startsWith(LEGACY_ACCEPTED_PREFIX)) return "request_accepted";
  if (reason?.startsWith(REFUSED_PREFIX) || reason?.startsWith(LEGACY_REFUSED_PREFIX)) return "request_refused";
  if (reason?.startsWith(OBSERVED_PREFIX)) return "provider_observed";
  return "operator_reported";
}

// ---- Inbound ---------------------------------------------------------------------------------------------------------

export type Observation =
  | { kind: "showing_changed"; from: Showing; to: Showing }
  | { kind: "item_added"; itemId: number }
  | { kind: "item_removed"; itemId: number }
  | { kind: "live_status_changed"; from: SimSessionStatus | null; to: SimSessionStatus | null }
  | { kind: "promotion_seen"; id: number; name: string; startMs: number }
  | { kind: "showing_unobservable" };

export function diffSnapshots(prev: PlatformSnapshot | null, next: PlatformSnapshot): Observation[] {
  // A failed read says nothing about the platform: no change is reported from it.
  if (!prev || next.problem) return [];
  const out: Observation[] = [];
  if (prev.status !== next.status) out.push({ kind: "live_status_changed", from: prev.status, to: next.status });
  for (const id of next.itemIds) if (!prev.itemIds.includes(id)) out.push({ kind: "item_added", itemId: id });
  for (const id of prev.itemIds) if (!next.itemIds.includes(id)) out.push({ kind: "item_removed", itemId: id });
  if (next.showing.state === "unobservable") {
    if (prev.showing.state !== "unobservable") out.push({ kind: "showing_unobservable" });
  } else if (prev.showing.state !== "unobservable") {
    const same = prev.showing.state === next.showing.state && (prev.showing.state === "none" || (prev.showing.state === "item" && next.showing.state === "item" && prev.showing.itemId === next.showing.itemId));
    if (!same) out.push({ kind: "showing_changed", from: prev.showing, to: next.showing });
  }
  for (const p of next.promotions) if (!prev.promotions.some((q) => q.id === p.id)) out.push({ kind: "promotion_seen", id: p.id, name: p.name, startMs: p.startMs });
  return out;
}

/**
 * What a notice is about, kept apart from its English sentence so the Lab can word it in either language.
 * Product names, item numbers and platform messages are original text and are never translated.
 */
export interface NoticeData {
  action?: "pinned" | "unpinned" | "added" | "removed";
  product?: string;
  itemId?: number;
  name?: string;
  message?: string;
}

export interface NoticeItem { code: string; summary: string; data?: NoticeData }

export type InboundAction =
  | { kind: "command"; command: CommandBody; summary: string; data: NoticeData }
  /** Nothing LiveLift may do by itself: it is shown to the operator as a notice. */
  | ({ kind: "notice" } & NoticeItem);

/** Turn what the platform now shows into LiveLift records or notices. */
export function inboundActions(session: Session, sync: SyncState, observations: readonly Observation[]): InboundAction[] {
  const out: InboundAction[] = [];
  const nameOf = (productId: string): string => session.products.find((p) => p.id === productId)?.name ?? productId;
  for (const o of observations) {
    switch (o.kind) {
      case "showing_changed": {
        if (o.to.state === "item") {
          const link = linkOfItem(sync, o.to.itemId);
          if (!link) { out.push({ kind: "notice", code: "unknown_item", summary: `The host pinned an item LiveLift has no product for (item ${o.to.itemId}). Import it from the catalog to track it.`, data: { action: "pinned", itemId: o.to.itemId } }); break; }
          out.push({ kind: "command", command: reportCommand(session, "pin_product", link.productId, "performed", `${OBSERVED_PREFIX}: the platform now shows this item`), summary: `Host pinned ${nameOf(link.productId)} on the platform`, data: { action: "pinned", product: nameOf(link.productId) } });
        } else if (o.from.state === "item") {
          const link = linkOfItem(sync, o.from.itemId);
          if (!link) break;
          out.push({ kind: "command", command: reportCommand(session, "unpin_product", link.productId, "performed", `${OBSERVED_PREFIX}: the platform no longer shows this item`), summary: `Host unpinned ${nameOf(link.productId)} on the platform`, data: { action: "unpinned", product: nameOf(link.productId) } });
        }
        break;
      }
      case "item_added": {
        const link = linkOfItem(sync, o.itemId);
        out.push({ kind: "notice", code: link ? "item_added_known" : "unknown_item", summary: link ? `The host added ${nameOf(link.productId)} to the live bag.` : `The host added an item LiveLift has no product for (item ${o.itemId}).`, data: link ? { action: "added", product: nameOf(link.productId) } : { action: "added", itemId: o.itemId } });
        break;
      }
      case "item_removed": {
        const link = linkOfItem(sync, o.itemId);
        out.push({ kind: "notice", code: "item_removed", summary: `The host removed ${link ? nameOf(link.productId) : `item ${o.itemId}`} from the live bag.`, data: link ? { action: "removed", product: nameOf(link.productId) } : { action: "removed", itemId: o.itemId } });
        break;
      }
      case "live_status_changed":
        if (o.to === "ended") out.push({ kind: "notice", code: "live_ended_on_platform", summary: "The live ended on the platform. End the LiveLift show when you are ready: LiveLift never ends it for you." });
        break;
      case "promotion_seen":
        out.push({ kind: "notice", code: "promotion_scheduled", summary: `A promotion "${o.name}" was scheduled on the platform.`, data: { name: o.name } });
        break;
      case "showing_unobservable":
        out.push({ kind: "notice", code: "showing_unobservable", summary: "The platform did not say which product is pinned. Pins made in the app must be reported by hand." });
        break;
    }
  }
  return out;
}

/** Describe a scheduled promotion's timing for the audience. */
export const promotionWords = (sim: ShopeeLiveSim, nowMs: number): Array<{ id: number; name: string; status: ReturnType<typeof promotionStatus>; createdBy: "api" | "host_app" }> =>
  sim.promotions.map((p) => ({ id: p.id, name: p.name, status: promotionStatus(p, nowMs), createdBy: p.createdBy }));

// ---- One full cycle --------------------------------------------------------------------------------------------------

/** Said once when the show ends and the live LiveLift opened never started. */
export const NEVER_ON_AIR =
  "The live LiveLift opened never went on air on SIMULATED Live, so LiveLift has nothing to end. If a live is still running in the live app, end it there.";

export interface CycleResult {
  sim: ShopeeLiveSim;
  sync: SyncState;
  /** Records for the show: what the host did on the platform. The caller dispatches them like any operator command. */
  commands: CommandBody[];
  /** Things the operator should know, each worded once. */
  notices: NoticeItem[];
  /** Writes only: what LiveLift asked the platform to change. */
  calls: SyncCall[];
  /** Every read this cycle made, in order, for the read log. A cycle with nothing new has reads and nothing else. */
  reads: ShopeeRead[];
}

/**
 * Read first, then write. Reading first means a change the host made is seen before LiveLift's own calls re-baseline the
 * platform; writing second brings the platform in line with the show. Calling it again with nothing new changes nothing:
 * no write, no record, no notice, and the platform state comes back byte for byte. Only its reads are returned.
 */
export function syncCycle(session: Session, simIn: ShopeeLiveSim, syncIn: SyncState, nowMs: number): CycleResult {
  let sim = simIn;
  let sync = syncIn;
  const commands: CommandBody[] = [];
  const notices: NoticeItem[] = [];
  const calls: SyncCall[] = [];
  const reads: ShopeeRead[] = [];
  let problem: string | null = null;

  if (sync.providerSessionId !== null) {
    const polled = pollPlatform(sim, sync, nowMs);
    sim = polled.sim;
    reads.push(...polled.reads);
    if (polled.snapshot.problem) {
      problem = `Could not read the platform: ${polled.snapshot.problem.message}`;
    } else {
      for (const a of inboundActions(session, sync, diffSnapshots(sync.last, polled.snapshot))) {
        if (a.kind === "command") {
          commands.push(a.command);
          notices.push({ code: "observed", summary: a.summary, data: a.data });
        } else notices.push({ code: a.code, summary: a.summary, ...(a.data ? { data: a.data } : {}) });
      }
      sync = { ...sync, last: polled.snapshot };
    }
  }

  if (session.lifecycle !== "planned") {
    const out = reconcileOutbound(sim, session, sync, nowMs);
    sim = out.sim;
    sync = out.sync;
    calls.push(...out.calls);
    reads.push(...out.reads);
    if (out.blocked) problem = `The platform refused ${out.blocked.endpoint}: ${out.blocked.message}`;
  }
  if (session.lifecycle === "active") {
    const out = schedulePromotions(sim, session, sync, nowMs);
    sim = out.sim;
    sync = out.sync;
    calls.push(...out.calls);
    reads.push(...out.reads);
    if (out.blocked) notices.push({ code: "promotion_refused", summary: `The platform refused the promotion: ${out.blocked.message}. It will not be retried until you ask.`, data: { message: out.blocked.message } });
  }

  // The live LiveLift opened never went on air (another live held the account, most likely). LiveLift cannot find or end
  // a live it is not linked to, so it says so plainly, once, and leaves it to the operator.
  if (session.lifecycle === "ended" && sync.providerSessionId !== null && sync.last?.status === "created") {
    problem ??= NEVER_ON_AIR;
  }
  if (problem !== null && problem !== sync.problem) notices.push({ code: "platform_problem", summary: problem });
  if (problem === null && sync.problem !== null) notices.push({ code: "platform_recovered", summary: "The platform is answering again." });
  return { sim, sync: { ...sync, problem }, commands, notices, calls, reads };
}
