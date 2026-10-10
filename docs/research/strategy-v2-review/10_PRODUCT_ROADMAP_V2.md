# LiveLift Strategy Review & Independent Product Evaluation
## 10 — Product Roadmap V2: Autonomous Major Phases

**Evaluator:** Independent Principal Technical Architect & Systems Researcher  
**Date:** October 4, 2026  
**Execution Target:** Autonomous Coding Agents Executing Post-Phase A Frontend  
**Guiding Architecture:** The Commerce Run-of-Show & Live Operations Desk (Option B)  

---

### 1. Master Phase Architecture Overview

Development after the Phase A frontend build is compressed into **four autonomous, high-leverage major engineering phases**:

```
[ PHASE A: FRONTEND REBUILD (CONCURRENT) ]
* Complete /next layout, LiveLift Control styling, and initial UI contract fixtures.
                    |
                    v
==========================================================================================
[ MAJOR PHASE 1: BACKEND CORE, RUNDOWN PERSISTENCE & SESSION RUNTIME ]
Mission: Build authoritative FastAPI domain layer; persist Run of Show, Product Pack
         snapshots, dynamic cascade timing calculations, and fail-closed session lifecycles.
                    |
                    v
==========================================================================================
[ MAJOR PHASE 2: REALTIME DESK SYNCHRONIZATION & COMMAND SAFETY ]
Mission: Build Server-Sent Events (SSE) state broadcasting, sequence-gap snapshot resync,
         command idempotency middleware, and dual-operator authority locking.
                    |
                    v
==========================================================================================
[ MAJOR PHASE 3: 3-MINUTE POST-LIVE REVIEW, TIKTOK ENRICHMENT & 1-CLICK CLONE ]
Mission: Build executive plan vs actual variance engine, official TikTok Shop minute-level
         analytics ingestion adapter, and 1-click playbook carry-forward.
                    |
                    v
==========================================================================================
[ MAJOR PHASE 4: DETERMINISTIC REHEARSAL SCENARIOS & PRODUCTION CUTOVER ]
Mission: Implement deterministic simulation engine, end-to-end Playwright golden-path suite,
         and zero-downtime Caddy proxy cutover from legacy /web to /next.
```

---

### 2. Major Phase 1: Backend Domain Core, Rundown Persistence & Session Runtime

#### Mission
Establish the authoritative FastAPI backend domain layer and persistence engine that powers the newly built Phase A frontend (`/next`), implementing strict session lifecycles, Run of Show persistence, immutable Product Pack snapshots, and dynamic cascade timing calculations.

#### What to Build
1. **Pydantic v2 Domain Models:**
   - Define clean models matching Phase A contracts: `Session`, `SessionProductSnapshot`, `RunOfShowPlan`, `Segment`, `RuntimeState`, `OperatorCommand`.
   - Implement dynamic downstream cascade calculation in Python: recalculate projected segment start times when an active segment overruns its target duration.
2. **Domain Repository Layer:**
   - Refactor `src/livelift/api/store.py` into `SessionRepository` and `PlanRepository`.
   - Maintain dual-backend support: PostgreSQL 16 (psycopg3) for production, in-memory for unit tests.
3. **Core REST Routers:**
   - `POST /api/sessions`: Create new session (`REAL` vs `SIMULATED`).
   - `GET /api/sessions/{id}/prepare` & `PUT /api/sessions/{id}/plan`: Autosave updated Run of Show and Product Pack.
   - `POST /api/sessions/{id}/start`: Start Live tracking. Validates preflight blockers (positive durations, unmapped products), materializes start plan, freezes baseline.
   - `POST /api/sessions/{id}/commands/start_segment`, `extend`, `hold`, `skip`: Advance or alter segments with `expected_revision`.
   - `POST /api/sessions/{id}/end`: Authoritative End Live. Freezes runtime.

#### What to Avoid
- DO NOT port legacy switchback randomizers (`assigner/outer.py`).
- DO NOT port legacy `autopilot.py` auto-pinning code.
- DO NOT touch `/web` or modify Phase A `/next` files.

#### Quality Gates
- `pytest tests/test_vong_doi_phien.py` passes 100% against new session state machine.
- Dynamic cascade timing correctly projects future segment start times when current segment is extended.
- Start Live fails closed if durations are non-positive or required products are unmapped.

#### Definition of Done
The backend can execute a complete manual golden path via REST calls (Create $\rightarrow$ Add Products $\rightarrow$ Build ROS $\rightarrow$ Start Live $\rightarrow$ Advance Segments $\rightarrow$ End Live) with all revisions incrementing monotonically.

#### Rollback Point
Revert to baseline commit `0a0b8c1`.

---

### 3. Major Phase 2: Realtime Desk Synchronization & Command Safety

