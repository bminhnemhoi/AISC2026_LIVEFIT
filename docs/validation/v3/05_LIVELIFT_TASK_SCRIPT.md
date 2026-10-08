# LiveLift V3 Operator Task Script & Live Desk Execution Runbook

**Document ID:** `VAL-V3-LIVE-05`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 3 (Execution Runbooks & Checklists)  
**Classification:** Standard Operating Procedure & Operator Runbook  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §7, §21, §28; `docs/validation/v3/00_VALIDATION_PROTOCOL.md`; `docs/validation/v3/04_TEST_SCENARIO.md`; `docs/validation/v3/07_DISTURBANCE_TIMELINE.md`

---

## 1. Executive Summary & Purpose

This document provides the authoritative, step-by-step operational runbook for the live-room operator running the **LiveLift Commerce Operations Desk** during experimental validation trials.

### 1.1 The Operator's Operational Role
In TikTok Shop live commerce broadcasts across Vietnam and Southeast Asia, the behind-the-camera operator is the air-gapped human bridge between studio pacing, merchandising systems, and on-camera talent:
1. **Pacing Governance:** Tracking active elapsed time against the run-of-show (ROS) budget, protecting committed promotional windows, and preventing catastrophic schedule drift.
2. **Platform Console Execution:** Manually pinning and unpinning product cards in TikTok Shop Seller Center, verifying active discount vouchers, and monitoring inventory depleting in real time.
3. **Talent Coordination:** Providing glanceable, low-noise cues to the on-camera host without inducing teleprompter glaze, cognitive overload, or speech stumbles.
4. **Post-Show Accounting:** Recording execution actuals for brand proof-of-performance and commission reconciliation.

### 1.2 Certified Feature Reality & Wizard-of-Oz Boundaries (UI SHA `9a91101`)
In strict compliance with the **Integrity Mandate** and the rule that *"Never pretend unfinished functionality exists"*, the operator interacts with the system strictly across certified operational boundaries:
- **`IMPLEMENTED` (Functional Domain Engine & Durable Local Store):** Session creation (`/live/new`), rundown configuration (`/prepare`), live desk tracking (`/operate`), segment commands (`start_live`, `advance_segment`, `extend_segment`, `commit_end_by`, `reanchor_segment`, `end_live`), manual cue action reporting (`report_cue`), operator note capture (`add_note`), dynamic rolling forecast engine (`next/src/lib/domain/forecast.ts`), constraint-aware recovery analysis (`next/src/lib/domain/recovery.ts`), revision-checked guarded local persistence (`next/src/lib/store/sessionStore.ts`), plan-vs-actual review table (`/review`), and Next LIVE rundown adaptation generator (`next/src/lib/domain/nextLive.ts`, `createNextSession`).
- **`SIMULATED` (Test Environment & Fixtures):** Deterministic rehearsal scenarios (`buffered`, `missed`, `minimum` — sessions `sim-buffered`, etc. in `/simulator`) driven by explicit virtual clocks, and sample product catalogs (`next/src/fixtures/library.ts`).
- **`WIZARD-OF-OZ` (Facilitator-Delivered Links):** Host prompt tablet mirror display (relayed by facilitator because no native multi-device WebSocket synchronization exists), and TikTok Shop Seller Center console responses (simulated inventory depletion and network pin spinners).
- **`NOT AVAILABLE` (Platform / Autonomous Exclusions):** Automated native TikTok Shop pinning, automated voucher distribution, autonomous AI pacing engines, and private TikTok streaming APIs are strictly excluded. All platform actions remain manual in TikTok Shop Seller Center.

