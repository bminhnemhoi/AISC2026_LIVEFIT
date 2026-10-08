# LiveLift V3 — Independent Validation Audit Checklist

Status: **SPECIFICATION ONLY — second-stage audit not run.** Created 2026-10-05 from audit worktree `orca/v3-validation-audit`, source HEAD `e4af76b`. No implementation, participant result, integration verification, merge or release approval is implied.

This is the independent architect/reviewer/integration guard's acceptance specification. Apply it after Antigravity supplies `docs/validation/v3/**` and Claude supplies the validation UI. Inspect their actual deliverables; their `PASS`, `DONE`, checked boxes and `BUILD SUCCESS` are claims to verify, not evidence. Initial preparation creates only this audit material and leaves both deliverables, application code and main untouched.

## 1. Authority and scope

The [V3 master roadmap](../../roadmap/LIVELIFT_V3_MASTER_ROADMAP.md), especially §§6–16, 21–23 and 29–30, governs product scope. Its current action is preregistered paired validation before engineering expansion. The current user assignment authorizes this independent specification, not frontend implementation or merging.

Read these supporting sources before assigning verdicts:

- [P0 domain, timing and command specification](../../research/codex-gap-study/13_P0_SPEC.md).
- [User validation protocol and frozen threshold proposal](../../research/codex-gap-study/14_USER_VALIDATION_PLAN.md), [demo scenarios](../../research/codex-gap-study/15_DEMO_STRATEGY.md) and [current next action](../../research/codex-gap-study/19_FINAL_RECOMMENDED_NEXT_ACTION.md).
- [Product vision](../../product/01_PRODUCT_VISION.md), [golden path](../../product/02_GOLDEN_PATH.md), [Prepare](../../product/03_PREPARE.md), [Operate](../../product/04_OPERATE.md) and [Review](../../product/05_REVIEW.md).
- [Frontend architecture reference](../../architecture/FRONTEND_REBUILD.md) and [historical evidence/replay research](../../research/antigravity/04_EVIDENCE_REPLAY_MODEL.md), as subordinate historical references.
- [Dated native capability map](../../research/codex-gap-study/03_TIKTOK_COMPLETE_CAPABILITY_MAP.md) and [dated API capability map](../../research/codex-gap-study/04_TIKTOK_API_CAPABILITY_MAP.md). These are research evidence with account/market/access limits, not current entitlement or verified execution.

Older documents/canvases contain server-first P0, provider, assistant/handoff, AI learning and advanced replay examples. They do not override V3's stage boundaries. In particular, an old evidence-ladder example associating HTTP 200 with verification does not override the explicit HTTP-200 invariant. Record conflicts and apply the master; do not silently revise a source to hide disagreement.

All five canonical canvases must be read and compared by frame/state, not merely cited:

| Canvas | Required reference and initial SHA-256 |
|---|---|
| [Foundations](../../../.kombai/canvas/livelift_canonical_20261003_00_foundations.canvas) | Chosen B direction, semantic dimensions, shells, interaction/shared states, responsive rules. `40352537c8a291eeb4879009907fc5b35177e7fbb812d773353db2f8950b0e91` |
| [Journey](../../../.kombai/canvas/livelift_canonical_20261003_03_journey.canvas) | Home/Create/Wrap/Sessions/Products/Integrations/Simulator, including clone and empty states. `16ebe6b63207bb08acb0c4beeb0a111aac174a754cedab79573a9922662dab6b` |
| [Prepare](../../../.kombai/canvas/livelift_canonical_20261003_05_prepare.canvas) | Four desktop sizes; empty, blocked, import, editor, provider-loss, SIMULATED, saving and long states. `e9a7243c5dfeace777d856d5709430b0af2e96eeaf3ecde0b64f500a661c48f7` |
| [Operate](../../../.kombai/canvas/livelift_canonical_20261003_06_operate.canvas) | Four desktop sizes; accepted, assistant, degraded, reconnect, draft, unknown, stale, wrong-room, handoff, end, SIMULATED and support states. `82c6593d5ad8f34e339c4b71b452bf9eee18d541d82791a276528aa6fccec7d4` |
| [Review](../../../.kombai/canvas/livelift_canonical_20261003_08_review.canvas) | Four desktop sizes; known-then/later/conflict/product/long/empty/SIMULATED, learning and clone preview. `ee33a0c05bd76c2033bea7a0877d3fca4160f4120d2cb38dafdfb8712d7e0cf5` |

Initial master SHA-256: `836f2384ef40cbb63edd504fde434e2f7e03fa15732d492fe49ff2a87dcbb0ef`. Freeze new source hashes at second-stage intake and explain changes. Canvas files have a comment header followed by JSON with embedded HTML. Use frame labels and embedded layout for viewport comparisons; the canvas positioning rectangle alone is not the rendered viewport contract. Exploration frames are references, not the selected visual direction.

Initial source review used direct Markdown reads and decoded HTML/text/layout inspection of every node in all five canvases. Graph coverage checks reported no recorded issue for the cited docs and unavailable tracked-freshness metadata for canvases; those canvases were read directly. This is document-grounded preparation, not verification of application behavior or graph completeness.

### Audit applicability

