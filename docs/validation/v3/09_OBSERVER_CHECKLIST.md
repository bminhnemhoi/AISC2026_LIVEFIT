# LiveLift V3 Dual-Rater Real-Time Observer Checklist & Event Logging Protocol

**Document ID:** `VAL-V3-OBS-09`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 3 (Execution Runbooks & Checklists)  
**Classification:** Research Protocol & Observer Data Capture Instrument  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §3, §5, §7, §10; `docs/validation/v3/04_TEST_SCENARIO.md`; `docs/validation/v3/07_DISTURBANCE_TIMELINE.md`

---

## 1. Executive Summary & Dual-Rater Governance

This document establishes the official **Dual-Rater Real-Time Observation Protocol** and second-by-second event logging instrument for the LiveLift V3 Product Validation Program.

### 1.1 The Dual-Rater Principle
Live e-commerce broadcast operations involve simultaneous cognitive, motor, verbal, and interface events occurring across fractions of a second. Relying on a single human observer introduces severe observational blind spots and perceptual bias. 

To achieve scientific rigor, forensic auditability, and statistical defensibility:
1. **Independent Dual Observation:** Every trial is simultaneously evaluated by two dedicated research observers working in physical and perceptual independence.
2. **Specialized Division of Observational Labor:**
   - **Observer 1 (Rater 1 — Technical & Timing Lead):** Focuses strictly on interface state transitions, digital clocks, button clicks, cell updates, Seller Center product pinning, and millisecond timestamp capture.
   - **Observer 2 (Rater 2 — Human Factors & Communication Lead):** Focuses strictly on human coordination, verbal cues, gaze shifts, pupil/facial tension, host speech stumbles, dead air pauses, and cognitive friction indicators.
