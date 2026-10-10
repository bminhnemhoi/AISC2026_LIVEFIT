# WP5: Live Desk, the original LiveLift idea on top of the simulation

> **Shared spec.** The work is split in two: [WP5a logic](WP5a-livedesk-logic.md) and [WP5b screens](WP5b-livedesk-ui.md). Each has its own brief, ownership and branch, and they meet at the contract in `next/src/lib/livedesk/types.ts`. Sections 4 to 6 below apply only to an agent doing the whole job alone.

You are a coding agent working for the LiveLift team. Work alone and finish in one pass. Do not ask questions; where this brief is silent, choose the simplest option that keeps the evidence model and say so in your report.

## 0. Read first, in this order

1. `AGENTS.md` (root) and `next/AGENTS.md`. The second says this is not the Next.js you know: read the relevant guide in `next/node_modules/next/dist/docs/` before writing routes or components.
2. `docs/platform/SHOPEE-LIVE-SIMULATION.md`, `docs/orchestration/SIMULATION-LAB-PLAN.md`, `docs/orchestration/reviews/06-lab-pass.md`.
3. Code you will build on: `next/src/lib/platform/{shopeeLive,sync,capabilities,world,viewModel,wire}.ts`, `next/src/components/platform/**` (especially `host-app/`, `PlatformSyncPanel.tsx`, `usePlatformWorld.ts`), `next/src/lib/server/ai/*`, `next/src/components/ai/*`, the CSV/TSV import in the Prepare screen.
4. Reference only, read-only, do not copy Python: the original project https://github.com/bminhnemhoi/AISC2026_LIVEFIT. Port the *behaviour* of its comment intent labels (`src/livelift/nlp/intent.py`, `labels.py`) and Vietnamese PII masking (`src/livelift/ingest/pii/`) to TypeScript, with your own tests.

## 1. Why this work exists

The team started with a live-assist desk: the operator imports products, goes live, pins and unpins whenever they like, watches comments and charts, and an AI helper says what to push next. An earlier assistant talked the team into a "Create LIVE, plan a run of show" model because real platform control was doubted. The simulation now exists (SIMULATED Shopee Live, two-way sync), so the product returns to its original shape:

**Connect a platform → Import products (they sync to the platform) → Start live → Live Desk (free pin/unpin, realtime comments and charts, AI Copilot suggestions).**

There is no "Create LIVE" and no run-of-show in this flow. Nothing talks to a real platform. Everything is SIMULATED and must say so.

## 2. Decisions already made (do not reopen)

- Build inside `next/` (TypeScript). The Python project is a reference, not a dependency.
- One platform-neutral adapter interface, with the existing SIMULATED Shopee Live behind it. No TikTok adapter now.
- The AI Copilot only suggests. The operator clicks Pin, Flash sale or Dismiss. No auto-pin.
- Unpin on the Live Desk is a normal button. The simulated platform serves it as a **shape-inferred** call; there is no documented Shopee endpoint, so the UI, capability table and docs say "guessed, no Shopee page found". Never present it as Shopee's behaviour.
- Realtime data comes from a seeded synthetic generator. It always carries the SIMULATED label and is never treated as learning from real data.
- Copilot works with several AI providers chosen by environment variable, and with a deterministic rules scorer when there is no key. Every suggestion says whether rules or an AI model produced it.
- The old V3 screens (Create, Prepare, Operate run-of-show, Review, Next LIVE, Simulator) keep their current URLs and tests. Add a `/legacy` page that links to them. The new navigation and Home do not link to them except through `/legacy`. Do not move or delete old routes.

## 3. Scope

