# LiveLift V3 Baseline Google Sheets & Chat Operational Specification

**Document ID:** `VAL-V3-BASE-03`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 2 (Baseline Specs & Test Scenario)  
**Classification:** Technical Specification & Baseline Benchmark Standard  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §7, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md`

---

## 1. Executive Summary & Non-Strawman Baseline Philosophy

This specification defines the official **Google Sheets + Chat Baseline** against which the **LiveLift Commerce Operations Desk (V3)** is empirically evaluated.

### 1.1 The Non-Strawman Mandate
To ensure that validation outcomes withstand scientific scrutiny and external industry audit, the baseline must represent **best-in-class spreadsheet craftsmanship**:
1. **No Artificial Handicaps:** The Google Sheets rundown is **not** an empty, static table or an unformatted text document. It is a highly capable, dynamically reactive operations model authored to the standard of an expert live-commerce operations producer.
2. **Dynamic Mathematical Modeling:** The sheet implements automated time-cascade calculations (`NOW()`, `TIME()`, `MAX()`, `ROUND()`, `IF()`, `ISBLANK()`), dynamic rolling projected start/end times, downstream schedule slippage tracking, and automated hard promotion anchor deficit warnings.
3. **Ergonomic Visual Signaling:** A 3-tier conditional formatting system provides instant peripheral alerts (active on-air status, amber 2-minute deadline warnings, bold red deficit alarms).
4. **Structured Chat Backchannel:** Communications between the operator desk and on-camera host follow a standardized, low-noise syntax (`[NOW]`, `[WARN]`, `[RECOVER]`, `[STOP]`, `[ANCHOR]`) replicating professional live-room Zalo/Telegram operations.
5. **Legitimate Basis of Comparison:** LiveLift must prove its superiority against a **competent, optimized, and fair** baseline. If LiveLift only outperforms an unmaintained or broken spreadsheet, the core product hypothesis is invalidated.

---

## 2. Workbook Architecture & Topology

The baseline workbook (`LiveLift_Val_Baseline_[SubjectID]`) consists of three dedicated sheets designed for dual-monitor or split-screen operation:

```
+----------------------------------------------------------------------------------------------------+
|                        LIVELIFT VALIDATION BASELINE WORKBOOK TOPOLOGY                              |
+----------------------------------------------------------------------------------------------------+
| 1. [00_Config]       | Global stream parameters, wall-clock start, show length, operator IDs       |
| 2. [01_Live_Rundown] | Primary 22-column operational control sheet with cascading formulas          |
| 3. [02_Summary_KPI]  | High-level dashboard: buffer pool, cumulative slip, anchor protection status|
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Sheet `00_Config` (Global Parameters)
This sheet stores static show-level metadata referenced by formulas across the workbook:

| Cell | Parameter Name | Format / Type | Example Value | Description |
|:---:|---|---|---|---|
| `B1` | `Stream_Start_Time` | Time (`HH:MM:SS`) | `20:00:00` | Official broadcast start wall-clock time. |
| `B2` | `Stream_Date` | Date (`YYYY-MM-DD`) | `2026-10-12` | Scheduled broadcast date. |
| `B3` | `Show_Title` | Text | `AuraSkin Vietnam Super Live` | Broadcast marketing campaign title. |
| `B4` | `Studio_ID` | Text | `STUDIO-HCM-01` | Physical studio facility identifier. |
| `B5` | `Operator_ID` | Text | `P01-OP` | Anonymized operator subject key. |
| `B6` | `Host_ID` | Text | `P01-HOST` | Anonymized host subject key. |
| `B7` | `Planned_Duration_Min` | Number (Dec) | `15.0` | Total scheduled show duration in minutes. |
| `B8` | `Planned_End_Time` | Formula | `=B2 + B1 + (B7 / 1440)` | Computed target broadcast sign-off datetime. |

---

## 3. Data Dictionary & Complete Column Specification (`01_Live_Rundown`)

The primary execution sheet, `01_Live_Rundown`, spans columns **A through W** (23 columns). It captures pre-show constraints, dynamic real-time rolling projections, ground-truth execution timestamps, manual operator remaining duration estimates, estimate observation timestamps, and operator notes.

```
+----------------------------------------------------------------------------------------------------+
|                                    01_LIVE_RUNDOWN COLUMN LAYOUT                                   |
+---+-------------------+---------------+------------------------------------------------------------+
|Col| Header Key        | Data Type     | Operational Role & Governance                              |
+---+-------------------+---------------+------------------------------------------------------------+
| A | Seq               | Integer       | Execution order index (1, 2, 3...)                         |
| B | Segment_Name      | String        | Descriptive segment title (e.g., "Hero 1: Serum Sáng Da")   |
| C | SKU_ID            | String        | Product identifier (e.g., "SKU-SERUM")                     |
| D | Stock_Qty         | Integer       | Initial allocated inventory units                          |
| E | Promo_Price       | Currency (VND)| Displayed live deal price (e.g., 289,000 ₫)                |
| F | Floor_Min         | Decimal Min   | Non-negotiable contractual floor duration                  |
| G | Planned_Dur_Min   | Decimal Min   | Scheduled target pitch duration                            |
| H | Is_Compressible   | Boolean       | Checkbox: Can this segment absorb upstream overruns?       |
| I | Is_Hard_Anchor    | Boolean       | Checkbox: Is start pinned to an immutable wall-clock time? |
| J | Anchor_Time       | Time          | Pinned wall-clock start time (e.g., 20:09:00 / 09:00:00)   |
| K | Planned_Start     | DateTime (Fm) | Pre-show scheduled start time (anchored to Base_DateTime)  |
| L | Planned_End       | DateTime (Fm) | Pre-show scheduled end time                                |
| M | Actual_Start      | Time (Input)  | Ground-truth start instant (`Ctrl+Shift+;` entry)          |
| N | Actual_End        | Time (Input)  | Ground-truth end instant (`Ctrl+Shift+;` entry)            |
| O | Actual_Dur_Min    | Dec (Formula) | Executed duration in decimal minutes                       |
| P | Variance_Min      | Dec (Formula) | Pacing discrepancy (Actual - Planned Duration)             |
| Q | Projected_Start   | DateTime (Fm) | Dynamic real-time estimated start based on current delay   |
| R | Anchor_Deficit_Min| Dec (Formula) | Projected delay beyond hard anchor deadline (Minutes)      |
| S | Status            | Enum Dropdown | `PENDING`, `ACTIVE`, `DONE`, `SKIPPED`                      |
| T | Host_Cue_Text     | String        | Atomic talking points and key offer constraints            |
| U | Operator_Notes    | String        | Runtime anomaly log and recovery action audit trail        |
| V | Remaining_Est_Min | Dec (Input)   | Operator-entered manual remaining duration (Minutes)       |
| W | Remaining_Est_Obs | Time (Input)  | Wall-clock observation timestamp (`Ctrl+Shift+;` entry)    |
+---+-------------------+---------------+------------------------------------------------------------+
```

