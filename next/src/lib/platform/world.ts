/**
 * Everything a rehearsal's simulated platform knows, kept beside (never inside) the show's own record.
 * Pure data and helpers: the Operate panel persists it per show, the Platform Lab keeps it in memory.
 */
import type { Session } from "@/contracts";
import { SHOPEE_ENDPOINTS, createShopeeLiveSim, readEntry, type LedgerEntry, type ReadEntry, type ShopeeLiveSim, type ShopeeRead } from "./shopeeLive";
import { catalogFromProducts, initialSyncState, type NoticeData, type NoticeItem, type SyncState } from "./sync";

export interface PlatformNotice {
  id: number;
  atMs: number;
  code: string;
  summary: string;
  /** What the notice is about, for wording it in the Lab's language. Absent in a world saved before it existed. */
  data?: NoticeData;
}

export interface PlatformWorld {
  sim: ShopeeLiveSim;
  sync: SyncState;
  notices: PlatformNotice[];
  nextNoticeId: number;
  auto: boolean;
  /** LiveLift's reads, kept apart from the platform's call log. Absent in a world saved before the read log existed. */
  readLog?: ReadLog;
}

/** The read log: reads oldest first, bounded on its own, and the next read's number. */
export interface ReadLog {
  entries: ReadEntry[];
  next: number;
}

const NOTICE_LIMIT = 20;
export const READ_LOG_LIMIT = 120;

export function freshWorld(session: Pick<Session, "products">): PlatformWorld {
  const sync = initialSyncState(session);
  return {
    sim: createShopeeLiveSim({ catalog: catalogFromProducts(session.products, sync.links) }),
    sync, notices: [], nextNoticeId: 1, auto: true, readLog: { entries: [], next: 1 },
  };
}

/** Keep reads in the read log. Its bound is its own: however often LiveLift polls, no write leaves the call log for it. */
export function logReads(world: PlatformWorld, reads: readonly ShopeeRead[]): PlatformWorld {
  if (reads.length === 0) return world;
  const log = world.readLog ?? { entries: [], next: 1 };
  const entries = reads.map((r, i) => readEntry(r, log.next + i));
  return { ...world, readLog: { entries: [...log.entries, ...entries].slice(-READ_LOG_LIMIT), next: log.next + reads.length } };
}

/** The reads to show, oldest first. */
export const readsOf = (world: PlatformWorld): ReadEntry[] => world.readLog?.entries ?? [];

export function addNotices(world: PlatformWorld, atMs: number, items: NoticeItem[]): PlatformWorld {
  if (items.length === 0) return world;
  let id = world.nextNoticeId;
  const added = items.map((n) => ({ id: id++, atMs, ...n }));
  return { ...world, notices: [...added.reverse(), ...world.notices].slice(0, NOTICE_LIMIT), nextNoticeId: id };
}

// ---- Reading a stored world back ---------------------------------------------------------------------------------------

type Check = (v: unknown) => boolean;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt: Check = (v) => typeof v === "number" && Number.isSafeInteger(v);
const isCount: Check = (v) => isInt(v) && (v as number) >= 0;
const isTime: Check = (v) => typeof v === "number" && Number.isFinite(v);
const isStr: Check = (v) => typeof v === "string";
const isBool: Check = (v) => typeof v === "boolean";
const orNull = (check: Check): Check => (v) => v === null || check(v);
const oneOf = (values: readonly unknown[]): Check => (v) => values.includes(v);
const listOf = (check: Check): Check => (v) => Array.isArray(v) && v.every(check);
const mapOf = (check: Check): Check => (v) => isRecord(v) && Object.values(v).every(check);
const shape = (fields: Record<string, Check>): Check => (v) => isRecord(v) && Object.entries(fields).every(([k, check]) => check(v[k]));

const ERRORS = ["", "error_data", "error_param", "error_auth", "error_server"];
const HOST_ACTIONS = ["add_catalog_item", "start_live", "end_live", "add_live_item", "remove_live_item", "pin_item", "unpin_item", "create_promotion"];
const itemRef = shape({ itemId: isInt, shopId: isInt });
const envelope = shape({ error: oneOf(ERRORS), message: isStr, request_id: isStr, response: isRecord });
const call = { atMs: isTime, endpoint: oneOf(SHOPEE_ENDPOINTS), path: isStr, basis: oneOf(["documented", "inferred"]), params: isRecord, envelope };
const ledgerEntry: Check = (v) =>
  isRecord(v) && (v.kind === "api"
    ? shape({ seq: isCount, ...call, readOnly: isBool })(v)
    : v.kind === "host_app" && shape({ seq: isCount, atMs: isTime, action: oneOf(HOST_ACTIONS), summary: isStr, ok: isBool })(v));
const readLogEntry = shape({ kind: oneOf(["read"]), n: isCount, afterSeq: isCount, ...call, readOnly: oneOf([true]) });

