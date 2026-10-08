# LiveLift V3 Master Roadmap

Canonical owner document. Created 2026-10-05 on `rebuild/livelift-next`. Research-based proposal; no implementation, user study or platform authorization occurred in this task. **Read §30 first in every future session.**

# 0. Executive Product Decision

**Verdict: YES — NARROW BUT VALUABLE.** Pivot emphasis toward **LiveLift Commerce Operations Desk**: execute a timed commerce show, recover when it drifts, and turn actual execution into a changed next rundown.

This is a conditional workflow hypothesis, not measured superiority or a new algorithm. The strongest documented TikTok residual gap is a team-owned future time budget with hard-anchor recovery and selected operational adaptation. TikTok already solves substantial native preparation, actions, analytics, replay, scripts, suggestions and practice. Opsique and professional rundown tools materially challenge global novelty.

**Single strongest differentiator:** constraint-aware pacing → explicit recovery → actual history → approved coherent next-plan changes. **Single biggest risk:** another screen/logging burden saves less than a good sheet or existing rundown. Validate before backend expansion.

This file is the **SINGLE SOURCE OF TRUTH** for V3. It supersedes earlier V2/Antigravity roadmap decisions where they conflict; archival documents remain evidence. This research task implements nothing and does not authorize future product changes beyond their separately approved work.

# 1. Product North Star

Help recurring teams execute agreed commerce commitments and prepare the next show with less operational work, without increasing critical cue misses.

North-star evaluation: paired recovery/review/planning time saved plus voluntary repeat-show use. Reliability guardrails: accurate actual capture, no false performed/confirmed state, no silent missed-anchor rewrite. GMV is optional contextual data, not the success metric or causal promise.

# 2. Primary ICP

**Primary, VALIDATE:** recurring Vietnamese merchant teams and small agencies with a dedicated operator and host, one active room initially. They use products/promotion deadlines repeatedly and have a real reason to review execution.

Secondary: creator + assistant with the same repeated operational need. Solo creators often cannot afford another screen; large agencies add permissions/staffing/procurement scope. Recruit by observed timing/reconstruction pain, not business label alone.

# 3. JTBD

When our commerce show runs differently from the plan, show what commitment is at risk, help us deliberately recover without losing required coverage, record what actually happened, and apply selected changes to tomorrow's show.

Sub-jobs: plan a coherent show; deliver private cues if useful; recover/hand off; review timing/skips/late reports; create a feasible revised plan. Not jobs: broadcast distribution, native product execution, product discovery, shop fulfillment or causal sales optimization.

# 4. Why LiveLift Exists Despite TikTok

Use TikTok LIVE Manager for platform-owned work. Add LiveLift only if timed future commitments, human recovery and next-plan adaptation cost too much in the team's native/sheet/chat workflow. A formal hard-anchor recovery/patch loop was NOT FOUND in reviewed official sources; it must be verified on target VN accounts.

Sheets can express the plan, actuals and history; Shoflo/Ontime/Rundown Studio already solve timing. The product must save recurring operating/review effort over a **competently configured** substitute. FastMoss/Kalodata serve intelligence/monitoring, which is not the same job. Zalo may be entirely sufficient for simpler shows. If these answers fail in paired tasks, pivot to a template/review companion or stop.

Evidence: [official capability map](../research/codex-gap-study/03_TIKTOK_COMPLETE_CAPABILITY_MAP.md), [competitor/substitute study](../research/codex-gap-study/06_COMPETITOR_SUBSTITUTE_MAP.md), and [final definition](../research/codex-gap-study/12_FINAL_PRODUCT_DEFINITION.md).

# 5. Where LiveLift Can Be Better Than TikTok

Potential advantages, all unmeasured here:

| Dimension | Mechanism | Proof target |
|---|---|---|
| Faster timing awareness/recovery | Explicit deadline deficit and feasible operator choices | ≥80% risk recognition ≤10s; median recovery ≥30% faster; ≥90% valid choices. |
| Better host coordination | Minimal shared timed cue; no duplicated script wall | ≥30% fewer avoidable cue messages and ≥80% cues understood ≤5s, with no delivery regression. |
| Faster operational review | Baseline vs actual transitions/cues/coverage | ≥90% facts correct; review + next-plan ≤5m and ≥30% faster. |
| Better next-session operational memory | Selected justified changes really alter a feasible new plan | At least three teams voluntarily reuse across repeated sessions; demonstrate real patch application. |
| Better operator rehearsal for this job | Deterministic offline whole-show recovery/failure scenario | Same commands/clock produce same result; transferred recovery task improves. |
| Better evidence-aware review | Distinguish reports, observations and later corrections | Zero false success/zero/causal claims; correct known-then interpretation. |

