# WP1 brief: Lab core (Claude Code)

Paste this whole file as your first message. Read `AGENTS.md` and `docs/orchestration/SIMULATION-LAB-PLAN.md` first.
Suggested setup: strongest model available, high effort, start in plan mode and show me the plan before editing.

## Your job

Build the **Platform Lab** route and everything behind it, using the code already in `next/src/lib/platform/` and
`next/src/components/platform/` (the SIMULATED Shopee Live, `syncCycle`, `PlatformSyncPanel`).
The Lab is a full-screen, three-zone page: LiveLift desk (left), the wire (centre), the host's Shopee app (right).
The right zone is built by another agent from `next/src/components/platform/host-app/types.ts`. You feed it a view model.

```bash
git fetch origin claude/youthful-galileo-92o0nz
git worktree add ../livelift-wp1 -b agent/claude-code/wp1-lab-core origin/claude/youthful-galileo-92o0nz
cd ../livelift-wp1/next && npm ci
```

## You own

`next/src/lib/platform/**` · `next/src/app/live/[sessionId]/lab/**` · `next/src/components/platform/lab/**` ·
`PlatformSyncPanel.tsx` · `usePlatformWorld.ts` · a link to the Lab from the Operate desk.
Do not touch `host-app/**` (WP2), `__tests__/platform/property/**` and `acceptance/` (WP3), `lib/domain/**`, `contracts/**`.

## Build, in this order

1. **`toHostAppViewModel(sim, sync, session, nowMs)`** in `next/src/lib/platform/viewModel.ts`. Pure. Returns the contract in `host-app/types.ts`.
   Prices are formatted for vi-VN and are `null` when unknown. Viewer count and comments are deterministic functions of the virtual clock and the call log (no `Math.random`, no `Date.now`), clearly synthetic.
   Platform conditions (token expired, region not supported, rate limited) become `banner`.
2. **Route `/live/[sessionId]/lab`**, SIMULATED shows only (otherwise explain and link back, as the Operate page does for a missing show). Reuse the desk clock and the simulator controls from the Operate page; extract a shared hook rather than copying.
   Until WP2 lands, render the right zone through a small local placeholder behind one import so swapping it is a one-line change.
3. **The wire**: a swimlane of LiveLift / platform / host over the virtual clock. Each API call is an arrow with endpoint, outcome, `request_id` and a "shape from Shopee's page" or "shape inferred" tag (data already in the call log). A host action is an event on the host lane. A read that noticed it draws the return arrow and the resulting LiveLift record. Click a call to see its JSON. Must work without colour alone.
4. **Demo Director**: `next/src/lib/platform/director.ts` (pure data: steps with id, caption en and vi, and a function from state to commands) plus the player UI (Play, Pause, Step, Reset, speed). 90 second story from the plan, section 1, item 2. Deterministic: running it twice yields identical call logs. Put a test next to it.
5. **Copy**: every Lab string in `next/src/components/platform/lab/labCopy.ts` as `{ en, vi }`, with a toggle. Vietnamese must be natural, not literal. Flag lines you are unsure of for a human to check.
6. **Presenter mode**: one key toggles large type and hides secondary chrome. Respect `prefers-reduced-motion`.
7. Remove duplication between `PlatformSyncPanel` and the Lab; keep the panel working inside Operate.

## Rules that matter here

- The evidence model in `AGENTS.md` is not negotiable. Record what the host does as `Provider observed (SIMULATED)`; a pin LiveLift sends is `performed` with the request id and stays `platform verification unknown`.
- Never claim a connection to Shopee. The Assumptions strip (A1, A2, with "not verified on real Shopee") is part of the page, not a footnote.
- Keep `syncCycle` pure and its call-log determinism. Add tests for everything you add.

## Done when

Typecheck, lint, tests and `npm run build` pass; the Lab route renders with a placeholder or WP2's components; the Demo Director replays identically; every item above is ticked or listed as not done in your report. Then push your branch and send the report in the format from `AGENTS.md`.
