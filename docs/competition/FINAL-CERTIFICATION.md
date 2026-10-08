# Final competition certification

This is the repeatable acceptance gate for LiveLift's existing competition flow:

**Home → Create → Simulator → Prepare → Operate → AI Copilot → Review → Insights → Next LIVE → Integrations → Terms → Privacy.**

The harness changes no product source, UI, styles, contracts, schema, dependencies or deployment configuration. It starts its own production servers bound to loopback, uses a temporary HTTPS proxy and disposable SQLite workspace, and stops only the processes it starts. Each viewport has a fresh browser context. The shipped ops CLI initializes the room and creates a temporary operator; its build runs in a private copy, leaving no `.ops` directory in the checkout. Runtime databases, passwords and TLS keys are removed afterward. Existing rooms, browser profiles and TikTok connections are never opened or reset.

## Run

Use **Node 22.23.3**. The executable refuses another version. Run from `next/`:

```sh
node --version                 # v22.23.3
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
NODE_PATH=/path/to/audit/node_modules node acceptance/final-competition.mjs
```

Playwright is an external audit tool, following the existing acceptance scripts; it is deliberately absent from the product lockfile. The environment used for this certification resolves it with:

```sh
NODE_PATH=/home/towfienes/.local/lib/node_modules/@playwright/cli/node_modules \
  node acceptance/final-competition.mjs
```

For a fresh machine, provision a separate audit directory once:

```sh
npm install --prefix /tmp/livelift-audit-tools --no-save playwright
NODE_PATH=/tmp/livelift-audit-tools/node_modules node acceptance/final-competition.mjs
```

The other prerequisites are OpenSSL on `PATH` and Chromium at `/usr/bin/chromium`; `CHROMIUM_PATH` selects another executable. The harness reuses the checkout's `.next` production build, so rerun `npm run build` after merging UI polish. It does not target an existing public server or need Docker, real TikTok OAuth, an AI account, a credential file, or a manually prepared room.

Default execution runs **not-configured** and **fixture** modes, each at **375×667, 768×900 and 1440×900**. Fixtures exercise the actual server configuration, authentication, CSRF, AI provider/validation routes, OAuth binding/callback, encryption, User Info and product UI. Only external provider responses are synthetic. The TikTok authorization-page navigation is intercepted and redirected to the real local callback with its actual single-use state; token exchange and User Info use `scripts/tiktok-fixture-preload.mjs`. The browser verifies the displayed identity says **Fixture Creator (not TikTok)**, then explicitly disconnects it before the next viewport. No real TikTok authorization page is contacted.

AI fixture output comes from `scripts/ai-fixture-preload.mjs`. It is deterministic verification data, **not a real AI model** and not proof of AI quality or platform capability. Inherited `LIVELIFT_*`, `NEXT_PUBLIC_*` and preload options are cleared for the default child runtimes, including values named by local dotenv files. This prevents accidentally using a developer's provider credentials or production databases.

If a real compatible AI provider is configured in the invoking shell, explicitly add a provider pass:

```sh
# Set LIVELIFT_AI_BASE_URL, LIVELIFT_AI_API_KEY and LIVELIFT_AI_MODEL
# in the shell using your existing secret management; do not commit them.
NODE_PATH=/path/to/audit/node_modules node acceptance/final-competition.mjs --provider
```

That adds all three viewports against a new disposable room. Only `LIVELIFT_AI_*` settings are passed to this runtime; TikTok stays synthetic. It makes nine requested AI analyses across Operate/Review/Next LIVE and sends only generated rehearsal evidence. A timeout, unavailable/invalid answer, absent Operate recommendation or absent Next LIVE suggestion fails this stricter provider pass. Without the flag, real-provider verification is explicitly recorded as **NOT RUN**, even if shell credentials exist. The fixture pass is always required.

## Assertions and evidence

| Invariant | Automated assertion |
|---|---|
| Home loads | HTTP 200, loop guide and truthful environment explanation. |
| Create and REAL/SIMULATED identity | REAL is the initial unchecked default, with its operations-only explanation; explicitly selecting SIMULATED creates a SIMULATED record. |
| Simulator and full rehearsal | Open the shipped buffered scenario, start tracking and apply the script to an ended lifecycle within a bounded 20-step loop. Virtual clock and SIMULATED label remain visible. |
| Prepare saves | Edit title through Show details, save, reload, compare persisted title and saved status. |
| NOW / NEXT / WHY / ACTION | Scripted Zip Hoodie overrun, upcoming Flash Sale and late/deficit explanation; trial clicks establish ACTION and primary controls receive input without applying them. |
| Rundown at all three widths | At least 160px visible height, no internal horizontal overflow; current, next and final rows reachable through actual scroll containers. |
| Copilot not configured | Signed-in real status route yields `not_configured`, displays product-logic facts labelled not AI, and offers no analysis button. Both Operate and Review are tested. |
| Copilot configured | Actual API returns validated `available` SIMULATED evidence; UI shows observed facts, AI interpretation and AI recommendation layers. Fixture is mandatory; real provider is optional. |
| Recommendation is not auto-applied | Deep comparison of the entire source record before/after opening or analysing Copilot and after reloading Operate. Advice reads “Recommended · not applied”; its Apply control is reachable by a trial click. |
| Review | Completed scenario has a Review reading note, every record labelled SIMULATED and platform verification unknown. |
| Missing ≠ zero in Insights | An additional UI-created template is started and ended without advancing virtual time. Its measured zero renders `0:00` and an actual mark; unreached rows render `Not recorded`, `Unknown` variance and no actual bars. Provider metrics remain unavailable. Viewing/filtering Insights leaves all session storage unchanged. |
| Next LIVE explicit selection | Every proposal starts unchecked, including after AI analysis. “Select suggested” is an explicit click and changes neither storage nor session count. The harness clears it and manually selects exactly one feasible trade-off before creation. |
| Source session unchanged | Full deep comparison before selection, after Next LIVE creation and after reload. Destination has a new id, the same environment, one recorded selected change, empty events and clean planned runtime. |
| Integrations and TikTok truth | Not configured has no Connect button. Connected fixture identity still states it does not start/read/control LIVE. LIVE eligibility, Shop, analytics and native action verification all remain not established; no LIVE-control action appears. |
| Terms / Privacy | Both canonical routes return 200 and render their main heading. |
| Browser failures | Zero page exceptions, unexpected HTTP failures and non-resource console errors. The only allowed failing response is signed-out `GET /api/v3/auth/session` 401 before login; all resource responses are checked by route/status. |
| Horizontal overflow | Document scroll width does not exceed client width by more than 1px at each captured flow state, including Copilot, Insights and Next LIVE. Rundown also checks its own scroll width. |
| Keyboard focus sanity | Repeated Tab stays within End tracking dialog; Escape returns focus to its trigger; Tab/Shift+Tab leaves a visible focus outline. |

