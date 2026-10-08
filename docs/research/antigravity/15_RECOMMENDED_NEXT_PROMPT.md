# LiveLift Strategic Research & Architecture Synthesis
## 15 — Recommended Next Engineering Phase Master Prompt

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Target:** Master Prompt for Phase B Execution (Post-Phase A Frontend Completion)  
**Usage:** Ready to be pasted directly into an autonomous coding agent. **DO NOT EXECUTE NOW.**  

---

```markdown
==========================================================================================
LIVELIFT — PHASE B: BACKEND DOMAIN CONTRACTS, PERSISTENCE & AUTHORITATIVE SESSION RUNTIME
==========================================================================================

You are acting as the Staff Backend & Systems Engineer for LiveLift.

Your mission in this phase is to establish the authoritative FastAPI backend domain layer
and persistence engine that powers the newly built Phase A frontend (/next).

You must execute Phase B cleanly, safely, and autonomously.

==================================================
CONTEXT & BASELINE
==================================================

ROOT: /home/towfienes/Projects/LiveLift-next
BRANCH: rebuild/livelift-next
CANONICAL UX BASELINE: 0a0b8c1 (plan.md & LiveLift Control tokens)
STRATEGIC RESEARCH SPECIFICATIONS: docs/research/antigravity/**

PHASE A STATUS:
The new frontend under `/next` has completed foundations, routes, and contracts.
The TypeScript domain contracts reside in:
- `next/src/contracts/**` (or `next/src/types/**`)

YOUR JOB IS BACKEND INTEGRATION & SESSION RUNTIME PERSISTENCE.
DO NOT BREAK OR REGRESS `/next`.
DO NOT MODIFY `/web` (legacy).

==================================================
ARCHITECTURAL INVARIANTS (NON-NEGOTIABLE)
==================================================

1. SERVER AUTHORITY: The client browser never decides segment timing, active states,
   or session status. Clocks are derived from server-authoritative timestamps.
2. STRICT ACTION SCOPING: Every command must validate session_id, runtime_generation,
   expected_revision, target_id, and actor_id. If expected_revision does not match
   session.revision, REJECT WITH HTTP 409 CONFLICT.
3. IMMUTABLE SNAPSHOTS: Product Pack additions in PREPARE must create immutable
   session_product_snapshot records. Subsequent edits to library products must NEVER
   mutate planned or active sessions.
4. APPEND-ONLY EVIDENCE: Do not overwrite operational history. Transition events,
   operator reports, and attempts must be appended to the event ledger.
5. NO OBSOLETE SWITCHBACK COUPLING: Do NOT require a switchback randomizer schedule
   as a prerequisite to start a live session. LiveLift is manual-first and runs
   smoothly with zero external providers.
6. NO AUTOPILOT PINNING: Do NOT port or re-implement src/livelift/api/autopilot.py.

==================================================
MISSION & DELIVERABLES
==================================================

### 1. Pydantic v2 Domain Contracts
Align backend schemas with the Phase A frontend contracts:
- `src/livelift/domain/models.py`:
  - `Session` (id, title, environment ['REAL'|'SIMULATED'], lifecycle, revision, lead_operator)
  - `SessionProductSnapshot` (id, session_id, code, name, price, priority, talking_points)
  - `RunOfShowPlan` (plan_id, session_id, plan_revision, segments)
  - `Segment` (id, title, segment_type, planned_duration_s, linked_product_ids, target_duration_s)
  - `OperatorCommand` (session_id, command_type, target_id, expected_revision, actor_id, idempotency_key)
  - `EvidenceRecord` (id, session_id, evidence_class, occurred_at, recorded_at, source, payload)
- Add automated contract consistency test (`tests/contracts/test_schema_parity.py`)
  verifying that Pydantic JSON schemas match Phase A Zod schemas.

### 2. Refactor Persistence Layer
Split the bloated `src/livelift/api/store.py` into focused domain repositories:
- `src/livelift/repositories/session_repo.py`: Session CRUD and lifecycle state machine.
- `src/livelift/repositories/plan_repo.py`: Run of Show plans and Product Pack snapshots.
- `src/livelift/repositories/evidence_repo.py`: Append-only event and report store.
- Maintain dual-backend support:
  - Production: PostgreSQL 16 (psycopg3).
  - Test / Local: High-speed in-memory store for unit tests.

### 3. Implement Core Authoritative REST Routers
In `src/livelift/api/routes/`:
- `sessions.py`:
  - `POST /api/sessions`: Create new session (validates environment REAL vs SIMULATED).
  - `GET /api/sessions`: List sessions with filters (status, date, environment).
  - `GET /api/sessions/{id}`: Fetch session detail.
  - `GET /api/sessions/{id}/snapshot`: Fetch full authoritative session snapshot.
  - `POST /api/sessions/{id}/cancel`: Cancel un-aired planned session.
- `prepare.py`:
  - `GET /api/sessions/{id}/prepare`: Fetch preparation workspace data.
  - `PUT /api/sessions/{id}/plan`: Autosave updated Run of Show and Product Pack.
  - `POST /api/sessions/{id}/start`: Start Live tracking. Validates preflight blockers
    (non-positive durations, unmapped products, another active live). Materializes
    initial plan into assignment events and freezes baseline.
- `runtime.py`:
  - `POST /api/sessions/{id}/commands/start_segment`: Advance or start specific segment.
  - `POST /api/sessions/{id}/commands/extend`: Extend target duration (+1 min).
  - `POST /api/sessions/{id}/commands/hold`: Hold / pause runtime NEXT.
  - `POST /api/sessions/{id}/commands/skip`: Skip planned segment.
  - `POST /api/sessions/{id}/commands/accept`: Record acceptance of recommendation.
  - `POST /api/sessions/{id}/reports/presentation`: Record operator report ("Presenting product").
  - `POST /api/sessions/{id}/end`: Authoritative End Live. Freezes runtime.
- `wrap.py` & `review.py`:
  - `GET /api/sessions/{id}/wrap`: Fetch wrap summary data.
  - `GET /api/sessions/{id}/replay`: Basic replay event fetch (filtered by recorded_at).

### 4. Command Idempotency Middleware
- Implement `IdempotencyMiddleware` in FastAPI:
  - Checks for `Idempotency-Key` header on all `POST /commands/*` requests.
  - Caches responses in memory for 60 seconds.
  - Returns cached response on repeated submissions without re-executing state mutations.

==================================================
QUALITY GATES & VERIFICATION
==================================================

Before concluding Phase B, execute and prove:

1. Contract Parity:
   `pytest tests/contracts/test_schema_parity.py` passes 100%.
2. Lifecycle Invariants:
   `pytest tests/test_vong_doi_phien.py` passes 100%.
3. Scoping Invariants:
   `pytest tests/test_actions_scoping.py` passes 100%.
4. End-to-End Golden Path Script:
   Execute `python scripts/verify_golden_path_backend.py`:
   - Creates session -> Adds 3 products -> Adds 3 segments -> Starts Live ->
     Transitions through segments -> Reports presentation -> Ends Live.
   - Confirms all revisions incremented monotonically and state is frozen.
5. Storage Outage Resilience:
   `pytest tests/test_kho_chet_giua_phien.py` passes 100%.

DO NOT COMMIT OR MERGE TO MAIN.
PROVIDE FULL TEST RUN OUTPUT AND CODE ARTIFACT SUMMARY.
```
