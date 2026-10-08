# TikTok integration feasibility

**Date checked: 2026-10-07.** Scope: what LiveLift may truthfully do with TikTok, for an app whose operator does **not** have a LIVE-eligible TikTok account.

This is research, not a promise. Where an official page could not be read, or says nothing, this document says so and does not fill the gap.

## Classification vocabulary

| Label | Meaning |
|---|---|
| **SUPPORTED NOW** | Documented, needs only a registered developer app, and LiveLift V1 implements it. |
| **SANDBOX TESTABLE** | Documented, and a TikTok Sandbox with explicitly added target users can exercise it before any app review. |
| **REQUIRES APP REVIEW** | Documented, but TikTok review/approval is needed before use beyond sandbox target users or for non-basic data. |
| **TIKTOK SHOP / PARTNER ONLY** | Lives in TikTok Shop Partner Center: a separate program, credentials, authorization and request signing. |
| **NOT DOCUMENTED / UNSUPPORTED** | No official documentation found for this app type. LiveLift does not build it and does not infer it. |

## How this was checked

- **developers.tiktok.com** pages were fetched on 2026-10-07 (summaries by a fetch tool, then cross-read against the page's own wording; items the pages do not state are marked *not stated*).
- **partner.tiktokshop.com** (TikTok Shop Partner Center) is a JavaScript application. It was rendered with headless Chromium on 2026-10-07 for: Authorization overview, App Category Selection Guide, Creator authorization guide, *Get Shop LIVE Performance List*, and the **API Reference** navigation tree (every entry containing *live, pin, chat, comment, stream, promotion, flash, showcase, affiliate*). Everything else about Shop is **carried from** `docs/research/codex-gap-study/04_TIKTOK_API_CAPABILITY_MAP.md` (rendered 2026-10-05) and marked *(carried, 2026-10-05)*.
- No TikTok credential was available, so **no request was sent to TikTok** while preparing this document. Request/response shapes below come from the documentation, and V1's behaviour against them is proven by deterministic fixtures, not by a live call. The first live proof is the sandbox run in `SANDBOX-SETUP.md`.
- Absence of an official page is "not documented", never proof that TikTok has no such capability for some partner.

## Summary

| # | Capability | Class | LiveLift V1 |
|---|---|---|---|
| 1 | Login Kit for Web (OAuth authorization-code) | **SANDBOX TESTABLE**; production for arbitrary users **REQUIRES APP REVIEW** | **Implemented** |
| 2 | Sandbox (≤5 per app, ≤10 target users) | **SUPPORTED NOW** | Prepared |
| 3 | Scope `user.info.basic` (open ID, avatar, display name) | **SANDBOX TESTABLE** / production **REQUIRES APP REVIEW** | **Implemented** (default) |
| 4 | Scope `user.info.profile` (username, bio, link, verified) | **REQUIRES APP REVIEW** | Optional, implemented (username, verified) |
| 5 | Scope `user.info.stats` (counts) | **REQUIRES APP REVIEW** | Not requested: counts risk "Missing != Zero" |
| 6 | User Info endpoint (Display API family) | **SANDBOX TESTABLE** | **Implemented** |
| 7 | Access token 24 h, refresh token 365 days, rotation | **SUPPORTED NOW** | **Implemented** |
| 8 | Token revocation endpoint | **SUPPORTED NOW** | **Implemented** (confirmed vs unconfirmed) |
| 9 | Redirect URI rules (https, no query/fragment, ≤512, ≤10, registered) | **SUPPORTED NOW** | Enforced |
| 10 | Content Posting API (`video.publish`, `video.upload`) | **REQUIRES APP REVIEW**; public posting unavailable in sandbox | Not built (LiveLift posts nothing) |
| 11 | Video list / query (`video.list`) | **REQUIRES APP REVIEW** | Not built |
| 12 | TikTok Shop seller/creator/partner authorization | **TIKTOK SHOP / PARTNER ONLY** | Boundary only |
| 13 | Shop product / catalog API (Search Products) | **TIKTOK SHOP / PARTNER ONLY** | Boundary only; CSV/TSV import unchanged |
| 14 | Shop LIVE analytics: session list, overview, per-minute, product performance | **TIKTOK SHOP / PARTNER ONLY** (post-hoc / aggregate) | Not built |
| 15 | Creator LIVE-room analytics (core stats, GMV/interaction/view trends, product stats, traffic, portraits) | **TIKTOK SHOP / PARTNER ONLY** (creator must be a TikTok Shop creator) | Not built |
| 16 | Generic Shop promotion APIs (e.g. create Flash Sale activity) | **TIKTOK SHOP / PARTNER ONLY** *(carried)* | Not built |
| 17 | Realtime LIVE chat (comment bodies) | **NOT DOCUMENTED / UNSUPPORTED** | Not built |
| 18 | Realtime LIVE engagement events (likes, gifts, joins) | **NOT DOCUMENTED / UNSUPPORTED** | Not built |
| 19 | Product pin / unpin in a LIVE | **NOT DOCUMENTED / UNSUPPORTED** | Not built; operator reports manually |
| 20 | Promotion/coupon/giveaway control inside a LIVE | **NOT DOCUMENTED / UNSUPPORTED** | Not built |
| 21 | Platform-side verification of a pin/promotion/native action | **NOT DOCUMENTED / UNSUPPORTED** | Not built |
| 22 | Checking whether an account is LIVE-eligible | **NOT DOCUMENTED / UNSUPPORTED** | Not built; UI says "not established" |

## 1. Login Kit for Web

Source: <https://developers.tiktok.com/doc/login-kit-web>, <https://developers.tiktok.com/doc/login-kit-overview>.

- Authorization URL `https://www.tiktok.com/v2/auth/authorize/` with `client_key`, `scope` (comma-separated), `redirect_uri`, `state`, `response_type=code`; optional `disable_auto_auth`.
- Callback query: `code`, `scopes`, `state`, and `error` / `error_description` when the user is ineligible for third-party login or denies.
- Redirect URI: absolute, begins with `https`, static (no query parameters), no fragment, ≤512 characters, ≤10 per app, **registered in the developer portal before use**.
- PKCE: **not mentioned** in the web guide (the token documentation requires `code_verifier` only for mobile/desktop). V1 does not send PKCE; it relies on a single-use `state` plus a browser-binding cookie (see README).
- Authorization-code lifetime: **not stated** in the page read. V1 treats the code as single-use and exchanges it immediately.
- Login Kit overview: pre-approval is required for access beyond basic user information; `user.info.basic` is the baseline.

## 2. Sandbox

Source: <https://developers.tiktok.com/doc/add-a-sandbox>, <https://developers.tiktok.com/doc/getting-started-create-an-app>.

- Create a sandbox from *Manage apps* by toggling the app to Sandbox and choosing *Create Sandbox*; optionally clone configuration; *Apply changes* to save. Up to **5 sandboxes** per app.
- Add **target users** (≤10 TikTok accounts you own) under *Sandbox settings*; each logs in and accepts the developer terms; results can take up to an hour to appear.
- Stated unavailable in sandbox: Content Posting API for public videos; Data Portability API.
- Login Kit is stated as available for sandbox testing for Web, Desktop, iOS, Android.
- Whether a sandbox has its own client key/secret: **not stated** on the page read. `SANDBOX-SETUP.md` tells the human to use whatever the Sandbox's own credentials page shows.
- Production use needs app review: explain each product and scope; at least one demo video (≤5, ≤50 MB each) showing the end-to-end flow.

## 3. Scopes and the User Info endpoint

Source: <https://developers.tiktok.com/doc/tiktok-api-scopes>, <https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info>.

- `GET https://open.tiktokapis.com/v2/user/info/?fields=…` with `Authorization: Bearer <access token>`.
- `user.info.basic`: `open_id`, `union_id`, `avatar_url`, `avatar_url_100`, `avatar_large_url`, `display_name`.
- `user.info.profile`: `bio_description`, `profile_deep_link`, `is_verified`, `username`.
- `user.info.stats`: `follower_count`, `following_count`, `likes_count`, `video_count`.
- Response: `{ "data": { "user": { … } }, "error": { "code": "ok", "message": "", "log_id": "" } }`.
- The scopes page does not itself say which scopes need review; the Login Kit overview does (anything beyond basic).
- Errors (<https://developers.tiktok.com/doc/tiktok-api-v2-error-handling>): `access_token_invalid` 401, `scope_not_authorized` 401, `scope_permission_missed` 400, `rate_limit_exceeded` 429, `internal_error` 500, `invalid_params` 400.
- Rate limit (<https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit>): `/v2/user/info/` 600 requests per one-minute sliding window; whether per user or per app is **not stated**. V1 reads a profile only on connect, on operator "Check connection", and once on page open when it is >15 minutes stale.

## 4. Tokens, refresh, revocation

Source: <https://developers.tiktok.com/doc/oauth-user-access-token-management>, <https://developers.tiktok.com/doc/oauth-error-handling>.

- Token endpoint `POST https://open.tiktokapis.com/v2/oauth/token/`, `application/x-www-form-urlencoded`: `client_key`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri` (must match the one used to obtain the code).
- Response: `access_token`, `expires_in` (24 h), `open_id`, `refresh_token` (365 days), `refresh_expires_in`, `scope`, `token_type=Bearer`.
- Refresh: `grant_type=refresh_token`; "the returned `refresh_token` may be different than the one passed" — V1 always stores the returned pair together.
- Revoke: `POST https://open.tiktokapis.com/v2/oauth/revoke/` with `client_key`, `client_secret`, `token` (the access token); empty body on success.
- Error body: `error`, `error_description`, `log_id`. Codes: `invalid_request`, `invalid_client`, `invalid_grant`, `invalid_scope`, `unauthorized_client`, `unsupported_grant_type`, `unsupported_response_type`, `server_error`, `temporarily_unavailable`; redirect error `access_denied`.
- Disconnect from the user's side (removing the app in TikTok's own settings) is not announced to LiveLift by any documented webhook in the pages read; LiveLift only learns of it when a refresh or API call is refused, and then shows **Authorization expired**.

## 5. TikTok Shop (Partner Center)

First-hand 2026-10-07: <https://partner.tiktokshop.com/docv2/page/678e3a3292b0f40314a92d75>, <https://partner.tiktokshop.com/docv2/page/hulvi36o>, <https://partner.tiktokshop.com/docv2/page/creator-authorization-guide>, <https://partner.tiktokshop.com/docv2/page/get-shop-live-performance-list-202609>.

- Shop is a **separate program**: an app registered in TikTok Shop Partner Center with an **App Category** (irreversible once chosen; it determines the default API scope), an app key/secret, a `service_id`, and **signed requests**. Seller authorization link: `https://services.tiktokshop.com/open/authorize?service_id={service_id}` (US: `services.us.tiktokshop.com`); token endpoints `https://auth.tiktok-shops.com/api/v2/token/get` and `…/token/refresh`. A Login Kit `user.info.basic` token cannot be used here, and the reverse.
- Creator authorization requires the user to be "**a real TikTok Shop creator, not just a regular TikTok account**", and some creator capabilities are beta/allowlist.
- API Reference contains *Get Shop LIVE Performance List* (`GET /analytics/202609/shop_lives/performance`, scope `data.shop_analytics.public.read`; "Sellers can only query room ID data for their own official creator accounts"), *Get Shop LIVE Performance Overview*, *Get Shop LIVE Minute Performance*, *Get Shop LIVE Products Performance List*, *Get Bestselling LIVE Sessions*, and *Get Live Room* Core Stats, GMV Trend, Interactive Trends, View Trends, Product Stats, Traffic Performance, User Portraits. These are **analytics**: aggregates and post-LIVE reporting, not realtime control. Per-minute and product performance are post-LIVE and restricted to official/marketing accounts *(carried, 2026-10-05)*.
- Product catalog: Search Products 202502 `POST /product/202502/products/search`, scope `seller.product.basic` *(carried)*.
- Promotions: a generic Create Promotion Activity (Flash Sale) exists; coupon *creation* is excluded by the promotion overview; room-level LIVE activation is not documented *(carried)*.
- The API Reference tree **contained no entry** for LIVE chat, comments, pinning, product pin, stream control, or giveaway control (the tree may not have been fully expanded; see the limits above).

**Consequence:** without Partner Center registration, a seller authorization and credentials this project does not have, nothing in Shop can be called, and none of it can be faked. V1 ships `lib/server/tiktok/shop.ts`, an adapter boundary that answers `requires_partner_authorization` and `not_connected` (never an empty catalogue). Manual CSV/TSV product import is untouched.

## 6. What stays impossible for this app type

Not documented, so not built, so the UI says **not established** rather than "no" or zero:

- **Realtime LIVE chat and engagement** (items 17, 18). Unofficial libraries that reverse-engineer LIVE streams exist; they are not TikTok's API, they break without notice, and LiveLift does not use them. Aggregate engagement exists only in Shop analytics (item 15), and only for Shop creators.
- **Pin/unpin, promotion, coupon and giveaway control inside a LIVE** (items 19, 20). The operator performs these natively in TikTok and reports them in LiveLift. A report is an *operator-reported* record; it is never upgraded to *provider-observed* or *platform-confirmed*.
- **Verification of native actions** (item 21).
- **LIVE eligibility** (item 22). No eligibility endpoint is documented. LiveLift never bypasses eligibility and never infers it from a connected account. A Login Kit connection is proof of an account identity only.

## 7. Evidence tiers in LiveLift

| Tier | Source | Example |
|---|---|---|
| operator reported | A human in LiveLift | "I pinned product 3" |
| provider observed | An official TikTok API answered LiveLift | Display name returned by User Info at 14:02 |
| platform confirmed | Independent evidence about the show action | **none available** |
| simulated | LiveLift's rehearsal engine | Simulator output is never provider-observed |

The TikTok connection produces only *provider observed* **identity**. It is stored outside the show/session model and no code path can attach it to a show, a cue, or a metric (enforced by a structural test).
