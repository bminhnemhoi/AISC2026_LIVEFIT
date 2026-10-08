import type { Session } from "@/contracts";
import type { AuthorityCommandBody, AuthorityReceipt, CommandEnvelope, RoomRead, RoomSnapshot } from "@/contracts/authority";
import { createAuthorityClient, type AuthorityClient } from "@/lib/client/authorityClient";
import { authorityNowMs, type AuthorityClockSample } from "@/lib/client/authorityTime";
import { announce } from "@/lib/client/announcer";
import { authStore } from "@/lib/client/authStore";
import { commandLabel, describeRejection } from "@/lib/client/commandText";
import {
  addPending,
  canPersistPending,
  clearAllPending,
  loadAllPending,
  partitionPending,
  removePending,
  scopeKey,
  type PendingScope,
  type PersistedPending,
  type QuarantineReason,
  type QuarantinedPending,
} from "@/lib/client/pendingEnvelopes";

/**
 * Client of the REAL room authority (docs/phase2/contract.md, docs/phase2/ui.md, docs/phase3/ui.md).
 *
 * The server owns REAL state. This store only ever INSTALLS what the server returned:
 * - It never advances REAL state optimistically, never edits an installed session, and never installs an
 *   older revision over a newer one.
 * - It polls once a second while any REAL view is mounted and visible, with at most one request in flight.
 * - If contact fails, or more than 3 s pass since the last successful contact, the installed snapshot is kept
 *   but marked not-authoritative: `connection` leaves "connected", writes are refused and authority time freezes.
 * - A command's identity is its envelope. The exact envelope is persisted before it is sent. A lost response is
 *   UNKNOWN (never "failed"); unresolved commands are reconciled through the receipt endpoint and are never
 *   re-POSTed unless the operator explicitly retries the exact same envelope.
 *
 * Phase 3: the store runs only under an authenticated session (`authStore`). Its scope — actor id, workspace id
 * and restore generation — is the identity of everything it holds:
 * - a different actor, workspace or generation drops the installed snapshot and asks for a FULL resnapshot;
 * - pending commands are looked up and re-sent only for the current scope; older-generation and legacy records are
 *   quarantined (shown, never looked up, never replayed, never moved into the new generation);
 * - sign-out drops everything displayed at once and keeps the stored pending records untouched;
 * - a 401 ends the session; the last confirmed snapshot stays visible, frozen and read-only, until the same actor
 *   signs in again or anyone else does (which drops it).
 *
 * Authoritative REAL session state is held in memory only. localStorage keeps just the pending envelopes
 * (see pendingEnvelopes.ts).
 */

export const POLL_INTERVAL_MS = 1000;
export const STALE_AFTER_MS = 3000;
const STALE_CHECK_MS = 500;
const RECONCILE_DELAY_MS = 1000;
/** After the last consumer leaves, keep polling briefly so moving between pages does not flicker the status. */
const IDLE_LINGER_MS = 1500;
/** While the sign-in service cannot be asked, ask again this often. */
const AUTH_RETRY_MS = 5000;
/** Server-provided clock gaps up to this are noise, not a discontinuity worth surfacing. */
export const CLOCK_BEHIND_TOLERANCE_MS = 2000;

export type ConnectionState = "idle" | "connecting" | "connected" | "stale" | "disconnected";
export type AccessInfo = RoomRead["access"];

/**
 * Why the room cannot be shown as current, as far as anything told us. Never "empty": a problem is not a room
 * with no shows.
 *
 * Retried automatically (transient): `unreachable`, `backend_unavailable`, `storage_unavailable`, `rate_limited`.
 * Waiting for the person (the retry would only repeat the answer): `signed_out`, `session_ended`,
 * `auth_unavailable` (the session service is asked again every few seconds) and the blocking ones below.
 */
export type RemoteProblem =
  | "signed_out"
  | "session_ended"
  | "auth_unavailable"
  | "unreachable"
  | "backend_unavailable"
  | "storage_unavailable"
  | "rate_limited"
  /** 404: this session's workspace/room is not what the server is deployed for. */
  | "wrong_deployment"
  /** 400: the server did not receive this session's context. */
  | "context_required"
  /** 409: the room was restored; the session context is being re-read. */
  | "recovery_required"
  /** 403 `csrf_failed`: the server refused this browser request as unsafe. */
  | "request_refused"
  /** 403 to a read: access is being re-read. */
  | "forbidden";

const AUTH_PROBLEMS: ReadonlySet<RemoteProblem> = new Set(["signed_out", "session_ended", "auth_unavailable"]);
const BLOCKING_PROBLEMS: ReadonlySet<RemoteProblem> = new Set(["wrong_deployment", "context_required", "recovery_required", "request_refused", "forbidden"]);
const TRANSIENT_PROBLEMS: ReadonlySet<RemoteProblem> = new Set(["unreachable", "backend_unavailable", "storage_unavailable", "rate_limited"]);

export const isAuthProblem = (p: RemoteProblem | null): boolean => p !== null && AUTH_PROBLEMS.has(p);
export const isBlockingProblem = (p: RemoteProblem | null): boolean => p !== null && BLOCKING_PROBLEMS.has(p);
/** LiveLift keeps trying on its own. */
export const isTransientProblem = (p: RemoteProblem | null): boolean => p !== null && TRANSIENT_PROBLEMS.has(p);

