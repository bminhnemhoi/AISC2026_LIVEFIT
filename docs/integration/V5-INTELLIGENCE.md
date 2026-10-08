# V5 intelligence integration acceptance

Verified 2026-10-07 in `/home/towfienes/Projects/v5-intelligence-integration` using Node **22.23.3** and the production webpack build. No push or deployment was performed.

## Candidate history and scope

- Starting SHA: `12a6d3ae965c34587193680ef00eb7b835f88b2d` (clean worktree).
- AI lane: `e1620b535e29063a3d89e5bebf3cd4117fd63a55`; merged first with `--no-ff` as `fe631410199b630fa645552fc19a980b617b75e2`.
- Analytics lane: `f2ef01ac2fa6d823d17888aa10f94e1aa589e2d2`; merged second with `--no-ff` as `976cad82b5ccf2acca43f0322327cb5745fb470e`.
- Git conflicts: none.
- Semantic resolution: the AI Review evidence limit now states that analytics **from TikTok** are absent. Operational Insights exists; TikTok performance analytics remains unavailable. The corresponding core/UI assertions were strengthened to require this qualification. The AI documentation uses the same boundary.
- Integration adds a browser acceptance script and this report. Neither feature was redesigned.

Git comparison against the base confirms no changes to TikTok provider routes, contracts, client or UI; auth, authority, backup/restore, operations and launcher implementation are preserved. The AI lane extends the shared HTTP boundary's fixed route names for redacted AI logging only.

## Combined experience and truth

| Surface | Verified behavior |
| --- | --- |
| Navigation | Insights is in the main navigation, has the correct current-page state, and links back to Review. |
| Operate | NOW/NEXT/WHY/ACTION and recovery actions remain available. AI is in Supporting information; opening a rehearsal does not contact AI until its tab is opened. Analysis and failures do not mutate show records. Applying a recommendation requires an operator click, records a recovery decision, invents no performed action, and disables stale advice. |
| Review | Recorded summary, timeline, segments, cues and history remain available beside a labeled AI second reading. Evidence limits distinguish unavailable TikTok analytics from recorded operational analytics. Unopened rehearsals, unconfigured AI, validated answers and REAL room evidence were exercised. |
| Analytics | REAL unavailable history differs from an empty selection. Populated SIMULATED and REAL views preserve separate environments, baseline/current/actual timing, missing values, report outcomes, unknown verification, coverage, observations and saved Next LIVE selections. Reading Insights preserves source history. |
| Next LIVE | AI marks existing proposals without ticking any box. The operator explicitly selects changes and creates a new plan. Only the selected adjustment is saved; source history is identical, destination events are empty, actual tracking is unset, and the destination keeps its environment. |
| TikTok | Existing Login Kit connect/callback/check/disconnect paths and connected profile UI pass against the shipped verification fixture. The profile is visibly `Fixture Creator (not TikTok)`. Account identity establishes no LIVE performance or platform action confirmation. |

Missing is not zero; planned is not actual; recommendations, acceptance, attempts and reported performed actions remain distinct. Operator reports are not provider observations or platform confirmations. Unknown is not failure. SIMULATED evidence never becomes REAL evidence. Observations do not establish causation. No TikTok views, clicks, GMV or comments are invented.

## Browser acceptance

Chromium ran against disposable local HTTPS installations, with isolated authority/provider databases and named operator/viewer accounts. External AI and TikTok calls in the configured runtime use the existing, explicitly labeled verification preloads. These checks establish application behavior; they do not certify a live AI model's quality or a fresh authorization against TikTok's real service.

