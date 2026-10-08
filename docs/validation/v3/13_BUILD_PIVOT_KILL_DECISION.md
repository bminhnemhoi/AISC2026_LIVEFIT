# LiveLift V3 Strategic Decision Framework: BUILD vs PIVOT vs KILL

**Document ID:** `VAL-V3-DECI-13`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 4 (Measurement, Thresholds & Decisions)  
**Classification:** Strategic Governance Framework & Product Decision Logic  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §5, §16, §21, §28, §29; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §1, §3; `docs/validation/v3/11_PASS_FAIL_THRESHOLDS.md`

---

## 1. Executive Summary & Decision Mandate

This document establishes the authoritative strategic decision framework for LiveLift V3. Following empirical trials ($N = 6 \text{ to } 10$ participant pairs), the product leadership team must execute an irrevocable, evidence-backed decision among three strategic pathways:

1. **BUILD:** Advance to Phase 1 Engineering (Single-Device Functional Manual Product).
2. **PIVOT:** Decouple and reframe product architecture across three predefined operational pivots (**Pivot A: Desk-Only**, **Pivot B: Review-Only Companion**, or **Pivot C: Commerce Template / Rundown Plugin**).
3. **KILL / DO NOT ADVANCE TO PHASE 1:** Immediately terminate product investment, archive repository assets, and document lessons learned.

### 1.1 The Priority of Behavioral Evidence
In accordance with master project governance, **audited behavioral evidence strictly supersedes subjective participant opinion**:
- If operators express enthusiastic praise ("I love the UI!") but telemetry proves they missed hard anchors, suffered increased cognitive workload, or logged late transitions, the verdict is **FAIL**.
- If operators express skepticism of software additions but achieve $\ge 30\%$ faster recovery, zero critical misses, and $\ge 20\%$ lower cognitive workload, the operational advantage is **CONFIRMED**.

### 1.2 Hierarchical Evaluation Precedence
To guarantee that the exact same empirical evidence never produces conflicting verdicts (e.g., both BUILD and KILL), product leadership must apply evaluation gates in strict hierarchical order:

1. **Gate 0A: Reliability & Experimental Validity Gate (Engineering REPAIR / RETEST):**
   - Software crashes, unhandled thread exceptions, blank screens, or lost acknowledged local commands invalidate the experimental trial run.
   - In accordance with master roadmap governance (§26), **reliability defects alone do not disprove the product value hypothesis**.
   - Trigger T4 (Crash/Lockup) or T3 (Lost Command) halts the trial, flags the build for an immediate **REPAIR / RETEST** engineering cycle, and schedules a clean retest under identical protocol conditions.
   - A product **KILL** occurs under Gate 0A *only* if engineering fails to achieve stability after authorized repair cycles or if the architecture exhibits persistent, irremediable runtime unreliability.
2. **Gate 0B: Substantive Falsification Gate (Product KILL):**
   - If the prototype executes a valid trial without software crashes, but empirical evidence demonstrates that LiveLift increases cognitive workload, induces critical anchor misses, suffers capture abandonment, or is beaten by the spreadsheet baseline across two iterations, the product hypothesis is falsified.
   - Activates **KILL / DO NOT ADVANCE TO PHASE 1** (Triggers K1–K4, K6).
3. **Gate 0C: Secondary Wedge Assessment (PIVOT Gate):**
   - If the core Operator Desk passes all primary timing and validity thresholds, but secondary subsystems (Host View, live manual capture) create operational friction or fail their sub-study criteria, product leadership executes a scoped pivot (**Pivot A: Desk-Only**, **Pivot B: Review Companion**, or **Pivot C: Template/Plugin**).
4. **Gate 0D: Unambiguous BUILD Gate:**
   - Advancement to Phase 1 Single-Device Desk occurs if and only if **100% of primary desk dimensions pass**, zero falsification triggers are activated, operator preference is $\ge 70.0\%$, and the Host View sub-study passes (or Pivot A is formally adopted).

