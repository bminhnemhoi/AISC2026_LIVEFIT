# LiveLift Strategic Research & Architecture Synthesis
## 10 — Technology Decision Matrix & Architectural Tradeoffs

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Scope:** Architectural Evaluation of 13 Core Technology Axes  
**Guiding Principle:** "Kill accidental complexity; choose boring, proven technology."  

---

### Decision 1: Realtime Transport

- **Options Considered:** (A) Full WebSocket, (B) Server-Sent Events (SSE) + REST, (C) Short Polling (1–2s), (D) Long Polling.
- **Pros & Cons:**
  - *WebSocket:* Bidirectional, low latency; but fragile through corporate firewalls, complex reconnection state machine, non-standard HTTP caching.
  - *SSE + REST:* Native browser reconnection (`EventSource`), standard HTTP/2 streaming, simple proxy traversal; but unidirectional (client sends commands via REST).
  - *Polling:* Simple, stateless; but high server load, poor latency for 5-second operational loop.
- **Project Fit:** LiveLift commands require strict transactional idempotency and revision checks (natural fit for REST `POST`). Downstream state updates are broadcast from server to client (natural fit for SSE).
- **RECOMMENDATION: Hybrid REST Commands + SSE State Stream.** Use SSE for downstream broadcast and standard HTTP `POST` for commands.
- **When to Revisit:** If LiveLift adds peer-to-peer operator audio/video communication or ultra-high-frequency mouse cursor presence.

---

### Decision 2: Client Server-State Management

- **Options Considered:** (A) TanStack Query (React Query), (B) SWR, (C) Plain `fetch` with `useEffect`.
- **Pros & Cons:**
  - *TanStack Query:* Comprehensive query caching, background refetching, mutation lifecycle hooks, query invalidation, deduplication; but ~13kB bundle size.
  - *SWR:* Lightweight; but less robust mutation and optimistic update ergonomics.
  - *Plain fetch:* Zero dependencies; but leads to reinvention of caching, race conditions, and unmount leak bugs.
- **Project Fit:** The operator desk demands flawless cache invalidation when switching sessions, background refetching on window focus, and robust mutation states (`isPending`, `isError`).
- **RECOMMENDATION: TanStack Query v5.** Industry standard for server-state synchronization.
- **When to Revisit:** Never; perfectly suited for React 18 / Next.js 14 client boundaries.

---

### Decision 3: Client Local State Management

- **Options Considered:** (A) Local Workspace Reducers (`useReducer`), (B) Zustand, (C) Redux Toolkit.
- **Pros & Cons:**
  - *Local Reducers:* Zero dependencies, strictly scoped to page lifecycle, prevents cross-workspace state contamination; requires prop passing or local React context.
  - *Zustand:* Minimal global store, hook-based; but risks state lingering across route transitions if not explicitly reset.
  - *Redux Toolkit:* Heavy boilerplate, excessive ceremony for a single-operator desk.
- **Project Fit:** Server state is already managed by TanStack Query. Local UI state (e.g. which tab is active in the supporting region, inline text input) should stay local to the workspace.
- **RECOMMENDATION: Local Workspace Reducers (`useReducer` + Local Context).** Keep UI state scoped to the active workspace. Avoid global singletons.
- **When to Revisit:** If cross-workspace background audio or multi-window floating panels are introduced in P1.

---

### Decision 4: Evidence Persistence Model

- **Options Considered:** (A) Mutable Relational Rows (`UPDATE live_session SET current_product = 'M03'`), (B) Pure Event Sourcing (Event Store with full state replay), (C) Append-Only Evidence Ledger with Materialized Snapshots.
- **Pros & Cons:**
  - *Mutable Rows:* Easy CRUD; but destroys historical provenance, makes "As Known Then" replay impossible, vulnerable to race conditions.
  - *Pure Event Sourcing:* Complete audit trail; but immense operational complexity, versioning migrations are painful, snapshotting overhead.
  - *Append-Only Evidence + Materialized Snapshots:* Session state is materialized for fast O(1) reads; all operational facts, decisions, and observations append immutable records to evidence tables.
- **Project Fit:** Solves the core product requirement: maintaining an unforgeable operational ledger while delivering sub-10ms desk state queries.
- **RECOMMENDATION: Append-Only Evidence Ledger with Materialized Snapshots.**
- **When to Revisit:** Never; this is a permanent foundational invariant.

