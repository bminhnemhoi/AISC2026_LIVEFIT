# LiveLift Strategic Research & Architecture Synthesis
## 00 — Executive Summary

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Baseline Git Commit:** `0a0b8c1` (UX baseline) / `c98b11e` (Product reset & legacy reuse)  
**Target Delivery:** LiveLift-next Rebuild Architecture & Post-Phase A Master Roadmap  

---

### 1. What LiveLift Should Ultimately Become

LiveLift must become an **operational decision desk, append-only evidence ledger, semantic replay engine, and continuous learning workspace** for live-commerce teams.

It is **NOT**:
- An autonomous AI autopilot that auto-pins products to TikTok Shop (an impossibility under official platform rules and a dangerous account-suspension risk).
- A generic analytics dashboard displaying vanity GMV curves.
- An AI chatbot overlay.
- A crawler-first competitor surveillance scraping tool.
- A black-box causal claim engine asserting unverified revenue lift.

Instead, LiveLift sits between the human operator (desk assistant) and the livestream reality. It operates around one continuous, disciplined loop:
$$\text{PREPARE} \longrightarrow \text{OPERATE} \longrightarrow \text{RECORD} \longrightarrow \text{REVIEW} \longrightarrow \text{LEARN} \longrightarrow \text{NEXT LIVE}$$

Crucially, **LiveLift is designed manual-first**. It delivers immediate, high-value operational control when running 100% disconnected from platform APIs (relying purely on human operator entries and plan-based intelligence), while dynamically and safely incorporating provider capabilities (catalog sync, post-live minute analytics, optional DOM observation) whenever those external providers are authenticated, capable, and healthy.

---

### 2. Core Architecture: The Six Invariant Pillars

```
                                +-----------------------------------+
                                |            OPERATOR UI            |
                                |  (Next.js 14 / React 18 / Tailwind)|
                                +-----------------------------------+
                                                  |
                                                  | REST (Commands) + SSE (Snapshot/Deltas)
                                                  v
                                +-----------------------------------+
                                |        SESSION RUNTIME API        |
                                |     (FastAPI Authoritative Core)  |
                                +-----------------------------------+
                                        |                   |
               +------------------------+                   +-----------------------+
               |                                                                    |
               v                                                                    v
+-------------------------------+                                   +-------------------------------+
|     APPEND-ONLY EVIDENCE      |                                   |     CAPABILITY ADAPTERS       |
|    & TEMPORAL EVENT STORE     |                                   |     & EXTERNAL INTEGRATIONS   |
|   (PostgreSQL 16 / JSONB)     |                                   |  (TikTok, Shopee, Simulator)  |
+-------------------------------+                                   +-------------------------------+
               |                                                                    |
               +------------------------+                   +-----------------------+
                                        v                   v
                                +-----------------------------------+
                                |    REPLAY & LEARNING SUBSYSTEM    |
                                | ("As Known Then" vs "Later Proof")|
                                +-----------------------------------+
```

The architecture is governed by six invariant principles:
1. **Unidirectional Operational Truth:** A saved plan is not a recommendation; a recommendation is not an acceptance; an acceptance is not an execution; an execution attempt is not an operator report; an operator report is not a platform observation; and an observation is never a platform confirmation.
2. **Environment Identity Separation:** `REAL` vs `SIMULATED` is an immutable session environment attribute established at session initialization. Simulation is never an automatic fallback for a failed network connection.
3. **Capability Negotiation vs Monolithic Switches:** LiveLift never branches on `if platform == 'tiktok'`. Instead, external platforms are modeled as capability providers (e.g., `CATALOG_SYNC`, `POST_LIVE_ANALYTICS`, `REALTIME_STATS`). System behavior degrades or enriches based on negotiated capability availability.
4. **Authoritative Server Revisioning:** All runtime transitions (segment start/end, hold, extend, end live) require monotonic revisions (`expected_revision`). Duplicate clicks, race conditions, and network retries fail safely without side effects.
5. **Two-Perspective Temporal Replay:** Review reconstructs operational reality in two distinct modes without falsifying history:
   - **"As Known Then":** What the operator and system knew at time $t$ during the live broadcast.
   - **"With Later Evidence":** Reconciled with post-live platform audit metrics, clearly highlighting late-arriving data and corrections.
6. **Conservative Disconnected Operation:** Disconnected operators can read and capture local notes or reports as `UNSYNCED DRAFTS`. Authoritative state cannot be mutated offline. Reconnection requires explicit operator confirmation before submitting drafts to server history.

