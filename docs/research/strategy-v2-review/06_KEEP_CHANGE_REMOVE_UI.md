# LiveLift Strategy Review & Independent Product Evaluation
## 06 — Frontend Screen-by-Screen Keep / Change / Remove Matrix

**Evaluator:** Independent Principal Product Strategist & UX Reviewer  
**Date:** October 4, 2026  
**Target:** Phase A Frontend Architecture (`/next`) & Canonical Kombai Baselines  
**Guiding Principle:** "If a panel merely duplicates TikTok, remove it. If it empowers live orchestration and cross-session iteration, amplify it."  

---

### 1. Screen-by-Screen Decision Matrix

| Workspace / Screen | Strategic Verdict | Operational Reason & Required Adjustment | Priority |
|---|---|---|:---:|
| **HOME (`/`)** | **KEEP BUT MODIFY** | Retain task-focused layout ("Continue active LIVE", "Create LIVE"). **MODIFY:** Remove any residual vanity KPI counters; prominently display "Last session's unapplied changes" and "Upcoming planned rundowns". | **P0** |
| **CREATE LIVE (`/live/new`)** | **KEEP** | Lightweight single-page creation form (Title, Schedule, Clone from previous session). Clean, fast, zero unnecessary wizard ceremony. | **P0** |
| **PREPARE (`/live/:id/prepare`)**| **KEEP BUT MODIFY** | **DOMINANT RUN OF SHOW:** Strengthen the Rundown as the primary 70% width working surface. **DEMOTE:** Shrink the Product Pack into a compact reference sidebar; remove heavy ecommerce PIM catalog features (TikTok already manages the master catalog). | **P0** |
| **OPERATE (`/live/:id/operate`)**| **KEEP BUT MODIFY** | **AMPLIFY NOW/NEXT/WHY:** The 5-second command band is the core operational hook. **AMPLIFY RUNDOWN:** The Run of Show must show real-time dynamic cascade drift (if segment 1 runs +4 mins late, all future segment clocks adjust). **REMOVE:** Purge Live Pulse KPI charts and raw comment radar. Keep supporting tab strictly for Queue and Notes. | **P0** |
| **WRAP (`/live/:id/wrap`)** | **KEEP** | Excellent short transition desk. Confirms runtime freeze, displays session duration, checks for offline unsynced drafts, and routes directly to Review. | **P0** |
| **REVIEW (`/live/:id/review`)** | **REDESIGN EMPHASIS**| **PIVOT FROM SCRUBBER TO 3-MINUTE DELTA SUMMARY:** Instead of opening with an overwhelming second-by-second timeline scrubber, open with an **Executive Plan vs Actual Variance Card** (Planned duration vs actual duration, overrun segments, cues missed). Keep the timeline inspector accessible on-demand as a drill-down tab. | **P0** |
| **LEARN (`/live/:id/review?view=learn`)**| **MERGE & SIMPLIFY** | **MERGE DIRECTLY INTO REVIEW:** Do not treat Learn as a separate abstract destination. Convert post-session variance directly into **"Next LIVE Adjustments"** (e.g. `[x] Reduce M03 planned duration to 6 mins`). | **P0** |
| **SESSIONS (`/sessions`)** | **KEEP** | Clean operational list of planned, live, ended, and archived sessions. Displays REAL vs SIMULATED environment identity cleanly. | **P0** |
| **PRODUCTS & PACKS (`/products`)** | **DEMOTE TO MINIMAL** | Do not build a heavy enterprise Product Information Management (PIM) tool. Provide simple CSV/paste import and reusable product bundles to feed into the Run of Show. | **P0** |
| **INTEGRATIONS (`/integrations`)** | **KEEP BUT MODIFY** | Render capability status tiles (`AVAILABLE`, `UNSUPPORTED`, `UNAVAILABLE`) rather than a simple binary "Connected" switch. Clearly explain that LiveLift operates 100% manually without integrations. | **P0** |
| **SIMULATOR (`/simulator`)** | **KEEP** | Essential for rehearsals, team training, and bulletproof demo presentations. Must retain persistent `SIMULATED` badge. | **P0** |

---

### 2. Detailed Panel-Level Refinements for OPERATE

The OPERATE desk is the mission-critical runtime surface. It must be optimized for maximum situational awareness on standard 1280×720 and 1440×900 laptop displays:

```
+--------------------------------------------------------------------------------------------------+
|                            OPTIMIZED OPERATE WORKSPACE (1280x720)                                |
+--------------------------------------------------------------------------------------------------+
| [FOCUSED HEADER]  Session: Friday Essentials · LIVE · 00:42:15 · Lead: Op A · [ End LIVE ]       |
+---------------------------------------------------+----------------------------------------------+
| [NOW PANEL (44% Width)]                           | [NEXT & ACTION PANEL (56% Width)]            |
| * Current: Segment 3 — M03 Cargo Pants            | * Proposing: Segment 4 — Flash Sale Voucher  |
| * Presenting: M03 Cargo Pants (Operator Report)   | * Target Time: In 02:45 (Planned: 00:45:00)  |
| * Elapsed: 04:15 / Target: 06:00 (Overrun: 00:00) | * WHY: Plan sequence; scheduled voucher drop |
| * Platform Pin: UNKNOWN (Manual Desk Active)      | * Missing: Engagement signals unavailable    |
| [ +1 Min ]  [ Hold ]  [ Report Presenting ]       | [ ACCEPT (Sage) ]  [ START NOW ]  [ OVERRIDE ]|
+---------------------------------------------------+----------------------------------------------+
| [RUN OF SHOW — DOMINANT WORKING AREA (70%)]       | [SUPPORTING REGION (30% Tabbed)]             |
| Seq | Time  | Segment / Linked SKU | Dur | Status | Tabs: [ QUEUE (Default) | NOTES | HISTORY ]   |
| 01  | 00:00 | Opening Hook         | 05m | DONE   |                                              |
| 02  | 05:00 | M01 Basic Tee        | 10m | DONE   | Pull-Forward Candidate:                      |
| 03  | 17:15 | M03 Cargo Pants      | 06m | LIVE   | * M05 Zip Hoodie (High Priority)             |
| 04  | 23:15 | Flash Sale Voucher   | 05m | NEXT   | [ Pull to Next ]                             |
| 05  | 28:15 | M02 Zip Hoodie       | 10m | PLAN   |                                              |
|                                                   | Quick Note Input:                            |
| * NOTE: Clocks automatically cascade downstream!  | [ "Host mentioned sizing..." ] [ Add ]       |
+---------------------------------------------------+----------------------------------------------+
```

---

### 3. What Should Become More Prominent vs Less Prominent

#### Become More Prominent:
1. **Dynamic Cascade Timing Drift:** If a segment overruns by 3 minutes, the Run of Show must immediately display the projected delay on all downstream segments in amber (e.g., `Flash Sale: 20:00 -> Projected: 23:15 (+3m drift)`). This gives the operator immediate leverage to speed up or trim segments.
2. **Presenter Action Cues:** Make talking-point cues and promotion reminders (e.g., *"Prompt host to pin voucher now"*) prominent and readable at 18px font from 1 meter away.
3. **3-Minute Post-Live Plan Variance Card:** In Review, prioritize the delta summary: *Planned 90m $\rightarrow$ Actual 98m; 2 segments overran; 1 segment skipped.*

#### Become Less Prominent / Subordinated:
1. **Live Pulse Macro Analytics:** Demote or hide viewer count graphs, like rate charts, and revenue curves during live operation. The operator already sees those on the TikTok monitor.
2. **Deep Epistemic Evidence Inspector:** Move cryptographic provenance hashes, receipt timestamps, and raw JSON envelopes into collapsed secondary disclosure drawers. They are for diagnostics, not routine operation.
3. **Complex Causal Experiment Settings:** Remove all experimental arm selectors and random seed inputs from the standard creation flow.

---

### 4. What Must Disappear Completely (Purge List)

1. **Autopilot Auto-Pin Toggle:** Completely purged. Eliminates dangerous claims of automated TikTok manipulation.
2. **Switchback Schedule Wizard (`/chay-phien` randomizer):** Completely purged. Replaced by simple Run of Show creation.
3. **Raw Comment NLP Radar:** Purged from the live desk. TikTok chat cannot be scraped safely; noisy NLP graphs distract operators.
4. **Causal Revenue Lift Badges:** Purged from post-live review. Replace with honest descriptive metrics (*"M03 received 48 clicks during presentation, averaging 8 clicks/min"*).
