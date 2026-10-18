/**
 * A deterministic, in-memory model of Shopee Live's Open Platform livestream module, for rehearsals.
 *
 * It is a SIMULATION. Nothing here talks to Shopee and nothing it returns is evidence about Shopee. No randomness and
 * no wall clock: every call takes `nowMs` (the rehearsal's virtual clock), so a rehearsal replays identically.
 *
 * What it copies, and from where:
 * - `update_show_item` ("Set the showing item", listed for TW, ID, TH, PH, MY, SG, VN): method, path, the three required
 *   parameters, the response envelope and the error vocabulary come from Shopee's own reference page, read on
 *   2026-10-08. The call needs an ONGOING session that BELONGS to the authorised account.
 * - Every other endpoint is known by NAME only (the page's menu). Their parameters and replies here are INFERRED and are
 *   labelled so through `ENDPOINT_BASIS`. They must be replaced by the real reference before anything is claimed.
 * - `unpin_show_item` is LiveLift's own GUESS (see `GUESSED_ENDPOINTS`): no Shopee page was found for clearing the showing
 *   item, so even its name and path are placeholders. Only the Live Desk calls it; the Lab and Operate never do.
 *
 * Questions the reference does not answer are modelled as explicit, visible `assumptions`, never as silent behaviour.
 */

export const SHOPEE_ENDPOINTS = [
  "create_session",
  "start_session",
  "end_session",
  "get_session_detail",
  "add_item_list",
  "delete_item_list",
  "get_item_list",
  "update_show_item",
  "create_promotion",
  "get_promotion_list",
  "unpin_show_item",
] as const;
export type ShopeeEndpoint = (typeof SHOPEE_ENDPOINTS)[number];

/** `documented`: read from Shopee's reference page. `inferred`: the name is known, the shape is a guess. */
export type EndpointBasis = "documented" | "inferred";

export const ENDPOINT_BASIS: Record<ShopeeEndpoint, EndpointBasis> = {
  create_session: "inferred",
  start_session: "inferred",
  end_session: "inferred",
  get_session_detail: "inferred",
  add_item_list: "inferred",
  delete_item_list: "inferred",
  get_item_list: "inferred",
  update_show_item: "documented",
  create_promotion: "inferred",
  get_promotion_list: "inferred",
  unpin_show_item: "inferred",
};

/** Not even the name is Shopee's: no Shopee page was found. The call exists so a SIMULATED rehearsal can unpin. */
export const GUESSED_ENDPOINTS: readonly ShopeeEndpoint[] = ["unpin_show_item"];

/** Promotions live in Shopee's separate shop_flash_sale module (names from a third-party listing); no live-specific endpoint was found. */
export const ENDPOINT_PATH: Record<ShopeeEndpoint, string> = {
  create_session: "/api/v2/livestream/create_session",
  start_session: "/api/v2/livestream/start_session",
  end_session: "/api/v2/livestream/end_session",
  get_session_detail: "/api/v2/livestream/get_session_detail",
  add_item_list: "/api/v2/livestream/add_item_list",
  delete_item_list: "/api/v2/livestream/delete_item_list",
  get_item_list: "/api/v2/livestream/get_item_list",
  update_show_item: "/api/v2/livestream/update_show_item",
  create_promotion: "/api/v2/shop_flash_sale/create_shop_flash_sale",
  get_promotion_list: "/api/v2/shop_flash_sale/get_shop_flash_sale_list",
  /** A placeholder path for the guess above: no Shopee page names it. */
  unpin_show_item: "/api/v2/livestream/unpin_show_item",
};

/** Reads never change the platform; the call log can hide them. */
export const READ_ONLY_ENDPOINTS: readonly ShopeeEndpoint[] = ["get_session_detail", "get_item_list", "get_promotion_list"];

// ---- Envelope --------------------------------------------------------------------------------------------------------

export type ShopeeErrorType = "error_data" | "error_param" | "error_auth" | "error_server";

/** The reply shape printed on Shopee's reference page: empty `error`/`message` means success. */
export interface ShopeeEnvelope {
  error: "" | ShopeeErrorType;
  message: string;
  request_id: string;
  response: Record<string, unknown>;
}

