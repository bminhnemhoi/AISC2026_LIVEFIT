import type {
  AuthorityReceipt,
  CommandEnvelope,
  CommandResponse,
  RoomRead,
} from "@/contracts/authority";
import type { AuthSession, LoginRequest } from "@/contracts/production";

export const SESSION_COOKIE_NAME = "__Host-livelift_session";

export interface AuthorityClientConfig {
  baseUrl: string;
  roomId: string;
  actorId: string;
  actorName: string;
  role: "operator" | "viewer";
  token?: string | null;
  extraHeaders?: Record<string, string>;
  // Phase 3 adaptations:
  workspaceId?: string;
  generation?: string;
  origin?: string;
  cookie?: string | null;
  username?: string;
  password?: string;
  authMode?: "bearer" | "cookie";
}

export interface SendCommandResult {
  status: number;
  data: CommandResponse | null;
  error?: string;
}

export interface GetReceiptResult {
  status: number;
  data: AuthorityReceipt | null;
  error?: string;
}

export interface PollRoomResult {
  status: number;
  data: RoomRead | null;
  error?: string;
}

/**
 * Black-box HTTP client for Phase 2 Remote Room Authority.
 * Communicates strictly over the frozen wire contract defined in docs/phase2/contract.md
 * and adapted to Phase 3 cookie/context contract per docs/phase3/contract.md.
 * Supports both Phase 2 Bearer capabilities and Phase 3 __Host-livelift_session cookie authentication.
 */
export class AuthorityClient {
  readonly config: AuthorityClientConfig;

