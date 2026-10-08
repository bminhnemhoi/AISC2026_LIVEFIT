# LiveLift V3 platform operations

One Linux host, one Next Node 22.23.3 process, one local SQLite database, one Caddy HTTPS edge.
Use **only** `docker-compose.v3.yml` for V3; legacy FastAPI/Postgres routing is independent.
Never scale `next` beyond one replica. Keep the installation directory on persistent local disk.

## Fresh installation and configuration

Copy the frozen `next/.env.production.example` to a protected administrator environment file.
Replace its placeholders. Add `LIVELIFT_HOST` (public DNS hostname) and
`LIVELIFT_APP_COMMIT` (the source commit SHA). The origin is an exact HTTPS origin, without a
trailing slash. Generate a unique workspace UUID once; keep the workspace/room binding for
this installation. No `LIVELIFT_CAPABILITIES` or `NEXT_PUBLIC` secret is needed.

Compose reads a root `.env` or an explicit `--env-file`; use the latter consistently below
when your configuration is elsewhere. Store it mode 0600. The backup password belongs in
`RESTIC_PASSWORD_FILE`, not this environment file or argv. `LIVELIFT_TRUST_PROXY=caddy` is
set by Compose: Next has no public port, and Caddy overwrites `X-LiveLift-Client-IP`.
Do not enable that setting with direct application ingress.

```sh
export LIVELIFT_APP_COMMIT=$(git rev-parse HEAD)
docker compose -f docker-compose.v3.yml build next
docker compose -f docker-compose.v3.yml run --rm --no-deps next node .ops/scripts/ops.js init --maintenance
docker compose -f docker-compose.v3.yml run --rm --no-deps next node .ops/scripts/ops.js user add lead --name 'Lead operator' --role operator
docker compose -f docker-compose.v3.yml run --rm --no-deps next node .ops/scripts/ops.js user add watch --name 'Viewer' --role viewer
docker compose -f docker-compose.v3.yml up -d
docker compose -f docker-compose.v3.yml exec -T next node .ops/scripts/ops.js status --json
```

Provision users before starting the service. User commands prompt on `/dev/tty` with echo
disabled, or accept `--password-stdin` through a private pipe/file. Passwords are 15–128
characters; spaces are preserved. Input is one newline-framed password, without trimming.
Protected input files must be owned by the invoking UID with mode 0600. Never pass a password
in argv, an environment variable, a URL or a shell command literal.

Storage paths inside the container are `/var/lib/livelift/authority.sqlite` and
`/var/backups/livelift`. Fresh named volumes inherit UID 1000 ownership. Existing volumes
must be writable by UID 1000. The image is unprivileged, the root filesystem is read-only,
and stop grace is 30 seconds. Caddy holds TLS certificates separately. Restrict public ingress
to ports 80/443. Health uses `/api/readyz`; `/api/healthz` is process liveness only.

For a source checkout: `cd next; npm ci; npm run build:ops`; use
`npm run ops -- <command>`. A compiled deployment uses `node .ops/scripts/ops.js <command>`
and needs no TypeScript compiler. Linux `flock`, `sh` and `cat` are required and included in
Docker. Init is explicit: normal startup never initializes or migrates storage.

## Accounts and revocation

Online administration uses `docker compose -f docker-compose.v3.yml exec next` followed by:

```text
node .ops/scripts/ops.js user add <username> --name <display-name> --role operator|viewer
node .ops/scripts/ops.js user reset-password <username>
node .ops/scripts/ops.js user set-role <username> --role operator|viewer
node .ops/scripts/ops.js user disable <username>
node .ops/scripts/ops.js user delete <username>
```

Use `exec -T ... --password-stdin < /protected/password-file` for protected file input.
Reset, role change, disable and delete revoke every existing login session immediately.
Reset-password also re-enables a disabled/restored account after administrator revalidation.
There is no email reset flow: verify the person's identity through your support procedure,
then use the CLI. Deleted usernames can be provisioned again with a **new** actor UUID;
old actor attribution and the never-reuse actor ledger remain intact.

## Upgrade and migration

Stop Next before maintenance; Caddy may stay up and return unavailable responses.
Maintenance operations acquire an exclusive kernel file lock. User operations, status and
online backup use a shared maintenance lock; the service also holds a separate exclusive
single-process lock. Locks release after process death, including SIGKILL.