### 3.1 Field Definitions & Column Rules

1. **`Seq` (Col A, Integer):** Unique 1-indexed sequence identifier. Fixed during planning.
2. **`Segment_Name` (Col B, String):** The operational title of the segment displayed to both operator and production staff.
3. **`SKU_ID` (Col C, String):** Alphanumeric SKU identifier matching TikTok Shop Seller Center.
4. **`Stock_Qty` (Col D, Integer):** Inventory count allocated to the stream. Monitored for sudden stockouts (Disturbance D3).
5. **`Promo_Price` (Col E, Currency):** Discounted live commerce retail price formatted as `#,##0 "₫"`.
6. **`Floor_Min` (Col F, Decimal Minutes):** The absolute minimum allowable broadcast duration. Any manual overrun recovery that reduces segment duration below `Floor_Min` violates commercial partner contracts and is scored as an **INVALID DECISION**.
7. **`Planned_Dur_Min` (Col G, Decimal Minutes):** The baseline planned duration allocated in the pre-show rundown.
8. **`Is_Compressible` (Col H, Boolean Checkbox):** Indicates whether this segment contains flexible buffer time ($G - F > 0$) that can be reclaimed during an overrun.
9. **`Is_Hard_Anchor` (Col I, Boolean Checkbox):** Flag marking immutable wall-clock promotional events (Flash Sales, co-funded platform vouchers, show sign-off).
10. **`Anchor_Time` (Col J, Time `HH:MM:SS`):** The exact wall-clock second when a hard promotion unlocks. Blank for floating segments.
11. **`Planned_Start` (Col K, DateTime Formula):** Static pre-show schedule cursor anchored to `Base_DateTime`.
12. **`Planned_End` (Col L, DateTime Formula):** Static pre-show segment completion time.
13. **`Actual_Start` (Col M, Time Input):** Captured live by the operator pressing `Ctrl+Shift+;` at the moment the host transitions.
14. **`Actual_End` (Col N, Time Input):** Captured live by the operator pressing `Ctrl+Shift+;` when the segment concludes.
15. **`Actual_Dur_Min` (Col O, Decimal Minutes Formula):** Realized pitch length calculated from `Actual_Start` and `Actual_End`.
16. **`Variance_Min` (Col P, Decimal Minutes Formula):** Duration difference ($O - G$). Positive indicates overrun; negative indicates under-run.
17. **`Projected_Start` (Col Q, Dynamic DateTime Formula):** Live rolling forecast cursor. Recalculates dynamically based on completed actuals, the active segment's elapsed time and stable remaining estimate anchored to observation time, and scheduled durations of pending items.
18. **`Anchor_Deficit_Min` (Col R, Decimal Minutes Formula):** Quantitative schedule deficit. Calculates the minutes by which `Projected_Start` exceeds normalized `Anchor_Time`.
19. **`Status` (Col S, Enum Dropdown):** Current operational state: `PENDING`, `ACTIVE`, `DONE`, or `SKIPPED`. Drives conditional formatting.
20. **`Host_Cue_Text` (Col T, String):** Atomic talking points ($\le 12$ words) provided for host guidance.
21. **`Operator_Notes` (Col U, String):** Real-time log where the operator records reasons for overrides, unexpected delays, or technical errors.
22. **`Remaining_Est_Min` (Col V, Decimal Minutes Input, Nullable):** Operator-entered manual estimate of remaining minutes for the currently active segment (e.g., entered when the host signals extra time required). Blank by default.
23. **`Remaining_Est_Obs` (Col W, Time Input `HH:MM:SS`, Nullable, EDITABLE Live):** Ground-truth wall-clock observation timecode captured live by the operator pressing `Ctrl+Shift+;` when the remaining estimate is observed/entered. When populated alongside `Remaining_Est_Min` (`Col V`) on an `ACTIVE` segment, the rolling projection engine evaluates estimated active segment finish as $\text{ToDateTime}(W) + \text{Remaining\_Est\_Min} / 1440$. This mathematically anchors the estimated completion to the recorded observation instant, guaranteeing that subsequent spreadsheet recalculations (e.g. at 06:45, 07:00) preserve the stable deadline and do not continuously and incorrectly add unchanged remaining minutes to advancing `NOW()`.

---

## 4. Mathematical Formulas & Dynamic Rolling Engine

All formulas utilize standard Google Sheets / Microsoft Excel syntax, maintaining absolute mathematical rigor. Time values in spreadsheets represent fractions of a 24-hour day ($1.0 = 24 \text{ hours} = 1,440 \text{ minutes} = 86,400 \text{ seconds}$).

### 4.0 Continuous DateTime Anchoring & Normalization Architecture

