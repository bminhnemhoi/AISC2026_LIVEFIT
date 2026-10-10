# LiveLift V3 Master Validation Protocol

**Document ID:** `VAL-V3-PROTO-00`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 1 (Foundations & Participant Pipeline)  
**Classification:** Research Governance & Protocol Specification  
**Authoritative Source:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md`

---

## 1. Executive Summary & Validation Objective

This document defines the master empirical validation protocol for the **LiveLift Commerce Operations Desk (V3)**. 

### 1.1 The Product Hypothesis
The hypothesis under evaluation is **not**:
> *"LiveLift is a better TikTok dashboard or an AI sales generator."*

TikTok already natively controls and optimizes broadcast video encoding, content delivery networks (CDN), live chat moderation, product showcase pinning, native voucher distribution, flash sales, and post-stream GMV analytics. Rebuilding or wrapping these capabilities provides zero durable enterprise value.

Instead, the formal hypothesis to test is:
> **The LiveLift Commerce Operations Desk materially improves live SHOW OPERATIONS—specifically schedule-risk detection, overrun recovery, hard promotion anchor protection, host-operator coordination, Plan-vs-Actual reconstruction, and feasible Next LIVE planning—compared with a competent, highly optimized spreadsheet and chat workflow, without increasing critical cue misses or operator cognitive burden.**

### 1.2 Evaluation Principles
1. **Dignity of the Baseline:** The comparison baseline (Google Sheets + Zalo/Telegram) must be configured to professional standards, equipped with dynamic time formulas, conditional formatting alerts, and standardized cue syntax. Strawman baselines are strictly forbidden.
2. **Behavioral Evidence Over Opinion:** Subjective satisfaction is secondary to audited, second-level behavioral measurements: detection latencies, recovery decision speeds, boundary error rates, message volumes, and factual reconstruction accuracy.
3. **Absolute Feature Truthfulness:** Prototype capabilities must be strictly classified into four operational states (`IMPLEMENTED`, `SIMULATED`, `WIZARD-OF-OZ`, `NOT AVAILABLE`). Software limitations must be transparently disclosed to participants and researchers. Unimplemented backend engines must never be faked as working software.
4. **Independent Governance Gates:** Validation results map directly to preregistered thresholds determining strategic product outcomes: **BUILD (Phase 1 Authorization)**, **PIVOT (Desk-Only, Review-Only, or Template)**, or **KILL / DO NOT ADVANCE**.
5. **Spreadsheet Integrity & Macro Prohibition:** The baseline Google Sheets workbook (`LiveLift_Val_Baseline_[SubjectID]`) must have all calculation and formula ranges (Columns E, H, R `Anchor_Deficit_Min`, and conditional formatting rules) locked via Google Sheets Protected Ranges (View-Only). Participants are restricted to designated manual input cells. Participant-authored macros, Google Apps Script automations, custom desktop audio chimes, or external browser extensions are strictly forbidden to ensure baseline consistency.

---

## 2. Core Operational Dimensions

The validation trial interrogates the six fundamental operational failure modes characteristic of fast-paced TikTok Shop live commerce:

```
+----------------------------------------------------------------------------------------------------+
|                                    LIVELIFT SHOW OPERATIONS DESK                                   |
+----------------------------------------------------------------------------------------------------+
| 1. Schedule-Risk Detection  | Detects deadline deficits before they cause misses                   |
| 2. Overrun Recovery         | Presents valid, constraint-aware choices (buffer/shorten/skip)       |
| 3. Hard Anchor Handling     | Preserves committed wall-clock promotions; never silently shifts     |
| 4. Host/Operator Sync       | Replaces noisy chat with minimal, glanceable cues (Host View)        |
| 5. Plan-vs-Actual Review    | Reconstructs delays, skips, and variances without video replay       |
| 6. Next LIVE Adaptation     | Clones rundown with validated selected patches for tomorrow's show   |
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Dimension 1: Schedule-Risk Detection
* **Operational Problem:** In live broadcasts, host banter, unexpected audience questions, and sales momentum cause pitches to overrun their time budgets. Operators relying on mental math fail to notice that downstream buffers are exhausted until an immovable promotional window is breached.
* **Mechanism:** The system tracks active segment elapsed time against planned duration. When active elapsed time exceeds the target, it recalculates future floating segments. If the projected cursor exceeds an upcoming hard anchor start time ($T_{\text{projected}} > T_{\text{anchor}}$), the system immediately raises an explicit deficit alert (e.g., `"1m deficit"`) accompanied by a concise rationale.
* **Proof Target:** $\ge 80\%$ of injected schedule conflicts recognized by the operator within $\le 10$ seconds.