```
+----------------------------------------------------------------------------------------------------+
|                               LIVELIFT OPERATOR WORKSPACE ARCHITECTURE                             |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ DISPLAY 1: CONTROL DESK (Fullscreen F11) ]       [ DISPLAY 2: SELLER CENTER & OBS MONITOR ]     |
|  +-------------------------------------------+       +-------------------------------------------+ |
|  | LiveLift Commerce Operations Desk         |       | TikTok Shop Seller Center (Manual Pinning)| |
|  | - NOW Command Panel (Timer, Active Item)  |       | - Product Showcase Pin / Unpin Button     | |
|  | - NEXT Recommendation Band (Action, Cue)  |       | - Flash Voucher Activation Console        | |
|  | - Operator Toolbar (Extend, End-By, Cue)  |       | - Live Inventory Stock Ledger             | |
|  | - Run of Show Live Scroll List            |       | OBS Studio Master Stream Monitor (1080p)  | |
|  | - Recovery Drawer (Candidate Plans)       |       | - Live Camera Return & Audio Levels       | |
|  +-------------------------------------------+       +-------------------------------------------+ |
|                                                                                                    |
|                                       COMMUNICATION BRIDGE                                         |
|                                                │                                                   |
|                                                ▼                                                   |
|                        [ ON-CAMERA HOST VIEW TABLET (Line of Sight) ]                              |
|                        - Synchronized Digital Countdown Timer                                      |
|                        - Active Presenting Product Code & SKU                                      |
|                        - Atomic Operator Instruction (<= 5 Words)                                  |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Pre-Show Preparation & Pre-Flight Protocol ($T-15\text{m}$ to $T-00\text{m}$)

Prior to broadcast kickoff, the operator must execute the pre-flight verification sequence.

### 2.1 Workstation Lockdown & Durable Persistence Protocol
1. **Dedicated Fullscreen Kiosk:**
   - Launch Google Chrome on the primary operator display.
   - Navigate to the designated trial session URL: `http://localhost:3000/live/[SessionId]/operate`.
   - Press **`F11`** to enter fullscreen kiosk mode. Address bar, bookmarks bar, and system tray must be completely hidden.
2. **Durable Local Storage Authority (`SessionStore`):**
   - The LiveLift desk persists session state, executed boundaries, and receipts into browser `localStorage` with guarded local persistence under isolated REAL/SIMULATED envelopes (`livelift.v3.REAL` or `livelift.v3.SIMULATED`).
   - If an accidental browser refresh occurs during a live trial, `SessionStore` automatically rehydrates the complete active session state from browser `localStorage` with revision checks, restoring recorded timestamps, active segment index, and event history.
3. **Macro & Extension Audit:**
   - Confirm that no third-party automation tools, macro keypads (Stream Deck automations), AutoHotkey scripts, or countdown extensions are running.

### 2.2 System Configuration & Rundown Review
1. **Catalog Preload, Import & Rundown Audit (`/prepare`):**
   - *Catalog Source Boundary:* Built-in sample fixtures (`next/src/fixtures/library.ts`) provide fashion products. For experimental trials, the research proctor pre-loads or authors the study packs into `/prepare` prior to participant seating:
     * In `/live/[sessionId]/prepare`, use the **Import** dialog (`data-testid="import-btn"`) to import the scenario TSV/CSV rows (`parseProductRows`), or initialize the session shell using the study catalog fixture.
   - Confirm pre-loaded product catalog:
     * **Scenario 1:** `CAT-COSMETICS-01` (AuraSkin: `SYS-INTRO`, `SKU-SERUM`, `SKU-TONER`, `SKU-KEMD`, `SKU-NANG`, `SYS-CLOSE`).
     * **Scenario 2:** `CAT-TECHFASH-02` (UrbanPulse: `SYS-INTRO2`, `SKU-TECH1`, `SKU-TECH2`, `SKU-FASH1`, `SKU-FASH2`, `SYS-CLOSE2`).
   - Verify that the planned duration totals exactly **15.0 minutes** (900 seconds) across 6 segments.
   - Confirm that the two hard promotion anchors are correctly tagged:
     * Scenario 1: Anchor 1 at $09:00:00$ (`SKU-KEMD`), Anchor 2 at $14:00:00$ (`SYS-CLOSE`).
     * Scenario 2: Anchor 1 at $10:30:00$ (`SKU-FASH1`), Anchor 2 at $14:00:00$ (`SYS-CLOSE2`).
2. **Clock Synchronization:**
   - Synchronize the operator workstation clock with the OBS studio master digital clock overlay within $\pm 0.5$ seconds.
   - Confirm that TikTok Shop Seller Center server time matches workstation wall-clock time.
3. **Host Display Link Verification:**
   - Verify that the host's auxiliary tablet screen is powered on, positioned directly under or adjacent to the primary camera lens ($< 15^\circ$ angular deviation).
   - Confirm facilitator remote push mirror responds within $\le 1.0$ second to operator status changes.

---

## 3. Live Desk UI Architecture & Operational Controls

The LiveLift Commerce Operations Desk (`next/src/app/live/[sessionId]/operate/page.tsx`) organizes runtime control into four high-visibility UI zones:

