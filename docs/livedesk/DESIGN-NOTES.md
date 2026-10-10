# Live Desk screens: design notes (WP7)

The real screens in `next/` rebuilt in the approved **Calm Studio with tape pin** look of the mockup
(`docs/competition/mockup-v2/`), driven by the real Live Desk logic (`@/lib/livedesk`), not by a script.
Key states, both themes, 2560×1440: `docs/livedesk/screens/`.

## 1. What was built

| Route | Screen | Built from |
|---|---|---|
| `/` | Home: the product in one sentence, the four steps, status, next step, “Cái gì là thật, cái gì không” | `useStartFlow`, `useCurrentLive`, `useLiveRecap` |
| `/start` | Three steps: connect, products (paste CSV/TSV or sample pack, per-product sync with the platform's own words), start live | `useStartFlow` |
| `/desk/[liveId]` | Products with one-tap Ghim/Bỏ ghim and the taped card, the one dominant answer, one combined chart, comments with intent counters, host phone, banner, drawer, End live | `useLiveDesk`, `useLiveRecap`, `useDeskSimulation` |
| `/desk/[liveId]/recap` | Numbers, timeline with pinned bands, “Gợi ý của trợ lý và bạn đã làm gì”, comments by intent, “Điều chưa biết” | `useLiveRecap` |
| `/legacy` | Index of the old V3 screens (which keep their URLs and their old look) | static |

All screens live in `next/src/components/livedesk/`; the routes are thin pages. The old WP5b `DeskFrame`,
`HostPreview` and `ProductList` were replaced.

## 2. Decisions made without asking

1. **Port the mockup's CSS, scoped.** `calm.css` is the mockup's `tokens.css` + `app.css`, rewritten by a small
   PostCSS pass so every selector starts with `.ld` (the wrapper of the new screens), plus a clearly marked
   additions section. The repository's dark tokens in `globals.css` are untouched; legacy screens never see
   `.ld` and keep their look. Tailwind's preflight is layered, so the unlayered `.ld` rules win inside the
   wrapper without `!important`.
2. **Self-hosted font.** Be Vietnam Pro 300/400/500/600, Latin, Latin-ext and Vietnamese subsets, as twelve
   woff2 files in `components/livedesk/fonts/` (OFL, licence alongside), declared with `@font-face` and
   `unicode-range` in `calm.css`. Next bundles them as same-origin static media, so the CSP's `font-src 'self'`
   holds and nothing is fetched from the network. `next/font/local` was not used because it cannot give each
   subset file its own `unicode-range`.
3. **Vietnamese by default, through the Lab's preference.** The new screens read and write the Lab's own keys
   (`livelift.lab.lang`, `livelift.lab.presenter`); only the default differs (`vi`). The theme has its own key
   (`livelift.livedesk.theme`). The first render after a full load uses the defaults so it matches the server;
   later screens start from the remembered choice, so a dark theme never flashes light between screens.
4. **The logic stays English; the screens translate word for word.** The Live Desk logic's strings (blocked
   reasons, import notes, banners, assumptions, signal labels) are pinned by its own tests, so `i18n.ts`
   translates known sentences exactly and shows anything it does not recognise as given: a model's wording, the
   platform's own error text. A translation never changes what a sentence claims. The rules' headline is a fixed
   sentence about a product, so it is written in the viewer's language (“Nên ghim tiếp: …”); an AI headline is
   shown verbatim with the line “Câu này do mô hình AI viết lại”.
5. **One answer.** The desk leads with the newest proposed *pin* suggestion; a proposed flash sale is a second,
   quieter row. Without a proposal the answer says what is true: “Bấm Chạy để bắt đầu” (clock at 00:00),
   “Giữ ghim …” (something on show) or “Chưa đủ tín hiệu để gợi ý”, with the rule's own minimum. The brick
   primary goes to the strongest action only: a low-confidence pin is an outline button.
6. **Accept is “Ghim …”.** Accepting a show_next suggestion pins the product (the logic does that), so the
   button names the effect. A suggestion is never drawn as a pin: dashed chip while proposed, the taped card only
   once the SIMULATED platform shows the product. After acceptance the answer says “Đã nhận, chờ nền tảng hiện”
   or “Đã nhận, nền tảng đã hiện (SIMULATED)”: accepted and performed stay apart.
