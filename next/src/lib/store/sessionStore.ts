import { SessionSchema, type EnvironmentIdentity, type Session } from "@/contracts";
import { PACK_LIBRARY, snapshotProducts } from "@/fixtures/library";
import {
  SCENARIO_BY_ID,
  SIMULATED_OPERATOR,
  applyCommand,
  applyScriptStep,
  createNextSession,
  createScenarioSession,
  createSession,
  duplicateSession,
  operatorFromName,
  seedSimulatorSessions,
  skipScriptStep,
  type CommandBase,
  type CommandBody,
  type CommandResult,
  type NextSessionResult,
  type RejectCode,
  type ScenarioId,
  type ScriptStepResult,
} from "@/lib/domain";

/**
 * Local command authority for Phase 1.
 *
 * One browser/device is the authority. Durability rules:
 * - A command is acknowledged only after the session's state, events and receipt have been written to
 *   browser storage in one write. If the write fails, nothing in memory changes and the caller gets an
 *   explicit "not saved" result carrying its intent for an explicit retry. Nothing is replayed silently.
 * - Every write re-reads the authoritative record from storage first and computes the command against it,
 *   so a stale tab or window can never overwrite newer acknowledged history (a stale expected revision is
 *   rejected; memory is brought up to date).
 * - Only the affected session's record is replaced; every other stored record — including ones this tab
 *   cannot read — is written back unchanged, so one session's write never erases another's facts.
 * - At most one REAL show is active on this device. Rehearsals are scoped separately.
 *
 * This is NOT a shared/team database: other browsers do not see it. REAL and SIMULATED sessions live in
 * separate namespaces and a REAL session can never be derived from a SIMULATED one.
 */

const SCHEMA_VERSION = 1;
const STORAGE_KEYS: Record<EnvironmentIdentity, string> = {
  REAL: "livelift.v3.REAL",
  SIMULATED: "livelift.v3.SIMULATED",
};

export type StorageHealth = "unknown" | "ok" | "unavailable" | "write_failed";

export interface StoreState {
  hydrated: boolean;
  sessions: Session[];
  storage: StorageHealth;
  /** Plain-language notices, e.g. data that could not be read and was set aside. */
  notices: string[];
  lastSavedAtMs: number | null;
}

const UNHYDRATED: StoreState = {
  hydrated: false,
  sessions: [],
  storage: "unknown",
  notices: [],
  lastSavedAtMs: null,
};

export type DispatchInput = CommandBody & Partial<Omit<CommandBase, "nowMs">> & { nowMs?: number };

/** The outcome of a command at the local authority. */
export interface DispatchResult extends CommandResult {
  /** The command exactly as attempted (time filled in), so an unsaved command can be retried explicitly. */
  intent: DispatchInput & { nowMs: number };
  /** When another REAL show already holds this device: the show to return to. */
  activeSessionId?: string;
}

export type StartingPoint =
  | { type: "blank" }
  | { type: "template" }
  | { type: "pack"; packId: string }
  | { type: "previous"; sourceId: string };

export interface NewSessionRequest {
  title: string;
  environment: EnvironmentIdentity;
  timezone: string;
  plannedStartMs: number;
  objective?: string | null;
  accountLabel?: string | null;
  /** REAL shows: the name recorded with every action. Blank = "Local operator". */
  operatorName?: string | null;
  start: StartingPoint;
}

export type EditResult = { ok: true; session: Session } | { ok: false; reason: string };
export type CreateResult = { ok: true; session: Session } | { ok: false; reason: string };

const UNAVAILABLE =
  "Browser storage is unavailable in this window (for example private browsing or blocked site data), so LiveLift cannot record anything here.";
const WRITE_FAILED = "Browser storage refused the write (it may be full). Nothing was recorded.";

function readStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const probe = "livelift.v3.probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const idOf = (item: unknown): string | null => (isRecord(item) && typeof item.id === "string" ? item.id : null);

type RawRead = { ok: true; items: unknown[] } | { ok: false; reason: string };
type FreshRead = { ok: true; items: unknown[]; base: Session | null } | { ok: false; reason: string };