These are bounded workflow dimensions, not “better overall.” Feature copying is easy. Possible defensibility is team fit, useful accumulated playbooks and reliable workflow execution, not a timer or AI moat. [Full superiority strategy](../research/codex-gap-study/08_SUPERIORITY_STRATEGY.md).

# 6. Non-Negotiable Product Boundaries

LOCKED: no product value depends on TikTok API, unofficial ingestion, AI or automatic native actions. One room/operator initially. Exact session identity, immutable baseline/current version separation and real actual history. Unknown/missing/source labels are truthful. Manual and simulated execution never mix.

A suggestion is not acceptance; acceptance is not platform execution; a report is not platform confirmation. Direct segment commands can combine decision recording and actual transition without extra ceremony. Native external actions remain reported until independently observed.

One authority at a time: local device in Phase 1; server in Phase 2. Commit state/event/receipt together before acknowledgement. No silently replayed offline runtime transitions. End freezes runtime; corrections/late evidence append in Review. Operational observations never imply sales causality.

Routine UI shows the timer, next cue and one reason. Expose detailed provenance only for missing/conflicting facts or review. The user does not need an internal invariant checklist.

# 7. TikTok-Owned Capabilities

Broadcast/video/OBS delivery, audience chat/moderation, native product ordering/pinning, Flash Sale/coupon/giveaway/billboard control, room activity, GMV/conversion/traffic/audience/product analysis, synchronized replay/comments/markers, scripts, AI sequence/diagnosis/recommendations and native AV/AI practice.

Do not rebuild these. Product-set reuse and host script prompts already exist. Native UI capability is not third-party API permission. Guides have market/eligibility/version qualifications; see [Dashboard crawl](../research/codex-gap-study/02_TIKTOK_LIVE_DASHBOARD_DEEP_CRAWL.md) and [API map](../research/codex-gap-study/04_TIKTOK_API_CAPABILITY_MAP.md).

# 8. LiveLift-Owned Capabilities

The team's agreed timed plan/product snapshots; constraint-aware forecast; operator-confirmed recovery; recorded actual segment/cue execution; minimal independent human reports; Plan vs Actual; selected operational adaptation; deterministic whole-show rehearsal. Optional private host cue projection belongs here only if validated.

Official platform data can enrich those records later. It never defines whether a manually observed show transition happened, retroactively rewrites the original plan, or supplies a causal revenue effect.

# 9. Current Repository State

Legacy FastAPI/Store, lifecycle, queues/actions, provider adapters, reports, seeded statistical simulations, experiment estimators, ingest isolation and operational journals contain valuable code/lessons. Legacy action execution changes local state without a TikTok/Shopee execution call. Authentication is not ready for workspace-scoped external operation.

Current `/next` is a functional **fixture UI prototype**, not a functional manual/backend product. Pages bypass the real API path, local listeners do not synchronize browsers, drafts lack durability, replay/learning are canned, selected clone changes are not applied, and mutation/lifecycle/revision semantics need repair. Hard-anchor downstream timing is not implemented.

Verification in this audit: Next **21 tests / 3 files pass**, TypeScript no-emit with incremental disabled passes; existing collector/core import-isolation script also passes. Targeted Python test execution was unavailable because FastAPI is missing from the existing environment after resolving import path; dependencies were not installed. No live integration, local browser walkthrough, interviews or production drills were run. [Repository feature audit](../research/codex-gap-study/01_REPO_FEATURE_AUDIT.md) contains source/test limits.

# 10. Target User Journey

Home/Sessions → Create manual show → Prepare pack and timed rundown → Operate NOW/NEXT/recover → End/freeze → Review actual vs baseline → select/validate changes → new Prepare.

Wrap becomes the end/review transition; Learn becomes selected operational observations in Review. Products/import and integration status are secondary. Simulator is explicit separate mode. Optional Host View is a scoped read-only projection; no competing execution authority.

# 11. P0

Manual products/basic import; segment duration/minimum/optional/coverage; hard anchors and zero-duration cues; forecast and uncertainty; operator start/end/shorten/extend/skip/reorder; actual event/report history; Plan vs Actual; coherent selected-change clone; deterministic offline scenario.

Phase 1 P0 is functional single-device authority with durable local storage. Phase 2 makes the same workflow server-backed/team-capable. No API, unofficial scraping, auto pin or AI. No claim that disconnected browsers can independently control one real session. [Exact P0 and timing algorithm](../research/codex-gap-study/13_P0_SPEC.md).

# 12. P1

Host View P0.5 if attention/message tests pass; single-room handoff; repeated comparable timing/coverage observations with selected changes; optional entitled catalog/session/post-LIVE enrichment.

Pattern rules require ≥3 comparable completed observations, display count/spread and exclude skipped/missing/censored intervals. Human approval and feasibility validation precede clone changes. Native performance context remains separate from operational facts.