---

### 3. Top 10 Strategic Recommendations

| # | Priority | Domain | Recommendation |
|---|---|---|---|
| **R01** | **P0** | **Integrations** | **Embrace Platform Reality:** Acknowledge that official TikTok Shop APIs provide NO live comment streaming and NO programmatic product pinning. Treat manual desk operation as the gold standard; treat official APIs as post-live audit and pre-live catalog providers. |
| **R02** | **P0** | **Runtime Safety** | **Strict Action Scoping:** Every command must bundle `session_id`, `runtime_generation`, `expected_revision`, `target_id`, `actor_id`, and `idempotency_key`. Reject any request whose target or revision does not match current authoritative state. |
| **R03** | **P0** | **Data Architecture** | **Append-Only Evidence Model:** Separate mutable session configuration (title, plan) from immutable operational evidence (`assignment_event`, `exposure_event`, `operator_report`, `metric_record`). Never overwrite or delete historical evidence. |
| **R04** | **P0** | **Realtime Layer** | **Hybrid Snapshot + Monotonic SSE:** Use HTTP POST for commands and Server-Sent Events (SSE) or WebSocket with monotonically increasing revision numbers for state synchronization. Trigger client snapshot resync upon detecting sequence gaps. |
| **R05** | **P0** | **Offline Model** | **Draft Isolation:** Persist unsynced notes/reports in browser IndexedDB labeled `UNSYNCED DRAFT`. On reconnect, prompt the operator to review and confirm submission. Never automatically submit or execute stale offline commands. |
| **R06** | **P0** | **Replay & Review** | **Bitemporal Event Tracking:** Record both `occurred_at` (when it happened) and `recorded_at` (when LiveLift received it). Default Replay to `recorded_at <= T_replay` to guarantee truth "as known then." |
| **R07** | **P0** | **Backend Strategy** | **Incremental FastAPI Evolution:** Retain and adapt existing FastAPI routes and PostgreSQL models. Strip out obsolete switchback-as-prerequisite logic and legacy autopilot code; wrap proven business logic in clean domain services. |
| **R08** | **P0** | **Experimentation** | **Decouple Core Loop from Experiments:** Do not block live sessions behind randomizers. For small rooms (<50 viewers), replace noisy switchbacks with disciplined pre/post paired product rotations and qualitative learning loops. |
| **R09** | **P0** | **Simulator** | **Scenario Engine over Heavy Framework:** Build deterministic, scenario-driven test fixtures (`golden_run.json`, `provider_outage.json`) using a virtual clock to test error handling, reconnects, and operator workflows reliably. |
| **R10** | **P0** | **Complexity Control** | **Kill Speculative Infrastructure:** Do NOT adopt Kafka, microservices, distributed orchestrators, vector databases, or multi-agent LLMs. A single PostgreSQL 16 instance with JSONB handles millions of events with sub-millisecond latencies. |

---

### 4. Top 10 System Risks & Mitigations

| # | Risk | Impact | Severity | Primary Mitigation |
|---|---|---|---|---|
| **K01** | **TikTok API Availability Illusion** | Engineering builds features dependent on non-existent official pin/chat endpoints. | **CRITICAL** | Formally document platform limitations; design UI around manual operator actions and post-live analytics. |
| **K02** | **Account Ban from Unofficial Bots** | Using reverse-engineered scraping/automation leads to TikTok Shop suspension. | **CRITICAL** | Strict quarantine of scraping code (`collectors/`); prohibit automated platform manipulation in production. |
| **K03** | **Wrong-Session / Wrong-Room Mutation** | Network callback, stale browser tab, or webhook mutates the wrong live room. | **CRITICAL** | Fail-closed scoping on `session_id`, `room_id`, and `runtime_generation`. Strict context validation before persistence. |
| **K04** | **Silent Simulation Leakage** | Synthetic simulator events pollute production seller data or analytics. | **HIGH** | Immutable `is_demo: boolean` and `environment: 'REAL' | 'SIMULATED'` flags enforced at schema and API levels. |
| **K05** | **Late Evidence Rewrites History** | Post-live delayed API metrics overwrite the live state known by the operator. | **HIGH** | Strict separation of "As Known Then" (query by `recorded_at`) vs "With Later Evidence" (query by `occurred_at`). |
| **K06** | **Duplicate Operator Commands** | Double-clicking transition buttons causes double segment advances or skips. | **HIGH** | Frontend button locking + backend idempotency keys (`Idempotency-Key` header) with 60-second cache deduplication. |
| **K07** | **Silent Offline State Divergence** | Operator works offline, reconnects, and blindly overrides newer server state. | **HIGH** | Offline actions strictly quarantined as `UNSYNCED DRAFT`. Reconnect requires explicit operator review before submission. |
| **K08** | **Storage Outage Masquerading as Normal** | DB outage causes 5xx, but UI displays empty arrays or zeros as if true. | **HIGH** | Follow legacy test `test_kho_chet_giua_phien`: DB failure surfaces explicit `StorageDegraded` UI, never zero or empty. |
| **K09** | **False Causal Claims in Review** | Recommending strategies based on spurious correlation, damaging seller trust. | **HIGH** | Strict UI copy guardrails: distinguish `Observation` from `Insight` and `Hypothesis`. Prohibit causal claims without experimental proof. |
| **K10** | **Cognitive Overload During Live** | Operator desk is cluttered with analytics widgets, missing crucial 5-second cues. | **HIGH** | Strictly enforce the 5-second NOW/NEXT/WHY/ACTION hierarchy locked in canonical design baseline `0a0b8c1`. |