| Suite | Result | Captures |
| --- | --- | ---: |
| Existing competition walkthrough | PASS; REAL tracking, attempted/performed reports, Review, Next LIVE, 38 internal links | 102 |
| Existing analytics acceptance, final build | PASS; unavailable/empty/populated history, tables and keyboard focus/scrolling, filters, saved changes, REAL/SIMULATED separation | 18 |
| Integrated walkthrough, AI unconfigured | PASS; Home → Create → Simulator → Prepare → Operate → AI → Review → Insights → Next LIVE → Integrations | 45 |
| Integrated walkthrough, AI fixture | PASS; same journey, recommendation/acceptance boundaries, eight provider failure/rejection cases, TikTok connected/disconnected UI, REAL AI Review and unchanged authority history | 60 |
| Additional REAL/viewer check | PASS; REAL AI Review, unchanged room history, isolated REAL Insights and denied viewer AI request | 2 |

All requested sizes passed: **375×667**, **768×900**, **1440×900**. Page and Copilot content have no horizontal overflow; primary controls remain reachable. Analytics tables scroll inside labeled, keyboard-focusable regions. There were no browser runtime exceptions or unexpected console/CSP errors. Intentional signed-out and provider-failure HTTP responses are recorded separately.

Rendered review: the existing dark palette, lime primary actions, SIMULATED badges, table equivalents and explicit selection controls remain coherent. Narrow pages stack and wrap; desktop Next LIVE uses the existing two-column choice/preview layout. Long Review evidence/history remains scrollable. Final visual polish can proceed without a feature redesign.

Evidence is retained locally in `/tmp/v5-integration-acceptance/`:

- `competition/results.json`, `analytics-final/analytics-results.json`
- `intelligence-noai/intelligence-results.json`, `intelligence-ai/intelligence-results.json`
- `real-results.json` and PNG captures beside each suite

## Required quality gates

| Command from `next/` | Result |
| --- | --- |
| `npm ci` | PASS; lockfile preserved |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS: 52 files, 830 passed, 57 existing transport-dependent skips; no tests disabled or weakened |
| `npm run build` | PASS: production webpack build |
| `npm audit --omit=dev` | PASS: zero vulnerabilities |

Broader security review found pre-existing development-only Vitest/tinypool/@vitest-mocker advisories. OSV reports them too; all affected lockfile entries have `dev: true`, and dependencies/lockfile are unchanged from the base. Remediation is a separate development-tool upgrade; the required production audit is clean. The optional full dependency security gate therefore remains flagged.

Gitleaks initially flags two occurrences of the fixed verification fixture key in the imported AI documentation/preload. Both point to `ai.fixture.test`, are explicitly verification-only, and confer no provider access. A rescan with exactly those reviewed fingerprints excluded reports no other findings. No scanner exclusion was added to the repository; credentials, database files, encryption keys and TLS keys used by acceptance remain outside git.

## Reproduce the combined browser check

Use an isolated HTTPS production runtime with named accounts. Set `NODE_PATH` to the audit environment's Playwright parent directory. No application dependency is added.

```sh
LIVELIFT_BROWSER_URL=https://your-disposable-runtime \
LIVELIFT_BROWSER_AUTH_FILE=/path/to/protected-credentials.json \
LIVELIFT_BROWSER_EVIDENCE=/tmp/intelligence-evidence \
LIVELIFT_BROWSER_AI_PHASE=noai \
node acceptance/intelligence-browser.mjs
```

For the `ai` phase, run the disposable server with the shipped AI and TikTok verification preloads and valid fixture-only server configuration. Set `LIVELIFT_BROWSER_AI_PHASE=ai` and `LIVELIFT_AI_FIXTURE_CONTROL` to the same control-file path used by the server. Use a fresh runtime/process and disconnected fixture account for a full rerun; this keeps rate-limit state and provider encryption isolated. The protected credentials JSON contains `username` and `password`.

## Verdict

- V5 INTELLIGENCE INTEGRATION: PASS
- AI COPILOT: PASS
- ANALYTICS: PASS
- PRODUCT TRUTHFULNESS: PASS
- READY FOR FINAL UI POLISH: YES

No integration blockers remain. Existing development dependency advisories and live external provider certification are disclosed above.