# 13. Later

Demand-led single-room agency standards/training, then at most one multi-room or additional-platform bet. Provider-neutral session/plan/evidence identity is architectural preparation now; connector implementations and simultaneous control are not.

Causal experiments remain separate research work requiring preregistration, valid outcomes, assignment/exposure logging, carryover and power checks. Existing scientific code is preserved. ML/bandits wait for an actual data/user premise.

# 14. Do Not Build

Do not build native broadcast/video/chat/replay/BI clones; generic AI scripts/diagnosis/sequence-ranking; AI host-practice clone; unsupported automatic TikTok pin/coupon/giveaway/room-promotion controls; shop OMS/PIM; multi-room staffing/calendar or broad multi-platform OS now; general provider factory/marketplace; mandatory evidence-score UI.

REMOVE refers to active roadmap/navigation/claims when later authorized. No legacy files are deleted by this study.

# 15. Target Architecture

Use existing Next contracts/components/client boundary and selected legacy backend code where verified; no framework rewrite merely for fashion.

**Phase 1:** one local manual authority, durable browser transaction for state/event/receipt, immutable plan, explicit real/sim namespaces, export/restore. Shared domain scenarios and virtual clock prove timing behavior. Browser storage is not a team database.

**Phase 2 candidate (VALIDATE via S3):** existing FastAPI + PostgreSQL, additive V3 routes/tables. Reuse lifecycle, Store error/backup patterns and permitted signing adapters; reconcile response shapes explicitly. Server is the sole transition authority. Frontend projections must conform to shared scenario vectors; if local TS and Python implementation coexist, never let both independently decide real state. Keep the smallest tested transition rules; no new service bus.

Minimal central records: Session, ProductSnapshot, PlanVersion/Segment/Cue, RuntimeState, CommandReceipt, SessionEvent, optional ProviderBinding/Observation, NextPlanPatch. Workspace/session ownership on every lookup; unique command key; compare expected revision; atomically commit then publish. One measured real-time transport, gap/duplicate handling and snapshot recovery. Do not ship WS and SSE redundantly.

Scoped operator/reviewer/host access precedes external/team data. Host capability is read-only, revocable and bounded. Secrets server-side. Late observations/corrections append with occurrence/receipt time; known-then view filters both and does not equate server receipt with host exposure.

Optional TikTok adapter: official catalog/binding/completed-session data after entitlement/version checks; manual native export only after actual format validation. Integration failure marks context unavailable; timing/commands continue. Never turn unavailable into zero or split aggregate minute GMV causally across segments.

# 16. Major Engineering Phase 1

### MISSION

Turn the current fixture UI into a useful, offline single-operator commerce execution loop.

### WHY THIS PHASE EXISTS

Prove manual timing/review value without waiting for platform access or shipping a premature multi-user backend.

### STARTING STATE

Current Next prototype: fixture routes, local simulator mutations, static replay/learning, in-memory drafts, 21 passing tests. Concept/substitute validation has met its build gate.

### FINAL STATE

A functional manual product on one browser/device: durable local sessions, real command history, timing recovery, review and changed next-plan clone. Separate deterministic rehearsal. This is not a multi-browser/server-backed or production-ready product.

### EXACT SCOPE

One active show per operator device; manual inputs/basic validated import; prepare/operate/end/review/adapt. Durable browser storage with export/restore for the pilot. No platform integration.

### FEATURES

Timed ROS, fixed anchors, minimum/compressible/optional rules, coverage, NOW/NEXT/concise WHY, explicit recovery, real actual transitions, minimal reported actions/corrections, selected-change clone, virtual-clock scenario. Host View concept test only; no distributed synchronization claim.

### DOMAIN CHANGES

Introduce explicit anchor/cue vs segment semantics, immutable baseline/current plan distinction, command enums, lifecycle guards, revisions/idempotency and occurred/recorded time. One local command authority; REAL manual execution and SIMULATED namespaces separated.

### FRONTEND CHANGES

Use the existing client/contract boundary consistently; remove unknown-ID fixture fallback and static review returns. Merge Wrap/Learn into end/review flow; queue becomes rundown order. Accessible timer, feasible preview, actual timeline and clone diff.

### BACKEND CHANGES

No external server product yet. Local authoritative domain/store replaces singleton fixture behavior; do not pretend existing FastAPI compatibility is solved. Legacy backend remains unchanged in this phase.

### API CHANGES

Define tested command/snapshot/event/receipt shapes through existing client boundary. No new public HTTP promises. Prepare the exact contract needed for the server phase; avoid a speculative provider framework.

### DATA CHANGES

Durable IndexedDB or an already installed equivalent, with atomic local state/event/receipt updates and explicit schema version. Local backup/export. Notes survive reload; simulated history never feeds real learning. Do not call browser storage a shared/team database.