export class SessionStore {
  private state: StoreState = UNHYDRATED;
  private listeners = new Set<() => void>();
  private storage: Storage | null = null;
  private started = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StoreState => this.state;
  getServerSnapshot = (): StoreState => UNHYDRATED;

  private set(next: Partial<StoreState>): void {
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }

  /** Load both namespaces. Safe to call repeatedly; only the first call does work. */
  hydrate(): void {
    if (this.started) return;
    this.started = true;
    this.storage = readStorage();
    const notices: string[] = [];
    if (!this.storage) notices.push(`${UNAVAILABLE} Shows cannot be created or run until storage is available.`);
    const sessions: Session[] = [];
    for (const env of ["REAL", "SIMULATED"] as const) sessions.push(...this.loadNamespace(env, notices));
    this.state = {
      hydrated: true,
      sessions,
      storage: this.storage ? (this.state.storage === "write_failed" ? "write_failed" : "ok") : "unavailable",
      notices,
      lastSavedAtMs: null,
    };
    if (this.storage && typeof window !== "undefined") window.addEventListener("storage", this.onStorageEvent);
    for (const l of this.listeners) l();
  }

  /** Discard in-memory state and read everything again from browser storage. */
  reloadFromStorage(): void {
    if (typeof window !== "undefined") window.removeEventListener("storage", this.onStorageEvent);
    this.started = false;
    this.state = UNHYDRATED;
    this.hydrate();
  }

  // ---- Storage primitives ----------------------------------------------------------------------