7. **Header (simplified in WP8).** Logo (the Home link), then three steps: 1 Bắt đầu · 2 Live Desk · 3 Tổng kết;
   on the desk also the LIVE status, the SIMULATED stamp, the journey toggle and End live. Links that do not exist
   yet (no live, no recap) are shown disabled with the reason. The old screens are one quiet link at the foot of
   Home, not a header item. Below 1600 px the desk header sheds the viewer count and the journey label; below
   1440 the stamp shortens to “SIMULATED”. The stamp is never hidden. Language, theme, keys and “Về dữ liệu này”
   sit in the quiet bottom bar with the clock.
8. **Clock controls in the bottom bar**: virtual time, Chạy, Dừng, 1× 5× 15× 60×, +30 giây, +1 phút, +5 phút,
   Đặt lại. The run fingerprint sits at the left of the bar.
9. **End live asks first** (“Kết thúc buổi live lúc 06:52?”). Confirming ends the live on the SIMULATED platform
   and opens the recap once the logic reports the live ended. If the platform refuses, the desk stays and the
   banner says why.
10. **No mode switch (removed in WP8).** The first build had Quan sát / Đề xuất / Thí nghiệm in the header. The team
    judged it noise: the assistant now always suggests, and a suggestion is only ever a suggestion. The experiment
    mode does not exist in this version; the recap says so under “Điều chưa biết” (causation needs a switchback
    session, not observation).
11. **Platform condition rehearsal.** The drawer can put SIMULATED Shopee into “Hết hạn quyền truy cập”, “Giới
    hạn tần suất” or “Lỗi máy chủ” and clear it again, through an additive hook over the logic's existing
    `setPlatformFault`. LiveLift reads again after the operator's next successful call; the drawer says so.
12. **Recap built from the record.** An additive `buildRecapView` in `hooks.ts` reads the desk's own record:
    markers with product ids, suggestion states, per-minute carts, viewer samples. Matching rule: an accepted
    show_next is matched to the first operator pin of that product at or after the suggestion; every other
    operator pin or unpin is “Tự làm”; suggestions still proposed at the end are “Không phản hồi”.
13. **Mobile (390 px)**: header wraps to two lines, one column with the answer first, bottom bar wraps; no
    horizontal scroll. Graceful, not designed to projector polish.

## 3. Tokens (`calm.css`, scoped to `.ld`)

| Group | Values |
|---|---|
| Type | Be Vietnam Pro only. 12/13/14/16/20/28/40/56 px; 300 for titles and numerals, 400 text, 500 emphasis, 600 stamps. Tabular lining figures. Presenter mode raises 12→14, 13→14, 14→16, 16→18, 20→22. |
| Space | 4/8/12/16/24/32/48/64. |
| Shape | Square corners; only the host phone is rounded (26 px). |
| Light | ground `#F6F3EE`, paper `#FBF7EF`, chip `#EAE3D8`, light rule `#D8D0C4`, ink `#2A2522`, ink-2 `#5A5047`, ink-3 `#6E6359`, kraft tape `rgba(201,180,138,.8)`. |
| Warm dark | ground `#1F1A17`, paper `#2E2722`, light rule `#463C34`, ink `#F3ECE1`, ink-2 `#CDC2B3`, ink-3 `#AD9F8E`. |
| Brick (LIVE, the one primary action, bars) | `#9E3B2B` (dark `#A8432F`; as text `#EC8A72`). |
| SIMULATED | violet `#4F3D86` (dark `#C4B5FF`): the rotated outline stamp or a straight violet word. Used for nothing else. |
| Status | ok `#3D6B4F`, amber `#7F5300` (missing values, low confidence), bad = brick. |
| Tilt | pinned card −0.8°, stamp −1.5°, phone +1.2°, with the `rotate` property so motion (`transform`) never fights it. |

## 4. Motion

120/200/320 ms, `cubic-bezier(.2,.8,.2,1)`, only `transform` and `opacity` (plus colour on hover). Screens
enter with an 8 px shift; new comments slide in; numbers tick in 320 ms; the answer lifts in when its meaning
changes (keyed by suggestion, not by every tick); the pinned card drops and its tape settles a beat later; chart
markers drop; the product list reorders with FLIP. **The LIVE dot is the only loop.** Skeletons are static
hatching. `prefers-reduced-motion` removes every animation and the pulse.