  constructor(config: Partial<AuthorityClientConfig> = {}) {
    const role = config.role ?? "operator";
    const defaultToken =
      role === "operator"
        ? (process.env.LIVELIFT_OPERATOR_TOKEN || "test-operator-token")
        : (process.env.LIVELIFT_VIEWER_TOKEN || "test-viewer-token");

    const defaultUsername =
      role === "operator"
        ? (process.env.LIVELIFT_OPERATOR_USERNAME || "test_operator")
        : (process.env.LIVELIFT_VIEWER_USERNAME || "test_viewer");

    const defaultPassword =
      role === "operator"
        ? (process.env.LIVELIFT_OPERATOR_PASSWORD || "TestOperatorPassword123!")
        : (process.env.LIVELIFT_VIEWER_PASSWORD || "TestViewerPassword123!");

    const baseUrl = config.baseUrl ?? (process.env.LIVELIFT_TEST_SERVER_URL || "http://localhost:3130");
    const origin = config.origin ?? (process.env.LIVELIFT_APP_ORIGIN || (baseUrl.startsWith("http://") ? baseUrl.replace("http://", "https://") : baseUrl));
    const workspaceId = config.workspaceId ?? (process.env.LIVELIFT_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001");
    const generation = config.generation ?? (process.env.LIVELIFT_GENERATION || "11111111-1111-4111-8111-111111111111");
    const authMode = config.authMode ?? (process.env.LIVELIFT_AUTH_MODE === "bearer" ? "bearer" : "cookie");

    this.config = {
      baseUrl,
      roomId: config.roomId ?? "room-default",
      actorId: config.actorId ?? (role === "operator" ? "actor-op-1" : "actor-vw-1"),
      actorName: config.actorName ?? (role === "operator" ? "Lead Operator" : "Guest Viewer"),
      role,
      token: config.token === undefined ? defaultToken : config.token,
      extraHeaders: config.extraHeaders,
      workspaceId,
      generation,
      origin,
      cookie: config.cookie ?? null,
      username: config.username ?? defaultUsername,
      password: config.password ?? defaultPassword,
      authMode,
    };
  }

  /** Phase 3 production login to acquire session cookie */
  async login(username?: string, password?: string): Promise<{ ok: boolean; status: number; cookie?: string }> {
    const creds: LoginRequest = {
      username: username ?? this.config.username ?? "operator",
      password: password ?? this.config.password ?? "TestOperatorPassword123!",
    };
    try {
      const res = await fetch(`${this.config.baseUrl}/api/v3/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LiveLift-Request": "1",
          Origin: this.config.origin ?? this.config.baseUrl,
        },
        body: JSON.stringify(creds),
      });

      if (res.ok) {
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
          const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
          if (match) {
            this.config.cookie = match[1];
          }
        }
        const data = (await res.json().catch(() => null)) as AuthSession | null;
        if (data) {
          if (data.workspaceId) this.config.workspaceId = data.workspaceId;
          if (data.generation) this.config.generation = data.generation;
          if (data.roomId) this.config.roomId = data.roomId;
        }
        return { ok: true, status: res.status, cookie: this.config.cookie ?? undefined };
      }
      return { ok: false, status: res.status };
    } catch {
      return { ok: false, status: 0 };
    }
  }

  private getHeaders(overrideHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-LiveLift-Room": this.config.roomId,
    };

    if (this.config.authMode === "cookie" || this.config.cookie) {
      if (this.config.cookie) {
        headers.Cookie = this.config.cookie.startsWith("__Host-")
          ? this.config.cookie
          : `${SESSION_COOKIE_NAME}=${this.config.cookie}`;
      }
      headers["X-LiveLift-Request"] = "1";
      if (this.config.origin) {
        headers.Origin = this.config.origin;
      }
      if (this.config.workspaceId) {
        headers["X-LiveLift-Workspace"] = this.config.workspaceId;
      }
      if (this.config.generation) {
        headers["X-LiveLift-Generation"] = this.config.generation;
      }
    } else if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }

    if (this.config.extraHeaders) {
      Object.assign(headers, this.config.extraHeaders);
    }
    if (overrideHeaders) {
      Object.assign(headers, overrideHeaders);
    }
    return headers;
  }

  /** POST /api/v3/room/commands */
  async sendCommand(envelope: CommandEnvelope, extraHeaders?: Record<string, string>): Promise<SendCommandResult> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/v3/room/commands`, {
        method: "POST",
        headers: this.getHeaders(extraHeaders),
        body: JSON.stringify(envelope),
      });

      const body = await res.json().catch(() => null);
      return {
        status: res.status,
        data: res.ok ? (body as CommandResponse) : (body as CommandResponse | null),
        error: !res.ok ? (body?.message ?? res.statusText) : undefined,
      };
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** GET /api/v3/room/commands/<commandId> */
  async getReceipt(commandId: string, extraHeaders?: Record<string, string>): Promise<GetReceiptResult> {
    try {
      const res = await fetch(
        `${this.config.baseUrl}/api/v3/room/commands/${encodeURIComponent(commandId)}`,
        {
          method: "GET",
          headers: this.getHeaders(extraHeaders),
        }
      );

      const body = await res.json().catch(() => null);
      return {
        status: res.status,
        data: res.ok ? (body as AuthorityReceipt) : null,
        error: !res.ok ? (body?.message ?? res.statusText) : undefined,
      };
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** GET /api/v3/room?afterRevision=<revision> */
  async pollRoom(afterRevision?: number, extraHeaders?: Record<string, string>): Promise<PollRoomResult> {
    try {
      const url = new URL(`${this.config.baseUrl}/api/v3/room`);
      if (afterRevision !== undefined) {
        url.searchParams.set("afterRevision", String(afterRevision));
      }

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(extraHeaders),
      });

      const body = await res.json().catch(() => null);
      return {
        status: res.status,
        data: res.ok ? (body as RoomRead) : null,
        error: !res.ok ? (body?.message ?? res.statusText) : undefined,
      };
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Poll until room revision >= targetRevision or timeout is reached */
  async waitForConvergence(targetRevision: number, timeoutMs = 2000): Promise<RoomRead> {
    const start = Date.now();
    let lastRead: RoomRead | null = null;

    while (Date.now() - start < timeoutMs) {
      const res = await this.pollRoom();
      if (res.data) {
        lastRead = res.data;
        if (res.data.revision >= targetRevision) {
          return res.data;
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    throw new Error(
      `Room convergence timed out after ${timeoutMs}ms. Expected revision >= ${targetRevision}, got ${lastRead?.revision ?? "none"}`
    );
  }
}

/** Check if backend authority server is currently available for integration testing */
export function isBackendAvailable(): boolean {
  return Boolean(process.env.LIVELIFT_TEST_SERVER_URL);
}
