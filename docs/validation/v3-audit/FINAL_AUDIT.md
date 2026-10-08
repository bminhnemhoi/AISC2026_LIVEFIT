# LIVELIFT V3 — Stage 2 final independent audit

Audit date: 2026-10-05. Reviewer: Codex, independent reviewer. **Executive verdict: REPAIR REQUIRED.** This is an audit of committed artifacts, not participant research, a repair, a Phase 1 authorization, or merge approval.

## AUDITED SHAs

| Input | Worktree and verified branch | Full audited commit |
|---|---|---|
| Baseline | `/home/towfienes/Projects/LiveLift-next` — `main` | `e4af76b3f76c8efd6f4d8cf4126fc99364154f5f` |
| ANTIGRAVITY package | `/home/towfienes/Projects/v3-validation` — `orca/v3-validation` | `a7f58a4581f6403e3228601d6131702f2e488b3f` |
| CLAUDE UI | `/home/towfienes/Projects/v3-validation-ui` — `orca/v3-validation-ui` | `7a5e8b2b1687c98f9739c823e7b414bc47ced58a` |
| Independent checklist | `/home/towfienes/Projects/v3-validation-audit` — `orca/v3-validation-audit` | `f3dd183ab2ff8e2c249a4c3e59d3e43ffcb1324b` |

Step 0 independently ran `branch --show-current`, `rev-parse --short HEAD`, and the requested `status --short` commands in the named worktrees. All four committed targets matched. Baseline, UI and audit worktrees were clean. ANTIGRAVITY's additional status check showed only untracked `.agents/`; those artifacts were excluded from evidence.

After the unexpected shutdown, the audit resumed from this untracked draft at `f3dd183`. All four branches and full SHAs were independently rechecked and still matched; main and both builders had no tracked changes. The incomplete step was final evidence verification/self-review and the report-only commit. Completed source, native-test, build and browser work was preserved. The recovery verification and loss of temporary attachments are recorded under TEST EVIDENCE below.

The authoritative reading order was the baseline master roadmap, the committed independent checklist, then all five canonical canvases. Supporting P0, validation, demo, next-action, product, architecture, evidence/replay and dated TikTok capability/API documents were read. The master roadmap overrides older server-first and broad-provider designs.

The package diff is exactly 15 added files, 5,035 lines. The UI diff is 73 files under `next/`: 37 added, 21 modified, 15 deleted; 11,200 insertions and 5,077 deletions. Review covered every changed path, all domain/store/contracts/scenario modules, the new components, every test file, and removed client/fixture behavior. It was not a page-only sample. Frozen contents were read with Git; test harnesses and builds that write output used `/tmp/livelift-stage2-audit`, never builder source edits. The archived UI's 79 tracked files were byte-compared against `7a5e8b2`: **zero mismatches**.

The installed `codebase-memory` skill was used for structural discovery, caller/callee tracing and snippets, including command dispatch, forecast, persistence and Next LIVE creation. Coverage checks covered relied-on paths. The two partial graph records, `next/src/app/integrations/page.tsx:65` and `next/src/components/ops/PrepareRos.tsx:95–96`, were covered by direct complete reads. Ignored/non-code records, including SVG, lockfile and canvases, were inspected directly. Graph coverage is a discovery aid, not proof of correctness.

Canonical files are baseline Git inputs. Their SHA-256 hashes are:

| Canvas under `.kombai/canvas/` | Frames read | SHA-256 |
|---|---:|---|
| `livelift_canonical_20261003_00_foundations.canvas` | 9 | `40352537c8a291eeb4879009907fc5b35177e7fbb812d773353db2f8950b0e91` |
| `livelift_canonical_20261003_03_journey.canvas` | 13 | `16ebe6b63207bb08acb0c4beeb0a111aac174a754cedab79573a9922662dab6b` |
| `livelift_canonical_20261003_05_prepare.canvas` | 12 | `e9a7243c5dfeace777d856d5709430b0af2e96eeaf3ecde0b64f500a661c48f7` |
| `livelift_canonical_20261003_06_operate.canvas` | 18 | `82c6593d5ad8f34e339c4b71b452bf9eee18d541d82791a276528aa6fccec7d4` |
| `livelift_canonical_20261003_08_review.canvas` | 12 | `ee33a0c05bd76c2033bea7a0877d3fca4160f4120d2cb38dafdfb8712d7e0cf5` |

## EXECUTIVE VERDICT

**REPAIR REQUIRED for both targets.** The UI delivers a substantial, functioning manual loop and mostly preserves the approved visual language. Nevertheless, acknowledged commands can be lost, stale local authorities can overwrite history, recovery feasibility is wrong in both directions, known-infeasible next plans can start, and truthful manual capture has gaps. These are demonstrated defects, not requests for a future backend.

The validation package is complete as a set of documents, but is not ready to produce a defensible BUILD/PIVOT/KILL decision. Its prescribed spreadsheet is mathematically inconsistent; scenario ground truth conflicts with its scripts; the metric dictionary, scorecard and decision document do not agree; and some instructions favor LiveLift. Its capability matrix describes the old prototype rather than the paired frozen UI.

A passing typecheck, lint, native suite and production build do not resolve those failures. No participant performance, professional-tool comparison, native-account walkthrough, repeat use or commercial superiority was established by this audit. These results block acceptance readiness; they do **not** establish that the product hypothesis should be killed.

## VALIDATION PACKAGE RESULT

**REPAIR.** All 15 required deliverables exist in the committed diff and were read:

| Deliverable | Main audit disposition |
|---|---|
| `00_VALIDATION_PROTOCOL.md` | Useful disclosure, counterbalancing and failure-recording structure; stale feature classification and inconsistent instructions — AG-02, AG-06. |
| `01_PARTICIPANT_PROFILE.md` | Relevant roles, recurring teams, skeptic/simple-show cases; professional challenge optional and example enrollment ambiguous — AG-08, AG-09. |
| `02_RECRUITMENT_SCRIPT.md` | Consent, recording disclosure, compensation and screening are usable foundations; actual recruitment is not verified. |
| `03_BASELINE_SHEET_SPEC.md` | Competence not established; prescribed formulas fail important states — AG-01. |
| `04_TEST_SCENARIO.md` | Concrete catalogs, minima and anchors; conflicting disturbance arithmetic — AG-02. |
| `05_LIVELIFT_TASK_SCRIPT.md` | Refers to deleted handlers and assisted behavior absent from this frozen UI — AG-06. |
| `06_BASELINE_TASK_SCRIPT.md` | Broken formula expectations and unequal post-show task — AG-01, AG-05. |
| `07_DISTURBANCE_TIMELINE.md` | State-relative approach is sensible, but clocks, deficits and lag scoring conflict — AG-02. |
| `08_MEASUREMENT_SHEET.md` | Useful raw fields and missingness intentions; definitions and metric IDs need correction — AG-03, AG-04. |
| `09_OBSERVER_CHECKLIST.md` | Useful synchronized observation structure; stimulus origin and condition-specific expectations differ — AG-04, AG-05. |
| `10_POST_TEST_INTERVIEW.md` | Leading comparisons and unlabelled example quotations — AG-05, AG-09. |
| `11_PASS_FAIL_THRESHOLDS.md` | Real negative gates exist, but Next LIVE is omitted and roadmap measures change — AG-03, AG-04. |
| `12_RESULT_TEMPLATE.md` | Blank results are appropriately unfilled, but metric numbering and feature certification are inconsistent — AG-03, AG-06. |
| `13_BUILD_PIVOT_KILL_DECISION.md` | Mutually inconsistent decisions and reliability/product-value conflation — AG-07. |
| `14_PHASE1_AUTHORIZATION_CHECKLIST.md` | Explicit conditional signatures are good; prerequisites and future scope are incorrect — AG-08. |

### M1–M11 versus “10 dimensions”

**Different counts alone are logically consistent.** One decision dimension can aggregate several metrics, and preference/repeat-use gates need not be timing metrics. However, the actual mapping is defective:

| Stable ID in `08` summary | Meaning | `11` threshold destination | Defect/qualification |
|---|---|---|---|
| M1 | Setup | 01 | Traceable. |
| M2 | Detection | 02 | Recognition definition is weaker than correct-anchor identification. |
| M3 + M4 | Recovery latency + validity | 03 | Legitimate grouping; latency origin differs from authoritative validation plan. |
| M5 | Anchor variance | 04 | Renamed M4 in `12`; pin/announcement ground truth conflicts. |
| M6 + M7 | Boundary errors + capture burden | 05 | Legitimate grouping; `12` M5 means capture instead of anchor variance. |
| M8 | Host coordination | 07 | `12` calls this M7; total messages replaces avoidable messages. |
| M9 | Workload | 06 | `12` calls this M6; workload alternative is removed. |
| M10 | Reconstruction/review | 08 | `12` calls this M8; total review-plus-plan budget is lost. |
| M11 | Next LIVE time + feasibility | **None** | Threshold 10 is repeat use, not Next LIVE adaptation. |
| Outside M1–M11 | Preference | 09 | Valid additional decision dimension. |
| Outside M1–M11 | Voluntary repeat use | 10 | Valid later G1 dimension, not a concept-test result. |

`08` additionally says “eight primary quantitative metrics,” lists eleven IDs, and uses ten numbered metric subsections by combining recovery speed/validity. That editorial count can be explained. The missing M11 gate and changing identifiers cannot. See AG-03 for the concrete failure and repair direction.

### Falsifiability

The package includes skeptical users, negative cases, no-benefit outcomes, counterbalancing, reliability disqualification and separate Host View evaluation. Those are useful. As committed, however, a poor baseline, prescribed recovery answers, leading interviews and ambiguous decision mappings can produce an apparent win or loss that does not measure the hypothesis. A concept pass must remain conditional on repaired instruments, frozen assistance, account/substitute evidence and actual observed results. Phase 1 is **not automatically authorized** by document completion or by this UI audit.

