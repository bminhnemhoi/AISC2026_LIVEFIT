# LiveLift V3 — final focused residual re-audit

Date: 2026-10-06. Independent reviewer: Codex.

**UI-15 is resolved; AG-08 is resolved; AG-01 through AG-07 remain partially resolved.** The remaining instrument contradictions prevent combined technical acceptance and participant validation readiness.

Exactly nine findings were reviewed against the residual oracle, `REPAIR_REAUDIT.md` at `9a930b9`. Review was limited to `71807ed..9a91101 -- next`, `3252477..717aba4 -- docs/validation/v3`, and necessary immediate consumers. Previously resolved findings were not reopened. No external research or builder repairs were performed.

Branch/HEAD/status checks matched before review and again before commit: main `main/e4af76b`, UI `orca/v3-validation-ui/9a91101`, validation `orca/v3-validation/717aba4`, audit `orca/v3-validation-audit/9a930b9`. Main and builder tracked files stayed clean. Validation's untracked helper artifacts were neither inspected nor used as evidence. The three protected historical documents remained byte-identical.

Native scripts were inspected and run once successfully on an exact UI archive in `/tmp/livelift-final-residual-reaudit/next`: `npm run typecheck`, `npm run lint`, `npm run test` (**9 files, 200 tests**), and `npm run build`. Production Chromium measurements and short independent standard-library calculations used only temporary artifacts. Spreadsheet arithmetic was evaluated from the specified formulas; an instantiated Google Sheets workbook was not executed. Graph coverage was checked; the reported `PrepareRos.tsx:96–97` gap was read directly. Source and observed behavior, rather than graph metadata or builder completion claims, determined verdicts.

Below, numbered references such as `03:195` identify documents in validation's `docs/validation/v3/` at `717aba4`; `UI:` identifies source at `9a91101`. All calculation rows and injected browser states are **synthetic auditor inputs, not participant evidence**.

## UI-15

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** RESOLVED

**Independent evidence:** The sizing changes in `SimulatorStrip`, `RunOfShowLive`, `NowPanel`, `NextPanel`, `SupportTabs`, shared buttons and dialogs close the named failures. Production Chromium at 100% zoom measured all six simulator controls at 44px high, inline Report controls at 44px high, critical desk metadata at least 16px, and primary recovery/Performed labels at 18px. No visible critical desk text below 16px remained; decorative, aria-hidden tile identifiers were excluded. NOW/NEXT/WHY/ACTION remained clearly distinguishable in the inspected 1280×720 screenshot.

At 1280×720, document scroll/client dimensions both equalled 1280×720; main scroll/client heights both equalled 623px. The current row occupied y594–659 inside the dedicated rundown scroller at y529–704 (175px high, content 601px). Independent scrolling and Return to current worked. The risk, recovery Apply and cue controls remained visible. At 1440×900 and 1600×1000, there was likewise no horizontal or outer vertical overflow; dedicated rundown heights were approximately 246px and 346px, and the current row and primary controls remained visible. This is targeted ergonomic verification, not full accessibility certification or manual Orca acceptance.

**Remaining blocker:** None for this residual.

## AG-01

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** PARTIALLY RESOLVED

**Independent evidence:** `03:124–136,183–238,255–263` correctly normalizes actuals and anchors to continuous dates. With stream start 23:55, active start 23:58, target 5m, now next-day 00:06 and anchor next-day 00:05, independent calculation gives **1m deficit**, not 1438m. Actual 23:58→00:03 gives 5m; missing end leaves actual duration and variance blank (`03:166,174`). Column V now represents the required remaining input: S1 at 06:30 with V=1 gives 90s; S2 at 09:30 with V=1.75 gives 45s.

However, both formula variants use **`NOW() + V/1440`**, with no estimate observation time (`03:116,195,217,230,245`). Leave S1's V=1 unchanged and recalculate at 06:45: the sheet projects Serum end 07:45 and deficit 105s; at 07:00 it gives 120s. The same estimate in the frozen UI retains end 07:30 and deficit 90s (`UI:next/src/lib/domain/forecast.ts:186–187`), independently reproduced in Chromium at 06:30 and 06:45. Even the correct Toner compression to 1.5m becomes 15s late on recalculation at 06:45 without new timing evidence.

**Remaining blocker:** The new remaining-input path continuously adds the same estimate again, changing the prescribed scenario and recovery result. Preserve its observation/deadline semantics, or explicitly define an equivalent executable update procedure, before baseline trials.

## AG-02

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** PARTIALLY RESOLVED

