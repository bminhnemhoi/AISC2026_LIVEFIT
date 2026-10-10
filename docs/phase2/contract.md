# Phase 2 frozen authority contract

This is the shared contract seed only. The wire types live in
`next/src/contracts/authority.ts`; this commit contains no backend or client implementation.

## Architecture and authority boundary

- One Next.js server, one SQLite database using built-in `node:sqlite`, one configured room.
- Reuse the existing TypeScript Phase 1 transition engine on the server without changing its semantics.
- REAL state is server authoritative. SIMULATED state and its virtual clock remain local.
- Writes use HTTP commands. Clients poll the full room snapshot on revision changes.
- At most one REAL show may be active in the room, enforced within the command transaction.

The server assigns session IDs, recording time and REAL environment, and resolves actor identity
and role from authenticated, room-scoped capabilities. Client JSON never supplies trusted identity,
role, runtime state, history, receipts or authority revisions. Domain operator attribution is derived
from that capability; Phase 1 operator context naming remains unchanged.

## Command contract

`POST /api/v3/room/commands` accepts this envelope:

```ts
type CommandEnvelope = {
  commandId: string;
  roomId: string;
  sessionId: string | null;
  expectedRevision: number;
  type: string;
  payload: object;
};
```

The shared TypeScript type narrows this shape into a discriminated union. Runtime types and
payload fields reuse Phase 1 `CommandBody`, with `type` outside `payload`. The REAL API rejects
`advance_clock` and `set_clock`. Server validation must reject unknown commands and invalid
payloads; TypeScript types alone are not runtime validation. Existing Zod session/plan schemas
remain reusable; this seed does not add a second command validator.

Eligible runtime commands may include optional `recoveryId` and `recoveryLabel` metadata from
Phase 1 `CommandBase`. These fields record which operator-selected recovery contextualized the
command. They do not imply an attempt, a performed action, platform confirmation or automatic
execution. Recommendation != acceptance, Acceptance != attempt, and Attempt != performed.

| Additional command | Envelope sessionId | Payload and behavior |
| --- | --- | --- |
| `create_session` | `null` | Phase 1 creation fields: required `title`, `timezone`, `plannedStartMs`; optional `objective`, `accountLabel`, `products`, `segments`, `cues`. Server creates a REAL draft and assigns ID/time/operator. |
| `save_prepare` | Target draft ID | Complete replacement of editable contents: `title`, `timezone`, `objective`, `accountLabel`, `products`, `plannedStartMs`, `segments`, `cues`. Preserve existing schema names and null semantics. Allowed only while planned and baseline unlocked. Runtime/history remain authority owned. |
| `create_next` | Source session ID | Existing `NextSessionInput` fields `title`, `plannedStartMs`, `changeIds`, `note`; server assigns new ID/time. Reuse Phase 1 ended-source validation and explicit selected adjustments. No runtime/history is copied. |

Runtime commands require the target session ID. Creation receipts identify the newly created
session; other receipts identify the target when available. Session revision is nullable when
there is no authoritative session to report. `eventIds` identifies events produced by the command.

```ts
type AuthorityReceipt = {
  commandId: string;
  type: string;
  outcome: "committed" | "rejected";
  code: string | null;
  message: string | null;
  roomRevisionAfter: number;
  sessionId: string | null;
  sessionRevisionAfter: number | null;
  eventIds: string[];
};
type CommandResponse = { receipt: AuthorityReceipt; duplicate: boolean };
```

`GET /api/v3/room/commands/<commandId>` looks up the original durable `AuthorityReceipt`,
subject to authenticated room access. A missing receipt is not evidence that a command failed.

## Revision and idempotency

Optimistic concurrency is room-wide: `expectedRevision` refers to the room, not the session.

- Every new committed command increments room revision exactly once.
- Runtime session revision behavior remains existing Phase 1 behavior.
- Rejections, duplicates and polling do not increment revisions.
- Same `commandId`, same authenticated actor and same canonical request return the original
  receipt with `duplicate: true`, even if the room revision has since advanced.
- Reusing a `commandId` for different intent or actor rejects with `idempotency_conflict`.
  Preserve the original log entry and receipt.
- Two different commands submitted at revision R can yield at most one commit; the loser gets
  `stale_revision`. No automatic rebasing and no offline replay.
