# Phase 2 backend

## Layout

- `next/src/lib/server/config.ts`: required configuration and room bearer authentication.
- `validation.ts`: strict envelope/payload validation and canonical JSON identity.
- `authority.ts`: synchronous SQLite transactions wrapping the frozen Phase 1 engine.
- `http.ts`: lazy server initialization, authenticated route boundary and no-store responses.
- `next/src/app/api/v3/room/**`: Node runtime HTTP handlers.

No client store, UI, domain semantics or SIMULATED state is changed. The backend has no import
or migration path for browser sessions. Client wiring remains the client lane's responsibility.

## Configuration and local run

Use Node 22.13+ (built-in `node:sqlite`, no database dependency). Configuration is server-only;
never use `NEXT_PUBLIC_` variables for capabilities. All three variables are required:

| Variable | Value |
| --- | --- |
| `LIVELIFT_ROOM_ID` | Single configured room identifier. |
| `LIVELIFT_DB_PATH` | Absolute path to a persistent SQLite file in an existing writable directory. |
| `LIVELIFT_CAPABILITIES` | JSON array of `{token, roomId, actorId, name, role}` records. |

Capabilities must have unique nonempty bearer tokens and all reference the configured room.
Roles are `operator` or `viewer`. Actor ID/name/role resolve entirely from this configuration.
Domain creation operator context uses `{id: actorId, name, role: "lead", isLead: true}`; authority
roles remain distinct from Phase 1 domain lead/assistant naming. Runtime event attribution uses
the configured actor name. Restart the server to apply capability changes.

```sh
cd next
npm ci
mkdir -p /tmp/livelift-local
export LIVELIFT_ROOM_ID=studio
export LIVELIFT_DB_PATH=/tmp/livelift-local/authority.sqlite
export LIVELIFT_CAPABILITIES='[{"token":"local-operator-token","roomId":"studio","actorId":"operator-1","name":"Local operator","role":"operator"},{"token":"local-viewer-token","roomId":"studio","actorId":"viewer-1","name":"Local viewer","role":"viewer"}]'
npm run dev
```

These tokens are local examples; configure private random tokens for shared access. For production
use `npm run build` followed by `npm run start`, with the same variables. The existing Node 22
Docker runtime supports SQLite; pass the three variables and mount a writable persistent directory
for the database. Preserve the database and its WAL sidecars. No build-time secrets are required.

```sh
curl -H 'Authorization: Bearer local-operator-token' http://localhost:3130/api/v3/room
curl -H 'Authorization: Bearer local-viewer-token' 'http://localhost:3130/api/v3/room?afterRevision=0'
curl -H 'Authorization: Bearer local-operator-token' -H 'Content-Type: application/json' \
  -d '{"commandId":"example-create-1","roomId":"studio","sessionId":null,"expectedRevision":0,"type":"create_session","payload":{"title":"Show","timezone":"Asia/Ho_Chi_Minh","plannedStartMs":1791291600000}}' \
  http://localhost:3130/api/v3/room/commands
```

## Schema and commit boundary

Schema version 1 uses:

| Table | Contents |
| --- | --- |
| `room_state` | Exactly one row: room ID, room-wide revision, persisted effective clock watermark. |
| `sessions` | REAL session JSON including plans/runtime/history/domain receipts, lifecycle, all previously used product/segment/cue IDs. |
| `command_log` | Command ID, actor ID, canonical request, authority receipt, original HTTP status, server recording time, immutable initial resolved draft for creation commands. |

Update/delete/replacement triggers make the command log and embedded authority receipts/creation drafts
immutable. A unique partial index on active session room IDs independently enforces one active
show. The database cannot be reopened under another configured room ID. No fallback room or
in-memory authority is created.

SQLite uses WAL, `synchronous=FULL`, foreign keys and a 5-second busy timeout. Initialization,
command execution and snapshot reads use short `BEGIN IMMEDIATE` transactions. A command checks
durable identity before revision, validates/executes once, then writes session, room revision and
receipt atomically. The response follows COMMIT. Terminal rejected valid envelopes also receive
immutable log entries, with unchanged room/session revisions. Malformed envelopes and unauthenticated
requests cannot establish a trusted command identity and do not enter the log.

