# Phase 3 frozen production contract

This shared seed freezes decisions and types only; implementation belongs to the three
lanes below. The seed files are frozen after branching.

## Scope and authority

One managed team deployment, one workspace, one authoritative configured room, one
Next.js Node process, one SQLite database on persistent local disk, and an HTTPS
reverse proxy. Named accounts use operator/viewer roles and opaque cookie sessions.
Migrations, backup and restore are explicit operations; restore generation protection
and production health/readiness/logging are required.

Preserve all Phase 1/2 authority and domain semantics, including REAL versus SIMULATED,
atomic state/history/receipt persistence, revisions, idempotency, server attribution,
one active REAL show, and unknown command outcomes. No TikTok API, AI, billing,
multi-tenant SaaS, enterprise RBAC or broad redesign.

## Shared wire types

`next/src/contracts/production.ts` defines types only:

- `ProductionContext`: `workspaceId`, `roomId`, `generation` (strings).
- `RecoveryNotice`: `restoredAtMs`, `backupTakenAtMs`, `backupRevision` (numbers).
- `AuthSession`: production context, `access: RoomRead["access"]`, `expiresAtMs`,
  `recoveryNotice: RecoveryNotice | null`. Existing access includes immutable
  authenticated `actorId`, display `name`, and `role: "operator" | "viewer"`;
  actor identity is available at `AuthSession.access.actorId` without duplication.
- `LoginRequest`: `username`, `password` (strings).
- `ProductionError`: `{ error: { code: ProductionErrorCode, message: string } }`.
- `WorkspaceExport`: production context, `formatVersion: 1`, `exportedAtMs`,
  `snapshot: RoomSnapshot`, and `receipts`, each containing `actorId`,
  `recordedAtMs`, and the existing `AuthorityReceipt`.

Times ending in `Ms` are Unix epoch milliseconds; backup revision is the backed-up
room revision. A null recovery notice means no restore notice. These types do not
change `AuthorityCommandBody`, authority receipts or the `Session` domain contract.

## Authentication

Named username/password accounts have exactly two roles: `operator` and `viewer`.
Administrator functions are CLI-only. No public signup, password reset email or SSO.
Passwords are 15–128 characters, hashed with scrypt (`N=131072`, `r=8`, `p=1`),
using a random salt of at least 16 bytes and bounded concurrent hashing.

Login issues an opaque random token; only its hash is stored. The cookie is
`__Host-livelift_session`, with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`
and no `Domain`. Sessions have a 12-hour absolute expiry and no silent renewal.
Password reset, role change, disable and account deletion revoke sessions.
Production bearer capability authentication is removed as a fallback.

Unsafe browser requests require the exact configured `Origin`, `application/json`
and `X-LiveLift-Request: 1`. No credentialed cross-origin CORS.

## Deployment isolation and errors

Persist the immutable `workspaceId`/`roomId` deployment binding. A configured identity
that differs from authoritative database metadata fails closed at startup.
Authenticated requests carry `X-LiveLift-Workspace` and `X-LiveLift-Generation`.
These headers never select authority: the server compares them against authoritative
DB metadata. Room identity in existing room requests must match the configured room.
Client-supplied actor or role is never trusted.

| Condition | HTTP status / production code |
| --- | --- |
| Invalid login credentials | 401 `invalid_credentials` |
| Missing, expired or revoked authentication | 401 `unauthenticated` |
| Viewer write or other denied permission | 403 `forbidden` |
| Wrong workspace or room | 404 `not_found` |
| Missing production context | 400 `context_required` |
| Old restore generation | 409 `recovery_required` |
| Unsafe browser request fails CSRF requirements | 403 `csrf_failed` |
| Invalid request | 400 `invalid_request` |
| Request body exceeds limit | 413 `payload_too_large` |
| Login/command throttled | 429 `rate_limited` |
| Storage unavailable | 503 `storage_unavailable` |
| Authority unavailable | 503 `authority_unavailable` |

Production boundary errors use `ProductionError`. Domain command outcomes continue
to use existing durable authority receipts and their codes.

## Database and migration

Keep SQLite. Normal production startup never creates a missing database and never
auto-migrates. Explicit operations are `ops init`, `ops migrate`, and `ops status`.
Phase 2 is schema version 1; the first Phase 3 schema is version 2, adding deployment
metadata, accounts and login sessions while preserving authority/history tables.
Use `PRAGMA user_version` and ordered SQL migrations.

Migration is maintenance-only, requires a verified pre-migration backup, and is
transactional: failure rolls back. Reject unknown/newer schemas. No automatic down
migration.

## Backup and restore

Use the SQLite backup API, never raw copying a live database. Each artifact is:

```text
backup-<timestamp>-<unique-id>/
  manifest.json
  authority.sqlite
