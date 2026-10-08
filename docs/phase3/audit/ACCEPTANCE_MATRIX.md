# Phase 3 Production Acceptance Matrix

This document defines the independent verification matrix for the LiveLift V3 Phase 3 Production Acceptance gates, derived from `docs/phase3/contract.md` and `next/src/contracts/production.ts`.

---

## 1. Acceptance Gates Overview

| Gate ID | Title | Owning Lane | Severity | Test File & Reference | Required Environment | Current State |
|---|---|---|---|---|---|---|
| **P3-AUTH** | Authentication & Revocation | Platform | **CRITICAL** | `p3.auth.test.ts` | In-Process + Live HTTP Server | **PASS NOW** (Contract) / **PENDING INTEGRATION** (Live) |
| **P3-ISOLATION** | Deployment & Workspace Isolation | Platform | **CRITICAL** | `p3.isolation.test.ts` | In-Process + Live HTTP Server | **PASS NOW** (Contract) / **PENDING INTEGRATION** (Live) |
| **P3-AUTHZ** | Role Enforcement & Attribution | Platform & UI | **CRITICAL** | `p3.auth.test.ts` | In-Process + Live HTTP Server | **PASS NOW** (Contract) / **PENDING INTEGRATION** (Live) |
| **P3-CSRF** | CSRF & Request Boundary | Platform | **CRITICAL** | `p3.csrf.test.ts` | In-Process + Live HTTP Server | **PASS NOW** (Contract) / **PENDING INTEGRATION** (Live) |
| **P3-DB** | Database, Schema & Migration | Platform | **CRITICAL** | `p3.db.migration.test.ts` | In-Process SQLite + Live Server | **PASS NOW** (Drill/Schema) / **PENDING INTEGRATION** (Live Server) |
| **P3-BACKUP** | Backup Artifacts & Validation | Platform | **CRITICAL** | `p3.backup.restore.test.ts` | In-Process SQLite + Live Server | **PASS NOW** (Drill/Manifest) / **PENDING INTEGRATION** (Live Storage) |
| **P3-RESTORE** | Restore Drill & Revalidation | Platform | **CRITICAL** | `p3.backup.restore.test.ts` | In-Process SQLite + Live Server | **PASS NOW** (Drill/RTO) / **PENDING INTEGRATION** (Live Drill) |
| **P3-RESTORE-CONTEXT** | Generation Isolation & Quarantine | Platform & UI | **CRITICAL** | `p3.backup.restore.test.ts`, `p3.isolation.test.ts` | In-Process + Live HTTP Server | **PASS NOW** (Contract) / **PENDING INTEGRATION** (Live) |
| **P3-CRASH** | Process Crash & Write Atomicity | Platform | **CRITICAL** | `p3.crash.atomicity.test.ts` | In-Process SQLite + Process Killer | **PASS NOW** (Atomicity) / **PENDING INTEGRATION** (Live Kill) |
| **P3-STORAGE** | Storage Failure & Fail Closed | Platform | **CRITICAL** | `p3.crash.atomicity.test.ts` | In-Process + Live Readyz Probe | **PASS NOW** (RO/Corrupt) / **PENDING INTEGRATION** (Live Probe) |
| **P3-SECURITY** | Rate Limiting, SQL & Secrets | Platform | **CRITICAL** | `p3.security.rate.test.ts` | In-Process + Live HTTP Server | **PASS NOW** (Bounds/SQL/Canary) / **PENDING INTEGRATION** (Live Limiter) |
| **P3-OBSERVABILITY** | Health, Readyz & Safe Logging | Platform | **HIGH** | `p3.observability.test.ts` | In-Process + Live HTTP Server | **PASS NOW** (Log/Invariant) / **PENDING INTEGRATION** (Live Probes) |
| **P3-DATA** | Authoritative Export & Deletion | Platform & UI | **HIGH** | `p3.data.export.delete.test.ts` | In-Process + Live HTTP Server | **PASS NOW** (Schema/Sanitization) / **PENDING INTEGRATION** (Live Export) |
| **P3-A11Y** | Accessibility & ARIA Semantics | UI | **HIGH** | `p3.a11y.test.tsx` | JSDOM + Manual Assistive Tech | **PASS NOW** (Structural ARIA) / **PENDING MANUAL** / **PENDING INTEGRATION** (axe-core) |
| **P3-DEPLOY** | Production Topology & Docker | Platform | **CRITICAL** | `p3.deploy.test.ts` | Static Host Config & Docker Engine | **PASS NOW** (Static Specs) / **PENDING INTEGRATION** (Compose Run) |
| **P3-REGRESSION** | Phase 1 & Phase 2 Safeguards | All Lanes | **CRITICAL** | `p3.regression.test.ts`, `phase2/*` | In-Process Suite (28 files, 340 tests) | **PASS NOW** |
| **P3-SOAK** | 48-Hour Rehearsal Endurance | All Lanes | **CRITICAL** | `p3.soak.test.ts`, `acceptance/soak.mjs`, `acceptance/liveSoak.ts` | Live Deployment Host | **PASS NOW** (Live CLI + Short Live Soak) / **PENDING 48H SOAK** (Full Release Gate) |

