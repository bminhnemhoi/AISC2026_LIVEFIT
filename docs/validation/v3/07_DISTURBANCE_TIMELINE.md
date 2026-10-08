# LiveLift V3 Disturbance Timeline, State-Relative Injection & Recovery Protocol

**Document ID:** `VAL-V3-DIST-07`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 2 (Baseline Specs & Test Scenario)  
**Classification:** Operational Disturbance Protocol & Experimental Choreography  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §5, §7; `docs/validation/v3/04_TEST_SCENARIO.md`

---

## 1. Executive Summary & Philosophy of State-Relative Injection

This specification defines the experimental disturbance injection mechanics, second-by-second choreography, proctor verbal scripts, operator response expectations, and recovery grading criteria for the LiveLift V3 Product Validation Program.

### 1.1 The State-Relative Architectural Breakthrough
In previous naive testing frameworks, operational disruptions were injected at fixed wall-clock marks (e.g., *"Inject stockout at exactly 10:15:00"*). In authentic live commerce broadcasts, this rigid approach produces catastrophic experimental artifacts:
1. **The Ghost Pin Anomaly:** If an operator dynamically pulls forward a product 90 seconds early to recover time, a fixed wall-clock lag injection at 11:00:00 would hit a product that was already pinned, creating an artificial condition.
2. **The Unscripted Dead Air Trap:** If a stockout is triggered at an arbitrary clock second rather than mid-pitch, the operator may be between segments, invalidating the cognitive stress measurement.

To eliminate these experimental flaws, **LiveLift V3 binds disturbances to Segment Lifecycle State Transitions**:
$$\text{Trigger Timestamp} = T_{\text{start}}(S_i) + \Delta t_{\text{state}}$$
This guarantees that:
- Overruns hit during active product demonstrations.
- Stockouts hit during active sales conversion.
- Console pinning lag hits at the exact instant the operator initiates a product transition.
- Under-runs hit when the host approaches the scheduled conclusion of a segment.

```
+-----------------------------------------------------------------------------------------------------------------------------+
|                                             DISTURBANCE TAXONOMY & STATE-RELATIVE MATRIX                                    |
+-----------------------------------+--------------------+------------------------+-------------------------------------------+
| Disturbance Archetype             | State-Relative Trigger Anchor               | Nominal Mark | Operational Vulnerability  |
+-----------------------------------+--------------------+------------------------+-------------------------------------------+
| D1: Upstream Pitch Overrun        | T_start(S2) + 4m30s (Deficit Evaluation)    | T = 06:30    | Segment Target Pacing / Slippage          |
| D2: Hard Promotion Anchor Deficit | Absolute Wall-Clock Commitment             | T = 09:00:00 | Platform Campaign Sync / Deal Start Instant|
| D3: Abrupt Mid-Pitch Stockout     | T_start(S4) + 1m15s (Flash Deal underway)  | T = 10:15    | Inventory Depletion / Emergency Pivot     |
| D4: Platform Console / Tech Lag   | Dynamic Transition into Segment 5 (S5 Entry)| T ≈ 10:30-12 | Operator Execution Gap / Console Pin Lag  |
| D5: Host Under-run / Script Stall | T_start(S5) + 1m00s (S5 remaining = 1.0m)  | T ≈ 11:30-13 | Pacing Void before Closing Anchor 2       |
+-----------------------------------+--------------------+------------------------+-------------------------------------------+
```

---

## 2. The 5 Disturbance Archetypes & Operational Vulnerabilities

### 2.1 Disturbance D1: Upstream Pitch Overrun (Schedule Slippage)
* **Root Operational Cause:** Host engages deeply with live viewer chat comments, executing detailed physical demonstrations and answering technical questions. The host ignores standard countdown cues.
* **System Threat:** As the active segment overruns its budget, the projected schedule cursor drifts forward. If remaining floating durations exceed available buffer, an upcoming hard anchor is pushed late ($T_{\text{projected}} > T_{\text{anchor}}$), creating an immediate schedule deficit.
* **Operator Challenge:** The operator must detect the emerging deficit before the hard anchor is breached, calculate available downstream buffer, evaluate compressible candidates without violating contractual floors, and dispatch an actionable recovery cue to the host.