// ---- State -----------------------------------------------------------------------------------------------------------

export interface SimItem {
  itemId: number;
  shopId: number;
  name: string;
  price: number | null;
  currency: string;
}

export type SimSessionStatus = "created" | "ongoing" | "ended";

export interface SimSession {
  sessionId: number;
  ownerUserId: number;
  title: string;
  status: SimSessionStatus;
  /** Who started it. A live started in the Shopee app is the open question the real API has to answer. */
  origin: "api" | "shopee_app";
  items: Array<{ itemId: number; shopId: number }>;
  showingItemId: number | null;
  createdAtMs: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
}

export interface SimPromotion {
  id: number;
  name: string;
  startMs: number;
  endMs: number;
  items: Array<{ itemId: number; shopId: number }>;
  createdBy: "api" | "host_app";
}

/** Things the documentation does not settle. Each one is shown to the audience as an assumption. */
export interface SimAssumptions {
  /** A1: can the API control a live that the host started in the Shopee app? Real answer: unknown. */
  appLiveControllable: boolean;
  /** A2: does reading the session reveal which item is showing? Real answer: unknown. */
  detailExposesShowingItem: boolean;
}

export type ShopeeFault = "token_expired" | "region_unsupported" | "rate_limited" | "server_error";

export type HostAction =
  | { type: "add_catalog_item"; item: SimItem }
  | { type: "start_live"; title: string }
  | { type: "end_live" }
  | { type: "add_live_item"; itemId: number }
  | { type: "remove_live_item"; itemId: number }
  | { type: "pin_item"; itemId: number }
  | { type: "unpin_item" }
  | { type: "create_promotion"; name: string; startMs: number; endMs: number; itemIds: number[] };

export type LedgerEntry =
  | {
      kind: "api";
      seq: number;
      atMs: number;
      endpoint: ShopeeEndpoint;
      path: string;
      basis: EndpointBasis;
      readOnly: boolean;
      params: Record<string, unknown>;
      envelope: ShopeeEnvelope;
    }
  | { kind: "host_app"; seq: number; atMs: number; action: HostAction["type"]; summary: string; ok: boolean };

export interface ShopeeLiveSim {
  /** The authorised broadcaster (Shopee calls these APIs "User" APIs). */
  account: { userId: number; shopId: number };
  /** The seller's products on the platform: what the host can put in a live. */
  catalog: SimItem[];
  sessions: Record<number, SimSession>;
  promotions: SimPromotion[];
  nextSessionId: number;
  nextPromotionId: number;
  seq: number;
  fault: ShopeeFault | null;
  assumptions: SimAssumptions;
  ledger: LedgerEntry[];
}

const LEDGER_LIMIT = 300;
export const SIM_USER_ID = 880011;
export const SIM_SHOP_ID = 77001;
const FIRST_SESSION_ID = 6236215;

export function createShopeeLiveSim(init: { catalog?: SimItem[]; assumptions?: Partial<SimAssumptions> } = {}): ShopeeLiveSim {
  return {
    account: { userId: SIM_USER_ID, shopId: SIM_SHOP_ID },
    catalog: init.catalog ?? [],
    sessions: {},
    promotions: [],
    nextSessionId: FIRST_SESSION_ID,
    nextPromotionId: 5100,
    seq: 0,
    fault: null,
    assumptions: { appLiveControllable: true, detailExposesShowingItem: true, ...init.assumptions },
    ledger: [],
  };
}

export const withFault = (sim: ShopeeLiveSim, fault: ShopeeFault | null): ShopeeLiveSim => ({ ...sim, fault });
export const withAssumptions = (sim: ShopeeLiveSim, patch: Partial<SimAssumptions>): ShopeeLiveSim => ({
  ...sim,
  assumptions: { ...sim.assumptions, ...patch },
});

/** The ongoing live, if any. One broadcaster runs one live at a time. */
export function ongoingSession(sim: ShopeeLiveSim): SimSession | null {
  return Object.values(sim.sessions).find((s) => s.status === "ongoing") ?? null;
}

