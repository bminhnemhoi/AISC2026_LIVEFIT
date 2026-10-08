# LiveLift Strategic Research & Architecture Synthesis
## 04 — Evidence, Provenance & Semantic Replay Model

**Author:** Principal Systems Researcher & Technical Strategist  
**Date:** October 3, 2026  
**Core Domain:** Epistemology of Operational Truth in Live Commerce  
**Design Reference:** `.kombai/canvas/livelift_canonical_20261003_08_review.canvas`  

---

### 1. Conceptual Framework: Epistemic Distinctions in Live Operations

In high-stress livestream operations, information arrives from disparate actors with fundamentally different latency, authority, and reliability:
- A broadcast host says they are discussing a dress.
- An assistant operator clicks "Pin Dress" in LiveLift.
- The assistant tries to click the pin button in TikTok LIVE Studio on an iPad.
- A viewer in the chat comments "Why is the hoodie still pinned?"
- Two hours later, TikTok Shop Open API exports minute-level attributed product clicks.

Systems that collapse these disparate signals into a single mutable status column (e.g., `status = 'pinned'`) create operational chaos, audit failures, and false product claims.

LiveLift establishes an **append-only epistemic evidence model** that maintains strict, non-negotiable boundaries between intentions, human assertions, automated observations, and platform proofs.

```
+--------------------------------------------------------------------------------------------------+
|                                    THE EPISTEMIC LADDER                                          |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
| [1. INTENT]       Saved Run of Show Plan: "Segment 3 plans to present M03 Cargo Pants"           |
|         |                                                                                        |
|         v                                                                                        |
| [2. RECOMMEND]    Policy / Queue Output: "LiveLift NEXT recommends starting M03 Cargo Pants"     |
|         |                                                                                        |
|         v                                                                                        |
| [3. DECISION]     Operator Decision: "Operator accepted recommendation at 19:42:10"              |
|         |                                                                                        |
|         v                                                                                        |
| [4. ATTEMPT]      Operator Command Attempt: "Operator clicked native pin in TikTok Studio"       |
|         |                                                                                        |
|         v                                                                                        |
| [5. REPORT]       Human Assertion: "Operator reports M03 is currently presenting to viewers"     |
|         |                                                                                        |
|         v                                                                                        |
| [6. OBSERVATION]  External Sensor/Telemetry: "DOM observer noticed product card in web broadcast" |
|         |                                                                                        |
|         v                                                                                        |
| [7. VERIFICATION] Platform Confirmation: "Shopee API returns update_show_item success HTTP 200" |
|         |                                                                                        |
|         v                                                                                        |
| [8. LATE AUDIT]   Post-Live Platform Metric: "TikTok API minute-level performance per product"   |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

---

### 2. Rigorous Semantic Definitions Matrix

Every piece of operational evidence in LiveLift must answer the nine core questions defined below:

| Evidence Class | WHO Says It? | WHEN Observed? | WHEN Happened? | HOW Obtained? | HOW Fresh? | Trustworthiness | Target Scope | Supersedes Another? | Rewrites History? |
|---|---|---|---|---|---|---|---|---|---|
| **Action Intent** | Run of Show Plan | At plan save | Planned future | Pre-session editor | Fresh at plan revision | High (intent only) | `plan_id`, `segment_id` | Superseded by newer plan revision | **NEVER** |
| **Recommendation** | Recommendation Engine | Generation time | Generation time | Evaluated from ROS + Queue + Rules | Decays over 30–60s | Rule-dependent | `session_id`, `product_id` | Superseded by newer recommendation | **NEVER** |
| **Decision** | Lead Operator | Clicks Accept / Reject | Instantaneous | Explicit UI click with auth token | Immutable point in time | Authoritative human choice | `decision_id`, `session_id` | Cannot be undone, only followed by override | **NEVER** |
| **Attempt** | Lead / Assistant | Click time | Moment of execution | Dispatched command or manual button | Point in time | High (proof of human attempt) | `attempt_id`, `target_id` | Append-only record | **NEVER** |
| **Operator Report** | Human Operator | Submission time | Estimated by operator | Direct entry ("Presenting now", "Pinned") | Decays if not refreshed | Subjective human observation | `session_id`, `product_id` | Can be corrected by newer Report | **NEVER** |
| **Observation** | Adapter / Telemetry | Ingestion time | Platform timestamp | Ingested via API/Poller/DOM probe | Dependent on poller interval | Medium (subject to sensor lag) | `source_id`, `session_id` | Append-only observation stream | **NEVER** |
| **Platform Verification** | External Platform API | Response receipt | Platform execution | Authoritative cryptographic API response | Real-time | Highest for platform state | `platform_id`, `target_id` | Confirms postcondition of an attempt | **NEVER** |
| **Evidence Correction** | Human / Auditor | Correction time | Applies to prior record | Explicit UI correction flow | As-of correction time | High (explicit admission of error) | References original `evidence_id` | Annotates original record with link | **NEVER** |
| **Late Evidence** | Post-Live Analytics | Post-session fetch | During live broadcast | Batched API call (e.g. TikTok Shop API) | Static historical batch | Authoritative financial/click audit | `session_id`, minute intervals | Complements live data; never replaces | **NEVER** |

---

### 3. The Minimal Bitemporal Data Model

To support historical honesty without the immense overhead of generalized bitemporal SQL engines, LiveLift standardizes on a **four-timestamp minimal temporal model** attached to all evidence records:

```python
class EvidenceRecord(BaseModel):
    evidence_id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    runtime_generation: int
    evidence_class: EvidenceClass  # intent, decision, attempt, report, observation, verification, late_audit
    
    # --- TEMPORAL ATTRIBUTES ---
    occurred_at: datetime      # T_event: When the event supposedly happened in the real world
    observed_at: datetime      # T_observed: When the sensor/operator witnessed the event
    recorded_at: datetime      # T_system: When LiveLift's database committed the record (authoritative clock)
    effective_as_of: datetime  # T_valid: The operational window or validity start time
    
    # --- PROVENANCE & ATTRIBUTION ---
    source: str                # e.g., 'operator:user_123', 'adapter:tiktok_shop', 'poller:shopee'
    confidence: float          # 0.0 to 1.0 (1.0 for verified platform receipts; 0.7 for operator reports)
    provenance_hash: str       # Cryptographic hash or signature of raw payload
    
    # --- RECONCILIATION & CORRECTION ---
    supersedes_id: UUID | None = None  # Pointer to prior record if this is an explicit correction
    conflict_flag: bool = False        # True if contradictory evidence exists for this time window
    payload: dict[str, Any]            # Specific payload attributes
