# LiveLift V3 Participant Profile & Sampling Specification

**Document ID:** `VAL-V3-PROFILE-01`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 1 (Foundations & Participant Pipeline)  
**Classification:** Sampling Methodology & User Qualification  
**Authoritative Source:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §21; `docs/research/codex-gap-study/14_USER_VALIDATION_PLAN.md`

---

## 1. Executive Summary & Purpose

This document specifies the target participant profiles, sampling quotas, qualification criteria, and screening rubrics for the LiveLift V3 Product Validation Program.

To produce empirical evidence that withstands scientific and commercial scrutiny:
1. **Recruit by Pain, Not Label:** Participants must be recruited based on verified operational pain around live timing drift, hard promotion anchor collisions, and tedious post-show reconstruction—not generic interest in e-commerce or AI.
2. **Strict Division of Labor:** Validation requires teams with a clear operational separation between the on-camera talent (**Host**) and the technical console controller (**Operator/Producer**).
3. **Independent Role Denominators:** Operator Desk (P0) and Host View (P0.5) serve distinct cognitive jobs. Their evaluations must be measured and reported with independent sample denominators ($n_{\text{op}}$ vs. $n_{\text{host}}$).

---

## 2. Ideal Customer Profile (ICP) Specification

```
+---------------------------------------------------------------------------------------------------+
|                                  LIVELIFT V3 TARGET AUDIENCE MATRIX                               |
+---------------------------------------------------------------------------------------------------+
|  [ PRIMARY ICP: Merchant Studio Teams ]                   [ SECONDARY ICP: Creator + Assistant ]  |
|  - Dedicated Operator + Host                              - Solo creator with dedicated assistant |
|  - >= 2-3 commercial live shows / week                    - Commercial promotion-heavy shows      |
|  - 8 to 25+ featured SKUs per show                        - High recurring rundown reuse          |
|  - Strict promotion anchors (Flash Sales, Vouchers)       - Shared operational responsibility     |
+---------------------------------------------------------------------------------------------------+
|  [ ANTI-ICP: DISQUALIFIED FROM PRIMARY SAMPLE ]                                                   |
|  - Solo Creators without operator (extreme cognitive overload; another screen is toxic)          |
|  - Analytics-only / Scraping teams (seeking TikTok scrapers, bots, or GMV predictive models)      |
|  - Casual / Chat-only Streamers (no structured rundown or time-locked commercial promotions)       |
|  - Large Enterprise Agencies (requiring multi-room RBAC, multi-tenant scheduling; out of scope)   |
+---------------------------------------------------------------------------------------------------+
```

### 2.1 Primary ICP: Recurring Vietnamese TikTok Shop Merchant Teams & Boutique Studios
* **Organization Type:** Independent brand merchants (DNVBs), official brand distributors (beauty, fashion, FMCG, home accessories), and boutique live-commerce production agencies located in major Vietnamese e-commerce hubs (Ho Chi Minh City, Hanoi, Da Nang).
* **Team Structure:** Dedicated studio cell consisting of at least:
  - 1 Lead Operator / Producer (controlling TikTok Shop Seller Center, OBS/streaming hardware, inventory allocation, and runsheet timing).
  - 1 Live Host / KOC (presenting products, interacting with viewers on camera).
  - *(Optional)* 1 Product Assistant (physical product staging, sample handoff).
* **Broadcast Cadence:** Running at least **2 to 3 recurring commercial live sessions per week**, typically ranging from 90 minutes to 4 hours per session.
* **Catalog Complexity:** 8 to 25+ active SKUs featured per broadcast, requiring structured sequence management.
* **Promotional Mechanics:** Frequent use of time-locked marketing mechanisms:
  - TikTok Shop Seller Center Flash Deals (*Giờ vàng giá sốc*).
  - Platform co-funded vouchers (*Mã giảm giá sàn*).
  - Brand-exclusive limited-quantity vouchers (*Voucher độc quyền nhãn hàng*).