### 2.2 Dimension 2: Overrun Recovery
* **Operational Problem:** When a schedule slips, operators under pressure attempt rapid ad-hoc arithmetic to salvage the broadcast. They frequently violate vendor contractual minimums (e.g., cutting a paid brand sponsor below its agreed floor) or fail to reclaim sufficient time, causing secondary collisions.
* **Mechanism:** A constraint-aware recovery engine evaluates remaining segment flexibility (unallocated buffers, compressible flags, floor durations) and presents explicit, feasible choices: consume buffer, compress pending segments, close active segment immediately, or skip optional items.
* **Proof Target:** Median recovery decision time $\ge 30\%$ faster than baseline; $\ge 90\%$ of recovery choices valid under declared segment constraints; zero additional cue misses.

### 2.3 Dimension 3: Hard Promotion Anchor Handling
* **Operational Problem:** TikTok Shop campaigns feature time-locked deals—Seller Center Flash Deals (*Giờ vàng giá sốc*), platform-subsidized vouchers, and sponsored brand drops—configured to activate at precise wall-clock seconds. If the host is not actively selling that item when the deal unlocks, conversion velocity drops catastrophically.
* **Mechanism:** Hard anchors are immutable wall-clock commitments. If the show runs ahead of schedule, the system preserves the unallocated waiting buffer rather than pulling the anchor forward. If delayed, it flashes an urgent deficit warning. Anchors are never silently shifted in time.
* **Proof Target:** Exactly 0 unintended critical anchor misses; median anchor start variance $\le 15$ seconds from committed wall-clock time.

### 2.4 Dimension 4: Host-Operator Coordination
* **Operational Problem:** The operator communicates timing adjustments to the on-camera host via physical whiteboards, hand gestures, in-ear IFBs, or noisy Zalo/Telegram group chats. These channels cause visual distraction, teleprompter hesitation, speech stumbles, or missed cues.
* **Mechanism:** Scoped, read-only Host View displaying an atomic countdown timer, the active product name, the next immediate cue, and a single operator instruction ($\le 5$ words).
* **Proof Target:** $\ge 30\%$ reduction in avoidable timing/cue chat messages; $\ge 80\%$ of cues comprehended within $\le 5$ seconds; zero host speech stumbles or delivery degradation.

### 2.5 Dimension 5: Plan-vs-Actual (PVA) Reconstruction
* **Operational Problem:** Post-live debriefs, brand proof-of-performance reports, and agency invoicing require an accurate record of what occurred on air. Teams spend 30–60 minutes scrubbing video replays and cross-referencing messy chat logs to determine actual segment durations.
* **Mechanism:** The system locks the planned baseline at show start and appends timestamped session events for every transition, manual note, and operator-reported platform action. At wrap, it renders a structured variance report detailing $\Delta$ durations, consumed buffers, and skipped items.
* **Proof Target:** Post-show review completed in $\le 5$ minutes (median $\ge 30\%$ faster than baseline); $\ge 90\%$ accuracy on standardized operational fact probes.

### 2.6 Dimension 6: Feasible Next LIVE Planning
* **Operational Problem:** Operational learnings from one broadcast are rarely systematically applied to the next. Teams repeat the same timing miscalculations across multi-day sales campaigns.
* **Mechanism:** Operators review variances, select justified timing adjustments (e.g., adding +2 minutes to Hero Serum, cutting 1 minute from Intro), and generate a cloned rundown for the next session. The system validates the patched allocations against downstream hard anchors, ensuring the new rundown is mathematically feasible.
* **Proof Target:** Next LIVE planning completed $\ge 30\%$ faster than manual spreadsheet duplication; at least 3 teams voluntarily adopt approved patches across consecutive live sessions.

---

## 3. Experimental Design & Architecture

### 3.1 Study Design: Paired Within-Subjects Counterbalanced Trial
To maximize statistical power while controlling for individual operator competence, spreadsheet proficiency, and domain familiarity, this protocol employs a **within-subjects, paired experimental design**.

Every participating operator-host pair completes **both** experimental conditions:
* **Condition A (LiveLift Desk):** LiveLift Commerce Operations Desk (P0 Operator Desk UI + Wizard-of-Oz host/forecast mechanics).
* **Condition B (Baseline Desk):** Competent Google Sheets Rundown + Standardized Zalo/Telegram Chat backchannel.

### 3.2 Counterbalancing Matrix
To eliminate order effects, asymmetric skill transfer, and fatigue bias, participants are randomized into two balanced cohorts:

```
                      [ Participant Cohort (N = 6 to 10 pairs) ]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
         [ Cohort 1 (50%) ]                              [ Cohort 2 (50%) ]
                 │                                               │
           Trial 1: Condition A                            Trial 1: Condition B
           (LiveLift Desk)                                 (Baseline Desk)
                 │                                               │
           [ Washout / Rest ]                              [ Washout / Rest ]
                 │                                               │
           Trial 2: Condition B                            Trial 2: Condition A
           (Baseline Desk)                                 (LiveLift Desk)
```

