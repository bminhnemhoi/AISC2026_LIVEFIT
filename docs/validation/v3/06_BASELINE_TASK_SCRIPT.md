# LiveLift V3 Baseline Google Sheets & Chat Operator Task Script

**Document ID:** `VAL-V3-BASE-06`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 3 (Execution Runbooks & Checklists)  
**Classification:** Standard Operating Procedure & Baseline Operator Runbook  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §7, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md`; `docs/validation/v3/03_BASELINE_SHEET_SPEC.md`; `docs/validation/v3/04_TEST_SCENARIO.md`; `docs/validation/v3/07_DISTURBANCE_TIMELINE.md`

---

## 1. Executive Summary & Non-Strawman Baseline Principles

This document provides the authoritative, step-by-step operational runbook for the live-room operator running the **Google Sheets + Zalo Chat Baseline** during experimental validation trials.

### 1.1 Non-Strawman Baseline Mandate
To ensure that empirical validation results withstand forensic audit and external scrutiny, this runbook adheres strictly to the non-strawman principles established in `03_BASELINE_SHEET_SPEC.md`:
1. **Professional Spreadsheet Standards:** The Google Sheets workbook is not an empty scratchpad. It is an expertly engineered operational model with automated cascading time calculations (`TIME`, `NOW`, `MAX`), dynamic rolling start projections, automated hard anchor deficit alarms, and a 3-tier conditional formatting matrix.
2. **Structured Communication Channel:** Operator-host coordination uses a standardized, low-noise syntax (`[NOW]`, `[WARN]`, `[RECOVER]`, `[STOP]`, `[ANCHOR]`, `[HOLD]`) over a dedicated desktop backchannel (`#live-ops-[SubjectID]`).
3. **Rigorous Operational Governance:** Calculation formulas are protected (View-Only) to preserve structural integrity, while timestamp shortcuts (`Ctrl+Shift+;`) simulate standard professional spreadsheet workflows.
4. **Authentic Multi-Window Environment:** The operator manages four concurrent desktop windows replicating an authentic live-stream operations desk: OBS Studio, TikTok Shop Seller Center, Google Sheets, and Zalo Desktop.

```
+----------------------------------------------------------------------------------------------------+
|                               BASELINE OPERATOR DESKTOP ARCHITECTURE                               |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ MONITOR 1: LIVESTREAM & SELLER CENTER ]         [ MONITOR 2: SPREADSHEET & BACKCHANNEL CHAT ]   |
|  +-------------------------------------------+       +-------------------------------------------+ |
|  | WINDOW 1: OBS Studio / TikTok Live Studio |       | WINDOW 3: Google Sheets Rundown           | |
|  | - Camera 1080p stream return              |       | - 01_Live_Rundown (Cols A to U)           | |
|  | - Master audio VU meters & broadcast clock|       | - Dynamic rolling forecast (Col Q)        | |
|  |                                           |       | - Anchor deficit alarm (Col R)            | |
|  | WINDOW 2: TikTok Shop Seller Center       |       | - 02_Summary_KPI (Buffer Pool Tracker)    | |
|  | - Product Showcase manual Pin/Unpin card  |       |                                           | |
|  | - Flash Deal voucher unlock console       |       | WINDOW 4: Zalo Desktop Backchannel        | |
|  | - Real-time inventory unit counters       |       | - Dedicated channel #live-ops-[SubjectID] | |
|  +-------------------------------------------+       +-------------------------------------------+ |
|                                                                                                    |
|                                       COMMUNICATION BRIDGE                                         |
|                                                │                                                   |
|                                                ▼                                                   |
|                        [ ON-CAMERA HOST TABLET (Line of Sight < 15°) ]                             |
|                        - Dedicated Zalo chat feed open to #live-ops-[SubjectID]                    |
|                        - Structured syntax: [NOW], [WARN], [RECOVER], [STOP]                       |
|                        - Host responds via physical nods or verbal pivots (Zero typing)            |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Pre-Show Preparation & Pre-Flight Protocol ($T-15\text{m}$ to $T-00\text{m}$)

The operator must execute the pre-flight verification sequence before commencing broadcast operations.

### 2.1 Multi-Window Layout Configuration
1. **Monitor 1 (Left / Primary Focus):**
   - **Top Half:** OBS Studio / TikTok Live Studio displaying live 1080p video feed, microphone audio bars, and master studio clock.
   - **Bottom Half:** TikTok Shop Seller Center logged into the designated merchant account (`AuraSkin Vietnam` or `UrbanPulse Studio`). Navigate to *Live Stream Management > Product Showcase*.
2. **Monitor 2 (Right / Control Console):**
   - **Left Half (65% width):** Google Chrome displaying the baseline workbook: `LiveLift_Val_Baseline_[SubjectID]`. Open sheet `01_Live_Rundown`. Zoom level set to 90% so all 23 columns (A to W) are visible without horizontal scrolling.
   - **Right Half (35% width):** Zalo Desktop application open to channel `#live-ops-[SubjectID]`. Font size enlarged to 14pt for glanceability.
   - *Single-Monitor Alternative:* If operating on a single 1440p monitor, divide screen into four equal quadrants: Q1 OBS (Top-Left), Q2 Seller Center (Bottom-Left), Q3 Google Sheets (Top-Right), Q4 Zalo (Bottom-Right).

