# LiveLift V3 — final independent clause recheck

Date: 2026-10-06. Independent reviewer: Codex.

**Six clauses resolve. AG-02 remains partially resolved because its new exploratory-branch annotation gives incorrect arithmetic. All 12 requested synthetic checks pass; they do not test that additional branch.**

All four branch/HEAD/status checks matched before review and again before commit: main `main/e4af76b`, UI `orca/v3-validation-ui/9a91101`, validation `orca/v3-validation/d03543c`, audit `orca/v3-validation-audit/0e6ab8f`. Main and builder tracked files remained clean; validation's untracked helpers were ignored completely. The four protected audit documents remained byte-identical.

The oracle was `FINAL_RESIDUAL_REAUDIT.md` at `0e6ab8f`. Review covered only AG-01–AG-07, the committed `717aba4..d03543c -- docs/validation/v3` diff, and immediate consumers needed to verify those clauses. UI findings and AG-08/09 stayed closed. No external research, browser campaign, builder changes, merge or push occurred. The previously accepted UI SHA is unchanged; its full health suite was not repeated.

Temporary independent checks reside under `/tmp/livelift-clause-recheck/`. A constrained Python evaluator parsed and executed the **committed universal nested-IF Q/R formulas**, including date normalization, spreadsheet branching and decimal rounding. This establishes executable formula behavior for the specified inputs; it is not a claim of running an actual Google Sheets workbook. A single temporary Vitest check in the existing exact UI archive executed four relevant command sequences through `applyCommand` and `forecastSession`. It passed with the observed results recorded below. No auditor harness was committed. Codebase-memory supplied navigation and coverage checks; committed source and independent results supplied evidence.

Numbered references below identify `docs/validation/v3/` files at `d03543c`. UI references identify frozen source at `9a91101`. **All test inputs are synthetic reviewer examples, not participant data.** Checks 1/2 use wall-clock `HH:MM`, as required by the requested 06:31 and 09:31:45 results. The actual scenario's elapsed `mm:ss` values remain distinct: elapsed 06:30 + 1m = 07:30; elapsed 09:30 + 1m45s = 11:15.

## AG-01

**FINAL VERDICT: RESOLVED**

`03:117–118` now defines remaining minutes V and observation timestamp W; W is explicitly editable (`03:372`). Both LET and universal formulas derive the observed deadline from normalized W + V/1440 (`03:197–198,222–223,238–239`). `06:194,235` supplies concrete W3/W4 entry instructions before the estimates. Independently executing the committed universal formula preserves 06:31:00 and 09:31:45 across later recalculations. The actual S1 fixture likewise preserves wall-clock 20:07:30 and its 90s deficit at 20:06:30 and 20:06:45. The prior midnight case still gives exactly 1m deficit.

## AG-02

**FINAL VERDICT: PARTIALLY RESOLVED**

`05:195,199` removes the earlier mandatory extension and specifies one canonical update: remaining 1m at elapsed 06:30. That path yields Serum end 07:30, Flash projection 10:30 and **90s deficit**, agreeing with the baseline and rater key.

However, `05:200` now claims **Extend +1m in addition to the 1m estimate yields 120s**. Independent execution at the repaired starting target of 4m produced:

| Commands at elapsed 06:30 | Observed deficit |
|---|---:|
| Remaining estimate 1m | 90s |
| Extend +1m alone | 60s |
| Remaining estimate 1m, then Extend +1m | **90s** |
| Extend +1m, then remaining estimate 1m | **90s** |

Every command returned a committed domain receipt. `UI:next/src/lib/domain/engine.ts:612–637` changes the target without clearing the estimate; `forecast.ts:186–187` continues to prioritize the observed estimate deadline. Thus the new branch annotation contradicts the actual engine, despite correctly separating exploratory choices from the canonical path.

**Remaining correction:** Remove the incorrect branch example or change its declared deficit to 90s for these commands. This is a script arithmetic correction, not a UI defect or a new requirement.

## AG-03

**FINAL VERDICT: RESOLVED**

`05:366`, `06:281`, `08:217`, `11:94–95,217–220`, `12:142` and `13:112` now agree on ≥80% per trial and ≥90% pooled. The pair 4/5 and 5/5 gives 80%/100% and 9/10=90% pooled: **PASS for fact validity throughout**, including authorization through Dimension 08 (`14:71–74`).

Configuration/import tasks (`05` §2.2, `06` §2.2) now map to the counted M1 observation (`08:68–75`), required integer field `n_config_errors` (`08:303`), setup/errors scorecard (`12:126`), ≤2-error threshold (`11:69–70,114–119`, `13:106`), and explicit G0 authorization requirement (`14:72–74`). With other setup criteria satisfied, 2 errors permits PASS; 3 is MARGINAL under `11` and blocks G0. The threshold is no longer orphaned.

## AG-04

**FINAL VERDICT: RESOLVED**

The result template now uses ΔTLX≤0 for its non-inferiority alternative (`12:136–137`), consistent with `08:200`, `11:186–193` and `13:111,221–223`. TLX 50→53 is +3 points/−6% improvement: **FAIL Dimension 06, K3**, even with significant recovery improvement and 100% validity. A committed-text search found no remaining contradictory ±5-point rule.

