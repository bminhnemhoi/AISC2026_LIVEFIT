# TikTok LIVE Intelligence Implementation Roadmap (Phase V7)

**Document Version:** 1.0 (Phase V7 TikTok LIVE Intelligence R&D)  
**Author:** LiveLift R&D Team  
**Date:** 2026-10-07  
**Target Branch:** `orca/v7-tiktok-live-intelligence-rd`  
**Classification Integrity Mode:** Development / Empirical Specification Mining  
**Audience:** Technical Leadership, Integration Engineers, Product Operations  

---

## 1. Executive Summary & Strategy

LiveLift Phase V7 transitions from an offline-first pacing desk into an integrated **TikTok LIVE Intelligence system**. Based on the authoritative findings in `docs/tiktok/LIVE-INTELLIGENCE-RD.md`, TikTok's official Open Platforms bifurcate sharply between real-time and post-LIVE capabilities:

1. **Post-LIVE Data is Rich and Officially Supported:** The TikTok Shop Partner Center provides 1-minute interval performance metrics (`performance_per_minutes`) and per-product conversion metrics (`products_performance`) for completed LIVE sessions.
2. **Real-Time Data is Heavily Restricted or Unsupported:** Real-time room stats require restricted Creator tokens; real-time in-stream product clicks are not emitted; and real-time live comment text streams do **not exist** in any official API.
3. **Core Architectural Strategy:** LiveLift adopts a **Post-LIVE Attribution Reconciler** as its primary integration vector, combined with **Operator Desk Cues** for un-instrumented live stream events, preserving domain invariants and system stability without relying on fragile, illegal scrapers.

---

## 2. Phased Implementation Milestones

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Phase V7 Implementation Roadmap                           │
└────────────────────────────────────────────────────────────────────────────────────────┘

    V7.0: Post-LIVE Attribution Reconciler (HIGHEST VALUE - IMMEDIATE)
    ├── Ingest Shop LIVE Minute Performance (`/performance_per_minutes`)
    ├── Ingest Shop LIVE Products Performance (`/products_performance`)
    ├── Reconcile platform GMV/clicks against LiveLift planned rundown segments
    └── Dual-Perspective Review Replay ("As Known Then" vs "With Later Evidence")
         │
         ▼
    V7.1: Partner Center Integration & Catalog Sync
    ├── Implement `TikTokShopProvider` interface
    ├── Support HMAC-SHA256 request signing & OAuth `authorized_code` flow
    ├── Shop binding via `shop_cipher` and `/authorization/202309/shops`
    └── Sync product catalog (`POST /product/202502/products/search`)
         │
         ▼
    V7.2: Live Room Telemetry & Creator Data
    ├── Implement `LiveMetricsProvider` for Creator tokens (`user_type = 1`)
    ├── Ingest near-realtime room aggregate stats (`/live_rooms/{id}/core_stats`)
    └── Polling viewer curves (`/live_rooms/{id}/view_trend_performances`)
         │
         ▼
    V7.3: Realtime Order Webhook Stream
    ├── Implement webhook endpoint for topic `ORDER_STATUS_CHANGE`
    ├── Verify HMAC webhook signatures
    └── Compute in-stream order velocity and sales pacing in LiveLift desk
         │
         ▼
    V7.4: Operational Intelligence & Next LIVE Synthesis
    ├── Cross-session correlation across ended broadcasts
    ├── Multi-session bottleneck detection and rundown adjustment proposals
    └── AI Copilot integration with structured fact grounding and anti-causality rules