## 5. Honesty, and where each rule shows

| Rule | On screen |
|---|---|
| SIMULATED | Header stamp at every width; “SIMULATED” on products, answer (“dữ liệu SIMULATED”), chart, comments, phone, banner, recap, Start table, drawer. No “synced with/connected to/confirmed by Shopee” or Vietnamese equivalents; tests and the harness scan for them in both languages. |
| Missing ≠ zero | “Chưa nhập” for price/stock; viewers “chưa rõ” before the first second; minutes with nothing pinned are hatched “Không ghim”, never 0; recap orders “Chưa biết”; add-to-carts “Chưa biết” if nothing was ever pinned. |
| Recommendation ≠ acceptance ≠ performed | Dashed “Trợ lý gợi ý, chưa ghim” → “Đã nhận, chờ nền tảng hiện” → taped card / “nền tảng đã hiện (SIMULATED)”. Recap: Nhận (with “chưa thấy trên nền tảng” or “nền tảng đã hiện”), Bỏ qua, Tự làm, Không phản hồi. |
| Operator ≠ provider observed | A host pin observed on the platform is “Người dẫn ghim …” in the chart and “Người dẫn … nền tảng ghi nhận (SIMULATED)” in the recap. |
| Observation ≠ causation | “Tín hiệu … cho thấy”; under the chart “Vạch dọc … cho biết khi nào, không chứng minh vì sao”; first “Điều chưa biết” is exactly that question. |
| Confidence from sample size only | Three-step meter + “cỡ mẫu N tín hiệu trong 2 phút”; bands (<10, 10–24, ≥25) in the drawer, checked against `confidenceFor` by a test. |
| Unpin is a guess | Drawer: only `update_show_item` copies Shopee's reference; `unpin_show_item` is LiveLift's guess; other calls are shape inferred. |
| aria-live | Only the suggestion headline (polite status) and the banner (alert). The comment stream is `aria-live="off"`. |

## 6. Design intent versus what is real

| Element | Real in this build | Intent / later |
|---|---|---|
| Platform | SIMULATED Shopee Live in the browser (WP1 Lab core) | Real platform where permitted (stage 2) |
| Viewers, comments, carts | Seeded generator; assumptions listed in the drawer | Real or SIMULATED feeds |
| Copilot | Real rules (2-minute window, sample-size confidence); AI refinement not wired here (rules only) | Model rewording with rules as fallback |
| Persistence | This browser's `localStorage` only | Database (stage 2) |
| Recap “whole live” comments | Unknown: the logic keeps five minutes of comments | Counters persisted per live |
| Orders | Unknown: the logic does not expose purchases to the screens | Platform order counts |
| Experiment mode | Locked | Switchback experiments on 90+ minute sessions |
| Host phone | Drawn preview of the view model; not a control | — |

## 7. Departures from the mockup, and why

- Five intents (the logic's Hỏi giá, Hỏi cỡ, Chốt đơn, Khen, Khác) instead of four; the counter grid wraps 3+2
  in narrow columns.
- Reasons are the logic's signals: hỏi giá, chốt đơn, thêm giỏ 2 phút qua as numerals, the rest (hỏi cỡ, tồn
  kho, lần ghim gần nhất) on one small line. The mockup's “2 phút trước” comparison exists only for flash sales.
- The answer's kicker (“dữ liệu SIMULATED”) and the header stamp stay visible on short and narrow screens,
  where the mockup hid them.
- No “Đã lưu” in the header: nothing is saved to a server in this build, so it is not claimed.
- No story dock (‹ 6/16 ›): the desk runs the real engine; the bottom bar has the real clock instead.

## 8. Review rounds

Six screenshot rounds at 1920×1080, 1440×900 and 1280×720 in both themes (and 390×844), each compared with the
mockup. Defects found and fixed: header overflow at 1920/1440/1280 (language moved to the bar, links shed by
width), bottom bar overflow at ≤1440, marker labels colliding with series titles, intent labels running
together, a doubled “bình luận” in the small signal line, a three-line Home headline, a squashed chart at
1440×900, the answer kicker hidden at 720 px height (lost its SIMULATED word), presenter-mode header overflow,
mobile header links overflowing and the stamp disappearing below 1280, a wrapping recap KPI label, and a
missing pinned-card drop. Round 6 had no overflow, no console error and no defect left that I could see.

