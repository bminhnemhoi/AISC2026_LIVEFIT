# LiveLift Strategic Research & Architecture Synthesis
## 05 — Realtime Transport, Disconnected Operation & Recovery

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Focus:** Operational Desk Network Reliability, Monotonic Revision Sync, and Offline Draft Safety  
**Design Reference:** `.kombai/canvas/livelift_canonical_20261003_06_operate.canvas`  

---

### 1. Realtime Transport Architecture: Evaluation and Recommendation

LiveLift's OPERATE workspace requires real-time coordination between the server, external platforms, and human operators. If an operator starts a segment or an assistant logs a note, all desk screens must synchronize immediately.

#### 1.1 Comparative Analysis of Realtime Transports

| Transport Pattern | Latency | Reconnection & Backoff | Proxy & Firewall Resilience | Architectural Complexity | Project Fit for LiveLift |
|---|---|---|---|---|---|
| **Full WebSocket (Bidirectional)** | Very Low ($<50$ms) | Requires manual heartbeat/ping-pong implementation | Can fail through corporate firewalls, VPNs, or aggressive HTTP proxies | Medium-High; requires custom state machine and reconnection handling | Sub-optimal for commands; good for streaming events |
| **Server-Sent Events (SSE) + REST** | Very Low ($<50$ms down) | Built into browser `EventSource` standard with native auto-reconnect | 100% standard HTTP/2 streaming; traverses all corporate proxies and Caddy seamlessly | **Low-Medium**; commands use standard idempotent REST; downstream uses SSE | **RECOMMENDED (BEST FIT)** |
| **Short Polling (1–2s)** | High (500–2000ms) | Trivial (stateless HTTP requests) | Excellent | Very Low | Wasteful server load; sluggish for 5-second decision loop |
| **Long Polling** | Medium (200–500ms) | Reconnects on every message | Good | Medium; high connection churn on FastAPI Uvicorn | Obsolete compared to HTTP/2 SSE |

#### 1.2 The Recommended Architecture: Hybrid REST Commands + SSE State Stream

```
[ OPERATOR BROWSER CLIENT ]                                [ LIVELIFT FASTAPI BACKEND ]
             |                                                          |
             |  1. POST /api/sessions/{id}/commands/start_segment       |
             |     Header: Idempotency-Key: <UUID>                      |
             |     Body: { target_id, expected_revision: 4 }            |
             |--------------------------------------------------------->| (Atomic Commit)
             |                                                          |   * Increment revision -> 5
             |  2. HTTP 200 OK                                          |   * Append exposure_event
             |     Body: { result: "ACK", revision: 5 }                 |   * Broadcast to SSE channel
             |<---------------------------------------------------------|
             |                                                          |
             |  3. SSE Stream: GET /api/sessions/{id}/events            |
             |     event: state_delta                                   |
             |     data: { revision: 5, active_segment_id, ... }        |
             |<=========================================================| (Pushed to all active desks)
```

**Key Architectural Decisions:**
1. **Commands Use Idempotent REST:** All authoritative mutations (Accept recommendation, Start segment, Hold, Extend, End LIVE) use standard `POST` endpoints with an `Idempotency-Key` header and `expected_revision`.
2. **State Updates Use Server-Sent Events (SSE):** Downstream synchronization from server to client uses an SSE stream (`/api/sessions/{sessionId}/events`). If WebSockets are already configured in legacy (`/ws`), they may be used for bidirectional chat if desired, but SSE remains the preferred, robust backbone.
3. **Transport Does Not Equal State Authority:** A message arriving over SSE is never assumed to be complete. Every message carries a monotonic `revision: int`.

---

### 2. Monotonic Revisions, Sequence Gaps, and Snapshot Recovery

To guarantee that no client displays stale or corrupt operational state, LiveLift implements a **monotonic revision protocol**:

```python
class SessionSnapshot(BaseModel):
    session_id: UUID
    runtime_generation: int
    revision: int                 # Monotonically increasing integer (1, 2, 3...)
    lifecycle: SessionLifecycle   # planned, live, ended, cancelled
    active_segment_id: UUID | None
    segment_start_ts: datetime | None
    target_duration_s: int
    lead_operator_id: str
    available_capabilities: dict[str, CapabilityState]
    server_time: datetime
```

#### The Client Resync Algorithm:
1. Every event received on the realtime stream includes `new_revision: int` and `previous_revision: int`.
2. **Normal Case:** Client local revision is equal to `previous_revision`. Client applies the delta and sets local revision to `new_revision`.
3. **Gap Detection:** If `previous_revision > client.local_revision + 1`, the client knows it missed one or more events (due to Wi-Fi packet drop or background tab throttling).
4. **Authoritative Fallback:** The client immediately suspends interactive controls, issues a `GET /api/sessions/{id}/snapshot` request, resets its local state to the fresh server snapshot, and reenables controls.

---

### 3. Server Clock vs Client Clock: Temporal Synchronization

In live broadcasting, seconds matter. However, operator laptops often suffer from local clock drift of 2 to 45 seconds.

**Strict Clock Rules:**
- **Zero Client Clock Authority:** The client browser clock is NEVER used to timestamp operational events, segment starts, or decision records. All timestamps are generated by PostgreSQL on the server (`clock_timestamp()`).
- **Clock Offset Estimation:** When establishing the SSE/REST connection, the client computes the network round-trip time ($RTT$) and clock offset ($\theta$):
  $$\theta = T_{\text{server}} - \left(T_{\text{client\_send}} + \frac{RTT}{2}\right)$$