The Next LIVE invariant concerns **changes**: unselected proposals must not affect the plan. The product intentionally allows explicitly creating a baseline copy with zero adjustments; the harness does not invent a requirement that the create button be disabled until a checkbox is selected.

Each passing checkpoint prints `PASS <mode> <width> <check>`. An assertion failure prints `FAIL`, saves a failure screenshot and returns a nonzero exit code. A dependent journey stops with an explicit `aborted` entry; later viewport/mode runs still execute. Nondependent layout/focus failures are collected while the remaining flow continues. Runtime setup failures and interruptions are blockers. No partial run can produce PASS.

Screenshots, redacted server logs and machine-readable `results.json` are written to a private temporary evidence directory, printed at exit. `LIVELIFT_BROWSER_EVIDENCE` can choose the directory. Use a fresh private directory per run; results include source HEAD, build ID, Node/Playwright/Chromium versions, timestamps, per-check outcomes, viewport/mode, browser exceptions, HTTP/console observations, aborts and blockers. Passwords, provider keys, OAuth code/state, login cookies and databases are not retained as evidence. Do not store provider runs' evidence in the repository.

The four focused harness tests run with `npm test` (or `npx vitest run acceptance/final-competition.test.ts`). They deliberately inject source mutation, wrong Next LIVE provenance/runtime/environment, missing-as-zero rendering and inherited deployment configuration, ensuring certification guards reject those regressions. They need neither a browser nor provider credentials.

## Scope and merge gate

This certifies a reusable competition rehearsal and the product's displayed boundaries. It does not certify real TikTok capability, broadcast control, provider analytics, elapsed deployment soak, model quality, full accessibility compliance or performance/Core Web Vitals. Screenshots have no committed comparison baseline: **visual regression is INCONCLUSIVE**, rather than silently PASS. Keyboard checks are sanity checks, not a screen-reader audit. Contained Insights tables intentionally support horizontal scrolling; the page itself must not overflow.

Only new files under `next/acceptance/` and this document are introduced. Text-level conflict risk with the UI polish lane is low. Preserve the existing test IDs and accessible control names or update the isolated harness selectors after the merge. Behavioral/layout regressions introduced by polish will correctly fail this gate. Rerun the complete command sequence on the merged HEAD; a passing result here is not certification of an unbuilt future merge.

## Certification record

Starting HEAD: `39727c422af5726c81baa40644f18d7e022159c2` on `orca/v6-final-cert-harness`.

Validation on 2026-10-07 with Node 22.23.3:

| Gate | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 53 files, 834 tests; 57 existing environment-gated skips |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS — zero production vulnerabilities |
| Final browser harness | PASS — 219 checks across six complete flows, 84 screenshots, zero runtime exceptions / unexpected HTTP errors / aborts |
| Staged secret scan (`gitleaks git --staged --redact`) | PASS — no leaks |

Browser verification used Playwright `1.64.0-alpha-1790635538000` and Chromium `153.0.8010.52`. The unavailable-browser negative check returned exit code 1 and a FAIL JSON report with zero successful checks. Temporary runtime directories were removed on completion.

Local final evidence for this run: `/tmp/livelift-final-cert-XbflGc/results.json` and 84 PNG captures in the same directory. This location is machine-local; fresh runs print their own evidence directory.

An additional full-lockfile OSV scan reported existing development-only advisories in `tinypool` 1.1.1 (two CVSS 9.5 findings), `vitest` 3.2.7 and `@vitest/mocker` 3.2.7 (CVSS 5.9). `npm ci` likewise reports two critical and one moderate development findings. The broader development dependency security gate therefore is not claimed clean. Dependency upgrades are outside this isolated acceptance lane; the required production-only audit passes. No real AI credentials were supplied, so real-provider execution is NOT RUN.

Final commit SHA is obtained with `git rev-parse HEAD` after the commit titled `test(v6): add final competition certification harness`; embedding the commit's own SHA in its contents would require changing it.

No remaining blocker for merging this isolated harness lane. Real-provider verification remains optional and unrun; screenshot baseline comparison remains inconclusive. The development dependency findings above require separate follow-up. Rerun the harness after merging UI polish.

```text
FINAL CERT HARNESS: PASS
READY TO MERGE AFTER UI POLISH: YES
```