| Cohort | Sequence | Trial 1 Condition | Trial 1 Scenario | Trial 2 Condition | Trial 2 Scenario | Target Sample |
|:---:|:---:|---|---|---|---|:---:|
| **Cohort 1** | $A \rightarrow B$ | Condition A (LiveLift) | Scenario 1 (Cosmetics) | Condition B (Baseline) | Scenario 2 (Fashion/Tech) | $n = 3\text{--}5$ pairs |
| **Cohort 2** | $B \rightarrow A$ | Condition B (Baseline) | Scenario 1 (Cosmetics) | Condition A (LiveLift) | Scenario 2 (Fashion/Tech) | $n = 3\text{--}5$ pairs |

* **Scenario Difficulty Parity & Temporal Permutation:** Scenario 1 and Scenario 2 maintain equivalent cognitive difficulty, identical segment count ($N=6$), identical total buffer allocations ($5.0\text{m}$), and two hard promotion anchors. However, to eliminate temporal anticipation and order-transfer bias, **Scenario 2 features permuted disturbance placements and injection timings** (e.g., in Scenario 2, D1 Overrun occurs on Segment 3 stimulated at $T=06:00$ with deficit evaluated at $T=09:30$; Hard Anchor 1 occurs at $T=10:30$; Stockout occurs on Segment 2 at $T=03:15$ with transition at $03:30$; Console Lag occurs on Segment 4; Under-run occurs on Segment 5 at $T=13:15$). This ensures operators in Trial 2 cannot predict disturbance onsets based on Trial 1 elapsed time.
* **Expanded Washout Interval & Active Distractor Task:** To eliminate cognitive carryover and temporal rehearsal between trials, the inter-trial washout is expanded to **10–15 minutes** (replacing brief 5-minute pauses). The washout includes the administration of the Trial 1 NASA-TLX survey in a separate physical/screen space followed by an active 5-minute cognitive distractor task (reviewing an unrelated catalog formatting sheet) completely disconnected from countdown timers and broadcast rundowns.

---

## 4. Software State & Feature Classification Matrix (Aligned with UI SHA `9a91101`)

In strict compliance with the **Integrity Mandate** and the rule that *"Never pretend unfinished functionality exists"*, every software capability utilized during validation is certified against the frozen UI implementation (`9a91101`):

| Feature / Subsystem | Certified Classification | Codebase Reality & Repository Reference | Validation Protocol Implementation |
|---|:---:|---|---|
| **Session Creation & Navigation** | `IMPLEMENTED` | Form in `next/src/app/live/new/page.tsx`; routes to `/prepare`, `/operate`, and `/review`. | Participant creates or clones show session; validated through guarded local SessionStore. |
| **Product Pack Configuration & Import** | `IMPLEMENTED` | Component `PrepareRos.tsx`; TSV/CSV import in `next/src/lib/domain/products.ts`. | Pre-loaded prior to session; participant verifies product status and imports rows. |
| **Run of Show Ordering & Readiness** | `IMPLEMENTED` | Segment creation, reordering, and anchor conflict detection in `PrepareRos.tsx` and `plan.ts`. | Participant reviews segment sequence; invalid anchor states block Start until resolved. |
| **Active Segment Tracking (NOW)** | `IMPLEMENTED` | Rendered in `NowPanel.tsx`. Real-time countdown and active target telemetry. | Displayed live during test. Driven by system clock with discontinuity detection. |
| **Segment Transitions & Timing Commands**| `IMPLEMENTED` | Commands in `engine.ts` (`start_live`, `advance_segment`, `extend_segment`, `commit_end_by`, `reanchor_segment`, `end_live`). | Operator issues explicit runtime timing adjustments via UI desk. |
| **Manual Cue Action Reporting** | `IMPLEMENTED` | Component `CueBar.tsx` and `OperateDialogs.tsx`; command `report_cue` in `engine.ts`. | Operator logs external promotional pin attempts (`attempted`, `performed`, `cancelled`). |
| **Operator Note Capture** | `IMPLEMENTED` | Dialog in `OperateDialogs.tsx`; command `add_note` in `engine.ts`. | Operator logs runtime context; persisted immutably in session history. |
| **Dynamic Rolling Forecast Engine** | `IMPLEMENTED` | Engine in `next/src/lib/domain/forecast.ts` (`forecastSession`). | Recalculates projected starts/ends from actual boundaries and explicit remaining estimates; holds at hard anchors. |
| **Constraint-Aware Recovery Drawer** | `IMPLEMENTED` | Algorithm in `next/src/lib/domain/recovery.ts` (`analyzeRecovery`); UI in `NextPanel.tsx` / `OperateDialogs.tsx`. | Evaluates candidate clean recovery plans (shorten, skip, end-by, reanchor); surfaces status and protects anchors. |
| **Durable Local Storage Authority** | `IMPLEMENTED` | Module `next/src/lib/store/sessionStore.ts` backed by browser `localStorage` with revision checks. | Revision-checked guarded persistence; rehydration preserves complete state on browser reload. |
| **Plan-vs-Actual Review Workspace** | `IMPLEMENTED` | View in `/live/[sessionId]/review`; table in `ReviewTable.tsx`; domain logic in `review.ts`. | Automatically compiles actual durations, variances, anchor drift, and execution outcomes upon ending tracking. |
| **Next LIVE Adaptation Generator** | `IMPLEMENTED` | Panel in `NextLivePanel.tsx`; domain logic in `nextLive.ts` (`createNextSession`). | Operator selects reviewed trade-offs; generates new draft session shell with anchor feasibility validation. |
| **Deterministic Rehearsal Scenarios** | `SIMULATED` | Scenarios `buffered`, `missed`, `minimum` (sessions `sim-buffered`, etc. in `scenarios.ts`); view in `/simulator`. | Repeatable rehearsal scripts executed on the shared domain engine with explicit virtual clock stepping. |
| **Sample Product Catalogs** | `SIMULATED` | Fixtures in `next/src/fixtures/library.ts` (built-in fashion); study cosmetics/tech packs imported via `/prepare`. | Pre-loaded via Prepare import flow (`import-btn` / `parseProductRows`) for test runs. Disclosed as sample data. |
| **Dedicated Host View Screen Sync** | `WIZARD-OF-OZ` | No network prompter sync route exists in `next/`. | Host participant displays cue tablet updated via facilitator proctor mirror. |
| **Native TikTok Shop Pinning Action** | `WIZARD-OF-OZ` | No native TikTok Seller Center integration. | Facilitator simulates native Seller Center pin states and console network latency (40s lag). |
| **Automated Native TikTok Pinning** | `NOT AVAILABLE` | Excluded by Master Roadmap §6, §7, §28. | Excluded from test. Native actions remain manual on phone/tablet or simulated in Seller Center. |
| **TikTok Private Streaming Telemetry**| `NOT AVAILABLE` | No official or unofficial live sales API exists. | Excluded from test. LiveLift makes zero real-time platform assumptions. |
| **AI Content/Script Generator** | `NOT AVAILABLE` | Excluded by Master Roadmap §14. | Excluded from test. All pitch scripts are human-authored. |