```

---

### Milestone V7.0: Post-LIVE Attribution Reconciler (Immediate Implementation)
- **Goal:** Ingest official post-LIVE performance metrics and correlate them with LiveLift's planned rundowns, actual segment durations, and shortlink clicks.
- **Scope & Deliverables:**
  - Ingest `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`:
    - 1-minute interval series of views, viewers, product impressions, product clicks, GMV, orders, comments, likes, shares.
  - Ingest `GET /analytics/202512/shop/{live_id}/products_performance`:
    - Per-product impressions, clicks (`produt_clicks`), orders, GMV, CTR.
  - Attribution Reconciler Algorithm:
    - Maps 1-minute platform intervals onto LiveLift `SegmentRun` intervals $[t_{\text{start}}, t_{\text{end}})$.
    - Computes interval GMV yield per minute of segment airtime.
    - Flags temporal co-occurrences without asserting direct causation (Invariant 5).
  - Review Workspace Dual-Perspective Replay:
    - "As Known Then": desk view as seen during the broadcast.
    - "With Later Evidence": overlays platform metrics with latency tags and divergence markers.
- **Dependencies:** TikTok Shop Seller token (`user_type = 0`), `shop_cipher`, scope `data.shop_analytics.public.read`.
- **Testing Strategy:** Fixture-based replay tests using verified official response samples (`tests/data/tiktok_shop/`).

---

### Milestone V7.1: Partner Center Integration & Catalog Sync
- **Goal:** Establish production connectivity to the TikTok Shop Open Platform, enabling automated product catalog imports and token management.
- **Scope & Deliverables:**
  - Production `TikTokShopProvider` implementing `CatalogProvider`.
  - Full cryptographic signing engine: HMAC-SHA256 over sorted parameters and raw body bytes.
  - Seller OAuth flow:
    - Authorize URL: `https://services.tiktokshop.com/open/authorize?service_id={service_id}`.
    - Token exchange: `https://auth.tiktok-shops.com/api/v2/token/get?grant_type=authorized_code`.
    - Token storage: AES-256-GCM encrypted in isolated `provider-credentials.sqlite`.
    - Shop resolution: Call `GET /authorization/202309/shops` to extract `shop_cipher`.
  - Product Catalog Sync:
    - Query `POST /product/202502/products/search` with scope `seller.product.basic`.
    - Map products to LiveLift `ShopProductSnapshot`, keeping CSV/TSV manual import as fallback.
- **Dependencies:** Partner Center Custom App or ISV App credentials.

---

### Milestone V7.2: Live Room Telemetry & Creator Data
- **Goal:** Provide near-realtime audience concurrency telemetry for creator-authorized broadcasts.
- **Scope & Deliverables:**
  - Implement Creator OAuth authorization flow (`user_type = 1`).
  - Implement `LiveMetricsProvider`:
    - `getRoomCoreStats(liveRoomId)`: Polls `GET /analytics/202502/live_rooms/{id}/core_stats`.
    - Ingests `current_visitor_count`, `peak_concurrent_user_count`, `is_live`.
    - Ingests `view_trend_performances` for audience join/leave curves.
  - Rate limiting & polling throttle: Poll every 10–30 seconds, well within dynamic QPS quota.
  - Fallback logic: If Creator token is absent or room metrics return `unavailable`, desk gracefully defaults to manual viewer entry without blocking operations.
- **Dependencies:** Creator token (`user_type = 1`), verified TikTok Shop Creator account (>=1,000 followers in Vietnam), package "Live Data" (scope `creator.data.live.read.public`).

---

### Milestone V7.3: Realtime Order Webhook Stream
- **Goal:** Track in-stream transaction velocity and gross order volume during active broadcasts.
- **Scope & Deliverables:**
  - Secure webhook endpoint: `/api/v3/integrations/tiktok/webhook`.
  - HMAC signature verification over incoming webhook payloads using partner app secret.
  - Ingestion of topic `ORDER_STATUS_CHANGE`:
    - Tracks order creations, payments, and cancellations in real-time.
  - LiveLift desk sales pacing indicator:
    - Computes orders-per-minute velocity.
    - Flags surges to inform operator overrun trade-off decisions.
- **Dependencies:** Public HTTPS callback URL, registered webhook topic in Partner Center.

---

### Milestone V7.4: Operational Intelligence & Next LIVE Synthesis
- **Goal:** Close the operational loop by combining platform attribution with multi-session AI analytics.
- **Scope & Deliverables:**
  - Cross-session intelligence engine analyzing up to three prior broadcasts.
  - Identifies repeated pacing bottlenecks, segment overruns, and high-yield product presentations.
  - Review Copilot integration:
    - Generates grounded, multi-session insights citing explicit fact IDs.
    - Formulates structured Next LIVE rundown proposals (`chg1`, `chg2`).
    - Enforces zero-causality and anti-hallucination validation rules.
- **Dependencies:** Operational post-LIVE attribution data from V7.0 and V7.1.

---

## 3. Comprehensive Risk Register

