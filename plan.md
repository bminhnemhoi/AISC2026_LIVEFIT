# LiveLift frontend product plan — plan.md

## 1. Executive UX Direction

LiveLift is an operational workspace built around one continuous loop:

**Prepare → Operate → Record → Review → Learn → Next LIVE.**

The experience must satisfy five principles:

1. **The next useful action is obvious.** Home directs the user into a session; PREPARE directs them toward readiness; OPERATE makes NOW, NEXT, WHY, and ACTION recognizable within five seconds.
2. **Operational truth has visible boundaries.** Plans, decisions, attempts, operator reports, provider observations, and platform confirmations remain distinct.
3. **Manual operation is complete.** Integrations add capabilities without becoming prerequisites for the core loop. Manual operation can coexist with available provider capabilities.
4. **History remains honest.** Replay reconstructs what was available at the time and identifies information that arrived afterward.
5. **Learning changes the next plan.** Review ends with selected, concrete changes rather than an unsupported summary of success.

### Evidence inspected

This plan follows the [product vision](docs/product/01_PRODUCT_VISION.md), [golden path](docs/product/02_GOLDEN_PATH.md), [PREPARE specification](docs/product/03_PREPARE.md), [OPERATE specification](docs/product/04_OPERATE.md), [REVIEW specification](docs/product/05_REVIEW.md), and [legacy reuse matrix](references/LEGACY_REUSE_MATRIX.md).

All seven designs on the [existing canvas](.kombai/canvas/livelift_prepare_live_20261002.canvas) were inspected. Repository references included the operational runbook, session journal, storage-outage benchmark, operational verification report, and dated TikTok research. Legacy lifecycle and action-scoping code was inspected through codebase-memory and source snippets.

The graph excludes product documentation; those documents were read directly. Legacy implementation and research establish lessons and historical limitations, not contracts or current provider capabilities.

### Design decisions retained and challenged

