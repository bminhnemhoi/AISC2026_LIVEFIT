import { z } from "zod";
import { TIKTOK_ROUTES, type TikTokStatusView } from "@/contracts/tiktok";
import { buildHeaders, classifyCode, readError, sendBounded, type RequestContext } from "./productionTransport";

/**
 * Typed client for the TikTok connection endpoints. Same rules as the other production clients: the session is an
 * HttpOnly cookie the server owns, every request carries the CSRF marker and the workspace context, and nothing
 * here can see a token (the server never sends one). The only URL this ever navigates to is TikTok's own
 * authorization page.
 */
export const TIKTOK_AUTHORIZE_PREFIX = "https://www.tiktok.com/v2/auth/authorize/?";

export type TikTokResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "signed_out" }
  | { kind: "forbidden" }
  | { kind: "not_configured" }
  | { kind: "rate_limited" }
  | { kind: "unavailable"; message: string };

const state = z.enum(["not_configured", "ready", "connected", "expired", "unavailable", "disconnected"]);
const reason = z.enum(["network", "timeout", "provider_error", "rate_limited", "app_credentials_rejected", "credential_unreadable"]);
const statusSchema = z.object({
  provider: z.literal("tiktok"),
  state,
  configIssues: z.array(z.string().max(80)).max(20),
  requestedScopes: z.array(z.string().max(80)).max(20),
  connection: z.object({
    openId: z.string().nullable(),
    grantedScopes: z.array(z.string()),
    notGrantedScopes: z.array(z.string()),
    connectedAtMs: z.number().nullable(),
    authorizationValidUntilMs: z.number().nullable(),
    profile: z.object({ displayName: z.string().nullable(), avatarAvailable: z.boolean(), username: z.string().nullable(), isVerified: z.boolean().nullable() }).nullable(),
    profileState: z.enum(["ok", "partial", "scope_missing", "unknown"]),
    profileFetchedAtMs: z.number().nullable(),
    lastCheckedAtMs: z.number().nullable(),
    unavailableReason: reason.nullable(),
  }).nullable(),
  disconnectedAtMs: z.number().nullable(),
  lastRevocation: z.enum(["confirmed", "unconfirmed"]).nullable(),
  limits: z.object({ live: z.literal("not_established"), shop: z.literal("not_established"), analytics: z.literal("not_established"), nativeActions: z.literal("not_established") }),
});

export function parseStatus(body: unknown): TikTokStatusView | null {
  const parsed = statusSchema.safeParse(body);
  return parsed.success ? (parsed.data as TikTokStatusView) : null;
}

export interface TikTokClient {
  getStatus(context: RequestContext): Promise<TikTokResult<TikTokStatusView>>;
  connect(context: RequestContext): Promise<TikTokResult<{ authorizeUrl: string }>>;
  refresh(context: RequestContext): Promise<TikTokResult<TikTokStatusView>>;
  disconnect(context: RequestContext): Promise<TikTokResult<TikTokStatusView>>;
}

export function createTikTokClient(options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): TikTokClient {
  const timeoutMs = options.timeoutMs ?? 15_000;

  async function call<T>(path: string, method: "GET" | "POST", context: RequestContext, parse: (body: unknown) => T | null): Promise<TikTokResult<T>> {
    const unsafe = method === "POST";
    const res = await sendBounded(options.fetchImpl, path, { method, headers: buildHeaders({ unsafe, context }), ...(unsafe ? { body: "{}" } : {}) }, timeoutMs);
    if (!res.ok) return { kind: "unavailable", message: res.message };
    if (res.status >= 200 && res.status < 300) {
      const value = parse(res.body);
      return value === null ? { kind: "unavailable", message: "The server sent a TikTok status LiveLift could not trust." } : { kind: "ok", value };
    }
    const code = classifyCode(res.status, res.body);
    if (res.status === 401) return { kind: "signed_out" };
    if (code === "provider_not_configured") return { kind: "not_configured" };
    if (res.status === 403 && code !== "csrf_failed") return { kind: "forbidden" };
    if (res.status === 429) return { kind: "rate_limited" };
    return { kind: "unavailable", message: readError(res.body).message ?? `The server answered ${res.status}.` };
  }

  return {
    getStatus: (context) => call(TIKTOK_ROUTES.status, "GET", context, parseStatus),
    refresh: (context) => call(TIKTOK_ROUTES.refresh, "POST", context, parseStatus),
    disconnect: (context) => call(TIKTOK_ROUTES.disconnect, "POST", context, parseStatus),
    connect: (context) =>
      call(TIKTOK_ROUTES.connect, "POST", context, (body) => {
        const url = typeof body === "object" && body !== null ? (body as { authorizeUrl?: unknown }).authorizeUrl : null;
        return typeof url === "string" && url.startsWith(TIKTOK_AUTHORIZE_PREFIX) ? { authorizeUrl: url } : null;
      }),
  };
}