### PROVIDER CHANGES

None. Manual products/actions and no integrations. Native TikTok operation remains external, reported only.

### TESTS

Meaningful timing vectors: original overrun, buffered recovery, multiple anchors, unknown remaining, minimum exhaustion, cue vs segment, skip coverage. Command duplicate/stale/end guards, durable reload, selected clone changes/cleared actuals, explicit pin/unpin enum, simulator mode/clock conformance.

### MANUAL ACCEPTANCE TEST

With WAN disconnected, create show; start; inject overrun; choose valid recovery; record action as reported; end; reload; inspect real actual timeline; select changes; clone; verify changed plan and empty actual history. Repeat virtual-clock scenario identically. Unknown ID returns not found.

### WHAT MUST NOT BE BUILT

Multi-user control, native pin/promotion execution, scraping, AI, GMV dashboard, live chat/video, generalized connector/plugin framework or multi-room. Do not silently auto-replay offline runtime actions.

### KNOWN RISKS

Single-device persistence may be cleared/lost; export and clear pilot limitations. Manual capture burden may fail despite correct timing. Browser clock corrections need explicit handling. Small dynamic-timing scope can still produce misleading forecasts.

### ROLLBACK POINT

Keep current prototype/research archives; export pilot records before migration. If functional tests or user gate fail, retain read-only plans and return to sheet/native baseline; no promised production service.

### QUALITY GATE

Phase-1 conformance and durable reload pass; real/sim separation and truthful action labels pass; repeat paired functional tasks meet report 14 critical reliability/recovery/review thresholds. No superiority claim based solely on concept prototype.

### DEFINITION OF DONE

Every P0 operation is based on this session's persisted facts, the full loop demonstrably works without APIs/AI/WAN, and pilot participants choose repeated use. Local manual product boundary is documented. No backend/production claim.

### NEXT PHASE HANDOFF

Versioned domain contracts, timing test vectors, event/export samples, measured user results, known data-capture defects and approved optional Host View requirement. Estimated 2–4 experienced engineering weeks, revised after spikes; not a calendar commitment.

# 17. Major Engineering Phase 2

### MISSION

Make the validated manual workflow durable and authoritative across operator/host browsers; enrich only with verified official data.

### WHY THIS PHASE EXISTS

Single-device operation cannot support trustworthy coordination, central history or team handoff. Integrations should add context to an already useful product.

### STARTING STATE

Functional single-operator P0, actual user gate, shared contract/conformance vectors and local exports. Backend/fixture incompatibilities are documented, not ignored.

### FINAL STATE

Checkpoint A: real server-backed manual team product with one operator authority, durable history, restart/reconnect recovery, validated Host View and basic operational patterns. Checkpoint B: separately labeled TikTok-enriched product only if entitlement/schema gates pass. A remains usable if B is blocked.

### EXACT SCOPE

One active room per team; minimal operator/host/reviewer permissions; selected existing FastAPI/Store infrastructure plus additive V3 routes/schema. Host View only if its own gate passes. Optional catalog import/exact binding/post-session enrichment; no platform controls.

### FEATURES

Real create/prepare/operate/review/adapt across reloads/devices; host read-only projection, single-room handoff, comparable-duration observations/approved patches. Optional integration status, catalog snapshot and native-analysis link/source overlay.

### DOMAIN CHANGES

Authority moves from local device to server; never dual-write real runtime. Add actor/workspace ownership and provider binding/evidence separate from operational state. Cross-session rules require ≥3 comparable completed observations; missing/skipped intervals excluded and sample/spread shown.

### FRONTEND CHANGES

All real routes use one server adapter; simulator stays explicit. Commands await committed receipts; conflicting revisions resnapshot. Shared view shows stale age on disconnect; durable note drafts reconcile explicitly. Integration errors affect enrichment only.

### BACKEND CHANGES

Reuse FastAPI lifecycle/auth/error/Store lessons selectively after S3 compatibility spike; additive V3 endpoints and PostgreSQL tables. Commit state, revision, event and unique command receipt atomically. Publish committed updates through one transport. Add scoped roles before any external or partner-data pilot.

### API CHANGES

Document V3 session/plan/command/snapshot/events/review/clone endpoints with exact IDs, expected revision and idempotency key. One websocket/event envelope or SSE protocol chosen by measured spike; do not ship both. Read-only scoped host access, revoke/expire capability. External TikTok connector remains optional server-side.

### DATA CHANGES

Central session/plan/product snapshots/events/receipts and observations; workspace scope on every lookup. Import Phase-1 exports with explicit provenance and IDs, deduplicate safely. Additive migrations with backup/restore. Times/units/currency/metric definitions retained for provider observations.

### PROVIDER CHANGES