```sh
docker compose -f docker-compose.v3.yml stop next
docker compose -f docker-compose.v3.yml run --rm --no-deps next node .ops/scripts/ops.js migrate --maintenance
docker compose -f docker-compose.v3.yml run --rm --no-deps next node .ops/scripts/ops.js status --json
docker compose -f docker-compose.v3.yml up -d next
```

The only migration is schema 1 → 2, using ordered static SQL in one transaction. It first
publishes and independently verifies a pre-migration backup; authority tables, history,
receipts, clock watermark and allocations are preserved. Accounts start empty for a v1
migration and need CLI provisioning. Failed SQL rolls back schema/data/version; the
maintenance marker remains for inspection. Unknown, version 0, and newer versions are
rejected. Ordinary startup requires version 2 and matching workspace/room metadata.

Migration failure: repair the specific storage/schema issue, keep the verified backup,
then retry `migrate --maintenance --resume`. If the DB already reports supported version 2
and full integrity/identity checks pass (a crash after commit), remove only the maintenance
marker under stopped-service maintenance, then recheck readiness. Never edit `user_version`
to bypass compatibility. There is no automatic downgrade. An older application can run
only a schema it explicitly supports; use its matching pre-upgrade backup, not the v2 DB.
Any workspace replacement must use the restore flow and a new generation.

## Backup, retention and off-host recovery

```sh
docker compose -f docker-compose.v3.yml exec -T next node .ops/scripts/ops.js backup
```

Each artifact is `backup-<epoch-ms>-<uuid>/{manifest.json,authority.sqlite}`. The manifest
records format/app commit/schema/binding/generation/time/revision/SHA-256. `node:sqlite`
backup creates the snapshot; the destination is closed, checked for integrity, foreign
keys, persisted REAL session/receipt decoding and allocation consistency, hashed, fsynced,
then atomically published. Failed publication never replaces an existing artifact.
**Never copy a live authority DB**. Docker copy of a validated, closed backup artifact is safe.

Configure a Restic encrypted off-host repository and a protected password file on the host.
Initialize it once using `restic init`. Run `next/scripts/backup-daily.sh` from the repository
root with the protected environment loaded. It obtains a validated live backup, copies only
that closed artifact, rechecks its checksum, uploads it tagged `livelift-v3,<workspace UUID>`,
verifies encrypted repository data with `restic check --read-data`, and only then prunes
managed local and remote snapshots older than 14 days. Remote retention groups by tags,
so changing artifact paths does not prevent pruning. Restic/Node/Docker/flock must be
installed on the host; the application image includes Restic for administrator deletion.

Schedule daily, for example a root crontab with a wrapper that loads the protected environment:
`0 2 * * * cd /deployment/repo && /protected/run-livelift-backup`.
That wrapper runs `next/scripts/backup-daily.sh`, checks its exit status and alerts on failure.
The script uses a host flock to prevent overlapping jobs. Monitor the latest verified artifact
and off-host job age: target RPO ≤24 hours, retention 14 days. Test recovery at least monthly
and record the actual installation's elapsed RTO; target ≤1 hour. Local test timings are not
an off-host recovery guarantee. Protect backups as credentials/history-bearing artifacts.

Manual local pruning is `ops backup --prune-only`; use it only after verifying off-host copies.
`ops backup --prune` creates a snapshot and then performs the same 14-day local retention.
It prunes only verified snapshots belonging to the current workspace.

## Restore and interrupted restore

Recover the complete artifact into the configured managed backup directory, preserving its
name. Stop Next, then:

```text
ops restore /var/backups/livelift/backup-<time>-<uuid> --maintenance
ops status --json
ops user reset-password <revalidated-username>
```

Restart Next after status succeeds and required administrators are revalidated. Restore checks
checksum/schema/identity/integrity/REAL data and stages supported forward migration before
replacement. It sets a new generation and recovery notice, clears all login sessions and
disables every restored account. Authority history/receipts/counters are exactly the backup's;
events after that backup are absent and are never invented. Old pending browser envelopes
must be quarantined, never relabelled or replayed.

The offline old database **and its WAL/SHM/journal** move to a separate timestamped rollback
directory before installation. This preserves even a corrupt current installation for local
administrator investigation; its sidecars never attach to the replacement. Staged data and
directory changes are fsynced. Readiness is checked before clearing the durable
`.livelift-maintenance.json` marker. Startup refuses any surviving marker.