Every commit increments room revision once. Runtime session revisions follow the Phase 1 engine;
`save_prepare` increments its target once; creation starts at session revision zero. Prepare replaces
editable fields only, preserves runtime/history and retires deleted IDs permanently. Drafts may
remain incomplete or infeasible; existing domain readiness checks block Start. `create_next` calls
the existing server-side proposal/clone path, applies only selected IDs, supplies a new operator/ID/time,
and leaves the source unchanged. The frozen `CreateNextPayload` contains only title, plannedStartMs,
changeIds and note; it defines no authority infeasibility acknowledgement field. None is invented here.

## Time and restart

REAL recording time comes from the server. The existing monotonic clock helper uses wall time plus
process monotonic elapsed time, clamped to the persisted watermark. Snapshot reads persist the watermark
without changing revisions. After restart the watermark prevents any reading or record from going back;
the elapsed downtime cannot be reconstructed if the wall clock also moved backward. The nonnegative
wall/effective gap is reported as `clockBehindByMs`. History remains unchanged. Explicit occurrence
times in reports/corrections retain their Phase 1 meaning as operator-supplied evidence, distinct from
server recording time. `advance_clock` and `set_clock` reject with `wrong_environment`.

Sessions, revisions, used IDs, initial creation drafts, committed receipts and terminal rejection
receipts survive process restart. Duplicate requests return the original receipt/status regardless
of current revision. Identity includes actor ID plus the complete canonical request; object key order
is ignored, arrays/null/zero/absent keys retain their distinctions. Conflicting reuse returns
`idempotency_conflict` and preserves the original entry. Storage/configuration failures return 503.

## Endpoints

All endpoints require `Authorization: Bearer <token>` and return `Cache-Control: no-store` with
`Vary: Authorization`. Optional `roomId` query selectors must match the configured room.

| Endpoint | Response |
| --- | --- |
| `GET /api/v3/room` | Frozen `RoomRead`, full REAL snapshot with authenticated access metadata. |
| `GET /api/v3/room?afterRevision=N` | Equal revision: `changed:false`, no sessions. Any mismatch: full snapshot. Includes server time/clock status in both cases. |
| `POST /api/v3/room/commands` | Frozen `CommandResponse` with durable receipt and duplicate flag. |
| `GET /api/v3/room/commands/{commandId}` | Original durable `AuthorityReceipt`, including rejections. Unknown: 404 with an explicit UNKNOWN-outcome explanation. |

Clients poll every second while visible, retain at most one request in flight, and reconcile lost
responses by receipt lookup plus room read. Receipt absence does not prove failure; no command is
automatically rebased or replayed by the backend.

Committed commands/duplicates use 200. Malformed JSON/envelopes/query revisions use 400; missing/invalid
capabilities use 401; viewer writes use 403; unknown room/session/domain targets/receipts use 404;
revision, identity, lifecycle and domain conflicts use 409; invalid command payloads use 422;
unavailable storage/authority uses 503. Command rejections retain existing domain codes where applicable.
Transport errors use `{error:{code,message}}`; valid-envelope terminal decisions use `CommandResponse`.

## Validation

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` in `next/`.
The focused backend-owned smoke test is `src/lib/server/authority.test.ts`; run it with
`npm test -- src/lib/server/authority.test.ts`. It checks auth, reads, durable rejected and committed
identity, draft ID retirement, lifecycle rules, empty clones, immutable logging and backward-clock reopen.

Lane validation also exercised the production server through 32 CLI/HTTP assertions, including two
parallel Start requests at one revision, real process stop/restart, durable receipt lookup, wrong room
and session IDs, and unavailable database/configuration responses. Existing domain/UI/store tests
remain unchanged. The one-room implementation reads full session JSON; polling a changed revision
costs O(retained room state). Use a bounded retention/query design if room history exceeds this scope.
