# LiveLift operational intelligence V1

Open **Insights** from the main navigation (`/insights`). REAL is the default. Select SIMULATED explicitly to inspect browser rehearsals. No analytics database, charting package, provider API call, or new mutable history is introduced.

## Architecture and evidence

`next/src/lib/domain/analytics.ts` exposes pure, typed `deriveSessionAnalytics` and `deriveIntelligence` functions. They read existing `Session` contracts and reuse baseline/current plans, plan scheduling, and the existing Plan vs Actual review. A mandatory environment filter keeps every summary, ranking, trend, and Next LIVE record in one environment. Derivation never writes to session stores, edits events, or modifies plans.

REAL input comes from the existing shared room snapshot through `useSessions`; SIMULATED input comes from the browser store. Legacy browser REAL archives are deliberately outside this room analytics view. A stale room snapshot is marked as last confirmed history. An unavailable room or browser store is disclosed; inability to load history is not an empty account. Insights reflects loaded history, not an assertion about records outside that source.

| Metric | Authoritative evidence | Interpretation |
| --- | --- | --- |
| Baseline and current segment targets | Immutable `plans[0]`, latest plan revision | Planned allocation, never actual duration |
| Actual segment duration | Completed runtime segment with recorded start and end | Recorded tracking interval, not proof of content coverage |
| Start difference | Recorded start minus scheduled baseline start | Unknown if either boundary is missing |
| Overrun / underrun | Actual duration minus baseline target | Flags at +15 / −15 seconds; ranking includes the largest 10 overruns |
| Completed / not reached / skipped / incomplete | Runtime state and existing review outcomes | Ending a show does not mark unreached segments completed |
| Declared content coverage | Runtime `coverage` and `followUp` | Complete, partial, or not declared; duration cannot imply coverage |
| Cue report coverage | Latest plan's operator cues and runtime report timestamps | Reports / operator cues; presenter information is excluded |
| Cue and unplanned action outcomes | Runtime report state and timestamps | Performed is a report; attempted remains unresolved; cancellation is explicit |
| Operator note counts and text | Append-only `note_added` events | No categories inferred: the current note command records free text only |
| Recovery selections | Append-only `recovery_selected` events | Recorded decisions; no claim of successful recovery or causation |
| Session duration | Ended tracking with recorded session start and end | Tracked elapsed time, not platform broadcast duration |
| Baseline show span | Scheduled baseline finish minus planned start | Includes anchor waiting; distinct from the sum of host targets |
| Cross-session trend | Ended sessions in the current selection | Table and bars preserve each session's values; no imputed average |
| Repeated deviation | Recorded segment kind overran in at least two selected ended sessions | Counts sessions with comparable timing, not repeated rows; no causal claim |
| Next LIVE changes | Destination session's `derivedFrom.appliedChanges` | Only saved selections, not unselected proposals or presumed improvements |
| Corrections / clock discontinuities | Append-only events | Context warning with Review link; original measurements remain unchanged |

## Missing-data and evidence rules

- Missing is `null`, never zero. A genuinely recorded zero-length interval stays zero. Reversed or incomplete boundaries have no duration.
- Not reached has no actual duration or variance. Planned and active sessions do not enter ended-session trends. An ended session can still have incomplete timing or undeclared coverage.
- A known target can still be compared with an actual duration when an upstream missing target makes the scheduled start unknown. Start variance remains missing.
- Cue report coverage includes a cue only when a report timestamp exists, including timestamp zero. Performed, attempted, and cancelled reports remain separate states. No operator cues means not applicable, not 0% or 100%.
- Operator reported does not mean provider observed or platform confirmed. Verification remains unknown. No report never becomes failed. SIMULATED reports never become REAL evidence.
- Notes and appended corrections may be added after tracking ended. Derivation uses the latest loaded history and does not rewrite the original events.
- All visual marks share a zero origin and a documented maximum within each timing view. Missing values have no mark. Exact numeric values, captions, row/column headers, and keyboard-focusable scroll regions provide table equivalents. Color is supplementary.

## Filters and responsive behavior

Environment, session, lifecycle, inclusive UTC date range, and newest/oldest order are available. Session date uses recorded start, falling back to baseline planned start. This makes planned sessions discoverable without inventing an actual start. Next LIVE history uses destination plan creation time for its date filter and includes plans derived from the selected source. Lifecycle applies to session summaries and trends, not to destination plans: an ended source can have a planned next show.

