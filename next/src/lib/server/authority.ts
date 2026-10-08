import { V1_SQL } from "./schema";
import { openExisting, verifyDatabase } from "./database";
import type { ProductionConfig } from "./config";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import type { AuthorityReceipt, CommandResponse, RoomRead } from "@/contracts/authority";
import { SessionSchema, type Session } from "@/contracts";
import { applyCommand, createSession } from "@/lib/domain/engine";
import { createNextSession } from "@/lib/domain/nextLive";
import { planCueTimeMs, schedulePlan } from "@/lib/domain/plan";
import { advanceDeviceClock, type ClockState } from "@/lib/domain/time";
import { AuthorityError, type Access } from "./config";
import { canonicalJson, parseBody, type Envelope } from "./validation";

type UsedIds = { products: string[]; segments: string[]; cues: string[] };
type StoredSession = { session: Session; used: UsedIds };
type Room = { revision: number; clock_ms: number };
export type CommandReply = { status: number; body: CommandResponse };

export function receiptStatus(receipt: AuthorityReceipt): number {
  if (receipt.outcome === "committed") return 200;
  if (receipt.code === "forbidden") return 403;
  if (receipt.code === "not_found") return 404;
  if (receipt.code === "invalid_payload") return 422;
  return 409;
}

function idsOf(session: Session): UsedIds {
  return {
    products: session.products.map((p) => p.id),
    segments: session.plans[0].segments.map((s) => s.id),
    cues: session.plans[0].cues.map((c) => c.id),
  };
}

function counterFloor(sessionId: string, kind: "s" | "c", counter: number, ids: string[]): number {
  const prefix = `${sessionId}:${kind}`;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const suffix = id.slice(prefix.length);
    if (/^\d+$/.test(suffix)) counter = Math.max(counter, Number(suffix));
  }
  return counter;
}

/** Validate draft identities/references without preventing incomplete or infeasible planning. */
function checkDraft(session: Session, previous?: StoredSession): string | null {
  const ids = idsOf(session);
  const current = previous ? idsOf(previous.session) : null;
  for (const kind of ["products", "segments", "cues"] as const) {
    if (new Set(ids[kind]).size !== ids[kind].length) return `Duplicate ${kind} identifier.`;
    if (previous && ids[kind].some((id) => previous.used[kind].includes(id) && !current![kind].includes(id))) {
      return `Deleted ${kind} identifiers cannot be reused.`;
    }
  }
  const plan = session.plans[0];
  if (plan.segments.some((s) => s.productId !== null && !ids.products.includes(s.productId))) return "A segment references an unknown product.";
  if (plan.cues.some((c) => c.productId !== null && !ids.products.includes(c.productId))) return "A cue references an unknown product.";
  if (plan.cues.some((c) => c.timing.type !== "at_offset" && !ids.segments.includes(c.timing.segmentId))) return "A cue references an unknown segment.";
  const schedule = schedulePlan(plan);
  const instants = [...schedule.rows.flatMap((row) => [row.startMs, row.endMs, row.anchorMs]), ...plan.cues.map((cue) => planCueTimeMs(plan, schedule, cue))];
  if (instants.some((ms) => ms !== null && (!Number.isSafeInteger(ms) || Math.abs(ms) > 8.64e15))) return "Plan times exceed the supported instant range.";
  return null;
}

export class RoomAuthority {
  readonly db: DatabaseSync;
  private clock: ClockState | null = null;

  constructor(readonly roomId: string, dbPath: string, readonly production?: ProductionConfig) {
    if (process.env.NODE_ENV === "production" && !production) throw new Error("Production identity is required");
    const db = production ? openExisting(dbPath) : new DatabaseSync(dbPath);
    this.db = db;
    try {
      db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;");
      if (production) {
        verifyDatabase(db, production);
      } else {
        this.transaction(() => {
          const version = db.prepare("PRAGMA user_version").get()!.user_version;
          if (version !== 0 && version !== 1) throw new Error("Unsupported authority schema");
          db.exec(V1_SQL);
          const existing = db.prepare("SELECT room_id FROM room_state").get();
          if (existing && existing.room_id !== roomId) throw new Error("Database belongs to another room");
          if (!existing) db.prepare("INSERT INTO room_state VALUES (1, ?, 0, ?)").run(roomId, Date.now());
        });
      }
    } catch (error) {
      db.close();
      throw error;
    }
  }

  close(): void { this.db.close(); }