export interface InFlightCommand {
  commandId: string;
  label: string;
}

/** A command whose outcome is not known: it may or may not have been committed. */
export interface UnresolvedCommand {
  commandId: string;
  label: string;
  envelope: CommandEnvelope;
  /** Plain-language account of what is and is not known. */
  detail: string;
  lookup: "idle" | "checking" | "absent" | "failed";
  retrying: boolean;
}

/**
 * A pending command from before this session's generation (or from an older build, owner unknown). It is only
 * displayed: it is never looked up, never sent again and never moved into the current generation.
 */
export interface QuarantinedCommand {
  commandId: string;
  label: string;
  reason: QuarantineReason;
  /** The generation it was made under; null for a record from before scoping existed. */
  generation: string | null;
}

/** A one-time message about a command that was unresolved and has now been settled (or set aside). */
export interface Resolution {
  id: string;
  commandId: string;
  label: string;
  tone: "ok" | "warn";
  text: string;
}

export interface RemoteState {
  /** At least one REAL view is mounted. */
  active: boolean;
  connection: ConnectionState;
  /** The last committed snapshot the server returned. Retained while stale. */
  snapshot: RoomSnapshot | null;
  access: AccessInfo | null;
  /** Informational: how far the server's raw clock trails time the authority already recorded (0 when none). Not part of display time. */
  clockBehindByMs: number;
  /** Why the room is not current, when it is not (null while connected or still connecting). */
  problem: RemoteProblem | null;
  lastError: string | null;
  inflight: InFlightCommand | null;
  /** Outcome-unknown commands of THIS actor, workspace and generation. They block new commands until resolved. */
  unresolved: UnresolvedCommand[];
  /** Older-generation and legacy pending commands. Informational only; they never block anything. */
  quarantined: QuarantinedCommand[];
  resolutions: Resolution[];
  /** Sessions the server confirmed creating that the installed snapshot does not contain yet. */
  awaitingSessionIds: string[];
}

const IDLE: RemoteState = {
  active: false,
  connection: "idle",
  snapshot: null,
  access: null,
  clockBehindByMs: 0,
  problem: null,
  lastError: null,
  inflight: null,
  unresolved: [],
  quarantined: [],
  resolutions: [],
  awaitingSessionIds: [],
};

export type CommandIntent = { body: AuthorityCommandBody; sessionId: string | null };

export type CommandOutcome =
  /** The authority committed the command. `viewCurrent` is false if the fresh snapshot could not be fetched yet. */
  | { status: "committed"; receipt: AuthorityReceipt; duplicate: boolean; viewCurrent: boolean }
  /** The authority refused the command. Nothing was recorded. */
  | { status: "rejected"; code: string | null; message: string; receipt: AuthorityReceipt | null }
  /** The response was lost. The command may have been committed. Reconcile before acting again. */
  | { status: "unknown"; commandId: string; message: string }
  /** The client declined to send. Nothing was transmitted. */
  | { status: "refused"; code: "not_connected" | "read_only" | "busy" | "unresolved" | "not_saved"; message: string };

/** What one failed request told the store, in the shape `applyFailure` reads. */
interface Failure {
  status: number | null;
  kind: string;
  code: string | null;
  message: string;
}

export interface RemoteStoreDeps {
  client?: AuthorityClient;
  /** Monotonic milliseconds (performance.now). Injected for tests. */
  perfNow?: () => number;
  newCommandId?: () => string;
}

const defaultPerfNow = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

function defaultCommandId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `cmd-${crypto.randomUUID()}`;
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
  return `cmd-${bytes}`;
}

/** Keep the previous object for any session whose recorded revision did not move, so unchanged views do not re-render. */
function reuseSessions(prev: RoomSnapshot | null, next: Session[]): Session[] {
  if (!prev) return next;
  const before = new Map(prev.sessions.map((s) => [s.id, s]));
  return next.map((s) => {
    const old = before.get(s.id);
    return old && old.revision === s.revision && old.updatedAtMs === s.updatedAtMs && old.events.length === s.events.length && old.lifecycle === s.lifecycle ? old : s;
  });
}

export class RemoteRoomStore {
  private state: RemoteState = IDLE;
  private listeners = new Set<() => void>();
  private client: AuthorityClient;
  private perfNow: () => number;
  private newCommandId: () => string;

  private consumers = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private authRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeAuth: (() => void) | null = null;
  private pollInFlight: Promise<void> | null = null;
  private reconciling: Promise<void> | null = null;
  private lastPollStartedPerf = 0;
  private forceFull = false;
  /** Announce connection changes only for real contact changes, not for the store being stopped. */
  private quiet = false;

  /**
   * Which actor / workspace / generation everything held here belongs to. `epoch` moves whenever that changes (or
   * protected state is dropped), so an answer that was already on its way for the OLD scope is recognised and
   * never installed under the new one.
   */
  private activeScopeKey: string | null = null;
  private snapshotScopeKey: string | null = null;
  private epoch = 0;

