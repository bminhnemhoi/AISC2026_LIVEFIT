# REVIEW — Semantic Replay & Learning Spec v0.1

## Job to be done

"The LIVE is over. Help me understand what we planned, what actually happened, what is still uncertain, and what is worth carrying into the next LIVE."

## Semantic Replay

Replay is not a video player first.

The primary replay is an operational timeline.

Each timeline item may represent:
- segment planned
- segment actual start/end
- recommendation exposed
- operator accepted/rejected/overrode
- action attempt
- operator-reported performed
- provider observation
- platform confirmation
- failure
- data gap
- metric/outcome arrival
- note
- hypothesis

## Preserve history

Replay must be able to reconstruct:

AS KNOWN AT THE TIME

Late analytics can be appended later, but must not rewrite what the operator knew during the LIVE.

Policy/model version must be recorded for historical decisions.

## Planned vs actual

Show both:
- planned start/duration/order
- actual start/end/order

Changing the plan mid-session must not rewrite past actual history.

## Evidence language

Correct:
- "Operator reported M03 was pinned"
- "Provider X observed M03"
- "TikTok Shop confirmed X"
- "Verification unavailable"

Incorrect:
- "M03 was definitely pinned"
when only an operator button was pressed.

## Outcomes

Outcomes can be:
- pending
- provisional
- final
- unavailable

Each outcome needs:
- source
- definition/version
- relevant time window
- as-of timestamp

Never average incompatible GMV definitions.

## Learn

Learning objects:

### Observation
What happened?

### Insight
What pattern did we notice?

### Hypothesis
What should we test next?

Example:

Observation:
M03 segment was extended by 2 minutes because viewers asked about sizing.

Insight:
Sizing questions repeatedly appeared during M03.

Hypothesis:
Show the size chart earlier during M03 in the next comparable LIVE.

No claim:
"Showing size chart earlier increases GMV"
until a defensible experiment supports it.

## Next LIVE

Allow:
- clone Product Pack
- clone ROS
- select lessons to carry forward
- record change note

Never mutate the completed session to make the next plan.