## VALIDATION UI RESULT

**REPAIR.** Independently observed working behavior includes:

- Manual creation, blocked empty rundown, editing, Start tracking, explicit segment commands, End tracking and Review.
- Forecasts from actual boundaries and explicit remaining estimates; downstream drift, waiting for hard anchors and visible missed anchors.
- Operator reports remain reports; attempts remain unresolved; no native action is automatically executed or confirmed.
- Immutable start baseline, appended plan versions, recorded events, separate actuals, late corrections and selected Next LIVE changes.
- New session/segment/cue identities, cleared execution history and unchanged source history after clone; successful ordinary reload.
- Three repeatable scenarios use the same domain engine as manual commands; REAL and SIMULATED histories occupy separate partitions.
- Exact unknown IDs show not-found rather than a fixture fallback.

The browser completed the buffered scenario, applied a recovery, reviewed its actuals, selected Opening 2m/A 9m and created a new plan with 1m before Flash Sale. It also created a fresh REAL session with a custom Vietnamese segment title, started with explicit schedule rebase, ended through the tracking confirmation and opened Review. No platform broadcast or native TikTok action was performed.

### Deleted behavior and retained requirements

| Removed/replaced behavior | Independent assessment |
|---|---|
| `fixtures/sessions.ts` canned runtime/replay/learning; old simulator timers and fallback snapshots | Replacement with event-derived review and actual domain execution is a substantial improvement. No requirement to retain canned “learning,” arbitrary elapsed time or convenient unknown-ID fallback. |
| `api/apiClient.ts`, `realtime/realtimeClient.ts`, `storage/draftStore.ts` and draft/capability contracts | No real server/provider authority is delivered or required for this checkpoint. Removing fake synchronization and volatile server-draft theater is acceptable. It does not excuse false local commit acknowledgements (UI-01/02). |
| Separate proposal Accept/Reject/Hold states | The master allows a direct Start to record decision and transition together. No unsupported requirement to rebuild ceremony around a deterministic next rundown item. Clock-only advancement does not perform a transition. |
| Independent presentation/native-action reporting and old general action dialog | Required manual reporting semantics were narrowed to preconfigured cues. Later cue reporting can be blocked, and unexpected native actions lack a structured target/action path — UI-06. |
| Dual knowledge lens and provider/late-metric fixture contracts | No provider ingestion or retrospective metric lens is currently offered. Missing advanced lenses are not Phase 1 blockers. Appended corrections preserve originals; no evidence supports claiming a full temporal/provider replay implementation. |
| Wrap page | Redirecting the local manual workflow into Review is acceptable; no real server-draft submission workflow exists to preserve. |
| Legacy route/simulator tests | Replacement tests cover more actual domain behavior, but some assertions explicitly accept defective states. Test count is not acceptance evidence. |

## ROADMAP COMPLIANCE

**FAIL overall.** The delivered product respects the narrow operational purpose and avoids privileged TikTok, scraping, AI, automatic execution, video/chat clones, GMV dashboards, generalized providers and team/server infrastructure. Locked authority/durability and timing semantics fail, and the package misstates future scope.

References below use the baseline master roadmap's section numbers and the checklist at `f3dd183`. `PASS` means the inspected behavior, not a production guarantee. `NOT VERIFIED` identifies an uncompleted acceptance dimension; `N/A` means its conditional feature is not delivered/claimed. Findings remain authoritative where a row includes both working and failing subcases.

| Check | Result | Evidence / limitation |
|---|---|---|
| R01 | FAIL | AG-08: future multi-room authorization conflicts with locked scope. |
| R02 | PASS | Validation, functional, backend and empirical gates remain distinct in this audit; package certification is not accepted as execution evidence. |
| R03 | PASS | No runtime TikTok/API/AI/scraper dependency; locally served manual/rehearsal paths exercised. Cold offline installation not certified. |
| R04 | FAIL | UI-02, UI-08: multiple local authorities/active shows. |
| R05 | PASS | Timing/recovery/actuals/next-plan dominate; no commerce analytics clone. |
| R06 | PASS | Native controls are external; no API entitlement inferred from native UI. Required account comparison still missing under V03. |
| R07 | PASS | Start/End explicitly describe tracking; cue report is not platform verification. |
| R08 | FAIL | UI-17: unqualified fixture identity/library facts in REAL flow. |
| R09 | N/A | UI Host View absent; package WoZ sub-study cannot establish functional synchronization. |
| V01 | FAIL | AG-02/03: frozen instruments contradict each other. |
| V02 | FAIL | AG-09: planned/example roster appears confirmed; no actual enrollment evidence. |
| V03 | FAIL | AG-01/05/08: baseline, matched tasks and account walkthrough. |
| V04 | FAIL | AG-08: professional challenge optional rather than required for at least two operators. |
| V05 | FAIL | AG-02: disturbance ground truth is inconsistent. |
| V06 | FAIL | Consent/data minimization exist; example evidence ambiguity remains AG-09. |
| V07 | FAIL | AG-04: timing definitions, denominators and zero baseline handling. |
| V08 | FAIL | AG-03/04: changed/omitted authoritative measures without approved amendment. |
| V09 | NOT VERIFIED | No actual three-team/three-session repeat-use evidence. |
| U01 | NOT VERIFIED | All five canvases/64 frames read; representative runtime comparisons below. Not an exhaustive screenshot pair for every conditional frame. |
| U02 | FAIL | Palette/Rubik/hierarchy retained; undersized operational metadata/actions — UI-15. |
| U03 | PASS | Focused Operate shell, stable identity/mode and separate End action in inspected flows. |
| U04 | NOT VERIFIED | Main 1280×720 controls/risk passed; exhaustive long-title/five-second human acceptance remains manual. |
| U05 | FAIL | UI-15: risk-state laptop rundown visibility and nested scroll. |
| U06 | NOT VERIFIED | No completed 23-item/200% actual browser-zoom acceptance run. |
| U07 | FAIL | Dialog focus tests passed; product-library cards lack keyboard activation — UI-16. Full keyboard-only loop not certified. |
| U08 | FAIL | Actual 36px/40px controls and 32px simulator controls; exhaustive contrast not measured — UI-15. |
| U09 | NOT VERIFIED | Labels, dialog roles and status regions inspected; no screen-reader session or complete reduced-motion runtime test. |
| U10 | FAIL | Honest image/price missingness works; storage failure/recovery remains UI-01/10. |
| J01 | PASS | Browser manual path and complete SIMULATED selected-clone path. |
| J02 | FAIL | UI-04/13: timing values and cue/product references. |
| J03 | FAIL | UI-12: valid import rows silently collapse. |
| J04 | NOT VERIFIED | NOW uses actual current segment; no timed independent five-second comprehension study. |
| J05 | FAIL | Deficit/nearest-anchor examples work; explicit unknown remaining cannot be represented — UI-04. |
| J06 | PASS | Plan/input/rule basis shown; no engagement or causal-sales invention. Arithmetic defects separately fail T10. |
| J07 | PASS | Explicit targeted commands; direct Start is permitted by master §6. |
| J08 | PASS | Waiting/virtual time alone does not execute segments or native cues. |
| T01 | FAIL | UI-09: backward device-clock discontinuity not surfaced. |
| T02 | FAIL | Valid zero remaining rejected; target-based fallback otherwise permitted — UI-04. |
| T03 | PASS | D01–D05 downstream arithmetic and executed-history guards. |
| T04 | PASS | Fixed anchors, max(cursor, anchor), waits and late branches; clock exception separately fails T01. |
| T05 | FAIL | UI-03/05: feasibility classification and Start gate. |
| T06 | PASS | Independent zero-duration cue vs full host segment, D08. |
| T07 | FAIL | UI-04/11: explicit unknown unavailable, invalid non-finite commands throw. |
| T08 | FAIL | UI-07: carry-forward/partial coverage not preserved through end-by UI path. |
| T09 | FAIL | Most floor/reorder exceptions guarded; specified minimum zero cannot enter/persist — UI-04. |
| T10 | FAIL | UI-03: both false-recoverable and false-infeasible statuses. Explicit re-anchor itself preserves baseline. |
| H01 | PASS | Baseline/current versions distinct under normal serial commands. |
| H02 | PASS | Actuals from this session's events, not canned replay; fresh custom REAL flow exercised. |
| H03 | PASS | Kernel refuses post-end runtime mutations; append-only corrections allowed. Store overwrite separately fails I12/C02. |
| H04 | FAIL | D02/D04 variances work; incomplete boundary mislabeled — UI-14. |
| H05 | FAIL | UI-07: implicit complete coverage following promised unfinished work. |
| H06 | FAIL | Event times/targets retained, but hardcoded actor attribution — UI-17. |
| H07 | N/A | No known-then/later provider lens; original correction targets retained. |
| H08 | PASS | One-run observation/trade-off distinction; no recurring/causal sales claim. |
| H09 | N/A | No recurring learning engine or REAL sample claim. |
| I01 | FAIL | Zero remaining/minimum and incomplete actuals — UI-04/14. Missing product price is correctly distinct from zero. |
| I02 | PASS | Planned vs actual separate. |
| I03 | PASS | Displaying suggestion does not accept it. |
| I04 | PASS | Recovery commitment does not perform a native action or actual end. |
| I05 | PASS | Attempt retains unknown outcome; no performed report synthesized. |
| I06 | PASS | Human report never generates provider observation. |
| I07 | N/A | No provider readback/confirmation path. |
| I08 | PASS | Pending/unverified action remains unknown, not failed. |
| I09 | PASS | Execution/history mode isolation and no REAL fixture fallback. Input attribution issue remains R08. |
| I10 | PASS | No causal-sales inference. |
| I11 | N/A | No external execution HTTP path; no transport-success-as-confirmation claim. |
| I12 | FAIL | UI-01/02 can lose acknowledged history; UI-18 broad rehearsal reset. Serial clone/re-anchor/correction checks pass. |
| I13 | FAIL | Pin/unpin enums distinct; cue product reference can become invalid — UI-13. |
| N01 | PASS | Exact reviewed source and baseline version used. |
| N02 | PASS | Selected changes applied; unselected changes absent; explicit trade-off selection. |
| N03 | FAIL | UI-05: unresolved clone conflicts still “Plan ready” and Start allowed. |
| N04 | PASS | New logical IDs/empty actuals/receipts/events. |
| N05 | PASS | Snapshot copies; original source byte-identical after browser clone. |
| N06 | PASS | SIMULATED clone stays SIMULATED; plan-only REAL creation clears execution. |
| S01 | PASS | All three fixed scripts repeat byte-identically in independent harness. |
| S02 | PASS | Shared domain engine/explicit virtual clock; REAL data survives simulator reset tests. Reset scope issue is UI-18. |
| S03 | PASS | Rehearsal labels persist through loop; no provider input required. |
| S04 | FAIL | Ordinary manual/virtual arithmetic agrees; REAL clock discontinuity exception UI-09. |
| C01 | FAIL | Pure kernel duplicate/stale/wrong-target/post-end checks pass; store race defeats stale protection UI-02. |
| C02 | FAIL | UI-01/02: no durable atomic success/single-writer result. |
| C03 | FAIL | Ordinary reload works; quota acknowledgement/null storage fail UI-01/10. |
| C04 | PASS | Local authority is disclosed; no fake server connection/replay queue. |
| C05 | N/A | No server draft/reconnect feature delivered. |
| C06 | N/A | No G2A team/backend claim established. |
| C07 | N/A | No G2B authorized enrichment established. |

