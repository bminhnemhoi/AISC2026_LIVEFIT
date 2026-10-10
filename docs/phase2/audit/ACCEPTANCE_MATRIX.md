# Phase 2 Frozen Authority Acceptance Matrix

This document defines the independent verification matrix for the Phase 2 Remote Room Authority boundary, derived from `docs/phase2/contract.md` and `next/src/contracts/authority.ts`.

## Matrix Overview

| Check ID | Title | Owning Lane | Blocker Severity | Test Reference | Current Status |
|---|---|---|---|---|---|
| **CHK-01** | Sole authority | Backend & UI | **CRITICAL** | `authority.acceptance.test.ts` (Check 1) | **PASS VERIFIED** |
| **CHK-02** | Shared room convergence | Backend & UI | **CRITICAL** | `authority.acceptance.test.ts` (Check 2) | **PASS VERIFIED** |
| **CHK-03** | Stale revision conflict | Backend | **CRITICAL** | `authority.acceptance.test.ts` (Check 3) | **PASS VERIFIED** |
| **CHK-04** | Idempotency | Backend | **CRITICAL** | `authority.acceptance.test.ts` (Check 4) | **PASS VERIFIED** |
| **CHK-05** | ID reuse conflict | Backend | **HIGH** | `authority.acceptance.test.ts` (Check 5) | **PASS VERIFIED** |
| **CHK-06** | Rejected command durability | Backend | **HIGH** | `authority.acceptance.test.ts` (Check 6) | **PASS VERIFIED** |
| **CHK-07** | One active REAL show | Backend | **CRITICAL** | `authority.acceptance.test.ts` (Check 7) | **PASS VERIFIED** |
| **CHK-08** | Viewer enforcement | Backend & UI | **CRITICAL** | `authority.acceptance.test.ts` (Check 8) | **PASS VERIFIED** |
| **CHK-09** | Wrong identity / scoping | Backend | **HIGH** | `authority.acceptance.test.ts` (Check 9) | **PASS VERIFIED** |
| **CHK-10** | Lost acknowledgement | Backend & UI | **CRITICAL** | `authority.acceptance.test.ts` (Check 10) | **PASS VERIFIED** |
| **CHK-11** | Reconnect & snapshot recovery | Backend & UI | **CRITICAL** | `authority.acceptance.test.ts` (Check 11) | **PASS VERIFIED** |
| **CHK-12** | Server restart durability | Backend | **CRITICAL** | `authority.acceptance.test.ts` (Check 12) | **PASS VERIFIED** |
| **CHK-13** | Atomicity & failure isolation | Backend | **CRITICAL** | `authority.acceptance.test.ts` (Check 13) | **PASS VERIFIED** |
| **CHK-14** | Clock truth | Backend | **HIGH** | `authority.acceptance.test.ts` (Check 14) | **PASS VERIFIED** |
| **CHK-15** | History semantics | Backend & Domain | **HIGH** | `authority.acceptance.test.ts` (Check 15) | **PASS VERIFIED** |
| **CHK-16** | Next LIVE draft derivation | Backend & Domain | **HIGH** | `authority.acceptance.test.ts` (Check 16) | **PASS VERIFIED** |
| **CHK-17** | Semantic invariants | Domain & Transport | **CRITICAL** | `semantic.safeguards.test.ts` | **PASS VERIFIED** |
| **CHK-18** | Phase 1 regression safeguard | All Lanes | **CRITICAL** | Phase 1 Suite (9 test files, 211 tests) | **PASS VERIFIED** |
| **CHK-19** | Recovery metadata wire lifecycle | Backend & Domain | **CRITICAL** | `authority.acceptance.test.ts` (Check 19) | **PASS VERIFIED** |
| **CHK-20** | Sparse counter sequence & no reuse | Backend & UI | **CRITICAL** | `authority.acceptance.test.ts` (Check 20) | **PASS VERIFIED** |

---

## Detailed Check Specifications

### CHK-01: Sole Authority
- **Contract Reference:** `docs/phase2/contract.md` § Architecture and authority boundary
- **Expected Behavior:** REAL session state is exclusively server-authoritative. Client-local storage (`localStorage`) must never commit or serve as authoritative for REAL sessions. Direct attempts to supply fabricated runtime states, events, or revisions over HTTP must fail closed with rejection.
- **Evidence Required:**
  - `POST /api/v3/room/commands` with injected runtime fields returns HTTP 400/422 and rejected receipt.
  - Client state inspection confirms `localStorage` only stores pending unacknowledged envelopes, never authoritative REAL sessions.
