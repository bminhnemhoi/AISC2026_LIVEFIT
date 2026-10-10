# OPERATE — Operator Desk Spec v0.1

## Job to be done

"I am in the middle of a LIVE. Tell me what is happening now, what I should do next, why, and let me record what actually happened quickly."

## Five-second hierarchy

1. CURRENT LIVE
2. NOW
3. NEXT
4. WHY
5. PRIMARY ACTION

Everything else is secondary.

## NOW

NOW represents operational truth as currently known.

Minimum:
- current segment
- current product if operator reported one
- elapsed time
- actual start time
- runtime status

Do not merge product states.

Keep conceptually separate:
- presenting_product: operator-reported/current segment
- pinned_product: confirmed / observed / unknown
- recommended_product: LiveLift policy output

## NEXT

NEXT is a recommendation or planned next segment.

It must include:
- action/product/segment
- short reason
- deadline / due context when relevant
- evidence availability
- missing input when relevant

Example:

NEXT
M03 Cargo Pants

WHY
- next in Run of Show
- not presented yet
- high priority

Missing
- TikTok live engagement unavailable

## WHY

WHY must be inspectable and short.

Evidence should point to records/rules, not an LLM-generated story.

Initial recommendation sources:
- experiment requirement if enabled later;
- ROS due item;
- manual objective;
- priority;
- coverage;
- time since last shown;
- operator constraints;
- available validated signals.

## Primary actions

Depending on context:
- Accept
- Reject
- Start next
- Skip
- Extend
- Hold

If operator performs a TikTok action manually:
- Mark attempted
- Mark performed

Never display "TikTok confirmed" unless an authoritative source confirms the postcondition.

## Action semantics

Decision:
proposed
accepted
rejected
overridden

Execution:
not_attempted
attempted
operator_reported

Evidence:
observed
platform_confirmed
failed
unknown

These are related but must not be collapsed into one linear status.

## Secondary panels

### Run of Show
Compact.
Current item highlighted.
Past actual state visible.
Future plan visible.

### Queue
Products/segments that can be pulled forward.

### Live Pulse
Only available signals with source + freshness.

Missing metric:
"Not available"

Never:
0

unless zero is a measured value.

### Product coverage
Safe states:
- Not shown
- Shown once
- Shown multiple times
- Recently shown
- Disabled
- High priority

Avoid:
HOT
TRENDING
WEAK

without sufficient evidence.

### Source health
Show capability health, not engineering jargon:
- Connected
- Delayed
- Unavailable
- Manual

## Failure behavior

Provider outage:
- core runtime continues;
- NOW/NEXT falls back to plan/manual inputs;
- dependent rules disable;
- UI marks missing/stale.

Wrong room/account:
- quarantine data;
- never attach by username guess alone.

Reconnect:
- resync by revision/snapshot;
- old event must not trigger a new live action.

## Simulator

SimulatorProvider may emit:
- viewer trend changes
- comment activity
- product interest
- provider outage
- stale signal
- delayed outcome

Every simulated signal must carry:
source = simulator
evidence_class = simulated

Simulator events test product behavior, not TikTok integration claims.
