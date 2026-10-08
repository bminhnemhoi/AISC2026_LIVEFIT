# LiveLift Strategy Review & Independent Product Evaluation
## 13 — Recommended Immediate Engineering & Product Next Actions

**Evaluator:** Independent Principal Product Strategist & Technical Architect  
**Date:** October 4, 2026  
**Status:** Actionable Transition Plan for Immediate Execution  

---

### 1. Immediate Actions While Phase A Frontend Completes (Parallel Safety)

While the frontend coding agent completes the initial `/next` implementation, the strategic and backend team should execute the following zero-risk preparation tasks:

```
+--------------------------------------------------------------------------------------------------+
|                              IMMEDIATE PARALLEL ACTION CHECKLIST                                 |
+--------------------------------------------------------------------------------------------------+
| [x] Complete Independent Strategy Review (docs/research/strategy-v2-review/**)                   |
| [ ] Lock Strategic Pivot: Formally adopt Option B (Commerce Run-of-Show Desk).                   |
| [ ] Register TikTok Partner Center Developer Account (Initiate Spike 1 approval test).           |
| [ ] Prepare Python Dynamic Cascade Timing Prototype (Spike 3: calculate_rundown_cascade).        |
| [ ] Ensure strict Git isolation: Zero commits to next/**, web/**, or src/** during review.       |
+--------------------------------------------------------------------------------------------------+
```

---

### 2. Immediate Handoff Plan: Transition from Phase A to Major Phase 1

As soon as the frontend agent signals completion of Phase A (frontend foundations, routes, and UI contracts under `/next`):

#### Step 1: Perform Frontend Contract Freeze & Review
1. Inspect `next/src/contracts/` (or `next/src/types/`).
2. Verify that the TypeScript interfaces represent the revised Option B priorities:
   - `RunOfShowPlan` with `Segment` (title, target duration, cues, linked SKUs).
   - `Session` with `status`, `environment`, and `revision`.
   - `OperatorCommand` with `expected_revision` and `idempotency_key`.
3. Apply the screen-by-screen refinements from `06_KEEP_CHANGE_REMOVE_UI.md`:
   - Ensure the Rundown is the dominant working surface in Prepare and Operate.
   - Confirm that vanity macro KPI cards are removed from the live desk.

#### Step 2: Launch Major Phase 1 (Backend Core & Session Runtime)
Provide the backend agent with the master specification from `docs/research/antigravity/15_RECOMMENDED_NEXT_PROMPT.md`, updated with the Option B strategic refinements:
- Refactor `store.py` into clean `SessionRepository` and `PlanRepository`.
- Implement dynamic cascade timing arithmetic.
- Build authoritative session lifecycle endpoints.
- Enforce monotonic revisions and idempotency keys.

#### Step 3: Execute Verification Gates
Run the non-negotiable verification suite before declaring Phase 1 complete:
```bash
# 1. Static typing and formatting
ruff check . && ruff format --check . && mypy src/livelift

# 2. Domain lifecycle invariants
pytest tests/test_vong_doi_phien.py

# 3. Action scoping invariants
pytest tests/test_actions_scoping.py

# 4. Storage degradation resilience
pytest tests/test_kho_chet_giua_phien.py

# 5. Golden path backend rehearsal script
python scripts/verify_golden_path_backend.py
```

---

### 3. Summary of Core Product Commitments

1. **We will not compete with TikTok LIVE Manager.** We live beside it on the second monitor as the smart rundown and operations desk.
2. **We will not build an academic evidence ledger.** We build a practical, high-speed Commerce Run-of-Show that eliminates chaotic Google Sheets and Zalo messages.
3. **We will not promise automated TikTok pinning.** We provide 1-click manual transition logging and plan-based cues that keep the team on schedule.
4. **We will not force merchants into broken switchback experiments.** We provide a 3-minute post-live plan variance card that generates an auto-adjusted plan for tomorrow's live broadcast.
