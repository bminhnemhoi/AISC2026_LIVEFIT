# LiveLift Strategic Research & Architecture Synthesis
## 09 — Test Strategy, Quality Gates & Deterministic Simulator

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Focus:** Layered Verification Pyramid, High-Value Quality Gates, and Scenario-Driven Simulation  
**Reference Standards:** `HARNESS.md`, `tests/test_kho_chet_giua_phien.py`, `tests/test_actions_scoping.py`  

---

### 1. The Quality Pyramid: High-Value vs Wasteful Testing

The legacy repository achieved over 2,100 automated tests. However, maintaining hundreds of fragile UI snapshots or repetitive database mocks creates friction without improving system reliability.

LiveLift-next standardizes on a **disciplined five-tier testing pyramid** focused strictly on **invariants, state transitions, and failure resilience**:

```
                                  / \
                                 /   \
                                / E2E \       <-- Tier 5: Playwright Golden Path (5-10 tests)
                               /-------\
                              / Visual  \     <-- Tier 4: Canonical Viewport Checks (1280x720)
                             /-----------\
                            / Integration \   <-- Tier 3: Realtime Reconnect & DB Store Tests
                           /---------------\
                          / Contract Tests  \ <-- Tier 2: Zod / Pydantic Schema Compatibility
                         /-------------------\
                        / Pure Domain Logic   \ <-- Tier 1: Invariants, Assigner, PII, Click Rules
                       /-----------------------\
```

#### 1.1 What to Test (High-Value Invariants)
- **State Transition Legality:** Asserting that invalid transitions fail closed (e.g., cannot start segment when session is ended; cannot end an un-started session).
- **Exact Action Scoping:** Asserting that commands target exact entity UUIDs and matching revisions, failing if card order shifts.
- **Storage Outage Visibility:** Asserting that when the database fails, the API raises explicit degraded health states rather than returning empty arrays or zeros.
- **Bitemporal Replay Faithfulness:** Asserting that "As Known Then" queries never leak records timestamped after the query horizon.
- **Offline Draft Quarantine:** Asserting that unsynced drafts never alter live server runtime state automatically upon reconnect.
- **PII Scrubbing Precision:** Asserting $\ge 95\%$ recall on Vietnamese phone numbers, addresses, and identity codes before database write.

#### 1.2 What NOT to Test (Low-Value Maintenance Waste)
- **Markup / DOM Snapshots:** Fragile tests that break whenever a CSS padding class or HTML wrapper div changes.
- **Third-Party Library Mechanics:** Testing whether React renders a button, or whether TanStack Query caches data.
- **Speculative Edge Cases:** Writing hundreds of tests for theoretical network combinations that do not correspond to known incident modes.

---

### 2. Layered Testing Architecture

| Tier | Focus Area | Technology | Execution Time | Gate Condition |
|---|---|---|---|---|
| **Tier 1: Domain Units** | Pure functions: PII filter, click validity, temporal projection, ROS duration math | `pytest` / `vitest` | $< 5$ seconds | 100% Pass; blocks pre-commit |
| **Tier 2: Contracts** | JSON schema equivalence between FastAPI Pydantic v2 and Next.js Zod | TypeScript schema test runner | $< 3$ seconds | Fails if API contract drifts |
| **Tier 3: API & Store** | FastAPI endpoints against real PostgreSQL container; transactional rollback | `pytest` + `testcontainers` | $< 25$ seconds | 100% Pass; CI pull request gate |
| **Tier 4: Visual Baselines** | Viewport rendering at 1280×720 and 1440×900; zero horizontal scroll; no obscured buttons | Playwright Visual Match | $< 45$ seconds | Fails if NOW/NEXT hidden at 1280×720 |
| **Tier 5: Golden Path E2E**| Complete loop: Create $\rightarrow$ Prepare $\rightarrow$ Start $\rightarrow$ Transition $\rightarrow$ Wrap $\rightarrow$ Replay | Playwright Browser E2E | $< 90$ seconds | Must pass before staging cutover |

---

### 3. Deterministic Simulator Architecture

The simulator is not an afterthought; it is a **mission-critical development, demonstration, and automated testing instrument**.