```
+----------------------------------------------------------------------------------------------------+
| 1. FOCUSED SHELL HEADER: Session Title · Environment · Elapsed (MM:SS) · Lead Op · [End LIVE]      |
+----------------------------------------------------------------------------------------------------+
| 2. DOMINANT COMMAND BAND (Top 40% of Screen):                                                      |
|  +---------------------------------------------+ +-----------------------------------------------+ |
|  | [NOW PANEL] (Active Runtime State)          | | [NEXT PANEL] (Recommendation & Action)        | |
|  | - Presenting SKU Avatar & Product Title     | | - Target Segment / Product Banner             | |
|  | - ACTUAL ELAPSED (Large Font, MM:SS)        | | - Algorithmic "Why" Rationale Text            | |
|  | - Remaining to Target / Estimate (MM:SS)    | | - [Start Next Segment] (Authoritative Action) | |
|  | - Imminent Anchor Warning Banner            | | - [Review Recovery Options] (When Deficit)    | |
|  | - Cue Action Strip (Attempted / Performed)  | | - Guidance: "Start transitions runtime"       | |
|  +---------------------------------------------+ +-----------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
| 3. OPERATOR TOOLBAR (Quick Capture & Routine Controls):                                            |
|  [Extend +1m]  [Set Target End-By]  [Re-anchor]  [Report Cue]  [Record Note]                       |
+----------------------------------------------------------------------------------------------------+
| 4. LOWER REGION:                                                                                   |
|  +---------------------------------------------+ +-----------------------------------------------+ |
|  | [RUN OF SHOW SCROLL LIST]                   | | [SUPPORTING TAB REGION]                       | |
|  | - Segment 01 to 06 with Order Badges        | | - Tabs: [History] [Coverage] [Plan Changes]   | |
|  | - Active Highlighting: Dark Green (#252D28) | | - History: Timestamped event audit log        | |
|  | - Target vs Actual Minutes Pill             | | - Coverage: Declared product pitch points     | |
|  | - Planned vs Projected Start Times          | | - Plan Changes: Appended version history      | |
|  +---------------------------------------------+ +-----------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

### 3.1 Command Band Controls & Semantic Actions

#### The NOW Panel (`NowPanel.tsx`)
- **Presenting Product:** Displays active product initials, alphanumeric SKU code, and full title. Indicates operator reporting attribution (`Operator reported · lead · HH:MM:SS`).
- **`ACTUAL ELAPSED` Timer:** Large digital readout displaying exact elapsed minutes and seconds since the current segment was started.
- **`Remaining to target / Estimate`:** Countdown calculating remaining seconds to scheduled target or operator-entered estimate.
- **Imminent Anchor Warning Banner:** Surfaces high-contrast peripheral warnings when a hard anchor deadline is approaching or threatened by upstream overrun.
- **Cue Action Bar (`CueBar.tsx`):** Displays active promo cues with one-click reporting: `Attempted`, `Performed`, `Cancelled`.

#### The NEXT Panel (`NextPanel.tsx`)
- **Target Item & Strategic Rationale:** Outlines the upcoming product code and algorithmic basis (e.g., *"Scheduled hero pitch to drive morning campaign momentum"*).
- **Button: `Next segment` (`advance_segment`, `data-testid="advance-btn"`):** **The Authoritative Runtime Transition.** Clicking this button wraps the active segment, records actual completion timestamps in the immutable event log, advances the NOW cursor to the next item, and persists the state with revision-checked commits to `SessionStore`.
- **Button: Recovery Apply Candidates (`analyzeRecovery`, `data-testid={`apply-${o.kind}`}`):** When downstream schedule drift threatens a hard anchor, an alert surfaces on the desk. Clicking candidate apply buttons (`data-testid="apply-shorten_pending"`, `data-testid="apply-skip_optional"`, `data-testid="apply-skip_required"`, `data-testid="apply-end_by"`, `data-testid="apply-close_now"`) executes clean recovery plans that mathematically protect the anchor while respecting contractual floor limits.

### 3.2 Operator Quick Capture & Toolbar Actions
- **Button: `Extend +1m` (`extend_segment`):** Increments `targetDurationMinutes` by $+1.0$ minute for the active segment without altering the underlying pre-show baseline plan.
- **Button: `Set Target End-By` (`commit_end_by`):** Commits a hard ceiling end-time for the active segment to protect an upcoming anchor.
- **Button: `Re-anchor` (`reanchor_segment`):** Explicitly updates a promotional anchor commitment when commercial conditions dictate a schedule change.
- **Button: `Report Cue Action` (`report_cue`, `data-testid="cue-report-btn"` / `data-testid="cue-performed-btn"`):** Logs manual external platform operations (pinning, unpinning, voucher drop) with verified timestamps and target SKU IDs.
- **Button: `Add Note` (`add_note`, `data-testid="quick-add-note-btn"`):** Opens text capture modal. Allows operator to record unstructured runtime observations (e.g., *"Host answering chat question on skin compatibility"*).

---

## 4. Scenario 1 Second-by-Second Execution Runbook (Cosmetics Catalog)

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

### 4.1 Second-by-Second Detailed Event Script

#### $T = 00:00:00$ — Session Kickoff (`SYS-INTRO`)
1. Proctor signals: *"Bắt đầu phiên live!"*
2. Operator observes LiveLift desk initialized on Segment 1 (`SYS-INTRO`). Planned target: 2.0m.
3. Verify timer starts ticking on `now-actual-elapsed`.
4. Switch to TikTok Shop Seller Center window: Verify stream is live and audio is balanced.
5. Host introduces broadcast, announces voucher goals, and teases the 09:00:00 Retinol Flash Deal.

#### $T = 01:45:00$ — Pre-Cue for Segment 2
1. LiveLift timer indicates `01:45` elapsed (15 seconds to target).
2. Inspect NEXT panel: Target shows `SKU-SERUM` (Hero 1: Serum Niacinamide) and upcoming `Next segment` transition.
3. Stage `SKU-SERUM` in TikTok Shop Seller Center showcase list.

#### $T = 02:00:00$ — Transition to Segment 2 (`SKU-SERUM`)
1. At exactly `02:00`, click **`Next segment`** (`data-testid="advance-btn"`).
2. NOW panel updates to `SKU-SERUM` (Hero 1). Timer resets to `00:00`. Target duration displays `4m`.
3. In Seller Center: Immediately click **Pin Product** for `SKU-SERUM`.
4. Return to LiveLift: In Cue Bar, click **Report Action** (`data-testid="cue-report-btn"`). Select `SKU-SERUM`, action `pin_product`, click **Save**.
5. Host begins core product demonstration on camera.

#### $T = 04:30:00$ — Disturbance D1 Stimulus Injected
1. Proctor triggers mock audience chat question to host: *"Shop ơi da đang treatment bong tróc có xài được không, test lên da ngăm xem có vón không ạ?"*
2. Host reads comment aloud and begins detailed physical application on hand.
3. Operator monitors elapsed time. Notice pitch extends into technical deep-dive.

#### $T = 06:00:00$ — Scheduled Segment 2 Deadline Reached
1. LiveLift NOW timer reaches `04:00` (planned target elapsed).
2. Host continues detailed demonstration, answering audience inquiries.
3. Operator observes active duration drifting positive on the desk without altering the schedule prematurely.

#### $T = 06:30:00$ — Disturbance D1 Deficit Evaluation & Native Forecast Alert
1. Show clock reaches `06:30`. Active Serum elapsed time = `04:30`. Host signals 1 additional minute remaining.
2. **Canonical Scored Path:** Operator enters the prescribed remaining estimate of 1 minute (`1.0m`). LiveLift's implemented downstream forecast engine automatically evaluates the schedule: projected Serum end `07:30`, plus Toner 3.0m projects Flash Sale at `10:30`, detecting a **90-second (+1.5m) deficit** facing Hard Anchor 1 (`09:00:00`).
   *(Note on Operator Choice Branches: If an operator instead chooses an alternative action, such as clicking `Extend +1m` without entering a remaining estimate [yielding a 60s deficit] or clicking `Extend +1m` in addition to entering a 1m estimate [yielding a 90s deficit, as the forecast engine prioritizes the active estimate deadline], that trial follows an exploratory operator-choice branch and must be scored against its actual mathematical forecast rather than the canonical 90s ground truth).*
3. **Implemented Deficit Banner:** The UI displays the native schedule risk alert card:
   ```
   [CẢNH BÁO TIẾN ĐỘ: Dự phóng trễ 90s so với Flash Deal 09:00:00 (Thâm hụt: 1:30)]
   ```
4. **Native Recovery Candidate Generation (`recovery.ts`):**
   - The implemented recovery engine evaluates downstream compressible segments and generates feasible recovery plans:
     - *Compress Downstream Buffer:* Compress Segment 3 (Toner) from planned 3.0m to 1.5m (respects 1.0m contractual floor). Reclaims 1.5m, pulling Flash Deal back to exactly 09:00:00.
     - *Aggressive Compression:* Compress Toner to floor 1.0m (reclaims 2.0m, providing 30s safety margin).
5. **Operator Decision & Execution:**
   - Operator reviews generated candidate, applies the candidate (`data-testid="apply-shorten_pending"`), and confirms the recovery plan.
   - Click `Add note` (`data-testid="quick-add-note-btn"`): Type *"Compressing S3 Toner to protect 09:00 Flash Deal"*.
   - Transmit atomic cue to Host Tablet: `[RECOVER: Rút Toner còn 1.5m | Giữ Flash Deal 09:00]`.
   - Host nods and begins wrapping Serum demo.

#### $T = 07:30:00$ — Transition to Segment 3 (`SKU-TONER`)
1. Host concludes Serum pitch: *"Dạ em qua mã Toner cân bằng ngay đây ạ!"*
2. Operator clicks **`Next segment`** (`data-testid="advance-btn"`).
3. In Seller Center: Unpin `SKU-SERUM`, click **Pin Product** for `SKU-TONER`.
4. LiveLift NOW panel updates to Toner. Target duration is adjusted to compressed target (1.5m).

#### $T = 08:30:00$ — Pre-Anchor Synchronization Window (D2 Prep)
1. Show clock reaches `08:30` (30 seconds before immutable Flash Deal).
2. In Seller Center: Navigate to Flash Sale campaign tab; locate `SKU-KEMD` (Kem Dưỡng Retinol 50% Flash Sale).
3. Transmit atomic cue to Host Tablet: `[ANCHOR: 30s đếm ngược FLASH DEAL Retinol]`.
4. Host alerts viewers: *"Còn đúng 30 giây nữa hệ thống sẽ mở Flash Deal 50% Kem Dưỡng Retinol, chuẩn bị sẵn tay trên nút mua nha cả nhà!"*

#### $T = 09:00:00$ — Hard Anchor 1 Execution (D2 Evaluation)
1. Master digital clock strikes exactly `09:00:00`.
2. Operator clicks **`Next segment`** (`data-testid="advance-btn"`) in LiveLift.
3. In Seller Center: Click **Pin Product** for `SKU-KEMD`.
4. Host counts down on air: *"5-4-3-2-1 mở deal! Giá sốc 295k chính thức mở bán!"*
5. Observer records Anchor Start Variance ($V_{\text{anchor}} = |t - 09:00:00|$). Target: $\le 15$ seconds.

#### $T = 10:15:00$ — Disturbance D3 Abrupt Stockout Injection
1. Segment 4 has run for 1m15s ($T_{\text{start}}(S4) + 1\text{m}15\text{s}$).
2. **Proctor Injects Stockout:** Mock Seller Center console flashes red alert:
   ```
   [MOCK CONSOLE ALERT]: CẢNH BÁO TỒN KHO: Mã hàng SKU-KEMD đã hết (Tồn kho = 0).
   ```
3. **Operator Recognition ($T_{\text{detect}}$):** Operator spots inventory depletion.
4. **Immediate Recovery Execution:**
   - In Seller Center: Click **Unpin** immediately on `SKU-KEMD`.
    - In LiveLift desk: Advance to Segment 5 (`SKU-NANG` — Kem Chống Nắng) via `Next segment` (`data-testid="advance-btn"`, calling `advance_segment`). **Authorized Floor Exemption:** Stopping pitch on verified stockout is scored as a valid recovery.
    - Transmit emergency cue to Host: `[STOP/HẾT HÀNG: Cắt Kem Dưỡng -> Chuyển Kem Nắng]`.
    - Host smoothly pivots on stream: *"Dạ 50 suất Kem Dưỡng đã cháy hàng hoàn toàn, hệ thống vừa tự động đóng giỏ hàng! Em xin phép chuyển ngay qua siêu phẩm chống nắng..."*

#### $T = 10:30:00$ — Disturbance D4 Platform Console Lag Injection
1. Dynamic transition into Segment 5 initiates.
2. Operator clicks Pin for `SKU-NANG` in Seller Center on time.
3. **Proctor Injects Pin Lag:** 40-second network spinner locks Seller Center console:
   ```
   [SYSTEM BANNER]: Không thể ghim sản phẩm SKU-NANG. Đang kết nối máy chủ... (Thử lại trong 40 giây)
   ```
4. **Operator Response:**
   - Recognize that pin is delayed. Do NOT leave host stranded.
   - Transmit holding cue to Host: `[HOLD: Minigame/Tương tác 40s trong lúc ghim]`.
   - Host deploys interaction filler: *"Trong lúc chờ hệ thống tải giỏ hàng, em xin phép tặng 3 phần quà cho các chị thả tim nhiều nhất nha..."*
   - In LiveLift desk: Log cue action as `Attempted`.
   - **Platform Delay Separation:** The 40s console spinner is an unavoidable native platform delay; operator is graded on prompt dispatch and hold communication, without penalty for external platform lag.

#### $T = 11:10:00$ — D4 Cleared & Pin Confirmed
1. Network spinner resolves. Product card successfully pins in Seller Center.
2. In LiveLift desk: Update cue action to `Performed`.
3. Cues host: `[NOW: Đã ghim Kem Nắng | Giá 249k]`. Host resumes product pitch.

#### $T = 12:00:00$ — Disturbance D5 Host Under-run Stimulus
1. Segment 5 reaches $T_{\text{start}}(S5) + 1\text{m}30\text{s}$ at $T = 12:00$.
2. Host completes talking points quickly and signals on camera: *"Dạ mã chống nắng em chia sẻ xong rồi ạ, giờ mình chuẩn bị qua phần tiếp theo nha..."*
3. **Operator Pacing Recognition:**
   - Operator checks the clock: Current show time is $12:00$. Hard Anchor 2 (`SYS-CLOSE`) is locked to **14:00:00**.
   - **Critical Rule:** The operator must **NOT** transition to Segment 6 early. Ending early creates an unfillable dead air void.
4. **Operator Execution:**
   - Transmit holding cue to Host: `[HOLD: Review swatch + Q&A giữ sóng đến 14:00]`.
   - Host pivots into audience interaction: *"Em thấy có chị hỏi da treatment dùng chống nắng này có rát không, em test lại chất kem trên tay nha..."*

#### $T = 13:30:00$ — Pre-Close Preparation
1. Show clock reaches `13:30` (30 seconds before closing cutoff).
2. LiveLift NEXT panel shows Segment 6 (`SYS-CLOSE`).
3. Operator transmits final cue: `[ANCHOR: Đúng 14:00 tổng kết chốt đơn]`.

#### $T = 14:00:00$ — Hard Anchor 2: Closing Transition
1. Clock strikes exactly `14:00:00`.
2. Operator clicks **`Next segment`** (`data-testid="advance-btn"`, calling `advance_segment`).
3. Host begins official outro: announces last 60 seconds to complete pending carts, reviews 7-day return policy, and teases tomorrow's 20:00 session.

#### $T = 15:00:00$ — Broadcast Sign-off & Review Transition
1. Clock strikes `15:00:00`.
2. Proctor calls: *"Hết giờ phát sóng! Hoàn thành phiên live!"*
3. Operator clicks **`End LIVE`** in top header (`end_live`).
4. Modal confirms: *"End Live Tracking? [Cancel] [Confirm End]"*. Click **Confirm End**.
5. Browser automatically transitions directly to `/live/[sessionId]/review`.

---

## 5. Scenario 2 Second-by-Second Execution Runbook (Fashion/Tech Permuted)

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

| Elapsed (mm:ss) | State Anchor | Context & Stimulus | Operator Action on LiveLift Desk | Action in Seller Center / Chat | Scoring & Recovery Target |
|:---:|---|---|---|---|---|
| **00:00** | $T_{\text{start}}(S1)$ | Stream Kickoff (`SYS-INTRO2`). Planned: 1.5m. | Verify timer running on NOW panel. | Confirm OBS stream feed; monitor audio. | Setup verified $\pm 5$s. |
| **01:30** | $T_{\text{start}}(S2)$ | S1 ends. Transition to S2 (`SKU-TECH1` MagSafe). Planned: 3.5m. | Click `Next segment` (`advance-btn`). Target = 3.5m. | Pin `SKU-TECH1` in Seller Center. Log cue action in LiveLift. | Transition within $\le 5$s. |
| **03:15** | **$T_{\text{start}}(S2) + 1\text{m}45\text{s}$** | **INJECT D3 STOCKOUT:** Mock console alerts `SKU-TECH1` stock = 0. | Operator detects stockout ($T_{\text{detect}}$). Cues host to halt pitch. | Unpin `SKU-TECH1`. Transmit cue: `[STOP/HẾT HÀNG: Cắt Sạc MagSafe -> Chuyển Tai Nghe]`. | **$T_{\text{detect}} \le 10\text{s}$**. Host halts pitch within $\le 15$s. |
| **03:30** | Early S3 Entry | Transition cleanly to S3 (`SKU-TECH2` Tai Nghe ANC). Actual S2 = 2.0m (meets floor). | Click `Next segment` (`advance-btn`). NOW updates to `SKU-TECH2`. S3 has 7.0m window before 10:30 anchor. | Pin `SKU-TECH2` in Seller Center. Log cue action in LiveLift. | Clean early transition; contractual floor respected. |
| **06:00** | **$T_{\text{start}}(S3) + 2\text{m}30\text{s}$** | **INJECT D1 STIMULUS:** Proctor posts technical audio question to host. | Monitor active pitch. Host performs outdoor call test. | Observe pacing drift as pitch expands past scheduled target. | Natural overrun initiated. |
| **09:30** | **$T_{\text{start}}(S3) + 6\text{m}00\text{s}$** | **EVALUATE D1 DEFICIT:** S3 elapsed = 6.0m. Host requests 1m45s remaining (target end 11:15). Flash Sale locked to 10:30. **Anchor Deficit = +45s.** | LiveLift surfaces Deficit Alert card: `[Dự phóng trễ 45s so với Flash Deal 10:30:00]`. Click to open recovery options ($T_{\text{detect}}$). | Select valid recovery: direct host to wrap S3 by 10:30:00. Transmit: `[RECOVER: Chốt Tai Nghe đúng 10:30 | Giữ Flash Deal Áo Acid Wash]`. | **$T_{\text{detect}} \le 10\text{s}$**. Recovery preserves 10:30:00 anchor ($7.0\text{m}$ actual $\ge 3.0\text{m}$ floor). |
| **10:00** | Pre-Anchor Sync | 30s before Flash Sale. | Check countdown to 10:30:00. | Transmit cue: `[ANCHOR: 30s đếm ngược FLASH DEAL Áo Acid Wash]`. | Pre-cue sent $\ge 20$s before 10:30:00. |
| **10:30** | **Absolute Wall-Clock** | **EVALUATE D2 ANCHOR 1:** Flash Deal unlocks. **INJECT D4 CONSOLE LAG:** 40s spinner on pinning `SKU-FASH1`. | Click `Next segment` (`advance-btn`) in LiveLift. Dispatches Seller Center pin on time; recognizes pin lag ($T_{\text{detect}}$). | Cues host: `[HOLD: Minigame chọn size 40s trong lúc ghim]`. Host verbal countdown on time. | **Announcement Variance = 0s**. 40s console spinner recorded as unavoidable platform lag. |
| **11:10** | D4 Cleared | Network spinner resolves. Product pins. | Update cue action in LiveLift to `Performed`. | Cues host: `[NOW: Đã ghim Áo Acid Wash 180k]`. Host pitches deal. | Pin verified on stream. Dead air avoided. |
| **12:30** | S4 End | Transition to S5 (`SKU-FASH2` Cargo Pants). Planned: 1.5m. | Click `Next segment` (`advance-btn`). NOW updates to `SKU-FASH2`. | Pin `SKU-FASH2` in Seller Center. Log cue action in LiveLift. | Transition within $\le 5$s. |
| **13:15** | **$T_{\text{start}}(S5) + 45\text{s}$** | **INJECT D5 UNDER-RUN:** Host exhausts styling tips; signals early wrap. | Recognize pacing void ($T_{\text{detect}}$). Do NOT advance S6 early. | Transmit holding cue: `[HOLD: Minigame chia sẻ live giữ sóng đến 14:00]`. | **Closing Anchor held at 14:00:00**. |
| **14:00** | **Absolute Wall-Clock** | **EVALUATE CLOSING ANCHOR:** Final closing window unlocks. | Click `Next segment` (`advance-btn`). NOW updates to `SYS-CLOSE2`. | Host begins outro and tomorrow teaser. | **$V_{\text{anchor}} \le 15\text{s}$**. |
| **15:00** | Final Cutoff | Broadcast concludes. | Click `End LIVE` -> Confirm End. | Stream offline in OBS. Transition directly to `/review`. | Total runtime = $15\text{m}00\text{s} \pm 15\text{s}$. |

---

## 6. Wrap & Matched Post-Session Review Runbook

Once the broadcast ends, the operator completes the post-show workflow directly in the **Review Workspace** (`/live/[sessionId]/review`). To maintain experimental parity with the baseline condition, the post-show task consists of the **identical 2-part matched protocol**, timed continuously by the proctor without predetermined duration assertions:

### 6.1 Matched Post-Show Protocol Specification

```
+----------------------------------------------------------------------------------------------------+
|                                MATCHED POST-SHOW PROTOCOL (PARITY SPECIFICATION)                   |
+----------------------------------------------------------------------------------------------------+
| Part 1: Plan-vs-Actual Fact Reconciliation (Metric M10 — T_recon)                                  |
|   - Scope: Inspect Review Table (actuals, variances, anchor adherence, stockout timeline).        |
|   - Output: Answer standardized Fact Probes (actual durations, peak anchor drift, stockout time).  |
|   - Measurement: Timed from stream conclusion until fact sheet submission (Target Budget <= 5.0m). |
|                                                                                                    |
| Part 2: Next LIVE Rundown Adaptation (Metric M11 — T_next_plan & F_next)                           |
|   - Scope: Select candidate trade-offs in NextLivePanel; generate adapted session draft.           |
|   - Output: Adjusted segment allocations, valid buffer pool >= 5.0m, protected promotional anchors |
|   - Measurement: Timed from Next LIVE start to draft creation; validated for anchor feasibility.   |
+----------------------------------------------------------------------------------------------------+
```

#### Step 1: Plan-vs-Actual Fact Reconciliation (Metric M10)
1. Immediately upon clicking `Confirm End` ($T = 15:00$), the research proctor starts the stopwatch for **Metric M10 ($T_{\text{recon}}$)**.
2. The browser loads `/live/[sessionId]/review`, displaying the **Plan vs Actual Review Table** (`ReviewTable.tsx`):
   - Compiles exact executed durations, planned targets, pacing variances, and execution status (`completed`, `skipped`, `incomplete`).
   - Displays promotional anchor adherence variances ($V_{\text{anchor}}$) for Anchor 1 and Anchor 2.
   - Summarizes net stream duration drift and cue action performance.
3. The operator answers the standardized 5-question Fact Sheet administered by the proctor:
   - *Probe 1:* What was the actual executed duration of Hero SKU 1?
   - *Probe 2:* What was the exact wall-clock start time of Flash Sale Anchor 1?
   - *Probe 3:* What was the realized timing variance on Anchor 1 ($V_{\text{anchor}}$)?
   - *Probe 4:* At what exact elapsed time was the stockout/overrun detected?
   - *Probe 5:* What was the net duration drift across the entire stream?
4. Proctor records $T_{\text{recon}}$ stop time upon Fact Sheet submission and evaluates accuracy ($\ge 80.0\%$ per trial [$\ge 4/5$ probes] and $\ge 90.0\%$ pooled across paired trials [$\ge 9/10$ probes] required for validity).

#### Step 2: Next LIVE Rundown Adaptation (Metric M11)
1. Immediately following Fact Sheet submission, the proctor starts the stopwatch for **Metric M11 ($T_{\text{next\_plan}}$)**.
2. In the **Next LIVE Panel** (`NextLivePanel.tsx`), the operator reviews candidate operational changes derived from the completed session:
   - Evaluates proposed duration adjustments (e.g. extending hero demo duration, trimming buffer).
   - Toggles candidate change checkboxes.
   - The engine validates anchor feasibility in real time: if selected adjustments create an unavoidable conflict with committed promotional anchors, the system warns the operator and blocks starting an infeasible plan until resolved.
3. Operator clicks **Create Next LIVE Session** (`data-testid="create-next-live-cta-btn"`, calling `createNextSession`).
   - A fresh session draft is created with new logical segment and cue IDs.
   - Baseline durations reflect approved changes; execution actuals and events are cleanly initialized to empty.
4. Proctor records $T_{\text{next\_plan}}$ upon plan completion and verifies plan feasibility ($F_{\text{next}} \in \{0, 1\}$).

---

## 7. Operator Troubleshooting & Human Error Mitigation

| Operational Anomaly | Immediate Root Cause | Operator Corrective Action | System Failsafe |
|---|---|---|---|
| **Accidental Segment Advance** | Operator double-clicked `Start Next segment`. | Check NOW panel. If advanced prematurely, use `Set Target End-By` to pace segment, or proceed with current item. | Immutable event log records all transitions with exact timestamps; no history is lost. |
| **Accidental Browser Reload** | Operator brushed trackpad back-swipe or pressed `Ctrl + R`. | Allow reload to complete. `SessionStore` automatically rehydrates the session from browser `localStorage` with revision checks. | Guarded local persistence preserves complete runtime actuals and timestamps. |
| **Host Fails to See Cue Tablet** | Host distracted by camera or ring light reflections. | 1. Operator delivers brief backup hand signal (e.g. 5-finger countdown).<br>2. Verify tablet brightness is set to 100% and angle is $< 15^\circ$ from camera. | Observer 2 logs cue transmission latency and delivery channel. |

---

## 8. Governance Sign-Off

This document constitutes the standardized operational runbook for LiveLift desk testing across all participant trials. Any modifications to button mappings or execution sequences must be documented in a dated version addendum.

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 3 | Lead Technical Author (M3) | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
