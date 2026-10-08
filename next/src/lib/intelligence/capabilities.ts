import type { TikTokConnectionState } from "@/contracts/tiktok";
import type { CapabilityState, ProviderCapability } from "./types";

/**
 * What LiveLift can and cannot offer from the provider, stated plainly.
 *
 * Two kinds of row. FIXED rows are facts about TikTok's official APIs (no server can change them). LIVE rows depend
 * on this deployment: Login Kit comes from the connection status, Shop analytics and Creator realtime from the
 * server. A row the server could not be asked about is UNKNOWN, never "not configured" and never "available".
 */

export const STATE_WORDS: Record<CapabilityState, string> = {
  connected: "CONNECTED",
  available: "AVAILABLE",
  post_live: "POST-LIVE ACCESS",
  realtime: "REALTIME ACCESS",
  access_required: "ACCESS REQUIRED",
  not_connected: "NOT CONNECTED",
  not_configured: "ACCESS NOT CONFIGURED",
  access_not_granted: "ACCESS NOT GRANTED",
  partner_access_required: "PARTNER ACCESS REQUIRED",
  rate_limited: "RATE LIMITED",
  auth_expired: "AUTHORIZATION EXPIRED",
  unavailable: "UNAVAILABLE",
  unsupported: "UNSUPPORTED BY OFFICIAL API",
  unknown: "NOT CHECKED",
};

/** ok: working. attention: could work after someone acts. fixed: not offered, nothing to fix. */
export type StateTone = "ok" | "attention" | "fixed" | "neutral";

export const STATE_TONE: Record<CapabilityState, StateTone> = {
  connected: "ok",
  available: "ok",
  post_live: "ok",
  realtime: "ok",
  access_required: "attention",
  not_connected: "neutral",
  not_configured: "attention",
  access_not_granted: "attention",
  partner_access_required: "attention",
  rate_limited: "attention",
  auth_expired: "attention",
  unavailable: "attention",
  unsupported: "fixed",
  unknown: "neutral",
};

export interface LedgerRow {
  key: string;
  name: string;
  state: CapabilityState;
  why: string;
  /** True when the row is a fixed fact about the official API, not something this deployment could change. */
  fixed: boolean;
}

const LOGIN_KIT_STATE: Record<TikTokConnectionState, CapabilityState> = {
  connected: "connected",
  not_configured: "not_configured",
  ready: "not_connected",
  disconnected: "not_connected",
  expired: "auth_expired",
  unavailable: "unavailable",
};

const SHOP_WHY: Partial<Record<CapabilityState, string>> = {
  available: "Post-LIVE minute and product evidence can be fetched. It arrives after the LIVE, as later evidence, never in real time.",
  not_configured: "No TikTok Shop Partner Center app is configured on this server, so no provider evidence can be fetched for any show.",
  access_not_granted: "A Partner Center app is configured, but the seller has not granted this deployment access to Shop analytics.",
  auth_expired: "The seller authorization expired or was revoked. Provider evidence stays unavailable until it is renewed.",
  rate_limited: "TikTok is limiting how often evidence can be fetched. Nothing is lost; try again later.",
  unavailable: "The provider could not be reached. That is unknown, not zero.",
  unknown: "This browser has not been able to ask the server yet.",
};

export interface LedgerInput {
  loginKit: TikTokConnectionState | null;
  /** null = not asked yet or signed out. "unreachable" = asked, no usable answer. */
  server: ProviderCapability[] | "unreachable" | null;
}

export function buildLedger({ loginKit, server }: LedgerInput): LedgerRow[] {
  const listed = (key: string): ProviderCapability | null => (Array.isArray(server) ? (server.find((c) => c.key === key) ?? null) : null);

  const loginState: CapabilityState = loginKit === null ? "unknown" : LOGIN_KIT_STATE[loginKit];
  const shop = listed("product_clicks");
  const fromProvider = (state: ProviderCapability["state"]): CapabilityState => ({ NOT_CONFIGURED: "not_configured", ACCESS_REQUIRED: "access_required", UNSUPPORTED: "unsupported", POST_LIVE: "post_live", REALTIME: "realtime" } as const)[state] ?? "unknown";
  const shopState: CapabilityState = shop ? fromProvider(shop.state) : Array.isArray(server) ? "not_configured" : "unknown";
  const creator = listed("audience_concurrency");
  const creatorState: CapabilityState = creator ? fromProvider(creator.state) : "partner_access_required";

  return [
    {
      key: "login_kit",
      name: "TikTok Login Kit",
      state: loginState,
      fixed: false,
      why: loginState === "connected" ? "Identifies the TikTok account. It carries no show analytics and does not control the LIVE." : "Sign-in identity only. It is not needed to run, rehearse or review a show.",
    },
    {
      key: "shop_analytics",
      name: "TikTok Shop analytics",
      state: shopState,
      fixed: false,
      why: shop?.note ?? SHOP_WHY[shopState] ?? "Provider evidence is not available.",
    },
    {
      key: "creator_realtime",
      name: "Creator realtime concurrency",
      state: creatorState,
      fixed: false,
      why: creator?.note ?? "Live viewer concurrency needs a verified Creator account and restricted partner access. LiveLift does not claim it.",
    },
    {
      key: "raw_chat",
      name: "Raw LIVE chat text",
      state: "unsupported",
      fixed: true,
      why: "TikTok offers no official API for chat text. LiveLift never shows comments; only the operator can report what they saw.",
    },
    {
      key: "pin_control",
      name: "Pin / unpin control",
      state: "unsupported",
      fixed: true,
      why: "No official API reads or changes the pinned product. The operator pins in TikTok and reports it here.",
    },
  ];
}