Checkpoint A has no required provider. Checkpoint B: approved app/token/scope probe, current API version mapping, manual confirmation of room binding, eligible catalog and completed-session minute/product reads. Native export import only after actual format validation. No automatic unofficial fallback.

### TESTS

Shared timing/domain conformance vectors between local prototype and server; transaction failure/duplicate/concurrent commands, ended-state mutation, unknown/wrong-workspace IDs, restart/restore, event gap/out-of-order/duplicate, stale host, draft reconciliation, clone patch application. Optional provider tests cover permissions, pagination, identity mismatch, missingness, units and late evidence.

### MANUAL ACCEPTANCE TEST

Two browsers join one room with allowed roles; operator recovers overrun, host sees committed update, reviewer cannot mutate. Restart server/reconnect; both converge. Attempt duplicate/conflicting command and wrong workspace read. End and correct in review. Clone selected changes. Disable integration; manual loop remains functional.

### WHAT MUST NOT BE BUILT

Native room action automation, realtime comment scraping, general OMS/PIM, ML ranking/causal GMV reports, multi-room staffing or every platform connector. Do not make official access a prerequisite for checkpoint A.

### KNOWN RISKS

Cross-language domain semantics if retaining Python server and TypeScript projection: keep one authoritative transition engine and shared conformance vectors, not two independent truths. Auth/tenant gaps in legacy must be fixed before external use. API approval wait, account-type ambiguity, metric granularity and manual boundary error.

### ROLLBACK POINT

Back up local/central data before import; preserve read-only Phase-1 exports. Roll back additive server release to last compatible snapshot; never discard acknowledged commands. Disable enrichment/Host View independently; manual product remains valid.

### QUALITY GATE

A: atomic receipt/event durability, strict role/workspace isolation, one transport recovery, real cross-browser acceptance and repeated team-use gate. B: approved VN entitlement plus tested identity/version/metric contract; data never converts unknown to zero or reports into confirmed platform action.

### DEFINITION OF DONE

Real backend manual product is demonstrably durable and coordinated; users reuse selected operational changes across sessions. Optional enriched label used only when B passes. No production/SLA/self-serve promise yet.

### NEXT PHASE HANDOFF

Verified migrations/restore, threat boundaries, scoped auth, command/event protocol, pilot support incidents, retention evidence and optional connector proof. Estimated 4–6 engineering weeks for A with appropriate frontend/backend coverage; B effort and approval waits are separate, unbounded until access.

# 18. Major Engineering Phase 3

### MISSION

Harden the proven one-room manual/team product into a supportable service without broadening the product wedge.

### WHY THIS PHASE EXISTS

A working pilot is not reliable external production. Recovery, security, accessibility, operations and economics must be demonstrated.

### STARTING STATE

Real backend team checkpoint, repeat use, scoped roles and tested restart behavior. Optional enrichment either verified or absent; no dependence on it.

### FINAL STATE

Production-ready manual service with validated access/isolation, restore/recovery, monitored operations, usable onboarding and defined support/retention. Enriched production tier only if its own authorization/privacy/data gate passes.

### EXACT SCOPE

Single-room team deployment, minimal organization/account lifecycle, safe imports/exports, backup/restore, monitoring/support runbook, access revocation, data retention, browser/device readiness and accessibility. Billing only if actual commercial pilot needs it.

### FEATURES

Self-contained onboarding/manual path, trustworthy session continuation, help for stale/conflicting state, recoverable data export/delete, reliable host projection if validated. No new AI or multi-room roadmap hidden in hardening.

### DOMAIN CHANGES

Freeze/version supported contracts; explicit correction and retention semantics, command failure classifications and integration revocation behavior. Multi-room remains rejected from current scope.

### FRONTEND CHANGES

Clear loading/not-found/permission/stale/conflict/error states, keyboard/focus/contrast and readable timers, practical tablet/mobile studio checks, concise onboarding. Native capabilities remain native; no internal implementation jargon in operator flow.

### BACKEND CHANGES

Harden scoped auth/session handling, query isolation, secret management, appropriate limits, health/metrics, durable receipts under failure, tested backups and restore procedure. Prefer existing deployment/backup components where valid. No Redis/Kafka/microservices without measured need.

### API CHANGES

Stable documented operator/reviewer/host contracts, versioned error behavior, reconnect/resnapshot and access revocation. Optional provider token refresh/revocation/permission errors tested; webhook support only if a concrete need and exact official contract exist.

### DATA CHANGES

Backup scheduling and tested restore, explicit retention and deletion/export, minimal personal data, migration rollback and compatibility. Validate that real/sim and workspace separation survive export/import and backups. Operational history is not sold as causal sales data.

### PROVIDER CHANGES

No required provider. If enriched production is offered, pass app approval and authorized-account probes, market eligibility, source semantics and service failure handling. Remove/demo-label any connector lacking this evidence.