## TEST EVIDENCE

`next/package.json` was inspected before execution. Environment: Linux, Node `v26.10.0`, npm `12.1.0`, Next `16.3.8`, React `19.3.0`, Vitest `3.2.7`. The environment is not a claim that the documented Node 22 deployment image was tested.

The following executions completed **before the shutdown**. They are prior independent observations, not new post-restart runs or builder completion claims.

| Exact command | Execution directory | Independent result |
|---|---|---|
| `npm run typecheck -- --incremental false` | `/home/towfienes/Projects/v3-validation-ui/next` | Exit 0. No TypeScript diagnostics; incremental write disabled. |
| `npm run lint` | Same frozen UI directory | Exit 0. No lint diagnostics. |
| `npm run test -- --cache=false` | Same frozen UI directory | Exit 0. 7 files, 123 tests passed. |
| `npm run build -- /tmp/livelift-stage2-audit/ui/next` | Same frozen UI directory | Initial isolation attempt failed: symlinked dependencies outside Turbopack root; second attempt with copied dependencies failed prerender with mixed Next roots. These setup failures are not treated as product defects. |
| `npm --prefix /tmp/livelift-stage2-audit/ui/next run build` | Same frozen UI directory | Exit 0 after using the archive's own dependency root. |
| `npm run build` | `/tmp/livelift-stage2-audit/ui/next` | Clean rebuild, exit 0, after moving prior `.next` aside and removing auditor test from build inputs. Compiled, typechecked, prerendered 9/9 static pages and generated all listed routes. |
| `npm run test -- --cache=false src/__tests__/audit.independent.test.ts` | Isolated archive, with temporary auditor harness | **Exit 1: 27 checks, 16 passed, 11 failed.** Failures independently establish the domain/store problems below. |
| `npm run start -- --hostname 0.0.0.0` | Isolated archive | Served the successful production build at port 3130 for primary browser review. |
| `npm run start -- --hostname 127.0.0.1` | Isolated archive | Served clean rebuild for fresh REAL/import review. Next warns to use its standalone server for deployment; no deployment/SLA certification inferred. |
| `node /tmp/livelift-stage2-audit/browser-flow.cjs` | Temporary auditor scripts | Exit 0; risk/recovery/Review at four desktop widths, focus checks, no page errors. |
| `node /tmp/livelift-stage2-audit/browser-next.cjs` | Temporary auditor scripts | Exit 0; selected clone, source immutability, reload, navigation; exposed dead Inspect Pack action. |
| `node /tmp/livelift-stage2-audit/browser-exceptions.cjs` | Temporary auditor scripts | Exit 0; unresolved cue blocks later cue; infeasible clone actually reaches active Operate. |
| `node /tmp/livelift-stage2-audit/browser-manual.cjs` | Temporary auditor scripts | Exit 0 in final run; fresh REAL creation/import/edit/start/end/review; import collision/minimum-zero and small controls observed. |

The 123 delivered tests comprise engine 25, timing 18, Next LIVE 13, scenarios 17, store 15, UI flow 29 and semantics 6. Each suite was inspected. UI tests use jsdom; their mocked element bounds cannot certify responsive layout. Native store tests accept in-memory committed state after write failure; native UI flow tests allow starting an infeasible plan. Thus those green assertions validate current behavior, not the independent requirements.

Auditor harness inputs use `2026-10-05`, `Asia/Ho_Chi_Minh`, explicit epoch instants, literal expected arithmetic and isolated localStorage. No expected value was copied from the tested algorithm. The 11 final failing checks are zero remaining, backward clock, two recovery classification cases, zero minimum schema, quota acknowledgement, stale writer, multiple REAL active sessions, JSON-null hydration, non-finite command handling, and implicit complete coverage after end-by. Clearing an estimate before its target is **not** reported as a bug: that command explicitly clears the estimate and may restore a labelled target-based projection. The separate required “explicitly unknown; disable target estimate” state is unavailable (UI-04).

The original temporary directory `/tmp/livelift-stage2-audit` was absent after restart. Its harnesses, screenshots and logs are **no longer available**. Results and reproduction inputs recorded before interruption remain embedded here; the lost attachments cannot be freshly inspected. Previously recorded SHA-256 values are retained only as provenance, not as newly verified files: native test log `0f108c28a2f10aa7b9147917f8f7669f40797a54d3f31fa37bbda938de07ab17`; clean build log `f89e5126818427ea92efa3ea04259019ec2819ab5fc24a98148a1aefffd5c584`; independent final log `77f7ff8d637518f15b0a831c830206b6a35d12ff442cdbe58bcb3a84ecdf5469`.

No builder tests or product source were repaired. Intermediate browser-driver selector/navigation errors were corrected only in temporary auditor scripts and are not product findings.

### Post-shutdown verification

Re-read the entire draft, checked its decisive assertions against the committed roadmap/checklist and builder contents, and verified all 83 numbered file citations resolve within the named files. Corrected the draft's authority/direct-command citations from roadmap §7 to §6, and independent-report citation from §9 to §8. No checklist change was necessary. All 27 finding IDs are unique; all 16 BLOCKER/HIGH entries have an owner, frozen SHA, exact files, evidence/reproduction, expected/actual behavior, requirement and repair direction. Separate root causes remain separate findings; there is no new finding based only on a hypothetical failure.

Reconfirmed ANTIGRAVITY's baseline formulas, both disturbance schedules, metric-to-threshold crosswalk, comparative tasks/interviews, stale capability claims, contradictory BUILD/KILL predicates and authorization requirements directly at `a7f58a4`. The package remains REPAIR independently of the UI result.

For the UI, extracted a fresh `git archive 7a5e8b2 next` into `/tmp/livelift-stage2-recovery`, using the existing installed dependencies. All **79 tracked files again matched the frozen commit byte-for-byte**. Only the temporary archive received an auditor test file. Exact command: `npm run test -- --cache=false src/__tests__/audit.recovery.test.ts`, executed from `/tmp/livelift-stage2-recovery/next`. **Exit 1: 12 checks, 2 passed, 10 failed**, with literal expectations calculated independently of the implementation:

| Recovery check | Newly observed result |
|---|---|
| UI-01, quota after healthy hydration | `committed / write_failed / memory active / disk planned`; required durable acknowledgement fails. |
| UI-02, two same-revision stores | Both notes acknowledged; second write removes the first note from disk. |
| UI-03, two feasibility cases | Optional savings reported as 420s instead of maximum 300s; legal protecting future end-by still labelled `no_feasible_recovery`. Two failures. |
| UI-04, declared zero values | Minimum 0 rejected by schema; remaining 0 rejected by command. Two failures. |
| UI-05, known infeasible draft | Start returns `committed` despite the recorded anchor conflict. |
| UI-07, end-by then ordinary Next | Promised unfinished work has no declaration/transfer; recorded coverage defaults to `complete`. This does not measure what a physical host actually covered. |
| UI-08, two REAL sessions | Both starts return `committed` in one store. |
| UI-10, JSON-null envelope | Hydration throws when reading `v`. |
| Positive control: reload and selected clone | Healthy reload preserves history; selected A duration becomes 540s in a new planned session with empty actuals/events; source remains byte-identical. PASS. |
| Positive control: clear estimate/overrun | Clearing the estimate restores labelled target projection; after target, remaining is unknown. PASS. |

The first recovery-harness run attached the quota mock to `Storage.prototype`, but the repository's test setup uses a plain storage object. That ineffective injection was corrected in the temporary harness to mock the actual `localStorage.setItem`; only the corrected run above supports UI-01. The final recovery log SHA-256 is `5d85f96d6e2efc8224fb4cf923a107f3adf74e98cfe8b70bd8b5e8e3631078a9`, at `/tmp/livelift-stage2-recovery/recovery-test.log`. This is temporary supporting evidence, not another committed deliverable.

The earlier full native suite, production build and browser review were not repeated: their frozen source is unchanged, and focused source/runtime verification reconfirmed the gate failures. Earlier visual measurements remain prior observations with lost screenshots; no fresh browser inspection is claimed after restart. The UI remains REPAIR, roadmap compliance FAIL, manual Orca acceptance readiness NO, and merge readiness NO.