* **Post-Show Administrative Need:** Mandatory operational requirement to reconcile actual product screen-time for brand sponsor SLAs, host commission tiers, and next-day sales planning.

### 2.2 Secondary ICP: Commercial Creator + Dedicated Operations Assistant
* **Organization Type:** Top-tier or mid-tier Key Opinion Consumer (KOC) / Creator running an independent commercial channel with an employed operations assistant.
* **Operational Characteristics:** The creator focuses 100% on on-camera sales delivery, while the assistant operates the runsheet, Seller Center console, and physical product staging from behind the camera.
* **Eligibility Rule:** Eligible for the study **only if** the operations assistant functions as a true rundown controller rather than just a passive camera technician.

### 2.3 Strict Anti-ICP (Automatic Disqualification Criteria)
To prevent polluted validation signals, the following profiles are strictly excluded from the primary validation sample:

1. **Solo Creators (No Dedicated Behind-the-Camera Operator):**
   - *Rationale:* A solo creator streaming from a single phone or ring light possesses zero cognitive bandwidth to operate a runsheet software desk while pitching and reading chat. Imposing an additional screen on a solo streamer induces severe cognitive saturation and guaranteed workflow rejection.
2. **Analytics-Only / Strategic Management Teams:**
   - *Rationale:* Teams seeking BI dashboards, competitor scraping (Kalodata, FastMoss), historical pricing charts, or AI GMV prediction. LiveLift V3 is a live show execution tool, not an executive BI platform.
3. **Casual, Conversational, or Unstructured Streamers:**
   - *Rationale:* Streamers who broadcast spontaneous lifestyle chat, gaming, or unstructured product showcases without pre-scheduled time commitments or promotional anchors.
4. **Large Enterprise MCNs Demanding Multi-Room / Multi-Tenant Systems:**
   - *Rationale:* Enterprise agencies operating 10+ concurrent studios requiring centralized resource scheduling, multi-level role-based access control (RBAC), and enterprise ERP integrations. (Explicitly deferred to Phase 2/3).

---

## 3. Operator and Host Persona Rubrics

### 3.1 Persona 1: The Operator / Producer (`Role: OPERATOR`)

```
+-----------------------------------------------------------------------------------+
|                         PERSONA: LIVE OPERATIONS PRODUCER                         |
+-----------------------------------------------------------------------------------+
| Title: Lead Operator, Studio Producer, E-Commerce Coordinator                     |
| Experience: >= 6 months running commercial TikTok Shop / Shopee Live broadcasts   |
| Primary Workspace: Behind the broadcast desk; 2 to 4 screens concurrently         |
+-----------------------------------------------------------------------------------+
```

#### Core Operational Responsibilities
1. **Rundown Pacing:** Enforcing the broadcast timeline, monitoring elapsed segment durations, and preventing schedule drift.
2. **TikTok Shop Seller Center Management:** Manually pinning and unpinning active products, activating and deactivating platform vouchers, updating flash deal stock quantities, and monitoring real-time inventory run-rates.
3. **Host Direction:** Transmitting real-time timing instructions, deal callouts, and product transition commands to the host via chat, cue cards, or IFB.
4. **Post-Show Reconciliation:** Compiling actual screen times, logging delays, calculating product performance, and drafting the rundown for the next session.

#### Operational Context & Technical Constraints
* **The Platform Air-Gap Reality:** Operates under the hard constraint that TikTok Shop provides **zero external API** to programmatically pin products or activate vouchers. The operator must physically click within Seller Center for every platform action.
* **Current Tool Stack:**
  - *Planning & Rundown:* Google Sheets (shared with brand/agency) or printed paper runbooks.
  - *Communication:* Zalo group chat (`#live-ops`), physical dry-erase whiteboards, hand gestures, or wireless IFB earpieces.
  - *Streaming Control:* TikTok Live Studio, OBS Studio, Prism Live Studio.
  - *Commerce Console:* TikTok Shop Seller Center browser dashboard on desktop.