### 2.2 Workbook & Formula Verification Checklist
The operator must cross-check the baseline workbook against the verification requirements from `03_BASELINE_SHEET_SPEC.md` §9:

```
[ ] 1. WORKBOOK IDENTITY & CONFIGURATION
    - Sheet '00_Config' contains correct parameters:
      * Stream_Start_Time (B1): 20:00:00 (or synchronized test wall-clock)
      * Planned_Duration_Min (B7): 15.0
      * Planned_End_Time (B8): =B1 + TIME(0, B7, 0)
    - Scenario catalog confirmed:
      * Scenario 1: CAT-COSMETICS-01 (AuraSkin)
      * Scenario 2: CAT-TECHFASH-02 (UrbanPulse)

[ ] 2. FORMULA INTEGRITY AUDIT (VIEW-ONLY LOCKED RANGES)
    - Confirm Col K (Planned_Start) formulas: ='00_Config'!$B$1 for row 2; =K2 + (G2 / 1440) for row >= 3.
    - Confirm Col L (Planned_End) formulas: =K2 + (G2 / 1440).
    - Confirm Col O (Actual_Dur_Min): =IF(OR(ISBLANK(M2), ISBLANK(N2), M2="", N2=""), "", ROUND(MOD(N2 - M2 + 1, 1) * 1440, 2)).
    - Confirm Col P (Variance_Min): =IF(OR(ISBLANK(O2), O2=""), "", ROUND(O2 - G2, 2)).
    - Confirm Col Q (Projected_Start): Dynamic rolling cascade holding at hard anchors via MAX(prior_cursor, J3), evaluating Col V remaining estimates and Col W observation timestamps, and bypassing skipped rows.
    - Confirm Col R (Anchor_Deficit_Min): =IF(AND(I2=TRUE, NOT(ISBLANK(J2)), J2<>""), IF(Q2 > J2, ROUND((Q2 - J2) * 1440, 1), 0), 0).
    - Confirm Sheet '02_Summary_KPI': Cell B4 Total Buffer Pool = 5.0m (SUMIFS on compressible rows H=TRUE); Cell B5 Pending Buffer Available = 5.0m.

[ ] 3. CONDITIONAL FORMATTING VERIFICATION
    - Test Rule CF-01: Change S2 Status to "ACTIVE" -> Verify row A2:W2 highlights in Soft Ice Blue (#CFE2F3).
    - Test Rule CF-02: Verify that when Col R > 0, cell fills Dark Crimson Red (#990000) with bold white text.
    - Test Rule CF-03: Verify Amber Warning (#FFD966) fires when Projected_Start is within 2m of Anchor_Time.
    - Reset test cells to "PENDING" prior to show kickoff.

[ ] 4. KEYBOARD SHORTCUT & MACRO CHECK
    - Test timestamp shortcut in scratch cell:
      * Windows / Linux: Press `Ctrl + Shift + ;` -> Verify current static time is inserted (e.g., 20:00:15).
      * macOS: Press `Cmd + Shift + ;` -> Verify static time insertion.
    - Confirm zero Google Apps Script macros or extensions are active.
```

### 2.3 Host Tablet Backchannel Verification
1. Ensure the host's tablet is positioned in the host's direct line of sight ($< 15^\circ$ from camera lens).
2. Verify Zalo channel `#live-ops-[SubjectID]` is open on host tablet with notifications enabled and screen lock disabled.
3. Transmit test ping from operator desktop: `[TEST: Kênh sẵn sàng - Chúc phiên live thành công!]`.
4. Host acknowledges via brief nod toward camera.

---

## 3. In-Show Execution Procedures & Standard Operating Cycle

During live broadcast operations, the operator executes a continuous **5-step cognitive loop** for every segment:

```
+----------------------------------------------------------------------------------------------------+
|                                 OPERATOR RECURRING 5-STEP CYCLE                                    |
+----------------------------------------------------------------------------------------------------+
|  1. LOG ACTUAL START     --> Press Ctrl+Shift+; in Col M. Set Status Col S to "ACTIVE".            |
|  2. SELLER CENTER PIN    --> Click Pin in Seller Center. Verify card appears on OBS monitor.       |
|  3. TRANSMIT NOW CUE     --> Send formatted [NOW] message in Zalo desktop.                         |
|  4. MONITOR PACE & DRIFT --> Watch Col P (Variance), Col Q (Rolling Start), Col R (Anchor Deficit).|
|  5. LOG ACTUAL END       --> Press Ctrl+Shift+; in Col N. Set Status Col S to "DONE". Advance.     |
+----------------------------------------------------------------------------------------------------+
```

