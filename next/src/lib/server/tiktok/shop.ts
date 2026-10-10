/**
 * TikTok Shop catalog adapter BOUNDARY (V1: contract only, no network).
 *
 * TikTok Shop APIs are a different program from Login Kit: they use TikTok Shop Partner Center (an app registered
 * there, authorised by a seller, with signed requests) and credentials LiveLift does not have. Login Kit's
 * `user.info.basic` token cannot read a catalog, and there is no honest way to pretend it can.
 *
 * So the boundary says exactly that. Manual CSV/TSV import (lib/domain/products.ts) remains the one real catalog
 * source; it is unaffected by anything here. A future Shop integration implements `CatalogProvider` and replaces
 * `tiktokShopCatalog`; callers already handle "not available" because that is what they get today.
 * See docs/tiktok/FEASIBILITY.md.
 */
export type CatalogSource = "manual_import" | "tiktok_shop";

export type CatalogAvailability =
  | { state: "available" }
  /** Needs Partner Center credentials and seller authorization that this deployment does not have. */
  | { state: "requires_partner_authorization" };

export type CatalogListResult =
  | { ok: true; products: never[] }
  | { ok: false; reason: "not_connected" };

export interface CatalogProvider {
  readonly source: CatalogSource;
  availability(): CatalogAvailability;
  listProducts(): Promise<CatalogListResult>;
}

export const tiktokShopCatalog: CatalogProvider = {
  source: "tiktok_shop",
  availability: () => ({ state: "requires_partner_authorization" }),
  // Never fabricates an empty catalog: "not connected" is not "zero products".
  listProducts: async () => ({ ok: false, reason: "not_connected" }),
};
