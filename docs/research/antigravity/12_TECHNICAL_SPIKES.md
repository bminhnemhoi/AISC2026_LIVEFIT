# LiveLift Strategic Research & Architecture Synthesis
## 12 — High-Value Technical Spikes & Verification Plan

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Scope:** Six Targeted Engineering Spikes to De-Risk Core Implementation  
**Methodology:** Minimal Prototype Scope, Falsifiable Success Criteria, and Decision Unlock Impact  

---

### 1. Overview of Spikes

Before investing heavily in full-scale production implementation, the engineering team must resolve high-risk architectural unknowns through six isolated, lightweight proof-of-concept spikes.

```
+--------------------------------------------------------------------------------------------------+
|                                    TECHNICAL SPIKE MATRIX                                        |
+----------+------------------------------------------------------+---------------+----------------+
| SPIKE ID | TARGET QUESTION / ARCHITECTURAL UNKNOWN              | ESTIMATED TIME| DECISION TARGET|
+----------+------------------------------------------------------+---------------+----------------+
| **SPK-01** | Provider Capability Negotiation & Dynamic Degradation| 1 Day         | Provider Core  |
| **SPK-02** | Realtime Monotonic Revision Sync & Snapshot Recovery | 1 Day         | Realtime Layer |
| **SPK-03** | Offline Draft Quarantine & Human Reconciliation Flow | 1 Day         | Offline UX     |
| **SPK-04** | Dual-Perspective Semantic Replay Query Performance   | 0.5 Day       | Data / Replay  |
| **SPK-05** | High-Frequency Event Rendering & DOM Throttling      | 0.5 Day       | Frontend Perf  |
| **SPK-06** | Dual-Operator Authority Lock & Control Takeover      | 0.5 Day       | Concurrency    |
+----------+------------------------------------------------------+---------------+----------------+
```

---

### 2. Detailed Technical Spike Specifications

#### Spike 1: Provider Capability Negotiation & Degradation Proof (SPK-01)
- **Core Question:** Can LiveLift dynamically reconfigure its active operational capabilities when an external provider disconnects or errors, without crashing the live desk or forcing the operator to reload the browser?
- **Minimal Implementation:**
  - Create a mock `TikTokShopAdapter` that simulates HTTP 401 token expiration after 10 seconds of streaming.
  - Implement a `CapabilityNegotiator` in Python that aggregates `ManualDeskAdapter` and `TikTokShopAdapter`.
  - Connect a minimal test frontend via SSE.
- **Success Criteria:**
  - When the mock adapter fails, the SSE stream emits a `capabilities_updated` event within 200ms.
  - The UI updates the catalog sync badge from `AVAILABLE` to `REVOKED`, renders a recovery hint ("Reconnect Seller Account"), and leaves the manual segment transition controls 100% active and unblocked.
- **Time / Complexity:** 1 Day / Low-Medium.
- **Decision It Unlocks:** Proves that the capability negotiation model completely eliminates the need for monolithic `if (platform == 'tiktok')` conditionals.

#### Spike 2: Realtime Monotonic Revision Sync & Snapshot Recovery (SPK-02)
- **Core Question:** Can a client that experiences network packet drop reliably detect sequence gaps in the SSE event stream and recover authoritative state via snapshot fetch without operator intervention?
- **Minimal Implementation:**
  - FastAPI endpoint streaming revision numbers (`rev: 1`, `rev: 2`, `rev: 3`...) over SSE every second.
  - A browser client maintaining `local_revision`.
  - Injected network fault: Drop packets `rev: 4` and `rev: 5` in the client event listener.
- **Success Criteria:**
  - When packet `rev: 6` arrives, client detects that `previous_revision (5) > local_revision (3) + 1`.
  - Client immediately displays a temporary non-blocking "Resyncing..." indicator, triggers `GET /api/sessions/{id}/snapshot`, updates `local_revision = 6`, and resumes normal operation with zero lost state.
- **Time / Complexity:** 1 Day / Low.
- **Decision It Unlocks:** Confirms that hybrid SSE + Snapshot recovery is 100% robust against unreliable studio Wi-Fi, eliminating the need for complex, heavy WebSocket state machines.