To eliminate cross-midnight wrap defects where date-stripped wall-clock comparisons produce astronomical false deficits (e.g., $1438.0\text{m}$ instead of $1.0\text{m}$), the baseline engine operates on continuous DateTime serial numbers:

1. **Global Base DateTime:**
   $$\text{Base\_DateTime} = \text{'00\_Config'!}\$B\$2 + \text{'00\_Config'!}\$B\$1$$
   where `$B$2` is `Stream_Date` (integer date serial) and `$B$1` is `Stream_Start_Time` (fractional day time).
2. **Timestamp Normalization Rule ($\text{ToDateTime}(t)$):**
   When operators enter time values $t \in [0, 1)$ via `Ctrl+Shift+;`, or when hard anchor times $J \in [0, 1)$ are specified, they represent time-of-day fractions. Because live broadcasts in this protocol have durations $< 24$ hours, any time value $t$ is normalized to continuous DateTime via:
   $$\text{ToDateTime}(t) = \text{'00\_Config'!}\$B\$2 + t + \text{IF}(t < \text{'00\_Config'!}\$B\$1, 1, 0)$$
   If $t < \text{Stream\_Start\_Time}$, the timestamp has crossed midnight onto the next calendar day, safely receiving a $+1.0$ day offset.
3. **Current Time Integration:**
   Spreadsheet `NOW()` returns continuous datetime serials (date + time). Formulas evaluate `NOW()` directly against continuous DateTime terms without date-stripping via `MOD(NOW(), 1)`.

---

### 4.1 Static Pre-Show Schedule Formulas

#### 1. Planned Start (`Col K`)
* **Row 2 (First Segment):**
  ```excel
  ='00_Config'!$B$2 + '00_Config'!$B$1
  ```
  *(Anchored directly to Base DateTime in sheet `'00_Config'`. Formatted as `HH:MM:SS` in the display layer).*
* **Row $i \ge 3$ (Subsequent Segments):**
  ```excel
  =K2 + (G2 / 1440)
  ```

#### 2. Planned End (`Col L`)
* **All Rows ($i \ge 2$):**
  ```excel
  =K2 + (G2 / 1440)
  ```

---

### 4.2 Dynamic Live Rolling Forecast Formulas

#### 3. Actual Duration (`Col O`)
Calculates realized duration in decimal minutes, cleanly suppressing calculation until both start and end timestamps are present, and handling cross-midnight rollover seamlessly:
```excel
=IF(OR(ISBLANK(M2), ISBLANK(N2), M2="", N2=""), "", ROUND(MOD(N2 - M2 + 1, 1) * 1440, 2))
```
* **Date/Time & Cross-Midnight Arithmetic:** In spreadsheet time serials, `MOD(N2 - M2 + 1, 1)` ensures that if a segment starts at `23:58:00` and finishes at `00:03:00`, the calculation evaluates to exactly `5.00` minutes without negative duration errors.
* **Missing Value Cleanliness:** When either boundary is missing or not yet captured, returns formula blank string `""`.

#### 4. Duration Variance (`Col P`)
Surfaces timing drift against the planned budget, with explicit blank handling to prevent `#VALUE!` errors:
```excel
=IF(OR(ISBLANK(O2), O2=""), "", ROUND(O2 - G2, 2))
```
* **Missing Actual Handling:** `OR(ISBLANK(O2), O2="")` cleanly preserves a blank cell without evaluating `"" - G2`, preventing formula calculation errors on unexecuted rows.

#### 5. Dynamic Rolling Projected Start (`Col Q`)
The rolling engine computes the projected start of every segment by evaluating the status of preceding rows, incorporating operator manual remaining estimates for active segments, and holding at hard promotional anchors:

* **Row 2 (First Segment):**
  ```excel
  =IF(AND(NOT(ISBLANK(M2)), M2<>""), '00_Config'!$B$2 + M2 + IF(M2 < '00_Config'!$B$1, 1, 0), '00_Config'!$B$2 + '00_Config'!$B$1)
  ```
* **Row $i \ge 3$ (Subsequent Segments — Modern LET Formulation, Google Sheets & Excel 365):**
  ```excel
  =LET(
    base_date, '00_Config'!$B$2,
    base_time, '00_Config'!$B$1,
    to_dt, LAMBDA(t, base_date + t + IF(t < base_time, 1, 0)),
    prior_cursor, IF(S2="DONE", to_dt(N2),
                    IF(S2="SKIPPED", Q2,
                      IF(S2="ACTIVE",
                        IF(AND(NOT(ISBLANK(V2)), V2<>""),
                          IF(AND(NOT(ISBLANK(W2)), W2<>""),
                            to_dt(W2) + (V2 / 1440),
                            to_dt(M2) + (G2 / 1440) + (V2 / 1440)
                          ),
                          MAX(NOW(), to_dt(M2) + (G2 / 1440))
                        ),
                        Q2 + (G2 / 1440)
                      )
                    )
                  ),
    IF(OR(S3="DONE", S3="ACTIVE"), to_dt(M3),
      IF(I3=TRUE, MAX(prior_cursor, to_dt(J3)), prior_cursor)
    )
  )
  ```
