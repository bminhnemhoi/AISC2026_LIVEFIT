# LiveLift Strategic Research & Architecture Synthesis
## 03 — Target System Architecture & Data Flow

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**System Target:** LiveLift-next Production Core Architecture  
**Design Reference:** `.kombai/canvas/livelift_canonical_20261003_00_foundations.canvas`  

---

### 1. Architectural Topology Overview

LiveLift is designed as a **server-authoritative, capability-driven operational desk and append-only evidence engine**. The frontend provides high-speed, zero-latency visual feedback for operators, while the backend maintains the definitive source of operational truth, strict revisioning, and historical evidence integrity.

```
==========================================================================================
                                  OPERATOR CONSOLE (UI)
                 (Next.js 14 / React 18 / Tailwind / LiveLift Control Tokens)
  +------------------------------------------------------------------------------------+
  | Workspaces: Home | Create Live | Prepare | Operate (NOW/NEXT/WHY) | Wrap | Review   |
  | Supporting Surfaces: Sessions | Products & Packs | Integrations | Settings (P1)   |
  +------------------------------------------------------------------------------------+
                                            |
                                            v
  +------------------------------------------------------------------------------------+
  |                            FRONTEND DOMAIN LAYER                                   |
  |  * Strict Contract Types (Zod Schemas mirroring Backend Pydantic models)          |
  |  * Local UI State & View Models (TanStack Query + Lightweight Workspace Reducers)  |
  |  * Local Capture Buffer: IndexedDB for UNSYNCED DRAFTS & Offline Isolation         |
  +------------------------------------------------------------------------------------+
                                     |            ^
                 Authoritative REST  |            | Monotonic State Push
                 Commands & IdempKey |            | (SSE / WebSocket)
                                     v            |
==========================================================================================
                               API CONTRACT & GATEWAY LAYER
                                 (Caddy Reverse Proxy + FastAPI)
  +------------------------------------------------------------------------------------+
  |  * Route Authentication & Session Context Validation                               |
  |  * Command Idempotency Filter (UUID Header Dedup Cache, 60s window)                |
  |  * Monotonic Revision Check: expected_revision == session.current_revision        |
  +------------------------------------------------------------------------------------+
                                            |
                                            v
==========================================================================================
                                APPLICATION SERVICES CORE
  +------------------------------------------------------------------------------------+
  |  [Session Runtime Service]        [Plan & Catalog Service]     [Recommendation]    |
  |  * State Machine: Planned->Ended  * RunOfShow Versioning       * Plan-order due    |
  |  * Segment Start / Extend / Hold  * ProductPack Snapshots      * Priority/Coverage |
  |  * Dual-Operator Authority Token  * Reusable Library Linking   * Missing signal cue|
  |-----------------------------------+----------------------------+-------------------|
  |  [Evidence & Ledger Service]      [Replay Projection Service]  [Learning Engine]   |
  |  * Append-only event ingestion    * "As Known Then" Query      * Observation       |
  |  * Provenance & Freshness tagging * "With Later Evidence" Query* Insight/Hypothesis|
  |  * Conflict detection & logging   * Gap & Outage Marker Engine * Next-Live Diff    |
  +------------------------------------------------------------------------------------+
                                  |              |
                                  v              v
==========================================================================================
      STORAGE & PERSISTENCE LAYER                 PROVIDER ADAPTER SUBSYSTEM
        (PostgreSQL 16 + JSONB)                (Capability-Oriented Integration)
  +------------------------------------+  +--------------------------------------------+
  | Mutable Entities (Config & State): |  | [Capability Negotiator Engine]             |
  | * live_session (revision, status)  |  | * Evaluates active provider bindings       |
  | * run_of_show_plan (versions)      |  | * Computes active session capabilities     |
  | * session_product_snapshot         |  +--------------------------------------------+
  |------------------------------------|                         |
  | Immutable Append-Only Ledger:      |                         v
  | * assignment_event (intent)        |  +--------------------------------------------+
  | * exposure_event (reality)         |  | Provider Adapters:                         |
  | * operator_action_attempt          |  | 1. ManualDeskAdapter (Baseline, always on) |
  | * operator_report (assertions)     |  | 2. TikTokShopAdapter (Catalog + Post-Audit)|
  | * provider_observation (metrics)   |  | 3. ShopeeLiveAdapter (Pin control + Chat)  |
  | * learning_object (lessons/diffs)  |  | 4. DeterministicSimulator (Rehearsals)     |
  +------------------------------------+  +--------------------------------------------+
                                                                 |
                                                                 v
                                                  +----------------------------+
                                                  | External Platform APIs     |
                                                  | (TikTok, Shopee, Mock Bus) |
                                                  +----------------------------+
```

---

### 2. End-to-End Data & Control Flow: The Six Stages

#### Stage 1: PREPARE (Plan Formulation)
1. **Creation:** Operator creates a session (`POST /api/sessions`). Environment is explicitly selected as `REAL` or `SIMULATED`.
2. **Product Pack Construction:** Products are imported from CSV, pasted text, or selected from the library. The backend materializes immutable `session_product_snapshot` records so future library changes cannot alter this session's products.
3. **Run of Show (ROS) Formulation:** Operator arranges segments, durations, and linked products. Edits increment the `plan_revision`.
4. **Preflight Validation:** The server evaluates readiness:
   - *Blocking Errors:* Missing title, zero segments, non-positive durations, unmapped products, another active live session.
   - *Non-Blocking Warnings:* Products omitted from rundown, optional provider disconnected.
