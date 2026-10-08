import { z } from "zod";
import type { TikTokConfig } from "./config";

/**
 * TikTok Login Kit (web) + User Info HTTP client. Official sources, checked 2026-10-07:
 *   authorize  https://developers.tiktok.com/doc/login-kit-web
 *   tokens     https://developers.tiktok.com/doc/oauth-user-access-token-management
 *   user info  https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info
 *   errors     https://developers.tiktok.com/doc/oauth-error-handling , .../tiktok-api-v2-error-handling
 *
 * Every function returns a value; none throws, and no failure carries a token, code, secret or response body.
 * Only a small fixed vocabulary of failure kinds leaves this module.
 */
export const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
export const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 64 * 1024;

export type ProviderFailure =
  /** Authorization code / refresh token invalid, expired, revoked or mismatched. */
  | "invalid_grant"
  /** TikTok rejected this app's client key/secret, or the app may not use this grant. */
  | "invalid_client"
  /** Request malformed or scope invalid. A LiveLift or configuration defect, not the user's. */
  | "invalid_request"
  /** The access token was refused. */
  | "token_invalid"
  /** The grant does not cover the requested fields. */
  | "scope_missing"
  | "rate_limited"
  | "timeout"
  | "network"
  /** 5xx, `server_error`, `temporarily_unavailable`, or an error code this client does not know. */
  | "provider_error"
  /** A success status with a body that does not match the documented shape. Treated as unknown, never as success. */
  | "malformed";

export type ProviderResult<T> = { ok: true; value: T } | { ok: false; failure: ProviderFailure };

export type TokenGrant = {
  accessToken: string;
  refreshToken: string;
  openId: string;
  accessExpiresInSec: number;
  refreshExpiresInSec: number;
  scopes: string[];
};
export type UserInfo = {
  openId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  username: string | null;
  isVerified: boolean | null;
  /** Fields TikTok was asked for and did not return. Unknown stays unknown. */
  missing: string[];
};

const tokenSchema = z.object({
  access_token: z.string().min(1).max(4096),
  refresh_token: z.string().min(1).max(4096),
  open_id: z.string().min(1).max(256),
  expires_in: z.number().int().positive().max(31_536_000 * 2),
  refresh_expires_in: z.number().int().positive().max(31_536_000 * 5),
  scope: z.string().max(1024),
  token_type: z.string().optional(),
});
const errorSchema = z.object({ error: z.string().min(1).max(128) }).passthrough();

async function readCapped(response: Response): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { void reader.cancel().catch(() => {}); return null; }
      chunks.push(value);
    }
  } catch { return null; }
  return Buffer.concat(chunks, size).toString("utf8");
}

type Raw = { status: number; json: unknown } | { failure: ProviderFailure };
async function send(url: string, init: RequestInit): Promise<Raw> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    return { failure: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
  }
  const text = await readCapped(response);
  if (text === null) return { failure: "malformed" };
  let json: unknown = null;
  if (text !== "") { try { json = JSON.parse(text); } catch { json = undefined; } }
  return { status: response.status, json };
}

function oauthFailure(code: string): ProviderFailure {
  switch (code) {
    case "invalid_grant": return "invalid_grant";
    case "invalid_client":
    case "unauthorized_client": return "invalid_client";
    case "invalid_request":
    case "invalid_scope":
    case "unsupported_grant_type":
    case "unsupported_response_type": return "invalid_request";
    default: return "provider_error"; // server_error, temporarily_unavailable and anything unrecognised
  }
}

function form(values: Record<string, string>): string { return new URLSearchParams(values).toString(); }

async function tokenRequest(config: TikTokConfig, body: Record<string, string>): Promise<ProviderResult<TokenGrant>> {
  const raw = await send(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache", Accept: "application/json" },
    body: form({ client_key: config.clientKey, client_secret: config.clientSecret, ...body }),
  });
  if ("failure" in raw) return { ok: false, failure: raw.failure };
  const err = errorSchema.safeParse(raw.json);
  if (err.success && err.data.error !== "ok") return { ok: false, failure: oauthFailure(err.data.error) };
  if (raw.status === 429) return { ok: false, failure: "rate_limited" };
  if (raw.status >= 500) return { ok: false, failure: "provider_error" };
  const parsed = tokenSchema.safeParse(raw.json);
  if (raw.status < 200 || raw.status >= 300 || !parsed.success) return { ok: false, failure: raw.status >= 400 ? "provider_error" : "malformed" };
  const scopes = parsed.data.scope.split(",").map((s) => s.trim()).filter((s) => /^[a-z][a-z0-9._]{1,63}$/.test(s));
  return { ok: true, value: { accessToken: parsed.data.access_token, refreshToken: parsed.data.refresh_token, openId: parsed.data.open_id, accessExpiresInSec: parsed.data.expires_in, refreshExpiresInSec: parsed.data.refresh_expires_in, scopes: [...new Set(scopes)] } };
}

