# LiveLift Strategy Review & Independent Product Evaluation
## 01 — Original LiveLift Historical Audit: From Competition Experiment to Production Reality

**Evaluator:** Independent Principal Product Strategist & Technical Architect  
**Date:** October 4, 2026  
**Audited Baseline:** `AISC2026_LIVEFIT` (Legacy Repository) · `rebuild/livelift-next`  
**Primary References:** `README.md`, `HARNESS.md`, `PREREGISTRATION.md`, `references/LEGACY_REUSE_MATRIX.md`  

---

### 1. The Original Problem Statement & Value Proposition

LiveLift was conceived as an academic competition project for AISC'26 under the thesis:
> *"Does pinning product B in minute 30 actually cause sales to rise, or was it just a coincidence driven by an algorithmic traffic surge or an energetic host?"*

The original value proposition was **Causal Live-Commerce Experimentation**:
1. Divide a live broadcast into randomized time blocks (switchback design).
2. Randomize blocks to `ON` (treatment: automated product pin) or `OFF` (control: standard broadcast).
3. Track viewer click-throughs via self-hosted redirect shortlinks (`/r/{code}`).
4. Compute Intent-to-Treat (ITT) and Local Average Treatment Effect (LATE) estimators with 95% confidence intervals from randomization inference tests.

---

### 2. What Was Actually Working vs What Was Aspirational

A rigorous examination of `/src/livelift`, `/web`, `/collectors`, and the 2,100 automated tests reveals a stark division between working engineering reality and aspirational prototype claims:

```
+--------------------------------------------------------------------------------------------------+
|                               ORIGINAL LIVELIFT SYSTEM AUDIT                                     |
+--------------------------------------------------------------------------------------------------+
| PROVEN, WORKING CODE (Genuinely Solid)                                                           |
| 1. Session Lifecycle State Machine (src/livelift/api/routes/sessions.py): Enforced             |
|    fail-closed transitions (planned -> scheduled -> live -> ended/cancelled).                    |
| 2. Click Validity & Redirect Tracking (src/livelift/core/click_validity.py): Implemented         |
|    strict IAB GIVT-lite rules (filtering web spiders, prefetch headers, refractory windows).     |
| 3. Vietnamese PII Scrubbing (src/livelift/ingest/pii/filter.py): Outstanding multi-pass regex   |
|    and phonetic dictionary filter achieving >=95% recall on Vietnamese phone numbers and CCCDs.  |
| 4. Official TikTok Shop API Client (src/livelift/ingest/tiktok_shop.py): Fully tested HMAC-SHA256|
|    signing engine and rate-limiting backoff for official post-live minute performance analytics. |
| 5. Statistical Estimation Core (src/livelift/analysis/estimators.py): Mathematically sound      |
|    randomization inference estimators calibrated against KuaiLive simulation benchmarks.        |
+--------------------------------------------------------------------------------------------------+
| ASPIRATIONAL / FRAGILE / FICTIONAL MECHANISMS (Must Be Acknowledged as Failed)                   |
| 1. Automated Platform Pinning (src/livelift/api/autopilot.py): Assumed software could           |
|    programmatically pin products on TikTok Shop. Zero official API exists. Completely dead.     |
| 2. Live Chat Ingestion & NLP Radar: Depended on collectors/tiktok_public, an unofficial          |
|    reverse-engineered WebSocket scraper. Highly fragile, zero platform guarantees, banned.     |
| 3. Real-Time Causal Estimation: Assumed real-time causal lift could be displayed during a live. |
|    Impossible under small-sample live traffic; numbers were pure statistical noise.              |
+--------------------------------------------------------------------------------------------------+
```

---

### 3. Root Cause Analysis: Why Original LiveLift Failed Operationally

An analysis of `docs/incident-log.md` (121 recorded incidents) and `docs/benchmarks/kiem-chung-van-hanh.md` reveals the five fatal flaws that killed the original product:

1. **The Small-Room Power Failure (Statistical Infeasibility):**  
   The project preregistration locked in 16 blocks of 5 minutes. However, benchmark calibration (`tom-tat.json`) revealed that with 15–50 concurrent viewers (the standard audience for 90% of Vietnamese live sellers), the Minimum Detectable Effect (MDE) exceeded **45%**. To detect a realistic 10% lift with 80% statistical power would require 1,200+ concurrent viewers across 40 continuous hours of broadcasting. The core statistical promise was mathematically unachievable for its target audience.
2. **The Switchback Operational Straightjacket:**  
   To start broadcasting, the `/chay-phien` wizard forced the seller to draw random seeds, generate an immutable switchback schedule, and lock it before going live. If a product suddenly caught fire and began selling out, the software demanded that the host unpin it when the 5-minute timer expired because the randomizer dictated an `OFF` block. Sellers rightfully revolted against software that sabotaged their sales rhythms.
3. **The 4-Column UI Disaster (`/desk`):**  
   The legacy desk layout partitioned the laptop screen into four equal-width vertical columns: Block Timer, Action Cards, Unfiltered Chat, and KPI graphs. In a high-tempo live stream, the operator's eye darted across 20 competing elements. Essential actions were buried, and clicking an action suffered from selection drift incidents where client-side card lists mismatched server candidate sets.
4. **Accidental Architectural Complexity:**  
   The backend incorporated TimescaleDB hypertables for `session_tick` (over-engineered for low-frequency live data), provisioned Redis (which was left completely unutilized in application code), and attempted to maintain an active machine-learning TF-IDF classifier on CPU for incoming Vietnamese slang.

---

### 4. What Was Over-Engineered vs What Was Genuinely Useful

| Architectural Asset | Verdict | Assessment |
|---|---|---|
| **Mandatory Switchback Schedule** | **DISCARD** | Pure academic over-engineering; commercial poison for live sellers. |
| **Autopilot Auto-Pin Engine** | **PURGE** | Built on false API assumptions; risks seller account bans. |
| **TimescaleDB Hypertables** | **SIMPLIFY** | Standard PostgreSQL 16 with standard indexes easily handles 5,000 events/session. |
| **Session Lifecycle Safety** | **RETAIN** | Fail-closed state transitions (`planned` $\rightarrow$ `live` $\rightarrow$ `ended`) prevent corrupted session history. |
| **Action & Scope Invariants** | **RETAIN** | Requiring `session_id`, `runtime_generation`, and `target_id` prevents cross-room contamination. |
| **Vietnamese PII Scrubber** | **RETAIN** | Mission-critical compliance tool for Law 91/2025/QH15. |
| **Append-Only Event Tables** | **RETAIN** | Migration 0006 (`assignment_event` vs `exposure_event`) proved separating intent from reality is essential. |
| **HMAC TikTok Shop API Client**| **RETAIN** | Production-grade client ready for post-live analytics reconciliation. |

---

### 5. Strategic Takeaway for LiveLift-next

Original LiveLift attempted to build an **academic clinical trial machine disguised as a broadcasting tool**. 

LiveLift-next must take the rigorous backend invariants (lifecycle safety, append-only event separation, PII protection, click tracking) and place them beneath a product that solves an urgent, daily commercial problem: **orchestrating the live show smoothly from pre-live rundown to post-live iteration.**