---

### Decision 5: Historical Replay Architecture

- **Options Considered:** (A) Replay Derived from Raw Logs on the Fly, (B) Dedicated Materialized Timeline Table, (C) Hybrid Bitemporal Query Engine.
- **Pros & Cons:**
  - *Raw Logs:* Requires recalculating state across thousands of rows on every replay scrub; slow.
  - *Dedicated Timeline Table:* Rigid; cannot easily reconstruct "As Known Then" vs "With Later Evidence" dynamically.
  - *Hybrid Bitemporal Query Engine:* Indexes events by `(session_id, recorded_at, occurred_at)`. Allows querying time slices with fast B-tree index scans.
- **Project Fit:** Live sessions average 1,000–5,000 operational events over 90 minutes. PostgreSQL indexes can filter this volume in $<5$ms without pre-materialization.
- **RECOMMENDATION: Hybrid Bitemporal Query Engine on PostgreSQL.** Query directly using indexed timestamp bounds.
- **When to Revisit:** If single sessions exceed 500,000 events (e.g., millions of unfiltered chat comments).

---

### Decision 6: Offline Draft Storage

- **Options Considered:** (A) Browser `IndexedDB`, (B) `localStorage`, (C) In-Memory Only (No Offline Persistence).
- **Pros & Cons:**
  - *IndexedDB:* Asynchronous, durable, structured key-value storage, handles megabytes of draft text and timestamps without blocking the main UI thread.
  - *localStorage:* Synchronous (blocks UI thread on write), 5MB limit, prone to serialization errors.
  - *In-Memory Only:* Discarding notes when Wi-Fi drops causes operator frustration and data loss.
- **Project Fit:** Operators must be able to log notes and draft presentation reports during network outages without losing work on accidental page reload.
- **RECOMMENDATION: Browser IndexedDB (via `idb` wrapper).**
- **When to Revisit:** Never; standard Web API for local storage.

---

### Decision 7: Schema Validation & Typing

- **Options Considered:** (A) Zod (Frontend) + Pydantic v2 (Backend), (B) TypeScript Interfaces Only (No Runtime Validation), (C) Protocol Buffers / gRPC.
- **Pros & Cons:**
  - *Zod + Pydantic v2:* Strict runtime validation on both ends; automated schema generation; protects against malformed API payloads.
  - *TypeScript Only:* Zero runtime protection; silent type mismatches crash React components.
  - *Protobuf/gRPC:* Fast; but introduces heavy compiler toolchains, poor debugging ergonomics in browser devtools.
- **Project Fit:** The domain demands that malformed platform signals or corrupted client states fail closed immediately with descriptive validation errors.
- **RECOMMENDATION: Zod (Frontend) + Pydantic v2 (Backend).** Generate TypeScript types or Zod schemas from backend OpenAPI JSON.
- **When to Revisit:** Never.

---

### Decision 8: External Provider Architecture

- **Options Considered:** (A) Monolithic Platform Conditional Switch (`if platform == 'tiktok'`), (B) Capability-Based Adapter Interfaces.
- **Pros & Cons:**
  - *Platform Switch:* Rapid to write initially; but tightly couples core logic to external quirks, breaks when capabilities differ.
  - *Capability Adapters:* Clean domain boundary; system degrades gracefully when individual capabilities fail; facilitates deterministic simulation.
- **Project Fit:** LiveLift must run manual-first while incorporating diverse external platforms (TikTok, Shopee, Simulator).
- **RECOMMENDATION: Capability-Based Adapter Interfaces.**
- **When to Revisit:** Never; core architectural principle.

---

### Decision 9: Backend Framework Strategy

- **Options Considered:** (A) Incremental Evolution of Existing FastAPI Backend, (B) Complete Rewrite in Go or Node.js, (C) Django / Ruby on Rails.
- **Pros & Cons:**
  - *FastAPI Evolution:* Preserves existing high-value HMAC clients, PII filters, and statistical engines; asynchronous I/O; fast execution.
  - *Go/Node Rewrite:* Discards over 2,000 verified tests and working platform integration modules; massive waiting time and rework risk.
  - *Django:* Heavy ORM overhead; unsuited for lightweight asynchronous SSE streaming.