export function authorizeUrl(config: TikTokConfig, state: string): string {
  // TikTok's documented examples keep the scope list's commas literal.
  const query = [["client_key", config.clientKey], ["scope", config.scopes.join(",")], ["response_type", "code"], ["redirect_uri", config.redirectUri], ["state", state]]
    .map(([k, v]) => `${k}=${k === "scope" ? v.split(",").map(encodeURIComponent).join(",") : encodeURIComponent(v)}`).join("&");
  return `${AUTHORIZE_URL}?${query}`;
}

export const tiktok = {
  exchangeCode(config: TikTokConfig, code: string): Promise<ProviderResult<TokenGrant>> {
    return tokenRequest(config, { code, grant_type: "authorization_code", redirect_uri: config.redirectUri });
  },
  refresh(config: TikTokConfig, refreshToken: string): Promise<ProviderResult<TokenGrant>> {
    return tokenRequest(config, { grant_type: "refresh_token", refresh_token: refreshToken });
  },
  /** `ok` only when TikTok returned success; anything else is "unconfirmed" to the caller. */
  async revoke(config: TikTokConfig, token: string): Promise<ProviderResult<true>> {
    const raw = await send(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache", Accept: "application/json" },
      body: form({ client_key: config.clientKey, client_secret: config.clientSecret, token }),
    });
    if ("failure" in raw) return { ok: false, failure: raw.failure };
    const err = errorSchema.safeParse(raw.json);
    if (err.success && err.data.error !== "ok") return { ok: false, failure: oauthFailure(err.data.error) };
    if (raw.status === 429) return { ok: false, failure: "rate_limited" };
    if (raw.status >= 200 && raw.status < 300) return { ok: true, value: true };
    return { ok: false, failure: raw.status >= 500 ? "provider_error" : "invalid_request" };
  },
  async userInfo(accessToken: string, fields: string[]): Promise<ProviderResult<UserInfo>> {
    const raw = await send(`${USER_INFO_URL}?fields=${fields.map(encodeURIComponent).join(",")}`, { method: "GET", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if ("failure" in raw) return { ok: false, failure: raw.failure };
    if (raw.status === 429) return { ok: false, failure: "rate_limited" };
    if (raw.status >= 500) return { ok: false, failure: "provider_error" };
    const body = z.object({ data: z.object({ user: z.record(z.unknown()).optional() }).partial().nullish(), error: z.object({ code: z.string() }).partial().nullish() }).safeParse(raw.json);
    if (!body.success) return { ok: false, failure: "malformed" };
    const code = body.data.error?.code;
    if (code && code !== "ok") {
      if (code === "access_token_invalid") return { ok: false, failure: "token_invalid" };
      if (code === "scope_not_authorized" || code === "scope_permission_missed") return { ok: false, failure: "scope_missing" };
      if (code === "rate_limit_exceeded") return { ok: false, failure: "rate_limited" };
      return { ok: false, failure: "provider_error" };
    }
    if (raw.status < 200 || raw.status >= 300) return { ok: false, failure: raw.status === 401 ? "token_invalid" : "provider_error" };
    const user = body.data.data?.user;
    if (!user) return { ok: false, failure: "malformed" };
    const str = (key: string): string | null => (typeof user[key] === "string" && (user[key] as string).trim() !== "" ? (user[key] as string).slice(0, 512) : null);
    const info: UserInfo = {
      openId: str("open_id"),
      displayName: str("display_name")?.replace(/\p{Cc}/gu, " ").trim() || null,
      avatarUrl: str("avatar_url") ?? str("avatar_url_100") ?? str("avatar_large_url"),
      username: str("username"),
      isVerified: typeof user.is_verified === "boolean" ? user.is_verified : null,
      missing: [],
    };
    const present: Record<string, boolean> = { open_id: info.openId !== null, display_name: info.displayName !== null, avatar_url: info.avatarUrl !== null, username: info.username !== null, is_verified: info.isVerified !== null };
    info.missing = fields.filter((f) => f in present && !present[f]);
    return { ok: true, value: info };
  },
};

/** TikTok-hosted avatar only; anything else is treated as "no avatar" (unknown) rather than fetched or rendered. */
export function isTikTokAvatarUrl(value: string | null): value is string {
  if (!value || value.length > 512) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.port === "" || url.port === "443") && /(^|\.)tiktokcdn(-[a-z]+)?\.com$/.test(url.hostname);
  } catch { return false; }
}