If restore is interrupted, keep service stopped and storage/rollback/staging intact. Fix disk
space/permissions, recover the same verified managed artifact, then repeat
`ops restore <artifact> --maintenance --resume`. It rebuilds staging and assigns another new
generation; earlier rollback copies remain separate. Do not delete the marker merely to start
an unverified database. A replacement rollback also goes through restore; never rename a
rollback DB into service and reuse its old generation. Keep rollback copies protected until
the installation's recovery has been checked, then explicitly retire them under maintenance.

## Storage incidents and crash outcomes

- **Disk full/unwritable:** stop writes, free unrelated files or increase local capacity, preserve
  authority/sidecars/verified snapshots, then check diagnostics/readiness. Failed transactions
  roll back; a lost response still means UNKNOWN and needs receipt lookup. No memory fallback.
- **Missing DB:** startup fails closed. Restore a verified artifact. Use init only for a deliberate
  new workspace. Do not create an empty DB to hide loss of authority history.
- **Corruption:** stop the service, preserve the installation locally and restore the newest
  verified backup. Restore keeps corrupted offline bytes in rollback storage.
- **Crash/restart:** WAL with synchronous FULL retains atomic state/history/receipt commits.
  Acknowledgement follows COMMIT. Reconcile stable command IDs through receipt lookup.
- **Unready:** probes perform a bounded write followed by rollback, cached for five seconds;
  neither authority revision nor history changes. Schema/binding/marker/file identity are checked
  before reuse. Probe SQLite busy timeout is 250 ms. Process liveness does not imply writable DB.

## Export and workspace deletion

While service is healthy, an authenticated operator exports through
`GET /api/v3/workspace/export`, with workspace/generation headers. Save the download securely.
It contains full REAL sessions/history and attributed durable receipts from one transaction;
no password material, login tokens or SIMULATED data. JSON export cannot be imported/restored.

Ordinary deletion requires no active LIVE. Stop Next, type the actual workspace UUID, then:

```text
ops delete-workspace --maintenance --confirm-workspace <typed-workspace-UUID> --prune-backups
```

Managed DB, sidecars, exports, staging and rollback copies are removed. `--prune-backups`
(or `LIVELIFT_DELETE_BACKUPS=1`) also removes managed snapshots. When Restic configuration is
present in the operations environment, workspace-tagged off-host snapshots are removed and
absence verified before local completion. For the Docker admin container, pass those env values
and bind-mount its protected Restic password file; provide SSH access separately for SFTP.
If remote copies exist but configuration was not supplied, delete those separately before
claiming complete retirement. Other workspace snapshots are never pruned.

Any backup cleanup failure leaves deletion incomplete, nonzero exit and the maintenance
marker intact; retry `delete-workspace ... --resume` after fixing cleanup. A minimal UUID
retirement ledger `.livelift-retired.json` stays outside workspace/restorable data and prevents
init/restore/startup from silently reviving the retired ID. Keep that ledger and the installation
root even after deleting workspace files. Provision a new UUID for a genuinely new workspace.

## Diagnostics and logs

`ops diagnostics --json` or `ops status --json` emits Node/app commit/SQLite/schema versions,
readiness, integrity result, maintenance flag, binding/recovery metadata, room revision and
counts plus generic redacted operational errors. Store diagnostic output with mode 0600.
It contains no DB contents, credentials, tokens, paths, notes or history. Structured service
logs record startup/shutdown, auth failures/revocations, command decisions, storage and
lifecycle outcomes. Correlate API responses by `X-Request-Id`; unchanged GET polling is quiet.
No request bodies/cookies/passwords/hashes or exports are logged.

## Live production soak

Run release tooling from a source checkout with Node 22.23.3 and `npm ci` in `next/`.
The canonical CLI is `node acceptance/soak.mjs`; `npm run soak:smoke` and
`npm run soak:48h` select its modes. It uses the locked TypeScript compiler before running
ordinary JavaScript. The production image does not need the compiler or soak tooling.

Configure these environment variables in the invoking shell or a protected operator
environment file. Do not copy the account passwords into that file.