const isSim = shape({
  account: shape({ userId: isInt, shopId: isInt }),
  catalog: listOf(shape({ itemId: isInt, shopId: isInt, name: isStr, price: orNull(isTime), currency: isStr })),
  sessions: mapOf(shape({
    sessionId: isInt, ownerUserId: isInt, title: isStr, status: oneOf(["created", "ongoing", "ended"]), origin: oneOf(["api", "shopee_app"]),
    items: listOf(itemRef), showingItemId: orNull(isInt), createdAtMs: isTime, startedAtMs: orNull(isTime), endedAtMs: orNull(isTime),
  })),
  promotions: listOf(shape({ id: isInt, name: isStr, startMs: isTime, endMs: isTime, items: listOf(itemRef), createdBy: oneOf(["api", "host_app"]) })),
  nextSessionId: isCount,
  nextPromotionId: isCount,
  seq: isCount,
  fault: orNull(oneOf(["token_expired", "region_unsupported", "rate_limited", "server_error"])),
  assumptions: shape({ appLiveControllable: isBool, detailExposesShowingItem: isBool }),
  ledger: listOf(ledgerEntry),
});

const isShowing: Check = (v) => isRecord(v) && (v.state === "item" ? isInt(v.itemId) : v.state === "none" || v.state === "unobservable");
const isSnapshot = shape({
  takenAtMs: isTime, providerSessionId: orNull(isInt), status: orNull(oneOf(["created", "ongoing", "ended"])), itemIds: listOf(isInt), showing: isShowing,
  promotions: listOf(shape({ id: isInt, name: isStr, startMs: isTime, endMs: isTime })),
  problem: orNull(shape({ error: isStr, message: isStr })),
});
const isSync = shape({
  providerSessionId: orNull(isInt),
  links: listOf(shape({ productId: isStr, itemId: isInt, shopId: isInt })),
  last: orNull(isSnapshot),
  promotions: mapOf(isInt),
  promotionRefused: mapOf(isStr),
  problem: orNull(isStr),
});
const isNoticeData = shape({
  action: (v) => v === undefined || ["pinned", "unpinned", "added", "removed"].includes(v as string),
  product: (v) => v === undefined || isStr(v), itemId: (v) => v === undefined || isInt(v),
  name: (v) => v === undefined || isStr(v), message: (v) => v === undefined || isStr(v),
});
const isNotice = shape({ id: isCount, atMs: isTime, code: isStr, summary: isStr, data: (v) => v === undefined || isNoticeData(v) });

/** Every counter is ahead of what it has counted, so the next notice, read, call or live never reuses a number. */
function countersAgree(w: PlatformWorld, log: ReadLog): boolean {
  const { sim } = w;
  const seqs = sim.ledger.map((e: LedgerEntry) => e.seq);
  const ascending = (xs: number[]): boolean => xs.every((x, i) => i === 0 || x > xs[i - 1]);
  const above = (next: number, xs: number[]): boolean => xs.every((x) => next > x);
  return ascending(seqs) && sim.seq >= (seqs.at(-1) ?? 0)
    && Object.entries(sim.sessions).every(([key, live]) => key === String(live.sessionId)) && above(sim.nextSessionId, Object.values(sim.sessions).map((x) => x.sessionId))
    && above(sim.nextPromotionId, sim.promotions.map((x) => x.id))
    && w.nextNoticeId >= 1 && above(w.nextNoticeId, w.notices.map((n) => n.id))
    && log.next >= 1 && ascending(log.entries.map((e) => e.n)) && above(log.next, log.entries.map((e) => e.n));
}

/**
 * A stored world, checked field by field, or null. A type assertion is not a check: a blob that is missing a part or
 * carries a broken counter would crash the panel or reuse a number, so it is refused and the caller starts afresh.
 * One older shape is migrated on purpose: a world saved before the read log and live ownership existed.
 */
export function parseWorld(raw: unknown): PlatformWorld | null {
  if (!isRecord(raw) || !isSim(raw.sim) || !isSync(raw.sync) || !listOf(isNotice)(raw.notices) || !isCount(raw.nextNoticeId) || !isBool(raw.auto)) return null;
  const syncIn = raw.sync as Record<string, unknown>;
  if (syncIn.openedByLiveLift !== undefined && !isBool(syncIn.openedByLiveLift)) return null;
  if (raw.readLog !== undefined && !shape({ entries: listOf(readLogEntry), next: isCount })(raw.readLog)) return null;
  const sync = syncIn as unknown as SyncState;
  const world: PlatformWorld = {
    sim: raw.sim as ShopeeLiveSim,
    // Ownership was not recorded before: never assume LiveLift opened the live.
    sync: { ...sync, openedByLiveLift: sync.openedByLiveLift ?? false },
    notices: raw.notices as PlatformWorld["notices"],
    nextNoticeId: raw.nextNoticeId as number,
    auto: raw.auto as boolean,
    readLog: (raw.readLog as ReadLog | undefined) ?? { entries: [], next: 1 },
  };
  return countersAgree(world, world.readLog!) ? world : null;
}