| Risk ID | Risk Category | Description & Impact | Platform Constraint / Cause | Mitigation & Fallback Strategy |
|---|---|---|---|---|
| **RSK-01** | Platform API Changes | Breaking changes or schema version deprecations by TikTok Shop (e.g. `202510` vs `202609`). | Fast API iteration cycle on TikTok Shop Open Platform. | Dynamic capability negotiation; contract isolation layer; pinning tested API version strings in provider adapters. |
| **RSK-02** | Rate Limiting & QPS Throttling | Gateway returns HTTP 429 or code `36009002` (`request traffic exceed limit`). | Dynamic QPS allocation restricts analytics calls to 0.2–1.0 req/s. Sandbox capped at 100–1000 req/hr. | Implement client-side token bucket throttler (max 0.2 req/s); exponential backoff with random jitter; honor `Retry-After`. |
| **RSK-03** | Data Settlement Latency | Post-LIVE minute metrics are not finalized immediately upon broadcast end; metrics settle over 24–48 hours. | Batch aggregation pipelines and attribution windows in TikTok data lake. | Schedule asynchronous post-LIVE polling cadence: every 15 min for 2 hours, then hourly up to 48 hours. Version ingested snapshots. |
| **RSK-04** | Account Manager (AM) Bottleneck (Vietnam) | Custom In-House App cannot be created without an assigned TikTok Shop Account Manager. | TikTok Shop Vietnam policy requires AM assignment for seller custom apps. | Use Development Shops (Sandboxes) for protocol verification; pursue ISV Public App corporate registration; maintain manual desk fallback. |
| **RSK-05** | Regional Regulatory Constraints (Vietnam) | E-Commerce Law 2025 mandates biometric KYC with chip-based Citizen Identity Card (CCCD) and tax ID for livestreamers. | Strict regulatory compliance in Vietnam market (effective July 1, 2026). | Operator checklist in documentation; clearly delineate platform identity requirements from LiveLift desk operations. |
| **RSK-06** | Data Security & Privacy Review (DSPR) | Partner Center ISV apps must pass formal security audits before accessing production scopes. | TikTok Developer Terms Section 2.7(g) strictly forbids third-party aggregation of end-user data. | Strict tenant isolation in SQLite credentials store; zero cross-tenant data aggregation; complete token erasure on disconnect. |

---

## 4. Required Summary Fields

### 4.1 Official APIs Discovered
- **TikTok for Developers (`developers.tiktok.com`):**
  - Login Kit: `POST /v2/oauth/token/` (exchange & refresh), `POST /v2/oauth/revoke/` (token revocation).
  - User Info: `GET /v2/user/info/?fields=open_id,union_id,avatar_url,display_name` (scope `user.info.basic`).
  - User Profile & Stats: `bio_description`, `follower_count`, `likes_count` (scopes `user.info.profile`, `user.info.stats`).
- **TikTok Shop Partner Center (`partner.tiktokshop.com`):**
  - Shop LIVE Performance List: `GET /analytics/202609/shop_lives/performance` (scope `data.shop_analytics.public.read`).
  - Shop LIVE Minute Performance: `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes` (1-min intervals).
  - Shop LIVE Products Performance: `GET /analytics/202512/shop/{live_id}/products_performance` (product breakdown).
  - Shop LIVE Daily Overview: `GET /analytics/202609/shop_lives/overview_performance?today=true`.
  - Live Room Core Stats: `GET /analytics/202502/live_rooms/{live_room_id}/core_stats` (scope `creator.data.live.read.public`).
  - Live Room Trends & Portraits: `view_trend_performances`, `interactive_trend_performances`, `gmv_trend_performances`, `user_portraits`.
  - Catalog: `POST /product/202502/products/search` (scope `seller.product.basic`).
  - Orders: `GET /order/202309/orders`, `GET /order/202309/orders/{order_id}` (scope `seller.order.info`).
  - Promotions: `POST /promotion/202309/activities` (flash sales), `POST /promotion/202406/coupons/search` (coupon search).
  - Webhooks: `ORDER_STATUS_CHANGE`, `PACKAGE_UPDATE`, `SELLER_DEAUTHORIZATION`, `Shoppable Content Posting`.

### 4.2 Realtime vs. Post-LIVE Data
- **Realtime Available:**
  - Creator Live Room Core Stats (`current_visitor_count`, `peak_concurrent_user_count`, `is_live`) via polling (Creator token only).
  - Creator View Trends (`onlineUsers`, `enterCount`, `leaveCount`) via polling.
  - Shop Order status updates via Webhook (`ORDER_STATUS_CHANGE`).
  - Today's cumulative shop-wide GMV (`overview_performance?today=true`).
- **Post-LIVE Only:**
  - Shop LIVE session historical list (`shop_lives/performance`).
  - Minute-by-minute interval telemetry (`performance_per_minutes`): views, viewers, product impressions, product clicks, interval GMV, interval orders, comment count, like count, share count.
  - Per-product performance breakdown (`products_performance`): impressions, clicks (`produt_clicks`), CTR, SKU orders, GMV.
  - Attributed session-level conversion rates and revenue metrics.

### 4.3 Data Unavailable Officially
- In-stream live comment bodies (chat message text and commenter IDs).
- Real-time like, gift, or follow event streams.
- Programmatic reading or verification of currently pinned product state in the video stream.
- Programmatic pin / unpin controls in an active live broadcast.
- Programmatic trigger of in-room voucher cards or giveaway winner selection.
- Programmatic extraction of telemetry from TikTok Shop LIVE Manager browser console.
- Stream start and stream end lifecycle webhooks.