### 3.1 Flow and routes
- `/` Home becomes the new flow: platform status (SIMULATED Shopee Live), product count, next step. Keep the honesty panel ("What is real, and what is not").
- `/start`: step 1 Connect (one click, SIMULATED), step 2 Import products (paste CSV/TSV using the existing parser, or the sample pack), step 3 Start live.
- Each imported product is added to the simulated platform at once through the adapter (`add_item_list`). Show per product: queued, synced (SIMULATED) or failed with the platform's own error text. A missing price stays "Not entered", never 0.
- "Start live" is enabled only when connected and at least one product is synced. It runs `create_session` then `start_session`. There is no Create LIVE button anywhere in the new flow.
- `/desk/[liveId]`: the Live Desk. End live is available there.
- `/legacy`: plain index of the old screens with one sentence on what they are.

### 3.2 Platform adapter
- `next/src/lib/livedesk/adapter.ts`: `LivePlatformAdapter` with `syncProducts`, `startLive`, `endLive`, `pin`, `unpin`, `observe` (what is showing), `readMetrics`. The Shopee implementation wraps the existing simulated platform and sync bridge. Do not fork or rewrite them.
- Add an inferred `unpin` to the simulated platform without changing any existing call or the Director script. Add its capability row and basis text. All existing capability tests must still pass, with updates only where the unpin row legitimately changes.
- Pin and unpin are free: any time during the live, any product that is synced, no schedule, no anchor, no cooldown, no confirmation dialog. One item shows at a time (a new pin replaces the old one). A pin or unpin the host makes in the simulated host app is observed through the existing sync and recorded as "Provider observed (SIMULATED)".

### 3.3 Realtime simulation
- `next/src/lib/livedesk/engine.ts`: seeded, deterministic. Events per virtual second are a pure function of (seed, second, world), so Run, Pause, speed changes and skip-ahead all give the same log for the same actions.
- Events: viewers, comments, add-to-cart, purchases. Rates respond to what is showing. That response is a documented simulation assumption listed on screen in a "Simulation assumptions" panel; it is not evidence about real viewers.
- Controls: Run and Pause, speeds 1×, 5×, 15×, 60×, skip +30 s, +1 min, +5 min, Reset. Take the idea from `useSimulatorControls` (Run/Pause with a speed) but own your state; there are no anchors to stop at here.
- Persist only in the browser under its own key `livelift.livedesk.SIMULATED`. Never write to `livelift.v3.SIMULATED`.
- A visible run fingerprint like the Lab's (reuse the digest helper if suitable).

### 3.4 Live Desk screen
Dark theme with the existing tokens; add none. Desktop 1280×720 and up is the target; 390 px wide must not break (stack the panels).
- Products: list with stock, price (or "Not entered"), pin state, Pin and Unpin buttons.
- Charts, inline SVG only, no new dependency: viewers over time; add-to-cart per minute for the product on show; markers where the operator pinned or unpinned. Under each chart one line: markers show when you acted, not what caused a change. Each chart has a text alternative.
- Comments: live stream, newest first, with intent chips (ask price, ask size, ready to buy, praise, other) from your TypeScript port of the original rules. Counters per intent for the last 2 minutes. Comment text goes through the PII mask before it is displayed or stored. A few synthetic comments contain obviously fake phone numbers or emails so masking is visible.
- Copilot panel (3.5).
- The simulated host app phone (reuse `components/platform/host-app`) so the operator sees what the audience sees.
- Condition banners from the platform (authorisation expired, rate limit, server error) as the existing sync does: stop, say once, operator continues by hand.
- Wire log available behind a toggle, as in the Lab.

### 3.5 AI Copilot
- `next/src/lib/livedesk/copilot/`: signal aggregation per product over a recent window: ask-price, ask-size and ready-to-buy comments, add-to-cart events, stock, time since last shown.
- A rules scorer ranks "show next" and proposes flash-sale timing (for example when add-to-cart momentum is rising while stock is healthy). It states the signals it used and the sample size. Confidence is low, medium or high from sample size only. No made-up probabilities or percentages.
- Optional model refinement through the existing `lib/server/ai` layer. Add providers only through environment variables and plain `fetch`, no new dependency. The model receives only aggregated numbers and PII-masked short excerpts, never raw comments. Validate its output with Zod. On timeout, error or missing key fall back to rules and show "rules". A tester must be able to run everything with no key.
- Lifecycle of each suggestion: proposed → accepted or dismissed by the operator → performed only when the platform shows the pin. The UI never conflates these. Wording says "signals suggest", never "this caused" or "will increase sales".
- Use the existing AI fixture mode in tests. No test calls a real provider.

