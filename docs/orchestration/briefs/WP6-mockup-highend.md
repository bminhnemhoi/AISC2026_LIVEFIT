# WP6: LiveLift high-end clickable mockup for AISC'26 round 2

You are a senior product designer and front-end engineer. Work alone and finish in one pass. Do not ask questions: decide, and write each decision in `DESIGN.md`. Use the highest reasoning effort you have, and take the time the quality bar needs. If a front-end design skill is available, invoke it first and follow it; its advice never overrides sections 5 and 6 below.

## 0. Mission

Build a **polished, clickable web mockup** of the LiveLift live-commerce desk that a student team will show to a judging panel at UIT on **22 October 2026** (15 minutes of presentation, 5 minutes of questions), screenshot into slides due **19 October**, and reuse as the design reference when the real product is rebuilt in November. It must look like a premium product from a funded studio, feel smooth, and be effortless to read. It is a mockup: no backend, scripted sample data, but every interaction a judge might try must work.

## 1. What the contest asks (binding)

Source: `docs/competition/AISC26-THE-LE.md`. Read it fully.

- Round 2: judges see the idea, the topic, a **poster** and a **mockup of the demo product's interface**. Slides due 19/10, poster 25/10, 15 min talk + 5 min Q&A.
- Round 3: the poster is voted by the public. Round 4 (early December, 80% of the score): a demo **connected to a database**, a poster exhibition, and rebuttal questions.
- Topic: **Data Driven Business**. The six things a team does: collect data, clean data, analyse, extract insight, propose a solution, evaluate effect.

So the mockup must (a) make the product understandable in ten seconds, (b) show the six-step data journey visibly, (c) look credible as a database-backed product, and (d) never overclaim.

## 2. The product in one sentence

**LiveLift is an assistant desk for people who sell by livestream: it turns comments and cart activity into the next decision (which product to pin, when to run a flash sale), shows why, and keeps an honest record of what happened.**

Users: a small seller's live operator who sits next to the host. Today they decide from gut feeling.

Three modes exist in the team's round-1 dossier. The mockup shows them in the header as a switch:
- **Quan sát** (observe): describes what happened.
- **Đề xuất** (suggest): the hero of this mockup; the assistant ranks "show next" and flash-sale timing, with reasons, sample size and confidence. The operator decides.
- **Thí nghiệm** (experiment): a switchback experiment mode. Shown **locked** with an honest reason ("Cần phiên từ 90 phút và đủ người xem"). Do not fake it.

Pinning and unpinning are **free**: any product, any time, one tap, no schedule, no confirmation.

## 3. Screens and states to design

Language: **Vietnamese** UI copy, English only for established technical terms. Product name `LiveLift`. Primary canvas 1920×1080 (projector); also perfect at 1440×900 and 1280×720; degrade gracefully down to a 390 px phone (stacked), though the projector is the priority.

1. **Chuẩn bị** (setup). Three steps: Kết nối (one click, **SIMULATED** platform), Sản phẩm (paste CSV or use the sample pack; rows appear and each goes queued → synced; a row with missing price shows "Chưa nhập", never 0), Bắt đầu live (one primary button; no "Create live" anywhere).
2. **Live Desk** (hero). One dominant answer, a product list with one-tap Pin/Unpin, one combined chart with pin markers, a comment stream with intent chips (hỏi giá, hỏi size, chốt đơn, khác) and 2-minute counters, the assistant's suggestion with reasons, sample size and confidence, a small **SIMULATED Shopee Live host-phone preview** that mirrors the pinned product, a drawer "Về dữ liệu này" (what is simulated, assumptions), a clock control (play/pause, 15×, 60×, skip) in a calm secondary place.
3. **Tổng kết** (recap). A few big numbers, the timeline with the pinned product as background bands, a table "Gợi ý của trợ lý và bạn đã làm gì" (Nhận, Bỏ qua, Tự làm), comments by intent, and a clearly styled box **"Điều chưa biết"**.
4. **Hành trình dữ liệu** (data journey) overlay, toggled from the header: six numbered callouts laid over the Live Desk that point to where each stage happens: 1 Thu thập (comment and viewer feed), 2 Làm sạch (masked personal data, "đã che" chips), 3 Phân tích (intent counters), 4 Khai thác insight (the "why" numbers), 5 Đề xuất giải pháp (the suggestion), 6 Đánh giá hiệu quả (the recap). This is the single most important slide for the rubric.
5. **States**: empty (no products yet), loading skeletons, a platform condition banner ("Hết hạn quyền truy cập": the app says it once, stops calling, the operator continues by hand), a low-confidence suggestion, "chưa đủ tín hiệu" for flash sale, the locked experiment mode, an end-live confirmation.
6. A small, quiet status "Đã lưu" in the header that signals the final product keeps data in a database. Mark it in the design notes as design intent.

