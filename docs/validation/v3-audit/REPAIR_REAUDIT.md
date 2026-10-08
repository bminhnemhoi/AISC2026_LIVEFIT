# LiveLift V3 — focused independent repair re-audit

Date: 2026-10-06 (Asia/Ho_Chi_Minh). Reviewer: independent Codex.

The original blocker/high UI counterexamples are resolved within the approved browser-local scope. Native checks pass. UI-15 is partially resolved. The validation package repairs several important disclosures and definitions, but still contains contradictory instructions and scoring rules. It is not yet a technically valid participant instrument.

This is a re-audit of the 27 findings in `FINAL_AUDIT.md`, not a new Stage-2 audit. The previous audit remains immutable historical evidence. No participant trials have occurred; no result here establishes empirical product value.

## Frozen evidence and method

All four branch/HEAD/status checks matched before substantive review:

| Worktree | Branch | Frozen HEAD | Initial tracked status |
|---|---|---|---|
| `/home/towfienes/Projects/LiveLift-next` | `main` | `e4af76b` | Clean |
| `/home/towfienes/Projects/v3-validation-ui` | `orca/v3-validation-ui` | `71807ed` | Clean |
| `/home/towfienes/Projects/v3-validation` | `orca/v3-validation` | `3252477` | Clean |
| `/home/towfienes/Projects/v3-validation-audit` | `orca/v3-validation-audit` | `f5bb4ef` | Clean |

Untracked validation `.agents/**` was ignored completely. The repair diffs reviewed were `7a5e8b2..71807ed -- next` and `a7f58a4..3252477 -- docs/validation/v3`. The previous findings and frozen `CHECKLIST.md` were the test oracle; builder completion summaries were not evidence. Only affected roadmap conclusions were reconsidered.

Final pre-commit checks again matched all four frozen HEADs. Builder/main tracked files remained clean; the audit worktree contained only this new report. `FINAL_AUDIT.md` was byte-identical to `f5bb4ef` (SHA-256 `7194acd6a6bc667673f507e81012de505871838a484762b10d0dd3833430ea18`).

In the finding records, `UI:` paths are relative to the UI worktree at `71807ed`; numbered document names refer to `docs/validation/v3/` in the validation worktree at `3252477`. Line references identify the repaired sources. Structural exploration used the required codebase-memory skill with coverage checks; the reported missing lines in `PrepareRos.tsx` were read directly. Graph metadata was treated as a best-effort navigation aid, not proof of behavior.

### Independent checks

The UI package scripts were inspected first. An exact `git archive 71807ed next` copy in `/tmp/livelift-repair-reaudit/next` kept generated output and temporary auditor tests out of the builder worktree.

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 8 files, 177 tests |
| `npm run build` | PASS — production compilation, type checking and static generation completed |
| Temporary independent Vitest harness | PASS — 19 tests covering UI-01..14 and UI-17..18 |
| Targeted production Chromium checks | PASS — quota/reload, later cue report, partial coverage, blocked clone Start, keyboard product/pack inspection, backward-clock warning |
| 1280×720 buffered-risk layout measurement | Rundown visibility repaired; residual target/text sizes confirmed |
| Document formula/state/predicate dry-runs | Residual contradictions reproduced below |

The initial production-build attempt used a `node_modules` symlink outside the archive root, which Turbopack rejected. Replacing that harness symlink with a local dependency copy produced the successful build; this was not a target-code failure. Native checks were run before adding the temporary test file.

The independent test command was `./node_modules/.bin/vitest run src/__tests__/independent.reaudit.test.ts --reporter=verbose`. Temporary browser scripts served the compiled archive on port 3144. Temporary harnesses, browser states, measurements and the screenshot live under `/tmp/livelift-repair-reaudit/`; none are builder commits or participant data. Key inputs/results are recorded below so the report does not depend on those temporary files surviving.

Spreadsheet checks evaluated the specified arithmetic independently using Python's standard-library `Fraction`; they did **not** execute a Google Sheets workbook. Browser checks were specific reproductions, not a full keyboard, zoom, screen-reader, canvas or manual Orca acceptance campaign. There was no external TikTok research.

## UI finding verdicts

### UI-01 — Persistence failure acknowledgement