- Rejected terminal commands are durably remembered and returned unchanged on duplicate lookup.

Canonical request identity includes `roomId`, `sessionId`, `expectedRevision`, `type` and the
complete payload. JSON object key order is insignificant; array order and missing versus explicit
null or zero remain significant. Actor identity comes from the capability, outside that JSON.

## Reads and polling

`GET /api/v3/room?afterRevision=<revision>` returns `RoomRead`:

```ts
type RoomSnapshot = { roomId: string; revision: number; sessions: Session[] };
type RoomRead = {
  roomId: string;
  revision: number;
  serverNowMs: number;
  clockBehindByMs: number;
  access: { actorId: string; name: string; role: "operator" | "viewer" };
} & (
  | { changed: true; sessions: Session[] }
  | { changed: false }
);
```

`Session` is the existing Phase 1 schema. Room sessions are REAL only. A first read without
`afterRevision`, or a revision different from the current revision, returns `changed: true`
and all room sessions. An equal revision returns `changed: false` without sessions. Every read
includes current server time, clock status and resolved access. `clockBehindByMs` is the
nonnegative gap when the server clock is behind the authoritative effective time; reads do not
rewrite history or increment revisions.

Poll every 1 second while visible, with at most one poll in flight. Never install an older snapshot
over a newer revision. Failed contact or more than 3 seconds since successful contact marks state
stale and disables REAL writes. A successful unchanged read still establishes contact.

## Persistence

SQLite location is configured by `LIVELIFT_DB_PATH`. Conceptual tables are `room_state`
(authoritative state/revision/history) and `command_log` (canonical request, actor and durable
receipt, including terminal rejections).

One command transaction:

```text
BEGIN IMMEDIATE
→ duplicate check
→ read authoritative state
→ revision check
→ validation/domain transition
→ persist state/history/receipt
→ COMMIT
→ respond
```

Capability checks precede trusted command execution. State, history and receipt commit atomically;
acknowledgment follows commit. Storage failure must never fall back to in-memory authority.
Durable terminal rejection logging must leave room and session revisions unchanged.

## Reconnect

Lost command response means outcome UNKNOWN, never failed. The client persists the exact pending
envelope locally before sending. On reconnect it checks the receipt endpoint to reconcile that
command and reads current authoritative state. It never automatically re-POSTs unresolved
commands, changes their expected revision, or replays an offline queue. An absent receipt leaves
the outcome unresolved until explicitly reconciled.

## Roles

- `operator`: room read plus permitted writes.
- `viewer`: room read only.

Capabilities are room scoped and resolved server-side, including receipt lookup. Client-supplied
roles cannot grant permission. No enterprise RBAC is introduced.

## Semantic invariants

Preserve all Phase 1 distinctions:

- Missing != zero
- Planned != actual
- Recommendation != acceptance
- Acceptance != attempt
- Attempt != performed
- Unknown != failed
- REAL != SIMULATED
- Completed != coverage complete

Hard anchors do not silently move. History is not silently rewritten. Later evidence is not
shown as if known earlier. Phase 2 changes the authority location, not these domain semantics.

## Scope exclusions

TikTok API, AI, multi-room, billing, enterprise RBAC and production-hardening Phase 3 work
are excluded. This seed also excludes API route handlers, SQLite implementation, UI changes,
Phase 1 semantic changes and new dependencies.

## Phase 2 Definition of Done

- REAL commands and reads use the single configured server/SQLite authority; SIMULATED stays local.
- Existing Phase 1 transitions and semantic invariants are preserved, with one active REAL show.
- Authenticated room capabilities enforce operator/viewer permissions and server-side attribution.
- Atomic command persistence survives restart, remembers terminal rejections and never falls back
  to in-memory authority on failure.
- Duplicate/conflicting IDs, concurrent commands and stale revisions satisfy the rules above.
- Polling returns full snapshots on change, prevents older-state installation and disables writes
  when contact is stale.
- Lost responses remain UNKNOWN; persisted pending envelopes reconcile through receipt lookup
  without automatic re-POST, rebasing or offline replay.
- Implementation validation demonstrates these behaviors, and `npm run typecheck` passes in `next/`.

The seed is done when only the shared wire contract and this document are committed, typecheck
passes, and no implementation has started. The Phase 2 behavior above is for subsequent lanes.