#### Behavioral Stress Triggers
* **The "Cháy giáo án" Panic:** Host becomes engaged in audience comments, overrunning a 5-minute pitch to 10 minutes. The operator realizes downstream flash sales will be missed but cannot calculate the required segment cuts fast enough while managing live stock.
* **Formula Breakdown in Spreadsheets:** Operator attempts to insert or delete rows in Google Sheets during a live broadcast, resulting in `#REF!`, formula circularity, and lost time tracking.
* **Multi-Screen Cognitive Fragmentation:** Juggling four open windows (OBS, Seller Center, Google Sheets, Zalo). Glancing away from Seller Center to update a spreadsheet cell causes a delayed product pin.

---

### 3.2 Persona 2: The On-Camera Host / Talent (`Role: HOST`)

```
+-----------------------------------------------------------------------------------+
|                         PERSONA: ON-CAMERA LIVESTREAM TALENT                      |
+-----------------------------------------------------------------------------------+
| Title: Livestream Host, KOC, Commercial Presenter                                 |
| Experience: >= 6 months on-camera selling; minimum 100+ hours of live broadcast   |
| Primary Workspace: On-camera set; standing/sitting before main lens & ring light  |
+-----------------------------------------------------------------------------------+
```

#### Core Operational Responsibilities
1. **Sales Conversion & Charisma:** Delivering high-energy product pitches, executing physical demonstrations, storytelling, overcoming viewer objections, and driving immediate checkout urgency.
2. **Audience Engagement:** Reading and answering 30 to 100+ live chat comments per minute scrolling on the studio monitor.
3. **Call-to-Action (CTA) Delivery:** Synchronizing verbal deal pitches with product pins (*"Các chị ơi nhìn vào giỏ hàng góc trái màn hình, mã 01 đang được ghim..."*).

#### Cognitive Bottlenecks & Human Limitations
* **Line-of-Sight Glance Budget:** The host's primary gaze must remain locked onto the camera lens to maintain audience eye contact. Gaze deviations to read auxiliary screens must not exceed **2 to 3 seconds**.
* **Atomic Information Tolerance:** Under high-energy selling, the host cannot absorb dense text, paragraphs, or arithmetic calculations. They can only process **atomic cues ($\le 5$ words or simple digits)** delivered in large, high-contrast typography (e.g., `Ghim mã 03`, `Còn 1 phút`, `Cắt chuyển flash`).
* **Audio-Visual Collisions:** Detailed verbal chatter from an operator over an in-ear IFB while the host is speaking induces immediate speech stumbles, stuttering, or cognitive paralysis ("teleprompter glaze").

#### Behavioral Stress Triggers
* **Unclear Pacing Cues:** Receiving ambiguous operator cues via chat (e.g., *"Cố gắng nhanh lên nhé"* without specifying which product is next or how many minutes remain).
* **Mid-Sentence Disturbance Halts:** Having a product unpinned abruptly from Seller Center without warning while mid-pitch because stock ran out.
* **Missed Promotional Sync:** Missing the exact second of a platform flash sale, resulting in audience confusion when viewers click the pin and see normal prices.

---

## 4. Sample Sizing & Composition Quotas

### 4.1 Sample Size Framework
To satisfy statistical and methodological rigor for a formative within-subjects validation trial (ensuring statistical power under non-parametric Wilcoxon signed-rank tests at $\alpha = 0.05$):
* **Total Sample Size:** **$N = 6 \text{ to } 10$ participant pairs** (12 to 20 total individuals), partitioned into two counterbalanced cohorts of $n = 3\text{--}5$ pairs each.
* **Core Majority Requirement:** Standard recurring merchant teams from the Primary ICP (§2.1) must form the core majority of the sample (at least **$\ge 3$ standard merchant teams** across all cohorts).
* **Team Breadth:** Recruited across at least **$\ge 3$ distinct, independent merchant teams or studios**.