- **Project Fit:** The existing FastAPI codebase is well-structured, clean, and robust. Refactoring `store.py` into domain repositories gives all the benefits of clean architecture at a fraction of the cost.
- **RECOMMENDATION: Incremental Evolution of Existing FastAPI Backend.**
- **When to Revisit:** If single-server WebSocket/SSE concurrency demands exceed 50,000 simultaneous connections (not applicable to the target live desk model).

---

### Decision 10: Database Engine

- **Options Considered:** (A) PostgreSQL 16 (Relational + JSONB), (B) TimescaleDB Hypertables, (C) ClickHouse, (D) SQLite.
- **Pros & Cons:**
  - *PostgreSQL 16:* ACID compliance, proven JSONB indexing, rock-solid stability, zero external dependency overhead.
  - *TimescaleDB:* Useful for billion-row IoT time series; excessive overhead for live commerce sessions (<50k rows/session).
  - *ClickHouse:* Phenomenal for petabyte-scale analytics; totally unsuited for low-latency transactional session state machines.
  - *SQLite:* Lacks concurrent write locks required for multi-operator desks.
- **Project Fit:** Standard PostgreSQL 16 easily handles LiveLift's transactional state and append-only evidence. Hypertables were speculative complexity in legacy.
- **RECOMMENDATION: Standard PostgreSQL 16.** Remove mandatory TimescaleDB hypertable requirement. Use standard B-tree and GIN indexes.
- **When to Revisit:** If aggregate historical multi-year analytics across 10,000+ shops require columnar compression.

---

### Decision 11: Event Bus & Ingestion Pipeline

- **Options Considered:** (A) PostgreSQL Append-Only Event Table with Listen/Notify, (B) Redis Streams, (C) Apache Kafka, (D) RabbitMQ.
- **Pros & Cons:**
  - *PostgreSQL Table:* Single transactional boundary, immediate consistency, zero additional operational infrastructure to monitor.
  - *Redis Streams:* Fast; but introduces a second datastore that can fall out of sync with Postgres during network partitions.
  - *Kafka:* Extreme operational complexity, JVM overhead, completely unjustified for single-desk operational events.
- **Project Fit:** Livestream event volume per room is 10–200 events/second during peak bursts. PostgreSQL easily handles thousands of writes per second on modest VPS hardware.
- **RECOMMENDATION: PostgreSQL Append-Only Event Table with Listen/Notify.** Keep the architecture single-datastore.
- **When to Revisit:** If LiveLift transitions into a multi-tenant platform aggregating live chat for 1,000 simultaneous rooms.

---

### Decision 12: Data Visualization & Charting

- **Options Considered:** (A) Custom Lightweight SVG / Canvas, (B) Recharts, (C) Chart.js, (D) Apache ECharts.
- **Pros & Cons:**
  - *Custom SVG/Canvas:* Maximum control, zero heavy bundle overhead, pixel-perfect alignment with LiveLift Control tokens; requires custom math.
  - *Recharts:* React-native, good declarative API; already in legacy dependencies; but can suffer rendering lag with >1,000 points.
  - *ECharts:* Feature-rich; but very large bundle size (>500kB), difficult to style to dark sage tokens.
- **Project Fit:** REVIEW workspace requires an aligned operational timeline (segments, recommendations, actions, gaps) rather than generic business line charts.
- **RECOMMENDATION: Hybrid Approach.** Use custom lightweight SVG for the semantic operational timeline; use Recharts only for macro-metric window summaries.
- **When to Revisit:** If advanced financial candlestick or high-frequency tick charts are required.

---

### Decision 13: Automated Testing Framework

- **Options Considered:** (A) Pytest (Backend) + Vitest / React Testing Library (Frontend) + Playwright (E2E), (B) Jest + Cypress, (C) Selenium.
- **Pros & Cons:**
  - *Pytest + Vitest + Playwright:* Extremely fast execution, native ESM support, robust headless browser automation, excellent async support.
  - *Jest + Cypress:* Slower; Cypress is heavier and less reliable for multi-tab or WebSocket testing.
- **Project Fit:** The codebase already uses Pytest and Playwright. Vitest provides seamless compatibility with Next.js 14 and Vite tooling.
- **RECOMMENDATION: Pytest + Vitest + Playwright.**
- **When to Revisit:** Never; modern standard stack.