export function promotionStatus(p: SimPromotion, nowMs: number): "scheduled" | "active" | "ended" {
  return nowMs < p.startMs ? "scheduled" : nowMs < p.endMs ? "active" : "ended";
}

// ---- Deterministic request ids ---------------------------------------------------------------------------------------

/** FNV-1a, 32 bit. Shared by everything that needs a stable, seedless hash of the simulation. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 32 hex characters like the samples on Shopee's page, derived from the call counter so replays match. */
export function requestIdFor(seq: number): string {
  return [0, 1, 2, 3].map((salt) => fnv1a(`livelift-sim:${seq}:${salt}`).toString(16).padStart(8, "0")).join("");
}

// ---- Calls -----------------------------------------------------------------------------------------------------------

type Draft = ShopeeLiveSim;
type HandlerResult = { error: ShopeeErrorType; message: string } | { response: Record<string, unknown> };

const err = (error: ShopeeErrorType, message: string): HandlerResult => ({ error, message });
const ok = (response: Record<string, unknown> = {}): HandlerResult => ({ response });

const isId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;

function sessionFor(draft: Draft, params: Record<string, unknown>): { session: SimSession } | { problem: HandlerResult } {
  if (!isId(params.session_id)) return { problem: err("error_param", "Invalid session_id") };
  const sid = params.session_id;
  const session = draft.sessions[sid];
  if (!session) return { problem: err("error_data", `The session(session_id:${sid}) is not exist`) };
  const reachable = session.ownerUserId === draft.account.userId && (session.origin === "api" || draft.assumptions.appLiveControllable);
  if (!reachable) return { problem: err("error_data", `The session(session_id:${sid}) is not belong to you`) };
  return { session };
}

function parseItemList(raw: unknown): Array<{ itemId: number; shopId: number }> | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) return null;
  const out: Array<{ itemId: number; shopId: number }> = [];
  for (const entry of raw) {
    const e = entry as Record<string, unknown> | null;
    if (!e || !isId(e.item_id) || !isId(e.shop_id)) return null;
    out.push({ itemId: e.item_id, shopId: e.shop_id });
  }
  return out;
}