* **Row $i \ge 3$ (Subsequent Segments — Standard Universal Nested IF Formulation):**
  ```excel
  =IF(OR(S3="DONE", S3="ACTIVE"),
    '00_Config'!$B$2 + M3 + IF(M3 < '00_Config'!$B$1, 1, 0),
    IF(I3=TRUE,
      MAX(
        IF(S2="DONE", '00_Config'!$B$2 + N2 + IF(N2 < '00_Config'!$B$1, 1, 0),
          IF(S2="SKIPPED", Q2,
            IF(S2="ACTIVE",
              IF(AND(NOT(ISBLANK(V2)), V2<>""),
                IF(AND(NOT(ISBLANK(W2)), W2<>""),
                  '00_Config'!$B$2 + W2 + IF(W2 < '00_Config'!$B$1, 1, 0) + (V2 / 1440),
                  '00_Config'!$B$2 + M2 + IF(M2 < '00_Config'!$B$1, 1, 0) + (G2 / 1440) + (V2 / 1440)
                ),
                MAX(NOW(), '00_Config'!$B$2 + M2 + IF(M2 < '00_Config'!$B$1, 1, 0) + (G2 / 1440))
              ),
              Q2 + (G2 / 1440)
            )
          )
        ),
        '00_Config'!$B$2 + J3 + IF(J3 < '00_Config'!$B$1, 1, 0)
      ),
      IF(S2="DONE", '00_Config'!$B$2 + N2 + IF(N2 < '00_Config'!$B$1, 1, 0),
        IF(S2="SKIPPED", Q2,
          IF(S2="ACTIVE",
            IF(AND(NOT(ISBLANK(V2)), V2<>""),
              IF(AND(NOT(ISBLANK(W2)), W2<>""),
                '00_Config'!$B$2 + W2 + IF(W2 < '00_Config'!$B$1, 1, 0) + (V2 / 1440),
                '00_Config'!$B$2 + M2 + IF(M2 < '00_Config'!$B$1, 1, 0) + (G2 / 1440) + (V2 / 1440)
              ),
              MAX(NOW(), '00_Config'!$B$2 + M2 + IF(M2 < '00_Config'!$B$1, 1, 0) + (G2 / 1440))
            ),
            Q2 + (G2 / 1440)
          )
        )
      )
    )
  )
  ```

* **Mathematical Invariants of Projected Start:**
  1. **Hard-Anchor Holding / Wait:** If row $i$ has a hard anchor (`I_i = TRUE`) scheduled at `J_i`, and prior segments conclude early (`prior_cursor < ToDateTime(J_i)`), the projected start evaluates to `MAX(prior_cursor, ToDateTime(J_i)) = ToDateTime(J_i)`. The sheet explicitly models waiting for the scheduled anchor window rather than advancing prematurely.
  2. **Overrun Propagation:** If prior segments run late (`prior_cursor > ToDateTime(J_i)`), `MAX(prior_cursor, ToDateTime(J_i)) = prior_cursor`, accurately reflecting downstream delay and surfacing the anchor deficit.
  3. **Skipped Row Exclusion:** If preceding row $i-1$ is marked `SKIPPED`, its duration consumption is zero (`prior_cursor` remains `Q_{i-1}`), immediately returning the planned minutes to downstream segments.
  4. **Active Segment Projection & Stable Remaining Estimate:** If preceding row $i-1$ is currently `ACTIVE`, the engine checks Column V (`Remaining_Est_Min`) and Column W (`Remaining_Est_Obs`). If populated with observation timestamp $W_{i-1}$, projected active completion evaluates to $\text{ToDateTime}(W_{i-1}) + (V_{i-1} / 1440)$. This mathematically preserves the observed deadline across subsequent spreadsheet recalculations without drifting forward on every `NOW()` tick. If blank, it projects from $\text{MAX}(\text{NOW}(), \text{ToDateTime}(M_{i-1}) + (G_{i-1} / 1440))$, providing real-time drift telemetry.

---

### 4.3 Dynamic Hard Anchor Deficit Calculation (`Col R`)

The anchor deficit formula detects upcoming timing collisions before they breach committed promotional windows.

#### Primary Formula (23-Column Rundown, Row 2):
```excel
=IF(AND(I2=TRUE, NOT(ISBLANK(J2)), J2<>""),
  IF(Q2 > ('00_Config'!$B$2 + J2 + IF(J2 < '00_Config'!$B$1, 1, 0)),
    ROUND((Q2 - ('00_Config'!$B$2 + J2 + IF(J2 < '00_Config'!$B$1, 1, 0))) * 1440, 1),
    0
  ),
  0
)
```
* **Logic:** If `Is_Hard_Anchor` is `TRUE`, it compares `Projected_Start` (`Col Q`) against normalized `Anchor_Time` (`ToDateTime(J2)`). If `Projected_Start > ToDateTime(J2)`, the difference is converted to minutes and rounded to 1 decimal place. If the projection is on time or held at anchor (`Q2 <= ToDateTime(J2)`), returns `0.0`.

---

### 4.4 Global KPI Formulas (`02_Summary_KPI`)

The summary sheet provides aggregate telemetry across the entire broadcast, strictly honoring compressibility semantics:

| Cell | Metric Name | Exact Formula | Description |
|:---:|---|---|---|
| `B2` | `Total_Planned_Dur` | `=SUM('01_Live_Rundown'!G2:G50)` | Total scheduled duration in minutes ($15.0\text{m}$). |
| `B3` | `Total_Floor_Dur` | `=SUM('01_Live_Rundown'!F2:F50)` | Contractual minimum duration across all segments ($8.0\text{m}$ in S1, $10.0\text{m}$ in S2). |
| `B4` | `Total_Buffer_Pool` | `=SUMIFS('01_Live_Rundown'!G2:G50, '01_Live_Rundown'!H2:H50, TRUE) - SUMIFS('01_Live_Rundown'!F2:F50, '01_Live_Rundown'!H2:H50, TRUE)` | Total reclaimable buffer across compressible segments (`H=TRUE`) only (exactly $5.0\text{m}$ in both S1 and S2; non-compressible rows excluded). |
| `B5` | `Pending_Buffer_Available` | `=SUMIFS('01_Live_Rundown'!G2:G50, '01_Live_Rundown'!H2:H50, TRUE, '01_Live_Rundown'!S2:S50, "PENDING") - SUMIFS('01_Live_Rundown'!F2:F50, '01_Live_Rundown'!H2:H50, TRUE, '01_Live_Rundown'!S2:S50, "PENDING")` | Reclaimable minutes remaining in unexecuted compressible segments. |
| `B6` | `Cumulative_Slip_Min` | `=SUMIF('01_Live_Rundown'!S2:S50, "DONE", '01_Live_Rundown'!P2:P50)` | Net minutes drifted from plan across completed segments. |
| `B7` | `Active_Anchor_Deficit` | `=MAX('01_Live_Rundown'!R2:R50)` | Peak deficit facing any upcoming hard anchor. |
| `B8` | `Anchor_Protection_Status`| `=IF(B7=0, "SECURE (ON TIME)", IF(B7<=B5, "RECOVERABLE VIA BUFFER", "CRITICAL BREACH UNRECOVERABLE"))` | High-level operational alert banner. |

