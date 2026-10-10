# WP6 report: LiveLift high-end clickable mockup

Branch `agent/claude/wp6-mockup`. Everything is inside `docs/competition/mockup-v2/`; no other path was touched.

## What was built

- **`dist/index.html`**: one self-contained page (about 320 KB) with the script, styles and Be Vietnam Pro (Latin and Vietnamese subsets, weights 400/500/600) inlined. It runs from disk (`file://`) or `npx serve dist`, fully offline. A Content-Security-Policy with `connect-src 'none'` makes "no network call" enforceable. `dist/style-tiles.html` holds the three candidate directions.
- **Screens:**
  - Chuẩn bị: three steps, an empty state, skeleton rows, rows going queued → syncing → on SIMULATED, and "Chưa nhập".
  - Live Desk: answer, products with one-tap pin and unpin, combined chart with pin markers and a no-data gap, comments with intent counters, masking, and the SIMULATED host-phone preview.
  - Tổng kết: big numbers including "Đơn hàng: Chưa biết", a timeline with pinned-product bands, the Nhận / Bỏ qua / Tự làm table, intents, and "Điều chưa biết".
  - Hành trình dữ liệu overlay: six numbered spotlights and callouts, with a legend that is also the text alternative.
- **States:**
  - Empty, loading, platform condition ("Hết hạn quyền truy cập": said once, calls stop, "Ghi tay"), low confidence, "chưa đủ tín hiệu" for flash sale, flash ready / running / dismissed.
  - Locked experiment mode, end-live confirmation, Quan sát mode, "Về dữ liệu này" drawer, key list.
  - The design-intent "Đã lưu" status in the header.
- **Story:** 16 deterministic beats (about 95 s on autoplay). `→`/`←` step (`←` rebuilds the previous beat from scratch); Space autoplays; R, T, P, 1/2/3, J and ? as briefed. Every beat is made of ordinary user actions, so clicking and storytelling produce the same state.
- **Assistant:** real rules in `app/src/engine.ts` over scripted data. It uses a 2-minute window and confidence from sample size only. The decision log follows the rule that a suggestion must be on screen 5 s before an action counts as "Nhận". `npm run check:story` proves the brief's numbers (4 → low; 12, 7 ask-price, add-to-cart 8 vs 3, stock 24 → medium) without a browser.
- **Docs:** `DESIGN.md` covers the direction, tokens, motion, honesty mapping, accessibility, design intent versus real, decisions and scores. `PRESENTER.md` (Vietnamese) covers how to run it, the keys, the 90-second script and plan B.

## Verification (run on the final build)

```
npm run typecheck                    -> clean (tsc, strict, noUnused*)
npm run check:story                  -> all story checks passed
npm run build                        -> dist/index.html 319 KB, dist/style-tiles.html 196 KB
npm run verify                       -> 16/16 checks passed
  axe-core, 18 states x 2 themes x 2 viewports (1920x1080, 1280x720), zero violations
  story plays end to end with ArrowRight only (16 beats, every checkpoint text seen)
  ArrowLeft rebuilds the previous beat
  network blocked: no request left the page (0 external requests)
  no console errors or warnings during the story
  Tab reaches the suggestion, focus ring visible, Enter pins
  keys J, Esc, ?, T, P, 1, 3, R, Space all work
  reduced motion: story completes; no looping or timed animation left
  390 px phone: no horizontal page scroll on any screen
  first contentful paint under 1 s (about 140 ms); CLS on load 0.0001
  dist under 5 MB (515 KB); no forbidden wording; no external src/href
npm run shots                        -> 37 PNG in screens/ (18 states x 2 themes at 2560x1440, plus style tiles)
```

Chromium used: `/usr/bin/chromium` (the cloud path `/opt/pw-browsers` is detected automatically when present). Playwright was not installed globally; `playwright-core` and `axe-core` are dev dependencies of this folder only.

## Review loop

Four screenshot rounds at 1920×1080, 1440×900 and 1280×720, in both themes; each round's defects were fixed before the next. Main fixes:

- **Round 1:**
  - The tote's missing-value meta wrapped badly.
  - The suggestion chip was not dashed.
  - The chart's band titles collided with the axis.
  - Stray flex gaps broke the flash-sale sentence.
  - "Điều chưa biết" was below the fold.
  - Journey callouts covered other targets, and the journey ran on the weak end-of-show state.