## TIMING / DOMAIN EVIDENCE

Minutes below are relative to 20:00 unless a date is specified. `null` actual interval means missing/not performed, never a synthetic zero-duration execution.

| Vector | Independently calculated expectation | Observed result |
|---|---|---|
| D01 | At 09, A started 05 and has 7m remaining: end 16; Giveaway fixed 12, deficit 4m; Giveaway 16–19; B 19–27; A elapsed 4m. | Exact domain values pass. Upstream deficit is not repairable by shortening B. |
| D02 | Close A at 12: actual 7m, Giveaway 12–15, B 15–23. Separate close at 16: A actual 11m, +4m against original 7m; anchor still 12, missed 4m. | Timing/baseline pass. Coverage disclosure through ordinary UI is incomplete — UI-07. |
| D03 | Opening 3m, A 6m, 3m wait, Flash fixed 12/3m, B 8m, optional Q&A 3m/min 0, Closing fixed 26/4m. At 07, A needs 6m: end 13; original end 09 overrun 4; buffer 3 consumed; both anchors late 1m. | Exact engine projections pass with independently constructed vector. **Vector cannot be entered/persisted with min 0 through supported schema/UI**, UI-04; test construction does not conceal this defect. |
| D04 | A closes 12, actual 9 vs 6 = +3m. New selected Opening 2 + A9 ends 11, wait 1, Flash 12–15, B15–23, Q&A23–26, Closing 26–30. | Exact schedule, new identities and empty actuals pass; browser clone/reload and unchanged source pass. Automatic unfinished-point carry/partial coverage does not — UI-07. |
| D05 | B allocation 10 ends 25; Q&A3 ends 28, Closing 2m late. Shorten Q&A to 1 restores 26. | Pass; completed segment edits/reordering past executed work/anchor crossing rejected in checked cases. |
| D06 | B target=min 10; Q&A required target=min 3; Closing 2m late. No clean lever supplies 2m. | `no_feasible_recovery` and no clean protecting option pass for this vector. Other cases expose UI-03. |
| D07 | After A's target, at 13 without fresh estimate: unknown active end, earliest 13; Giveaway deficit at least 1m; B earliest 16. At 11 explicit unknown must disable target estimate. Explicit remaining 0 does not end A. | Post-target lower-bound propagation passes. Explicit unknown cannot be selected; explicit 0 rejected — UI-04. |
| D08 | A ends 16; parallel cue due 12 consumes no host time, so B starts 16. Full Giveaway instead occupies 16–19. | Pass. Cue report does not end A or confirm platform action. |
| D09 | At 07 A remaining 1 => end 08, wait 4. At 12 anchor has 0 projected deficit but no actual start; at 12:01 without action it is missed by 1s. | Pass; no early pull-forward or automatic start. |
| D10 | Skipped optional has no actual interval; correction adds a new receipt/time without replacing original. Incomplete boundary stays unavailable. | Domain null duration/variance and correction retention pass. Incomplete completed row is displayed as “Did not run” — UI-14. |
| D11 | Oct 5 23:58 +3m = Oct 6 00:01; anchor 00:02 gives 1m wait. Same instant produces same result. Backward wall-clock change must be surfaced. | Midnight/repeat calculation pass. At 13 the pending anchor is missed; querying clock 11 returns on_track and REAL hook has no discontinuity state — UI-09. |
| Optional lever overlap | A target=min 12; optional 5/min 3; anchor 11; now 01 => projected 17, deficit 6. Maximum clean saving from optional is 5, not 5+2. | Reports maximum 7 and `recoverable`, although clean choices leave 1m or 4m deficit — UI-03. |
| Future floor-respecting recovery | A target 10/min 8 starts 00; now 02; anchor 09. Commit to end 09 gives actual allocation 9 ≥8, saves 1 and protects anchor. | Clean protecting end-by exists, but status is `no_feasible_recovery` — UI-03. |
| Explicit re-anchor | Original anchor 12, recorded new commitment 16; actual start 16. | Original baseline 12 retained and Review reports 4m late relative to original. Explicit change is not retroactive recovery. |
| Duplicate/stale/post-end | Same command key applies once; old expectedRevision rejected; wrong segment rejected; ended execution immutable. | Pure kernel passes. Concurrent store snapshots bypass this protection — UI-02. |
| Clone after completion | Selected source baseline plus approved changes; new draft, new IDs, no copied runtime/events/receipts. | Pass in kernel/native tests/browser, apart from infeasible readiness UI-05. |

Reproduction helpers for domain findings: construct a REAL session with `createSession`, epoch `Date.UTC(2026, 9, 5, 13)`, named segments from `newSegment`, and call `applyCommand` with explicit `nowMs`; inspect `receipt`, `forecastSession`, `analyzeRecovery` and `buildReview`. For store races use two `new SessionStore()` instances, hydrate both before dispatching the two writes. This exercises delivered functions without modifying frozen source.

## VISUAL / RESPONSIVE FINDINGS

Actual runtime inspection was available and completed before the shutdown. Browser: headless Chromium `153.0.8010.12`, Playwright from the installed CLI package, Linux, isolated browser contexts, locally served production build. The unavailable Chrome MCP executable was not treated as “browser tested”; installed Playwright Chromium supplied the actual inspection. These observations were preserved during recovery; the browser was not rerun afterward.

| Viewport | Observed behavior |
|---|---|
| **1280×720** | NOW/NEXT/WHY, main action, extension and imminent anchor warning visible at 100%. Risk/recovery expands command band to about 374px. Main viewport 627px has 714px content; rundown starts at y≈651 and extends to≈795, leaving only its first portion on screen until outer scrolling. It also has its own internal scroll. Recovery-options dialog y≈48–673 fits. Next-plan creation fields/CTA require ordinary vertical scrolling. |
| **1440×900** | Risk-state main container does not overflow vertically; roughly 201px rundown area. Review and Next LIVE remain usable. |
| **1600×1000** | Roughly 301px rundown area; extra space adds operational rows. No observed horizontal overflow. |
| **1920×1080** | Operate roughly 381px rundown area; main controls and warnings remain visible. No unrelated analytics panels introduced. |

Rubik loaded successfully (`document.fonts.check('16px Rubik') === true`); Vietnamese text rendered in the fresh manual session. Graphite surfaces, restrained lime primary actions, violet rehearsal/evidence accents, amber warnings and controlled red are retained. The desk remains the flagship, not a KPI wall, TikTok analytics clone, neon/glass dashboard or internal epistemic wall. There is no basis to reject the visual language wholesale.

The buffered demo flow's primary timer hierarchy is readable. Dialog opening focus, Tab progression, wrap from last to first focusable control, Escape and return to invoking control were checked. Unresolved cue and recovery dialogs fit the laptop viewport. No page errors occurred in the completed main browser flows. “Inspect Pack” is dead; product cards lack keyboard activation. Smaller host-estimate/history controls do not meet the canonical target size. See UI-15/16.

### Canvas-to-runtime comparison

All 64 embedded frame payloads/text/layouts were read. The following identifies representative exact frame IDs; comparisons concern approved language and task hierarchy, not pixel equality.

| Canvas | Representative frame IDs | Runtime comparison / scope disposition |
|---|---|---|
| Foundations | `node_6b4949ac3feb` chosen B; `node_bc05877d8cfd` semantics; `node_0cd59c916a7e` responsive; `node_0e2934b02252` interaction | Palette/type/focus intent preserved; density and target-size deviations UI-15. |
| Journey | `node_a781baaa3a1e` empty home; `node_891966e8406d` create; `node_c06a575fb556` sessions; `node_5ac6214b8c3d` products; `node_51b854b138d0` integrations; `node_feda44dd37f9` simulator; `node_4fd492091b3c` clone | Routes exercised. Fresh empty state, manual creation and simulation lineage work. Product support controls have UI-16. Server unsynced-draft frame is outside delivered local authority. |
| Prepare | `node_b9f0fd9d2e00` 1280; `node_f79a831fe3c8` 1440; `node_1e5125937cea` 1600; `node_8c94ef028518` 1920; `node_f5bb8921eb01` empty; `node_97ec2cecb2a6` blocked; `node_bd310d4b5ab8` import | Real empty/blocked/import and SIMULATED planned/derived plan inspected. Three columns at laptop differ from compact-bottom readiness intent but remain usable; readiness semantics fail UI-05. |
| Operate | `node_1ddf0e104293` 1280; `node_279f3b641c9d` 1440; `node_cf644009ac7b` 1600; `node_e48b4e113909` 1920; `node_7a93c08711f6` unknown; `node_4bea04f72dfc` end; `node_0dca77d103c9` simulated; `node_5aad2abee56b` history | Active/risk/recovery/unknown-report/end and all four widths inspected. Direct Start replaces separate acceptance consistently with V3. Assistant/handoff/provider reconnect frames are not implemented and not P0 defects. |
| Review | `node_2373c31aedc6` 1280; `node_d1d5c98542e5` 1440; `node_11494dbe3762` 1600; `node_54f8e0105eba` simulated; `node_4482e59a4f81` learning; `node_7b0b6b290b62` clone | Actual Plan vs Actual and selected feasible/infeasible next-plan paths inspected. V3 operational changes replace canned learning; provider conflict/later-evidence lenses not claimed. |

Screenshots captured before shutdown included `prepare1280.png`, `operate-risk-{1280,1440,1600,1920}.png`, `options1280.png`, `review-{1280,1440,1600}.png`, `next-{1280,1440,1600}.png`, `infeasible-prepare1280.png` and `cue-blocked1280.png`; those temporary files were lost on restart. Not completed: exhaustive frame-by-frame screenshot pairs, a screen-reader session, full keyboard-only end-to-end flow, 23-item stress layout, actual 200% browser zoom, or a measured full contrast matrix. These remain explicit manual acceptance items; this report does not pretend they passed.