**PREVIOUS SEVERITY:** BLOCKER. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/store/sessionStore.ts:398` reads the authoritative envelope, applies the command, and writes before publishing success/in-memory state. A failed write returns rejected `not_persisted` with no committed event IDs. Draft/create writes also use guarded persistence. `operate/page.tsx:176,355` preserves failed intent and exposes an unsaved banner with explicit retry.
- **Independent reproduction/check:** Forced `localStorage.setItem` to throw on Start and an active note. Neither returned a committed receipt; memory and disk history stayed unchanged after reload. Restoring storage and explicitly retrying saved the action; repeating its idempotency key produced only one `session_started` event. The production browser note path displayed the unsaved banner and did not invent durable history.
- **Remaining risk:** Persistence remains subject to browser storage availability and retention. A failed operation must be retried explicitly; it is not acknowledged as saved. No database durability claim is inferred.

### UI-02 — Stale second writer overwrites history

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/store/sessionStore.ts:404,425,478` rereads stored records at mutation time and applies the existing revision guard against that state. Writing one session retains other stored records.
- **Independent reproduction/check:** Hydrated stores A/B at the same revision. A committed note A; before any storage notification, B submitted note B against its stale revision. B was rejected with `stale_revision`, and reload retained note A. Explicit retry against the refreshed revision retained A+B. Independent edits to different sessions retained both; a stale same-session draft edit was refused.
- **Remaining risk:** This closes the exact previously demonstrated sequential stale-tab race. Synchronous localStorage read/modify/write is not a true cross-process compare-and-swap or lock. Arbitrarily simultaneous interleavings are not certified, and a server/database is not required by this local-scope verdict.

### UI-03 — Recovery feasibility counterexamples

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/recovery.ts:154,534` selects compatible levers per segment and forecasts the resulting plan, including legal future end-by commitments.
- **Independent reproduction/check:** Both original vectors were reconstructed. (1) A target/minimum 12m, optional item target 5m/minimum 3m, anchor 11m, now 1m: deficit 360s, maximum clean savings 300s, `no_feasible_recovery`, no clean protecting option. Shorten 2m and skip 5m were not added together. (2) A target 10m/minimum 8m, anchor 9m, now 2m: `recoverable`; clean end-by at 9m produced zero anchor deficit. Since repaired Start correctly rejects initially infeasible plans, the harness started with a feasible later anchor and explicitly reanchored to reproduce the same runtime state.
- **Remaining risk:** Estimates and declared constraints are human inputs. This verifies the two arithmetic defects, not a guarantee about real host completion.

### UI-04 — Zero and unknown timing states

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/contracts/plan.ts:32` permits minimum zero; `contracts/session.ts:43` separately stores explicit remaining unknown. Engine/forecast and the estimate/editor controls distinguish unknown, no estimate, and known zero.
- **Independent reproduction/check:** Real SessionStore writes and rehydration preserved minimum `0`, absent estimate with `target` basis, remaining `0` with a known estimate/end at now and no actual segment end, and explicit unknown with `declared_unknown` basis. Clearing the estimate returned to target basis rather than retaining unknown.
- **Remaining risk:** Remaining zero is an estimate, not an automatic end or complete-coverage declaration. That distinction is preserved.

### UI-05 — Infeasible Next LIVE is Startable

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/plan.ts:175` makes known anchor infeasibility a blocker; `start_live` rejects invalid plans, and Prepare disables Start while retaining the draft for editing.
- **Independent reproduction/check:** Used the original minimum scenario and selected only the reviewed Zip Hoodie allocation change from 6m to 10m. The cloned draft existed, retained `anchor_infeasible`, and domain Start returned `plan_invalid`. The production Prepare browser showed a disabled Start button.
- **Remaining risk:** A blocked draft is deliberately retained for human repair. No optional future automated repair feature is required.

### UI-06 — Unresolved action blocks later independent reports

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/components/ops/CueBar.tsx:49` separates pending from attempted/unresolved work. `OperateDialogs.tsx:369` supplies a targeted report picker for planned cues, unresolved actions and new manual actions.
- **Independent reproduction/check:** Left Flash attempted/unverified, then recorded the later B product pin as performed and another unplanned action as attempted. The earlier attempt remained unresolved with unknown verification. The production browser picker captured B without requiring Flash to be falsely finalized.
- **Remaining risk:** Performed is a human report, not provider confirmation. The repair maintains that boundary.