---

## 2. Detailed Verification Specifications

### P3-AUTH: Authentication & Revocation
- **Contract Reference:** `docs/phase3/contract.md` § Authentication
- **Requirements:**
  1. Named accounts with `operator` and `viewer` roles. Passwords 15–128 characters, hashed with scrypt (`N=131072, r=8, p=1`, random salt >= 16 bytes).
  2. Login issues random token; stores only SHA-256 hash. Sets `__Host-livelift_session` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, and no `Domain`.
  3. Absolute 12-hour session expiry, no silent renewal.
  4. Revocation on logout (`POST /api/v3/auth/logout` with body `{}`), password reset, role change, account disable, and account deletion.
  5. Production bearer capability authorization removed; bearer-only requests fail closed with 401 `unauthenticated`.
  6. Client role or actor spoof headers never elevate permissions.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.auth.test.ts`
- **Current State:**
  - In-process schema, password bounds, username regex, logout request format (`body: {}`), and cookie contracts: **PASS NOW**
  - Live HTTP adversarial authentication tests: **PENDING INTEGRATION**

---

### P3-ISOLATION: Deployment & Workspace Isolation
- **Contract Reference:** `docs/phase3/contract.md` § Deployment isolation and errors
- **Requirements:**
  1. Immutable deployment binding `(workspaceId, roomId)`. Configuration differing from database fails closed at startup.
  2. Authenticated requests carry `X-LiveLift-Workspace` and `X-LiveLift-Generation`. Server validates against authoritative DB metadata. Context headers do NOT include `X-LiveLift-Room` (per frozen Phase 3 contract).
  3. Missing context returns 400 `context_required`. Wrong workspace returns 404 `not_found`. Outdated generation returns 409 `recovery_required`.
  4. Wrong room targeted through supported identity mechanisms (query target `?roomId=...` or command envelope `envelope.roomId`) fails closed with 404 `not_found` without revealing authority state.
  5. Cookies and contexts do not cross-authorize across separate installations.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.isolation.test.ts`
- **Room Identity Contract Note:** The previous server failure to reject an arbitrary `X-LiveLift-Room` header was a harness assumption, NOT a production defect. `docs/phase3/contract.md` specifies `X-LiveLift-Workspace` and `X-LiveLift-Generation` as the context headers. Supported room identity enforcement is validated strictly via supported mechanisms (`?roomId=<id>` on reads/receipts and `envelope.roomId` on command dispatch), which correctly fail closed with 404 `not_found`.
- **Current State:**
  - In-process wire contracts, context header generators, and supported wrong-room enforcement: **PASS NOW**
  - Live HTTP header validation and cross-tenant isolation: **PENDING INTEGRATION**

---