### 2.2 Disturbance D2: Hard Promotion Anchor Synchronization
* **Root Operational Cause:** TikTok Shop Seller Center campaigns (Flash Deals, platform-subsidized vouchers) unlock at precise, immutable wall-clock seconds.
* **System Threat:** If the broadcast cursor is misaligned by even 15–30 seconds, viewers arrive at an unpinned product or normal retail pricing, causing massive audience drop-off and lost conversion.
* **Operator Challenge:** Reconcile schedule pace $\ge 30$ seconds before the anchor, pre-stage the Seller Center promotion, dispatch a synchronized countdown cue to the host, and transition exactly at the anchor second ($V_{\text{anchor}} \le 15\text{s}$).

### 2.3 Disturbance D3: Abrupt Mid-Pitch Stockout (Inventory Depletion)
* **Root Operational Cause:** High conversion velocity during a flash promotion depletes limited inventory far faster than scheduled.
* **System Threat:** The host continues pitching a sold-out item for 1.5–3 minutes. Viewers tapping the shopping cart encounter "Hết hàng", experience anger, and leave the broadcast.
* **Operator Challenge:** Detect inventory depletion within $\le 10$ seconds, immediately dispatch a `[STOP/HẾT HÀNG]` cue to the host, unpin the sold-out SKU in Seller Center, and execute an emergency recovery (pull forward the next eligible product or activate a buffer segment).

### 2.4 Disturbance D4: Platform Console / Tech Lag (Pinning Spinner)
* **Root Operational Cause:** Network jitter, browser tab freeze, or Seller Center latency during product showcase pinning.
* **System Threat:** The host is ready to present the new product, but the shopping bag pin card is missing from viewer screens. If the host presents without a pinned card, conversion drops by $>70\%$.
* **Operator Challenge:** Recognize the console freeze, immediately dispatch a `[HOLD]` interaction cue to the host ($\le 5$ words) directing an impromptu minigame or audience Q&A, resolve the technical stall, and pin the product without creating dead air.

### 2.5 Disturbance D5: Host Under-run / Script Stall (Pacing Collapse)
* **Root Operational Cause:** Host exhausts prepared talking points early due to unfamiliarity with product nuances or nervous rushing.
* **System Threat:** The segment completes 1–2 minutes ahead of schedule, opening an unplanned schedule void before an immutable closing anchor. Dead air on camera causes rapid viewer attrition.
* **Operator Challenge:** Detect the under-run risk, refrain from prematurely advancing into an immutable anchor, and cue the host to deploy prepared filler content (audience swatch polls, voucher reminders, routine FAQs) to pace accurately into the closing anchor.

---

## 3. Scenario 1 Master Disturbance Timeline (Cosmetics Catalog)

**Catalog:** `CAT-COSMETICS-01` (AuraSkin Vietnam)  
**Nominal Start:** $T = 00:00:00$ | **Nominal End:** $T = 15:00:00$  
**Hard Anchors:** Anchor 1 at $09:00:00$ (`SKU-KEMD`), Anchor 2 at $14:00:00$ (`SYS-CLOSE`).

### 3.1 Second-by-Second Operational Choreography Table

