# TikTok LIVE Intelligence Research & Provider Architecture (Phase V7)

**Document Version:** 1.0 (Phase V7 TikTok LIVE Intelligence R&D)  
**Author:** LiveLift R&D Team  
**Date:** 2026-10-07  
**Target Branch:** `orca/v7-tiktok-live-intelligence-rd`  
**Classification Integrity Mode:** Development / Empirical Specification Mining  
**Audience:** Platform Engineers, Domain Modelers, AI System Architects, Integration Reviewers  

---

## 1. Executive Summary & Ecosystem Bifurcation

Phase V7 investigates extending LiveLift from an offline-first pacing, rundown, and recovery desk into an intelligent **TikTok LIVE Intelligence system**. To establish an authoritative engineering foundation without relying on undocumented, reverse-engineered, or fragile scrapers, this research evaluates all official interfaces across ByteDance and TikTok platforms.

### 1.1 The Fundamental Architectural Divide

Our empirical mining of official documentation, partner portals, and gateway routing confirms that TikTok operates two entirely disjoint developer ecosystems with distinct identity pools, OAuth scopes, token formats, signature protocols, and API domains:

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │               ByteDance / TikTok Ecosystem             │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                       ┌──────────────────────────────────────┴──────────────────────────────────────┐
                       ▼                                                                            ▼
       ┌───────────────────────────────┐                                            ┌───────────────────────────────┐
       │     TikTok for Developers     │                                            │  TikTok Shop Partner Center   │
       │    (developers.tiktok.com)    │                                            │   (partner.tiktokshop.com)    │
       └───────────────┬───────────────┘                                            └───────────────┬───────────────┘
                       │                                                                            │
      ┌────────────────┴────────────────┐                                          ┌────────────────┴────────────────┐
      ▼                                 ▼                                          ▼                                 ▼
