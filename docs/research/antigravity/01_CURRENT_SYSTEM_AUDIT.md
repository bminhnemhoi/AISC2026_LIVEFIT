# LiveLift Strategic Research & Architecture Synthesis
## 01 — Current System Audit & Legacy Reuse Analysis

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Audited Targets:** `src/livelift/**`, `web/**`, `collectors/**`, `docker/**`, `ops/**`, `scripts/**`, `tests/**`  
**Reference Documents:** `references/LEGACY_REUSE_MATRIX.md`, `HARNESS.md`, `PREREGISTRATION.md`, `docs/incident-log.md`  

---

### 1. Architectural Audit Overview

The legacy codebase represents an intensive experimental prototype developed for an academic/innovation competition (AISC'26). While it successfully validated core statistical ideas and achieved a clean test record (over 2,100 passing tests), it accumulated significant technical debt and domain coupling. 

Specifically, the system was originally conceived around an **automated switchback experiment engine** that assumed automated product pinning, raw live comment scraping, and mandatory experimental randomization schedules before a live broadcast could even begin.

The reset committed in `c98b11e` and codified in `plan.md` establishes that **LiveLift is an operational decision and evidence workspace, not an autonomous experiment runner**. 

This audit systematically categorizes every subsystem in the repository to establish what to salvage, what to adapt, and what to purge.

---

### 2. Component-by-Component Deep Dive

```
+-----------------------------------------------------------------------------------------+
|                                LEGACY SYSTEM TOPOLOGY                                   |
+-----------------------------------------------------------------------------------------+
| [Frontend: web/]                                                                        |
| Next.js 14, React 18, Tailwind, Recharts                                                |
| Routes: /chay-phien (wizard), /desk (4 columns), /host, /ket-qua, /replay               |
+-----------------------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------------+
| [Backend: src/livelift/api/]                                                            |
| FastAPI, Pydantic, store.py (Dual backend: in-memory snapshot + psycopg3 PostgreSQL)    |
| Modules: actions.py, autopilot.py, cards.py, ingest_jobs.py, sessions.py, ws.py        |
+-----------------------------------------------------------------------------------------+
          |                                  |                                 |
          v                                  v                                 v
+-----------------------+          +-----------------------+         +--------------------+
| [Core & Analysis]     |          | [Ingest & Collectors] |         | [Storage Layer]    |
| assigner (outer/inner)|          | ingest/base.py        |         | Postgres 16        |
| estimators.py         |          | tiktok_shop.py        |         | TimescaleDB        |
| click_validity.py     |          | shopee.py, youtube.py |         | Redis (idle)       |
| pii/filter.py         |          | collectors/tiktok_pub |         | Migrations 01-09   |
+-----------------------+          +-----------------------+         +--------------------+
```

#### 2.1 Backend Core (`src/livelift/api/`)
- **`store.py` (2,054 lines):** Implements a dual-mode persistence layer (PostgreSQL with psycopg3 or in-memory dictionary with JSON file snapshots).
  - *Strengths:* Implements write-once columns, transaction safety, and graceful degradation when Postgres is unavailable. Handles hypertable queries for `session_tick`.
  - *Weaknesses:* Extreme coupling. A single file manages session lifecycles, experimental blocks, comments, clicks, orders, and interventions. Contains legacy table assumptions (`experiment_block`, `intervention_log`).
  - *Verdict:* **Refactor & Split.** Extract persistence into domain-specific repositories (`SessionRepository`, `PlanRepository`, `EvidenceRepository`). Keep the dual-backend interface pattern for local development and unit testing.
- **`routes/sessions.py` (473 lines):** Manages session state machine (`planned`, `scheduled`, `live`, `ended`, `cancelled`).
  - *Strengths:* Enforces fail-closed lifecycle transitions (e.g., cannot end a session that never started; cancels un-aired sessions cleanly via migration 0008).
  - *Weaknesses:* Enforces schedule pre-conditions; treats switchback parameters as core session metadata.
  - *Verdict:* **Adapt.** Strip experimental arm requirements; adapt to support the new `RunOfShow` and `ProductPack` domain models.
- **`routes/actions.py` (340 lines) & `cards.py` (200 lines):** Manages operator recommendations, candidate evaluation, and execution logging.
  - *Strengths:* Strict action scoping born out of an incident where client clicks drifted from backend candidate sets. Carries `session_id`, `product_id`, `actor`, and timestamps.
  - *Weaknesses:* Coupled to `autopilot.py` and old candidate scoring routines.
  - *Verdict:* **Rebuild.** Use the proven scoping invariant (`session_id`, `revision`, `target_id`, `decision_id`, `actor`), but replace the underlying card engine with the clean `NOW/NEXT/WHY` state machine.
- **`autopilot.py` (607 lines):** Background loop attempting automatic execution of pin actions during "ON" blocks.
  - *Weaknesses:* Fundamentally obsolete. Built on the assumption that external platforms allow automated pinning, or that an operator wants hands-off automated changes.
  - *Verdict:* **PURGE / DO NOT REUSE.** Completely eliminate.

#### 2.2 Storage & Database Schema (`src/livelift/migrations/`)
- **`0001_init.up.sql`:** Created `product`, `live_session`, `experiment_block`, `session_tick`, `intervention_log`, `comment_event`, `shortlink`, `click_event`, `order_event`.
- **`0006_event_tables.up.sql`:** Key architectural improvement that split intent from reality:
  - `assignment_event`: Append-only schedule intent materialized prior to live.
  - `exposure_event`: Append-only operational reality (pins, unpins, block transitions) with `ack_latency_ms`.
- **`0008_session_lifecycle_and_dry_run.up.sql` & `0009_is_demo.up.sql`:** Added `cancelled`, `dry_run`, and `is_demo`.
  - *Strengths:* The database migration history shows hard-won lessons about preserving operational truth and preventing test/demo data contamination.
  - *Weaknesses:* TimescaleDB hypertable (`session_tick`) was over-engineered for low-frequency live events; Redis was provisioned in Docker Compose but never utilized by application code.
  - *Verdict:* **Retain Schema Concepts, Reorganize Tables.** In the new architecture, do NOT run migrations 0001-0009 as-is. Create clean, unified schema definitions that natively embody append-only evidence without legacy experimental baggage.

#### 2.3 Frontend Application (`web/`)
- **Current Stack:** Next.js 14 (Pages/App router mix), Tailwind CSS, Recharts.
- **Pages:**
  - `/chay-phien`: Multi-step setup wizard that forced operators through random seed generation and switchback schedules before broadcasting.
  - `/desk`: Operator console utilizing four equal-weight columns, overwhelming operators with raw comment streams, uncurated cards, and small action buttons.
  - `/host`: Simplified display showing elapsed time and current pinned product.
  - `/ket-qua`: Post-session reporting focused strictly on ITT/LATE statistical estimators and confidence intervals.
  - `/replay`: Visual playback attempting to synchronize YouTube chat with timeline ticks.
- *Verdict:* **REPLACE ENTIRELY WITH `/next`.** As governed by `plan.md` and canonical design `0a0b8c1`, `/web` is completely superseded by `/next` (LiveLift Control). None of the `/web` UI components, layouts, or state logic should be transplanted.

#### 2.4 Collectors & External Ingestion (`collectors/` & `src/livelift/ingest/`)
- **`collectors/tiktok_public/`:** Unofficial scraping script using reverse-engineered WebSocket protocols to intercept live chat. Quarantined from `src/` by architectural lint rules (`scripts/check_isolation.py`).
  - *Verdict:* **DO NOT USE FOR PRODUCTION.** Keep quarantined strictly as historical reference. Never import into core application services.
- **`src/livelift/ingest/tiktok_shop.py` (1,314 lines):** Rigorous, production-grade client for the official TikTok Shop Open Platform (Partner Center).
  - *Strengths:* Correctly implements HMAC-SHA256 request signing across query, path, and body bytes; handles header-based access tokens; implements rate-limiting backoff (0.2-1.0 QPS); packages error codes; and sanitizes secrets in logs. Correctly targets official post-live minute performance (`/analytics/202510/shop_lives/{live_id}/performance_per_minutes`) and product performance endpoints.
  - *Verdict:* **SALVAGE AND ADAPT.** This is a high-value module. Wrap it in a clean `TikTokShopCapabilityAdapter` implementing the new provider capability interface.
- **`src/livelift/ingest/pii/filter.py` (220 lines):** Comprehensive Vietnamese PII scrubber.
  - *Strengths:* Custom regex and dictionary-based scrubbers for Vietnamese phone numbers (including numbers written phonetically as words, e.g., "không chín không..."), addresses, bank account numbers, emails, order codes, and personal names. Validated on test datasets to achieve $\ge 95\%$ recall to satisfy Vietnam Personal Data Protection Decree (Law 91/2025/QH15).
  - *Verdict:* **SALVAGE 100%.** Retain this module directly as a core domain utility for all incoming chat/comment processing.
- **`src/livelift/core/click_validity.py` (219 lines):** Implements IAB GIVT-lite click filtering rules for self-hosted `/r/{code}` redirects (filtering web crawlers, prefetch headers, non-GET requests, refractory windows $<10$s, and volume caps).
  - *Verdict:* **SALVAGE 100%.** Direct reuse for redirect attribution and click evidence verification.

#### 2.5 Analysis & Statistical Engines (`src/livelift/analysis/`)
- **`estimators.py`, `adjust.py`, `power.py`, `carryover.py`:** Rigorous statistical implementations of Horvitz-Thompson estimators, randomization inference, block burn-in (Hu & Wager 2022), and switchback carryover adjustment.
  - *Strengths:* Mathematically sound and verified via KuaiLive-calibrated simulations.
  - *Weaknesses:* Highly specialized for switchback A/B tests. Irrelevant during manual livestream operations or non-randomized sales sessions.
  - *Verdict:* **ARCHIVE & ISOLATE.** Keep in `analysis/` for offline or optional advanced experiment analysis modules (Phase D/E). Completely decouple from the real-time operational path.

---

### 3. Key Incident Log Findings (121 Incidents Analyzed)

A thorough review of `docs/incident-log.md` reveals critical real-world failure modes that must shape the new architecture:

1. **Selection Drift / Mismatched Action Targets:**  
   *Incident:* The operator clicked an action card in the UI, but because background state had updated, the card index mapped to a different product on the server.  
   *Architecture Fix:* All actions must be keyed by immutable target UUIDs (`product_id`, `decision_id`), never array indices or transient card positions.
2. **Uncloseable Planned Sessions:**  
   *Incident:* An operator created a session in manual mode to test setup, but could not close or cancel it because the server required `status == 'live'` before `POST /end` was permitted.  
   *Architecture Fix:* Explicit session state machine with `cancelled` and `abandoned` paths that preserve auditability without corrupting active live pools.
3. **Demo Data Contamination of Production Metrics:**  
   *Incident:* Seeding demo sessions populated the primary database tables, polluting aggregate seller reports with synthetic data.  
   *Architecture Fix:* Migration 0009 introduced `is_demo: boolean`. In LiveLift-next, `REAL` vs `SIMULATED` is an immutable top-level environment boundary.
4. **Storage Outages Masquerading as Normal Inactivity:**  
   *Incident:* During a database connection pool failure, endpoints returned HTTP 500 or fallback empty lists, leading the UI to display "0 comments, 0 clicks" rather than alerting the operator that persistence had died.  
   *Architecture Fix:* Implement `StorageDegradedException` and visible system health indicators. If persistence fails, LiveLift halts automatic processes and alerts the desk immediately.
5. **Client/Server Latency Drift:**  
   *Incident:* Client timestamps diverged by up to 45 seconds from the server, causing events to be assigned to incorrect time buckets.  
   *Architecture Fix:* Server-authoritative timestamps (`recorded_at`, `server_ts`) for all state transitions, with monotonic sequence numbers for client ordering.

---

### 4. Definitive Legacy Reuse Matrix

| Module / Component | Classification | Primary Reason | Future Action in LiveLift-next |
|---|---|---|---|
| `src/livelift/api/main.py` | **Adapt** | Clean FastAPI bootstrap, CORS, exception handling | Adapt to register new domain routers; remove legacy routes |
| `src/livelift/api/store.py` | **Refactor** | Excellent transactional invariants, but bloated | Split into domain repositories (`SessionRepo`, `EvidenceRepo`) |
| `src/livelift/api/routes/sessions.py` | **Adapt** | Proven lifecycle transition guards | Refactor around `RunOfShow` / `ProductPack` contracts |
| `src/livelift/api/routes/actions.py` | **Replace** | Coupled to card engine and switchbacks | Rebuild around `NOW/NEXT/WHY/ACTION` command handlers |
| `src/livelift/api/autopilot.py` | **DISCARD** | Autopilot pinning is obsolete and unsafe | **DELETE.** Do not port any autopilot code |
| `src/livelift/ingest/tiktok_shop.py` | **Reuse** | Flawless HMAC signing, rate-limiting, error handling | Adapt into `TikTokShopCapabilityAdapter` |
| `src/livelift/ingest/pii/filter.py` | **Reuse** | Vietnamese PII scrubber with $\ge 95\%$ recall | Reuse directly as shared ingestion utility |
| `src/livelift/core/click_validity.py` | **Reuse** | Robust GIVT-lite click filtering engine | Reuse directly for `/r/{code}` attribution redirect |
| `src/livelift/core/assigner/` | **Isolate** | Clean pure functions, but switchback specific | Move to optional experiment plugin module |
| `src/livelift/analysis/` | **Isolate** | Complex causal estimators | Move to offline post-live analysis engine |
| `web/` (Next.js 14 legacy) | **DISCARD** | Cluttered 4-column layout, outdated dependencies | **SUPERSEDED** completely by new `/next` frontend |
| `collectors/tiktok_public/` | **DISCARD** | Unofficial scraper risking account bans | Keep quarantined; do not import in core services |
| `docker/Caddyfile` | **Reuse** | Solid reverse proxy with automatic HTTPS | Update upstream routes to point to `/next` |
| `tests/test_kho_chet_giua_phien.py`| **Reuse** | Golden test pattern for storage outage visibility | Port to new test harness as required quality gate |