| Elapsed (mm:ss) | State Anchor | Segment Context | Facilitator Action & Stimulus Injection | Verbatim Proctor Prompt / Stimulus | Expected Operator Response | Scoring & Recovery Grading Criteria |
|:---:|---|---|---|---|---|---|
| **00:00** | $T_{\text{start}}(S1)$ | S1: Intro | Proctor signals stream start. | *"Bắt đầu phiên live!"* / *"Session start!"* | Operator logs `Actual_Start` for S1. Confirms stream health in OBS. | Setup verified within $\pm 5$s. |
| **01:45** | $T_{\text{start}}(S1) + 1\text{m}45\text{s}$ | S1: Intro | None (Pacing check). | None (Natural flow). | Operator sends pre-cue for S2 (`SKU-SERUM`). | Timely pre-cue dispatched. |
| **02:00** | $T_{\text{start}}(S2)$ | S2: Serum | S1 scheduled end. Operator transitions to S2. | None. | Operator marks S1 `DONE`, starts S2. Pins `SKU-SERUM` in Seller Center. | Transition logged within $\le 5$s of 02:00. |
| **04:30** | $T_{\text{start}}(S2) + 2\text{m}30\text{s}$ | S2: Serum | **INJECT D1 STIMULUS:** Proctor posts mock audience comment to host chat monitor. | `[CHAT BOT]: "Shop ơi da đang treatment bong tróc có xài được không, test lên da ngăm xem có vón không ạ?"` | Host reads comment aloud and begins extensive live test on hand. | Host engagement verified. Overrun initiates naturally. |
| **06:00** | $T_{\text{start}}(S2) + 4\text{m}00\text{s}$ | S2: Serum | S2 scheduled end reached. Host continues pitching deeply. | None. Host ignores normal 4m mark. | Operator observes active overrun ($+0\text{m}$ slip). Checks remaining time. | Pacing awareness logged. |
| **06:30** | **$T_{\text{start}}(S2) + 4\text{m}30\text{s}$** | S2: Serum | **EVALUATE D1 DEFICIT:** S2 elapsed = 4.5m. Host requests 1 additional minute to conclude (projected end 07:30, duration 5.5m). With S3 planned at 3.0m, projected Flash Sale is 10:30. **Anchor Deficit = +90s (1.5m).** | **LiveLift:** Deficit alert card flashes: `[Dự phóng trễ 90s so với Flash Deal 09:00:00]`.<br>**Baseline:** Cell `R5` (Flash Sale row) turns Dark Red (`1.5m`). | Operator detects deficit ($T_{\text{detect}}$). Formulates recovery: compress S3 (Toner) from 3.0m to 1.5m (respecting 1.0m floor) to protect 09:00 anchor. | **$T_{\text{detect}} \le 10\text{s}$**. Recovery choice must respect S3 contractual floor ($1.0\text{m}$). |
| **06:45** | $T_{\text{start}}(S2) + 4\text{m}45\text{s}$ | S2: Serum | Facilitator monitors operator dispatch. | None. Strictly neutral observation. | Operator transmits recovery cue to host via chat or LiveLift cue: `[RECOVER: Rút Toner còn 1.5m | Giữ Flash Deal 09:00]`. | **$T_{\text{decision}}$ scored**. Must be valid under constraints. |
| **07:30** | $T_{\text{start}}(S2) + 5\text{m}30\text{s}$ | S2: Serum | Host concludes Serum demo (Actual duration: 5.5m, Variance: $+1.5\text{m}$). | Host: *"Dạ em qua mã Toner cân bằng ngay đây ạ!"* | Operator logs S2 `DONE`, starts S3 (`SKU-TONER`). Pins Toner in Seller Center. | S2 duration = 5.5m. S3 target adjusted to 1.5m. |
| **08:30** | $T_{\text{start}}(S3) + 1\text{m}00\text{s}$ | S3: Toner | Pre-anchor synchronization window. | None. | Operator sends 30s countdown cue: `[ANCHOR: 30s đếm ngược FLASH DEAL Retinol]`. Pre-stages `SKU-KEMD`. | Pre-cue sent $\ge 20$s before 09:00:00. |
| **09:00** | **Absolute Wall-Clock** | S4: Flash Deal | **EVALUATE D2 ANCHOR 1:** Seller Center Flash Sale unlocks at exactly 09:00:00. | Proctor verifies Seller Center flash discount is live. | Host begins countdown: *"5-4-3-2-1 mở deal!"* Operator starts S4, pins `SKU-KEMD`. | **$V_{\text{anchor}} = \|t - 09:00:00\| \le 15\text{s}$**. Host verbal announcement on time. |
| **10:15** | **$T_{\text{start}}(S4) + 1\text{m}15\text{s}$** | S4: Flash Deal | **INJECT D3 STOCKOUT:** Proctor triggers inventory drop to 0 in mock console. | `[MOCK CONSOLE ALERT]: "SKU-KEMD Tồn kho: 0 (HẾT HÀNG)"` | Operator observes stockout ($T_{\text{detect}}$). Dispatches `[STOP/HẾT HÀNG: Cắt ngay Kem Dưỡng -> Chuyển Kem Nắng]`. Unpins SKU-KEMD. | **$T_{\text{detect}} \le 10\text{s}$**. Host transitions by 10:30 (actual 1.5m). **Authorized Floor Exemption applied.** |
| **10:30** | Dynamic S5 Entry | S5: Kem Nắng | Transition to S5 (`SKU-NANG`). **INJECT D4 CONSOLE LAG:** Proctor triggers 40s network spinner on pinning. | `[SYSTEM BANNER]: "Seller Center: Pinning failed. Retrying... (40s spinner)"` | Operator dispatches pin on time ($\le 5\text{s}$); recognizes pin freeze. Cues host: `[HOLD: Minigame/Tương tác 40s]`. Resolves pin once lag clears. | **Platform Lag Separation:** 40s console spinner is an unavoidable native platform delay. Graded on dispatch speed and hold communication; not penalized for platform lag. |
| **11:10** | Dynamic S5 Active | S5: Kem Nắng | Network lag clears. Product pin succeeds. | Proctor releases mock network spinner. | Operator confirms `SKU-NANG` pinned on stream. Cues host to pitch sunscreen. | Pin verified on stream. Host avoided dead air. |
| **12:00** | **$T_{\text{start}}(S5) + 1\text{m}30\text{s}$** | S5: Kem Nắng | **INJECT D5 UNDER-RUN:** Host exhausts talking points early; signals wrap-up. | Host: *"Dạ mã chống nắng em chia sẻ xong rồi ạ, giờ mình qua phần tiếp theo nha..."* | Operator detects pacing void ($T_{\text{detect}}$). Cues host to hold airwaves via Q&A/voucher recap until 14:00 closing anchor. | **Operator does NOT pull S6 early**. Anchor 2 held at 14:00:00. |
| **13:30** | Pre-Close Prep | S5: Kem Nắng | 30s before final closing anchor. | None. | Operator sends final wrap cue: `[ANCHOR: 14:00 Tổng kết đóng giỏ hàng]`. | Operator prepares outro. |
| **14:00** | **Absolute Wall-Clock** | S6: Kết Show | **EVALUATE CLOSING ANCHOR:** Final broadcast cutoff instant. | Proctor logs closing transition timestamp. | Host begins closing outro. Operator marks S5 `DONE`, starts S6. | **Variance $\le 15\text{s}$ against 14:00:00**. |
| **15:00** | Final Cutoff | S6: Kết Show | Broadcast concludes. | Proctor: *"Hết giờ phát sóng!"* / *"Stream wrap!"* | Operator ends session. Transitions to post-show review. | Total runtime = $15\text{m}00\text{s} \pm 15\text{s}$. |

