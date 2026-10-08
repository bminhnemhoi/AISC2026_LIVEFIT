# Phase 2 UI: remote authority client

This describes how the Next.js frontend consumes the frozen contract in `contract.md` and
`next/src/contracts/authority.ts`. It changes where REAL state lives, not what it means: every Phase 1
distinction (missing ≠ zero, planned ≠ actual, recommendation ≠ acceptance, acceptance ≠ attempt,
attempt ≠ performed, unknown ≠ failed, REAL ≠ SIMULATED, completed ≠ coverage complete) is unchanged.

## 1. Remote / local split

| | REAL | SIMULATED |
| --- | --- | --- |
| Authority | The room server (HTTP + SQLite) | This browser (`sessionStore`, `localStorage`) |
| Client | `lib/client/authorityClient.ts` + `lib/store/remoteRoomStore.ts` | `lib/store/sessionStore.ts` (unchanged) |
| Time | Server time, interpolated on the monotonic timer | The rehearsal's virtual clock |
| Writes | `POST /api/v3/room/commands`, answered by a receipt | Synchronous local dispatch |
| Where state lives in the browser | In memory only (the installed snapshot) | `livelift.v3.SIMULATED` |

`lib/store/hooks.ts` joins the two: `useSession(id)` resolves a rehearsal from the local store and a REAL show
from the room snapshot; `useSessions()` returns room REAL shows plus local rehearsals. A REAL id is never reported
"not found" while the room cannot be asked (that is the *unavailable* state). Rehearsal screens never start the
room store, so they make no network requests.

Files:

- `lib/client/authorityClient.ts`: typed client for the four frozen endpoints. Wire types are imported from
  `@/contracts/authority`, never redefined. Transport trouble is returned as a value, never thrown.
- `lib/client/authorityTime.ts`: authority-time interpolation (pure).
- `lib/client/pendingEnvelopes.ts`: the only REAL data kept in `localStorage` (see §5).
- `lib/client/commandText.ts`: desk-command → authority-command mapping, operator-facing wording.
- `lib/store/remoteRoomStore.ts`: the REAL authority store.
- `components/ops/ConnectionStatus.tsx`: the connection chip and the stale / outcome-unknown banners.
- `components/ui/CommandState.tsx`: lets any `Dialog` stay open and busy while the room answers.

## 2. Remote store state

`RemoteRoomStore` holds: the installed `RoomSnapshot` (room id, revision, sessions); the resolved `access`
(actor, name, role); `clockBehindByMs`; the connection state; the last error; the one command in flight;
unresolved (outcome-unknown) commands; one-time resolution messages; and ids of sessions the room confirmed
creating that the snapshot does not hold yet. Server time and last-contact time are kept as monotonic
bookkeeping that changes every poll and is deliberately not React state (an unchanged poll re-renders nothing);
read them with `authorityNow()`, `serverNow()` and `lastContactAgeMs()`.

Nothing in the snapshot is ever edited locally. The store only installs what the server returned.

## 3. Polling

- One request every second while at least one REAL view is mounted and the tab is visible
  (`POLL_INTERVAL_MS`). The first poll is immediate. Views hold the store with `acquire()`; it stops 1.5 s after
  the last release so moving between pages does not flicker the status.
- At most one request in flight. A request is aborted after 2.5 s so a hung connection cannot outlive the 3 s
  staleness window.
- Polls send `?afterRevision=<installed revision>`. `changed: false` is a valid read: it establishes contact and
  keeps the installed snapshot. If the server says "unchanged" about a revision other than the one held, the next
  poll asks for the full snapshot.
- An older revision is never installed over a newer one (`read.revision < installed.revision` is ignored).
- Immediate poll after: a committed receipt (until the snapshot is at or past the receipt's room revision, up to
  three tries, since a poll already in flight can predate the commit), a `stale_revision` rejection, the tab
  becoming visible, window focus / `pageshow`, and the browser's `online` event. A hidden tab does not poll.
- Unchanged sessions keep their object identity, so unchanged views do not re-render.

## 4. Stale and disconnected behavior

| State | Meaning |
| --- | --- |
| `connecting` | Started; no contact yet |
| `connected` | Last request succeeded, ≤ 3 s ago |
| `stale` | Had contact; the last request failed, **or** more than 3 s passed since the last success (checked by an independent 500 ms timer) |
| `disconnected` | Never had contact, or the room answered 401/403 (no capability) |

While not `connected`:

- the last committed snapshot is **retained and shown**, labelled as not current (chip + banner with "Try now");
- every REAL mutation control is disabled; the store also refuses to send (`not_connected`);
- authority time is **frozen** at the moment contact was lost (`authorityNow()` stops), so NOW/NEXT projections,
  elapsed counters and forecasts stop where they were. Transitions the client has not seen are never simulated;
- unsaved text typed into a dialog stays where it is.

The page header chip is compact below 1280 px (icon + role, words kept for screen readers); the operating desk
always spells it out.

## 5. Commands

### Operator intent → one command