```
+--------------------------------------------------------------------------------------------------+
|                                DETERMINISTIC SIMULATOR ENGINE                                    |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
| [1. VIRTUAL CLOCK]    Controls time passage deterministically: advance_by(seconds), pause(),     |
|                       set_speed(1x, 5x, 20x). Independent of real wall-clock time.               |
|                                                                                                  |
| [2. SCENARIO SCRIPT]  Structured JSON fixture containing scheduled sequence of external events:  |
|                       * Minute 01: Host starts broadcast; baseline viewer count = 45             |
|                       * Minute 03: Algorithmic viewer burst (+180 viewers)                       |
|                       * Minute 05: Influx of 12 sizing questions for M03 in chat                 |
|                       * Minute 07: Injected network drop (30s disconnect)                        |
|                       * Minute 12: External platform pin verification returns HTTP 500           |
|                                                                                                  |
| [3. SIM ADAPTER]      SimulatorCapabilityAdapter emits normalized events tagged with:            |
|                       evidence_class = 'SIMULATED', provenance = 'simulator'                     |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

#### 3.1 Strict Simulation Isolation Rules
1. **Immutable Environment Flag:** Sessions created under simulation receive `environment: 'SIMULATED'` and `is_demo: true`.
2. **Schema & API Enforcement:** Database constraints prevent simulated sessions from being aggregated into seller production analytics.
3. **Unmistakable Visual Identity:** The UI header displays a persistent, functional SIMULATED indicator. Simulated evidence carries an amber flask icon.
4. **Never an Automatic Fallback:** If a real livestream loses its TikTok connection, LiveLift falls back to **MANUAL OPERATION**, NEVER to the simulator. Simulation is activated exclusively via intentional, explicit operator choice.

---

### 4. Canonical Scenario Fixture Suite

LiveLift standardizes on four core scenario fixtures stored in `tests/data/scenarios/`:

```
tests/data/scenarios/
├── 01_golden_run.json          # Perfect 60-min broadcast; 5 products; smooth transitions
├── 02_provider_outage.json     # TikTok API disconnects at min 15; manual desk takes over
├── 03_high_traffic_burst.json  # 5,000 comments/min burst; tests DOM throttling and UI rendering
└── 04_reconnect_reconcile.json # Wi-Fi cut for 2 mins; operator logs drafts; reconnect sync
```

#### Example Scenario Definition (`02_provider_outage.json`):
```json
{
  "scenario_id": "sim_outage_02",
  "title": "Provider Outage & Manual Fallback Rehearsal",
  "initial_state": {
    "session_title": "Friday Evening Flash Sale (Rehearsal)",
    "environment": "SIMULATED",
    "products_count": 6
  },
  "timeline_events": [
    {
      "offset_seconds": 0,
      "event_type": "SESSION_START",
      "payload": { "operator": "lead_op" }
    },
    {
      "offset_seconds": 180,
      "event_type": "SEGMENT_TRANSITION",
      "payload": { "target_product_id": "M01" }
    },
    {
      "offset_seconds": 300,
      "event_type": "FAULT_INJECTION",
      "payload": {
        "fault_type": "PROVIDER_DISCONNECT",
        "target_provider": "tiktok_shop",
        "duration_seconds": 600
      }
    },
    {
      "offset_seconds": 310,
      "event_type": "ASSERTION_CHECK",
      "expected_state": {
        "capabilities.catalog_read.state": "UNAVAILABLE",
        "capabilities.manual_operating_desk.state": "AVAILABLE",
        "now_panel.notice": "Provider disconnected. Manual operation active."
      }
    }
  ]
}
```

---

### 5. Automated CI Quality Gates

Every code change submitted to the repository must satisfy these non-negotiable gates:

1. **Gate 1: Static Hygiene:** `ruff check .`, `ruff format --check .`, `mypy src/livelift`, and TypeScript strict compilation (`tsc --noEmit`) with 0 errors.
2. **Gate 2: Isolation Verification:** `python scripts/check_isolation.py` confirms zero imports from `src/` into `collectors/tiktok_public`.
3. **Gate 3: PII Recall Barrier:** Test suite validates $\ge 95\%$ recall across all phone, address, and ID test fixtures.
4. **Gate 4: Storage Failure Test:** `pytest tests/test_kho_chet_giua_phien.py` confirms that simulated database termination surfaces visible degradation alerts and causes no silent data corruption.
5. **Gate 5: Golden Path Simulation:** Headless Playwright script executes `01_golden_run.json` from Prepare to Review in $<60$ seconds.
