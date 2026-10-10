import type { DatabaseSync } from "node:sqlite";
import { AuthorityError, type ProductionConfig } from "../config";
import { log } from "../log";
import type { TikTokCallbackOutcome, TikTokConnectionView, TikTokProfileView, TikTokStatusView, TikTokUnavailableReason } from "@/contracts/tiktok";
import { loadTikTokConfig, providerStorePath, type TikTokConfig } from "./config";
import { randomToken, safeEqualHex, sha256Hex } from "./crypto";
import { authorizeUrl, isTikTokAvatarUrl, tiktok, type ProviderFailure, type TokenGrant } from "./provider";
import { openProviderStore, type ConnectionRow, type ProviderStore, type StoredProfile } from "./store";

/**
 * Orchestrates the TikTok Login Kit connection for ONE workspace.
 *
 * Truth rules enforced here:
 *  - A connection means "TikTok issued this app an authorization for this account". It does not mean LIVE
 *    eligibility, Shop access, analytics, or any native-action evidence; `limits` in the view says so every time.
 *  - Transient provider trouble is `unavailable` (unknown), never `expired` (known-unusable) and never a wipe.
 *  - Only a definitive refusal (refresh token invalid/expired/revoked, or access still refused after a fresh refresh)
 *    ends the authorization, and then the tokens are erased (fail closed).
 */
export type TikTokContext = { production: ProductionConfig; authorityDb: DatabaseSync; now?: () => number };

const PENDING_TTL_MS = 10 * 60_000;
const REFRESH_SKEW_MS = 5 * 60_000;
export const PROFILE_STALE_MS = 15 * 60_000;
const BASIC = "user.info.basic";
const PROFILE_SCOPE = "user.info.profile";
const LIMITS = { live: "not_established", shop: "not_established", analytics: "not_established", nativeActions: "not_established" } as const;
const clock = (ctx: TikTokContext): number => (ctx.now ?? Date.now)();

function unavailable(): AuthorityError { return new AuthorityError(503, "storage_unavailable", "TikTok credential storage is unavailable."); }

function storeFor(ctx: TikTokContext, config: TikTokConfig | null, create: boolean): ProviderStore | null {
  try {
    return openProviderStore(config?.providerDbPath ?? providerStorePath(ctx.production), ctx.production.workspaceId, config?.encryptionKey ?? Buffer.alloc(32), create);
  } catch { throw unavailable(); }
}

function reasonOf(failure: ProviderFailure): TikTokUnavailableReason {
  switch (failure) {
    case "network": return "network";
    case "timeout": return "timeout";
    case "rate_limited": return "rate_limited";
    case "invalid_client": return "app_credentials_rejected";
    default: return "provider_error";
  }
}

// ---- views ----------------------------------------------------------------------------------------------------

function profileView(profile: StoredProfile | null): TikTokProfileView | null {
  return profile ? { displayName: profile.displayName, avatarAvailable: isTikTokAvatarUrl(profile.avatarUrl), username: profile.username, isVerified: profile.isVerified } : null;
}
function connectionView(row: ConnectionRow, requested: string[]): TikTokConnectionView {
  return {
    openId: row.openId,
    grantedScopes: row.grantedScopes,
    notGrantedScopes: requested.filter((s) => !row.grantedScopes.includes(s)),
    connectedAtMs: row.connectedAtMs,
    authorizationValidUntilMs: row.status === "connected" ? row.refreshExpiresAtMs : null,
    profile: profileView(row.profile),
    profileState: row.profileState,
    profileFetchedAtMs: row.profileFetchedAtMs,
    lastCheckedAtMs: row.lastCheckedAtMs,
    unavailableReason: row.status === "connected" ? (row.unavailableReason as TikTokUnavailableReason | null) : null,
  };
}

function buildView(config: ReturnType<typeof loadTikTokConfig>, row: ConnectionRow | null): TikTokStatusView {
  const requested: string[] = config.scopes;
  const base = { provider: "tiktok" as const, configIssues: config.ok ? [] : config.issues, requestedScopes: requested, limits: LIMITS };
  if (!config.ok) return { ...base, state: "not_configured", connection: null, disconnectedAtMs: null, lastRevocation: null };
  if (!row) return { ...base, state: "ready", connection: null, disconnectedAtMs: null, lastRevocation: null };
  if (row.status === "disconnected") return { ...base, state: "disconnected", connection: null, disconnectedAtMs: row.disconnectedAtMs, lastRevocation: row.revocation };
  const connection = connectionView(row, requested);
  if (row.status === "expired") return { ...base, state: "expired", connection, disconnectedAtMs: null, lastRevocation: null };
  return { ...base, state: row.unavailableReason ? "unavailable" : "connected", connection, disconnectedAtMs: null, lastRevocation: null };
}