---

### 4.5 Mathematical Dry-Run Matrix & Proof of Parity

To verify the spreadsheet baseline under all operational conditions, the formula engine was dry-run across all six canonical edge cases:

| Test Case | Operational Scenario | Exact Inputs | Formula Execution & Behavior | Verified Output | Status |
|:---:|---|---|---|---|:---:|
| **TC-01** | **Normal Pacing** | S1 on time ($2.0\text{m}$), S2 on time ($4.0\text{m}$). Stream start `20:00:00`. | `NOW() <= Planned_End`; `Q_i = K_i`. Prior cursors match planned schedule. | `Col R` = $0.0\text{m}$. Status = `SECURE`. | **PASS** |
| **TC-02** | **Early Finish (Wait at Anchor)** | S2 finishes early at $03:30$ ($N_3 = 20:03:30$ vs planned $20:06:00$). Anchor 1 scheduled at $20:09:00$. S3 runs floor $1.0\text{m}$ to $20:04:30$. | Prior cursor = $20:04:30$. Anchor DateTime = $20:09:00$. `Q_5 = MAX(prior_cursor, Anchor_DT) = 20:09:00`. Rundown holds at anchor time; does not advance prematurely. | `Q5 = 20:09:00`. Deficit `R5 = 0.0m`. | **PASS** |
| **TC-03** | **Skipped Segment** | S3 dropped (`Status S4 = "SKIPPED"`). Preceding cursor $N_3 = 20:07:00$. S3 planned $3.0\text{m}$. | `IF(S3="SKIPPED", Q3, ...)` passes cursor $20:07:00$ directly to S4. S3 consumes exactly $0.0\text{m}$. | `Q4 = 20:07:00`. $3.0\text{m}$ buffer immediately returned downstream. | **PASS** |
| **TC-04** | **Missing Actual Boundaries** | Row unexecuted or blank boundary: $M_5 = \text{""}$, $N_5 = \text{""}$. | $O_5$ evaluates `OR(ISBLANK, "")` $\rightarrow$ returns formula blank `""`. $P_5$ evaluates `OR(ISBLANK(O5), O5="")` $\rightarrow$ returns `""`. | Zero `#VALUE!` errors. Blank cells cleanly preserved. | **PASS** |
| **TC-05** | **Cross-Midnight Rolling Forecast** | Late-night show starts $23:55:00$ on $2026-10-12$. S2 starts $23:58:00$ ($M_3 = 23:58:00$, planned $5.0\text{m}$, scheduled finish next-day $00:03:00$). At wall-clock $00:06:00$ on $2026-10-13$, Hard Anchor is at next-day $00:05:00$ ($J_4 = 00:05:00$). | $M_3\text{ DT} = 2026-10-12\ 23:58:00$. Scheduled finish $= 2026-10-13\ 00:03:00$. $\text{NOW}() = 2026-10-13\ 00:06:00$. Active finish $= \text{MAX}(\text{NOW}(), \text{Sched}) = 00:06:00$. $J_4\text{ DT} = 2026-10-13\ 00:05:00$. $Q_4 = 00:06:00$. Col R evaluates $(Q_4 - J_4\text{ DT}) \times 1440 = 1.0\text{m}$. | **`R4 = 1.0m`** (True active lower-bound deficit). The $1438.0\text{m}$ wrap bug is eliminated. | **PASS** |
| **TC-06** | **Remaining-Estimate Active Overrun (Stable Observation)** | **S1 (Cosmetics):** At $06:30$ ($20:06:30$), S2 Serum active elapsed is $4.5\text{m}$. Host requests $1.0\text{m}$ remaining. Operator enters observation time $W_3 = 20:06:30$ and estimate $V_3 = 1.0$. Floating Toner $= 3.0\text{m}$. Anchor 1 at $09:00:00$ ($J_5 = 20:09:00$).<br>**S2 (Fashion/Tech):** At $09:30$ ($20:09:30$), S3 Earbuds active elapsed is $6.0\text{m}$ (started $03:30$). Host signals $1\text{m}45\text{s}$ ($1.75\text{m}$) remaining. Operator enters $W_4 = 20:09:30$ and $V_4 = 1.75$. Anchor 1 at $10:30:00$ ($J_5 = 20:10:30$). | **S1:** Active finish $= \text{ToDateTime}(W_3) + 1.0\text{m} = 20:07:30$. Projected Toner finish $= 20:07:30 + 3.0\text{m} = 20:10:30$. $Q_5 = 20:10:30$. Deficit $R_5 = (20:10:30 - 20:09:00) \times 1440 = 1.5\text{m}$ ($+90\text{s}$). Cell turns crimson.<br>*Recalculation at 06:45 ($20:06:45$):* $W_3$ and $V_3$ unchanged; Serum finish remains stable at $20:07:30$; deficit $R_5$ remains $1.5\text{m}$ ($+90\text{s}$), eliminating false recalculation drift.<br>**S2:** Active finish $= \text{ToDateTime}(W_4) + 1.75\text{m} = 20:11:15$. $Q_5 = 20:11:15$. Deficit $R_5 = (20:11:15 - 20:10:30) \times 1440 = 0.75\text{m}$ ($\mathbf{45s}$ / $\mathbf{0.8m}$). Cell turns crimson.<br>*Recalculation at 09:45:* Earbuds finish remains stable at $20:11:15$; deficit remains $0.8\text{m}$ ($+45\text{s}$). | **S1:** **`R5 = 1.5m`** ($+90\text{s}$). Stable at 06:45.<br>**S2:** **`R5 = 0.8m`** ($+45\text{s}$). Stable at 09:45. | **PASS** |