### 3.1 Step 1: Logging Actual Start (`Col M`)
1. At the exact second the host transitions into a new segment:
   - Click cell `M{row}` (`Actual_Start`).
   - Press **`Ctrl + Shift + ;`** (or `Cmd + Shift + ;`).
   - Click cell `S{row}` (`Status`) and select **`ACTIVE`** from dropdown.
2. The entire row immediately turns **Soft Ice Blue** (`#CFE2F3`), signaling on-air status.

### 3.2 Step 2: Native Platform Execution (Seller Center)
1. Switch to Window 2 (TikTok Shop Seller Center).
2. Locate the presenting SKU in the showcase list.
3. Click **Ghim sản phẩm** (Pin Product).
4. Glance at Window 1 (OBS Stream Monitor) to verify the yellow shopping bag product card pops up on stream.

### 3.3 Step 3: Structured Chat Dispatch (Zalo)
1. Switch to Window 4 (Zalo Desktop).
2. Type and dispatch the standardized `[NOW]` cue using strict template syntax:
   ```
   [NOW: <SKU> | Target: <X>m | Hard Stop: <HH:MM:SS>]
   ```
   *Example:* `[NOW: Serum Niacinamide | Target: 4m | Stop: 20:06:00]`
3. Verify host glances at tablet, absorbs cue within 2–3 seconds, and verbally acknowledges on stream.

### 3.4 Step 4: Pacing & Deficit Monitoring
1. Monitor Google Sheets `01_Live_Rundown` while active segment runs:
   - **Column P (`Variance_Min`):** Tracks duration drift against target budget.
   - **Column Q (`Projected_Start`):** Displays dynamically calculated start times for all upcoming segments.
   - **Column R (`Anchor_Deficit_Min`):** The primary schedule alarm. If the rolling cursor exceeds an upcoming hard anchor, Col R turns **Dark Crimson Red** (`#990000`).
   - **Summary KPI (`02_Summary_KPI`):**
     * Cell `B4`: `Total_Buffer_Pool` ($5.0\text{m}$).
     * Cell `B5`: `Pending_Buffer_Available` (remaining flexible minutes in unexecuted compressible rows).
     * Cell `B6`: `Cumulative_Slip_Min` (net realized drift across completed rows).

### 3.5 Step 5: Logging Actual End (`Col N`)
1. When the segment concludes:
   - Click cell `N{row}` (`Actual_End`).
   - Press **`Ctrl + Shift + ;`**.
   - Set cell `S{row}` to **`DONE`**.
2. Column O (`Actual_Dur_Min`) and Column P (`Variance_Min`) compute realized duration metrics.
3. Immediately advance to the next row (Step 1).

---

## 4. Disturbance Recovery Runbook (Scenario 1 — Cosmetics `CAT-COSMETICS-01`)

**Catalog:** `CAT-COSMETICS-01` (AuraSkin Vietnam)  
**Nominal Run:** $T = 00:00:00$ to $15:00:00$ (900 seconds)  
**Hard Promotion Anchors:** Anchor 1 at $09:00:00$ (`SKU-KEMD`), Anchor 2 at $14:00:00$ (`SYS-CLOSE`).

```
00:00       02:00                 06:00          09:00             12:00        14:00   15:00
  |-----------|---------------------|--------------|-----------------|------------|-------|
  [ 1. INTRO ]      [ 2. SERUM ]      [ 3. TONER ] [ 4. FLASH DEAL ] [ 5. NẮNG ]  [ CLOSE ]
                    ^               ^              ^                 ^            ^
                 04:30:          06:30:         09:00:00:         S4+1m15s:    14:00:00:
                 [CHAT STIMULUS] [EVAL D1]      [EVAL D2]         [INJECT D3]  [EVAL CLOSE]
                 Host stimulated 90s deficit    Did Flash start   Stockout!    End adherence
                 to pitch deep   vs Anchor 1    at 09:00:00?      Pull S5?     at 14:00:00
```

### 4.1 Second-by-Second Detailed Execution Table