### TESTS

Failure-driven acceptance: process/network loss around commit, lost ack/duplicate command, event gap, clock discontinuity, expired/revoked access, cross-workspace/host-write attempts, restore from backup, schema upgrade rollback, incomplete/late/conflicting provider data. Accessibility and actual studio-device tasks. Appropriate existing unit/contract checks once per relevant change.

### MANUAL ACCEPTANCE TEST

Fresh team creates/operates/reviews/clones without developer help; another workspace cannot read it. Host link can be revoked. Recover a committed show after server crash and backup restore; client resync has no phantom performed action. Integration outage does not stop show. Complete agreed rehearsal/soak and support handoff.

### WHAT MUST NOT BE BUILT

Multi-room operations, simultaneous multi-platform control, scientific optimization platform, native replay/BI/chat and a generalized extension marketplace. No expansion to hide failed retention.

### KNOWN RISKS

Human support burden, clock/network behavior, production data privacy and backup economics, unclear willingness to pay. Platform changes can invalidate enrichment. Reliability is not established by a passing fixture suite.

### ROLLBACK POINT

Known-good deploy and verified restorable database backup. Roll back code only to schema-compatible version; disable optional connector/view independently. Preserve committed records and give users exports if service stops.

### QUALITY GATE

Production gate in master §24 passes, critical defects resolved, repeated-user value and support ownership demonstrated. External enriched label separately approved only after entitlement and data checks. No universal reliability claim from a short soak.

### DEFINITION OF DONE

Manual service can be onboarded, operated, recovered and supported under defined pilot-to-production conditions; data and permission boundaries hold; user value persists. Production readiness explicitly records remaining limits and integration status.

### NEXT PHASE HANDOFF

Measured adoption/retention/support/cost evidence and documented production limits. Optional future bet requires new customer evidence and decision-log approval. Estimated 2–4 engineering weeks of hardening after stable pilot, revised by discovered incidents; no guaranteed launch date.

# 19. Optional Future Phase

Not scheduled or authorized by current evidence. After production/repeat-use gates, choose **one** expansion: agency playbooks/training, multiple-room handoffs, or one additional platform. Mission/scope/data/API/acceptance must be written and approved then; it is not an inevitable commerce OS phase.

Entry evidence: several retained teams asking for the same specific job, workable authorization/data rights if a connector is involved, and manual product value that survives expansion. Final state must remain usable independently of platform control. Rollback is the proven one-room manual/team service. Do not bundle all future bets or replace the current next action.

# 20. Technical Spikes

Run [the timeboxed spike table](../research/codex-gap-study/16_TECHNICAL_SPIKES.md): native/substitute gap, timing semantics, domain/API authority, reconnect/draft durability, host attention, selected clone, optional VN entitlement/version and actual native export, access/restore boundary.

S1/paired concept comparison precede engineering. Server/protocol/auth spikes feed Phase 2. Entitlement wait does not block manual product. A spike returns evidence and stop/fallback, not a new speculative feature backlog.

# 21. Product Validation

Preregister 5–10 relevant participants across at least three teams, with role/proxy denominators separate. Use actual VN native workflow and a competent sheet/chat baseline; counterbalance matched overrun scenarios. At least two operators challenge a configured professional rundown; Opsique comparison if accessible.

Freeze the [thresholds/protocol](../research/codex-gap-study/14_USER_VALIDATION_PLAN.md) before scored tasks. Measure setup, recognition/recovery, cue misses, capture burden, workload, host messages/comprehension, review/adaptation correctness/time, preference and voluntary repeat use. Tiny formative results are not population or causal GMV superiority.

Concept prototype/Wizard-of-Oz pass permits Phase 1, not production claims. Repeat functional comparison and actual repeat sessions before backend/production investment. Host View has an independent pass gate.

# 22. Demo Plan

Four-minute simulated story: prepare products/durations/two anchors; A's overrun consumes buffer and threatens 20:12 promotion; operator chooses valid recovery; optional validated host display updates; actual A duration and reported cue appear in Review; selected A/opening/buffer changes produce a feasible materially changed next show.

Show a missed-anchor branch without retroactively moving the original commitment. Do not fabricate platform execution, REAL credentials, actual history or automatic learning. [Full script and exact allocations](../research/codex-gap-study/15_DEMO_STRATEGY.md). A generic timer demo is insufficient; actual-to-next adaptation and comparative evidence are the payoff.

# 23. Quality Gates

