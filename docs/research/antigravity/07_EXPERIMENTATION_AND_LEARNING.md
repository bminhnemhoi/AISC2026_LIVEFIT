# LiveLift Strategic Research & Architecture Synthesis
## 07 — Experimentation, Causal Inference & Continuous Learning

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Focus:** Statistical Reality in Live Commerce, Small-Sample Experimentation, and the Learning Loop  
**Reference Documents:** `PREREGISTRATION.md`, `HARNESS.md`, `docs/benchmarks/so-hieu-chuan.json`, `docs/product/05_REVIEW.md`  

---

### 1. The Statistical Reality of Livestream Commerce

In traditional e-commerce (e.g., web storefronts), experimentation uses classic A/B testing: User $A$ is routed to Treatment and User $B$ to Control via cookie hashing.

**In livestream commerce, classic user-level A/B testing is physically impossible.**
1. **Single Shared Canvas:** Every viewer in a live room sees the exact same video stream, host presentation, and pinned showcase product. The audience cannot be split.
2. **Time is the Only Split Unit:** The only way to experiment is to vary interventions over time (e.g., pinning a product during interval $t_1$, and unpinning or showing a standard item during interval $t_2$).

#### 1.1 The Legacy Switchback Approach: Strengths and Fatal Flaws
The legacy LiveLift system implemented a rigorous within-session switchback design based on Bojinov, Simchi-Levi & Zhao (2023) and Hu & Wager (2022). It partitioned a 90-minute session into 16 time blocks (10-minute boundary blocks and 14 5-minute blocks), randomly assigning each block to `ON` (treatment pin) or `OFF` (control).

```
+--------------------------------------------------------------------------------------------------+
|                              LEGACY SWITCHBACK SCHEDULE (90 MIN)                                 |
+--------------------------------------------------------------------------------------------------+
| Block: |  01   |  02   |  03   |  04   |  05   |  06   |  07   |  08   | ... |  15   |  16   |
| Arm:   |  OFF  |  ON   |  OFF  |  OFF  |  ON   |  OFF  |  ON   |  ON   | ... |  OFF  |  ON   |
| Time:  | 10 min| 5 min | 5 min | 5 min | 5 min | 5 min | 5 min | 5 min | ... | 5 min | 10 min|
| Burn:  | [1m]  | [1m]  | [1m]  | [1m]  | [1m]  | [1m]  | [1m]  | [1m]  | ... | [1m]  | [1m]  |
+--------------------------------------------------------------------------------------------------+
```

While mathematically elegant, enforcing switchback as a mandatory operational prerequisite in production created catastrophic product failures:
- **Small-Room Power Failure:** The legacy benchmark (`tom-tat.json`) revealed that at an average of 15 concurrent viewers (typical for small Vietnamese SME shops), the Minimum Detectable Effect (MDE) is **over 45%**! In small rooms, random noise completely overwhelms the statistical signal.
- **Carryover Distortion:** When a host presents and pins a viral product in Block 2 (`ON`), viewers continue thinking about, clicking, and buying that product in Block 3 (`OFF`). The 1-minute burn-in window proved insufficient when viewer dwell time was 5–7 minutes.
- **Operational Straightjacket:** Hosts refused to follow random switchback timers. If a product was selling rapidly, forcing the host to unpin it after 5 minutes because the randomizer demanded an `OFF` block violated basic commercial common sense.

**Strategic Pivot:** LiveLift-next completely decouples the core live desk from mandatory switchbacks. Live operations run smoothly without any experimentation. Experimentation is treated as an optional advanced capability for high-volume streams.

---

### 2. Pragmatic Experimental Designs for Real-World Livestreams

For teams that genuinely want to test operational strategies, LiveLift recommends designs calibrated to realistic traffic tiers:

| Strategy | Suitable Audience Size | Execution Model | Confounding & Bias Controls | Commercial Disruption |
|---|---|---|---|---|
| **Paired Product Rotation** | Low–Medium ($15–100$ viewers) | Alternate two comparable products (e.g. Tee A vs Tee B) across equivalent 15-minute segments | Rotates sequence order across sessions to balance host fatigue | Very Low; matches normal sales rhythms |
| **Pre/Post Timed Intervention** | Low ($<50$ viewers) | Baseline 10 min standard presentation $\rightarrow$ 10 min with interactive cue (e.g. size chart) | Compares relative lift against same-session baseline | Zero |
| **Cross-Session Paired Switchback** | High ($>100$ viewers) | Session 1: Strategy A in early half, Strategy B in late half; Session 2 reverses order | Controls for time-of-day and viewer arrival curve | Low |
| **Full Blocked Switchback** | Very High ($>300$ viewers) | Legacy 5-min randomized blocks with 2-min burn-in (Hu & Wager 2022) | Randomization inference test with fixed seed | Moderate; requires trained host |

---

### 3. Confounding Factors in Livestream Commerce

Any analysis of livestream data must account for severe confounding variables:

