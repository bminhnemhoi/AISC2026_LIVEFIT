import type { AuthSession, RecoveryNotice } from "@/contracts/production";
import type { RoomRead } from "@/contracts/authority";
import { announce } from "./announcer";
import { createAuthClient, type AuthClient, type AuthFailureReason, type ExportResult, type LoginResult, type SessionResult } from "./authClient";
import type { PendingScope } from "./pendingEnvelopes";
import type { RequestContext } from "./productionTransport";

/**
 * The browser's view of "who is signed in" (docs/phase3/ui.md §1).
 *
 * The SERVER owns the session: an opaque cookie it sets and clears, which this code can neither read nor store.
 * What is held here is the `AuthSession` the server described, in memory only. It is a description, not a
 * credential, and it is never trusted over the room: the role is re-read on every poll and any 401 ends it.
 *
 * Status:
 *   checking        asking the server whether this browser has a session
 *   signed_out      no session (never signed in, signed out, or the server says there is none)
 *   signing_in      a login request is in flight (a second submission joins it, it is never sent twice)
 *   authenticated   a session; `session.access.role` is operator or viewer
 *   ended           there WAS a session and the server now says 401: expired or revoked (it cannot say which)
 *   unavailable     the server or its storage could not be asked; nothing is known about the session
 *   signing_out     the logout request is in flight; protected REAL state is already cleared
 */

export type AuthStatus = "checking" | "signed_out" | "signing_in" | "authenticated" | "ended" | "unavailable" | "signing_out";

export type LoginFailure =
  /** One answer for an unknown user and a wrong password, so the UI cannot reveal which accounts exist. */
  | { kind: "invalid_credentials" }
  | { kind: "rate_limited" }
  | { kind: "invalid_request"; message: string }
  | { kind: "unavailable"; reason: AuthFailureReason; message: string };

/** Shown once per restore generation, until acknowledged. `notice` is null when the server sent none but the generation changed. */
export interface RecoveryView {
  generation: string;
  notice: RecoveryNotice | null;
}

export interface AuthState {
  status: AuthStatus;
  /** Present while `authenticated`, and kept (for the identity only) while `signing_out`. */
  session: AuthSession | null;
  loginError: LoginFailure | null;
  unavailable: { reason: AuthFailureReason; message: string } | null;
  /** Set when sign-out could not be confirmed with the server (the session may still be live there). */
  logoutNote: string | null;
  recovery: RecoveryView | null;
}

const INITIAL: AuthState = { status: "checking", session: null, loginError: null, unavailable: null, logoutNote: null, recovery: null };

const ACK_KEY = "livelift.v3.recovery.ack";
const LAST_GENERATION_KEY = "livelift.v3.lastGeneration";

