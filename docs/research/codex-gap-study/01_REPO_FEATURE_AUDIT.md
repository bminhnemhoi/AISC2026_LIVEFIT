# Repository feature audit

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

## Audit method and proof standard

Structural exploration used codebase-memory search, caller/callee tracing and source snippets, followed by direct reads for documentation, contracts and parse gaps. Index generation was 2026-10-04T09:01:22Z: 9,935 nodes / 33,614 edges. Coverage was checked for `src/livelift`, `web`, `next/src`, `tests`, `collectors`, `scripts`, `docker`, `ops`, `docs`, `references` and the root brief documents. Partial lines in Operate (705/767), Review (486), Integrations (64), Sessions (98) and migration 0001 (64) were read directly. Image files and dependency/build folders are not fully graph-indexed. A clean coverage result is best-effort, not proof of completeness.

Classification has two axes: **implementation status** and **V3 disposition**. ACTUALLY WORKING means an implemented local flow with tests or historical execution evidence; it does not mean this audit exercised production. PARTIALLY WORKING means substantive logic with incomplete end-to-end delivery. DEMO-ONLY means fixture/local demonstration. EXPERIMENTAL means research/calibration work. ASPIRATIONAL means specifications or schema placeholders. BROKEN names a demonstrated source inconsistency, not a missing dependency. OBSOLETE applies to assumptions/architecture for the new journey, not a blanket dismissal of legacy code. REBUILD and REMOVE are recommendations, not changes made here.

Inventory excluding installed dependencies and generated caches: src/livelift 96 files; web 69; next 61; tests 135; collectors 4; scripts 24; docker 5; ops 4; docs 177; references 1. These are file counts, not working feature counts. Inspected important flows and test boundaries below; this is not a line-by-line security certification of every file.