## BLOCKING FINDINGS

All file paths below are repository-relative. `AG-*` paths belong to **a7f58a4 / ANTIGRAVITY**; `UI-*` paths belong to **7a5e8b2 / CLAUDE**. Severity is the impact on this checkpoint. Every item in this section requires repair before acceptance readiness.

### AG-01 — The prescribed baseline is not a competent working timing sheet

- **Severity / owner / affected SHA:** HIGH / ANTIGRAVITY / `a7f58a4`.
- **Files:** `docs/validation/v3/03_BASELINE_SHEET_SPEC.md:42,127,148,154,161,167,178,189,211`; `docs/validation/v3/06_BASELINE_TASK_SCRIPT.md:67,97,193`.
- **Evidence and reproduction:** Implement the specification literally. The tab is named `00_Config`, but formulas reference `Config!$B$1`. Actual start/end are time-only `Ctrl+Shift+;` entries, while projection compares them to date-and-time `NOW()`. Q's pending cascade adds G without holding at each hard anchor or excluding SKIPPED rows. With a prior cursor 08:00 and hard anchor 09:00, the anchored segment can project 08:00. A skipped 3m row still consumes 3m. `O2` returns formula `""` for missing boundaries; `ISBLANK(O2)` is false, so P's subtraction is evaluated instead of preserving missing variance. Summary `SUM(G)-SUM(F)` counts non-compressible differences: the prescribed scenario yields 7m, not the asserted 5m clean buffer.
- **Expected:** A reproducible baseline with dated clock arithmetic, correct anchor waits/skips, protected original plan and missing actuals; identical floor/compressibility rules to the scored task.
- **Actual:** Formula specification itself fails those states. The audit did not execute a real Google Sheets workbook, and no such runnable committed workbook is supplied; these are directly identifiable formula/specification defects, not measured participant disadvantages.
- **Requirement:** Master §§21/30; checklist V03, I01, T03/T04; competent spreadsheet/chat comparator.
- **Repair direction:** Correct and instantiate the baseline, then independently dry-run normal/late/early/skipped/missing/cross-midnight cases. Freeze the tested workbook/version and equalize task burden before participants.

### AG-02 — Disturbance ground truth conflicts with its own schedule

- **Severity / owner / affected SHA:** HIGH / ANTIGRAVITY / `a7f58a4`.
- **Files:** `docs/validation/v3/04_TEST_SCENARIO.md:71–73,190–191,233,246`; `docs/validation/v3/05_LIVELIFT_TASK_SCRIPT.md:200–212`; `docs/validation/v3/06_BASELINE_TASK_SCRIPT.md:231–238`; `docs/validation/v3/07_DISTURBANCE_TIMELINE.md:91,96–98,115,128–134`; `docs/validation/v3/08_MEASUREMENT_SHEET.md:84,117–126` (all under `docs/validation/v3/`).
- **Evidence and reproduction:** Scenario 1 instructs Extend +1m at 06:00: A now ends 07:00, then Toner 3m gives Flash 10:00 versus 09:00, a 60s deficit; the 06:30 alert is prescribed 30s. Scenario 2 pulls S3 to 03:45 with target 5.5m: projected end 09:15, **75s before** 10:30; at 07:45 it prescribes a 45s deficit without a remaining estimate that would produce it. S3+1:15 is 05:00 after that pull-forward, not the simultaneously prescribed 06:15. Scenario 2's 10:30 pin is deliberately stalled 40s; M5 requires announcement **and pin**, so earliest compliance 11:10 is a 40s critical miss while the script demands ≤15s. Scenario 1 stockout after 1:15 demands stopping within 15s, below S4's 2m floor; ordinary floor-valid scoring has no matching explicit exception.
- **Expected:** One deterministic state/time rule per disturbance, coherent forecasts, feasible scored responses or explicitly scored unavoidable exceptions, and distinct announcement/pin ground truth.
- **Actual:** Operators/proctors cannot follow all instructions and earn a valid score. Row references also disagree (`R3`/`R4` versus the actual flash row 5).
- **Requirement:** Master §§11/21; checklist V01/V05, T04/T09; fair reproducible disturbance timing.
- **Repair direction:** Recalculate both scenarios from a single event schedule, freeze state-relative triggers and explicit remaining estimates, and separate controllable host timing from deliberately unavailable native execution. Do not hand-script the desired winner's response.

### AG-03 — Metric identity and Next LIVE decision mapping are broken

- **Severity / owner / affected SHA:** HIGH / ANTIGRAVITY / `a7f58a4`.
- **Files:** `docs/validation/v3/08_MEASUREMENT_SHEET.md:42–62,190–223`; `docs/validation/v3/11_PASS_FAIL_THRESHOLDS.md:55–99,218`; `docs/validation/v3/12_RESULT_TEMPLATE.md:217–223`; `docs/validation/v3/13_BUILD_PIVOT_KILL_DECISION.md:83,148`.
- **Evidence and reproduction:** Trace M5 from measurement to results: anchor variance becomes M4. M6 boundary error becomes workload in the result table. M11 has its own next-plan speed/feasibility target but no scorecard threshold. The decision document calls Threshold 10 Next LIVE, while `11` defines it as repeat use. A trial can pass review within 5m and fail/omit next-plan creation without failing the listed review threshold.
- **Expected:** Stable IDs, every measured metric mapped to its actual gate, and total review+next-plan ≤5m with feasible changed plan.
- **Actual:** Aggregating eleven metrics into ten dimensions is potentially valid, but this implementation drops a central measured outcome and changes identifiers. This is a real mapping defect, not merely a count typo.
- **Requirement:** Master §§21/23/30; checklist V07/V08/N03 and its frozen threshold table.
- **Repair direction:** Publish one stable metric-to-field-to-threshold-to-decision crosswalk; include Next LIVE correctness and combined task time; validate the worksheet with both passing and deliberately failing synthetic rows clearly labelled as such.

### AG-04 — Scoring can change the result without a behavior change

- **Severity / owner / affected SHA:** HIGH / ANTIGRAVITY / `a7f58a4`.
- **Files:** `docs/validation/v3/08_MEASUREMENT_SHEET.md:79–110,155–188,225–259`; `docs/validation/v3/09_OBSERVER_CHECKLIST.md:188–190,230–234`; `docs/validation/v3/11_PASS_FAIL_THRESHOLDS.md:72–92,151–209,280`; `docs/validation/v3/14_PHASE1_AUTHORIZATION_CHECKLIST.md:56–64`.
- **Evidence and reproduction:** `09` records D1 stimulus at 04:30, while `08` starts detection at 06:30: identical recognition at 06:35 scores 125s or 5s. Looking at a red cell/reaching for a mouse qualifies as detection without correctly identifying the at-risk anchor. Recovery clocks start at detection, omitting pre-detection delay from injection-to-feasible-recovery. Percentage formulas divide by baseline with no defined zero-baseline branch; a 0-message baseline yields undefined reduction. Host benefit uses total messages instead of avoidable timing/next-cue messages. Workload requires 20% reduction and p<.05, deleting the roadmap's no-worse-with-recovery-benefit alternative. No-increase in cue misses versus baseline is not retained as an explicit pass condition.
- **Expected:** Same observable start/stop and correct-answer criteria, paired denominators/zero handling, authoritative metrics or an approved preregistered amendment.
- **Actual:** Raters can legitimately compute different outcomes; several gates silently change the hypothesis test. The unsupported power assertion is not accepted as evidence of an adequately powered experiment.
- **Requirement:** Master §21; baseline `docs/research/codex-gap-study/14_USER_VALIDATION_PLAN.md`; checklist V07/V08 and thresholds at CHECKLIST:99–108.
- **Repair direction:** Freeze scoring events and denominators, record correct anchor/feasible action, retain missing/zero separately, implement the specified alternatives and disclose small-sample limits. Obtain explicit approval for any intended threshold change before trials.

### AG-05 — Baseline tasks and interviews bias the comparison

- **Severity / owner / affected SHA:** HIGH / ANTIGRAVITY / `a7f58a4`.
- **Files:** `docs/validation/v3/05_LIVELIFT_TASK_SCRIPT.md:340–399`; `docs/validation/v3/06_BASELINE_TASK_SCRIPT.md:248–274`; `docs/validation/v3/09_OBSERVER_CHECKLIST.md:231`; `docs/validation/v3/10_POST_TEST_INTERVIEW.md:126–161`.
- **Evidence and reproduction:** Baseline post-show instructions prescribe 5–10m restoration, 15–25m analytics/chat reconciliation and 10–15m reporting, including native analytics work; the LiveLift task inspects prepared review/assisted next-plan output. An equivalent timed baseline next-plan deliverable is not specified. Interview Q2.1 asks how stressful spreadsheet juggling was; Q3.2 contrasts detailed Zalo text with a “clear” LiveLift cue; Q4.1 assumes overwritten spreadsheet actuals. Observer criteria also assign condition-specific expected decision latencies.
- **Expected:** Same output/questions and information access, equal training, neutral prompts, actual task duration measured rather than prescribed, symmetric assistance disclosure.
- **Actual:** Baseline receives additional work and unfavorable premises. The repeated claim that reconstruction requires 30–60m is not independent evidence from these trials.
- **Requirement:** Master §§21/30; checklist V03/V06/V07; unbiased participant/research instructions and falsifiability.
- **Repair direction:** Give both tools the same short fact-and-feasible-next-plan task; time actual work; standardize assistance; replace evaluative interview language with neutral event-specific probes; score without tool-specific expectations.

### AG-06 — Package instructions do not describe the frozen implementation

