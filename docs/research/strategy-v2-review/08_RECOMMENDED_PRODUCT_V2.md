# LiveLift Strategy Review & Independent Product Evaluation
## 08 — Recommended Product V2 Specification: The Commerce Run-of-Show Desk

**Author:** Principal Product Strategist & Systems Architect  
**Date:** October 4, 2026  
**Document Status:** Definitive Product Direction Post-Strategy V2 Review  
**Product Category:** Commerce Run-of-Show & Live Operations Desk  

---

### 1. Product Identity & Problem Statement

#### 1.1 One-Line Positioning
> **LiveLift is the Commerce Run-of-Show desk that replaces chaotic spreadsheets and chat coordination, keeping livestream teams on schedule, on cue, and continuously improving every broadcast.**

#### 1.2 The Problem
During a 3-hour live broadcast on TikTok Shop, the live studio is chaotic:
- The host rambles on Segment 1 for 18 minutes instead of the planned 8 minutes.
- The assistant is frantically messaging on Zalo, calculating mental math on when the Flash Sale voucher must drop.
- The printed spreadsheet on the clipboard is immediately outdated.
- The assistant clicks the wrong product pin on the mobile screen because they lost their place in the script.
- After the live stream ends at 11 PM, the team is exhausted. Nobody updates the spreadsheet. Tomorrow's live broadcast repeats the exact same operational mistakes.

TikTok LIVE Manager manages the **broadcast video, shopping bag, and money collection**, but it provides **zero support for operational rundown timing, presenter pacing, and cross-session playbook iteration**.

#### 1.3 Target User Persona
- **Primary:** The **Live Assistant / Operations Lead (Trợ live / Điều phối phiên)** sitting at the control desk with dual monitors beside the studio floor.
- **Secondary:** The **Livestream Host / Creator (Người dẫn live)** who needs a clean, distraction-free prompter showing the current item, remaining target seconds, and key talking points.
- **Tertiary:** The **Shop Owner / Live Commerce Agency Manager** reviewing weekly operational variance across 5 live studios.

---

### 2. Core Operational Workflow

```
[ 1. PREPARE ]          Operator builds the Run of Show (segments, target durations, linked SKUs,
                        talking-point cues, promotion triggers) in under 10 minutes.
                             |
                             v
[ 2. OPERATE ]          Desk displays NOW / NEXT / WHY in 5 seconds. Clocks dynamically cascade
                        downstream timing drift. Assistant logs 1-click transitions and notes.
                             |
                             v
[ 3. WRAP ]             Runtime freezes automatically. Assistant confirms outstanding notes.
                             |
                             v
[ 4. REVIEW (3-MIN) ]   Desk displays the Executive Plan vs Actual Variance Card (top overrunning
                        segments, missed cues, joined to TikTok post-live revenue data).
                             |
                             v
[ 5. ITERATE & CLONE ]  Operator clicks "Apply to Tomorrow's Live." System clones the rundown,
                        auto-adjusts durations, and generates the new plan in 1 click.
```

---

### 3. What LiveLift IS vs What LiveLift IS NOT

| LiveLift IS | LiveLift IS NOT |
|---|---|
| The **smart operational rundown** for live commerce teams | A replacement for TikTok LIVE Manager or OBS |
| The **sidecar desk** sitting on the secondary monitor | An automated bot that claims to auto-pin products |
| An active system that **calculates timing overruns in real time** | A generic analytics dashboard showing GMV curves |
| A tool that **turns operational mistakes into tomorrow's plan** | An academic clinical trial A/B testing suite |
| An **append-only evidence ledger** ensuring historical honesty | An AI chatbot or generic script generator |

---

### 4. P0 vs P1 Scope Definition

#### 4.1 P0 Scope (The Usable Core Loop — 100% Manual-First, Zero API Blocker)
- **Session Identity:** Environment (`REAL` vs `SIMULATED`), timezone, and title.
- **Run of Show Engine:**
  - Drag-and-drop segment sequencing.
  - Linked product association (Code, Name, Price, Notes).
  - Target duration math with **Dynamic Downstream Cascade Drift** (recalculating start times when segments overrun).
  - Presenter cues and promotion reminders.
- **Operator Desk (NOW / NEXT / WHY / ACTION):**
  - Current segment elapsed timer and overrun indicator.
  - NEXT recommendation based on plan sequence, operator queue, and coverage.
  - 1-Click transition controls (`Start Next`, `Extend +1m`, `Hold`, `Skip`, `Report Presenting`).
  - Action scoping and idempotency guards.
- **3-Minute Post-Live Review:**
  - Executive Plan vs Actual Variance Summary.
  - Highlight segments with $>2$ min overrun/underrun.
  - Basic semantic timeline drill-down.
- **1-Click Next LIVE Clone:**
  - Clone previous rundown into new session with auto-adjusted durations.
- **Deterministic Simulator:**
  - Built-in `01_golden_run.json` scenario for instant demo and team training.

#### 4.2 P1 Scope (High-Value Post-Core Enhancements)
- **Official TikTok Shop Integration:**
  - Ingest catalog via `product.list`.
  - Automated post-live audit reconciliation via `performance_per_minutes` API.
- **Host View Companion Route (`/live/:id/host`):**
  - Ultra-clean, high-contrast mobile/tablet display showing current item, elapsed timer, and talking-point cue.
- **Offline Draft Resilience (IndexedDB):**
  - Local quarantine of notes captured during studio Wi-Fi drops.
- **Multi-Room Agency Dashboard:**
  - View planned rundowns across 3 simultaneous studio rooms.

#### 4.3 What NOT to Build (Definitive Purge List)
- **DO NOT BUILD:** A video player or live stream encoder.
- **DO NOT BUILD:** A live chat clone or comment scraper.
- **DO NOT BUILD:** Flash Sale / Coupon / Giveaway creation builders (TikTok owns execution).
- **DO NOT BUILD:** An AI marketing script copywriter.
- **DO NOT BUILD:** Mandatory switchback randomization engines.

---

### 5. Platform Coexistence & Architecture

#### 5.1 The Dual-Monitor Desk Setup
In real studio operations, LiveLift lives peacefully alongside TikTok:
- **Left Monitor (TikTok LIVE Manager):** Video monitor, live chat moderation, shopping bag order changes, native flash sale launch, and native pinning.
- **Right Monitor (LiveLift Control Desk):** The Run of Show, NOW/NEXT cues, dynamic timing overrun cascade, presenter prompts, and 1-click actual transition logging.

#### 5.2 Dynamic Capability Adaptation
If an official TikTok Shop account is connected, LiveLift enriches the experience (pulling product names automatically, joining post-live minute revenue to segments). If no account is connected, LiveLift runs **100% manually without error, degradation, or disruption.**

---

### 6. Measurable Success Criteria

LiveLift Product V2 is successful when:
1. **Onboarding in $< 3$ Minutes:** An operator can import a product list, arrange 5 segments, and start live tracking without configuring API keys.
2. **Zero Mental Math on Overruns:** When a host overruns by 4 minutes, the operator immediately sees the downstream impact on all future segments without opening a calculator.
3. **Closing the Loop in 3 Minutes:** Post-live review takes under 3 minutes, identifying the top 2 timing mistakes and outputting an adjusted plan for tomorrow's broadcast.