---

## 5. Wizard-of-Oz (WoZ) Protocol & Facilitator Rules

Capabilities that require cross-device teleprompter networking or direct native TikTok Shop console interaction are delivered through a preregistered **Wizard-of-Oz (WoZ)** protocol:

### 5.1 WoZ Governance Principles
1. **Clinical Neutrality:** The facilitator must never assist, coach, or prompt the participant toward a specific decision. The software's implemented recovery engine (`next/src/lib/domain/recovery.ts`) generates candidate options automatically; the facilitator does NOT suggest recovery actions.
2. **Transparent Disclosure:** Participants are briefed prior to the trial that host prompter synchronization and Seller Center console network behaviors operate under research facilitation.
3. **Rigid Latency Standards:** Facilitator stimuli (mock comments, stockout alerts, console lag spinners) must be injected within predefined, second-accurate time windows to ensure experimental reproducibility across all participant pairs.

### 5.2 Specific WoZ Mechanics

#### 1. Overrun & Deficit Triggering (Disturbance D1)
* **Trigger:** Facilitator stimulates active Segment 2 pitch via mock chat comment.
* **Mechanism:** In LiveLift, the implemented forecast engine (`forecastSession`) detects the deficit against Hard Anchor 1 and surfaces the alert card automatically on the desk. In Baseline, the spreadsheet formula in `Col R` highlights Dark Crimson Red. Facilitators do not manually calculate or verbally prompt the deficit.

#### 2. Host Display Synchronization
* **Trigger:** Operator confirms a segment transition or enters an operational note.
* **WoZ Action:** Because the prototype is a single-workstation desk without multi-device WebSocket networking, the facilitator updates the host's secondary prompt tablet within $\le 1.0$ second to reflect:
  - Active segment countdown timer.
  - Presenting product name and SKU.
  - Next immediate operational cue ($\le 5$ words).

#### 3. Native Platform Console Simulation (Disturbances D3 & D4)
* **Trigger:** Stockout (D3) at scheduled second; Console Lag (D4) upon anchor entry.
* **WoZ Action:** Facilitator triggers mock inventory drop to 0 units in the Seller Center console view, and injects the 40-second network spinner during product pinning. Facilitator records operator response and separates native platform lag from operator timing performance.

### 5.3 Technical Exception & Crash Recovery Runbook

The LiveLift prototype utilizes browser `localStorage` with revision-checked guarded persistence (`SessionStore`), while the baseline utilizes Google Sheets:

#### 1. Preventative Browser Lock & Kiosk Protocol
* **Fullscreen Kiosk Mode:** The operator desktop browser must run in dedicated fullscreen presentation / kiosk mode (`F11`) with bookmarked shortcuts and navigation bars hidden.
* **Macro & Extension Lock:** Operating systems must be audited prior to trial start. Macro keyboards, AutoHotkey scripts, browser timer extensions, and external automation software are strictly prohibited.

#### 2. Crash Triage & Invalidation Protocols
* **Case A: Pre-Disturbance Crash ($T_{\text{show}} < 04:00$, Prior to D1):**
  - If a browser crash or hardware freeze occurs prior to $T = 04:00$, the trial is **immediately restarted from $T = 00:00$** under a new session identifier (`[SubjectID]_[Cond]_Restart1`).
  - *Validity:* Permitted because the operator has not yet encountered any disturbance stimuli, preserving naive reaction latency.
* **Case B: Post-Disturbance Crash ($T_{\text{show}} \ge 04:00$, Active Disturbances):**
  - If a disruption occurs after D1 has been injected ($T \ge 04:00$), **the live trial must NOT be restarted**.
  - **Durable Local Recovery:** The operator refreshes the page (`F5`). `SessionStore` rehydrates the session from browser `localStorage` with revision checks, preserving all recorded actual timestamps, notes, and receipts.
  - If hardware completely fails, research staff salvage the trial using synchronized OBS multi-track recording:
    - *Track 1:* Operator desktop screen recording at 60 fps (1080p).
    - *Track 2:* On-camera host video stream.
    - *Track 3:* Synchronized millisecond master digital clock overlay.
    - *Track 4:* Synchronized studio audio stream.
  - Evaluators reconstruct exact timestamps ($T_{\text{detect}}$, $T_{\text{decision}}$, verbal cues, button clicks) from the high-resolution video capture. Data up to the crash point is certified under the `CRASH_SALVAGED_VALID` ledger.
* **Case C: Unrecoverable Technical Failure (Total Loss):**
  - If both browser session and video recording fail simultaneously, the trial is declared **INVALID (TECHNICAL LOSS)**.
  - Both Trial 1 and Trial 2 for the affected pair are discarded to prevent asymmetric within-subjects data.
  - A replacement pair is immediately scheduled into the **identical counterbalanced sequence** ($A \rightarrow B$ or $B \rightarrow A$) from the pre-screened backup reserve pool to preserve cohort counterbalancing balance.
  - *Recruitment Reserve:* The study maintains an oversubscription buffer of 8–10 recruited pairs to guarantee $\ge 6$ fully completed, audit-compliant pairs.

---

## 6. Standardized 15-Minute Test Scenario Overview

To evaluate live operational performance without imposing the logistical and cognitive exhaustion of a 90-minute broadcast, the protocol utilizes a **15-minute compressed live show scenario** (1:5 time compression ratio).

### 6.1 Master Scenario Rundown (T = 00:00 to 15:00)

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

| Seq | Segment Name | SKU ID | Planned Dur | Floor Dur | Compressible | Hard Anchor | Scheduled Window | Operational Role |
|:---:|---|---|:---:|:---:|:---:|:---:|:---:|---|
| **1** | Mở màn & Giới thiệu Deal | `SYS-INTRO` | **2.0m** | 1.0m | `FALSE` | `FALSE` | `00:00 - 02:00` | Stream kickoff, audience welcome, program voucher reveal. |
| **2** | Hero 1: Serum Sáng Da | `SKU-SERUM` | **4.0m** | 2.0m | `TRUE` | `FALSE` | `02:00 - 06:00` | Deep-dive product demo; core conversion hero; site for D1 overrun stimulus. |
| **3** | Đệm: Toner Cân Bằng | `SKU-TONER` | **3.0m** | 1.0m | `TRUE` | `FALSE` | `06:00 - 09:00` | Compressible buffer segment; absorbs overrun to protect Hard Anchor 1. |
| **4** | **FLASH SALE 1: Kem Dưỡng** | `SKU-KEMD` | **3.0m** | 2.0m | `FALSE` | **`TRUE (09:00)`** | `09:00 - 12:00` | **Hard Anchor 1: Platform 50% Flash Sale locked to 09:00:00.** (D3 site). |
| **5** | Upsell: Kem Chống Nắng | `SKU-NANG` | **2.0m** | 1.0m | `TRUE` | `FALSE` | `12:00 - 14:00` | Routine catalog item; site for D4 console lag and D5 underrun. |
| **6** | **KẾT SHOW: Tổng kết & Hẹn giờ**| `SYS-CLOSE` | **1.0m** | 1.0m | `FALSE` | **`TRUE (14:00)`** | `14:00 - 15:00` | **Hard Anchor 2: Final broadcast cutoff and tomorrow's tease.** |