- **Severity / owner / affected SHA:** HIGH / ANTIGRAVITY / `a7f58a4` (compared with UI `7a5e8b2`).
- **Files:** `docs/validation/v3/00_VALIDATION_PROTOCOL.md:129–149,191`; `docs/validation/v3/05_LIVELIFT_TASK_SCRIPT.md:27–29,71,112–150,350,411–413`; `docs/validation/v3/12_RESULT_TEMPLATE.md:97–103`.
- **Evidence and reproduction:** Follow references to `simulatorEngine.ts`, `draftStore.ts`, `realtimeClient.ts`, `FIXTURE_REPLAY_EVENTS`, Hold proposal, Choose next override/resume skipped work, unsynced Wrap submission or known-then toggle. Those old files/flows were deleted/replaced. The package says no dynamic forecast/recovery/selected clone engine exists and refresh clears all actuals; the frozen UI implements these modules and ordinary persistent reload, independently demonstrated here.
- **Expected:** Per-capability classification tied to the exact build, separating implemented software from simulated inputs and facilitator assistance. Unavailable actions must not be instructed as working controls.
- **Actual:** Neither operator nor proctor can execute the package literally against this build. WoZ assistance can duplicate or replace implemented behavior and contaminate measured timings.
- **Requirement:** Master §§10/21/23/30; checklist R02/R08/V01/V05; IMPLEMENTED/SIMULATED/WIZARD-OF-OZ/NOT AVAILABLE honesty.
- **Repair direction:** Reconcile the capability matrix and scripts against the next frozen UI; name implemented functions, mode/data provenance, unavailable features and exact permitted assistance separately. Do not call a simulated input an unimplemented algorithm or a working algorithm provider verification.

### AG-07 — The same evidence can select both BUILD and KILL

- **Severity / owner / affected SHA:** HIGH / ANTIGRAVITY / `a7f58a4`.
- **Files:** `docs/validation/v3/13_BUILD_PIVOT_KILL_DECISION.md:74–84,173–207,227–230`; `docs/validation/v3/11_PASS_FAIL_THRESHOLDS.md:263–270`; `docs/validation/v3/14_PHASE1_AUTHORIZATION_CHECKLIST.md:42–74`.
- **Evidence and reproduction:** Enter strong timing/workload results but 40% operator preference. Section 2 requires 100% of criteria including ≥70% preference; K6 says <50% is KILL; the synthesis matrix's behavior PASS/preference NEGATIVE row says BUILD with UX refinement. K5 maps any zero-tolerance prototype crash to irreversible KILL/archival, while the master treats reliability failure as a release block requiring repair, distinct from disproving value.
- **Expected:** One precedence-ordered decision for the same evidence; failed reliability cannot be bypassed by preference and does not alone prove no product need.
- **Actual:** Conflicting outcomes permit selective interpretation. Formal signatures are conditional, but the predicate being signed is inconsistent.
- **Requirement:** Master §26; checklist V07/V08; BUILD/PIVOT/KILL must follow measured evidence.
- **Repair direction:** Define mutually exclusive predicates and precedence; distinguish REPAIR/RETEST from product KILL; require all mandatory value/comparator gates and preserve negative cases. Dry-run contradictory/borderline evidence before freezing.

### AG-08 — Authorization omits required comparisons and misclassifies multi-room scope

- **Severity / owner / affected SHA:** HIGH / ANTIGRAVITY / `a7f58a4`.
- **Files:** `docs/validation/v3/01_PARTICIPANT_PROFILE.md:185–189`; `docs/validation/v3/11_PASS_FAIL_THRESHOLDS.md:303–315`; `docs/validation/v3/13_BUILD_PIVOT_KILL_DECISION.md:101–102`; `docs/validation/v3/14_PHASE1_AUTHORIZATION_CHECKLIST.md:26–34,42–74,142–155`.
- **Evidence and reproduction:** Recruitment makes 1–2 professional-tool operators optional “when available”; the threshold document requires at least 2. The final G0 ledger can be certified without an explicit native VN account walkthrough, configured professional challenge result, or Opsique access/uncertainty record. The authorization diagram labels Phase 2 “WebSockets & multi-room”; the master §17 explicitly excludes multi-room and §19 leaves it separately undecided. G0→Phase 1 is expressly conditional, so this is not an allegation that Phase 2 is already automatically authorized.
- **Expected:** Gate predicates include the actual native/substitute frontier. G1 is necessary for later approved team/server work; it cannot authorize a deferred multi-room product.
- **Actual:** The approval checklist can miss required falsification evidence and treats a future rejected/deferred expansion as a normal Phase 2 entitlement.
- **Requirement:** Master §§17/19/21/23/28/30, L3 and D2; checklist R01/V03/V04/R09.
- **Repair direction:** Make native/configured-substitute evidence a prerequisite, assign at least 2 operators, record inaccessible Opsique as uncertainty, and correct all phase diagrams/authorization language to one-room scope and separate future approval.

### UI-01 — Failed persistence still acknowledges a committed runtime command

- **Severity / owner / affected SHA:** **BLOCKER** / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/store/sessionStore.ts:199–217,241–255`; `next/src/__tests__/store.test.ts` (write-failure expectations).
- **Evidence and reproduction:** Hydrate a store, create/save a REAL planned show, then make `localStorage.setItem` throw quota error. Dispatch `start_live`. Independent output: **`receipt.outcome=committed`, `storage=write_failed`, lifecycle=active**, while the stored envelope remains the old planned state. Rehydration therefore loses the acknowledged operation. Same path handles transitions/notes/clone commits.
- **Expected:** Durable state/event/receipt before success, or an explicit uncommitted/failed result with recoverable intent; no acknowledged lost history.
- **Actual:** Memory mutates before write, persistence catches failure without returning it, and dispatch returns the successful kernel receipt. A warning does not undo the false success.
- **Requirement:** Master §§6/15/16, L9; checklist C02/C03/I12/U10; historical state must not be silently lost.
- **Repair direction:** Make the local authority's transaction outcome control publication/acknowledgement. Preserve pending input on write failure and refuse/clearly mark uncommitted transitions. Do not solve this by adding a server.

### UI-02 — Stale same-device writers overwrite acknowledged history

- **Severity / owner / affected SHA:** HIGH / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/store/sessionStore.ts:199–217,241–255`; `next/src/lib/store/hooks.ts:65–77`; `next/src/lib/domain/engine.ts:855–860`.
- **Evidence and reproduction:** Hydrate stores A and B from the same active REAL session revision r. A commits note `A committed`, expectedRevision r. Before B handles a storage notification, B commits `B committed`, also expectedRevision r. Both validate against their own cached r; B writes the entire environment envelope. Disk no longer contains A's acknowledged note. Independent check failed. Whole-partition writes can also erase another session's newer data.
- **Expected:** One local writer/serialized authority or authoritative revision check at commit; stale operation rejected/resynced without erasing newer facts.
- **Actual:** Storage-event convergence is eventual notification, not commit exclusion/CAS. Kernel revision checking alone cannot protect two cached authorities.
- **Requirement:** Master §§6/16, L9; checklist R04/C01/C02/I12; stale state must not mutate another session/history.
- **Repair direction:** Enforce a single workstation writer or an atomic local transaction/revision boundary across tabs. Test two stores/tabs writing before notification delivery, including different-session writes.

### UI-03 — Recovery feasibility is wrong in both directions

- **Severity / owner / affected SHA:** HIGH / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/domain/recovery.ts:263–330,341–364,441–453`; `next/src/components/ops/NextPanel.tsx` (renders analysis status).
- **Evidence and reproduction:** Case A: A12/min 12, optional 5/min 3, anchor 11, now 01. Deficit 6m; optional skip saves 5m maximum. Engine sums shortening 2 + skipping 5 =7m and returns `recoverable`; clean options actually leave 1m or 4m late. Case B: A10/min 8, anchor 09, now 02. Future end-by 09 is legal 9m total and protects the anchor. That clean/protecting option exists, yet status is `no_feasible_recovery` because current elapsed has not reached the floor.
- **Expected:** Feasibility from compatible constraint-respecting actions, including future commitments; mutually exclusive levers counted once.
- **Actual:** Aggregate savings double-counts one segment and omits legal future active savings. It can falsely reassure or falsely tell the operator recovery is impossible.
- **Requirement:** Master §11; checklist T05/T08/T09/T10; explicit feasible/infeasible recovery.
- **Repair direction:** Derive status from actual compatible candidate plans or a correct per-segment upper bound; reconcile status with clean protecting options. Keep exception/re-anchor outcomes distinct.

### UI-04 — Required zero/unknown timing states cannot be represented

- **Severity / owner / affected SHA:** HIGH / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/contracts/plan.ts:22–29`; `next/src/contracts/session.ts:31–35`; `next/src/lib/domain/engine.ts:575–598`; `next/src/lib/domain/forecast.ts:175–189`; `next/src/components/ops/SegmentEditor.tsx:58–85,144–151`; `next/src/components/ops/NowPanel.tsx` (estimate editor).
- **Evidence and reproduction:** Parse optional Q&A target 180/min 0 using `SegmentSchema`: rejected by `.positive()`. Browser minimum `0:00` yields validation error; blank means noncompressible, not zero. Dispatch active remainingSec 0: rejected, although zero estimate need not end a segment. Before target, there is no command/schema/UI state for “remaining explicitly unknown; disable target-derived estimate.” Null clears an estimate and resumes the target projection; it is not such a state.
- **Expected:** D03's declared zero minimum is valid; D07 can distinguish zero remaining, no entered estimate and explicitly unknown remaining. Unknown must propagate possible risk without inventing an end.
- **Actual:** The exact checklist vector is impossible through normal authoring/persistence, valid zero remaining is rejected, and explicit unknown is unavailable. Post-target unknown/lower-bound behavior itself works.
- **Requirement:** Checklist D03/D07, T02/T07/T09/I01/J02; missing != zero.
- **Repair direction:** Model and validate these distinct timing states, expose the required operator choice, and retain them on reload. A zero-duration host segment need not be allowed; separate cues already cover that case.