**Independent evidence:** The canonical state now agrees across `00/04/06/07/08/09`: S1 evaluation 06:30 + remaining 1m + Toner 3m gives Flash 10:30, **90s/1.5m deficit**; nominal lag injection 10:30, clear 11:10, under-run 12:00. S2 uses stockout 03:15, transition 03:30, prompt 06:00, evaluation 09:30, remaining 1m45s, projected end 11:15 and **45s/0.75m deficit** against 10:30. The 0.8m sheet display is the declared one-decimal rounding of 0.75m. Former stale timing/deficit uses and floating pending MagSafe arithmetic were removed; 11:15 remains a legitimate S2 projected end.

But `05:195` already extends Serum's target to 5m at 06:00; `05:199` still permits entering remaining **“or extends segment”** at 06:30 while demanding the same 90s alert. Independently injected equivalent production-UI states yielded: remaining 1m → **90s**; another Extend +1m → **120s**; retaining the earlier extension without an estimate → **60s**. These are different ground truths. AG-01 also changes the baseline state after the prescribed estimate entry.

**Remaining blocker:** Remove or precisely specify the incompatible Extend alternative and keep the remaining-estimate state stable across both conditions. The published timestamps alone no longer contradict; executable instructions still do.

## AG-03

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** PARTIALLY RESOLVED

**Independent evidence:** M1–M11 identities, Dimension 10 preference in G0 (`11:322–324`, `14:71–74`), separate G1 repeat use, setup ≤10m/≤2m baseline penalty, five administered/scored probes, and the **combined ≤5.0m** budget now agree in the principal crosswalk. Synthetic passing aggregate: setup B/A=5/5m, errors=0; recognition=100% within 5s; decision 20→10s and total 25→12s with significance; validity=100%; anchor variance=5s, critical misses=0; capture=1 command/2s, boundary errors=0; TLX 50→35 with significance; Host sub-study passes; review 8→2m, plan 8→2m, facts=5/5, feasible plans=100%, preference=80%, prerequisites satisfied. This satisfies the criteria across `08/11/12/13/14`. Changing only review and plan to 4m each preserves 50% improvement but makes total 8m: **G0 cannot pass in all five documents**. The old combined-budget defect is closed.

Residual crosswalk failures remain. `05:365` and `06:281` require ≥90% fact accuracy for full validity per submitted five-question sheet; `08:216`, `11:213–216`, `12:140`, `13:100` accept ≥80% per trial with ≥90% pooled. A paired 4/5 and 5/5 battery gives **80% in one trial, 9/10=90% pooled**: accepted by the latter criteria, below the task-script validity requirement. Also, ≤2 configuration errors exists in `13:94` but has no corresponding setup error field/threshold in `08/11/12`.

**Remaining blocker:** Propagate one fact-validity rule and one configuration-error collection/threshold mapping through the administered tasks, measurement, scorecard and gates. No new threshold or future functionality is requested.

## AG-04

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** PARTIALLY RESOLVED

**Independent evidence:** `11:123–127` defines eligible recognition opportunities and excludes unadministered/aborted trials; no detection uses null plus a disclosed 120s censored ranking value, and no action uses null/invalid recovery. `08:302–307` permits these observations without fabricated timestamps. Recovery's zero denominator explicitly fails; cue-comprehension zero means FAIL after dispatch failure or N/A when none planned (`08:121,189`, `11:141,200`). General zero-baseline arithmetic and the avoidable-message exception are explicit.

The requested workload vector still disagrees: baseline TLX=50, LiveLift=53, significant recovery improvement and 100% validity gives **FAIL/K3** under `08:199`, `11:181–189`, `13:99,209–211`; `12:135` still prints **“≥20% red. or +/-5pt”**, permitting PASS for the same +3 increase. The empty recognition case after all opportunities are excluded also leaves `N_opp=0` undefined; no explicit no-score/retest rule accompanies `11:123–131`.

**Remaining blocker:** Replace the stale workload scorecard alternative and specify empty recognition-denominator behavior. Most missingness repairs are real; scoring is still not fully deterministic.

## AG-05

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** PARTIALLY RESOLVED

**Independent evidence:** The obsolete WoZ recovery prescription has been replaced by product-generated recovery (`05:197–212`), which is legitimate assistance. Baseline and LiveLift still receive matching five-probe review and feasible Next LIVE tasks. `03` §8 now labels proposed timing costs as hypotheses rather than collected condition-specific penalties. `06:194` and `09:191,233` use the condition-blind 15s decision criterion.

