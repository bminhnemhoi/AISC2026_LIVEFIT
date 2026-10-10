# TikTok LIVE Dashboard — product model and screenshot crawl

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

## Evidence and access

Primary source: [T1: LIVE Dashboard — Vietnam](https://seller-vn.tiktok.com/university/essay?knowledge_id=967473030956801&lang=vi-VN). Accessed **2026-10-05**; market **Vietnam**; **CONFIRMED — VIETNAM** means official published capability, not successful authenticated use by this researcher. The article displays 18 July 2025. Fourteen linked screenshots were downloaded to temporary storage and visually inspected. No seller account or private session was accessed. English labels, USD/MYR examples and GMT+8 in illustrations are documentation examples; they do not establish Vietnamese currency settings or entitlements.

This is a model of the documented product, not an exhaustive specification of every account rollout. A capability shown in a Vietnam guide is not thereby available through an API. Related Manager, Diagnosis and Traffic guides are separately identified below.

## Object and navigation model

The central object is an identified **shoppable LIVE session**, analyzed while running or after completion. Seller Center's LIVE/video management entry leads into that session's dashboard. The shell combines video, room identity, duration/status, totals, product control/analysis and diagnostic areas. Its main analytical views are **Key Data**, **Performance Trends**, and **Traffic Sources**. It changes behavior by live/ended state rather than presenting a separate third-party workspace. [Official overview screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/bae8df946b014461adbd4e200230aac4~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192438&x-signature=i6LTLXhP02uxl4IngDJYloHTmzY%3D).

The underlying analytical model is: session → time windows → metric series, with related products, traffic-channel branches, promotions and content-quality events. A selected interval changes analysis; a selected point links to replay time. This already joins “what happened” to “what the platform measured.” No time-budgeted future segment plan, immutable baseline rundown or downstream hard-anchor recovery model was found in this source. That absence is limited to the reviewed documentation.

## Key Data: selection, comparison and trend control

The documented customization dialog permits **up to 16 metrics**, recommended choices, explicit selection, drag ordering, reset, save and cancel. Metrics are not simply a fixed GMV tile row. The visible dialog groups commercial, traffic and engagement measures. Some mock rows are duplicated; this crawl treats observed labels as evidence of a catalog, not proof that every illustrated label is simultaneously selectable. [Official metrics screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/e3ef580a9a4d4e9a9ce805c2de635f20~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192434&x-signature=aQsev%2F7xFZHrYctBj%2FDJPPFxBlM%3D).

The trend view supports the entire session, recent **5-minute** and **30-minute** windows, and custom range/brush selection. Two selected measures can be compared with separate vertical axes. Hover/selection reveals a time-specific value; clicking chart time seeks the replay. Product pin, promotion/advertising and violation markers give context along the timeline. Export is documented for **post-LIVE tabular data**; the article does not establish the file format, raw-event completeness or an export API. Video download is a distinct LIVE Manager feature. [Official trends screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/f8fa8824ce1748bc857af374b04f52cb~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192436&x-signature=zStzkUTaGzAScv4Y26B23gd69J4%3D); [T2: LIVE Manager for Sellers](https://seller-vn.tiktok.com/university/essay?knowledge_id=113561775900417&lang=en).

The benchmark panel exposes regional/category comparison and the user's historical performance, including a **14-day** personal reference and previous-session comparison. The article is inconsistent about the live panel: its overview mentions one weak metric while its detailed account and illustration indicate a three-metric presentation; post-LIVE discusses three. Do not hard-code an inferred universal count without an account check. “Benchmark” here means platform comparisons, not controlled experiments. [Official bench-live screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/7d9a0da056d146d5bc5fa5ad3df71fbf~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192432&x-signature=NT36YP0SCrrcYnsBykwA1HCJFYQ%3D); [Official bench-post screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/81a4b32d31234a4db00bb5ed64f4d272~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192434&x-signature=j8L3hHM6cEndTtu3bLJeZTMJ0Fg%3D).

## Metric catalog and semantic hazards

The following are observed labels/families across dashboard illustrations and related official guides. Names that look similar are not automatically interchangeable. Availability, time aggregation and formula must be verified against the selected metric's definition.

| Family | Observed measures | Interpretation / caution |
|---|---|---|
| Commercial totals | Direct GMV; attributed GMV; Ads GMV; GMV/hour; sales; buyers/customers | Distinguish attribution windows, paid contribution and time normalization; do not sum overlapping GMV definitions. |
| Orders / basket | Main orders; SKU orders; created SKU orders; items sold; average main-order price; illustrative “Average buyers”; refunds | Orders, line items and units are separate denominators. Created and paid/attributed states need definition. |
| Reach / audience | Impressions; impressions/hour; views; viewers / unique viewers; visitors; current viewers | Snapshot concurrency is not cumulative visitors. A trend count is not an individual viewer event stream. |
| Attention | Average watch duration / PV; room-entry rate | Verify whether averages use views, unique viewers or another denominator and how partial intervals behave. |
| Monetization | Show GPM; Watch GPM | GMV per 1,000 impressions or views respectively; compare only like-for-like definitions. |
| Conversion | Product clicks; product views; CTR; CTOR; main-order / SKU-order rates | Keep the specific order numerator and exposure denominator. Platform CTR is not legacy LiveLift shortlink clicks/viewer-seconds. |
| Engagement | Comment, follow, share and like rates; engagement counts | Rates and counts differ. Aggregate comments do not imply API access to comment text. |
| Product context | Inventory; product/SKU identity; price; pinned status | A native real-time pin indicator is not a documented third-party pin-status endpoint. |


The traffic playbook defines product CTR using product clicks relative to LIVE views and CTOR using SKU orders relative to product clicks; Show GPM and Watch GPM normalize GMV by impressions/views. Those definitions must not silently replace another dashboard variant. The Diagnosis guide includes an illustrative GMV decomposition whose printed 1,000 factor is dimensionally inconsistent with a per-1,000 measure; preserve metric dictionary verification rather than copying that expression into code. [T16: LIVE Traffic Playbook](https://seller-vn.tiktok.com/university/essay?knowledge_id=512121839519504&lang=en); [T7: LIVE Diagnosis](https://seller-vn.tiktok.com/university/essay?knowledge_id=3706134402107137).

The core-data screenshot confirms a rich native metric panel with customizable selections and comparison context. It is not evidence that LiveLift should duplicate all metrics. [Official core screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/f2367d756b5c4b94a62283f4aff2e1ae~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192437&x-signature=bIDFuGhiLUvRMq3tUhsTg3kjrLQ%3D).

## Visible metric-label inventory

The illustrations expose the following labels (case normalized); scroll-hidden items were not invented. Mock duplicates and nonsensical example values prevent treating these as a clean machine-readable dictionary.

| Surface | Labels visibly documented | Unit/definition status |
|---|---|---|
| Custom dialog | GMV; Ads GMV; views; items sold; orders; SKU orders; buyers; Average buyers; visitors; refunds | GMV currency must be selected/verified. The repeated Average buyers/visitors/views/refunds labels are illustrative; refund unit and Average buyers semantics are not specified here. |
| Core panel | GMV; sales; viewers; impressions; GMV per hour; impressions per hour; Show GPM; average viewing duration (PV); comment rate; follow rate; enter-room rate for LIVE; enter-room rate; click-through rate; order rate (SKU orders); share rate; like rate | Count, currency, time and percentage measures coexist. Two room-entry labels must not be merged without tooltips; sample rate values are not trustworthy benchmarks. |
| Product/commerce detail | Direct GMV; attributed GMV; main orders; created SKU orders; items sold; product impressions/click measures; stock; price | Product/time/attribution grain differs. Native pin status is UI evidence, not a published pin API. |
| Follower comparison | GMV; SKU orders; average main-order price; viewers; customers | Follower/non-follower slices; denominator and attribution require actual metric definition. |
| Promotion detail | Start time; viewers; users clicked; users joined; incremental impressions; incremental views | Event counts/platform labels; no demonstrated randomized incrementality method. |

Source/evidence: the individually linked metrics, core, products, portraits and promotions illustrations in the screenshot register, all accessed 2026-10-05, VN documentation. The traffic playbook supplies selected rate/GPM definitions. This inventory covers every legible label inspected, not hidden metrics or account-specific additions.

## Traffic Sources: hierarchy, shares and conversion

Traffic analysis compares **absolute values and contribution shares** for GMV, impressions and views. Each measure has its own total; a channel's GMV share is not its impression share. Users can compare up to five channels, sort them and inspect conversion measures such as CTR, CTOR and room entry. The source hierarchy distinguishes LIVE-related discovery and subchannels: For You/LIVE feeds, click or swipe entry, video-driven entry and other navigation such as Following/Inbox. Parent totals and their children must not be summed together. [Official traffic screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/05145e9df7304a14ab421652543dd3cc~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192431&x-signature=MZdE6%2FC5Vi3W3zm0iFe0xMIuqmM%3D).

The associated video-to-LIVE panel ranks videos by views, impressions and commercial contribution, exposes thumbnails/identifiers and supports copying a video ID. This is attribution-oriented content analysis, not proof that a specific video caused incremental orders. Illustrative numbers are not market benchmarks. [Official video-traffic screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/f4c87400f4ae408592df7a56d04b3228~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192434&x-signature=aRcQDSrYgiEgZGEQAxkzztI3dPM%3D).

## Product analysis and native control

The products area joins shopping-bag identity, pin status and commercial performance. It supports searching/filtering, sorting and customizable columns. Visible fields include product/SKU information, stock, price, impressions, CTR, viewers, order/items measures and GMV. Native controls include pinning and viewing product scripts. Product-set preparation and native product ordering exist elsewhere in Manager and are not novel LiveLift preparation functions. [Official products screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/713d44fcf8574f0dbf2796d67d5ce8ab~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192436&x-signature=DwKxAQf0fwhAU9XztJ%2FlqykdY4s%3D); [T8: Livestream Product Set](https://seller-vn.tiktok.com/university/essay?knowledge_id=6837782308259585&lang=en).

Product trend details associate product exposure with charted commerce outcomes. This can help locate when a product was featured, but it does not reconstruct a team's planned segment duration, recovery choice or reason for skipping a planned product. Those would require operator-owned plan/action records. [Official trends-products screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/34cdaf84778b4d1d81ed9f328d1401b9~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192433&x-signature=%2Fq%2ByKbrqIljGPDG0mTyTynWKuho%3D).

## Replay interaction: substantially solved natively

Replay appears beside analysis with a seekable timeline. Clicking chart time navigates playback. Comment context follows the replay, and the pinned product card reflects the selected video moment. Comment display/filter controls are visible, including the all-comments state. Timeline markers distinguish product/promotion and content-quality events. LiveLift must not market synchronized comments, product pin markers or chart-to-video seeking as an untouched gap. [Official replay screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/a63ed25a884743eea7cf3cb4200cc034~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192438&x-signature=y9qIy2TxX%2BVhIAV%2Fu8U30RZhjFw%3D); [Official trends screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/f8fa8824ce1748bc857af374b04f52cb~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192436&x-signature=zStzkUTaGzAScv4Y26B23gd69J4%3D).

LIVE Manager additionally documents downloading the recording and session comments. The Dashboard's tabular export, Manager's replay download and an API for accessing either are three different claims; only the first two were confirmed as UI capabilities. [T2: LIVE Manager for Sellers](https://seller-vn.tiktok.com/university/essay?knowledge_id=113561775900417&lang=en).

## Promotion and content-quality analysis

The promotion section identifies configured promotional activity and records task/event timing. The giveaway illustration includes **start time, viewers, users clicked, users joined, incremental impressions and incremental views**. “Incremental” is a platform metric label here; this crawl found no accompanying randomized causal methodology for those figures. Do not adopt it as demonstrated treatment lift. [Official promotions screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/61a8525ffa564e4489100e731e1f3dd8~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192435&x-signature=j9UwTg6A4fiHMWTfN3GnFBCr1yk%3D).

Violation/content-quality cards connect a flagged time with a replay clip, issue label/reason, a recommended response and appeal navigation. Example mock text is not reliable evidence of an actual enforcement cause. The valuable product model is **event → clip → explanation → remediation/appeal**. LiveLift should link to native diagnosis rather than build a policy engine or promise to prevent account violations. [Official violations screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/66e9ee5e055d4614be6f181903f7b93b~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192433&x-signature=OhPmOVnsvxL69FWkJzQzlIaDRRQ%3D).

## Viewer/customer segmentation

The dashboard distinguishes followers/non-followers across commerce and audience measures: GMV, orders, average order price, viewers and customers. Portraits show aggregate gender, age, country/region distributions. These are summarized audience slices, not personally identified viewer histories. There is no basis here for importing individual viewer identities into LiveLift. [Official portraits screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/b4b09a77eeb248bcb28039d3939b402a~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192433&x-signature=Q%2FjFoyEOjMkqKYw%2BjODvrOFQU98%3D).

## Interaction contract reconstructed from the crawl

| User operation | Linked state | Meaning for LiveLift |
|---|---|---|
| Open session; switch live/ended context | Room/session ID, duration, native totals | Bind enrichment to an explicitly verified session; never infer it from title alone. |
| Select/customize metrics | Tile choices and corresponding series | Link native analysis; avoid parallel copies of the metric dashboard. |
| Brush/custom range; compare two measures | Interval, axes and detailed product/traffic analysis | An operational interval can be linked later; matching boundaries still needs time-source verification. |
| Click chart/event marker | Replay playhead and contextual comments/pinned card | Semantic operational replay should add the missing plan/decision, not replace this video experience. |
| Filter traffic/product rows | Channel/product-specific measures | Platform diagnosis and operational variance answer different questions. |
| Open violation or promotion detail | Related clip/event and prescribed response | Keep platform-native corrective action on TikTok. |
| Export after LIVE | Documented tabular dataset | A manual import spike must validate an actual Vietnamese export; format is still unknown. |

## Product implications

**TikTok already answers:** what sales/reach/conversion occurred, which products and channels performed, what was pinned/promoted, what was said in replay, and where platform diagnosis suggests improvement.

**LiveLift can potentially answer:** what the team intended to do, which deadlines became infeasible, what the operator decided with the information available then, which execution records remain unconfirmed, and which approved timing change should appear in tomorrow's rundown. This is a bounded gap hypothesis, not proof that private TikTok tools have no comparable workflow.

**Do not duplicate:** GMV dashboards, audience portraits, video replay, synchronized native comments, traffic attribution, product ranking, violation diagnosis and generic post-LIVE AI summaries. Optional official analytics should enrich the operational record, with source/time/granularity displayed when needed.

## Reproducible screenshot register

Every row below was visually inspected on **2026-10-05**, market **Vietnam documentation**, evidence **CONFIRMED — VIETNAM** for the illustrated UI. Signed image URLs may change; the permanent parent guide is [T1: LIVE Dashboard — Vietnam](https://seller-vn.tiktok.com/university/essay?knowledge_id=967473030956801&lang=vi-VN). Images remained in temporary storage and are not added to this repository.

| Illustration | Source | Inspection purpose |
|---|---|---|
| overview | [Official overview screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/bae8df946b014461adbd4e200230aac4~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192438&x-signature=i6LTLXhP02uxl4IngDJYloHTmzY%3D) | Session shell / navigation |
| core | [Official core screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/f2367d756b5c4b94a62283f4aff2e1ae~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192437&x-signature=bIDFuGhiLUvRMq3tUhsTg3kjrLQ%3D) | Core data selections |
| bench-live | [Official bench-live screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/7d9a0da056d146d5bc5fa5ad3df71fbf~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192432&x-signature=NT36YP0SCrrcYnsBykwA1HCJFYQ%3D) | During-LIVE benchmarking |
| bench-post | [Official bench-post screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/81a4b32d31234a4db00bb5ed64f4d272~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192434&x-signature=j8L3hHM6cEndTtu3bLJeZTMJ0Fg%3D) | Post-LIVE benchmarking |
| products | [Official products screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/713d44fcf8574f0dbf2796d67d5ce8ab~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192436&x-signature=DwKxAQf0fwhAU9XztJ%2FlqykdY4s%3D) | Product grid and native controls |
| portraits | [Official portraits screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/b4b09a77eeb248bcb28039d3939b402a~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192433&x-signature=Q%2FjFoyEOjMkqKYw%2BjODvrOFQU98%3D) | Aggregated customer portraits |
| trends-products | [Official trends-products screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/34cdaf84778b4d1d81ed9f328d1401b9~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192433&x-signature=%2Fq%2ByKbrqIljGPDG0mTyTynWKuho%3D) | Product trend detail |
| promotions | [Official promotions screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/61a8525ffa564e4489100e731e1f3dd8~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192435&x-signature=j9UwTg6A4fiHMWTfN3GnFBCr1yk%3D) | Giveaway / promotion analysis |
| violations | [Official violations screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/66e9ee5e055d4614be6f181903f7b93b~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192433&x-signature=OhPmOVnsvxL69FWkJzQzlIaDRRQ%3D) | Clip-linked violation cards |
| video-traffic | [Official video-traffic screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/f4c87400f4ae408592df7a56d04b3228~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192434&x-signature=aRcQDSrYgiEgZGEQAxkzztI3dPM%3D) | Video-to-LIVE attribution |
| replay | [Official replay screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/a63ed25a884743eea7cf3cb4200cc034~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192438&x-signature=y9qIy2TxX%2BVhIAV%2Fu8U30RZhjFw%3D) | Comments / pinned card / replay |
| metrics | [Official metrics screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/e3ef580a9a4d4e9a9ce805c2de635f20~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192434&x-signature=aQsev%2F7xFZHrYctBj%2FDJPPFxBlM%3D) | 16-metric configuration dialog |
| trends | [Official trends screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/f8fa8824ce1748bc857af374b04f52cb~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192436&x-signature=zStzkUTaGzAScv4Y26B23gd69J4%3D) | Brush, dual series and markers |
| traffic | [Official traffic screenshot](https://p16-oec-university-sign-sg.ibyteimg.com/tos-alisg-i-nk3i2mqmvs-sg/05145e9df7304a14ab421652543dd3cc~tplv-nk3i2mqmvs-image.png?lk3s=5d1a069b&x-expires=2068192431&x-signature=MZdE6%2FC5Vi3W3zm0iFe0xMIuqmM%3D) | Hierarchical source comparison |