* **Total Planned Duration:** Exactly 15 minutes (900 seconds).
* **Total Reclaimable Buffer:** Segment 2 ($4.0 - 2.0 = 2.0\text{m}$) + Segment 3 ($3.0 - 1.0 = 2.0\text{m}$) + Segment 5 ($2.0 - 1.0 = 1.0\text{m}$) = **5.0 minutes total flexibility**.
* **State-Relative Disturbance Synchronization:** Downstream disturbances are formally defined relative to segment state transitions rather than rigid wall-clock marks. This ensures that dynamic operator pull-forwards (e.g. pulling forward Segment 5 upon an inventory stockout) never cause temporal desynchronization or unscripted dead air.

---

## 7. The 5 Disturbance Injections & State-Relative Architecture

Every trial incorporates five realistic operational disturbances. To prevent timeline collapse when operators dynamically adjust the schedule, disturbances D3, D4, and D5 are anchored to **segment lifecycle states**:

```
+-----------------------------------------------------------------------------------------------------------------------------+
|                                             DISTURBANCE TAXONOMY & STATE-RELATIVE MATRIX                                    |
+-----------------------------------+--------------------+------------------------+-------------------------------------------+
| Disturbance Archetype             | State-Relative Trigger Anchor               | Nominal Mark | Operational Vulnerability  |
+-----------------------------------+--------------------+------------------------+-------------------------------------------+
| D1: Upstream Pitch Overrun        | T_start(S2) + 4m30s (Stimulated at T=04:30) | T = 06:30    | Segment Target Pacing / Slippage          |
| D2: Hard Promotion Anchor Deficit | Absolute Wall-Clock Commitment             | T = 09:00:00 | Platform Campaign Sync / Deal Start Instant|
| D3: Abrupt Mid-Pitch Stockout     | T_start(S4) + 1m15s (Flash Deal underway)  | T = 10:15    | Inventory Depletion / Emergency Pivot     |
| D4: Platform Console / Tech Lag   | Dynamic Transition into Segment 5 (S5 Entry)| T ≈ 10:30-12 | Operator Execution Gap / Console Pin Lag  |
| D5: Host Under-run / Script Stall | T_start(S5) + 1m30s in S1; +45s in S2      | T ≈ 12:00-13 | Pacing Void before Closing Anchor 2       |
+-----------------------------------+--------------------+------------------------+-------------------------------------------+
```

### 7.1 Detailed Injection Mechanics (Scenario 1)

1. **D1: Upstream Pitch Overrun (Stimulus at $T = 04:30$; Deficit at $T = 06:30$):**
   - *Natural Participant Stimulus:* The on-camera host is an authentic, unblinded experimental subject. Rather than deceptive scripting or artificial actor cues, the facilitator injects an urgent mock audience inquiry into the host's studio chat feed at $T = 04:30$ (*"Shop ơi test chất kem lên da ngăm và so sánh với bản cũ giúp em với ạ!"*).
   - This naturally engages the host, causing the pitch to extend past the planned 06:00 mark.
   - At show clock $T = 06:30$ ($T_{\text{start}}(S2) + 4\text{m}30\text{s}$), host signals 1m remaining, extending Serum to 07:30. With Toner at 3.0m, projected Flash Sale is 10:30, creating a **90-second ($1.5\text{m}$) projected deficit** against Anchor 1 ($09:00:00$). The operator must recognize the deficit, evaluate buffer compression options on Segment 3 (Toner), and issue a transition cue.
2. **D2: Hard Promotion Anchor Synchronization (at committed wall-clock $T = 09:00:00$):**
   - At exactly 09:00:00, the platform flash sale unlocks in Seller Center. The observer logs whether the operator gave a pre-cue to the host at $08:30$ and whether the transition to Segment 4 occurred within $\le 15$ seconds of $09:00:00$.
3. **D3: Abrupt Mid-Pitch Stockout (State-Relative: at $T_{\text{start}}(S4) + 1\text{m}15\text{s}$; Nominal $T = 10:15$):**
   - After the host has spent 1 minute 15 seconds pitching `SKU-KEMD`, the mock Seller Center console indicates inventory drops abruptly to 0 ("HẾT HÀNG").
   - The operator must detect the stockout, send an immediate halt cue to the host, unpin the sold-out SKU, and pull forward Segment 5 (`SKU-NANG`).
4. **D4: Platform Console / Tech Lag (State-Relative: Upon Segment 5 Entry / $T_{\text{start}}(S5) + 0\text{s}$):**
   - *State Anchor:* Injected dynamically at the exact second the operator initiates the transition into Segment 5 (whether pulled forward early at $T \approx 10:30$ or on schedule at $T = 12:00$).
   - A 40-second network spinner is simulated during product pinning in Seller Center. The operator must issue a holding cue to the host (`[HOLD: Minigame/Tương tác]`) to prevent dead air while waiting for the pin to resolve.
   - *Desynchronization Prevention:* Because D4 is anchored to S5 entry rather than a hardcoded wall-clock time, it is guaranteed to occur during active product pinning, preventing the fatal flaw of injecting a pin lag after the product was already pinned.