Every REAL action is one operator intent and gets **one stable `commandId`** (`cmd-<uuid>`). The envelope carries
`roomId`, the target `sessionId`, `expectedRevision` = the **room** revision of the installed snapshot, the
`type`, and the payload.

Never sent for REAL: browser time (`nowMs`), the Phase 1 idempotency `key`, the session revision, an actor, or the
simulation controls (`advance_clock` / `set_clock` cannot be expressed as a REAL command). The server assigns
recording time and operator identity. `toRuntimeBody()` strips these from the desk's Phase 1 command shape.

**Recovery attribution is sent.** `recoveryId` / `recoveryLabel` (permitted on runtime commands by the contract)
travel unchanged in the payload when, and only when, the operator chose that recovery on the desk (Apply on a shown
option, an exception acknowledgement of one, or the re-anchor dialog). The client never adds them itself. They record
which recovery contextualized the command; they do not mean the command was accepted by anyone else, attempted,
performed or confirmed by the platform. Merely showing a recommendation sends nothing.

### Pending

The store allows **one command in flight**; a second is refused (`busy`), not queued. While it waits:

- nothing advances: the snapshot does not change until the room says so;
- the dialog that issued it stays open and shows "Waiting for confirmation…" (`CommandStateContext`);
- the desk's mutation controls are disabled and the chip reads "Waiting for confirmation…".

### Outcomes

| Outcome | What the room said | UI |
| --- | --- | --- |
| committed | A `committed` receipt. The client then fetches a snapshot at or past `roomRevisionAfter` **before** reporting success | Dialog closes; the confirmation shows the recorded event's own summary |
| rejected | A `rejected` receipt, or HTTP 4xx with no receipt (nothing was executed) | Dialog stays open with the reason and the operator's input; `stale_revision` also re-reads the room |
| forbidden | `forbidden` code / 401 / 403 | "You are viewing this room read-only…" for viewers, otherwise "did not allow that action for your access" |
| unknown | Timeout, dropped connection, 5xx, 408, or a 2xx with no receipt | See below |
| refused | Never sent: not connected, viewer, busy, unresolved earlier action, or the pending envelope could not be saved | Nothing was transmitted; the reason is shown |

A receipt is **not** platform confirmation, and a failed or timed-out response is **not** a rejection.

### Outcome unknown

1. The exact envelope is written to `localStorage` (`livelift.v3.remote.pending`) **before** it is transmitted.
   If the browser refuses the write, the command is not sent.
2. If the answer is lost, the command becomes *unresolved*: an **OUTCOME UNKNOWN** banner shows what is and is
   not known. New commands are refused until it is resolved, because the unknown one may have committed.
3. The store reconciles by **receipt lookup** (`GET /api/v3/room/commands/{commandId}`): 1 s after the loss, on
   reconnect, after a page reload, and on "Check status". It **never re-POSTs automatically** and never changes
   `expectedRevision`.
4. A found receipt settles it (committed → fresh snapshot; rejected → shown). An **absent** receipt is not
   evidence of failure: it stays unresolved and says so.
5. Operator choices: **Check status**; **Retry same action** (re-POSTs the exact stored envelope: same
   `commandId`, same `expectedRevision`, same payload, so a command that did commit returns its original receipt
   with `duplicate: true`, and one that no longer fits the room is rejected as stale); **Set aside** (drops the
   banner and the stored envelope; the outcome is recorded as still unknown, not as failed).

## 5a. Capability (authentication)

The room authenticates `Authorization: Bearer <room capability>` only. There is no login, signup or role UI.

- `lib/client/capability.ts` holds the active capability for this tab (`sessionStorage`, never `localStorage`).
  `ConnectionStatus` shows one password-type input ("Room capability" + Connect, and Forget) whenever the room
  needs one; entering it connects without a reload.
- `authorityClient` attaches the header to **every** request (GET room, POST command, GET receipt) in one place,
  with `credentials: "omit"`. The token is never in a URL, a command envelope or payload, the pending-envelope record,
  store state, an error message, or session/domain history.
- Authentication is its own state, `RemoteState.auth`: `missing` (no capability held; **nothing is sent**),
  `rejected` (the room answered 401/403 to the one held), `ok`, `unknown`. The chip reads "Capability needed" /
  "Capability not accepted", the banner says which, and a REAL show page says "A room capability is needed" /
  "did not accept this capability" instead of "cannot be reached" or "not found".
- A 401 to a command is a definite rejection (`unauthorized`; it was not executed), not an unknown outcome.
- Changing the capability drops the installed snapshot and role (they belonged to the previous identity) and reads
  the room again. Pending envelopes are kept; they hold no credential.
- A viewer capability stays read-only: the role comes from the room's `access`, and the UI and store both refuse
  writes for it.

## 6. Roles

- `operator`: room read plus writes.
- `viewer`: reads everything (Home, Sessions, Prepare, Operate, Review). Mutation controls are disabled
  (Prepare's editing area and Start, Operate's NOW/NEXT actions, toolbar and End LIVE) or hidden (Review's note and
  correction controls); Review's Next LIVE button is disabled.
  The desk header says "Viewing as <name> · Lead is <name>" instead of "You are Lead". The chip shows
  "Viewer · read-only".