### 3.6 Honesty requirements (inherited, enforced by tests)
- Every surface that shows simulated state carries the word SIMULATED. Never write "synced with Shopee", "connected to Shopee" or "confirmed by Shopee". The acceptance script greps rendered text for these.
- Only `update_show_item` copies Shopee's published reference; all else is shape inferred and labelled. Do not invent platform facts. If you need one you do not have, say so in the report.
- Planned is not actual, recommendation is not acceptance, operator reported is not provider observed, missing is not zero, observation is not causation. Synthetic data never becomes "learning".

## 4. Ownership and limits

Create and own: `next/src/lib/livedesk/**`, `next/src/components/livedesk/**`, `next/src/app/start/**`, `next/src/app/desk/**`, `next/src/app/legacy/**`, matching tests under `next/src/__tests__/livedesk/**`, `next/acceptance/livedesk-browser.mjs`, `docs/livedesk/**`.

You may make small edits to: the shared navigation and Home (`next/src/components/shell/**`, `next/src/app/page.tsx`), `next/src/lib/platform/capabilities.ts` and `next/src/lib/platform/shopeeLive.ts` for the inferred unpin only, `next/src/app/integrations/**` for the unpin row text, `next/src/lib/server/ai/**` for extra providers. Any other file: stop and describe it in the report.

Hard rules: the Platform Lab, its Director script and its fingerprint **9d723008** (39 calls) must not change. No test is removed or weakened. No new dependency. No `any`. Test ids that other code or the Lab harness uses are contracts.

## 5. Process

```bash
git worktree add ../livelift-livedesk -b agent/claude/livedesk origin/claude/youthful-galileo-92o0nz
cd ../livelift-livedesk/next && npm ci
```

Commit small, imperative subjects. Never push to `main` or another agent's branch; push only `agent/claude/livedesk`. Do not merge: the operator reviews and merges.

## 6. Verify and report

From `next/`: `npm run typecheck && npm run lint && npm test && npm run build`. Baseline before your work: 78 files, 1,252 passed, 57 skipped. Add tests for: engine determinism (same seed and actions across different tick batching), adapter sync and failure states, free pin/unpin including immediately after start and repeated, host-side change observed, intent rules and PII mask, Copilot scoring, fallback labelling, suggestion lifecycle, no-forbidden-phrases, and `/legacy` links.

Write `next/acceptance/livedesk-browser.mjs` in the style of `lab-browser.mjs` (production build, local HTTPS, Playwright, axe-core): walk Connect → Import → Start live → Run → pin, unpin, pin again → accept a Copilot suggestion → end live, at 1920×1080, 1280×720 and 390×844, two runs each; zero axe violations; run fingerprint equal across the two runs; no horizontal overflow; no Create LIVE in the new navigation. Also run the existing Lab harness and report whether it still passes with fingerprint 9d723008. Use axe-core 4.13.0; a newer axe flags `label-content-name-mismatch` on the wire JSON buttons, which is a known tool-version difference, not your change.

Write `docs/livedesk/README.md`: the flow, what is simulated and how, the simulation assumptions, the Copilot's inputs and limits, the unpin guess, how to run it, and the demo script in four steps.

Report in the AGENTS.md format (branch and SHA, files changed and any outside ownership with why, verify output summary lines, unfinished or unsure items, screenshots of Start, Live Desk with a Copilot suggestion, and the 390 px layout). Say plainly anything you could not verify.
