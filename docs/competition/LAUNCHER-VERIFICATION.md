# Competition launcher verification — 2026-10-07

Starting revision: `af55b09868fd83d7ae171cda32cc0331435a4d79` on
`orca/v3-competition-launcher`, descended from `v3.0.0-competition`.
Only launcher scripts, documentation and the launcher-state ignore rule changed.
No product source, contracts, database schema, Docker topology or sample data changed.

## Commands and runtime

```sh
./start-livelift-demo
./check-livelift-demo
./reset-livelift-demo
./stop-livelift-demo
```

POSIX shell entry points locate the repository independently of the current directory.
One shared Node stdlib script runs the existing Next development CLI on loopback, at
`http://localhost:3130/`. Keep the startup terminal open. A private Unix socket identifies
this repository's managed launcher, prevents duplicate starts and requests shutdown of
only its child. Logs and sockets live in ignored `next/.competition-demo/`.
The default child cannot use inherited/file-based REAL authority settings. Docker is
only used for explicit `--real` startup with an existing configured HTTPS installation.

Reset opens the existing Simulator controls and prints the confirmation steps. It never
resets browser state from the terminal. Single-run reset preserves other rehearsals;
confirmed full rehearsal deletion regenerates the four shipped sessions. The browser
profile and origin used for the presentation must be the ones reset.

## Certification

Executed from `next/` with **Node 22.23.3**, npm **10.9.9**:

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS: 40 files; 545 passed, 57 skipped |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS: zero vulnerabilities |
| Shell syntax; Bash and Fish invocation | PASS |
| Fresh start; repeat start from a different current directory | PASS; existing launcher reused |
| Unrelated listener on port 3130 | PASS; startup refuses, listener remains alive |
| App, health, Simulator and assets | PASS |
| Authority readiness in SIMULATED mode | Expected FAIL / HTTP 503 `authority_unavailable`; overall rehearsal PASS |
| Browser URL | `http://localhost:3130/` |
| Auto-open / unavailable desktop | Actual local desktop opener accepted the request; dispatch and URL fallback also exercised with controlled OS-command stubs |
| Stop helper, restart, Ctrl+C; offline check | PASS; only owned child stopped; offline check exits 1 |
| Invalid REAL HTTP origin | PASS; rejected before Docker/storage actions |
| Home, Create/Cancel, fresh Simulator desk | PASS; Create's REAL default remains unchanged |
| Existing CSV and TSV imports in actual Prepare UI | PASS; four products, D04 remains missing/Not entered |
| Refresh, single-run reset, full rehearsal reset | PASS; predictable shipped demo restored |
| REAL safety | PASS; authority-file sentinel, REAL local-storage bytes and cookie retained; zero authority write requests |
| Existing competition browser walkthrough | PASS at 1440, 375 and 768px; 81 captures, 26 links, zero runtime exceptions |

The executable integration check reuses `next/acceptance/competition-browser.mjs` for the
full Operate → Review → Next LIVE → Capability Center flow. It requires the audit environment's
Playwright and Chromium, without adding an app dependency:

```sh
NODE_PATH=/path/to/installed/node_modules node scripts/competition/launcher.check.mjs
```

Use a free port 3130 and stop your managed launcher before running this check. It uses
disposable browser contexts, checks both reset controls and restores a stopped runtime.

## Limits

The live REAL Docker startup branch was not exercised: no configured REAL installation
is available in this lane. It uses the unchanged `docker-compose.v3.yml`, requires existing
images/configuration/accounts, and does not provision, reset or delete REAL data.
Actual desktop visibility cannot be established by an opener's exit code; the command
reports an accepted open request and always prints the URL. Default rehearsal startup,
reset safety and the complete SIMULATED presentation are verified.

**COMPETITION LAUNCHER: PASS** · **EMERGENCY DEMO KIT: PASS** · **REAL DATA SAFETY: PASS**

**READY FOR TIKTOK INTEGRATION R&D: YES** — no TikTok integration is claimed or added.
