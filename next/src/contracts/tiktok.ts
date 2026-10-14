/**
 * TikTok provider connection (Login Kit) as the browser may see it.
 *
 * This is a description of an authorization, never a credential: no access token, refresh token, client secret,
 * authorization code or OAuth state exists in any of these types.
 *
 * Evidence tier: every field under `connection` was PROVIDER OBSERVED through TikTok's Login Kit / User Info API
 * at `profileFetchedAtMs`. None of it is PLATFORM CONFIRMED evidence about LIVE, Shop, analytics or native actions.
 */

export type TikTokConnectionState =
  /** Server environment is incomplete or invalid; no OAuth can start. */
  | "not_configured"
  /** Configured, and no connection has been made. */
  | "ready"
  /** A stored authorization exists and no failure is known. */
  | "connected"
  /** The authorization can no longer be used (refresh token expired, revoked or refused). Fails closed. */
  | "expired"
  /** The authorization is stored, but the last check could not reach a usable answer from TikTok. Unknown, not failed. */
  | "unavailable"
  /** A connection existed and the operator removed it. */
  | "disconnected";

export type TikTokUnavailableReason = "network" | "timeout" | "provider_error" | "rate_limited" | "app_credentials_rejected" | "credential_unreadable";

/** `ok` every requested field came back; `partial` some did not; `scope_missing` the grant does not allow the fields; `unknown` never fetched or the last fetch gave no answer. */
export type TikTokProfileState = "ok" | "partial" | "scope_missing" | "unknown";

export interface TikTokProfileView {
  displayName: string | null;
  /** True when a TikTok-hosted avatar URL is on file; the image is only ever served through LiveLift's own route. */
  avatarAvailable: boolean;
  username: string | null;
  isVerified: boolean | null;
}

export interface TikTokConnectionView {
  openId: string | null;
  grantedScopes: string[];
  /** Requested by this deployment but not granted by the user. */
  notGrantedScopes: string[];
  connectedAtMs: number | null;
  /** Until when LiveLift can still renew access without the user (refresh token expiry), when known. */
  authorizationValidUntilMs: number | null;
  profile: TikTokProfileView | null;
  profileState: TikTokProfileState;
  profileFetchedAtMs: number | null;
  lastCheckedAtMs: number | null;
  unavailableReason: TikTokUnavailableReason | null;
}

export type TikTokRevocation = "confirmed" | "unconfirmed";

export interface TikTokStatusView {
  provider: "tiktok";
  state: TikTokConnectionState;
  /** Names (never values) of environment variables that are missing or invalid, when `not_configured`. */
  configIssues: string[];
  requestedScopes: string[];
  connection: TikTokConnectionView | null;
  disconnectedAtMs: number | null;
  /** Whether TikTok confirmed the token revocation at the last disconnect. */
  lastRevocation: TikTokRevocation | null;
  /** Always the same: what this connection does NOT establish. Each is `not_established`, never "no" or zero. */
  limits: {
    live: "not_established";
    shop: "not_established";
    analytics: "not_established";
    nativeActions: "not_established";
  };
}

export type TikTokCallbackOutcome =
  | "connected"
  | "denied"
  | "state_invalid"
  | "forbidden"
  | "not_configured"
  | "exchange_failed"
  | "credentials_rejected"
  | "provider_unavailable";

export const TIKTOK_CALLBACK_OUTCOMES: readonly TikTokCallbackOutcome[] = [
  "connected",
  "denied",
  "state_invalid",
  "forbidden",
  "not_configured",
  "exchange_failed",
  "credentials_rejected",
  "provider_unavailable",
];

export const TIKTOK_ROUTES = {
  status: "/api/v3/integrations/tiktok",
  connect: "/api/v3/integrations/tiktok/connect",
  callback: "/api/v3/integrations/tiktok/callback",
  refresh: "/api/v3/integrations/tiktok/refresh",
  disconnect: "/api/v3/integrations/tiktok/disconnect",
  avatar: "/api/v3/integrations/tiktok/avatar",
} as const;
