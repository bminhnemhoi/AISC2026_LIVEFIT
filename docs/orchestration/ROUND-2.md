# Round 2: integrate, fix, verify, capture

**Date 2026-10-08.** Round 1 is merged into `claude/youthful-galileo-92o0nz` (WP2 host app, WP3 review and property tests, WP1 Lab).
Operator checks on the merged tree: typecheck clean, lint clean, **76 test files, 1,185 passed, 18 expected failures, 57 skipped**, `npm run build` green,
the Lab renders at 1920×1080, 1280×720 and 390×844, the Demo Director replays with an identical call-log fingerprint on two runs, no forbidden phrase, no removed or skipped test,
every agent stayed inside its files. The 18 expected failures are Codex's nine defect reproductions; they stay red-on-purpose until fixed.

Read `AGENTS.md` first. Branch from the updated integration branch. Same report format.

## Decisions on the two contract findings

- **P01 (strict idempotence).** Reads are traffic, not writes. A repeated cycle with nothing new must make **no writes, no commands, no notices**. Reads are still logged, but in a **separate bounded ring** so polling can never evict a write from the call log. The property is restated that way.
- **P05 (performed without a request id).** Keep. A host action has no LiveLift request. The rule is: an outbound `performed` carries an accepted request id; a provider-observed `performed` carries the reason `Provider observed (SIMULATED)` and never a made-up id. Restate the property that way. A structured marker would need a change in `lib/domain`, which nobody owns; it stays a known limitation, written down in `docs/platform/SHOPEE-LIVE-SIMULATION.md`.

## WP1b, Claude Code: integrate the real phone, fix the defects

Branch `agent/claude-code/wp1b-integrate`. You own what you owned, and you may now also edit the `host-app` import sites in the Lab. You do not edit `host-app/**` itself.

1. **Wire the real `HostApp`** into the Lab and delete `HostAppPlaceholder` and the stand-in note. Fill it with `toHostAppViewModel`; map each `HostAppActions` callback to the matching host action and run the sync, exactly as the stand-in's controls do. Both zones must stay in step with the wire.
2. **Fix, in `next/src/lib/platform/**` and `usePlatformWorld.ts`**, the findings in `docs/orchestration/reviews/01-platform-core.md`:
   P01 (read ring), **P02** (a refused call must never overwrite the last good baseline), **P03** (resume starting an API-created session once its products load), **P04** (keep the explicit link to a host-started live reachable and disclose an unlinked ongoing live at show end), **P06** (validate the whole persisted shape and every counter, recover a fresh world), **P07** (reload world on session change), P08 (sync after Reset), P09 (snapshot `params` and the envelope in the ledger).
   Exception granted for this round only: in `next/src/__tests__/platform/property/`, you may change `it.fails` to `it` **for the tests of defects you actually fixed**, and nothing else there. Every fix needs its reproducing test passing as an ordinary test.
3. Update `docs/platform/SHOPEE-LIVE-SIMULATION.md` for the P01 and P05 decisions.
4. Report which findings are fixed, which are not and why.

## WP2b, Antigravity: audit your phone, then capture

Branch `agent/antigravity/wp2b-polish`. Same ownership as before, plus `docs/img/platform/**`.

**Part A, now.** Audit the gallery at 1920×1080, 1280×720 and 390×844: text contrast on the dark tokens (target WCAG AA), focus order, touch target size (at least 44 px), long Vietnamese and English strings, reduced motion, the phone at 200 px and at 480 px wide (in the Lab it sits in a narrow zone). Fix what you find inside `host-app/**`. Keep SIMULATED legible at every size. Report what you changed.

**Part B, after the operator says WP1b is merged.** Capture, from the real Lab in presenter mode, in Vietnamese and English where it matters:

| # | Still (2560×1440) | Shows |
|---|---|---|
| S1 | Hero | The Lab at Director step 6: the host pinned in the phone, LiveLift recorded *Provider observed (SIMULATED)* |
| S2 | The wire | A call expanded: endpoint, request, reply, `request_id`, "shape from Shopee's page" or "shape inferred" |
| S3 | The phone | Live mode with a pinned product and the flash-sale countdown |
| S4 | Degrade | Authorisation expired: LiveLift says it once and the operator continues by hand |
| S5 | Honesty | The Assumptions strip with A1 and A2 |
| S6 | Platforms | The Integrations page, "Platform control, by platform" (TikTok next to Shopee) |

Also one 60 to 90 second screen recording of the Director playing in Vietnamese. Stills go in `docs/img/platform/` with a `README.md` giving each file's name and what it shows. **Do not commit the video.** Keep it outside the repository and report its path and size. No credentials or personal data in any frame.

## WP3b, Codex: review the Lab, then the acceptance harness

Branch `agent/codex/wp3b-acceptance`. Same ownership as before.

1. **Review 02** → `docs/orchestration/reviews/02-lab.md`. Read `lib/platform/{lab,director,viewModel,wire,world}.ts` and `components/platform/lab/**`. Same format as review 01: reproducible findings or an honest "tried X, found nothing". Look hardest at: the Lab reducer against the evidence rules (can a provider-observed record ever be written as operator-reported, or the reverse?), Director determinism (clock, locale, `Intl` formatting differences between machines, a hidden dependence on render timing), Vietnamese copy keys that are missing or untranslated, `useLabPreferences` storage, the Presenter and language toggles under keyboard, and focus handling when the phone updates.
2. **`next/acceptance/lab-browser.mjs`**, in the style of `final-competition.mjs`, against the production build: three viewports; open a SIMULATED show; play the Director to the end; a second run gives the same call-log fingerprint; **0 axe-core violations** in each state; no layout shift when the phone updates; reduced motion; SIMULATED present on every simulated surface; none of the forbidden phrases in the rendered text. Run it and attach the output. Anything you cannot run, say so.
3. After WP1b merges, re-run your property suite and tell the operator which expected failures flipped.

## Order and dates

| Step | Who | When |
|---|---|---|
| WP1b, WP2b part A, WP3b run in parallel | the three agents | now |
| Operator review and merge | operator | when two or more report |
| WP2b part B (capture) | Antigravity | after WP1b merges |
| Feature freeze | all | 2026-10-15 |
| Slide due | team | 2026-10-19 |