### 4.2 Independent Role Denominators
Because the Operator Desk (P0) and Host View (P0.5) evaluate separate interfaces and cognitive tasks, results must be tabulated with explicit, separated denominators:
* **Dedicated Operators:** $n_{\text{op}} \ge 3$ (Target: $n_{\text{op}} = 6\text{--}10$).
* **On-Camera Hosts:** $n_{\text{host}} \ge 3$ (Target: $n_{\text{host}} = 6\text{--}10$).
* *Reporting Mandate:* Every metric must declare its exact sample denominator (e.g., *"Recovery Decision Latency: $n_{\text{op}} = 6$ operators"*; *"Cue Comprehension Rate: $n_{\text{host}} = 6$ hosts"*).

### 4.3 Cohort Composition Quotas & Archetypes
The participant sample is anchored by standard merchant teams while deliberately incorporating specific operational archetypes to stress-test product boundaries:

```
+---------------------------------------------------------------------------------------------------+
|                                  COHORT DIVERSITY & SAMPLING MATRIX                               |
+---------------------------------------------------------------------------------------------------+
| 1. Standard Primary ICP Merchant Teams | >= 3 Teams    | Core majority; validates everyday reality |
| 2. Advanced Spreadsheet Power-User     | >= 1 Operator | Guarantees baseline is fair and competent |
| 3. Skeptical / Anti-Screen Operator    | >= 1 Operator | Tests friction and resistance to new tools|
| 4. Simple-Show Counterexample Team     |    1 Team     | Identifies lower boundary of utility      |
| 5. Professional-Tool Comparator        | >= 2 Operators| Mandatory comparator frontier vs Ontime/  |
|    (Ontime / Shoflo / Rundown Studio)  | (Mandatory)   | Shoflo/dedicated broadcast event timers   |
+---------------------------------------------------------------------------------------------------+
```

1. **Standard Primary ICP Merchant Teams ($\ge 3$ Teams):**
   - *Requirement:* Standard recurring Vietnamese TikTok Shop merchant studio cells (1 Lead Operator + 1 Host) managing 8–25 SKUs with active promotion anchors.
   - *Purpose:* Forms the core empirical majority to ensure findings reflect mainstream live commerce operations rather than outlier behavior.
2. **At Least 1 Advanced Spreadsheet Power-User ($n \ge 1$ Operator):**
   - *Requirement:* An operator who routinely authors complex Google Sheets models with dynamic formulas (`INDEX/MATCH`, `TIME`, `ARRAYFORMULA`), conditional formatting, and keyboard shortcuts (`Ctrl+Shift+;`).
   - *Purpose:* Ensures that the Google Sheets baseline is evaluated at peak human proficiency, guaranteeing that LiveLift's observed advantages do not stem from testing against spreadsheet novices.
3. **At Least 1 Skeptical / Anti-Screen Operator ($n \ge 1$ Operator):**
   - *Requirement:* An operator who is vocally skeptical of adopting new software, prefers simple physical whiteboards or minimal chat, and resists adding "yet another browser tab" to their broadcast console.
   - *Purpose:* Rigorously evaluates cognitive capture burden, setup friction, and whether LiveLift genuinely reduces operational anxiety.
4. **1 Simple-Show Counterexample Team ($n = 1$ Team):**
   - *Requirement:* A team running low-complexity broadcasts (e.g., 3–4 products total, no flash deals, minimal timing constraints), admitted under the explicit Quota 4 Exception Clause.
   - *Purpose:* Establishes the lower threshold of product utility, proving where LiveLift is unnecessary and where Google Sheets or simple Zalo chat remains the superior, more efficient choice.
5. **Required Professional-Tool Comparator Operators ($n \ge 2$ Operators):**
   - *Classification:* **Mandatory Comparator Benchmark.** Prerequisite requirement for Gate G0 clearance.
   - *Requirement:* At least 2 operators who routinely operate configured professional broadcast rundown tools (**Ontime, Shoflo, or Rundown Studio**) or dedicated broadcast automation setups.
   - *Purpose:* Rigorously tests LiveLift against dedicated professional timing tools to establish whether LiveLift provides unique commerce-specific value (dynamic anchor deficit calculations, inventory stockout cuts, Next LIVE cloning) beyond general-purpose event timer software.
