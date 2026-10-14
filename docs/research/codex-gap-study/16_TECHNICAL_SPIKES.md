# Technical spikes and stop conditions

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

Spikes are timeboxed evidence gathering, not a parallel feature backlog. S1 and user validation come first. S2–S6/S9 follow only after a build decision. S7/S8 are optional enrichment gates; waiting for platform approval must not block manual P0. Estimates are effort bounds for an experienced contributor, not committed deadlines or permissions to use credentials.

| ID | Question | Smallest test / input | Required output | Timebox | Stop / fallback |
|---|---|---|---|---|---|
| S1 | Native/substitute gap walkthrough | Relevant VN operator account plus competent sheet and at least one professional rundown | Document exact timing/review/host workflow and baseline burden | 2–3 researcher days plus participant availability | STOP broad desk if equivalent low-burden workflow already exists |
| S2 | Timing semantics and minimal engine | Pure domain scenario; original example + buffered demo + multiple anchors | Anchor/minimum/uncertain remaining rules produce correct previews; compare template adaptation first | 1–2 engineering days after validation | Reuse existing rundown/template if differentiation absent; no global optimizer |
| S3 | Domain/API compatibility and authority | Trace existing Store/routes and next contracts; define one command/state shape | Atomic receipt/revision/event transaction, stable identity, lifecycle freeze; explicit migration gaps | 1–2 engineering days | Reuse selected legacy pieces; do not bolt incompatible payloads together |
| S4 | Reconnect and durable note draft | Two browsers, committed revisions, dropped/duplicate/out-of-order events | Gap → snapshot; command conflict safe; pending notes survive reload without auto replay | 1–2 engineering days | One transport; do not require distributed event infrastructure for single room |
| S5 | Host View attention/device | Tablet, phone stand, monitor against native script/chat | Comprehension, delivery quality and message reduction pass report 14 | 1–2 design/test days | Remove or reduce Host View if it harms attention |
| S6 | Selected-change clone / operational learning | Actual completed intervals and explicit patch | New IDs, cleared actual/evidence, actual changed fields, anchor conflict validator; no fabricated pattern | 1 engineering day | Simple manual changes first; no ML |
| S7 | Official VN entitlement and version probe | Approved app, seller/creator credentials, granted scope, exact room/shop binding | Read-only authorization/catalog/list/minute/product request proof; 202509→202609 mapping, account coverage/freshness | 2–3 engineering days after access; approval wait unbounded | Keep manual product if denied; no unofficial fallback |
| S8 | Native export semantic mapping | Actual consented VN post-LIVE tabular export | Format, time zone, currency, metric dictionary and stable identity/granularity verified | 1 researcher/engineering day after sample | No invented CSV format; drop importer if ambiguous |
| S9 | Production trust boundary / restore | Additive schema, minimal roles, persisted events, local/pilot deployment | No open read/shared-token external deployment; recover committed state/receipts from backup | 2–3 engineering days initially; hardening later | Delay external pilot until access/isolation passes |

## API probe detail

Document app category/region, granted scope, authorized account type, request version/path, permission outcome, returned identity, time zone/currency and data latency. Redact all secrets/customer identifiers. Use catalog reads, completed-session reads and creator aggregate reads only after actual authorization. Do not infer room control from scope names or generic promotion APIs. Affiliate Get Live Room Info needs its current endpoint resolved; do not invent a guessed path.

## Event correctness detail

For incoming event with committed revision r: duplicates/older revisions at or below local revision are ignored; accept only a matching previous revision and next revision equal to local+1; otherwise fetch authoritative snapshot. A “gap greater than one” heuristic misses a single missing update. Known-then review includes only occurrence and recorded timestamps at or before cutoff; operator exposure additionally requires delivery/render evidence and is not guaranteed by server receipt.

## What not to spike yet

ML product ranking, bandits, causal GMV optimization, unofficial comment protocols, automated pin/coupon/giveaway control, multi-room scheduling, broad multi-provider factories and paid broadcast tools. Existing legacy code is evidence/reuse material; a speculative feature's existence does not make it a required V3 dependency.