### UI-07 — Duration silently implies complete coverage

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/engine.ts:418` records declared coverage or leaves it unknown. Recovery copy requests declaration when ending. `operate/page.tsx:242,615` opens a coverage dialog for the shortened/end-by transition and accepts explicit partial coverage plus follow-up text.
- **Independent reproduction/check:** End-by followed by a plain domain advance left coverage `null`, even when the minimum was met. Explicit partial coverage and unfinished-point text survived actual store reload. The production end-by/Next path opened the dialog and saved `partial` with “Unfinished fit comparison.”
- **Remaining risk:** Follow-up is manually recorded; automatic allocation into a later segment is not claimed or required. Time/minimum compliance does not establish content completion.

### UI-08 — Multiple active REAL shows

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/store/sessionStore.ts:412` checks other active REAL shows in the freshly read local envelope. Prepare exposes the active-show conflict.
- **Independent reproduction/check:** Two drafts and two hydrated stores: after A started the first REAL show, stale B's Start of the second returned `another_show_active` identifying the first. Reload had exactly one active REAL show. After explicitly ending the first, the second could start.
- **Remaining risk:** This is the approved same-browser-storage authority, with the same simultaneous-interleaving limitation as UI-02. It does not assert cross-device or database locking.

### UI-09 — Backward device-clock change

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/time.ts:115` and `lib/store/hooks.ts:72` retain monotonic displayed time using the browser timer and recorded-event floor. Operate exposes alignment uncertainty and an explicit event-recording action.
- **Independent reproduction/check:** A reading at minute 13 followed by device minute 11 one monotonic second later retained minute 13+1s and exposed a 121,000ms gap. In a REAL production-browser state, moving `Date.now()` back two minutes rendered the warning; explicitly recording it appended `clock_discontinuity`.
- **Remaining risk:** Device alignment is uncertain until corrected; this is disclosed, not synchronized to a trusted external clock.

### UI-10 — JSON-null hydration crash

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/store/sessionStore.ts:114,185,284` guards envelope shape before field access and quarantines invalid content before replacing it.
- **Independent reproduction/check:** Seeded the REAL storage key with literal JSON `null`, then hydrated a fresh store. Hydration completed with a “set aside” notice; quarantine retained the original `null` bytes instead of throwing.
- **Remaining risk:** If quarantine cannot be persisted, the original data is preserved rather than silently erased. This is a recovery boundary, not unlimited storage availability.

### UI-11 — Invalid numeric commands throw

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/engine.ts:1108,1143` validates finite/bounded command numbers before timestamp formatting or mutation.
- **Independent reproduction/check:** `commit_end_by` with `NaN` and `Infinity`, and reanchor with `Infinity`, all returned controlled `invalid_payload`; no exception or source-session mutation occurred.
- **Remaining risk:** None remaining in the original non-finite cases; this is not a new exhaustive payload fuzz audit.

### UI-12 — Imported product ID collision

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/products.ts:76` allocates unique IDs against existing and newly generated IDs. Prepare imports the valid batch without silently dropping colliding normalized IDs.
- **Independent reproduction/check:** Parsed `A-B\tFirst item\t0` and `A_B\tSecond item\t` together. Both products survived with distinct IDs; prices remained `[0, null]`.
- **Remaining risk:** Duplicate product codes can still be explicitly refused; refusal is distinct from silent loss of a valid differently coded row.

### UI-13 — Orphan cue/product reference

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/plan.ts:196,218` validates cue references and counts segment plus cue references. Prepare prevents removing referenced products; reporting validates the concrete target.
- **Independent reproduction/check:** A pin cue's product appeared in `productReferences`. Removing that product in an independently injected invalid state produced `cue_product_missing`; attempted report against it returned `invalid_payload`. The removal guard was checked in source.
- **Remaining risk:** Malformed historical data is rejected or surfaced, not made truthful by reporting an absent target.

### UI-14 — Incomplete actual called “Did not run”

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/review.ts:231,280` preserves incomplete outcome and recorded start separately from actual duration. `ReviewTable.tsx:182` displays “Started … · end not recorded” and unavailable duration.
- **Independent reproduction/check:** Removed a recorded end from an otherwise executed scenario interval. Review returned `incomplete`, `actual = null`, and the retained start; the display branch does not say “Did not run” or invent an end/variance.
- **Remaining risk:** The missing boundary remains unavailable until a truthful correction is supplied.