/** Local-only read. Ends an authorization whose refresh token has expired by the clock; never touches the network. */
export function tiktokStatus(ctx: TikTokContext): TikTokStatusView {
  const config = loadTikTokConfig(ctx.production);
  if (!config.ok) return buildView(config, null);
  const store = storeFor(ctx, config.config, false);
  if (!store) return buildView(config, null);
  try {
    let row = store.get();
    if (row?.status === "connected" && row.refreshExpiresAtMs !== null && row.refreshExpiresAtMs <= clock(ctx)) {
      store.markExpired(clock(ctx));
      row = store.get();
      log("tiktok_authorization_expired", { workspaceId: ctx.production.workspaceId, resultCode: "refresh_token_expired" }, "warn");
    }
    return buildView(config, row);
  } catch { throw unavailable(); }
  finally { store.close(); }
}

// ---- connect / callback ---------------------------------------------------------------------------------------

export function beginConnect(ctx: TikTokContext, actorId: string): { authorizeUrl: string; binding: string; ttlSeconds: number } {
  const config = loadTikTokConfig(ctx.production);
  if (!config.ok) throw new AuthorityError(409, "provider_not_configured", "TikTok is not configured on this deployment.");
  const state = randomToken();
  const binding = randomToken();
  const store = storeFor(ctx, config.config, true)!;
  try { store.createPending(sha256Hex(state), sha256Hex(binding), actorId, config.config.redirectUri, clock(ctx), PENDING_TTL_MS); }
  catch { throw unavailable(); }
  finally { store.close(); }
  log("tiktok_connect_started", { workspaceId: ctx.production.workspaceId, actorId });
  return { authorizeUrl: authorizeUrl(config.config, state), binding, ttlSeconds: PENDING_TTL_MS / 1000 };
}

function operatorStillValid(db: DatabaseSync, actorId: string): boolean {
  return db.prepare("SELECT 1 FROM accounts WHERE actor_id = ? AND enabled = 1 AND role = 'operator'").get(actorId) !== undefined;
}

function outcomeFor(failure: ProviderFailure): TikTokCallbackOutcome {
  switch (failure) {
    case "invalid_client": return "credentials_rejected";
    case "invalid_grant":
    case "invalid_request":
    case "malformed":
    case "token_invalid":
    case "scope_missing": return "exchange_failed";
    default: return "provider_unavailable";
  }
}

function tokensFrom(grant: TokenGrant, now: number) {
  return { accessToken: grant.accessToken, refreshToken: grant.refreshToken, accessExpiresAtMs: now + grant.accessExpiresInSec * 1000, refreshExpiresAtMs: now + grant.refreshExpiresInSec * 1000 };
}

/**
 * The browser arrives here from TikTok without the SameSite=Strict session cookie, so identity comes from the
 * server-side pending record (created by an authenticated operator), proven by the state value in the URL AND by the
 * Lax binding cookie that only the initiating browser holds. Both must match; the record is single use.
 */
export async function completeCallback(ctx: TikTokContext, url: URL, bindingCookie: string | null): Promise<TikTokCallbackOutcome> {
  const config = loadTikTokConfig(ctx.production);
  if (!config.ok) return "not_configured";
  const cfg = config.config;
  const state = url.searchParams.get("state");
  if (url.pathname !== new URL(cfg.redirectUri).pathname || !state || !/^[A-Za-z0-9_-]{43}$/.test(state)) return "state_invalid";
  const store = storeFor(ctx, cfg, false);
  if (!store) return "state_invalid";
  try {
    const now = clock(ctx);
    const pending = store.consumePending(sha256Hex(state), now);
    if (!pending || pending.redirectUri !== cfg.redirectUri || !bindingCookie || !/^[A-Za-z0-9_-]{43}$/.test(bindingCookie) || !safeEqualHex(sha256Hex(bindingCookie), pending.bindingHash)) return "state_invalid";
    if (!operatorStillValid(ctx.authorityDb, pending.actorId)) return "forbidden";
    if (url.searchParams.has("error")) return url.searchParams.get("error") === "access_denied" ? "denied" : "exchange_failed";
    const code = url.searchParams.get("code");
    if (!code || code.length > 2048 || /[\s\p{Cc}]/u.test(code)) return "exchange_failed";

    const exchanged = await tiktok.exchangeCode(cfg, code);
    if (!exchanged.ok) {
      log("tiktok_connect_failed", { workspaceId: ctx.production.workspaceId, actorId: pending.actorId, resultCode: `token_${exchanged.failure}` }, "warn");
      return outcomeFor(exchanged.failure);
    }
    const grant = exchanged.value;
    // The pending record was single use and the exchange may have taken seconds: re-check the operator before storing.
    if (!operatorStillValid(ctx.authorityDb, pending.actorId)) return "forbidden";
    const savedAt = clock(ctx);
    store.saveConnection({ openId: grant.openId, grantedScopes: grant.scopes, tokens: tokensFrom(grant, savedAt), actorId: pending.actorId, now: savedAt });
    log("tiktok_connected", { workspaceId: ctx.production.workspaceId, actorId: pending.actorId });
    await syncProfile(ctx, store, cfg, grant.accessToken);
    return "connected";
  } catch { throw unavailable(); }
  finally { store.close(); }
}

