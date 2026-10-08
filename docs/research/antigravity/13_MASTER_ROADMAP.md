# LiveLift Strategic Research & Architecture Synthesis
## 13 — Post-Phase A Master Engineering Roadmap

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Execution Model:** Four Autonomous Major Phases Optimized for High Leverage & Zero Rework  
**Baseline Inputs:** Phase A Frontend Completion (`/next`), Canonical Canvas `0a0b8c1`, Product Plan `plan.md`  

---

### 1. Roadmap Architecture: Compressing into Four Autonomous Major Phases

To maximize agent autonomy and eliminate coordination bottlenecks, all post-Phase A development is compressed into **four coherent, major engineering phases**:

```
[ PHASE A: FRONTEND REBUILD (CONCURRENT) ]
* Next.js 14 (/next), LiveLift Control Tokens, UI Component Hierarchy, Canonical Routes
                    |
                    v
==========================================================================================
[ PHASE B: BACKEND DOMAIN CONTRACTS & AUTHORITATIVE SESSION RUNTIME ]
Mission: Align FastAPI backend to Phase A domain schemas; implement authoritative session
         state machine, Run of Show versioning, Product Pack snapshots, and revisioning.
                    |
                    v
==========================================================================================
[ PHASE C: REALTIME ENGINE, COMMAND IDEMPOTENCY & OFFLINE RESILIENCE ]
Mission: Implement SSE state stream, monotonic sequence sync, snapshot resync, idempotency
         deduplication, dual-operator locking, and browser IndexedDB draft reconciliation.
                    |
                    v
==========================================================================================
[ PHASE D: APPEND-ONLY EVIDENCE LEDGER, CAPABILITY PROVIDERS & REPLAY ]
Mission: Build immutable evidence repository, capability negotiator (TikTok, Shopee, Sim),
         bitemporal "As Known Then" vs "Later Evidence" replay, and the learning carry-forward.
                    |
                    v
==========================================================================================
[ PHASE E: SYSTEM HARDENING, DETERMINISTIC SIMULATION & PRODUCTION CUTOVER ]
Mission: Complete canonical scenario fixtures, Playwright golden-path E2E suite, storage
         outage tests, zero-downtime Caddy cutover (/web -> /next), and demo packaging.
```

---

### 2. Major Phase B: Backend Core, Domain Contracts & Authoritative Session Runtime

#### Mission
Establish the authoritative, clean backend domain layer in FastAPI matching Phase A frontend contracts, implementing strict session lifecycles, Run of Show versioning, immutable Product Pack snapshots, and monotonic revision checks.

#### Inputs
- Phase A frontend contract definitions (Zod schemas / TypeScript interfaces in `/next/src/contracts/`).
- Canonical design specifications in `plan.md` and `docs/product/03_PREPARE.md`.
- Legacy session route patterns in `src/livelift/api/routes/sessions.py`.

#### Concrete Work
1. **Domain Contract Alignment:**
   - Define Pydantic v2 domain models matching Phase A contracts: `Session`, `ProductSnapshot`, `RunOfShowPlan`, `Segment`, `RuntimeState`, `OperatorCommand`.
   - Add automated schema check asserting 1:1 compatibility between backend Pydantic models and frontend Zod schemas.
2. **Session Repository Refactoring:**
   - Extract `SessionRepository` and `PlanRepository` from `src/livelift/api/store.py`.
   - Implement fail-closed lifecycle state machine: `planned` $\rightarrow$ `live` $\rightarrow$ `ended` / `cancelled` / `abandoned`.
3. **Run of Show & Product Pack Persistence:**
   - Implement versioned `run_of_show_plan` with auto-incrementing `plan_revision`.
   - Implement immutable `session_product_snapshot` tables so subsequent library changes never alter active sessions.
4. **Authoritative Runtime Endpoints:**
   - Implement `POST /api/sessions` (Create Live).
   - Implement `GET /api/sessions/{id}/prepare` & `PUT /api/sessions/{id}/plan` (Preparation & Autosave).
   - Implement `POST /api/sessions/{id}/start` (Authoritative Start Live; validates preflight blockers, freezes start-plan baseline).
   - Implement `POST /api/sessions/{id}/commands/start_segment`, `extend`, `hold`, `skip`.
   - Implement `POST /api/sessions/{id}/end` (Authoritative End Live; freezes runtime).

#### Dependencies & Preconditions
Phase A frontend contracts must be locked.

#### Critical Risks
Accidental inheritance of legacy switchback schedule prerequisites.