  /** Read one namespace straight from storage. Never trusts memory. Unreadable data is reported, not replaced. */
  private readRaw(env: EnvironmentIdentity): RawRead {
    if (!this.storage) return { ok: false, reason: UNAVAILABLE };
    let raw: string | null;
    try {
      raw = this.storage.getItem(STORAGE_KEYS[env]);
    } catch {
      return { ok: false, reason: "Browser storage could not be read. Nothing was recorded." };
    }
    if (raw === null) return { ok: true, items: [] };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: `Stored ${env} data is not readable, so it was left untouched. Nothing was recorded.` };
    }
    if (!isRecord(parsed) || parsed.v !== SCHEMA_VERSION || !Array.isArray(parsed.sessions)) {
      return { ok: false, reason: `Stored ${env} data is in an unexpected format, so it was left untouched. Nothing was recorded.` };
    }
    return { ok: true, items: parsed.sessions };
  }

  private writeRaw(env: EnvironmentIdentity, items: unknown[]): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(STORAGE_KEYS[env], JSON.stringify({ v: SCHEMA_VERSION, sessions: items }));
      this.state = { ...this.state, storage: "ok", lastSavedAtMs: Date.now() };
      return true;
    } catch {
      this.set({ storage: "write_failed" });
      return false;
    }
  }

  private parseSession(item: unknown, env: EnvironmentIdentity): Session | null {
    const result = SessionSchema.safeParse(item);
    return result.success && result.data.environment === env ? result.data : null;
  }

  /** Read the authoritative record for one session and bring memory in line with it. */
  private readFresh(env: EnvironmentIdentity, id: string): FreshRead {
    const read = this.readRaw(env);
    if (!read.ok) return read;
    const item = read.items.find((it) => idOf(it) === id);
    if (item === undefined) {
      this.syncMemory(id, null);
      return { ok: true, items: read.items, base: null };
    }
    const base = this.parseSession(item, env);
    if (!base) return { ok: false, reason: "The stored record for this show could not be read, so it was left untouched. Nothing was recorded." };
    this.syncMemory(id, base);
    return { ok: true, items: read.items, base };
  }

  /** Replace exactly one record; every other stored item is written back unchanged. */
  private writeRecord(env: EnvironmentIdentity, items: unknown[], next: Session): boolean {
    const index = items.findIndex((it) => idOf(it) === next.id);
    const out = index >= 0 ? items.map((it, i) => (i === index ? next : it)) : [...items, next];
    return this.writeRaw(env, out);
  }

  /** Publish one session to memory (or remove it). Only called with authoritative, stored data. */
  private syncMemory(id: string, session: Session | null): void {
    const index = this.state.sessions.findIndex((s) => s.id === id);
    if (session === null) {
      if (index >= 0) this.set({ sessions: this.state.sessions.filter((s) => s.id !== id) });
      return;
    }
    if (index < 0) {
      this.set({ sessions: [...this.state.sessions, session] });
      return;
    }
    const mem = this.state.sessions[index];
    if (mem === session) return;
    if (mem.revision === session.revision && mem.scriptCursor === session.scriptCursor && mem.updatedAtMs === session.updatedAtMs) return;
    this.set({ sessions: this.state.sessions.map((s, i) => (i === index ? session : s)) });
  }

  private onStorageEvent = (event: StorageEvent): void => {
    const env = (Object.keys(STORAGE_KEYS) as EnvironmentIdentity[]).find((e) => STORAGE_KEYS[e] === event.key);
    if (!env) return;
    // Another tab committed. Converge on what is stored; never write in response.
    const read = this.readRaw(env);
    if (!read.ok) return;
    const stored = read.items.map((it) => this.parseSession(it, env)).filter((s): s is Session => s !== null);
    this.set({ sessions: [...this.state.sessions.filter((s) => s.environment !== env), ...stored] });
  };

  private loadNamespace(env: EnvironmentIdentity, notices: string[]): Session[] {
    const key = STORAGE_KEYS[env];
    const seeds = (): Session[] => (env === "SIMULATED" ? seedSimulatorSessions() : []);
    if (!this.storage) return seeds(); // shown, but every command is refused until storage works

    let raw: string | null;
    try {
      raw = this.storage.getItem(key);
    } catch {
      notices.push(`Stored ${env} data could not be read.`);
      return seeds();
    }
    if (raw === null) {
      const fresh = seeds();
      if (fresh.length > 0 && !this.writeRaw(env, fresh)) {
        notices.push("Rehearsals could not be saved; they are shown but cannot be run until storage accepts writes.");
      }
      return fresh;
    }

    let parsed: unknown;
    let parseFailed = false;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parseFailed = true;
    }
    if (parseFailed || !isRecord(parsed) || parsed.v !== SCHEMA_VERSION || !Array.isArray(parsed.sessions)) {
      // Corrupt JSON, JSON null, a bare array, or another version: keep the original bytes before anything else.
      const why = parseFailed
        ? "could not be read"
        : isRecord(parsed) && typeof parsed.v === "number" && parsed.v !== SCHEMA_VERSION
          ? "uses an unsupported version"
          : "is not in a format LiveLift recognises";
      if (this.setAside(key, raw)) {
        const fresh = seeds();
        this.writeRaw(env, fresh); // replaced only after the original is safely set aside
        notices.push(`Stored ${env} data ${why}. It was set aside, not deleted.`);
        return fresh;
      }
      notices.push(`Stored ${env} data ${why}, and could not be set aside, so it was left untouched. ${env} changes cannot be saved until it is cleared.`);
      return seeds();
    }

    const good: Session[] = [];
    const keep: unknown[] = [];
    let setAside = 0;
    let stuck = 0;
    for (const item of parsed.sessions) {
      const session = this.parseSession(item, env);
      if (session) {
        good.push(session);
        keep.push(item);
      } else if (this.setAside(key, JSON.stringify(item))) {
        setAside += 1;
      } else {
        stuck += 1;
        keep.push(item); // could not be preserved elsewhere: leave it where it is
      }
    }
    if (setAside > 0) {
      this.writeRaw(env, keep);
      notices.push(`${setAside} stored ${env} session${setAside === 1 ? "" : "s"} could not be read and ${setAside === 1 ? "was" : "were"} set aside.`);
    }
    if (stuck > 0) notices.push(`${stuck} stored ${env} record${stuck === 1 ? "" : "s"} could not be read and ${stuck === 1 ? "was" : "were"} left untouched.`);
    return good;
  }

  /** Copy unreadable data to a quarantine key. Returns false if it could not be preserved. */
  private setAside(key: string, raw: string): boolean {
    if (!this.storage) return false;
    try {
      const qKey = `${key}.quarantine`;
      const existing = this.storage.getItem(qKey);
      let list: string[] = [];
      if (existing) {
        try {
          const p: unknown = JSON.parse(existing);
          if (Array.isArray(p)) list = p.filter((x): x is string => typeof x === "string");
        } catch {
          list = [existing];
        }
      }
      list.push(raw);
      this.storage.setItem(qKey, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  // ---- Queries -----------------------------------------------------------------------------

  getSession(id: string): Session | null {
    return this.state.sessions.find((s) => s.id === id) ?? null;
  }

  list(env?: EnvironmentIdentity): Session[] {
    return this.state.sessions.filter((s) => (env ? s.environment === env : true));
  }

  /** The REAL show currently running on this device, if any (at most one). */
  activeRealSession(): Session | null {
    return this.state.sessions.find((s) => s.environment === "REAL" && s.lifecycle === "active") ?? null;
  }

  canPersist(): boolean {
    return this.storage !== null;
  }

  private nextId(env: EnvironmentIdentity, items: unknown[]): string {
    const prefix = env === "REAL" ? "real" : "sim";
    const ids = [...this.state.sessions.map((s) => s.id), ...items.map(idOf).filter((x): x is string => x !== null)];
    let max = 0;
    for (const id of ids) {
      const m = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `${prefix}-${max + 1}`;
  }

  private refusal(session: Session, intent: DispatchInput & { nowMs: number }, code: RejectCode, message: string): DispatchResult {
    return {
      session,
      duplicate: false,
      intent,
      receipt: {
        commandKey: intent.key ?? "",
        type: intent.type,
        outcome: "rejected",
        code,
        message,
        revisionAfter: session.revision,
        eventIds: [],
      },
    };
  }

  // ---- Commands ----------------------------------------------------------------------------

  /** Run a runtime command through the single local authority. Acknowledged only once durably written. */
  dispatch(sessionId: string, input: DispatchInput): DispatchResult | null {
    const known = this.getSession(sessionId);
    if (!known) return null;
    const env = known.environment;
    const intent = { ...input, nowMs: input.nowMs ?? Date.now() };

    const fresh = this.readFresh(env, sessionId);
    if (!fresh.ok) return this.refusal(known, intent, "not_persisted", `Not saved: ${fresh.reason}`);
    const base = fresh.base;
    if (!base) {
      return this.refusal(known, intent, "not_found", "This show no longer exists on this device (it was removed in another tab or window).");
    }

    // One active REAL show per device, checked against what is stored — not against a cached list.
    if (input.type === "start_live" && base.environment === "REAL") {
      const other = fresh.items.find(
        (it) => isRecord(it) && it.id !== base.id && it.environment === "REAL" && it.lifecycle === "active"
      ) as Record<string, unknown> | undefined;
      if (other) {
        const title = typeof other.title === "string" ? other.title : "Another REAL show";
        return {
          ...this.refusal(base, intent, "another_show_active", `${title} is already running on this device. End it before starting another REAL show.`),
          activeSessionId: String(other.id),
        };
      }
    }

    const result = applyCommand(base, intent);
    if (result.receipt.outcome !== "committed" || result.duplicate) return { ...result, intent };

    let next = result.session;
    // Starting a rehearsal by hand satisfies the script's opening "Start LIVE" step, so it is not offered again.
    if (input.type === "start_live" && next.environment === "SIMULATED" && next.scriptCursor === 0 && next.scenarioId) {
      const first = SCENARIO_BY_ID[next.scenarioId as ScenarioId]?.script[0];
      if (first?.id === "start") next = { ...next, scriptCursor: 1 };
    }
    if (!this.writeRecord(env, fresh.items, next)) {
      return this.refusal(base, intent, "not_persisted", `Not saved: ${WRITE_FAILED}`);
    }
    this.syncMemory(next.id, next);
    return { ...result, session: next, intent };
  }

  /** Apply the next scripted rehearsal step (simulated sessions only), through the same commit boundary. */
  applyNextScriptStep(sessionId: string): ScriptStepResult | null {
    const known = this.getSession(sessionId);
    if (!known || known.environment !== "SIMULATED") return null;
    const fresh = this.readFresh("SIMULATED", sessionId);
    const notSaved = (session: Session, message: string): ScriptStepResult => ({
      session,
      step: null,
      receipt: { commandKey: "", type: "script_step", outcome: "rejected", code: "not_persisted", message, revisionAfter: session.revision, eventIds: [] },
    });
    if (!fresh.ok) return notSaved(known, `Not saved: ${fresh.reason}`);
    if (!fresh.base) return null;
    const result = applyScriptStep(fresh.base);
    if (result.session === fresh.base) return result;
    if (!this.writeRecord("SIMULATED", fresh.items, result.session)) return { ...notSaved(fresh.base, `Not saved: ${WRITE_FAILED}`), step: result.step };
    this.syncMemory(sessionId, result.session);
    return result;
  }

  skipNextScriptStep(sessionId: string): EditResult {
    const known = this.getSession(sessionId);
    if (!known || known.environment !== "SIMULATED") return { ok: false, reason: "Only rehearsals have a script." };
    const fresh = this.readFresh("SIMULATED", sessionId);
    if (!fresh.ok) return { ok: false, reason: `Not saved: ${fresh.reason}` };
    if (!fresh.base) return { ok: false, reason: "That rehearsal no longer exists." };
    const next: Session = { ...skipScriptStep(fresh.base), revision: fresh.base.revision + 1 };
    if (!this.writeRecord("SIMULATED", fresh.items, next)) return { ok: false, reason: `Not saved: ${WRITE_FAILED}` };
    this.syncMemory(sessionId, next);
    return { ok: true, session: next };
  }

  // ---- Prepare (before the baseline locks) ---------------------------------------------------

  /**
   * Edit a draft show. The updater receives an independent copy and returns nothing.
   * Allowed only before Start LIVE locks the baseline, and only against the latest stored version.
   */
  editDraft(
    sessionId: string,
    update: (draft: Session, alloc: { segmentId: () => string; cueId: () => string }) => void
  ): EditResult {
    const known = this.getSession(sessionId);
    if (!known) return { ok: false, reason: "That show does not exist." };
    const env = known.environment;
    const fresh = this.readFresh(env, sessionId);
    if (!fresh.ok) return { ok: false, reason: `Not saved: ${fresh.reason} Your change was not applied.` };
    const base = fresh.base;
    if (!base) return { ok: false, reason: "That show no longer exists on this device." };
    if (base.revision !== known.revision) {
      return { ok: false, reason: "This plan changed in another tab or window. The latest version is shown; make your change again." };
    }
    if (base.lifecycle !== "planned" || base.baselineLocked) {
      return { ok: false, reason: "The baseline is locked. Changes during a show are explicit plan revisions." };
    }
    const draft = structuredClone(base);
    update(draft, {
      segmentId: () => `${draft.id}:s${++draft.seq.segment}`,
      cueId: () => `${draft.id}:c${++draft.seq.cue}`,
    });
    draft.revision += 1;
    draft.updatedAtMs = Date.now();
    const checked = SessionSchema.safeParse(draft);
    if (!checked.success) {
      return { ok: false, reason: `That change is not valid and was not saved: ${checked.error.issues[0]?.message ?? "invalid plan"}.` };
    }
    if (!this.writeRecord(env, fresh.items, checked.data)) {
      return { ok: false, reason: `Not saved: ${WRITE_FAILED} Your change was not applied; try again.` };
    }
    this.syncMemory(sessionId, checked.data);
    return { ok: true, session: checked.data };
  }

  // ---- Creating shows ------------------------------------------------------------------------

  createSession(req: NewSessionRequest): CreateResult {
    const env = req.environment;
    const read = this.readRaw(env);
    if (!read.ok) return { ok: false, reason: read.reason };
    const id = this.nextId(env, read.items);
    const nowMs = Date.now();
    const operator = env === "SIMULATED" ? SIMULATED_OPERATOR : operatorFromName(req.operatorName);
    const base = {
      id,
      title: req.title.trim(),
      environment: env,
      timezone: req.timezone,
      plannedStartMs: req.plannedStartMs,
      nowMs,
      objective: req.objective ?? null,
      accountLabel: req.accountLabel ?? null,
      operator,
    };

    let session: Session;
    if (req.start.type === "previous") {
      const source = this.getSession(req.start.sourceId);
      if (!source) return { ok: false, reason: "The session to copy no longer exists." };
      if (source.environment !== env) {
        return { ok: false, reason: "REAL and SIMULATED shows are never mixed. Choose a source from the same environment." };
      }
      session = {
        ...duplicateSession(source, { id, title: base.title, plannedStartMs: base.plannedStartMs, nowMs }),
        objective: base.objective ?? source.objective,
        accountLabel: base.accountLabel ?? source.accountLabel,
        operator,
      };
    } else if (req.start.type === "template") {
      const template = SCENARIO_BY_ID.buffered;
      const { segments, cues } = template.buildPlan(id);
      session = createSession({ ...base, products: snapshotProducts(template.productIds), segments, cues });
    } else if (req.start.type === "pack") {
      const packId = req.start.packId;
      const pack = PACK_LIBRARY.find((p) => p.id === packId);
      session = createSession({ ...base, products: snapshotProducts(pack?.productIds ?? []) });
    } else {
      session = createSession(base);
    }
    if (!this.writeRecord(env, read.items, session)) return { ok: false, reason: `Not saved: ${WRITE_FAILED} The show was not created.` };
    this.syncMemory(session.id, session);
    return { ok: true, session };
  }

  /** Create the next show from an ended one and persist it. The source is never touched. */
  createNext(
    sourceId: string,
    input: { title: string; plannedStartMs: number; changeIds: string[]; note: string }
  ): NextSessionResult {
    const source = this.getSession(sourceId);
    if (!source) return { ok: false, reason: "That show does not exist." };
    const read = this.readRaw(source.environment);
    if (!read.ok) return { ok: false, reason: read.reason };
    const result = createNextSession(source, {
      id: this.nextId(source.environment, read.items),
      nowMs: Date.now(),
      ...input,
    });
    if (!result.ok) return result;
    if (!this.writeRecord(source.environment, read.items, result.session)) {
      return { ok: false, reason: `Not saved: ${WRITE_FAILED} The next show was not created.` };
    }
    this.syncMemory(result.session.id, result.session);
    return result;
  }

  // ---- Rehearsal resets ------------------------------------------------------------------------

  /**
   * Reset ONE scenario's rehearsal run to its initial state. Every other rehearsal — completed runs,
   * your own rehearsals, plans derived from rehearsals — is left exactly as it is. REAL data is never touched.
   */
  resetScenario(scenarioId: ScenarioId): EditResult {
    const scenario = SCENARIO_BY_ID[scenarioId];
    if (!scenario) return { ok: false, reason: "Unknown scenario." };
    const read = this.readRaw("SIMULATED");
    if (!read.ok) return { ok: false, reason: read.reason };
    const old = read.items.find((it) => idOf(it) === scenario.sessionId);
    const oldRevision = isRecord(old) && typeof old.revision === "number" ? old.revision : -1;
    // Revisions keep rising across a reset, so a stale screen of the old run can never act on the new one.
    const fresh: Session = { ...createScenarioSession(scenarioId), revision: oldRevision + 1 };
    if (!this.writeRecord("SIMULATED", read.items, fresh)) return { ok: false, reason: `Not saved: ${WRITE_FAILED}` };
    this.syncMemory(fresh.id, fresh);
    return { ok: true, session: fresh };
  }

  /** Explicit, destructive: delete EVERY rehearsal on this device and regenerate the scripted ones. REAL data is never touched. */
  purgeRehearsals(): EditResult {
    if (!this.storage) return { ok: false, reason: UNAVAILABLE };
    const seeds = seedSimulatorSessions();
    if (!this.writeRaw("SIMULATED", seeds)) return { ok: false, reason: `Not saved: ${WRITE_FAILED}` };
    const real = this.state.sessions.filter((s) => s.environment === "REAL");
    this.set({ sessions: [...real, ...seeds] });
    return { ok: true, session: seeds[0] };
  }
}

export const sessionStore = new SessionStore();