function handle(draft: Draft, nowMs: number, endpoint: ShopeeEndpoint, params: Record<string, unknown>): HandlerResult {
  switch (endpoint) {
    case "create_session": {
      const title = typeof params.title === "string" ? params.title.trim() : "";
      if (title.length === 0 || title.length > 120) return err("error_param", "parameter invalid");
      const sessionId = draft.nextSessionId++;
      draft.sessions[sessionId] = {
        sessionId, ownerUserId: draft.account.userId, title, status: "created", origin: "api", items: [],
        showingItemId: null, createdAtMs: nowMs, startedAtMs: null, endedAtMs: null,
      };
      return ok({ session_id: sessionId });
    }
    case "start_session": {
      const found = sessionFor(draft, params);
      if ("problem" in found) return found.problem;
      if (found.session.status !== "created") return err("error_data", `The session(session_id:${found.session.sessionId}) is not exist`);
      if (ongoingSession(draft)) return err("error_data", "Another livestream is ongoing");
      found.session.status = "ongoing";
      found.session.startedAtMs = nowMs;
      return ok();
    }
    case "end_session": {
      const found = sessionFor(draft, params);
      if ("problem" in found) return found.problem;
      if (found.session.status !== "ongoing") return err("error_data", `The session(session_id:${found.session.sessionId}) is not ongoing`);
      found.session.status = "ended";
      found.session.endedAtMs = nowMs;
      found.session.showingItemId = null;
      return ok();
    }
    case "get_session_detail": {
      const found = sessionFor(draft, params);
      if ("problem" in found) return found.problem;
      const s = found.session;
      return ok({
        session_id: s.sessionId, title: s.title, status: s.status,
        ...(draft.assumptions.detailExposesShowingItem ? { showing_item_id: s.showingItemId } : {}),
      });
    }
    case "add_item_list": {
      const found = sessionFor(draft, params);
      if ("problem" in found) return found.problem;
      if (found.session.status === "ended") return err("error_data", `The session(session_id:${found.session.sessionId}) is not ongoing`);
      const list = parseItemList(params.item_list);
      if (!list) return err("error_param", "parameter invalid");
      for (const entry of list) {
        if (!draft.catalog.some((c) => c.itemId === entry.itemId && c.shopId === entry.shopId)) return err("error_param", "Invalid item_id");
        if (!found.session.items.some((i) => i.itemId === entry.itemId)) found.session.items.push(entry);
      }
      return ok();
    }
    case "delete_item_list": {
      const found = sessionFor(draft, params);
      if ("problem" in found) return found.problem;
      const list = parseItemList(params.item_list);
      if (!list) return err("error_param", "parameter invalid");
      const gone = new Set(list.map((l) => l.itemId));
      found.session.items = found.session.items.filter((i) => !gone.has(i.itemId));
      if (found.session.showingItemId !== null && gone.has(found.session.showingItemId)) found.session.showingItemId = null;
      return ok();
    }
    case "get_item_list": {
      const found = sessionFor(draft, params);
      if ("problem" in found) return found.problem;
      return ok({ item_list: found.session.items.map((i) => ({ item_id: i.itemId, shop_id: i.shopId })) });
    }
    case "update_show_item": {
      // Parameter, ownership and state checks follow the order of the error table on Shopee's reference page.
      if (!isId(params.session_id)) return err("error_param", "Invalid session_id");
      if (!isId(params.item_id)) return err("error_param", "Invalid item_id");
      if (!isId(params.shop_id)) return err("error_param", "Invalid shop_id");
      const found = sessionFor(draft, params);
      if ("problem" in found) return found.problem;
      const s = found.session;
      if (s.status !== "ongoing") return err("error_data", `The session(session_id:${s.sessionId}) is not ongoing`);
      // Inferred: an item that is not in the live's list cannot be shown.
      if (!s.items.some((i) => i.itemId === params.item_id && i.shopId === params.shop_id)) return err("error_data", "data not exist");
      s.showingItemId = params.item_id;
      return ok();
    }
    case "unpin_show_item": {
      // Guessed shape: the live's id only; clears whatever is showing, and an empty showcase stays empty.
      const found = sessionFor(draft, params);
      if ("problem" in found) return found.problem;
      const s = found.session;
      if (s.status !== "ongoing") return err("error_data", `The session(session_id:${s.sessionId}) is not ongoing`);
      s.showingItemId = null;
      return ok();
    }
    case "create_promotion": {
      const name = typeof params.name === "string" ? params.name.trim() : "";
      const start = params.start_time, end = params.end_time;
      const list = parseItemList(params.item_list);
      if (name.length === 0 || !isId(start) || !isId(end) || end <= start || !list) return err("error_param", "parameter invalid");
      if (start * 1000 < nowMs) return err("error_param", "Parse data error: start_time must be in the future");
      const id = draft.nextPromotionId++;
      draft.promotions.push({ id, name, startMs: start * 1000, endMs: end * 1000, items: list, createdBy: "api" });
      return ok({ promotion_id: id });
    }
    case "get_promotion_list": {
      return ok({
        promotion_list: draft.promotions.map((p) => ({
          promotion_id: p.id, name: p.name, start_time: p.startMs / 1000, end_time: p.endMs / 1000, status: promotionStatus(p, nowMs),
        })),
      });
    }
  }
}

function faultReply(fault: ShopeeFault): HandlerResult {
  switch (fault) {
    case "token_expired": return err("error_auth", "You are not authorized");
    case "region_unsupported": return err("error_server", "The API is not supported for current region");
    case "rate_limited": return err("error_server", "Too many requests, please try again later");
    case "server_error": return err("error_server", "Something wrong. Please try later.");
  }
}

function append(sim: ShopeeLiveSim, entry: LedgerEntry): LedgerEntry[] {
  const ledger = [...sim.ledger, entry];
  return ledger.length > LEDGER_LIMIT ? ledger.slice(ledger.length - LEDGER_LIMIT) : ledger;
}

export interface ShopeeCallResult {
  sim: ShopeeLiveSim;
  envelope: ShopeeEnvelope;
  ok: boolean;
}