**B — baseline:** mandatory for validation package/UI readiness, including truthful scope and the inspectable timing → recovery → actuals → changed-clone loop. A static storyboard or disclosed Wizard-of-Oz can support concept research, but cannot PASS executable UI checks; score those as NOT VERIFIED. Concept assistance must be declared and measured separately.

**C — conditional:** mandatory if the delivered feature or claim is present (for example durable local P0, Host View, provider enrichment or backend authority). Absent later-phase features are not reasons to build them. Record N/A with the omitted feature and roadmap basis. Do not use N/A for a required core loop or invariant. A validation-ready prototype is not G0 product proof, G1 functional P0, G2A backend, G2B enrichment or G3 production.

Each row has an objective PASS condition; **FAIL means an observed counterexample to that condition**. Missing, inaccessible or unrun evidence is **NOT VERIFIED**, never PASS. Record observed failures even when other evidence is missing. Untested behavior, developer descriptions and screenshots of static states cannot establish runtime correctness.

## 2. Evidence and second-stage procedure

1. Print `pwd`, `git branch --show-current`, `git status --short`, `git rev-parse --short HEAD`. Stop for wrong audit worktree/branch. Record full audit/UI/package commits, worktrees, dirty diffs, runtime build identity and source hashes. Read completed deliverables from their pinned worktrees/commits without merging or editing them; do not audit only this older checkout.
2. Inventory every actual file in `docs/validation/v3/**`, including scenario scripts, baseline sheets, consent/data instructions, score definitions, threshold/decision rules and claimed results. Build a path-to-check-ID map; filenames/coverage are to be discovered, not assumed. Record missing deliverables as NOT VERIFIED.
3. Inspect the UI diff and actual domain/contracts/clock/store/client/review/clone paths. For structural exploration use installed `codebase-memory`: verify project/freshness, `search_graph` → `trace_path` → `get_code_snippet`, relevant caller/callee directions and pagination, then `check_index_coverage` for every relied-on path/scope. Read any missed/stale/unknown ranges directly. Use `rg` and direct reads for literals/configs/docs and verification. Qualify bounded absence findings.
4. Run meaningful existing checks and independent scenario vectors below against the pinned runtime. Record commands, environment, exit status, actual assertion output and test coverage limits. Build/typecheck/lint support buildability; they cannot prove timing, history, clone semantics, accessibility or provider success. Expected vectors must be derived independently, not copied from the implementation's return values.
5. Walk a fresh session through PREPARE → OPERATE → END/REVIEW → NEXT LIVE without hidden fixture swaps or database edits. Repeat failure branches, inspect underlying snapshots/events, and capture 1280×720 plus other reference sizes. Use a clean browser profile and varied titles/products/IDs/allocations to expose fixed-source fallbacks. All audit rehearsals are SIMULATED; a REAL manual-path check is explicitly an audit record with no claim of a live TikTok broadcast.
6. Reconcile package instructions with behavior: can the participant perform each scored task, can the assessor determine truth/timing, and does the prescribed result produce an actual feasible clone? Separate unassisted, assisted and concept-only trials.
7. Complete every applicable row and retain negative cases. Issue separate readiness and product-evidence conclusions. Do not merge, deploy, fix the implementation or change thresholds during the audit; report exact defects and required evidence to the owners.

Minimum evidence packet required for second-stage sign-off:

| Evidence | Required contents |
|---|---|
| Source identity | Audit/package/UI full commits and dirty diffs; file manifest and source hashes; run date, browser/OS, timezone, viewport/zoom and app mode. |
| Requirements mapping | Every checklist ID → actual package path, relevant source/function, test/scenario and runtime artifact; declared omissions and assistance. |
| Executable behavior | Clean-run startup instructions and dependency/lockfile identity; relevant test output; independent clock/command vectors; an actual full-loop recording. |
| State/history | Baseline and current-plan snapshots, stable session/segment/product IDs, command inputs/receipts where implemented, actual boundaries/reports, correction links and timestamps, end/freeze state. Debug exports or inspected storage are acceptable for a prototype; an unbuilt export UI is not required. |
| Timing/recovery | Before/after projections for every affected segment and anchor, uncertainty/minima/coverage/dependency constraints, rejected candidates and committed operator decision. |
| Review/clone | Baseline-to-actual reconciliation, source-session history before/after, selected/rejected patch list, field/order diff, new IDs, empty actual/evidence state and clone feasibility. |
| Visual/accessibility | Matched screenshots with canvas frame IDs; computed font/target/contrast measurements; keyboard/focus/reorder/dialog/zoom/reduced-motion observations and screen-reader results. |
| Honesty/claims | Visible mode/source/capability labels and inspected adapter/network behavior; no-provider run; limitation text; evidence for any optional backend/provider claim. Redact secrets and personal data. |
| Product validation | Frozen protocol/version, anonymous role/team/proxy counts, consent, scenario/order/assistance logs, raw paired timings/correctness/burden/cue/review facts, all negative/missing cases and decision arithmetic. If trials have not happened, explicitly NOT VERIFIED. |

## 3. Roadmap, Validation Gate and scope checks