#### Quality Gates
- `pytest tests/test_vong_doi_phien.py` passes 100% against new session state machine.
- Start Live fails closed if durations are non-positive or required products are unmapped.
- Ending an active session freezes its state permanently; cannot restart under same `session_id`.

#### What NOT to Do
- DO NOT port legacy switchback randomizers (`assigner/outer.py`) into core session startup.
- DO NOT port legacy `autopilot.py`.
- DO NOT touch or modify `/web`.

#### Definition of Done
The backend can independently execute a complete manual golden path via REST calls (Create $\rightarrow$ Add Products $\rightarrow$ Build ROS $\rightarrow$ Start Live $\rightarrow$ Advance Segments $\rightarrow$ End Live) with full validation.

#### Rollback Point
Revert to baseline commit `0a0b8c1`.

---

### 3. Major Phase C: Realtime Engine, Command Idempotency & Offline Resilience

#### Mission
Build the real-time synchronization and network fault-tolerance layer: SSE state broadcasting, monotonic revision gap recovery, command idempotency caching, dual-operator locks, and IndexedDB draft reconciliation.

#### Inputs
- Phase B authoritative session endpoints.
- Spike 2 (SPK-02) and Spike 3 (SPK-03) validation findings.

#### Concrete Work
1. **Server-Sent Events (SSE) Stream:**
   - Implement `GET /api/sessions/{id}/events` streaming `state_delta` events with monotonic `revision: int`.
   - Implement `GET /api/sessions/{id}/snapshot` for full-state synchronization.
2. **Client Resync & Sequence Gap Protocol:**
   - In `/next`, implement SSE connection manager with auto-reconnect and exponential backoff.
   - Implement gap detection: if `previous_revision > local_revision + 1`, pause controls, fetch snapshot, update local state, resume.
3. **Command Idempotency Filter:**
   - Implement FastAPI middleware enforcing `Idempotency-Key: <UUID>` on all mutating commands.
   - Cache results in memory/Postgres for 60 seconds; repeated clicks return cached response without re-executing side effects.
4. **Two-Operator Authority Locking:**
   - Implement `lead_operator_id` verification on transition endpoints.
   - Implement `POST /api/sessions/{id}/commands/takeover_control` with explicit confirmation and revision increment.
5. **IndexedDB Offline Draft Capture & Reconciliation:**
   - Implement browser IndexedDB store for unsynced notes and presentation reports.
   - Implement reconciliation drawer: on reconnect, prompt operator to review and confirm draft submission. Prohibit automatic silent submission.

#### Dependencies & Preconditions
Phase B session runtime must be functional.

#### Critical Risks
Silent execution of stale offline commands causing unexpected state changes upon reconnection.

#### Quality Gates
- Double-clicking "Start Segment" executes exactly one segment advance (tested via concurrent pytest).
- Simulating a dropped SSE message triggers automatic snapshot resync within $< 500$ ms.
- Reconnecting offline drafts does NOT send network requests until explicit human button click.

#### What NOT to Do
- DO NOT build complex peer-to-peer WebRTC or CRDT engines.
- DO NOT queue live transition commands (Start, End) while offline.

#### Definition of Done
Simulating Wi-Fi disconnection on the operator desk preserves local notes, locks transition controls, interpolates clocks, and recovers state cleanly upon reconnection.

#### Rollback Point
Disable SSE stream and fall back to manual refresh on Phase B REST endpoints.

---

### 4. Major Phase D: Evidence Ledger, Capability Providers & Semantic Replay

#### Mission
Implement the immutable, append-only evidence ledger, pluggable capability provider adapters (TikTok Shop, Shopee, Simulator, Manual), bitemporal replay projection ("As Known Then" vs "With Later Evidence"), and the learning carry-forward loop.

#### Inputs
- Phase C realtime desk infrastructure.
- Legacy `src/livelift/ingest/tiktok_shop.py` and `src/livelift/ingest/pii/filter.py`.
- Epistemic evidence model specification (Doc 04).

#### Concrete Work
1. **Append-Only Evidence Repository:**
   - Create unified `evidence_record` table in PostgreSQL indexing `(session_id, recorded_at, occurred_at)`.
   - Ingest operator reports, action attempts, provider observations, and platform confirmations as immutable records.
2. **Capability Negotiator & Provider Adapters:**
   - Implement `CapabilityNegotiator` and `ProviderAdapter` interfaces.
   - Port `src/livelift/ingest/tiktok_shop.py` into `TikTokShopCapabilityAdapter` (handling catalog read and post-live minute performance).
   - Port `src/livelift/ingest/pii/filter.py` into shared ingestion pipeline.
   - Implement `ManualDeskAdapter` ensuring 100% operation without external integrations.
