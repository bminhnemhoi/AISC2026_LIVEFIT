# LiveLift V7 provider core

Implemented on `orca/v7-provider-core`, starting at `043fc59edd4ef545e59544e74a90c5bf29701416`. This lane adds server contracts, protected provider transport, separate durable evidence, historical replay, conservative reconciliation and AI Review facts. It does not change the React experience or the REAL authority schema. Node used for certification: **22.23.3**.

## Verified official capabilities

Verification date: **2026-10-07**. Public Partner Center documentation was read through official-source search and rendered public pages in Chromium/Playwright. No private API, LIVE Manager reverse engineering, chat scraping or browser-internal inspection was used. The R&D and roadmap documents are hypotheses; this implementation corrects their flattened response assumptions.

| Capability | Official support implemented | Access/runtime qualification |
| --- | --- | --- |
| Audience concurrency | Creator aggregate snapshot, REALTIME family | Restricted `creator.data.live.read.public`; access required. No polling SLA or production access certified. |
| Minute viewers | POST_LIVE | Seller `data.shop_analytics.public.read`; minute viewers are not additive unique viewers or concurrency. |
| Product impressions / clicks | POST_LIVE | Minute and session product aggregates; no realtime product click stream. |
| Orders / GMV | POST_LIVE | `sku_orders`, decimal `gmv`; product `direct_gmv` has different provider meaning. |
| Comment count / likes / shares | POST_LIVE | Aggregate counts only. |
| Raw comment text | UNSUPPORTED | No verified official endpoint in this integration. |
| Product pin state / pin-unpin control / giveaway control | UNSUPPORTED | No verified official endpoint in this integration; operator reports remain separate. |

The typed 13-entry matrix is returned by `GET /api/v3/intelligence/status`. `support` is `REALTIME | POST_LIVE | UNSUPPORTED`; `state` also supports `ACCESS_REQUIRED | NOT_CONFIGURED`. A configured token means READY, not granted access. A successful seller observation allows POST_LIVE; Creator remains ACCESS_REQUIRED because credentials do not prove that restricted entitlement. Fixture configuration reports NOT_CONFIGURED for genuine provider capabilities and an explicit `SIMULATED / FIXTURE` label.

Verified endpoint contracts:

* [Get Shop LIVE Minute Performance](https://partner.tiktokshop.com/docv2/page/get-shop-live-minute-performance-202510): `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes`, finished LIVE only, shop official/marketing accounts, seller token, shop cipher, `currency=LOCAL`, optional `page_token`. No invented `page_size`. Response: `data.performance.overall`, `data.performance.intervals[].{start_time,end_time,sales,traffic,interactions}`, optional `data.next_page_token`. Supported fields are `sales.{gmv,sku_orders}`, `traffic.{viewers,product_impressions,product_clicks}`, `interactions.{comments,likes,shares}`.
* [Get Shop LIVE Products Performance List](https://partner.tiktokshop.com/docv2/page/get-shop-live-products-performance-list-202512): `GET /analytics/202512/shop/{live_id}/products_performance`, same seller scope. Response: `data.products[].id`, `sales.{direct_gmv,sku_orders}`, `traffic.{product_impressions,produt_clicks}`. **`produt_clicks` is the official field spelling**, not a local correction. No invented product pagination or SKU-level subrecords. Provider names are discarded; product identity requires explicit mapping.
* [Get LIVE Core Stats](https://partner.tiktokshop.com/docv2/page/get-live-core-stats-202502): `GET /analytics/202502/live_rooms/{live_room_id}/core_stats`; `data.stats.{current_visitor_count,peak_concurrent_user_count}`. The schema is corroborated by the official indexed reference; its directly rendered page was unavailable. The restricted Creator family scope/token is corroborated by [Get LIVE Room GMV Trend](https://partner.tiktokshop.com/docv2/page/get-live-room-gmv-trend-202502). Creator uses its own token and no seller cipher. No invented `is_live` field. Production permission, freshness and regional availability remain unverified.
* [Login Kit](https://developers.tiktok.com/doc/login-kit-overview/) and [Scopes](https://developers.tiktok.com/doc/scopes-overview/): the existing identity login is separate from Shop seller/creator authorization. Login Kit does not authorize this telemetry.

No 24–48 hour settlement guarantee, regional onboarding guarantee or eligibility threshold is assumed. Unsupported means LiveLift has no verified implementation, not a universal assertion about every TikTok partner program.

## Architecture and configuration

`contracts/liveIntelligence.ts` is the exact closed wire schema. `domain/liveIntelligence.ts` is a pure reconciliation overlay; `domain/asKnownThen.ts` replays record-time authority events. `server/liveIntelligence/provider.ts` implements `LiveMetricsProvider` and `ProductPerformanceProvider` through `TikTokShopProvider`. `service.ts` owns authenticated eligibility, mapping, idempotency and receipt-time checks. `store.ts` owns evidence, never credentials. Existing Login Kit, authority, AI and authentication remain in use.

| Server environment variable | Default / purpose |
| --- | --- |
| `LIVELIFT_INTELLIGENCE_MODE` | `off`; explicitly select `real` or `fixture`. |
| `LIVELIFT_PROVIDER_EVIDENCE_DB_PATH` | Absolute `provider-evidence.sqlite` beside `LIVELIFT_DB_PATH`. Must differ from room/credential databases. |
| `LIVELIFT_TIKTOK_SHOP_APP_KEY` | Partner Center application identity; required for real mode. |
| `LIVELIFT_TIKTOK_SHOP_APP_SECRET` | Server-only signing secret; required for real mode. |
| `LIVELIFT_TIKTOK_SHOP_ACCESS_TOKEN` | Seller access token, `user_type=0`; required for real mode. |
| `LIVELIFT_TIKTOK_SHOP_CIPHER` | Authorized shop cipher; required for real mode. |
| `LIVELIFT_TIKTOK_CREATOR_ACCESS_TOKEN` | Optional restricted Creator token, `user_type=1`; Creator snapshot only. |
| `LIVELIFT_TIKTOK_SHOP_INTERVAL_POLICY` | `unverified`; `half_open_confirmed` only after interval semantics are independently confirmed for the deployment. |

Existing workspace/room/origin/DB/auth environment variables still apply. Only placeholders are added to `next/.env.production.example`. No base URL override exists. Keep the administrator environment file protected. No credential values appear in status, browser storage, errors, analytics tables or logs. No local Partner Center credentials were used during implementation or certification.

To connect later: obtain approval for seller analytics in Partner Center, authorize the intended shop, provision the four required seller values in the protected server environment, set `mode=real`, and restart. Map a completed REAL LiveLift show to its explicit TikTok numeric LIVE id in an operator refresh command. Map local product ids to provider product ids explicitly. Verify scope, account class, region and receipt freshness with the authorized account; configure interval policy only with evidence. Creator authorization is separate and optional. Token renewal is an administrator/Partner Center concern in this version; AUTH_EXPIRED is truthful and does not trigger automatic renewal or fixture fallback.

## Request signing and transport

Pure `signTikTokShopRequest(path, query, secret, bodyBytes?, contentType?)` follows [Sign your API request](https://partner.tiktokshop.com/docv2/page/sign-your-api-request): exclude `sign` and `access_token`, sort decoded query names, concatenate path plus names/values, append exact body bytes except multipart, wrap in the application secret, HMAC-SHA256 with the same secret, return lowercase hex. Tokens use `x-tts-access-token`. The official published GET vector is an independent regression test. POST exact-byte and multipart exclusions are tested even though these analytics calls are GET.

[Common parameters](https://partner.tiktokshop.com/docv2/page/678e3a4278f4c20311b8b57e) define UTC Unix seconds and timestamp tolerance. Each request signs a fresh second timestamp after pacing. [Official error codes](https://partner.tiktokshop.com/docv2/page/678e3a45786253031531b942) inform normalized auth, access, throttling and timeout states; reused/ambiguous codes remain UNAVAILABLE. Upstream messages, request ids, arbitrary JSON and bodies are never returned to the browser.

Transport uses the fixed `https://open-api.tiktokglobalshop.com` origin and numeric-id paths, rejects redirects, has a 10-second header/body deadline and a 2 MiB decoded body limit, requires JSON/fatal UTF-8, validates documented fields and drops extras. Negative/noninteger/unsafe counts, timestamp overflow, invalid decimal/currency values, conflicting duplicate intervals/products, overlapping buckets, repeated page tokens and more than 30 pages/3000 buckets/1000 products are rejected. Missing/null documented metrics remain missing. Calls are paced at least five seconds apart within a refresh; the room permits one in-flight refresh and four new commands per minute. No hidden retries or REAL fixture fallback.

## Durable evidence and isolation

The separate SQLite store is schema **v1**, `user_version` checked; unknown nonempty schemas fail closed. Database files are `0600`, newly created directories `0700`, parent ownership/write permissions and symlinks/hardlinks checked. Full synchronous transactions, rollback journaling and a busy timeout protect command completion plus snapshot insertion atomically. No analytics table or migration is added to the room schema.

Tables: immutable workspace/room metadata; immutable generation/session/mode/provider-shop mappings; append-only snapshots; append-only Creator receipt records; idempotent refresh command claims/results. Database triggers block updates/deletes of evidence. New refresh ids append new snapshot UUIDs and fetched timestamps. Replays of the same actor, context and exact intent return the original result; reuse for another intent/actor/context is a conflict. Interrupted pending work is `UNAVAILABLE/outcome_unknown`, not failed and not silently re-executed. While a live in-process request exists it is FETCHING.

All reads/writes are scoped to the existing workspace, room, generation, session and REAL/SIMULATED environment. Mapping a provider session to another show or changing a show's established provider/shop mapping fails closed. Restored generations cannot consume old evidence; prior physical records remain auditable. The administrator's existing explicit workspace deletion now verifies evidence-store ownership and erases that separate store too. Existing room backup/restore is unchanged; the separate evidence file needs its own administrator backup if retention is required. Copy it with the app stopped or SQLite backup tooling, not while a refresh writes it.

## Exact JSON contract

All timestamps below are nonnegative integer **UTC epoch milliseconds**. Counts are nonnegative safe integers. Missing optional fields or explicit `null` are not zero. All provider facts use `evidenceTier: "provider_observed"`, including fixtures whose source/mode clearly identify simulation. `platform_confirmed` is not a permitted provider tier.

```ts
type Availability = "available" | "missing" | "unknown" | "unsupported";
type Source = "tiktok_shop" | "tiktok_creator" | "fixture";
type Money = { amount: string; currency: string }; // decimal major units; ISO 3-letter currency
type Ratio = { numerator: string; denominator: string; currency?: string }; // exact integers; denominator > 0
type ProviderMetric = {
  key: string; value: number | Money | Ratio | null; unit: string;
  availability: Availability; source: Source; evidenceTier: "provider_observed";
  observedAt: number; providerWindowStart?: number; providerWindowEnd?: number;
  note?: string; calculation?: "COMPUTED FROM PROVIDER-OBSERVED DATA";
};
type MinuteEvidenceBucket = {
  startMs: number; endMs: number; reportedEndMs?: number;
  viewers?: number | null; impressions?: number | null; clicks?: number | null;
  orders?: number | null; gmv?: Money | null; comments?: number | null;
  likes?: number | null; shares?: number | null;
  source: Source; evidenceTier: "provider_observed"; observedAt: number;
  timing: "half_open" | "unverified_bounds";
};
type SegmentAttribution = {
  segmentId: string; title: string; plannedDurationMs: number | null;
  actualStartMs?: number; actualEndMs?: number;
  coverage: "complete" | "partial" | "ambiguous" | "none";
  metrics: ProviderMetric[];
  ambiguousBuckets: { startMs: number; endMs: number;
    reason: "segment_boundary" | "unknown_timing" | "overlapping_actual_windows" }[];
  limitations: string[];
};
type ProductPerformance = {
  productId?: string; skuId?: string; productLabel?: string;
  impressions?: number | null; clicks?: number | null; orders?: number | null;
  gmv?: Money | null; ctor?: Ratio | null; availability: Availability;
  source: Source; observedAt: number; evidenceTier: "provider_observed";
  association: "contextual" | "ambiguous" | "session_only";
  segmentId?: string; limitations: string[];
};
type LiveIntelligenceSnapshot = {
  snapshotId: string; sessionId: string; sessionRevision: number;
  mode: "REAL" | "SIMULATED"; perspective: "later_evidence";
  provider: Source; providerSessionId: string; fetchedAt: number;
  providerWindow?: { startMs: number; endMs: number };
  minuteBuckets: MinuteEvidenceBucket[]; segmentAttributions: SegmentAttribution[];
  productPerformance: ProductPerformance[];
  productMappings: { liveLiftProductId: string; providerProductId: string }[];
  evidenceLimits: string[]; reconciliationVersion: "livelift.attribution.v1";
};
```

Decimal amounts accept up to 30 integer digits and six fraction digits; no exponent, sign, separators or JS monetary number. BigInt coefficients align scales for addition. Different currencies or out-of-range sums become unknown, never summed/coerced. Rational rates remain exact; UI rounding is display-only. A real zero amount/count remains available. `availability=available` requires a nonnull metric value; every other availability requires null. Snapshot validation also enforces every nested source matches the snapshot's mode/source. `skuId` is reserved in the shared contract but these verified endpoints do not populate unsupported SKU records.

## Authenticated APIs

Use the existing cookie, `X-LiveLift-Workspace`, `X-LiveLift-Generation` context and mutation `Origin` / `X-LiveLift-Request: 1` checks. No second auth model. Viewers may GET REAL evidence/status just as they read existing review data. Operator required for refresh and browser-local SIMULATED POST reads. The server rereads authentication, generation and REAL session revision after slow provider requests before committing.

* `GET /api/v3/intelligence/status` → `{provider:"tiktok_shop",state,mode,configIssues:string[],capabilities,fixtureLabel}`. States: NOT_CONFIGURED, READY, FETCHING, AVAILABLE, UNAVAILABLE, AUTH_EXPIRED, RATE_LIMITED, ACCESS_NOT_GRANTED, UNSUPPORTED. Global status describes configuration; session evidence status includes its latest refresh outcome and reports NOT_CONFIGURED when the configured provider mode cannot serve that session environment.
* `POST /api/v3/intelligence/refresh` body: `{commandId:UUID,roomId,sessionId,expectedSessionRevision,providerSessionId?,productMappings?:[],fixtureCase?,session?,action?:"post_live"|"creator_snapshot"}`. Default post_live; REAL must exist in the room and explicitly provide the provider LIVE id, cannot supply browser REAL state or fixtureCase. Completed/start/end records required for post-live. Creator snapshots require active lifecycle. SIMULATED supplies its existing browser-local validated session and requires mode=fixture. Product mappings must use unique stable local/provider ids from the show's product pack.
* Refresh success → `{state:"AVAILABLE",duplicate:boolean,snapshot}` or `{state:"AVAILABLE",duplicate:boolean,telemetry}`. Creator telemetry is `{telemetryId,sessionId,mode,providerSessionId,observedAt,recordedAt,metrics}`. Its provider response has no timestamp: both timestamps explicitly mean receipt on the authority clock (virtual clock for fixture rehearsal).
* Refresh provider failure → `{state,code,duplicate:boolean,retryAfterSec?}`. Codes: `not_configured | access_not_granted | auth_expired | rate_limited | timeout | network | malformed_response | response_too_large | upstream_unavailable | unsupported | outcome_unknown`. Provider availability failures are HTTP 200 application outcomes, with Retry-After when known. Request/auth/room/revision conflicts use existing HTTP 400/401/403/404/409/429 conventions.
* `GET /api/v3/intelligence/evidence?roomId=...&sessionId=...&perspective=later_evidence[&snapshotId=UUID]` → `{sessionId,mode,perspective,snapshot:Snapshot|null,status,priorSnapshots:{snapshotId,fetchedAt}[]}`. History lists at most the last 100, while older known UUIDs remain readable under the same context. Later evidence requires an ended show; a null snapshot is absence, not zero or success.
* The same GET with `perspective=as_known_then&asOfMs=...` → `{sessionId,mode,perspective,asOfMs,plan,runtime,events,evidenceLimits,providerEvidence:CreatorEvidence[]}`. Starts at recorded LIVE start. No `snapshot` property and no post-LIVE provider metrics.
* `POST /api/v3/intelligence/evidence` accepts the same read fields plus `session` for a validated browser-local SIMULATED rehearsal. Existing mutation authentication applies; no authority writes occur.

Duplicate/unknown query keys, oversized bodies, malformed timestamps/UUIDs and wrong context fail closed. UI should distinguish configuration absence from access denial, and display provider provenance, fetched time, temporal coverage and metric availability separately.

## Reconciliation and attribution

Actual starts/ends come only from authoritative segment run records. Baseline target duration stays planned; revisions do not turn targets into performed timing or move anchors. Not-reached segments have no invented actual window. Incomplete windows remain partial/ambiguous. Reconciliation only reads the session and creates a separate snapshot.

For each actual window, consider overlapping provider buckets. A bucket is assignable only when it has verified half-open bounds, is wholly contained in exactly one actual segment, and no overlapping actual window competes for it. Otherwise it remains in `minuteBuckets`, with references in `ambiguousBuckets`. **Never split clicks, orders or money proportionally.** Unambiguous contained values may be presented under partial/ambiguous coverage, with explicit limitations that they are not segment totals. No allocatable buckets yields null, never inferred zero.

Complete means contiguous buckets exactly cover the recorded window; partial means some usable temporal coverage/gaps; ambiguous means boundary/clock/window uncertainty; none means no actual window or no evidence. Complete describes time coverage, not completeness of every metric: if any contained bucket omits a metric, its total is missing. Overlapping provider intervals are rejected rather than double counted.

The official sample includes equal start/end timestamps and does not specify exclusive/inclusive end rules. Under default `unverified`, retain `reportedEndMs`, use a conservative 60-second envelope and mark affected attribution ambiguous. An explicit independently confirmed policy allows nonzero half-open intervals; equal endpoints remain unverified. Synthetic fixtures explicitly declare half-open windows. No timezone-dependent parsing occurs: provider UTC seconds become UTC milliseconds; the show's display timezone does not shift them.

Product performance remains session-level. One explicitly mapped product with one timed rundown occurrence receives `association=contextual` and segmentId; this is context, not proof of segment sales. Repeats or incomplete timed occurrences are ambiguous; no explicit identity/unmatched id is session_only. Titles alone never establish identity. Product direct GMV is never mixed into minute GMV.

Derived clicks/orders/impressions/GMV per minute and click-through ratio require complete temporal coverage and the necessary nonmissing inputs. Zero denominators produce null/unknown, not infinity. Exact rationals and `calculation=COMPUTED FROM PROVIDER-OBSERVED DATA` label calculations. Minute viewers use a maximum, never an additive sum. Existing domain review remains responsible for operational overrun calculations.

## Historical perspectives and AI boundary

AS KNOWN THEN replays append-only events whose **recordedAtMs** is at/before the requested cutoff; occurredAtMs does not make a late report known early. Only plans referenced by known events plus the recorded baseline are included. Starts/ends, remaining estimates, attempted/performed/cancelled cue/action reports and accepted operational changes retain their recorded distinction. Corrections are append-only; originals are not rewritten. Pre-LIVE draft edits are not fully event sourced, so replay explicitly begins at LIVE start.

Only Creator aggregate receipt records actually stored during that LIVE, with recorded/observed times at/before the cutoff, can appear as historical provider evidence. Records fetched later, even if their provider window overlaps the LIVE, cannot appear. Creator timestamps represent local receipt, not a provider event timestamp. Post-LIVE snapshots remain completely outside this replay.

WITH LATER EVIDENCE reads an immutable reconciliation snapshot with fetchedAt and sessionRevision. The authority session/history is unchanged. Prior versions remain separately addressable.

AI Review's route selects the latest server snapshot. Matching session/mode/revision is required; provider facts retain `evidenceTier=provider_observed`, source, fetchedAt and later_evidence. Complete windows supply a bounded set of exact facts and observational comparisons. Partial/ambiguous/missing windows supply limits. Fixture AI facts say SIMULATED / FIXTURE. Existing presentation `kind` remains recorded/simulated for wire compatibility; it does not change the explicit provider evidence tier.

Model output must quote quantitative provider facts exactly with their own fact citations; it cannot move numbers between metrics, windows or perspectives. Causal or platform-confirmation statements are rejected. Review prompts explicitly forbid hindsight claims about operator knowledge. AI Operate does not load snapshots and ignores an injected laterEvidence dependency. Numeric telemetry claims without Review's exact provider facts are refused even when an unrelated number appears elsewhere in the prompt. No provider evidence can imply acceptance, attempt, performance or external control.

## Certification and limits

The security gate also upgrades the existing development runner to pinned Vitest 4.1.11, removing the vulnerable Tinypool dependency and correcting the mocker advisory. The [official migration guide](https://v4.vitest.dev/guide/migration) confirms the worker replacement. Existing tests and assertions are retained. The test-only fake room installs a fresh fetch callable so nested request spies stay independent under Vitest 4; worker concurrency is bounded to four on shared hosts.

Four new test files cover provider normalization/signing/transport, domain reconciliation/history, persistence/auth APIs and adversarial AI output. Deterministic official-shape fixtures cover all 15 required scenarios: normal, zero/missing clicks, zero/missing GMV, crossing boundary, not reached, repeated/unknown product, malformed response, rate limit, auth expired, empty LIVE data, aggregate comments without text and Creator viewer snapshot. All are explicitly synthetic. REAL adapter route tests inject typed observations only inside tests; they are not production credential certification.

Run on Node 22.23.3:

```sh
cd next
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
npm run test:provider-fixtures
```

The executable uses the existing disposable production runtime, protected fresh databases and HTTPS cookie authentication. It certifies live HTTP APIs, idempotency/history, historical isolation, normalized failure, all fixture cases and REAL refusal of fixture fallback. It clears inherited provider variables, uses no real credentials, removes its runtime, and writes nonsecret evidence under `/tmp/livelift-v7-certification` (optional output path argument).

Real access blockers: no confirmed seller analytics/Creator authorization; current official interval-boundary semantics need confirmation before precise REAL segment totals; no production Partner Center request or settlement latency can be certified without authorized credentials. Reconciliation, storage, transport and fixture/API certification are ready for UI integration. Raw chat, realtime click stream, pin/unpin and giveaway automation remain outside the verified official capability set.

## Validation record and changed files

Certification on Node 22.23.3: clean `npm ci`; typecheck, lint and production build pass; 58 test files pass with 944 tests passed and 57 pre-existing conditional skips. The four new suites contain 94 tests. The executable production HTTPS/API acceptance passes all 15 fixture cases. Production npm audit and the all-lockfile OSV scan report zero vulnerabilities; staged gitleaks reports zero secrets. No actual Partner Center credentials or real TikTok analytics requests were used.

The committed change touches these 34 files (no product React component changes):

* `docs/tiktok/LIVE-INTELLIGENCE-IMPLEMENTATION.md`
* `next/.env.production.example`
* `next/acceptance/final-runtime.mjs`
* `next/acceptance/provider-fixtures.mjs`
* `next/package-lock.json`
* `next/package.json`
* `next/src/__tests__/helpers/fakeRoom.ts`
* `next/src/app/api/v3/ai/review/route.ts`
* `next/src/app/api/v3/intelligence/evidence/route.ts`
* `next/src/app/api/v3/intelligence/refresh/route.ts`
* `next/src/app/api/v3/intelligence/status/route.ts`
* `next/src/contracts/ai.ts`
* `next/src/contracts/liveIntelligence.ts`
* `next/src/lib/ai/context.ts`
* `next/src/lib/ai/output.ts`
* `next/src/lib/ai/prompt.ts`
* `next/src/lib/ai/providerFacts.ts`
* `next/src/lib/domain/asKnownThen.ts`
* `next/src/lib/domain/liveIntelligence.ts`
* `next/src/lib/server/ai/service.ts`
* `next/src/lib/server/http.ts`
* `next/src/lib/server/liveIntelligence/ai.test.ts`
* `next/src/lib/server/liveIntelligence/attribution.test.ts`
* `next/src/lib/server/liveIntelligence/config.ts`
* `next/src/lib/server/liveIntelligence/fixtureSession.ts`
* `next/src/lib/server/liveIntelligence/fixtures.ts`
* `next/src/lib/server/liveIntelligence/provider.test.ts`
* `next/src/lib/server/liveIntelligence/provider.ts`
* `next/src/lib/server/liveIntelligence/service.test.ts`
* `next/src/lib/server/liveIntelligence/service.ts`
* `next/src/lib/server/liveIntelligence/signing.ts`
* `next/src/lib/server/liveIntelligence/store.ts`
* `next/src/lib/server/operations.ts`
* `next/vitest.config.ts`
