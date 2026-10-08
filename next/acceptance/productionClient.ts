import type {
  AuthorityReceipt,
  CommandEnvelope,
  CommandResponse,
  RoomRead,
} from "@/contracts/authority";
import type {
  AuthSession,
  LoginRequest,
  ProductionContext,
  ProductionError,
  WorkspaceExport,
} from "@/contracts/production";

export interface ProductionClientConfig {
  baseUrl: string;
  origin: string;
  workspaceId: string;
  roomId: string;
  generation: string;
  actorId?: string;
  actorName?: string;
  role: "operator" | "viewer";
  username?: string;
  password?: string;
  sessionToken?: string | null;
  extraHeaders?: Record<string, string>;
  requestTimeoutMs?: number;
}

export interface HttpResponse<T> {
  status: number;
  data: T | null;
  error?: ProductionError["error"] | null;
  rawError?: string;
  headers: Headers;
  rawText?: string;
}

export const SESSION_COOKIE_NAME = "__Host-livelift_session";

/**
 * Independent acceptance HTTP client for Phase 3 Production.
 * Enforces and verifies the frozen wire contracts in docs/phase3/contract.md
 * and next/src/contracts/production.ts.
 */
export class ProductionClient {
  readonly config: ProductionClientConfig;
  private sessionCookie: string | null = null;
  private currentSession: AuthSession | null = null;