---

### 4.6 Compressibility & Floor Duration Semantics

1. **Contractual Floor Invariant:** Each segment possesses a contractual minimum duration `Floor_Min` (`Col F`), agreed with commercial brand sponsors.
2. **Buffer Availability Constraint:** Buffer time can ONLY be harvested from segments marked `Is_Compressible = TRUE` (`Col H`), calculated strictly as $\text{Buffer}_i = G_i - F_i$. Segments with `Is_Compressible = FALSE` (such as fixed-duration opening pitches or contractual flash drops) yield **zero** buffer time ($0.0\text{m}$), even if $G_i > F_i$.
3. **Invalid Compression Penalty:** Any manual schedule recovery that cuts a segment below `Floor_Min` without an authorized external disturbance exception (e.g., sudden SKU stockout) violates sponsor contracts and is scored as an **INVALID RECOVERY DECISION** (Metric M4).
4. **Authorized Exception (Stockout):** If an inventory stockout occurs (Disturbance D3), terminating the pitch immediately below `Floor_Min` is recognized as an authorized operational exception.

---

## 5. Multi-Tier Conditional Formatting Specification

The baseline employs a **3-tier conditional formatting matrix** designed to draw the operator's peripheral vision to emerging risks without inducing sensory clutter:

```
+----------------------------------------------------------------------------------------------------+
|                                CONDITIONAL FORMATTING ALERT MATRIX                                 |
+---+----------------------+-------------------+-----------------------+-----------------------------+
|Tier| Severity             | Visual Fill Color | Text Styling          | Trigger Condition           |
+---+----------------------+-------------------+-----------------------+-----------------------------+
| 1 | On-Air Execution     | Soft Ice Blue     | Bold Dark Navy        | Status = ACTIVE             |
| 2 | Proximity Warning    | Amber Yellow      | Bold Charcoal         | Deficit <= 2m or near anchor|
| 3 | Critical Deficit     | Dark Crimson Red  | Bold Bright White     | Deficit > 0m on hard anchor |
+---+----------------------+-------------------+-----------------------+-----------------------------+
```

### 5.1 Formatting Rules Table

| Rule ID | Target Range | Condition Formula | Hex Fill | Hex Text | Semantic Meaning |
|:---:|---|---|:---:|:---:|---|
| **CF-01** | `A2:W50` | `=$S2="ACTIVE"` | `#CFE2F3` | `#0B5394` | **ACTIVE ON AIR:** Segment currently presenting live on camera. |
| **CF-02** | `R2:R50` | `=$R2>0` | `#990000` | `#FFFFFF` | **CRITICAL ANCHOR DEFICIT:** Hard promotional deadline will be missed! |
| **CF-03** | `Q2:Q50` | `=AND($I2=TRUE, $Q2 > ('00_Config'!$B$2 + $J2 + IF($J2 < '00_Config'!$B$1, 1, 0)) - TIME(0,2,0), $Q2 <= ('00_Config'!$B$2 + $J2 + IF($J2 < '00_Config'!$B$1, 1, 0)))` | `#FFD966` | `#7F6000` | **AMBER WARNING:** Projected start is within 2 minutes of hard anchor. |
| **CF-04** | `P2:P50` | `=$P2>=1.0` | `#F4CCCC` | `#990000` | **OVERRUN SLIP:** Segment exceeded scheduled target by $\ge 1.0$ minute. |
| **CF-05** | `P2:P50` | `=$P2<=-1.0` | `#D9EAD3` | `#274E13` | **UNDER-RUN VOID:** Segment finished $\ge 1.0$ minute ahead of target. |
| **CF-06** | `A2:W50` | `=$S2="SKIPPED"` | `#EFEFEF` | `#999999` | **SKIPPED / DROPPED:** Segment omitted from broadcast to recover time. |
| **CF-07** | `A2:W50` | `=$S2="DONE"` | `#F3F3F3` | `#434343` | **COMPLETED:** Segment successfully executed and wrapped. |

---

## 6. Sheet Security & Protected Ranges Governance

To ensure the validity and fairness of experimental trials, the baseline workbook enforces strict range access controls:

### 6.1 Range Protection Matrix

```
+----------------------------------------------------------------------------------------------------+
|                                 SHEET SECURITY & PERMISSION BOUNDARIES                             |
+---------------------+-------------------+-------------------+--------------------------------------+
| Range / Column      | Header Role       | Permission Level  | Rationale                            |
+---------------------+-------------------+-------------------+--------------------------------------+
| Cols K, L (K2:L50)  | Planned Times     | VIEW-ONLY (Locked)| Prevents accidental overwriting of   |
|                     |                   |                   | static baseline schedule             |
| Cols O, P (O2:P50)  | Actual & Variance | VIEW-ONLY (Locked)| Protects duration calculation logic  |
| Cols Q, R (Q2:R50)  | Proj & Deficit    | VIEW-ONLY (Locked)| Protects rolling cascade and deficit |
| Sheet '00_Config'   | Global Parameters | VIEW-ONLY (Locked)| Protects global stream constants     |
| Sheet '02_Summary'  | Summary KPIs      | VIEW-ONLY (Locked)| Protects aggregate formula model     |
| Cols B, C, D, E, F, G| Product & Budgets | EDITABLE (Pre-run)| Pre-show catalog configuration       |
| Cols H, I, J, T     | Anchors & Cues    | EDITABLE (Pre-run)| Promotional schedule configuration   |
| Cols M, N (M2:N50)  | Actual Start/End  | EDITABLE (Live)   | Operator logs runtime timestamps     |
| Col S (S2:S50)      | Status Dropdown   | EDITABLE (Live)   | Operator transitions execution state |
| Col U (U2:U50)      | Operator Notes    | EDITABLE (Live)   | Operator logs runtime remarks        |
| Col V (V2:V50)      | Remaining Est     | EDITABLE (Live)   | Operator logs active remaining est   |
| Col W (W2:W50)      | Remaining Obs     | EDITABLE (Live)   | Operator logs observation timestamp  |
+---------------------+-------------------+-------------------+--------------------------------------+
```