| Gate | Required evidence | Blocks |
|---|---|---|
| G0 — product gap | Native/substitute walkthrough and paired concept thresholds; negative cases documented | Engineering expansion if no missing job. |
| G1 — functional manual | Timing/minimum/anchor/unknown tests, local durability, identity/lifecycle, true review/changed clone, functional user result | Calling prototype functional P0. |
| G2A — real backend | Atomic receipts/state/events, scoped roles/isolation, two-browser convergence, restart/gap/conflict handling, repeated use | External team/backend claim. |
| G2B — optional enrichment | Actual VN permission/binding/version/units/granularity evidence; missing/late/conflict behavior | Calling product TikTok-enriched. G2A still usable. |
| G3 — production | §24 operational/security/accessibility/recovery/support/economics checks | External production-ready claim. |

Critical false success, unexpected cue miss, cross-workspace leak or lost acknowledged state under ordinary process/reconnect failure blocks the applicable gate regardless of preference. Run meaningful existing checks and scenario tests; do not inflate verification by mirroring implementation or repeating unchanged suites.

# 24. Production Gate

Production-ready manual and enriched products have separate gates.

- Named owner can deploy/support/restore; operational runbook covers lost ack, stale host, database failure, integration revocation and a failed native action report.
- Scoped accounts/roles, query isolation, revocable host links and secret handling pass adversarial tests. No external deployment with legacy global/open auth. Data collection/retention/export/delete are explicit and minimal.
- Durable commits survive ordinary process restart/network interruption with no lost acknowledged operation. Two clients converge on authoritative snapshot; ended runtime stays frozen. Disaster backup/restore has a measured, disclosed budget (initial target RTO ≤1h, backup RPO ≤24h, subject to customer acceptance); do not promise zero loss under total storage failure without corresponding infrastructure.
- A restoration drill and migration/rollback drill reproduce coherent plan/events/receipts from a real backup. A 48-hour rehearsal/soak includes injected failures and realistic device interactions; it is evidence under those conditions, not a universal uptime guarantee.
- Keyboard/focus/contrast/readable timers and actual tablet/monitor/operator tasks pass. Unknown/stale/conflict/error and no-provider manual path are usable.
- At least three teams voluntarily use repeated sessions and apply a useful change; capture remains accurate and support burden is sustainable. Pricing/economics are evaluated, not assumed from research.
- Optional enriched tier: approved app/account market/scopes, tested version/room identity/source/currency/time contract, refresh/revocation behavior and documented provider outage. If absent, offer manual only.

Exact enterprise SLA, billing and retention period remain deferred until evidence. Critical blockers unresolved means pilot-only, not production-ready.

# 25. Risks

Top risks: native/private feature parity; Opsique/configured rundown sufficiency; added logging/host distraction; false-safe forecasts; sparse/misleading learning; unsupported action promises; authorization/version uncertainty; unsafe legacy auth/tenant reuse; command/reconnect/data loss; weak repeat use/payment; scope creep.

[Risk and adversarial review](../research/codex-gap-study/18_RISK_AND_KILL_CRITERIA.md) assigns stop/block responses. No independent interviews, live permission tests or competitor performance trials occurred in this research.

# 26. Kill/Pivot Criteria

Kill/narrow after two focused iterations if competent baseline matches or beats recovery/review and no recurring missing job remains. If native account or existing rundown already supplies the loop, prefer a commerce template/integration or stop. If actual capture remains inaccurate/expensive, learning claims stop.

Host View failure removes that layer only. Lack of repeated approved adaptation narrows retention claims. API denial drops enrichment only. No voluntary repeat use or concrete economic case means no production/multi-room scaling. Reliability/access failures block release rather than justify a pivot into more features.

# 27. Deferred Decisions

ML/ranking, causal experiments, advanced semantic audit, multi-room/calendar, second platform, generalized connectors, exact billing/price, enterprise SLA and final retention policy. Specific server reuse/protocol selection and optional integration/export mapping remain validation decisions with spikes, not undocumented defaults.

# 28. Rejected Decisions

Rejected now: unsupported native action automation; first-rundown/Host View/simulator/switchback claims; broad analytics/AI desk; silent commitment/history rewrite; correlation-as-causation; immediate multi-platform OS; taking fixture/test labels as production proof; deleting legacy scientific work because the commercial wedge changed.

Rejection can be revisited only with genuinely new evidence and logged owner approval, not because a future agent prefers a different architecture.

# 29. Decision Log

## Decision register