| ID | Applies | PASS criterion / inspection |
|---|---|---|
| R01 | B | Deliverables explicitly serve master §30 paired validation; no unapproved locked-decision changes or activation of deferred/rejected scope. Trace scope to §§11, 14, 21, 23 and L1–L10. |
| R02 | B | The label is validation prototype/rehearsal with actual limitations. Readiness approval is separate from a measured build/pivot/kill decision and from G1/G2/G3. No production/backend/market-superiority claim inferred from a UI/build/demo pass. |
| R03 | B | Core workflow runs with manual plan inputs and explicit simulation, without TikTok credentials/API, scraping, automatic pinning, AI or WAN-dependent data. Test unavailable optional context; it must not block timing/recovery/review/clone. Record offline asset/runtime setup separately. |
| R04 | B | One room and one runtime operator; rundown is the execution order. No separate queue silently changes it, concurrent disconnected authorities, generalized connector framework, multi-room OS, shop OMS/PIM or backend expansion hidden in the validation task. |
| R05 | B | UI/navigation/tasks center on future time commitments, explicit recovery, actual history and selected next-plan adaptation. No rebuilt broadcast/video/player/chat/moderation, native promotion controls, GMV/traffic BI, AI script/diagnosis/practice clone. Small product snapshots and short cues remain operational context. |
| R06 | B | The package acknowledges native capabilities and configured substitutes. It does not claim TikTok lacks scripts/product ordering/replay/advice/practice, or that a bounded NOT FOUND is universal absence. Native UI permission is never treated as third-party API entitlement. |
| R07 | B | Start/End wording says LiveLift tracking, with native broadcast started/stopped separately. Pin/unpin/coupon/Flash Sale/giveaway/billboard controls are absent or explicitly human reports, with no fake execution endpoint or success label. Inspect handler and network behavior as well as copy. |
| R08 | B | All displayed session/provider/product facts are attributed to manual input, observed evidence or SIMULATED fixtures. No fabricated authorized account/room, working backend, synchronization, provider receipt, native action or REAL credentials. Changing an unknown ID never returns a convenient demo session. |
| R09 | C | Host View/handoff/assistant features, if shown, have explicit prototype status and one read-only projection/one operator authority. Host View benefit has its own gate; absent Host View does not fail P0. Backend/enrichment claims require their distinct §23 gates and separately authorized evidence. |

## 4. Validation-package checks

| ID | Applies | PASS criterion / inspection |
|---|---|---|
| V01 | B | Scenario scripts, timer start/stop definitions, critical-cue tolerance, scoring denominators, exclusion/assistance rules and build/pivot/kill thresholds have a frozen version before first scored trial. Post hoc changes remain logged and cannot make earlier trials pass retroactively. |
| V02 | B | Recruitment plan specifies 5–10 relevant participants across at least three recurring teams, aiming for ≥3 dedicated operators and ≥3 hosts for host testing; role/team/proxy counts are separate. Actual enrollment/results are not invented when only a plan exists. |
| V03 | B | Native VN account walkthrough is planned/recorded with eligibility/version/capabilities; competent sheet includes duration formulas, anchor highlights, required products and actual notes, plus normal chat. Matched training and counterbalanced A→B/B→A equivalent scenarios prevent a deliberately weak baseline or memorization advantage. |
| V04 | B | At least two operators are assigned a configured Ontime/Shoflo/Rundown Studio challenge; Opsique access/result or uncertainty is explicit. Inaccessible comparisons remain limitations, not wins. Scripts include a simple-show counterexample and negative cases. |
| V05 | B | Every scored disturbance has a predefined injection time and observable ground truth: overrun, late report, required-product coverage loss, and handoff/reconnect. Unbuilt later-phase handoff/reconnect is declared concept assistance and scored separately; no pretend backend reliability. |
| V06 | B | Instructions protect consent/minimal anonymous data and disclose screen/event recording and assistance. Raw timings/correctness/workload/preferences retain missing observations and unfavorable trials; no fabricated participant or willingness-to-pay evidence. |
| V07 | B | Decision worksheet computes per-operator paired differences and sample medians with exact trial denominators, specified zero-baseline handling and no invented statistical significance. Preference cannot override a critical cue/false-success failure. |
| V08 | B | Thresholds below match report 14 or have an explicit preregistered, authorized change. No lowered target chosen after results. Concept-test readiness, concept results and functional repeat results are distinct. |
| V09 | C | Any repeat-use claim is supported by ≥3 teams voluntarily returning across ≥3 sessions and applying a useful selected change. Intent-to-use, rehearsal fixtures and promised purchase do not count as actual repeat use. |

Freeze and later compute these report-14 measures. This table is a protocol check now; **it contains no measured passes**.

| Measure | PASS target for measured validation |
|---|---|
| Setup | ≤10m; baseline median penalty ≤2m. |
| Awareness | Correct at-risk anchor identified within 10s in ≥80% of scored trials. |
| Recovery | Median time ≥30% faster than baseline; ≥90% choices respect constraints. |
| Cue misses | No increase versus baseline and zero critical unintended misses; tolerance frozen in advance (report example: 15s). |
| Capture burden | ≤1 routine command per transition; median ≤3s extra effort; ≥90% boundaries within 15s of observed truth. |
| Workload | Median ≥20% lower, or no worse with documented recovery benefit, on the same scale. |
| Host coordination, if tested | ≥80% cues understood correctly within 5s and ≥30% fewer avoidable timing/next-cue messages, with no observed delivery regression. |
| Review + next plan | ≤5m total; median ≥30% faster; ≥90% facts correct; changed plan feasible. |
| Preference | ≥70% operators voluntarily choose LiveLift with a specific reason; cannot override reliability failures. |
| Repeat use, later checkpoint | ≥3 teams voluntarily use across ≥3 sessions and apply a useful change. |