  /** Monotonic bookkeeping that changes every poll. Kept out of `state` so unchanged polls do not re-render the app. */
  private clock: AuthorityClockSample | null = null;
  private frozenAtPerfMs: number | null = null;
  private lastContactPerfMs: number | null = null;

  /** Pending commands of the CURRENT scope only. Everything else stays in storage, untouched. */
  private pendingEnvelopes = new Map<string, PersistedPending>();
  private quarantineEntries = new Map<string, QuarantinedPending>();
  private seq = 0;

  constructor(deps: RemoteStoreDeps = {}) {
    this.client = deps.client ?? createAuthorityClient();
    this.perfNow = deps.perfNow ?? defaultPerfNow;
    this.newCommandId = deps.newCommandId ?? defaultCommandId;
  }

  // ---- External-store plumbing --------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): RemoteState => this.state;
  getServerSnapshot = (): RemoteState => IDLE;

  /** Apply a change and notify only if something observable actually changed. */
  private patch(partial: Partial<RemoteState>): void {
    let changed = false;
    for (const key of Object.keys(partial) as Array<keyof RemoteState>) {
      if (!Object.is(this.state[key], partial[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    const before = this.state;
    this.state = { ...this.state, ...partial };
    this.announceConnection(before);
    for (const l of this.listeners) l();
  }

  /** Contact lost and contact restored are announced once each. Auth problems have their own announcement. */
  private announceConnection(before: RemoteState): void {
    if (this.quiet || !this.state.active || before.connection === this.state.connection) return;
    const now = this.state;
    if (before.connection === "connected" && (now.connection === "stale" || now.connection === "disconnected") && !isAuthProblem(now.problem)) {
      announce("Lost contact with the room. What you see is the last confirmed state, and changes are paused.", "polite");
    } else if ((before.connection === "stale" || before.connection === "disconnected") && before.snapshot !== null && now.connection === "connected") {
      announce("Reconnected to the room. What you see is current again.", "polite");
    }
  }

  // ---- Lifecycle ----------------------------------------------------------------------------------

  /** A REAL view is on screen. Polling runs while at least one holder exists. Returns the release function. */
  acquire(): () => void {
    this.consumers += 1;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (!this.state.active) this.start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.consumers -= 1;
      if (this.consumers === 0) {
        this.stopTimer = setTimeout(() => {
          this.stopTimer = null;
          if (this.consumers === 0) this.stop();
        }, IDLE_LINGER_MS);
      }
    };
  }

  private start(): void {
    this.patch({ active: true, connection: this.state.snapshot ? "stale" : "connecting" });
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onForeground);
    if (typeof window !== "undefined") {
      window.addEventListener("focus", this.onForeground);
      window.addEventListener("online", this.onForeground);
      window.addEventListener("pageshow", this.onForeground);
    }
    this.staleTimer = setInterval(this.checkStale, STALE_CHECK_MS);
    this.unsubscribeAuth = authStore.subscribe(this.syncAuth);
    authStore.ensureChecked();
    this.syncAuth();
  }

  private stop(): void {
    this.cancelTimers();
    this.unsubscribeAuth?.();
    this.unsubscribeAuth = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onForeground);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onForeground);
      window.removeEventListener("online", this.onForeground);
      window.removeEventListener("pageshow", this.onForeground);
    }
    // Contact is no longer being confirmed, so what is shown cannot be called current.
    this.freezeClock();
    this.quiet = true;
    this.patch({ active: false, connection: this.state.snapshot ? "stale" : "idle" });
    this.quiet = false;
  }

  private cancelTimers(): void {
    for (const t of [this.pollTimer, this.reconcileTimer, this.authRetryTimer]) if (t) clearTimeout(t);
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.pollTimer = this.staleTimer = this.reconcileTimer = this.authRetryTimer = null;
  }

  private isHidden(): boolean {
    return typeof document !== "undefined" && document.visibilityState === "hidden";
  }

  private onForeground = (): void => {
    if (!this.state.active || this.isHidden() || authStore.getContext() === null) return;
    void this.refreshNow();
  };

  // ---- Session scope ------------------------------------------------------------------------------

  /**
   * React to the auth store. The room is only ever asked under the CURRENT authenticated session; whenever that
   * session's actor, workspace or generation differs from what is installed, what is installed is dropped.
   */
  private syncAuth = (): void => {
    if (!this.state.active) return;
    const auth = authStore.getSnapshot();
    if (auth.status !== "unavailable" && this.authRetryTimer) {
      clearTimeout(this.authRetryTimer);
      this.authRetryTimer = null;
    }
    switch (auth.status) {
      case "authenticated": {
        const scope = authStore.getScope();
        if (!scope) return;
        const key = scopeKey(scope);
        if (key !== this.activeScopeKey) this.enterScope(scope, key);
        else if (isAuthProblem(this.state.problem)) this.patch({ problem: null, lastError: null });
        this.ensurePolling();
        return;
      }
      case "checking":
      case "signing_in":
        // Nothing may be sent until the session is known; do not flash over a problem that is already on screen.
        if (this.state.problem === null && !this.state.snapshot) this.patch({ connection: "connecting" });
        return;
      case "signing_out":
      case "signed_out":
        this.dropProtectedState("signed_out", "You are signed out, so REAL shows are not shown.");
        return;
      case "ended":
        this.markEnded();
        return;
      case "unavailable":
        this.freezeClock();
        this.patch({
          connection: this.state.snapshot ? "stale" : "disconnected",
          problem: "auth_unavailable",
          lastError: auth.unavailable?.message ?? "The sign-in service could not be asked.",
        });
        if (!this.authRetryTimer) {
          this.authRetryTimer = setTimeout(() => {
            this.authRetryTimer = null;
            if (this.state.active && authStore.getSnapshot().status === "unavailable") void authStore.bootstrap();
          }, AUTH_RETRY_MS);
        }
        return;
    }
  };

  /** A different (or first) actor/workspace/generation: nothing installed under another scope may be shown under this one. */
  private enterScope(scope: PendingScope, key: string): void {
    this.activeScopeKey = key;
    if (this.snapshotScopeKey !== key) {
      this.epoch += 1;
      // Another actor, workspace or restore generation: full authoritative resnapshot, nothing carried over.
      this.clock = null;
      this.frozenAtPerfMs = null;
      this.lastContactPerfMs = null;
      this.forceFull = true;
      this.snapshotScopeKey = null;
      this.patch({ snapshot: null, access: null, clockBehindByMs: 0, connection: "connecting", problem: null, lastError: null, awaitingSessionIds: [], resolutions: [], inflight: null });
      this.loadScopedPending(scope);
    } else {
      // The same actor signed in again under the same generation: keep what is held and read on from it.
      this.patch({ problem: null, lastError: null });
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Sign-out (or an unknown session): the protected REAL view goes away at once. Stored pending records stay saved. */
  private dropProtectedState(problem: RemoteProblem, message: string): void {
    this.cancelPolling();
    this.epoch += 1;
    this.activeScopeKey = null;
    this.snapshotScopeKey = null;
    this.clock = null;
    this.frozenAtPerfMs = null;
    this.lastContactPerfMs = null;
    this.forceFull = false;
    this.pendingEnvelopes.clear();
    this.quarantineEntries.clear();
    this.patch({
      snapshot: null,
      access: null,
      clockBehindByMs: 0,
      connection: "disconnected",
      problem,
      lastError: message,
      inflight: null,
      unresolved: [],
      quarantined: [],
      resolutions: [],
      awaitingSessionIds: [],
    });
  }

  /** The session expired or was revoked. What was last confirmed stays visible, frozen, and nothing more is sent. */
  private markEnded(): void {
    this.cancelPolling();
    this.freezeClock();
    this.patch({
      connection: this.state.snapshot ? "stale" : "disconnected",
      problem: "session_ended",
      lastError: "Your session ended (it expired or was revoked).",
    });
  }

  private cancelPolling(): void {
    for (const t of [this.pollTimer, this.reconcileTimer]) if (t) clearTimeout(t);
    this.pollTimer = this.reconcileTimer = null;
  }

  private ensurePolling(): void {
    if (!this.state.active || this.isHidden() || authStore.getContext() === null) return;
    if (isBlockingProblem(this.state.problem)) return;
    if (this.pollInFlight || this.pollTimer) return;
    void this.poll();
  }

  private checkStale = (): void => {
    if (this.state.connection !== "connected" || this.lastContactPerfMs === null) return;
    if (this.perfNow() - this.lastContactPerfMs > STALE_AFTER_MS) {
      this.freezeClock();
      this.patch({ connection: "stale", problem: this.state.problem ?? "unreachable", lastError: "No contact with the room for more than 3 seconds." });
    }
  };

  private freezeClock(): void {
    if (this.frozenAtPerfMs === null && this.clock) this.frozenAtPerfMs = this.perfNow();
  }

  /**
   * Forget everything this tab holds in memory AND every stored pending record. Tests only: sign-out never calls
   * it, because an unresolved command is not resolved by signing out and its record must survive.
   */
  reset(): void {
    this.cancelTimers();
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.unsubscribeAuth?.();
    this.unsubscribeAuth = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onForeground);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onForeground);
      window.removeEventListener("online", this.onForeground);
      window.removeEventListener("pageshow", this.onForeground);
    }
    this.consumers = 0;
    this.pollInFlight = null;
    this.reconciling = null;
    this.forceFull = false;
    this.epoch += 1;
    this.activeScopeKey = null;
    this.snapshotScopeKey = null;
    this.clock = null;
    this.frozenAtPerfMs = null;
    this.lastContactPerfMs = null;
    this.pendingEnvelopes.clear();
    this.quarantineEntries.clear();
    clearAllPending();
    this.state = IDLE;
    for (const l of this.listeners) l();
  }

  // ---- Polling ------------------------------------------------------------------------------------

  /** Poll now (or join the poll already in flight). At most one request is ever outstanding. */
  refreshNow(): Promise<void> {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    // A manual retry of a blocked room first asks the server what this session is now.
    if (isBlockingProblem(this.state.problem)) {
      return authStore.refresh().then(() => {
        if (authStore.getContext() === null) return;
        this.patch({ problem: null });
        return this.poll();
      });
    }
    return this.poll();
  }

  private poll(): Promise<void> {
    if (this.pollInFlight) return this.pollInFlight;
    const run = this.doPoll().finally(() => {
      this.pollInFlight = null;
      this.scheduleNext();
    });
    this.pollInFlight = run;
    return run;
  }

  private async doPoll(): Promise<void> {
    if (authStore.getContext() === null) return; // no authenticated session: nothing is sent
    const epoch = this.epoch;
    const started = this.perfNow();
    this.lastPollStartedPerf = started;
    const after = this.forceFull ? null : (this.state.snapshot?.revision ?? null);
    this.forceFull = false;
    const res = await this.client.getRoom({ afterRevision: after });
    if (epoch !== this.epoch) return; // this answer belongs to a session that is no longer the current one
    const ended = this.perfNow();
    if (res.ok) this.applyRead(res.read, (started + ended) / 2, ended);
    else this.applyFailure(res);
  }

  private scheduleNext(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    if (!this.state.active || this.isHidden() || authStore.getContext() === null || isBlockingProblem(this.state.problem)) return;
    const wait = this.forceFull ? 0 : Math.max(0, POLL_INTERVAL_MS - (this.perfNow() - this.lastPollStartedPerf));
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      if (this.isHidden()) return; // a hidden view does not poll; foregrounding polls at once
      void this.poll();
    }, wait);
  }

  private applyRead(read: RoomRead, midPerfMs: number, endPerfMs: number): void {
    const prev = this.state.snapshot;
    let snapshot = prev;
    if (read.changed) {
      // Never install an older revision over a newer snapshot (e.g. a reordered or replayed response).
      if (!prev || prev.roomId !== read.roomId || read.revision >= prev.revision) {
        snapshot = { roomId: read.roomId, revision: read.revision, sessions: reuseSessions(prev, read.sessions) };
      }
    } else if (!prev || prev.roomId !== read.roomId || prev.revision !== read.revision) {
      // "Unchanged" must refer to what we hold. If it does not, ask for the full snapshot; keep what we have meanwhile.
      this.forceFull = true;
    }

    this.clock = { serverNowMs: read.serverNowMs, receivedPerfMs: midPerfMs };
    this.frozenAtPerfMs = null;
    this.lastContactPerfMs = endPerfMs;
    if (snapshot) this.snapshotScopeKey = this.activeScopeKey;
    const reconnected = this.state.connection !== "connected";
    const present = new Set(snapshot?.sessions.map((s) => s.id) ?? []);
    const awaiting = this.state.awaitingSessionIds.filter((id) => !present.has(id));
    this.patch({
      connection: "connected",
      snapshot,
      access: read.access,
      clockBehindByMs: read.clockBehindByMs,
      problem: null,
      lastError: null,
      awaitingSessionIds: awaiting.length === this.state.awaitingSessionIds.length ? this.state.awaitingSessionIds : awaiting,
    });
    // The role the room reports is the one that counts: a role change shows up here without a reload.
    authStore.observeAccess(read.access);
    if (reconnected && this.state.unresolved.length > 0) this.scheduleReconcile(0);
  }

  /** Turn what one failed request said into the state it truthfully supports. */
  private applyFailure(f: Failure): void {
    if (f.kind === "unauthenticated") return; // the auth store owns "no session"
    if (f.status === 401) {
      // Expired or revoked. The auth store flips to `ended`, and `syncAuth` freezes the display.
      this.freezeClock();
      authStore.markSessionEnded();
      return;
    }
    this.freezeClock();
    const connection: ConnectionState = this.state.snapshot ? "stale" : "disconnected";
    let problem: RemoteProblem;
    let message = f.message;
    if (f.status === 403 && f.code === "csrf_failed") {
      problem = "request_refused";
      message = "The server refused this browser's request as unsafe. Reload the page; if it persists, sign out and in again.";
    } else if (f.status === 403) {
      problem = "forbidden";
      message = "The room did not allow this session to read it. Access is being re-checked.";
    } else if (f.status === 400 && f.code === "context_required") {
      problem = "context_required";
      message = "The server did not receive this session's workspace context. The session is being re-checked.";
    } else if (f.status === 404) {
      problem = "wrong_deployment";
      message = "This session's workspace or room is not the one this server is set up for.";
    } else if (f.status === 409 && f.code === "recovery_required") {
      problem = "recovery_required";
      message = "The room was restored from a backup. LiveLift is re-reading the session and will reload the room.";
    } else if (f.status === 429) {
      problem = "rate_limited";
      message = "The room is limiting how often it is asked. LiveLift will try again.";
    } else if (f.code === "storage_unavailable") {
      problem = "storage_unavailable";
      message = "The room's storage is not available, so REAL shows cannot be read or recorded right now. This is not an empty room.";
    } else if (f.code === "authority_unavailable" || (f.status !== null && f.status >= 500)) {
      problem = "backend_unavailable";
      message = "The room server is not available right now. This is not an empty room.";
    } else {
      problem = "unreachable";
    }
    this.patch({ connection, problem, lastError: message });
    // The session may have changed under us (a restore, a role change): ask the server what it is now.
    if (isBlockingProblem(problem)) void authStore.refresh();
  }

  // ---- Time ---------------------------------------------------------------------------------------

  /** The authority's corrected "now" (`serverNowMs` + monotonic elapsed), frozen while not connected. */
  authorityNow(): number | null {
    return this.clock ? authorityNowMs(this.clock, this.perfNow(), this.frozenAtPerfMs) : null;
  }

  /** Milliseconds since the last successful contact, or null if there has been none. */
  lastContactAgeMs(): number | null {
    return this.lastContactPerfMs === null ? null : Math.max(0, this.perfNow() - this.lastContactPerfMs);
  }

  /** The loaded snapshot belongs to the authority and is current: writes may be attempted. */
  isAuthoritative(): boolean {
    return this.state.connection === "connected" && this.state.snapshot !== null;
  }

  private inCurrentScope(): PendingScope | null {
    const scope = authStore.getScope();
    return scope && scopeKey(scope) === this.activeScopeKey ? scope : null;
  }

  // ---- Commands -----------------------------------------------------------------------------------

  /**
   * Send ONE operator intent to the authority. Resolves only when the outcome is known (committed / rejected),
   * known to be unknown, or the client declined to send. Nothing in `snapshot` changes until the server says so.
   */
  async submit(intent: CommandIntent): Promise<CommandOutcome> {
    const { snapshot, access } = this.state;
    const label = commandLabel(intent.body.type);
    const scope = this.inCurrentScope();
    if (!snapshot || this.state.connection !== "connected" || !scope) {
      return { status: "refused", code: "not_connected", message: `Not connected to the room, so what is shown may be out of date. ${label} was not sent.` };
    }
    if (access?.role !== "operator") {
      return { status: "refused", code: "read_only", message: describeRejection("forbidden", null, access?.role ?? null) };
    }
    if (this.state.inflight) {
      return { status: "refused", code: "busy", message: `Still waiting for “${this.state.inflight.label}” to be confirmed. Nothing else was sent.` };
    }
    if (this.state.unresolved.length > 0) {
      return {
        status: "refused",
        code: "unresolved",
        message: `The outcome of “${this.state.unresolved[0].label}” is not known yet. Resolve it before sending anything else.`,
      };
    }
    if (!canPersistPending()) {
      return { status: "refused", code: "not_saved", message: "This browser cannot keep a record of the pending action, so it was not sent. Nothing was recorded." };
    }

    const { type, ...payload } = intent.body;
    const envelope = {
      commandId: this.newCommandId(),
      roomId: snapshot.roomId,
      sessionId: intent.sessionId,
      expectedRevision: snapshot.revision,
      type,
      payload,
    } as CommandEnvelope;
    const outcome = await this.transmit({ scope, envelope, label });
    this.announceOutcome(label, outcome);
    return outcome;
  }

  /** A command's FINAL answer is announced once, here. Nothing about a pending or waiting state is announced. */
  private announceOutcome(label: string, outcome: CommandOutcome): void {
    if (outcome.status === "committed") announce(`${label}: recorded by the room.`, "polite");
    else if (outcome.status === "rejected") announce(`${label}: not accepted. ${outcome.message}`, "assertive");
    else if (outcome.status === "unknown") announce(`${label}: outcome unknown. It may or may not have been recorded.`, "assertive");
    else announce(outcome.message, "assertive"); // refused: nothing was sent, and the person who clicked should hear why
  }

  /** Persist the exact envelope, send it, and settle the answer. Also used for an explicit retry of the same envelope. */
  private async transmit(entry: PersistedPending): Promise<CommandOutcome> {
    const { envelope, label } = entry;
    const epoch = this.epoch;
    this.pendingEnvelopes.set(envelope.commandId, entry);
    if (!addPending(entry)) {
      this.pendingEnvelopes.delete(envelope.commandId);
      return { status: "refused", code: "not_saved", message: "This browser could not record the pending action, so it was not sent. Nothing was recorded." };
    }
    this.patch({ inflight: { commandId: envelope.commandId, label } });
    const result = await this.client.postCommand(envelope);
    const current = epoch === this.epoch;
    if (current) this.patch({ inflight: null });

    if (!current) {
      // Signed out, or the session's scope changed, while this was on its way. It is neither cancelled nor failed.
      if (result.kind === "response" && result.response.receipt.commandId === envelope.commandId) {
        const receipt = result.response.receipt;
        removePending(entry.scope, envelope.commandId); // the answer is known: nothing left to reconcile
        return receipt.outcome === "committed"
          ? { status: "committed", receipt, duplicate: result.response.duplicate, viewCurrent: false }
          : { status: "rejected", code: receipt.code, message: describeRejection(receipt.code, receipt.message, null), receipt };
      }
      return {
        status: "unknown",
        commandId: envelope.commandId,
        message: `You signed out, or the session changed, while “${label}” was being confirmed. It may or may not have been recorded. Its record stays saved under your account.`,
      };
    }

    if (result.kind === "response") {
      const receipt = result.response.receipt;
      if (receipt.commandId !== envelope.commandId) {
        return this.markUnknown(envelope, label, "The room answered with a receipt for a different command.");
      }
      return this.settleReceipt(envelope.commandId, receipt, result.response.duplicate);
    }
    if (result.kind === "refused") {
      // The server refused before executing anything: this is a definite "not recorded".
      this.forgetPending(envelope.commandId);
      const code = result.status === 404 ? "wrong_deployment" : (result.code ?? (result.status === 409 ? "stale_revision" : null));
      if (code === "stale_revision") await this.refreshNow();
      else if (code === "wrong_deployment" || code === "context_required" || code === "recovery_required" || code === "csrf_failed") {
        this.applyFailure({ status: result.status, kind: "http", code: result.status === 404 ? "not_found" : code, message: result.message });
      } else if (code === "forbidden") void authStore.refresh(); // a role change shows up here
      return { status: "rejected", code, message: describeRejection(code, result.message, this.state.access?.role ?? null), receipt: null };
    }
    // Unknown. A 401 is not a rejection: the session may have ended after the command was already sent.
    if (result.status === 401) authStore.markSessionEnded();
    return this.markUnknown(envelope, label, result.message);
  }

  /** A receipt (from the POST, a duplicate answer, or a lookup) turns the command into a known outcome. */
  private async settleReceipt(commandId: string, receipt: AuthorityReceipt, duplicate: boolean): Promise<CommandOutcome> {
    this.forgetPending(commandId);
    if (receipt.outcome === "rejected") {
      if (receipt.code === "stale_revision") await this.refreshNow();
      return { status: "rejected", code: receipt.code, message: describeRejection(receipt.code, receipt.message, this.state.access?.role ?? null), receipt };
    }
    // Committed. A receipt is not the new state: fetch a snapshot at or past the commit before reporting it.
    if (receipt.sessionId) this.patch({ awaitingSessionIds: [...new Set([...this.state.awaitingSessionIds, receipt.sessionId])] });
    const viewCurrent = await this.refreshUntil(receipt.roomRevisionAfter);
    return { status: "committed", receipt, duplicate, viewCurrent };
  }

  /** Poll until an installed snapshot is at or beyond `revision`. A poll already in flight may predate the commit. */
  private async refreshUntil(revision: number, attempts = 3): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      await this.refreshNow();
      if ((this.state.snapshot?.revision ?? -1) >= revision) return true;
      if (this.state.connection !== "connected") return false;
    }
    return false;
  }

  private markUnknown(envelope: CommandEnvelope, label: string, why: string): CommandOutcome {
    const entry: UnresolvedCommand = {
      commandId: envelope.commandId,
      label,
      envelope,
      detail: `${why} “${label}” may or may not have been recorded.`,
      lookup: "idle",
      retrying: false,
    };
    this.patch({ unresolved: [...this.state.unresolved.filter((u) => u.commandId !== envelope.commandId), entry] });
    this.scheduleReconcile(RECONCILE_DELAY_MS);
    void this.refreshNow();
    return { status: "unknown", commandId: envelope.commandId, message: entry.detail };
  }

  private forgetPending(commandId: string): void {
    const held = this.pendingEnvelopes.get(commandId);
    this.pendingEnvelopes.delete(commandId);
    if (held) removePending(held.scope, commandId);
    if (this.state.unresolved.some((u) => u.commandId === commandId)) {
      this.patch({ unresolved: this.state.unresolved.filter((u) => u.commandId !== commandId) });
    }
  }

  /**
   * Split what storage holds for this browser: the current scope's work becomes `unresolved` (it can be looked up and
   * re-sent); older-generation and legacy records become `quarantined` (display only); other actors' records are
   * not read into memory at all.
   */
  private loadScopedPending(scope: PendingScope): void {
    const { current, quarantined } = partitionPending(loadAllPending(), scope);
    this.pendingEnvelopes.clear();
    this.quarantineEntries.clear();
    const unresolved: UnresolvedCommand[] = current.map((p) => {
      this.pendingEnvelopes.set(p.envelope.commandId, p);
      return {
        commandId: p.envelope.commandId,
        label: p.label,
        envelope: p.envelope,
        detail: `“${p.label}” was interrupted before its outcome was known. It may or may not have been recorded.`,
        lookup: "idle",
        retrying: false,
      };
    });
    for (const q of quarantined) this.quarantineEntries.set(q.envelope.commandId, q);
    if (unresolved.length > 0) announce(`${unresolved.length === 1 ? "An earlier action is" : "Earlier actions are"} still waiting for confirmation. Check their status before recording anything else.`, "polite");
    this.patch({
      unresolved,
      quarantined: quarantined.map((q) => ({ commandId: q.envelope.commandId, label: q.label, reason: q.reason, generation: q.scope?.generation ?? null })),
    });
  }

  // ---- Reconciliation (receipt lookup — never a re-POST) -------------------------------------------

  private scheduleReconcile(delayMs: number): void {
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      void this.reconcile();
    }, delayMs);
  }

  /** Ask the authority what happened to each unresolved command of the current scope. Read-only: nothing is sent again. */
  reconcile(): Promise<void> {
    if (this.reconciling) return this.reconciling;
    const run = this.doReconcile().finally(() => {
      this.reconciling = null;
    });
    this.reconciling = run;
    return run;
  }

  private setUnresolved(commandId: string, change: Partial<UnresolvedCommand>): void {
    this.patch({ unresolved: this.state.unresolved.map((u) => (u.commandId === commandId ? { ...u, ...change } : u)) });
  }

  private async doReconcile(): Promise<void> {
    const epoch = this.epoch;
    for (const entry of [...this.state.unresolved]) {
      if (entry.retrying) continue;
      if (epoch !== this.epoch) return;
      this.setUnresolved(entry.commandId, { lookup: "checking" });
      const res = await this.client.getReceipt(entry.commandId);
      if (epoch !== this.epoch) return; // the session changed: this lookup is not for the current scope any more
      if (res.kind === "found") {
        const outcome = await this.settleReceipt(entry.commandId, res.receipt, true);
        this.addResolution(
          entry,
          outcome.status === "committed" ? "ok" : "warn",
          outcome.status === "committed"
            ? `“${entry.label}” was confirmed: the room did record it.`
            : `“${entry.label}” was not accepted by the room: ${outcome.status === "rejected" ? outcome.message : "rejected"}`
        );
      } else if (res.kind === "absent") {
        this.setUnresolved(entry.commandId, {
          lookup: "absent",
          detail: `The room has no record of “${entry.label}”. That does not prove it failed. It has not been sent again.`,
        });
      } else {
        if (res.status === 401) authStore.markSessionEnded();
        this.setUnresolved(entry.commandId, { lookup: "failed", detail: `Could not check “${entry.label}” yet: ${res.message}` });
      }
    }
  }

  /** Operator action: look the commands up again now. */
  checkUnresolved(): Promise<void> {
    return this.reconcile();
  }

  /**
   * Operator action: send the exact same envelope again (same commandId, same expectedRevision, same payload).
   * If the original was committed the server answers with the original receipt; if the room moved on it rejects
   * the command as stale and nothing is applied twice. Only work of the CURRENT scope can be re-sent.
   */
  async retryUnresolved(commandId: string): Promise<CommandOutcome> {
    const entry = this.state.unresolved.find((u) => u.commandId === commandId);
    const held = this.pendingEnvelopes.get(commandId);
    const scope = this.inCurrentScope();
    if (!entry || !held || !scope || !sameScopeKey(held.scope, scope)) return { status: "refused", code: "unresolved", message: "That action is no longer waiting." };
    if (!this.isAuthoritative()) {
      return { status: "refused", code: "not_connected", message: "Not connected to the room, so the action was not sent again." };
    }
    if (this.state.access?.role !== "operator") {
      return { status: "refused", code: "read_only", message: describeRejection("forbidden", null, this.state.access?.role ?? null) };
    }
    if (this.state.inflight) return { status: "refused", code: "busy", message: "Another action is still being confirmed." };
    this.setUnresolved(commandId, { retrying: true });
    const outcome = await this.transmit(held);
    // `transmit` already cleared the entry on a known outcome; on a second unknown it re-created it (retrying: false).
    if (outcome.status === "committed" || outcome.status === "rejected") {
      this.addResolution(
        entry,
        outcome.status === "committed" ? "ok" : "warn",
        outcome.status === "committed" ? `“${entry.label}” is confirmed.` : `“${entry.label}” was not accepted: ${outcome.message}`
      );
    } else {
      this.setUnresolved(commandId, { retrying: false });
    }
    return outcome;
  }

  /**
   * Operator action: stop waiting on an unresolved command. The outcome stays UNKNOWN — this does not mean it
   * failed. The room's snapshot remains the only truth about what was recorded.
   */
  dismissUnresolved(commandId: string): void {
    const entry = this.state.unresolved.find((u) => u.commandId === commandId);
    if (!entry) return;
    this.forgetPending(commandId);
    this.addResolution(entry, "warn", `“${entry.label}” was set aside with its outcome still unknown. Check the show history to see whether it was recorded.`);
  }

  /**
   * Operator action: stop listing a quarantined command. It is not looked up, sent or attached to anything first:
   * setting it aside only removes this browser's note of it.
   */
  dismissQuarantined(commandId: string): void {
    const held = this.quarantineEntries.get(commandId);
    if (!held) return;
    this.quarantineEntries.delete(commandId);
    removePending(held.scope, commandId);
    this.patch({ quarantined: this.state.quarantined.filter((q) => q.commandId !== commandId) });
  }

  private addResolution(entry: UnresolvedCommand, tone: Resolution["tone"], text: string): void {
    this.seq += 1;
    this.patch({ resolutions: [...this.state.resolutions, { id: `res-${this.seq}`, commandId: entry.commandId, label: entry.label, tone, text }] });
    announce(text, tone === "warn" ? "assertive" : "polite");
  }

  dismissResolution(id: string): void {
    this.patch({ resolutions: this.state.resolutions.filter((r) => r.id !== id) });
  }
}

const sameScopeKey = (a: PendingScope | null, b: PendingScope): boolean => a !== null && scopeKey(a) === scopeKey(b);

export const remoteRoomStore = new RemoteRoomStore();