```
                                  +-----------------------+
                                  |   TRAFFIC SPIKES      |
                                  | (TikTok FYP Algorithm)|
                                  +-----------------------+
                                              |
                                              v
+-----------------------+         +-----------------------+         +-----------------------+
|    HOST FATIGUE &     | ------> |    OBSERVED SALES &   | <------ |     PRODUCT PRICE     |
|   ENERGY OVER TIME    |         |    CLICK CONVERSIONS  |         |     & INTRINSIC VALUE |
+-----------------------+         +-----------------------+         +-----------------------+
                                              ^
                                              |
                                  +-----------------------+
                                  |   VIEWER ACCUMULATION |
                                  |  & LIVE DURATION BIAS |
                                  +-----------------------+
```

1. **Platform Algorithm Surges:** TikTok's recommendation algorithm periodically dumps 500 viewers into a room for 3 minutes before traffic subsides. If an intervention coincides with an algorithmic surge, an unadjusted analysis will falsely attribute the spike to the operator's action.
2. **Product Heterogeneity:** Pinning a 50,000 VND flash-sale lipstick will always generate more raw clicks than pinning a 1,500,000 VND winter coat. Comparing interventions across dissimilar products without margin/price normalization produces invalid conclusions.
3. **Sequence & Fatigue Effects:** Segments presented during the first 30 minutes benefit from high host energy and fresh viewers. Segments presented at minute 110 suffer from host exhaustion and viewer drop-off.

---

### 4. The Structured Learning Loop

Rather than pretending an automated AI model can definitively calculate causal lift, LiveLift empowers operators through a disciplined, qualitative-to-quantitative **Learning Loop**:

$$\text{Observation} \longrightarrow \text{Insight} \longrightarrow \text{Hypothesis} \longrightarrow \text{Next-Live Change Proposal}$$

```
+--------------------------------------------------------------------------------------------------+
|                                    THE LEARNING OBJECT MODEL                                     |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
| [1. OBSERVATION]  "During M03 Cargo Pants (min 42-49), 18 comments asked about waist sizing."    |
|                   Evidence Link: comment_event_ids [c1, c2...], segment_id: 'seg_m03'            |
|                   Certainty: PROVEN FACT (Directly observed in chat log)                         |
|         |                                                                                        |
|         v                                                                                        |
| [2. INSIGHT]      "Viewers hesitate to buy pants because size chart is not shown early."         |
|                   Certainty: INTERPRETATION (Plausible operational pattern)                      |
|         |                                                                                        |
|         v                                                                                        |
| [3. HYPOTHESIS]   "Displaying the size card in the first 60 seconds will reduce redundant        |
|                   comments and shorten required segment duration by 2 minutes."                  |
|                   Certainty: TESTABLE PREDICTION                                                 |
|         |                                                                                        |
|         v                                                                                        |
| [4. NEXT-LIVE]    Concrete Action Proposal:                                                      |
|                   * Target: Segment M03 Cargo Pants                                              |
|                   * Mutation: Add cue "Hold size chart to camera at 00:30"                       |
|                   * Planned Duration: Reduce from 7 min to 5 min                                 |
|                   * Status: DRAFT -> ACCEPTED BY OPERATOR FOR NEXT LIVE                          |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

#### 4.1 Strict Guardrails on Causal Language
To protect seller trust, LiveLift strictly enforces epistemic modesty across all UI surfaces:

| Prohibited Misleading Claim (AVOID) | Approved Epistemic Copy (P0 STANDARD) |
|---|---|
| *"Ghim M03 đã tăng 35% doanh thu phiên này."* | *"M03 ghi nhận 45 lượt bấm trong lúc ghim, cao hơn mức trung bình phân khúc."* |
| *"AI phát hiện ghim áo nỉ lúc phút 20 là nguyên nhân kéo 200 khách mới."* | *"Thời điểm ghim áo nỉ trùng với lượt vào từ thuật toán (200 người xem mới gia nhập)."* |
| *"Chiến lược của bạn hiệu quả 98%."* | *"Phiên hoàn thành 14/15 phân đoạn theo đúng kế hoạch; 3 đề xuất được chấp thuận."* |

---

### 5. Carry-Forward Pipeline: Turning Review into Action

The learning loop achieves closure during session creation:
1. Operator opens an ended session's Review $\rightarrow$ `Learn` subview.
2. Operator reviews accepted `Next-Live Changes`.
3. Operator clicks **"Create Next LIVE"**.
4. The clone preview displays:
   - Base Product Pack (retained).
   - Base Run of Show (retained).
   - **Checklist of Proposed Changes:**
     - `[x]` Reduce M03 duration by 2 mins (Hypothesis: Sizing cue).
     - `[x]` Move Flash Sale from minute 45 to minute 20.
     - `[ ]` Swap Hoodie M02 for Zip Sweater (Deselected by operator).
5. Operator confirms. The server generates a fresh session with a unique `session_id`, applies the selected changes to `plan_revision = 1`, and embeds the originating session ID as `cloned_from_session_id`.
6. Historical data is 100% preserved; the new session starts with a clean operational slate.