function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    return typeof window === "undefined" ? null : kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readLastGeneration(workspaceId: string): string | null {
  try {
    const raw = safeStorage("local")?.getItem(LAST_GENERATION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const value = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)[workspaceId] : null;
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function writeLastGeneration(workspaceId: string, generation: string): void {
  try {
    const s = safeStorage("local");
    if (!s) return;
    const raw = s.getItem(LAST_GENERATION_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const next = { ...(typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {}), [workspaceId]: generation };
    s.setItem(LAST_GENERATION_KEY, JSON.stringify(next));
  } catch {
    // The notice is a convenience: without storage it simply cannot tell that the generation changed.
  }
}

const recoveryKey = (workspaceId: string, generation: string): string => `${workspaceId}|${generation}`;

/** Where to go after signing in: only a path on this site, never another origin and never the login page itself. */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || raw.startsWith("/login")) return "/";
  return raw;
}

export interface AuthStoreDeps {
  client?: AuthClient;
}

export class AuthStore {
  private state: AuthState = INITIAL;
  private listeners = new Set<() => void>();
  private client: AuthClient;
  private started = false;
  private checking: Promise<void> | null = null;
  private loginInFlight: Promise<LoginResult> | null = null;
  private acked: string | null = null;
  /** The newest generation this page has seen, to notice a generation change while the page stays open. */
  private seenGeneration: { workspaceId: string; generation: string } | null = null;

  constructor(deps: AuthStoreDeps = {}) {
    this.client = deps.client ?? createAuthClient();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): AuthState => this.state;
  getServerSnapshot = (): AuthState => INITIAL;

  private set(partial: Partial<AuthState>): void {
    let changed = false;
    for (const key of Object.keys(partial) as Array<keyof AuthState>) {
      if (!Object.is(this.state[key], partial[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l();
  }

  // ---- What requests may use ----------------------------------------------------------------------

  /** The deployment context of the CURRENT session, or null when nothing may be sent. Never user-supplied. */
  getContext = (): RequestContext | null => {
    const { status, session } = this.state;
    return status === "authenticated" && session ? { workspaceId: session.workspaceId, generation: session.generation } : null;
  };

  /** Who pending commands belong to: the immutable actor id, workspace and generation of the current session. */
  getScope = (): PendingScope | null => {
    const { status, session } = this.state;
    return status === "authenticated" && session ? { actorId: session.access.actorId, workspaceId: session.workspaceId, generation: session.generation } : null;
  };

  // ---- Bootstrap ----------------------------------------------------------------------------------

  /** Ask the server once, the first time anything REAL needs to know. Rehearsal-only pages never call it. */
  ensureChecked(): void {
    if (!this.started) void this.bootstrap();
  }

  /** Ask the server whether this browser has a session. Joins a check already in flight. */
  bootstrap(): Promise<void> {
    this.started = true;
    if (this.checking) return this.checking;
    if (this.state.status === "signing_in" || this.state.status === "signing_out") return Promise.resolve();
    if (this.state.status === "unavailable" || this.state.status === "signed_out" || this.state.status === "ended") this.set({ status: "checking" });
    const run = this.client
      .getSession()
      .then((r) => this.applySession(r))
      .catch(() => this.applySession({ kind: "unavailable", reason: "unexpected", message: "The sign-in check could not be completed. Reload the page and try again." }))
      .finally(() => {
        this.checking = null;
      });
    this.checking = run;
    return run;
  }

  /**
   * Re-read the session without flickering to "checking": used when the room hints that the context changed
   * (400 `context_required`, 404, 409 `recovery_required`) or after a 403. Whatever the server says wins.
   */
  refresh(): Promise<void> {
    if (this.state.status !== "authenticated") return Promise.resolve();
    if (this.checking) return this.checking;
    const run = this.client
      .getSession()
      .then((r) => this.applySession(r))
      .catch(() => this.applySession({ kind: "unavailable", reason: "unexpected", message: "The sign-in check could not be completed. Reload the page and try again." }))
      .finally(() => {
        this.checking = null;
      });
    this.checking = run;
    return run;
  }

  private applySession(result: SessionResult): void {
    if (this.state.status === "signing_in" || this.state.status === "signing_out") return; // the user's action is newer than this answer
    if (result.kind === "authenticated") {
      this.install(result.session);
    } else if (result.kind === "signed_out") {
      // A session that was there and is now gone ended; one that never was is simply signed out.
      const wasAuthenticated = this.state.status === "authenticated";
      this.set(wasAuthenticated ? { status: "ended", session: null, recovery: null } : { status: "signed_out", session: null, recovery: null });
      if (wasAuthenticated) announce("Your session ended. Sign in again to continue with REAL shows.", "assertive");
    } else {
      this.set({
        status: this.state.status === "authenticated" ? "authenticated" : "unavailable",
        unavailable: { reason: result.reason, message: result.message },
      });
    }
  }

  private install(session: AuthSession): void {
    const previous = this.seenGeneration && this.seenGeneration.workspaceId === session.workspaceId ? this.seenGeneration.generation : readLastGeneration(session.workspaceId);
    const changed = previous !== null && previous !== session.generation;
    this.seenGeneration = { workspaceId: session.workspaceId, generation: session.generation };
    writeLastGeneration(session.workspaceId, session.generation);

    const key = recoveryKey(session.workspaceId, session.generation);
    this.acked ??= safeStorage("session")?.getItem(ACK_KEY) ?? null;
    const wants = session.recoveryNotice !== null || changed;
    const recovery: RecoveryView | null = wants && this.acked !== key ? { generation: session.generation, notice: session.recoveryNotice } : null;
    const wasShown = this.state.recovery !== null && this.state.recovery.generation === session.generation;

    this.set({ status: "authenticated", session, unavailable: null, loginError: null, logoutNote: null, recovery });
    if (recovery && !wasShown) {
      announce("This room was restored from a backup. Actions recorded after the backup may be missing. LiveLift has reloaded the room.", "polite");
    }
  }

  /** The user has read the restore notice for this generation. */
  dismissRecovery(): void {
    const r = this.state.recovery;
    const s = this.state.session;
    if (!r || !s) return;
    this.acked = recoveryKey(s.workspaceId, r.generation);
    try {
      safeStorage("session")?.setItem(ACK_KEY, this.acked);
    } catch {
      // Held in memory for this page.
    }
    this.set({ recovery: null });
  }

  // ---- Login --------------------------------------------------------------------------------------

  /** One login at a time: a second submit while one is running gets the same answer and sends nothing. */
  login(credentials: { username: string; password: string }): Promise<LoginResult> {
    if (this.loginInFlight) return this.loginInFlight;
    this.set({ status: "signing_in", loginError: null, logoutNote: null });
    const run = this.client
      .login(credentials)
      .then((result) => {
        if (result.kind === "authenticated") {
          this.started = true;
          this.install(result.session);
        } else {
          const loginError: LoginFailure =
            result.kind === "invalid_credentials"
              ? { kind: "invalid_credentials" }
              : result.kind === "rate_limited"
                ? { kind: "rate_limited" }
                : result.kind === "invalid_request"
                  ? { kind: "invalid_request", message: result.message }
                  : { kind: "unavailable", reason: result.reason, message: result.message };
          this.set({ status: "signed_out", session: null, loginError, recovery: null });
        }
        return result;
      })
      .finally(() => {
        this.loginInFlight = null;
      });
    this.loginInFlight = run;
    return run;
  }

  // ---- Logout / end -------------------------------------------------------------------------------

  /**
   * End the session. The REAL room store reacts to `signing_out` at once (stops polling, drops what it displays),
   * so protected state is gone even if the server cannot be reached. A pending command that was already sent is
   * not cancelled and not called failed: its record stays saved under this account's scope.
   */
  async logout(): Promise<void> {
    if (this.state.status === "signing_out") return;
    this.set({ status: "signing_out", loginError: null, logoutNote: null, recovery: null });
    const result = await this.client.logout();
    this.set({
      status: "signed_out",
      session: null,
      recovery: null,
      logoutNote:
        result.kind === "signed_out"
          ? null
          : "Signed out in this browser, but the server did not confirm it. Your session may stay active there until it expires. Sign in and out again when the connection is back.",
    });
    if (result.kind === "signed_out") announce("Signed out.", "polite");
  }

  /** The server answered 401 to an authenticated request: the session expired or was revoked. */
  markSessionEnded(): void {
    if (this.state.status !== "authenticated") return;
    this.set({ status: "ended", session: null, recovery: null });
    announce("Your session ended. REAL shows are read-only until you sign in again.", "assertive");
  }

  /** The room says who this is on every read. The role the room reports wins over what the session said earlier. */
  observeAccess(access: RoomRead["access"]): void {
    const session = this.state.session;
    if (this.state.status !== "authenticated" || !session) return;
    if (access.actorId !== session.access.actorId) {
      void this.refresh(); // the room and the session disagree about who this is: ask the server again
      return;
    }
    if (access.role !== session.access.role || access.name !== session.access.name) {
      const roleChanged = access.role !== session.access.role;
      this.set({ session: { ...session, access: { ...session.access, role: access.role, name: access.name } } });
      if (roleChanged) announce(access.role === "viewer" ? "Your access changed to read-only viewer." : "Your access changed to operator.", "polite");
    }
  }

  /**
   * Ask for the workspace export under the CURRENT session's context. Operators only: the server decides, and a
   * 401 / 403 / context error here is handled like any other (the session ended, the role changed, the room moved).
   */
  async exportWorkspace(): Promise<ExportResult> {
    const context = this.getContext();
    if (!context) return { kind: "session_ended" };
    const result = await this.client.exportWorkspace(context);
    if (result.kind === "session_ended") this.markSessionEnded();
    else if (result.kind === "forbidden" || result.kind === "wrong_context") void this.refresh();
    return result;
  }

  /** For tests: back to a page that has not asked the server anything. */
  reset(): void {
    this.started = false;
    this.checking = null;
    this.loginInFlight = null;
    this.acked = null;
    this.seenGeneration = null;
    this.state = INITIAL;
    for (const l of this.listeners) l();
  }
}

export const authStore = new AuthStore();