```
+----------------------------------------------------------------------------------------------------+
|                                  HIERARCHICAL DECISION FLOWCHART                                   |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|                                    [ EMPIRICAL VALIDATION TRIAL ]                                  |
|                                                  │                                                 |
|                                                  ▼                                                 |
|                                    [ LEVEL 0A: VALIDITY CHECK ]                                    |
|                                    Software crash, lost command,                                   |
|                                    or unhandled thread lockup?                                     |
|                                                  │                                                 |
|                                   YES ───────────┴─────────── NO                                   |
|                                    │                           │                                   |
|                                    ▼                           ▼                                   |
|                            [ REPAIR / RETEST ]            [ LEVEL 0B: FALSIFICATION CHECK ]        |
|                            Invalid trial run;             - Baseline beats LiveLift (K1)?          |
|                            engineering bug fix.           - Critical anchor miss (K2)?             |
|                            (Persistent unreliability      - Cognitive workload increase (K3)?      |
|                             -> KILL K5)                   - Capture chore rejection (K4)?          |
|                                                           - Preference < 50% (K6)?                 |
|                                                                        │                           |
|                                                         YES ───────────┴─────────── NO             |
|                                                          │                           │             |
|                                                          ▼                           ▼             |
|                                                      [ KILL ]             [ LEVEL 0C: PRIMARY ]    |
|                                                   Do Not Advance          All 8 Primary Desk       |
|                                                   to Phase 1              Dimensions Passed?       |
|                                                                                      │             |
|                                                                       YES ───────────┴──────── NO  |
|                                                                        │                        │  |
|                                                  Host View Sub-Study?  │                        ▼  |
|                                                ┌───────────┴───────────┐│                   [ PIVOT ]      |
|                                               PASS                    FAIL                  Diagnostics:   |
|                                                │                       │                    - Desk only: A |
|                                                │                       ▼                    - Review: B    |
|                                                │                  [ PIVOT A ]               - Template: C  |
|                                                │                Desk-Only Scope                    │       |
|                                                │                (Kill Host View)                   ▼       |
|                                                │                       │                    [ RESTRUCTURE ]|
|                                                ▼                       ▼                                   |
|                                    [ LEVEL 0D: PREFERENCE GATE ] ──────┘                                   |
|                                    Operator Preference >= 70.0%?                                           |
|                                                  │                                                         |
|                                   YES ───────────┴─────────── NO (50.0% - 69.9%)                           |
|                                    │                           │                                           |
|                                    ▼                           ▼                                           |
|                                [ BUILD ]             [ DETERMINISTIC FALLBACK ]                            |
|                             Phase 1 Product          1. >=50% host reason -> PIVOT A                       |
|                             (Single-Device)          2. >=50% sheet reason -> PIVOT B                      |
|                                                      3. >=50% OBS reason  -> PIVOT C                       |
|                                                      4. Otherwise -> UX REPAIR / RETEST                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Pathway 1: BUILD (Advance to Phase 1 Single-Device Product)

### 2.1 Prerequisite Gate Clearance
Advancement to the BUILD pathway requires meeting **100% of the following criteria**:
1. **Zero Disqualification Triggers:** Zero occurrences of Silent Anchor Shifts (T1), False Confirmed Actions (T2), Lost Acknowledged Commands (T3), or unhandled Prototype Crashes (T4).
2. **Primary Desk Thresholds Met (Dimensions 01–06, 08, 09):**
   - *Dimension 01 (Setup & Configuration):* Initial configuration duration $T_{\text{setup}} \le 10.0$ minutes, $\Delta T_{\text{setup}} \le 2.0$ minutes compared to baseline, with $\le 2$ configuration errors.
   - *Dimension 02 (Schedule-Risk Awareness):* $\ge 80.0\%$ of eligible schedule deficit opportunities correctly recognized (identifying the threatened anchor) within $\le 10$ seconds of stimulus.
   - *Dimension 03 (Overrun Recovery Speed & Constraint Validity):* Median recovery decision latency $T_{\text{decision}} \ge 30.0\%$ faster than baseline, with $\ge 90.0\%$ of recovery actions mathematically respecting minimum segment durations and downstream anchor commitments.
   - *Dimension 04 (Hard Promotion Anchor Protection):* Exactly 0 unintended critical anchor misses; median verbal anchor variance $|V_{\text{anchor, verbal}}| \le 15$ seconds (native platform delay recorded separately as external latency).
   - *Dimension 05 (Routine Capture Burden & PVA Accuracy):* $\le 1$ command per transition, median capture latency $t_{\text{capture}} \le 3$ seconds, boundary error rate $E_{\text{PVA}} \le 10.0\%$.
   - *Dimension 06 (Operator Cognitive Workload):* Median raw NASA-TLX score $\ge 20.0\%$ lower than baseline ($p < 0.05$); OR non-inferior ($\text{Median}(\text{TLX}_{\text{LiveLift}}) \le \text{Median}(\text{TLX}_{\text{Base}})$, $\Delta\text{TLX} \le 0.0$) with statistically significant ($p < 0.05$) recovery latency improvement ($T_{\text{decision}}$) and $\ge 90.0\%$ recovery validity ($R_{\text{valid}}$). Standalone workload increases ($\Delta\text{TLX} > 0$) fail.
   - *Dimension 08 (Post-Show Fact Accuracy & Review Reconciliation):* Total review reconciliation duration $T_{\text{recon}} \le 5.0$ minutes (median $\ge 30.0\%$ faster than baseline) with $\ge 80.0\%$ fact accuracy per trial ($\ge 90.0\%$ pooled across trial battery).
   - *Dimension 09 (Feasible Next LIVE Adaptation):* Next-plan authoring duration $T_{\text{plan}} \le 5.0$ minutes (median $\ge 30.0\%$ faster than baseline), with $\ge 90.0\%$ plan constraint feasibility, and combined post-show duration $T_{\text{recon}} + T_{\text{plan}} \le 5.0$ minutes.
3. **Subjective Operator Preference (Dimension 10):**
   - $\ge 70.0\%$ of participating operators voluntarily choose LiveLift for tomorrow's real live sales broadcast.
   *(Note: Voluntary Repeat Use across $\ge 3$ merchant teams $\times \ge 3$ consecutive live shows is Gate G1 field acceptance, evaluated in production pilots following Phase 1 completion).*

---

### 2.2 Authorized Engineering Scope (Phase 1)
Clearance of the BUILD gate authorizes engineering to implement the **Phase 1 Single-Device Manual Operations Desk**:
* **Persistence Layer:** Durable local storage utilizing **browser-local IndexedDB or embedded SQLite (via OPFS / WebAssembly)**.
* **Architecture:** Strictly **single-device, zero-backend, offline-first**. All state machines, event logs, and command receipts execute within the local client runtime.
* **Studio Room Scope:** Strictly **one active room per device**. Multi-room concurrent dashboards and agency management are explicitly deferred.
* **External Integration Boundary:**
  - **Zero TikTok API Dependencies:** No reliance on private, undocumented, or official TikTok endpoints.
  - **Manual External Action Reporting:** Product pins, voucher activations, and price changes remain strictly manual operator clicks logged as `operator_reported`.
  - **No Autonomous Automation:** No auto-pinning bots, no headless browser scraping, no AI auto-pacing.

---

### 2.3 Strict Phase 2 Prohibition & Scope Boundary
Clearance of the Phase 0 BUILD gate **DOES NOT authorize Phase 2 engineering**:
- Phase 2 scope is strictly defined as a **single-room / one-room team authoritative backend** (server authority, WebSockets, and synchronized operator/host/producer devices for one studio room).
- Multi-room concurrent dashboards, multi-agency fleet management, and cross-studio views are **DEFERRED TO FUTURE PHASES** and subject to separate independent authorization.
- Cloud synchronization, server backends, PostgreSQL databases, multi-tenant authentication, WebSockets, and team networking remain **STRICTLY PROHIBITED** until Phase 1 passes its own in-vivo field acceptance gate (**Gate G1**).

---

## 3. Pathway 2: PIVOT (Scoped Operational Reframing)

If the core Operator Desk demonstrates genuine operational superiority, but secondary subsystems create friction or fail their dedicated sub-study gates, product leadership must execute one of three predefined pivots:

```
+----------------------------------------------------------------------------------------------------+
|                                      PIVOT TAXONOMY & TRIGGERS                                     |
+-------------------+-----------------------------------+--------------------------------------------+
| Pivot Variant     | Trigger Condition                 | Strategic Reframing Action                 |
+-------------------+-----------------------------------+--------------------------------------------+
| **Pivot A**       | Host View fails message reduction | **Kill Host View entirely.**               |
| (Desk-Only)       | or causes talent distraction;     | Focus 100% of engineering on behind-the-   |
|                   | Operator Desk passes all metrics. | desk Operator Console. Existing Zalo/cues. |
+-------------------+-----------------------------------+--------------------------------------------+
| **Pivot B**       | In-live runtime logging is        | **De-emphasize live in-show tracking.**    |
| (Review-Only      | rejected as too heavy, but post-  | Pivot to post-show video/chat transcript   |
|  Companion)       | show variance review is valued.   | PVA reconciler & Next LIVE plan generator. |
+-------------------+-----------------------------------+--------------------------------------------+
| **Pivot C**       | Operators reject standalone app;  | **Abandon standalone web app.**            |
| (Template / Plugin| demand existing spreadsheet/chat  | Package LiveLift pacing formulas into      |
|  Architecture)    | or broadcast rundown tools.       | Google Sheets template + Zalo cue bot.     |
+-------------------+-----------------------------------+--------------------------------------------+
```

---

### 3.1 Pivot A: Desk-Only Pivot (Decouple & Terminate Host View)
* **Trigger Conditions:**
  1. Operator Desk passes all primary thresholds (Thresholds 01 through 06, 08, 09).
  2. Host View (Threshold 07) fails: Total coordination messages are reduced by $< 30\%$, host comprehension takes $> 5$ seconds, or hosts exhibit teleprompter glaze / speech stumbles on camera.
  3. Qualitative feedback from hosts indicates the tablet creates visual clutter or anxiety.
* **Operational Action:**
  - **Permanently eliminate the dedicated Host View screen** from Phase 1 scope.
  - Reframe LiveLift strictly as a **Behind-the-Desk Operator Pacing Cockpit**.
  - Operator continues to direct talent using the studio's native communication channel (physical whiteboard, hand signals, or existing Zalo chat).
  - Eliminates cross-browser synchronization overhead and multi-screen deployment friction.

---

### 3.2 Pivot B: Review-Only Companion Pivot
* **Trigger Conditions:**
  1. Live in-show runtime tracking (Dimension 05) fails: Operators report that clicking segment transitions during high-stress selling is an intolerable chore, resulting in $E_{\text{PVA}} > 10.0\%$.
  2. Post-show Plan-vs-Actual review (Dimension 08) and Next LIVE planning (Dimension 09) receive high acclaim ($\ge 90.0\%$ fact accuracy, $\ge 90.0\%$ feasibility for the planning engine).
* **Operational Action:**
  - **De-prioritize live-second-by-second tracking.**
  - Reframe the product as a **Post-Live Debrief & Rundown Planning Companion**.
  - System ingests simple post-show artifacts (exported TikTok Seller Center order curves, raw stream timestamps, or simple segment lists) to reconstruct pacing variances and output optimized next-day rundowns.
  - Removes the high-reliability real-time state machine requirement.

---

### 3.3 Pivot C: Commerce Template / Rundown Plugin Pivot
* **Trigger Conditions:**
  1. Operators demonstrate that an expertly configured Google Sheets workbook (with formulas and conditional formatting) achieves comparable recovery and pacing performance to LiveLift.
  2. Studio owners refuse to adopt another standalone web application, citing screen real-estate constraints or reluctance to pay SaaS subscriptions for dedicated tools.
  3. Advanced operators request integration into existing production ecosystems (e.g., Ontime broadcast rundown, OBS WebSocket docks, or Google Workspace).
* **Operational Action:**
  - **Discontinue standalone application development.**
  - Package LiveLift's proprietary constraint-aware scheduling formulas, dynamic deficit calculators, and flash-sale pacing algorithms into a **Production-Grade Google Sheets Master Template** paired with an open-source **Zalo/Telegram Cue Webhook Bot**.
  - Monetize via paid template licenses, studio consulting, or plugins for established broadcast suites (Ontime / Shoflo).

---

## 4. Pathway 3: KILL / DO NOT ADVANCE TO PHASE 1

### 4.1 Concrete Termination Triggers
Product leadership must **immediately terminate LiveLift V3 development** and block Phase 1 engineering if any of the following empirical conditions occur:

```
+----------------------------------------------------------------------------------------------------+
|                                  HARD TERMINATION TRIGGER MATRIX                                   |
+----+----------------------------+------------------------------------------------------------------+
| #  | Termination Trigger        | Concrete Empirical Evidence Condition                            |
+----+----------------------------+------------------------------------------------------------------+
| K1 | Baseline Spreadsheet       | The competent Google Sheets baseline matches or outperforms      |
|    | Dominance                  | LiveLift in Recovery Decision Speed (T_decision) and Fact        |
|    |                            | Accuracy (A_facts) across two focused product iterations.        |
+----+----------------------------+------------------------------------------------------------------+
| K2 | Critical Operational Harm  | LiveLift induces >= 1 critical unintended anchor miss or causes  |
|    | (Unintended Anchor Misses) | live broadcast failure due to interface ambiguity or distraction.|
+----+----------------------------+------------------------------------------------------------------+
| K3 | Cognitive Workload Increase| Operators experience higher subjective cognitive workload        |
|    | (NASA-TLX Regression)      | using LiveLift than using Google Sheets (TLX_A > TLX_B,          |
|    |                            | Delta TLX > 0.0). Workload increases activate K3 and block BUILD.|
+----+----------------------------+------------------------------------------------------------------+
| K4 | Routine Capture Chore      | Operators abandon live transition logging in >= 30% of trials,   |
|    | Rejection                  | citing screen overload and Seller Center multi-tasking conflict. |
+----+----------------------------+------------------------------------------------------------------+
| K5 | Disqualification Trigger   | Prototype crash, freeze, or lost command triggers an immediate   |
|    | Activation (Persistent)    | REPAIR / RETEST engineering gate. If engineering cannot resolve  |
|    |                            | the bug, or prototype demonstrates persistent fatal unreliability|
|    |                            | across retests, development is terminated (KILL).                |
+----+----------------------------+------------------------------------------------------------------+
| K6 | Zero Commercial Willingness| < 50.0% of operators choose LiveLift, or operators demonstrate   |
|    | to Adopt                   | preference for spreadsheets, proving lack of market viability.   |
+----+----------------------------+------------------------------------------------------------------+
```

---

### 4.2 Termination & Project Archival Protocol
Upon triggering a KILL decision:
1. **Immediate Code Freeze:** Halt all development on `orca/v3-validation` and related branches.
2. **Post-Mortem Documentation:** Author `docs/validation/v3/POST_MORTEM_KILL_REPORT.md` within 5 business days, documenting exact telemetry distributions, root causes of operational friction, and spreadsheet superiority mechanics.
3. **Repository Archival:** Tag the repository state as `v3-val-kill-archive`, lock branches, and transition engineering resources to alternative company initiatives.
4. **Governance Record:** Record formal cancellation in the Master Roadmap Decision Log (`docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §29).