  constructor(config: Partial<ProductionClientConfig> = {}) {
    const role = config.role ?? "operator";
    const baseUrl =
      config.baseUrl ??
      (process.env.LIVELIFT_TEST_SERVER_URL || "http://localhost:3130");
    const origin =
      config.origin ??
      (process.env.LIVELIFT_APP_ORIGIN ||
        (baseUrl.startsWith("http://")
          ? baseUrl.replace("http://", "https://")
          : baseUrl));

    this.config = {
      baseUrl,
      origin,
      workspaceId:
        config.workspaceId ??
        (process.env.LIVELIFT_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001"),
      roomId: config.roomId ?? (process.env.LIVELIFT_ROOM_ID || "room-aud-01"),
      generation:
        config.generation ??
        (process.env.LIVELIFT_GENERATION || "11111111-1111-4111-8111-111111111111"),
      role,
      actorId: config.actorId,
      actorName: config.actorName,
      username:
        config.username ??
        (role === "operator"
          ? (process.env.LIVELIFT_OPERATOR_USERNAME || "test_operator")
          : (process.env.LIVELIFT_VIEWER_USERNAME || "test_viewer")),
      password:
        config.password ??
        (role === "operator"
          ? (process.env.LIVELIFT_OPERATOR_PASSWORD || "TestOperatorPassword123!")
          : (process.env.LIVELIFT_VIEWER_PASSWORD || "TestViewerPassword123!")),
      sessionToken: config.sessionToken ?? null,
      extraHeaders: config.extraHeaders,
      requestTimeoutMs: config.requestTimeoutMs,
    };

    if (this.config.sessionToken) {
      this.sessionCookie = `${SESSION_COOKIE_NAME}=${this.config.sessionToken}`;
    }
  }

  setSessionToken(token: string | null): void {
    this.config.sessionToken = token;
    this.sessionCookie = token ? `${SESSION_COOKIE_NAME}=${token}` : null;
  }

  setContext(context: Partial<ProductionContext>): void {
    if (context.workspaceId) this.config.workspaceId = context.workspaceId;
    if (context.roomId) this.config.roomId = context.roomId;
    if (context.generation) this.config.generation = context.generation;
  }

  getSessionCookie(): string | null {
    return this.sessionCookie;
  }

  getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  private request(input: string, init?: RequestInit): Promise<Response> {
    return fetch(input, this.config.requestTimeoutMs === undefined ? init : {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(this.config.requestTimeoutMs)]) : AbortSignal.timeout(this.config.requestTimeoutMs),
      redirect: "error",
    });
  }

  /**
   * Generates standard production request headers.
   */
  getHeaders(options: {
    includeContext?: boolean;
    includeCsrf?: boolean;
    includeCookie?: boolean;
    overrideHeaders?: Record<string, string>;
  } = {}): Headers {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    if (options.includeCookie !== false && this.sessionCookie) {
      headers.set("Cookie", this.sessionCookie);
    }

    if (options.includeContext !== false) {
      headers.set("X-LiveLift-Workspace", this.config.workspaceId);
      headers.set("X-LiveLift-Generation", this.config.generation);
    }

    if (options.includeCsrf !== false) {
      headers.set("X-LiveLift-Request", "1");
      headers.set("Origin", this.config.origin);
    }

    if (this.config.extraHeaders) {
      for (const [k, v] of Object.entries(this.config.extraHeaders)) {
        headers.set(k, v);
      }
    }

    if (options.overrideHeaders) {
      for (const [k, v] of Object.entries(options.overrideHeaders)) {
        headers.set(k, v);
      }
    }

    return headers;
  }

  private async parseResponse<T>(res: Response): Promise<HttpResponse<T>> {
    const rawText = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(rawText);
    } catch {
      // not JSON
    }

    const isError = !res.ok;
    let prodError: ProductionError["error"] | null = null;

    if (json && typeof json === "object" && "error" in json) {
      const errObj = (json as Record<string, unknown>).error;
      if (errObj && typeof errObj === "object" && "code" in errObj && "message" in errObj) {
        prodError = errObj as ProductionError["error"];
      }
    }

    return {
      status: res.status,
      data: !isError ? (json as T) : null,
      error: prodError,
      rawError: isError && !prodError ? rawText : undefined,
      headers: res.headers,
      rawText,
    };
  }

  /** Raw HTTP probe for adversarial testing */
  async rawRequest(
    path: string,
    init: RequestInit = {}
  ): Promise<HttpResponse<unknown>> {
    const url = path.startsWith("http") ? path : `${this.config.baseUrl}${path}`;
    try {
      const res = await this.request(url, init);
      return this.parseResponse<unknown>(res);
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** POST /api/v3/auth/login */
  async login(
    credentials?: LoginRequest,
    overrideHeaders?: Record<string, string>
  ): Promise<HttpResponse<AuthSession>> {
    const body: LoginRequest = credentials ?? {
      username: this.config.username || "test_operator",
      password: this.config.password || "TestOperatorPassword123!",
    };

    const headers = this.getHeaders({
      includeContext: false,
      includeCookie: false,
      includeCsrf: true,
      overrideHeaders,
    });

    try {
      const res = await this.request(`${this.config.baseUrl}/api/v3/auth/login`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const parsed = await this.parseResponse<AuthSession>(res);

      if (res.ok) {
        // Parse set-cookie
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
          const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
          if (match) {
            this.setSessionToken(match[1]);
          }
        }
        if (parsed.data) {
          this.currentSession = parsed.data;
          this.setContext({
            workspaceId: parsed.data.workspaceId,
            roomId: parsed.data.roomId,
            generation: parsed.data.generation,
          });
        }
      }

      return parsed;
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** POST /api/v3/auth/logout */
  async logout(
    overrideHeaders?: Record<string, string>
  ): Promise<HttpResponse<{ success: boolean }>> {
    const headers = this.getHeaders({
      includeContext: false,
      includeCookie: true,
      includeCsrf: true,
      overrideHeaders,
    });

    try {
      const res = await this.request(`${this.config.baseUrl}/api/v3/auth/logout`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      const parsed = await this.parseResponse<{ success: boolean }>(res);
      if (res.ok) {
        this.setSessionToken(null);
        this.currentSession = null;
      }
      return parsed;
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** GET /api/v3/auth/session */
  async getSession(
    overrideHeaders?: Record<string, string>
  ): Promise<HttpResponse<AuthSession>> {
    const headers = this.getHeaders({
      includeContext: false,
      includeCookie: true,
      includeCsrf: false,
      overrideHeaders,
    });

    try {
      const res = await this.request(`${this.config.baseUrl}/api/v3/auth/session`, {
        method: "GET",
        headers,
      });

      const parsed = await this.parseResponse<AuthSession>(res);
      if (res.ok && parsed.data) {
        this.currentSession = parsed.data;
      }
      return parsed;
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** GET /api/v3/room */
  async pollRoom(
    afterRevision?: number,
    overrideHeaders?: Record<string, string>,
    roomId?: string
  ): Promise<HttpResponse<RoomRead>> {
    const url = new URL(`${this.config.baseUrl}/api/v3/room`);
    if (afterRevision !== undefined) {
      url.searchParams.set("afterRevision", String(afterRevision));
    }
    if (roomId !== undefined) {
      url.searchParams.set("roomId", roomId);
    }

    const headers = this.getHeaders({
      includeContext: true,
      includeCookie: true,
      includeCsrf: false,
      overrideHeaders,
    });

    try {
      const res = await this.request(url.toString(), {
        method: "GET",
        headers,
      });
      return this.parseResponse<RoomRead>(res);
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** POST /api/v3/room/commands */
  async sendCommand(
    envelope: CommandEnvelope,
    overrideHeaders?: Record<string, string>
  ): Promise<HttpResponse<CommandResponse>> {
    const headers = this.getHeaders({
      includeContext: true,
      includeCookie: true,
      includeCsrf: true,
      overrideHeaders,
    });

    try {
      const res = await this.request(`${this.config.baseUrl}/api/v3/room/commands`, {
        method: "POST",
        headers,
        body: JSON.stringify(envelope),
      });
      return this.parseResponse<CommandResponse>(res);
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** GET /api/v3/room/commands/:commandId */
  async getReceipt(
    commandId: string,
    overrideHeaders?: Record<string, string>,
    roomId?: string
  ): Promise<HttpResponse<AuthorityReceipt>> {
    const url = new URL(
      `${this.config.baseUrl}/api/v3/room/commands/${encodeURIComponent(commandId)}`
    );
    if (roomId !== undefined) {
      url.searchParams.set("roomId", roomId);
    }

    const headers = this.getHeaders({
      includeContext: true,
      includeCookie: true,
      includeCsrf: false,
      overrideHeaders,
    });

    try {
      const res = await this.request(
        url.toString(),
        {
          method: "GET",
          headers,
        }
      );
      return this.parseResponse<AuthorityReceipt>(res);
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** GET /api/v3/workspace/export */
  async exportWorkspace(
    overrideHeaders?: Record<string, string>
  ): Promise<HttpResponse<WorkspaceExport>> {
    const headers = this.getHeaders({
      includeContext: true,
      includeCookie: true,
      includeCsrf: false,
      overrideHeaders,
    });

    try {
      const res = await this.request(`${this.config.baseUrl}/api/v3/workspace/export`, {
        method: "GET",
        headers,
      });
      return this.parseResponse<WorkspaceExport>(res);
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** GET /api/healthz */
  async getHealthz(): Promise<HttpResponse<{ live: boolean }>> {
    try {
      const res = await this.request(`${this.config.baseUrl}/api/healthz`);
      return this.parseResponse<{ live: boolean }>(res);
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }

  /** GET /api/readyz */
  async getReadyz(): Promise<HttpResponse<{ ready: boolean }>> {
    try {
      const res = await this.request(`${this.config.baseUrl}/api/readyz`);
      return this.parseResponse<{ ready: boolean }>(res);
    } catch (err) {
      return {
        status: 0,
        data: null,
        error: null,
        rawError: err instanceof Error ? err.message : String(err),
        headers: new Headers(),
      };
    }
  }
}

/** Check if backend test server is reachable */
export function isBackendAvailable(): boolean {
  return Boolean(process.env.LIVELIFT_TEST_SERVER_URL);
}