- The UI never relies on this alone: the store refuses to send for a viewer, and the server's own `forbidden`
  is handled as a normal rejection. The role is re-read on every poll, so a capability change takes effect
  without a reload. Identity is whatever the room's capability resolves to; the Create form no longer asks for a
  name.

## 7. Screens

- **Create**: REAL → `create_session` (title, timezone, planned start, objective, account label, products,
  segments, cues). Templates and packs are built client-side, with segment/cue ids scoped to the new plan
  (`draft:…`); the server assigns the session id. Copying an *ended* REAL show uses `create_next` (keeps "planned
  from"); copying a planned/active one uses `create_session` with the copied baseline (no provenance link, as the
  contract has no field for it). Navigation to Prepare happens after the committed receipt, using the receipt's
  `sessionId`.
- **Prepare**: each edit builds the complete draft on a clone of the installed session, validates it with the
  Phase 1 schema, and sends one `save_prepare` with the full editable contents. Start LIVE is `start_live`;
  the desk opens only after the room confirms. The "one active REAL show" check is also shown from the snapshot;
  the room enforces it.
- **Operate**: `report_cue`, `report_manual_action`, `advance_segment`, `extend_segment`, `reanchor_segment`,
  `skip_segment`, `reorder_segment`, `set_remaining_estimate`, `add_note`, `end_live`, etc. map one-to-one to
  Phase 1 commands. The "needs an exception" flow works as before: the room's `needs_ack_*` rejection opens the
  acknowledgement dialog, whose confirmation re-sends with the flag as a new intent.
- **Review**: reads the snapshot. Notes and corrections are commands. **Next LIVE** is `create_next`.
- **SIMULATED**: unchanged. Pixel-identical to the pre-migration build at 1440×900, 1280×720, 1024×768, 390×844
  for the Simulator, Operate, Prepare and Review screens.

### Authority time and clock discrepancy

`serverNowMs` is already the authority's corrected time. The desk shows

    display authority time = serverNowMs + monotonic elapsed since the snapshot

and **never adds `clockBehindByMs`**. While stale or disconnected the elapsed term stops (frozen where contact was
lost); the next successful read re-anchors on the room's time.

`clockBehindByMs` is informational: how far the server's raw clock trails time it already recorded. Above 2 s it
drives the Phase 1 discontinuity banner, worded for the server clock ("The room's clock is behind recorded time by
…, it reads <corrected − gap>; LiveLift keeps counting from <corrected>"). "Record in history" sends
`acknowledge_clock_discontinuity` with that raw reading and the corrected time being kept. The gap is disclosed,
never applied.

## 8. Migration behavior

- Fresh REAL shows are created in the room. Nothing REAL is written to `livelift.v3.REAL` any more.
- REAL shows recorded in this browser before Phase 2 are **never uploaded or merged**. They appear on the Sessions
  page under "Local archive · before shared authority", labelled as such, and open only as a read-only Review
  (`/live/<id>/review?archive=1`; the flag is needed because a local id may equal a room id). They cannot be
  prepared, started, operated, appended to, or used to create a Next LIVE.
- The local store, its storage-health notices and all SIMULATED behavior are unchanged.
- The only REAL data the browser keeps is the pending-envelope list described in §5. It is removed as soon as a
  receipt is known.

## 9. Contract ambiguities found

These are places where the frozen contract is silent and the client made the most conservative choice. None
required changing the contract.

1. ~~Recovery attribution is not expressible.~~ Resolved: the contract now permits `recoveryId` / `recoveryLabel`
   on runtime commands and the client sends them (§5).
2. **Segment/cue id allocation.** `create_session` and `save_prepare` payloads carry client-allocated segment and
   cue ids (`draft:…` at creation; `<sessionId>:s<N>` / `:c<N>` from the installed `seq` while editing). The
   payload has no `seq`. The server must keep `seq.segment` / `seq.cue` at or above the highest id used, or a later
   client allocation can repeat one.
3. ~~How the capability is presented.~~ Resolved: bearer header, §5a.
4. **Refusal shape.** A refused POST is accepted either as a `rejected` receipt or as HTTP 4xx without a receipt;
   401/403 map to `forbidden`; 5xx, 408, timeouts and receipt-less 2xx are *unknown*. A missing receipt on lookup
   (404) means "absent".
5. ~~`clockBehindByMs` semantics~~ Resolved: informational only, never added (§7). Still an interpretation: the
   meaning of `acknowledge_clock_discontinuity`'s `deviceNowMs` / `keptNowMs` when the clock in question is the
   server's (raw reading / corrected time).
6. **Duplicating a non-ended REAL show** has no provenance field (`derivedFrom`) in `create_session`.
7. **One writer at a time.** `expectedRevision` is room-wide, so any other operator's commit, including one from
   another desk on the same show, makes an in-flight action `stale_revision` by design. The UI says so and
   re-reads; it never retries on its own.