---

## 4. Scenario 2 Master Disturbance Timeline (Fashion/Tech Permuted)

**Catalog:** `CAT-TECHFASH-02` (UrbanPulse Studio)  
**Nominal Start:** $T = 00:00:00$ | **Nominal End:** $T = 15:00:00$  
**Hard Anchors:** Anchor 1 at $10:30:00$ (`SKU-FASH1`), Anchor 2 at $14:00:00$ (`SYS-CLOSE2`).

### 4.1 Permuted Disturbance Mapping Architecture
To eliminate order carryover and temporal anticipation bias:
- **D3 Stockout** occurs early on **Segment 2** at $T = 03:15$ ($T_{\text{start}}(S2) + 1\text{m}45\text{s}$), with transition executing at $03:30$ ($2.0\text{m}$ actual duration, meeting floor).
- **D1 Pitch Overrun** occurs on **Segment 3** (which starts early at $03:30$). Audience question injected at $T = 06:00$ ($T_{\text{start}}(S3) + 2\text{m}30\text{s}$); at $T = 09:30$ ($T_{\text{start}}(S3) + 6\text{m}00\text{s}$), host signals $1\text{m}45\text{s}$ remaining time (projected end $11:15$). This surfaces an **anchor deficit of exactly 45 seconds** against Hard Anchor 1 (10:30:00). Operator recovers by wrapping S3 by 10:30:00 ($7.0\text{m}$ actual, $\ge 3.0\text{m}$ floor).
- **D2 Hard Anchor 1** unlocks at locked wall-clock **10:30:00** on **Segment 4** (verbal announcement and pin dispatch scheduled for 10:30:00).
- **D4 Console Lag** hits Seller Center upon **Segment 4 Entry** at $10:30:00$ (40s network spinner; operator cues size minigame; platform delay separated from operator performance).
- **D5 Host Under-run** occurs on **Segment 5** at $T_{\text{start}}(S5) + 45\text{s}$ ($T = 13:15$). Operator cues host to hold airwaves until 14:00:00 closing anchor.
- **Hard Anchor 2** unlocks at locked wall-clock **14:00:00**.

