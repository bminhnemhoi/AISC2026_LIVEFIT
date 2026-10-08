# LiveLift V3 — competition demo (3 to 5 minutes)

> Written for the V3 freeze (`v3.0.0-competition`). Since then the product gained TikTok Login Kit (V4), Insights and
> the AI Copilot (V5) and LIVE Intelligence with labelled fixture provider evidence (V7). The flow below still works;
> for current status see the [root README](../../../README.md#demo).

Each step below was clicked through on this build in a browser before it was written down.
Where a step was **not** exercised, it says so.

This is the V3 app in `next/`. It is separate from the older Python desk described in
`kich-ban-demo-7-phut.md`.

## The one-paragraph pitch

LiveLift is the operating desk around a TikTok Shop LIVE. An operator who works beside a host
builds a timed run of show, runs it from one screen that shows what is on **now**, what is
**next**, **why**, and what to do when time slips, then records what actually happened and
reviews it truthfully. The review feeds the plan for the next LIVE:

**Create → Prepare → Operate → Review → Next LIVE.**

It does not replace TikTok and is not connected to it. See "What we do not claim" below.

## What is REAL and what is SIMULATED in this demo

| | What it is | Where it lives | In this demo |
|---|---|---|---|
| **SIMULATED** | A rehearsal that runs through the same engine on a virtual clock that only moves when you move it | This browser only | The whole walkthrough below |
| **REAL** | A show you actually run, recorded with the signed-in operator and the room's clock | The shared room on the server | Only if a room is deployed and you can sign in (see "Optional: REAL") |
| **Not connected** | TikTok analytics, realtime engagement, pin or promotion control, platform verification | n/a | Listed as Unsupported or Not connected on **Integrations** |

Every rehearsal is badged SIMULATED wherever it appears, and its Review says so at the top.
Nothing in the demo is presented as real evidence.

## Before you present (10 minutes, once)

Rehearsal-only setup, no room server or account needed. From the repository root:

```sh
./start-livelift-demo        # http://localhost:3130; keep terminal open
./check-livelift-demo        # run in a second terminal
./reset-livelift-demo        # opens Simulator; confirm reset there
```

Install dependencies once with `cd next && npm ci` if prompted. The launcher uses `next dev`
with REAL authority configuration disabled for its child. A production build (`npm start`)
refuses to boot without deployment configuration, by design. Authority readiness is expected
to return 503 in this rehearsal-only runtime; the app, health and Simulator checks must pass.
Ctrl+C or `./stop-livelift-demo` stops only the managed rehearsal server, retaining browser state.
The [presenter cheat sheet](../PRESENTER-CHEATSHEET.md) and [emergency kit](../EMERGENCY-DEMO.md)
are the short presentation/recovery references.

Open `http://localhost:3130/` in a fresh window. With no room server you will see:

- a red banner, "The sign-in service cannot be reached ... Rehearsals still work";
- a "Sign-in is unavailable" panel on Home, above the loop strip.

That is expected, and it is the product being honest: it will not pass a failure off as an
empty account. Say so out loud in the first beat. The rehearsal path does not need the room.
When a room is reachable and signed in, Home shows a first-run card instead, with three entry
points: Create a LIVE, Try Simulator, and Open sample Review.

Reset before each take: **Simulator → Reset this run** on "Fall collection rehearsal" (the
button appears once a run has started; a fresh browser does not need it).

Dev mode logs Content-Security-Policy warnings from development styles and React debugging. The production policy remains strict. See [the integration acceptance report](../integration-acceptance.md) for the tested runtime and findings.

## The flow

Target 4 minutes. Each beat stands alone, so you can cut to 3.

| Time | Where | Do | Say |
|---|---|---|---|
| 0:00 | **Home** | Point at the subtitle, then the five-step strip **How a LIVE runs in LiveLift**, then the bottom panel **What is real, and what is not**. | "LiveLift is the desk around a LIVE, for the operator beside the host. Plan, run, review, and carry the lesson into the next one. It sits next to TikTok, not inside it. REAL and SIMULATED are how you always know what you are looking at. The red banner is the app telling the truth: no room server here, rehearsals still work." |
| 0:45 | **Create LIVE** (top right) | Show the four starting points and the **Create as SIMULATED rehearsal** toggle. Do not submit. Click Cancel. | "Starting is small: blank, a 30-minute template, a sample pack, or a copy of a previous show. REAL is the default. A rehearsal stays in this browser." |
| 1:15 | **Simulator → Fall collection rehearsal → Open rehearsal desk** | On Prepare, show the run of show and the lock on the **Flash Sale announcement** (hard anchor 20:12). Click **Import**, paste the rows from `sample-products.csv`, show the preview, then Cancel to preserve the scripted take. Import them into a separate rehearsal before presenting to verify the asset. | "This is the plan: timed segments and one commitment that cannot move. Products come from the library or pasted CSV or TSV. A missing price stays 'Not entered', never zero." |
| 1:55 | **Start SIMULATED session** → Operate | Click **Apply step** twice (Opening ends, then the host's estimate). Stop when the strip reads *Operator: end Zip Hoodie by 20:12*. | "The host says Zip Hoodie needs six more minutes. NOW is Zip Hoodie. NEXT is the 20:12 Flash Sale. WHY says it would start a minute late. The desk offers the recovery that keeps 20:12." |
| 2:35 | Operate | Click **Apply step** once more: it performs the recovery the desk is offering. Click **Note**, enter “Competition rehearsal operator note; not platform evidence.”, then **Save note**. Keep clicking **Apply step** (8 more; the last one ends the session), then **Open Review**. | "It is a rehearsal, so the script plays the operator's moves. This note records our rehearsal evidence without claiming a TikTok action. The engine is the same one a REAL show uses." |
| 3:05 | **Review** | Point at the header strip (hard anchors 2/2 on time, Zip Hoodie +3:00, cues reported), then the line "reported is the operator's word, not platform confirmation". | "Review compares the plan with what was recorded. 'Reported' is the operator's word, not TikTok's. Unknown means the outcome lacks confirmation, even if a report or attempt exists; it is never shown as a failure." |
| 3:35 | Review → **Next LIVE · 2 proposed** | Tick the feasible change **Opening: 3:00 → 2:00**, click **Create next LIVE · 1 change**, then open Home. The new plan is under **Prepared for next**, badged SIMULATED. | "One show supports a manual choice. It says nothing about sales. You pick the changes, and the next plan starts from them." |
| 4:00 | **Integrations** | Point at Available / Manual / Platform-Limited / Unsupported. | "The show desk works today. No platform provider is connected to V3. TikTok owns video, chat, pins, promotions and platform analytics; reports here are not platform confirmation." |

If the take is short on time, skip the 0:45 and 1:15 beats' detail and open the finished
**Collection launch · rehearsal (completed)** straight from Home → Finish the review.

## Demo content to use

| Item | Value |
|---|---|
| Rehearsal | **Fall collection rehearsal** (shipped scripted scenario: Zip Hoodie overruns, Flash Sale holds at 20:12) |
| Finished Review with nothing to run | **Collection launch · rehearsal (completed)**, generated by running the scripted scenario through the engine, not hand-written |
| Custom show title if you create one | October collection · Evening LIVE (the Create LIVE default) |
| Objective if you add one | Launch the fall line and test the sizing cue |
| Import rows | `sample-products.csv` or `sample-products.tsv` in this folder |

The sample products D01 to D04 are invented examples with their own codes, so they never
collide with the shipped M01 to M05. They are not a catalog, and no price here is real.
`D04` has no price on purpose: Import shows it as "Not entered". Import takes `code, name,
price` per line with no header row.

## If something goes wrong

| Symptom | Do |
|---|---|
| A rehearsal is already running or finished from an earlier take | **Simulator → Reset this run** |
| Everything looks stale | **Simulator → Delete all rehearsals…** regenerates the scripted ones. REAL data is untouched. |
| Cannot run the walkthrough live at all | Open **Collection launch · rehearsal (completed)** and present Review only |
| Asked "is this connected to TikTok?" | Open **Integrations**. It lists what is Unsupported and Not connected |

## Optional: REAL

If your team has a room deployed per `docs/phase3/platform/runbook.md` (HTTPS, operator
accounts created with the ops tool), sign in and use **Create LIVE** with the SIMULATED toggle
**off**. The same Prepare, Operate and Review screens apply, but the show lives in the shared
room and is recorded under the signed-in operator.

**Not exercised in this lane.** A REAL show needs an HTTPS deployment (the server rejects a
non-HTTPS origin), which was out of scope here. The REAL path is covered by the existing
automated tests with a test double of the room, not by a live server.

## What we do not claim

- No TikTok connection. The Integrations page lists realtime engagement, post-LIVE analytics,
  pin or promotion control and platform verification as unsupported or not connected.
- No sales, conversion or revenue effect. Review itself says one show "says nothing about sales".
- No automation of the host or the platform. The operator acts in TikTok and reports it here.
- "Reported" is never "confirmed". Verification stays Unknown without an independent channel.
- No real data in the rehearsals, and no fake provider analytics anywhere.
- No claim that a rehearsal predicts how a real show will go.

## Assets in this folder

| File | Use |
|---|---|
| `README.md` | This presenter guide |
| `JUDGE-GUIDE.md` | One page a judge can read in about a minute |
| `sample-products.csv`, `sample-products.tsv` | Paste into Prepare → Import. Same four products |
