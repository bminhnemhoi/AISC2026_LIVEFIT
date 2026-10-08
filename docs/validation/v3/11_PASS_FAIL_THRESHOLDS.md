# LiveLift V3 Preregistered Quantitative Pass/Fail Thresholds & Governance Gates

**Document ID:** `VAL-V3-THRS-11`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 4 (Measurement, Thresholds & Decisions)  
**Classification:** Empirical Decision Criteria & Statistical Gate Specification  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §5, §16, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §1, §7; `docs/validation/v3/08_MEASUREMENT_SHEET.md`

---

## 1. Executive Summary & Preregistration Philosophy

This specification establishes the authoritative, preregistered quantitative pass/fail thresholds, statistical decision rules, and hard disqualification triggers governing the LiveLift V3 Product Validation Program.

### 1.1 The Preregistration Principle
In behavioral and operational systems research, adjusting evaluation thresholds after observing experimental data (*p-hacking* or goalpost shifting) invalidates scientific and commercial claims. To ensure complete auditability:
1. **Pre-Experimental Freeze:** All numeric criteria, percentage improvements, and disqualification triggers in this document are frozen prior to participant testing.
2. **Deterministic Gate Mapping:** Every experimental outcome deterministically maps to one of four hierarchical outcomes: **REPAIR / RETEST (Engineering Defect Gate: T3 Lost Command, T4 Crash/Lockup)**, **KILL / DO NOT ADVANCE TO PHASE 1 (Substantive Falsification Gate: K1–K4, K6)**, **PIVOT (Scoped Operational Reframing: Pivot A/B/C)**, or **BUILD (Advance to Phase 1 Single-Device Build)**.
3. **No Retrospective Exceptions:** A failure on any primary threshold or hard disqualification trigger cannot be overridden by favorable subjective opinions or secondary metrics.