### UI-15 — Laptop layout, target sizes and readability

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** Operate's height-responsive command band restores the rundown. Estimate controls and support tabs now measure 44px high. Residual source sizes remain in `UI:next/src/components/ops/SimulatorStrip.tsx:37`, `RunOfShowLive.tsx:112`, `NowPanel.tsx:133,151,226`, `NextPanel.tsx:179` and `SupportTabs.tsx:82`.
- **Independent reproduction/check:** At 1280×720, buffered risk, 100% zoom, main scrollHeight/clientHeight were both 623px. Rundown started at y≈479 and had ≈229px height, with the current row visible; the previous outer overflow/≈69px visible rundown was closed. Estimate and support controls were 44px. Simulator controls and rundown cue Report remained 36px high; measured operational action text/metadata still included 15/14/13px. These fail the existing U08 44px targets and U02 ≥16px critical metadata/≥18px primary action text requirements.
- **Remaining risk:** Original ergonomic finding remains open for target/text sizing. This is a medium residual, not evidence of a clipped primary recovery action. No fresh full-canvas, contrast or zoom requirement was added.

### UI-16 — Dead pack inspection and mouse-only product cards

**PREVIOUS SEVERITY:** LOW. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/app/products/page.tsx:77,81,145` supplies focusable button semantics, Enter/Space activation and an Inspect Pack handler/dialog.
- **Independent reproduction/check:** In the production browser, focused product cards opened their dialog with Enter and Space. Packs → Inspect Pack opened the pack detail dialog.
- **Remaining risk:** This closes the named support-page defect; it does not certify the entire keyboard-only product journey.

### UI-17 — Unconfirmed fixture attribution in REAL

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/domain/engine.ts:172` defaults to “Local operator”; new-session UI offers an optional display name and explains local attribution. `fixtures/library.ts:5` marks `sample_library`, and new/Prepare/library views disclose sample names/prices before use.
- **Independent reproduction/check:** A fresh blank REAL session's Start event actor was “Local operator,” not Linh. Sample-source tags and the pre-Start notices were checked directly against the repaired creation/Prepare paths.
- **Remaining risk:** A display name is manually supplied local attribution, not authenticated identity. Sample inputs still require operator verification; disclosure is now explicit.

### UI-18 — Reset removes unrelated rehearsals

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `UI:next/src/lib/store/sessionStore.ts:591` resets the selected scenario. `app/simulator/page.tsx:133` offers “Reset this run”; environment-wide purge is a separate explicitly destructive action.
- **Independent reproduction/check:** Advanced/customized `sim-minimum`, reset buffered, then hydrated a fresh store. The unrelated minimum session remained serialized byte-identical.
- **Remaining risk:** An operator can still deliberately select the separate purge. That is not the ordinary isolated-run reset and is not a regression.

## Storage wording and authority check

**PASS for the requested current-storage wording.** `00_VALIDATION_PROTOCOL.md:138,179,191`, `05_LIVELIFT_TASK_SCRIPT.md:69` and `12_RESULT_TEMPLATE.md:99` describe the current UI as browser localStorage-backed SessionStore with guarded revision-checked persistence and reload rehydration. This agrees with the actual `71807ed` implementation and independent reload/failure/stale-write checks.

Every IndexedDB/OPFS/SQLite reference inspected is in an explicitly future Phase 1 objective, scope or authorization contract (`00` §10, `11` Gate G1, `13` §2.2, `14` §§3–4/sign-off). These are not attributed to the current build. No current database-grade transaction or true cross-process locking claim was found. This wording correction does not certify the future contracts or eliminate AG-06's remaining control/script mismatches.

## Validation-package finding verdicts