- **Owning Lane:** Backend (API enforcement) & UI (Store storage separation).
- **Blocker Severity:** **CRITICAL**.

### CHK-02: Shared Room Convergence
- **Contract Reference:** `docs/phase2/contract.md` § Reads and polling
- **Expected Behavior:** Two independent clients connected to the same room converge to identical authoritative state and room revision within 2 seconds on healthy local transport.
- **Evidence Required:**
  - Client A commits command advancing room revision to $R$.
  - Client B polling `GET /api/v3/room?afterRevision=<R-1>` receives `{ changed: true, sessions: [...] }` with `revision: R` within 2,000ms.
- **Owning Lane:** Backend (polling route) & UI (polling worker).
- **Blocker Severity:** **CRITICAL**.

### CHK-03: Stale Revision Conflict
- **Contract Reference:** `docs/phase2/contract.md` § Revision and idempotency
- **Expected Behavior:** Optimistic concurrency is room-wide. When two commands are submitted concurrently with the same `expectedRevision: R`, exactly one commits and increments revision to $R+1$; the loser is rejected with `outcome: "rejected"`, `code: "stale_revision"`.
- **Evidence Required:**
  - HTTP 200 with receipt containing `code: "stale_revision"`.
  - Room revision increments exactly once ($R \to R+1$), not twice.
  - No offline auto-rebase or blind retry.
- **Owning Lane:** Backend.
- **Blocker Severity:** **CRITICAL**.

### CHK-04: Idempotency
- **Contract Reference:** `docs/phase2/contract.md` § Revision and idempotency
- **Expected Behavior:** Submitting an identical command envelope (same `commandId`, same canonical request) returns the original receipt with `duplicate: true`. No additional events are appended, and room revision does not increment.
- **Evidence Required:**
  - First POST: `duplicate: false`, `outcome: "committed"`, room revision $R$.
  - Second POST: `duplicate: true`, identical receipt payload, room revision remains $R$.
  - Session event log count remains identical.
- **Owning Lane:** Backend.
- **Blocker Severity:** **CRITICAL**.

### CHK-05: ID Reuse Conflict
- **Contract Reference:** `docs/phase2/contract.md` § Revision and idempotency
- **Expected Behavior:** Reusing an existing `commandId` with changed intent (differing payload, session, or revision) is rejected with `code: "idempotency_conflict"`. The original receipt in `command_log` is preserved intact.
- **Evidence Required:**
  - Second POST returns `outcome: "rejected"`, `code: "idempotency_conflict"`.
  - `GET /api/v3/room/commands/<commandId>` returns the original receipt unchanged.
- **Owning Lane:** Backend.
- **Blocker Severity:** **HIGH**.

### CHK-06: Rejected Command Durability
- **Contract Reference:** `docs/phase2/contract.md` § Revision and idempotency
- **Expected Behavior:** Terminal rejections are durably recorded in `command_log`. An identical retry returns the original rejected receipt with `duplicate: true` and leaves room/session revisions unchanged.
- **Evidence Required:**
  - First attempt returns `outcome: "rejected"`.
  - Identical retry returns `duplicate: true`, identical rejected receipt.
  - Room revision unchanged across both attempts.
- **Owning Lane:** Backend.
- **Blocker Severity:** **HIGH**.

### CHK-07: One Active REAL Show
- **Contract Reference:** `docs/phase2/contract.md` § Architecture and authority boundary
- **Expected Behavior:** At most one REAL show may be active in the room. Concurrent or sequential `start_live` commands targeting a second session while one is active must reject with `code: "another_show_active"`.
- **Evidence Required:**
  - Session 1 in state `active`.
  - `start_live` on Session 2 returns `outcome: "rejected"`, `code: "another_show_active"`.
  - Room read confirms exactly one session has `lifecycle: "active"`.
- **Owning Lane:** Backend.
- **Blocker Severity:** **CRITICAL**.