5. **D5: Host Under-run / Script Stall (State-Relative: at $T_{\text{start}}(S5) + 1\text{m}30\text{s}$; Nominal $T = 12:00$):**
   - *State Anchor:* Injected dynamically when Segment 5 reaches elapsed 1.5 minutes relative to its dynamic start time (at nominal $T = 12:00$).
   - The host, having covered key talking points, indicates they are ready to wrap early. This opens a potential schedule void before the immutable $14:00:00$ closing anchor ($T_{\text{start}}(S6)$).
   - The operator must detect the impending void and cue an impromptu audience Q&A or voucher teaser to hold the airwaves until the $14:00:00$ closing anchor.

### 7.2 Scenario 2 Temporal Permutation (Anti-Anticipation Design)

To prevent participants from anticipating disturbance timestamps during their second trial, **Scenario 2 permutes disturbance placement, segment order, and injection timestamps** while maintaining identical total cognitive difficulty ($N=6$ segments, 5.0m buffer, 2 hard anchors, 5 disturbances):

| Disturbance | Scenario 1 Placement (Cosmetics) | Scenario 2 Permuted Placement (Fashion/Tech) |
|---|---|---|
| **D1: Pitch Overrun** | Segment 2 (`SKU-SERUM`), stimulated at $T=04:30$, deficit evaluated at $06:30$ | Segment 3 (`SKU-TECH2`), stimulated at $T=06:00$, deficit evaluated at $T=09:30$ (+45s deficit) |
| **D2: Hard Anchor 1** | Segment 4 (`SKU-KEMD`), locked at $T = 09:00:00$ | Segment 4 (`SKU-FASH1`), locked at $T = 10:30:00$ |
| **D3: Stockout Pivot** | Segment 4, triggered at $T_{\text{start}}(S4) + 1\text{m}15\text{s}$ | Segment 2, triggered at $T_{\text{start}}(S2) + 1\text{m}45\text{s}$ ($T = 03:15$, transition at $03:30$) |
| **D4: Console Pin Lag** | Injected upon entry into Segment 5 | Injected upon entry into Segment 4 (Anchor Flash Pin) |
| **D5: Host Under-run** | Injected at $T_{\text{start}}(S5) + 1\text{m}30\text{s}$ ($T = 12:00$) | Injected at $T_{\text{start}}(S5) + 45\text{s}$ ($T = 13:15$) |

This temporal permutation completely eliminates order carryover and memorization bias, ensuring that detection latency and recovery decisions measured in Trial 2 reflect authentic operational agility.

---

## 8. Validation Lifecycle: Phase 0 vs Phase 1

The LiveLift validation roadmap proceeds across two distinct validation gates:

```
+---------------------------------------------------------------------------------------------------+
|                                  VALIDATION LIFECYCLE ROADMAP                                     |
+---------------------------------------------------------------------------------------------------+
|  [ PHASE 0: Current Build (SHA 9a91101) ]                   [ PHASE 1: Future Target Milestone ]  |
|  - Browser localStorage (guarded) + WoZ Engine              - Durable local IndexedDB product     |
|  - Tests foundational workflow hypothesis                   - Tests single-device durability      |
|  - N = 5 to 10 participants across >=3 teams                - N = 3 to 5 recurring teams          |
|  - AUTHORIZES: Phase 1 Single-Device Engineering            - AUTHORIZES: Phase 2 Pilot Beta      |
+---------------------------------------------------------------------------------------------------+
```

### 8.1 Phase 0: Disclosed Concept Comparison (Current Protocol)
* **Objective:** Establish whether the core LiveLift mental model and workflow primitives materially outperform a competent spreadsheet baseline when downstream deficits and recovery choices are made explicit.
* **Harness:** Next.js fixture UI (`next/` with browser `localStorage` guarded persistence) paired with the Wizard-of-Oz facilitator protocol.
* **Authorization Authority:** Successfully passing Phase 0 clears the **G0 Gate**, authorizing engineering resources to build the **Phase 1 Single-Device Functional Product**. It does **not** authorize production backend development or platform API integration.

### 8.2 Phase 1: Functional Re-Test (Subsequent Milestone)
* **Objective:** Verify that the validated workflow advantages persist when executed on a real, durable, single-device local software implementation (IndexedDB transaction storage, local deterministic timing engine).
* **Harness:** Phase 1 standalone local application without facilitator WoZ intervention.
* **Authorization Authority:** Successfully passing Phase 1 clears the **G1 Gate**, authorizing development of the **Phase 2 Multi-Device Server Architecture**.

---

## 9. Ethics, Privacy & Research Governance

To protect participant commercial interests and comply with research ethics standards:

### 9.1 Informed Consent & Voluntary Participation
* All participants (operators, studio leads, hosts) must review and execute the informed consent agreement prior to testing.
* Participants retain the absolute right to pause, interrupt, or terminate the trial at any moment without penalty or loss of compensation.

