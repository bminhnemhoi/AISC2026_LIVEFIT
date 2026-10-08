# LiveLift Strategic Research & Architecture Synthesis
## 11 — Comprehensive System Risk Register

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Scope:** Operational, Platform, Security, Statistical, and Concurrency Risks  
**Methodology:** Impact-Probability Prioritization with Explicit Fail-Closed Safeguards  

---

### 1. Risk Register Matrix

| Risk ID | Title & Description | Category | Prob. | Impact | Detection Mechanism | Mitigation Strategy | Fallback Plan | Subsystem |
|---|---|---|---|---|---|---|---|---|
| **RSK-01** | **TikTok API Availability Illusion**<br>Assuming official endpoints exist for live pinning or real-time comment streaming. | Platform | **HIGH** | **CRITICAL** | Early architecture review & failed sandbox testing | Design LiveLift manual-first; treat platform APIs strictly as post-live audit and pre-live catalog providers. | Manual operator desk with zero external API dependencies | Integration / Adapters |
| **RSK-02** | **Merchant Account Ban from Scraping**<br>Using reverse-engineered scrapers or auto-clicker extensions triggers TikTok bot detection. | Legal / Platform | **MED** | **CRITICAL** | TikTok account warning or immediate API token revocation | Strictly prohibit automated browser clickers or unauthorized scrapers in production code. | Full manual execution by human assistant on official mobile/Studio app | Architecture / Compliance |
| **RSK-03** | **Wrong-Session / Wrong-Room Mutation**<br>Async webhook or stale browser tab issues commands that mutate another active live room. | Data Integrity | **LOW** | **CRITICAL** | Scope mismatch in middleware (`req.session_id != target.session_id`) | Fail-closed scoping on `session_id`, `room_id`, and `runtime_generation`. Atomic DB verification before write. | Abort command immediately with HTTP 403 Forbidden; quarantine event | API Gateway / Runtime |
| **RSK-04** | **Silent Simulation Leakage**<br>Synthetic rehearsal data pollutes real merchant history or analytical models. | Data Integrity | **MED** | **HIGH** | Periodic data audit checking `is_demo == true` in production aggregates | Immutable `environment` (`REAL` vs `SIMULATED`) established at creation; DB constraints bar mixed aggregation. | Isolate simulation records to separate schema or flag-filtered partitions | Data Layer / Core |
| **RSK-05** | **Late Evidence Rewrites Historical Truth**<br>Post-live analytics overwrite what the operator saw during the broadcast. | Epistemic | **HIGH** | **HIGH** | Replay discrepancy between live timeline and post-live audit | Enforce bitemporal model (`occurred_at` vs `recorded_at`). Default Replay to "As Known Then" (`recorded_at <= T`). | Display late arrivals as distinct, tagged audit layers without mutating live log | Evidence / Replay |
| **RSK-06** | **Duplicate Operator Action / Double Click**<br>Operator double-clicks transition button, skipping two segments inadvertently. | Concurrency | **HIGH** | **HIGH** | Frontend button lock + backend idempotency check | Client locks button on first keydown/click; backend requires unique `Idempotency-Key` and checks `expected_revision`. | Server detects duplicate key within 60s and returns cached HTTP 200 without re-executing | Runtime / API |
| **RSK-07** | **Offline Reconnection Conflict**<br>Operator works offline and attempts to silently overwrite newer live server state. | Concurrency | **MED** | **HIGH** | Client revision mismatch upon reconnect (`client.rev < server.rev`) | Disconnected actions are quarantined as `UNSYNCED DRAFT`. Reconnect requires explicit human confirmation before submission. | Retain drafts as historical notes; never permit offline commands to alter live state | Offline Engine / UI |
| **RSK-08** | **Storage Outage Masquerading as Normal**<br>Postgres connection fails, but UI renders empty arrays, showing "0 viewers, 0 clicks." | Reliability | **MED** | **HIGH** | Backend `StorageDegradedException` caught by health monitor | Inherit legacy test `test_kho_chet_giua_phien`: DB failure raises explicit degraded state; halting automatic actions. | Render persistent full-width amber banner: "Storage Degraded — Changes Unsaved" | Storage / Health |
| **RSK-09** | **Contract Drift (Frontend vs Backend)**<br>TypeScript models in `/next` diverge from Python Pydantic models in `/src`. | Maintainability| **HIGH** | **HIGH** | CI contract test comparing Zod schemas against generated OpenAPI specs | Automated schema generation script runs in CI; fails build on any unmapped field or type mismatch. | Halt build until schemas synchronize | Build & CI |
| **RSK-10** | **Studio Wi-Fi / Demo Network Drop**<br>Connection severed during high-stakes sales presentation or competition demo. | Infrastructure | **HIGH** | **HIGH** | SSE heartbeat timeout ($>10$ seconds without keep-alive ping) | Desk remains 100% readable; local clocks continue interpolating; notes saved as local drafts; clear offline badge. | Operator continues tracking presentation manually on desk | Realtime / Network |
| **RSK-11** | **Underpowered Statistical Claims**<br>Asserting causal lift in small live rooms ($<50$ viewers) where noise exceeds effect. | Statistical | **HIGH** | **MED** | Automated statistical power check ($N_{\text{viewers}} \times T_{\text{dwell}}$) | Strictly prohibit automated causal lift percentages in UI; enforce epistemic copy (Observations vs Hypotheses). | Present data as descriptive operational milestones rather than causal proof | Analysis / Review |
| **RSK-12** | **Operator Cognitive Overload**<br>Desk displays too many graphs and widgets, causing operator to miss 5-second transition. | Ergonomic | **MED** | **MED** | Usability testing; operator response latency exceeding 5 seconds | Enforce canonical design `0a0b8c1`: dominant NOW/NEXT band; collapse secondary columns into one tabbed region. | Fallback to keyboard shortcuts and high-contrast minimal display mode | Frontend UX |
| **RSK-13** | **Dual-Operator Authority Collision**<br>Lead operator and assistant attempt simultaneous conflicting segment transitions. | Concurrency | **MED** | **MED** | Server detects non-lead operator token attempting state transition | Strict `lead_operator_id` lock; assistant controls display lock icon; explicit takeover modal with revision bump. | Second command rejected with HTTP 409 Conflict: "Controlled by Lead Operator" | Runtime / Security |
| **RSK-14** | **Vietnamese PII Leakage into Logs**<br>Customer phone numbers or addresses in live chat leak into server logs or demo. | Security / Legal| **MED** | **HIGH** | CI automated PII scanner running against sample chat datasets | Multi-pass regex and phonetic dictionary filter (`pii/filter.py`) scrubs raw comments before memory or DB write. | Immediate redaction job and security alert; raw text never stored | Ingestion / PII |
| **RSK-15** | **Accidental Deletion of Completed Sessions**<br>Operator attempts to delete or clean up an ended session, destroying historical evidence. | Data Loss | **LOW** | **HIGH** | API interceptor rejects `DELETE /sessions/{id}` if `status == 'ended'` | Completed sessions can only be `ARCHIVED` (hidden from default view), never hard-deleted from database. | Restore visibility via "Show Archived" toggle | Data Layer |

---

### 2. High-Priority Risk Treatment Action Plan

1. **Immediate Quarantine of Scraping Tools (RSK-01, RSK-02):**  
   Retain `scripts/check_isolation.py` in CI to ensure no scraping utilities from `collectors/` are ever referenced by core services.
2. **Implementation of Idempotency & Revision Guards (RSK-03, RSK-06):**  
   Mandate that every mutating endpoint in Phase B requires the `expected_revision` parameter and `Idempotency-Key` HTTP header.
3. **Automated Schema Contract Sync (RSK-09):**  
   Implement a lightweight code generator that outputs TypeScript Zod definitions from FastAPI OpenAPI JSON, running automatically on every backend commit.
4. **Epistemic Copy Linting in Review (RSK-05, RSK-11):**  
   Review all UI copy in `/next` against the Epistemic Language Guide (Doc 07) to ensure no unverified causal claims are displayed to merchants.