### 4.2 Second-by-Second Operational Choreography Table (Scenario 2)

| Elapsed (mm:ss) | State Anchor | Segment Context | Facilitator Action & Stimulus Injection | Verbatim Proctor Prompt / Stimulus | Expected Operator Response | Scoring & Recovery Grading Criteria |
|:---:|---|---|---|---|---|---|
| **00:00** | $T_{\text{start}}(S1)$ | S1: Intro | Proctor signals stream start. | *"Bắt đầu phiên live UrbanPulse!"* | Operator logs `Actual_Start` for S1. Confirms tech setup. | Setup verified within $\pm 5$s. |
| **01:30** | $T_{\text{start}}(S2)$ | S2: MagSafe | S1 scheduled end. Transition to S2 (`SKU-TECH1`). | None. | Operator marks S1 `DONE`, starts S2. Pins `SKU-TECH1` in Seller Center. | Transition logged within $\le 5$s of 01:30. |
| **03:15** | **$T_{\text{start}}(S2) + 1\text{m}45\text{s}$** | S2: MagSafe | **INJECT D3 STOCKOUT:** Proctor triggers inventory drop to 0 in mock console. | `[MOCK CONSOLE ALERT]: "SKU-TECH1 Tồn kho: 0 (HẾT HÀNG)"` | Operator detects stockout ($T_{\text{detect}}$). Cues host: `[STOP/HẾT HÀNG: Cắt Sạc MagSafe -> Chuyển Tai Nghe ANC]`. Unpins SKU-TECH1. | **$T_{\text{detect}} \le 10\text{s}$**. Transition planned to execute by 03:30. |
| **03:30** | Early S3 Transition | S3: Tai Nghe | Operator transitions cleanly to S3 (`SKU-TECH2`). | None. | Operator marks S2 `DONE` (Actual dur = 2.0m, meeting floor), starts S3. Pins `SKU-TECH2`. | Clean transition executed; S3 receives 7.0m window before 10:30 anchor. |
| **06:00** | **$T_{\text{start}}(S3) + 2\text{m}30\text{s}$** | S3: Tai Nghe | **INJECT D1 STIMULUS:** Proctor posts technical audio question to host chat monitor. | `[CHAT BOT]: "Shop ơi mic đàm thoại ngoài đường gió lớn có lọc ồn tốt không, test mic thực tế đi ạ!"` | Host engages in live audio recording demo; pitch extends past planned target. | Host engagement verified. Overrun initiates naturally. |
| **09:30** | **$T_{\text{start}}(S3) + 6\text{m}00\text{s}$** | S3: Tai Nghe | **EVALUATE D1 DEFICIT:** S3 elapsed = 6.0m. Host requests 1m45s remaining time (target end 11:15). Flash Sale locked to 10:30. **Anchor Deficit = +45s.** | **LiveLift:** Deficit alert card flashes: `[Dự phóng trễ 45s so với Flash Deal 10:30:00]`.<br>**Baseline:** Cell `R5` turns Dark Red (`0.8m` / `45s`). | Operator detects deficit ($T_{\text{detect}}$). Formulates recovery: direct host to wrap S3 by 10:30:00 to protect Flash Sale. | **$T_{\text{detect}} \le 10\text{s}$**. Decision preserves 10:30:00 anchor ($7.0\text{m}$ actual $\ge 3.0\text{m}$ floor). |
| **09:45** | Recovery Dispatch | S3: Tai Nghe | Facilitator monitors recovery instruction. | None. Strictly neutral observation. | Operator dispatches recovery cue: `[RECOVER: Chốt Tai Nghe đúng 10:30 | Giữ Flash Deal Áo Acid Wash]`. | **$T_{\text{decision}}$ scored**. Must be valid under constraints. |
| **10:30** | **Absolute Wall-Clock** | S4: Flash Tee | **EVALUATE D2 ANCHOR 1:** Seller Center Flash Sale unlocks at 10:30:00. **INJECT D4 CONSOLE LAG:** 40s spinner on pinning `SKU-FASH1`. | `[SYSTEM BANNER]: "Seller Center: Pinning failed. Retrying... (40s spinner)"` | Host begins countdown at 10:30:00. Operator dispatches pin on time; detects pin lag; dispatches: `[HOLD: Minigame chọn size 40s trong lúc ghim]`. | **Announcement Variance = 0s**. 40s console spinner recorded as unavoidable platform lag. |
| **11:10** | D4 Cleared | S4: Flash Tee | Network spinner resolves; product card pins. | Proctor releases mock network spinner. | Operator confirms pin on stream; host pitches deal. | Pin verified on stream. Dead air avoided. |
| **12:30** | S4 End | S5: Cargo Pants | Transition to S5 (`SKU-FASH2`). | None. | Operator marks S4 `DONE`, starts S5. Pins `SKU-FASH2` in Seller Center. | Transition logged within $\le 5$s. |
| **13:15** | **$T_{\text{start}}(S5) + 45\text{s}$** | S5: Cargo Pants | **INJECT D5 UNDER-RUN:** Host exhausts styling points; signals early finish. | Host: *"Dạ mẫu quần cargo em giới thiệu xong rồi ạ, em chuẩn bị chốt show nha..."* | Operator detects pacing void ($T_{\text{detect}}$). Cues host: `[HOLD: Minigame chia sẻ livestream giữ sóng đến 14:00]`. | **Operator does NOT pull S6 early**. Anchor 2 held at 14:00:00. |
| **14:00** | **Absolute Wall-Clock** | S6: Kết Show | **EVALUATE CLOSING ANCHOR:** Final broadcast cutoff instant. | Proctor logs closing transition timestamp. | Host begins outro and tomorrow teaser. Operator marks S5 `DONE`, starts S6. | **Variance $\le 15\text{s}$ against 14:00:00**. |
| **15:00** | Final Cutoff | S6: Kết Show | Broadcast concludes. | Proctor: *"Hết giờ phát sóng!"* / *"Stream wrap!"* | Operator ends session. Transitions to post-show review. | Total runtime = $15\text{m}00\text{s} \pm 15\text{s}$. |