### Scripted demo story (deterministic, about 90 seconds, controlled by the presenter)

Beats the presenter steps through with `→`/`←` (or autoplays with Space):
1. Setup: connect (SIMULATED), paste CSV, rows sync one by one, the missing-price row is flagged. Press Bắt đầu live.
2. Live Desk opens with 120 viewers; first comments arrive; "hỏi giá" counter ticks up.
3. The suggestion appears with **low** confidence (4 events); more comments arrive and it becomes **medium** (12 events). Reasons: 7 ask-price comments, add-to-cart 8 vs 3 before, 24 in stock.
4. The operator taps Ghim: the product moves to the top as "ĐANG GHIM", a marker drops on the chart, the host-phone preview updates.
5. Add-to-cart rises; flash sale says "chưa đủ tín hiệu", later "Nên chạy flash sale trong 1 phút" with its reasons; the operator dismisses it.
6. A platform condition appears once ("Hết hạn quyền truy cập"), the app switches to manual and says so; it clears.
7. The operator unpins and pins another product freely; two chart markers.
8. End live → Tổng kết, with "Điều chưa biết".
9. Toggle Hành trình dữ liệu to show the six stages.

### Sample data (use exactly this; it is all fictional)

Products: Áo hoodie zip 199.000 ₫, còn 24; Quần cargo 249.000 ₫, còn 9; Áo sơ mi linen 229.000 ₫, còn 15; Túi vải tote, giá và tồn kho chưa nhập.
Comments (Vietnamese, with intent): "Mình cao 1m65 nặng 52kg lấy size nào ạ" (hỏi size); "Chốt đơn quần này, sđt ●●●●●●●●●●" (chốt đơn, đã che); "Áo hoodie giá bao nhiêu vậy shop" (hỏi giá); "Hoodie còn màu xám không ạ, giá sao" (hỏi giá); "Lên đơn giúp mình 2 cái hoodie nha" (chốt đơn); "Quần này có size L không shop" (hỏi size); "Shop live đẹp quá" (khác); and a dozen more you invent in the same style. Viewers climb from 120 to about 440; run-of-show length 30 minutes. Handles look like `viewer_8812`.

## 4. Design brief

**Taste, from the person who will judge the result:** friendly, clean, easy to use, "đẹp ngon". The previous interface was rejected as "cực kỳ rối mắt" (extremely visually noisy) because it put too many functions on screen. Therefore: at most about five focal elements visible at once, one primary action per screen, strong hierarchy, generous space.

**Art direction.** Before building, make a single **style-tiles page** with three candidate directions (for example "Calm Studio": warm light, editorial; "Control Room": deep graphite with one bright accent, like pro streaming tools; "Soft Commerce": bright, rounded, friendly). Choose the one that best serves the brief and defend the choice in `DESIGN.md` in five lines. Then build the whole mockup with **two themes selectable by one toggle**: a light theme (default, best for projectors and print) and a dark theme. All colour, type, spacing, radius and motion values are CSS custom properties.

**System.** An 8 px grid; a spacing scale 4/8/12/16/24/32/48/64; radii 10/14/20; one type family with excellent Vietnamese diacritics (Be Vietnam Pro or Inter, **self-hosted**), at most two weights per screen region, a scale like 12/13/14/16/20/28/40/56, tabular figures for every number, `vi-VN` number and time formatting. Neutral ramp with a tiny warm or cool tint (never pure black or white), **one signal colour** for LIVE and the primary action, a violet reserved for **SIMULATED**, and green/amber/red only as semantic status. Elevation: hairline borders plus at most one soft shadow level. One icon set (inline SVG, consistent stroke). Charts are hand-built SVG with direct labels instead of legends, thin gridlines, honest axes, and pin markers.

**Motion** (smooth, purposeful, never decorative): 120/200/320 ms, easing `cubic-bezier(.2,.8,.2,1)`, animate `transform` and `opacity` only. New comments slide in; numbers tick; the suggestion card enters with a soft scale and lift; list reordering uses FLIP; markers drop onto the chart; chart lines draw in; screens crossfade with an 8 px shift; buttons have a tactile press state. One subtle pulse on the LIVE dot is the only looping animation. Respect `prefers-reduced-motion` fully.

**Quality bar against "AI slop".** Forbidden: purple-to-blue gradient heroes, emoji used as icons, blur-glass cards everywhere, fake 3D, stock illustrations, lorem ipsum, everything centred, cards inside cards inside cards, more than two font families, unexplained numbers, critical information only in tooltips, icon-only buttons with no label (except universally known ones). Required: real copy, real data, consistent alignment to the grid, a deliberate empty/loading/error treatment, and details that reward a second look (kerning of big numbers, optical alignment of icons and text, correct Vietnamese tone marks at every size).

