# LiveLift V7: LIVE intelligence experience (UX)

Originally delivered on `orca/v7-live-intelligence-ui`; now integrated with Provider Core on `orca/v7-final-integration`.
The final canonical contract, production API and certification results are recorded in [V7 integration acceptance](V7-INTEGRATION-ACCEPTANCE.md).

V7 adds a second layer to LiveLift's loop. Operate records what the operator did and reported while the LIVE ran. Review
can then show, beside it, what a provider observed **afterwards**. The one idea the interface protects:

> Later evidence must never appear as if the operator knew it during the LIVE.

## 1. Experience model

| Surface | What V7 adds | Where |
|---|---|---|
| Operate | **Quick report**: five one-tap *operator reported* cues, recorded as ordinary notes | `components/ops/QuickReports.tsx` |
| Review | **As known then / With later evidence** perspective control; replay timeline; later-evidence view | `app/live/[sessionId]/review/page.tsx`, `components/intelligence/*` |
| Insights | Two labelled bands: *LiveLift operations* (unchanged analytics) and *Platform evidence* | `app/insights/page.tsx`, `components/intelligence/PlatformEvidencePanel.tsx` |
| Integrations | **Provider evidence access** ledger: what TikTok does and does not offer | `app/integrations/page.tsx`, `components/intelligence/CapabilityLedger.tsx` |
| AI Copilot (Review) | Operations evidence / provider evidence / interpretation / recommendation kept apart | `components/ai/ReviewCopilot.tsx`, `CopilotParts.tsx` |
| Home | One sentence in the Review step: later evidence "stays separate" | `components/onboarding/loop.ts` |

No new top-level navigation was added. V7 lives inside Review and Insights.

## 2. Semantics the UI will not blur

```
Missing != zero                 Planned != actual
Recommendation != acceptance    Acceptance != attempt          Attempt != performed
Operator reported != provider observed != platform confirmed
Unknown != failed               REAL != SIMULATED
Observation != causation        Later evidence != evidence known during the LIVE
```

Colour roles are kept apart: **lime** = what LiveLift recorded/did and the one live action; **provider ink** (a cool,
quiet off-white `#B4C6DD`) = what a provider observed later; **cyan** = AI; **violet** = SIMULATED / fixture; **amber** = look
at this. Every state is also carried by words and an icon, never by colour alone.

## 3. As known then

The default perspective. It shows the existing Review (plan vs actual, segments, cues, history) and adds a **replay**,
"What you knew, in order":

- strictly the records written up to and including `session_ended`; notes and corrections appended afterwards are
  *counted* ("N notes recorded after the LIVE ended… not replayed") but never placed on the timeline;
- lanes: Plan, Actual, Decision (lime), Operator report; each decision/report shows **what the plan expected and what was
  actually running at that moment**, which answers "why did I decide that, then?";
- historical Creator receipt records come from the actual server path, constrained by recorded and observed times. If none
  were recorded, the view says so; post-LIVE snapshots are excluded. LiveLift cannot see what TikTok’s own screens showed;
- progressive disclosure: decisions and reports first; "Show every recorded step (N more)" reveals segment starts/ends.

The AI Copilot, in this perspective, hides provider facts and any AI statement that rests on one, and counts what it hid.

## 4. With later evidence

Selecting it **never mutates the session** (view state only; `?perspective=later` can be shared). The first thing on screen
is one sentence: **"This data was not available to the operator during the LIVE."**, with provenance beneath it (tier, fetched
time, source). Then:

1. **Provider evidence on the recorded show**: one bar per provider minute, aligned to the segments the operator recorded.
   A metric picker (Clicks, Orders, GMV, Viewers, Impressions, Comments) shows one series at a time. Every bar starts at
   zero; a direct label gives the peak; a table twin ("Minute-by-minute table") carries every value.
