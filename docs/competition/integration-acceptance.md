# LiveLift V3 competition integration acceptance

Validated on 2026-10-07 in `orca/v3-competition-integration`.

## Provenance and boundaries

| Item | SHA |
|---|---|
| Starting RC.2 | `feb3a930c80c86401e5c40df961356c7334ca0c5` |
| Core lane | `675f95d7aaaaeca2b5052d078b3a01ea5fc5f968` |
| Demo lane | `70ee1e3da3164f7205e6d9cacc8cf183b8dcfabe` |
| Capability lane | `f5fa5f54c9677eeb54aea73333fe805668c61d4b` |
| Core merge | `e80ba27` |
| Demo merge | `be88687` |
| Capability merge | `1bf62cd` |

All three branches were inspected and merged in the requested order with `--no-ff`.
No Git conflicts occurred. Integration fixes are in the separate commit
`fix(v3): reconcile competition integration` containing this report.

Production authority transitions, authentication/session semantics, database schema,
backup/restore, production contracts, Docker/Caddy and soak implementation are unchanged
from RC.2. The changed files are UI, competition documentation/assets, existing UI tests
and a separate browser acceptance check. No dependency was added. No push or final tag
was performed.

## Integration fixes

- Let the shared session context bar wrap at mobile widths, and wrap Review tabs.
  This fixes D1 for Review, Next LIVE and the Wrap handoff without hiding overflow.
- Wrap narrow Prepare rows so reorder/edit controls remain inside the Run of Show.
  Wrap the Next LIVE result header and Capability Center card headings/stat boxes.
- Reconcile Capability Center with Home and the actual V3 runtime. No platform provider
  is connected. Older Python adapters, causal experiments, host blinding and dual
  knowledge lenses are not functional V3 capabilities. Remove those claims from the
  competition positioning document. REAL explicitly requires a configured shared room.
- Match Capability Center CTAs to their destination: Create LIVE creates a plan;
  “Open export controls” opens Sessions and needs operator access for export.
- Correct presenter/judge wording: unknown outcomes can coexist with recorded attempts
  or reports. Select the feasible Opening trade-off for the Next LIVE demonstration.
- Preserve all eight capability tests, update their wording assertions to the reconciled
  product, and add checks that platform cards have no connection/action CTAs.
- Leave a runnable Chromium check in `next/acceptance/competition-browser.mjs`.

## Antigravity findings rechecked

| Finding | Integrated result |
|---|---|
| D1 Review mobile overflow | Reproduced after merges: 406px Review and 408px Next LIVE at 375px. Fixed. Final Review, Next LIVE and Wrap measured `clientWidth = scrollWidth = 375` in both dev and production. |
| D2 CSP warnings | Dev-only inline style and React eval warnings reproduced. No CSP warnings or eval exceptions in the built production browser run. Production CSP was not changed. |
| D3 artificial route URLs | `/create`, `/prepare`, `/operate`, `/review` correctly return 404. Canonical `/live/new` and session-specific routes work. 31 internal links returned 200; Capability Center card CTAs were clicked. No bogus routes added. |
| D4 unavailable storage/configuration | Intentionally unconfigured dev runtime returns 503; this run returned `authority_unavailable` with “Room authority configuration is unavailable.” The prior lane recorded `storage_unavailable`. Both represent unavailable authority, not an empty account. The documented rehearsal path still completes. Configured production returns 401 when signed out and works after actual cookie login. The fail-closed contract is preserved. Managed storage is SQLite, not PostgreSQL. |

## Browser acceptance

Installed Playwright drove real `/usr/bin/chromium` against the app, with DOM measurements
and screenshot inspection. The Chrome connector was unavailable because its configured
Google Chrome executable was missing; computer-use reported no visible applications.

| Runtime | Viewports | Results |
|---|---|---|
| Intentionally unconfigured Next dev | 1440×900, 375×667, 768×900 | Rehearsal loop, both imports, empty states, dialogs, active Home, capability filters/CTAs and Wrap passed; 78 captures, 26 internal links, zero page exceptions. Expected dev CSP/503 console messages. |
| Built Next production with disposable local SQLite room and HTTPS test proxy | 1440×900, 375×667, 768×900 | 99 captures, 31 internal links, zero page exceptions. Rehearsal walkthrough and signed-in REAL Create → Prepare → Operate → Review → Next LIVE passed. No CSP warnings; only expected signed-out 401 resource errors. |

The local HTTPS proxy and temporary operator account were acceptance fixtures, not a
public deployment. REAL mode was tested using disposable room records; no TikTok
broadcast or platform action was performed or verified. The production process emitted
the existing `next start` advisory for `output: standalone`; it served and passed the checks.

Verified together as one product:

- Home explains who LiveLift helps and the five-stage loop. A loaded empty room shows
  first-run onboarding. An unavailable room explains its failure. An active rehearsal
  replaces the first-run/idle card and links back to Operate.
- Products' pack CTA selects the correct pack in Create. Blank Prepare has useful empty
  states. CSV and TSV both save four products; D04's absent price stays absent.
- The scripted overrun shows NOW Zip Hoodie, NEXT Flash Sale, WHY one minute late,
  and an actionable recovery. Mobile uses vertical scrolling, desktop keeps the main
  operating controls together. Primary actions and Prepare controls remain reachable.
- Dialog focus stays inside, Escape restores focus to End LIVE, and keyboard focus has
  a visible outline. REAL action reporting records an unresolved attempt separately
  from a later performed report; Review still says platform verification is unknown.
- SIMULATED badges/virtual clock remain visible and Review explicitly labels every record
  SIMULATED. REAL has no Simulator strip. Next LIVE creates a clean plan in the same
  environment, with selected changes and no copied runtime; source history stays unchanged.
