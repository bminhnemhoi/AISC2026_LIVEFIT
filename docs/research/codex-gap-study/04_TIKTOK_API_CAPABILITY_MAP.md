# TikTok Shop API capability crawl

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

## Method and evidence limits

Access date **2026-10-05**. Official Partner Center pages were opened; where the public web response was only an application shell, installed headless Chromium rendered the documentation without signing in or installing software. Endpoint descriptions, methods, paths, scopes and visible response examples were inspected. No production request, authorization approval or Vietnamese credential was tested. General developer searches did not establish LIVE room-control APIs.

Classification is at capability level: **OFFICIAL API EXISTS**, **OFFICIAL API EXISTS BUT ACCESS RESTRICTED**, **OFFICIAL ANALYTICS ONLY**, **NO DOCUMENTED API FOUND**, **UNOFFICIAL ONLY**, **UNKNOWN**. “Exists” always requires authorized app/token/scopes; “restricted” highlights additional creator/affiliate approval or unverified rollout. A scope containing `public` does not mean anonymous access. All API-source evidence is **OFFICIAL BUT RESTRICTED**, market **Partner platform / creator platform; VN entitlement not tested**, unless stated otherwise.

## Capability map

| Capability | Classification | Exact official evidence | Contract / limitation | Product consequence |
|---|---|---|---|---|
| Seller authorization | OFFICIAL API EXISTS | [A1: Authorization overview](https://partner.tiktokshop.com/docv2/page/678e3a3292b0f40314a92d75) | OAuth; seller credentials, granted scopes, refresh; app/category approval still required | Optional enrichment; never block manual operation. |
| Creator authorization | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A21: Creator authorization guide](https://partner.tiktokshop.com/docv2/page/creator-authorization-guide) | Separate creator token; creator enrolment, target market, enabled scopes; guide still describes beta testing accounts | Do not reuse seller token or assume approval. |
| Shop identity | OFFICIAL API EXISTS | [A2: Get Authorized Shops](https://partner.tiktokshop.com/docv2/page/6507ead7b99d5302be949ba9) | GET /authorization/202309/shops; seller.authorization.info; use shop_cipher | Bind tenant → authorized shop; display binding status. |
| Creator identity | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A22: Get Creator Profile 202405](https://partner.tiktokshop.com/docv2/page/get-creator-profile-202405) | GET /affiliate_creator/202405/profiles; creator.affiliate.info or creator.video.write | Profile is not a verified room-to-shop relationship. |
| Products / catalog search | OFFICIAL API EXISTS | [A3: Search Products 202502](https://partner.tiktokshop.com/docv2/page/search-products-202502) | POST /product/202502/products/search; seller.product.basic; pagination | Later import snapshot; manual pack remains usable. |
| Seller LIVE session list | OFFICIAL API EXISTS | [A4: Shop LIVE Performance List 202609](https://partner.tiktokshop.com/docv2/page/get-shop-live-performance-list-202609) | GET /analytics/202609/shop_lives/performance; data.shop_analytics.public.read | Find candidate room/session; explicit binding, not automatic by title. |
| Shop LIVE aggregate performance | OFFICIAL API EXISTS | [A14: Shop LIVE Performance Overview 202609](https://partner.tiktokshop.com/docv2/page/get-shop-live-performance-overview-202609) | GET /analytics/202609/shop_lives/overview_performance; today=true can return realtime daily aggregate | Shop/day total is not exact-session pacing evidence. |
| Post-LIVE minute performance | OFFICIAL API EXISTS | [A5: Shop LIVE Minute Performance 202510](https://partner.tiktokshop.com/docv2/page/get-shop-live-minute-performance-202510) | GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes; completed official/marketing LIVE | Enrich review with defined interval aggregates; no realtime stream promise. |
| Post-LIVE product performance | OFFICIAL API EXISTS | [A6: Shop LIVE Products Performance 202512](https://partner.tiktokshop.com/docv2/page/get-shop-live-products-performance-list-202512) | GET /analytics/202512/shop/{live_id}/products_performance; official/marketing LIVE | Exact documented path; aggregate product metrics, not segment revenue attribution. |
| Creator room core stats | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A7: LIVE Room Core Stats 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-core-stats-202502) | GET /analytics/202502/live_rooms/{live_room_id}/core_stats; creator.data.live.read.public | Documented commerce/audience aggregates; freshness SLA unverified. |
| Creator GMV trends | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A8: LIVE Room GMV Trend 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-gmv-trend-202502) | GET /analytics/202502/live_rooms/{live_room_id}/gmv_trend_performances; creator.data.live.read.public | Timestamp series does not guarantee low-latency polling entitlement. |
| Creator interaction trends | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A9: LIVE Room Interactive Trends 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-interactive-trends-202502) | GET /analytics/202502/live_rooms/{live_room_id}/interactive_trend_performances | Aggregate comments/shares/watch; not comment bodies. |
| Creator view trends | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A10: LIVE Room View Trends 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-view-trends-202502) | GET /analytics/202502/live_rooms/{live_room_id}/view_trend_performances | Aggregate online/enter/leave counts; not identified joins. |
| Creator product stats | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A11: LIVE Room Product Stats 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-product-stats-202502) | GET /analytics/202502/live_rooms/{live_room_id}/product_stats | Product performance/inventory fields do not establish current pin. |
| Creator traffic sources | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A12: LIVE Room Traffic Performance 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-traffic-performance-202502) | GET /analytics/202502/live_rooms/{live_room_id}/traffic_performances | Source/subsource aggregates. |
| Creator viewer portraits | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A13: LIVE Room User Portraits 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-user-portraits-202502) | GET /analytics/202502/live_rooms/{live_room_id}/user_portraits | Aggregate demographics; no individual identity inference. |
| LIVE room identity lookup | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A23: Affiliate integration](https://partner.tiktokshop.com/docv2/page/affiliate-integration) | Affiliate integration names Get Live Room Info; exact endpoint/version not resolved in this crawl | Endpoint contract UNKNOWN until entitlement/schema spike; do not invent URL. |
| Creator-to-shop collaboration | OFFICIAL API EXISTS BUT ACCESS RESTRICTED | [A23: Affiliate integration](https://partner.tiktokshop.com/docv2/page/affiliate-integration) | Affiliate collaboration/profile capabilities exist | Relationship can be many-to-many; current-room shop mapping UNKNOWN. |
| Order details | OFFICIAL API EXISTS | [A15: Get Order Detail 202309](https://partner.tiktokshop.com/docv2/page/get-order-detail-202309) | GET /order/202309/orders; seller.order.info | Order data is not inherently room-attributed. |
| Order list/status webhooks | OFFICIAL API EXISTS | [A16: OMS official integration requirements](https://partner.tiktokshop.com/docv2/page/order-management-system-oms) | OMS integration explicitly requires order search/detail and order-status webhook | Topic/version, signature, retries and attribution require exact contract check. |
| Comment text / message event stream | NO DOCUMENTED API FOUND | Bounded negative search; UI evidence in report 03 | No official LIVE comment-message endpoint found in the bounded partner/developer search | UNOFFICIAL ONLY in isolated legacy Webcast collector; exclude from product dependency. |
| Likes event stream | NO DOCUMENTED API FOUND | Bounded negative search; UI evidence in report 03 | UI counts and interaction analytics are not individual LIVE like events | No required ingestion. |
| Gifts event stream | NO DOCUMENTED API FOUND | Bounded negative search; UI evidence in report 03 | Manager activity UI does not establish API delivery | Unofficial collectors exist; no official assumption. |
| Joins / individual viewers | NO DOCUMENTED API FOUND | [A10: LIVE Room View Trends 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-view-trends-202502) | Aggregate arrival/departure analytics exists; identified viewer events not found | No personal viewer logging in P0. |
| Current pinned product | NO DOCUMENTED API FOUND | [A11: LIVE Room Product Stats 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-product-stats-202502) | Reviewed product analytics does not document current pin state | Manual reported state only; unknown stays unknown. |
| Pin / unpin product in room | NO DOCUMENTED API FOUND | Bounded negative search; UI evidence in report 03 | Native controls exist; no external LIVE control contract found | REJECTED automatic TikTok pinning. |
| Coupon list/details | OFFICIAL API EXISTS | [A19: Search Coupon List 202406](https://partner.tiktokshop.com/docv2/page/search-coupon-list-202406) | POST /promotion/202406/coupons/search; seller.promotion.info or seller.customer_service | Existing seller coupons can be read; GET detail separately documented. |
| Create coupon / pin coupon card | NO DOCUMENTED API FOUND | [A17: Promotion API overview](https://partner.tiktokshop.com/docv2/page/650da1ab55bc3202b76f8d21) | Promotion overview explicitly excludes coupon creation; no room card-execution endpoint found | Native setup/control only; do not infer from coupon reads. |
| Product discount / Flash Sale creation | OFFICIAL API EXISTS | [A18: Create Promotion Activity 202309](https://partner.tiktokshop.com/docv2/page/create-promotion-activity-202309) | POST /promotion/202309/activities; seller.promotion.write; FLASHSALE type; future begin_time | Generic promotion exists; not proof of creator LIVE flash activation or immediate room control. |
| Promotion updates/management | OFFICIAL API EXISTS | [A17: Promotion API overview](https://partner.tiktokshop.com/docv2/page/650da1ab55bc3202b76f8d21) | Official promotion family includes catalog promotion management | Scope/eligibility/market contract must be checked before use; deferred. |
| Room-level LIVE Flash Sale activation | NO DOCUMENTED API FOUND | [A18: Create Promotion Activity 202309](https://partner.tiktokshop.com/docv2/page/create-promotion-activity-202309) | Generic FLASHSALE configuration lacks verified room activation semantics | Schedule a human cue, not a remote execution promise. |
| Giveaway execution / winner control | NO DOCUMENTED API FOUND | Bounded negative search; UI evidence in report 03 | No published third-party LIVE giveaway control found | Native opt-in automation is different from developer access. |
| Billboard control | NO DOCUMENTED API FOUND | Bounded negative search; UI evidence in report 03 | Native UI documented; external control not found | Avoid public overlay management. |
| Replay video / synchronized comments download API | NO DOCUMENTED API FOUND | Bounded negative search; UI evidence in report 03 | Native replay/download/export confirmed, programmatic retrieval not found | Native deep link or user-provided artifact; no scraper. |
| Benchmark / diagnosis external API | OFFICIAL ANALYTICS ONLY | Bounded negative search; UI evidence in report 03 | Native UI features confirmed; no matching public external workflow API found | Link to TikTok; do not clone. |
| Authenticated VN app access in this project | UNKNOWN | Bounded negative search; UI evidence in report 03 | No live credentials or entitlement probe performed | Mandatory spike before promising enrichment. |


## What changed from previous repository research

1. **Seller analytics versions have moved.** The repository's session-list implementation uses 202509; the rendered current documentation lists 202609. This is a version-migration spike, not proof that 202509 is already disabled.
2. **Analytics are not universally post-only.** The shop overview documents `today=true` daily real-time aggregates, and creator room aggregate endpoints exist. Neither establishes a low-latency exact-session event stream for this app.
3. **Minute-level seller analytics are explicitly post-LIVE.** Do not substitute them for the pacing clock. The official/marketing restrictions also differ from session-list wording.
4. **Promotions are not universally unavailable.** Generic Flash Sale/discount creation exists. Coupon creation is excluded by the promotion overview; room-specific activation, coupon card pinning and giveaway control remain unestablished.
5. **Room identity is not wholly undocumented.** Affiliate documentation names Get Live Room Info, but this crawl did not resolve its exact current request schema. Keep the narrow existence claim and an UNKNOWN contract.

## Endpoint contradictions that require a spike

| Documentation inconsistency | Safe interpretation |
|---|---|
| LIVE session list description says official-account scope; account_type enum includes OFFICIAL / MARKETING / AFFILIATE | Do not promise all creator room coverage. Probe approved VN account types and confirm with partner support. |
| Minute/product analytics describe official or marketing accounts | Apply each endpoint's rule; do not transfer list eligibility to detail APIs. |
| Shop overview description mentions local currency; enum also includes USD | Read actual response currency/unit and compare with native export. No forced conversion or implicit VND assumption. |
| Creator guide includes beta test-account wording while documentation is public | Public docs are not a successful access grant. Verify app category, region and token scopes. |
| Product endpoint path contains `/shop/{live_id}/products_performance` | Preserve the exact official path until tested; do not “fix” it to a guessed plural. |
| Trend response examples expose partial/collapsed JSON | No inferred SLA, interval completeness or extra fields absent from inspected contract. |

## Avoid false-positive API matches

The [official developer product catalog](https://developers.tiktok.com/docs/en/welcome) was checked on **2026-10-05**, market **global developer platform**, evidence **OFFICIAL BUT RESTRICTED** for its documented products. Login/Display/Posting/Research product areas do not themselves establish TikTok Shop LIVE comment events or room controls. Search results for video/ad-comment pinning are a different resource from LIVE product pinning. AI Scripts external API: **NO DOCUMENTED API FOUND** in this bounded crawl; native UI script availability is not an analytics/API contract.

## Required authorization/binding contract

Seller and creator identities require separate credentials. Persist credential ownership, authorized shop/creator, market, app category, granted scopes, token expiry and revocation state. Resolve a platform room only through explicit candidate selection and sufficient identity evidence. A title or scheduled time alone is insufficient; official creator, marketing and affiliate relations can differ. On permission expiry, keep the manual show working and mark enrichment unavailable.

App-level permission and token-level granted scope both matter. Common scope/token/signature errors should become actionable integration status; do not map every unfamiliar error to throttling. Secrets stay server-side and out of operator exports. No new credential work is authorized by this research task. [A1: Authorization overview](https://partner.tiktokshop.com/docv2/page/678e3a3292b0f40314a92d75); [A21: Creator authorization guide](https://partner.tiktokshop.com/docv2/page/creator-authorization-guide); [A24: App category guide](https://partner.tiktokshop.com/docv2/page/hulvi36o); [A25: Common errors](https://partner.tiktokshop.com/docv2/page/678e3a45786253031531b942).

## Bounded negative search register

Official domains searched: `partner.tiktokshop.com`, `developers.tiktok.com`, and `seller-vn.tiktok.com`. Query families covered LIVE comments/chat, likes/gifts/joins/viewer events, pinned product/pin/unpin, LIVE promotion execution, giveaway, room identity, LIVE stats/GMV/minute performance and seller/creator authorization. Public partner navigation was inspected in addition to search. This establishes **no documented public contract found here**, not proof of absence from private partner programs or a ban on all third-party integration.

Unofficial Webcast ingestion in `collectors/tiktok_public/collect.py` is a separate, isolated research route. It does not upgrade any capability to official, and V3 P0 must not depend on it. No scraping or collector execution was performed.

## Least-dependent integration order

**First:** manual pack and authoritative operational timing. **Second, if entitled:** catalog import and explicit room binding; post-session minute/product enrichment or a validated manual native export. **Third, only after a demonstrated user need and access probe:** creator/shop aggregates. **Never implied:** external auto pin, coupon execution or giveaway automation.

An API failure must affect enrichment only. A chart overlay should retain source, currency, metric definition, covered interval, fetch time and known missingness. A minute overlaps multiple segments; never apportion its revenue causally among them or join an unrelated shop/day total to a room.

## Official source register

| ID | Source URL | Access date | Market | Evidence |
|---|---|---|---|---|
| A1 | [A1: Authorization overview](https://partner.tiktokshop.com/docv2/page/678e3a3292b0f40314a92d75) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A2 | [A2: Get Authorized Shops](https://partner.tiktokshop.com/docv2/page/6507ead7b99d5302be949ba9) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A3 | [A3: Search Products 202502](https://partner.tiktokshop.com/docv2/page/search-products-202502) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A4 | [A4: Shop LIVE Performance List 202609](https://partner.tiktokshop.com/docv2/page/get-shop-live-performance-list-202609) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A5 | [A5: Shop LIVE Minute Performance 202510](https://partner.tiktokshop.com/docv2/page/get-shop-live-minute-performance-202510) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A6 | [A6: Shop LIVE Products Performance 202512](https://partner.tiktokshop.com/docv2/page/get-shop-live-products-performance-list-202512) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A7 | [A7: LIVE Room Core Stats 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-core-stats-202502) | 2026-10-05 | Creator APIs; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A8 | [A8: LIVE Room GMV Trend 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-gmv-trend-202502) | 2026-10-05 | Creator APIs; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A9 | [A9: LIVE Room Interactive Trends 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-interactive-trends-202502) | 2026-10-05 | Creator APIs; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A10 | [A10: LIVE Room View Trends 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-view-trends-202502) | 2026-10-05 | Creator APIs; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A11 | [A11: LIVE Room Product Stats 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-product-stats-202502) | 2026-10-05 | Creator APIs; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A12 | [A12: LIVE Room Traffic Performance 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-traffic-performance-202502) | 2026-10-05 | Creator APIs; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A13 | [A13: LIVE Room User Portraits 202502](https://partner.tiktokshop.com/docv2/page/get-live-room-user-portraits-202502) | 2026-10-05 | Creator APIs; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A14 | [A14: Shop LIVE Performance Overview 202609](https://partner.tiktokshop.com/docv2/page/get-shop-live-performance-overview-202609) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A15 | [A15: Get Order Detail 202309](https://partner.tiktokshop.com/docv2/page/get-order-detail-202309) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A16 | [A16: OMS official integration requirements](https://partner.tiktokshop.com/docv2/page/order-management-system-oms) | 2026-10-05 | Partner platform; market-specific requirements | OFFICIAL BUT RESTRICTED |
| A17 | [A17: Promotion API overview](https://partner.tiktokshop.com/docv2/page/650da1ab55bc3202b76f8d21) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A18 | [A18: Create Promotion Activity 202309](https://partner.tiktokshop.com/docv2/page/create-promotion-activity-202309) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A19 | [A19: Search Coupon List 202406](https://partner.tiktokshop.com/docv2/page/search-coupon-list-202406) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A20 | [A20: Get Coupon 202406](https://partner.tiktokshop.com/docv2/page/get-coupon-202406) | 2026-10-05 | Partner platform; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A21 | [A21: Creator authorization guide](https://partner.tiktokshop.com/docv2/page/creator-authorization-guide) | 2026-10-05 | Creator integrations; access conditions | OFFICIAL BUT RESTRICTED |
| A22 | [A22: Get Creator Profile 202405](https://partner.tiktokshop.com/docv2/page/get-creator-profile-202405) | 2026-10-05 | Creator integrations; VN entitlement not tested | OFFICIAL BUT RESTRICTED |
| A23 | [A23: Affiliate integration](https://partner.tiktokshop.com/docv2/page/affiliate-integration) | 2026-10-05 | Affiliate APIs; approval required | OFFICIAL BUT RESTRICTED |
| A24 | [A24: App category guide](https://partner.tiktokshop.com/docv2/page/hulvi36o) | 2026-10-05 | Partner platform; category-dependent access | OFFICIAL BUT RESTRICTED |
| A25 | [A25: Common errors](https://partner.tiktokshop.com/docv2/page/678e3a45786253031531b942) | 2026-10-05 | Partner platform | OFFICIAL BUT RESTRICTED |