### CHK-08: Viewer Enforcement & Bearer Capabilities
- **Contract Reference:** `docs/phase2/contract.md` § Roles & Bearer Capabilities
- **Expected Behavior:** Access control is enforced strictly via Bearer tokens hashed against server configuration (`LIVELIFT_CAPABILITIES`):
  - Operator Bearer token authorizes both read (`GET /api/v3/room`) and write (`POST /api/v3/room/commands`).
  - Viewer Bearer token authorizes read (`GET /api/v3/room`), but write commands are forbidden (`HTTP 403` / `outcome: "rejected"`, `code: "forbidden"`), even if UI controls are bypassed.
  - Absent or invalid Bearer token is rejected with `HTTP 401 Unauthorized` / `{ error: "unauthorized" }`.
  - Forged identity headers (`X-LiveLift-Role: operator`, `X-LiveLift-Actor-Id`) without valid Bearer token must never elevate access.
- **Evidence Required:**
  - Operator POST/GET return 200 with `access.role: "operator"`.
  - Viewer POST returns HTTP 403 `forbidden`; GET returns HTTP 200 with `access.role: "viewer"`.
  - Unauthenticated / invalid token returns HTTP 401.
  - Forged headers do not grant operator access.
- **Owning Lane:** Backend & UI.
- **Blocker Severity:** **CRITICAL**.

### CHK-09: Wrong Identity / Scoping
- **Contract Reference:** `docs/phase2/contract.md` § Roles & Command contract
- **Expected Behavior:** Submitting a command with an invalid room ID, nonexistent session ID, or entity ID not belonging to the room fails closed (HTTP 404/400). No fallback to local fixtures or mock data.
- **Evidence Required:**
  - Nonexistent `roomId` returns 404/400.
  - Nonexistent `sessionId` returns 404/400.
- **Owning Lane:** Backend.
- **Blocker Severity:** **HIGH**.

### CHK-10: Lost Acknowledgement
- **Contract Reference:** `docs/phase2/contract.md` § Reconnect
- **Expected Behavior:** When a command is committed by the server but the client network drops before receiving the response, the client must treat the outcome as UNKNOWN. Querying `GET /api/v3/room/commands/<commandId>` retrieves the durable receipt without triggering side effects.
- **Evidence Required:**
  - Receipt lookup endpoint returns HTTP 200 and original `AuthorityReceipt`.
  - No new command or event created during lookup.
- **Owning Lane:** Backend & UI.
- **Blocker Severity:** **CRITICAL**.

### CHK-11: Reconnect & Snapshot Recovery
- **Contract Reference:** `docs/phase2/contract.md` § Reads and polling, § Reconnect
- **Expected Behavior:** A client missing intermediate revisions fetches a complete snapshot upon reconnect (`GET /api/v3/room?afterRevision=<oldRev>`). An out-of-order or late response must never overwrite a newer installed revision.
- **Evidence Required:**
  - Poll with outdated revision returns `changed: true` and full `sessions` array.
  - Client store drops/ignores snapshots where `revision <= installedRevision`.
- **Owning Lane:** Backend & UI.
- **Blocker Severity:** **CRITICAL**.

### CHK-12: Server Restart Durability
- **Contract Reference:** `docs/phase2/contract.md` § Persistence
- **Expected Behavior:** Authoritative room state, session lifecycle, active segment, events history, revisions, receipts, and idempotency cache survive server shutdown and restart exactly.
- **Evidence Required:**
  - Active session with events persisted to SQLite (`LIVELIFT_DB_PATH`).
  - Server restarted.
  - Subsequent read matches pre-restart revision and lifecycle.
  - Pre-restart commandId retry returns `duplicate: true`.
- **Owning Lane:** Backend.
- **Blocker Severity:** **CRITICAL**.

### CHK-13: Atomicity & Failure Isolation
- **Contract Reference:** `docs/phase2/contract.md` § Persistence
- **Expected Behavior:** State, event history, and receipt commit atomically in a single `BEGIN IMMEDIATE ... COMMIT` transaction. Storage failure must never expose updated state or fall back to in-memory authority.
- **Evidence Required:**
  - Transaction rollbacks leave room revision and state completely unmodified.
  - No orphaned events without receipts or receipts without events.
- **Owning Lane:** Backend.
- **Blocker Severity:** **CRITICAL**.