### AG-01 — Baseline formulas and dry-run coherence

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** `03_BASELINE_SHEET_SPEC.md:127,149,157,169,234` fixes the tab reference, missing variance, ordinary anchor waits, skipped-row propagation and compressible-only buffer calculation. However Q still compares time-only `MOD(NOW(),1)` to an unwrapped `M + G/1440`, while R compares that cursor to time-only anchor J. Its cross-midnight dry-run at line 253 tests actual duration O, not rolling Q/R. Merely offering a dated first cell at line 129 does not date the remaining actuals, anchors or current-time term.
- **Independent reproduction/check:** Ordinary early/wait and skipped-row arithmetic now pass; actual duration 23:58→00:03 correctly gives 5m. For the specified time-only forecast, active M=23:58, G=5m, now=00:06 gives Q's preceding finish at next-day 00:03, already 3m behind now. A next-day 00:05 hard anchor stored as time-only J gives R=1438m, whereas the correct active lower-bound deficit is 1m. Neither nested IF nor LET fixes this. The new remaining-estimate scenario also lacks a corresponding baseline remaining-input/formula path.
- **Remaining risk:** The claimed six-case parity does not establish coherent rolling midnight forecasts or scenario-input parity. Correct the complete time model and remaining-input path, then freeze an instantiated workbook with independent dry-runs. This review did not execute Google Sheets.

### AG-02 — One deterministic scenario ground truth

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** `04_TEST_SCENARIO.md` and `07_DISTURBANCE_TIMELINE.md` now give explicit remaining estimates: S1 at 06:30, remaining 1m; S2 starts 03:30 and at 09:30 has 1m45s remaining. Stockout exceptions and verbal-anchor/native-pin-lag separation repair the original impossible floor/40s-pin scoring. But `05_LIVELIFT_TASK_SCRIPT.md:198` still injects a 30s WoZ deficit; `06_BASELINE_TASK_SCRIPT.md:194` says R4=0.5m, and lines 232–234 retain the old 03:45/06:15/07:45 S2 sequence and 0.8m deficit. `00:118,282` retains old timing. `08:86`/`09:232` instead invent 45s remaining plus 1m pending MagSafe, although MagSafe already ran before S3; `09:230` still prompts at 06:15 rather than `04`'s 06:00.
- **Independent reproduction/check:** Canonical S1: 06:30+1m+3m=10:30, deficit 90s against 09:00. Extend-only gives 07:00+3m=10:00, deficit 60s; neither yields the retained 30s. Canonical S2: 09:30+1:45=11:15, deficit 45s. Old S2 start 03:45+5:30=09:15 is early against 10:30, so the old 07:45 red-deficit instruction is impossible. S1 lag/under-run timings also disagree: `07` uses 10:30/11:10/12:00, while `08`/`09`/`06` retain 10:35/11:15/12:15.
- **Remaining risk:** Proctors/operators/raters still cannot follow one frozen state sequence. Replace all derivative scripts/score keys with the same event ground truth, including actual participant-choice branches, before trials.

### AG-03 — M1–M11 and decision-dimension mapping

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** `08`/`11`/`12` now preserve M1–M11 identities and map Next LIVE to dimension 09, preference to 10, with repeat use separately under G1. Residual contradictions: `11:310` still allows G0 on 01–09 and calls Threshold 10 repeat use at line 315; `13:94` demands setup ≤180s/≤3 errors while `08:75`/`11:105`/`12` use ≤10m and ≤2m baseline penalty. `08:234`, `11:216,219`, `13:101` change combined review+plan PASS to ≤10m with ≤5m merely a target, against frozen CHECKLIST's ≤5m total. `14:69` checks next-plan time alone.
- **Independent reproduction/check:** Traced the metric/field/threshold/result/authorization crosswalk, not just ID counts. A synthetic feasible run with review=4m and next-plan=4m, accurate facts and ≥30% improvements, passes the new 10m envelope but fails the original 5m total. No approved threshold amendment was supplied. The task scripts give five review probes while `08`/`11` score a ten-probe denominator, leaving the administered/scored battery mismatched.
- **Remaining risk:** Stable names are repaired; gate predicates are not consistently mapped. Restore the approved combined budget or obtain a recorded amendment, and propagate a single setup/preference/fact-battery mapping to all ledgers.

