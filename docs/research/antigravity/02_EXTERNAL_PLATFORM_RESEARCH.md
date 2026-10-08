# LiveLift Strategic Research & Architecture Synthesis
## 02 — External Platform Research & Integration Realities

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Primary Platforms Investigated:** TikTok Shop Open Platform, Shopee Open Platform, YouTube Data API, Meta/Facebook Graph API  
**Sources:** Official Developer Documentation, Partner Center Guidelines, API Reference Specs, Repository Field Investigations  

---

### 1. Executive Finding: The Myth of Autonomous Platform Control

A foundational misconception in live-commerce software is the belief that software can connect to TikTok Shop via an official API and autonomously pin products, read live viewer comments in real time, and execute promotions during a live broadcast.

**Our deep investigation into platform documentation and API endpoints confirms:**
1. **NO Official Public API Exists to Pin Products in a TikTok Live:** Product pinning is strictly an interactive mobile UI feature in the TikTok app or TikTok LIVE Studio reserved for the authenticated broadcaster.
2. **NO Official Real-Time Live Chat WebSocket Exists for TikTok Shop Sellers:** The TikTok Shop Open Platform does not provide a live comment stream endpoint or webhook.
3. **Automated Automation/Scraping Bots Lead to Immediate Account Suspension:** Using browser automation (Puppeteer, Selenium) or reverse-engineered Webcast protocol scrapers violates TikTok Terms of Service, triggering account bans and merchant shop closure.
4. **Official APIs are Strictly Post-Live or Catalog-Centric:** Official endpoints provide pre-live product catalog synchronization and post-live aggregated or minute-level performance audits *after* the broadcast has finished.

Therefore, **LiveLift's decision to treat manual desk operation as a first-class supported mode is not merely a fallback—it is the ONLY technically sound, TOS-compliant, and reliable architecture possible.**

---

### 2. Comprehensive Platform Capability Matrix

| Platform | Domain | Capability | Status | Requirements & Limitations | Source & Date |
|---|---|---|---|---|---|
| **TikTok Shop** | Catalog | Read/Sync Product List | **CONFIRMED OFFICIAL** | Scope: `product.list`; Seller OAuth (`user_type=0`); QPS 5–10 | Partner Center (2026-07) [Official] |
| **TikTok Shop** | Post-Live | Performance per Minute | **CONFIRMED OFFICIAL** | Scope: `data.shop_analytics.public.read`; `GET /analytics/202510/shop_lives/{id}/performance_per_minutes`; Available only **AFTER** session ends | Partner Center (2026-07) [Official] |
| **TikTok Shop** | Post-Live | Products Performance | **CONFIRMED OFFICIAL** | Scope: `data.shop_analytics.public.read`; `GET /analytics/202512/shop/{id}/products_performance`; GMV, orders, clicks | Partner Center (2026-08) [Official] |
| **TikTok Shop** | Live Room | Real-time Core Stats | **LIKELY RESTRICTED** | Scope: `creator.data.live.read.public`; Requires **Creator OAuth (`user_type=1`)**; Closed beta approval | Partner Center (2026-07) [Official] |
| **TikTok Shop** | Live Stream | Programmatic Pin/Unpin | **NOT AVAILABLE** | Does not exist in public or partner APIs; Native UI app only | Verified via API audit [Primary Source] |
| **TikTok Shop** | Live Chat | Real-time Comment Stream | **NOT AVAILABLE** | No webhook, no SSE, no official WebSocket for live chat comments | Verified via API audit [Primary Source] |
| **Shopee** | Live Stream | Update Showing Item | **CONFIRMED OFFICIAL** | `POST /api/v2/livestream/update_show_item`; Sets currently displayed product; requires active `session_id` & shop token | Shopee Open Platform [Official] |
| **Shopee** | Live Chat | Fetch Latest Comments | **CONFIRMED OFFICIAL** | `POST /api/v2/livestream/get_latest_comment_list`; Short-polling endpoint; high rate-limit sensitivity | Shopee Open Platform [Official] |
| **YouTube** | Live Chat | Read Chat Messages | **CONFIRMED OFFICIAL** | `GET /liveChat/messages`; Polling required via `pollingIntervalMillis`; heavy quota consumption (10,000 units/day) | Google YouTube API v3 [Official] |
| **YouTube** | Live Stream | Broadcast State | **CONFIRMED OFFICIAL** | `GET /liveBroadcasts`; Status transitions (`testing`, `live`, `complete`) | Google YouTube API v3 [Official] |
| **Facebook** | Live Video | Live Comments & Video | **CONFIRMED OFFICIAL** | Graph API `/{live-video-id}/comments`; Webhook support; Page access token required | Meta for Developers [Official] |

---

### 3. In-Depth Platform Analysis

#### 3.1 TikTok Shop Open Platform (Partner Center)

The repository's internal research (`src/livelift/ingest/tiktok_shop.py` and `docs/research/2026-09-17-tiktok-duong-chinh-thuc.md`) was independently re-verified against current TikTok Shop specifications:

1. **Authentication & Cryptographic Request Signing:**
   - TikTok Shop employs a strict HMAC-SHA256 signature scheme.
   - Headers: `x-tts-access-token` (contains bearer token; excluded from signature).
   - Query: `app_key`, `timestamp` (10-digit Unix timestamp, valid strictly within $[-300s, +30s]$), `sign`.
   - Signature input format:
     $$\text{string\_to\_sign} = \text{app\_secret} + \text{path} + \sum (\text{sorted key-value pairs}) + \text{body\_bytes} + \text{app\_secret}$$
   - Any modification to payload bytes or URL parameters triggers HTTP 400 error code `106001` (Invalid Signature).