- **Round 2:**
  - Journey placement fell back to covering the intents target, fixed by clamping candidates into view.
  - The product column was too narrow at 1440 ("ĐANG GHIM" wrapped).
  - Intent labels were cut.
  - The chart was squeezed at 900 and 720 px heights.
  - Hidden dock labels had no accessible name.
- **Round 3:**
  - Solid product buttons were visually heavy, so they became outline buttons.
  - A chart pill overflowed the panel.
  - Verification found the "đã che" chip under 4.5:1 contrast, a scroll region that was not focusable, a `<p>` inside a `<dl>`, arrow keys blocked by the end-live dialog, and overflow at 390 px.
- **Round 4:**
  - Pinned-product bands used violet (reserved for SIMULATED), so they became neutral.
  - The loading chart skeleton did not fill its panel.
  - Observe mode said "độ tin cậy" for a description.
  - The beat-4 viewer count was not exactly 120.
  - Pasting a custom CSV now shows an honest note.

Self-scores (1–5): clarity 4, hierarchy 4, spacing 4, typography 4, colour and contrast 4, motion 4, honesty 5, states 4, story 4, polish 4. `DESIGN.md` §9 says what each needs to reach 5.

## Review round 2 (09/10): what changed

1. **The data journey no longer covers anything.**
   - **Panel:** the six stages are one ordered panel in its own layout column, and the desk reflows beside it (container queries on the stage).
   - **Each stage:** number, name, one sentence, and "Ở đâu:" naming its element.
   - **Badges:** six numbered badges sit inside the real elements, in the layout.
   - **Ring:** the page dims slightly; hovering, focusing or stepping a stage (`→` / `↓`) rings its element in red.
   - Screens: `04-data-journey-*` and `04-data-journey-stage-4-*`.
2. **Presenter mode is slide-ready.**
   - **Type:** it raises the type scale (no text under 14 px, running text at least 16 px, at 1920×1080), and `verify.mjs` checks this.
   - **Chrome:** it hides the bottom bar and "Đã lưu", and keeps "Dữ liệu mẫu" in the header.
   - **Exports:** a second set of 38 PNGs at 2560×1440 is in `screens/presenter/` (`npm run shots:presenter`).
3. **Polish:**
   - The Live Desk chart's axis fits the elapsed time.
   - The host phone shows a drawn studio frame, readable chat lines and a full pinned-product card.
   - The "Trợ lý gợi ý, chưa ghim" tag has its own line.
4. **Screenshot loop:** three more rounds at 1920×1080, 1440×900 and 1280×720.
   - At 1440 with the panel open, the desk fell to two columns and the comment badges went off-screen. It now keeps three narrow columns down to a 940 px desk.
   - The dock overlapped itself beside the panel; it now spans the full width.
   - Panel stages were clipped at 900 px height; the panel now compacts on short screens.
   - A viewport rule broke product rows at 1280.
   - Stage sentences broke awkwardly, and a stray ring-light shape appeared in the phone frame.

Final verification for round 2 (same build as the committed `dist/` and both screen sets):

```
npm run typecheck    -> clean
npm run check:story  -> all story checks passed
npm run build        -> dist/index.html 323 KB, dist/style-tiles.html 196 KB
npm run verify       -> 19/19 checks passed
  axe-core, 19 states x 2 themes x 2 viewports, zero violations
  story end to end with ArrowRight only, network blocked (0 external requests), no console errors
  journey: panel beside the desk (no overlap), six badges in place, → / ↓ step stages with a ring
  presenter mode: no text under 14 px, body text at least 16 px (phone mock excluded)
  reduced motion: story completes, no looping or timed animation left
  390 px: no horizontal scroll; first paint 116 ms; CLS 0.0001; dist 519 KB
npm run shots            -> 39 PNG in screens/
npm run shots:presenter  -> 38 PNG in screens/presenter/
```

## Review round 3 (09/10): re-skin to "Calm Studio with tape pin"

