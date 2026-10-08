# LiveLift V3 Quantitative Measurement Instrument & Data Dictionary

**Document ID:** `VAL-V3-MEAS-08`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 4 (Measurement, Thresholds & Decisions)  
**Classification:** Empirical Data Collection Instrument & Mathematical Dictionary  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §5, §16, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §3, §7; `docs/validation/v3/04_TEST_SCENARIO.md`; `docs/validation/v3/07_DISTURBANCE_TIMELINE.md`; `docs/validation/v3/09_OBSERVER_CHECKLIST.md`

---

## 1. Executive Summary & Data Governance

This specification establishes the authoritative mathematical formulas, operational variable definitions, data schemas, and standardized raw logging instruments for the LiveLift V3 Product Validation Program.

### 1.1 Integrity & Research Stance
In strict compliance with the **Integrity Mandate**, all measurements must represent genuine, audited behavioral observations. Fabricated telemetry, post-hoc smoothing, omitted outliers, or biased data transformations are strictly prohibited. 

Every trial in the dual-arm within-subjects trial is recorded across two synchronized video tracks (Observer 1 Technical/Timing and Observer 2 Human Factors). All timing points must be reconcilable to millisecond timecodes (`HH:MM:SS.mmm`) derived from the master Network Time Protocol (NTP) time server.