/** One authorised API call as LiveLift would make it. The call is logged whatever its outcome. */
export function callShopee(sim: ShopeeLiveSim, nowMs: number, endpoint: ShopeeEndpoint, params: Record<string, unknown>): ShopeeCallResult {
  const draft = structuredClone(sim) as Draft;
  draft.seq += 1;
  const outcome = draft.fault ? faultReply(draft.fault) : handle(draft, nowMs, endpoint, params);
  const envelope: ShopeeEnvelope =
    "error" in outcome
      ? { error: outcome.error, message: outcome.message, request_id: requestIdFor(draft.seq), response: {} }
      : { error: "", message: "", request_id: requestIdFor(draft.seq), response: outcome.response };
  // A failed call must leave the platform untouched, so the rejected draft's changes are discarded.
  const base = "error" in outcome ? { ...sim, seq: draft.seq } : draft;
  // The log keeps its own copies: a caller reusing its objects must never rewrite what was sent or answered.
  const next: ShopeeLiveSim = {
    ...base,
    ledger: append(base, {
      kind: "api", seq: draft.seq, atMs: nowMs, endpoint, path: ENDPOINT_PATH[endpoint], basis: ENDPOINT_BASIS[endpoint],
      readOnly: READ_ONLY_ENDPOINTS.includes(endpoint), params: structuredClone(params), envelope: structuredClone(envelope),
    }),
  };
  return { sim: next, envelope, ok: envelope.error === "" };
}

// ---- Reads -----------------------------------------------------------------------------------------------------------

/**
 * A read LiveLift made, as the platform answered it. Reads are traffic, not changes: they leave the platform, its call
 * counter and its call log untouched, so polling can never push a write out of the log. The caller keeps them in a
 * separate, bounded read log (see `logReads` in world.ts).
 */
export interface ShopeeRead {
  /** The platform's call counter when the read was made: it sits after that call in the log. */
  afterSeq: number;
  atMs: number;
  endpoint: ShopeeEndpoint;
  params: Record<string, unknown>;
  error: "" | ShopeeErrorType;
  message: string;
  response: Record<string, unknown>;
}

/** A read as the read log keeps it: the same shape as a logged call, numbered in its own sequence. */
export interface ReadEntry {
  kind: "read";
  n: number;
  afterSeq: number;
  atMs: number;
  endpoint: ShopeeEndpoint;
  path: string;
  basis: EndpointBasis;
  readOnly: true;
  params: Record<string, unknown>;
  envelope: ShopeeEnvelope;
}

/** A read's request id: its own namespace, so it can never repeat a call's id. */
export function readRequestIdFor(n: number): string {
  return [0, 1, 2, 3].map((salt) => fnv1a(`livelift-sim-read:${n}:${salt}`).toString(16).padStart(8, "0")).join("");
}

/** Answer a read-only endpoint without changing anything. Conditions apply to reads exactly as to calls. */
export function readShopee(sim: ShopeeLiveSim, nowMs: number, endpoint: ShopeeEndpoint, params: Record<string, unknown>): { read: ShopeeRead; ok: boolean } {
  if (!READ_ONLY_ENDPOINTS.includes(endpoint)) throw new Error(`${endpoint} changes the platform: use callShopee`);
  // Handlers work on a draft; a read's draft is thrown away, so nothing the read touches can leak into the platform.
  const draft = structuredClone({ ...sim, ledger: [] }) as Draft;
  const outcome = draft.fault ? faultReply(draft.fault) : handle(draft, nowMs, endpoint, params);
  const read: ShopeeRead =
    "error" in outcome
      ? { afterSeq: sim.seq, atMs: nowMs, endpoint, params: structuredClone(params), error: outcome.error, message: outcome.message, response: {} }
      : { afterSeq: sim.seq, atMs: nowMs, endpoint, params: structuredClone(params), error: "", message: "", response: outcome.response };
  return { read, ok: read.error === "" };
}

