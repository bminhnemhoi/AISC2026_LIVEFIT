# AGENTS.md: rules for every coding agent on LiveLift

Applies to Claude Code, Codex and Antigravity alike. Read this file, then your brief in `docs/orchestration/briefs/`.
The plan all briefs belong to is `docs/orchestration/SIMULATION-LAB-PLAN.md`.

## What this repository is

- The current product is `next/` (Next.js 16, React 19, strict TypeScript, Tailwind 4, Zod, Vitest). Work there.
- `src/`, `tests/`, `web/`, `collectors/`, `analysis/` are the original Python research project. Do not change them.
- Interface language is English. Dark theme tokens live in `next/src/app/globals.css`; reuse them, add none unless your brief says so.

## Verify before you say "done"

From `next/`:

```bash
npm run typecheck && npm run lint && npm test
npm run build          # for any UI change
```

Baseline on 2026-10-09: **88 test files, 1,410 passed, 57 skipped**, typecheck and lint clean. A change may add tests; it may not remove or weaken one.
Paste the summary line of each command in your report. Do not claim a result you did not see.

## Non-negotiable: the evidence model

Never blur these. A change that does is rejected however good it looks.

- missing is not zero · unknown is not failed · planned is not actual
- recommendation is not acceptance, attempt, or performed
- operator reported is not provider observed is not platform confirmed
- REAL is not SIMULATED, and simulated data never becomes real learning
- observation is not causation; later evidence never appears as known during the LIVE

## Simulation honesty

Everything under `next/src/lib/platform/` and `next/src/components/platform/` is a **simulation of Shopee Live**. Nothing talks to Shopee.

- Every surface that shows simulated platform state carries the word SIMULATED (or the violet simulated token).
- Only `update_show_item` copies Shopee's published reference. Every other call is *shape inferred*. Do not present a guess as Shopee's behaviour.
- Never write "synced with Shopee", "connected to Shopee" or "confirmed by Shopee" in code, UI or docs.
- In the UI the platform is a generic simulated live platform: write "SIMULATED Live", never a real platform's name. Shopee is named only where a note cites its published reference (e.g. `update_show_item`).
- Do not invent platform facts. If a brief needs one you do not have, say so in your report.

## Scope, branches, conflicts

- Stay inside the files your brief says you own. Need a change elsewhere? Stop and describe it in your report.
- Work in your own git worktree on your own branch, created from `claude/youthful-galileo-92o0nz`:
  `git worktree add ../livelift-<wp> -b agent/<tool>/<wp> origin/claude/youthful-galileo-92o0nz`
- Never push to `main`, never push to another agent's branch, never force-push, never rewrite history.
- Commit small and often. Imperative subject lines. No secrets, tokens, personal data or screenshots showing them.
- No new dependencies without asking. No `any`. Match the surrounding code's style and comment density.

## Report format (end of every work session)

1. Branch and last commit SHA. 2. Files changed, and any file outside your ownership you had to touch (with why).
3. The verify commands with their summary lines. 4. What you could not finish or are unsure about. 5. Screenshots, if UI.