### UI-05 — An infeasible Next LIVE is called ready and can start

- **Severity / owner / affected SHA:** HIGH / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/domain/plan.ts:169–178`; `next/src/lib/domain/engine.ts:379–389`; `next/src/components/ops/NextLivePanel.tsx:64,189–209`; `next/src/app/live/[sessionId]/prepare/page.tsx:80–82,240–243,315–326`.
- **Evidence and reproduction:** Run the missed-anchor scenario to completion; select A 6→10m only. Preview correctly says Flash 12 and Closing 26 each arrive 1m late. Check “Create it anyway and fix the conflict in Prepare.” New Prepare says **Plan ready**, displays both warnings, and enables Start. Browser clicked Start and reached `/live/sim-1/operate`, lifecycle **active**, with unresolved conflicts.
- **Expected:** Allow an explicitly unresolved draft if desired, but block ready/Start until the selected plan satisfies commitments or an explicit new commitment resolves them.
- **Actual:** Known infeasibility is warning-only in shared validation, so both UI and command handler admit it. Acknowledging creation-for-repair is not resolving the plan.
- **Requirement:** Checklist N03/D06/T05/J02; master §11/§16 feasible next-plan loop.
- **Repair direction:** Separate draft preservation from runnable readiness; enforce the constraint at Start in the domain as well as UI. Do not move anchors automatically.

### UI-06 — Truthful unresolved reports prevent capturing later native actions

- **Severity / owner / affected SHA:** HIGH / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/components/ops/CueBar.tsx:39–61,95–108`; `next/src/components/ops/OperateDialogs.tsx:350–415`; `next/src/components/ops/RunOfShowLive.tsx:88–120`; `next/src/app/live/[sessionId]/operate/page.tsx:345–360`; deleted `next/src/lib/simulator/simulatorEngine.ts` / old general platform-report handler at baseline.
- **Evidence and reproduction:** In buffered rehearsal mark Flash cue Attempted, leave outcome unknown, then advance to B while skipping scripted performed reports. At 20:15 the bar still offers only Flash with “+2 more.” More dialog has only Flash performed/attempted/cancelled; rundown cue rows are not action selectors. There is no way to select the later B pin without declaring the earlier cue performed/cancelled. Unexpected native actions not preconfigured as cues likewise lack a structured report path; a note is not equivalent target/action evidence.
- **Expected:** Each independent human action can be reported with its own exact target/time and unresolved outcome, without falsely resolving unrelated actions.
- **Actual:** First-open-cue selection blocks later reporting and narrows a required semantic from the deleted general manual-action flow.
- **Requirement:** Master §8 minimal independent human reports; checklist I05/I08/I13/J07/H06 and core truthful external-action state.
- **Repair direction:** Permit selection/reporting of any relevant cue and a minimal independent manual action where no cue exists. Preserve unresolved earlier attempts; do not solve by auto-cancelling them.

### UI-07 — End-by recovery promises unfinished work but silently records complete coverage

- **Severity / owner / affected SHA:** HIGH / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/domain/recovery.ts:314–324`; `next/src/lib/domain/engine.ts:317–355,532–572`; `next/src/app/live/[sessionId]/operate/page.tsx:341`; `next/src/lib/domain/review.ts:196–202`.
- **Evidence and reproduction:** D03 at 07 estimates A needs 6m, then selects end-by 12, whose detail promises “Unfinished points carry later.” End-by only changes target/clears estimate; it creates no follow-up/cue transfer. At 12 the normal Next button sends `advance_segment` without coverage. Since the minimum was met, kernel sets `coverage=complete`. Independent check observed complete; regular UI provides no above-minimum partial-coverage selection. The browser's recovered run likewise completes without a carried follow-up record.
- **Expected:** Operator can declare unfinished/partial coverage independently of minimum duration, retain the follow-up and decide whether it is actually completed later. Acceptance of an end-by target is not proof all product points were covered.
- **Actual:** Duration compliance becomes complete coverage and the promised carry-forward is not implemented.
- **Requirement:** Checklist D02/D04/T08/H05; master §11 coverage/explicit recovery/actual history.
- **Repair direction:** Record the operator's partial/complete declaration and explicit follow-up, or honestly state a manual follow-up requirement without asserting transfer. Keep ordinary transition capture lightweight.

### UI-08 — More than one REAL show can run on the same local authority

- **Severity / owner / affected SHA:** HIGH / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/store/sessionStore.ts:241–255,299–340`; `next/src/lib/domain/engine.ts:379–409`; `next/src/app/page.tsx` (active-session selection).
- **Evidence and reproduction:** Create two REAL planned sessions in one hydrated store; dispatch Start for each. Both return `committed` and remain active. No cross-session active-show guard exists. This was independently executed, not inferred from a future multi-user scenario.
- **Expected:** The one-operator workstation has one active REAL show; starting another requires ending/explicitly resolving the existing one. Rehearsals can remain separately scoped.
- **Actual:** Simultaneous REAL sessions are accepted, while the home continuation workflow selects an active item rather than establishing one authority.
- **Requirement:** Master §16 one active show per device, L3; checklist R04/C01; single-device scope.
- **Repair direction:** Enforce the active-show invariant at the store/local transaction boundary, with a clear route back to the existing show; test direct commands as well as buttons.

## NON-BLOCKING FINDINGS

These do not independently determine the repair verdict above. They remain recorded defects or limitations for the named owner; several must be resolved before a functional/reliability or complete accessibility claim.

### AG-09 — Example recruitment and quotes look like collected evidence

- **Severity / owner / affected SHA:** MEDIUM / ANTIGRAVITY / `a7f58a4`.
- **Files:** `docs/validation/v3/01_PARTICIPANT_PROFILE.md:300–318`; `docs/validation/v3/10_POST_TEST_INTERVIEW.md:179–211`.
- **Evidence/reproduction:** Read the registry: future-dated P01–P06 pairs are “Confirmed.” The coding matrix contains named participant IDs, verbatim favorable quotations and precise behavioral timings, without a nearby explicit fictional-example label.
- **Expected / actual:** Templates distinguish illustrative rows from actual enrollment/interviews; current rows can be mistaken for empirical evidence. No raw evidence was supplied to authenticate them; this audit does not accuse real participants of saying anything.
- **Requirement:** Checklist V02/V06; master §21 evidence integrity.
- **Repair direction:** Blank the templates or clearly label synthetic examples and link any real rows to consented source records.

### UI-09 — Backward REAL clock changes silently change risk

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/store/hooks.ts:49–63`; `next/src/lib/domain/forecast.ts:140–147,175–189`; `next/src/lib/domain/engine.ts:864–866`.
- **Evidence/reproduction:** D01 without estimate, query 13 then 11: pending anchor status changes `missed`→`on_track`. REAL `useNow` reads raw `Date.now()` each tick without discontinuity detection. Command event timestamps are clamped to the last recorded event, but passive display/risk is not.
- **Expected / actual:** Discontinuity should expose uncertain alignment and require explicit correction; current display can erase a previously visible miss without explanation. No stored event rewrite was observed in this test.
- **Requirement:** Checklist D11/T01; master §16 explicit clock correction.
- **Repair direction:** Detect/reconcile wall-clock discontinuities at the local clock boundary, preserving baseline and actual events; add a real UI discontinuity test.

### UI-10 — JSON-null storage crashes hydration

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **File:** `next/src/lib/store/sessionStore.ts:159–171`.
- **Evidence/reproduction:** In isolated storage set `livelift.v3.REAL` to literal `null`, then hydrate a new store. It throws `TypeError: Cannot read properties of null (reading 'v')`.
- **Expected / actual:** Invalid stored envelope is quarantined with recoverable notice; syntactically valid JSON null escapes validation and crashes before that path.
- **Requirement:** Checklist C03/U10; claimed schema/corrupt-storage handling.
- **Repair direction:** Validate the unknown envelope as an object before property access, preserving the original data and a usable recovery surface.

### UI-11 — Some invalid numeric commands throw rather than reject

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/domain/engine.ts:532–570,686–719,835–939`; `next/src/lib/domain/time.ts:27–28`.
- **Evidence/reproduction:** On active A, `commit_end_by` with NaN or Infinity and `reanchor_segment` with Infinity throw `RangeError: Invalid time value`. Negative extension and non-finite remaining estimates are correctly rejected. No mutated source session was observed after the thrown calls.
- **Expected / actual:** All invalid numeric commands yield a controlled invalid-payload receipt; some reach formatting before finite validation. Browser time inputs limit ordinary exposure, so this is a domain-boundary defect, not a demonstrated normal-click crash.
- **Requirement:** Checklist T07/C01.
- **Repair direction:** Validate finite, bounded numeric inputs before arithmetic/formatting at command entry.

### UI-12 — Valid imported product codes silently collide

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/domain/products.ts:31–59,69–83`; `next/src/app/live/[sessionId]/prepare/page.tsx:175–178`; `next/src/components/ops/PrepareRos.tsx:380–411`.
- **Evidence/reproduction:** Browser import `A-B\tFirst item\t0` and `A_B\tSecond item\t` as two lines. Preview labels both valid and offers Import 2; after import only A-B remains. Both IDs normalize to `prod_a_b`, and the add loop silently drops the second.
- **Expected / actual:** Distinct valid codes retain distinct identities or preview flags the collision; two promised imports become one without explanation. Zero price and missing price themselves display correctly.
- **Requirement:** Checklist J03; honest import/identity handling.
- **Repair direction:** Allocate collision-safe IDs or detect the actual normalized-ID conflict in preview and report the skipped row explicitly.

### UI-13 — Removing a product used only by a cue leaves an invalid target

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/components/ops/PrepareRos.tsx:256,329–339`; `next/src/lib/domain/plan.ts:183–190`; `next/src/app/live/[sessionId]/prepare/page.tsx:185–188`; `next/src/lib/domain/engine.ts:730–781`.
- **Evidence/reproduction:** Source-traced path: create a product-free host segment plus a pin cue targeting product P; remove P in Prepare. Removal's `usedBy` checks only segments. Plan validation checks cue segment references, not cue product references; report handling validates the cue but not existence of its product snapshot.
- **Expected / actual:** Referenced action target remains valid or readiness blocks with repair guidance; current path can retain/report a pin for a product no longer in the session pack. This path was traced in source, not independently clicked in the browser.
- **Requirement:** Checklist J02/I13/N04; exact target semantics.
- **Repair direction:** Validate all cue/product references at edit, readiness and report boundaries; prevent removal or explicitly clear/repair dependent cues.