/** Number a read for the read log. */
export function readEntry(read: ShopeeRead, n: number): ReadEntry {
  return {
    kind: "read", n, afterSeq: read.afterSeq, atMs: read.atMs, endpoint: read.endpoint, path: ENDPOINT_PATH[read.endpoint],
    basis: ENDPOINT_BASIS[read.endpoint], readOnly: true, params: structuredClone(read.params),
    envelope: { error: read.error, message: read.message, request_id: readRequestIdFor(n), response: structuredClone(read.response) },
  };
}

// ---- The host acting in the Shopee app (no API, no signature) --------------------------------------------------------

function describeHost(action: HostAction, sim: ShopeeLiveSim): string {
  const nameOf = (id: number): string => sim.catalog.find((c) => c.itemId === id)?.name ?? `item ${id}`;
  switch (action.type) {
    case "add_catalog_item": return `Added "${action.item.name}" to the shop catalog`;
    case "start_live": return `Went live: "${action.title}"`;
    case "end_live": return "Ended the live";
    case "add_live_item": return `Added ${nameOf(action.itemId)} to the live bag`;
    case "remove_live_item": return `Removed ${nameOf(action.itemId)} from the live bag`;
    case "pin_item": return `Pinned ${nameOf(action.itemId)}`;
    case "unpin_item": return "Unpinned the product";
    case "create_promotion": return `Scheduled promotion "${action.name}"`;
  }
}

/** The host's own hands in the Shopee app. Not an API call: it needs no token and is never rate limited or region-checked. */
export function hostAct(sim: ShopeeLiveSim, nowMs: number, action: HostAction): { sim: ShopeeLiveSim; ok: boolean } {
  const draft = structuredClone(sim) as Draft;
  draft.seq += 1;
  const live = ongoingSession(draft);
  let done = true;
  switch (action.type) {
    case "add_catalog_item":
      if (draft.catalog.some((c) => c.itemId === action.item.itemId)) done = false;
      else draft.catalog.push(action.item);
      break;
    case "start_live":
      if (live) { done = false; break; }
      {
        const sessionId = draft.nextSessionId++;
        draft.sessions[sessionId] = {
          sessionId, ownerUserId: draft.account.userId, title: action.title, status: "ongoing", origin: "shopee_app", items: [],
          showingItemId: null, createdAtMs: nowMs, startedAtMs: nowMs, endedAtMs: null,
        };
      }
      break;
    case "end_live":
      if (!live) { done = false; break; }
      live.status = "ended"; live.endedAtMs = nowMs; live.showingItemId = null;
      break;
    case "add_live_item": {
      const item = draft.catalog.find((c) => c.itemId === action.itemId);
      if (!live || !item) { done = false; break; }
      if (!live.items.some((i) => i.itemId === item.itemId)) live.items.push({ itemId: item.itemId, shopId: item.shopId });
      break;
    }
    case "remove_live_item":
      if (!live) { done = false; break; }
      live.items = live.items.filter((i) => i.itemId !== action.itemId);
      if (live.showingItemId === action.itemId) live.showingItemId = null;
      break;
    case "pin_item":
      if (!live || !live.items.some((i) => i.itemId === action.itemId)) { done = false; break; }
      live.showingItemId = action.itemId;
      break;
    case "unpin_item":
      if (!live) { done = false; break; }
      live.showingItemId = null;
      break;
    case "create_promotion": {
      const items = action.itemIds.map((id) => draft.catalog.find((c) => c.itemId === id)).filter((c): c is SimItem => c !== undefined);
      if (action.endMs <= action.startMs || items.length === 0) { done = false; break; }
      draft.promotions.push({
        id: draft.nextPromotionId++, name: action.name, startMs: action.startMs, endMs: action.endMs,
        items: items.map((i) => ({ itemId: i.itemId, shopId: i.shopId })), createdBy: "host_app",
      });
      break;
    }
  }
  if (!done) return { sim: { ...sim, seq: draft.seq, ledger: append(sim, { kind: "host_app", seq: draft.seq, atMs: nowMs, action: action.type, summary: `${describeHost(action, sim)} (not possible right now)`, ok: false }) }, ok: false };
  return { sim: { ...draft, ledger: append(draft, { kind: "host_app", seq: draft.seq, atMs: nowMs, action: action.type, summary: describeHost(action, sim), ok: true }) }, ok: true };
}
