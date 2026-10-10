# WP3 brief: independent verification (Codex)

Paste this whole file as your first message. Read `AGENTS.md` and `docs/orchestration/SIMULATION-LAB-PLAN.md` first.
Suggested setup: highest reasoning level, sandboxed, workspace-write only inside your worktree.

## Your job

You are the second pair of eyes. A different model family wrote the platform core, so assume it has defects and find them.
You do not rewrite it; you test it, break it, and report. Then you build the browser acceptance for the Lab.

```bash
git fetch origin claude/youthful-galileo-92o0nz
git worktree add ../livelift-wp3 -b agent/codex/wp3-verification origin/claude/youthful-galileo-92o0nz
cd ../livelift-wp3/next && npm ci
```

## You own

`next/src/__tests__/platform/property/**` · `next/acceptance/lab-browser.mjs` · `docs/orchestration/reviews/**`.
You may **add** files there. You may not edit source files, existing tests, `package.json`, lockfiles or CI. A defect goes in a review note, not into the source.

## Phase 1: now

Read `next/src/lib/platform/` (`shopeeLive.ts`, `sync.ts`, `capabilities.ts`) and `next/src/components/platform/`. Then:

1. **Adversarial review** → `docs/orchestration/reviews/01-platform-core.md`. For each finding: file and line, the failing input or sequence, why it matters, severity, and a minimal reproducing test. Look hardest at:
   - the failed-call path: does a refused call ever leave the platform changed, or the ledger inconsistent?
   - echo suppression: can any sequence make LiveLift report its own change back as "observed"?
   - `syncCycle` idempotence and ordering (read first, then write);
   - `structuredClone` of state across `localStorage` round trips (`usePlatformWorld`): version drift, partial writes, a corrupted blob;
   - the 300-entry ledger cap: does anything depend on an old entry that can fall off?
   - evidence labels: any path that records `performed` without an accepted request, or `observed` without a real read;
   - anything that reads `Date.now()` or randomness and would break determinism.
2. **Property tests** in `next/src/__tests__/platform/property/` (no new dependency: write a small seeded generator). Properties to check over thousands of random action sequences:
   - determinism: same seed and actions, identical state and ledger;
   - idempotence: a second `syncCycle` with nothing new changes nothing and makes no calls;
   - no echo; a refused call never mutates platform state; `performed` implies an accepted request id;
   - the live is never ongoing after the show ended and the sync ran;
   - ledger length never exceeds the cap and `seq` is strictly increasing.
3. Any failing property is a finding. Commit the failing test marked `it.fails` or `it.skip` **with the reason in the title** so the suite stays green and the defect stays visible.

## Phase 2: once the Lab route exists (the operator will tell you)

Write `next/acceptance/lab-browser.mjs` in the style of the other scripts in that folder (production build, local HTTPS, Chromium, Playwright installed outside the product):
three viewports (1920×1080, 1280×720, 390×844); open a SIMULATED show; run the Demo Director to the end; assert that the call log is identical on a second run; assert **0 axe-core violations** on each state; assert no layout shift when the phone updates; assert `prefers-reduced-motion` removes motion; assert the word SIMULATED is present on every simulated surface; assert none of the forbidden phrases in `AGENTS.md` appears anywhere in the rendered text.

## Done when

The review note is written with reproducible findings, property tests are in and the suite is green, and (phase 2) the acceptance script runs and its output is attached. Push your branch and report in the format from `AGENTS.md`. Do not pad the review: "no defect found in X, here is what I tried" is a valid, useful line.
