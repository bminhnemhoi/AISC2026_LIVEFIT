"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { EnvironmentIdentity, Session } from "@/contracts";
import {
  CLOCK_DISCONTINUITY_TOLERANCE_MS,
  advanceDeviceClock,
  effectiveNowMs,
  lastRecordedMs,
  type ClockState,
} from "@/lib/domain";
import { authStore, type AuthState } from "@/lib/client/authStore";
import { sessionStore, type DispatchInput, type DispatchResult, type StoreState } from "./sessionStore";
import {
  CLOCK_BEHIND_TOLERANCE_MS,
  remoteRoomStore,
  type CommandIntent,
  type CommandOutcome,
  type InFlightCommand,
  type RemoteProblem,
  type RemoteState,
} from "./remoteRoomStore";

/** Subscribe to the store and trigger hydration on the client (server render stays unhydrated). */
export function useStoreState(): StoreState {
  const state = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot
  );
  useEffect(() => {
    sessionStore.hydrate();
  }, []);
  return state;
}

/** Where a show's authority lives: REAL shows on the room server, SIMULATED rehearsals and the legacy archive in this browser. */
export type SessionSource = "remote" | "local";

export type SessionLookup =
  | { status: "loading"; session: null }
  /** The room cannot be asked (signed out, session ended, backend/storage unavailable, wrong deployment…) and nothing about this id is known. */
  | { status: "unavailable"; session: null; reason: string; problem: RemoteProblem | null }
  | { status: "missing"; session: null }
  /** `archive`: a pre-Phase-2 REAL show kept in this browser. Read-only history, never uploaded or merged. */
  | { status: "ready"; session: Session; source: SessionSource; archive: boolean };

/** Who is signed in, as the server last described it (never a token; the cookie is not readable here). */
export function useAuth(): AuthState {
  return useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getServerSnapshot);
}

/** Subscribe to the room store without keeping it polling. */
export function useRemoteState(): RemoteState {
  return useSyncExternalStore(remoteRoomStore.subscribe, remoteRoomStore.getSnapshot, remoteRoomStore.getServerSnapshot);
}

/** Subscribe to the room store AND keep it polling while the calling view is mounted (and `enabled`). */
export function useRemoteRoom(enabled = true): RemoteState {
  const state = useRemoteState();
  useEffect(() => {
    if (!enabled) return;
    return remoteRoomStore.acquire();
  }, [enabled]);
  return state;
}

/**
 * Resolve a show by its exact id. SIMULATED rehearsals come from this browser; REAL shows come from the room
 * snapshot. An unknown id never falls back to some other show, and a REAL id is never "missing" while the room
 * cannot be asked. `archive` selects a pre-Phase-2 REAL show from this browser instead of the room.
 */
export function useSession(id: string, opts: { archive?: boolean } = {}): SessionLookup {
  const local = useStoreState();
  const localSession = local.hydrated ? (local.sessions.find((s) => s.id === id) ?? null) : null;
  const wantsArchive = opts.archive === true;
  const isRehearsal = localSession?.environment === "SIMULATED" && !wantsArchive;
  const remote = useRemoteRoom(local.hydrated && !isRehearsal && !wantsArchive);

  if (!local.hydrated) return { status: "loading", session: null };
  if (wantsArchive) {
    return localSession && localSession.environment === "REAL"
      ? { status: "ready", session: localSession, source: "local", archive: true }
      : { status: "missing", session: null };
  }
  if (localSession && isRehearsal) return { status: "ready", session: localSession, source: "local", archive: false };

  const found = remote.snapshot?.sessions.find((s) => s.id === id);
  if (found) return { status: "ready", session: found, source: "remote", archive: false };
  if (remote.awaitingSessionIds.includes(id)) return { status: "loading", session: null };
  // "Missing" is only ever said about a room that is connected and has answered; a problem is never "no such show".
  if (remote.snapshot && remote.connection === "connected" && remote.problem === null) return { status: "missing", session: null };
  if (remote.problem !== null || remote.connection === "disconnected" || (remote.snapshot && remote.connection === "stale")) {
    return { status: "unavailable", session: null, reason: remote.lastError ?? "The room cannot be reached.", problem: remote.problem };
  }
  return { status: "loading", session: null };
}