### 9.2 Commercial & Financial Confidentiality
* **Zero Commercial Revenue Audits:** The study strictly evaluates *operational timing and coordination*. Observers are strictly prohibited from inspecting, recording, or transcribing merchant sales revenues, gross margins, wholesale product costs, supplier agreements, or private TikTok Shop financial analytics.
* **Mock Catalogs:** Experimental trials utilize standardized mock product packs (`Cosmetics Pack` and `Fashion/Tech Pack`) with simulated retail pricing. Merchants are never asked to expose their proprietary catalog data during testing.

### 9.3 Protection of Personal Identifiable Information (PII)
* **Anonymized Identifiers:** All collected data, screen captures, and interview transcripts are scrubbed of personal and corporate names. Records are cataloged exclusively via anonymized subject keys:
  - Operators: `P01-OP`, `P02-OP`, ..., `P10-OP`
  - Hosts: `P01-HOST`, `P02-HOST`, ..., `P10-HOST`
  - Studios/Teams: `TEAM-01`, `TEAM-02`, `TEAM-03`
* **Zero Viewer Data Capture:** No live audience comments, user handles, or customer shipping records are ingested, stored, or analyzed.
* **Secure Storage:** Video and audio recordings are stored in encrypted local storage and restricted strictly to authorized research team members.

---

## 10. End-to-End Session Runbook

Each validation trial session requires approximately **75 to 90 minutes** per operator-host pair. The master schedule is structured as follows:

| Time Elapsed | Segment | Activity & Protocol Details | Role Focus |
|:---:|---|---|:---:|
| **00:00 – 10:00** | **1. Welcome & Briefing** | • Facilitator introduces research goals (operational pacing study; no sales hype).<br>• Review and execute Informed Consent & Research NDA.<br>• Confirm participant anonymous IDs (`Pxx-OP`, `Pxx-HOST`).<br>• Disclose simulation and Wizard-of-Oz mechanics. | Operator & Host |
| **10:00 – 18:00** | **2. Baseline Familiarization** | • Review Google Sheets rundown schema, formulas, and Zalo chat syntax.<br>• Verify formula range locks and macro isolation.<br>• Conduct 3-minute dry-run: practice timestamp shortcut (`Ctrl+Shift+;`) and sample chat cue dispatch. | Operator & Host |
| **18:00 – 26:00** | **3. LiveLift Familiarization** | • Walkthrough LiveLift desk: NOW panel, NEXT panel, manual transition button, recovery drawer, note logging, and clone view.<br>• Confirm fullscreen kiosk mode (`F11`) and browser `beforeunload` lock.<br>• Conduct 3-minute dry-run: practice advancing a segment, extending duration, and holding a proposal. | Operator & Host |
| **26:00 – 41:00** | **4. Experimental Trial 1** | • Execute Trial 1 under assigned condition (Condition A or Condition B according to counterbalancing matrix).<br>• Full 15-minute live run with scripted disturbances D1 through D5.<br>• Dual observers record real-time timestamps and event logs. | Operator & Host |
| **41:00 – 45:00** | **5. Trial 1 Debrief & Workload** | • Administer NASA-TLX workload survey for Trial 1 away from the main console.<br>• Complete 3-minute operational fact reconstruction quiz. | Operator |
| **45:00 – 58:00** | **6. Washout & Cognitive Distractor** | • **Mandatory 10–15 minute cognitive washout interval** to prevent carryover bias.<br>• Participant steps away from the broadcast screens.<br>• Facilitator administers 5-minute active cognitive distractor task (unrelated catalog formatting check / SKU proofreading puzzle) to purge short-term timing memory.<br>• Facilitator resets simulator engine and loads permuted Scenario 2 catalog. | Operator & Host |
| **58:00 – 73:00** | **7. Experimental Trial 2** | • Execute Trial 2 under alternate condition (Condition B or Condition A).<br>• Full 15-minute live run with permuted disturbance placements and timings.<br>• Dual observers record real-time timestamps and event logs. | Operator & Host |
| **73:00 – 77:00** | **8. Trial 2 Debrief & Workload** | • Administer NASA-TLX workload survey for Trial 2 away from console.<br>• Complete 3-minute operational fact reconstruction quiz. | Operator |
| **77:00 – 90:00** | **9. Semi-Structured Interview** | • Conduct semi-structured debrief interview.<br>• Forced-choice commercial preference probe: *"Which tool would you voluntarily choose for tomorrow's live show, and why?"*<br>• Review Keep/Change/Remove feedback.<br>• Provide 1.5M VNĐ honorarium and conclude session. | Operator & Host |

---

## 11. Governance Sign-Off

This protocol document is preregistered and locked prior to participant testing. Any mid-trial amendments to metric definitions, scenario durations, or pass/fail thresholds must be documented in a dated version addendum with explicit rationale.

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 1 | Validation Research Lead | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