| Existing evidence | Keep | Change |
|---|---|---|
| [FINAL PREPARE](.kombai/canvas/livelift_prepare_live_20261002.canvas#node_8b1dc5cb11e4) | Dominant Run of Show; unboxed Product Pack; optional TikTok; restrained START LIVE | Replace fixed work-region heights and widths with responsive behavior; support real editing, validation, and long lists |
| [FINAL OPERATE](.kombai/canvas/livelift_prepare_live_20261002.canvas#node_7103e0e5c12d) | NOW/NEXT command band; separate presenting and pinned products; acceptance does not start the product | Replace four simultaneous secondary columns with a dominant rundown and one supporting region |
| OPERATE examples | Concise evidence and explicit unknown verification | Correct the M03 rationale: Flash Sale precedes it in the plan, so recommending M03 requires an explicit pull-forward reason |
| Earlier PREPARE variations | Exploration of rundown proportions | Do not inherit alternate palettes, serif typography, or equal-weight panels |
| Legacy product | Lifecycle safety, exact action scope, visible persistence failures | Do not transplant experiment prerequisites, autopilot semantics, navigation, database assumptions, or frontend structure |

The selected direction is **LiveLift Control**, confirmed during planning: dark neutral surfaces, Rubik, restrained sage, readable metadata, minimal borders, and functional iconography. The ClickHouse preset is superseded for this plan.

**Confirmed defaults:** English interface; one lead operator controls runtime; disconnected clients can read and capture notes/report drafts but cannot perform authoritative runtime transitions. Offline action/operator reports remain **UNSYNCED DRAFTS** until the operator explicitly confirms submission after reconnect/resync.

This is a plan-only deliverable. No frontend source, legacy source, design system, or canvas is changed.

## 2. Complete Product Map

| Workspace | Priority | Purpose |
|---|---|---|
| PREPARE | **P0 CORE** | Build the session Product Pack and Run of Show; resolve blockers; start tracking |
| OPERATE | **P0 CORE** | Understand current state, choose the next intervention, and record events safely |
| REVIEW | **P0 CORE** | Reconstruct operational history with evidence, uncertainty, and late information |
| Learn / Next LIVE | **Within P0 CORE Review**, not a separate workspace | Turn evidence into selected changes and a new plan |
| Home | **P0 REQUIRED SUPPORTING** | Continue the highest-priority work or create a session |
| Create LIVE | **P0 REQUIRED SUPPORTING** | Create a session with minimal input |
| WRAP | **P0 REQUIRED SUPPORTING** | Confirm runtime end, preserve unresolved work, and enter Review |
| Sessions | **P0 REQUIRED SUPPORTING** | Find, resume, review, abandon, or clone sessions |
| Simulator | **P0 REQUIRED SUPPORTING**, cross-product environment | Rehearse the complete loop with unmistakably simulated evidence |
| Products / Packs | **P0 MINIMAL SUPPORT SURFACES** | Maintain reusable product information and pack templates |
| Integrations | **P0 MINIMAL SUPPORT SURFACES** | Explain available capabilities and actionable connection problems |
| Settings | **P1 LATER** | Basic operator preferences; required timezone/session defaults are exposed in the P0 session flow |
| Simplified host view | **P1 LATER** | Offer a separate current/next projection after operator workflow validation |
| Additional provider connectors | **P1 LATER** | Add validated catalog, analytics, or realtime capabilities individually |
| Extension and verified platform control | **P1 LATER** | Add scoped observation or execution only when trustworthy contracts exist |

**Planned in this document does not mean every surface must be implemented before the core loop is usable.** Implement the core workspaces with the minimum supporting flow needed to create, run, end, review, and clone a session. Complete the remaining P0 supporting surfaces incrementally; do not make the full Product Library, integration management, or P1 Settings a prerequisite for that first usable loop.

LEARN, evidence detail, queue, and coverage do not become permanent navigation destinations. No analytics center, AI chat page, enterprise administration, or market-intelligence workspace is introduced.

## 3. End-to-End User Journey

| Handoff | User action | State preserved |
|---|---|---|
| Home → Create | Create LIVE, or choose a previous session to clone | Origin session and selected changes, when applicable |
| Create → Prepare | Save the short creation form | New session identity, title, timezone, optional schedule, source selection |
| Prepare → Operate | Resolve required blockers and select START LIVE | Saved plan version, product snapshots, operating identity, REAL/SIMULATED environment, available capabilities, lead operator |
| Operate → Record | Accept, reject, transition, report, or note | Actor, exact targets, timing, decision relationships, command result, evidence source |
| Operate → Wrap | Confirm End LIVE | Authoritative end time, last current segment, outstanding actions, data gaps |
| Wrap → Review | Open Review immediately or return later | Runtime frozen; review remains available while optional evidence is pending |
| Review → Learn | Create or accept a learning object | Supporting events, segment/product scope, uncertainty |
| Learn → Next LIVE | Select changes and create the next session | New IDs and plan version; explicit provenance and applied changes |

Starting or ending LIVE in LiveLift controls **LiveLift tracking**, not the platform broadcast. PREPARE and the end confirmation state this explicitly. OPERATE distinguishes “LiveLift active” from any separately observed broadcast status.

Creating the next session never changes the completed session’s plan, runtime, or historical evidence.

## 4. Route / Information Architecture

Use one stable session prefix:

| Route | Behavior |
|---|---|
| `/` | Home |
| `/live/new` | Short Create LIVE page |
| `/live/:sessionId` | Resolve the session and open its appropriate workspace |
| `/live/:sessionId/prepare` | Editable preparation for a planned session |
| `/live/:sessionId/operate` | Active runtime workspace |
| `/live/:sessionId/wrap` | Ended session’s short wrap workspace |
| `/live/:sessionId/review` | Semantic replay |
| `/live/:sessionId/review?view=learn` | Learning subview |
| `/sessions` | Session library |
| `/products` | Products and Packs tabs |
| `/integrations` | Capability-based provider management |
| `/settings` | P1 preferences; required P0 timezone/session defaults remain in Create/Prepare |

Review links may preserve selected segment, product, event, time, filters, and knowledge view in query parameters. Learning objects and evidence details receive shareable links within the session workspace.

**Route rules:**

- A session route loads and validates identity before displaying session-specific information.
- An ended session’s OPERATE URL resolves to WRAP or REVIEW with a clear explanation.
- An active session’s PREPARE URL opens OPERATE; future-plan editing is contextual there.
- REVIEW is available for ended or abandoned sessions that contain runtime history. P0 does not add a live historical-review mode.
- WRAP has its own route because it must survive reload and deferred completion.
- Next LIVE uses Create LIVE with clone context; it does not require another workspace.
- Returning to a page restores its useful selection and scroll position.
- Browser navigation never starts, ends, or changes a session.

Permanent navigation contains **Home, Sessions, Products** as those surfaces ship. Integrations lives in the user menu; Settings is added there in P1. Unimplemented destinations are not exposed.

## 5. Global App Shell

### Standard shell

Use a quiet horizontal header approximately 60–64px high:

- LiveLift wordmark linking to Home.
- Home, Sessions, Products, as those surfaces ship.
- A compact active-session return link when relevant.
- User menu containing Integrations and user identity; Settings is added in P1.

Within session workspaces, place session identity immediately below the global header: title, lifecycle, REAL/SIMULATED environment, schedule/timezone where useful, and session-specific controls.

Manual operating availability and individual provider capabilities are separate from environment identity. A REAL session can show manual controls available, catalog available, realtime unavailable, and verification unknown simultaneously.

Provider health is contextual:

- Home shows an issue only when the user can act on it.
- PREPARE shows capabilities relevant to readiness.
- OPERATE shows affected capabilities beside their dependent information.
- Integrations provides the complete capability view.

### Focused OPERATE shell

Replace standard navigation with a single compact session header:

**Session identity · REAL/SIMULATED environment · LiveLift runtime status · elapsed time · operator/control status · session menu · End LIVE.**

Hide global destination links and the large preparation identity band. Keep account/room identity accessible and visibly present when a provider association is active.

The session menu provides “Leave desk,” control handoff, and shortcut help. Leaving the desk does not end runtime.

### Global feedback

Separate:

- Client connection.
- Persistence/recording health.
- Manual operating availability.
- Provider capability health.
- Session lifecycle.
- Pending command status.

A healthy provider must not conceal an inability to save actions.

Notifications appear near the affected workflow. Persistent safety issues remain visible; informational toasts do not accumulate into a notification dashboard. Page transitions avoid animation that delays recognition or moves controls.

## 6. HOME

Home answers **“What should I do next?”**

### Priority order

1. **Continue active LIVE**, when one exists.
2. **Create LIVE**, when no session is active.
3. Prepared/upcoming sessions with “Open Prepare.”
4. Recent ended sessions with “Open Review.”
5. Specific unfinished review work and accepted changes not yet applied.

Show a maximum of three items per supporting group, with a Sessions link for the rest.

Unresolved work is expressed as a task:

- “Review two conflicting pin reports.”
- “Three next-live changes are ready to apply.”
- “Finish wrapping Friday Evening Essentials.”

Do not aggregate these into vanity counters or imply every unknown verification requires investigation.

### First run

Show Create LIVE, a short explanation of the operational loop, and a secondary “Try a simulated session.” No empty KPI grid or connection setup wizard.

### Active session

Continue LIVE becomes the only filled primary action. Creating another draft remains available as a secondary action. Starting a second runtime is blocked under the P0 single-active-session default.

Provider problems appear only with an affected capability and recovery action. Optional disconnected providers are absent from Home’s main task area.

## 7. CREATE LIVE

Use a **dedicated lightweight page**, not a wizard or mandatory modal.

This supports deep links, clone context, recovery after refresh, and keyboard use without compressing the form into an overlay.

### Inputs

- Session title, required, with an editable date-based suggestion.
- Optional scheduled date/time, using the selected session timezone.
- Optional objective, collapsed initially.
- Starting point: Blank, Saved pack, or Previous session.
- Optional account association, under a disclosure.
- Simulator entry when explicitly chosen.

Default to a REAL session with manual operation available. Available provider capabilities may coexist with manual operation. Creating a session does not require any provider.

Required timezone/session-default controls are part of this flow, not a prerequisite Settings page.

### Behavior

- Blank creates an empty Product Pack and Run of Show.
- Saved pack copies reusable product information; it does not imply a rundown exists.
- Previous session opens a compact clone preview for Product Pack, Run of Show, and selected learning changes.
- Schedule changes do not alter the identity of a cloned session.
- Account association remains optional and is validated separately from creation.
- Submit creates the session once and opens PREPARE.
- Failed submission preserves the entered form.
- An ambiguous creation response is reconciled before retrying; it must not create duplicate sessions.

The target is one short form followed by the actual preparation workspace.

## 8. PREPARE

### Layout and hierarchy

Retain **Product Pack + dominant Run of Show + Readiness**.

At 1440px and above, use three regions. At 1280px, retain Product Pack and Run of Show as working columns and move readiness into a compact bottom region. Do not shrink metadata to preserve three columns.

### Product Pack

An operational list shows:

- Short code and product name.
- Optional price and currency.
- High or Normal priority.
- Enabled/disabled state.
- Notes/talking-points indicator.
- Source/as-of information through accessible disclosure.

Selecting a product opens its contextual editor:

- Name and code.
- Price, optional.
- Priority.
- Operator notes.
- Talking points.
- Explicit constraints.
- Enabled state.
- Reusable-library origin and session overrides.

P0 constraints are simple operator-entered conditions and supported scheduling restrictions. Do not introduce an arbitrary rules language.

Product order is reference order; it does not silently determine segment order.

### Product operations

Support add, edit, reorder, disable, remove, paste/import, and add from library.

- Reordering supports drag and Move up/Move down.
- Disabling preserves the product and its history.
- Linked disabled products create actionable segment warnings.
- Removing a linked product requires resolving its segment links.
- Changes remain session-specific unless the user explicitly saves them to the library.
- Price absence is displayed as “Not entered,” never zero.

### Import and quick entry

One import surface supports pasted rows, tab-separated clipboard, and CSV.

Minimum required information is a product name. Generate session-local codes when omitted. Preview normalized rows, duplicate codes, invalid values, and selected currency before committing.

Valid rows can be imported while invalid rows remain available for correction. No silent overwriting or conversion of observed external listings into owned catalog products.

### Run of Show

Use aligned rows:

**Order / planned offset or time · segment and products · planned duration · status/menu.**

Support:

- Add, edit, duplicate, remove, and reorder.
- Segment title, type, duration, cue, and notes.
- Zero, one, or several linked products.
- An explicitly selected lead product when several are linked.
- Product-free Opening, Q&A, Promotion, Break, and Closing segments.
- Optional timing restrictions, shown only when configured.

Show relative offsets when no scheduled time exists. Show planned clock times and timezone when scheduled.

A segment’s linked product is a plan, not evidence that the product was presented.

### Validation

Required blockers:

- Missing session title.
- No runnable segment.
- Invalid or non-positive duration.
- Invalid product reference.
- Unresolved hard constraint.
- Unsaved or conflicting plan revision.
- Inability to persist the start.
- Another active session under the P0 limit.

A Product Pack is required only when segments depend on products. A product-free session is valid.

Non-blocking warnings:

- Enabled products absent from the rundown.
- Optional prices or notes missing.
- Forecast finish later than intended.
- Optional provider capability unavailable.
- Disabled unlinked products.

Readiness statements must be computed from saved data, not decorative checks.

### Reuse and saving

Autosave committed valid edits with visible Saving, Saved, Unsaved, and Conflict states. Editors with several fields use an explicit Save action.

Clone copies plan content and selected lessons, not runtime, actual timing, decisions, action records, verification, or live provider health.

### START LIVE

The readiness region shows:

- Required plan readiness.
- Manual operating availability.
- Relevant optional capabilities.
- REAL or SIMULATED environment identity.
- Primary START LIVE action.

Do not offer Manual versus Provider as mutually exclusive session modes. Environment selection and capability availability are separate.

Supporting copy states: **“Starts LiveLift tracking. Start your broadcast in the platform separately.”**

Starting validates the saved revision, establishes control ownership, and records the starting plan version. Enter OPERATE only after an authoritative active-session response.

If the response is uncertain, show “Checking whether tracking started” and reconcile status before permitting another start.

## 9. OPERATE

### Primary composition

Use two unequal command regions:

**NOW** on the left; **NEXT with WHY and ACTION** on the right.

Both remain visible above the fold on the supported laptop baseline. Below them:

- Run of Show owns the main remaining vertical space.
- One supporting region contains Queue, Coverage, Pulse, and History as tabs.
- Queue is selected by default.
- The latest command acknowledgement remains beside its action.

This removes the existing design’s four-column secondary field. More width reveals more useful rows rather than more equal-weight widgets.

### NOW

Show:

- Current actual segment, or “No segment started.”
- Presenting product, attributed to the relevant operator report.
- Actual segment start and elapsed time.
- Original planned duration.
- Current target duration when extended.
- Overrun or remaining target time.
- Operator identity and control status.
- Separate pinned-product evidence.

Preserve three identities:

| Identity | Meaning |
|---|---|
| Presenting product | What the operator reports the host is presenting |
| Platform pinned product | What an identified source reported, observed, or confirmed |
| LiveLift recommended product | What NEXT proposes |

Starting a product-linked segment establishes its operational segment state. It does not automatically confirm host presentation or platform pinning. A quick “Presenting this product” report records presentation explicitly.

If presentation differs from the linked product, show both without forcing either to overwrite the other.

A platform pin display always includes its evidence class and time. If current verification is unavailable, display **Unknown**, even if an older operator report exists.

### NEXT

NEXT shows one actionable proposal:

- Target segment/product/action.
- Proposed or accepted decision state.
- Expected transition timing or deadline.
- Eligibility and blocking constraints.
- Concise WHY.
- Missing inputs affecting the recommendation.

P0 recommendations use saved plan order, operator queue choices, priority, coverage, and supported constraints. Optional validated signals may enrich them later.

NEXT may be a non-product segment. A product ranking must not silently bypass a planned Flash Sale, Q&A, or Closing.

If a proposal pulls an item forward, state:

**“Pull M03 forward ahead of Flash Sale: operator queue change.”**

Keep the original plan order visible. If no eligible item exists, explain why and offer a manual selection or End LIVE.

### WHY

Show at most three short, decision-relevant reasons, with expandable evidence:

- “Next eligible segment in plan revision 4.”
- “Not yet reported presented.”
- “High priority in this session pack.”

Each reason identifies its source and relevant freshness or limitation. A missing provider does not invalidate plan-based reasons.

Do not fabricate a rationale from generated prose. AI may improve wording only when the underlying cited facts remain inspectable.

### ACTION semantics

| Control | Effect |
|---|---|
| **Accept recommendation** | Records acceptance; leaves NOW unchanged |
| **Reject recommendation** | Rejects the proposal; does not automatically skip its planned segment |
| **Start segment** | Explicitly changes authoritative current-segment state |
| **Skip segment** | Records that the selected segment is skipped in this runtime |
| **Hold** | Defers NEXT until resumed; NOW and elapsed time continue |
| **Extend current +1 min** | Changes the operational target duration; preserves original plan duration |
| **Choose next** | Records an operator override with the selected target |
| **Presenting product** | Records an explicit presentation report |
| **Log platform action** | Records attempt or operator report without claiming verification |
| **Add note** | Appends a session-, segment-, or product-linked note |

Use target-specific labels. “Reject recommendation” and “Skip Flash Sale” cannot share an ambiguous SKIP label.

Accept and Start occupy separate, stable control locations. Never replace the ACCEPT hit target with START underneath the pointer. Only the strongest currently available action uses the sage fill.

Reasons for routine rejection or override are optional and can be added afterward. Required safety information remains mandatory.

### Run of Show during operation

Show planned order alongside actual status:

- Pending.
- Current.
- Completed.
- Skipped.
- Deferred.

Elapsed time does not automatically complete a segment. The operator transitions explicitly.

The current segment remains easy to locate. Selecting a future segment reveals pull-forward/start controls without executing anything.

Future-plan edits are permitted through a contextual editor and produce a new revision. Past actual records and the start-plan baseline remain unchanged.

Auto-follow pauses when the operator deliberately browses the rundown; “Return to current” restores it.

### Operational queue

The queue is the operator’s near-term intention, distinct from the saved plan.

Support pull forward, reorder, defer, and remove from queue. These operations do not silently edit the Run of Show.

An accepted proposal remains attached to its exact identity. New proposals are indicated without replacing the item currently being read or acted upon.

### Product coverage

Show reported coverage:

- No presentation recorded.
- Reported presented once/multiple times.
- Currently reported presenting.
- Disabled.
- High priority.

“No presentation recorded” is safer than asserting “Never shown.” Coverage derives from presentation records, not acceptance, pin attempts, or segment links.

### LIVE Pulse

Keep Pulse secondary and compact:

- Only available signals that affect a decision.
- Definition, source, window, and age.
- Explicit unavailable, partial, stale, or simulated treatment.

No provider produces an empty neutral explanation, not a grid of zeroes. Notes count does not belong as a Pulse KPI.

### Recent history and quick capture

History shows recent operational events with actor, time, target, and evidence class. Expand details on demand.

Quick note uses an inline field in the supporting region. Platform action reporting uses a compact non-modal panel:

1. Select exact product/action.
2. Choose “Attempted” or “I performed this.”
3. Save.

When disconnected, the last step saves an **UNSYNCED DRAFT**, not a server-history record. After reconnect/resync, the operator must review and explicitly confirm submission. Reconnection alone never submits an offline report.

An operator may report a performed action without a previously recorded attempt; the UI must not invent the missing attempt.

Corrections append a correcting record linked to the original. They do not silently delete history.

### Two-operator safety

One lead controls transitions, recommendation decisions, hold/extend, queue changes, and runtime end.

Assistants can read, add notes, and submit reports. They see who has control.

Handoff is explicit and acknowledged. A disconnected lead does not automatically transfer authority. Recovery takeover requires confirmation and a fresh authoritative ownership response.

All runtime commands still use revision checks. Ownership does not eliminate stale tabs or duplicate clicks.

Conflicting human reports remain visible as conflicting evidence. They do not silently overwrite NOW.

### Provider loss, reconnect, and resync

- Provider outage disables dependent signals/rules; plan/manual operation continues alongside any remaining provider capabilities.
- Wrong account, room, market, or session quarantines the affected source.
- Stale evidence remains labeled historical and stops contributing as current input.
- Client reconnect keeps the last snapshot visible with its age and blocks authoritative controls.
- Resync obtains current identity, ownership, lifecycle, revision, and command results before enabling controls.
- Offline reports remain UNSYNCED DRAFTS after resync until explicitly confirmed for submission.
- Old recommendations or events never trigger a new action.
- Accepted but now-ineligible targets require a new decision.
- Offline capture and later report submission never replay runtime commands or alter authoritative runtime state.

### Duplicate and uncertain commands

Disable the submitted operation while pending. Ignore repeated keydown and repeated submission of the same intent.

Retries reuse command identity. After a timeout, show “Outcome unknown—checking” rather than Failed. Reconcile before allowing a replacement command.

A stale-revision rejection identifies what changed and asks the operator to act again against the new state. Never retarget the original click automatically.

### Ending

End LIVE remains a quiet, separated header action. Its confirmation names the session and states that LiveLift tracking will stop; it does not stop TikTok.

Routine operation uses no modal. Ending and control takeover are the protected exceptions.

## 10. END LIVE / WRAP

End LIVE freezes runtime after authoritative acknowledgement and opens WRAP.

### Short wrap workspace

Show:

- Actual start/end and tracked duration.
- Last segment and any unresolved action outcome.
- Optional provider evidence still pending.
- Unsynced local report drafts.
- One optional quick note.
- Primary **Open Review**.
- Secondary **Finish later**.

Do not require resolving verification, filling a survey, or waiting for analytics.

Closing the last segment at runtime end records “Closed when tracking ended,” not a claim that the host completed its planned content.

“Wrap complete” means the operator finished wrap work. It does not mean every outcome is final or every action verified.

If end acknowledgement is uncertain, remain in an ending state and reconcile. Do not show a finished session optimistically.

If the client is offline, it can save a local “Broadcast ended” **UNSYNCED DRAFT**, but cannot claim the server runtime has stopped. Submitting that report after reconnect/resync requires explicit operator confirmation and does not perform End LIVE.

## 11. REVIEW

### Default workspace

REVIEW opens as **semantic operational replay**, not a chart report.

Use three conceptual regions:

1. Segment navigator.
2. Aligned operational timeline and event list.
3. Contextual evidence inspector.

At laptop width, the inspector becomes an on-demand drawer or in-flow detail region.

The top shows session identity, actual runtime bounds, REAL/SIMULATED environment, and concise unresolved issues. Manual operation and provider capability history remain separate contextual information. It does not lead with revenue cards.

### Timeline structure

Use a time-aligned overview with expandable tracks:

- Planned segments.
- Actual segments and reported presentation.
- Recommendations and operator decisions.
- Attempts and reports.
- Observations and confirmations.
- Data gaps.
- Selected metric windows.

The overview locates events. The readable event list explains them.

Keep planned and actual lanes distinct. A connector can show that a recommendation led to a decision and attempt, but must not imply causation between the attempt and an outcome.

### Knowledge view

Default to **As known then**.

For a selected replay time, include only records available to LiveLift by that time. Where operator exposure matters, additionally distinguish information actually displayed to that operator.

Offer a clearly labeled **With later evidence** view. Late additions identify:

- Event/measurement time.
- Receipt time.
- Source.
- What they add or contradict.

Switching views never silently rewrites the original recommendation rationale or earlier operator context.

A late correction preserves the earlier value, correction, and relationship. Recalculated summaries identify their newer as-of time.

An offline report enters server history only after confirmed submission. Its estimated occurrence/capture time and later receipt time stay separate; it must not appear as information the server knew during the disconnected interval. Unsubmitted drafts stay outside server replay.

### Recommendation reconstruction

For each recommendation show:

- Target and proposed action.
- Generation time.
- Recorded inputs, rule/policy version, and rationale.
- Delivery/display evidence.
- Operator acceptance, rejection, override, or no recorded decision.
- Associated attempts and subsequent evidence.

“Displayed to operator” is recorded separately from delivery. It means the recommendation was rendered in the active eligible view, not proof that the operator read it.

Do not use “Seen” when human attention cannot be established. An explicit decision establishes acknowledgement of that proposal, not proof of earlier reading.

Do not regenerate historical recommendations using today’s rules.

### Planned versus actual

Selecting a segment shows:

- Start-plan position and duration.
- Applicable mid-session plan revisions.
- Actual start/end and order.
- Target extensions.
- Skips, holds, pull-forwards, and operator reports.
- Linked products and presentation evidence.

Actual timing remains actual; the latest plan is an optional comparison, not a replacement baseline.

### Evidence chain

Selecting an action reveals related records independently:

**Recommendation → decision → attempt → report → observation → confirmation.**

Missing stages remain missing. Observations can exist without a recorded attempt. A platform confirmation requires exact source authority and target matching.

HTTP acknowledgement appears as command transport information, never platform verification.

### Metrics

A metric is shown only when it helps explain a decision, subsequent event, or next-live hypothesis.

Each metric window contains:

- Metric definition/version and unit.
- Source.
- Exact time window.
- Completeness.
- As-of/arrival time.
- Pending, provisional, final, or unavailable state.

Missing intervals remain gaps. Incompatible definitions or sources are displayed separately, not averaged. Do not imply product-minute revenue attribution without a valid contract.

### Gaps and conflicts

Show interval markers for:

- Client disconnection.
- Recording/persistence interruption.
- Provider absence or staleness.
- Wrong-context quarantine.
- Missing presentation/action evidence.
- Conflicting reports.
- Unknown command outcomes.

A gap detail explains what was unavailable, which decisions it affected, and whether later evidence filled any part of it.

Later receipt does not erase an outage from the historical view.

### Navigation and filters

Support:

- Segment jumps.
- Previous/next event.
- Jump to elapsed time.
- Product filter.
- Event-type filter.
- Source/evidence-class filter.
- Gaps/conflicts filter.
- Search for product codes and note text.

Product-focused replay is the same workspace filtered across all appearances. Event-focused replay is a deep-linked selection, not a separate page.

For long sessions, keep the overview and segment navigator sticky, load event ranges incrementally, and preserve selection when filters change. Avoid a horizontally endless timeline as the only navigation method.

There is no required autoplay or video player. If media is added later, the semantic ledger remains usable without it.

### Review actions

From a selected event or interval:

- Add observation.
- Link to an existing insight.
- Draft a hypothesis.
- Propose a next-live change.
- Add a correction or uncertainty note.

AI suggestions are optional, source-linked drafts. They cannot replace missing evidence.

## 12. LEARN / NEXT LIVE

Keep LEARN as a Review subview and a contextual action from replay.

| Object | Question | Required distinction |
|---|---|---|
| Observation | What happened? | Link to evidence; qualify reported or uncertain facts |
| Insight | What pattern may matter? | Interpretation, not established cause |
| Hypothesis | What should we test/change? | Expected effect and a way to assess it |
| Next-live change | What exactly changes? | Concrete target edit and adoption decision |

Example:

- Observation: “Sizing questions were recorded during M03.”
- Insight: “Sizing clarification may be consuming segment time.”
- Hypothesis: “Introduce the size chart earlier in the next comparable session.”
- Change: “Add ‘Show size chart’ to the first M03 cue.”

### Workflow

- Create learning objects manually without AI.
- Scope them to session, product, or segment.
- Preserve evidence links and unresolved uncertainty.
- AI-generated objects begin as Suggested.
- Accept, reject, or edit suggestions explicitly.
- Keep reusable cues/constraints separate from causal claims.

Next-live changes specify a concrete operation: change duration, move a segment, edit a cue, change priority, add a product, or add a constraint.

### Carry forward

“Create next LIVE” opens a clone preview:

- Product Pack.
- Run of Show.
- Selected accepted changes.
- Resulting edit preview.
- Change note.

Apply only selected changes. If a target is missing or archived, ask for a mapping or omit that change with an explanation.

Record where a change was applied and link the originating lesson. Do not copy actual timing, old verification, or provider bindings as current truth.

Changing a library product remains a separate explicit action.

## 13. SESSIONS / HISTORY

Use an efficient list/table, not a reporting center.

### Row content

- Title.
- Scheduled/actual date in an explicit timezone.
- Lifecycle.
- **REAL or SIMULATED environment identity.**
- Manual operating availability and relevant provider capabilities shown independently when useful.
- Relevant review/wrap state.
- Contextual primary action.
- Clone/abandon/archive menu where valid.

Do not classify sessions into exclusive Manual versus Provider modes. A REAL session may use manual operation, available catalog data, unavailable realtime signals, and unknown verification simultaneously.

### Filters

Search, lifecycle, date range, and REAL/SIMULATED environment. No complex saved-report builder.

### Actions

- Planned → Open Prepare.
- Active → Continue LIVE.
- Ended → Open Wrap or Review.
- Abandoned after runtime → Review partial history.
- Abandoned before runtime → Inspect preparation or clone.
- Past session → Clone into a new plan.

An unresponsive client does not make a session abandoned. Marking an active session abandoned requires a protected authoritative transition and preserves its runtime.

P0 permits multiple prepared sessions but only one active runtime per workspace. If existing data contains conflicting active sessions, resolve the ambiguity explicitly before enabling runtime control.

Archiving hides a session from the default library without deleting its history.

## 14. PRODUCT LIBRARY / PACKS

Use Products and Packs tabs under one destination.

This is a P0 minimal support surface. Its full planned reuse capabilities do not block the first usable session loop, which can create products directly in PREPARE.

### Reusable product data

Minimum useful fields:

- Stable identity and human-readable code.
- Name.
- Optional price/currency.
- Talking points.
- Reusable notes/constraints.
- Source/as-of metadata.
- Archived state.

No inventory engine, SKU administration suite, supplier management, or ERP features.

### Packs

A pack is a named reusable ordered selection of products with optional default notes and priorities.

Support create, reorder, clone, import, and archive. Reuse the Product Pack editor rather than building another interaction system.

### Session separation

Adding a product or pack creates session snapshots and overrides.

- Library edits do not silently change prepared or active sessions.
- “Refresh from library” previews differences and requires acceptance.
- Session edits do not silently update the library.
- Archived products remain visible in historical sessions.
- Historical prices and notes remain reproducible.

Provider-sourced products include their source and as-of state. Importing external observed products requires explicit adoption; observation alone does not imply ownership.

## 15. INTEGRATIONS

Use a compact provider list with capability detail.

This is a P0 minimal support surface. The first usable core loop does not depend on provider connection or full integration management.

Do not advertise a global “TikTok connected” boolean as sufficient health.

### Provider detail

Show:

- Authorized identity and market.
- Connection/authorization state.
- Individual capabilities.
- Capability freshness or last successful update.
- Relevant permissions in product language.
- Connect, reconnect, or disconnect.
- What still works manually.

Example capability rows:

| Capability | Possible state |
|---|---|
| Authorization | Authorized / revoked / permission required |
| Product catalog | Available / delayed / unavailable |
| Post-LIVE analytics | Available / pending / unsupported |
| Realtime engagement | Available / stale / unavailable |
| Product action control | Unsupported / unavailable / eligible |
| Action verification | Available / unavailable / unknown |

Authorization is not equivalent to capability availability.

### Context safety

Before attaching a provider to a session, show the exact account, market, and room/session association.

Wrong identity quarantines only the affected provider. The user may correct it or detach it and continue manually. No username guessing or silent rebinding.

Changing account association during operation requires an explicit protected flow and fresh validation.

### Scope

P0 represents manual operating availability, the REAL/SIMULATED environment distinction, and the integration-state surface. Manual operation is a capability/fallback, not a mutually exclusive alternative to provider capabilities.

A live connector is shown as usable only when implemented and validated.

Official TikTok, managed realtime, external market context, and extension capabilities can be added individually. No mock Connect action may imply a working integration.

Dated repository research informs caution; current provider support must be revalidated when a connector is implemented.

Disconnect explains which capabilities stop and preserves historical provenance. Credentials and engineering diagnostics are not exposed in ordinary product flows.

## 16. SETTINGS

The standalone Settings surface is **P1**.

P0 exposes only absolutely required timezone/session-default UI directly in Create/Prepare. A Settings page is not a prerequisite for creating or operating a session.

The planned P1 settings contain only:

- Basic operator display identity.
- Timezone default.
- Keyboard shortcuts enabled/disabled.
- Optional alert sound, off by default.
- Basic session naming/default preferences where supported.

Timezone defaults to Asia/Ho_Chi_Minh for the initial target audience. Session timezone is recorded separately and remains visible in history.

English is the P0 interface language. Preserve support for Vietnamese product names and notes.

Use system reduced-motion preferences. Do not add a density selector initially; page-specific density already serves different jobs.

Authentication and trusted actor identity are prerequisites supplied by the application boundary and require later engineering decisions. A display name is not authorization. This plan does not introduce an enterprise RBAC or identity-administration suite.

## 17. Manual Operation

**REAL versus SIMULATED is environment identity. Manual operation is a capability/fallback, not a mutually exclusive session mode.**

A REAL session may simultaneously have manual operation, some available provider capabilities, and other capabilities that are unavailable or unknown.

Manual operation supports the entire loop with no external provider.

- Products come from entry, import, library, or clone.
- Run of Show drives preparation and plan-based NEXT.
- Operators explicitly record presentation, transitions, attempts, reports, and notes.
- Review reconstructs those records and their gaps.
- Learning and cloning remain complete.

No metric is required to end, review, or create the next session.

Provider loss during a REAL session changes capability availability; it does not require switching environment identity or creating a replacement session.

Manual operation remains available alongside provider capabilities. It does not imply that the client can communicate with LiveLift while offline.

Platform broadcast and pin verification can remain Unknown throughout a fully useful REAL session operated manually.

## 18. Simulator Mode

SIMULATED is a permanent environment identity once the session starts.

Show it:

- In session headers.
- Beside generated signals and evidence.
- In session rows.
- In replay and learning provenance.
- In copied/exported evidence if export is later added.

Use explicit text and a distinct functional icon, without neon or a disruptive banner.

### P0 rehearsal

Provide a deterministic example session that exercises:

- Segment transitions.
- Recommendation acceptance/rejection.
- Manual reporting.
- Provider loss.
- Stale input.
- Delayed evidence.
- Unknown verification.

Scenario controls remain secondary and simulator-only. Resetting a rehearsal creates a new simulated runtime; it does not erase a completed one.

Simulated observations cannot be used as real-session evidence. A simulator plan may be copied into a real draft, but simulated outcomes and lessons are excluded by default and any manually carried lesson remains labeled.

Changing a prepared session between REAL and SIMULATED requires explicit confirmation and removes incompatible bindings. Changing environment identity after runtime starts is prohibited. Manual operating availability is separate from this choice.

## 19. Evidence & Verification System

Use independent semantic dimensions, not one status ladder.

| Dimension | States |
|---|---|
| Plan | Planned, revised |
| Recommendation/decision | Recommended, accepted, rejected, overridden |
| Execution | No attempt recorded, attempted, operator reported |
| Evidence | Observed, platform confirmed, failed, unknown |
| Availability | Available, degraded, unavailable |
| Freshness/completeness | Fresh, stale, freshness unknown, partial |
| Environment | REAL, SIMULATED |
| Operating capabilities | Manual operating availability plus each provider capability independently |
| Metric finality | Pending, provisional, final, unavailable |
| Local report draft | UNSYNCED DRAFT; awaiting operator confirmation; submitting; submitted or submission unresolved |

An UNSYNCED DRAFT is not execution evidence or a server-history event.

### Reusable visual treatment

| State | Label/icon behavior |
|---|---|
| Planned | Schedule/list icon; “Planned”; applicable plan version |
| Recommended | Direction icon; proposed target; reason |
| Accepted | Decision check; actor/time; execution remains separate |
| Rejected | Dismissal icon; actor/time; optional reason |
| Attempted | Attempt icon; target/time; outcome displayed independently |
| Operator reported | Person icon; exact assertion and actor |
| Observed | Observation icon; source and observation time |
| Platform confirmed | Confirmation icon; authoritative source and matched postcondition |
| Failed | Failure icon; specific failed operation and evidence |
| Unknown | Question icon; what cannot be established |
| Stale | Age/clock icon; last value timestamp; excluded from current truth |
| Degraded | Partial-capability icon; working and affected capabilities |
| Unavailable | Unavailable icon; affected capability and manual alternative |
| Simulated | Simulator icon and explicit SIMULATED text |
| Conflict | Divergence icon; competing assertions with their sources |
| Unsynced report draft | Draft icon and explicit UNSYNCED DRAFT label; device-local, not submitted as history |

Labels remain readable at full opacity. Color is supplementary. Use existing neutral, sage, and attention surfaces; do not invent a separate palette per page.

### Detail disclosure

Every material assertion can expose:

- Target identity.
- Source and actor.
- Event/measurement time.
- Receipt time.
- Relevant age/window.
- Evidence class.
- Verification authority and scope.
- Conflict/correction links.
- Missing information.

Freshness follows capability/metric validity information supplied by the data contract. If no validity basis exists, show “Freshness unknown.” Never apply a universal arbitrary timeout to all evidence.

Verification is limited to the asserted target and postcondition. A confirmed pin does not prove presentation, sales, or causal effect.

## 20. Responsive Strategy

Dimensions below refer to the **browser viewport**, not canvas size.

### Width behavior

| Screen | 1280px laptop | 1440px desktop | 1600px+ / ultrawide |
|---|---|---|---|
| Home | Centered single task flow; max 1080px | Same, with supporting groups beside each other when useful | Cap at 1200px |
| Create | Form max 720px | Same | Same |
| PREPARE | 24px margins; Product Pack about 288px plus flexible ROS; readiness bottom region | 32px margins; about 292px Pack, flexible ROS, 280px readiness; 20px gaps | Pack 300–320px, readiness 280–300px; workspace cap 1600px |
| OPERATE | 24px margins; NOW roughly 44%, NEXT 56%; supporting ROS + one tab region | 32px margins; same hierarchy with more text/rows visible | Command workspace cap 1680px; no additional permanent widget columns |
| REVIEW | About 200px segment navigator + timeline; inspector on demand | About 208px navigator + flexible timeline + 320px inspector when it fits | Cap around 1760px; inspector may reach 360px |
| WRAP | Single flow max 960px | Same | Same |
| Sessions | Essential columns visible; secondary detail in row expansion | Add timezone/context columns if space permits | Cap around 1440px |
| Products/Packs | List plus on-demand editor | List plus 360px editor when space permits | Cap around 1440px |
| Integrations | Provider list and selected details | Optional list/detail split | Cap around 1200px |
| Settings, P1 | Form max 720px | Same | Same |

PREPARE’s rundown should retain at least approximately 600px when displayed beside reference regions. Collapse the reference region before breaking that minimum.

OPERATE’s NOW and NEXT should each retain approximately 480px. Below the two-column threshold, stack them and preserve the action path before secondary information.

### Scrolling and sticky regions

| Workspace | Scroll model |
|---|---|
| Home/Create/Wrap/Settings | Normal page scroll; sticky global header |
| PREPARE | Sticky shell/identity; Pack and ROS can scroll independently on roomy desktops; readiness remains reachable |
| OPERATE | Command band stays visible; ROS owns primary scroll; supporting tab has its own bounded scroll |
| REVIEW | Sticky knowledge controls and overview; navigator and event list scroll independently; inspector detail has local scroll |
| Sessions/Products | Page/list scroll with sticky column headers; editor scrolls locally |
| Integrations | Normal page scroll or bounded detail region on wide screens |

Avoid nested scroll containers inside rows or evidence excerpts.

### Short-height displays

At heights below approximately 760px:

- Compress session chrome and decorative spacing.
- Preserve 16px metadata and 44px controls.
- PREPARE uses a bottom readiness/action region with reserved content space.
- OPERATE shortens the command band by moving expanded evidence and historical reports into supporting detail.
- Keep current identity, elapsed time, target, primary reason, and routine actions visible at 1280×720.
- Hide Pulse/history by default; keep the ROS current row reachable.
- REVIEW shortens its overview and retains segment/event navigation.

Below approximately 640px height, allow page scrolling instead of clipping essential content. Use a compact sticky current/next summary and action region. Sticky content must not consume the entire visible workspace.

### Overflow and density

- No application-wide horizontal scrolling.
- Comparative REVIEW content may scroll horizontally within its region.
- Long product/session names wrap; codes and action targets stay identifiable.
- Wider displays increase useful row visibility, not unlimited line length.
- Browser zoom triggers the same layout collapses.
- Under laptop width, collapse secondary references before shrinking type.

## 21. Interaction System

| Pattern | Use | Boundary |
|---|---|---|
| Inline edit | Simple title, duration, priority, notes | Do not silently commit invalid data |
| Drag/reorder | Pack, future rundown, queue | Always offer keyboard/button equivalents |
| Side panel | Product/segment editor and evidence detail | One contextual panel at a time |
| Drawer | Detail when a permanent inspector cannot fit | Must not conceal routine OPERATE controls |
| Popover | Short options or action menu | Not long evidence or complex forms |
| Dialog | End runtime, abandon active session, takeover, consequential removal | No routine accept/reject/hold/report modal |
| Command bar | P1 only if navigation demand emerges | P0 uses contextual shortcut intents and menus |
| Toast | Brief acknowledgement and reversible draft changes | Never the sole record of failure |
| Confirmation | Irreversible lifecycle or identity change; submission of an offline report after resync | Name the target and consequence; offline-report confirmation can be inline |
| Undo | Preparation edits/removal and reversible draft operations | Runtime history uses explicit correction |
| Optimistic update | Local draft editing and clearly pending note presentation | No optimistic runtime or platform confirmation |
| Conflict notice | Stale edit/command | Show changed state; preserve user input |

Unsaved changes receive route-leave protection only when there is actual data at risk. Leaving an active desk warns that tracking continues; it does not imply ending the session.

## 22. Keyboard / Operator Efficiency

Preserve these P0 shortcut intents:

| Shortcut intent | Action |
|---|---|
| Accept recommendation | Accept the displayed recommendation |
| Start accepted target | Start the accepted target |
| Reject recommendation | Reject the displayed recommendation |
| Hold/resume | Hold/resume NEXT |
| Extend current | Extend current target by one minute |
| Quick note | Open quick note |
| Action report | Open action report |
| Dismiss transient UI | Close transient UI or cancel an uncommitted edit |

**Exact key combinations are a Design/usability decision and are not frozen by this plan.** Before assignment, test OS, browser, keyboard-layout, input-method, and assistive-technology conflicts, including Vietnamese input methods.

No global shortcut skips a segment, ends LIVE, or takes control.

Once assigned and validated, shortcuts:

- Are visible in contextual help and accessible control descriptions.
- Ignore held-key repeats.
- Are disabled while typing in editable controls.
- Require current ownership, valid revision, and an eligible target.
- Never act on a silently replaced recommendation.
- Can be disabled through the planned P1 Settings preference.

Tab order in OPERATE follows session identity/control, NOW controls, NEXT decision/action controls, rundown, supporting tabs, and details. Provide skip links to NEXT actions and Run of Show.

Routine controls use 44px minimum targets, with the primary transition approximately 56–66px high. Keep accept/start/reject/hold close together but distinguish their labels and hit targets.

## 23. Accessibility / Readability

- Rubik 400/500; preserve 600 only where functional emphasis needs it.
- Session/task titles approximately 29–32px.
- Product/segment identity approximately 22px.
- Operational body/action text 18px.
- Visible metadata never below 16px.
- Tabular numerals for clocks, durations, prices, and comparable counts.
- Text contrast at least 4.5:1 for normal text and 3:1 for qualifying large text.
- Interactive boundaries and focus indicators meet 3:1 contrast.
- Focus uses a visible 2px outline with offset.
- Interactive targets at least 44×44px.
- Disabled-control explanations stay readable.
- No hover-only action access.
- Reordering supports keyboard operation and announces the resulting position.
- Status uses labels/icons, not color alone.
- Screen-reader action names include exact segment/product targets.
- Timers do not announce every second.
- Command acknowledgements and safety-state changes use appropriate live regions.
- Focus remains stable through updates; dialogs return focus to their trigger.
- Reduced motion removes overlay movement and nonessential transitions.
- No flashing/pulsing connectivity indicators.
- At 200% zoom, essential actions remain operable through responsive layout changes.
- Test English labels alongside long Vietnamese names and diacritics.

## 24. Component Architecture

Organize components around domain responsibilities. Page-specific compositions remain page-specific.

```text
Application
├── AppShell
│   ├── PrimaryNavigation
│   ├── UserMenu
│   ├── ActiveSessionReturn
│   └── ConnectionAndRecordingStatus
├── SessionWorkspace
│   ├── SessionIdentity
│   ├── EnvironmentIdentity
│   ├── SessionStatus
│   └── OperatorControl
├── HomeWorkspace
│   ├── NextTask
│   └── SessionList
├── CreateLiveFlow
│   ├── SessionForm
│   └── ClonePreview
├── PrepareWorkspace
│   ├── ProductPack
│   │   ├── ProductRow
│   │   ├── ProductEditor
│   │   └── ProductImport
│   ├── RunOfShow
│   │   ├── SegmentRow
│   │   └── SegmentEditor
│   └── ReadinessAndStart
├── OperateWorkspace
│   ├── FocusedSessionHeader
│   ├── NowPanel
│   │   ├── RuntimeClock
│   │   ├── PresentationState
│   │   └── PinnedProductEvidence
│   ├── NextPanel
│   │   ├── WhyEvidence
│   │   └── OperatorActionBar
│   ├── OperationalRunOfShow
│   ├── SupportingRegion
│   │   ├── OperationalQueue
│   │   ├── ProductCoverage
│   │   ├── LivePulse
│   │   └── ActivityHistory
│   └── QuickCapture
├── WrapWorkspace
│   ├── RuntimeEndSummary
│   ├── OutstandingRecords
│   └── WrapNote
├── ReviewWorkspace
│   ├── ReplayKnowledgeControls
│   ├── ReplaySegmentNavigator
│   ├── ReplayTimeline
│   │   ├── PlannedActualTracks
│   │   ├── DecisionActionTracks
│   │   └── GapMarkers
│   ├── ReplayEventList
│   ├── EvidenceInspector
│   ├── MetricWindow
│   └── LearningWorkspace
│       ├── LearningObjectEditor
│       └── NextLiveChangeSelection
├── SessionsWorkspace
│   └── SessionList
├── ProductsWorkspace
│   ├── ProductLibrary
│   └── PackLibrary
└── IntegrationsWorkspace
    ├── ProviderList
    └── CapabilityDetail
```

Shared semantic primitives include EvidenceLabel, Source/Freshness, EnvironmentIdentity, CommandStatus, and contextual Empty/Unavailable/Conflict states. Manual operating availability is represented independently from EnvironmentIdentity.

Reuse product identity and rundown data semantics across pages, while allowing different preparation, operation, and replay row compositions.

Do not build a generic configurable dashboard engine, universal status enum, or a separate component for every label.

## 25. Frontend State Model

### State boundaries

| Boundary | Responsibility |
|---|---|
| Authoritative session state | Identity, REAL/SIMULATED environment, lifecycle, revision, active segment, control ownership |
| Saved plan state | Product snapshots, rundown, constraints, plan versions |
| Commands | Exact intent, pending result, acknowledgement, rejection, uncertain outcome |
| Evidence | Independent assertions, sources, timestamps, corrections, conflicts |
| Operating capabilities | Manual operating availability alongside provider capabilities |
| Provider capabilities | Authorization, identity binding, availability, freshness |
| Replay projection | Selected time, knowledge view, applicable historical records |
| Learning | Drafts, accepted/rejected proposals, next-session adoption |
| Local UI | Selection, expanded panel, filters, scroll, uncommitted edits |
| Local capture | Device-local notes/drafts; UNSYNCED report drafts; occurrence-time estimates and explicit submission-confirmation state |

Do not duplicate server truth in a general global UI store. Keep transient view state near its workspace and make navigation-relevant selections addressable.

### Lifecycle

**Planned → Active → Ended.**

Planned sessions can be abandoned before starting. Active sessions can be explicitly abandoned with partial history retained.

WRAP pending/complete, review progress, manual operating availability, provider health, and evidence finality are independent dimensions—not extra runtime lifecycle steps.

Ended or abandoned sessions cannot restart under the same identity.

### Minimum UI contracts

The frontend needs:

- Session identity, lifecycle, revision, runtime timestamps, REAL/SIMULATED environment, timezone, and ownership.
- Manual operating availability and independently represented provider capabilities.
- Versioned plan and session product snapshots.
- Recommendation identity, target, validity/constraints, recorded reasons, and rule version.
- Command scope: session, exact targets, decision where applicable, expected revision, actor, and stable intent identity.
- Command result: acknowledged, rejected, conflicting, pending, or unknown.
- Evidence identity, assertion, source/class, event time, receipt time, target context, and correction/conflict relationships.
- Display/exposure records sufficient to distinguish generated, delivered, displayed, and explicitly acknowledged recommendations.
- Metric definition/window/completeness/finality and as-of information.
- Replay data sufficient to reconstruct availability at a historical time.
- Learning provenance and selected change adoption.
- Capability-specific provider identity, permissions, freshness, and availability.

These are frontend contract requirements, not database or event-infrastructure prescriptions. Their engineering contracts still require later definition and validation.

### Asynchronous safety

Cache and request identity includes session and relevant context. Late responses from a previous route cannot replace the current session.

Apply newer authoritative revisions only. Detect missing continuity and resync rather than assuming an event stream is complete.

Derive clocks from authoritative timestamps and clock synchronization. Local timers interpolate display only. After reconnect or tab wake, reconcile before enabling transitions.

### Offline capture

Use a small browser-local durable capture buffer for notes and drafts only.

- Offline notes/drafts may persist locally.
- Offline action/operator reports remain explicitly labeled **“UNSYNCED DRAFT—saved on this device, not submitted to session history.”**
- Drafts do not appear as completed actions, authoritative current state, or server-history evidence.
- Preserve original capture time and distinguish it from later server receipt.
- Do not pretend offline timestamps are authoritative.
- Never queue Start, End, Accept, or other runtime commands.
- After reconnect/resync, review the current session context and require **explicit operator confirmation** before submitting each selected offline report as server history.
- Do not automatically submit reports merely because connectivity returns.
- Confirmed submissions use stable identity to prevent duplicates.
- Reports submitted after a session ends remain historical assertions, not current-state commands.
- Offline capture and confirmed report submission never alter authoritative runtime state or replay runtime commands.
- Conflicts require explicit review.
- If local storage fails, state that the draft is not saved and provide copyable text.

No full offline runtime, conflict-free replicated plan, or multi-writer timeline is required in P0.

## 26. Empty / Loading / Error / Degraded Matrix

| Workspace | Empty/loading | Save/error/conflict | Degraded/recovery |
|---|---|---|---|
| Home | First-run Create LIVE; labeled loading placeholders | Retry session tasks without showing false emptiness | Last-known active session labeled with age |
| Create | Blank or clone preview loading | Preserve form; reconcile uncertain creation | Provider absence does not block creation |
| Prepare | Add products/create first segment; loading plan identity first | Inline validation; Saving/Unsaved; retain stale edit for resolution | Manual readiness; block start only for required core failures |
| Operate | Active with no segment → Start first segment; initial snapshot gates controls | Pending command beside target; uncertain outcome; stale-revision explanation | Provider loss continues manual operation alongside remaining capabilities; client loss blocks runtime changes |
| Wrap | End confirmed; optional evidence pending | Preserve note and unsynced report drafts; uncertain end remains unresolved | Review opens without optional analytics |
| Review | Operator ledger valid without metrics; incremental event loading | Retry affected interval; never show retrieval failure as no events | Gaps, partial evidence, late additions, conflicts explicitly represented; unsubmitted drafts excluded |
| Learn | Prompt to add evidence-linked observation | Keep draft; show suggestion rejection/edit state | Manual learning remains available without AI |
| Sessions | Create LIVE; filters with no matches | Retry list; protected abandonment conflicts | Cached rows labeled as last-known; environment and capabilities remain separate |
| Products | Add/import product or pack | Preview invalid imports; preserve edits | Archived/source-stale data remains identified |
| Integrations | Manual operation available independently; optional providers absent | Reconnect, permission missing, revoked token, wrong-context detail | Capability-specific degradation and manual continuation |
| Settings, P1 | Defaults available | Preserve unsaved preferences; explain failed save | Device-only preferences clearly scoped |

### Cross-product exceptional states

- **Offline client:** last snapshot and local notes/drafts; action/operator reports labeled UNSYNCED DRAFT; runtime controls disabled.
- **Reconnecting:** check identity, ownership, revision, and pending outcomes; require explicit confirmation before offline-report submission.
- **Persistence unavailable:** no Saved claims or unlogged automatic side effects.
- **Wrong room/account:** quarantine affected source; offer correction or detachment.
- **Unknown:** valid evidence state, not a generic failure.
- **Partial:** show available portion and missing interval.
- **Stale revision:** preserve intended target; require a fresh action.
- **Session ended:** controls replaced with Wrap/Review access.
- **Abandoned:** partial history and explicit termination reason when supplied.
- **Historical replay:** no current-runtime controls.
- **Late evidence:** arrival marker and knowledge-view distinction.
- **Simulator:** explicit SIMULATED environment identity persists through every state.

Use local recovery instructions. Reserve persistent top-level alerts for problems affecting safe operation or recording.

## 27. Design Sequence

Design core failure behavior alongside the normal workflow, not after visual polish.

1. **Shared foundations and semantic specimen sheet:** LiveLift Control tokens, typography, controls, evidence labels, unknown/stale/conflict/simulated treatments.
2. **Minimal shell and session identity:** standard and focused forms; environment identity separate from capabilities.
3. **OPERATE at 1280×720 and 1440×900:** NOW/NEXT, accept-versus-start, manual reports, rundown, lead/assistant behavior.
4. **OPERATE safety states:** provider loss, client reconnect, unsynced report drafts and explicit submission confirmation, uncertain command, stale revision, wrong-room quarantine.
5. **PREPARE:** populated, empty, import, editor, validation, manual readiness, responsive action region.
6. **REVIEW:** planned/actual alignment, action chain, as-known-then, late evidence, gaps, product filtering.
7. **Learning and clone preview:** prove a concrete change reaches a new plan.
8. **Home, Create, and WRAP:** connect the complete journey; expose required timezone/session defaults.
9. **Sessions and Simulator:** lifecycle, contextual actions, environment identity, and rehearsal behavior.
10. **Products/Packs and Integrations:** minimal supporting surfaces; standalone Settings remains P1.
11. **1600px+, ultrawide, short-height, zoom, and narrower variants.**
12. **Keyboard/focus states, shortcut usability/conflict testing before key assignment, copy consistency, and final visual polish.**

Keep existing canvas nodes intact. New designs should be added as explicitly labeled successors or on a new canvas after human approval.

This sequence does not require every supporting design to be complete before the core workflow can be evaluated.

## 28. Implementation Sequence

Implementation begins only in a later authorized Code Mode turn.

The first usable core loop is the priority. The full set of surfaces planned in this document is not a prerequisite for that milestone.

### Phase 1 — Foundations and contracts

- Establish an isolated rebuild frontend boundary without assuming reuse of `/web`.
- Implement LiveLift Control foundations, routing, session identity, semantic labels, and contract fixtures.
- Establish exact command scope, revisions, ownership, timestamps, and replay knowledge requirements.
- Separate trusted actor identity from display preferences.
- Represent REAL/SIMULATED environment independently from manual and provider capabilities.

### Phase 2 — Manual preparation

- Home/Create.
- Product Pack import/editing.
- Run of Show editing.
- Readiness and authoritative start.
- Required timezone/session-default UI within the session flow.
- Minimal Sessions access.

### Phase 3 — Manual operation and wrap

- NOW/NEXT/WHY/ACTION.
- Decision-versus-transition semantics.
- Reporting, notes, coverage, queue, history.
- Duplicate prevention, reconnect, local notes/report drafts, explicit confirmation before offline-report submission, lead handoff.
- Authoritative end and short WRAP.

### Phase 4 — Replay and next session

- Planned/actual history.
- Recommendation/decision/action/evidence relationships.
- As-known-then and late evidence.
- Learning objects and selected change carry-forward.

Through Phase 4, the manual core loop can be usable without the completed reusable-library, integration-management, or Settings surfaces.

### Phase 5 — Supporting reuse and simulator

- Reusable Products/Packs and explicit refresh behavior.
- Minimal Integrations.
- Deterministic simulator using the same UI contracts.
- Complete failure and responsive coverage.

Simulator remains required for P0 completion. Standalone Settings and its nonessential preferences remain P1.

### Phase 6 — Optional integrations

Add one validated capability at a time after the manual loop passes acceptance. Unsupported capabilities remain honestly unavailable.

Provider capability definitions, authentication/trusted identity, backend contracts, framework, package versions, backend storage, deployment, and implementation details require later engineering decisions. This product plan does not authorize inheritance of legacy choices.

### Validation

Use a small meaningful suite focused on invariants:

- Complete manual golden-path rehearsal.
- Exact-target, duplicate, ownership, and stale-revision command checks.
- Offline draft persistence, explicit report-submission confirmation, and uncertain-response recovery.
- Replay knowledge-time and late-evidence checks.
- REAL/SIMULATED separation and manual/provider capability coexistence.
- Missing-versus-zero and reported-versus-confirmed rendering.
- Keyboard conflict/usability testing before assignment, contrast, zoom, and laptop viewport checks.

Do not add tests that merely mirror markup or snapshot every component.

## 29. Open UX Decisions

**No blocking UX decisions remain for entering Design Mode.**

This does not mean P0 is engineering-ready or that all implementation decisions are settled. Provider capabilities, authentication/trusted identity, backend contracts, and implementation details still require later engineering decisions and validation.

Confirmed during planning:

- LiveLift Control.
- English UI.
- One lead operator with assistants.
- Offline read-and-draft capture rather than full offline runtime.
- Explicit operator confirmation after reconnect/resync before submitting an offline report as server history.

Explicit defaults:

- One active session per workspace.
- REAL/SIMULATED environment identity.
- Manual operation available by default alongside any available provider capabilities.
- LEARN inside REVIEW.
- Dedicated short WRAP route.
- No P0 density selector, host workspace, command palette, or required AI.
- Asia/Ho_Chi_Minh initial timezone default.
- Standalone Settings is P1; required timezone/session defaults remain in the P0 session flow.

Operator testing may revise layout proportions and the extension increment. Until evidence justifies a change, those values and behaviors are the design defaults.

Exact shortcut key combinations remain a Design/usability decision. Test OS/browser/input-method and assistive-technology conflicts before assigning them.

Provider-specific validity windows and permission mappings must come from validated integration contracts; the frontend represents missing definitions as unknown rather than inventing them.

## 30. Anti-patterns / Risks

| Risk | Prevention |
|---|---|
| Dashboard clutter | NOW/NEXT command band; rundown plus one supporting tab region |
| Generic SaaS navigation | Three permanent destinations as surfaces ship; session work stays contextual |
| Integration dependency | Manual golden path passes before provider work |
| Manual/provider false exclusivity | REAL/SIMULATED environment separate from manual operating availability and individual provider capabilities |
| Misleading LIVE status | Separate LiveLift tracking from platform broadcast |
| Acceptance appears executed | Separate Accept and Start controls and records |
| Report appears confirmed | Independent evidence classes and source/time |
| Unsupported “seen” claims | Use generated/delivered/displayed/acknowledged distinctions |
| Recommendation contradicts plan | Explicit pull-forward reason and preserved plan order |
| Metrics obscure missing data | Gaps and unavailable labels; never default to zero |
| Late evidence rewrites history | Default as-known-then; visible later-evidence view |
| Too dense on laptops | Collapse references and secondary panels before shrinking text |
| Modal-heavy live operation | Inline actions and compact contextual capture |
| Alert fatigue | Affected-capability messages; one persistent safety notice per issue |
| Overcomponentization | Domain components, shared semantics, page-specific composition |
| Product library becomes PIM | Minimal metadata and explicit session snapshots |
| Review becomes an AI report | Timeline and evidence first; editable learning objects |
| Offline capture becomes fake runtime/history | UNSYNCED report drafts; resync and explicit operator confirmation before historical submission; no runtime mutation |
| Simulator contaminates real evidence | Immutable environment identity and provenance |
| Premature shortcut assignment | Retain intents; test OS/browser/input-method conflicts before binding keys |
| Supporting scope delays the core loop | Minimal supporting flow first; standalone Settings P1 |
| Impressive static mockup fails operationally | Design long lists, failures, timing, conflicts, and 1280×720 early |
| Legacy constraints leak into rebuild | Carry invariants, not experiment schedules or autopilot domain |

## 31. P0 Frontend Gate

Before production frontend coding begins, humans should be able to check the following against the approved plan and core design prototypes.

This gate does not require every planned supporting surface to be implemented or fully designed before the core loop is usable. Engineering decisions and validated contracts remain necessary before coding the behaviors that depend on them.

### Product continuity

- [ ] Home → Create → Prepare → Operate → Wrap → Review → Learn → Next LIVE is designed end to end.
- [ ] The complete journey works with no external integration or AI.
- [ ] Creating, starting, ending, reviewing, and cloning have distinct, explicit meanings.
- [ ] START/END LIVE copy distinguishes tracking from platform broadcast.
- [ ] Completed sessions never restart or mutate into next-session plans.
- [ ] Prepare, Operate, Review remain P0 CORE; Home, Create LIVE, Wrap, Sessions, Simulator remain P0 REQUIRED SUPPORTING.
- [ ] Products/Packs and Integrations remain P0 MINIMAL SUPPORT SURFACES.
- [ ] Standalone Settings is P1; only required timezone/session-default UI is included in the P0 session flow.

### Operator comprehension and safety

- [ ] A new operator can identify session, NOW, NEXT, WHY, ACTION, and uncertainty within five seconds.
- [ ] At 1280×720, NOW/NEXT, the primary reason, and routine controls require no initial scrolling.
- [ ] Accepting a recommendation leaves NOW unchanged.
- [ ] Start requires a distinct user action and exact target.
- [ ] Rejecting a recommendation does not silently skip a segment.
- [ ] Hold does not freeze elapsed time.
- [ ] Presenting, pinned, and recommended products remain separate.
- [ ] Lead/assistant controls and explicit handoff are designed.
- [ ] Double clicks, stale revisions, timeouts, and reconnect cannot execute unintended actions.
- [ ] Provider loss preserves manual operation alongside any remaining capabilities.
- [ ] REAL/SIMULATED environment identity is distinct from manual/provider capability availability.
- [ ] Client or persistence loss never displays false Saved/Active acknowledgements.
- [ ] Offline action/operator reports remain UNSYNCED DRAFTS until explicit confirmation after reconnect/resync.
- [ ] Offline capture and later report submission cannot alter authoritative runtime state.

### Evidence and replay

- [ ] Missing measurement is distinct from measured zero.
- [ ] Attempt, operator report, observation, confirmation, failure, and unknown have distinct readable treatments.
- [ ] HTTP success cannot become platform verification.
- [ ] Wrong account/room/session data is quarantined.
- [ ] Recommendation delivery/display/acknowledgement is distinguishable without claiming human attention.
- [ ] Replay preserves plan versions and actual timing.
- [ ] As-known-then excludes information not yet received.
- [ ] Unsubmitted offline drafts are excluded from server history; confirmed later reports preserve occurrence/capture and receipt times.
- [ ] Later evidence and corrections remain visibly later.
- [ ] Gaps and conflicts remain inspectable.
- [ ] Metric windows include definitions, sources, completeness, and as-of state.
- [ ] Simulated data remains identifiable throughout the loop.

### Learning and supporting scope

- [ ] An evidence-linked observation can become an editable hypothesis and concrete next-live change.
- [ ] Changes require explicit selection before application.
- [ ] Clone preview preserves provenance and excludes old actual state.
- [ ] Global product edits cannot silently alter session snapshots.
- [ ] Home contains actionable tasks rather than vanity KPIs.
- [ ] Products and Integrations remain smaller than the core workspaces; P1 Settings does not block the core loop.

### Design and accessibility

- [ ] LiveLift Control is selected for subsequent design work.
- [ ] Existing canvas designs remain intact.
- [ ] Essential metadata is at least 16px and controls at least 44px.
- [ ] Contrast, focus, keyboard navigation, and non-color status communication are specified.
- [ ] Shortcut intents are preserved; exact combinations require Design/usability and OS/browser/input-method conflict testing before assignment.
- [ ] Long names, long sessions, empty data, and missing capabilities are represented.
- [ ] 1280px, 1440px, 1600px+, ultrawide, short-height, and zoom behavior is designed.
- [ ] Sticky regions do not obscure content or create unusable scrolling.
- [ ] No speculative platform capability appears as working.

**First Design Mode deliverable after approval:** a shared semantic foundation sheet and the focused OPERATE workspace at **1280×720 and 1440×900**, including manual operation alongside independent provider capabilities, acceptance-before-start, unknown pin verification, and reconnect behavior with unsynced report drafts. PREPARE and semantic REVIEW follow in that order.