## 5. Canonical canvas, accessibility and viewport checks

| ID | Applies | PASS criterion / inspection |
|---|---|---|
| U01 | B | Frame-to-screen matrix covers all five canvases and exercised empty/blocked/active/accepted/unknown/ended/Review/clone/SIMULATED states. Optional out-of-scope frames are listed with roadmap reason; no entire canvas is skipped. Side-by-side screenshots identify frame ID, dimensions and justified deviations. |
| U02 | B | Chosen B visual grammar: matte near-black/graphite layers (`#090B0F`, `#13161C`, `#1B1F27`, `#252A34`, `#303643`), lime primary action, violet for evidence/later receipts. Rubik/Vietnamese glyphs and tabular clocks/codes render; computed body/critical metadata ≥16px and primary action text ≥18px. No glow, arbitrary confidence or color-only status ladder. |
| U03 | B | Standard shell has minimal navigation; Operate uses focused shell. Identity/mode/timezone stay recognizable, End stays distinct from routine actions, and leaving the desk does not end execution. Acceptance does not move the Start target into the Accept click position. |
| U04 | B | At 1280×720, 100% zoom, NOW/NEXT/WHY/primary ACTION, elapsed/target and imminent anchor risk are readable without scrolling. Prepare readiness/Start remain reachable; Review ledger/Plan-vs-Actual and Next LIVE remain usable; long Vietnamese titles retain accessible full identity. No clipped/overlapping/hidden controls or page-level horizontal overflow. |
| U05 | B | Laptop layout follows canvas priorities: Prepare product pack + dominant rundown with bottom readiness action; Operate 40/60 command hierarchy, compact toolbar and rundown scroll; Review uses an inspector drawer rather than crushing the ledger. Secondary Pulse/History/detail collapses first. Desktop 1440×900, 1600×1000 and 1920×1080 add useful rows rather than unrelated dashboard widgets. |
| U06 | B | Long lists (≥23 segments/products) have explicit workspace scroll ownership, no row-within-row scroll traps, accessible Return to current and no timer/action displacement during updates. At 200% zoom fixed heights release into page flow; task controls remain reachable and labels readable. |
| U07 | B | Keyboard alone completes create/edit/reorder/start/recover/report/end/review/select/clone. Reorder has Move up/down alternatives; focus order matches task order; focus is visible (canonical 2px outline/3px offset or verified equivalent), dialogs/drawers contain focus and return it on close. No keyboard trap or hover-only essential action. |
| U08 | B | Interactive targets measure ≥44×44 CSS px. Measured contrast meets ≥4.5:1 ordinary text, ≥3:1 large text and meaningful UI/focus indicators. State/error/risk uses text and coherent icons in addition to color; absent/unknown/conflict is distinguishable from failed. |
| U09 | B | Inputs have programmatic labels; icon controls include exact action/target names; tabs/checkboxes/dialogs expose state to a screen reader. Command acknowledgements/errors are announced without announcing every clock tick or stealing focus. Reduced-motion setting removes flashing/pulsing/spatial transitions. |
| U10 | B | Missing images have stable neutral footprints, code/name and honest unavailable text; no invented stock imagery. Missing price/metrics remain missing. Loading, save failure, uncertain outcome, conflict and empty evidence have specific text and an actionable recovery; no false empty/saved/success state. |

## 6. Journey and NOW / NEXT / WHY / ACTION checks

| ID | Applies | PASS criterion / inspection |
|---|---|---|
| J01 | B | A fresh exact-ID session completes PREPARE → OPERATE → end/freeze → REVIEW → selected changes → new PREPARE. Wrap/Learn are parts of that transition, not disconnected mandatory workflows. Links/session list/open/review/clone all retain the selected session identity. |
| J02 | B | Prepare records title, mode, timezone/start, product snapshots and ordered segment IDs/durations/minima/optional/compressible/required coverage, anchors and cues. Readiness checks actual saved values, invalid/missing durations/references and at least one runnable segment; product-free show is allowed. A zero-duration cue is not a runnable host segment. |
| J03 | B | Manual/basic import previews malformed/duplicate rows and optional missing values without coercing them to zero or overwriting existing IDs silently. Session overrides and later library edits do not alter the saved historical product snapshot. |
| J04 | B | NOW derives from this session's actual transition/report, never acceptance, pin state or fixture identity. It distinguishes active segment/product, actual elapsed/start, target and source/unknown state. In a five-second exposure, the reviewer can identify session/mode, NOW, NEXT, WHY and expected ACTION correctly; record each answer and any miss. Participant thresholds remain the separately frozen report-14 measures. |
| J05 | B | NEXT names the next executable segment/cue and projected start or lower bound, identifies nearest important anchor, and exposes definite/possible risk. In the four-minute example it stays Giveaway; unrelated Product B is not presented as the way to rescue its upstream anchor. |
| J06 | B | WHY states one concise relevant reason from saved plan/operator input/constraint arithmetic. Expanded evidence exposes the actual inputs/rule/as-of and missing context. Altering those inputs changes the explanation; no invented engagement, generic AI rationale or causal-sales reason. |
| J07 | B | ACTION names the exact target and effect; Start/End/extend/shorten/skip/reorder/recovery are explicit operator commands. Accept/reject alone does not perform a transition or native action. A direct Start may record decision + transition together without an extra routine acceptance step. |
| J08 | B | Hold/wait pauses proposals or intentionally waits, not broadcast elapsed time. Advancing time alone never marks a product performed, accepts recovery or executes a promotion. Timed cues can become due without becoming performed. |

