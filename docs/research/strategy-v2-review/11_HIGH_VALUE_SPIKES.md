# LiveLift Strategy Review & Independent Product Evaluation
## 11 — High-Value Technical & Operational Spikes

**Evaluator:** Independent Principal Technical Architect & Systems Researcher  
**Date:** October 4, 2026  
**Focus:** Targeted Empirical Tests to Resolve Strategic Unknowns Before Full Implementation  

---

### 1. High-Value Spike Inventory

```
+--------------------------------------------------------------------------------------------------+
|                                    TECHNICAL SPIKE OVERVIEW                                      |
+----------+--------------------------------------------------+---------------+--------------------+
| SPIKE ID | STRATEGIC UNKNOWN                                | TIME / EFFORT | TARGET AREA        |
+----------+--------------------------------------------------+---------------+--------------------+
| **SPK-01** | Official TikTok Seller OAuth & Scope Approval    | 1–2 Days      | Platform Partner   |
| **SPK-02** | Post-Live Minute Performance Physical Latency    | 1 Day         | Analytics Ingest   |
| **SPK-03** | Dynamic Downstream Cascade Timing Calculation    | 0.5 Day       | Rundown Core       |
| **SPK-04** | 3-Minute Plan Variance & 1-Click Clone Diff Join | 0.5 Day       | Post-Live Review   |
| **SPK-05** | Dual-Monitor Sidecar Usability & Eye-Dart Test   | 1 Day         | Operator Ergonomics|
+----------+--------------------------------------------------+---------------+--------------------+
```

---

### 2. Detailed Spike Specifications

#### Spike 1: Official TikTok Seller OAuth & Scope Approval (SPK-01)
- **Question:** Can a standard registered Vietnamese SME seller account authorize an unpublished partner app and grant `data.shop_analytics.public.read` without an assigned ByteDance Account Manager?
- **Why It Matters:** Determines whether the official TikTok Shop post-live integration can be self-served by SME merchants on Day 1, or if it is strictly restricted to enterprise agency retainers.
- **Minimal Test:** Register a test developer account in the TikTok Shop Partner Center; initiate OAuth authorization flow using a real Vietnamese test shop; assert whether token generation succeeds for analytics scopes.
- **Success Criterion:** OAuth token successfully generated with `data.shop_analytics.public.read` granted.
- **Failure Outcome & Fallback:** If ByteDance blocks approval without an Account Manager, LiveLift immediately activates **Fallback Plan A**: Provide a 1-click CSV import parser for the standard Seller Center "Phân tích LIVE" exported file.
- **Decision Unlocked:** Governs whether Phase 3 builds an automated OAuth sync or a CSV import workflow.

#### Spike 2: Post-Live Minute Performance Physical Latency (SPK-02)
- **Question:** What is the physical delay between the moment a live stream ends on TikTok and when `GET /analytics/202510/shop_lives/{live_id}/performance_per_minutes` returns valid non-empty minute intervals?
- **Why It Matters:** Determines whether the post-live variance card can reconcile platform sales data immediately during the Wrap stage, or if it must remain in a `pending_audit` state.
- **Minimal Test:** Complete a 15-minute test broadcast on a live TikTok account. Call the endpoint every 5 minutes post-broadcast and log the timestamp of data availability.
- **Success Criterion:** Data becomes available within $< 45$ minutes of broadcast termination.
- **Failure Outcome & Fallback:** If latency exceeds 2 hours, the Wrap workspace displays the operational rundown variance immediately and schedules a background webhook/poller to attach financial metrics when ready.
- **Decision Unlocked:** Dictates whether Review reconciliation is synchronous or asynchronous.

#### Spike 3: Dynamic Downstream Cascade Timing Engine (SPK-03)
- **Question:** Can the Run of Show state machine recalculate downstream projected start times and segment drifts across 30 segments in $< 2$ milliseconds in Python and TypeScript?
- **Why It Matters:** This is the core operational feature that beats static Google Sheets during live broadcasts.
- **Minimal Test:** Implement a pure function `calculate_rundown_cascade(plan: RunOfShow, actuals: list[SegmentActual])` and benchmark execution across 1,000 runs.
- **Success Criterion:** Execution time is $< 1$ millisecond; downstream times adjust instantly when an overrun is injected.
- **Failure Outcome & Fallback:** None; pure deterministic arithmetic.
- **Decision Unlocked:** Proves the core runtime calculation for Phase 1.

#### Spike 4: 3-Minute Plan Variance & 1-Click Clone Diff Join (SPK-04)
- **Question:** Can the backend automatically generate concrete recommended duration mutations from plan vs actual variance (e.g. `actual > planned + 2m -> recommend plan + 1m`) and clone them cleanly into a new session plan?
- **Why It Matters:** Validates the core 1-click cross-session learning loop that creates the workflow moat.
- **Minimal Test:** Feed an executed session fixture with 3 overrunning segments into `generate_playbook_adjustments()`; assert that cloned session incorporates duration adjustments with valid provenance links.
- **Success Criterion:** Valid new session generated with zero data contamination of the originating session.
- **Failure Outcome & Fallback:** If automated adjustment rules are too aggressive, fall back to displaying the variance and prompting the operator with a simple duration slider.
- **Decision Unlocked:** Finalizes the Review $\rightarrow$ Next Live interaction model.

#### Spike 5: Dual-Monitor Sidecar Usability & Eye-Dart Test (SPK-05)
- **Question:** Does an operator running TikTok LIVE Manager on Monitor 1 and LiveLift on Monitor 2 experience cognitive overload, or does LiveLift measurably improve pacing?
- **Why It Matters:** Verifies that LiveLift is actually superior to a printed clipboard under real broadcast stress.
- **Minimal Test:** Run a simulated 30-minute broadcast rehearsal with a live assistant using two 1080p monitors. Track how quickly the assistant responds to segment overrun warnings.
- **Success Criterion:** Assistant notices overruns within 5 seconds without missing product pin transitions in TikTok LIVE Manager.
- **Failure Outcome & Fallback:** If eye-dart between screens is excessive, implement optional audio chimes ("30 seconds remaining in segment") in LiveLift Control.
- **Decision Unlocked:** Refines font sizes, audio alert settings, and high-contrast styling for the OPERATE workspace.
