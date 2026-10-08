# Legacy Reuse Matrix v0.1

Legacy repository:
https://github.com/Towfienes/AISC2026_LIVEFIT

Rule:
The legacy repository is reference/evidence. LiveLift-next is a new product and new implementation.

## Reuse philosophy

Do not copy the application wholesale.

For every legacy artifact ask:
1. What failure/invariant did this solve?
2. Does the new product still have that problem?
3. Can the concept/test be transplanted without importing the old domain?
4. Is the old code tied to switchback experiments or obsolete UI?
5. Can we reimplement the invariant more cleanly?

## HIGH-VALUE LEGACY LESSONS

### Session lifecycle
Reference:
- src/livelift/api/routes/sessions.py
- tests/test_vong_doi_phien.py

Keep concepts:
- explicit lifecycle;
- server-owned session identity;
- invalid transitions fail closed;
- demo/real are not interchangeable;
- human-readable session naming;
- role-specific projections when needed.

Do not keep:
- switchback schedule as mandatory precondition;
- experimental-arm semantics in core session state.

### Action scoping
Reference:
- src/livelift/api/routes/actions.py
- tests/test_actions_scoping.py

Critical lesson:
A click/action must remain scoped to the exact product/session/decision the operator selected.

Legacy incident:
client card selection could drift from backend candidate set.

New invariant:
- every decision/action carries session_id;
- product/segment identity;
- decision_id;
- revision;
- actor;
- causation;
- idempotency key where relevant.

Stale selection must fail closed instead of silently acting on another item.

### Planned vs actual / decision vs exposure
Reference:
- actions.py comments and exposure_event design

Keep concept:
decision record and actual exposure/evidence are different things.

Adapt to:
- recommendation
- decision
- attempt
- operator report
- observation
- platform confirmation

Do not reuse old switchback-specific propensity/candidate semantics in MVP.

### Storage failure / graceful degradation
Reference:
- tests/test_kho_chet_giua_phien.py

Critical lessons:
- storage outage must be visible;
- 5xx/transient failure differs from programming bug;
- never silently continue automation while persistence is unavailable;
- never show empty/zero as if valid data;
- retry must not create duplicate side effects;
- durable recovery must preserve unknown state.

New product implication:
manual runtime may continue only when the operator can clearly see degraded persistence/source state and no unlogged automatic side effects occur.

### Simulator
Reference:
- src/livelift/sim/
- tests/test_sim_*.py
- demo seeding infrastructure

Keep concept:
a deterministic, clearly labeled simulator is valuable for demo, development, testing, and regression.

Do not copy:
the old switchback/statistical simulation domain.

Build new:
SimulatorProvider emitting normalized operational signals.

### TikTok fixtures
Reference:
- tests/data/tiktok_shop/

Keep:
response samples and error cases as research/test references.

Do not assume:
old endpoint versions, scopes, fields, or timing are current.

All official integrations must be rebuilt against current contracts.

### Replay
Reference:
- src/livelift/api/routes/replays.py
- web replay views/tests

Keep:
session-scoped replay and timeline reconstruction lessons.

Rebuild:
semantic replay around plan, runtime, recommendations, actions, evidence, gaps, and outcomes.

### PII / comment safety
Keep later:
PII filtering, raw-comment handling lessons, retention thinking.

Not MVP blocker:
comments are not required for manual-first core.

## REFERENCE ONLY

- Docker/Caddy patterns
- CI structure
- FastAPI robustness patterns
- PostgreSQL transaction patterns
- Playwright/browser tests
- error-message quality
- health endpoints
- API fixtures

Rebuild fresh and only pull ideas when needed.

## DO NOT TRANSPLANT

- current web UI/design system
- old homepage/navigation
- /chay-phien wizard structure
- /desk visual hierarchy
- /host legacy assumptions
- /ket-qua experimental framing
- migrations 0001–0009
- switchback engine as core product requirement
- randomization schedule
- old autopilot/pin semantics
- old provider compatibility hacks
- old Next.js/Tailwind versions by default
- Redis/TimescaleDB just because they existed

## Mandatory invariants carried into LiveLift-next

1. Missing measurement != zero.
2. Planned != actual.
3. Recommended != accepted.
4. Accepted != attempted.
5. Attempted != performed.
6. Operator-reported != platform-confirmed.
7. Unknown != failed.
8. Demo/simulated != real.
9. Wrong session/room/account fails closed.
10. Stale async data cannot mutate another/current session.
11. Historical replay preserves what was known at the time.
12. Provider data always carries source/provenance/freshness.
13. No provider is allowed to become the domain model.
14. No causal claim from correlation alone.