6. **Native Vietnam Account Walkthrough, Opsique Comparator & Telemetry Record:**
   - *Prerequisite:* Prior to laboratory trials, researchers must conduct a detailed walkthrough of an authentic native Vietnamese TikTok Shop Seller Center console (verifying product showcase pinning flows, voucher setup, and real console latencies).
   - *Opsique Product Comparator & Native Telemetry Record:*
     * *Opsique Product Comparator:* Researchers must evaluate Opsique as a commercial workflow comparator if accessible, recording comparative benchmark findings in the Gate G0 ledger. If Opsique is inaccessible as a commercial workflow comparator, its inaccessibility must be formally documented as an explicit comparator uncertainty in the Gate G0 ledger (cannot be satisfied merely by citing missing API telemetry).
     * *Native Platform Telemetry:* Inaccessible real-time Seller Center or Opsique internal telemetry/APIs must be formally documented as an explicit technical uncertainty rather than assumed to be accessible via private APIs.

---

## 5. Screening Questionnaire & Qualification Rubric

The following 8-question diagnostic screener must be administered to prospective teams during recruitment:

### 5.1 Screener Questionnaire

```markdown
### LiveLift V3 Recruitment Screener (VN / EN)

Q1: [Cadence] How many commercial livestream sessions does your team run per week?
    [ ] A. Less than 1 session per week
    [ ] B. 1 to 2 sessions per week
    [ ] C. 3 to 5 sessions per week
    [ ] D. 6 or more sessions per week

Q2: [Team Structure] What is your staffing structure during a live broadcast?
    [ ] A. Solo host only (I handle camera, selling, and product pins myself)
    [ ] B. Host + 1 dedicated Operator/Producer behind the console
    [ ] C. Host + Operator + Assistant/Tech crew (3+ people)

Q3: [Catalog Depth] On average, how many distinct SKUs do you showcase in a single live show?
    [ ] A. 1 to 4 SKUs
    [ ] B. 5 to 10 SKUs
    [ ] C. 11 to 25 SKUs
    [ ] D. More than 25 SKUs

Q4: [Promotions] Do you regularly schedule time-locked promotional events during your live shows (e.g., Flash Deals, Giờ vàng giá sốc, platform vouchers, sponsored drops)?
    [ ] A. No, all prices and vouchers remain constant throughout the stream
    [ ] B. Occasionally, but not tied to specific clock times
    [ ] C. Yes, we have fixed wall-clock promotion windows that must go live at exact times

Q5: [Current Tool Stack] What tools do you currently use to plan, pace, and manage your live rundowns? (Select all that apply)
    [ ] A. Memory / Mental notes
    [ ] B. Printed paper runbooks / Whiteboards
    [ ] C. Google Sheets / Excel
    [ ] D. Zalo / Telegram / Discord group chat
    [ ] E. Professional rundown software (Ontime, Shoflo, Rundown Studio, etc.)
    [ ] F. Specialized live commerce SaaS

Q6: [Spreadsheet Skill] (For Operators) How would you describe your proficiency with Google Sheets / Excel?
    [ ] A. Basic (viewing, simple text entry)
    [ ] B. Intermediate (basic formulas like SUM, simple formatting)
    [ ] C. Advanced (cascading formulas, TIME/NOW, conditional formatting, shortcuts)

Q7: [Operational Pain] When a live pitch runs long ("cháy giáo án"), what is the biggest challenge your team experiences?
    [ ] A. No challenge; we simply extend the broadcast indefinitely
    [ ] B. Calculating which upcoming products to cut or shorten under time pressure
    [ ] C. Missing scheduled flash deal windows or confusing the host with frantic messages
    [ ] D. Reconciling actual durations and brand proof-of-performance after the broadcast

Q8: [Post-Show Workflow] How long does it typically take your team to audit actual show timing and prepare the rundown for the next broadcast?
    [ ] A. Less than 5 minutes / We don't track it
    [ ] B. 10 to 20 minutes
    [ ] C. 30 to 60+ minutes
```