### 6.2 Macro Isolation & Automation Prohibition
In strict compliance with `00_VALIDATION_PROTOCOL.md` §1.2 (Principle 5):
1. **Zero Participant Macros:** No Google Apps Script macros, custom desktop hotkey listeners, or third-party audio extensions are permitted.
2. **Keyboard Shortcut Standard:** Operators capture timestamps using standard spreadsheet key commands:
   - **Windows / Linux:** `Ctrl + Shift + ;` (Inserts current wall-clock time).
   - **macOS:** `Cmd + Shift + ;` (Inserts current wall-clock time).
3. **No External Add-ons:** Browser environments are audited before testing to ensure zero automated spreadsheet extensions or external countdown timers are present.

---

## 7. Structured Zalo / Telegram Backchannel Chat Protocol

To mirror professional Vietnamese live rooms while maintaining experimental rigor, communication between the Operator and Host utilizes a dedicated backchannel (`#live-ops-[SubjectID]`) with standardized, low-noise syntax:

```
+----------------------------------------------------------------------------------------------------+
|                                 STANDARDIZED OPERATOR-HOST CHAT SYNTAX                             |
+----------------------------------------------------------------------------------------------------+
| 1. NOW BROADCASTING:                                                                               |
|    [NOW: <SKU> | Target: <X>m | Hard Stop: <HH:MM>]                                               |
|    Example: "[NOW: Serum Retinol | Target: 4m | Stop: 20:06]"                                      |
|                                                                                                    |
| 2. OVERRUN WARNING (Active pitch slips past target):                                              |
|    [WARN: Lệch +<Y>m | Khẩn trương chốt đơn trong <Z>s]                                           |
|    Example: "[WARN: Lệch +1.0m | Khẩn trương chốt đơn trong 30s]"                                  |
|                                                                                                    |
| 3. RECOVERY ADJUSTMENT (Downstream buffer reallocation):                                          |
|    [RECOVER: Rút ngắn <SKU_next> còn <Floor>m | Giữ Flash Deal <HH:MM>]                           |
|    Example: "[RECOVER: Rút Toner còn 1.0m | Giữ Flash Deal 09:00:00]"                              |
|                                                                                                    |
| 4. IMMEDIATE CUT / STOCKOUT (Mid-pitch inventory depletion):                                       |
|    [STOP/HẾT HÀNG: Cắt ngay <SKU> -> Chuyển sang <SKU_next>]                                      |
|    Example: "[STOP/HẾT HÀNG: Kem Dưỡng hết hàng -> Chuyển ngay Kem Chống Nắng]"                   |
|                                                                                                    |
| 5. HARD ANCHOR IMMINENT (30 seconds prior to platform flash drop):                                |
|    [ANCHOR: Đúng <HH:MM> đếm ngược FLASH DEAL]                                                    |
|    Example: "[ANCHOR: Đúng 09:00:00 đếm ngược FLASH DEAL Giảm 50%]"                               |
|                                                                                                    |
| 6. TECHNICAL HOLD BUFFER (Platform lag or console delay):                                         |
|    [HOLD: Minigame/Tương tác <X>s trong lúc ghim sản phẩm]                                        |
|    Example: "[HOLD: Minigame/Giao lưu 40s trong lúc ghim giỏ hàng]"                               |
+----------------------------------------------------------------------------------------------------+
```

### 7.1 Host Interaction Rules
1. **Zero Text Replies:** The host is strictly prohibited from typing replies during broadcasts.
2. **Subtle Physical / Verbal Acknowledgment:** The host confirms receipt within 2–3 seconds via:
   - A brief nod toward the operator console.
   - A natural on-camera verbal pivot: *"Dạ vâng, em thấy các chị đang chốt rất nhanh, em xin phép qua deal tiếp theo ngay ạ..."*
3. **Glance Budget Discipline:** The host's tablet or phone is positioned within $15^\circ$ of the camera lens. Gaze shifts to read cues must not exceed **2 to 3 seconds**.

---

## 8. Systematic Operational Hypotheses: Anticipated Bottlenecks of Spreadsheet + Chat

Despite being configured with expert formulas and conditional formatting, the Google Sheets + Chat baseline exhibits four hypothesized human-system bottlenecks under live broadcast pressure. These hypotheses represent the **focal operational challenges** LiveLift V3 is engineered to test against:

```
+----------------------------------------------------------------------------------------------------+
|                         HYPOTHESIZED BREAKDOWN MODES OF SPREADSHEET + CHAT                         |
+----------------------------------------------------------------------------------------------------+
| 1. Cognitive Switching Lag  | Hypothesized 30-60s latency to detect deficit, do math, and draft cue|
| 2. Split-Attention Penalty  | 4 open windows (OBS, Seller Center, Sheet, Zalo); potential pin delays|
| 3. Formula Fragility        | Ad-hoc row edits during live stress risk formula cascade (#REF!)     |
| 4. Post-Show Reconstruction | Reconciling edited cells, chat logs, and video requires manual burden|
+----------------------------------------------------------------------------------------------------+
```