Cards and filters collapse into one column on narrow screens. Timing tables scroll inside named regions; the page itself must not overflow at 375×667, 768×900, or 1440×900. Filter controls and inspection buttons have at least 44px height. Shared focus styles and dedicated table focus outlines support keyboard use.

## Provider-data future seam

`ProviderMetric` is a separate type for future TikTok Shop / LIVE inputs. Each metric requires a session and environment, metric name, nullable value, unit, observation timestamp, source reference, and an evidence level (`provider_observed` or `platform_confirmed`). These evidence levels are distinct. A future adapter must validate its provider inputs and session association before passing them to a separate provider read model.

V1 supplies no provider metric values. The Provider analytics panel explicitly says unavailable. TikTok Login Kit account identity and authorization do not establish LIVE performance access. Views, GMV, CTR, conversion, engagement, and sales are not derived from LiveLift timing, notes, recovery selections, or cue reports. No Login Kit behavior or provider files were changed.

## Competition demo sequence (about 2 minutes)

1. Open Insights with REAL selected. If signed out or the room is unavailable, point out that unavailable history is not zero shows. With a room and sign-in, inspect an ended REAL tracking session.
2. Select SIMULATED. The shipped completed rehearsal is explicit rehearsal evidence. For multiple-session patterns, open Simulator and finish both the buffered and missed-anchor scenarios through their scripted steps.
3. Inspect the buffered session: Zip Hoodie planned 6:00, recorded 9:00, +3:00. Explain that segment completion and content coverage are separate.
4. Show cue report coverage and unknown platform verification. An unreported cue is unknown, not a failed platform action.
5. Show the overrun ranking and repeated deviations across ended rehearsals. They describe recorded observations, not causes or provider performance.
6. In the buffered Review, select the Opening 3:00 → 2:00 trade-off in Next LIVE and create its new plan. Return to Insights to show the saved adjustment and source/destination history. Its source show remains unchanged.
7. Filter to a planned session with ended tracking selected to show the empty state. Finish at Provider analytics: no TikTok performance values have been invented.

## Verification

Use Node 22.23.3 from `next/`:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

`analytics.test.ts` covers null vs zero, baseline vs actual, unreached/incomplete segments, partial cue/content coverage, claims vs confirmation, environment isolation, repeated sessions, filters, notes/recovery events, saved Next LIVE selections, and frozen input/history preservation. `analytics.ui.test.tsx` covers unavailable/loading/stale/empty states, filters, equivalent table values, missing timing, and provider boundaries.

Run browser acceptance against a **disposable** runtime; it records actual application commands and creates tracking sessions. Playwright comes from the audit environment, not application dependencies:

```sh
NODE_PATH=/path/to/installed/node_modules \
LIVELIFT_BROWSER_URL=https://your-disposable-runtime \
LIVELIFT_BROWSER_EVIDENCE=/tmp/analytics-evidence \
LIVELIFT_BROWSER_AUTH_FILE=/path/to/protected-test-credentials.json \
node acceptance/analytics-browser.mjs
```

The optional protected credentials file has `username` and `password` and enables REAL tracking verification. Without it, the script exercises unavailable REAL history and browser rehearsals. Browser checks cover all three required sizes, page overflow, accessible table equivalents, focus visibility, control reachability, filter behavior, Next LIVE history, no historical mutation, environment separation, provider boundaries, and runtime/CSP errors. Screenshots and `analytics-results.json` are written to the evidence directory. Existing `acceptance/competition-browser.mjs` remains unchanged and supplies the full competition flow regression.

Verified on 2026-10-07 with Node 22.23.3: clean install, typecheck, lint, production build, and all 48 test files passed (692 tests passed; 57 existing skips). Production audit found zero vulnerabilities. Analytics browser acceptance passed 18 captures across all three sizes, including REAL tracking, SIMULATED rehearsals, horizontal keyboard scrolling, and unchanged rehearsal history. Existing competition acceptance passed 102 captures and 32 internal links with no runtime exceptions. Expected signed-out HTTP 401 messages were allowed; no unexpected browser/CSP errors were found.