```

#### Meaning of Timestamps:
1. `occurred_at`: The physical time on the video stream or seller center.
2. `observed_at`: The moment the human eye or polling loop noticed the change.
3. `recorded_at`: Server-authoritative PostgreSQL timestamp (`clock_timestamp()`). This is the **immutable ordering key** for system causality.
4. `effective_as_of`: When the information became operationally actionable for decisions.

---

### 4. Dual-Perspective Semantic Replay

The primary deliverable of the REVIEW workspace is semantic operational replay. Review answers two fundamentally different questions:
1. **"What did the operator know when they made this decision during the LIVE?"** (Accountability & Operational Assessment)
2. **"What actually happened during the live broadcast, taking into account all subsequent audit data?"** (Business Truth & Learning)

LiveLift derives both perspectives from the identical underlying append-only event store using temporal projection filters.

```
                           +-------------------------------------------------------+
                           |           UNIFIED APPEND-ONLY EVIDENCE STORE          |
                           +-------------------------------------------------------+
                                           |                       |
                  Query: recorded_at <= T  |                       |  Query: occurred_at <= T
                                           v                       v
                   +-------------------------------+       +-------------------------------+
                   |    VIEW A: "AS KNOWN THEN"    |       |  VIEW B: "WITH LATER EVIDENCE"|
                   +-------------------------------+       +-------------------------------+
                   | * Omits late-arriving metrics |       | * Incorporates post-live data |
                   | * Shows operator visibility   |       | * Highlights late corrections |
                   | * Audits why decisions occurred|      | * Reconciles gaps and drift   |
                   +-------------------------------+       +-------------------------------+
```

#### 4.1 "AS KNOWN THEN" Projection Rule
For a user inspecting the replay at virtual playback time $T_{\text{replay}}$:
$$\mathcal{E}_{\text{known}}(T_{\text{replay}}) = \{ e \in \text{EvidenceStore} \mid e.\text{recorded\_at} \le T_{\text{replay}} \land e.\text{occurred\_at} \le T_{\text{replay}} \}$$
- **Invariant:** No record received after $T_{\text{replay}}$ can appear in this view.
- **Why this matters:** If TikTok Shop minute analytics arrive 2 hours after the stream ends, they are strictly excluded when scrubbing through minute 15 in "As Known Then." The UI displays the recommendation exactly as it was shown to the operator, with whatever data gaps or missing signals existed at that exact second.

#### 4.2 "WITH LATER EVIDENCE" Projection Rule
For a user inspecting the replay to evaluate product performance:
$$\mathcal{E}_{\text{later}}(T_{\text{replay}}) = \{ e \in \text{EvidenceStore} \mid e.\text{occurred\_at} \le T_{\text{replay}} \}$$
- Where $e.\text{recorded\_at} > T_{\text{live\_end}}$, the record is rendered with a distinct **Late-Arriving Badge** indicating arrival latency (e.g., `+2h 15m post-live`).
- If a late record contradicts an operator report (e.g., operator reported Dress M01 was presented, but platform product analytics indicate zero impressions and 500 impressions on Hoodie M02), the timeline renders a **Conflict Divergence Marker**. It does NOT overwrite the operator report; it displays both side by side.

---

### 5. Conflict Resolution and Supersession Protocols

1. **Corrections Are Additive:**  
   If an operator mistakenly clicks "Presenting M01" and 30 seconds later corrects it to "Presenting M02":
   - Record 1 (`report_id_1`): `target = 'M01'`, `occurred_at = 19:30:00`, `recorded_at = 19:30:05`.
   - Record 2 (`report_id_2`): `target = 'M02'`, `supersedes_id = 'report_id_1'`, `correction_reason = 'Wrong product selected'`, `occurred_at = 19:30:00`, `recorded_at = 19:30:35`.
   - In "As Known Then" between 19:30:05 and 19:30:35, M01 is shown as active. At 19:30:35, the correction takes effect.
2. **Missing vs Measured Zero:**  
   If engagement analytics for an interval were never received from TikTok, the metric state is `MISSING` (rendered as `—` with an "Unavailable" badge). It is **strictly prohibited** to render `0` views, `0` likes, or `0` GMV when no measurement took place.
3. **HTTP 200 $\ne$ Platform Confirmation:**  
   When LiveLift issues an API command to an external provider:
   - Receiving an HTTP 200 acknowledgment from the transport layer creates a `CommandTransportAcknowledged` event.
   - It does NOT create a `PlatformConfirmed` event until a subsequent query or webhook confirms that the product state actually changed on the platform broadcast.