### AG-04 — Deterministic scoring, denominators and missingness

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** `08:79` now requires correct identification; `08:100` and `11:130` retain total stimulus-to-action recovery as well as decision latency. Avoidable-message measurement, general zero-baseline comparison rules, and no-increase in anchor misses are restored. But `11:68` uses `N_disturbances` while `11:118` and `08:96` use scored trials. `08:305` requires non-null detection/action times and finite 0–120s latencies even for absent recognition/action. Validity and cue-comprehension ratios do not define empty denominators. Workload alternatives differ: `08:197` requires significant speed and validity improvement; `11:174` requires recovery significance only; `14:77` still requires significance on recovery and workload. All call ±5 points “no worse,” permitting increases absent an approved amendment.
- **Independent reproduction/check:** One timely D1 recognition in one trial with four required recognition opportunities is 25% under the disturbance denominator but 100% under a one-D1-per-trial interpretation. A missed detection/no action cannot be entered faithfully into the mandatory timestamp/latency schema without inventing a value. For baseline TLX=50 and LiveLift=53 with significant recovery improvement, `11` accepts the ±5 alternative even though workload is higher; `08` can reject the same row if validity improvement is not significant. Rechecked the repaired general 0/0→PARITY and positive-vs-zero→FAIL branches; those fixes are real.
- **Remaining risk:** Raters can still select different denominators/alternatives or lose unfavorable observations. Specify eligible opportunities, censoring/missing/no-action cases and zero decision/cue denominators, and use one approved workload predicate throughout. AG-02's inconsistent stimulus times also remain relevant.

### AG-05 — Fair tasks and neutral interviews

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** Both task scripts now assign matched post-show fact reconstruction plus feasible Next LIVE planning and time actual work; the baseline's extra native analytics/reconciliation burden was removed. `10_POST_TEST_INTERVIEW.md` repairs the original leading Q2.1/Q3.2/Q4.1. However `05:198` still supplies a facilitator-triggered deficit and prescribed recovery options, followed by “select Option 1 or Option 2”; `00:156,164` explicitly prohibits that coaching and says implemented software supplies options. `06:194` still sets baseline decision ≤25s against the condition-blind ≤15s observer rubric.
- **Independent reproduction/check:** Compared the same D1 operator/proctor steps and both post-show deliverables. Neutral interview prompts and matching post-show outputs pass. Literal S1 execution still gives LiveLift facilitator-generated/recommended options while the baseline operator calculates its response; the two latency rubrics remain different. `03` §8 also still states uncollected condition-specific baseline time penalties as established facts.
- **Remaining risk:** The repaired interview cannot neutralize the retained asymmetric assistance and expectations. Remove obsolete WoZ coaching, make permissible help identical/disclosed, and align the scored task rubric. This does not require removing legitimate implemented software assistance.

### AG-06 — Package matches UI 71807ed

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** The package now recognizes the implemented forecast/recovery/review/clone engines, guarded localStorage and reload recovery. Its current-vs-future storage wording passes the dedicated check above. However `00:134,135,140,141` and `05:27` cite nonexistent `report_cue_action`, `record_note`, `createNextLivePlan`, and scenario IDs `sim-1/2/3`; the target implements `report_cue`, `add_note`, `createNextSession`, and buffered/missed/minimum scenarios. `05:176,180,183` still instructs Accept recommendation/`accept-recommendation-btn`, `start-segment-btn`, and `quick-platform-report-btn`; these do not match the repaired controls. The old WoZ recovery drawer remains in the executable script.
- **Independent reproduction/check:** Compared the capability matrix and literal operator steps with exact source symbols/test IDs and the targeted production browser. Existing Advance, Report action and implemented recovery were operable; the cited obsolete controls were absent. Built-in sample fixtures are fashion products, not the matrix's claimed pre-supplied cosmetics/fashion/tech test catalog; the separate study catalog needs an explicit preload/authoring step.
- **Remaining risk:** A facilitator still has to improvise around the written script. Replace obsolete identifiers/actions and state how to prepare the study scenarios. Missing networking/native automation/future storage is not a UI defect; pretending unavailable controls work remains a package defect.

