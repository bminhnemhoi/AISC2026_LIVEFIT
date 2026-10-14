# P0 specification — smallest useful manual product

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

## P0 outcome and boundary

An operator can prepare one timed commerce show, recognize an impending deadline miss, deliberately recover, review actual execution and create a coherently changed next show. It works **without TikTok API, unofficial scraping, automatic pinning or AI**, and can be rehearsed without internet access. Native TikTok controls remain the place where promotions/products are actually executed.

This is a specification, not a working implementation. The current frontend is a UI/fixture prototype. User validation precedes the backend build.

## In scope

1. Create a manual or unmistakably simulated session with stable ID, local date/timezone and planned start.
2. Prepare a small product snapshot from manual fields or a validated basic CSV: identifier/name, reference price/currency if supplied, short selling points and required/optional coverage. Missing stock/price stays missing.
3. Build ordered segments with planned duration, minimum duration, optional/compressible flags, product reference, fixed wall-clock anchor where needed, and short cues. A promotion **cue** can be zero-duration and parallel; a promotion **segment** consumes host time. Do not confuse them.
4. Start/end/advance segments; extend target, shorten remaining time, skip/reorder eligible pending segments; record a brief external-action report or correction. One designated operator is runtime authority.
5. Show current segment, elapsed/target, remaining estimate uncertainty, next executable segment/projected start, nearest important anchor and a concise recovery reason.
6. Persist baseline, plan changes and actual transitions; Review answers timings, skips, late/missed cues and selected change rationale.
7. Select concrete changes and clone a new plan after constraint validation. New session/segment IDs and empty actual/evidence state; products remain snapshots, not live stock authority.
8. Deterministic rehearsal using the same domain rules, a virtual clock and scripted disturbances. Simulator is isolated from real operational history.

**P0.5 — VALIDATE:** private read-only Host View. It is not required to prove the manual P0 loop.

## Minimal domain

| Entity | Required meaning |
|---|---|
| Session | ID, workspace/local ownership, mode, lifecycle, time zone, planned start, actual start/end; optional provider binding separate. |
| ProductSnapshot | Show-selected product facts and source/as-of; referenced across that show's segments. |
| PlanVersion | Immutable baseline locked at start plus later explicit edits; comparison never loses original commitment. |
| Segment | Ordered ID, kind, duration, minimum, optional/compressible, required coverage, optional fixed start; selling/cue notes. |
| Cue | Planned time/segment relation, urgency, optional external action; separate actual report. |
| RuntimeState | Authoritative current segment, statuses, observed boundaries, forecast inputs, revision. |
| CommandReceipt | Unique command key, target, actor, expected revision, outcome and committed revision; duplicate returns same outcome. |
| SessionEvent | Session-scoped ordered record with occurrence/recorded time, actor/source and immutable correction relation. |
| NextPlanPatch | Explicit selected field/order changes and reason, validation result, new-plan diff. |

Do not introduce a general provider/plugin factory, event bus, ML pipeline or a separate queue competing with the rundown. The rundown is the execution order; segment-level coverage derives from it.

## Timing rules

All execution elapsed time uses a reliable elapsed clock; anchor comparison uses server wall-clock instants derived from the saved time zone. In Phase 1 the single local device is authority and persists its own commands; in Phase 2 browser timers render server state and never become a competing authority. Simulation uses a virtual clock for both. Session times spanning midnight remain dated instants. Record time corrections explicitly if clock alignment is uncertain.

The baseline is immutable after start. Extending a target or editing an anchor creates a current plan change and forecast; it never retroactively claims the original plan was different.

For an ordered single-host show:

- Completed segment boundaries use recorded actual times. Their variance is actual duration minus baseline duration. Skipped segments have no performed interval.
- The active segment has elapsed `now - actual_start`. Its projected end is `now + explicit_remaining_estimate`. A non-negative remaining estimate may come from target minus elapsed until the target is exceeded; after that, request an estimate or show **end unknown; earliest possible end = now**. Do not use zero remaining as a confident promise that an overrunning pitch ends now.
- Initialize the future cursor to projected active end or session start. For each pending floating segment, projected start is cursor (or a declared earliest-start constraint), projected end adds current allocated duration, then cursor advances.
- A hard anchor retains its committed time. Its earliest feasible start is `max(cursor, anchor_time)`; deficit is `max(0, cursor - anchor_time)`. If cursor arrives early, show a buffer/wait rather than pulling the anchor forward. If cursor arrives late, show missed/at-risk; do not silently shift the committed anchor.
- When no remaining estimate exists, show lower-bound projections plus uncertainty; a definite risk is distinguishable from a possible risk. Never label an infeasible schedule as safe because the unknown was treated as zero.
- Process each anchor boundary independently. A recovery that protects one anchor must be checked against every later anchor and required product/closing constraint.
- A zero-duration promotion cue can occur while a product segment continues if explicitly configured; a full host announcement segment cannot overlap other single-host segments.

A linear pass is sufficient for ordinary shows. This is established scheduling arithmetic, not a novel optimization algorithm. P0 recommends transparent candidates and recalculates them; no unconstrained global optimization or autoexecution is needed.

## Recovery policy