### P3-AUTHZ: Authorization & Role Enforcement
- **Contract Reference:** `docs/phase3/contract.md` § Scope and authority
- **Requirements:**
  1. Exactly two roles: `operator` and `viewer`.
  2. Viewer read allowed (`GET /api/v3/room`).
  3. Viewer write mutation strictly forbidden (403 `forbidden`).
  4. Viewer duplicate-command replay trick rejected (403 `forbidden`).
  5. Viewer export forbidden (403 `forbidden`).
  6. Administration operations are CLI-only; no web deletion or admin console.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.auth.test.ts`
- **Current State:**
  - Role definition and fixture invariants: **PASS NOW**
  - Live HTTP viewer mutation rejection: **PENDING INTEGRATION**

---

### P3-CSRF: Request Boundary & CSRF Defense
- **Contract Reference:** `docs/phase3/contract.md` § Authentication
- **Requirements:**
  1. Unsafe browser requests require exact configured `Origin`, `application/json`, and `X-LiveLift-Request: 1`.
  2. Missing Origin, `Origin: null`, foreign Origin, missing `X-LiveLift-Request`, or wrong Content-Type rejected with 403 `csrf_failed`.
  3. Zero state mutation occurs on CSRF failure.
  4. Request body size limits: Login <= 4 KiB; Commands <= 1 MiB. Oversized payloads rejected with 413 `payload_too_large`.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.csrf.test.ts`
- **Current State:**
  - In-process limits and header specifications: **PASS NOW**
  - Live HTTP CSRF probes and body limits: **PENDING INTEGRATION**

---

### P3-DB: Database, Schema & Migration
- **Contract Reference:** `docs/phase3/contract.md` § Database and migration
- **Requirements:**
  1. Normal startup with missing DB fails closed; explicit `ops init` and `ops migrate`.
  2. Migration from v1 (real Phase 2 database) to v2 preserves all sessions, plans, products, segments, cues, events, receipts, revisions, and monotonic sequence counters.
  3. Rejects unsupported/newer schemas (`PRAGMA user_version >= 3`).
  4. Migration is transactional: failure rolls back completely without corrupting v1 state.
  5. Foreign keys and database integrity enforced (`PRAGMA foreign_key_check`, `PRAGMA integrity_check`).
  6. Data survives restart across database reopen.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.db.migration.test.ts`
- **Current State:**
  - Real Phase 2 v1 to v2 migration drill, data preservation, and rollback: **PASS NOW**
  - Live server missing-db fail closed: **PENDING INTEGRATION**

---

### P3-BACKUP: Backup Artifacts & Integrity
- **Contract Reference:** `docs/phase3/contract.md` § Backup and restore
- **Requirements:**
  1. Uses SQLite online backup API; never raw copies live active database.
  2. Artifact directory `backup-<timestamp>-<unique-id>/` contains `manifest.json` and standalone `authority.sqlite`.
  3. Manifest contains formatVersion, appCommit, schemaVersion, workspaceId, roomId, generation, timestamp, roomRevision, and SHA-256.
  4. Artifact passes `PRAGMA integrity_check`, foreign key checks, and checksum verification.
  5. Corrupt checksum, corrupt SQLite, or unsupported schema rejected.
  6. Failed backup cleans up temporary directory without corrupting prior good backups.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.backup.restore.test.ts`
- **Current State:**
  - Backup creation, manifest validation, checksum verification, and tampering rejection: **PASS NOW**
  - Automated production cron backup: **PENDING INTEGRATION**

---

### P3-RESTORE & P3-RESTORE-CONTEXT: Restore Drill & Recovery Context
- **Contract Reference:** `docs/phase3/contract.md` § Backup and restore; § Recovery generation
- **Requirements:**
  1. Staged restore drill validates artifact, rolls back old installation, and installs validated database.
  2. Restores real sessions, plans, events, receipts, revisions, and counters. Never invents missing events.
  3. Assigns a NEW `generation`.
  4. Clears all active login sessions; disables restored accounts until administrator revalidation.
  5. Sets recovery notice `(restoredAtMs, backupTakenAtMs, backupRevision)`.
  6. Old pending commands scoped to previous generation are quarantined; requests with old generation return 409 `recovery_required`.
  7. Client requires full resnapshot.
  8. RTO duration measured (target <= 1 hour).
- **Harness & Verification:** `next/src/__tests__/phase3/p3.backup.restore.test.ts`
- **Current State:**
  - In-process restore drill, data retention, account disabling, and generation rotation: **PASS NOW**
  - Live server restore execution drill: **PENDING INTEGRATION**