// ---- token + profile lifecycle --------------------------------------------------------------------------------

function fieldsFor(scopes: string[]): string[] | null {
  if (!scopes.includes(BASIC)) return null;
  return ["open_id", "avatar_url", "display_name", ...(scopes.includes(PROFILE_SCOPE) ? ["username", "is_verified"] : [])];
}

/** Returns "token_invalid" when TikTok refused the access token; every other outcome is recorded here. */
async function syncProfile(ctx: TikTokContext, store: ProviderStore, cfg: TikTokConfig, accessToken: string): Promise<"done" | "token_invalid"> {
  const row = store.get();
  if (!row || row.status !== "connected") return "done";
  const now = clock(ctx);
  const fields = fieldsFor(row.grantedScopes);
  if (!fields) { store.saveProfile(row.tokenVersion, null, "scope_missing", now); return "done"; }
  const result = await tiktok.userInfo(accessToken, fields);
  if (result.ok) {
    const info = result.value;
    store.saveProfile(row.tokenVersion, { displayName: info.displayName, avatarUrl: info.avatarUrl, username: info.username, isVerified: info.isVerified }, info.missing.length ? "partial" : "ok", now);
    return "done";
  }
  if (result.failure === "token_invalid") return "token_invalid";
  if (result.failure === "scope_missing") { store.saveProfile(row.tokenVersion, null, "scope_missing", now); return "done"; }
  store.markUnavailable(reasonOf(result.failure), now);
  log("tiktok_provider_failure", { workspaceId: ctx.production.workspaceId, resultCode: `user_info_${result.failure}` }, "warn");
  return "done";
}

type Access = { ok: true; accessToken: string } | { ok: false };

/** An access token that is valid now, refreshing (and storing the rotated pair) when it is close to expiry or forced. */
async function freshAccess(ctx: TikTokContext, store: ProviderStore, cfg: TikTokConfig, force: boolean): Promise<Access> {
  const now = clock(ctx);
  const row = store.get();
  if (!row || row.status !== "connected") return { ok: false };
  if (row.refreshExpiresAtMs !== null && row.refreshExpiresAtMs <= now) { store.markExpired(now); return { ok: false }; }
  let tokens: { accessToken: string | null; refreshToken: string | null };
  try { tokens = store.readTokens(row); }
  catch { store.markUnavailable("credential_unreadable", now); log("tiktok_provider_failure", { workspaceId: ctx.production.workspaceId, resultCode: "credential_unreadable" }, "error"); return { ok: false }; }
  if (!tokens.accessToken || !tokens.refreshToken) { store.markExpired(now); return { ok: false }; }
  if (!force && row.accessExpiresAtMs !== null && row.accessExpiresAtMs - now > REFRESH_SKEW_MS) return { ok: true, accessToken: tokens.accessToken };

  const refreshed = await tiktok.refresh(cfg, tokens.refreshToken);
  if (!refreshed.ok) {
    if (refreshed.failure === "invalid_grant") {
      store.markExpired(clock(ctx));
      log("tiktok_authorization_expired", { workspaceId: ctx.production.workspaceId, resultCode: "refresh_rejected" }, "warn");
    } else {
      store.markUnavailable(reasonOf(refreshed.failure), clock(ctx));
      log("tiktok_provider_failure", { workspaceId: ctx.production.workspaceId, resultCode: `refresh_${refreshed.failure}` }, "warn");
    }
    return { ok: false };
  }
  // TikTok may return a different refresh token; the pair is replaced together, only if nothing else changed meanwhile.
  const applied = store.replaceTokens(row.tokenVersion, tokensFrom(refreshed.value, clock(ctx)), refreshed.value.scopes.length ? refreshed.value.scopes : null);
  return applied ? { ok: true, accessToken: refreshed.value.accessToken } : { ok: false };
}