| Elapsed (mm:ss) | State Anchor | Operational Event & Stimulus | Operator Action in Google Sheets | Action in Seller Center & OBS | Structured Zalo Cue to Host | Expected Response & Scoring Target |
|:---:|---|---|---|---|---|---|
| **00:00** | $T_{\text{start}}(S1)$ | Stream Kickoff (`SYS-INTRO`). Planned: 2.0m. | Click `M2`, press `Ctrl+Shift+;`. Set `S2` to `ACTIVE`. | Verify stream feed & audio in OBS. | `[NOW: Giới thiệu Deal | Target: 2m | Stop: 20:02:00]` | Setup verified within $\pm 5$s. |
| **01:45** | Pre-Cue S2 | 15s to S1 planned end. | Check row 3 (`SKU-SERUM`). | Pre-stage `SKU-SERUM` in Seller Center. | `[WARN: 15s chuẩn bị vào Hero 1 Serum]` | Timely pre-cue dispatched. |
| **02:00** | $T_{\text{start}}(S2)$ | S1 ends. Transition to S2 (`SKU-SERUM`). Planned: 4.0m. | Click `N2`, press `Ctrl+Shift+;`. Set `S2`=`DONE`. Click `M3`, press `Ctrl+Shift+;`. Set `S3`=`ACTIVE`. | Click **Pin** `SKU-SERUM` in Seller Center. Verify pin card in OBS. | `[NOW: Serum Niacinamide | Target: 4m | Stop: 20:06:00]` | Transition logged within $\le 5$s of 02:00. |
| **04:30** | D1 Stimulus | **INJECT D1 STIMULUS:** Proctor posts chat question on treatment skin. | Observe active run. S3 elapsed = 2.5m. | Monitor chat engagement in OBS. | None (Host engages naturally). | Natural overrun initiated. |
| **06:00** | S2 Deadline | S2 planned end reached. Host continues pitching deeply. | Observe cell `P3` drifting positive. S3 elapsed = 4.0m. | Monitor Seller Center stock. | `[WARN: Lệch +0m | Chuẩn bị chốt Serum]` | Operator notices drift. |
| **06:30** | **D1 Deficit** | **EVALUATE D1 DEFICIT:** S2 elapsed = 4.5m. Host requests 1 additional minute to conclude. Operator logs observation time in cell `W3` (`Remaining_Est_Obs`, `Ctrl+Shift+;` or `20:06:30`) and enters `1.0` in cell `V3` (`Remaining_Est_Min`). **Cell `R5` (Flash Sale row) turns Dark Crimson Red (`1.5m` / `90s`), maintaining a stable deficit without drifting on subsequent recalculations**. | **Operator detects Red cell in Col R ($T_{\text{detect}}$)**. Inspects Row 4 (`SKU-TONER`): `Floor_Min` (Col F) = 1.0m; `Is_Compressible` (Col H) = `TRUE`. Calculates available buffer: $3.0 - 1.0 = 2.0\text{m}$. Formulates recovery: compress Toner to 1.5m (absorbing 1.5m slip). Types note in `U3`: *"D1: Compress S3 Toner to 1.5m to absorb Serum slip"*. | Stage Seller Center for early Serum unpin. | `[RECOVER: Rút Toner còn 1.5m | Giữ Flash Deal 09:00:00]` | **$T_{\text{detect}} \le 10\text{s}$**. **$T_{\text{decision}} \le 15.0\text{s}$**. Decision preserves 09:00:00 anchor and respects 1.0m floor. |
| **07:30** | S2 End / S3 Start | Host wraps Serum (Actual: 5.5m, Variance: $+1.5\text{m}$). Transition to S3 (`SKU-TONER`). | Click `N3`, press `Ctrl+Shift+;`. Set `S3`=`DONE`. Click `M4`, press `Ctrl+Shift+;`. Set `S4`=`ACTIVE`. | Unpin `SKU-SERUM`. Click **Pin** `SKU-TONER` in Seller Center. | `[NOW: Toner Centella | Target: 1.5m | Stop: 20:09:00]` | S2 duration = 5.5m. S3 compressed target = 1.5m. |
| **08:30** | Pre-Anchor Sync | 30s before immutable Flash Deal 1 (`SKU-KEMD`). | Check row 5 (`SKU-KEMD`). Anchor time = 20:09:00. | Pre-stage `SKU-KEMD` in Seller Center. | `[ANCHOR: 30s đếm ngược FLASH DEAL Retinol 50%]` | Pre-cue sent $\ge 20$s before 09:00:00. |
| **09:00** | **D2 Anchor 1** | **EVALUATE D2 ANCHOR 1:** Seller Center Flash Sale unlocks at exactly 09:00:00. | Click `N4`, press `Ctrl+Shift+;`. Set `S4`=`DONE`. Click `M5`, press `Ctrl+Shift+;`. Set `S5`=`ACTIVE`. | Click **Pin** `SKU-KEMD` in Seller Center. Verify 50% price in OBS. | `[NOW: FLASH DEAL Kem Dưỡng | Target: 3m | Stop: 20:12:00]` | **$V_{\text{anchor}} \le 15\text{s}$**. Host counts down on air: *"5-4-3-2-1 mở deal!"* |
| **10:15** | **D3 Stockout** | **INJECT D3 STOCKOUT:** Mock console alerts `SKU-KEMD` stock drops to 0 ("HẾT HÀNG"). | **Detect stockout ($T_{\text{detect}}$)**. Check Row 6 (`SKU-NANG`). Click `N5`, press `Ctrl+Shift+;`. Set `S5`=`DONE`. Advance early to Row 6. Click `M6`, press `Ctrl+Shift+;`. Set `S6`=`ACTIVE`. Type note in `U5`: *"D3: Stockout at 10:15; pulled S5 early"*. | **Click Unpin immediately on `SKU-KEMD`**. Click **Pin** `SKU-NANG` in Seller Center. | `[STOP/HẾT HÀNG: Cắt Kem Dưỡng -> Chuyển ngay Kem Nắng]` | **$T_{\text{detect}} \le 10\text{s}$**. Host halts pitch within $\le 15$s. Clean pivot to next product. |
| **10:30** | **D4 Tech Lag** | **INJECT D4 CONSOLE LAG:** 40s network spinner upon S5 entry at 10:30. | Notice Seller Center freeze. Type note in `U6`: *"D4: Seller Center pin spinner 40s"*. | Observe spinner. Do NOT abandon stream. | `[HOLD: Minigame/Tương tác 40s trong lúc ghim]` | **Zero dead air**. Host interacts with audience smoothly. |
| **11:10** | D4 Cleared | Network spinner resolves (40s post-injection). Product card pins. | Verify stream health. | Confirm `SKU-NANG` pinned on stream in OBS. | `[NOW: Đã ghim Kem Nắng | Giá 249k]` | Pin verified on stream. Host pitches sunscreen. |
| **12:00** | **D5 Under-run** | **INJECT D5 UNDER-RUN:** Host exhausts points; signals wrap early ($T_{\text{start}}(S5) + 1\text{m}30\text{s} = 12:00$). | **Detect pacing void ($T_{\text{detect}}$)**. Check Row 7 (`SYS-CLOSE`). Anchor time = 20:14:00. Notice 2.0m schedule gap before 14:00 closing anchor. **Do NOT advance row 7 early**. Type note in `U6`: *"D5: Host under-run; cueing filler to hold 14:00 anchor"*. | Maintain active pin for `SKU-NANG`. | `[HOLD: Minigame chia sẻ live + Q&A giữ sóng đến 14:00]` | **Operator holds closing anchor at 14:00:00**. Avoids early shutdown. |
| **13:30** | Pre-Close Prep | 30s before closing anchor. | Prepare final row 7 (`SYS-CLOSE`). | Check Seller Center order summary. | `[ANCHOR: 30s đếm ngược ĐÓNG GIỎ HÀNG]` | Pre-close cue sent on time. |
| **14:00** | **Closing Anchor** | **EVALUATE CLOSING ANCHOR:** Final broadcast cutoff instant. | Click `N6`, press `Ctrl+Shift+;`. Set `S6`=`DONE`. Click `M7`, press `Ctrl+Shift+;`. Set `S7`=`ACTIVE`. | Unpin product showcase. | `[NOW: KẾT SHOW | Tổng kết & Đóng giỏ hàng]` | **Variance $\le 15\text{s}$ against 14:00:00**. Host executes official outro. |
| **15:00** | Final Cutoff | Broadcast concludes. | Click `N7`, press `Ctrl+Shift+;`. Set `S7`=`DONE`. | End broadcast in OBS Studio. | `[STOP: Hết giờ - Kết thúc phiên live thành công!]` | Total runtime = $15\text{m}00\text{s} \pm 15\text{s}$. |


