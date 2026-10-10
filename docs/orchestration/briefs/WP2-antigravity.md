# WP2 brief: the host's Shopee app (Antigravity)

Paste this whole file as your first message. Read `AGENTS.md` and `docs/orchestration/SIMULATION-LAB-PLAN.md` first.
Suggested setup: Agent Manager with the browser enabled, and **destructive shell actions disabled**. Comment on your artifacts at checkpoints. Commit after every visible step.

## Your job

Build the **simulated Shopee Live host screen**: the phone the host holds during a live. It is the right-hand zone of the Platform Lab.
It should look like a polished, believable live-commerce screen, and it must never look like a claim that this is Shopee.

```bash
git fetch origin claude/youthful-galileo-92o0nz
git worktree add ../livelift-wp2 -b agent/antigravity/wp2-host-app origin/claude/youthful-galileo-92o0nz
cd ../livelift-wp2/next && npm ci && npm run dev    # http://localhost:3130
```

## You own, and only this

`next/src/components/platform/host-app/**` · `next/src/app/simulator/gallery/**` · one block at the end of `next/src/app/globals.css`
delimited by `/* host-app */ ... /* end host-app */` (keyframes and tokens only).
Do not touch anything else. In particular not `lib/**`, `contracts/**`, `components/platform/lab/**`, `PlatformSyncPanel.tsx`.

## The contract

`next/src/components/platform/host-app/types.ts` is fixed: `HostAppViewModel` and `HostAppActions`. Your components take a view model and actions and
nothing else. They import nothing from `@/lib/platform` and never read the clock or randomness. Another agent builds the adapter that fills the view model.
If the contract is missing something, do not change it: describe the need in your report.

## Build

1. `HostApp.tsx`: a phone frame (about 390×844, scales down) with three modes:
   - **idle**: "Go live" screen with the shop's product bag preview.
   - **live**: video area (an abstract animated gradient, no real faces or logos), top bar with a clearly labelled simulated viewer count and elapsed time, the **pinned product card** with a smooth enter and leave, the bag drawer, a flash-sale banner with countdown, the synthetic comment stream, and the host's controls (pin, unpin, add, remove, end).
   - **ended**: a quiet summary state.
   - A permanent, legible **"SIMULATED"** tag on the phone. A banner slot for platform conditions (info, warn, danger).
2. Small parts it uses: `PinnedCard`, `BagDrawer`, `PromotionBanner`, `CommentStream`, `ViewerPill`.
3. **Gallery page** `next/src/app/simulator/gallery/host-app/page.tsx` showing every mode and state from fixtures, with toggles, so it can be reviewed with no other code. Include: empty bag, ten items, long names, price unknown (`null`, shown as "Price not set", never 0), pinned/unpinned, promotion scheduled/active/ended, each banner tone, 100+ comments.
4. Motion: pin and unpin transitions, countdown tick, new comment, banner appear. 60 fps, no layout shift, and a calm fallback under `prefers-reduced-motion`.
5. Accessibility: real buttons with labels, visible focus (`--focus-ring`), contrast on the dark tokens, comment stream is `aria-live="polite"` and does not steal focus, nothing relies on colour alone.
6. Use the existing design tokens and Rubik. Reuse `components/ui` where it fits. Remix Icon is the icon set. No new dependencies, no remote images or fonts.

## Look

The product is dark, calm and precise (lime for the one real action, violet for SIMULATED). The phone may be warmer and more energetic than the desk, but it must stay inside that palette and read as part of LiveLift. It should be the thing people photograph.

## Verify with your own browser

At 1920×1080, 1280×720 and 390×844: no overflow, no clipping, no horizontal scroll, focus order sensible. Attach screenshots to your report. Run typecheck, lint, tests and `npm run build`.

## Done when

The gallery shows every state cleanly, all checks pass, screenshots are attached, and nothing outside your folders changed. Push your branch and send the report in the format from `AGENTS.md`.