5. **START LIVE Transition:** Operator clicks START LIVE.
   - Request includes `session_id`, `plan_revision`, and `operator_id`.
   - Server validates state, transitions status from `planned` to `live`, materializes the initial plan into immutable `assignment_event` rows, and issues an authoritative `session_started` event.

#### Stage 2: OPERATE (Live Runtime Control)
1. **Authoritative NOW State:** Displays the current active segment, elapsed seconds (derived from `now() - segment.start_ts`), target duration, and operator identity.
2. **NEXT Recommendation Pipeline:**
   - Evaluated dynamically from: (a) saved plan sequence, (b) operator queue overrides, (c) presentation coverage, and (d) configured constraints.
   - Displays proposed target, concise WHY reasons, and explicit "Missing inputs" indicators if provider signals are unavailable.
3. **Command Execution Path:**
   - Operator clicks **Accept Recommendation** $\longrightarrow$ Dispatches `POST /api/sessions/{id}/commands/accept` with `decision_id` and `expected_revision`. Recorded as a decision; NOW remains completely unchanged!
   - Operator clicks **Start Segment** $\longrightarrow$ Dispatches `POST /api/sessions/{id}/commands/start_segment`. Server verifies revision, closes the previous segment, sets active segment, appends an `exposure_event`, increments `session.revision`, and pushes updated snapshot via SSE.
   - Operator clicks **Extend (+1 min)** $\longrightarrow$ Updates operational target duration without modifying the original planned baseline duration.

#### Stage 3: RECORD (Multi-Source Evidence Capture)
Operational facts arrive through three distinct channels:
1. **Human Operator Reports:** Operator clicks "Report Product Presented" or logs a quick note. Dispatched with server-side timestamping and actor identity. If disconnected, captured as `UNSYNCED DRAFT` in browser IndexedDB.
2. **Provider Observations:** External provider adapters (e.g., Shopee live poller or YouTube live chat reader) poll or receive external platform data. Events are sanitized via the PII scrubber (`pii/filter.py`) and stored as `provider_observation` with explicit source and latency metadata.
3. **Platform Confirmations:** Authorized postconditions verified directly against external APIs (e.g., Shopee confirming showing item). Marked as `PLATFORM_CONFIRMED`. If confirmation cannot be validated, the record remains explicitly `UNKNOWN`.

#### Stage 4: WRAP (Operational Closure)
1. **End LIVE Trigger:** Lead operator clicks "End LIVE" in the focused header and confirms the target session name.
2. **Authoritative Freeze:** Server transitions session status to `ended`, sets `end_ts = now()`, closes the final open segment, and freezes the runtime state machine. Further live transitions are rejected fail-closed.
3. **Wrap Desk:** Displays session duration, segment completion tally, outstanding unverified actions, and any device-local unsynced drafts requiring reconciliation.

#### Stage 5: REVIEW (Semantic Replay)
1. **Replay Engine Ingestion:** Ingests the unified append-only ledger (`assignment_event`, `exposure_event`, `operator_report`, `provider_observation`, `metric_window`).
2. **Dual-Perspective Projection:**
   - **"As Known Then" (Default):** Reconstructs the timeline for any time $T$ using solely records where `recorded_at <= T`. Allows auditing the exact information that led an operator to accept or reject an action.
   - **"With Later Evidence":** Layers in post-live minute performance metrics fetched from TikTok Shop Open API after session end, highlighting discrepancies between operator reports and platform audit logs.

#### Stage 6: LEARN & NEXT LIVE (Continuous Improvement)
1. **Knowledge Extraction:** Operator creates evidence-linked `LearningObject` items:
   - `Observation` (e.g., "Cargo pants segment overrun by 4 minutes due to sizing questions")
   - `Insight` (e.g., "Size charts missing from first 3 minutes of presentation")
   - `Hypothesis` (e.g., "Introducing size chart at minute 1 reduces segment duration")
   - `Next-Live Change` (e.g., Concrete patch: Add cue 'Show Size Chart' to M03 segment)
2. **Clone into Next LIVE:** Operator clicks "Create Next LIVE."
   - Server creates a brand new session with a new `session_id`.
   - Clones the Product Pack and Run of Show from the previous session.
   - Previews and applies selected `Next-Live Changes` as concrete plan modifications.
   - Preserves complete provenance links to the originating session without mutating the historical record.

---

### 3. Subsystem Boundaries and Invariants

```
+-----------------------------------------------------------------------------------------+
|                               ARCHITECTURAL INVARIANTS                                  |
+-----------------------------------------------------------------------------------------+
| 1. Server Authority: The browser never decides segment timing or session state. Clocks  |
|    are derived from authoritative start_ts and server clock synchronization.             |
|                                                                                         |
| 2. Append-Only Ledger: Events, observations, and reports are strictly immutable.        |
|    Corrections append new records referencing the original fact; they never delete.     |
|                                                                                         |
| 3. Environment Isolation: REAL and SIMULATED sessions share data schemas but NEVER share|
|    runtime processes, database records, or analytical aggregations.                     |
|                                                                                         |
| 4. Fail-Closed Commands: Any mismatch in session_id, room_id, or expected_revision      |
|    immediately aborts the command with HTTP 409 Conflict.                               |
|                                                                                         |
| 5. Capability-Aware UI: Controls only appear if the underlying capability is active.    |
|    If an integration is disconnected, the UI displays manual fallbacks without error.   |
+-----------------------------------------------------------------------------------------+
```