2. **Segment attribution**: per segment: recorded duration (operator's record) with overrun/underrun in words, headline
   Clicks/Orders/GMV, attribution coverage, and a per-row **Details** disclosure with all metrics, boundary minutes and
   limitations. Segments that never ran are one quiet line, not a row of dashes.
3. **Observed patterns**: association statements only ("higher during", "rose from … to …", "overran while … stayed at or
   above"), each with the provider minutes it rests on.
4. **Product performance**: per-product provider figures for the whole LIVE.
5. Aside (desktop) / below (tablet, phone): **Where this came from** and **What this cannot tell you**.

Layout: phone stacks everything; tablet pairs duration beside evidence; the two-column split (content + provenance) and the
five-column attribution grid only appear on wide desktops.

## 5. Provider evidence semantics

- `LiveIntelligenceSnapshot.perspective` is always `later_evidence`. A snapshot that is not, that names another show, or that
  identifies itself as fixture/SIMULATED for a REAL show is **refused** and shown as "LiveLift could not trust the evidence".
- A provider metric that is not `available` carries no value. `available` without a number is read as *missing*.
- Absent states are their own screens, each stating that the figure is *unknown, not zero*:
  not configured · access not granted · authorization expired · rate limited (with retry hint) · unsupported by the official
  API · still settling · unavailable/untrusted · signed out · local archive (not in the room).
- Evidence is fetched only when the operator opens it (Review → "With later evidence", Insights → "Check provider evidence").

## 6. Missing and zero

| Value | Number/table | Chart | Words |
|---|---|---|---|
| Recorded 0 | `0` (`data-state="zero"`) | a 2px tick on the baseline | "Recorded as 0" in the key; "all 0" on the metric picker |
| Not recorded | *Not recorded* (italic) | a hollow ring at the baseline; **no bar** | "Not recorded (N)"; "not recorded" on the picker |
| Unsupported | *Not offered by the provider* | no chart; a note | "This is not zero." |
| Unknown | *Unknown* | none | |
| Sum with holes | `≥ 1,234` | n/a | "N min not recorded" |

CTOR is only ever the provider's figure. With 0 clicks and no CTOR it reads *Not defined (0 clicks)*, never `0%`. A GMV
amount always names its currency, is never added across currencies, and with no stated currency is a bare number labelled
"currency not stated".

## 7. Ambiguous attribution

A one-minute provider bucket can straddle two segments. That is intentional, not an error. The minute is **not assigned to
either segment**: it is drawn as a **hollow, dashed bar** on the chart, counted in the key ("Boundary minute: overlaps two
segments, not assigned to either"), listed in the segment's Details ("Attribution ambiguous at this boundary… overlaps this
segment and "X". Not assigned to either."), and labelled `Boundary: A | B` in the minute table. Segment totals contain only
minutes that lie fully inside the recorded window; observed patterns also leave boundary minutes out.

## 8. Operator quick cues

TikTok exposes no raw LIVE comment text and no pin events, so the operator is the only observer. **Quick report** (Operate
toolbar, beside **Note**) offers: *Price questions rising · CTA delivered · Product pin changed · Audience reaction spike ·
Unexpected issue*.

- Header: **OPERATOR REPORTED**. Footer: "LiveLift cannot read TikTok comments; this is what you saw, not a platform confirmation."
- Recorded through the **existing `add_note` command** as `"<label> (operator-reported quick cue)"`. The authority stamps the
  time. No new event type, no authority/schema change, no provider state, no effect on segments, cues or the plan.
- Review recognises the fixed suffix and labels the entry **Operator reported** in the operator lane of the replay.
- Keyboard: trigger opens and focuses the first cue; Up/Down wrap; Enter/Space record; Escape closes and returns focus. On a
  phone it is a bottom sheet (thumb reach); from `sm` it is a compact two-column popover under the toolbar.
- The toolbar is a `fieldset`: a read-only viewer or an unreachable room disables it with everything else.

## 9. Fixture presentation

Fixture provider evidence exists **only for SIMULATED rehearsals**, never for REAL (enforced in `fixtureResultFor`, and again
by the client adapter, which rejects fixture-labelled data for a REAL show).

- Banner: **FIXTURE PROVIDER EVIDENCE · SIMULATED. Not TikTok data, and never shown for a REAL show.** with a **Fixture state**
  picker: Rich · Ambiguous boundary · Repeated product mapping · Zero clicks · Missing clicks · Zero GMV · Missing GMV ·
  Unsupported comments · Not configured · Access not granted · Authorization expired · Rate limited · Unavailable.
- Deterministic: generated from the show's own recorded times, no randomness, parsed through the same parser as real data.
- Deep link: `/live/<id>/review?perspective=later&evidence=<state>`.
- Insights shows no fixture by default (it states "Unavailable: no provider-observed…"); fixture evidence needs an explicit,
  labelled opt-in.

## 10. Competition / demo flow

1. **Home**: the loop; Review step now notes later evidence "stays separate".
2. **Simulator → Prepare → Operate** (`sim-buffered`): apply two scripted steps, tap **Quick report → CTA delivered**
   (keyboard works), finish the rehearsal.
3. **Review → As known then**: the replay shows the quick cue as *Operator reported*, with the plan-versus-actual context.
4. **Review → With later evidence**: read the disclosure first, then the chart (try Orders, then Clicks), open a segment's
   **Details**; switch **Fixture state** to *Ambiguous minute boundary*, *Missing clicks*, *Zero clicks*, *Rate limited*.
5. **Insights**: *LiveLift operations* above, *Platform evidence* below; opt into the fixture and read Product performance.
6. **AI Copilot** (Review): operations evidence vs provider evidence vs interpretation vs "Recommended, not applied".
7. **Integrations**: **Provider evidence access**: CONNECTED / ACCESS NOT CONFIGURED / PARTNER ACCESS REQUIRED / UNSUPPORTED BY
   OFFICIAL API.

## 11. Impeccable design principles used (Operate mode)

- **Operate, not Persuade.** A professional livestream desk: scannable, calm, dense where useful, truthful. No hero metrics.
- **Evidence beside the show it describes.** One timeline-aligned chart and a table beat a dashboard of tiles.
- **Thin marks, one axis, honest zero.** Bars start at zero, capped width, 2px gaps; no dual axes, no gauges, no pies.
- **Every chart has its table.** The minute table and the attribution table carry the same facts as words.
- **Progressive disclosure over density.** Headline metrics inline; the rest behind per-row **Details**; the minute table
  behind a disclosure; "every recorded step" behind a toggle.
- **Uncertainty looks deliberate.** Hollow dashed bars and a sentence, not an error banner.
- **No decoration.** No gradients, glows, glass, nested cards, kickers or pill ladders. Cards only where a surface is a region.
- **Restrained colour with fixed roles** (section 2); states are words first.
- **Mobile is designed, not collapsed.** Stacked rows, a bottom-docked quick-report sheet, one metric column in the minute
  table, labels that disappear rather than truncate to a letter. All V7 targets ≥ 44px.
- **Native semantics.** Tabs with arrow/Home/End, a radio group for metrics, `details`/`summary`, real tables, `aria-expanded`.

## 12. File map

```
next/src/lib/intelligence/        canonical type re-exports, strict shared parser, thin HTTP client, formatting and shared-core fixtures
next/src/components/intelligence/ PerspectiveTabs, EvidenceTimeline, SegmentAttributionTable, ProductPerformanceTable,
                                  ReplayTimeline, LaterEvidenceView, PlatformEvidencePanel, CapabilityLedger, ProviderState,
                                  EvidenceParts, useLiveIntelligence
next/src/components/ops/QuickReports.tsx
next/src/__tests__/v7/            intelligence.lib, review.perspective, quickreports, evidence.components
next/acceptance/live-intelligence-browser.mjs   browser acceptance for the V7 surfaces
```

## 13. Final integrated contract

`next/src/contracts/liveIntelligence.ts` is authoritative. The prototype lane seam was removed, including its local structural types, tolerant timestamp/number coercion, guessed product matches and competing attribution implementation.

- `GET /api/v3/intelligence/status` returns the canonical uppercase provider state and 13-entry capability matrix.
- `GET /api/v3/intelligence/evidence` reads authoritative REAL evidence by room/session identity; `POST` reads explicitly supplied SIMULATED rehearsal state. Both support historical and later perspectives, with immutable snapshots addressable by UUID.
- `POST /api/v3/intelligence/refresh` carries command UUID, room/session identity, expected revision, explicit provider LIVE identity for REAL and optional stable product mappings. Existing cookie/context/CSRF/operator checks apply.
- Timestamps are integer epoch milliseconds. Money is exact decimal `{ amount, currency }`; ratios are exact numerator/denominator strings. Missing stays missing. No ISO dates, numeric-string counts, aliases or guessed currency are accepted.
- Review AI receives canonical provenance fields (`evidenceTier`, `source`, `fetchedAt`, `perspective`); `kind` remains recorded/simulated. Later-cited statements and analyses using post-LIVE appended records are withheld in As known then. Operate never loads later snapshots.
- SIMULATED demos reuse Provider Core’s pure fixture parser/reconciliation. Operators may fetch and persist an explicitly labelled fixture through the actual server. REAL never requests or falls back to fixtures.
- Browser certification uses production LiveLift routes. Only the upstream TikTok/AI hosts are doubled inside disposable certification runtimes; no LiveLift API is intercepted. Missing provider routes are unexpected HTTP failures.

See [V7 integration acceptance](V7-INTEGRATION-ACCEPTANCE.md) for the final results and external provider-access limits.