---

## 5. Disturbance Recovery Runbook (Scenario 2 — Fashion/Tech Permuted `CAT-TECHFASH-02`)

**Catalog:** `CAT-TECHFASH-02` (UrbanPulse Studio)  
**Nominal Run:** $T = 00:00:00$ to $15:00:00$ (900 seconds)  
**Hard Promotion Anchors:** Anchor 1 at $10:30:00$ (`SKU-FASH1`), Anchor 2 at $14:00:00$ (`SYS-CLOSE2`).

```
00:00    01:30                03:30 (Early Pivot)             10:30:00          12:30        14:00   15:00
  |--------|--------------------|-------------------------------|-----------------|------------|-------|
  [ INTRO ][ 2. POWERBANK MAG ] [ 3. TAI NGHE ANC PRO ]         [ 4. FLASH TEE ]  [ 5. CARGO ] [ CLOSE ]
           ^                    ^                               ^                 ^            ^
        03:15:               06:00 / 09:30:                  10:30:00:         13:15:       14:00:00:
        [INJECT D3]          [INJECT D1 & EVAL DEFICIT]      [EVAL D2 & D4]    [INJECT D5]  [EVAL CLOSE]
        Stockout!            Overrun extends to 11:15        Flash Sale Anchor Under-run!   End adherence
        Pivot to S3 at 03:30 45s deficit vs 10:30 Anchor     Pin lag 40s       Hold to 14m  at 14:00:00
```

### 5.1 Permuted Operational Choreography Table