```
+----------------------------------------------------------------------------------------------------+
|                                    GOVERNANCE GATE ARCHITECTURE                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|                       [ EXPERIMENTAL TRIALS: N = 6 to 10 PARTICIPANT PAIRS ]                       |
|                                                  │                                                 |
|                       ┌──────────────────────────┴──────────────────────────┐                      |
|                       ▼                                                     ▼                      |
|          [ ZERO-TOLERANCE AUDIT ]                                [ QUANTITATIVE METRICS ]          |
|          4 Hard Triggers (T1..T4)                                10 Operational Dimensions         |
|          - T1: Silent Shift / T2: False Action                   (Wilcoxon Signed-Rank Test)       |
|          - T3: Lost Command / T4: Crash                                     │                      |
|                       │                                                     │                      |
|      ┌────────────────┴────────────────┐                                    │                      |
|      ▼ (T3/T4 Crash / Lost Command)    ▼ (T1/T2 Substantive Falsification)  │                      |
| [ REPAIR / RETEST ]             [ HARD FAIL / KILL ]                        │                      |
| Engineering defect gate;        Substantive falsification (K2);             │                      |
| (Persistent unreliability       Do not advance to Phase 1.                  │                      |
|   -> KILL K5)                                  │                            │                      |
|                       ┌────────────────────────┘                            │                      |
|                       ▼ (ALL ZERO-TOLERANCE TRIGGERS PASS)                  │                      |
|             [ EVALUATE PREREGISTERED DIMENSIONS ] <─────────────────────────┘                      |
|             - Primary Gates (Core Desk: D01..D06, D08..D10)                                        |
|             - Decoupled Host Sub-Study (D07)                                                       |
|                                   │                                                                |
|                       ┌───────────┼───────────┐                                                    |
|                       ▼           ▼           ▼                                                    |
|                   [ BUILD ]   [ PIVOT ]   [ KILL ]                                                 |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Master Preregistered Threshold Matrix

The 11 quantitative metrics (M1–M11) and qualitative preferences map systematically across the **ten preregistered decision dimensions**:

```
+-----------------------------------------------------------------------------------------------------------------------------------+
|                                            PREREGISTERED THRESHOLD MASTER SCORECARD                                               |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| #  | Operational Dimension      | Tier     | Primary Metric (M#)    | Preregistered Threshold  | Mathematical Condition           |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 01 | Setup & Configuration      | Secondary| Setup Time & Errors    | <= 10.0m; <= 2.0m slower;| T_setup <= 10.0m AND             |
|    |                            |          | (M1, N_config_errors)  | <= 2 config errors       | Delta_T_setup<=2.0m & N_err<=2   |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 02 | Schedule-Risk Awareness    | Primary  | Detection Latency (M2) | >= 80% recognized        | Count(T_detect <= 10.0s) /       |
|    |                            |          | (Correct identification| in <= 10.0 seconds       |   N_opp >= 0.80 (mapped opps;    |
|    |                            |          |  or N/A Retest Nopp=0) | (or N/A Retest if Nopp=0)|   N/A Retest if N_opp == 0)      |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 03 | Overrun Recovery Speed     | Primary  | Decision Latency (M3)  | Median >= 30.0% faster;  | Pct_Improve(T_decision) >= 30.0% |
|    | & Constraint Validity      |          | & Validity Rate (M4)   | >= 90.0% valid choices   | AND R_valid >= 90.0%             |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 04 | Hard Promotion Anchor      | Primary  | Anchor Variance (M5) & | Zero critical misses;    | N_critical_misses == 0 AND       |
|    | Protection                 |          | Verbal Miss Count      | Median Var <= 15.0s      | Med(V_anchor)<=15s & No increase |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 05 | Routine Capture Burden     | Primary  | PVA Boundary Error (M6)| <= 1 command/transition; | Commands <= 1.0 AND              |
|    | & Plan-vs-Actual Accuracy  |          | & Capture Latency (M7) | Median <= 3.0s; >=90%<15s| Med(T_cap)<=3.0s & E_PVA<=10.0%  |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 06 | Operator Cognitive Burden  | Primary  | Raw NASA-TLX           | Median score >= 20.0%    | Pct_Improve(NASA_TLX) >= 20.0%   |
|    |                            |          | Workload Scale (M9)    | lower (or non-inferior   | (p < 0.05) OR (Delta_TLX <= 0.0  |
|    |                            |          |                        | Delta_TLX <= 0 with      | AND recovery p < 0.05            |
|    |                            |          |                        | recovery p<0.05 & R>=90%)| AND R_valid >= 90.0%)            |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 07 | Host Coordination (P0.5)   | Gated    | Avoidable Cues (M8)    | >= 30.0% fewer messages; | Pct_Reduct(N_avoidable) >= 30.0% |
|    | (Host View Sub-Study)      |          | & Comprehension        | >= 80% understood <= 5.0s| (or <=2 if Base=0) & T_comp<=5.0s|
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 08 | Post-Show PVA Review       | Primary  | Review Duration & Fact | <= 5.0m total, >= 30%    | T_recon <= 5.0m & Pct_Imp >= 30% |
|    |                            |          | Accuracy (M10)         | faster; >= 80% per trial | AND A_facts >= 80.0% per trial   |
|    |                            |          |                        | (>= 90% pooled)          | (AND >= 90.0% pooled)            |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 09 | Next LIVE Adaptation       | Primary  | Next LIVE Planning &   | <= 5.0m total, >= 30%    | T_plan <= 5.0m & Pct_Imp >= 30%  |
|    |                            |          | Feasibility (M11)      | faster; >= 90% feasible  | AND Feas >= 90%; Total<=5.0m     |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 10 | Subjective Adoption Choice | Primary  | Forced-Choice Probe    | >= 70.0% of operators    | N_choose_LiveLift / N_operators  |
|    |                            |          | (Operator & Host Team) | voluntarily choose desk  |   >= 0.70                        |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
```

---

## 3. Detailed Dimension Specifications & Scoring Rubrics

### 3.1 Dimension 1: Setup Time ($T_{\text{setup}}$, Metric M1) & Configuration Errors ($N_{\text{config\_errors}}$)
* **Operational Rationale:** If preparing a show in LiveLift is heavier, more cumbersome, or more error-prone than duplicating a spreadsheet tab, solo operators and small agencies will abandon the tool before broadcast kickoff.
* **Numeric Boundary:**
  - Absolute Cap: $\text{Median}(T_{\text{setup}}) \le 10.0\text{ minutes}$.
  - Baseline Parity: $\text{Median}(T_{\text{setup, LiveLift}}) - \text{Median}(T_{\text{setup, Base}}) \le 2.0\text{ minutes}$.
  - Configuration Accuracy: $N_{\text{config\_errors}} \le 2$ errors during show initialization/catalog import.
* **Evaluation Method:** Clock time from blank/import opening to participant declaring readiness; count of setup errors.
* **Scoring Rubric:**
  - `PASS`: Setup completed $\le 10.0$m, $\le 2.0$m slower than baseline, and $N_{\text{config\_errors}} \le 2$.
  - `MARGINAL`: Setup takes $10.1\text{--}15.0$m, $> 2.0$m slower, or $N_{\text{config\_errors}} \in [3, 4]$; triggers UX onboarding refinement.
  - `FAIL`: Setup exceeds $15.0$m or $N_{\text{config\_errors}} > 4$; heavier/more error-prone than traditional tools.

---

### 3.2 Dimension 2: Schedule-Risk Detection Latency ($T_{\text{detect}}$, Metric M2)
* **Operational Rationale:** Detecting an emerging schedule deficit early allows gentle, non-disruptive compression of upcoming buffers. Detecting it late causes catastrophic panic, emergency cutting of hero products, or missed promotions.
* **Numeric Boundary:**
  $$\frac{\sum_{i=1}^{N_{\text{opp}}} \mathbf{1}(T_{\text{detect}, i} \le 10.0\text{s})}{N_{\text{opp}}} \ge 80.0\%$$
  where $N_{\text{opp}}$ is the authoritative count of scored recognition opportunities ($N_{\text{opp}} = N_{\text{scored\_trials}}$ for primary D1 overrun recognition; or total eligible disturbance instances for multi-disturbance audits). Unadministered or aborted trials are excluded from the denominator.
* **Evaluation Method & Censoring Rules:** Stopwatch from mathematical deficit emergence to operator *correct identification* of the specific threatened anchor or deficit condition. Physical glance or cursor movement without verified identification is not scored as detection.
  - *No Detection / Unobserved:* If the operator fails to detect the deficit before segment conclusion or anchor breach, $t_{\text{detect}} = \text{null}$, recorded as `CENSORED` ($T_{\text{detect}} = 120.0\text{s}$ timeout for ranking), and scored as $0$ in $\mathbf{1}(T_{\text{detect}} \le 10.0\text{s})$. Do not fabricate artificial timestamps.
  - *No Action:* If detected but no recovery action is taken, $t_{\text{action}} = \text{null}$, scored as invalid recovery ($R_{\text{valid}} = 0$).
  - *Empty Recognition Denominator Rule ($N_{\text{opp}} = 0$):* If no eligible recognition opportunities were administered or all were aborted ($N_{\text{opp}} = 0$), recognition accuracy cannot be computed ($0/0$). Observers and raters must NOT divide by zero and must NOT fabricate detections. The trial/metric disposition is strictly recorded as **`N/A — INVALID FOR SCORING / RETEST REQUIRED`**; the affected trial must be re-administered.
* **Scoring Rubric:**
  - `PASS`: At least $80.0\%$ of eligible recognition opportunities ($N_{\text{opp}}$) recognized with correct anchor identification within $\le 10.0$ seconds.
  - `MARGINAL`: $60.0\%\text{--}79.9\%$ recognized in $\le 10.0$s; indicates visual hierarchy ambiguity.
  - `FAIL`: $< 60.0\%$ recognized; baseline conditional formatting matches or outperforms LiveLift.

---

### 3.3 Dimension 3: Overrun Recovery Speed ($T_{\text{decision}}$, Metric M3) & Validity ($R_{\text{valid}}$, Metric M4)
* **Operational Rationale:** Once a deficit is recognized, calculating which downstream segments can yield time without violating manufacturer floors is mentally exhausting. The LiveLift recovery engine must materially accelerate decision velocity while guaranteeing mathematical feasibility.
* **Numeric Boundary:**
  $$\text{Percentage Improvement in Median } T_{\text{decision}} \ge 30.0\% \quad \text{and} \quad \text{Median } T_{\text{total}} \ge 30.0\% \text{ faster}$$
  $$R_{\text{valid}} \ge 90.0\%$$
* **Evaluation Method & Zero-Denominator Rule:** Paired Wilcoxon signed-rank test comparing $T_{\text{decision}}$ and $T_{\text{total}}$ in seconds; constraint audit on all logged choices.
  - *Zero-Denominator Rule:* If no recovery decisions are attempted during an overrun trial ($N_{\text{decisions}} = 0$), $R_{\text{valid}} = 0.0\%$ (FAIL). An unhandled overrun cannot pass validity with an empty denominator.
* **Scoring Rubric:**
  - `PASS`: Median recovery time $\ge 30.0\%$ faster than baseline AND $\ge 90.0\%$ of choices valid under constraints.
  - `MARGINAL`: Recovery is $10.0\%\text{--}29.9\%$ faster, or validity is $75.0\%\text{--}89.9\%$.
  - `FAIL`: Recovery is $< 10.0\%$ faster, or validity is $< 75.0\%$; LiveLift provides no operational arithmetic advantage.

---

### 3.4 Dimension 4: Hard Promotion Anchor Protection & Variance ($V_{\text{anchor}}$, Metric M5)
* **Operational Rationale:** Live TikTok Shop commerce depends on scheduled promotions (Seller Center flash sales, platform co-funded vouchers). Missing an anchor destroys GMV and violates commercial agreements.
* **Numeric Boundary:**
  $$N_{\text{critical\_unintended\_misses}} = 0 \quad (\text{Zero Tolerance})$$
  $$\text{Median}(V_{\text{anchor, verbal}}) \le 15.0\text{ seconds}$$
  $$\text{Misses}_{\text{LiveLift}} \le \text{Misses}_{\text{Baseline}} \quad (\text{No increase in anchor misses vs baseline})$$
* **Critical Miss Definition:** A hard anchor is classified as a Critical Miss if:
  1. On-camera verbal announcement occurs $> 30.0$ seconds after scheduled wall-clock instant without prior authorized schedule adjustment.
  2. The anchor is omitted or skipped entirely.
  3. The anchor start time was silently altered by software without explicit human authorization.
  *(Note: Native platform delay, such as the 40s console spinner in Scenario 2 D4, is tracked separately as $\Delta t_{\text{platform}}$ and does not penalize operator timing adherence provided holding cues were dispatched).*
* **Scoring Rubric:**
  - `PASS`: Zero critical misses across all experimental trials, median verbal variance $\le 15.0$ seconds, and no increase in misses vs baseline.
  - `FAIL`: Any critical missed anchor attributable to software confusion, or median variance $> 15.0$s.

---

### 3.5 Dimension 5: Routine Capture Burden ($N_{\text{commands}}$, $T_{\text{capture}}$, Metric M7) & PVA Error Rate ($E_{\text{PVA}}$, Metric M6)
* **Operational Rationale:** If logging segment progress requires complex navigation or multi-click workflows, operators will abandon tracking during chaotic live broadcasts, corrupting post-show analytics.
* **Numeric Boundary:**
  - Clicks per Transition: $\le 1.0$ command interaction per routine segment transition.
  - Median Capture Latency: $\text{Median}(T_{\text{capture}}) \le 3.0\text{ seconds}$.
  - Plan-vs-Actual Boundary Accuracy: $\ge 90.0\%$ of segment transitions recorded within $15.0$ seconds of ground-truth video timecode ($E_{\text{PVA}} \le 10.0\%$).
* **Scoring Rubric:**
  - `PASS`: $\le 1$ click, median capture latency $\le 3.0$s, and $E_{\text{PVA}} \le 10.0\%$.
  - `MARGINAL`: $1.1\text{--}2.0$ clicks, or latency $3.1\text{--}6.0$s; operator notes capture friction.
  - `FAIL`: $> 2$ clicks, latency $> 6.0$s, or $E_{\text{PVA}} > 10.0\%$; capture chore compromises operations.

---

### 3.6 Dimension 6: Operator Cognitive Workload (NASA-TLX, Metric M9)
* **Operational Rationale:** Live stream operators operate at near-total cognitive saturation. LiveLift must materially unload mental arithmetic and window-switching anxiety.
* **Numeric Boundary (Including Preregistered Workload Non-Inferiority Alternative):**
  $$\text{Primary Workload Improvement: } \frac{\text{Median}(\text{TLX}_{\text{Base}}) - \text{Median}(\text{TLX}_{\text{LiveLift}})}{\text{Median}(\text{TLX}_{\text{Base}})} \times 100\% \ge 20.0\% \quad (p < 0.05)$$
  $$\mathbf{OR} \quad \text{Non-Inferiority Alternative: } \text{Median}(\text{TLX}_{\text{LiveLift}}) \le \text{Median}(\text{TLX}_{\text{Base}}) \quad (\Delta\text{TLX} \le 0.0, \text{ zero workload increase})$$
  $$\text{provided recovery decision latency } T_{\text{decision}} \text{ demonstrates statistically significant improvement } (p < 0.05) \text{ AND } R_{\text{valid}} \ge 90.0\%$$
* **Evaluation Method:** Raw NASA-TLX 6-dimensional scale (0–100) administered immediately post-trial; paired difference evaluated via Wilcoxon signed-rank test ($\alpha = 0.05$).
* **Scoring Rubric:**
  - `PASS`: Statistically significant reduction in median workload of $\ge 20.0\%$ ($p < 0.05$), OR non-inferior workload ($\Delta\text{TLX} \le 0.0$, zero workload increase) with statistically significant recovery decision velocity ($p < 0.05$) AND valid recovery choices $R_{\text{valid}} \ge 90.0\%$.
  - `MARGINAL`: Workload reduction of $5.0\%\text{--}19.9\%$, or non-significant trend ($p \ge 0.05$) without recovery significance.
  - `FAIL`: Workload reduction $< 5.0\%$ without recovery superiority, OR any workload increase ($\Delta\text{TLX} > 0.0$, including $+3$ or $+5$ points), activating Termination Trigger K3.

---

### 3.7 Dimension 7: Host Coordination & Comprehension (Metric M8, Host View Gated Sub-Study)
* **Operational Rationale:** Talent on camera must not be distracted by chat notifications or verbose instructions. The Host View must provide glanceable, atomic cues that reduce communication clutter without harming delivery.
* **Numeric Boundary & Zero-Handling Rules:**
  $$\text{Avoidable Message Reduction Rate} \ge 30.0\% \quad (\text{or } N_{\text{avoidable, LiveLift}} \le 2 \text{ if Baseline } = 0)$$
  $$\frac{\sum \mathbf{1}(T_{\text{comprehend}} \le 5.0\text{s})}{N_{\text{cues}}} \ge 80.0\%$$
  $$N_{\text{speech\_stumbles\_caused\_by\_cue}} = 0$$
  - *Zero-Baseline Rule for Avoidable Messages:* If baseline avoidable messages $N_{\text{avoidable, Base}} = 0$, percentage reduction is undefined ($0/0$); LiveLift passes if $N_{\text{avoidable, LiveLift}} \le 2$ messages (maintaining near-zero disruption). If $N_{\text{avoidable, LiveLift}} > 2$, it is scored as a coordination regression (FAIL).
  - *Zero-Denominator Rule for Cue Comprehension:* If $N_{\text{cues}} = 0$ due to cue dispatch failure during a trial, cue comprehension is scored as $0.0\%$ (FAIL); if zero cues were planned in a control run, it is marked N/A.
* **Gated Architecture:** Host View (P0.5) is evaluated as an **independent, decoupled sub-study**. If Host View fails to achieve these thresholds, it is eliminated or pivoted to Desk-Only (Pivot A), without invalidating the core Operator Desk (P0).
* **Scoring Rubric:**
  - `PASS`: $\ge 30.0\%$ fewer avoidable messages (or $\le 2$ if baseline is 0), $\ge 80.0\%$ cues comprehended in $\le 5$s, and zero delivery degradation.
  - `FAIL (PIVOT A)`: Messages not reduced or host exhibits teleprompter glaze / speech stumbles; trigger immediate Desk-Only pivot.

---

### 3.8 Dimension 8: Post-Show Fact Accuracy & Review Reconciliation (Metric M10)
* **Operational Rationale:** Reconstructing what occurred during a live show is vital for merchant brand reporting and revenue settlement. LiveLift must eliminate painful manual video scrubbing and argument.
* **Numeric Boundary:**
  $$\text{Total Review Duration } (T_{\text{recon}}) \le 5.0\text{ minutes}$$
  $$\text{Percentage Improvement in Median } T_{\text{recon}} \ge 30.0\%$$
  $$A_{\text{facts}} \ge 80.0\% \quad (\ge 4 \text{ out of 5 standardized probes correct per trial; } \ge 90.0\% \text{ pooled across paired trials})$$
* **Evaluation Method:** Timed 5-minute reconciliation task followed by standardized 5-question factual audit administered per trial (matching the 5 probes in the task scripts; 10 probes pooled across the paired trial battery).
* **Scoring Rubric:**
  - `PASS`: Review completed $\le 5.0$m, median $\ge 30.0\%$ faster than baseline, and $A_{\text{facts}} \ge 80.0\%$ per trial ($\ge 90.0\%$ pooled).
  - `MARGINAL`: Review takes $5.1\text{--}8.0$m, or accuracy is $75.0\%\text{--}89.9\%$.
  - `FAIL`: Review takes $> 8.0$m, or accuracy is $< 75.0\%$; review engine untrustworthy.

---

### 3.9 Dimension 9: Feasible Next LIVE Adaptation (Metric M11)
* **Operational Rationale:** Post-show review is incomplete if operators cannot rapidly turn operational learnings (+2m Hero, -1m Intro) into a constraint-feasible rundown for tomorrow's show. LiveLift must provide rapid, feasible plan generation.
* **Numeric Boundary:**
  $$\text{Next LIVE Planning Time } (T_{\text{plan}}) \le 5.0\text{ minutes}$$
  $$\text{Percentage Improvement in Median } T_{\text{plan}} \ge 30.0\%$$
  $$\text{Plan Feasibility Rate } (\text{Feas}) \ge 90.0\% \quad (\text{Respects all floors and anchors})$$
  $$\text{Total Post-Show Envelope: } T_{\text{recon}} + T_{\text{plan}} \le 5.0\text{ minutes total}$$
* **Evaluation Method:** Timed 5-minute next-plan adaptation task followed by mathematical constraint verification of the resulting draft rundown.
* **Scoring Rubric:**
  - `PASS`: $T_{\text{plan}} \le 5.0$m, median $\ge 30.0\%$ faster than baseline, $\text{Feas} \ge 90.0\%$, and total combined post-show duration $T_{\text{recon}} + T_{\text{plan}} \le 5.0$m.
  - `MARGINAL`: Planning takes $5.1\text{--}8.0$m, or feasibility is $75.0\%\text{--}89.9\%$.
  - `FAIL`: Planning takes $> 8.0$m, or $\text{Feas} < 75.0\%$; planning engine generates broken schedules.

---

### 3.10 Dimension 10: Subjective Operator & Team Preference
* **Operational Rationale:** Behavioral efficiency must translate into genuine commercial preference. If operators outperform with LiveLift but still choose Google Sheets for their next real broadcast, product adoption will fail in the wild.
* **Numeric Boundary:**
  $$\frac{N_{\text{operators\_choosing\_LiveLift}}}{N_{\text{total\_operators}}} \ge 70.0\%$$
* **Evaluation Method:** Forced-choice post-test interview commitment probe: *"If you were directing tomorrow's real live sales broadcast, which tool would you voluntarily mandate for your studio, and why?"*
* **Scoring Rubric:**
  - `PASS`: $\ge 70.0\%$ of operators choose LiveLift.
  - `MARGINAL`: $50.0\%\text{--}69.9\%$ choose LiveLift; triggers qualitative UX refinement and blocks immediate BUILD without resolution.
  - `FAIL`: $< 50.0\%$ choose LiveLift; operators prefer spreadsheet/chat (Triggers KILL K6).

---

### 3.11 Gate G1 Post-Authorization Field Acceptance: Voluntary Repeat Use
* **Operational Rationale:** Laboratory trials prove capability; field trials prove utility. Before authorizing cloud backend development (Phase 2), LiveLift must prove sticky in repeated live studio operations.
* **Numeric Boundary:**
  $$\text{Count}(\text{Merchant Teams Completing } \ge 3 \text{ Consecutive Sessions}) \ge 3\text{ teams}$$
* **Timing & Execution:** Evaluated exclusively at **Gate G1** during Phase 1 functional field trials, not during the Phase 0 laboratory concept test.
* **Scoring Rubric:**
  - `PASS`: At least 3 independent recurring merchant teams voluntarily use the Phase 1 single-device desk across $\ge 3$ consecutive production broadcasts.
  - `FAIL`: Teams abandon the desk after 1 session or refuse field deployment.

---

## 4. Hard Disqualification Triggers (Zero Tolerance)

Regardless of aggregate quantitative metric performance, the activation of any of the following four **Hard Disqualification Triggers** results in an **immediate experimental failure and disqualification** of the prototype build:

```
+----------------------------------------------------------------------------------------------------+
|                               HARD DISQUALIFICATION TRIGGERS (ZERO TOLERANCE)                      |
+----+----------------------------+------------------------------------------------------------------+
| #  | Trigger Name               | Operational Violation Definition                                 |
+----+----------------------------+------------------------------------------------------------------+
| T1 | Silent Anchor Shift        | The software automatically shifts, reschedules, or alters a      |
|    |                            | hard promotional anchor in time without explicit, active human    |
|    |                            | authorization. (Hiding deficits by sliding the anchor forward).  |
+----+----------------------------+------------------------------------------------------------------+
| T2 | False Confirmed Action     | The software indicates, confirms, or implies to the user that a  |
|    |                            | native TikTok Shop action (pinning, vouchers, price cuts) was     |
|    |                            | executed on the platform, when it was only locally reported.     |
+----+----------------------------+------------------------------------------------------------------+
| T3 | Lost Acknowledged Command  | An operator command (start segment, extend, note, transition)    |
|    |                            | acknowledged by the UI is dropped, rolled back, or lost from the |
|    |                            | local event stream, causing data corruption or desync.           |
+----+----------------------------+------------------------------------------------------------------+
| T4 | Prototype Crash / Lockup   | An unhandled software crash, blank screen, frozen cursor, or     |
|    |                            | memory leak that interrupts broadcast operations for > 15s.      |
+----+----------------------------+------------------------------------------------------------------+
```

### 4.1 Trigger T1: Silent Anchor Shift
* **Rationale:** In live commerce, changing the scheduled time of a flash sale without notifying the host or audience breaches platform rules and damages viewer trust. If an overrun occurs, the software must show an explicit **Deficit Alert**; it must **never** silently recalculate the anchor start time to make the rundown look green.
* **Violation Check:** Any code or UI behavior where `anchor.start_time` moves dynamically with upstream delays without a logged operator confirmation.

### 4.2 Trigger T2: False Confirmed Action
* **Rationale:** Third-party software cannot programmatically execute actions inside TikTok Shop Seller Center. A tool that marks an action as "Confirmed on TikTok" creates catastrophic false confidence.
* **Violation Check:** Any event or UI label claiming `confirmed_by_platform` rather than `operator_reported`.

### 4.3 Trigger T3: Lost Acknowledged Command
* **Rationale:** If an operator clicks "Next Segment" and turns their attention back to the broadcast, losing that transition event due to race conditions or unhandled state transitions invalidates all downstream metrics.
* **Violation Check:** Any discrepancy between the command receipt log and the persisted runtime state.

### 4.4 Trigger T4: Prototype Crash / Invalidation
* **Rationale:** Live broadcast operations do not pause for software reboots. A crash during a live show is an unforgivable failure.
* **Violation Check:** Any unrecoverable exception, white screen of death, or frozen thread requiring browser restart.

---

## 5. Statistical Power, Sample Size & Governance Gates

### 5.1 Sample Size & Statistical Power
* **Sample Size ($N$):** $N = 6 \text{ to } 10$ operator-host participant pairs (representing at least 3 distinct recurring merchant teams).
* **Statistical Framework:** Nonparametric paired analysis using the **Wilcoxon Signed-Rank Test** ($W$).
* **Significance Level:** $\alpha = 0.05$ (two-tailed).
* **Effect Size & Power:** For a paired sample of $N = 8$ pairs, the design achieves $\ge 80\%$ power to detect large operational effect sizes ($d \ge 1.1$, corresponding to $\ge 30\%$ median improvements in latencies and $\ge 20\%$ in NASA-TLX workload).
* **Confidence Reporting:** For all continuous metrics, report the Hodges-Lehmann median difference estimator and its distribution-free $95\%$ confidence interval.

### 5.2 Primary vs Secondary Gate Architecture

```
+----------------------------------------------------------------------------------------------------+
|                                    GATE GOVERNANCE ARCHITECTURE                                    |
+-------------------+----------------------------+---------------------------------------------------+
| Gate Level        | Scope & Timing             | Evaluation Criteria                               |
+-------------------+----------------------------+---------------------------------------------------+
| **Gate G0**       | Laboratory Phase 0 Trial   | Must pass Thresholds 01 through 10 (including      |
| (Validation Gate) | (Fixture UI + WoZ Engine)  | Threshold 10: Operator Preference >= 70.0%)        |
|                   |                            | AND zero disqualification triggers T1–T4.          |
|                   |                            | Authorizes Phase 1 Single-Device Engineering.     |
+-------------------+----------------------------+---------------------------------------------------+
| **Gate G1**       | In-Vivo Phase 1 Pilot      | Must maintain Gate G0 metrics in live studio      |
| (Functional Gate) | (Local SQLite/IndexedDB)   | setting AND pass In-Vivo Repeat Use Acceptance    |
|                   |                            | (>= 3 distinct teams, >= 3 live shows each).      |
|                   |                            | Authorizes Phase 2 One-Room Server Architecture.  |
+-------------------+----------------------------+---------------------------------------------------+
```

---

## 6. Subgroup Analysis & Edge Cohort Rules

To ensure findings are robust and not an artifact of novice participants, subgroup analyses must be independently calculated and disclosed for the following mandatory cohorts:

1. **Spreadsheet Power-User Subgroup ($n \ge 1$):**
   - *Requirement:* Must include at least 1 advanced operator with mastery of Google Sheets formulas and macros.
   - *Rule:* If the power-user achieves superior recovery and review speeds with Google Sheets compared to LiveLift, the finding must be analyzed: Does LiveLift only benefit novices, or does it provide genuine structural advantage?
2. **Skeptical Operator Subgroup ($n \ge 1$):**
   - *Requirement:* Must include at least 1 operator who explicitly prefers paper rundowns or minimal tooling.
   - *Rule:* Used to evaluate whether the capture burden (Threshold 5) induces operational resistance.
3. **Professional Rundown Challengers ($n \ge 2$):**
   - *Requirement:* At least 2 operators must evaluate LiveLift against a configured professional broadcast tool (Ontime / Shoflo / Rundown Studio).
   - *Rule:* Benchmarks LiveLift's live commerce domain specialization against generic broadcast software.
4. **Simple-Show Counterexample ($n = 1$ team):**
   - *Requirement:* 1 merchant team running unstructured, 2-SKU conversational live streams.
   - *Rule:* Validates the lower boundary of product utility, proving where LiveLift is unnecessary.