#### Spike 3: Offline Draft Quarantine & Explicit Reconciliation (SPK-03)
- **Core Question:** Can an operator log presentation reports and notes while completely offline, have them safely quarantined in browser IndexedDB, and reconcile them explicitly upon reconnect without mutating live server state?
- **Minimal Implementation:**
  - Lightweight web page with IndexedDB wrapper (`idb`).
  - Toggle browser to offline mode (`navigator.onLine = false`).
  - Log 3 quick reports ("Presenting M01", "Presenting M02", "Note: Host changed outfit").
  - Restore connection; simulate a scenario where the live session was ended by another operator while this client was offline.
- **Success Criteria:**
  - Offline entries are unmistakably labeled `UNSYNCED DRAFT`.
  - Reconnecting does NOT automatically send requests to the server.
  - Client queries server, discovers session is ended, flags that live state cannot be changed, and presents a reconciliation modal allowing the operator to convert the drafts into historical post-session notes.
- **Time / Complexity:** 1 Day / Medium.
- **Decision It Unlocks:** Validates the safety and UX of the conservative offline policy, preventing accidental corruptions of live broadcasts.

#### Spike 4: Dual-Perspective Semantic Replay Query Performance (SPK-04)
- **Core Question:** Can standard PostgreSQL 16 indexes query both "As Known Then" and "With Later Evidence" timelines across 5,000 operational events in under 10 milliseconds without pre-computed summary tables?
- **Minimal Implementation:**
  - Seed a PostgreSQL test table with 10,000 synthetic operational events across 2 live sessions with random `occurred_at` and `recorded_at` timestamps (simulating 500 delayed analytics arrivals).
  - Write two SQL queries:
    - Query A (As Known Then): `WHERE session_id = :id AND recorded_at <= :t_replay`
    - Query B (With Later Evidence): `WHERE session_id = :id AND occurred_at <= :t_replay`
  - Measure execution latency using `EXPLAIN ANALYZE`.
- **Success Criteria:**
  - Both queries execute in $< 8$ ms using composite B-tree index `idx_events_session_recorded_ts (session_id, recorded_at, occurred_at)`.
- **Time / Complexity:** 0.5 Day / Low.
- **Decision It Unlocks:** Confirms that LiveLift does NOT need complex event-sourcing frameworks, Timescale hypertables, or ClickHouse for semantic operational replay.

#### Spike 5: High-Frequency Event Rendering & DOM Throttling (SPK-05)
- **Core Question:** Can the Next.js React 18 frontend handle an incoming burst of 5,000 live chat comments per minute without freezing the browser main thread, dropping frames, or delaying the 5-second NOW/NEXT operator command response?
- **Minimal Implementation:**
  - A mock script pushing 100 comment events per second over SSE.
  - A React 18 component using a circular memory buffer (retaining latest 100 comments) and `requestAnimationFrame` / `useDeferredValue` for rendering.
  - Measure main-thread frame rate and click response latency using Chrome DevTools Performance Profiler.
- **Success Criteria:**
  - Main thread frame rate remains $> 55$ FPS.
  - Clicking the "Start Segment" button responds within $< 50$ ms even while the comment stream is bursting at peak load.
- **Time / Complexity:** 0.5 Day / Low-Medium.
- **Decision It Unlocks:** Confirms the UI throttling pattern required to protect operator responsiveness during viral broadcast spikes.

#### Spike 6: Two-Operator Authority Lock & Control Takeover (SPK-06)
- **Core Question:** Does the backend fail-closed when two browser windows attempt simultaneous conflicting segment transitions, and does the explicit control takeover protocol transfer authority cleanly?
- **Minimal Implementation:**
  - Open two browser tabs (Tab A = Lead, Tab B = Assistant).
  - FastAPI endpoint enforcing `lead_operator_id`.
  - Simulate Tab B attempting `POST /commands/start_segment` (assert rejection).
  - Simulate Tab B executing `POST /commands/takeover_control`.
- **Success Criteria:**
  - Tab B's initial transition attempt is rejected with HTTP 409 Conflict.
  - Following the takeover confirmation, Tab B receives the transition token, Tab A's screen is locked with an authoritative notice ("Control taken over by Assistant"), and the audit event is persisted.
- **Time / Complexity:** 0.5 Day / Low.
- **Decision It Unlocks:** Establishes the multi-operator coordination contract before full frontend integration.