| Elapsed (mm:ss) | State Anchor | Context & Stimulus | Operator Action in Google Sheets | Action in Seller Center & OBS | Structured Zalo Cue to Host | Scoring Target |
|:---:|---|---|---|---|---|---|
| **00:00** | $T_{\text{start}}(S1)$ | Kickoff (`SYS-INTRO2`). Planned: 1.5m. | Click `M2`, press `Ctrl+Shift+;`. Set `S2`=`ACTIVE`. | Verify OBS feed & audio. | `[NOW: Drop Phố & Voucher | Target: 1.5m | Stop: 20:01:30]` | Setup verified $\pm 5$s. |
| **01:30** | $T_{\text{start}}(S2)$ | Transition to S2 (`SKU-TECH1` MagSafe). Planned: 3.5m. | Click `N2`, press `Ctrl+Shift+;`. Set `S2`=`DONE`. Click `M3`, press `Ctrl+Shift+;`. Set `S3`=`ACTIVE`. | Click **Pin** `SKU-TECH1` in Seller Center. Verify pin in OBS. | `[NOW: Sạc MagSafe Qi2 | Target: 3.5m | Stop: 20:05:00]` | Transition within $\le 5$s. |
| **03:15** | **$T_{\text{start}}(S2) + 1\text{m}45\text{s}$** | **INJECT D3 STOCKOUT:** Mock console alerts `SKU-TECH1` stock drops to 0 ("HẾT HÀNG"). | **Detect stockout ($T_{\text{detect}}$)**. Click `N3`, press `Ctrl+Shift+;`. Set `S3`=`DONE`. Advance early to Row 4 (`SKU-TECH2`). Click `M4`, press `Ctrl+Shift+;`. Set `S4`=`ACTIVE`. Type note in `U3`: *"D3: MagSafe stockout at 03:15; transition at 03:30"*. | **Click Unpin on `SKU-TECH1`**. Click **Pin** `SKU-TECH2` in Seller Center. | `[STOP/HẾT HÀNG: Cắt Sạc MagSafe -> Chuyển ngay Tai Nghe ANC]` | **$T_{\text{detect}} \le 10\text{s}$**. Host halts pitch within $\le 15$s. Clean transition planned to execute by 03:30. |
| **03:30** | Early S3 Transition | Host pivots smoothly to S3 (`SKU-TECH2` Tai Nghe ANC Pro). | Monitor rolling start in `Col Q`. Actual S2 duration = 2.0m (meets floor). | Verify `SKU-TECH2` pinned on OBS screen. | `[NOW: Tai Nghe ANC Pro | Target: 5.5m | Stop: 20:10:30]` | Early transition executed cleanly at 03:30. |
| **06:00** | **$T_{\text{start}}(S3) + 2\text{m}30\text{s}$** | **INJECT D1 STIMULUS:** Proctor posts audio mic call test inquiry at 06:00 ($03:30 + 2\text{m}30\text{s}$). | Observe active run. S3 elapsed = 2.5m. | Monitor chat in OBS. | None (Host engages naturally). | Natural overrun initiated. |
| **09:30** | **$T_{\text{start}}(S3) + 6\text{m}00\text{s}$** | **EVALUATE D1 DEFICIT:** S3 elapsed = 6.0m ($03:30 + 6\text{m}00\text{s}$). Host requests 1m45s remaining time. Operator logs observation time in cell `W4` (`Remaining_Est_Obs`, `Ctrl+Shift+;` or `20:09:30`) and enters `1.75` in cell `V4` (`Remaining_Est_Min`). **Cell `R5` turns Dark Crimson Red (`0.8m` / `45s`), maintaining a stable deficit without drifting on subsequent recalculations**. | **Detect Red cell in Col R ($T_{\text{detect}}$)**. Inspect Row 5 (`SKU-FASH1` Flash Anchor at 10:30:00). Mentally calculate: S3 finish is $09:30 + 1\text{m}45\text{s} = 11:15$, creating 45s deficit vs 10:30:00 anchor. Operator formulates recovery: cue host to wrap S3 by 10:30:00 ($7.0\text{m}$ actual $\ge 3.0\text{m}$ floor). Type note in `U4`: *"D1: Deficit 45s; wrapping S3 by 10:30"*. | Stage `SKU-FASH1` in Seller Center. | `[RECOVER: Chốt Tai Nghe đúng 10:30 | Giữ Flash Deal 10:30:00]` | **$T_{\text{detect}} \le 10\text{s}$**. **$T_{\text{decision}} \le 15.0\text{s}$**. Decision preserves 10:30:00 anchor ($7.0\text{m}$ actual $\ge 3.0\text{m}$ floor). |
| **10:00** | Pre-Anchor Sync | 30s before Flash Sale. S3 concludes wrapping. | Check Row 5 (`SKU-FASH1`). Anchor time = 20:10:30. Click `N4`, press `Ctrl+Shift+;`. Set `S4`=`DONE`. | Pre-stage Flash Deal in Seller Center. | `[ANCHOR: 30s đếm ngược FLASH DEAL Áo Acid Wash 50%]` | Pre-cue sent $\ge 20$s before 10:30:00. |
| **10:30** | **Absolute Wall-Clock** | **EVALUATE D2 ANCHOR 1:** Flash Deal unlocks. **INJECT D4 CONSOLE LAG:** 40s spinner on pinning `SKU-FASH1`. | Click `M5`, press `Ctrl+Shift+;`. Set `S5`=`ACTIVE`. **Detect Seller Center pin spinner ($T_{\text{detect}}$)**. Type note in `U5`: *"D4: Pin spinner 40s on Flash Deal"*. | Observe spinner in Seller Center. Do NOT panic. | `[HOLD: Minigame chọn size 40s trong lúc ghim giỏ hàng]` | **$V_{\text{anchor}} \le 15\text{s}$**. Zero dead air. Host runs size quiz. |
| **11:10** | D4 Cleared | Network spinner resolves. Product card pins. | Verify stream health. | Confirm `SKU-FASH1` pinned on OBS screen. | `[NOW: Đã ghim Áo Acid Wash 180k]` | Pin verified. Host pitches flash deal. |
| **12:30** | S4 End | S4 concludes. Transition to S5 (`SKU-FASH2` Cargo Pants). Planned: 1.5m. | Click `N5`, press `Ctrl+Shift+;`. Set `S5`=`DONE`. Click `M6`, press `Ctrl+Shift+;`. Set `S6`=`ACTIVE`. | Unpin `SKU-FASH1`. Click **Pin** `SKU-FASH2` in Seller Center. | `[NOW: Quần Cargo Pants | Target: 1.5m | Stop: 20:14:00]` | Transition within $\le 5$s. |
| **13:15** | **$T_{\text{start}}(S5) + 45\text{s}$** | **INJECT D5 UNDER-RUN:** Host exhausts styling tips; signals early finish. | **Detect pacing void ($T_{\text{detect}}$)**. Check Row 7 (`SYS-CLOSE2`). Anchor = 20:14:00. **Do NOT advance row 7 early**. Type note in `U6`: *"D5: Host under-run; holding airwaves to 14:00 closing anchor"*. | Maintain active pin for `SKU-FASH2`. | `[HOLD: Minigame chia sẻ livestream giữ sóng đến 14:00]` | **Closing Anchor held at 14:00:00**. |
| **14:00** | **Closing Anchor** | **EVALUATE CLOSING ANCHOR:** Final closing window unlocks. | Click `N6`, press `Ctrl+Shift+;`. Set `S6`=`DONE`. Click `M7`, press `Ctrl+Shift+;`. Set `S7`=`ACTIVE`. | Unpin product showcase. | `[NOW: KẾT SHOW | Đóng giỏ hàng & Hẹn giờ]` | **$V_{\text{anchor}} \le 15\text{s}$**. Host executes outro. |
| **15:00** | Final Cutoff | Broadcast concludes. | Click `N7`, press `Ctrl+Shift+;`. Set `S7`=`DONE`. | End broadcast in OBS Studio. | `[STOP: Hết giờ - Kết thúc phiên live thành công!]` | Total runtime = $15\text{m}00\text{s} \pm 15\text{s}$. |