[Login Kit / Display]          [Content Posting]                          [Seller Open APIs]               [Creator Open APIs]
- user.info.basic              - video.upload                             - shop_lives/*                   - live_rooms/*
- user.info.profile            - video.publish                            - products_performance           - core_stats
- user.info.stats              (No LIVE streaming API)                    - orders, catalog, flashsale     - gmv/view/interactive trends
(OAuth 2.0 Web, App Review)                                               (OAuth Seller user_type=0,       (OAuth Creator user_type=1,
                                                                           HMAC-SHA256, shop_cipher)        Live Data package, Beta)
```

#### Core Ecosystem Differences:
1. **TikTok for Developers (`developers.tiktok.com`):**
   - **Focus:** User identity, short-video posting, user statistics, web profile embeds.
   - **Gateway:** `https://open.tiktokapis.com/v2/`
   - **Authentication:** Standard OAuth 2.0 Bearer tokens in `Authorization: Bearer <token>`.
   - **Key Finding:** Contains **zero** APIs, WebSockets, or webhooks for LIVE streaming, live room chat messages, real-time viewer concurrency, or live commerce interactions.
2. **TikTok Shop Partner Center (`partner.tiktokshop.com`):**
   - **Focus:** E-commerce operations, order management (OMS), catalog management (ERP), seller analytics, and creator live room analytics.
   - **Gateway:** `https://open-api.tiktokglobalshop.com/` (US: `https://open-api.tiktokglobalshop.com/` or `partner.us.tiktokshop.com`).
   - **Authentication:** Separate Partner App credentials (`app_key`, `app_secret`, `service_id`). Token endpoint `https://auth.tiktok-shops.com/api/v2/token/get` with literal `grant_type=authorized_code`.
   - **Cryptographic Request Signing:** Mandatory HMAC-SHA256 signing of sorted query parameters, request path, and exact raw request body bytes.
   - **Key Finding:** Houses all official LIVE analytics endpoints. However, Seller APIs are strictly **POST-LIVE ONLY**, while Creator APIs offer near-realtime aggregate room stats but require restricted Creator authorization tokens (`user_type = 1`).

---

## 2. Master Capability Matrix (All 25 Capabilities)

All 25 capability areas are evaluated and strictly classified using only the seven official status labels:
- `AVAILABLE NOW`
- `PARTNER/SHOP ACCESS REQUIRED`
- `APP REVIEW REQUIRED`
- `POST-LIVE ONLY`
- `REALTIME`
- `NOT DOCUMENTED`
- `UNSUPPORTED`

| # | Capability Area | Strict Status | Official Citation (Endpoint / Document / Scope) | Auth / Token Type | Data Granularity & Timing | Key Limitations & Constraints |
|---|---|---|---|---|---|---|
| **1** | LIVE session list / history | **POST-LIVE ONLY** | `GET /analytics/202609/shop_lives/performance`<br>Scope: `data.shop_analytics.public.read`<br>[Shop Live Performance List](https://partner.tiktokshop.com/docv2/page/get-shop-live-performance-list-202609) | Seller token (`user_type=0`), requires `shop_cipher` | Historical list by date range (`start_date_ge`, `end_date_lt`) | Restricted to shop's own official and marketing creator accounts; does not stream ongoing live state. |
| **2** | Current / recent viewer counts | **REALTIME** | `GET /analytics/202502/live_rooms/{live_room_id}/core_stats`<br>Scope: `creator.data.live.read.public`<br>[Live Room Core Stats](https://partner.tiktokshop.com/docv2/page/get-live-room-core-stats-202502) | Creator token (`user_type=1`), package "Live Data" | Snapshot during LIVE (`current_visitor_count`, `peak_concurrent_user_count`) | Requires verified Creator OAuth authorization; completely unavailable via Seller token. Beta allowlist. |
| **3** | Comments (Chat stream / bodies) | **UNSUPPORTED** | [TikTok Developer Welcome](https://developers.tiktok.com/docs/en/welcome)<br>[TTS Partner Center Navigation Tree](https://partner.tiktokshop.com/docv2/page/hulvi36o) | None | Post-LIVE aggregate count only (`performance_per_minutes.interactions.comments`) | No official API exists to read live chat message text, commenter usernames, or chat events. |
| **4** | Likes | **UNSUPPORTED** | `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`<br>[TikTok Scopes](https://developers.tiktok.com/doc/tiktok-api-scopes) | None (for live stream) | Post-LIVE aggregate count per minute; Account-level total in `user.info.stats` | No real-time event stream for incoming likes. Account-level total likes requires App Review. |
| **5** | Follows | **UNSUPPORTED** | `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`<br>[TikTok Scopes](https://developers.tiktok.com/doc/tiktok-api-scopes) | None (for live stream) | Post-LIVE new follower count per minute; Account-level total in `user.info.stats` | No real-time follower acquisition stream. Account-level follower count requires App Review. |
| **6** | Engagement (Gifts, shares, joins) | **UNSUPPORTED** | `GET /analytics/202502/live_rooms/{live_room_id}/interactive_trend_performances`<br>`GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes` | Creator token (`user_type=1`) or Seller token (`user_type=0`) | Post-LIVE 1-minute aggregates (shares, comments, likes) or Creator trend curves | No real-time event stream for gifts, room enters, or individual interactive taps. |
| **7** | Product clicks | **POST-LIVE ONLY** | `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`<br>`GET /analytics/202512/shop/{live_id}/products_performance`<br>Scope: `data.shop_analytics.public.read` | Seller token (`user_type=0`), requires `shop_cipher` | 1-minute interval series (`traffic.product_clicks`, `ctr`) and per-product summary (`produt_clicks`) | Available strictly after session finishes. Schema field has verbatim official typo: `produt_clicks`. |
| **8** | Product impressions | **POST-LIVE ONLY** | `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`<br>`GET /analytics/202512/shop/{live_id}/products_performance`<br>Scope: `data.shop_analytics.public.read` | Seller token (`user_type=0`), requires `shop_cipher` | 1-minute interval series (`traffic.product_impressions`) and per-product total | Available strictly after broadcast finishes. No real-time impression counter. |
| **9** | Orders | **PARTNER/SHOP ACCESS REQUIRED** | `GET /order/202309/orders`<br>`GET /order/202309/orders/{order_id}`<br>Webhook: `ORDER_STATUS_CHANGE`<br>Scope: `seller.order.info` | Seller token (`user_type=0`), requires `shop_cipher` | Real-time webhook & polling for shop orders; Post-LIVE attributed room orders | In US market, `room_id` attribution exists (July 2026); in VN, session attribution is post-LIVE only. |
| **10** | GMV | **POST-LIVE ONLY** | `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`<br>`GET /analytics/202609/shop_lives/overview_performance`<br>Scope: `data.shop_analytics.public.read` | Seller token (`user_type=0`), requires `shop_cipher` | 1-minute interval series (`sales.gmv`); Daily shop total (`today=true`) | Session-specific minute GMV is post-LIVE only (attributed, includes returns/refunds). Daily total is shop-wide. |
| **11** | Conversion | **POST-LIVE ONLY** | `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`<br>`GET /analytics/202512/shop/{live_id}/products_performance`<br>Scope: `data.shop_analytics.public.read` | Seller token (`user_type=0`), requires `shop_cipher` | 1-minute conversion metrics (`ctr`, `enter_room_rate`, `conversion.created_sku_orders`, CTOR) | Post-LIVE only. Calculated over platform attribution windows. |
| **12** | Product performance during LIVE | **POST-LIVE ONLY** | `GET /analytics/202512/shop/{live_id}/products_performance`<br>Creator: `GET /analytics/202502/live_rooms/{live_room_id}/product_stats` | Seller token (post-LIVE) or Creator token (near-realtime aggregates) | Post-LIVE per-product breakdown (sales, clicks, units sold); Creator product stats | Seller endpoint returns data only after session completes. Creator endpoint requires creator token. |
| **13** | LIVE room analytics suite | **PARTNER/SHOP ACCESS REQUIRED** | `GET /analytics/202502/live_rooms/{live_room_id}/*`<br>(`core_stats`, `gmv_trend`, `interactive_trend`, `view_trend`, `product_stats`, `traffic`, `portraits`)<br>Scope: `creator.data.live.read.public` | Creator token (`user_type=1`), package "Live Data" | Aggregate room trends, demographic user portraits, traffic channel shares | Requires creator authorization from an approved TikTok Shop Creator (CCCD + >=1,000 followers in VN). |
| **14** | Stream status (Live / Ended) | **NOT DOCUMENTED** | Seller: No endpoint.<br>Creator: `GET /analytics/202502/live_rooms/{live_room_id}/core_stats` (`is_live`) | Creator token (`user_type=1`) | Polling snapshot (`is_live`: boolean) | No stream start / end webhooks exist. Seller API does not document active stream status. |
| **15** | Pinned product state | **NOT DOCUMENTED** | [Live Room Product Stats](https://partner.tiktokshop.com/docv2/page/get-live-room-product-stats-202502)<br>[Top Showcase Products](https://partner.tiktokshop.com/docv2/page/top-showcase-products-202409) | None | Visual UI indicator in LIVE Manager only | No official API returns the currently pinned product ID in a LIVE room. |
| **16** | Pin / unpin control | **UNSUPPORTED** | [Top Showcase Products](https://partner.tiktokshop.com/docv2/page/top-showcase-products-202409)<br>[Doc: Common Errors](https://partner.tiktokshop.com/docv2/page/678e3a45786253031531b942) | None | Native manual UI action in TikTok app / LIVE Manager | `creator.showcase.write` only controls creator profile showcase products, not in-stream live pinning. |
| **17** | Promotions (Flash sales) | **PARTNER/SHOP ACCESS REQUIRED** | `POST /promotion/202309/activities`<br>Scope: `seller.promotion.write`<br>[Create Promotion Activity](https://partner.tiktokshop.com/docv2/page/create-promotion-activity-202309) | Seller token (`user_type=0`), requires `shop_cipher` | Future scheduled flash sale creation at shop level | Configures shop discount activity; does not support real-time in-stream room flash activation. |
| **18** | Coupons | **PARTNER/SHOP ACCESS REQUIRED** | `POST /promotion/202406/coupons/search`<br>`GET /promotion/202406/coupons/{coupon_id}`<br>Scope: `seller.promotion.info`<br>[Search Coupon List](https://partner.tiktokshop.com/docv2/page/search-coupon-list-202406) | Seller token (`user_type=0`), requires `shop_cipher` | Read existing seller coupon list and status | Coupon creation is explicitly excluded by the API; in-stream voucher card pinning is native only. |
| **19** | LIVE Manager data | **UNSUPPORTED** | [LIVE Manager for Sellers](https://seller-vn.tiktok.com/university/essay?knowledge_id=113561775900417)<br>[Agency Access to Live Manager](https://partner.tiktokshop.com/docv2/page/6864797b75134204a1f760cf) | None (UI-only) | Web browser console (`seller-vn.tiktok.com`) | LIVE Manager has no external API for third-party tools. Agency access is an allowlisted UI portal. |
| **20** | Webhooks | **PARTNER/SHOP ACCESS REQUIRED** | Topics: `ORDER_STATUS_CHANGE`, `PACKAGE_UPDATE`, `SELLER_DEAUTHORIZATION`, `UPCOMING_AUTHORIZATION_EXPIRATION`, `Shoppable Content Posting` (Topic 17) | Partner app webhook signature (HMAC-SHA256) | Real-time HTTPS POST push notifications to developer callback URL | No stream lifecycle webhooks (`stream_start`/`stream_end`); no live comment or viewer webhooks. |
| **21** | Polling frequency & rate limits | **PARTNER/SHOP ACCESS REQUIRED** | TTS Dynamic QPS Allocation: 0.2 - 1.0 req/s baseline for analytics; Sandbox: 100 or 1000 req/hr<br>[Rate Limit & Throttling](https://partner.tiktokshop.com/docv2/page/64f1991d64ed2e0295f3d2c0) | Dynamic rate limiting per app / shop | 0.2 req/s (LiveLift Python client); Post-LIVE polling cadence: every 15 min up to 48 hrs | HTTP 429 / code `36009002` triggers exponential backoff + jitter, respecting `Retry-After`. |
| **22** | Seller / creator authorization | **PARTNER/SHOP ACCESS REQUIRED** | Seller: `https://services.tiktokshop.com/open/authorize?service_id={service_id}`<br>Creator: Creator OAuth guide<br>Token: `GET https://auth.tiktok-shops.com/api/v2/token/get?grant_type=authorized_code` | OAuth 2.0 (`authorized_code`), HMAC-SHA256 signature, `shop_cipher` | Seller token lasts 7 days; Creator token requires verified creator account | `user_type=0` (Seller) cannot access `live_rooms/*`; `user_type=1` (Creator) cannot access `shop_lives/*`. |
| **23** | Partner Center app requirements | **PARTNER/SHOP ACCESS REQUIRED** | Portal: `partner.tiktokshop.com`<br>Custom App vs ISV App<br>[Developer Onboarding](https://partner.tiktokshop.com/docv2/page/developer-onboarding) | Partner credentials (`app_key`, `app_secret`, `service_id`) | App Category selection is irreversible and binds scope packages | Seller In-house app requires assigned Account Manager. ISV app requires legal business entity + DSPR. |
| **24** | Scopes | **APP REVIEW REQUIRED** | Login Kit: `user.info.basic`, `user.info.profile`, `user.info.stats`<br>Shop: `data.shop_analytics.public.read`, `creator.data.live.read.public`, `seller.order.info` | Scopes requested during OAuth authorization code flow | User/Seller/Creator consents to specific scopes | Login Kit `user.info.basic` is `AVAILABLE NOW` in sandbox; profile/stats and Shop scopes need approval. |
| **25** | App review requirements | **APP REVIEW REQUIRED** | TikTok Dev: Portal App Review (1-5 demo videos <=50MB, scope justification)<br>TTS: ISV Review + Data Security & Privacy Review (DSPR) | Developer submission via partner/developer console | Status progression: Draft -> In Review -> Live | Custom seller apps skip public app review but require KYC/KYB and Account Manager compliance check. |

---

## 3. Deep-Dive Specification Mining per Capability

### 3.1 LIVE Session List & History (#1)
- **Status:** `POST-LIVE ONLY`
- **Endpoint:** `GET /analytics/202609/shop_lives/performance` (backward-compatible: `202509`).
- **Base Domain:** `https://open-api.tiktokglobalshop.com`
- **Scope:** `data.shop_analytics.public.read` (Package: "TikTok Shop Analytics").
- **Authentication:** Header `x-tts-access-token` with Seller Token (`user_type = 0`). Mandatory query parameter `shop_cipher`.
- **Query Parameters:**
  - `start_date_ge` (int64, mandatory): Unix timestamp in seconds (start of date range).
  - `end_date_lt` (int64, mandatory): Unix timestamp in seconds (exclusive end).
  - `page_size` (int32, optional): 1–100, default 20.
  - `page_token` (string, optional): Pagination token returned by previous page.
  - `account_type` (string enum, optional): `OFFICIAL_ACCOUNTS`, `MARKETING_ACCOUNTS`, `AFFILIATE_ACCOUNTS`.
- **Response Structure:**
  ```json
  {
    "code": 0,
    "message": "success",
    "request_id": "20261007...",
    "data": {
      "live_list": [
        {
          "live_id": "7412345678901234567",
          "live_title": "Summer Campaign - Super Night Live",
          "start_time": 1727700000,
          "end_time": 1727707200,
          "duration": 7200,
          "account_type": "OFFICIAL_ACCOUNTS",
          "creator_name": "Shop Official",
          "gmv": { "amount": "15420000", "currency": "VND" },
          "views": 45200,
          "items_sold": 185
        }
      ],
      "next_page_token": "token_abc123",
      "total_count": 1
    }
  }
  ```
- **Constraints & Edge Cases:**
  - As stated in official documentation: *"Sellers can only query room ID data for their own official creator accounts and marketing accounts"*.
  - When invoked during an active, ongoing live stream, the API behavior is officially undefined/undocumented; only completed broadcasts are indexed in the historical reporting database.

### 3.2 Current & Recent Viewer Counts (#2)
- **Status:** `REALTIME` (Creator API only) / `UNSUPPORTED` (via Seller API)
- **Endpoint:** `GET /analytics/202502/live_rooms/{live_room_id}/core_stats`
- **Scope:** `creator.data.live.read.public` (Package: "Live Data", released 2026-07-02).
- **Authentication:** Header `x-tts-access-token` with **Creator Token (`user_type = 1`)**.
- **Crucial Requirement:** Must **NOT** include `shop_cipher` (passes `is_shop_chiper_exist = False`).
- **Response Schema:**
  ```json
  {
    "code": 0,
    "message": "success",
    "request_id": "20261007...",
    "data": {
      "current_visitor_count": 1420,
      "peak_concurrent_user_count": 2850,
      "accumulated_viewers": 18200,
      "is_live": true,
      "accumulated_comments": 430,
      "accumulated_likes": 12500,
      "accumulated_shares": 110
    }
  }
  ```
- **Error Behavior:** Calling this endpoint with a Seller token (`user_type = 0`) fails immediately with code `101000` (`Invalid user type: expected creator token`).

### 3.3 Comments (#3), Likes (#4), Follows (#5), Engagement (#6)
- **Status:** `UNSUPPORTED` (Real-Time Streams) / `POST-LIVE ONLY` (Aggregates)
- **Exhaustive Finding:**
  - An exhaustive check across all 956 pages in the TikTok Shop Partner Center API reference navigation tree and TikTok Developers Display/Login Kit documentation confirms: **No official endpoint or WebSocket exists to stream live chat message text, commenter usernames, or real-time like/gift events**.
  - Available aggregate data:
    1. Post-LIVE minute aggregate counts via `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`:
       - `interactions.comments` (integer count of comments within the 60-second window).
       - `interactions.likes` (integer count of likes within the minute).
       - `interactions.shares` (integer count of shares within the minute).
       - `interactions.new_followers` (integer count of new followers acquired).
    2. Creator trend curves via `GET /analytics/202502/live_rooms/{live_room_id}/interactive_trend_performances`.
    3. Profile totals via `GET https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count` (requires `user.info.stats`, `APP REVIEW REQUIRED`).
- **Operational Reality:** Any requirement to analyze live comment content (e.g. detecting audience questions or sentiment) cannot be automated via official APIs; it must be addressed via manual operator desk reporting.

### 3.4 Product Clicks (#7) & Product Impressions (#8)
- **Status:** `POST-LIVE ONLY`
- **Endpoints:**
  1. `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes` (Minute intervals)
  2. `GET /analytics/202512/shop/{live_id}/products_performance` (Per-product list)
- **Scope:** `data.shop_analytics.public.read` (Seller token, `shop_cipher` required).
- **Minute Interval Payload (`performance_per_minutes`):**
  ```json
  "traffic": {
    "views": 2500,
    "viewers": 1800,
    "impressions": 3200,
    "enter_room_rate": 0.125,
    "product_impressions": 1400,
    "product_clicks": 180,
    "ctr": 0.1286
  }
  ```
- **Product Breakdown Payload (`products_performance`):**
  ```json
  {
    "product_id": "1729485729104928172",
    "product_name": "Serum Trắng Da Vitamin C 30ml",
    "product_impressions": 4500,
    "produt_clicks": 620,
    "ctr": 0.1378,
    "sku_orders": 45,
    "gmv": { "amount": "4500000", "currency": "VND" }
  }
  ```
  *(Important Schema Note: The official TikTok Shop response verbatim spells `produt_clicks` without the 'c'; client adapters must handle this key).*

### 3.5 Orders (#9), GMV (#10), and Conversion (#11)
- **Status:** `PARTNER/SHOP ACCESS REQUIRED` (Orders) / `POST-LIVE ONLY` (Attributed GMV & Conversion)
- **Order APIs:**
  - `GET /order/202309/orders` and `GET /order/202309/orders/{order_id}` with scope `seller.order.info`.
  - Webhook topic: `ORDER_STATUS_CHANGE`.
  - In Vietnam, orders emitted via the general Order API are shop-level; direct attribution to an active LIVE session is only guaranteed post-hoc through the `shop_lives` analytics pipeline.
- **GMV & Conversion Reporting:**
  - `performance_per_minutes.sales.gmv`: Minute-level attributed GMV.
  - Per official TikTok announcement (2026-02-12): GMV and order counts are **attributed metrics**, and GMV is reported **including returns and refunds**.
  - `conversion.created_sku_orders`, `traffic.ctr` (product click-through rate = clicks / impressions), and CTOR (sku_orders / clicks) are published exclusively post-LIVE.

### 3.6 Stream Status (#14), Pinned Product State (#15), and Pin/Unpin (#16)
- **Status:** `NOT DOCUMENTED` (Status & State) / `UNSUPPORTED` (Control)
- **Findings:**
  - No webhooks exist for stream start or stream end.
  - Seller API provides no endpoint to check if a stream is live.
  - Creator API provides `core_stats.is_live: boolean`, but only via polling.
  - **Pinned Product State:** No official API returns which product is currently pinned in the live stream.
  - **Pin/Unpin Control:** The scope `creator.showcase.write` (`/showcases/202409/products/*`) controls the **Creator Profile Showcase** tab, not in-stream video product pinning. Pinning products during a broadcast must be executed manually by the host or moderator in the TikTok mobile app or LIVE Manager web console.

### 3.7 Promotions (#17) & Coupons (#18)
- **Status:** `PARTNER/SHOP ACCESS REQUIRED`
- **APIs:**
  - `POST /promotion/202309/activities`: Creates shop-level discount or flash sale activities (`FLASHSALE`).
  - `POST /promotion/202406/coupons/search`: Queries existing seller coupons.
- **Limitations:**
  - API does not support programmatic creation of new seller coupons.
  - Triggering an in-stream voucher card pin or flash sale specifically inside a LIVE room is not exposed via API.

### 3.8 LIVE Manager Data (#19)
- **Status:** `UNSUPPORTED`
- **Finding:**
  - TikTok Shop LIVE Manager (`seller-vn.tiktok.com/live/manager`) is a closed first-party browser application.
  - It provides no external REST, WebSocket, or GraphQL API for third-party tools.
  - Partner Center "Agency Access to Live Manager" is an allowlisted human UI portal access model, not a programmatic API.

### 3.9 Webhooks (#20) & Polling / Rate Limits (#21)
- **Status:** `PARTNER/SHOP ACCESS REQUIRED`
- **Supported Webhook Topics:** `ORDER_STATUS_CHANGE`, `PACKAGE_UPDATE`, `SELLER_DEAUTHORIZATION`, `UPCOMING_AUTHORIZATION_EXPIRATION`, `Shoppable Content Posting` (Topic 17).
- **Missing Topics:** No stream lifecycle, viewer counts, comments, or product pinning webhooks.
- **Dynamic QPS Allocation:**
  - Baseline rate limit for analytics endpoints: **0.2 to 1.0 requests per second**.
  - HTTP 429 or error code `36009002` triggers exponential backoff with jitter and respects `Retry-After`.
  - Sandbox cap: 100 or 1,000 requests per hour (code `36009037`).
  - Recommended LiveLift polling strategy: Poll once every 15 minutes post-LIVE up to 48 hours.

### 3.10 Authorization (#22), Partner App Models (#23), Scopes (#24), App Review (#25)
- **Status:** `PARTNER/SHOP ACCESS REQUIRED` / `APP REVIEW REQUIRED`
- **Two App Models in Partner Center:**
  1. **Custom App (Seller In-House):** Dedicated to the seller's own shop. Skips public app review, but requires verified KYC/KYB and an **assigned TikTok Shop Account Manager (AM)**.
  2. **ISV Public App:** Allows multi-tenant seller authorizations. Requires corporate entity registration, functional demo review, and mandatory Data Security & Privacy Review (DSPR).
- **Request Signing Protocol (HMAC-SHA256):**
  $$\text{Sign} = \text{HMAC-SHA256}_{app\_secret}\left(app\_secret + \text{path} + \sum_{k \in \text{sorted\_keys}} (k + v) + \text{raw\_body} + app\_secret\right)$$
  - Signature passed in query `sign=<hex>`; seller token passed in header `x-tts-access-token`.

---

## 4. Regional Limitations & Vietnam Market Architecture

### 4.1 Vietnam Regulatory Framework & Identity Verification
- **E-Commerce Law 2025 (Effective July 1, 2026):**
  - Requires all commercial livestream hosts and affiliate marketers to complete biometric KYC matching their 12-digit chip-based Citizen Identity Card (CCCD / Căn cước công dân) and national tax identification number (Mã số thuế).
  - Unverified accounts cannot activate TikTok Shop affiliate showcases or receive commercial affiliate payouts.
- **Shop vs. Creator Account Bifurcation:**
  - **Seller Account:** Requires CCCD, age >= 18, and local bank account matching the identity. Approvals typically clear within 1–2 business days.
  - **Creator Account:** Required for issuing Creator tokens (`user_type = 1`). To register as a commercial creator in Vietnam, an account must have **at least 1,000 followers** and complete identity binding.
- **Currency:**
  - Official currency is Vietnamese Đồng (`VND`).
  - In TikTok Shop APIs, VND is represented as integer amounts without minor fractional currency units (e.g. `"15420000"` for 15,420,000 ₫). LiveLift data models must handle VND integers without floating-point division distortion.

### 4.2 The Account Manager (AM) Bottleneck in Vietnam
- **Custom App Creation:** A Vietnamese TikTok Shop seller cannot independently create a Custom In-House App in Partner Center unless their shop is assigned an official **TikTok Shop Account Manager (AM)**.
- **AM Assignment:** Account Managers are assigned based on monthly GMV tiers or via business development outreach; there is no self-serve portal application.
- **ISV Alternative:** Creating an ISV App requires a registered Vietnamese business entity (Doanh nghiệp có mã số thuế doanh nghiệp) and undergoing the formal DSPR security review.

### 4.3 Excluded Developer APIs for Vietnam
- **Research API:** Vietnam is **strictly ineligible** (restricted to US, Canada, EU, EEA, UK, Switzerland, and Brazil safety research).
- **Commercial Content API:** Restricted to EU/EEA/UK/Switzerland under DSA compliance. Excludes Vietnam.
- **Data Portability API:** Restricted to EU/EEA/UK under GDPR mandates. Excludes Vietnam.

### 4.4 Development Shop (Sandbox) Limitations
- Developers in Partner Center can generate up to 10 Vietnamese test seller accounts (valid 180 days).
- **Critical Limitation:** Development shops **cannot broadcast real LIVE streams** and **generate no live analytics**. They are restricted to verifying request signing, OAuth flows, and error handling.

---

## 5. Current Account Testability Assessment

Based on the verified credentials, tokens, and active runtime environment of this workspace:

| Current Account Capability | Direct Usability | Concrete Testing Boundary in LiveLift |
|---|---|---|
| **1. Real TikTok Mobile LIVE Access** | **MANUAL ONLY** | Host can initiate broadcast on TikTok mobile app. LiveLift **cannot** ingest viewer counts or stream status via official APIs. |
| **2. TikTok Shop LIVE Manager (Linux Browser)** | **MANUAL ONLY** | Operator can open `seller-vn.tiktok.com/live/manager` in Chrome to monitor real-time GMV, pin products, and manage giveaways. Telemetry **cannot** be piped to LiveLift via API. |
| **3. Real TikTok Login Kit Sandbox Connection** | **FULLY FUNCTIONAL** | LiveLift `/api/v3/integrations/tiktok/*` connects to Login Kit sandbox, exchanges authorization codes, encrypts tokens with AES-256-GCM in SQLite, and handles token refresh. |
| **4. `user.info.basic` Working** | **AVAILABLE NOW** | Ingests `open_id`, `display_name`, and `avatar_url`. Proves **provider-observed identity only**; does **not** establish LIVE eligibility or Shop access. |

---

## 6. LiveLift Provider Abstraction Architecture

LiveLift avoids monolithic platform checks (`if (platform === 'tiktok')`) by introducing a capability-negotiated provider abstraction layer across three primary domain providers and an epistemic evidence envelope.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 LiveLift Core Application                             │
│                     (Session Pacing, Rundown Engine, Recovery Loop)                     │
└───────────────▲───────────────────────────▲───────────────────────────▲────────────────┘
                │                           │                           │
                │ ProviderEvidence<T>       │ ProviderEvidence<T>       │ ProviderEvidence<T>
                │                           │                           │
┌───────────────┴───────────────┐ ┌─────────┴─────────────┐ ┌───────────┴────────────────┐
│      TikTokShopProvider       │ │  LiveMetricsProvider  │ │ ProductPerformanceProvider │
├───────────────────────────────┤ ├───────────────────────┤ ├────────────────────────────┤
│ • getAuthorizedShops()        │ │ • getRoomCoreStats()  │ │ • getProductPerformance()  │
│ • searchProducts()            │ │ • getViewTrends()     │ │ • reconcileWithPlanned-    │
│ • getCapabilities()           │ │ • getShopLiveMinute-  │ │   Segments()               │
│ • getHealth()                 │ │   Performance()       │ │                            │
└───────────────────────────────┘ └───────────────────────┘ └────────────────────────────┘
```

### 6.1 Complete TypeScript Interface Contracts

```typescript
// ============================================================================
// File: next/src/contracts/provider.ts (Design Contract)
// ============================================================================

export type ProviderId = "tiktok_shop" | "tiktok_open_api" | "manual" | "simulator";

export type CapabilityKey =
  | "catalog_read"              // Search and import shop products
  | "catalog_write"             // Update inventory / prices
  | "live_room_metrics"         // Room viewer trends & core stats (Creator API)
  | "live_minute_performance"   // Post-live minute performance (Seller API)
  | "product_performance"       // Post-live per-product metrics (Seller API)
  | "order_status_stream"       // Webhook-based order lifecycle updates
  | "platform_pin_control"      // Programmatic product pinning (UNSUPPORTED)
  | "live_chat_stream";         // Realtime comment text stream (UNSUPPORTED)

export type CapabilityState =
  | "available"                 // Fully operational and healthy
  | "degraded"                  // High latency or approaching rate limit
  | "stale"                     // Exceeded TTL; cached/historical only
  | "unavailable"               // Temporary network, timeout, or gateway error
  | "unsupported"               // Documented as unsupported by platform design
  | "requires_authorization";   // Needs OAuth / Partner Center approval

export interface CapabilityStatus {
  readonly capability: CapabilityKey;
  readonly state: CapabilityState;
  readonly lastFreshAtMs: number | null;
  readonly validityTtlMs: number | null;
  readonly reason: string | null;
}

export type ProviderHealthState = "healthy" | "degraded" | "unavailable" | "expired";

export interface ProviderHealth {
  readonly providerId: ProviderId;
  readonly state: ProviderHealthState;
  readonly lastCheckedAtMs: number;
  readonly message: string | null;
}

// ============================================================================
// ProviderEvidence Envelope
// ============================================================================

export type EvidenceTier =
  | "operator_reported"         // Manually declared by human desk operator
  | "provider_observed"         // Returned by authorized third-party API
  | "platform_confirmed";       // Cryptographically or stream-verified (None in TikTok)

export interface ProvenanceMetadata {
  readonly provider: ProviderId;
  readonly endpoint: string;
  readonly requestId?: string;
  readonly logId?: string;
  readonly accountOrShopCipher: string;
  readonly observedAtMs: number;         // When platform emitted or timestamped data
  readonly fetchedAtMs: number;          // When LiveLift ingested the response
  readonly effectiveInterval?: {
    readonly startMs: number;
    readonly endMs: number;
  };
}

export interface ProviderEvidence<T> {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly environment: "REAL" | "SIMULATED";
  readonly tier: EvidenceTier;
  readonly confidence: number;           // 0.0 to 1.0 (1.0 for validated API response; 0.0 for gap)
  readonly provenance: ProvenanceMetadata;
  readonly data: T | null;               // Nullable: missing != zero
  readonly conflictFlag: boolean;
  readonly supersedesId: string | null;
}

export type ProviderResult<T> =
  | { readonly ok: true; readonly evidence: ProviderEvidence<T> }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly retryable: boolean;
        readonly reason: CapabilityState;
      };
    };

// ============================================================================
// 1. TikTokShopProvider Interface
// ============================================================================

export interface AuthorizedShopInfo {
  readonly shopId: string;
  readonly shopName: string;
  readonly region: string;               // e.g. "VN"
  readonly sellerType: "cross_border" | "local";
  readonly authorizedAtMs: number;
}

export interface ProductCatalogQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly keyword?: string;
  readonly status?: "active" | "all";
}

export interface ShopProductSnapshot {
  readonly platformProductId: string;
  readonly sku: string;
  readonly title: string;
  readonly price: number;
  readonly currency: string;
  readonly stockCount: number | null;    // null if unrecorded; missing != zero
  readonly imageUrl: string | null;
}

export interface TikTokShopProvider {
  readonly providerId: "tiktok_shop";
  
  getHealth(): Promise<ProviderHealth>;
  getCapabilities(): Promise<Record<CapabilityKey, CapabilityStatus>>;
  getAuthorizedShops(): Promise<ProviderResult<AuthorizedShopInfo[]>>;
  searchProducts(query: ProductCatalogQuery): Promise<ProviderResult<ShopProductSnapshot[]>>;
}

// ============================================================================
// 2. LiveMetricsProvider Interface
// ============================================================================

export interface RoomCoreStats {
  readonly roomId: string;
  readonly isLive: boolean;
  readonly currentVisitorCount: number | null;
  readonly peakConcurrentUserCount: number | null;
  readonly accumulatedViewers: number | null;
  readonly accumulatedLikes: number | null;
  readonly accumulatedComments: number | null;
  readonly accumulatedShares: number | null;
}

export interface ViewTrendPoint {
  readonly timestampMs: number;
  readonly onlineUsers: number | null;
  readonly enterCount: number | null;
  readonly leaveCount: number | null;
}

export interface MinuteMetricInterval {
  readonly minuteTimestampMs: number;
  readonly views: number | null;
  readonly viewers: number | null;
  readonly productImpressions: number | null;
  readonly productClicks: number | null;
  readonly ctr: number | null;
  readonly skuOrders: number | null;
  readonly gmv: number | null;
  readonly currency: string;
  readonly commentsCount: number | null;
  readonly likesCount: number | null;
  readonly sharesCount: number | null;
  readonly newFollowersCount: number | null;
}

export interface LiveMetricsProvider {
  readonly providerId: "tiktok_open_api" | "tiktok_shop";
  
  getCapabilities(): Promise<Record<CapabilityKey, CapabilityStatus>>;
  
  // Realtime/Near-realtime Room Telemetry (Creator Token required)
  getRoomCoreStats(roomId: string): Promise<ProviderResult<RoomCoreStats | null>>;
  getViewTrends(roomId: string): Promise<ProviderResult<ViewTrendPoint[]>>;
  
  // Post-LIVE Seller Minute Analytics (Seller Token required)
  getShopLiveMinutePerformance(
    liveSessionId: string
  ): Promise<ProviderResult<MinuteMetricInterval[]>>;
}

// ============================================================================
// 3. ProductPerformanceProvider Interface
// ============================================================================

export interface ProductPerformanceMetrics {
  readonly productId: string;
  readonly productName: string;
  readonly productImpressions: number | null; // null if unrecorded; missing != zero
  readonly productClicks: number | null;      // Maps official 'produt_clicks' typo
  readonly ctr: number | null;
  readonly skuOrders: number | null;
  readonly gmv: number | null;
  readonly currency: string;
}

export interface ProductPerformanceProvider {
  readonly providerId: "tiktok_shop";
  
  getCapabilities(): Promise<Record<CapabilityKey, CapabilityStatus>>;
  
  // Post-LIVE Product Performance List
  getProductPerformance(
    liveSessionId: string
  ): Promise<ProviderResult<ProductPerformanceMetrics[]>>;
}
```

---

## 7. Rigorous Enforcement of the 5 Semantic Domain Invariants

In accordance with LiveLift's domain modeling principles and the `domain-modeling` skill, five semantic invariants must be strictly preserved across all data models, evidence envelopes, and Copilot contexts:

| Invariant | Core Semantic Principle | TypeScript Structural Encoding | Copilot Context & Output Schema |
|---|---|---|---|
| **1. Operator Reported != Provider Observed** | Human statements are unverified assertions; provider data is external API telemetry. | `CueRun.state` ("performed") vs `ProviderEvidence.tier` ("provider_observed"). | Facts tagged `operator_reported` vs `provider_observed`. Copilot cannot cite an operator report as platform proof. |
| **2. Provider Observed != Platform Confirmed** | HTTP 200 receipts or polled stats do not prove the broadcast stream displayed the action. | `EvidenceTier = "provider_observed" \| "platform_confirmed"`. `AiPlatformEvidence` locked to `"not_established"`. | Schema rejects claims like *"Platform confirmed product pin"*. Output validator rejects answers asserting platform verification. |
| **3. Missing != Zero** | Absence of measurement is never numerical zero. Coercing null to 0 corrupts analytics and reasoning. | `value: number \| null` (never optional `value?: number` defaulting to 0). | `AiFactKind = "gap"`. Copilot prompt & validator rejects claiming "0 viewers" or "0 clicks" when data is `null`. |
| **4. Unknown != Failed** | Unreported cues or interrupted telemetry are unknown states, not execution failures. | `CueRun.state = "no_report"`. Integration state = `"unavailable"` (with reason). | Copilot Review outputs unreported cues under `gaps` ("unknown, not failed"), not `deviations` or failures. |
| **5. Observation != Causation** | Co-occurrence of timing with metric changes is correlation, not proof of cause. | Metrics store timestamps independently of segments. No `causedBySegmentId` field exists. | Output validator rejects causal phrases (*"caused"*, *"resulted in"*, *"drove sales"*). Restricted to observational language. |

### 7.1 Invariant 1: Operator Reported != Provider Observed
- **Rationale:** If an assistant operator clicks *"Pinned Dress M01 at 20:14"*, this is an `operator_reported` assertion. It must never be upgraded to `provider_observed` data from an official API. If the operator misclicked or TikTok LIVE Studio dropped the action, the records must reflect the divergence.
- **Enforcement:**
  - Operator reports carry `occurredAtMs` and `reportedAtMs`.
  - API telemetry carries `provenance.endpoint`, `requestId`, and `fetchedAtMs`.
  - Facts in AI context carry explicit disjoint kinds:
    ```typescript
    export type AiFactKind =
      | "recorded"          // LiveLift schedule arithmetic
      | "computed"          // Schedule derivations
      | "operator_reported" // Human desk assertions (confidence = 0.70)
      | "provider_observed" // External API telemetry (confidence = 0.95)
      | "gap"               // Explicit missing data disclosure
      | "simulated";        // Synthetic rehearsal data
    ```

### 7.2 Invariant 2: Provider Observed != Platform Confirmed
- **Rationale:** A successful API call (`HTTP 200 OK`) confirms transport delivery to TikTok's gateway; it does not confirm that video stream frames displayed the product card to viewers. Furthermore, TikTok has **no public API** to verify in-stream pin states.
- **Enforcement:**
  - `AiPlatformEvidence` in `next/src/contracts/ai.ts` is permanently locked:
    ```typescript
    export interface AiPlatformEvidence {
      readonly live: "not_established";
      readonly shop: "not_established";
      readonly analytics: "not_established";
      readonly nativeActions: "not_established";
    }
    ```
  - The output validator (`next/src/lib/ai/output.ts`) enforces an absolute regex rejection on platform confirmation claims:
    ```typescript
    const PLATFORM_CONFIRMATION_REGEX = /(platform confirmed|verified on stream|tiktok confirmed pin|broadcast verified)/i;
    // Violations fail validation with reason: "unsupported_claim".
    ```

### 7.3 Invariant 3: Missing != Zero
- **Rationale:** If TikTok Shop API does not return product impressions during an interval due to rate limiting or batch delay, treating `impressions = 0` produces division-by-zero or artificial 0% CTR, triggering false alarm recoveries.
- **Enforcement:**
  - All numeric metric fields are strictly typed `number | null`.
  - Missing values are emitted as `gap` facts:
    ```typescript
    {
      id: "f4",
      topic: "product_clicks",
      kind: "gap",
      text: "Product click data was not reported for this interval (missing, not zero)."
    }
    ```
  - UI renders em-dash (`—`) with an *Unavailable* tooltip, never `0` or `0.00%`.

### 7.4 Invariant 4: Unknown != Failed
- **Rationale:** An unreported cue is not a failed cue; it simply means the operator did not submit a report. An interrupted API call is an unavailable connection, not a revoked or expired token.
- **Enforcement:**
  - `CueRun.state` supports `"no_report"` alongside `"performed"` and `"cancelled"`.
  - Review Copilot schema strictly separates verified deviations from gaps:
    ```typescript
    export const ReviewModelOutputSchema = z.object({
      summary: z.object({ text: z.string(), cites: z.array(z.string()) }),
      deviations: z.array(z.object({ text: z.string(), cites: z.array(z.string()) })).max(5), // Verified variances
      gaps: z.array(z.object({ text: z.string(), cites: z.array(z.string()) })).max(5),       // Unknown / unreported items
      evidenceLimits: z.array(z.object({ text: z.string(), cites: z.array(z.string()) })).max(4)
    });
    ```

### 7.5 Invariant 5: Observation != Causation
- **Rationale:** If GMV increases by 15,000,000 ₫ during Segment 3 (Flash Sale), automated systems often claim "Segment 3 caused 15,000,000 ₫ in GMV". In reality, the surge could be driven by FYP algorithm recommendation spikes, influencer shares, or checkout backlogs from Segment 1.
- **Enforcement:**
  - LiveLift models segment-metric overlaps as **Temporal Co-Occurrence**, never direct causation:
    ```typescript
    export interface TemporalCoOccurrence {
      readonly segmentId: string;
      readonly metricIntervalStartMs: number;
      readonly metricIntervalEndMs: number;
      readonly observedMetricValue: number | null;
      readonly relationship: "co_occurred_temporally"; // NEVER "caused_by"
    }
    ```
  - Output validator regex rejects causal claims:
    ```typescript
    const CAUSAL_CLAIM_REGEX = /\b(caused|led to|drove the (sales|views|drop)|responsible for|resulted in)\b/i;
    // Violations fail validation with reason: "unsupported_claim".
    ```

---

## 8. Operational & Intelligence Flow Integration

LiveLift connects live analytics and operator intelligence through a closed-loop operational cycle:

```
[PLAN]
  │
  ▼
[OPERATE: NOW / NEXT / WHY / ACTION] ◄───┐
  │                                      │
  ▼                                      │ Real-time feedback
[ANALYTICS ENGINE: Facts Derivation]    │ (Timing & Pacing)
  │                                      │
  ▼                                      │
[AI COPILOT: Advisory Evaluation] ───────┘ (Advisory recommendations)
  │
  ▼ (Show Ends)
[REVIEW: Dual-Perspective Replay] ◄─── [POST-LIVE API INGESTION]
  │                                    (TikTok Shop Minute/Product Data)
  ▼
[NEXT LIVE: Iterative Plan Optimization]
  │
  └───► Generates Plan for Next Show
```

### 8.1 Cycle Stages
1. **Analytics Engine (Deterministic Derivation):**
   - Pure schedule arithmetic: elapsed duration, pacing variance against baseline ($\pm 15\text{s}$), hard anchor countdowns, and cue coverage.
   - Converts observations into structured, numbered facts (`AiFact[]`, e.g. `f1`, `f2`) with explicit kinds.
   - Zero mutation: never edits history or alters plan baselines.
2. **AI Copilot (Advisory Projection):**
   - Operates as a pure advisor with **zero autonomous execution authority**.
   - Evaluates server-constructed `OperateAiContext` or `ReviewAiContext`.
   - Recommends only candidate option aliases pre-computed by LiveLift's recovery engine (`opt1`, `opt2`).
   - Cites exact fact IDs; rejects hallucinations or causal assertions.
3. **NOW / NEXT / WHY / ACTION Desk Interface:**
   - **NOW:** Active segment title, elapsed duration, planned target, overrun amount, host time remaining controls.
   - **NEXT:** Upcoming segment, projected start time (`≈` or `>=`), schedule drift.
   - **WHY:** Mathematical diagnosis and Copilot interpretation citing observed facts.
   - **ACTION:** Up to two recovery options marked `Recommended · not applied`. The operator must explicitly click `Apply option` to trigger a signed runtime command.
4. **Review Workspace (Dual-Perspective Replay):**
   - **"As Known Then" Replay:** Audits operator decision quality using only data committed prior to virtual time $T$, preventing hindsight bias.
   - **"With Later Evidence" Replay:** Ingests post-LIVE TikTok Shop minute and product metrics (`performance_per_minutes`, `products_performance`), rendering divergence markers where platform data contradicts operator reports.
5. **Next LIVE Plan Generation:**
   - Evaluates multi-session performance patterns across up to three prior broadcasts.
   - Generates concrete rundown optimization proposals (`chg1: Extend Segment 3 baseline by 2m`, `chg2: Deprioritize SKU 104`).
   - Operator selects proposals to construct `plans[0]` for the subsequent broadcast.

---

## 9. Explicit Evaluation of the 4 Operational Scenarios

Every operational scenario is evaluated against official platform data availability:

| Operational Scenario | Data Requirements | Official Platform Feasibility | LiveLift Operational Flow Pattern |
|---|---|---|---|
| **1. Viewers rising but clicks flat** | Realtime viewer counts/trends + Realtime product clicks/CTR | **POST-LIVE ONLY / UNSUPPORTED IN REALTIME**<br>Product click streams are strictly post-LIVE (`/products_performance`). Realtime in-room click telemetry does not exist in official APIs. | **Desk-Assisted Mode:** Assistant observes LIVE Manager browser console and taps quick cue *"Clicks flat despite high views"*. LiveLift Copilot suggests *"Highlight product voucher or pin reminder"*. Post-LIVE audit verifies CTR drop. |
| **2. Clicks rising while segment overruns** | Authoritative segment pacing/overrun + Realtime click/order velocity | **PARTIAL**<br>Timing overrun is authoritative in LiveLift. Order stream is supported via Webhook (`ORDER_STATUS_CHANGE`). Realtime minute product click stream is post-LIVE only. | **Trade-Off Decision Loop:** LiveLift flags overrun (+3m) and offers recovery: *"Extend active segment, drop optional Segment 5"*. Operator accepts trade-off. Post-LIVE minute audit confirms whether sales velocity justified the schedule sacrifice. |
| **3. Product performance changing** | Historical baseline + Per-product live impressions, clicks, orders, GMV | **FEASIBLE FOR REVIEW & NEXT LIVE**<br>Official post-LIVE product performance is available via `GET /analytics/202512/shop/{live_id}/products_performance`. Live intra-session streaming is unsupported. | **Next LIVE Refinement:** Ingested post-LIVE product metrics feed Review. Products with higher conversion receive suggested baseline increases (`chg: +2m airtime`); underperformers are deprioritized in next show. |
| **4. Comments asking price** | Realtime live comment text stream + Vietnamese NLP intent classification | **COMPLETELY UNSUPPORTED**<br>TikTok provides zero official Open APIs or webhooks for live room chat comments. | **Operator Quick-Report Cue:** Assistant taps *"Audience asking price"* button in LiveLift desk. Pacing engine cues host: *"State price of active product"*. Zero reliance on fragile, illegal reverse-engineered scrapers. |

---

## 10. Conclusion & Architectural Recommendations

1. **Reject Reverse-Engineered Webcast Scrapers:** The isolated prototype in `collectors/tiktok_public` (based on `TikTokLive`) violates platform terms, relies on brittle protobuf decoding, and risks IP bans. It must remain strictly isolated as a dataset collector and never be introduced into LiveLift's runtime.
2. **Prioritize the Post-LIVE Attribution Reconciler:** The highest-value, 100% officially supported feature is reconciling LiveLift's planned rundowns and shortlink clicks against TikTok Shop's post-LIVE `performance_per_minutes` and `products_performance` data.
3. **Preserve Operational Independence:** LiveLift's live desk must remain 100% operational in standalone mode (`ManualDeskAdapter`), ensuring that third-party API downtime, rate limits, or authorization lapses never disrupt a live commercial broadcast.