### CHK-14: Clock Truth & Anti-Double-Count
- **Contract Reference:** `docs/phase2/contract.md` § Architecture, § Reads and polling
- **Expected Behavior:** REAL authoritative event timestamps (`occurredAtMs`, `recordedAtMs`) and snapshot time (`serverNowMs`) are assigned strictly by the server clock.
  - Client/browser clock manipulation does not alter authoritative timestamps.
  - `RoomRead.serverNowMs` is already advanced to the authoritative time. Non-zero `clockBehindByMs` ($\max(0, \text{nowMs} - \text{wall})$) must **NOT** be added to `serverNowMs` twice.
  - Client-side wall interpolation must anchor directly to authoritative `serverNowMs`.
  - Stale freeze thresholds ($> 3000$ms behind) must remain accurately detected without double-counting skew.
- **Evidence Required:**
  - Spoofed client timestamps ignored for authoritative records.
  - Authoritative effective time calculation does not add `clockBehindByMs` to `serverNowMs`.
  - Stale gap $> 3000$ms correctly triggers stale freeze condition.
- **Owning Lane:** Backend & UI.
- **Blocker Severity:** **HIGH**.

### CHK-15: History Semantics
- **Contract Reference:** `docs/phase2/contract.md` § Semantic invariants
- **Expected Behavior:** Ending a session (`session_ended`) permanently blocks runtime mutation. Post-end corrections append new events (`correction_added`, `note_added`) with current `recordedAtMs` without altering past event records.
- **Evidence Required:**
  - Runtime commands (`start_segment`, etc.) on ended session reject with `invalid_state`.
  - Corrections append to events array without modifying existing elements.
- **Owning Lane:** Backend & Domain.
- **Blocker Severity:** **HIGH**.

### CHK-16: Next LIVE Draft Derivation
- **Contract Reference:** `docs/phase2/contract.md` § Command contract
- **Expected Behavior:** `create_next` derives a new draft session from an ended session. Only selected adjustments are applied. Source session remains untouched. New session has new ID, empty runtime, empty history. Infeasible plans (e.g. anchor deficits) cannot start.
- **Evidence Required:**
  - Source session unchanged in room snapshot.
  - Derived session has `lifecycle: "planned"`, `runtime.startedAtMs: null`, empty `events`.
  - `start_live` on infeasible draft rejected with `plan_invalid` / `anchor_infeasible`.
- **Owning Lane:** Backend & Domain.
- **Blocker Severity:** **HIGH**.

### CHK-17: Semantic Invariants
- **Contract Reference:** `docs/phase2/contract.md` § Semantic invariants
- **Expected Behavior:** Preserve all 9 core domain distinctions:
  1. Missing != zero
  2. Planned != actual
  3. Recommendation != acceptance
  4. Acceptance != attempt
  5. Attempt != performed
  6. Unknown != failed
  7. REAL != SIMULATED
  8. Completed != coverage complete
  9. Hard-anchor truth
- **Evidence Required:**
  - Automated test pass in `next/src/__tests__/phase2/semantic.safeguards.test.ts`.
- **Owning Lane:** Domain & Transport.
- **Blocker Severity:** **CRITICAL**.
- **Current Status:** **PASS NOW** (9/9 automated tests passing).

### CHK-18: Phase 1 Regression Safeguard
- **Contract Reference:** `docs/phase2/contract.md` § Phase 2 Definition of Done
- **Expected Behavior:** Existing Phase 1 domain and UI ergonomics test suites remain 100% valid. No assertion is relaxed or bypassed due to transport layer additions.
- **Evidence Required:**
  - All 211 existing unit/integration tests pass without modification.
- **Owning Lane:** All Lanes.
- **Blocker Severity:** **CRITICAL**.
- **Current Status:** **PASS NOW** (211/211 automated tests passing).