export interface SessionsView {
  /** Local storage has loaded. REAL shows depend on the room (`remote.snapshot`), never on this. */
  hydrated: boolean;
  /** REAL shows from the room snapshot plus SIMULATED rehearsals from this browser. */
  sessions: Session[];
  remote: RemoteState;
}

export function useSessions(env?: EnvironmentIdentity): SessionsView {
  const state = useStoreState();
  const remote = useRemoteRoom(env !== "SIMULATED");
  const real = env === "SIMULATED" ? [] : (remote.snapshot?.sessions ?? []);
  const rehearsals = env === "REAL" ? [] : state.sessions.filter((s) => s.environment === "SIMULATED");
  return { hydrated: state.hydrated, sessions: [...real, ...rehearsals], remote };
}

/** REAL shows recorded in this browser before Phase 2. History only: they are not part of the room. */
export function useLegacyArchive(): { hydrated: boolean; sessions: Session[] } {
  const state = useStoreState();
  return { hydrated: state.hydrated, sessions: state.sessions.filter((s) => s.environment === "REAL") };
}

export interface ClockDiscontinuity {
  /** "device": this browser's wall clock moved back (SIMULATED/legacy). "server": the room's clock is behind recorded time. */
  source: "device" | "server";
  /** What the clock in question reads (the device clock, or the server clock for a REAL room). */
  deviceNowMs: number;
  /** The time the desk keeps using (never earlier than a time already shown or recorded). */
  keptNowMs: number;
  behindByMs: number;
}

export interface DeskClock {
  /** null until mounted, so server and first client render agree. */
  nowMs: number | null;
  /** The device clock is behind the time LiveLift keeps: alignment is uncertain. */
  discontinuity: ClockDiscontinuity | null;
  /** A fresh reading for a command, taken at the moment of the click. */
  read: () => number;
}

/**
 * The clock the desk renders and records with.
 * - SIMULATED: the session's virtual clock (changes only through recorded commands).
 * - REAL: the device clock, ticking once a second after mount. It is monotonic: a backward wall-clock
 *   jump never makes "now" earlier than a time already shown or recorded (so a missed anchor cannot
 *   quietly become on-track); time keeps advancing on the browser's monotonic timer and the gap is surfaced.
 */
export function useDeskClock(session: Session | null, tickMs = 1000): DeskClock {
  const isReal = session?.environment === "REAL";
  const sessionId = session?.id ?? null;
  const floor = session && isReal ? lastRecordedMs(session) : null;
  const floorRef = useRef<number | null>(floor);
  const stateRef = useRef<ClockState | null>(null);
  const [reading, setReading] = useState<{ nowMs: number; deviceNowMs: number; behindByMs: number } | null>(null);

  useEffect(() => {
    floorRef.current = floor;
  }, [floor]);

  const read = useCallback((): { nowMs: number; deviceNowMs: number; behindByMs: number } => {
    const device = Date.now();
    const perf = typeof performance !== "undefined" ? performance.now() : 0;
    let prev = stateRef.current;
    const f = floorRef.current;
    // Never before the latest recorded event: that time was already used.
    if (f !== null && (prev === null || f > prev.nowMs)) prev = { nowMs: f, perfMs: perf };
    const r = advanceDeviceClock(prev, device, perf);
    stateRef.current = r.state;
    return { nowMs: r.state.nowMs, deviceNowMs: device, behindByMs: r.behindByMs };
  }, []);

  useEffect(() => {
    if (!isReal) return;
    stateRef.current = null;
    const tick = (): void => setReading(read());
    tick();
    const timer = window.setInterval(tick, tickMs);
    return () => window.clearInterval(timer);
  }, [isReal, tickMs, sessionId, read]);

  if (!session) return { nowMs: null, discontinuity: null, read: () => Date.now() };
  if (session.environment === "SIMULATED") {
    const v = effectiveNowMs(session, 0);
    return { nowMs: v, discontinuity: null, read: () => v };
  }
  return {
    nowMs: reading?.nowMs ?? null,
    discontinuity:
      reading && reading.behindByMs > CLOCK_DISCONTINUITY_TOLERANCE_MS
        ? { source: "device", deviceNowMs: reading.deviceNowMs, keptNowMs: reading.nowMs, behindByMs: reading.behindByMs }
        : null,
    read: () => read().nowMs,
  };
}