---

### P3-CRASH: Process Crash & Atomicity
- **Contract Reference:** `docs/phase3/contract.md` § Scope and authority
- **Requirements:**
  1. Kill before commit leaves database untouched (uncommitted command absent).
  2. Kill during transaction rolls back cleanly via SQLite WAL/journal; no partial authority state.
  3. Commit succeeds then response lost: receipt lookup by `commandId` reconciles committed command idempotently.
  4. Room revision and event history advance atomically together.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.crash.atomicity.test.ts`
- **Current State:**
  - Transaction atomicity, rollback isolation, and idempotent reconciliation: **PASS NOW**
  - Live external process-kill drills: **PENDING INTEGRATION**

---

### P3-STORAGE: Storage Failure & Fail Closed
- **Contract Reference:** `docs/phase3/contract.md` § Scope and authority
- **Requirements:**
  1. Missing database fails closed; no automatic empty-room creation.
  2. Unreadable or unwritable database causes `readyz` probe to return 503 `storage_unavailable`.
  3. REAL writes fail safely without partial state or in-memory fallback.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.crash.atomicity.test.ts`
- **Current State:**
  - Read-only storage and corrupt database handling: **PASS NOW**
  - Live readyz probe against injected disk failure: **PENDING INTEGRATION**

---

### P3-SECURITY: Rate Limiting, Security Boundaries & Canary Scrubbing
- **Contract Reference:** `docs/phase3/contract.md` § Security
- **Requirements:**
  1. Login throttling with bounded scrypt concurrency. Excess attempts return 429 `rate_limited` with `Retry-After`.
  2. IP and account throttling boundaries. Command rate limiting.
  3. Parameterized SQL ensures SQL injection strings remain literal data.
  4. Path traversal attempts against admin artifact inputs rejected.
  5. Forwarded-header spoof attempts (`X-Forwarded-For`) ignored unless behind trusted proxy.
  6. Canary secrets scanner confirms no passwords, hashes, tokens, session cookies, or sensitive canaries appear in logs or error responses.
  7. Security headers enforced: CSP with nonce, `nosniff`, `no-referrer`, `Permissions-Policy`, and `Cache-Control: no-store`.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.security.rate.test.ts`
- **Current State:**
  - Parameterized SQL, path traversal logic, and canary secret scanner: **PASS NOW**
  - Live HTTP rate limiter and security header verification: **PENDING INTEGRATION**

---

### P3-OBSERVABILITY: Health, Readyz & Safe Logging
- **Contract Reference:** `docs/phase3/contract.md` § Observability
- **Requirements:**
  1. `GET /api/healthz` verifies process liveness.
  2. `GET /api/readyz` verifies storage accessibility, valid schema, and writeability.
  3. Readiness probe is strictly read-only: does not advance room revision or write to command log.
  4. `X-Request-Id` returned on responses for tracing.
  5. Structured JSON logging with allowlisted safe fields only; no secrets or request bodies logged.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.observability.test.ts`
- **Current State:**
  - Readiness read-only invariant and log allowlist verification: **PASS NOW**
  - Live HTTP healthz and readyz route probes: **PENDING INTEGRATION**

---