2. **Access Models & Scopes:**
   - **Seller Developer (`user_type = 0`):** Requires an active TikTok Shop seller account bound to an assigned ByteDance Account Manager (AM). Gives access to shop analytics, orders, products.
   - **ISV (Custom App):** Allows multi-shop authorization, but requires full corporate business registration verification (KYB) and security review.
   - **Creator Developer (`user_type = 1`):** Required for live room endpoints (`/analytics/202502/live_rooms/*`). In Vietnam, creators must have $\ge 1,000$ followers and national ID (CCCD) verification.
3. **Analytics Latency & Consistency:**
   - Endpoint: `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`.
   - The platform documentation explicitly states: *"Returns minute-level performance for a LIVE session after the session is finished."*
   - Crucial detail: The GMV and order counts reported by TikTok are **attributed numbers** subject to post-hoc return and cancellation adjustments.
   - Rate limit: Complex analytics endpoints are throttled to **0.2 to 1.0 requests per second**. Rapid polling during a broadcast will result in HTTP 429 (`36009002` rate limit exceeded) and temporary IP throttling.

#### 3.2 Shopee Open Platform

Shopee provides a contrasting, comparatively accessible API for livestream commerce:
- **`update_show_item` (`/api/v2/livestream/update_show_item`):** Officially allows an authorized application to change the showing product during a Shopee Live stream.
- **`get_latest_comment_list` (`/api/v2/livestream/get_latest_comment_list`):** Allows retrieving recent comments using timestamp pagination.
- **Caveat:** Shopee's API is notorious for regional variations (Shopee VN vs SG vs TH), frequent OAuth token expiration (tokens last 4 hours, refresh tokens last 30 days), and strict IP whitelisting in production partner configurations.

#### 3.3 YouTube Live Streaming API

- Polling live chat via `GET /liveChat/messages` is technically simple but economically constrained by Google Cloud quotas.
- Each chat list call costs 5 quota units. At a 5-second polling interval, an hour-long live stream consumes 3,600 units (over 35% of the default 10,000 daily project quota).
- YouTube chat is useful for VOD replay evaluation (using `yt-dlp` or post-session exports), but is not an e-commerce platform.

---

### 4. Technical and Legal Risks of Unofficial Workarounds

Because official TikTok live stream pinning APIs do not exist, teams are often tempted to use two dangerous workarounds:

```
+-----------------------------------------------------------------------------------------+
|                              UNOFFICIAL WORKAROUND RISKS                                |
+-----------------------------------------------------------------------------------------+
| 1. Unofficial Webcast Scrapers (e.g., TikTokLive Python library)                        |
|    - Mechanism: Reverse-engineers protobuf WebSocket connection to TikTok Webcast server|
|    - Fragility: Protobuf schemas and encryption salts change unannounced every 3-6 weeks|
|    - Risk: IP blocking, CAPTCHA challenges, total data loss mid-session                 |
+-----------------------------------------------------------------------------------------+
| 2. Browser Automation / Auto-Clicker Extensions                                         |
|    - Mechanism: Chrome extension injecting scripts into TikTok LIVE Studio / Web Seller |
|    - Fragility: DOM changes break selectors; human operator loses manual control         |
|    - Risk: TikTok fraud detection flags rapid synthetic DOM clicks -> IMMEDIATE SHOP BAN|
+-----------------------------------------------------------------------------------------+
```

**Architecture Policy for LiveLift-next:**
- **Zero Automation on Broadcast Platform:** LiveLift never attempts to programmatically click or inject DOM actions into TikTok Web or TikTok LIVE Studio.
- **The Desk Displays, The Human Operates:** LiveLift tells the assistant *what* to do and *why* in under 5 seconds. The human assistant clicks the pin in TikTok LIVE Studio or on the host iPad. The assistant logs "Attempted" or "Pinned" in LiveLift.
- **Optional Read-Only DOM Observation:** If a browser companion extension is built in the future (P1/P2), it must be **strictly read-only** (e.g., observing whether a pin badge appeared in DOM) and its output must be classified as `PROVISIONAL_OBSERVATION`, never `PLATFORM_CONFIRMED`.

---

### 5. Architectural Implications: The Capability-Based Abstraction

Because platforms differ radically in what they expose:
- TikTok: Catalog (Sync) + Post-Live Analytics (Replay Audit).
- Shopee: Catalog + Live Pinning Control + Polled Comments.
- Manual-First: Full Run of Show, Operator Reports, Manual Transitions.

LiveLift must NOT construct an architecture that expects every provider to implement an identical interface. Instead, LiveLift models external connections as a collection of independent, negotiable **Capabilities**.

If a session is running on TikTok:
- `CAPABILITY_CATALOG_SYNC` = `AVAILABLE`
- `CAPABILITY_PIN_CONTROL` = `UNSUPPORTED`
- `CAPABILITY_LIVE_CHAT` = `UNAVAILABLE`
- `CAPABILITY_POST_LIVE_AUDIT` = `AVAILABLE`
- `CAPABILITY_MANUAL_DESK` = `AVAILABLE (ACTIVE)`

The system displays the appropriate controls and expectations without breaking or pretending to possess features the platform does not provide.