---

## 5. Objective Behavioral Evidence vs Subjective Opinion

To prevent cognitive dissonance, confirmation bias, or polite participant flattery from contaminating the decision, research evaluations must follow the **Triangulation Conflict Resolution Matrix**:

```
+--------------------------------------------------------------------------------------------------------------------+
|                                         TRIANGULATION CONFLICT RESOLUTION                                          |
+------------------------+------------------------+------------------------------------------------------------------+
| Behavioral Telemetry   | Subjective Interview   | Authoritative Strategic Interpretation                           |
+------------------------+------------------------+------------------------------------------------------------------+
| **PASS**               | **POSITIVE**           | **UNAMBIGUOUS BUILD:**                                           |
| Latency improved >=30%;| >= 70.0% of operators  | Behavioral efficiency validated by user sentiment.               |
| Zero critical misses;  | voluntarily choose     | Clear mandate for Phase 1 single-device build.                   |
| Workload lower >=20%.  | LiveLift for live show.|                                                                  |
+------------------------+------------------------+------------------------------------------------------------------+
| **PASS**               | **MODERATE**           | **DETERMINISTIC FALLBACK (50.0% - 69.9% PREFERENCE):**           |
| Latency improved >=30%;| 50.0% - 69.9% choose   | Primary behavioral efficiency validated, but operator            |
| Zero critical misses;  | LiveLift; hesitation   | adoption is below the 70.0% BUILD threshold. Apply hierarchical  |
| Workload lower >=20%   | regarding UI friction. | deterministic fallback tree:                                     |
| (or non-inferior).     |                        | 1. If >= 50% of non-choosers cite Host distraction -> PIVOT A    |
|                        |                        | 2. Else if >= 50% cite spreadsheet formula desire -> PIVOT B     |
|                        |                        | 3. Else if >= 50% cite window juggling / OBS demand -> PIVOT C    |
|                        |                        | 4. Otherwise (default) -> UX REPAIR & RETEST (blocks BUILD;      |
|                        |                        |    if retest < 70%, routes to KILL K6).                          |
+------------------------+------------------------+------------------------------------------------------------------+
| **PASS**               | **NEGATIVE**           | **KILL / DO NOT ADVANCE TO PHASE 1 (Trigger K6):**               |
| Latency improved >=30%;| < 50.0% choose         | Commercial unwillingness overrides raw telemetry.                |
| Zero critical misses;  | LiveLift; operators    | If operators reject the tool in favor of sheets                  |
| Workload lower >=20%.  | prefer spreadsheets.   | despite speed, the product cannot achieve organic                |
|                        |                        | adoption in the wild. Project terminated.                        |
+------------------------+------------------------+------------------------------------------------------------------+
| **FAIL**               | **POSITIVE**           | **HARD REJECTION / COURTESY BIAS (FALSE CHARM):**                |
| Latencies lag baseline;| Operator claims tool   | Participant is exhibiting courtesy bias or                       |
| Missed anchors > 0;    | is "great" and "saves  | novelty attraction. Telemetry proves operational                 |
| Workload higher.       | time".                 | breakdown. Subjective praise is DISCARDED. FAIL.                 |
+------------------------+------------------------+------------------------------------------------------------------+
| **FAIL**               | **NEGATIVE**           | **UNAMBIGUOUS KILL / DO NOT ADVANCE TO PHASE 1:**                |
| Latencies lag baseline;| Operator rejects tool; | Total alignment between operational breakdown                    |
| Cognitive overload.    | states sheet is better.| and user rejection. Immediate project kill.                      |
+------------------------+------------------------+------------------------------------------------------------------+
```

---

## 6. Formal Decision Governance & Sign-Off

The final strategic decision must be unanimously ratified by the leadership trio and independently attested by the forensic auditor:

```
====================================================================================================
LIVELIFT V3 PRODUCT DECISION RATIFICATION
====================================================================================================
FINAL DECISION:     [ ] BUILD (Advance to Phase 1 Single-Device Product)
                    [ ] PIVOT A (Desk-Only Pivot)
                    [ ] PIVOT B (Review-Only Companion Pivot)
                    [ ] PIVOT C (Commerce Template / Rundown Plugin Pivot)
                    [ ] KILL / DO NOT ADVANCE TO PHASE 1

EXECUTIVE SUMMARY OF EMPIRICAL BASIS:
____________________________________________________________________________________________________
____________________________________________________________________________________________________

GOVERNANCE SIGN-OFF:

Product Strategy Lead:        ___________________________   Date: [ YYYY-MM-DD: ____________ ]
Lead Validation Researcher:   ___________________________   Date: [ YYYY-MM-DD: ____________ ]
Engineering Architecture Lead:___________________________   Date: [ YYYY-MM-DD: ____________ ]
Independent Forensic Auditor: ___________________________   Date: [ YYYY-MM-DD: ____________ ]
====================================================================================================
```