## 7. Timing, downstream drift, anchors and explicit recovery

| ID | Applies | PASS criterion / inspection |
|---|---|---|
| T01 | B | Elapsed time derives from recorded actual boundaries and an explicit clock, not tick count/render frequency. Same instant gives same elapsed/forecast after rerender/tab suspension; dated timezone-aware anchors work across midnight. Clock discontinuity is surfaced/recorded rather than silently rewriting elapsed/history. |
| T02 | B | Completed variance = recorded actual duration − immutable baseline duration. Pending projections use current allocation. Active end = now + explicit non-negative remaining estimate; target-minus-elapsed may estimate remaining before overrun, but exceeded target with no estimate becomes unknown/lower-bound, never confident zero. |
| T03 | B | Floating starts propagate from active projected end through every pending duration/earliest-start constraint. Extend/shorten/skip/reorder/estimate changes recalculate all affected future starts, deficits and coverage. No stale downstream card or mutation of completed intervals. |
| T04 | B | Hard commitment remains fixed; earliest feasible start = `max(cursor, anchor)` and deficit = `max(0, cursor − anchor)`. Early arrival shows wait/buffer; late arrival shows risk/miss. Passing the wall-clock deadline with no performed record cannot become on-time by moving the anchor. |
| T05 | B | Every anchor boundary, required product, minimum, dependency and closing constraint is checked after a recovery or clone patch. Protecting the nearest anchor cannot conceal an infeasible later one. Earlier recovered time does not accumulate again at each anchor. |
| T06 | B | Parallel zero-duration cues consume no host time only when configured as such; full announcement segments consume their duration and cannot overlap a single-host pitch. Cue due/report time and segment start/end remain independent. |
| T07 | B | Unknown active remaining propagates uncertainty. Show earliest/lower-bound times and distinguish certain deficit from possible risk; downstream safety is not asserted from a zero substitution. Negative/NaN/infinite durations/remaining and minimum greater than allocation are rejected or explicitly unresolved. |
| T08 | B | Recovery preview lists affected allocations, minutes saved/cost, minima, lost/partial coverage and all-anchor result. Acceptance alone does not falsify actual end/coverage. Applied recovery records exact choice/reason/version and future projections reflect it. Cancel/reject leaves plan/runtime unchanged. |
| T09 | B | Only eligible pending/compressible portions above minima may shorten; optional skips disclose lost coverage. A required-coverage/minimum exception needs explicit acknowledgement and remains an exception, not a valid-within-constraints success. Executed segments and dependencies cannot be silently reordered. |
| T10 | B | No feasible candidate produces explicit “No feasible recovery under current constraints.” Extend displays downstream cost; shortening after an already-missed anchor cannot repair its start. Re-anchor is an explicit new commitment, preserving the old miss; cancellation records missed/cancelled and reason, never performed. |

### Independent timing vectors

Run all vectors through the same delivered domain behavior used by the UI. Set the scenario date to `2026-10-05`, timezone `Asia/Ho_Chi_Minh`; minute values below are exact. Require exact millisecond/second assertions in the domain; UI may round to a second but must preserve risk sign and show its precision. Record inputs, expected values, actual values, plan versions and events. No real platform request is needed or authorized.

