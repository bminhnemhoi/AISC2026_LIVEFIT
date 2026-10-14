# Feature priority scorecard

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

Scores are judgmental 0–5 as of 2026-10-05. High novelty/value/feasibility/demo/long-term are benefits; high TikTok overlap and competitor saturation are burdens. “Novelty” is useful specialization/combination, not first-in-world proof. Priorities are qualitative: value and feasible data precede demo appeal. BUILD NOW describes a validated P0 implementation order, not authorization to implement product code in this research task.

| Feature | Novelty | User value | Feasibility | TikTok overlap | Competitor saturation | Demo value | Long-term value | Priority | Reason / guard |
|---|---|---|---|---|---|---|---|---|---|
| Manual Product Pack / snapshot | 1 | 3 | 5 | 4 | 4 | 3 | 3 | BUILD NOW | Small input to the show; no PIM |
| Timed Run of Show | 2 | 5 | 4 | 1 | 5 | 5 | 5 | BUILD NOW | Subject to validated operator need |
| Hard promotion anchors / minimums | 2 | 5 | 4 | 1 | 4 | 5 | 5 | BUILD NOW | Explicit constraint and deadline, not scheduler invention |
| Dynamic downstream projection | 2 | 5 | 4 | 1 | 5 | 5 | 5 | VALIDATE | Core hypothesis; smallest robust implementation after validation |
| Operator recovery commands | 2 | 5 | 4 | 2 | 4 | 5 | 5 | BUILD NOW | Confirm feasible choices; no autopilot |
| NOW / NEXT / concise WHY | 1 | 4 | 5 | 3 | 5 | 5 | 4 | BUILD NOW | Commodity presentation of useful state |
| Product coverage / skips | 2 | 4 | 5 | 3 | 3 | 4 | 4 | BUILD NOW | Only required vs optional show coverage |
| Plan-vs-actual timeline | 2 | 5 | 4 | 2 | 4 | 5 | 5 | BUILD NOW | Actual events must be real records |
| Selected-change next-show clone | 3 | 5 | 4 | 2 | 3 | 5 | 5 | BUILD NOW | No decorative unchanged clone |
| Deterministic whole-show simulator | 2 | 4 | 4 | 3 | 4 | 5 | 4 | BUILD NOW | Thin domain scenario, no AI audience |
| Host View | 1 | 4 | 5 | 3 | 5 | 5 | 4 | VALIDATE | P0.5, tablets/monitor before feature-heavy phone app |
| Minimal action report / correction | 2 | 4 | 4 | 3 | 3 | 4 | 4 | BUILD NOW | Minimal report, source provenance mostly internal |
| Cross-session duration rules | 3 | 4 | 4 | 3 | 3 | 4 | 5 | BUILD SOON | Require comparable actual observations and selection |
| Handoff summary | 2 | 3 | 4 | 3 | 4 | 3 | 4 | BUILD SOON | One room and clear authority first |
| Official catalog/session binding | 1 | 3 | 3 | 5 | 4 | 3 | 4 | BUILD SOON | Only if approved VN entitlement; optional gate |
| Official post-LIVE enrichment | 1 | 3 | 3 | 5 | 5 | 3 | 4 | BUILD SOON | No core GMV dashboard; sparse source overlays |
| Full semantic known-then replay | 3 | 3 | 3 | 2 | 3 | 4 | 4 | DEFER | Minimal event review now; advanced audit when demanded |
| Full evidence center / score badges | 1 | 1 | 4 | 2 | 3 | 2 | 2 | REMOVE | Keep invariants internally; avoid ritual UI |
| Native broadcast/video/OBS controller | 0 | 1 | 1 | 5 | 5 | 2 | 1 | REMOVE | Keep broadcast tools |
| Unified chat / comment moderation | 0 | 2 | 1 | 5 | 5 | 3 | 2 | REMOVE | No official LIVE text stream established |
| GMV/traffic/viewer BI clone | 0 | 2 | 2 | 5 | 5 | 3 | 2 | REMOVE | Platform and intelligence vendors already strong |
| Generic AI script/diagnosis/ranking | 0 | 2 | 3 | 5 | 5 | 4 | 2 | REMOVE | TikTok overlap; no demonstrated advantage |
| Automatic TikTok pin / promo execution | 1 | 4 | 0 | 5 | 4 | 5 | 2 | REMOVE | Unsupported room-control contract; reject dependency |
| AI host practice clone | 0 | 2 | 2 | 5 | 4 | 4 | 2 | REMOVE | Native AI practice exists |
| Causal switchbacks / bandits | 2 | 3 | 2 | 2 | 4 | 4 | 4 | DEFER | Research value; prerequisites and user demand absent |
| Agency multi-room staffing | 1 | 4 | 2 | 3 | 4 | 4 | 5 | DEFER | Single-room retention first |
| Second-platform connector | 1 | 3 | 2 | 1 | 4 | 4 | 4 | DEFER | Portability remains manual until actual demand |
| Provider abstraction framework | 1 | 2 | 3 | 1 | 4 | 2 | 3 | DEFER | Use explicit identities/source fields now; no speculative factory |

A core feature marked VALIDATE does not justify building a broad product before the test. Dynamic timing can be exercised using a controlled prototype or Wizard-of-Oz scenario first; production correctness follows the validation gate. BUILD SOON integration remains conditional on entitlement and an actual enrichment need.

Scores are not a ranked backlog of dozens of micro-phases. Group BUILD NOW into one usable manual checkpoint, BUILD SOON into a repeat-team checkpoint, and production obligations into the final major phase. REMOVE means remove from the active scope/navigation/claims when later authorized, not delete archival research code now.