3. **Semantic Replay Projection Engine:**
   - Implement `GET /api/sessions/{id}/replay?view=as_known_then&t={timestamp}` (filters `recorded_at <= t`).
   - Implement `GET /api/sessions/{id}/replay?view=with_later_evidence&t={timestamp}` (filters `occurred_at <= t`).
   - Highlight late-arriving metrics with explicit latency badges and conflict divergence markers.
4. **Learning Objects & Next LIVE Carry-Forward:**
   - Implement endpoints to create and link `Observation`, `Insight`, `Hypothesis`, and `NextLiveChange`.
   - Implement clone endpoint `POST /api/sessions/clone`: clones Product Pack and ROS, applies selected next-live changes, records provenance link.

#### Dependencies & Preconditions
Phase C realtime infrastructure and database schemas.

#### Critical Risks
Late-arriving post-live analytics inadvertently overwriting live timeline records.

#### Quality Gates
- Querying "As Known Then" at minute 20 returns zero data for analytics received at minute 90.
- PII filter achieves $\ge 95\%$ recall on Vietnamese test fixtures before records hit the evidence ledger.
- Cloning a session copies plan structures and applied changes without copying old actual timestamps or runtime states.

#### What NOT to Do
- DO NOT scrape TikTok chat via unofficial reverse-engineered tools.
- DO NOT generate automated causal claims ("This action caused +40% GMV") in the review UI.

#### Definition of Done
An operator can review an ended session, scrub the operational timeline in both knowledge perspectives, draft an evidence-linked hypothesis, and clone the session into a revised plan for the next live.

#### Rollback Point
Retain Phase C runtime; disable advanced replay filters.

---

### 5. Major Phase E: System Hardening, Deterministic Simulation & Production Cutover

#### Mission
Finalize the deterministic scenario engine, execute comprehensive automated Playwright and storage resilience test suites, cut over Caddy proxy from `/web` to `/next`, and verify demo readiness.

#### Inputs
- Fully integrated frontend (`/next`) and backend (`/src`).
- Scenario specifications in Doc 09 (`01_golden_run.json` to `04_reconnect_reconcile.json`).

#### Concrete Work
1. **Deterministic Scenario Simulation Engine:**
   - Implement `SimulatorCapabilityAdapter` driven by scenario JSON fixtures.
   - Verify all four canonical scenarios: Golden Run, Provider Outage, High-Traffic Burst, and Reconnect Reconcile.
2. **Comprehensive Integration & E2E Test Suite:**
   - Implement Playwright test executing the complete golden path: Home $\rightarrow$ Create $\rightarrow$ Prepare $\rightarrow$ Operate $\rightarrow$ Wrap $\rightarrow$ Review $\rightarrow$ Learn $\rightarrow$ Next Live.
   - Run legacy storage degradation benchmark (`test_kho_chet_giua_phien.py`) against the new PostgreSQL evidence store.
   - Verify visual rendering on 1280×720 and 1440×900 viewports.
3. **Production Deployment Cutover:**
   - Update `docker/Dockerfile.next` for production multi-stage build.
   - Update `docker-compose.prod.yml` to launch `/next` container on port 3000.
   - Update `docker/Caddyfile`: route root `/*` to `next:3000`, route `/api/*` to `api:8000`.
   - Map `/legacy/*` to old `web:3000` for emergency rollback contingency.
4. **Demo Packaging & Verification:**
   - Seed golden demo scenario (`01_golden_run.json`) accessible via single CLI command: `python -m livelift.sim seed-demo`.
   - Validate that a fresh clone boots via `docker compose up -d` and passes health check in $< 60$ seconds.

#### Dependencies & Preconditions
Phases B, C, and D must be complete and passing tests.

#### Critical Risks
Production cutover breaks existing demonstration or testing bookmarks.

#### Quality Gates
- Full Playwright E2E suite passes with 0 failures on headless Chromium.
- Storage outage simulation displays explicit degradation banner without corrupting session data.
- Fresh deployment from clean machine boots and passes health checks without manual intervention.

#### What NOT to Do
- DO NOT delete legacy `/web` code before cutover verification is complete.
- DO NOT perform destructive database table drops.

#### Definition of Done
LiveLift-next is live on root domain `/*`, serving the new LiveLift Control interface, backed by the robust evidence core, fully verified via automated tests, with a working deterministic demo ready for presentation.

#### Rollback Point
Revert `docker/Caddyfile` root proxy to point back to `web:3000`.