- **Display Interpolation:** The elapsed time counter on the operator desk (e.g., `04:12` elapsed) is interpolated locally:
  $$\text{elapsed\_seconds} = (T_{\text{local\_now}} + \theta) - \text{segment}.\text{start\_ts}$$
- When a tab is backgrounded and awakened, the browser immediately requests a sync ping to re-align $\theta$.

---

### 4. Conservative Disconnected Operation & UNSYNCED DRAFTS

Livestreaming environments (warehouses, trade shows, noisy studio Wi-Fi) experience frequent network drops. LiveLift enforces a **conservative offline safety policy** to prevent corrupting live broadcasts.

```
+--------------------------------------------------------------------------------------------------+
|                                    OFFLINE BEHAVIOR MATRIX                                       |
+------------------------------------+-------------------------------------------------------------+
| CAPABILITY                         | PERMITTED WHILE DISCONNECTED?                               |
+------------------------------------+-------------------------------------------------------------+
| Read Active Plan / Products        | YES (Available from local memory cache)                     |
| Browse Run of Show                 | YES (Read-only)                                              |
| View Elapsed Clocks                | YES (Interpolated with explicit "Disconnected" warning)   |
| Capture Quick Notes                | YES (Saved locally as UNSYNCED DRAFT in IndexedDB)           |
| Log Operator Presentation Report   | YES (Saved locally as UNSYNCED DRAFT in IndexedDB)           |
|------------------------------------+-------------------------------------------------------------|
| Accept / Reject Recommendation     | NO — BLOCKED (Button disabled; requires server revision)     |
| Start / Skip / Extend Segment      | NO — BLOCKED (Cannot mutate live sequence offline)          |
| End LIVE                           | NO — BLOCKED (End Live requires authoritative freeze)        |
+------------------------------------+-------------------------------------------------------------+
```

#### 4.1 The UNSYNCED DRAFT Lifecycle
When an operator logs an action report (e.g., "Reported M03 Cargo Pants Presented") while disconnected:
1. **Local Storage:** The report is saved into browser `IndexedDB` in the `unsynced_drafts` store.
2. **Distinct Visual State:** The item is rendered with an amber striped pattern and a clear badge:
   $$\text{[ UNSYNCED DRAFT — Saved on device, not submitted to session history ]}$$
3. **Payload Structure:** Includes `draft_id` (UUID), `session_id`, `target_id`, `local_captured_at`, and the payload.

```
[ NETWORK LOST ]
       |
       v
[ Operator enters note or report ]
       |
       v
[ Persist to IndexedDB: status = 'UNSYNCED_DRAFT' ]
       |
[ NETWORK RESTORED ]
       |
       v
[ Step 1: Re-fetch Authoritative Session Snapshot ]
       |
       +---> Did Session End while offline?
       |        |
       |        v
       |     [ Quarantine Drafts: historical audit only, cannot alter runtime ]
       |
       +---> Did Room / Account change?
       |        |
       |        v
       |     [ Flag Mismatch: prevent cross-session contamination ]
       |
       +---> Session is still LIVE and valid
                |
                v
[ Step 2: Render Reconciliation Drawer ]
  "You have 2 unsynced reports captured while offline. Review and submit:"
       |
       v
[ Step 3: Explicit Human Operator Confirmation (Click "Confirm Submission") ]
       |
       v
[ Submit via POST /api/sessions/{id}/reports/reconcile with Idempotency-Key ]
       |
       v
[ Server commits as EvidenceRecord: occurred_at = local_captured_at, recorded_at = now() ]
```

#### 4.2 Prohibited Disconnected Behaviors
- **NO Automatic Background Flushing:** LiveLift NEVER automatically flushes offline reports upon detecting `navigator.onLine`. Network reconnection could occur minutes later after the host has moved to a completely different product. Automatic submission would pollute the timeline with false concurrent presentation claims.
- **NO Queued Runtime Transitions:** If the operator pressed "Start Segment M03" while disconnected, LiveLift does NOT queue this command. It displays an error: *"Cannot transition segments while offline. Check connection."*
- **NO Silent Overwrites:** An offline report submitted after reconnect cannot overwrite another operator's report submitted during the outage. Both exist in the evidence ledger as competing assertions.

---

### 5. Multi-Operator Authority and Conflict Takeover

In professional studios, two operators may share a desk (e.g., Lead Operator transitioning segments; Assistant logging notes and monitoring chat).

1. **The Lead Authority Token:** The session runtime maintains `lead_operator_id`. Only the lead operator's browser holds the active transition lock.
2. **Assistant View:** Assistant desks have read-write access to notes and reports, but transition buttons (Start, Extend, End) display a lock icon: *"Controlled by Lead (Operator A)"*.
3. **Control Takeover Protocol:** If Operator A's laptop battery dies:
   - Operator B clicks "Take Over Control."
   - A modal requires confirmation: *"Take over live desk control from Operator A?"*
   - Server issues a `takeover_control` command, increments `session.revision`, logs an audit event, sets `lead_operator_id = 'Operator B'`, and notifies all connected clients via SSE.
   - Operator A's controls are immediately locked upon reconnection.