### UI-14 — An incomplete actual interval is labelled “Did not run”

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/contracts/session.ts:24–35`; `next/src/lib/domain/review.ts:191–202`; `next/src/components/ops/ReviewTable.tsx:166–176`.
- **Evidence/reproduction:** In an isolated completed SIMULATED history retain A's start/state but set its end boundary null. Domain returns `actual=null`, variance=null, outcome completed; the table's fallback displays “Did not run.” Schema has no completed-boundary consistency guard. The independent incomplete-history check confirms null arithmetic is preserved.
- **Expected / actual:** Incomplete/censored execution is rejected/quarantined or shown as recorded start with unavailable end; current copy asserts nonexecution despite evidence of a start.
- **Requirement:** Checklist D10/H04/I01; missing evidence is not evidence of no execution.
- **Repair direction:** Distinguish incomplete execution from not-reached/skipped in validation and rendering without inventing an end.

### UI-15 — Laptop rundown visibility and control sizing fall short of canonical ergonomics

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/app/live/[sessionId]/operate/page.tsx:289–430`; `next/src/components/ops/NowPanel.tsx`; `next/src/components/ops/SupportTabs.tsx`; `next/src/components/ops/SimulatorStrip.tsx:37`; `next/src/components/ops/RunOfShowLive.tsx:145–190`.
- **Evidence/reproduction:** Buffered risk at 1280×720 gives main scrollHeight 714/clientHeight 627; rundown y≈651–795 has its own scroll, so only about 69px initially fit. At the larger tested heights outer overflow disappears. Fresh REAL browser measurements: Set host estimate 36px high, History/Coverage/Plan changes 40px. Simulator controls use 32px. Important cue/time metadata frequently uses 13–15px versus the checklist's 16px minimum.
- **Expected / actual:** Compact laptop command band leaves a usable rundown and predictable scroll ownership; essential targets meet 44px, with readable hierarchy. Main action/risk are visible, so this is not a claim that the primary recovery control is clipped.
- **Requirement:** Canonical foundations/responsive and Operate laptop frames; checklist U02/U05/U08.
- **Repair direction:** Reduce secondary command-band density, give rundown one clear scroll region and preserve current-row visibility; enlarge essential small targets/metadata without changing the approved visual language.

### UI-16 — Product support page has a dead action and mouse-only cards

- **Severity / owner / affected SHA:** LOW / CLAUDE / `7a5e8b2`.
- **File:** `next/src/app/products/page.tsx:67–76,117–139`.
- **Evidence/reproduction:** Click Packs→Inspect Pack: no dialog/navigation/state change; no handler is bound. Product cards are clickable divs without keyboard role/tabIndex/activation.
- **Expected / actual:** Visible action works or is honestly unavailable; keyboard users can open product details. Current secondary support controls fail those expectations. This behavior is inherited in part from the baseline but remains in the audited target.
- **Requirement:** Checklist U07; canonical Journey products/packs and dead-navigation review.
- **Repair direction:** Implement the modest inspection path or remove/disable it with truthful copy; use semantic keyboard-operable controls for cards.

### UI-17 — REAL history inherits unconfirmed fixture attribution

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/domain/engine.ts:131–149,870`; `next/src/fixtures/library.ts:3–21`; `next/src/components/shell/StandardShell.tsx:122`; `next/src/lib/store/sessionStore.ts:299–340`.
- **Evidence/reproduction:** Create a blank REAL session as a new operator. Events and shell say Linh; creation has no operator confirmation field. Built-in library is described in source as “operator entry,” with dated facts/prices, and is usable in REAL packs without an explicit sample-data notice.
- **Expected / actual:** Attributed entered facts or clearly disclosed local/sample defaults; current prototype identity can be mistaken for actual actor provenance. This is not a claim of authenticated account access or cross-mode execution leakage.
- **Requirement:** Checklist R08/H06; honest manual attribution.
- **Repair direction:** Use an explicitly unconfigured local operator or confirm a display name; disclose sample library origin before copying it into a REAL plan.

### UI-18 — Simulator reset deletes unrelated retained rehearsals

- **Severity / owner / affected SHA:** MEDIUM / CLAUDE / `7a5e8b2`.
- **Files:** `next/src/lib/store/sessionStore.ts:359–367`; `next/src/app/simulator/page.tsx:111–130`.
- **Evidence/reproduction:** Complete/customize two SIMULATED shows, then use Reset rehearsals. Handler keeps only REAL sessions and regenerates fixtures; all custom and completed SIMULATED histories disappear. Dialog explicitly warns this, so the deletion is not silent and no REAL loss is alleged.
- **Expected / actual:** Checklist's isolated-run reset preserves unrelated retained history; current reset is an environment-wide purge.
- **Requirement:** Checklist I12/S02; deterministic reset isolation.
- **Repair direction:** Provide selected-scenario/run reset that preserves other histories; distinguish any optional explicit purge from ordinary rehearsal reset.

## OUT-OF-SCOPE / FUTURE NOTES

- No team/server authority, provider framework, scraping, AI/ML, multi-room, native execution, commerce analytics dashboard or chat/video clone is required to repair this checkpoint. A same-device stale-tab overwrite is a current local-authority defect, not a demand for Phase 2 collaboration.
- Host View is absent in this UI and explicitly WoZ in the package. Its absence is not a P0 failure; any future benefit/synchronization claim needs its own comparison/gate.
- Provider-observed/platform-confirmed and HTTP-success boundaries are respected by not offering an execution/ingestion path. Actual entitlement, scopes, TikTok account rollout, room binding and provider failures were **not tested**. Dated repository research is not a current credential probe.
- No full retrospective provider lens, causal inference engine or recurring learning was certified. Current observations and manual selected changes are appropriate for one run.
- No export/restore UI is required merely to show a validation prototype. Functional G1 durability/schema/restore acceptance remains outstanding; existing “saved on this device” claims are why quota/race/corrupt-state handling were tested now.
- No actual participant task, willingness to pay, host benefit, native walkthrough, professional-tool superiority or repeat-use gate passed here. Templates and simulated histories cannot supply those results.
- Warm locally served execution was inspected. Cold offline packaging, storage eviction/disaster recovery, Node 22 container deployment, other browser engines and long-running physical device behavior remain unverified.

## MANUAL ORCA ACCEPTANCE REQUIREMENTS

**Not ready yet.** After CLAUDE and ANTIGRAVITY repair their own artifacts and freeze new commits, rerun the affected independent cases before the user's acceptance gate. This audit authorizes no source repair or merge.

1. Confirm the new target SHAs and complete the exact operator journey in Orca using a fresh custom REAL plan and a separate SIMULATED rehearsal. Verify current session/mode/NOW/NEXT/WHY/ACTION within five seconds.
2. At 1280×720 first, then 1440×900 and 1600+, exercise ordinary overrun, missed/possible anchor risk, recovery exceptions, zero-duration cues, unresolved attempts, end/freeze, Review and selected feasible/infeasible clones. Inspect the resulting facts, not just labels.
3. Perform keyboard-only create/edit/reorder/start/recover/report/end/review/clone; inspect focus, announcement behavior, all dialogs, long Vietnamese names, at least 23 rows, 200% browser zoom and contrast/target sizes on the actual monitor.
4. Verify storage-failure acknowledgement, stale second-tab writes, wrong-session commands, duplicate delivery, one-active-show guard, refresh/restart and backward device clock with recoverable history. No production platform action is needed.
5. Independently dry-run the corrected baseline and both matched scripts; freeze metric IDs, clocks, assistance, exclusions, denominators and zero handling. Resolve the native VN/configured-professional/Opsique evidence requirements before a measured decision.
6. Keep technical acceptance separate from actual G0 participant results, G1 functional/repeat-use evidence, and any later G2 authority/enrichment gate. Even a technical re-audit PASS still requires the user's explicit browser/design acceptance.

## FINAL GATE DECISION

**REPAIR REQUIRED.** Both frozen builder artifacts require owner repairs. The visual direction is broadly preserved, and substantial serial/manual functionality works, but the blocking findings prevent readiness for manual Orca acceptance. No Phase 1/Phase 2 implementation authorization, market validation, push or merge follows from this report.

Self-review: duplicated symptoms were grouped by cause; each BLOCKER/HIGH has a concrete committed-source, executed domain/store, or browser reproduction. Unsupported/absent future features are separated from present defects. Passed native tests are reported accurately without treating count as proof. No agent VICTORY/PASS/completion label is used as evidence. `CHECKLIST.md` is unchanged. The post-shutdown freeze recheck again matched all four input SHAs; only this report was untracked in the audit worktree. The original temporary attachments were lost, and that limitation is disclosed; fresh focused checks reconfirmed the decisive failures. Only this report is to be committed on the audit branch.

VALIDATION PACKAGE: REPAIR
VALIDATION UI: REPAIR
ROADMAP COMPLIANCE: FAIL
READY FOR MANUAL ORCA ACCEPTANCE: NO
READY TO MERGE: NO