/** The clock the screen should render with (see useDeskClock). */
export function useNow(session: Session | null, tickMs = 1000): number | null {
  return useDeskClock(session, tickMs).nowMs;
}

/** Dispatch commands for a session using the revision the screen rendered, so a stale click is rejected. */
export function useSessionActions(session: Session | null): {
  dispatch: (input: DispatchInput) => DispatchResult | null;
} {
  const sessionId = session?.id ?? null;
  const renderedRevision = session?.revision;
  const dispatch = useCallback(
    (input: DispatchInput): DispatchResult | null => {
      if (!sessionId) return null;
      return sessionStore.dispatch(sessionId, { expectedRevision: renderedRevision, ...input });
    },
    [sessionId, renderedRevision]
  );
  return { dispatch };
}

/**
 * The clock a REAL room show renders with. It never reads the browser wall clock: it is the server's time,
 * interpolated on the monotonic timer, and it FREEZES while the room is stale or disconnected.
 */
export function useAuthorityClock(tickMs = 1000): DeskClock {
  const remote = useRemoteState();
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = (): void => setNowMs(remoteRoomStore.authorityNow());
    tick();
    const timer = window.setInterval(tick, tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs, remote.connection, remote.clockBehindByMs, remote.snapshot]);

  // `nowMs` is already the room's corrected time. The discontinuity is a disclosure: the server's raw clock reads
  // `nowMs - behind`, and LiveLift keeps showing the corrected time. `behind` is never added to `nowMs`.
  const behind = remote.clockBehindByMs;
  return {
    nowMs,
    discontinuity:
      nowMs !== null && behind > CLOCK_BEHIND_TOLERANCE_MS
        ? { source: "server", deviceNowMs: nowMs - behind, keptNowMs: nowMs, behindByMs: behind }
        : null,
    read: () => remoteRoomStore.authorityNow() ?? nowMs ?? 0,
  };
}

export interface RemoteCommands {
  role: "operator" | "viewer" | null;
  /** REAL mutation controls may be used right now. */
  canWrite: boolean;
  /** Why they may not, in words for the operator (null when they may, or while a command is simply pending). */
  blockedReason: string | null;
  /** True when the room's data on screen is the last confirmed state, not a current one. */
  stale: boolean;
  /** The one command currently waiting for the authority's answer. */
  pending: InFlightCommand | null;
  submit: (intent: CommandIntent) => Promise<CommandOutcome>;
}

/** Gate and send REAL commands. Mutation controls should be disabled unless `canWrite`. */
export function useRemoteCommands(): RemoteCommands {
  const remote = useRemoteState();
  const role = remote.access?.role ?? null;
  const connected = remote.connection === "connected" && remote.snapshot !== null;
  const unresolved = remote.unresolved.length > 0;
  let blockedReason: string | null = null;
  if (role === "viewer") blockedReason = "You are viewing this room read-only. Only an operator can record changes.";
  else if (remote.problem === "signed_out") blockedReason = "You are signed out. Sign in to see and record REAL shows.";
  else if (remote.problem === "session_ended") blockedReason = "Your session ended. This is the last confirmed state; sign in again to record changes.";
  else if (!connected) blockedReason = "Not connected to the room: this is the last confirmed state and changes are paused until contact returns.";
  else if (unresolved) blockedReason = `The outcome of “${remote.unresolved[0].label}” is not known yet. Resolve it before recording anything else.`;
  return {
    role,
    canWrite: role === "operator" && connected && !unresolved && remote.inflight === null,
    blockedReason,
    stale: !connected,
    pending: remote.inflight,
    submit: useCallback((intent: CommandIntent) => remoteRoomStore.submit(intent), []),
  };
}