## 9. Engine observations (not changed; outside this package)

- Suggestions are re-scored every 15 virtual seconds. While the clock is paused, a proposed flash sale can still
  name a product that is no longer pinned until the next tick.
- The logic keeps comments for five minutes and does not expose purchases, so the recap cannot give whole-live
  comment counts or orders; both are shown as unknown.

## 10. Toolkit skills used

frontend-design (implementation), ui-ux-pro-max (pre-build UX checks: focus, tab order, reduced motion, list
size), impeccable (craft floor and the rendered review rounds; its eyebrow and stripe defaults yield to the
pinned brief), karpathy-guidelines (surgical, additive changes), decision-making (recap from an additive
`hooks.ts` builder rather than parsing labels; JEV planning ran all six tasks DIRECT_PARENT), domain-modeling
(outcome vocabulary: open, no_response, accepted, performed, dismissed, self, host), systematic-debugging
(harness failures), structural/verification/security gates (gitleaks before each commit), ponytail-review
(self-review of the diff). Not applicable here: 21st-ui (would add a dependency), design-taste-frontend
(product UI with a pinned look), project-onboarding, prompt-optimizer, resolving-merge-conflicts, typesafe-ai,
agent-introspection-debugging.

## 11. Design language (owner decisions, October 2026)

The owner's choices after the A+ review, applied to every Calm screen. Follow them when a screen is added or
changed; propose departures as a mockup first, because a repaint that skipped this step was reverted.

- **Palette.** Paper `#f6f3ee`, ink `#2a2522`, brick `#9e3b2b` (LIVE and the one primary action only), kraft
  tape, the violet simulated token. No new palette (a navy repaint was rejected), no rainbow or holographic
  colour. Every colour comes from a token, and every token has a dark value.
- **Logo.** The team's mark redrawn flat (an L with a fold, a bar, a lift arrow, two live arcs; `docs/brand/logo`) beside
  the L3 wordmark: “LiveLift” in one weight (600), “Lift” in brick, its i-dot replaced by a small upward wedge.
- **Titles (T2).** One weight (500), tight tracking (-0.03em), balanced wrapping; never a light line beside a bold
  one. Exactly one phrase per page title sits on the kraft tape: `TapeTitle` in `ui.tsx` with a `*TitleMark` copy
  key (Home “nên ghim gì”, Recap “buổi live”, Legacy “Bản cũ”; Start sets “buổi live.” on its own line). Section
  titles are 500 too. Big numerals stay light: their size carries the evidence weight, not their stroke.
- **Art.** Wide-screen empty space gets a spec sheet (`art.tsx`): a bordered sheet with registration marks at the
  corners, a kicker, a tick ruler with its caption, a faint giant word, and the brand drawings placed on it. The
  drawings come from `docs/brand/assets` through `docs/brand/assets/source/build_tsx.py`, which writes `brand.tsx`
  with every palette colour as a class mapped to a theme token, so they follow the dark theme; edit the SVG or the
  script, never `brand.tsx`. Start keeps its own die-cut stickers (phone on air, shirt with a tag), which the owner preferred to the brand sheet there. Home: the suggestion spec sheet
  (`HeroSpec`) and one drawing per step. Recap: card stack, arrow, comment chips; the “Chưa biết” sticky note on the
  unknowns box. Legacy: card stack, clip, price tag. Empty and not-found states: the card stack. Rules: words only,
  never digits, except the Home example that labels itself as one; `aria-hidden`; static; hidden at narrow widths.
  The Live Desk itself has no art.
- **Evidence first (A+).** Brick only for LIVE and the primary action; a suggestion is ink dashed, never brick;
  numbers sized by how much evidence stands behind them; missing stays “Chưa biết”, never 0.
- **SIMULATED.** The word marks the mode, not decoration. The approved Start keeps its stamp and per-panel tags as
  the project rules require. The owner has floated naming SIMULATED only in the top stamp and writing “nền tảng”
  elsewhere; that copy change is not approved yet, so ask before making it.
