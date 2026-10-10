/**
 * What each platform lets LiveLift do, stated per action and with the strength of the evidence behind it.
 *
 * LiveLift never assumes a platform has a control. It asks this table, and where a platform offers none the action
 * falls back to the operator doing it natively and reporting it (an operator report, never platform confirmation).
 */

export type PlatformId = "tiktok" | "shopee_live";

export type ControlKey =
  | "catalog_sync"
  | "start_live"
  | "end_live"
  | "add_items"
  | "pin"
  | "unpin"
  | "promotion"
  | "observe_showing_item"
  | "read_comments"
  | "post_live_analytics";

/** `official_api`: LiveLift can call it. `operator_assisted`: LiveLift tells the operator, who acts natively and reports. */
export type Support = "official_api" | "operator_assisted" | "not_established";

/**
 * How well the row is known.
 * - `documented`: read from the platform's own reference page.
 * - `repo_research`: found by earlier project research (2026-09/10), not re-read for this table.
 * - `inferred`: only an endpoint NAME is known; parameters and behaviour are guesses.
 * - `unverified`: a plausible behaviour nobody has confirmed with a real call.
 * - `not_documented`: no official page was found. Absence of a page is not proof the platform lacks the capability.
 */
export type Basis = "documented" | "repo_research" | "inferred" | "unverified" | "not_documented";

export interface CapabilityRow {
  key: ControlKey;
  support: Support;
  basis: Basis;
  /** Shown beside the row. Plain words, including what is not known. */
  note: string;
}

export const CONTROL_LABEL: Record<ControlKey, string> = {
  catalog_sync: "Product catalog",
  start_live: "Open the live",
  end_live: "End the live",
  add_items: "Add products to the live",
  pin: "Pin a product",
  unpin: "Unpin",
  promotion: "Flash sale / promotion",
  observe_showing_item: "See what the host pinned",
  read_comments: "Read comments",
  post_live_analytics: "Analytics after the live",
};

export const PLATFORM_LABEL: Record<PlatformId, string> = { tiktok: "TikTok LIVE", shopee_live: "Shopee Live" };

export const PLATFORM_CAPABILITIES: Record<PlatformId, CapabilityRow[]> = {
  tiktok: [
    { key: "catalog_sync", support: "official_api", basis: "documented", note: "TikTok Shop Partner API (Search Products). Needs Partner Center access and an Account Manager this team does not have." },
    { key: "start_live", support: "not_established", basis: "not_documented", note: "No documented endpoint, and no way to check LIVE eligibility." },
    { key: "end_live", support: "not_established", basis: "not_documented", note: "No documented endpoint." },
    { key: "add_items", support: "operator_assisted", basis: "not_documented", note: "The host builds the shopping bag in TikTok." },
    { key: "pin", support: "operator_assisted", basis: "not_documented", note: "No documented API to pin. LiveLift says what to pin; the operator pins in TikTok and reports it." },
    { key: "unpin", support: "operator_assisted", basis: "not_documented", note: "As for pin." },
    { key: "promotion", support: "operator_assisted", basis: "repo_research", note: "Shop Partner API can create a promotion in advance. Nothing documented starts one inside a live." },
    { key: "observe_showing_item", support: "not_established", basis: "not_documented", note: "No official way to read the pinned product." },
    { key: "read_comments", support: "not_established", basis: "not_documented", note: "No official API for comment text." },
    { key: "post_live_analytics", support: "official_api", basis: "repo_research", note: "Per-minute analytics after the live, Partner access only." },
  ],
  shopee_live: [
    { key: "catalog_sync", support: "official_api", basis: "inferred", note: "Shopee's product module exists; its use for this has not been read." },
    { key: "start_live", support: "official_api", basis: "inferred", note: "create_session and start_session exist by name. Unknown: whether the API supplies a video address or the host still streams from the app or OBS." },
    { key: "end_live", support: "official_api", basis: "inferred", note: "end_session exists by name." },
    { key: "add_items", support: "official_api", basis: "inferred", note: "add_item_list, delete_item_list and update_item_list exist by name." },
    { key: "pin", support: "official_api", basis: "documented", note: "update_show_item, listed for VN. Needs an ongoing live that belongs to the authorised account. \"Showing item\" is read as pin; unconfirmed." },
    { key: "unpin", support: "operator_assisted", basis: "not_documented", note: "No endpoint to clear the showing item was found: item_id is required. The operator unpins in the app and reports it. The Live Desk's SIMULATED Shopee answers a guessed unpin call (unpin_show_item): guessed, no Shopee page found, never Shopee's behaviour." },
    { key: "promotion", support: "official_api", basis: "inferred", note: "Promotions are scheduled through separate Shopee modules (flash sale, discount, voucher). Nothing found that fires one inside a live." },
    { key: "observe_showing_item", support: "official_api", basis: "unverified", note: "Whether reading the session reveals the showing item, and whether a live started in the app can be read at all, is not known." },
    { key: "read_comments", support: "official_api", basis: "repo_research", note: "get_latest_comment_list, a 10 second window, listed for VN." },
    { key: "post_live_analytics", support: "official_api", basis: "repo_research", note: "get_session_metric and get_session_item_metric, listed for VN." },
  ],
};

export function capabilityFor(platform: PlatformId, key: ControlKey): CapabilityRow {
  const row = PLATFORM_CAPABILITIES[platform].find((r) => r.key === key);
  if (!row) throw new Error(`No capability row for ${platform}/${key}`);
  return row;
}

/** True only when LiveLift may attempt the action through the platform's own API. */
export const canCallApi = (platform: PlatformId, key: ControlKey): boolean => capabilityFor(platform, key).support === "official_api";

export const BASIS_WORDS: Record<Basis, string> = {
  documented: "Read from the platform's page",
  repo_research: "From earlier project research",
  inferred: "Name known, shape guessed",
  unverified: "Not confirmed by a real call",
  not_documented: "No official page found",
};
