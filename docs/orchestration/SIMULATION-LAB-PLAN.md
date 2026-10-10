# Simulation Lab: plan, ownership and review protocol

**Date 2026-10-08.** Operator: the planning session (this document's author). Builders: Claude Code, Codex, Antigravity.
Goal: the SIMULATED Shopee Live two-way sync becomes a demo that is beautiful, fast to understand, honest, and repeatable.
Dates: slide due **2026-10-19**, poster due **2026-10-25** (AISC'26 round 2 page). The date of the presentation itself is not yet confirmed.

## 1. What "done" looks like

A new route, **Platform Lab** (`/live/[sessionId]/lab`, SIMULATED shows only), that a judge understands in ten seconds.

```
┌─────────────── LiveLift desk ──────────────┬──── the wire ────┬────── Host's Shopee app (SIMULATED) ──────┐
│ NOW / NEXT / WHY chips · clock controls    │ → create_session │  phone frame: live room look              │
│ planned cues, one-tap "Pin on Shopee"      │ ← 200 request_id │  pinned product card, bag, viewer count   │
│ evidence labels on every record            │ swimlane, both   │  flash-sale countdown, synthetic comments │
│ what LiveLift noticed                      │ directions       │  the host's own buttons: pin/add/end      │
└────────────────────────────────────────────┴──────────────────┴────────────────────────────────────────────┘
        Demo Director: ▶ Play · ⏸ · ⏭ Step · ↺ Reset · captions (en | vi) · Presenter mode · Reduced motion
```

Acceptance, all required:

1. **Both directions are visible as cause and effect.** LiveLift pins, the phone shows it pinned. The host pins on the phone, LiveLift records *Provider observed (SIMULATED)*. The wire lane shows the call, the reply, and the next read that noticed it.
2. **Demo Director** plays a 90 second deterministic story: show starts, live opens, products load, LiveLift pins, host pins another product, authorisation expires and LiveLift degrades to manual and says so once, it recovers, the 20:12 flash sale becomes active, the live ends. Same script gives a byte-identical call log.
3. **Honest by construction.** SIMULATED on every simulated surface. An *Assumptions* strip shows A1 and A2 as switchable, with "not verified on real Shopee". No sentence claims a connection to Shopee.
4. **Presenter mode** for a projector (1280×720 and 1920×1080): large type, minimal chrome, readable from the back of a room. **Vietnamese** toggle for all Lab copy, kept in one file.
5. **Quality gates.** typecheck, lint, all tests, `npm run build` green. A browser acceptance run against the production build passes on three viewports (1920×1080, 1280×720, 390×844) with **0 axe violations** and no layout shift when the phone updates. `prefers-reduced-motion` is respected.
6. **Media for the poster and slides**, produced from the real app: 6 stills (2560×1440) and one 60–90 s recording, in `docs/img/platform/` with a README saying what each shows.

## 1b. Competition deliverables (from the AISC'26 round-2 page and the organisers' template)

| Item | Spec |
|---|---|
| Slide | Due 2026-10-19. PDF, PPT or PPTX, at most 25 MB. File name `<team id>-<team name>_Slide`, for example `AISC26-0039-LiveLift_Slide.pdf`. |
| Poster | Due 2026-10-25. Organisers' template: fixed red header and footer art, **content area 55 cm × 60 cm** (guide ratio 1100 × 1200 px). Backdrop PNG and logos supplied (white and colour). Do not alter header, footer or logos. File name assumed to follow the slide pattern; confirm on the page. |
| Confirmation of participation | Done 2026-10-08; editable until 2026-10-14 23:59. |

The template files are the organisers' artwork. Keep them out of this repository; the operator holds them.

## 2. Who does what, and why

Evidence for the split. In this repository, every commit that carries a co-author trailer carries a Claude one (63 trailers, Opus 5, Opus 5.5, Sonnet 5.5, Fable 5), so Claude Code wrote the product and knows its invariants. Codex produced the gap study (`docs/research/codex-gap-study/`): bounded, claim-disciplined, strong on "NOT FOUND" honesty. Antigravity produced the architecture study and the screenshot set (`docs/research/antigravity/`). Outside the repo, secondary reviews (blogs, not official, they disagree in places) say: Claude Code is favoured for planning and multi-file refactors and has the stronger subagent ecosystem; Codex is favoured for scoped, sandboxed, repetitive work and as a second-model reviewer; Antigravity's strength is driving a real browser to verify its own UI work and publishing screenshots and recordings, with reported instability and security caveats while in preview. Treat those as leads, and judge by the diffs you get back.

| Work package | Agent | Why this agent | Owns |
|---|---|---|---|
| **WP1 Lab core**: route, state, wire lane, Demo Director, view-model adapter, Vietnamese copy | **Claude Code** | Wrote the product and the platform core; multi-file change that must keep the evidence invariants | `next/src/lib/platform/**`, `next/src/app/live/[sessionId]/lab/**`, `next/src/components/platform/lab/**`, `PlatformSyncPanel.tsx`, `usePlatformWorld.ts` |
| **WP2 Host app**: the phone, the bag, the pin card, countdown, comments, animations, gallery | **Antigravity** | Visual work that needs a live browser loop; can verify its own UI and capture media | `next/src/components/platform/host-app/**`, `next/src/app/simulator/gallery/**`, the `/* host-app */` block at the end of `next/src/app/globals.css` |
| **WP3 Verification**: adversarial review of the core and WP1, property tests, browser acceptance with axe, determinism checks | **Codex** | A second model family reviewing code another family wrote; scoped, test-heavy, sandbox-friendly | `next/src/__tests__/platform/property/**`, `next/acceptance/lab-browser.mjs`, review notes in `docs/orchestration/reviews/` |
| **WP4 Media and documents**: stills, recording, slides, poster | Antigravity (capture) + operator (documents) | Capture comes from its browser loop; slides and poster are not code | `docs/img/platform/**` |

The one contract all three depend on is `next/src/components/platform/host-app/types.ts` (already committed): `HostAppViewModel` and `HostAppActions`. WP2 builds components that take that view model and nothing else, so WP2 never waits for WP1. WP1 writes `toHostAppViewModel` in `next/src/lib/platform/viewModel.ts`.

## 3. Sequence

| When | Step |
|---|---|
| Day 0 (10-08) | Operator commits rules, contract and briefs. Each agent starts in its own worktree. |
| Day 1 to 3 (10-09 to 10-11) | WP1, WP2, WP3-review run in parallel. WP2 delivers a gallery page with fixtures so it can be judged without WP1. |
| 10-12 | Operator reviews each branch (section 5). Merge order: WP2 first (leaf components), then WP3 tests, then WP1 integrates both. |
| 10-13 to 10-14 | WP3 runs browser acceptance on the integrated build. Fix list goes back to the owner of each failure. |
| 10-15 | **Feature freeze.** Only fixes from here. |
| 10-16 to 10-17 | WP4 captures stills and recording from the frozen build. Operator drafts slides. |
| 10-18 | Slides reviewed by the team. **10-19 slide due.** Poster follows by 10-25. |

If anything slips, cut in this order: Vietnamese toggle, recording (keep stills), the wire swimlane (keep the call log). Never cut honesty labels or the gates.

## 4. Branches and merging

- Integration branch: `claude/youthful-galileo-92o0nz`. Each agent branches from it: `agent/claude-code/wp1-lab-core`, `agent/antigravity/wp2-host-app`, `agent/codex/wp3-verification`.
- One git worktree per agent, so three tools never edit the same folder. Never two agents in one working tree.
- Agents push their own branch and report. Nobody merges their own branch. The operator reviews, then merges in the order above.
- Files nobody owns (`package.json`, lockfile, `ci.yml`, anything under `next/src/lib/domain/`, `contracts/`) are **off limits**. A needed change goes in the report.

## 5. Operator review checklist (per branch)

1. `git fetch`, then `git diff --stat origin/claude/youthful-galileo-92o0nz...<branch>`: any file outside the owner's list is a finding.
2. Run typecheck, lint, test, build. Compare with the baseline (65 files, 1,095 passed, 57 skipped).
3. Search the diff for the forbidden phrases: "synced with Shopee", "connected to Shopee", "confirmed by Shopee", "real-time from Shopee"; and for any simulated surface missing SIMULATED.
4. Check that no test was removed, skipped or loosened.
5. Look at the screenshots. Compare against section 1.
6. Check determinism: run the Demo Director twice, compare the call logs.
7. For WP3: did it find real defects in WP1? A review that finds nothing is suspect; ask what it tried.

## 6. Risks

- **Antigravity** is reported as unstable and security-sensitive in preview. Restrict it to presentational files, disable destructive shell actions, review every diff, and have it commit after each visible step.
- **Two agents, same file.** The ownership table and worktrees prevent it. A violation is sent back, not patched by hand.
- **Beauty versus honesty.** A polished phone can make the simulation look real. Every simulated surface keeps its label, and a judge must be able to see that nothing here is Shopee.
- **Unknown platform behaviour.** The simulation answers A1 and A2 by assumption only. The poster says "architecture ready, real integration awaiting access", never "synced".