const inflight = new Map<string, Promise<TikTokStatusView>>();

/** Operator "check connection": renews the access token when needed and re-reads the profile. One at a time per workspace. */
export function refreshConnection(ctx: TikTokContext): Promise<TikTokStatusView> {
  const config = loadTikTokConfig(ctx.production);
  if (!config.ok) return Promise.resolve(buildView(config, null));
  const key = `${ctx.production.workspaceId}:${config.config.providerDbPath}`;
  const running = inflight.get(key);
  if (running) return running;
  const run = (async () => {
    const store = storeFor(ctx, config.config, false);
    if (!store) return buildView(config, null);
    try {
      const row = store.get();
      if (row?.status === "connected") {
        const access = await freshAccess(ctx, store, config.config, false);
        if (access.ok) {
          let outcome = await syncProfile(ctx, store, config.config, access.accessToken);
          if (outcome === "token_invalid") {
            // The token was refused although it looked valid: renew once and ask again; a second refusal is final.
            const again = await freshAccess(ctx, store, config.config, true);
            if (again.ok) outcome = await syncProfile(ctx, store, config.config, again.accessToken);
            if (outcome === "token_invalid") { store.markExpired(clock(ctx)); log("tiktok_authorization_expired", { workspaceId: ctx.production.workspaceId, resultCode: "access_refused" }, "warn"); }
          }
        }
      }
      return buildView(config, store.get());
    } catch { throw unavailable(); }
    finally { store.close(); }
  })().finally(() => { inflight.delete(key); });
  inflight.set(key, run);
  return run;
}

// ---- disconnect -----------------------------------------------------------------------------------------------

/**
 * Local credentials are always erased. TikTok-side revocation is attempted first and reported as `confirmed` only
 * when TikTok said so; anything else is `unconfirmed` (the user can remove the app in TikTok's own settings).
 */
export async function disconnect(ctx: TikTokContext, actorId: string): Promise<TikTokStatusView> {
  const config = loadTikTokConfig(ctx.production);
  const store = storeFor(ctx, config.ok ? config.config : null, false);
  if (!store) return buildView(config, null);
  try {
    const row = store.get();
    if (row && row.status !== "disconnected") {
      let revocation: "confirmed" | "unconfirmed" | null = null;
      if (row.status === "connected") {
        revocation = "unconfirmed";
        if (config.ok) {
          try {
            let accessToken = store.readTokens(row).accessToken;
            // An access token past (or near) its 24 h life cannot be revoked; renew it first so revocation targets a valid token.
            if (row.accessExpiresAtMs === null || row.accessExpiresAtMs - clock(ctx) <= REFRESH_SKEW_MS) {
              const fresh = await freshAccess(ctx, store, config.config, false);
              accessToken = fresh.ok ? fresh.accessToken : null;
            }
            if (accessToken && (await tiktok.revoke(config.config, accessToken)).ok) revocation = "confirmed";
          } catch { /* unreadable credential: erase locally, revocation stays unconfirmed */ }
        }
      }
      store.markDisconnected(clock(ctx), revocation);
      log("tiktok_disconnected", { workspaceId: ctx.production.workspaceId, actorId, resultCode: revocation ?? "not_applicable" });
    }
    return buildView(config, store.get());
  } catch { throw unavailable(); }
  finally { store.close(); }
}

// ---- avatar ---------------------------------------------------------------------------------------------------

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const AVATAR_MAX = 512 * 1024;

/** Serves TikTok's avatar through LiveLift (CSP stays `img-src 'self'`). Any problem is simply "no avatar". */
export async function fetchAvatar(ctx: TikTokContext): Promise<{ bytes: Buffer; contentType: string } | null> {
  const config = loadTikTokConfig(ctx.production);
  if (!config.ok) return null;
  const store = storeFor(ctx, config.config, false);
  if (!store) return null;
  let url: string | null;
  try { const row = store.get(); url = row && row.status !== "disconnected" ? row.profile?.avatarUrl ?? null : null; }
  catch { return null; }
  finally { store.close(); }
  if (!isTikTokAvatarUrl(url)) return null;
  try {
    const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { Accept: "image/*" } });
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!response.ok || !AVATAR_TYPES.has(type) || !response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > AVATAR_MAX) { void reader.cancel().catch(() => {}); return null; }
      chunks.push(value);
    }
    return { bytes: Buffer.concat(chunks, size), contentType: type };
  } catch { return null; }
}
