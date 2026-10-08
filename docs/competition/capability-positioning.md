# LiveLift V3 competition capability positioning

LiveLift is a show operations product for the operator beside a host:

**Create → Prepare → Operate → Review → Next LIVE**

Operate presents **NOW → NEXT → WHY → ACTION**. TikTok owns video, chat,
native actions and native platform analytics. LiveLift owns the plan, clock,
operator decisions, recorded evidence, Review and the next plan.

## What is available in this candidate

| Category | Behavior today | Requirements and limits |
|---|---|---|
| AVAILABLE | Create and prepare a timed run of show; operate it; compare baseline and recorded actuals; select adjustments for Next LIVE | REAL requires a configured shared room, managed SQLite storage and a signed-in operator. Room/server failure pauses REAL writes. No platform integration is required. |
| AVAILABLE | Simulator with scripted scenarios and a manual virtual clock | Browser storage; always SIMULATED; never REAL history or learning. |
| AVAILABLE | Shared room records and receipts; workspace JSON export | Configured server and operator permissions. Export controls are on Sessions; export contains REAL operations, excludes browser rehearsals and account secrets. |
| MANUAL / BUILT-IN | Product library snapshots, pasted CSV/TSV, pacing decisions, cues and operator reports | A sample product remains labelled as a sample. Missing price stays “Not entered”; known zero is zero. |
| PLATFORM-LIMITED | Potential TikTok, Shopee, YouTube and Facebook connections | No provider is connected to this V3 candidate. Sanctioned provider access, credentials and verified permissions would be required before offering an integration. |
| UNSUPPORTED / NOT CONNECTED | TikTok pin/unpin, promotion control, realtime chat ingestion, platform analytics import | The operator uses TikTok directly. LiveLift does not execute these actions, scrape chat or fabricate platform metrics. |
| UNKNOWN | Independent platform action verification | No independent verification channel is connected. An operator report or successful HTTP request is not platform confirmation. |

The older Python product includes platform-related tooling under
`src/livelift/ingest/`. It is separate from the V3 app in `next/` and does not
make any connection functional in the V3 competition candidate. This document
supersedes the capability lane's earlier descriptions of causal measurement,
host blinding, dual knowledge lenses and engineered V3 provider clients.
Those are not claims made by this candidate. Provider API and legal details
are outside this competition walkthrough.

## Evidence that must stay distinct

- Missing != zero; planned != actual.
- Recommendation != acceptance != attempt != performed.
- Operator reported != provider observed != platform confirmed.
- Unknown != failed. A report or attempt may exist while its outcome lacks confirmation.
- REAL != SIMULATED.
- Observation != causation. One show supports a manual planning choice, not a sales claim.
- Browser/HTTP action != verified TikTok action.

Review preserves the baseline and recorded history. Notes and corrections
append evidence; they do not silently rewrite it. Next LIVE copies a clean
plan with only the changes the operator selects, without old runtime or reports.

## Presenter language

“LiveLift works beside TikTok. We prepare the show, operate with NOW, NEXT,
WHY and ACTION, record what the operator reports, review the plan against
actuals, and choose what goes into the next plan. This demo is SIMULATED.
No platform provider is connected. Platform-limited capabilities are intentional;
we do not need a TikTok connection to demonstrate the show operations loop.”

See the [presenter guide](v3-demo/README.md), [judge guide](v3-demo/JUDGE-GUIDE.md)
and [integrated acceptance report](integration-acceptance.md).
