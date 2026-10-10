# WP5b: Live Desk screens

You are one of two agents. The other builds the logic (WP5a) at the same time, in another worktree. Work alone, finish in one pass, do not ask questions; where this brief is silent choose the simplest option that keeps the evidence model and say so in the report.

## Read first
1. `AGENTS.md` (root) and `next/AGENTS.md`: **this is not the Next.js you know**; read the relevant guide in `next/node_modules/next/dist/docs/` before writing routes or components.
2. **The full spec: `docs/orchestration/briefs/WP5-livedesk.md`.** Sections 1, 2, 3.1, 3.4 and 3.6 are binding for you. Sections 3.2, 3.3 and 3.5 are the other agent's.
3. **The contract: `next/src/lib/livedesk/types.ts`, `fixtures.ts`, `hooks.ts`.** You get all data from `useStartFlow()` and `useLiveDesk(liveId)` and send all intent through the returned actions. Today `hooks.ts` returns fixtures; the other agent replaces it with the real logic and the signatures do not change. **Import nothing else from `@/lib/livedesk` and nothing from `@/lib/platform`.** Never read the clock. Do not change `types.ts`, `fixtures.ts` or `hooks.ts`; if you need a change, stop and describe it in the report.
4. Reuse: `components/platform/host-app/*` (the simulated phone, via its own view-model contract; build a small adapter from `LiveDeskViewModel` in your components folder), the shell, `components/ui`, the dark tokens in `globals.css` (add none), the Lab's en/vi copy approach (`labCopy`, `useLabPreferences`).

## What you deliver
1. `/` Home: the new flow (platform status, product count, next step) plus the existing honesty panel "What is real, and what is not". New navigation: Home, Start, Desk (when a live exists), Integrations, Legacy. No "Create LIVE" anywhere in the new flow.
2. `/start`: Connect, Import (paste box, sample pack, per-product sync state with the platform's words on failure, "Not entered" for missing price), Start live. `/legacy`: a plain index of the old screens (Sessions, Products, Insights, Simulator, Integrations, Create) with one sentence each. Old routes keep their URLs untouched.
3. `/desk/[liveId]`: products with Pin and Unpin (always enabled while live, no confirmation, one tap), clock controls (Run, Pause, speeds from the view model, skip 30 s, 1 min, 5 min, Reset), viewers, the two charts as inline SVG with markers and a text alternative and the line "Markers show when you acted, not what caused a change", the comment stream with intent chips and the 2-minute counters, the Copilot panel (headline, signals, sample size, confidence, source "Rules" or "AI", state, Accept and Dismiss, the AI status label), the simulated host phone, the banner, the fingerprint, the "Simulation assumptions" list, End live. Desktop 1280×720 and up is the target; at 390 px the panels stack and nothing scrolls sideways.
4. English interface with an EN/VI toggle persisted like the Lab's. Every surface that shows simulated state carries the word SIMULATED. Never write "synced with Shopee", "connected to Shopee", "confirmed by Shopee"; write "SIMULATED Shopee".
5. Accessibility: 44 px targets, visible focus, charts have text alternatives, live regions do not spam (announce suggestions and banners, not every comment), `prefers-reduced-motion` respected.
6. Tests under `next/src/__tests__/livedesk/ui/**` against the fixtures: each screen renders, actions are called with the right arguments, Unpin and Pin enabled while live, disabled states and reasons on `/start`, SIMULATED labels, no forbidden phrase, `/legacy` links, no Create LIVE in the new navigation.
7. `next/acceptance/livedesk-browser.mjs` in the style of `lab-browser.mjs` (production build, local HTTPS, Playwright, axe-core 4.13.0): Connect → Import → Start live → Run → pin, unpin, pin again → accept a Copilot suggestion → end live, at 1920×1080, 1280×720 and 390×844, two runs each; zero axe violations; no horizontal overflow; the run fingerprint equal across the two runs. Until the logic lands the flow cannot complete against the stub; make the script run to the extent the stub allows, and say exactly what you could not run. The operator runs the full flow after merging both branches.
8. `docs/livedesk/README.md`: how to run, the four-step demo script, what is simulated.

## Ownership
Own: `next/src/components/livedesk/**`, `next/src/app/start/**`, `next/src/app/desk/**`, `next/src/app/legacy/**`, `next/src/__tests__/livedesk/ui/**`, `next/acceptance/livedesk-browser.mjs`, `docs/livedesk/README.md`. Small edits allowed: `next/src/app/page.tsx` and `next/src/components/shell/**` (navigation and Home), `next/src/app/integrations/**` (the unpin row text only if the other agent's capability change needs it; otherwise leave it). Anything else: stop and describe it in the report. You write no engine, adapter, Copilot or platform code.

## Rules
Existing screens keep their URLs, tests and test ids. The Lab and its harness must still pass. No test removed or weakened. No new dependency. No `any`. Match the surrounding style.

## Process and report
```bash
git worktree add ../livelift-wp5b -b agent/codex/wp5b-ui origin/claude/youthful-galileo-92o0nz
cd ../livelift-wp5b/next && npm ci
```
Commit small, push only `agent/codex/wp5b-ui`, never force, never merge. Verify from `next/`: `npm run typecheck && npm run lint && npm test && npm run build` (baseline 78 files, 1,252 passed, 57 skipped). Report in the AGENTS.md format with screenshots of Start, the Desk with a suggestion, and the 390 px layout. Say plainly what you could not verify.
