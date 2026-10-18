# Serious product options and ranked combination strategy

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

## Scoring method

All scores are **research judgments, 0–5**, not measurements or validated demand. Pain, novelty, feasibility, day-1/demo/long-term/moat potential are benefits (5 high). TikTok/competitor overlap, API dependency, build cost and risk are burdens (5 high). A transparent qualitative ranking is preferable to hiding ordinal judgments inside a pseudo-precise weighted sum. Rank considers dependency on prior operational records and delivery scope. Rank G is a fallback, not a competing broad-product bet.

| ID / direction | User pain | Novelty | TikTok overlap | Competitor overlap | Technical feasibility | API dependency | Day-1 value | Demo value | Long-term potential | Moat potential | Build cost | Risk | Rank / choice |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A — Commerce Run-of-Show & Operations Desk | 5 | 3 | 2 | 4 | 5 | 1 | 4 | 5 | 4 | 2 | 3 | 3 | 1 — primary wedge; validate against configured rundown |
| B — Host/Operator Coordination System | 4 | 2 | 3 | 4 | 5 | 1 | 4 | 4 | 3 | 1 | 2 | 3 | 3 — small layer on A; not standalone business yet |
| C — Operational Learning / Next-Show Planner | 4 | 3 | 3 | 3 | 4 | 1 | 2 | 4 | 5 | 3 | 3 | 3 | 2 — retention layer on A; cannot start with no records |
| D — Agency Multi-Room Operations Platform | 4 | 2 | 3 | 4 | 3 | 3 | 2 | 4 | 5 | 3 | 5 | 5 | 4 — future segment, too much first build |
| E — Cross-Platform Commerce OS | 3 | 2 | 2 | 4 | 2 | 5 | 1 | 4 | 5 | 3 | 5 | 5 | 6 — broad scope; architectural preparation only |
| F — Experimentation & Optimization System | 3 | 2 | 2 | 4 | 2 | 4 | 1 | 4 | 4 | 3 | 5 | 5 | 5 — preserve scientific branch; defer commercial wedge |
| G — Native/Existing-Rundown Commerce Template + Review Companion | 3 | 1 | 2 | 3 | 5 | 1 | 4 | 3 | 3 | 1 | 1 | 2 | Fallback — cheapest response if a full desk cannot beat substitutes |


## What each direction would actually sell

| Direction | Buyer/job | Serious advantage | Failure mode |
|---|---|---|---|
| A | Operator/team lead executing recurring shows | Timing and recovery with an operational record | Adds logging effort; generic rundown/ Opsique already sufficient. |
| B | Host + assistant eliminating cue confusion | Glanceable synchronized private cue | Native script or Zalo already enough; host attention cost. |
| C | Lead planning tomorrow from repeated execution | Approved recurring timing adjustments, not sales causality | Sparse/noisy records; users just clone unchanged sheets. |
| D | Agency lead managing staffed rooms | Standards, shifts, handoffs, reusable training | Calendar/permissions/multi-room expands before single-room retention. |
| E | Merchant operating several channels | Portable manual operating method | Connector rights vary; control becomes a lowest-common-denominator promise. |
| F | Research/large operations team testing policies | Controlled learning with valid assignment and evidence | Insufficient power, interference/carryover, instrumentation and uninterested users. |
| G | Team already happy with a rundown tool | Minimal commerce template + operational review | Smaller business/novelty; may nevertheless be the correct cheapest product. |

## Recommended combination

**Primary wedge:** A, timed commerce execution and recovery.

**Differentiation to validate:** constraint-aware pacing plus optional B private host cues. B is P0.5, conditional on host comprehension and fewer cue messages.

**Retention:** thin C operational learning. P0 already includes selected changes to a new plan; repeated-history rules mature in P1.

**Trust:** reuse the repository's separation of plan/actual/report/observation and timestamps internally. Do not sell a twelve-state evidence panel to every operator.

**Enrichment:** official TikTok catalog/session/post-LIVE analytics only when credentials and granularity are verified. They are context, not authority over the show clock.

**Future:** D first if repeated single-room agency use appears; E only when actual customers operate a second platform. F remains a separately gated research track.

## Why the combination is stronger than its parts

Timing alone is commodity; Host View alone is commodity; generic post-LIVE recommendations overlap TikTok. The connected loop may remove recurring reconstruction/planning effort, making session history useful rather than a passive archive. That value is specific and measurable. Opsique's overlap means the combination cannot carry a first-in-market claim. The initial defensible question is whether this implementation suits underserved VN recurring teams at lower operating burden.

## Strategic stop rule

Do not build all seven directions. If A fails the paired baseline, choose G only with a specific demonstrated missing job; otherwise stop. If A works but C does not, keep a simple execution product. If B harms hosts, remove B without killing A. If official API access fails, the manual wedge is unchanged; the enriched offer is unavailable.