#### Mission
Build the real-time coordination and network fault-tolerance layer: SSE state broadcasting, monotonic revision gap recovery, command idempotency caching, and dual-operator locks.

#### What to Build
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

#### What to Avoid
- DO NOT build complex peer-to-peer WebRTC or CRDT engines.
- DO NOT queue live transition commands (Start, End) while offline.

#### Quality Gates
- Double-clicking "Start Segment" executes exactly one segment advance (tested via concurrent pytest).
- Simulating a dropped SSE message triggers automatic snapshot resync within $< 500$ ms.

#### Definition of Done
Simulating Wi-Fi disconnection on the operator desk preserves local notes, locks transition controls, interpolates clocks, and recovers state cleanly upon reconnection.

#### Rollback Point
Disable SSE stream and fall back to manual refresh on Phase 1 REST endpoints.

---

### 4. Major Phase 3: 3-Minute Post-Live Review, TikTok Enrichment & 1-Click Clone

#### Mission
Implement the executive plan vs actual variance engine, the official TikTok Shop minute-level analytics ingestion adapter, and the 1-click playbook carry-forward loop.

#### What to Build
1. **Executive Plan vs Actual Variance Engine:**
   - Compute segment-by-segment duration variance (planned vs actual seconds).
   - Identify top 3 overrun/underrun segments and highlight unpresented products.
2. **Official TikTok Shop Partner Integration Adapter:**
   - Port `src/livelift/ingest/tiktok_shop.py` into `TikTokShopCapabilityAdapter`.
   - Implement catalog import (`product.list`) and post-live minute performance fetch (`performance_per_minutes`).
   - Join minute-level attributed product clicks and GMV directly to the executed Run of Show segments.
3. **1-Click Playbook Carry-Forward:**
   - Generate concrete recommended plan mutations (e.g. *"Reduce M03 planned duration from 8m to 6m"*).
   - Implement `POST /api/sessions/clone`: clones rundown, applies selected adjustments, creates fresh session for tomorrow's live.

#### What to Avoid
- DO NOT scrape TikTok chat via unofficial reverse-engineered tools.
- DO NOT generate automated causal claims ("This action caused +40% GMV") in the review UI.

#### Quality Gates
- Querying post-live review generates the complete 3-minute executive variance card in $< 50$ ms.
- TikTok post-live minute data joins accurately to segment timestamps without modifying historical live logs.
- 1-Click clone creates a valid new session with adjusted durations and explicit provenance links.

#### Definition of Done
An operator can end a session, view the 3-minute variance report, inspect joined TikTok sales metrics, and generate an auto-adjusted plan for tomorrow's live broadcast in one click.

#### Rollback Point
Disable TikTok adapter; retain Phase 2 manual review and cloning.

---

### 5. Major Phase 4: Deterministic Rehearsal Scenarios & Production Cutover

#### Mission
Finalize the deterministic scenario engine, execute comprehensive automated Playwright and storage resilience test suites, cut over Caddy proxy from `/web` to `/next`, and verify demo readiness.

#### What to Build
1. **Deterministic Scenario Simulation Engine:**
   - Implement `SimulatorCapabilityAdapter` driven by scenario JSON fixtures (`01_golden_run.json`).
   - Provide instant seeding CLI: `python -m livelift.sim seed-demo`.
2. **Comprehensive Integration & E2E Test Suite:**
   - Implement Playwright test executing the complete golden path: Home $\rightarrow$ Create $\rightarrow$ Prepare $\rightarrow$ Operate $\rightarrow$ Wrap $\rightarrow$ Review $\rightarrow$ Clone.
   - Run legacy storage degradation benchmark (`test_kho_chet_giua_phien.py`) against the new PostgreSQL store.
3. **Production Deployment Cutover:**
   - Update `docker-compose.prod.yml` to launch `/next` container on port 3000.
   - Update `docker/Caddyfile`: route root `/*` to `next:3000`, route `/api/*` to `api:8000`.
   - Preserve `/legacy/*` pointing to old `web:3000` for emergency rollback contingency.

#### What to Avoid
- DO NOT delete legacy `/web` code before cutover verification is complete.
- DO NOT perform destructive database table drops.

#### Quality Gates
- Full Playwright E2E suite passes with 0 failures on headless Chromium.
- Storage outage simulation displays explicit degradation banner without corrupting session data.
- Fresh deployment from clean machine boots and passes health checks in $< 60$ seconds.

#### Definition of Done
LiveLift-next is live on root domain `/*`, serving the new LiveLift Control interface, backed by the robust evidence core, fully verified via automated tests, with a working deterministic demo ready for presentation.

#### Rollback Point
Revert `docker/Caddyfile` root proxy to point back to `web:3000`.
