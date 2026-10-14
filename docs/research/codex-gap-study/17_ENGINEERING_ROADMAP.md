# Engineering roadmap — three usable checkpoints

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

The [master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) is the single authority. This is its dated engineering detail, not a second mutable plan. No implementation was performed in this research task.

| Stage | Product status | Evidence required |
|---|---|---|
| Current frontend | UI/fixture prototype | Current 21 tests and typecheck; no backend/production implication. |
| Phase 1 | Functional manual product, single-device durable authority | Working offline plan/recovery/review/changed clone; functional user comparison. |
| Phase 2 checkpoint A | Real backend team product | Atomic durable commands, shared identity, scoped roles and two-browser/restart acceptance. |
| Phase 2 checkpoint B, optional | TikTok-enriched product | Actual approved VN entitlement and correct source/identity/metric semantics. A does not depend on B. |
| Phase 3 | Production-ready manual service; enriched tier separately gated | Restore, isolation, operational support, accessibility and repeated value. |

Before engineering: run report 14's paired concept/substitute validation. A prototype win is not a production win. Estimates below assume experienced contributors, appropriate frontend/backend coverage and no access delay; they are effort hypotheses, not commitments.

## Major Engineering Phase 1 — Functional manual P0

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

## Major Engineering Phase 2 — Real backend, team use and optional enrichment

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

## Major Engineering Phase 3 — Production-ready focused service

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


## Optional future phase

Only after repeat use and production stability: choose **one** evidence-led expansion, such as single-room agency templates/training, multi-room handoffs or one additional platform. Reuse the manual plan method and add only the proved integration. Do not package these as one inevitable commerce OS. Preregistered experiments remain a separate research gate requiring instrumentation/power/carryover evidence.