| Vector | Inputs / steps | Required result |
|---|---|---|
| D01 — original deficit | Opening 20:00/5m; A 20:05/7m, minimum 4m; full Giveaway fixed 20:12/3m, minimum 3m; B 8m after Giveaway. At 20:09 set A remaining 7m. | A projects 20:16; Giveaway commitment remains 20:12, earliest 20:16, deficit 4m; B projects 20:19–20:27. A's actual elapsed is 4m. NEXT Giveaway; shortening B cannot rescue Giveaway. |
| D02 — recover and miss branches | From D01, explicitly choose close A at 20:12, with unfinished coverage disclosed; separately reset and actually close A at 20:16. | Recovered branch: A actual 7m, Giveaway 20:12–20:15, B 20:15–20:23. Late branch: A actual 11m (+4m), Giveaway earliest 20:16–20:19 and original anchor missed 4m; B 20:19–20:27. No retroactive success. |
| D03 — buffered two-anchor show | Opening 20:00/3m (min 2m); A 20:03/6m (min 4m); implicit buffer to full Flash Sale fixed 20:12/3m (min 3m); B 8m (min 5m); optional Q&A 3m (min 0); Closing fixed 20:26/4m (min 4m). Opening/A/B/Q&A compressible unless a vector says otherwise. At 20:07 A remaining 6m. | A projects 20:13: 4m over its baseline end, 3m buffer consumed, first deficit 1m. Without recovery Flash Sale projects 20:13–20:16, B 20:16–20:24, Q&A to 20:27, Closing earliest 20:27 (1m deficit). Both commitments stay fixed. |
| D04 — buffered recovery and selected clone | From D03, choose close A at 20:12 and carry unfinished points to Q&A; actually transition then. Finish Flash Sale 20:15, B 20:23, Q&A 20:26 and Closing 20:30. Select next Opening 2m, A 9m, buffer 1m; leave anchors unchanged. | A actual 9m (+3m), both anchors on time. New plan: Opening 20:00–20:02, A 20:02–20:11, wait to 20:12, Flash Sale to 20:15, B to 20:23, Q&A to 20:26, Closing to 20:30. Only selected patches apply; new actuals empty. |
| D05 — downstream cost and recovery eligibility | After D04 first-anchor recovery, extend B from 8m to 10m before B ends; then shorten eligible Q&A from 3m to 1m. Also try modifying an executed segment or crossing the Flash Sale anchor by reorder. | Extended B projects to 20:25, Q&A to 20:28 and Closing is 2m at risk. Shortened Q&A restores Closing 20:26, disclosing reduced Q&A/follow-up coverage. Executed-history/reorder violations are refused or an explicit new commitment/exception is required. Baseline stays unchanged. |
| D06 — every later anchor matters / minima exhausted | After the D04 first-anchor recovery, explicitly propose B allocation/minimum both 10m, Q&A required/noncompressible 3m with minimum 3m; no pending segment is optional or has allocation above its minimum. Keep both anchors unchanged. | Flash Sale remains on time but Closing has 2m deficit. Preview rejects readiness or says no feasible recovery under these constraints: no legal shortening/skip saves 2m, and ending B below 10m is an explicit minimum exception. Baseline unchanged; cannot quietly skip Q&A or alter Closing. Explicit exception/re-anchor remains distinct from valid recovery. |
| D07 — unknown remaining | D01, advance to 20:13 while A has not ended and no fresh remaining estimate exists. Separately at 20:11 mark remaining explicitly unknown (disable target-derived estimate). Do not explicitly enter zero. | At 20:13 A end unknown, earliest 20:13; Giveaway has a definite lower-bound deficit ≥1m; B earliest ≥20:16. At 20:11 explicit unknown gives possible risk, not a confident safe deadline. Explicitly entered zero is distinct and still does not record an actual end. |
| D08 — cue versus host segment | D01 variant: Giveaway is explicitly a parallel zero-duration cue due 20:12, with A actually ending 20:16. Compare full-segment variant. | Cue due/report can occur at 20:12 while A continues; B can start 20:16, since cue consumes zero time. Full variant still gives Giveaway 20:16–20:19 and B 20:19. Neither variant auto-performs a native giveaway. |
| D09 — wait and exact boundary | Use D03 A remaining 1m at 20:07; explicitly end A at 20:08, then advance to anchor exactly and one second after without starting/reporting Flash Sale. | A projected end 20:08, wait 4m, Flash Sale earliest 20:12. Early completion cannot pull it forward. Exactly-at boundary has zero projected deficit; one second late without execution remains due/missed/unknown actual, never completed on time. |
| D10 — actual skip/missing/correction | Skip an optional segment with disclosed coverage loss. Exercise explicitly incomplete SIMULATED history with a missing actual boundary, or verify it is rejected without filling the gap. Append a late correction referring to an earlier wrong-product report. | Skip has no performed interval; accepted incomplete history shows unavailable duration, never a completed zero-duration sample. Correction retains original actor/record/time plus new actor/reason/receipt; known-then view before receipt retains the original when that lens is implemented. |
| D11 — clock and midnight | Start 23:58 on Oct 5 with floating 3m segment; next full anchor Oct 6 00:02. Suspend/rerender at same elapsed instant; inject a backward wall-clock adjustment. | Next floating end Oct 6 00:01, wait 1m, anchor date Oct 6. Repeated rendering cannot change timing. Backward wall change cannot create negative actual duration, erase a miss or shift baseline; uncertain alignment is explicit. |

## 8. Original plan, actual history, Review and domain invariants