3. **Statistical Inter-Rater Reliability (IRR):** All recorded data must satisfy preregistered agreement standards ($\text{ICC}(2,1) \ge 0.90$ for continuous latencies; Cohen's $\kappa \ge 0.85$ for categorical classifications) prior to inclusion in the validation ledger.

```
+----------------------------------------------------------------------------------------------------+
|                                  DUAL-RATER OBSERVATIONAL ARCHITECTURE                             |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|                     [ EXPERIMENTAL TRIAL: OPERATOR + HOST LIVE RUN ]                               |
|                                            │                                                       |
|                     ┌──────────────────────┴──────────────────────┐                                |
|                     ▼                                             ▼                                |
|       [ OBSERVER 1: TECHNICAL & TIMING ]            [ OBSERVER 2: HUMAN FACTORS & COGNITIVE ]      |
|       - Digital Stopwatch & Master Clock Sync       - Host/Operator Verbal Audio Feed              |
|       - Operator Desk Screen Mirror (1080p)         - Dual High-FPS Facial & Gaze Cameras          |
|       - Seller Center Pin/Unpin Logging             - Speech Stumble & Delivery Degradation Log    |
|       - System State Transition Timestamps          - Behavioral Stress & Panic Indicators         |
|       - Button Clicks / Formula Cell Edits          - Cue Wording, Glance Budget, Comprehension    |
|                     │                                             │                                |
|                     └──────────────────────┬──────────────────────┘                                |
|                                            ▼                                                       |
|                        [ POST-SESSION DUAL-RATER RECONCILIATION ]                                  |
|                        - Compare Timestamps (Threshold: Delta <= 2.0s)                             |
|                        - Inter-Rater Reliability Audit (ICC >= 0.90, Kappa >= 0.85)                |
|                        - Video Arbitration via Synchronized OBS Multi-Track Master                 |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Observer Roles, Instrumentation & Data Capture Hardware

### 2.1 Observer 1: Timing, Technical Actions & State Transitions
- **Primary Mission:** Record authoritative ground-truth timestamps for every system state change, operator input, platform manipulation, and disturbance injection.
- **Dedicated Hardware & Displays:**
  * **Screen 1:** Synchronized 60fps mirror of the operator's primary workstation.
  * **Screen 2:** Live mirror of the TikTok Shop Seller Center showcase console.
  * **Digital Time Standard:** Master NTP-synchronized millisecond digital timecode display (`HH:MM:SS.mmm`) embedded into the multi-view monitor.
  * **Input Device:** Dedicated hardware timestamp capture deck or synchronized digital logging spreadsheet.

### 2.2 Observer 2: Host/Operator Communication, Cognitive Load & Human Factors
- **Primary Mission:** Record verbal, non-verbal, and behavioral coordination signals between operator and host, tracking gaze shifts, speech disruptions, cognitive overload indicators, and cue comprehension latencies.
- **Dedicated Hardware & Displays:**
  * **Screen 1:** Direct high-resolution studio camera feed focused on on-camera host ($1080\text{p60}$).
  * **Screen 2:** Wide-angle studio camera capturing operator posture, hand gestures, and head orientation.
  * **Audio Monitor:** Studio broadcast mix + operator desk ambient microphone feeding professional closed-back headphones.
  * **Host Tablet Mirror:** Real-time screen capture of the host's cue display (LiveLift host view tablet or Zalo chat feed).

---

## 3. Authoritative Timestamp Definitions & Mathematical Derivations

All timing measurements must conform to strict mathematical definitions:

```
+----------------------------------------------------------------------------------------------------+
|                                     TIMESTAMP CAPTURE SEQUENCE                                     |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    T_stimulus                T_detect              T_decision             T_action                 |
|        │                         │                      │                    │                     |
|        ▼                         ▼                      ▼                    ▼                     |
|   [ PROCTOR ] -------------> [ OPERATOR ] --------> [ OPERATOR ] -------> [ OPERATOR ]             |
|   Injects disturbance       First perceptual       Selects recovery      Executes click /          |
|   stimulus (chat/alert)     reaction / gaze shift  strategy / formula    dispatches cue msg        |
|                                                                              │                     |
|                                                                              ▼                     |
|                                                                     T_host_comprehend              |
|                                                                              │                     |
|                                                                              ▼                     |
|                                                                         [ HOST ]                   |
|                                                                         Absorbs cue & pivots       |
|                                                                         on-camera delivery         |
|                                                                                                    |
|   <--- Latency T_detect ---> <------- Decision Latency T_decision -------> <--- Cue Transit --->   |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 3.1 Primary Timestamp Keys

1. **$T_{\text{stimulus}}$ (Injection Moment):**
   - The exact millisecond when the proctor injects an environmental disturbance:
     * *D1:* Chat comment appears on host monitor.
     * *D2:* Clock strikes 09:00:00 (Scenario 1) or 10:30:00 (Scenario 2).
     * *D3:* Mock console displays `Tồn kho = 0`.
     * *D4:* Network spinner appears upon product pin attempt.
     * *D5:* Host begins unscripted under-run statement.
2. **$T_{\text{detect}}$ (Perceptual Detection Instant):**
   - The exact millisecond when the operator first perceives and attends to the stimulus:
     * *Behavioral Marker:* Gaze fixes on the alert banner or Red cell; hand twitches toward mouse; verbal gasp or sigh (*"Ủa"*, *"Hết hàng rồi"*).
3. **$T_{\text{decision}}$ (Strategy Selection Instant):**
   - The moment the operator commits to a specific recovery path:
     * *Behavioral Marker:* In LiveLift: Click on recovery option or opening override modal; in Baseline: Cursor moves to compressible row or beginning to type chat message.
4. **$T_{\text{action}}$ (Execution Dispatch Instant):**
   - The moment the operational action is executed:
     * *Behavioral Marker:* In LiveLift: Clicking `advance-btn`, `apply-[kind]`, or `extend-plus-one-btn`; in Baseline: Pressing Enter on Zalo message or logging `Ctrl+Shift+;` in Sheets.
5. **$T_{\text{host\_comprehend}}$ (Host Acknowledgment & On-Camera Pivot):**
   - The moment the on-camera talent absorbs the instruction:
     * *Behavioral Marker:* Physical nod toward operator/tablet; verbal bridge on stream (*"Dạ em xin phép qua mã tiếp theo..."*); gaze returns to camera lens.

### 3.2 Derived Operational Metrics
- **Detection Latency:** $T_{\text{detect\_lat}} = T_{\text{detect}} - T_{\text{stimulus}}$ (Target: $\le 10.0$ seconds).
- **Decision / Recovery Latency:** $T_{\text{decision\_lat}} = T_{\text{action}} - T_{\text{detect}}$ (Target: $\le 15.0\text{s}$ condition-blind).
- **Hard Anchor Variance:** $V_{\text{anchor}} = |T_{\text{action}}(S_{\text{anchor}}) - T_{\text{anchor\_scheduled}}|$ (Target: $\le 15.0$ seconds; critical miss: $> 30.0\text{s}$).
- **Host Comprehension Latency:** $T_{\text{comp\_lat}} = T_{\text{host\_comprehend}} - T_{\text{action}}$ (Target: $\le 5.0$ seconds).

---

## 4. Behavioral Indicators & Cognitive Load Coding Dictionary

Observer 2 evaluates real-time cognitive workload and friction using standardized behavioral coding:

```
+----------------------------------------------------------------------------------------------------+
|                               BEHAVIORAL FRICTION CODING DICTIONARY                                 |
+------+--------------------------+------------------------------------------------------------------+
| Code | Behavioral Category      | Observable Physical Manifestations                               |
+------+--------------------------+------------------------------------------------------------------+
| B-01 | Verbal Sigh / Gasp       | Audible exhalations, sharp inhalations, muttered frustration     |
|      |                          | ("Trời ơi", "Chết rồi", "Kịp không ta", "Ủa sao kỳ vậy").        |
| B-02 | Gaze Switching Flutter   | Rapid alternating head/eye movements between monitors (>3 shifts|
|      |                          | in 10s without mouse movement; indicates cognitive disorientation|
| B-03 | Mouse Cursor Jitter      | Rapid circular mouse scrubbing, aimless cursor hovering, or      |
|      |                          | repeatedly selecting and deselecting random UI elements.         |
| B-04 | Panic Typing / Backspace | Rapid burst typing followed by continuous backspacing (>5 strokes|
|      |                          | in Zalo or notes; indicates cognitive indecision or confusion).  |
| B-05 | Postural Collapse        | Leaning forward with face inches from monitor, holding forehead, |
|      |                          | or resting chin in hands (indicates extreme focal strain).       |
| B-06 | Host Teleprompter Glaze  | Host's eyes locked onto cue tablet for >4 continuous seconds     |
|      |                          | during a pitch, resulting in flat, robotic vocal delivery.       |
| B-07 | Host Speech Stumble      | Audible stutter, repeated syllable, mid-sentence stall (>2s), or |
|      |                          | accidental verbal repetition of operator instructions on air.    |
| B-08 | Unscripted Dead Air      | Total silence on broadcast stream exceeding 5.0 continuous       |
|      |                          | seconds (Critical operational failure if >15.0 seconds).         |
+------+--------------------------+------------------------------------------------------------------+
```

---

## 5. Scenario 1 Second-by-Second Event Log & Observation Protocol

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

### 5.1 Scenario 1 Real-Time Observation Master Table

| Clock (mm:ss) | Event ID | State Anchor & Segment | Stimulus / Trigger Details | Observer 1: Technical & Timing Capture | Observer 2: Human Factors & Communication | Primary Timestamp Key | Objective Pass/Fail Rubric |
|:---:|---|---|---|---|---|:---:|---|
| **00:00** | `EVT-S1-01` | $T_{\text{start}}(S1)$ — Intro | Proctor signals stream start (*"Bắt đầu phiên live!"*). | Log desk init / Sheet `Actual_Start` (Col M). Check OBS video feed & audio meters. | Observe operator posture. Confirm host welcome energy & posture. | $T_{\text{action}}(S1)$ | Setup verified within $\pm 5.0\text{s}$. |
| **01:45** | `EVT-S1-02` | Pre-Cue S2 | 15s before S1 scheduled completion. | Check NEXT panel acceptance or Zalo pre-cue staging. | Log host eye contact with cue tablet. Record glance duration (s). | $T_{\text{action\_precue}}$ | Timely pre-cue dispatched $\ge 10\text{s}$ before transition. |
| **02:00** | `EVT-S1-03` | $T_{\text{start}}(S2)$ — Serum | Transition to S2 (`SKU-SERUM`). Planned: 4.0m. | Log `Start segment` click or Col M `Ctrl+Shift+;`. Log Seller Center pin timestamp. | Host begins Hero Serum demonstration. Check verbal smoothness (no stumbles). | $T_{\text{action}}(S2)$ | Transition within $\le 5.0\text{s}$ of 02:00. Product pinned $\le 10.0\text{s}$. |
| **04:30** | `EVT-S1-04` | Chat Comment Prompt | Proctor triggers mock chat comment on treatment skin. | Log exact millisecond comment enters chat monitor. | Host glances at chat, reads aloud, applies serum to hand. Verify engagement. | $T_{\text{chat\_prompt}}$ | Comment delivered within $\pm 2.0\text{s}$ of 04:30. |
| **06:00** | `EVT-S1-05` | S2 Scheduled Deadline | S2 target duration elapsed (4m). Host continues pitching; extend +1m. | Note LiveLift NOW timer reaches 04:00 or Sheet Col P turns positive. Check clicks. | Log operator body language: leaning forward, gaze shift to clock, sigh (B-01). | $T_{\text{pacing\_slip}}$ | Operator demonstrates schedule awareness. |
| **06:30** | `EVT-S1-06` | **D1 Stimulus & Deficit Evaluation** | **Deficit reaches +90s vs Anchor 1 (09:00:00)**.<br>Active 4m30s + 1m remaining + 3m Toner = 10:30 (+90s deficit).<br>LiveLift: Alert card flashes.<br>Baseline: Col R turns Dark Red. | **Log $T_{\text{stimulus}}(D1) = 06:30.000$**.<br>**Log $T_{\text{detect}}$:** Correct identification of threatened anchor.<br>**Log $T_{\text{decision}}$:** Strategy selected.<br>**Log $T_{\text{action}}$:** Button click or Zalo send. | Log verbal exclamation (B-01), mouse jitter (B-03), panic typing (B-04). Record host delivery: any speech stumble? | **$T_{\text{stimulus}}(D1)$**<br>**$T_{\text{detect}}$**<br>**$T_{\text{decision}}$**<br>**$T_{\text{action}}$** | **$T_{\text{detect}} \le 10.0\text{s}$**.<br>**$T_{\text{decision}} \le 15.0\text{s}$** (Condition-blind objective rubric).<br>Preserves 1.0m floor. |
| **07:30** | `EVT-S1-07` | S2 End / S3 Start | Host concludes Serum (Actual: 5.5m). Transition to S3 (`SKU-TONER`). | Log `Start segment` click or Col M/N updates. Log Seller Center unpin/pin sequence. | Host pivots: *"Qua mã toner cân bằng ngay đây ạ"*. Gaze returns to camera lens. | $T_{\text{action}}(S3)$ | Transition completed. Target S3 compressed to 1.5m. |
| **08:30** | `EVT-S1-08` | Pre-Anchor Sync | 30s before hard Flash Sale anchor (09:00:00). | Log pre-cue dispatch. Check Seller Center Flash Deal pre-staging. | Host delivers verbal countdown alert to audience. Check vocal cadence. | $T_{\text{precue}}(D2)$ | Pre-cue sent $\ge 20.0\text{s}$ before 09:00:00. |
| **09:00** | `EVT-S1-09` | **D2 Anchor 1 Execution** | **Seller Center Flash Deal unlocks at exactly 09:00:00**. | **Log exact millisecond of transition to S4 (`SKU-KEMD`)**.<br>Log Seller Center pin click. | Host counts down on air: *"5-4-3-2-1 mở deal!"* Record crowd excitement energy. | **$T_{\text{action}}(S4)$** | **$V_{\text{anchor}} = \|t - 09:00:00\| \le 15.0\text{s}$**.<br>Zero critical anchor miss. |
| **10:15** | `EVT-S1-10` | **D3 Abrupt Stockout** | **Proctor triggers stockout in mock console (Stock = 0)**. | **Log $T_{\text{stimulus}}$:** Console flashes red.<br>**Log $T_{\text{detect}}$:** Operator notices alert.<br>**Log $T_{\text{action}}$:** Unpin SKU / pull S5. | Log operator panic indicators. Record cue to host: `[STOP/HẾT HÀNG]`. Host halts pitch within $\le 15$s. | **$T_{\text{stimulus}}(D3)$**<br>**$T_{\text{detect}}$**<br>**$T_{\text{action}}$** | **$T_{\text{detect}} \le 10.0\text{s}$**.<br>Host stops pitching sold-out SKU $\le 15.0\text{s}$ post-alert. |
| **10:30** | `EVT-S1-11` | **D4 Platform Tech Lag** | **Dynamic transition to S5 (`SKU-NANG`). 40s pin spinner triggered**. | **Log $T_{\text{stimulus}}$:** Spinner initiates.<br>Log holding cue dispatch or note capture. | **Log dead air duration (s)**. Record whether holding cue sent: `[HOLD: Minigame/Tương tác]`. Host filler deployed? | **$T_{\text{stimulus}}(D4)$**<br>$T_{\text{action\_hold}}$ | **Zero dead air ($> 5.0\text{s}$)**.<br>Hold cue sent $\le 10.0\text{s}$. Host avoids stutter. |
| **11:10** | `EVT-S1-12` | D4 Cleared | Network spinner resolves. Product pin succeeds. | Log product pin confirmation timestamp in Seller Center & LiveLift. | Host resumes product storytelling. Note transition smoothness. | $T_{\text{resolved}}(D4)$ | Pin verified on stream $\le 5.0\text{s}$ post-release. |
| **12:00** | `EVT-S1-13` | **D5 Host Under-run** | **Host finishes points early; signals wrap (elapsed 1.5m in S5 / at T=12:00)**. | **Log $T_{\text{stimulus}}$:** Host statement.<br>**Log $T_{\text{detect}}$:** Operator reaction.<br>Verify operator does **NOT** start S6 early. | Record host verbal prompt: *"Em chia sẻ xong rồi ạ..."* Observe operator restraint: holding closing anchor? | **$T_{\text{stimulus}}(D5)$**<br>$T_{\text{action\_filler}}$ | **Anchor 2 held at 14:00:00**.<br>Filler cue deployed. Zero premature cutoff. |

| **13:30** | `EVT-S1-14` | Pre-Close Sync | 30s before immutable closing anchor (14:00:00). | Log closing pre-cue dispatch. Check Seller Center end-of-show status. | Host reminds audience: *"Còn 30s đóng giỏ hàng"*. Check closing flow. | $T_{\text{precue\_close}}$ | Timely closing cue dispatched. |
| **14:00** | `EVT-S1-15` | **Closing Anchor Execution** | **Final broadcast cutoff instant (14:00:00)**. | **Log transition to S6 (`SYS-CLOSE`)**. Verify actual timecode. | Host begins official sign-off, reviews return policy, teases tomorrow 20:00 live. | **$T_{\text{action}}(S6)$** | **$V_{\text{close}} = \|t - 14:00:00\| \le 15.0\text{s}$**. |
| **15:00** | `EVT-S1-16` | Broadcast Wrap | 15:00:00 master cutoff. Proctor calls: *"Stream wrap!"*. | Log session end click (`End LIVE` / Col N). Verify total session elapsed. | Host concludes stream on air. Microphones muted. Post-test debrief begins. | $T_{\text{end\_session}}$ | Total duration: $15\text{m}00\text{s} \pm 15.0\text{s}$. |

---

## 6. Scenario 2 Second-by-Second Event Log & Observation Protocol

**Catalog:** `CAT-TECHFASH-02` (UrbanPulse Studio)  
**Nominal Run:** $T = 00:00:00$ to $15:00:00$ (900 seconds)  
**Hard Promotion Anchors:** Anchor 1 at $10:30:00$ (`SKU-FASH1`), Anchor 2 at $14:00:00$ (`SYS-CLOSE2`).

```
00:00    01:30        03:30                                           10:30             12:30        14:00   15:00
  |--------|------------|-----------------------------------------------|-----------------|------------|-------|
  [ INTRO ][ 2. MAGSAFE][ 3. TAI NGHE ANC PRO ]                         [ 4. FLASH TEE ]  [ 5. CARGO ] [ CLOSE ]
           ^            ^                               ^               ^                 ^            ^
        03:15:       03:30:                          06:00 / 09:30:  10:30:00:         13:15:       14:00:00:
        [INJECT D3]  Early pivot                     [D1 STIM & EVAL] [EVAL D2 & D4]    [INJECT D5]  [EVAL CLOSE]
        Stockout!    to S3 Earbuds                   Deficit +45s    Flash Sale Anchor Under-run!   End adherence
        Cut S2       (Actual 2.0m)                   vs Anchor 1     Verbal count/lag  Fill to 14m? at 14:00:00
```

### 6.1 Scenario 2 Real-Time Observation Master Table

| Clock (mm:ss) | Event ID | State Anchor & Segment | Stimulus / Trigger Details | Observer 1: Technical & Timing Capture | Observer 2: Human Factors & Communication | Primary Timestamp Key | Objective Pass/Fail Rubric |
|:---:|---|---|---|---|---|:---:|---|
| **00:00** | `EVT-S2-01` | $T_{\text{start}}(S1)$ — Intro | Proctor signals start (*"Bắt đầu phiên UrbanPulse!"*). | Log desk init / Col M start time. Confirm stream feed & audio meters. | Observe host energy and delivery pace. Confirm camera focus. | $T_{\text{action}}(S1)$ | Setup verified $\pm 5.0\text{s}$. |
| **01:30** | `EVT-S2-02` | $T_{\text{start}}(S2)$ — MagSafe | Transition to S2 (`SKU-TECH1`). Planned: 3.5m. | Log transition timestamp. Log Seller Center pin timestamp. | Host begins MagSafe wireless charger demonstration. | $T_{\text{action}}(S2)$ | Transition within $\le 5.0\text{s}$ of 01:30. |
| **03:15** | `EVT-S2-03` | **D3 Early Stockout Injection** | **Proctor triggers stockout in mock console (Stock = 0)**. | **Log $T_{\text{stimulus}}$:** Mock alert fires.<br>**Log $T_{\text{detect}}$:** Operator spots stockout.<br>**Log $T_{\text{action}}$:** Unpin SKU-TECH1; advance to S3. | Record operator alert cue: `[STOP/HẾT HÀNG: Cắt Sạc MagSafe]`. Host halts pitch within $\le 15$s. | **$T_{\text{stimulus}}(D3)$**<br>**$T_{\text{detect}}$**<br>**$T_{\text{action}}$** | **$T_{\text{detect}} \le 10.0\text{s}$**.<br>Host stops pitching sold-out item $\le 15.0\text{s}$. |
| **03:30** | `EVT-S2-04` | Early S3 Transition | Dynamic early start of S3 (`SKU-TECH2` ANC Earbuds). | Log transition to S3. Log Seller Center pin for `SKU-TECH2`. Actual MagSafe: 2.0m ($\ge 2.0\text{m}$ floor). | Host executes early pivot: *"Em qua ngay tai nghe chống ồn đỉnh cao"*. Zero dead air. | $T_{\text{action}}(S3)$ | Clean early transition without dead air ($> 5.0\text{s}$). |
| **06:00** | `EVT-S2-05` | Technical Chat Prompt | Proctor triggers mock technical chat question on mic clarity at 06:00 ($03:30 + 2\text{m}30\text{s}$). | Log millisecond question enters chat monitor. | Host engages in live microphone audio test. Check pitch expansion. | $T_{\text{chat\_prompt}}$ | Prompt delivered within $\pm 2.0\text{s}$ of 06:00. |
| **09:00** | `EVT-S2-05b`| S3 Scheduled Deadline | S3 target duration elapsed (5.5m). Host continues pitching; extend +1m. | Note LiveLift NOW timer reaches 05:30. Check operator extension command. | Host deep into audio feature demonstration. | $T_{\text{pacing\_slip}}$ | Operator demonstrates schedule awareness. |
| **09:30** | `EVT-S2-06` | **D1 Stimulus & Deficit Evaluation** | **Deficit reaches +45s vs Anchor 1 (10:30:00)**.<br>Active 6m00s + 1m45s remaining on Earbuds = 11:15 (+45s deficit vs 10:30:00).<br>LiveLift: Alert flashes.<br>Baseline: Col R turns Dark Red. | **Log $T_{\text{stimulus}}(D1) = 09:30.000$**.<br>**Log $T_{\text{detect}}$:** Correct identification of threatened anchor.<br>**Log $T_{\text{decision}}$:** Strategy selected.<br>**Log $T_{\text{action}}$:** Cue dispatched. | Log operator stress markers (sigh, posture shift). Record cue wording to host: `[RECOVER: Chốt Tai Nghe trước 10:30]`. | **$T_{\text{stimulus}}(D1)$**<br>**$T_{\text{detect}}$**<br>**$T_{\text{decision}}$**<br>**$T_{\text{action}}$** | **$T_{\text{detect}} \le 10.0\text{s}$**.<br>**$T_{\text{decision}} \le 15.0\text{s}$** (Condition-blind objective rubric).<br>Target S3 concludes at 10:30 (actual 7.0m $\ge 3.0\text{m}$ floor). |
| **10:00** | `EVT-S2-08` | Pre-Anchor Sync | 30s before Flash Sale Anchor 1 (10:30:00). | Log pre-cue dispatch. Check Flash Deal pre-staging in Seller Center. | Host counts down to flash deal unlock: *"30s nữa mở deal Áo Thun!"*. | $T_{\text{precue}}(D2)$ | Pre-cue sent $\ge 20.0\text{s}$ before 10:30:00. |
| **10:30** | `EVT-S2-09` | **D2 Anchor 1 & D4 Console Lag** | **Flash Deal unlocks at 10:30:00**.<br>**D4 Injected: 40s pin spinner locks Seller Center console**. | **Log verbal transition to S4 (`SKU-FASH1`)**.<br>**Log $T_{\text{stimulus}}(D4)$:** Pin spinner starts.<br>Log operator hold cue dispatch. | Host counts down at 10:30:00: *"Mở deal!"*<br>Operator dispatches holding cue: `[HOLD: Minigame size]`. **Log dead air (s)**. | **$T_{\text{action\_verbal}}(S4)$**<br>**$T_{\text{stimulus}}(D4)$**<br>$T_{\text{action\_hold}}$ | **$V_{\text{anchor, verbal}} \le 15.0\text{s}$**.<br>**Zero dead air ($> 5.0\text{s}$)**.<br>Console lag recorded separately as native external delay. |
| **11:10** | `EVT-S2-10` | D4 Cleared | Network spinner resolves (40s). Product pins. | Log pin confirmation timestamp in Seller Center & LiveLift. | Host announces pin confirmed; begins full styling pitch. | $T_{\text{resolved}}(D4)$ | Pin verified $\le 5.0\text{s}$ post-release. |
| **12:30** | `EVT-S2-11` | S4 End / S5 Start | S4 concludes. Transition to S5 (`SKU-FASH2` Cargo Pants). | Log transition to S5. Log Seller Center pin for `SKU-FASH2`. | Host begins streetwear cargo pants presentation. | $T_{\text{action}}(S5)$ | Transition within $\le 5.0\text{s}$ of 12:30. |
| **13:15** | `EVT-S2-12` | **D5 Host Under-run** | **Host finishes points early; signals wrap (45s into S5)**. | **Log $T_{\text{stimulus}}$:** Host statement.<br>**Log $T_{\text{detect}}$:** Operator reaction.<br>Verify operator does **NOT** start S6 early. | Record host statement: *"Em giới thiệu xong rồi ạ..."* Observe operator restraint: holding closing anchor to 14:00. | **$T_{\text{stimulus}}(D5)$**<br>$T_{\text{action\_filler}}$ | **Anchor 2 held at 14:00:00**.<br>Filler cue deployed. Zero premature cutoff. |
| **14:00** | `EVT-S2-13` | **Closing Anchor Execution** | **Final broadcast cutoff instant (14:00:00)**. | **Log transition to S6 (`SYS-CLOSE2`)**. Verify actual timecode. | Host begins official sign-off, reviews orders, teases next live session. | **$T_{\text{action}}(S6)$** | **$V_{\text{close}} \le 15.0\text{s}$**. |
| **15:00** | `EVT-S2-14` | Broadcast Wrap | 15:00:00 master cutoff. Proctor calls: *"Stream wrap!"*. | Log session end click (`End LIVE` / Col N). Verify total session elapsed. | Host concludes stream on air. Studio wrap. | $T_{\text{end\_session}}$ | Total duration: $15\text{m}00\text{s} \pm 15.0\text{s}$. |

---

## 7. Operational Error Classification & Severity Taxonomy

Observers classify every observed error into one of five standardized severity tiers:

```
+----------------------------------------------------------------------------------------------------+
|                                OPERATIONAL ERROR CLASSIFICATION                                    |
+------+--------------------------+----------+-------------------------------------------------------+
| Code | Error Category           | Severity | Operational Definition & Invalidation Criterion       |
+------+--------------------------+----------+-------------------------------------------------------+
| E-01 | Critical Anchor Miss     | FATAL    | Host transitions to hard anchor item >30.0s after the |
|      |                          |          | scheduled second, or anchor is skipped entirely.      |
| E-02 | Silent Anchor Shift      | FATAL    | Operator changes the scheduled anchor time in the     |
|      |                          |          | spreadsheet or UI without explicit proctor permission.|
| E-03 | Contractual Floor Breach | FATAL    | Operator compresses a segment below its non-negotiable|
|      |                          |          | contractual floor duration (Floor_Min).               |
| E-04 | Critical Dead Air        | FATAL    | Broadcast experiences unaddressed silence on camera   |
|      |                          |          | exceeding 15.0 continuous seconds.                    |
| E-05 | Ghost Selling            | FATAL    | Host continues pitching a confirmed out-of-stock SKU  |
|      |                          |          | for >30.0s after the console alert was triggered.     |
| E-06 | Moderate Anchor Variance | MAJOR    | Anchor transition occurs 15.1s to 30.0s off-schedule. |
| E-07 | Delayed Deficit Detect   | MAJOR    | Operator fails to recognize schedule deficit for      |
|      |                          |          | >10.0s after stimulus injection.                      |
| E-08 | Extended Speech Stumble  | MINOR    | Host stumbles on air (>2.0s pause) following complex  |
|      |                          |          | or distracting operator cue.                          |
| E-09 | Pin Latency Lag          | MINOR    | Operator takes >15.0s to pin product in Seller Center |
|      |                          |          | after host starts presentation.                       |
+------+--------------------------+----------+-------------------------------------------------------+
```

---

## 8. Inter-Rater Reliability (IRR) & Post-Session Reconciliation Protocol

To guarantee that validation findings are audit-proof and free of researcher variance:

### 8.1 Statistical Reliability Thresholds
1. **Continuous Latencies ($T_{\text{detect}}$, $T_{\text{decision}}$, $V_{\text{anchor}}$):**
   - Evaluated via two-way random-effects Intraclass Correlation Coefficient:
     $$\text{ICC}(2,1) \ge 0.90$$
   - Any pair of observer logs yielding $\text{ICC}(2,1) < 0.90$ triggers mandatory video audit.
2. **Categorical Event Scoring (Pass / Marginal / Fail):**
   - Evaluated via Cohen's Kappa:
     $$\kappa \ge 0.85$$

### 8.2 The 30-Minute Reconciliation Workflow
Within 30 minutes of session conclusion, Observer 1 and Observer 2 conduct the formal reconciliation meeting:

```
[ ] STEP 1: INDEPENDENT LOG LOCK
    - Both observers export their raw observation files:
      * Observer 1: 'OBS1_[TrialID]_[SubjectID].csv'
      * Observer 2: 'OBS2_[TrialID]_[SubjectID].csv'
    - File hashes (SHA-256) are generated to prevent post-hoc alteration.

[ ] STEP 2: AUTOMATED DISCREPANCY SCAN
    - Run statistical reconciliation script:
      * Flag any timestamp pair where |T_obs1 - T_obs2| > 2.0 seconds.
      * Flag any categorical score mismatch (e.g. Pass vs Marginal).

[ ] STEP 3: VIDEO ARBITRATION VIA OBS MASTER MULTI-TRACK
    - For all flagged discrepancies:
      * Open synchronized 1080p60 OBS master recording.
      * Scrub to exact millisecond timecode on Track 3 (Master NTP overlay).
      * Inspect Track 1 (Operator screen) and Track 2 (Host video) at frame accuracy (16.6ms/frame).
      * Establish ground-truth instant and record in 'RECONCILED_[TrialID]_[SubjectID].csv'.

[ ] STEP 4: GOVERNANCE CERTIFICATION
    - Both observers and Lead Proctor execute the sign-off block below.
```

---

## 9. Governance Sign-Off

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Observer 1 (Technical & Timing)** | Lead Proctor 1 | Technical Evaluation Lead | 2026-10-05 | *[Signed]* |
| **Observer 2 (Human Factors)** | Lead Proctor 2 | Cognitive & Human Factors Lead | 2026-10-05 | *[Signed]* |
| **Lead Technical Author** | Worker 3 | Lead Technical Author (M3) | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