| Candidate | Eligibility / effect | Operator presentation |
|---|---|---|
| Consume buffer | Unallocated wait time before an anchor can absorb delay | “3m buffer available; 1m deficit remains.” |
| Shorten | Only compressible remaining allocation above a declared minimum | Show minutes saved, affected segments and required minimum. |
| Close current now | Human chooses to end current segment; preserve coverage status as actually completed/partial | “End Product A by 20:12; carry unfinished points after promotion.” |
| Skip | Optional pending segment; required product warning needs explicit acknowledgement | Show lost coverage and why anchor becomes feasible. |
| Reorder / pull forward | Eligible pending segments; no crossed dependency, executed history or hard anchor without explicit edit | Preview entire affected plan and all anchors. |
| Hold / wait | Early arrival or intentional delay | Countdown to anchor continues; broadcast clock never pauses. |
| Extend | Changes current target/forecast; cannot magically protect another anchor | Show the downstream cost before confirmation. |
| Re-anchor | Explicit human change to commitment, recorded as a new plan version | Original anchor remains visible in Review; no “recovered” label for changing history. |
| Cancel missed cue | Human decides promotion/announcement should not occur | Record missed/cancelled and reason; never relabel as performed. |

Prefer few clear feasible options. If none can protect a hard deadline within minimum/coverage rules, say **No feasible recovery under current constraints** and offer explicit commitment change or missed-cue handling. No AI recommendation is required.

## Required example: Product A overruns by four minutes

Baseline:

| Segment | Committed time | Planned duration | Constraint |
|---|---|---|---|
| Opening | 20:00 | 5m | Floating after show start |
| Product A | 20:05 | 7m | Floating; declared minimum applies |
| Giveaway announcement | 20:12 | 3m | Hard anchor, consumes host time |
| Product B | 20:15 | 8m | Floating after giveaway |

**At 20:09**, A's revised estimate says it will end **20:16**. Only three minutes remain to the giveaway; A needs seven. The forecast has a four-minute deficit. The committed giveaway time remains 20:12. NEXT remains Giveaway (the next executable segment); the anchor-risk cue receives urgency and WHY explains the deficit. No later floating segment before this anchor exists to shorten, so shortening B cannot rescue this already-upstream conflict.

The operator may close A at 20:12 and continue unfinished selling points later, with a documented coverage tradeoff. Then Giveaway stays 20:12–20:15 and B can still start 20:15. If A's declared minimum has not been met, the app warns that protecting the anchor requires a minimum/coverage exception or changing the commitment. It must not pretend every recovery is feasible.

**If A actually ends 20:16**, the original anchor is already missed by four minutes. The earliest full Giveaway segment is 20:16–20:19; B projects 20:19–20:27. The fixed anchor remains 20:12 in baseline/variance. A decision to shorten Giveaway can save future time only within its minimum; it cannot make its start on time. Canceling it could start B at 20:16. Re-anchoring is a new commitment, not retroactive success. Extending A further worsens downstream risk.

If the giveaway is configured as a **parallel zero-duration cue** instead of a full segment, it may fire at 20:12 without ending A, but that is a different explicitly planned scenario. LiveLift schedules the human cue; native execution still requires an operator action/report.

## Command and lifecycle contract

Prepare editing is allowed before start. Starting locks the baseline. Runtime commands require session/segment IDs, a current expected revision and idempotency key. A committed transition and its event/receipt are atomic; failures never appear as success. Duplicate delivery returns the committed result; stale revision requires resnapshot/review, not blind replay. An in-flight command shows pending until the authoritative receipt arrives.

Accepting a recovery suggestion is not itself proof a product was pinned or a promotion fired. A direct segment Start command can log the associated decision and transition in one operation; the UI need not force a separate acceptance click. External actions remain “operator reported” unless separately observed. Explicit action enums prevent `unpin` from matching `pin` through substring logic.

End freezes active execution. Review can append corrections/late evidence without reopening runtime or rewriting history. Reopen, if ever needed, is an explicit later decision; P0 does not silently permit mutations after end.

## Offline definition

No WAN is required for manual/local rehearsal. Phase 1 is a single-browser durable manual product with no shared-server claim. In Phase 2 a local authoritative backend and LAN can support a studio. Simulation can run locally with its clock; mode separation prevents fixture events entering real history. “Offline” does not mean two disconnected browsers independently control one real session.

For the server-backed phase, if the browser loses its authoritative server, show last-known state with clear age, block authoritative runtime commands and permit durable local note drafts. Reconnect fetches committed state; drafts require explicit reconciliation/confirmation and are not automatically replayed segment transitions. Local notes are not provider-confirmed actions. A host view shows stale state rather than pretending to continue receiving cues.

## Review and next-show learning

Compute timing/cue/coverage variance from actual records, with unrecorded boundaries marked incomplete. A single session can justify a selected manual change but not an automatic recurring pattern. For repeated durations, require at least three comparable **completed** occurrences, group by relevant product/segment/context, exclude skipped/censored/missing intervals, show sample count and spread, and propose a transparent statistic such as the median. No pitch-duration rule implies higher sales.

Examples: A often takes 9m rather than 6m; flash activation is repeatedly reported late; Q&A spills into closing; a product repeatedly goes unperformed. The operator selects changes. Changing A from 6m to 9m may break an anchor: clone validation must require compensating changes or disclose unresolved infeasibility.

## Acceptance and explicit exclusions

The P0 demonstration must survive browser reload (and server process restart in Phase 2), unknown session IDs, replayed commands, two conflicting operator requests, an overrun beyond every minimum, a missed anchor, ended-session mutation attempts, actual correction and a selected-change clone. Run the same core timing scenario with virtual time and the live manual clock; expected constraints/records must agree.

Exclude AI, scraping, auto pin, multi-room, generalized connectors, video/chat/GMV dashboards, a policy/violation engine and elaborate evidence scores. Accessibility basics, meaningful error handling and minimal access control for any external pilot are not optional exclusions.