---

## 6. Wrap & Matched Post-Show Operational Protocol

To maintain experimental parity with the LiveLift condition, the baseline post-show procedure consists of the **identical 2-part matched operational task**, timed continuously by the proctor without predetermined duration assertions:

### 6.1 Matched Post-Show Task Specification

```
+----------------------------------------------------------------------------------------------------+
|                                MATCHED POST-SHOW PROTOCOL (PARITY SPECIFICATION)                   |
+----------------------------------------------------------------------------------------------------+
| Part 1: Plan-vs-Actual Fact Reconciliation (Metric M10 — T_recon)                                  |
|   - Scope: Verify actual start/end timestamps in '01_Live_Rundown' and '02_Summary_KPI'.           |
|   - Output: Answer standardized Fact Probes (actual durations, peak anchor drift, stockout time).  |
|   - Measurement: Timed from stream conclusion until fact sheet submission (Target Budget <= 5.0m). |
|                                                                                                    |
| Part 2: Next LIVE Rundown Adaptation (Metric M11 — T_next_plan & F_next)                           |
|   - Scope: Author an adapted 15-minute rundown in the 'Next_LIVE' tab incorporating learnings.     |
|   - Output: Adjusted segment allocations, valid compressible buffer pool >= 5.0m, protected anchors|
|   - Measurement: Timed from Next LIVE start to completion; evaluated for mathematical feasibility. |
+----------------------------------------------------------------------------------------------------+
```

#### Step 1: Plan-vs-Actual Fact Reconciliation (Metric M10)
1. Immediately upon broadcast sign-off ($T = 15:00$), the research proctor starts the post-show stopwatch for **Metric M10 ($T_{\text{recon}}$)**.
2. The operator reviews the completed sheet:
   - Verifies all actual timestamps in `Col M` (`Actual_Start`) and `Col N` (`Actual_End`).
   - Checks `Col O` (`Actual_Dur_Min`) and `Col P` (`Variance_Min`).
   - If a timestamp was missed during live execution, the operator consults the Zalo backchannel message log to recover the transition instant.
   - Inspects `02_Summary_KPI` for total show runtime and peak anchor variance.