`N_opp=0` explicitly yields **N/A — INVALID FOR SCORING / RETEST REQUIRED**, with no division or fabricated detection (`08:97,279`, `11:74,131`, `12:128`). It cannot pass G0 by treating an empty denominator as successful recognition.

## AG-05

**FINAL VERDICT: RESOLVED**

`07:190–191` now supplies one condition-blind rubric: PASS≤15s, MARGINAL 15.1–30s, FAIL>30s or constraint violation. It agrees with the operational script/rater criteria in `06:194,235` and `09:191,233`. A valid 20.0s decision is **MARGINAL in both conditions**. The former baseline ≤25s advantage is absent from the committed package.

## AG-06

**FINAL VERDICT: RESOLVED**

`05:138,210` names the actual recovery IDs: `apply-shorten_pending`, `apply-skip_optional`, `apply-skip_required`, `apply-end_by`, `apply-close_now`. Frozen `recovery.ts:319,385,414,444,461,475` emits the matching kinds; `NextPanel.tsx:193` renders `apply-${o.kind}`. Applicability and exception handling remain governed by the candidate, rather than implying every button is present in every state. The literal nonexistent shorten/skip references are removed. Current-build ledgers now identify **9a91101** (`00:123–125,300`, `05:25`, `12:83–85`); a committed-package search found no remaining 71807ed reference. AG-02's arithmetic annotation is recorded separately above.

## AG-07

**FINAL VERDICT: RESOLVED**

Tracing the initial-evaluation vectors through `11`'s governance diagram/Dimension 10, `12`'s scorecard, `13`'s hierarchical diagram/matrix and `14`'s authorization criteria gives compatible outcomes. Crash/lost-command-only stops at **REPAIR/RETEST** (`11:39–43`, `13:30–34,55–62`). Strong behavior with 40% preference gives **K6 KILL** (`11:249`, `13:63,274–278`). With 60%, Host PASS and no pivot-reason majority, the corrected preference gate (`13:84–94`) and ordered matrix (`13:264–272`) give **UX REPAIR/RETEST**; `11:248`, `12:146` and `14:74,87–88` block BUILD. With 80% and every other mandatory gate satisfied, **BUILD is eligible**. No diagram bypasses the ≥70% preference gate for the specified 60% vector. The decision tree retains the corrected no-workload-increase/K3 rule (`13:61,111,221–223`). Product authorization is not inferred from an invalid trial or a synthetic result.

## Twelve requested synthetic checks

Decision examples concern an initial evaluation, with all unspecified mandatory criteria satisfied; persistent unreliability or an already failed retest is not inserted into their evidence.

| # | Synthetic check | Exact independently observed outcome | Check |
|---:|---|---|---|
| 1 | Observe 06:30, remaining 1m; recalculate at 06:45 | Estimated end **06:31:00 at both evaluations** (HH:MM wall clock) | PASS |
| 2 | Observe 09:30, remaining 1m45s; recalculate at 09:45 | Estimated end **09:31:45 at both evaluations** | PASS |
| 3 | Active 23:58, target 5m; now next-day 00:06; anchor 00:05 | **1.0m deficit**, with the anchor normalized to the next day | PASS |
| 4 | Fact scores 4/5 and 5/5 | **80%/100%, pooled 90% → fact-validity PASS** in tasks, measurement, thresholds, result, decision and authorization | PASS |
| 5 | Collect configuration errors | **Task → M1 count → required `n_config_errors` → scorecard → ≤2 threshold → G0**; 2 permits PASS, 3 blocks G0 | PASS |
| 6 | TLX 50→53; significant recovery improvement; validity 100% | **FAIL Dimension 06 / K3**; no ±5 alternative | PASS |
| 7 | N_opp=0 | **N/A — INVALID FOR SCORING / RETEST REQUIRED**; no ratio, invented detection or silent PASS | PASS |
| 8 | Valid decision latency 20.0s | **LiveLift MARGINAL; baseline MARGINAL** | PASS |
| 9 | Crash/lost acknowledged command only | **REPAIR / RETEST**, without automatic product KILL | PASS |
| 10 | Strong behavior; preference 40% | **KILL K6** | PASS |
| 11 | Strong behavior; preference 60%; Host PASS; no pivot-reason majority | **UX REPAIR / RETEST**, BUILD blocked | PASS |
| 12 | Strong behavior; preference 80%; all mandatory gates PASS | **BUILD eligible** | PASS |

**SYNTHETIC CHECKS: 12/12 PASS.** The additional, directly scoped AG-02 command reproduction disproves the new 120s annotation; passing the twelve requested vectors does not remove that contradiction.

The previous V03/V07/V08 failure causes close for the baseline, fairness, scoring and decision clauses checked here. V01/V05 retain the AG-02 executable-script contradiction, so affected roadmap compliance remains FAIL. These are finding-dependent technical conclusions, not claims of completed participant or comparator studies. Previously accepted UI and AG-08/09 conclusions remain unchanged. The only outstanding technical correction is the finite branch annotation above. Participant trials, empirical G0 clearance and proof of product value are separate and have not been claimed; their absence is not the reason for this REPAIR result. Manual Orca acceptance remains required before any merge decision.

VALIDATION INSTRUMENTS: REPAIR

AFFECTED ROADMAP COMPLIANCE: FAIL

READY FOR MANUAL ORCA ACCEPTANCE: NO

READY FOR PARTICIPANT VALIDATION: NO

READY TO MERGE: NO