### AG-07 — One precedence-ordered decision

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** `13_BUILD_PIVOT_KILL_DECISION.md:27` now explicitly orders reliability repair before value judgment. T3/T4 first require REPAIR/RETEST, and the previous strong-results/40%-preference row now consistently gives K6 KILL at line 257. Those original counterexamples are repaired in `13`. However `11:21,38,44` still restricts outcomes to BUILD/PIVOT/KILL and routes any trigger, including command loss/crash, to automatic KILL/PIVOT. `13:209` makes any TLX increase K3 despite its own ±5-point workload PASS alternative at line 99. The 50–69.9% preference row at `13:251` allows choosing a Pivot A/B/C or UX repair/retest without one deterministic selection/fallback rule.
- **Independent reproduction/check:** Strong behavioral evidence with 40% preference now gives K6 KILL. Injecting only a crash/lost acknowledged command gives REPAIR/RETEST under `13`'s first gate but the incompatible KILL/PIVOT route under `11`'s global diagram. Synthetic TLX 50→53 with significant recovery benefit satisfies the declared workload alternative yet activates K3, making that accepted alternative unable to support BUILD under the stated precedence. Borderline preference has a blocked BUILD but no unique next result.
- **Remaining risk:** Retain the corrected reliability/value separation and make all diagrams/tables refer to the same mutually consistent predicates and fallback order. An engineering failure does not automatically prove product KILL; that correction must propagate beyond one document.

### AG-08 — Native/configured comparators and future scope

**PREVIOUS SEVERITY:** HIGH. **VERDICT:** PARTIALLY RESOLVED.

- **Evidence:** `01_PARTICIPANT_PROFILE.md:184` now mandates ≥2 professional-tool operators; line 189 requires an actual VN native walkthrough before laboratory trials. `14_PHASE1_AUTHORIZATION_CHECKLIST.md:56,60` requires recorded native/configured comparator evidence. Phase diagrams and authorization text now explicitly keep Phase 2 to one room and defer multi-room separately. However `01:190` and `14:64` cover only Seller Center/Opsique *internal telemetry/API* uncertainty, not Opsique product access/comparison or its unavailability as a workflow comparator.
- **Independent reproduction/check:** Traced recruitment requirements through the G0 ledger and future authorization. A ledger can certify inaccessible native API telemetry without checking whether the Opsique product can be evaluated; this does not satisfy frozen V04's “Opsique access/result or uncertainty” comparator record or master §21's accessible-comparison requirement. No external feature research was performed or needed to demonstrate the ledger omission.
- **Remaining risk:** Record Opsique product access and comparison result, or explicitly inaccessible comparison as uncertainty; do not equate lack of API telemetry with lack of comparator access. Native/professional studies are now required but have not been executed, which is an empirical prerequisite rather than a newly invented UI requirement. The one-room/multi-room scope repair passes.

### AG-09 — Synthetic examples versus collected evidence

**PREVIOUS SEVERITY:** MEDIUM. **VERDICT:** RESOLVED.

- **Evidence:** `01_PARTICIPANT_PROFILE.md` §7 labels the roster synthetic/not participant data and individual example statuses; `10_POST_TEST_INTERVIEW.md:182` labels the coding matrix and quotes synthetic; `12_RESULT_TEMPLATE.md` remains a blank collection instrument.
- **Independent reproduction/check:** Read the previously problematic roster and quote blocks in context. They no longer appear to be confirmed recruitment or actual interview results. No completed trial ledger/participant evidence was inferred from them or from builder signatures.
- **Remaining risk:** Actual recruitment, consent, trials and evidence collection still remain to be done. Synthetic disclosure resolves the honesty finding, not empirical validation.

## Affected roadmap compliance

These are replacements only for previous FAIL conclusions materially affected by the 27 findings. PASS here means the cited defect was closed in this checkpoint, not that every broader empirical/manual criterion has been executed.