3. The operator completes the standardized 5-question Fact Sheet administered by the proctor:
   - *Probe 1:* What was the actual executed duration of Hero SKU 1?
   - *Probe 2:* What was the exact wall-clock start time of Flash Sale Anchor 1?
   - *Probe 3:* What was the realized timing variance on Anchor 1 ($V_{\text{anchor}}$)?
   - *Probe 4:* At what exact elapsed time was the stockout/overrun detected?
   - *Probe 5:* What was the net duration drift across the entire stream?
4. Proctor records $T_{\text{recon}}$ stop time upon Fact Sheet submission and evaluates accuracy ($\ge 80.0\%$ per trial [$\ge 4/5$ probes] and $\ge 90.0\%$ pooled across paired trials [$\ge 9/10$ probes] required for validity).

#### Step 2: Next LIVE Rundown Adaptation (Metric M11)
1. Immediately following Fact Sheet submission, the proctor starts the stopwatch for **Metric M11 ($T_{\text{next\_plan}}$)**.
2. The operator opens the pre-templated `Next_LIVE` sheet and adapts the rundown for the subsequent broadcast based on observed live dynamics:
   - Adjusts segment duration allocations to account for observed hero product pitch requirements.
   - Ensures all hard promotion anchor windows remain strictly protected.
   - Validates that the total compressible buffer pool remains mathematically sound ($\ge 5.0\text{m}$) and respects contractual floor limits (`Floor_Min`).
3. Proctor records $T_{\text{next\_plan}}$ upon plan completion and verifies plan feasibility ($F_{\text{next}} \in \{0, 1\}$).

### 6.2 Structural Comparison Points (Empirical Hypotheses to be Measured)
Rather than asserting arbitrary post-show durations as pre-determined facts, the validation study empirically measures how tool integration impacts post-show workflow efficiency:
1. **Decoupled vs Unified History:** Baseline operators manually cross-reference disconnected tools (spreadsheet cells, chat timestamps, and notes), whereas LiveLift operators review an immutable event-derived ledger in a single unified interface.
2. **Manual Recalculation vs Automated Next Plan:** Baseline operators manually re-calculate formula cascades and verify floor constraints when drafting a new plan, whereas LiveLift operators select structured trade-offs with automated conflict detection.
3. **Objective Measurement:** Both conditions are measured on identical deliverables, enabling an unbiased, falsifiable comparison of total review-plus-planning latency ($T_{\text{recon}} + T_{\text{next\_plan}}$) and plan feasibility ($F_{\text{next}}$).

---

## 7. Operator Troubleshooting & Human Error Mitigation

| Anomaly in Baseline | Root Operational Cause | Operator Recovery Procedure | Prevention / Constraint |
|---|---|---|---|
| **Accidental Overwrite of Locked Formula** | Operator types in `Col K`, `L`, `O`, `P`, `Q`, or `R` instead of `Col M` or `N`. | Google Sheets displays Protected Range warning modal: *"You are attempting to edit a protected cell"*. Press **Esc** or click **Cancel**. Click into `Col M` or `Col N`. | Range protection locks ensure formulas cannot be permanently corrupted. |
| **Missing Timestamp Shortcut (`Ctrl+Shift+;`)** | Focus was in wrong window or shortcut miskeyed. | 1. Glance at OBS master clock overlay.<br>2. Manually type current wall-clock time in `HH:MM:SS` format (e.g., `20:06:30`). | Do not leave cell blank; blanks break downstream duration formulas. |
| **Zalo Window Lost Behind Browser** | Multi-window focus shifted to Google Sheets. | Press **`Alt + Tab`** (Windows/Linux) or **`Cmd + Tab`** (macOS) to immediately bring Zalo Desktop to foreground. | Keep Zalo pinned to right 35% of Monitor 2 without overlapping Sheets. |
| **Accidental Row Deletion or Shift** | Operator pressed `Ctrl + -` or right-clicked delete row. | Press **`Ctrl + Z`** (Undo) immediately. Check `Col K` and `Col Q` to verify `#REF!` errors are cleared. | If formulas corrupt, notify proctor immediately. |
| **Host Fails to See Zalo Cue** | Host distracted by camera or stream chat comments. | Deliver backup hand gesture (finger countdown or pointing to tablet). Follow up with verbal keyword pivot. | Tablet must remain within $15^\circ$ line of sight. |

---

## 8. Governance Sign-Off

This document constitutes the standardized operational runbook for Google Sheets + Chat baseline testing across all participant trials. Any modifications to formula structures or chat syntax must be documented in a dated version addendum.

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 3 | Lead Technical Author (M3) | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