---

### 5.2 Qualification & Scoring Rubric

Each candidate team is scored against the following evaluation matrix:

| Criterion | Disqualification Threshold (`DISQUALIFIED`) | Acceptable Threshold (`ELIGIBLE`) | Priority Target (`PRIORITY`) |
|---|---|---|---|
| **Q1: Cadence** | Choice A ($<1$ show/week) | Choice B ($1\text{--}2$ shows/week) | Choice C or D ($\ge 3$ shows/week) |
| **Q2: Team Structure** | Choice A (Solo host without operator) | Choice B or C (Dedicated Operator + Host) | Choice B or C with defined roles |
| **Q3: Catalog Depth** | Choice A ($<5$ SKUs) — *ELIGIBLE (Simple-Show Quota only)* | Choice B ($5\text{--}10$ SKUs) | Choice C ($11\text{--}25$ SKUs) |
| **Q4: Hard Promotions** | Choice A (No promotional variation) — *ELIGIBLE (Simple-Show Quota only)* | Choice B (Occasional, floating) | Choice C (Fixed wall-clock promotion anchors) |
| **Q5: Current Tools** | Choice A only (Memory only) | Choice B, C, D (Paper, Sheets, Zalo) | Choice C + D (Google Sheets + Zalo) |
| **Q6: Sheet Skill** | N/A | Choice A or B | Choice C (Meets Power-User quota) |
| **Q7: Operational Pain**| Choice A (No timing sensitivity) — *ELIGIBLE (Simple-Show Quota only)* | Choice B, C, or D acknowledged | Choice B AND C acknowledged |
| **Q8: Post-Show Time** | Choice A (No post-show auditing) | Choice B ($10\text{--}20$ min) | Choice C ($30\text{--}60+$ min) |

#### Exception for Quota 4 (Simple-Show Counterexample)
> **Explicit Quota 4 Exception Clause:** A candidate selecting Choice A on Q3 (Catalog Depth $<5$ SKUs), Q4 (No promotional variation), or Q7 (No timing sensitivity) is **ELIGIBLE exclusively for the Simple-Show Counterexample slot** (target: $n = 1$ team), provided they operate a commercial live stream with a dedicated behind-the-console operator and on-camera host (Choice B or C on Q2).

* **Final Disposition Rule:**
  - **DISQUALIFIED:** Any team selecting Choice A on Q1 (Cadence $<1$ show/week) or Q2 (Solo host without operator) is immediately disqualified. Teams selecting Choice A on Q3, Q4, or Q7 are disqualified from the primary cohort, **unless** evaluated and admitted under the explicit Quota 4 Exception Clause (Simple-Show Counterexample).
  - **ELIGIBLE:** Teams meeting all acceptable thresholds across Q1–Q8 (or admitted under the Quota 4 Exception Clause).
  - **SELECTED COHORT:** Final selection of 6 to 10 teams must satisfy the diversity quotas in Section 4.3, ensuring standard primary ICP merchant teams form the core majority ($\ge 3$ teams).

---

## 6. Role-Separation Guardrail: Operator Desk vs Host View

A critical architectural and methodological requirement of LiveLift V3 is the **complete decoupling of the Operator Desk (P0) from the Host View (P0.5)**:

```
+---------------------------------------------------------------------------------------------------+
|                                  INDEPENDENT EVALUATION GATES                                     |
+---------------------------------------------------------------------------------------------------+
|  [ OPERATOR DESK P0 GATE ]                                 [ HOST VIEW P0.5 GATE ]                |
|  - Measured across n_op >= 3                               - Measured across n_host >= 3          |
|  - Metrics: Detection latency, recovery speed,             - Metrics: Message count reduction,    |
|    PVA accuracy, clone time, operator workload               comprehension latency, speech flow   |
|  - OUTCOME: Governs Phase 1 Core Desk Build                - OUTCOME: Governs Host Screen Feature |
+---------------------------------------------------------------------------------------------------+
```