However, the operational scoring rubric in `07:190–191` retains **≤15s LiveLift / ≤25s baseline**, with different marginal ranges. A synthetic 20s decision is baseline PASS under `07`, but MARGINAL under the condition-blind rubric and for LiveLift.

**Remaining blocker:** Align the retained disturbance rubric with the condition-blind rule. Removing facilitator coaching did not remove this scoring advantage.

## AG-06

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** PARTIALLY RESOLVED

**Independent evidence:** The repaired commands `report_cue`, `add_note`, `createNextSession`; scenario identities `sim-buffered`, `sim-missed`, `sim-minimum`; and controls `advance-btn`, `quick-add-note-btn`, `cue-report-btn`, `create-next-live-cta-btn` exist in the frozen source. Former Accept/start/quick-platform identifiers were removed. `05:75–80` explicitly prepares non-default cosmetics/tech catalogs through Prepare Import (`import-btn`/`parseProductRows`). Current storage wording remains guarded, revision-checked localStorage with reload rehydration; future storage requirements are not current capabilities.

But `05:138,209` names **`apply-shorten`**; the engine emits `kind: "shorten_pending"` (`UI:next/src/lib/domain/recovery.ts:444`), and `NextPanel.tsx:193` renders **`apply-shorten_pending`**. In the synthetic S1 browser reproduction, the actual shortening control existed and `apply-shorten` count was zero. The same list incorrectly abbreviates skip kinds. Certified feature ledgers still name UI **71807ed**, not the final 9a91101 (`00:123–125`, `05:25`, `12:83–85`).

**Remaining blocker:** Correct the executable recovery-control references and frozen UI attribution. A facilitator must not improvise nonexistent controls; this does not require changing the UI's implemented commands.

## AG-07

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** PARTIALLY RESOLVED

**Independent evidence:** Four synthetic vectors were traced through the relevant predicates and diagrams:

- **A — crash/lost acknowledged command only:** `11:39–43` and `13:30–34,55–62` now agree on **REPAIR/RETEST**, not automatic product KILL.
- **B — strong behavior, 40% preference:** `11:245` and `13:63,262–266` agree on **K6 KILL**.
- **C — TLX 50→53:** the final no-increase predicate gives **FAIL/K3**, but `12:135` still permits workload PASS, as reproduced under AG-04.
- **D — strong behavior, 60% preference, Host sub-study PASS, no pivot-reason majority, first evaluation:** `13:252–260` deterministically selects **UX REPAIR/RETEST**; `11:244` also blocks BUILD. Yet `13:63,69–79` tests only preference <50%, then its eight primary desk dimensions, then Host PASS, and reaches **BUILD**. Its diagram omits the ≥70% preference gate that its own prose (`13:41,102–103`) requires.

**Remaining blocker:** Propagate the corrected workload rule and preference fallback into every decision diagram/table. Reliability separation and the 40% vector are repaired; the 60% vector still yields incompatible next actions.

## AG-08

**PREVIOUS VERDICT:** PARTIALLY RESOLVED

**FINAL VERDICT:** RESOLVED

**Independent evidence:** `01:188–192` and `14:64–69` now require either accessible Opsique workflow evaluation with recorded result, or explicitly inaccessible comparator access recorded as uncertainty. Internal/API telemetry uncertainty is separately stated and cannot substitute for the workflow comparison. Native Vietnamese TikTok Shop walkthrough before laboratory trials (`01:189`), ≥2 professional-tool operators and completed professional substitute benchmarking (`01:184–187`, `14:56–62`) remain required. Phase 2 remains one-room/team authority (`14:169`); multi-room is deferred and separately authorized (`14:166`). No external comparator research was needed.

**Remaining blocker:** None for the instrument requirement. Actual walkthroughs, comparator evaluations and participant trials remain empirical work to perform.

## Affected roadmap and final decision

Only residual-dependent conclusions change: **U02/U08 PASS** after UI-15; **V04 PASS** after AG-08. **V01/V03/V05/V07/V08 remain FAIL** because the reproduced AG-01–07 contradictions persist. Other historical conclusions remain unchanged. This evaluates technical instrument readiness, not empirical G0 clearance or proof of LiveLift's product hypothesis. Manual Orca/browser acceptance remains required before a merge decision; no participant trials are claimed.

UI RESIDUAL: PASS

VALIDATION RESIDUALS: REPAIR

AFFECTED ROADMAP COMPLIANCE: FAIL

READY FOR MANUAL ORCA ACCEPTANCE: NO

READY FOR PARTICIPANT VALIDATION: NO

READY TO MERGE: NO