  private transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try { this.db.exec("ROLLBACK"); } catch { /* The original failure determines the response. */ }
      throw error;
    }
  }

  private room(): Room {
    const row = this.db.prepare("SELECT revision, clock_ms FROM room_state WHERE room_id = ?").get(this.roomId);
    if (!row) throw new Error("Configured room is unavailable");
    return { revision: Number(row.revision), clock_ms: Number(row.clock_ms) };
  }

  private time(watermark: number): { nowMs: number; behindByMs: number } {
    const wall = Date.now();
    const perf = performance.now();
    const previous = this.clock ?? { nowMs: watermark, perfMs: perf };
    const reading = advanceDeviceClock(previous, wall, perf);
    const nowMs = Math.floor(Math.max(watermark, reading.state.nowMs));
    // Another route connection may already have advanced the watermark; do not count its elapsed time twice.
    this.clock = { nowMs, perfMs: perf };
    this.db.prepare("UPDATE room_state SET clock_ms = ? WHERE room_id = ?").run(nowMs, this.roomId);
    return { nowMs, behindByMs: Math.max(0, nowMs - wall) };
  }

  private sessions(): StoredSession[] {
    // ponytail: one-room JSON snapshots; query target rows if retained history outgrows polling.
    return this.db.prepare("SELECT state_json, used_ids_json FROM sessions WHERE room_id = ? ORDER BY rowid").all(this.roomId).map((row) => ({
      session: SessionSchema.parse(JSON.parse(String(row.state_json))),
      used: JSON.parse(String(row.used_ids_json)) as UsedIds,
    }));
  }

  read(access: Access, afterRevision?: number): RoomRead {
    return this.transaction(() => {
      const room = this.room();
      const time = this.time(room.clock_ms);
      const base = { roomId: this.roomId, revision: room.revision, serverNowMs: time.nowMs, clockBehindByMs: time.behindByMs, access };
      return afterRevision === room.revision ? { ...base, changed: false } : { ...base, changed: true, sessions: this.sessions().map((s) => s.session) };
    });
  }

  receipt(commandId: string): AuthorityReceipt | null {
    const row = this.db.prepare("SELECT receipt_json FROM command_log WHERE command_id = ?").get(commandId);
    return row ? JSON.parse(String(row.receipt_json)) as AuthorityReceipt : null;
  }

  command(envelope: Envelope, access: Access, currentAccess?: () => Access): CommandReply {
    return this.transaction(() => {
      if (currentAccess) access = currentAccess();
      const canonical = canonicalJson({ roomId: envelope.roomId, sessionId: envelope.sessionId, expectedRevision: envelope.expectedRevision, type: envelope.type, payload: envelope.payload });
      const existing = this.db.prepare("SELECT actor_id, canonical_request, receipt_json, http_status FROM command_log WHERE command_id = ?").get(envelope.commandId);
      const room = this.room();
      const sessions = this.sessions();
      const target = sessions.find((s) => s.session.id === envelope.sessionId);
      const rejected = (code: string, message: string): AuthorityReceipt => ({
        commandId: envelope.commandId, type: envelope.type, outcome: "rejected", code, message,
        roomRevisionAfter: room.revision, sessionId: target?.session.id ?? null,
        sessionRevisionAfter: target?.session.revision ?? null, eventIds: [],
      });
      if (existing) {
        if (existing.actor_id === access.actorId && existing.canonical_request === canonical) {
          return { status: Number(existing.http_status), body: { receipt: JSON.parse(String(existing.receipt_json)) as AuthorityReceipt, duplicate: true } };
        }
        return { status: 409, body: { receipt: rejected("idempotency_conflict", "That command ID already identifies another intent or actor."), duplicate: false } };
      }

      const time = this.time(room.clock_ms);
      const remember = (receipt: AuthorityReceipt, resolvedCreation: Session | null = null): CommandReply => {
        const status = receiptStatus(receipt);
        this.db.prepare("INSERT INTO command_log VALUES (?, ?, ?, ?, ?, ?, ?)").run(
          envelope.commandId, access.actorId, canonical, JSON.stringify(receipt), status, time.nowMs,
          resolvedCreation ? JSON.stringify(resolvedCreation) : null,
        );
        return { status, body: { receipt, duplicate: false } };
      };
      const refuse = (code: string, message: string) => remember(rejected(code, message));
      if (envelope.roomId !== this.roomId) return refuse("not_found", "That room is not configured on this authority.");
      if (access.role !== "operator") return refuse("forbidden", "Viewer capabilities cannot write.");
      if (envelope.expectedRevision !== room.revision) return refuse("stale_revision", "The room changed. Read the current snapshot before submitting a new command.");
      if (envelope.type === "advance_clock" || envelope.type === "set_clock") return refuse("wrong_environment", "REAL authority time is supplied by the server.");
      const body = parseBody(envelope);
      if (!body) return refuse("invalid_payload", "Unknown command or invalid payload fields.");
      if ((body.type === "create_session") !== (envelope.sessionId === null)) return refuse("invalid_payload", "The command has an invalid session target.");
      if (body.type !== "create_session" && !target) return refuse("not_found", "That session is not in this room.");
      const operator = { id: access.actorId, name: access.name, role: "lead" as const, isLead: true };
      let next: Session;
      let eventIds: string[] = [];
      let creation = false;
      if (body.type === "create_session") {
        next = createSession({ ...body, id: randomUUID(), environment: "REAL", nowMs: time.nowMs, operator });
        creation = true;
      } else if (body.type === "create_next") {
        if (target!.session.lifecycle !== "ended") return refuse("invalid_state", "Next LIVE requires an ended source show.");
        const result = createNextSession(target!.session, { ...body, id: randomUUID(), nowMs: time.nowMs });
        if (!result.ok) return refuse("invalid_payload", result.reason);
        next = { ...result.session, operator };
        creation = true;
      } else if (body.type === "save_prepare") {
        const base = target!.session;
        if (base.lifecycle !== "planned" || base.baselineLocked) return refuse("invalid_state", "Prepare is editable only while planned and baseline unlocked.");
        const { title, timezone, objective, accountLabel, products, plannedStartMs, segments, cues } = body;
        const oldIds = idsOf(base);
        next = {
          ...base, title, timezone, objective, accountLabel, products,
          plans: [{ ...base.plans[0], plannedStartMs, segments, cues }],
          seq: { ...base.seq, segment: base.seq.segment + segments.filter((s) => !oldIds.segments.includes(s.id)).length, cue: base.seq.cue + cues.filter((c) => !oldIds.cues.includes(c.id)).length },
          revision: base.revision + 1, updatedAtMs: time.nowMs,
        };
      } else {
        if (body.type === "start_live" && sessions.some((s) => s.session.id !== target!.session.id && s.session.lifecycle === "active")) {
          return refuse("another_show_active", "Another REAL show is active. End it before starting this show.");
        }
        const result = applyCommand(target!.session, { ...body, key: envelope.commandId, actor: access.name, nowMs: time.nowMs });
        if (result.receipt.outcome === "rejected") return remember(rejected(result.receipt.code!, result.receipt.message!));
        next = result.session;
        eventIds = result.receipt.eventIds;
      }
      if (creation || body.type === "save_prepare") {
        const issue = checkDraft(next, creation ? undefined : target);
        if (issue) return refuse("invalid_payload", issue);
      }
      next = SessionSchema.parse(next);
      const ids = idsOf(next);
      const used = creation ? ids : Object.fromEntries(
        (["products", "segments", "cues"] as const).map((kind) => [kind, [...new Set([...target!.used[kind], ...ids[kind]])]]),
      );
      // Retired IDs also contribute, so deleting a sparse suffix never lowers the allocation floor.
      next.seq.segment = counterFloor(next.id, "s", next.seq.segment, used.segments);
      next.seq.cue = counterFloor(next.id, "c", next.seq.cue, used.cues);
      if (![next.seq.segment, next.seq.cue].every((counter) => Number.isSafeInteger(counter) && counter < Number.MAX_SAFE_INTEGER)) {
        return refuse("invalid_payload", "Session-scoped numeric IDs must leave room for a safe next counter.");
      }
      if (creation) {
        this.db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?)").run(next.id, this.roomId, next.lifecycle, JSON.stringify(next), JSON.stringify(used));
      } else {
        this.db.prepare("UPDATE sessions SET lifecycle = ?, state_json = ?, used_ids_json = ? WHERE id = ? AND room_id = ?").run(next.lifecycle, JSON.stringify(next), JSON.stringify(used), next.id, this.roomId);
      }
      this.db.prepare("UPDATE room_state SET revision = revision + 1 WHERE room_id = ?").run(this.roomId);
      return remember({ commandId: envelope.commandId, type: body.type, outcome: "committed", code: null, message: null,
        roomRevisionAfter: room.revision + 1, sessionId: next.id, sessionRevisionAfter: next.revision, eventIds }, creation ? next : null);
    });
  }
}

export function assertRoom(roomId: string | null, configured: string): void {
  if (roomId !== null && roomId !== configured) throw new AuthorityError(404, "not_found", "That room is not configured on this authority.");
}