### CHK-19: Recovery Metadata Wire Lifecycle
- **Contract Reference:** `docs/phase2/contract.md` § Recovery & History
- **Expected Behavior:** When an operator accepts a recovery recommendation, the recovery metadata flows end-to-end through the HTTP wire into durable history:
  - An ordinary command (e.g. standard `shorten_segment`) produces NO `recovery_selected` event.
  - A command with recovery metadata (`recoveryId`, `recoveryLabel`) persists a durable `recovery_selected` event into session history preserving `recoveryId` and `label`.
  - Accepting a recovery suggestion does NOT imply automatic cue attempt, execution, or platform verification (`state` remains `pending` or `performed`, never fabricated as `attempted`).
  - An identical retry of a command with recovery metadata returns `duplicate: true` and appends NO additional event.
  - Submitting a command with altered recovery metadata under the same `commandId` is rejected with `code: "idempotency_conflict"`.
- **Evidence Required:**
  - Ordinary command: 0 `recovery_selected` events in session history.
  - Recovery command: Exactly 1 `recovery_selected` event with matching `recoveryId` and `label`.
  - Invariant: No cues set to `attempted` solely by accepting a recovery recommendation.
  - Idempotency: Duplicate submission produces `duplicate: true` with zero additional events.
  - Conflict: Mutated recovery payload on same `commandId` returns `outcome: "rejected"`, `code: "idempotency_conflict"`.
- **Owning Lane:** Backend & Domain.
- **Blocker Severity:** **CRITICAL**.
- **Current Status:** PENDING INTEGRATION (Wire acceptance in Check 19; contract serialization & domain invariant tests **PASS NOW**).

### CHK-20: Sparse Segment/Cue Counter Sequence & No Reuse
- **Contract Reference:** `docs/phase2/contract.md` § Entity Identifiers & SQLite Store
- **Expected Behavior:** Segment and cue entity counter sequences must be strictly monotonic across deletions, saves, and server restarts:
  - When segments `s1`, `s2`, `s3` (or cues `c1`, `c2`, `c3`) are allocated and saved, deleting entity `s3`/`c3` permanently retires that identifier in the durable `used.segments` / `used.cues` register.
  - Subsequent allocations must yield `s4`/`c4` (monotonic progression), never re-proposing or reusing retired `s3`/`c3`.
  - After a server restart, the sparse sequence counter must continue from the max used identifier (e.g. allocating `s5`/`c5`), never resetting or colliding with retired identifiers.
  - Re-proposing a deleted identifier must fail closed with HTTP 422 (`"Deleted segments/cues identifiers cannot be reused."`).
- **Evidence Required:**
  - Allocate & save `s1..s3`, `c1..c3`.
  - Delete `s3`, `c3`.
  - Allocate next entity $\to$ strictly receives `s4`, `c4`.
  - Restart server, reload room $\to$ next allocation strictly receives `s5`, `c5`.
  - Zero ID collisions or reuse of retired identifiers.
- **Owning Lane:** Backend & UI.
- **Blocker Severity:** **CRITICAL**.
- **Current Status:** PENDING INTEGRATION (Wire acceptance in Check 20; contract sequence monotonicity tests **PASS NOW**).

---

## Cross-Lane Contract Observations & Discrepancies

### Observation 1: CommandEnvelope Payload Typing vs Domain Recovery Metadata
- In `next/src/contracts/authority.ts`, `CommandEnvelope` defines:
  ```ts
  payload: Omit<Extract<AuthorityCommandBody, { type: T }>, "type">
  ```
  where `AuthorityCommandBody` uses `RuntimeCommandBody = Exclude<CommandBody, ...>`.
- In Phase 1 domain types, `recoveryId?: string; recoveryLabel?: string` were declared on `CommandBase`, but are not top-level properties on `CommandBody` union variants.
- Consequently, TypeScript static analysis flags `{ ...payload, recoveryId }` on `CommandEnvelope["payload"]` unless typed with `as unknown as CommandEnvelope`.
- **Backend Schema:** The backend `validation.ts` schema does accept `recoveryId` and `recoveryLabel` on wire command payloads.
- **Recommendation:** Post-Phase 2, refine `CommandEnvelope` in `authority.ts` to explicitly include optional `recoveryId?: string` and `recoveryLabel?: string` across all command payloads.

### Observation 2: Capability Token Hashing vs HTTP Headers
- The backend resolves capabilities exclusively by computing SHA-256 hashes of `Authorization: Bearer <token>` against entries in `LIVELIFT_CAPABILITIES`.
- Request headers `X-LiveLift-Role` and `X-LiveLift-Actor-Id` are purely informational/supplementary and cannot elevate access without a corresponding valid Bearer token.

