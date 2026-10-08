# LiveLift V3 emergency demo kit

Run commands from the repository root, in Bash or Fish. Normal rehearsal:

```sh
./start-livelift-demo
```

Keep that terminal open. It prints the browser URL (normally `http://localhost:3130/`).
Use the **same URL and browser profile** throughout: localhost and 127.0.0.1 have different browser storage.
Default startup isolates the SIMULATED rehearsal from REAL configuration; Docker and login are unnecessary.
It does not change Create's product default: Create normally defaults to REAL. Cancel during the demo,
or use `http://localhost:3130/live/new?env=sim` and verify the SIMULATED toggle before submitting.

## App will not start

```sh
node --version
npm --version
cd next
npm ci
cd ..
./start-livelift-demo
```

Use Node **22.23.3** for certification. The app accepts `>=22.16 <23 || >=24`.
If Node is already installed through nvm, use `nvm use 22.23.3` in Bash; with fnm,
use `fnm use 22.23.3` in your configured shell. Otherwise install Node, then reopen the terminal.
Do not run `npm start` for a rehearsal: production requires REAL deployment configuration.
Inspect the private `next/.competition-demo/app.log` locally if startup still fails; do not publish it.

## Port already in use / repeat start

```sh
./check-livelift-demo
lsof -nP -iTCP:3130 -sTCP:LISTEN
```

On Linux, if lsof is absent:

```sh
ss -ltnp '( sport = :3130 )'
```

A second start reuses this launcher's server. An unmanaged listener is never killed, even if it
looks like LiveLift. Close its owning terminal yourself, or rehearse on another port:

```sh
./start-livelift-demo --port 3131
./check-livelift-demo --port 3131
./reset-livelift-demo --port 3131
```

A different port has fresh browser storage. To stop only a managed rehearsal:

```sh
./stop-livelift-demo
./start-livelift-demo
```

Wait for the first terminal to exit before restarting. Ctrl+C there also works. No server-side data is deleted.
After a hard crash, a stale launcher socket may remain. First inspect the port above and ensure the old
launcher terminal has exited; then remove **only this control socket**, and retry:

```sh
rm -f next/.competition-demo/3130.sock
./start-livelift-demo
```

Never remove database files or Docker volumes. Never use `pkill node`, `killall`, or `docker compose down -v`.

## Stale session / simulator midway / rehearsal completed

```sh
./reset-livelift-demo
```

This opens **Simulator**, and performs no deletion itself. In the presenting browser:

1. **Fall collection rehearsal → Reset this run → Reset this run** (confirmation).
2. **Open rehearsal desk**. It is ready to start again.

Other rehearsals and Next LIVE plans are preserved. For the complete shipped starting set,
choose **Delete all rehearsals… → Delete all rehearsals** instead. That explicitly removes
every browser-local SIMULATED rehearsal/derived plan and regenerates the shipped scenarios,
including the completed Review. REAL shows, accounts, login cookies and authority storage are untouched.
Close old rehearsal tabs after resetting. If the helper opened another browser profile, navigate to
`http://localhost:3130/simulator` in the original profile and use its controls there.

## Accidental refresh

The virtual clock moves only when you click. Reopen Simulator and click **Continue rehearsal**,
or Home → the active SIMULATED card. Saved rehearsal state survives a normal refresh.
If browser storage is blocked, use a normal profile that allows local storage; a fresh private window
starts a separate rehearsal, and its state may disappear when you close it.

## Imported sample twice

Cancel the import dialog when duplicate codes appear. The timed presentation previews CSV and **Cancels**,
so it never changes the scripted plan. To return to all shipped content after an actual import,
use the confirmed **Delete all rehearsals** operation above. A single-run reset restores that scenario's
products but preserves your other rehearsals. The originals are:

```sh
cat docs/competition/v3-demo/sample-products.csv
cat docs/competition/v3-demo/sample-products.tsv
```

There is no header row. D04 has a missing price and must display **Not entered**, never zero.

## Wrong page clicked / login appears / return to safe Simulator

Navigate directly (no sign-in required):

```text
http://localhost:3130/simulator
```

Choose **Fall collection rehearsal → Open rehearsal desk / Continue rehearsal**. Check the SIMULATED badge.
If you landed on Create, Cancel; do not submit a REAL show. On Home the sign-in-unavailable warning is
expected for rehearsal-only startup. If a REAL login is actually required, leave that environment intact
and run the default launcher on localhost for this presentation.

## Health / readiness fails

```sh
./check-livelift-demo
```

Expected rehearsal result: app **PASS**, health **PASS**, Simulator **PASS**, assets **PASS**;
ready **FAIL — expected 503: REAL authority is not configured**. Overall rehearsal startup must **PASS**.
Readiness describes REAL managed storage, not browser-local rehearsals. Unexpected errors are startup failures.

If app or health fails, stop the managed rehearsal and restart it:

```sh
./stop-livelift-demo
./start-livelift-demo
```

## Browser does not open / certificate problem

Copy the printed browser URL. You can suppress auto-open:

```sh
./start-livelift-demo --no-open
```

Local rehearsal uses HTTP on localhost and needs no certificate. A configured REAL deployment uses
HTTPS; check the hostname, system clock and deployment certificate through the existing
[platform runbook](../phase3/platform/runbook.md). Do not bypass TLS checks or change authentication.
Switch to the default SIMULATED launcher for the presentation while REAL deployment repair is pending.

## Configured REAL deployment (optional; never a reset target)

Use only with your existing repository-root `.env` / deployment environment, Docker images and accounts:

```sh
./start-livelift-demo --real
./check-livelift-demo --real
./reset-livelift-demo --real
```

The launcher reads the configured HTTPS origin; no UUIDs, passwords or port reminders are needed.
It reuses a healthy deployment, or runs `docker compose -f docker-compose.v3.yml up -d` using the
existing topology/images. It does not provision accounts, rebuild images, migrate/reset storage, or
stop REAL services. If authority health is failing, follow the runbook. Reset still only opens
Simulator for explicit browser-local confirmation. To check/open Simulator on a remote deployment:

```sh
./check-livelift-demo --real --url https://your-host
./reset-livelift-demo --real --url https://your-host
```

## Last-minute fallback

Home → **Finish the review** → **Collection launch · rehearsal (completed)**. Present Review,
then **Next LIVE** and **Integrations**. Say it is a completed SIMULATED rehearsal generated by
the engine. If the app is entirely unavailable, use the [judge guide](v3-demo/JUDGE-GUIDE.md)
and [presenter cheat sheet](PRESENTER-CHEATSHEET.md); do not pretend it is a live run.