### P3-DATA: Data Export & Workspace Deletion
- **Contract Reference:** `docs/phase3/contract.md` § Export, deletion and retention
- **Requirements:**
  1. `GET /api/v3/workspace/export` is operator-only (viewer receives 403 `forbidden`).
  2. Returns versioned JSON snapshot containing REAL session history, room revision, receipts, and actor attribution.
  3. Sanitized: strictly excludes credentials, passwords, salts, tokens, and SIMULATED local data.
  4. Not a restore format.
  5. Workspace deletion via CLI requires typed confirmation; refuses deletion while a REAL show is active; cleans managed copies and backups; records retired workspace ID to prevent future restores.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.data.export.delete.test.ts`
- **Current State:**
  - Export schema validation, secret sanitization, and deletion guard logic: **PASS NOW**
  - Live HTTP export and CLI deletion drills: **PENDING INTEGRATION**

---

### P3-A11Y: Accessibility & ARIA Semantics
- **Contract Reference:** `docs/phase3/contract.md` § Frontend and accessibility
- **Requirements:**
  1. Covers Login, Create, Prepare, Operate, Review, Next LIVE, Export, and Dialogs.
  2. Form inputs have associated accessible labels. Buttons have accessible names.
  3. Modals use `role="dialog"`, `aria-modal="true"`, and accessible title (`aria-labelledby`).
  4. Critical state changes announced via live regions (`role="status"`, `aria-live="polite"`).
  5. Timers do not spam screen readers on every second tick (no `aria-live="assertive"` ticker).
  6. Error banners use `role="alert"`.
  7. Manual verification for keyboard-only flow, focus trap/restore, 200% zoom, and screen reader walkthroughs.
- **Platform Tooling Dependency:** `axe-core` / `jest-axe` (Platform lane package ownership).
- **Harness & Verification:** `next/src/__tests__/phase3/p3.a11y.test.tsx`
- **Current State:**
  - Structural DOM and ARIA semantics tests: **PASS NOW**
  - Automated axe-core scanning: **PENDING INTEGRATION** (Platform package dependency)
  - Manual screen reader, zoom, and keyboard tests: **PENDING MANUAL**

---

### P3-DEPLOY: Production Deployment Topology
- **Contract Reference:** `docs/phase3/contract.md` § Deployment and operations
- **Requirements:**
  1. Linux host with Docker Compose, Caddy HTTPS, single Next.js Node 22 LTS container.
  2. Only Caddy reverse proxy publishes public ports (80/443). Next.js container internal or bound to 127.0.0.1.
  3. Persistent volume for SQLite database (`/var/lib/livelift`).
  4. Single container instance; unprivileged process (`USER node`).
  5. Restart policy `unless-stopped` or `always`.
  6. Stop grace period of 30 seconds.
  7. `.env.production.example` contains placeholders with no hardcoded credentials.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.deploy.test.ts`
- **Current State:**
  - Static Dockerfile, Compose topology, and example config inspection: **PASS NOW**
  - Full staging container execution drill: **PENDING INTEGRATION**

---

### P3-REGRESSION: Phase 1 & Phase 2 Authority Regression
- **Contract Reference:** `docs/phase3/contract.md` § Acceptance IDs
- **Requirements:**
  1. Preserves all Phase 1 domain semantics, state transitions, invariants, and planning arithmetic.
  2. Preserves Phase 2 CHK-01 through CHK-20 authority assertions without weakening.
  3. Adapts Phase 2 authority client from bearer tokens to production cookie/context headers while maintaining equivalence.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.regression.test.ts`, `next/src/__tests__/phase2/*`
- **Current State:** **PASS NOW** (All 28 test files and 340 tests pass cleanly)

---

### P3-SOAK: Production Soak Rehearsal
- **Contract Reference:** `docs/phase3/contract.md` § Acceptance IDs
- **Requirements:**
  1. Exercised over sustained production workloads: concurrent polling clients, operator commands, viewer clients, simulated network interruptions, and receipt reconciliations.
  2. Preserve the short simulated CI smoke; separately certify the live CLI with a 30–120 second staging run.
  3. Full 48-hour mode (`rehearsal_48h`) as the final integrated release gate.
- **Harness & Verification:** `next/src/__tests__/phase3/p3.soak.test.ts`,
  `next/acceptance/soak.mjs`, `next/acceptance/liveSoak.ts`. The legacy
  `acceptance/soakRunner.ts` simulation is test evidence only and is not the release CLI.
- **Commands (from `next/` with protected live configuration):**
  `npm run soak:smoke -- --duration 60s`; `npm run soak:48h -- --duration 48h`.
  Configuration, credential permissions, metrics, exit codes and optional ops integration
  are specified in [the platform runbook](../platform/runbook.md#live-production-soak).
- **Current State:**
  - Simulated smoke and focused CLI regression checks: **PASS NOW**
  - Live HTTP smoke and short rehearsal-mode entry point: **PASS NOW**;
    [recorded staging evidence](LIVE_SOAK_CERTIFICATION.md).
  - Full 48-hour endurance run: **PENDING 48H SOAK** (Release gate)
