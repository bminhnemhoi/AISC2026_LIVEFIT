# LiveLift Strategy Review & Independent Product Evaluation
## 05 — Strategic Differentiation Scorecard

**Evaluator:** Independent Principal Product Strategist & Systems Researcher  
**Date:** October 4, 2026  
**Scoring Rubric:**
- **0 = Redundant:** Duplicates what TikTok already does natively with zero added value.
- **1 = Weak:** Marginal utility; easily replicated in Google Sheets with basic formulas.
- **2 = Useful:** Practical operational feature, but not a standalone reason to purchase.
- **3 = Differentiated:** Clear competitive advantage over spreadsheets and TikTok-native tools.
- **4 = Strong Strategic Advantage:** Solves a major unsolved industry pain point; difficult to copy.
- **5 = Potential Moat:** Creates compounding proprietary value, network effects, or workflow lock-in.

---

### 1. Capability Differentiation Scorecard

| # | LiveLift Capability | Score (0–5) | Competitive Benchmark | Strategic Rationale & Evaluation |
|---|---|:---:|---|---|
| **01** | **Session Identity & Lifecycle** | **2** (Useful) | Internal / DB | Essential technical foundation for data hygiene, but invisible to paying customers. |
| **02** | **Session Product Pack** | **2** (Useful) | TikTok Shopping Bag | Useful for freezing session pricing, but closely mirrors TikTok's native product sets. |
| **03** | **Run of Show (Rundown)** | **5** (POTENTIAL MOAT) | Google Sheets / Shoflo | **THE CORE HOOK.** Replaces static spreadsheets with a dynamic, cascading e-commerce rundown. |
| **04** | **NOW / NEXT Command Band** | **4** (Strong Advantage) | Mental Math / Zalo | Delivers the 5-second operational answer; keeps host and assistant in lockstep. |
| **05** | **WHY Rationale Engine** | **3** (Differentiated) | Subjective Memory | Backs up recommendations with inspectable plan rules and inventory urgency. |
| **06** | **Runtime Recommendations** | **3** (Differentiated) | TikTok Suggestions | More flexible than TikTok's generic sales nudges; respects rundown sequence and operator queue. |
| **07** | **Operator Action Tracking** | **3** (Differentiated) | Unrecorded in Sheets | Records what was actually attempted, transitioned, and extended during the live. |
| **08** | **Decision Ledger** | **2** (Useful) | Audit Logs | High internal engineering value; low direct marketing appeal to merchants. |
| **09** | **Evidence Provenance & Freshness** | **2** (Useful) | Epistemic Quality | Essential data hygiene; prevents bugs; not a customer-facing purchase driver. |
| **10** | **Semantic Replay (Overview)** | **2** (Useful) | TikTok Video Replay | Useful for diagnosing major mistakes, but low daily operator engagement. |
| **11** | **"As Known Then" Perspective** | **3** (Differentiated) | Non-existent elsewhere| Unique ability to reconstruct what the operator saw; great for agency post-mortems. |
| **12** | **"With Later Evidence" Layer** | **3** (Differentiated) | Manual VLOOKUP | Automates joining TikTok Shop post-live minute performance back to the live rundown. |
| **13** | **Learning Objects** | **2** (Useful) | Notion Notes | Generic notes rot; only valuable when tied directly to executable plan mutations. |
| **14** | **Hypotheses Tracking** | **2** (Useful) | Academic Research | High cognitive burden for average SME sellers; valuable only for sophisticated agencies. |
| **15** | **Causal Experimentation (A/B)** | **1** (Weak) | Legacy Switchback | Mathematically unviable in standard live rooms ($<50$ viewers; MDE $>45\%$). |
| **16** | **Cross-Session Playbook Learning**| **4** (Strong Advantage) | Manual Copy-Paste | 1-Click carry-forward: turns session timing overruns into an auto-adjusted plan for tomorrow. |
| **17** | **Deterministic Simulator** | **4** (Strong Advantage) | Competitions / Training | Critical for team rehearsals, onboarding new live assistants, and bulletproof demos. |
| **18** | **Manual-First Operation** | **4** (Strong Advantage) | API Fragility | Guarantees 100% functionality on Day 1 without requiring ByteDance AM approval. |
| **19** | **Multi-Provider Capability Model**| **3** (Differentiated) | Hardcoded Integrations| Future-proofs the system against Shopee/Facebook expansion, but secondary for MVP. |
| **20** | **Product Radar / Intent Tracking**| **1** (Weak) | Unofficial Scrapers | Relies on brittle unofficial chat scrapers; high maintenance; poor F1 scores on slang. |
| **21** | **Live Pulse (Macro KPI Cards)** | **1** (Weak) | TikTok LIVE Dashboard | Redundant copy of TikTok's native dashboard; distracts operator from the rundown. |

---

### 2. Analysis of Top Differentiators

```
+--------------------------------------------------------------------------------------------------+
|                              THE THREE STRATEGIC PILLARS THAT WIN                                |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   1. THE COMMERCE RUN-OF-SHOW (SCORE: 5)                                                         |
|      * Replaces Google Sheets as the single source of truth for the live stream.                 |
|      * Automatically recalculates downstream timings when segments overrun.                      |
|      * Aligns host prompter and assistant desk in real time.                                     |
|                                                                                                  |
|   2. THE NOW / NEXT COMMAND BAND (SCORE: 4)                                                      |
|      * Eliminates the cognitive chaos of live broadcasts.                                        |
|      * Tells the operator WHAT to do, WHAT is presenting, and WHAT is next in under 5 seconds.   |
|      * Provides a 1-click transition log that records actual broadcast reality.                  |
|                                                                                                  |
|   3. 1-CLICK CROSS-SESSION PLAYBOOK ITERATION (SCORE: 4)                                         |
|      * Automatically joins TikTok Shop post-live minute data to the executed rundown.            |
|      * Identifies which segments overran and which talking points converted.                     |
|      * Generates tomorrow's revised plan with one click, creating a compounding workflow moat.   |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

---

### 3. What Must Be Demoted or Purged

1. **Purge the Generic Analytics Dashboard (Score 1):**  
   Trying to show GMV curves, viewer graphs, and like rates during the live broadcast duplicates TikTok's native LIVE Dashboard. It adds zero value and consumes valuable screen real estate.
2. **Purge Live Chat Sentiment & Intent Radar (Score 1):**  
   Because TikTok does not expose an official live chat WebSocket, attempting to scrape comments using unofficial libraries (`collectors/tiktok_public`) risks merchant account bans and produces noisy, uncalibrated NLP intent graphs.
3. **Demote Causal Experimentation (Score 1):**  
   Switchback A/B testing is mathematically broken for 90% of live streams. Remove it from P0 entirely.
4. **Demote Complex Replay Scrubbing (Score 2):**  
   Keep replay simple and focused on a **3-minute variance report** (Plan vs Actual delta), rather than marketing an exhaustive second-by-second scrubbing engine.