---

### 5. What to Reuse vs What to Discard from Legacy

```
+-----------------------------------------------------------------------------------+
|                                 LEGACY AUDIT VERDICT                              |
+----------------------------------------------------+------------------------------+
| REUSE / ADAPT (High Value)                         | DISCARD / KILL (Technical Debt)|
+----------------------------------------------------+------------------------------+
| * Session lifecycle state machine (planned->ended) | * Mandatory switchback schedule as pre-req   |
| * Explicit action scoping (session, product, actor)| * Autopilot / auto-pin execution modules    |
| * Append-only assignment & exposure event separation| * Legacy Next.js 14 /web UI & old styling   |
| * PII filtering engine (Law 91/2025/QH15 compliant)| * Redis / Timescale hypertable dependency    |
| * GIVT-lite click validity rules & shortlinks      | * Migrations 0001-0009 coupling              |
| * Storage failure visibility & degradation tests   | * Raw TikTok scraping dependencies in core   |
| * Post-live minute analytics client & HMAC signing | * 4-column widget dashboard layout           |
+----------------------------------------------------+------------------------------+
```

---

### 6. Master Roadmap Overview (Post-Phase A Frontend)

The remaining development after the current frontend build (Phase A) is compressed into **four autonomous, high-leverage major engineering phases**:

```
[ PHASE A: Frontend Rebuild & UX Contracts ]  <-- CONCURRENTLY RUNNING
                      |
                      v
[ PHASE B: Backend Core, Contracts & Session Runtime ]
   * Clean domain schemas (Pydantic v2) matching Phase A contracts
   * Session lifecycle, Run of Show, Product Pack persistence
   * Monotonic revision management & idempotency engine
                      |
                      v
[ PHASE C: Realtime Engine, Command Safety & Offline Resilience ]
   * Server-Sent Events (SSE) / WebSocket state push
   * Reconnect resync & sequence gap recovery protocol
   * Client IndexedDB draft storage & explicit reconciliation flow
                      |
                      v
[ PHASE D: Evidence Ledger, Capability Providers & Semantic Replay ]
   * Append-only evidence repository & bitemporal queries
   * Capability-oriented provider adapters (TikTok Shop, Shopee, Sim)
   * Semantic Replay ("As Known Then" vs "With Later Evidence")
   * Learning loop & clone-into-next-live pipeline
                      |
                      v
[ PHASE E: System Hardening, Scenario Verification & Production Cutover ]
   * Deterministic simulator scenario suite & fault injection
   * End-to-end integration & Playwright golden-path validation
   * Zero-downtime Caddy cutover (/web -> /next) and deployment
```

---

### 7. Major Unresolved Unknowns

1. **Official TikTok Shop Partner Account Approval:** Unclear whether seller accounts can obtain live data scopes without dedicated ByteDance Account Managers in SE Asia.
2. **Post-Live Minute Analytics Latency:** Official TikTok documentation states minute performance is available "after the session is finished," but does not commit to a latency window (15 mins vs 2 hours vs next day).
3. **Operator Compliance Under Live Broadcast Stress:** Real-world field testing is required to measure how consistently solo operators log manual product presentations while coordinating with hosts.