```

The manifest includes format version, app commit, schema version, workspace ID,
room ID, generation, timestamp, room revision and database SHA-256. A backup must
pass `integrity_check`, foreign key checks, and validation of persisted sessions,
receipts and allocation counters. Take daily backups with 14-day managed retention
and verified off-host encrypted backup. RPO target is at most 24 hours; measured
RTO target is at most 1 hour.

Restore runs in maintenance mode: validate the staged artifact, run supported
migrations in staging, preserve the old installation separately, install the
validated database, assign a NEW generation, clear login sessions, disable restored
accounts until administrator revalidation, and perform full readiness verification.
Restore preserves authority history, receipts and counters from the backup; it never
invents missing events.

## Recovery generation

Synchronization identity is `(workspaceId, generation, roomRevision)`; the existing
snapshot `revision` is the room revision. Generation changes only on restore or
replacement, never on ordinary restart. Pending browser commands are scoped by
`(actorId, workspaceId, generation)` using the immutable authenticated actor ID.

On a generation change, discard the installed snapshot, obtain a full resnapshot,
and quarantine old pending envelopes. Never rewrite their generation or automatically
replay them. The recovery notice identifies restore time, backup time and backed-up
room revision.

## Security

Require strict validation, bounded request bodies, login throttling, bounded scrypt
concurrency, a reasonable command rate limit, parameterized SQL and administrator-only
filesystem operations. No secrets in logs, URLs or `NEXT_PUBLIC` variables.
Authenticated responses use `Cache-Control: no-store`. Require security headers,
nonce CSP, HSTS at the HTTPS deployment, `nosniff`, and restricted referrer and
permissions policies. No enterprise security scope is added.

## Observability

Use structured JSON logs with useful fields: `timestamp`, `level`, `event`,
`requestId`, `route`, `status`, `durationMs`, `workspaceId`, `roomId`, `actorId`,
`commandId`, `revision`, `resultCode` where applicable. Never log cookie/session
tokens, passwords/password hashes, request bodies, operator notes or full export/history.

- `GET /api/healthz`: process liveness.
- `GET /api/readyz`: valid deployment identity/schema and usable writable storage.

## Export, deletion and retention

`GET /api/v3/workspace/export` is operator-only and returns versioned JSON from one
consistent authoritative snapshot. Include REAL sessions/history, room revision,
durable receipts and actor attribution. Exclude credentials, tokens, password hashes
and SIMULATED local data. Export is NOT a restore format.

Authoritative history and receipts are retained until explicit workspace deletion.
Whole-workspace deletion is administrator maintenance-only; no web deletion console.

## Frontend and accessibility

Keep the existing visual design. Required states: signed out, auth loading, viewer
read-only, expired/revoked session, wrong deployment context, offline/stale, backend
unavailable, storage unavailable, reconnected, restored database recovery notice,
first REAL setup, and export.

No optimistic REAL authority. A 401, timeout or 503 after a submitted command does
not prove failure; preserve UNKNOWN outcomes and existing receipt reconciliation.
Logout/account switch cannot leak another actor's REAL state or pending commands.

Critical flows support keyboard operation, visible focus, semantic controls,
labelled inputs, dialog focus trap/restore and announcement, live-region announcements
for critical state, no screen-reader countdown spam, 200% zoom, and reduced motion
where relevant. Acceptance requires automated axe plus manual keyboard and scoped
screen-reader evidence.

## Deployment and operations

Deploy on a Linux host with Docker Compose, Caddy HTTPS, one Next.js container,
Node 22 LTS >=22.16 and persistent local disk. SQLite is at
`/var/lib/livelift/authority.sqlite`. Only Caddy is publicly reachable. Run the app
unprivileged, with a restart policy, health/readiness checks and a 30-second stop
grace. No multiple app replicas against this SQLite database.

Required administrator operations interface:

```text
ops init
ops migrate
ops status --json
ops user add
ops user reset-password
ops user set-role
ops user disable
ops user delete
ops backup
ops restore
ops delete-workspace
ops diagnostics
```

Passwords must never be supplied as command-line arguments. Example deployment and
administrator backup configuration is in `next/.env.production.example`; it contains
only non-secret/example values, including an off-host repository and protected
password-file path. No sample passwords, session tokens, bearer capabilities or
`NEXT_PUBLIC` secrets.

## Acceptance IDs

| Frozen ID | Required evidence |
| --- | --- |
| P3-AUTH | Named accounts, password policy/hash, secure cookie, absolute expiry and revocation; no bearer fallback. |
| P3-ISOLATION | Immutable deployment binding, fail-closed startup, authoritative context comparison and error statuses. |
| P3-AUTHZ | Exactly operator/viewer roles, server-derived actor attribution and CLI-only administration. |
| P3-CSRF | Exact Origin, JSON, request marker and no credentialed cross-origin CORS. |
| P3-DB | Explicit init/migrate/status, version 1 to 2 preservation, backup prerequisite and transactional rollback. |
| P3-BACKUP | Backup API, manifest/hash/validation, daily retention and verified encrypted off-host backup; RPO. |
| P3-RESTORE | Validated staged restore/migration, preserved old installation/history/counters, revoked sessions, disabled accounts and measured RTO. |
| P3-RESTORE-CONTEXT | New generation, full resnapshot, actor/workspace/generation pending isolation, quarantine and no automatic replay. |
| P3-CRASH | Atomic durable authority/history/receipts and unknown-outcome reconciliation survive crashes/restarts. |
| P3-STORAGE | Missing/unwritable storage fails closed; readiness and storage errors reflect failure without in-memory fallback. |
| P3-SECURITY | Validation, bounds, throttling, parameterized SQL, protected operations, no secret leakage, no-store and security headers. |
| P3-OBSERVABILITY | Structured safe logs, request correlation and health/readiness semantics. |
| P3-DATA | Consistent operator-only export, exclusions, retention and administrator-only workspace deletion. |
| P3-A11Y | Automated axe and manual keyboard/scoped screen-reader evidence for critical flows, zoom and reduced motion. |
| P3-DEPLOY | Frozen Linux/Compose/Caddy/single-container topology, Node version, persistent disk, unprivileged process and stop grace. |
| P3-REGRESSION | Mandatory unchanged Phase 1 semantics and Phase 2 CHK-01..CHK-20 authority assertions. |
| P3-SOAK | Sustained production exercise covers authentication, polling/commands, storage, restart, backup and recovery within this deployment scope. |

Phase 1 semantic tests remain mandatory. Phase 2 CHK-01..CHK-20 remain mandatory;
authentication setup may migrate from bearer capabilities to login cookies, but
their authority assertions must not be weakened.

## File ownership

| Lane | Owned paths |
| --- | --- |
| SHARED | `docs/phase3/contract.md`; `next/src/contracts/production.ts`; `next/.env.production.example` |
| PLATFORM | `next/src/lib/server/**`; `next/src/app/api/**`; `next/src/proxy.ts`; `next/src/instrumentation.ts`; `next/scripts/**`; `next/next.config.mjs`; package/lock/build config; `docker/next.Dockerfile`; `docker/next.Caddyfile`; `docker-compose.v3.yml`; `.github/workflows/livelift-v3.yml`; `docs/phase3/platform/**` |
| UI | `next/src/app/**` excluding `api/**`; `next/src/components/**`; `next/src/lib/client/**`; `next/src/lib/store/remoteRoomStore.ts`; `next/src/lib/store/hooks.ts`; remote/UI tests; `helpers/fakeRoom.ts`; `next/src/__tests__/phase3-ui/**`; `docs/phase3/ui.md` |
| AUDIT | `next/src/__tests__/phase3/**`; `next/acceptance/**`; `next/src/__tests__/phase2/**` only for production-auth harness adaptation; `docs/phase3/audit/**` |

Nobody edits the Phase 1 domain engine, `contracts/session.ts`, `contracts/authority.ts`,
SIMULATED semantics or frozen semantic tests. The three shared seed files are frozen
after branching; implementation lanes consume them without edits.