| ID | Status | Decision | Evidence / rationale |
|---|---|---|---|
| L1 | LOCKED | No rebuilt native broadcast/video/chat/GMV/traffic/diagnosis/script system | Official capability overlap and focus; reports 02–06 |
| L2 | LOCKED | P0 works without TikTok API, scraping, automatic pinning or AI | Day-1 operational value and controllable data; report 13 |
| L3 | LOCKED | One room / one designated runtime operator initially | Minimum useful scope; team value before multi-room |
| L4 | LOCKED | Immutable start baseline; explicit plan changes; actual history never rewritten | Repository domain lesson and truthful variance |
| L5 | LOCKED | External operator report is distinct from provider observation/platform confirmation | Legacy fake execute and next substring bug show necessity |
| L6 | LOCKED | Manual/simulated separation, exact IDs, missing != zero, unknown != failed | Repository lessons; no fixture REAL-as-production claims |
| L7 | LOCKED | Selected changes must materially change a validated new plan with cleared actual state | Review CTA only navigates; Create uses a fixed source; selected patches not applied; demo core |
| L8 | LOCKED | Operational patterns are not causal sales claims | No research/field evidence supporting revenue causality |
| L9 | LOCKED | One authority per stage; atomic state/event/receipt before acknowledgement | Prevent lost/phantom operations; phase boundary |
| L10 | LOCKED | No external/team backend deployment with legacy open reads/global token semantics | Required access and workspace boundaries |
| V1 | VALIDATE | Dynamic downstream timing as primary differentiation | User/substitute test; timing itself established |
| V2 | VALIDATE | Host View as P0.5 | Native scripts/competitor displays; attention/message gates |
| V3 | VALIDATE | Recurring VN merchant teams/small agencies as primary ICP | No interviews in this study; recruit for observed pains |
| V4 | VALIDATE | Repeated actual-to-next adaptation as retention layer | Comparable history and voluntary reuse needed |
| V5 | VALIDATE | FastAPI/selected Store reuse for server phase | Contract/transaction spike; existing code valuable but incompatible |
| V6 | VALIDATE | Official VN catalog/session/post-data access and native export import | No authorized probes; current versions/account coverage uncertain |
| D1 | DEFERRED | ML ranking, bandits and causal sales optimization | No demand, power/instrumentation or data premise |
| D2 | DEFERRED | Agency multi-room calendar/staffing | Single-room repeat use first; Opsique overlap |
| D3 | DEFERRED | Second-platform connector / cross-platform control | Manual method portability only now |
| D4 | DEFERRED | Advanced known-then audit/replay and evidence scores | Minimal review first; specialist need unproven |
| D5 | DEFERRED | Exact billing/price, retention period, enterprise SLA | Measured pilot economics and customer requirements first |
| R1 | REJECTED | Unsupported automatic TikTok pin/unpin, coupon/giveaway/room-promotion control | No documented matching official contract found |
| R2 | REJECTED | First-in-market rundown/Host View/simulator/switchback claims | Professional tools, Opsique and native AI practice contradict |
| R3 | REJECTED | Generic AI/data dashboard as primary wedge | TikTok and intelligence products already strong |
| R4 | REJECTED | Silent anchor movement, forecast unknown treated as zero, report treated as performed | Misleading user promise and history |
| R5 | REJECTED | Broad multi-platform commerce OS as immediate scope | Connector rights and unproven need make it a distraction |

## Change control

Future agents must read §30 first and treat this master as authoritative. **LOCKED decisions change only with new evidence and product-owner approval.** VALIDATE decisions change after their gate and a log entry. DEFERRED/REJECTED scope may not be activated casually. Research reports remain dated evidence; do not silently rewrite them to imply measured results.

Every important change records all fields below. Initial creation is explicitly user-requested; no product implementation or deployment approval is implied.

| DATE | OLD DECISION | NEW EVIDENCE | NEW DECISION | IMPACT | APPROVAL REQUIRED |
|---|---|---|---|---|---|
| 2026-10-05 | Prior V2/Antigravity broad desk/architecture hypotheses; no V3 master | Repository trace, official VN UI/API crawl, professional rundown and direct competitor evidence | Create narrow manual operations V3 hypothesis and three-checkpoint roadmap | Active strategy/next action changes; archival research and product code untouched | Creation authorized by user's research request; future LOCKED changes require explicit product-owner approval. |
| Future date | Exact decision ID and previous wording | Source/probe/user result with market/date/denominator | New status and wording | Product, data, API, phase and migration effects | Yes for LOCKED; identify approver/result. Others follow recorded gate/owner scope. |

A new TikTok document may alter an evidence claim; first append the evidence and impact, then request approval for a locked scope change if needed. Never treat public UI as API permission. No agent may substitute a new primary task without a logged evidence-based decision.

# 30. Current Next Action

The primary task is the paired validation, before further engineering. Use the current prototype honestly and produce a build/pivot/kill decision against frozen thresholds. Full procedure: [next action](../research/codex-gap-study/19_FINAL_RECOMMENDED_NEXT_ACTION.md) and [validation plan](../research/codex-gap-study/14_USER_VALIDATION_PLAN.md).

**CURRENT NEXT ACTION**

**Run the preregistered paired validation of the timed commerce execution-and-next-plan workflow with 5–10 relevant participants against TikTok LIVE Manager + spreadsheet/chat, including a configured professional rundown challenge.**