### 6.1 Rationale for Decoupled Governance
1. **Host View is an Additive Wedge, Not the Foundation:** The core value proposition of LiveLift resides in the Operator Desk—detecting schedule deficits, computing constraint-aware recoveries, and reconciling actual execution.
2. **Asymmetric Failure Risk:** If the Host View screen introduces visual distraction, induces teleprompter gaze, or fails to reduce message volume, **the Host View feature must be killed or deferred**, but the core Operator Desk must survive if its primary metrics pass.
3. **Independent Kill Gate:**
   - If Host View achieves $<30\%$ message reduction or $>20\%$ host speech stumbles, **Host View is killed (Decision: PIVOT TO DESK-ONLY)**.
   - The Operator Desk evaluation is scored independently; host dissatisfaction with a secondary tablet must not invalidate an operator desk that dramatically speeds up schedule recovery.

---

## 7. Participant Governance & Tracking Log

> [!IMPORTANT]
> **SYNTHETIC EXAMPLE — NOT PARTICIPANT DATA — ILLUSTRATIVE ROSTER TEMPLATE ONLY**
> The entries below are fictional illustrative examples demonstrating the schema, cohort balancing, and scheduling format. They do **not** represent real human participant enrollments, confirmed recruitments, or completed experimental sessions. No real participant recruitment or trial has occurred.

All recruited participants must be cataloged in the master validation registry using the standardized schema below:

| Participant ID | Team Key | Role | Cadence (Shows/Wk) | Typical SKU Count | Tool Stack | Cohort Sub-Type | Condition Sequence | Scheduled Date | Status |
|:---:|:---:|:---:|:---:|:---:|---|---|:---:|:---:|:---:|
| `P01-OP` | `TEAM-01` | Lead Operator | 4 | 18 | Sheets + Zalo | Power-User | $A \rightarrow B$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P01-HOST`| `TEAM-01` | Main Host | 4 | 18 | Whiteboard / Zalo| Standard Host | $A \rightarrow B$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P02-OP` | `TEAM-02` | Operator | 3 | 12 | Sheets + Telegram| Skeptical Operator| $B \rightarrow A$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P02-HOST`| `TEAM-02` | Main Host | 3 | 12 | Chat phone | Standard Host | $B \rightarrow A$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P03-OP` | `TEAM-03` | Studio Producer | 5 | 20 | Sheets + Zalo | Standard Merchant | $A \rightarrow B$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P03-HOST`| `TEAM-03` | Main Host | 5 | 20 | Tablet cue screen | Standard Host | $A \rightarrow B$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P04-OP` | `TEAM-04` | Producer | 3 | 15 | Sheets + Zalo | Standard Merchant | $B \rightarrow A$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P04-HOST`| `TEAM-04` | Host/KOC | 3 | 15 | IFB Earpiece | Standard Host | $B \rightarrow A$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P05-OP` | `TEAM-05` | Operator | 2 | 4 | Paper + Zalo | Simple-Show Case (Quota 4 Exc.) | $A \rightarrow B$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P05-HOST`| `TEAM-05` | Creator/Host | 2 | 4 | Self-paced | Standard Host | $A \rightarrow B$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P06-OP` | `TEAM-06` | Lead Operator | 4 | 16 | Ontime / Sheets | Professional Tool Comparator | $B \rightarrow A$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P06-HOST`| `TEAM-06` | Main Host | 4 | 16 | Tablet cue screen | Standard Host | $B \rightarrow A$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P07-OP` | `TEAM-07` | Broadcast Op | 5 | 22 | Shoflo / Sheets | Professional Tool Comparator | $A \rightarrow B$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |
| `P07-HOST`| `TEAM-07` | Main Host | 5 | 22 | Studio Monitor | Standard Host | $A \rightarrow B$ | [ILLUSTRATIVE] | [SYNTHETIC EXAMPLE] |

---

## 8. Specification Sign-Off

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 1 | Validation Research Lead | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