| ID | Applies | PASS criterion / inspection |
|---|---|---|
| H01 | B | At Start, capture immutable baseline IDs/order/durations/anchors/cues/product snapshot/timezone/version. Runtime edits append explicit current-plan versions with actor/time/reason. Reproduce the exact original plan after extensions, reorders, re-anchor, end, correction and clone. |
| H02 | B | Actual execution ledger comes from this run's commands/boundaries/reports, scoped to its exact session/mode. Use nonfixture products/allocations and a second session with different commands; Review must differ accordingly. Future/planned/accepted/skipped segments have no invented performed interval. |
| H03 | B | End commits/fixes final runtime and duration. Advancing the clock, revisiting Operate, stale commands, extend/reorder/skip/start and simulator timers cannot mutate ended execution. Review corrections/late evidence append without reopening or overwriting historical records. |
| H04 | B | Plan-vs-Actual compares actuals to start baseline, while current allocation/version is separately inspectable. Signed variance is correct (D02 +4m, D04 +3m); gaps, skipped, partial and censored intervals stay explicit. Totals distinguish performed time, wait and missing time; no double-counting parallel cues. |
| H05 | B | Required coverage is based on recorded execution/report with source and completeness. Accepted/planned/pinned products are not automatically “presented”; skipped/partial/unrecorded products never count as completed coverage silently. Repeated same-product segments retain distinct segment identities. |
| H06 | B | Reports retain actor, exact action/target, occurrence and recorded/receipt time. Corrections link original record plus reason/source/new receipt; conflicts retain both assertions. Original records remain inspectable after review, later evidence, clone and reload if persistence is claimed. |
| H07 | C | If known-then/later lenses are provided, at replay instant T known-then excludes records with occurrence or receipt after T. Later lens includes attributed late evidence without rewriting the earlier view; receipt is not proof a host/operator saw it. Frozen historical recommendation inputs remain inspectable, or missing provenance is stated. |
| H08 | B | Observations and suggested next changes identify their records and uncertainty; a single run supports a manual adjustment, not automatic recurring learning. No “this caused sales lift,” causal segment attribution or sales optimization claim from timing/association. |
| H09 | C | Recurring patterns require ≥3 comparable completed REAL observations, exclude skipped/missing/censored/SIMULATED intervals, and show sample count/spread/context. Operator approval and all-constraint validation precede any changed clone. |

Every invariant below is mandatory when its state is rendered or processed. Absence of a provider means no provider confirmation is available; it does not permit invented evidence.

| ID | Invariant | Objective adversarial check / PASS |
|---|---|---|
| I01 | Missing != zero | Omit price, remaining estimate, actual end and metric; compare explicit numeric zero. Missing retains unavailable/unknown/gap semantics in UI, totals, exports and rules. Zero appears only with attributed entered/measured value; no truthiness bug hides a genuine zero. |
| I02 | Planned != actual | Extend/reorder A then end. Baseline unchanged; actuals require observed/recorded transition, not plan offsets or latest targets. |
| I03 | Recommendation != acceptance | Display/reject a suggestion. No acceptance recorded; showing it does not establish human attention. |
| I04 | Acceptance != attempt | Accept next segment/external-action suggestion. No native attempt or start until explicit corresponding command. |
| I05 | Attempt != performed | Record a pin attempt with unresolved result. Performed/presenting/pinned state is not inferred; no synthetic performed receipt. |
| I06 | Operator reported != provider observed | Submit “pinned” manually. Preserve report/source; no provider observation is generated by the button. |
| I07 | Provider observed != platform confirmed | Supply a simulated provider readback. Retain simulated observation; no platform confirmation without authoritative matching postcondition evidence. |
| I08 | Unknown != failed | Missing acknowledgement/readback shows unresolved/unknown with receipt checking; only explicit failure evidence becomes failed. |
| I09 | REAL != SIMULATED | Inject SIMULATED signals/history and trigger a REAL manual-path error. No fallback, cross-mode facts, fixture receipts or simulated records in REAL review/learning/export. |
| I10 | Observation != causation | Associate activity with a product interval. UI/review/changes retain association/uncertainty and cannot claim revenue effect or infer a valid experiment. |
| I11 | HTTP 200 != verified platform action | Mock a successful transport response without authoritative postcondition evidence. Verification stays unknown; no “TikTok confirmed” or product-control success. |
| I12 | Historical state must not be silently rewritten | Re-anchor, correct report, receive late evidence, change library and clone. Original plan/events/known-then result remain reproducible; edits append attributed changes. Explicit rehearsal reset may clear only its isolated SIMULATED run; it cannot rewrite retained historical or REAL sessions. |
| I13 | Exact enum/target semantics | Exercise `pin`, `unpin`, presentation, attempt and performed-report separately. `unpin` never matches `pin` via substring; an attempt does not change reported pin; actions cannot target another session/product. |

## 9. Next LIVE clone integrity

| ID | Applies | PASS criterion / inspection |
|---|---|---|
| N01 | B | Clone uses the exact reviewed source session and explicit source plan version, not a fixed canned ID or latest global session. Preview names source, selected accepted patches and before/after fields/order. |
| N02 | B | Accepted/selected duration/order/cue/buffer changes materially alter the new plan. Unselected/rejected/proposed changes do not enter it. No-selection clone copies the declared plan without silently applying suggestions. Test two source sessions and conflicting patches. |
| N03 | B | Full clone validation checks all anchors/minima/coverage/dependencies; increasing A alone in D03 cannot be called feasible if it threatens Flash Sale/Closing. Reject the patch set or disclose unresolved infeasibility and block ready/Start; never silently move anchors to make it fit. D04 produces the exact feasible selected plan. |
| N04 | B | New session/segment/cue identities and draft lifecycle; internal product/cue/patch references remap coherently. No actual starts/ends, receipts, execution events, old acceptance/verification, provider bindings or ended flags are copied as new facts. Source lineage/change note is provenance only. |
| N05 | B | Product facts copy as snapshots, with source/as-of/optional missing values preserved. Editing the clone cannot mutate source plan/product snapshot/actuals/events; compare source snapshots before and after clone/edit. |
| N06 | B | Mode is explicit at creation: simulated history never becomes REAL history/learning. Reusable plan-only data may seed an explicitly chosen REAL draft with clear simulation lineage and cleared actual/evidence/provider state; this cannot imply a real prior show. |

## 10. Simulator and local/command authority