| Row(s) | Re-audit | Finding-dependent conclusion |
|---|---|---|
| R01 | PASS | AG-08's one-room authorization/deferred multi-room correction is explicit. |
| R04 | PASS | UI-02/UI-08 close the original stale local authority and multiple-active-show cases; no cross-process lock certified. |
| R08 | PASS | UI-17 supplies honest local attribution and sample disclosure. |
| V01 | FAIL | AG-02/03/06 still prevent one consistent frozen instrument. |
| V02 | PASS | AG-09 closes example-as-confirmed-enrollment ambiguity; actual enrollment remains unperformed. |
| V03 | FAIL | AG-01/05 leave an incoherent baseline and asymmetric literal task instructions. Native walkthrough is required, not yet observed. |
| V04 | FAIL | Required ≥2 configured-tool operators are repaired; AG-08 still omits Opsique product-comparator access/result/uncertainty. |
| V05 | FAIL | AG-02's scripts and observation keys still disagree. |
| V06 | PASS | AG-09 closes synthetic-evidence ambiguity; existing consent/minimization is not re-audited or treated as executed trials. |
| V07 | FAIL | AG-04/07 leave scoring and outcome ambiguity. |
| V08 | FAIL | AG-03/04 retain unapproved combined-time/workload predicate changes and inconsistent mappings. |
| U02 | FAIL | UI-15's operational text remains below the existing size requirements. |
| U05 | PASS | Original UI-15 laptop-risk rundown/outer-scroll defect is repaired in the reproduced viewport. |
| U07 | PASS | UI-16's support-page keyboard/dead action defect is repaired; full keyboard loop still not certified. |
| U08 | FAIL | UI-15's 36px simulator/cue targets remain below 44px. |
| U10 | PASS | UI-01/10 expose save failure and recover invalid local storage without false acknowledgement. |
| J02 | PASS | UI-04/13 repair timing missingness and cue/product references. |
| J03 | PASS | UI-12 preserves both valid imported products. |
| J05 | PASS | UI-04 persists explicit unknown separately. |
| T01, S04 | PASS | UI-09 surfaces backward-clock discontinuity and keeps the inspected runtime clock monotonic. |
| T02, T09 | PASS | UI-04 permits and persists valid zero remaining/minimum. |
| T05 | PASS | UI-03/05 repair both recovery counterexamples and known-infeasible Start gating. |
| T07 | PASS | UI-04/11 distinguish unknown and reject non-finite commands safely. |
| T08, H05 | PASS | UI-07 preserves explicit/unknown coverage and partial follow-up without inventing completion. |
| T10 | PASS | UI-03's incompatible-savings and future end-by cases classify correctly. |
| H04 | PASS | UI-14 preserves incomplete actuals and truthful display. |
| H06 | PASS | UI-17 removes unconfirmed named-actor default. |
| I01 | PASS | UI-04/14 preserve zero, unknown and missing boundaries distinctly. |
| I12 | PASS | UI-01/02/18 close acknowledged-write loss, exact stale overwrite and unrelated-run reset loss in local scope. |
| I13 | PASS | UI-13 validates cue product references. |
| N03 | PASS | UI-05 retains an infeasible clone as a blocked draft. |
| C01, C02 | PASS | UI-01/02 honor guarded-write acknowledgement and revision rejection for the reproduced local cases; no database-grade atomicity claim. |
| C03 | PASS | UI-01/10 repair failed-write reload and null-envelope recovery. |

Other previous PASS/N/A/NOT VERIFIED conclusions were not reopened. In particular, actual repeat use (V09), full canvas/zoom/accessibility and human five-second/browser acceptance remain unverified where previously recorded. Optional Host View, server/team/networking and future Phase 1 database requirements were not converted into current UI defects.

## Remaining repair scope and final gate

The focused next repair is finite: finish UI-15's existing target/text sizing, make the baseline time/remaining-input model executable, propagate one scenario ground truth, restore or explicitly amend the approved scoring predicates, remove obsolete/asymmetric task instructions, reconcile every decision table/diagram, and add the Opsique comparator record. No unrelated new finding or broad redesign is opened.

Technical regression health passes, but the complete repaired checkpoint does not yet pass independent technical acceptance. Manual Orca/browser acceptance remains required before any merge decision even after these residuals are repaired. Participant readiness is NO because the instruments remain inconsistent, not because participant evidence was expected to exist already. No collected product-validation evidence exists and no product hypothesis is declared proven.

UI REPAIR: REPAIR
VALIDATION PACKAGE REPAIR: REPAIR
AFFECTED ROADMAP COMPLIANCE: FAIL
READY FOR MANUAL ORCA ACCEPTANCE: NO
READY FOR PARTICIPANT VALIDATION: NO
READY TO MERGE: NO