- Unsupported platform features offer no connection controls. No Phase 2 token setup
  appears in the tested product flow. No serious runtime exceptions or broken links.

## Gates

| Command from `next/` | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 40 files, 545 tests passed, 57 pre-existing environment-gated skips |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS — zero vulnerabilities |

Typecheck was rerun after build completed to avoid generated-type file races.
Temporary dev output was moved outside the worktree and its automatic tsconfig change
was reverted. No checks were muted or removed. The 57 skipped tests do not represent
an elapsed 48-hour deployment soak; no new hosting or soak work was requested.

To rerun the browser acceptance, use a **disposable** runtime. The script creates
rehearsals and, if credentials are supplied, REAL test records:

```sh
cd next
NODE_PATH=/home/towfienes/.local/lib/node_modules/@playwright/cli/node_modules \
LIVELIFT_BROWSER_URL=http://127.0.0.1:3130 \
node acceptance/competition-browser.mjs
```

`CHROMIUM_PATH` selects Chromium. `LIVELIFT_BROWSER_EVIDENCE` selects the output directory;
otherwise a temporary directory is created. For configured local HTTPS acceptance,
`LIVELIFT_BROWSER_AUTH_FILE` names a protected JSON file with `username` and `password`.
Do not pass account secrets on the command line. Screenshots/JSON and gate logs for this
run are in `/tmp/livelift-competition-evidence/`; these are local evidence, not release assets.

## Recommended 4-minute presentation

| Time | Action and explanation |
|---|---|
| 0:00–0:40 | Home: show the pitch, Create → Prepare → Operate → Review → Next LIVE, and REAL/SIMULATED truth. In the unconfigured demo explain the unavailable sign-in banner; rehearsals still work. |
| 0:40–1:00 | Create LIVE: show Blank / 30-minute show / Sample pack / Previous session and the SIMULATED toggle; cancel. |
| 1:00–1:40 | Simulator → Fall collection rehearsal → Open rehearsal desk. Show the Flash Sale 20:12 hard anchor. Import → paste the shipped CSV → preview D04 “Not entered” → Cancel. Both actual imports were checked in separate rehearsals before presenting. |
| 1:40–2:30 | Start SIMULATED session. Apply step twice. Show NOW Zip Hoodie, NEXT Flash Sale, WHY 1:00 late and ACTION end Zip Hoodie by 20:12. Apply step once to accept the recovery. Click Note, enter “Competition rehearsal operator note; not platform evidence.” and Save note. |
| 2:30–3:15 | Apply step eight more times to finish. Open Review. Show 2/2 anchors on time, Zip Hoodie +3:00 and operator reports. Reports/attempts do not establish platform confirmation; unknown is not failed. |
| 3:15–3:45 | Next LIVE: tick **Opening: 3:00 → 2:00**, inspect the feasible preview and click **Create next LIVE · 1 change**. Home shows the new SIMULATED plan under Prepared for next. One show supports a manual choice, not a sales claim. |
| 3:45–4:15 | Integrations: show Available / Manual / Platform-Limited / Unsupported. No platform provider is connected; TikTok owns video, chat, actions and analytics. |

For a 3-minute cut, shorten Create/import detail. For a failure fallback use the shipped
completed rehearsal Review. Reset the buffered scenario before the next take.

## Remaining competition blockers and verdict

No remaining blocker for the documented rehearsal competition story. A REAL presentation
requires a configured room/account; the supplied unconfigured demo intentionally cannot
record REAL shows. No production/public rollout, sanctioned provider, or elapsed 48-hour
soak is claimed by this competition integration.

```
COMPETITION INTEGRATION: PASS
CORE PRODUCT EXPERIENCE: PASS
DEMO EXPERIENCE: PASS
CAPABILITY POSITIONING: PASS
READY FOR FINAL COMPETITION AUDIT: YES
```

## Files changed relative to RC.2

34 files:

- `docs/competition/browser-audit.md`
- `docs/competition/capability-positioning.md`
- `docs/competition/integration-acceptance.md`
- `docs/competition/v3-demo/JUDGE-GUIDE.md`
- `docs/competition/v3-demo/README.md`
- `docs/competition/v3-demo/sample-products.csv`
- `docs/competition/v3-demo/sample-products.tsv`
- `next/acceptance/competition-browser.mjs`
- `next/src/__tests__/onboarding/demo.assets.test.ts`
- `next/src/__tests__/onboarding/home.onboarding.test.tsx`
- `next/src/__tests__/onboarding/loop.test.ts`
- `next/src/__tests__/ui.flow.test.tsx`
- `next/src/app/integrations/__tests__/integrations.test.tsx`
- `next/src/app/integrations/categories.ts`
- `next/src/app/integrations/page.tsx`
- `next/src/app/live/[sessionId]/operate/page.tsx`
- `next/src/app/live/[sessionId]/prepare/page.tsx`
- `next/src/app/live/[sessionId]/review/page.tsx`
- `next/src/app/live/[sessionId]/wrap/page.tsx`
- `next/src/app/live/new/page.tsx`
- `next/src/app/page.tsx`
- `next/src/app/products/page.tsx`
- `next/src/app/sessions/page.tsx`
- `next/src/components/onboarding/HomeOnboarding.tsx`
- `next/src/components/onboarding/loop.ts`
- `next/src/components/ops/CueBar.tsx`
- `next/src/components/ops/NextLivePanel.tsx`
- `next/src/components/ops/NextPanel.tsx`
- `next/src/components/ops/PrepareRos.tsx`
- `next/src/components/ops/ReviewTable.tsx`
- `next/src/components/ops/SimulatorStrip.tsx`
- `next/src/components/ops/SupportTabs.tsx`
- `next/src/components/shell/FocusedShell.tsx`
- `next/src/components/shell/SessionContextBar.tsx`