---

## 5. Clinical Neutrality & Facilitator Scripting Standards

To preserve empirical integrity and prevent experimenter bias:

### 5.1 Facilitator Code of Conduct
1. **Strictly Non-Directive:** The facilitator must **never** suggest tactical actions (e.g., *"You should probably cut Toner now"* or *"Look at cell R3"*). All proctor communication consists strictly of deterministic environmental stimuli (chat comments, console alerts, network spinners).
2. **Deterministic Triggering:** State-relative stimuli must be injected at the exact second the prerequisite state condition is satisfied ($\pm 2\text{ seconds}$).
3. **Identical Stimulus Fidelity:** Verbatim script copy must be delivered identically across all participating teams, regardless of cohort or condition.

### 5.2 Verbatim Stimulus Script Repository

```
+----------------------------------------------------------------------------------------------------+
|                                VERBATIM PROCTOR STIMULUS SCRIPTS                                   |
+----------------------------------------------------------------------------------------------------+
| STIMULUS D1 (Chat Inquiry - Cosmetics):                                                            |
| "[CHAT BOT]: Shop ơi da đang treatment bong tróc có xài được không, test lên da ngăm xem có vón  |
|  không ạ?"                                                                                         |
|                                                                                                    |
| STIMULUS D1 (Chat Inquiry - Tech/Fashion):                                                         |
| "[CHAT BOT]: Shop ơi mic đàm thoại ngoài đường gió lớn có lọc ồn tốt không, test mic thực tế đi ạ?"|
|                                                                                                    |
| STIMULUS D3 (Stockout Alert - Mock Console):                                                       |
| "[MOCK CONSOLE ALERT]: CẢNH BÁO TỒN KHO: Mã hàng [SKU_ID] đã hết (Tồn kho = 0). Vui lòng cập nhật  |
|  hoặc đổi sản phẩm ghim trên phiên LIVE."                                                          |
|                                                                                                    |
| STIMULUS D4 (Console Network Freeze - Mock Banner):                                                |
| "[SYSTEM BANNER]: Không thể ghim sản phẩm [SKU_ID]. Kết nối máy chủ TikTok Shop đang tải...        |
|  (Đang thử lại trong 40 giây...)"                                                                  |
|                                                                                                    |
| STIMULUS D5 (Host Under-run Cue Card - Confederate Prompt):                                         |
| "Host hoàn thành giới thiệu sản phẩm sớm hơn dự kiến, thông báo trên live: 'Dạ em chia sẻ xong    |
|  sản phẩm này rồi ạ, giờ chuẩn bị qua phần tiếp theo nha cả nhà...'"                               |
+----------------------------------------------------------------------------------------------------+
```