```
+----------------------------------------------------------------------------------------------------+
|                                MEASUREMENT ARCHITECTURE DATA PIPELINE                               |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ EXPERIMENTAL RUN ] ---> [ DUAL-RATER OBSERVER LOGS ] ---> [ NTP-ALIGNED AUDIT ]               |
|      Condition A & B           Obs 1: Millisecond actions        Inter-Rater Reliability           |
|      15-minute trials          Obs 2: Communication/Gaze         ICC(2,1) >= 0.90                  |
|                                                                        │                           |
|                                                                        ▼                           |
|    [ PASS/FAIL GATES ] <--- [ PAIRED DIFFERENCE CALC ] <--- [ DERIVED METRICS SHEET ]              |
|      11_THRESHOLDS.md          Wilcoxon Signed-Rank Test         08_MEASUREMENT_SHEET.md           |
|      13_DECISION.md            Hodges-Lehmann Estimator          T_detect, T_decision, V_anchor    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

### 2. Mathematical Data Dictionary & Metric Formulas

The validation program operationalizes the core operational dimensions into eleven primary quantitative metrics (M1–M11). These metrics map systematically to the ten decision dimensions defined in `docs/validation/v3/11_PASS_FAIL_THRESHOLDS.md`.

```
+----------------------------------------------------------------------------------------------------+
|                                    SUMMARY METRIC FORMULA MATRIX                                    |
+----+----------------------------+-----------------------+------------------------------------------+
| ID | Metric Name                | Unit / Scale          | Authoritative Mathematical Formula       |
+----+----------------------------+-----------------------+------------------------------------------+
| M1 | Setup Time (T_setup)       | Minutes (float)       | (t_ready - t_session_init) / 60          |
| M2 | Detection Latency (T_detect| Seconds (float)       | t_detect - t_stimulus (correct anchor)   |
| M3 | Decision Latency (T_decis) | Seconds (float)       | t_action - t_detect; T_total=t_act-t_stim|
| M4 | Recovery Validity Rate     | Percentage (%)        | (N_valid_decisions / N_total) * 100      |
| M5 | Anchor Variance (V_anchor) | Seconds (float)       | |t_actual_verbal - t_committed_anchor|   |
| M6 | Plan-vs-Actual Error Rate  | Percentage (%)        | (N_err_boundaries / N_total) * 100       |
| M7 | Routine Capture Burden     | Clicks & Seconds      | Clicks per transition; t_log - t_pitch   |
| M8 | Avoidable Host Messages    | Count & Ratio (%)     | N_avoidable_msgs; (N_avoid/N_msgs) * 100 |
| M9 | Cognitive Workload (TLX)   | Scale (0 - 100)       | Sum(Subscales) / 6 (Raw NASA-TLX)        |
| M10| PVA Review & Reconstruction| Minutes & Accuracy %  | T_recon; (N_correct / 5) * 100           |
| M11| Next LIVE Adaptation       | Minutes & Feasibility | T_plan; Binary Constraint Check          |
+----+----------------------------+-----------------------+------------------------------------------+
```

---

### 2.1 Metric 1 (M1): Setup Time ($T_{\text{setup}}$) & Configuration Errors ($N_{\text{config\_errors}}$)
* **Definition:** Total elapsed wall-clock duration in minutes required for the operator to initialize the show environment, verify catalog SKUs, configure hard anchors, and declare readiness for live broadcast, alongside the count of configuration/import errors committed.
* **Mathematical Formula:**
  $$T_{\text{setup}} = \frac{t_{\text{ready}} - t_{\text{session\_init}}}{60}$$
  * $t_{\text{session\_init}}$: Timestamp when the operator opens the blank/imported rundown template.
  * $t_{\text{ready}}$: Timestamp when the operator signals complete readiness to the proctor.
* **Unit of Measure:** Minutes (decimal format, rounded to 2 decimal places); Error count (integer).
* **Target:** $T_{\text{setup}} \le 10.0\text{ min}$, $\Delta T_{\text{setup}} \le 2.0\text{ min}$ compared to baseline median, and $N_{\text{config\_errors}} \le 2$ configuration errors during show setup/catalog import.

---

### 2.2 Metric 2 (M2): Schedule-Risk Detection Latency ($T_{\text{detect}}$)
* **Definition:** Elapsed duration in seconds from the exact mathematical injection of an operational disturbance or schedule deficit to the operator's *correct identification* of the specific threatened anchor or deficit condition.
* **Mathematical Formula:**
  $$T_{\text{detect}} = t_{\text{detect}} - t_{\text{stimulus}}$$
  * $t_{\text{stimulus}}$: Authoritative ground-truth timestamp when the disturbance condition mathematically emerges:
    - *Disturbance D1 (Overrun Deficit):* The exact second when active elapsed time plus remaining floating durations causes the projected cursor to exceed the hard anchor commitment ($T_{\text{projected}} > T_{\text{anchor}}$).
      - In **Scenario 1**, this occurs at $T = 06:30$ ($T_{\text{start}}(S2) + 4\text{m}30\text{s}$), where active elapsed 4m30s plus remaining estimated 1m00s on Serum plus 3m00s floating Toner projects Flash Sale at 10:30 (+90s deficit vs 09:00:00 anchor).
      - In **Scenario 2**, this occurs at $T = 09:30$ ($T_{\text{start}}(S3) + 6\text{m}00\text{s}$), where active elapsed 6m00s plus remaining estimated 1m45s (1.75m) on Earbuds projects Earbuds completion at 11:15 (+45s deficit vs 10:30:00 anchor).
    - *Disturbance D3 (Stockout):* The exact second the mock Seller Center console displays `Tồn kho = 0` ($T = 10:15$ in Scenario 1; $T = 03:15$ in Scenario 2).
    - *Disturbance D4 (Console Lag):* The exact second the operator initiates product pin and encounters the 40s spinner ($T = 10:30$ in Scenario 1; $T = 10:30$ in Scenario 2).
    - *Disturbance D5 (Under-run):* The exact second the host speaks the unscripted pacing wrap phrase ($T = 12:00$ in Scenario 1; $T = 13:15$ in Scenario 2).
  * $t_{\text{detect}}$: Authoritative timestamp of operator's **correct identification** of the at-risk anchor or deficit condition:
    - *Identification Criterion:* The operator must correctly identify the threatened anchor or disturbance. Physical gaze shifts or cursor jitter alone do **not** qualify as detection without verified recognition.
    - *Observable Behavioral Markers:*
      - *Verbal Marker:* Spoken acknowledgment naming the specific threatened anchor or issue (*"Lệch giờ Flash Deal rồi"*, *"Trễ mốc 09:00"*, *"Hết hàng mã Serum"*).
      - *Software Marker:* Opening the recovery drawer for that anchor, selecting the at-risk row, or initiating a constraint-valid recovery action.
* **Unit of Measure:** Seconds (decimal format, rounded to 1 decimal place).
* **Target:** $\ge 80.0\%$ of eligible schedule deficit opportunities ($N_{\text{opp}}$) recognized within $T_{\text{detect}} \le 10.0\text{ seconds}$ with correct anchor identification.
* **Empty Recognition Denominator Rule ($N_{\text{opp}} = 0$):** If no eligible recognition opportunities were administered or all were aborted ($N_{\text{opp}} = 0$), recognition accuracy cannot be computed ($0/0$). Observers must NOT divide by zero and must NOT fabricate detections. The metric disposition is strictly recorded as **`N/A — INVALID FOR SCORING / RETEST REQUIRED`**; the affected trial must be re-administered.

---

### 2.3 Metric 3 (M3): Recovery Decision Latency ($T_{\text{decision}}$) & Total Recovery Latency ($T_{\text{total}}$)
* **Definition:** 
  1. *Decision Latency ($T_{\text{decision}}$):* Elapsed duration in seconds from verified risk detection ($t_{\text{detect}}$) to the execution of a recovery command or dispatch of a recovery cue ($t_{\text{action}}$).
  2. *Total Recovery Latency ($T_{\text{total}}$):* Total elapsed duration from mathematical stimulus injection ($t_{\text{stimulus}}$) to recovery action execution ($t_{\text{action}}$):
     $$T_{\text{total}} = t_{\text{action}} - t_{\text{stimulus}} = T_{\text{detect}} + T_{\text{decision}}$$
* **Mathematical Formulas:**
  $$T_{\text{decision}} = t_{\text{action}} - t_{\text{detect}}$$
  $$T_{\text{total}} = t_{\text{action}} - t_{\text{stimulus}}$$
* **Unit of Measure:** Seconds (decimal format, rounded to 1 decimal place).
* **Target:** Median $T_{\text{decision}}$ and median $T_{\text{total}}$ at least **$30.0\%$ faster** than baseline median.

---

### 2.4 Metric 4 (M4): Recovery Constraint Validity Rate ($R_{\text{valid}}$)
* **Definition:** Percentage of recovery decisions that satisfy all declared product constraints (contractual floor durations, hard anchor inviolability, non-negative buffers, and non-retroactive absorption).
* **Mathematical Formula:**
  $$R_{\text{valid}} = \left( \frac{\sum_{i=1}^{N_{\text{decisions}}} \mathbf{1}_{\text{valid}}(i)}{N_{\text{decisions}}} \right) \times 100\%$$
  where indicator function $\mathbf{1}_{\text{valid}}(i) = 1$ if and only if all the following hold:
  1. $\text{Duration}(S_k) \ge \text{Floor\_Duration}(S_k)$ for all affected segments $S_k$ (unless explicit authorized emergency stockout exception applies).
  2. $\text{Projected\_Start}(\text{Anchor}_j) \le \text{Committed\_Time}(\text{Anchor}_j)$ (Hard anchor is protected).
  3. No downstream segment occurring *after* an anchor is shortened to solve a deficit occurring *before* that anchor.
* **Zero-Denominator Rule:** If no recovery decisions were attempted during an overrun trial ($N_{\text{decisions}} = 0$), $R_{\text{valid}} = 0.0\%$ (FAIL). An unhandled overrun cannot pass validity with an empty denominator.
* **Unit of Measure:** Percentage ($0.0\%\text{--}100.0\%$).
* **Target:** $R_{\text{valid}} \ge 90.0\%$ constraint-valid recovery choices across all trials.

---

### 2.5 Metric 5 (M5): Hard Promotion Anchor Protection & Variance ($V_{\text{anchor}}$)
* **Definition:** Absolute deviation in seconds between the actual on-camera broadcast execution of a hard promotional anchor and its immutable pre-scheduled wall-clock commitment.
* **Separation of Verbal Execution vs Native Platform Delay:**
  - $t_{\text{actual\_verbal}}$: Authoritative timestamp when the host officially announces and unlocks the promotion on camera.
  - $t_{\text{actual\_pin}}$: Timestamp when the product card pin is verified active in Seller Center.
  - $\Delta t_{\text{platform}} = t_{\text{actual\_pin}} - t_{\text{pin\_command}}$: Native platform execution delay.
  - *Scoring Rule:* Host verbal announcement adherence ($V_{\text{anchor, verbal}}$) evaluates the operator's timing control. When native platform lag occurs (such as the deliberate 40s console spinner in Scenario 2 D4), platform delay is recorded separately as external technical latency $\Delta t_{\text{platform}}$ and is not penalized as an operator timing failure, provided the operator dispatched the required holding cue and the host executed verbal countdown at the anchor.
* **Mathematical Formula:**
  $$V_{\text{anchor}} = |t_{\text{actual\_verbal}} - t_{\text{committed\_anchor}}|$$
  * $t_{\text{committed\_anchor}}$: Pre-scheduled wall-clock commitment ($09:00:00$ and $14:00:00$ in Scenario 1; $10:30:00$ and $14:00:00$ in Scenario 2).
* **Binary Adherence Classification:**
  $$\text{Status}_{\text{anchor}} = \begin{cases} 
  \text{PASS (Synchronized)}, & \text{if } V_{\text{anchor}} \le 15.0\text{ seconds} \\
  \text{MARGINAL (Delayed)}, & \text{if } 15.0\text{s} < V_{\text{anchor}} \le 30.0\text{ seconds} \\
  \text{CRITICAL MISS (Failed)}, & \text{if } V_{\text{anchor}} > 30.0\text{ seconds or omitted entirely}
  \end{cases}$$
* **Target:** Exactly **0 critical unintended anchor misses** across all trials; median $V_{\text{anchor}} \le 15.0\text{ seconds}$; no increase in anchor misses compared to baseline.

---

### 2.6 Metric 6 (M6): Plan-vs-Actual Boundary Error Rate ($E_{\text{PVA}}$)
* **Definition:** The proportion of segment start and end transitions where the operator's recorded runtime timestamp deviates by more than $15.0$ seconds from audited ground-truth video timecode, or where transitions are skipped or erroneously marked.
* **Mathematical Formula:**
  $$E_{\text{PVA}} = \left( \frac{N_{\text{erroneous\_boundaries}}}{N_{\text{total\_boundaries}}} \right) \times 100\%$$
  where a boundary $b$ is classified as erroneous if:
  $$\mathbf{1}_{\text{err}}(b) = \begin{cases} 
  1, & \text{if } |t_{\text{logged}}(b) - t_{\text{ground\_truth}}(b)| > 15.0\text{ seconds} \\
  1, & \text{if } b \text{ was omitted / unrecorded} \\
  1, & \text{if } b \text{ was falsely recorded (ghost transition)} \\
  0, & \text{otherwise}
  \end{cases}$$
  For a 6-segment rundown with 12 discrete transition boundaries (Start and End per segment):
  $$N_{\text{total\_boundaries}} = 12$$
* **Target:** $E_{\text{PVA}} \le 10.0\%$ (no more than 1 erroneous boundary per 15-minute trial).

---

### 2.7 Metric 7 (M7): Routine Capture Burden ($N_{\text{commands}}$ & $T_{\text{capture}}$)
* **Definition:** The operational effort required to record a standard, non-disturbed segment transition during the live broadcast.
* **Components:**
  1. *Interaction Command Count ($N_{\text{commands}}$):* Total discrete physical inputs (mouse clicks or keystrokes) required to complete a single segment transition.
  2. *Capture Latency ($T_{\text{capture}}$):* Elapsed time in seconds from the moment the host completes a segment pitch on camera ($t_{\text{pitch\_end}}$) to the moment the transition is saved in the tool ($t_{\text{log\_saved}}$).
* **Mathematical Formula:**
  $$T_{\text{capture}} = t_{\text{log\_saved}} - t_{\text{pitch\_end}}$$
* **Target:** $\le 1$ command per transition; median $T_{\text{capture}} \le 3.0\text{ seconds}$; $\ge 90\%$ of boundaries recorded within $15\text{ seconds}$.

---

### 2.8 Metric 8 (M8): Avoidable Host Coordination Messages & Disruption
* **Definition:** Evaluates the cognitive and communicative friction between the behind-the-scenes operator and on-camera talent, focusing on avoidable timing inquiries, clarification queries, and delivery fluency.
* **Component Formulas:**
  1. **Total Coordination Message Volume ($N_{\text{msgs}}$):** Total count of cues, chat messages, and whiteboard signals.
  2. **Avoidable Timing Message Count ($N_{\text{avoidable}}$) & Ratio ($R_{\text{avoidable}}$):**
     $$N_{\text{avoidable}} = \text{Count}(\text{Timing checks, pace inquiries, and transition clarifications})$$
     $$R_{\text{avoidable}} = \left( \frac{N_{\text{avoidable}}}{N_{\text{msgs}}} \right) \times 100\%$$
     *(Clarification queries: "Còn mấy phút?", "Ủa qua mã chưa?", "Cắt hay giữ?", "Nhanh lên")*
  3. **Host Comprehension Latency ($T_{\text{comprehend}}$):**
     $$T_{\text{comprehend}} = t_{\text{host\_pivot}} - t_{\text{cue\_dispatched}}$$
  4. **Behavioral Speech Stumble Rate ($N_{\text{stumble}}$):** Count of verbal stutters or halts ($>2$s) occurring within 5 seconds of cue reception.
  5. **Teleprompter Glaze Incidents ($N_{\text{glaze}}$):** Count of occurrences where host gaze freezes on the cue screen for $>4.0$ continuous seconds.
* **Zero-Baseline & Zero-Denominator Rules:**
  - *Avoidable Messages:* If baseline avoidable messages $N_{\text{avoidable, baseline}} = 0$, percentage reduction is undefined ($0/0$). In this condition, LiveLift passes if $N_{\text{avoidable, LiveLift}} \le 2$ messages (maintaining near-zero disruption). If baseline is 0 and LiveLift produces $> 2$ avoidable messages, it is scored as a coordination regression.
  - *Cue Comprehension:* If zero cues are dispatched due to system or operator failure ($N_{\text{cues}} = 0$), cue comprehension is scored as $0.0\%$ (FAIL); in a control run where no cues were planned, comprehension is recorded as N/A.
* **Target:** $\ge 30.0\%$ reduction in avoidable message volume (or $\le 2$ messages if baseline is 0); $\ge 80.0\%$ of cues comprehended within $T_{\text{comprehend}} \le 5.0\text{ seconds}$; zero speech stumbles or delivery degradation caused by cues.

---

### 2.9 Metric 9 (M9): NASA-TLX Subjective Cognitive Workload
* **Definition:** Standardized measurement of operator multi-tasking strain administered immediately post-trial across the 6 validated dimensions of the NASA Task Load Index (Mental Demand, Physical Demand, Temporal Demand, Performance Satisfaction, Effort, Frustration Level).
* **Mathematical Formula (Raw NASA-TLX Score):**
  $$\text{NASA-TLX}_{\text{Raw}} = \frac{\text{MD} + \text{PD} + \text{TD} + \text{OP} + \text{EF} + \text{FR}}{6}$$
  where each subscale is scored on a $0\text{--}100$ scale in 5-point increments.
* **Target:** Median $\text{NASA-TLX}_{\text{Raw}}$ score in LiveLift is at least **$20.0\%$ lower** than Baseline median ($p < 0.05$), **OR** non-inferior ($\text{Median}(\text{TLX}_{\text{LiveLift}}) \le \text{Median}(\text{TLX}_{\text{Base}})$, $\Delta\text{TLX} \le 0.0$, zero workload increase) provided recovery decision latency ($T_{\text{decision}}$) demonstrates statistically significant improvement ($p < 0.05$) AND recovery validity $R_{\text{valid}} \ge 90.0\%$. Standalone workload increases ($\Delta\text{TLX} > 0.0$, including $+3$ or $+5$ points) strictly FAIL Dimension 06 and activate Trigger K3.

---

### 2.10 Metric 10 (M10): Post-Show PVA Review & Fact Reconciliation ($T_{\text{recon}}$ & $A_{\text{facts}}$)
* **Definition:** 
  1. *Reconstruction Duration ($T_{\text{recon}}$):* Clock time in minutes from show conclusion to operator producing a reconciled actual report.
  2. *Fact Accuracy Rate ($A_{\text{facts}}$):* Accuracy on a 5-item standardized factual quiz evaluating actual show occurrences without video review.
* **Mathematical Formulas:**
  $$T_{\text{recon}} = \frac{t_{\text{review\_complete}} - t_{\text{show\_end}}}{60}$$
  $$A_{\text{facts}} = \left( \frac{\sum_{k=1}^{5} \mathbf{1}_{\text{correct}}(k)}{5} \right) \times 100\%$$
* **Standardized 5-Item Post-Show Fact Battery (Matching Task Scripts):**
  1. *Probe 1:* What was the actual executed duration of Hero SKU 1?
  2. *Probe 2:* What was the exact wall-clock start time of Flash Sale Anchor 1?
  3. *Probe 3:* What was the realized timing variance on Anchor 1 ($V_{\text{anchor}}$)?
  4. *Probe 4:* At what exact elapsed time was the stockout/overrun detected?
  5. *Probe 5:* What was the net duration drift across the entire stream?
* **Target:** $T_{\text{recon}} \le 5.0\text{ minutes}$ (and median $\ge 30.0\%$ faster than baseline); $A_{\text{facts}} \ge 80.0\%$ ($\ge 4$ out of 5 probes correct per trial; $\ge 90.0\%$ pooled across trial battery).

---

### 2.11 Metric 11 (M11): Feasible Next LIVE Adaptation ($T_{\text{plan}}$ & $\text{Feas}$)
* **Definition:** 
  1. *Planning Duration ($T_{\text{plan}}$):* Elapsed wall-clock time in minutes required to produce a modified rundown for the next broadcast incorporating operational learnings (+2m Hero, -1m Intro).
  2. *Feasibility Score ($\text{Feas}$):* Binary audit confirming whether the adapted plan respects all minimum floor constraints and downstream hard anchors.
  3. *Total Post-Show Envelope:* Combined duration of Fact Reconciliation and Next LIVE Adaptation ($T_{\text{recon}} + T_{\text{plan}}$).
* **Mathematical Formulas:**
  $$T_{\text{plan}} = \frac{t_{\text{plan\_complete}} - t_{\text{plan\_start}}}{60}$$
  $$\text{Feas} = \begin{cases}
  1 \text{ (PASS)}, & \text{if } \forall S_i: \text{Planned}(S_i) \ge \text{Floor}(S_i) \text{ and } \forall A_j: \text{Projected}(A_j) \le \text{Anchor}(A_j) \\
  0 \text{ (FAIL)}, & \text{otherwise}
  \end{cases}$$
* **Target:** $T_{\text{plan}}$ median $\ge 30\%$ faster than baseline; $\text{Feas} = 1$ in $\ge 90\%$ of trials; combined post-show duration $T_{\text{recon}} + T_{\text{plan}} \le 5.0\text{ minutes total}$.

---

## 3. Paired Difference Calculations & Directional Conventions

Because the validation protocol uses a **within-subjects paired design**, the fundamental unit of analysis is the within-participant paired difference:

$$\Delta_i = \text{Score}_{\text{LiveLift}, i} - \text{Score}_{\text{Baseline}, i}$$

### 3.1 Directional Sign Conventions & Zero-Baseline Handling
Depending on the metric's operational nature, a "better" score has different mathematical signs:

```
+----------------------------------------------------------------------------------------------------+
|                                    METRIC DIRECTIONALITY MATRIX                                     |
+--------------------------+---------------------+-------------------+-------------------------------+
| Metric Category          | Desired Direction   | Superiority Sign  | Percentage Improvement Formula|
+--------------------------+---------------------+-------------------+-------------------------------+
| Latencies (T_detect,     | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
| T_decision, T_capture)   | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Variances & Errors       | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
| (V_anchor, E_PVA)        | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Avoidable Messages       | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
| (N_avoidable)            | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Cognitive Load           | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
| (NASA-TLX)               | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Accuracy & Validity      | Higher is better    | Delta > 0         | ((LiveLift - Baseline) /      |
| (R_valid, A_facts)       | (Increase)          | (Positive)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Time (T_recon, T_plan)   | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
|                          | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
```

### 3.2 Formal Zero-Baseline Division Handling
In real-world testing, certain baseline metrics may equal zero (e.g., zero anchor misses, zero avoidable messages):
1. **Undefined Denominator Rule:** If $\text{Baseline} = 0$, percentage reduction $\frac{\text{Baseline} - \text{LiveLift}}{\text{Baseline}}$ is mathematically undefined ($0/0$). Observers must **not** record `#DIV/0!` or invent arbitrary percentages.
2. **Absolute Difference Evaluation:** When $\text{Baseline} = 0$, evaluation shifts to the absolute difference:
   $$\Delta = \text{Score}_{\text{LiveLift}} - \text{Score}_{\text{Baseline}}$$
   - If $\text{Baseline} = 0$ and $\text{LiveLift} = 0$: Result is **PASS (Parity / Zero Defect Maintained)**.
   - If $\text{Baseline} = 0$ and $\text{LiveLift} > 0$: Result is **FAIL (Operational Regression)**.
   - For avoidable messages specifically, if $\text{Baseline} = 0$, LiveLift passes if $\text{Score}_{\text{LiveLift}} \le 2$ messages.
3. **Empty Recognition Denominator Rule ($N_{\text{opp}} = 0$):** If no eligible recognition opportunities were administered or all were aborted ($N_{\text{opp}} = 0$), recognition accuracy cannot be computed ($0/0$). Observers must NOT divide by zero and must NOT fabricate detections. The metric disposition is strictly recorded as **`N/A — INVALID FOR SCORING / RETEST REQUIRED`**; the affected trial must be re-administered.

---

## 4. Master Data Schema & Storage Architecture

All captured observations must conform to the following tabular schema. Variables are strictly typed and bounded.

```
+----------------------------------------------------------------------------------------------------+
|                                   DATA SCHEMA FIELD SPECIFICATIONS                                 |
+--------------------+------------+---------------+----------------------+---------------------------+
| Field Name         | Data Type  | Nullable      | Valid Range          | Description               |
+--------------------+------------+---------------+----------------------+---------------------------+
| trial_id           | String     | No            | `TR-[0-9]{3}`        | Unique trial code         |
| participant_id     | String     | No            | `P[0-9]{2}-OP`       | Operator participant ID   |
| host_id            | String     | No            | `P[0-9]{2}-HOST`     | Host participant ID       |
| condition          | Enum       | No            | `LIVELIFT`, `BASE`   | Experimental arm          |
| order_sequence     | Enum       | No            | `A_B`, `B_A`         | Counterbalanced order     |
| scenario_id        | Enum       | No            | `SCEN-01`, `SCEN-02` | Test scenario catalog     |
| trial_date         | Date       | No            | `YYYY-MM-DD`         | Date of execution         |
| obs1_rater_id      | String     | No            | `RATER-[0-9]{2}`     | Observer 1 identifier     |
| obs2_rater_id      | String     | No            | `RATER-[0-9]{2}`     | Observer 2 identifier     |
| t_setup_min        | Float      | No            | `0.00 .. 30.00`      | Setup duration (minutes)  |
| n_config_errors    | Integer    | No            | `0 .. 10`            | Setup config errors (<= 2)|
| d1_t_stimulus      | Timestamp  | No            | `HH:MM:SS.mmm`       | D1 injection timecode     |
| d1_t_detect        | Timestamp  | Yes           | `HH:MM:SS.mmm`, NULL | D1 detect time (null if unobserved/censored) |
| d1_t_action        | Timestamp  | Yes           | `HH:MM:SS.mmm`, NULL | D1 action time (null if no recovery taken)   |
| d1_t_detect_lat_s  | Float      | Yes           | `0.0 .. 120.0`, NULL | D1 detect latency (censored 120s if null)   |
| d1_t_dec_lat_s     | Float      | Yes           | `0.0 .. 120.0`, NULL | D1 decision latency (null if no action)     |
| d1_t_total_lat_s   | Float      | Yes           | `0.0 .. 120.0`, NULL | D1 total recovery lat (null if no action)   |
| d1_decision_valid  | Boolean    | No            | `TRUE`, `FALSE`      | D1 valid (FALSE if no action or violated)   |
| d2_v_anchor1_s     | Float      | No            | `0.0 .. 300.0`       | Anchor 1 verbal deviat (s)|
| d2_anchor1_status  | Enum       | No            | `PASS`, `MARG`, `FAIL`| Anchor 1 categorical grade|
| d2_platform_lag_s  | Float      | No            | `0.0 .. 120.0`       | Anchor 1 console lag (s)  |
| d3_t_detect_lat_s  | Float      | Yes           | `0.0 .. 120.0`, NULL | D3 stockout detect lat (null if unobserved) |
| d3_t_dec_lat_s     | Float      | Yes           | `0.0 .. 120.0`, NULL | D3 stockout recovery lat (null if no action)|
| d4_hold_action     | Boolean    | No            | `TRUE`, `FALSE`      | D4 holding cue dispatched |
| d5_hold_close      | Boolean    | No            | `TRUE`, `FALSE`      | D5 anchor 2 protected     |
| v_anchor2_s        | Float      | No            | `0.0 .. 300.0`       | Anchor 2 variance (s)     |
| err_boundary_count | Integer    | No            | `0 .. 12`             | Erroneous transitions     |
| pva_error_rate_pct | Float      | No            | `0.0 .. 100.0`       | PVA boundary error rate % |
| capture_clicks_avg | Float      | No            | `0.0 .. 10.0`        | Mean clicks per boundary  |
| capture_lat_med_s  | Float      | No            | `0.0 .. 30.0`        | Median capture latency (s)|
| total_coord_msgs   | Integer    | No            | `0 .. 100`            | Total cues & messages sent|
| avoidable_msgs_cnt | Integer    | No            | `0 .. 100`            | Avoidable timing messages |
| avoidable_msg_pct  | Float      | No            | `0.0 .. 100.0`       | Avoidable message ratio % |
| host_comp_lat_med_s| Float      | No            | `0.0 .. 30.0`        | Host comprehension latency|
| host_stumbles_count| Integer    | No            | `0 .. 20`             | Host speech stumbles      |
| host_glaze_count   | Integer    | No            | `0 .. 20`             | Teleprompter glaze events |
| tlx_mental_demand  | Integer    | No            | `0 .. 100`            | NASA-TLX Mental Demand    |
| tlx_phys_demand    | Integer    | No            | `0 .. 100`            | NASA-TLX Physical Demand  |
| tlx_temp_demand    | Integer    | No            | `0 .. 100`            | NASA-TLX Temporal Demand  |
| tlx_performance    | Integer    | No            | `0 .. 100`            | NASA-TLX Performance     |
| tlx_effort         | Integer    | No            | `0 .. 100`            | NASA-TLX Effort           |
| tlx_frustration    | Integer    | No            | `0 .. 100`            | NASA-TLX Frustration      |
| tlx_raw_total      | Float      | No            | `0.00 .. 100.00`      | Mean NASA-TLX raw score   |
| t_recon_min        | Float      | No            | `0.00 .. 30.00`      | Review reconstruction time|
| fact_accuracy_pct  | Float      | No            | `0.0 .. 100.0`       | Post-show fact accuracy % |
| t_plan_min         | Float      | No            | `0.00 .. 30.00`      | Next LIVE planning time   |
| next_plan_feasible | Boolean    | No            | `TRUE`, `FALSE`      | Next LIVE valid plan audit|
+--------------------+------------+---------------+----------------------+---------------------------+
```

---

## 5. Blank Session Logging Instruments

The following sheets provide standardized logging templates to be printed or imported into research tablets for each experimental trial.

---

### Sheet 5.1: Master Trial Header Block

```
====================================================================================================
LIVELIFT V3 VALIDATION PROGRAM — SESSION LOGGING HEADER
====================================================================================================
TRIAL ID:           [ TR-_________ ]            DATE:             [ YYYY-MM-DD: ______________ ]
OPERATOR ID:        [ P____-OP     ]            SCHEDULED START:  [ HH:MM:SS:   ______________ ]
HOST ID:            [ P____-HOST   ]            ACTUAL START:     [ HH:MM:SS:   ______________ ]
CONDITION:          [ ] LIVELIFT DESK (A)       [ ] GOOGLE SHEETS BASELINE (B)
ORDER SEQUENCE:     [ ] A -> B (Cohort 1)       [ ] B -> A (Cohort 2)
SCENARIO / CATALOG: [ ] SCEN-01 (Cosmetics)     [ ] SCEN-02 (Fashion/Tech)
OBSERVER 1 (TIMING):[ RATER-______ ]            OBSERVER 2 (HUMAN):[ RATER-______ ]
====================================================================================================
```

---

### Sheet 5.2: Second-by-Second Disturbance Event Logging Table

```
+----+-------------+--------------+--------------+--------------+-------------+-------------+-------------+------------+
| ID | Event Name  | Stimulus (t) | Detect (t)   | Action (t)   | T_detect(s) | T_decis(s)  | T_total(s)  | Valid?     |
+----+-------------+--------------+--------------+--------------+-------------+-------------+-------------+------------+
| D1 | Overrun     | S1: 06:30.000| __:__:__.__  | __:__:__.__  | ____._ s    | ____._ s    | ____._ s    | [ ]Y  [ ]N |
|    | Deficit     | S2: 09:30.000| Correct ID   | Cue Dispatch | (Max 10.0s) | (Action-Det)| (Action-Stm)| Violations?|
+----+-------------+--------------+--------------+--------------+-------------+-------------+-------------+------------+
| D2 | Hard Anchor | Committed    | Verbal Start | Deviat (sec) | Status      | Pinned in   | Platform Lag| Host Ready?|
|    | 1 Sync      | S1: 09:00:00 | __:__:__.__  | ____._ s     | [ ]PASS<=15 | Seller Ctr? | Spinner (s):| [ ] Yes    |
|    |             | S2: 10:30:00 |              |              | [ ]FAIL>15  | [ ] Yes     | ____._ s    | [ ] Stumble|
+----+-------------+--------------+--------------+--------------+-------------+-------------+-------------+------------+
| D3 | Mid-Pitch   | Stock = 0    | Detect (t)   | Cue Dispatch | T_detect(s) | T_decis(s)  | T_total(s)  | SKU Pulled:|
|    | Stockout    | S1: 10:15.000| __:__:__.__  | __:__:__.__  | ____._ s    | ____._ s    | ____._ s    | [ ] Next   |
|    |             | S2: 03:15.000| Correct SKU  | Emergency Cue| (Max 10.0s) |             |             | [ ] Buffer |
+----+-------------+--------------+--------------+--------------+-------------+-------------+-------------+------------+
| D4 | Console Lag | Spinner On   | Detect (t)   | Hold Cue (t) | T_detect(s) | Hold Cue?   | Dead Air?   | Spinner Dur|
|    | (40s Freeze)| S1: 10:30.000| __:__:__.__  | __:__:__.__  | ____._ s    | [ ] Yes     | [ ] None    | Actual (s):|
|    |             | S2: 10:30.000|              |              |             | [ ] No      | [ ] >5s     | ____._ s   |
+----+-------------+--------------+--------------+--------------+-------------+-------------+-------------+------------+
| D5 | Under-run   | Verbal Stall | Detect (t)   | Filler Cue   | T_detect(s) | Held 14:00? | Early Pull? | End Deviat |
|    | Script Void | S1: 12:00.000| __:__:__.__  | __:__:__.__  | ____._ s    | [ ] Yes     | [ ] Yes     | ____._ s   |
|    |             | S2: 13:15.000|              |              |             | [ ] No      | [ ] NO (OK) | (vs 14:00) |
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
| -- | Closing     | Committed    | Actual Start | Deviat (sec) | Status      | Total Run   | Final Diff |
|    | Anchor 2    | 14:00:00.000 | __:__:__.__  | ____._ s     | [ ]PASS<=15 | __:__:__.__ | ____._ s   |
|    |             |              |              |              | [ ]FAIL>15  | (15m +/-15s)|            |
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
```

---

### Sheet 5.3: Boundary Logging & Plan-vs-Actual Audit Table

```
+---+----------------------+---------------+---------------+---------------+---------------+--------+
|Seq| Segment Name         | Ground Start  | Ground End    | Logged Start  | Logged End    | Error? |
+---+----------------------+---------------+---------------+---------------+---------------+--------+
| 1 | S1: Intro & Vouchers | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 2 | S2: Hero 1 Serum     | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 3 | S3: Toner Buffer     | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 4 | S4: Flash Deal Kem   | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 5 | S5: Kem Nắng Upsell  | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 6 | S6: Kết Show Outro   | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
+---+----------------------+---------------+---------------+---------------+---------------+--------+
TOTAL ERRONEOUS BOUNDARIES (Count where |Logged - Ground| > 15s or Omitted): [ _____ / 12 ]
BOUNDARY ERROR RATE (E_PVA = Count / 12 * 100%):                            [ ____._ %  ]
```

---

### Sheet 5.4: Host Coordination, Gaze & Communication Log

```
+----------------------------------------------------------------------------------------------------+
| COORDINATION CUE & COMMUNICATION LOG (OBSERVER 2)                                                  |
+----------------------------------------------------------------------------------------------------+
| Total Coordination Cues Dispatched:                                        [ _____ cues ]          |
| Avoidable Clarification Cues ("Còn mấy phút?", "Nhanh lên", "Cắt chưa?"): [ _____ cues ]          |
| Avoidable Message Ratio (Clarifications / Total * 100%):                   [ ____._ %   ]          |
|                                                                                                    |
| Host Comprehension Latencies (Time from cue appearance to verbal pivot):                           |
|   - Cue 1 (D1 Overrun / Toner Compress): Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   - Cue 2 (D2 Pre-Anchor 30s Countdown): Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   - Cue 3 (D3 Stockout Emergency Cut):   Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   - Cue 4 (D4 Holding Action Minigame):  Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   - Cue 5 (D5 Under-run Holding Action): Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   MEDIAN HOST COMPREHENSION LATENCY:                                       [ ____._ s   ]          |
|   PERCENTAGE UNDERSTOOD IN <= 5.0 SECONDS:                                 [ ____._ %   ]          |
|                                                                                                    |
| Host Delivery Degradation Indicators:                                                              |
|   - Speech Stumble / Verbal Hesitations within 5s of cue (B-07):           [ _____ incidents ]     |
|   - Teleprompter Glaze Incidents (>4s continuous screen gaze) (B-06):      [ _____ incidents ]     |
|   - Unscripted Dead Air (>5s continuous stream silence) (B-08):            [ _____ incidents ]     |
+----------------------------------------------------------------------------------------------------+
```

---

### Sheet 5.5: NASA-TLX Cognitive Workload Questionnaire

Administered immediately following trial completion. The operator marks their rating on each continuous scale from 0 to 100 (in increments of 5):

```
+----+-----------------------+---------------------------------------------------+-------+
| ID | Subscale              | Rating Scale & Anchors                            | Score |
+----+-----------------------+---------------------------------------------------+-------+
| 01 | MENTAL DEMAND         | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 02 | PHYSICAL DEMAND       | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 03 | TEMPORAL DEMAND       | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 04 | PERFORMANCE (INVERTED)| Good|---|---|---|---|---|---|---|---|---| Poor    | [   ] |
|    | (0 = Perfect, 100=Fail| 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 05 | EFFORT                | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 06 | FRUSTRATION LEVEL     | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
|    | RAW NASA-TLX SCORE    | (MD + PD + TD + OP + EF + FR) / 6                 | [ . ] |
+----+-----------------------+---------------------------------------------------+-------+
```

---

### Sheet 5.6: Post-Show Fact Battery & Reconstruction Log

```
+----------------------------------------------------------------------------------------------------+
| POST-SHOW RECONSTRUCTION & 5-ITEM FACT AUDIT                                                       |
+----------------------------------------------------------------------------------------------------+
| Reconstruction Start: [ __:__:__ ]   Reconstruction Complete: [ __:__:__ ]  Elapsed: [ __.__ min ]  |
+----+---------------------------------------------------------------+--------------+----------------+
| #  | Factual Audit Question (Proctor Administered)                 | Correct Fact | Operator Ans |
+----+---------------------------------------------------------------+--------------+----------------+
| 1  | What was the actual executed duration of Hero SKU 1?          | S1: 5.5m     | [ ] Correct    |
| 2  | What was the exact wall-clock start time of Flash Sale Anchor?| 09:00:00     | [ ] Correct    |
| 3  | What was the realized timing variance on Anchor 1 (V_anchor)? | 0s (on-time) | [ ] Correct    |
| 4  | At what exact elapsed time was the stockout/overrun detected? | 10:15 / 06:30| [ ] Correct    |
| 5  | What was the net duration drift across the entire stream?     | 0.0m         | [ ] Correct    |
+----+---------------------------------------------------------------+--------------+----------------+
TOTAL CORRECT FACTUAL ANSWERS:                                               [ _____ / 5 ]           |
FACT ACCURACY SCORE (A_facts = Correct / 5 * 100%):                          [ ____._ %   ]          |
====================================================================================================
NEXT LIVE ADAPTATION TASK:
Planning Start: [ __:__:__ ]   Planning Complete: [ __:__:__ ]   Elapsed:    [ __.__ min  ]          |
Constraint Validation Audit:
  - Did patched allocations respect product floor minimums?                  [ ] YES   [ ] NO         |
  - Did patched allocations preserve downstream hard anchor timing?          [ ] YES   [ ] NO         |
FEASIBLE NEXT LIVE PLAN STATUS:                                              [ ] PASS  [ ] FAIL       |
====================================================================================================
```

---

## 6. Verification & Quality Assurance Method

1. **Dual-Rater Reconciliation:** After each trial, Observer 1 and Observer 2 must cross-compare logged timestamps for $t_{\text{stimulus}}$, $t_{\text{detect}}$, and $t_{\text{action}}$.
2. **Discrepancy Threshold:** Any timestamp discrepancy $> 2.0\text{ seconds}$ between raters must be arbitrated by immediate joint review of the synchronized OBS 60fps multi-track video master.
3. **Data Lock:** Reconciled values are transcribed into the official master ledger (`docs/validation/v3/12_RESULT_TEMPLATE.md`). No alterations may be made to the ledger once signed by the Validation Researcher.