| ID | Applies | PASS criterion / inspection |
|---|---|---|
| S01 | B | Scenario has version/seed, saved initial plan, virtual start/timezone and explicit commands/disturbances. Same reset + seed + clock + commands produces identical allocations, risk, logical IDs/order, events/receipts/actuals/review and clone diff. Incidental ID normalization, if needed, is declared narrowly; never normalize away differing domain facts. |
| S02 | B | Simulator uses the same tested timing/transition rules as the displayed desk. No `Date.now`, unseeded randomness or hidden timers change virtual results. Clock advancement and actions are independent; reset removes prior scenario state and restores exact initial conditions without touching REAL records. |
| S03 | B | Entire rehearsal including failure branches works without provider/WAN; SIMULATED label is persistent across Prepare/Operate/Review/clone and every synthetic signal/report. Replay represents the run, not a canned end-state. |
| S04 | B | Manual clock/domain and virtual clock agree for the same instants/commands (D01–D11), except clearly labeled simulation provenance. Changing tab visibility/render interval cannot alter authoritative timing or perform actions. |
| C01 | B | Command handlers enforce exact session/segment/mode and lifecycle, not UI-disabled buttons alone. Unknown IDs return not-found; stale/duplicate/post-end command delivery cannot produce extra transitions, false performed facts or another session's result. Prototype limitations in revisions/receipts are explicit and cannot support G1. |
| C02 | C | Functional P0 claim: expected revision and unique command key enforce one committed state/event/receipt result; duplicate returns same outcome, stale revision resnapshots without blind replay, uncertain ack checks receipt before retry. State/event/receipt commit atomically before success UI. |
| C03 | C | Local durability claim: reload/restart preserves baseline/current plan/events/notes/receipts and mode isolation. Storage failure cannot acknowledge a lost command; schema version/export/restore reproduce coherent records. Denied/quota/corrupt storage has explicit failure and preserved recoverable input. |
| C04 | B | Authority boundary is honest: Phase-1 local device continues without WAN; simulated server-disconnect state is labeled rehearsal. If an authoritative server is actually used, its loss blocks runtime commands and shows snapshot age while durable note drafts remain local. No generic “offline” state silently replays transitions or claims disconnected-browser coordination. |
| C05 | C | Draft/reconnect feature: note/report intent survives reload, remains outside committed actual history until explicit reconciliation/confirmation, and never resubmits by navigation/reconnect alone. Submitted result needs committed receipt; failed/unknown outcome retains recoverable draft without changing ended runtime. |
| C06 | C | Any backend/team claim supplies G2A evidence: one server authority, atomic receipts/events, scoped roles/session/workspace isolation, actual two-browser convergence, restart/gap/duplicate/conflict handling. Host/reviewer cannot write runtime. Local listeners or fake adapters cannot PASS. This audit does not authorize such expansion. |
| C07 | C | Any provider-enriched claim supplies G2B evidence: permitted current app/account/market/scopes/version and exact room/session binding, units/time/currency/granularity/as-of, missing/late/conflict handling. Wrong identity quarantines only its capability; manual loop survives failure. Simulated probes are not live entitlement. |

## 11. Results, blockers and sign-off

Record one result per check and D01–D11 vector, including all invariant checks. Use this entry format in the eventual audit report (do not prefill verdicts in this specification):

```text
Check/vector ID:
Applicability: B / C (feature or claim) / N/A (roadmap reason)
Verdict: PASS / FAIL / NOT VERIFIED / N/A
Artifact identity: package/UI commit, runtime build, mode, browser, viewport
Evidence: exact file/function/test command/output/screenshot/event or snapshot
Reproduction: initial inputs, clock and commands
Expected / observed:
Severity and affected claim/gate:
Required correction or missing evidence / owner:
```

**Blocking defects:** any false success/confirmation, missing-as-zero/unknown-as-failed coercion, REAL/SIMULATED mixing, silent history/anchor rewrite, infeasible forecast presented as safe, hidden required-coverage loss, wrong-session result, unsupported native execution, lost acknowledged state, critical unintended cue miss, or unusable/inaccessible core operation. Critical truth/reliability violations block the applicable gate regardless of preference or build results. Other applicable failures also prevent complete sign-off; record severity for prioritization, not to waive acceptance criteria.

Conclude separately:

- **Validation readiness:** PASS only when all baseline checks/vectors and applicable conditional checks PASS, with no unresolved FAIL or NOT VERIFIED. Clearly mark any concept-only assistance and the executable checks it cannot verify. N/A needs a roadmap-backed absence, never a missing test excuse.
- **Product evidence:** G0 build/pivot/kill decision only from frozen paired trials, raw negative cases and threshold arithmetic. If participants have not run trials, state NOT VERIFIED even if the package/UI is ready. No inference of functional P0/backend/enrichment/production gates without their own evidence.
- **Integration handoff:** list exact audited commits, tested contract/scenario compatibility, remaining limitations and owners. Readiness is a review result; merging remains a separate user-authorized action. This checklist authorizes no merge or implementation changes.

Before closing the initial specification task or a later review: inspect completeness against the mission and every invariant, inspect the diff for out-of-scope changes, run `git status --short`, list created/modified files, and report exactly which second-stage evidence is present versus still required.