The base branch `claude/youthful-galileo-92o0nz` (team's style reference in `docs/competition/mockup-vibe/`) was merged into this branch with a normal merge; no history was rewritten. Only the art direction changed; everything else was re-verified.

- **Look:** warm cream ground, brown ink, a brick-red CTA, square corners, an ink rule between regions and a light rule between rows, 300-weight titles and numerals (56 px at 1920), and tracked caps region labels.
- **Signature:**
  - The pinned product is a −0.8° paper card with kraft tape.
  - SIMULATED is a −1.5° violet outline stamp.
  - The host phone is +1.2°.
  - Nothing else tilts; the tilts use the CSS `rotate` property, so the FLIP list animation can't cancel them.
- **No data is hatched, never zero:** chart gaps, the "Đơn hàng: Chưa biết" KPI, and the loading skeletons.
- **Host phone:** it grows into the space under the product list (the empty gap is gone). It shows a drawn warm studio frame, two chat lines on a dark scrim, and the pinned-product card.
- **Dark theme:** warm brown-ink ground, cream text, the same brick accent.
- **Fonts:** Be Vietnam Pro 300/400/500/600 is inlined with its Vietnamese subset. The new render test is in `verify.mjs`, and `screens/00-font-render-test.png` shows "Nên ghim tiếp: Quần cargo, ếệạữ ởầ" at 300/400/500. I opened it, and every tone mark is correct.
- **Screenshot loop:** three rounds at 1920×1080, 1440×900 and 1280×720 in both themes. Fixed along the way:
  - The phone text was too small (now about 13 px).
  - Two stacked caps labels sat over the comment counters.
  - "Chuẩn bị buổi live" broke onto two lines.
  - At 1280 the mode tabs wrapped and the product rows were cramped.
  - The font test captured empty space.
- **Style tiles:** updated to record that the team chose Calm Studio.

Final verification for round 3 (same build as the committed `dist/` and all screens):

```
npm run typecheck    -> clean
npm run check:story  -> all story checks passed
npm run build        -> dist/index.html 384 KB, dist/style-tiles.html 259 KB
npm run verify       -> 20/20 checks passed
  axe-core, 19 states x 2 themes x 2 viewports, zero violations
  story end to end with ArrowRight only, network blocked (0 external requests), no console errors
  keyboard: Tab + Enter pins; J, Esc, ?, T, P, 1, 3, R, Space
  journey: panel beside the desk, six badges, stepping rings
  presenter mode: no text under 14 px, body text at least 16 px
  Vietnamese render test at 300/400/500: fonts.check true, 9 faces loaded, no fallback
  reduced motion: story completes, no looping or timed animation left
  390 px: no horizontal scroll; first paint 80 ms; CLS 0.0002; dist 643 KB
npm run shots            -> 39 PNG in screens/
npm run shots:presenter  -> 38 PNG in screens/presenter/ (2560x1440)
```

## Not done, or unsure

- **Not checked on real hardware:** the UIT projector, a low-end laptop at 60 fps (only first paint and CLS were measured headless), Safari and Firefox (only Chromium was run).
- **The 390 px layout** is "graceful", not polished to projector standard; axe was not run at 390 px.
- **The journey at 1280×720** works (all badges on screen), but the desk is dense there and the chart is small. It is designed for 1920×1080 first.
- **Weight-300 text** (the team's choice) has not been seen on the UIT projector. Presenter mode raises sizes, but light weights on cream are the main legibility risk.
- **The host phone at 1280×720** has no room for the drawn frame, so it shows the compact strip (LIVE, viewers, pinned card) instead. The full frame shows at 1440×900 and 1920×1080.
- **The presenter type check** treats prices, ticks, chips and badges as labels (14 px minimum) and sentences as body text (16 px minimum). The drawn phone screen is excluded: its text is about 13 px at 1920.
- **CSV parsing** is not implemented: import always loads the sample pack, and the screen says so.
- **"Đã lưu"** is design intent only (stated in the UI drawer and in `DESIGN.md`). There is no database.
- **The flash-sale and switch thresholds** (10 add-to-cart, stock 10, margin 4, 3-minute cooldown) are my design choices, not platform facts. They are listed in "Về dữ liệu này".
- **Shopee's actual behaviour:** the mockup asserts none. Pin semantics (one pinned product at a time) are a LiveLift design assumption, and the platform condition is shown only as something the SIMULATED platform reports.