**Accessibility.** WCAG AA contrast in both themes, visible focus rings, full keyboard operation, 44 px touch targets, semantic landmarks, charts with a text alternative, `aria-live` used sparingly (suggestions and banners, not every comment).

## 5. Honesty rules (inherited from the project, enforced)

Read `AGENTS.md`. In this mockup:
- Every surface that shows simulated platform state carries **SIMULATED** (or the violet token). Write "SIMULATED Shopee Live". Never write "synced with Shopee", "connected to Shopee", "confirmed by Shopee", "đồng bộ với Shopee", "kết nối Shopee" as if real.
- Missing is not zero: unknown price or stock shows "Chưa nhập". Unknown is not failed. Planned is not actual. A recommendation is not an acceptance and not a performed action: keep those states visibly distinct. Observation is not causation: the assistant says "tín hiệu cho thấy", never "sẽ tăng doanh số" or "gây ra". Confidence comes from sample size only, no invented percentages.
- Do not invent platform facts. Do not show real people, real shops or real brands. All numbers are labelled as sample data somewhere visible ("Dữ liệu mẫu").
- Personal data in comments is always masked.

## 6. Technical constraints

- Everything lives in **`docs/competition/mockup-v2/`**. Do not touch `next/`, `src/`, `web/`, `tests/` or any other path, and import nothing from them. You may create your own `package.json` inside the folder; no dependency may be added anywhere else.
- Stack is your choice (for example Vite with TypeScript, plus a small animation helper if it earns its place). Output a **static build** in `dist/` that runs **fully offline** by `npx serve dist` or by opening `index.html`: no CDN, no remote fonts, no network call at runtime. Keep the build under 5 MB. Commit the built `dist/`.
- Presenter keys: `→`/`←` step the story, `Space` play/pause, `R` reset, `T` theme, `P` presenter mode (hides chrome and the clock control), `1`/`2`/`3` jump to Chuẩn bị / Live Desk / Tổng kết, `J` data journey overlay, `?` shows the key list.
- Performance: first paint under 1 s on a laptop, 60 fps animation, no layout shift.
- Chromium is installed for Playwright at `/opt/pw-browsers/chromium` in cloud sessions; run `npm run build` and screenshot with Playwright. Do not run `playwright install`.

## 7. Process (do not skip the loop)

1. Read: `docs/competition/AISC26-THE-LE.md`, `docs/competition/mockup/` (an earlier draft that the team judged "not enough"; learn what it lacked: it was tidy but plain), `docs/competition/FACT-SHEET.md` (for the honesty tone), `AGENTS.md`.
2. Style tiles page → pick a direction → write the token file.
3. Build the shell and the Live Desk first, then the other screens, then the states and the journey overlay, then the story controller.
4. **Look at your work.** After each build, screenshot every screen and state at 1920×1080, 1440×900 and 1280×720, in both themes. **Open the images, describe in writing what you see, list every defect** (alignment, spacing, contrast, clipped text, awkward empty areas, hierarchy), fix them, and repeat. At least three rounds. Do not claim a screen is good without having looked at it.
5. Score yourself 1 to 5 on: first-glance clarity, hierarchy, spacing rhythm, typography, colour and contrast, motion quality, honesty of labels, state coverage, story flow, polish. Do not stop until every score is 4 or more, then say what would take it to 5.
6. Verification: axe-core with zero violations on every screen in both themes; no console errors; the whole story plays with the network blocked; the story is operable by keyboard alone; reduced-motion run is calm and complete.

## 8. Deliverables

In `docs/competition/mockup-v2/`: `app/` (source), `dist/` (build), `screens/` (PNG at 2560×1440 for each key state in both themes, with names like `02-live-desk-suggestion-light.png`), `DESIGN.md` (direction chosen and why, tokens, motion rules, accessibility checks, what is design intent versus real), `PRESENTER.md` (in Vietnamese: how to run it, the key list, a 90-second story with exactly what to say beat by beat, and a plan B if the laptop fails), `REPORT.md`.

## 9. Branch, commits, report

```bash
git worktree add ../livelift-wp6 -b agent/claude/wp6-mockup origin/claude/youthful-galileo-92o0nz
```

Commit small with imperative subjects. Push only `agent/claude/wp6-mockup`. Never push to `main` or another branch, never force-push, never merge. End with the report format from `AGENTS.md`: branch and last SHA; files changed; the verification results with their summary lines; what you could not finish or are unsure about; and the screenshots of every key state. State plainly anything you could not check.
