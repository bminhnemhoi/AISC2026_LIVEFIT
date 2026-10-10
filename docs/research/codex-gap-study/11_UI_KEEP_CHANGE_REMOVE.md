# Current UI and information architecture audit

Research date: **2026-10-05**. Repository: `rebuild/livelift-next`. This is research and a proposed product strategy, not implementation or proof of market demand. The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md) governs future work; these reports supply evidence.

This is a scope audit of legacy `web` and current `next`, not a pixel-level usability study. No product files were changed. Functional evidence and fixture defects are in [report 01](01_REPO_FEATURE_AUDIT.md).

| Surface | Decision | Target behavior | Reason / limit |
|---|---|---|---|
| HOME | MODIFY | One active/upcoming show, create/continue, last review and explicit simulator entry | Do not center disconnected metric/feature cards. |
| CREATE LIVE | KEEP / STRENGTHEN | Title, date/timezone, manual environment, pack and template | No TikTok login/experiment requirement; exact route identity. |
| PREPARE | STRENGTHEN | Product snapshot + compact timed ROS + promotion anchors + readiness | Not a PIM, script writer or elaborate compliance checklist. |
| OPERATE | STRENGTHEN | NOW/NEXT, timer/anchor risk, one recovery reason, command controls | Native platform remains open for actions; no duplicate broadcast or analytics console. |
| WRAP | MERGE | End/freeze and brief missing-report check inside Operate → Review transition | Do not force a separate process-heavy page. |
| REVIEW | STRENGTHEN | Plan vs Actual, timing/cue/product variance, corrections, selected next-plan changes | No GMV dashboard/replay clone; link native analysis. |
| LEARN | MERGE | Operational observations and selected changes inside Review; recurring patterns after enough comparable history | No separate mandatory learning-object workflow. |
| SESSIONS | KEEP / SIMPLIFY | Real/simulated filter, lifecycle, last operation, next-show link | Do not present fixture history as production record. |
| PRODUCTS | DEMOTE | Reusable input/import surface reached from Prepare | Only metadata needed for shows; avoid inventory/catalog system. |
| INTEGRATIONS | DEMOTE | Settings/status for optional authorized enrichment | Not a P0 onboarding blocker; remove pretend connections. |
| SIMULATOR | KEEP / STRENGTHEN | Clearly labeled deterministic rehearsal entered from Home | Current engine is incomplete, not a dedicated verified scenario UI. |
| HOST VIEW | VALIDATE → STRENGTHEN if passed | Private read-only projection, large current/next/time and short cue | P0.5; no second operator console or full text dump. |


## Component decisions

| Component | Decision | Meaning |
|---|---|---|
| Product Pack | KEEP / SIMPLIFY | Show-selected snapshot, not live authoritative stock/price or replacement native Product Sets. |
| Run of Show | STRENGTHEN | First-class timing/anchor/coverage constraints and actual transitions. |
| NOW | KEEP | Current segment/product, target time and elapsed/remaining uncertainty. |
| NEXT | STRENGTHEN | Next executable segment plus projected start; urgent cue is separate from next segment. |
| WHY | MODIFY | One explainable constraint reason, e.g. “4m needed; 3m remain before 20:12.” |
| ACTION | MODIFY | Specific operator command; suggestion acceptance and native action report have distinct meaning. |
| Queue | MERGE | Upcoming rundown order; remove a second mutable competing queue. |
| Coverage | KEEP / SIMPLIFY | Required/optional products and skipped/follow-up items; not a new analytics panel. |
| Pulse | DEMOTE | Tiny optional provider availability/metric context; no mandatory wall of GMV/viewer charts. |
| History | MERGE | Recent transitions in Operate; durable timeline in Review. |
| Evidence | DEMOTE | Contextual source/unknown/conflict detail only when it affects a fact. |
| Replay | MODIFY | Semantic operational timeline; native video/replay opens on TikTok, not a second player. |
| Next LIVE | STRENGTHEN | Select actual changes, validate constraints, inspect diff and create changed plan. |
| Host View | VALIDATE | NOW/NEXT/countdown/promotion cue/message; native scripts already exist. |


## Resulting route model

**Home / Sessions → Create → Prepare → Operate → Review → selected changes → next Prepare.** End/freeze is an Operate-to-Review transition; Learn becomes Review's adaptation area. Product/import and integration status are secondary utilities. Simulator is an explicitly separate session mode. Optional Host View uses a narrowly scoped share route after validation.

A route must return the requested session or a real not-found state. Prepare, Operate and Review must share one API/domain identity; existing unrelated fallback fixtures are not acceptable for a functional checkpoint. Reopening a session after process restart must reproduce the same actual history.

## Trust in the UI without internal-state overload

Normal view: planned time, current elapsed/forecast, upcoming deadline and one concrete decision. A manually reported external action should say “Reported” when relevant; the UI need not show acceptance/attempt/source ladders everywhere. On conflict, stale/missing data or later correction, reveal source and time. Review can offer known-then vs later-evidence detail when answering a disputed choice.

Real and simulated labels must be unambiguous. Missing provider data is “Unavailable,” never zero. The absence of a platform integration must not make the manual show look broken. These are user-facing honesty requirements, not a new evidence-management product.

## Host View placement

Start with a browser on a studio tablet/monitor; test phone in a stand if the studio uses one. It must be readable at actual distance with minimal scrolling, visual changes supported by text/icons, and no private integration credentials. Native scripts remain available for long selling copy. Host cues must not interrupt or add a second competing narrative.

P0.5 decision: build only after the paired test shows cue comprehension and reduced coordination effort. If host distraction worsens, retain a simple shared timer/next cue or remove the view. A polished private screen alone is not novelty.
