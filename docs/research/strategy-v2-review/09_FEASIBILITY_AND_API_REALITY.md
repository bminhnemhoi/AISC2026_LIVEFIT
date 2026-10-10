# LiveLift Strategy Review & Independent Product Evaluation
## 09 — Feasibility Classification & Technical API Reality

**Evaluator:** Independent Principal Technical Architect & Systems Researcher  
**Date:** October 4, 2026  
**Audited Integrations:** TikTok Shop Partner Center, Shopee Open Platform, YouTube Data API, Browser Companion  
**Guiding Principle:** "Do not invent platform capabilities; classify feasibility based on verified production reality."  

---

### 1. Definitive Feasibility Classification Matrix

| Feature / Data Entity | Feasibility Tier | Prerequisites & Access Boundaries | Technical Risk & Failure Mode |
|---|---|---|---|
| **Run of Show Engine** | **BUILDABLE NOW** | None (Pure local/server business logic) | Zero external risk; 100% within LiveLift control. |
| **NOW/NEXT Decision Band**| **BUILDABLE NOW** | None (Plan sequence + operator queue) | Zero external risk; deterministic state machine. |
| **Manual Transition Logging**| **BUILDABLE NOW** | None (REST command with idempotency key) | Network drops handled via local draft quarantine. |
| **Plan vs Actual Variance**| **BUILDABLE NOW** | None (PostgreSQL timestamp diffs) | Dependent on operator logging transitions. |
| **Deterministic Simulator**| **BUILDABLE NOW** | None (Virtual clock + JSON scenario fixtures) | Zero external risk; fully self-contained. |
| **Vietnamese PII Scrubber**| **BUILDABLE WITH EXISTING BACKEND** | `src/livelift/ingest/pii/filter.py` | Proven code; $\ge 95\%$ recall validated in tests. |
| **GIVT Click Validity** | **BUILDABLE WITH EXISTING BACKEND** | `src/livelift/core/click_validity.py` | Proven code; self-hosted redirect `/r/{code}`. |
| **Official Catalog Import**| **BUILDABLE WITH OFFICIAL ACCESS** | Seller OAuth (`user_type=0`), scope `product.list`| Requires seller account authorization. |
| **Post-Live Minute Data** | **BUILDABLE WITH OFFICIAL ACCESS** | Scope `data.shop_analytics.public.read`; `GET /analytics/202510/shop_lives/{id}/performance_per_minutes` | Available only **AFTER** session ends; 30-120m latency. |
| **Product Sales Performance**| **BUILDABLE WITH OFFICIAL ACCESS** | Scope `data.shop_analytics.public.read`; `GET /analytics/202512/shop/{id}/products_performance` | Available only **AFTER** session ends. |
| **Shopee Live Pin Control** | **BUILDABLE WITH OPTIONAL PROVIDER**| Shopee Partner API `POST /api/v2/livestream/update_show_item` | Requires Shopee Live broadcaster token. |
| **Shopee Live Comments** | **BUILDABLE WITH OPTIONAL PROVIDER**| Shopee Partner API `POST /api/v2/livestream/get_latest_comment_list` | Short-polling (3–5s); rate-limit sensitive. |
| **Official TikTok Live Stats**| **NEEDS TECHNICAL SPIKE** | Requires **Creator OAuth (`user_type=1`)**; `GET /analytics/202502/live_rooms/{id}/core_stats` | Closed beta approval; sellers do not have creator tokens. |
| **Current Pinned Product Read**| **UNRELIABLE / PROVISIONAL** | Optional read-only DOM companion extension | Fragile to TikTok DOM selector changes; provisional only. |
| **Automated TikTok Pinning**| **SHOULD NOT PROMISE** | Non-existent in official TikTok API | Prohibited. Synthetic clickers get seller accounts banned. |
| **Live Chat WebSocket (TikTok)**| **SHOULD NOT PROMISE** | Non-existent in official TikTok API | Prohibited. Reverse-engineered scrapers break constantly. |
| **Real-time Causal GMV Lift**| **SHOULD NOT PROMISE** | Statistical power failure in rooms $<50$ viewers | Mathematically impossible in small rooms (MDE $>45\%$). |

---

### 2. Deep Dive: The Three Critical Feasibility Boundaries

#### 2.1 What Is 100% Buildable Today (Zero External Blockers)
Everything required to deliver the core **Commerce Run-of-Show Desk (Option B)** can be built immediately with standard, proven technology:
- The drag-and-drop rundown builder.
- The 5-second NOW/NEXT cue band with dynamic downstream cascade timing calculation.
- The 1-click transition logging engine with idempotency keys.
- The 3-minute post-live plan variance summary.
- The 1-click playbook cloning engine.
- The deterministic rehearsal simulator.

**Strategic Impact:** The core product can launch, onboard merchants, and deliver immense daily value without waiting for ByteDance API approvals or partner registrations.

#### 2.2 What Is Feasible via Official Partner APIs (Post-Live & Catalog Enrichment)
The existing backend code (`src/livelift/ingest/tiktok_shop.py`) already contains production-grade, tested implementations of TikTok's official HMAC-SHA256 signature protocol.
- **Catalog Sync:** Pulls product titles, codes, and prices directly into the Product Pack pre-session.
- **Post-Live Minute Performance:** After a broadcast ends, LiveLift pulls `/analytics/202510/shop_lives/{live_id}/performance_per_minutes` and joins the minute-level click/order counts directly to the executed Run of Show segments.
- **Feasibility Assessment:** Fully buildable and officially supported, provided the seller authorizes the app through standard OAuth.

#### 2.3 What Must Be Purged from Product Roadmaps (Dangerous Fantasies)
1. **Automated TikTok Pinning:** Any proposal claiming LiveLift can auto-pin products on TikTok must be rejected. The API does not exist. Third-party DOM automation extensions get merchant shops permanently banned.
2. **Official Live Chat Streaming for TikTok:** There is no official streaming endpoint for live comments. Relying on unofficial scrapers (`collectors/tiktok_public`) creates massive technical maintenance debt and legal vulnerability under Law 91/2025/QH15.
3. **Real-Time Causal Attribution:** Claiming that software can statistically isolate the revenue lift of an intervention during a 15-viewer live stream is scientific malpractice.

---

### 3. Summary of API Reality for Engineering Roadmaps

```
+--------------------------------------------------------------------------------------------------+
|                                  THE DATA SEPARATION BOUNDARY                                    |
+--------------------------------------------------------------------------------------------------+
| LIVE RUNTIME (T_live):           POST-SESSION AUDIT (T_live + 60m):                              |
| * 100% Server Authoritative      * Official TikTok Shop Partner API                              |
| * Human Operator Transitions     * Attributed Minute-Level GMV & Clicks                          |
| * Plan-Based Pacing & Cues       * Joined to Executed Run of Show for Post-Mortem Variance       |
| * ZERO Dependency on TikTok API  * Enrichment Layer (Enhances, but does not block core loop)     |
+--------------------------------------------------------------------------------------------------+
```