| Variable | Required / handling |
|---|---|
| `LIVELIFT_TEST_SERVER_URL` | Required, deployment HTTPS origin; HTTP permitted only for loopback test peers |
| `LIVELIFT_WORKSPACE_ID` | Required, actual installation workspace UUID |
| `LIVELIFT_ROOM_ID` | Required, actual installation room |
| `LIVELIFT_OPERATOR_USERNAME` | Required, enabled named operator account |
| `LIVELIFT_OPERATOR_PASSWORD_FILE` | Required, protected operator password file |
| `LIVELIFT_VIEWER_USERNAME` | Required, enabled named viewer account |
| `LIVELIFT_VIEWER_PASSWORD_FILE` | Required, protected viewer password file |
| `LIVELIFT_APP_ORIGIN` | Optional, defaults to deployment URL origin; set the exact configured CSRF origin |
| `LIVELIFT_GENERATION` | Optional expected generation; otherwise discovered at login and pinned for the run |
| `NODE_EXTRA_CA_CERTS` | Optional PEM CA file for staging with a private CA; keep TLS verification enabled |
| `LIVELIFT_SOAK_OPS_EXECUTABLE` | Optional absolute path to a trusted ops wrapper; needed for integrated status/backup coverage |

Both password files must be regular files owned by the invoking UID with mode **0600**.
Symlinks and group/world access are rejected. Supply one UTF-8 password, 15–128 characters,
with an optional final LF. Spaces are preserved. Passwords, cookies, tokens and credential
file paths are never printed or saved by the CLI. Password argv options are rejected, and
the soak does not use `LIVELIFT_OPERATOR_PASSWORD` or `LIVELIFT_VIEWER_PASSWORD`.

After configuring the environment, run:

```sh
cd next
npm ci
npm run soak:smoke -- --duration 60s
npm run soak:48h -- --duration 48h
```

`--duration` accepts positive whole seconds/minutes/hours such as `30s`, `5m`, `1h`, `48h`.
Malformed, fractional, zero or unsafe values fail. Smoke defaults to 30 seconds; rehearsal
defaults to 48 hours. `node acceptance/soak.mjs --help` prints configuration and usage
without credentials or a running deployment.

The runner logs in both roles, polls their full room snapshots, checks sessions and HTTP
health/readiness, and creates one planned REAL draft named `Release soak <run UUID> A`.
It then alternates the title of **that draft only** through valid `save_prepare` commands.
The draft and its durable receipts remain as audit evidence. It never starts/ends a show,
restores/deletes a workspace or clears history. Leave this draft alone during the soak.
Absolute session expiry causes an explicit logout/login; revoked accounts and a changed
generation fail closed. A five-minute recovery budget per operation tolerates ordinary
temporary connectivity/availability loss; receipt lookup precedes resend of an unknown
command outcome. The command ID, payload and expected revision stay unchanged on replay.

Startup output lists nonsecret deployment configuration and `credentials: "[REDACTED]"`.
Progress JSON is bounded to counters (every five seconds for smoke, every minute for 48h).
The final line records elapsed/configured duration, both roles' logins/polls, commands,
receipts/reconciliation, reconnects, errors, probes/backups and invariant checks/violations.
No snapshots, history, arbitrary server error bodies or ops output are printed.

When `LIVELIFT_SOAK_OPS_EXECUTABLE` is configured, the executable is called directly,
without a shell, with `status --json` at each health interval and `backup` at startup/hourly.
Point the wrapper at the **same deployment** using the existing ops CLI. Status identity,
generation, schema, readiness and integrity are validated. Existing `ops backup` verifies
the online artifact before successful exit. Both calls have a 60-second timeout and bounded,
suppressed output. The wrapper must return the real ops exit code. No wrapper means backup
coverage is absent: keep the established daily/off-host backup schedule and its evidence.

Ctrl-C (SIGINT) or SIGTERM stops new cycles, finishes the current bounded operation, and
prints final `STOPPED`, exiting 130 or 143. A completed run emits `PASS` and exits 0 only
with both roles active, a committed real mutation, reconciled receipt accounting and no
invariant failure. Invalid config, invariant failure, unrecoverable authentication/server
failure, exhausted recovery budget or failed ops checks emits `FAIL` and exits 1.

The smoke and rehearsal entry points were tested against staging with short durations;
see [live certification](../audit/LIVE_SOAK_CERTIFICATION.md) for exact commands and results.
A duration override certifies the entry point, not 48 hours of endurance. Require the full
completed 48-hour output and backup evidence before clearing the final release gate.