| FEATURE | STATUS | REPOSITORY EVIDENCE | V3 DISPOSITION | FINDING / LIMIT |
|---|---|---|---|---|
| Legacy session creation/start/end/cancel | ACTUALLY WORKING at source level; historical regression evidence | [src/livelift/api/routes/sessions.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/sessions.py:121),260,292; [tests/test_vong_doi_phien.py](/home/towfienes/Projects/LiveLift-next/tests/test_vong_doi_phien.py) | VALUABLE REUSABLE CODE / REBUILD contract | Keep transition guards and idempotent terminal behavior; remove schedule prerequisite from manual P0. |
| Exact action session/product identity | ACTUALLY WORKING at source level | [src/livelift/api/routes/actions.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/actions.py:170); [tests/test_actions_scoping.py](/home/towfienes/Projects/LiveLift-next/tests/test_actions_scoping.py) | VALUABLE DOMAIN LESSON / REUSE tests | No silent retargeting when candidates change. |
| Legacy execute pin / autopilot | BROKEN as a platform-execution claim; local bookkeeping works | actions.py:170–285 → store/add_exposure/publish; [api/autopilot.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/autopilot.py) | REMOVE from V3 runtime | No provider network call on traced path. executed=True does not prove pinning. |
| Legacy product catalog / stock / shortlinks | PARTIALLY WORKING | [api/store.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/store.py); [routes/sessions.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/sessions.py); [routes/redirect.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/redirect.py) | REUSE narrow import/validation lessons | Global catalog is not a tenant-safe PIM or durable session Product Pack. |
| Legacy runsheet JSON column | PARTIALLY WORKING / ASPIRATIONAL as a timing engine | [migrations/0001_init.up.sql](/home/towfienes/Projects/LiveLift-next/src/livelift/migrations/0001_init.up.sql:30); [store.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/store.py:1191) | REBUILD | Storage field is not hard anchors, drift, or a runnable commerce rundown. |
| Legacy experimental schedule | EXPERIMENTAL; substantive implemented logic | [core/assigner/outer.py](/home/towfienes/Projects/LiveLift-next/src/livelift/core/assigner/outer.py); [tests/test_assigner_outer.py](/home/towfienes/Projects/LiveLift-next/tests/test_assigner_outer.py) | VALUABLE REUSABLE CODE, outside P0 | Randomized blocks are not show segments. Preserve the research separately. |
| Inner randomized choice / propensity | EXPERIMENTAL; implemented | [core/assigner/inner.py](/home/towfienes/Projects/LiveLift-next/src/livelift/core/assigner/inner.py); [tests/test_assigner_inner.py](/home/towfienes/Projects/LiveLift-next/tests/test_assigner_inner.py) | DEFER commercial use | Useful experiment integrity; not proof a recommended product increases sales. |
| Gamma-Poisson candidates / cards | EXPERIMENTAL / partially aligned explanation | [api/cards.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/cards.py:115),174; [tests/test_cards_gamma_poisson.py](/home/towfienes/Projects/LiveLift-next/tests/test_cards_gamma_poisson.py) | REBUILD recommendation policy | Ranks by posterior click exposure but visible rationale cites margin/stock. V3 must explain actual timing rule. |
| Operator queue / coverage / NOW-NEXT-WHY | ASPIRATIONAL legacy; DEMO-ONLY rebuild | [docs/product/04_OPERATE.md](/home/towfienes/Projects/LiveLift-next/docs/product/04_OPERATE.md); [next/src/app/live/[sessionId]/operate/page.tsx](/home/towfienes/Projects/LiveLift-next/next/src/app/live/[sessionId]/operate/page.tsx) | STRENGTHEN / simplify | Rebuild has UI and local mutations; no real cross-client queue service. |
| Legacy Host View | PARTIALLY WORKING; historical browser evidence | [web/src/app/host/page.tsx](/home/towfienes/Projects/LiveLift-next/web/src/app/host/page.tsx); [web/src/lib/useHost.ts](/home/towfienes/Projects/LiveLift-next/web/src/lib/useHost.ts) | VALUABLE DOMAIN LESSON / REBUILD | Already exists. Old blinding deliberately hides block countdown. New commerce cues require a different projection. |
| Legacy desk, polling, WebSocket | PARTIALLY WORKING | [web/src/app/desk/page.tsx](/home/towfienes/Projects/LiveLift-next/web/src/app/desk/page.tsx); [api/routes/ws.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/ws.py); store.Broadcaster | REUSE envelope lessons | In-process pubsub is not durable cross-worker event delivery. |
| Memory Store locks / optional snapshot | PARTIALLY WORKING | [api/store.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/store.py); [tests/test_store_dong_thoi.py](/home/towfienes/Projects/LiveLift-next/tests/test_store_dong_thoi.py) | REUSE selected guards | Thread safety and JSON backup are useful; do not acknowledge durable production writes solely because memory changed. |
| PostgreSQL Store / migrations | PARTIALLY WORKING, historical outage tests | [api/store.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/store.py:995); src/livelift/migrations; [tests/test_kho_chet_giua_phien.py](/home/towfienes/Projects/LiveLift-next/tests/test_kho_chet_giua_phien.py) | VALUABLE REUSABLE CODE / additive V3 schema | StoreUnavailable handling is valuable. V3 command+revision+event transaction is not established by old APIs. |
| Ingest supervisor / spool / restart | PARTIALLY WORKING | [api/ingest_jobs.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/ingest_jobs.py:401),468; [ingest/runner.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/runner.py); [ingest/spool_replay.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/spool_replay.py) | REUSE later | Simulation admission guards and classified failures survive; no P0 comments ingestion requirement. |
| TikTok seller LIVE analytics client | PARTIALLY WORKING; mocked/signing tests | [ingest/tiktok_shop.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/tiktok_shop.py:910),977,1028; [tests/test_ingest_tiktok_shop.py](/home/towfienes/Projects/LiveLift-next/tests/test_ingest_tiktok_shop.py) | VALUABLE REUSABLE CODE / version spike | HMAC, paging, redaction, errors exist. No live authorized VN success established here; 202609 seller versions require review. |
| TikTok catalog import | ASPIRATIONAL in prior plans | No catalog-sync method in [ingest/tiktok_shop.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/tiktok_shop.py); [next/src/contracts/product.ts](/home/towfienes/Projects/LiveLift-next/next/src/contracts/product.ts) | INTEGRATE later | Product Basic official API exists; requires new connector path and access verification. |
| Shopee client / update_show_item | PARTIALLY WORKING integration; experimental control | [ingest/shopee.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/shopee.py); [tests/test_ingest_shopee.py](/home/towfienes/Projects/LiveLift-next/tests/test_ingest_shopee.py) | DEFER / reusable signing lessons | Real request method exists; legacy autopilot does not call it. No authorized current success tested. |
| YouTube / Facebook observation | PARTIALLY WORKING | [ingest/youtube.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/youtube.py); [ingest/facebook.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/facebook.py); dated official API reports | DEFER connectors | Credential, quota and schema distinctions survive. Do not port unofficial fallback as a product dependency. |
| Public TikTok collector | EXPERIMENTAL / isolated research only | [collectors/tiktok_public/README.md](/home/towfienes/Projects/LiveLift-next/collectors/tiktok_public/README.md); collect.py; [scripts/check_isolation.py](/home/towfienes/Projects/LiveLift-next/scripts/check_isolation.py) | REMOVE from launch scope; retain archive | Unofficial protocol. Core is intentionally isolated; no need to delete historical research. |
| YouTube replay ingest | PARTIALLY WORKING; external downloader dependency | [api/routes/replays.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/replays.py:115); [ingest/youtube_replay.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/youtube_replay.py) | DEMOTE / reuse observability lessons | Creates ended analysis-only sessions; synthetic tempo ticks cannot be viewer measurements. |
| Signal presence / gaps / quality | VALUABLE DOMAIN LESSON; implemented code | [core/signals.py](/home/towfienes/Projects/LiveLift-next/src/livelift/core/signals.py); [core/quality.py](/home/towfienes/Projects/LiveLift-next/src/livelift/core/quality.py); [tests/test_signals.py](/home/towfienes/Projects/LiveLift-next/tests/test_signals.py) | REUSE selectively | No source is different from measured zero. Keep contextual availability; remove always-visible diagnostic walls. |
| Moment / intent radar | EXPERIMENTAL | [core/moments.py](/home/towfienes/Projects/LiveLift-next/src/livelift/core/moments.py); [nlp/intent.py](/home/towfienes/Projects/LiveLift-next/src/livelift/nlp/intent.py); [docs/benchmarks/intent-eval/results.md](/home/towfienes/Projects/LiveLift-next/docs/benchmarks/intent-eval/results.md) | DEFER / remove from P0 | Historical held-out/domain shift matters more than synthetic CV. No current validated host cue dependence. |
| PII scrubber / normalization | VALUABLE REUSABLE CODE; bounded benchmark | [ingest/pii/filter.py](/home/towfienes/Projects/LiveLift-next/src/livelift/ingest/pii/filter.py); [tests/test_pii_filter.py](/home/towfienes/Projects/LiveLift-next/tests/test_pii_filter.py) | KEEP internal when text ingest returns | Reported recall is not general compliance or proof every note is anonymized. |
| Redirect click validity / GIVT flags | ACTUALLY WORKING at source level, historical tests | [core/click_validity.py](/home/towfienes/Projects/LiveLift-next/src/livelift/core/click_validity.py); [routes/redirect.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/redirect.py); [tests/test_click_validity.py](/home/towfienes/Projects/LiveLift-next/tests/test_click_validity.py) | KEEP research module / DEFER product | Self-hosted valid clicks per viewer-second differ from TikTok native CTR. |
| Order ingest / CSV / dedupe | PARTIALLY WORKING | [api/routes/orders.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/orders.py); [tests/test_don_hang.py](/home/towfienes/Projects/LiveLift-next/tests/test_don_hang.py) | REUSE parsing later, not OMS | No customer addresses needed for operational P0. Order timestamp alone does not identify a LIVE room. |
| Estimators / carryover / SRM / power | EXPERIMENTAL, substantial research implementation | analysis/**; [PREREGISTRATION.md](/home/towfienes/Projects/LiveLift-next/PREREGISTRATION.md); [tests/test_estimators.py](/home/towfienes/Projects/LiveLift-next/tests/test_estimators.py); [test_power.py](/home/towfienes/Projects/LiveLift-next/tests/test_power.py) | PRESERVE / DEFER | Preregistration still draft. Outcomes, assignment and observation validity gate any causal claim. |
| Legacy seeded statistical simulator | ACTUALLY WORKING research model; historical reports | [sim/simulator.py](/home/towfienes/Projects/LiveLift-next/src/livelift/sim/simulator.py:230); [sim/validate.py](/home/towfienes/Projects/LiveLift-next/src/livelift/sim/validate.py); [tests/test_sim_validation.py](/home/towfienes/Projects/LiveLift-next/tests/test_sim_validation.py) | VALUABLE REUSABLE CODE outside P0 operational sim | Simulates clicks/carryover, not the exact new operator command state machine. |
| Reports / narrative exports | PARTIALLY WORKING | [api/routes/reports.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/routes/reports.py); [analysis/narrate.py](/home/towfienes/Projects/LiveLift-next/src/livelift/analysis/narrate.py); web/src/app/bao-cao/[id] | REBUILD operational review | Keep qualified evidence language; remove mandatory causal scoreboard. |
| Legacy multi-user / tenant permissions | ASPIRATIONAL; production boundary missing | [api/auth.py](/home/towfienes/Projects/LiveLift-next/src/livelift/api/auth.py); store global products | REBUILD before external service | Shared write token; reads open; blank token disables write auth. Not workspace roles or host read authorization. |
| Docker / Caddy / backup / restore | VALUABLE REUSABLE CODE; historical drills not rerun | docker/Caddyfile; [docker-compose.yml](/home/towfienes/Projects/LiveLift-next/docker-compose.yml); [scripts/khoi_phuc_sao_luu.py](/home/towfienes/Projects/LiveLift-next/scripts/khoi_phuc_sao_luu.py) | REUSE with production gate | Explicit durable backend, internal ports and backup lessons matter; deployment is not verified by file existence. |
| Operational journals / runbooks | VALUABLE DOMAIN LESSON | [ops/runbooks/quy-trinh-phien.md](/home/towfienes/Projects/LiveLift-next/ops/runbooks/quy-trinh-phien.md); ops/templates/** | STRENGTHEN simpler workflow | Role handoffs and known incident discipline transfer; automatic-pin wording and experimental blinding do not. |
| next contracts / semantic labels | PARTIALLY WORKING; 21 tests pass | next/src/contracts/**; next/src/components/ui/** | VALUABLE REUSABLE CODE | Zod schemas and visible environment/source treatment are a foundation, not real data flow. |
| next Create / Prepare | DEMO-ONLY functional fixture prototype | next/src/app/live/new; next/src/app/live/[sessionId]/prepare | STRENGTHEN | Direct singleton simulator calls; unknown-route fixture fallback must be removed. |
| next Operate runtime | DEMO-ONLY; mutation guards incomplete | [next/src/lib/simulator/simulatorEngine.ts](/home/towfienes/Projects/LiveLift-next/next/src/lib/simulator/simulatorEngine.ts); [operate/page.tsx](/home/towfienes/Projects/LiveLift-next/next/src/app/live/[sessionId]/operate/page.tsx) | REBUILD domain authority | Client methods lack consistent revisions, lifecycle validation and event recording. |
| next hard anchors / cascading forecast | ASPIRATIONAL | [next/src/contracts/runOfShow.ts](/home/towfienes/Projects/LiveLift-next/next/src/contracts/runOfShow.ts) | BUILD after validation | plannedOffset and duration exist; fixed-start/minimum/compressibility/projected timing do not. |
| next platform report semantics | BROKEN | [next/src/lib/simulator/simulatorEngine.ts](/home/towfienes/Projects/LiveLift-next/next/src/lib/simulator/simulatorEngine.ts) reportPlatformAction | FIX in authorized future work | String includes(pin) also matches unpin; attempt can set reported pinned state before performed evidence. |
| next real API adapter | PARTIALLY WORKING / unintegrated | [next/src/lib/api/apiClient.ts](/home/towfienes/Projects/LiveLift-next/next/src/lib/api/apiClient.ts) | RECONCILE | Real fetch/Zod path exists but core pages bypass it. Legacy prefix may be proxied, response schemas still differ. |
| next realtime client | DEMO-ONLY | [next/src/lib/realtime/realtimeClient.ts](/home/towfienes/Projects/LiveLift-next/next/src/lib/realtime/realtimeClient.ts) | REBUILD | In-process listeners and simulator resync; no cross-browser transport. |
| next offline drafts | PARTIALLY WORKING UI; BROKEN durability promise | [next/src/lib/storage/draftStore.ts](/home/towfienes/Projects/LiveLift-next/next/src/lib/storage/draftStore.ts) | REBUILD minimal durable notes | Memory array; local submitted flag has no server receipt. Reload loses pending notes. |
| next Wrap / ended session | DEMO-ONLY; freeze aspirational | next/src/app/live/[sessionId]/wrap; simulator.endLive | STRENGTHEN | End sets timestamps; shared mutation methods can still change ended runtime. |
| next semantic replay / As Known Then | DEMO-ONLY | [next/src/contracts/replay.ts](/home/towfienes/Projects/LiveLift-next/next/src/contracts/replay.ts); [review/page.tsx](/home/towfienes/Projects/LiveLift-next/next/src/app/live/[sessionId]/review/page.tsx); simulator.getReplay | REBUILD from real events | Fixture returns do not reconstruct actual commands or original operator-delivered state. Review filters an isLate flag, not occurrence/receipt cutoffs at a selected moment (review lines 77–89). |
| next Later Evidence / learning objects | DEMO-ONLY | [next/src/contracts/learning.ts](/home/towfienes/Projects/LiveLift-next/next/src/contracts/learning.ts); simulator.getLearning | SIMPLIFY / STRENGTHEN | Use operational observation + selected patch; avoid four mandatory conceptual steps. |
| next Next LIVE clone | PARTIALLY WORKING fixture operation | simulatorEngine.createSession(startingPoint="clone"):156; [review/page.tsx](/home/towfienes/Projects/LiveLift-next/next/src/app/live/[sessionId]/review/page.tsx:128); nextLiveChanges | REBUILD exact apply contract | Create clones source segments and clears their actual times. Review CTA only navigates to /live/new; New uses a hard-coded source session. Selected learning patches are not carried/applied. |
| next Product library / integrations | DEMO-ONLY | next/src/app/products; integrations/page.tsx | DEMOTE minimal import/status | Fixture connection rows do not prove OAuth or access. |
| next Simulator experience | DEMO-ONLY / incomplete dedicated surface | Home Try Simulator; next/src/lib/simulator/** | STRENGTHEN same-domain virtual clock | No standalone next/src/app/simulator/page.tsx. Uses wall-clock Date rather than a deterministic virtual event clock. |
| Current UI frameworks | ACTUALLY PRESENT installed configuration | next/package.json | KEEP unless concrete failure | Next 16.3.8 / React 19.3.0 / Tailwind 4 / Zod 3.24 observed; older architecture version statements are stale. |


## The important call traces

1. `sessions.start_session` → service lifecycle checks → Store persistence. Existing switchback schedule is required. Preserve identity/terminal guards, not the experiment requirement.
2. `actions.execute_action` ← autopilot step → candidate selection → intervention/exposure records → broadcast local pinned product. **No TikTok or Shopee execution client is called.** This is the most important distinction between a local working demo and platform behavior.
3. Replay `_run_job` → downloader/parser → PII filter/classifier → ended, analysis-only session → synthetic comment tempo ticks. Viewer data unavailable is not a true measured zero.
4. Rebuild page → fixture singleton → memory maps. ApiClient does not make this path a real backend product. RealtimeClient and DraftStore do not add network delivery or durable storage.

## Verification performed in this audit

| Check | Result | What it establishes |
|---|---|---|
| `npm test -- --reporter=dot` in next | **PASS: 3 files / 21 tests** | Existing frontend test expectations only. |
| `node_modules/.bin/tsc --noEmit --incremental false` in next | **PASS** | Current TS static check; no build or browser acceptance claim. |
| Targeted pytest with `PYTHONPATH=src`, bytecode/cache disabled | **NOT RUN: conftest import fails, fastapi missing** | Environment lacks backend dependency. Not evidence backend tests fail functionally. No dependencies installed. |
| `PYTHONDONTWRITEBYTECODE=1 python scripts/check_isolation.py` | **PASS: 71 src files / 1 collector file scanned** | Import isolation holds under this script's defined scope; not full integration readiness. |
| Legacy platform credentials / authorized API calls | **NOT TESTED** | Official endpoint existence and repository mocks cannot establish production integration. |

No new tests or product code were added. Runtime defects above are source findings that need regression checks during a later authorized engineering task.

## Prior research register and corrections

All discovered prior research was included in the evidence review: 14 strategy-v2-review files, 16 antigravity files, and 17 dated top-level research documents. Deep reads focused on the required strategy, architecture, API and product documents; dated research was reviewed for its claims, corrections, methods and evidence references. The three structured reading/seminar/PI JSON files under docs/research/data were also inspected as historical hypotheses. References to external/raw datasets do not establish that those original artifacts are present or reproducible here.

| PRIOR MATERIAL | LESSON RETAINED | CONCLUSION CHALLENGED |
|---|---|---|
| strategy-v2-review 00–13 | Commerce rundown is a plausible wedge; native analytics overlap | Zero TikTok operational support; globally novel rundown; universal MDE >45%; immediate ban certainty; production-grade catalog reuse. |
| antigravity 00–15 | Authority, timing of knowledge, capability-specific providers, persistence recovery | Proposed components are not implemented. SSE is not automatically proxy-proof; confidence scores/hash chains not P0 necessities; transport gap arithmetic needs correction. |
| 2026-08-24 API / synthesis / switchback / estimators | Outcomes must be measurable; carryover and units matter | Absolute first/no-competitor claims; inherited quota/access statements need current verification. |
| 2026-08-24 datasets / NLP / critique | Calibration != validation on new users; label provenance and domain shift | Synthetic CV accuracy and dataset licensing cannot become customer claims. |
| 2026-09-06 audit; 2026-09-07 agenda + reading/seminar/PI JSON | Real ingest contracts and preregistration integrity are significant work | Academic scope cannot all fit a small product team; zero proof of commercial demand. |
| 2026-09-09 yt-dlp; 09-10 competitor; 09-11 position/roadmap | Separate unofficial collection; experiments already have adjacent commercial precedents | Marketing breadth or competition ranking is not demand; no universal novel switchback invention. |
| 2026-09-17 system/API/China–India/TikTok/YouTube reports | Most careful prior reports already distinguish seller/creator and source access | Later summaries lost those qualifications. Do not generalize one market/version or carry historical deadlines forward. |
| plan.md; product 01–05; LEGACY_REUSE_MATRIX | Exact identity, manual first, real/sim separation, selected next-plan changes | Full supporting UI and epistemic terminology should not delay the smaller useful loop. |
| README; HARNESS; PREREGISTRATION | Data integrity, reproducibility, draft preregistration, honest outcome definitions | Documentation of a method or old test count is not current production readiness or measured GMV lift. |


The specifically named `LiveLift_Strategy_V2_TikTok_Gap_Analysis_2026-10-04.md` and `LiveLift_Product_V2_Final_Direction.md` were not found under those filenames in the inspected worktree. The strategy-v2-review equivalents were reviewed. Earlier plans reference commands such as `scripts/verify_golden_path_backend.py`; that script is not present in the current scripts inventory and must not be presented as an existing quality gate.

## Which invariants create customer value?

| Invariant | Normal operation | Conflict / review | Internal obligation |
|---|---|---|---|
| Planned != actual | Show baseline, current timer and forecast | Explain variance | Separate immutable start baseline from later plan versions. |
| Recommendation != acceptance != attempt != performed | One clear action; no mandatory ladder | Show status only when ambiguous | Log exact target and command result; accepting a suggestion never starts a segment by itself. A direct Start command may record its decision in the same transaction. |
| Operator report != provider observation != platform confirmation | “Reported” beside external action if relevant | Show both sources on disagreement | Independent evidence records; API success is not viewer-visible verification. |
| Unknown != failed; missing != zero | Unavailable only beside the affected fact | Inspect why | No zero default for absent provider data. |
| REAL != SIMULATED | Unmistakable session mode | Exclude simulation from real history | Immutable environment and separate namespaces. Fixture REAL labels are still fixtures. |
| Later evidence != known then | Hidden from routine operation | Show source/receipt time when assessing past decisions | Two times, corrections and as-of projection. Server knew is not proof operator saw. |
| Observation != causation | Operational wording | No causal sales conclusion from adjacent GMV | Experimental methods and preregistered outcomes required for causal research. |

OBSOLETE for V3: OFF/ON as the product's main navigation, experiment-gated manual start, blinding a commerce host from needed show countdown, mandatory causal scoreboard, and local “auto-pin” claims. Valuable archival material remains intact.

## Selected source anchors for future verification

- [Create/clone operation](/home/towfienes/Projects/LiveLift-next/next/src/lib/simulator/simulatorEngine.ts:118): source clone begins at 156; no selected learning-patch application.
- [Review carry-forward handler](/home/towfienes/Projects/LiveLift-next/next/src/app/live/[sessionId]/review/page.tsx:128): navigation only; the selected change list is not transferred.
- [Create source selection](/home/towfienes/Projects/LiveLift-next/next/src/app/live/new/page.tsx:38): fixed source session when clone is selected.
- [Platform-action report](/home/towfienes/Projects/LiveLift-next/next/src/lib/simulator/simulatorEngine.ts:455): substring pin match changes reported state even for an attempt.
- [Replay and learning return paths](/home/towfienes/Projects/LiveLift-next/next/src/lib/simulator/simulatorEngine.ts:511): missing per-session history falls back to shared fixtures.
- [Legacy write-auth boundary](/home/towfienes/Projects/LiveLift-next/src/livelift/api/auth.py:1): intentionally shared token/demo protection, not tenant roles; blank token behavior is documented.

## Prior-research file register

The claim-review conclusions above refer to the following pre-existing documents. This register makes coverage reviewable; it does not upgrade archived assertions to verified current facts.

### docs/research/strategy-v2-review

- [00_VERDICT.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/00_VERDICT.md)
- [01_ORIGINAL_LIVELIFT_AUDIT.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/01_ORIGINAL_LIVELIFT_AUDIT.md)
- [02_TIKTOK_LIVE_MANAGER_CURRENT_STATE.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/02_TIKTOK_LIVE_MANAGER_CURRENT_STATE.md)
- [03_STRATEGY_V2_CLAIM_REVIEW.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/03_STRATEGY_V2_CLAIM_REVIEW.md)
- [04_COMPETITOR_AND_SUBSTITUTE_MAP.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/04_COMPETITOR_AND_SUBSTITUTE_MAP.md)
- [05_DIFFERENTIATION_SCORECARD.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/05_DIFFERENTIATION_SCORECARD.md)
- [06_KEEP_CHANGE_REMOVE_UI.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/06_KEEP_CHANGE_REMOVE_UI.md)
- [07_PRODUCT_OPTIONS.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/07_PRODUCT_OPTIONS.md)
- [08_RECOMMENDED_PRODUCT_V2.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/08_RECOMMENDED_PRODUCT_V2.md)
- [09_FEASIBILITY_AND_API_REALITY.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/09_FEASIBILITY_AND_API_REALITY.md)
- [10_PRODUCT_ROADMAP_V2.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/10_PRODUCT_ROADMAP_V2.md)
- [11_HIGH_VALUE_SPIKES.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/11_HIGH_VALUE_SPIKES.md)
- [12_OPEN_QUESTIONS.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/12_OPEN_QUESTIONS.md)
- [13_RECOMMENDED_NEXT_ACTIONS.md](/home/towfienes/Projects/LiveLift-next/docs/research/strategy-v2-review/13_RECOMMENDED_NEXT_ACTIONS.md)

### docs/research/antigravity

- [00_EXECUTIVE_SUMMARY.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/00_EXECUTIVE_SUMMARY.md)
- [01_CURRENT_SYSTEM_AUDIT.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/01_CURRENT_SYSTEM_AUDIT.md)
- [02_EXTERNAL_PLATFORM_RESEARCH.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/02_EXTERNAL_PLATFORM_RESEARCH.md)
- [03_TARGET_ARCHITECTURE.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/03_TARGET_ARCHITECTURE.md)
- [04_EVIDENCE_REPLAY_MODEL.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/04_EVIDENCE_REPLAY_MODEL.md)
- [05_REALTIME_OFFLINE_RECOVERY.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/05_REALTIME_OFFLINE_RECOVERY.md)
- [06_PROVIDER_CAPABILITY_ARCHITECTURE.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/06_PROVIDER_CAPABILITY_ARCHITECTURE.md)
- [07_EXPERIMENTATION_AND_LEARNING.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/07_EXPERIMENTATION_AND_LEARNING.md)
- [08_SECURITY_OBSERVABILITY_DEPLOYMENT.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/08_SECURITY_OBSERVABILITY_DEPLOYMENT.md)
- [09_TEST_AND_SIMULATOR_STRATEGY.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/09_TEST_AND_SIMULATOR_STRATEGY.md)
- [10_TECHNOLOGY_DECISION_MATRIX.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/10_TECHNOLOGY_DECISION_MATRIX.md)
- [11_RISK_REGISTER.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/11_RISK_REGISTER.md)
- [12_TECHNICAL_SPIKES.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/12_TECHNICAL_SPIKES.md)
- [13_MASTER_ROADMAP.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/13_MASTER_ROADMAP.md)
- [14_OPEN_QUESTIONS.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/14_OPEN_QUESTIONS.md)
- [15_RECOMMENDED_NEXT_PROMPT.md](/home/towfienes/Projects/LiveLift-next/docs/research/antigravity/15_RECOMMENDED_NEXT_PROMPT.md)

### Dated research and structured notes

- [2026-08-24-apis-competition.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-08-24-apis-competition.md)
- [2026-08-24-bao-cao-tong-hop-nghien-cuu.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-08-24-bao-cao-tong-hop-nghien-cuu.md)
- [2026-08-24-datasets-simulation.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-08-24-datasets-simulation.md)
- [2026-08-24-estimators.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-08-24-estimators.md)
- [2026-08-24-phan-bien-tai-lieu.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-08-24-phan-bien-tai-lieu.md)
- [2026-08-24-switchback-design.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-08-24-switchback-design.md)
- [2026-08-24-vietnamese-nlp.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-08-24-vietnamese-nlp.md)
- [2026-09-06-danh-gia-toan-dien-va-ke-hoach.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-06-danh-gia-toan-dien-va-ke-hoach.md)
- [2026-09-07-chuong-trinh-nghien-cuu-vong-2.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-07-chuong-trinh-nghien-cuu-vong-2.md)
- [2026-09-09-youtube-ytdlp-live.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-09-youtube-ytdlp-live.md)
- [2026-09-10-khao-sat-doi-thu.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-10-khao-sat-doi-thu.md)
- [2026-09-11-vi-the-va-lo-trinh.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-11-vi-the-va-lo-trinh.md)
- [2026-09-17-danh-gia-toan-dien-va-lo-trinh-tu-dong.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-17-danh-gia-toan-dien-va-lo-trinh-tu-dong.md)
- [2026-09-17-nen-tang-livestream-va-serpapi.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-17-nen-tang-livestream-va-serpapi.md)
- [2026-09-17-thi-truong-trung-quoc-an-do-va-bai-bao-moi.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-17-thi-truong-trung-quoc-an-do-va-bai-bao-moi.md)
- [2026-09-17-tiktok-duong-chinh-thuc.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-17-tiktok-duong-chinh-thuc.md)
- [2026-09-17-youtube-kiem-thu-chinh-thuc.md](/home/towfienes/Projects/LiveLift-next/docs/research/2026-09-17-youtube-kiem-thu-chinh-thuc.md)
- [2026-09-07-chuong-trinh-pi.json](/home/towfienes/Projects/LiveLift-next/docs/research/data/2026-09-07-chuong-trinh-pi.json)
- [2026-09-07-reading-notes.json](/home/towfienes/Projects/LiveLift-next/docs/research/data/2026-09-07-reading-notes.json)
- [2026-09-07-seminar-phan-bien.json](/home/towfienes/Projects/LiveLift-next/docs/research/data/2026-09-07-seminar-phan-bien.json)