### 8.1 Hypothesized Mode 1: Cognitive Switching Lag
When an overrun occurs, the spreadsheet surfaces an amber or red fill in `Col R`. However, the spreadsheet **cannot propose a solution**. The operator must:
1. Notice the cell color change while monitoring video and Seller Center.
2. Mentally inspect pending rows to find compressible candidates (`Col H = TRUE`).
3. Subtract floor durations (`Col F`) to determine available buffer.
4. Perform mental arithmetic under time pressure: *"If Serum overruns by 1.5m, can Toner absorb 1.5m, or must we also shave Kem Nắng?"*
5. Switch to Zalo, type the formatted `[RECOVER]` message, and send it.
* **Testable Hypothesis (H1):** In live trials, this multi-step cognitive sequence is hypothesized to impose measurable decision latency on operators facing disturbances. Metric M04 will measure actual stimulus-to-action decision latency empirically without predetermining the outcome.

### 8.2 Hypothesized Mode 2: Split-Attention & Window Juggling
The operator manages four concurrent desktop windows:
- **Window 1:** TikTok Live Studio / OBS (audio/video telemetry).
- **Window 2:** TikTok Shop Seller Center (product pinning, flash voucher management).
- **Window 3:** Google Sheets (rundown pacing).
- **Window 4:** Zalo Desktop (host messaging).
* **Testable Hypothesis (H2):** Interacting with Google Sheets requires clicking away from Seller Center. If a stockout or network lag occurs while the operator is entering a timestamp in Sheets, product pinning on stream is hypothesized to experience operational delay. Metric M07 will record actual pinning latency empirically.

### 8.3 Hypothesized Mode 3: Formula Fragility & Structural Rigidity
If a sudden live event requires skipping an unscheduled product or inserting an emergency sponsor announcement:
- Inserting a new row in Google Sheets often risks breaking relative formula references (`Q2 + G2 / 1440`), generating `#REF!` or circular dependency errors.
- Troubleshooting a broken formula during an active broadcast causes severe operator panic, resulting in complete abandonment of rundown tracking.
* **Testable Hypothesis (H3):** Unplanned rundown reordering under baseline conditions is hypothesized to incur higher operational error rates (Metric M02) and higher subjective frustration (Metric M05) compared to dedicated software.

### 8.4 Hypothesized Mode 4: Reconstruction Overhead & Historical Data Loss
Because operators enter actual execution numbers into the working sheet:
- The rolling projection state at the time of each disturbance is recalculated, altering the view of dynamic projections that existed before the recovery.
- Reconciling post-show execution facts across multiple decoupled applications (spreadsheet cells, chat logs, and Seller Center console logs) introduces cognitive overhead and timing burden compared to an integrated operational desk. Actual post-show review duration and Next LIVE planning time are empirical metrics (Metric M08 and Dimension 09) to be measured during testing rather than prescribed as predetermined facts.

---

## 9. Baseline Validation Checklist & Verification Sign-Off

Before any validation trial begins, the research proctor must verify the baseline environment using the checklist below:

```
[ ] 1. WORKBOOK INITIALIZATION
    - Duplicate template to 'LiveLift_Val_Baseline_[SubjectID]'.
    - Confirm Config parameters in '00_Config': Start time (B1), Date (B2), Planned duration (B7).

[ ] 2. FORMULA AUDIT
    - Verify Col K Planned_Start cascade: ='00_Config'!$B$2 + '00_Config'!$B$1 for row 2; =K2 + (G2 / 1440) for row >= 3.
    - Verify Col O Actual_Dur_Min: =IF(OR(ISBLANK(M2), ISBLANK(N2), M2="", N2=""), "", ROUND(MOD(N2 - M2 + 1, 1) * 1440, 2)).
    - Verify Col P Variance_Min: =IF(OR(ISBLANK(O2), O2=""), "", ROUND(O2 - G2, 2)).
    - Verify Col Q Projected_Start rolling logic: Evaluates previous status (DONE/SKIPPED/ACTIVE), handles Col V remaining estimates and Col W observation timestamps, normalizes DateTimes via ToDateTime(), and holds at hard anchors via MAX(prior_cursor, ToDateTime(J3)).
    - Verify Col R Anchor_Deficit_Min: =IF(AND(I2=TRUE, NOT(ISBLANK(J2)), J2<>""), IF(Q2 > ('00_Config'!$B$2 + J2 + IF(J2 < '00_Config'!$B$1, 1, 0)), ROUND((Q2 - ('00_Config'!$B$2 + J2 + IF(J2 < '00_Config'!$B$1, 1, 0))) * 1440, 1), 0), 0).
    - Verify Summary_KPI buffer formulas: Cell B4 uses SUMIFS on compressible rows (H=TRUE) yielding exactly 5.0m buffer.

[ ] 3. CONDITIONAL FORMATTING VERIFICATION
    - Test active status: Enter "ACTIVE" in S2 -> Confirm light blue fill (#CFE2F3).
    - Test overrun: Enter Actual_End = Actual_Start + 5m -> Confirm pink variance fill (#F4CCCC).
    - Test deficit: Advance Projected_Start past Anchor_Time -> Confirm dark crimson fill (#990000) on Col R.

[ ] 4. SECURITY & RANGE PROTECTION LOCK
    - Confirm formula ranges (Cols K, L, O, P, Q, R) are VIEW-ONLY for participant account; Col V (Remaining_Est_Min) and Col W (Remaining_Est_Obs) are EDITABLE.
    - Confirm zero Google Apps Script macros or extensions are active.
    - Test timestamp shortcut: Verify Ctrl+Shift+; inserts static wall-clock time.

[ ] 5. CHAT BACKCHANNEL INITIALIZATION
    - Dedicated channel #live-ops-[SubjectID] open on Operator desktop and Host tablet.
    - Verify host tablet positioned in direct line of sight (< 15 degrees from camera lens).
    - Review syntax cheat-sheet: [NOW], [WARN], [RECOVER], [STOP], [ANCHOR].
```

---

## 10. Governance Sign-Off

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 2 | Lead Technical Author (M2) | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