---

## 6. Recovery Grading Rubric & Invalidation Rules

Every disturbance event is scored against objective, quantitative behavioral rubrics:

```
+----------------------------------------------------------------------------------------------------+
|                                    DISTURBANCE SCORING RUBRIC                                      |
+----+--------------------+-----------------------+-------------------------+------------------------+
|Code| Metric             | PASS Criteria         | MARGINAL Criteria       | FAIL Criteria          |
+----+--------------------+-----------------------+-------------------------+------------------------+
| D1 | T_detect           | <= 10.0 seconds       | 10.1 to 20.0 seconds    | > 20.0s or Unrecognized|
| D1 | T_decision         | <= 15.0 seconds       | 15.1 to 30.0 seconds    | > 30.0s or Violates    |
|    |                    | (Condition-Blind)     | (Condition-Blind)       | contractual floors     |
| D2 | V_anchor           | <= 15.0 seconds       | 15.1 to 30.0 seconds    | > 30.0s or Silent Move |
| D3 | Stockout Halt      | Host halts <= 15.0s   | Host halts 15.1 to 30.0s| Host pitches zero-stock|
|    |                    | post-alert            | post-alert              | item > 30.0 seconds    |
| D4 | Tech Lag Hold      | Hold cue sent <= 10s; | Hold cue sent 10.1-20s; | Dead air > 15s or      |
|    |                    | Zero dead air         | Brief pause <= 5s       | Host confused on air   |
| D5 | Under-run Hold     | Hold deployed; Anchor | Hold deployed; Anchor   | Premature sign-off or  |
|    |                    | held at 14:00:00      | variance <= 30s         | Dead air > 15 seconds  |
+----+--------------------+-----------------------+-------------------------+------------------------+
```

### 6.1 Disqualification & Invalidation Rules
A trial run is declared **FATALLY INVALID** if the operator commits any of the following critical operational breaches:
1. **Silent Anchor Shift:** Modifying a hard anchor start time in the spreadsheet or prototype without explicit verbal authorization from the proctor.
2. **Contractual Floor Breach:** Compressing a segment below its non-negotiable floor duration (`Floor_Min`), violating commercial vendor contracts.
3. **Dead Air Abandonment:** Allowing the live broadcast to experience unaddressed dead air or awkward camera silence exceeding **15 continuous seconds**.
4. **Ghost Selling:** Permitting the host to pitch a confirmed out-of-stock SKU for greater than **30 seconds** after the mock console stockout alert was triggered.

---

## 7. Governance Sign-Off

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 2 | Lead Technical Author (M2) | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