### 4.4 Exact Access Requirements
- **Seller Analytics Access:**
  - Registered account in TikTok Shop Partner Center (`partner.tiktokshop.com`).
  - Custom App (requires assigned Account Manager) or ISV App (requires corporate registration + DSPR).
  - Seller OAuth 2.0 authorization code flow (`user_type = 0`).
  - Retrieval of `shop_cipher` via `GET /authorization/202309/shops`.
  - Mandatory HMAC-SHA256 request signing.
  - Scope: `data.shop_analytics.public.read`.
- **Creator Room Telemetry Access:**
  - Host account must be an approved TikTok Shop Creator (in Vietnam: verified CCCD + >=1,000 followers).
  - Creator OAuth 2.0 authorization code flow (`user_type = 1`).
  - Restricted scope package "Live Data" (scope `creator.data.live.read.public`).

### 4.5 What Can Be Tested with Current Account
- **TikTok Login Kit Sandbox Connection:** Fully functional and testable. Exchanges tokens, encrypts in SQLite with AES-256-GCM, auto-refreshes.
- **`user.info.basic`:** Fully functional and verified. Returns open ID, display name, avatar URL.
- **TikTok Mobile LIVE Broadcast:** Host can broadcast manually using the mobile app. LiveLift cannot ingest telemetry from it via official APIs.
- **TikTok Shop LIVE Manager:** Operator can log in via Chromium browser (`seller-vn.tiktok.com/live/manager`) on Linux to monitor live metrics and manage products visually. Programmatic streaming to LiveLift is unsupported.
- **Shop Analytics API Ingestion:** Fully testable using deterministic fixture replay in `tests/test_ingest_tiktok_shop.py` (all 100 test cases passing). Live-fire API calls require Partner Center credentials.

### 4.6 Recommended Phase V7 Implementation
Implement **Milestone V7.0 (Post-LIVE Attribution Reconciler)** as the core foundation:
1. Implement the decoupled `TikTokShopProvider`, `LiveMetricsProvider`, and `ProductPerformanceProvider` contracts.
2. Ingest post-LIVE `performance_per_minutes` and `products_performance`.
3. Build the Attribution Reconciler to overlay official 1-minute metrics onto LiveLift run-of-show segments.
4. Enhance the Review workspace with Dual-Perspective Replay ("As Known Then" vs "With Later Evidence").
5. Implement Operator Quick-Report Cues for live comments, pinning, and audience reactions.

### 4.7 Highest-Value First Feature
**The Post-LIVE Attribution Reconciler:**
- Seamlessly bridges LiveLift's planned rundowns and operational pacing with official platform-attributed revenue and product click telemetry.
- Delivers concrete, actionable post-show intelligence without risking stream downtime, violating developer terms, or depending on unavailable real-time APIs.

### 4.8 Blockers
1. **Account Manager Requirement for Custom App (Vietnam):** Vietnamese sellers cannot create In-House Apps in Partner Center without an assigned AM.
2. **Creator Follower Threshold:** Creator APIs (`live_rooms/core_stats`) require a verified TikTok Shop Creator account with at least 1,000 followers.
3. **Absence of Official Chat & Click Stream APIs:** Prevents full real-time automation of comment sentiment analysis and in-stream CTR triggers, necessitating operator desk cues.

### 4.9 Final SHA
- final SHA: `8c83901ca945133d22ed3583e82ce626ead5e914`

---

## 5. Official Verdict

```
VERDICT:
LIVE INTELLIGENCE FEASIBLE: PARTIAL
REALTIME STRATEGY FEASIBLE: PARTIAL
READY FOR IMPLEMENTATION: YES
```

### Verdict Justification:
- **LIVE INTELLIGENCE FEASIBLE: PARTIAL:** Fully feasible post-LIVE via official TikTok Shop Seller Analytics (`performance_per_minutes`, `products_performance`); partially feasible during broadcast due to the complete lack of official APIs for chat comments, real-time product clicks, and stream pinning.
- **REALTIME STRATEGY FEASIBLE: PARTIAL:** Real-time order velocity via webhooks and room audience concurrency via Creator APIs are feasible with appropriate entitlements; however, real-time in-stream interaction automation is not supported officially and must be augmented by LiveLift's Operator Quick Cues.
- **READY FOR IMPLEMENTATION: YES:** The provider architecture, TypeScript contracts, data models, domain invariants, and Post-LIVE Attribution Reconciler (Milestone V7.0) are fully specified and 100% ready for engineering implementation.
