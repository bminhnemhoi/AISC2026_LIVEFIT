# WP7: Rebuild the Live Desk screens in the Calm Studio design (stage 1, ready for 20 October)

You are a senior front-end engineer with a designer's eye. Work alone and finish in one pass; do not ask questions: decide and record each decision in `docs/livedesk/DESIGN-NOTES.md`. Use the highest reasoning effort. If a front-end design skill is available, invoke it first and follow it, but never above the honesty rules in section 5.

## 0. Mission

The product's first screens (Home, `/start`, `/desk/[liveId]`, recap) work but were rejected by the team as visually noisy and ugly. The team approved a design: the clickable mockup in `docs/competition/mockup-v2/` (look at `screens/` and `screens/presenter/` first, then read `DESIGN.md`, `PRESENTER.md`, `app/src/tokens.css`, `app/src/app.css`, `app/src/parts/*`, `app/src/screens/*`). **Rebuild the real screens in `next/` to look and feel like that mockup, driven by the real engine, not scripted data.** The new web version must run with the same one command as today and be demonstrable at the UIT round-2 presentation on 22 October (15 minutes). Stage 2 (database, official data sources, evaluation) is a separate later brief; do not start it.

## 1. Decisions already made (do not reopen)

- Replace the screens inside `next/`. Old V3 screens stay reachable under `/legacy`, untouched and passing their tests.
- **Do not change** the engine, adapter, Copilot or session code in `next/src/lib/livedesk/**` (accepted; run fingerprint `886c9499`), nor `next/src/lib/platform/**` (Lab fingerprint `9d723008`, 39 calls), nor `next/src/lib/server/ai/**`. You may add **view-model helpers and additive fields** to `next/src/lib/livedesk/types.ts`/`hooks.ts` only if a screen truly needs data the view model lacks; any such change must be additive, covered by tests, and listed in your report. If a change needs more than that, stop and describe it.
- Default interface language is **Vietnamese**, with an EN switch that persists (reuse the existing Lab preference mechanism). All copy comes from the mockup; translate any copy it lacks into natural Vietnamese and give it an English counterpart.
- Light theme is the default, plus a warm-dark theme, switchable with one control and persisted. Presenter mode (key `P`) hides chrome and enlarges type, as in the mockup.
- Design vocabulary (binding): Calm Studio, warm cream background, brown ink, brick-red CTA, square corners, hairline rules, large light-weight numerals, Be Vietnam Pro with Vietnamese subset **self-hosted** (no network font fetch; use `next/font/local` or an equivalent that works offline). The pinned product is a slightly tilted paper card held by kraft tape; SIMULATED is a rotated outline stamp. Tilt only the pinned card, the stamp and the host phone. One dominant answer per screen, one primary action.
- Tokens are **scoped** to the new screens (for example a `data-livedesk` wrapper class), so legacy screens keep their current look and the repository rule "reuse dark tokens, add none" still holds for them. Do not edit existing tokens.

## 2. What to build

1. **Shell and nav**: new top bar for the new screens (logo, mode switch Quan sát / Đề xuất / Thí nghiệm [locked, with honest reason], LIVE status, the SIMULATED stamp, "Hành trình dữ liệu" toggle, end live). Header links: Home, Bắt đầu, Live Desk, Tổng kết, Legacy. No "Create LIVE" anywhere.
2. **Home** (`/`): the product in one sentence, the four-step flow (Kết nối → Sản phẩm → Bắt đầu live → Live Desk), status and next step, and the "What is real, and what is not" panel in the new style.
3. **Start** (`/start`): the three-step flow from the mockup with the real adapter behaviour (connect, paste CSV or sample pack, per-product sync with the platform's own error text, "Chưa nhập" for missing values, Start live).
4. **Live Desk** (`/desk/[liveId]`): product list with one-tap Pin/Unpin and the taped pinned card, the dominant suggestion with reasons, sample size, confidence and source (Rules/AI) and Accept/Dismiss, one combined chart with pin markers and hatched "no data" regions, comment stream with intent chips and 2-minute counters, host-phone preview with real content, clock controls placed quietly, platform condition banner, "Về dữ liệu này" drawer with the simulation assumptions, fingerprint, End live.
5. **Recap** (new route, e.g. `/desk/[liveId]/recap`, opened by End live): numbers, timeline with pinned-product bands, table "Gợi ý của trợ lý và bạn đã làm gì" (Nhận, Bỏ qua, Tự làm), comments by intent, the "Điều chưa biết" box. Build it from the recorded live (suggestion states, pins, counters); anything the engine cannot produce is shown as "Chưa biết", never zero.
6. **Data journey overlay** (`J` key and header button): six numbered badges on the real elements plus one ordered side panel, nothing covering content, exactly as in the mockup's accepted version.
7. States: empty, loading, platform condition, low confidence, flash-sale "chưa đủ tín hiệu", locked experiment mode, end-live confirmation.
8. Keys: `J` journey, `P` presenter, `T` theme, `?` key list, `Space` run/pause, `1` `2` `3` jump between Bắt đầu / Live Desk / Tổng kết. Also keep the Run/Pause/speed/skip/Reset controls the engine already offers.
9. Responsive: perfect at 1920×1080, 1440×900, 1280×720; graceful stacked layout at 390 px wide with no horizontal scroll.

## 3. Motion and polish

120/200/320 ms, `cubic-bezier(.2,.8,.2,1)`, animate `transform` and `opacity` only: new comments slide in, numbers tick, the suggestion enters with a soft lift, the pinned card drops with its tape, chart markers drop, screens crossfade with an 8 px shift. One looping animation only (the LIVE dot). Respect `prefers-reduced-motion` fully. No layout shift, 60 fps.

## 4. Quality bar

No purple-to-blue gradients, emoji icons, glass blur, fake 3D, stock art, lorem ipsum, cards inside cards inside cards, more than one type family, unexplained numbers. Real Vietnamese copy with correct diacritics at every size. 44 px targets, visible focus rings, full keyboard operation, WCAG AA in both themes, charts with text alternatives, `aria-live` only for suggestions and banners.

**Look at your work.** After each build, screenshot every screen and state at 1920×1080, 1440×900 and 1280×720 in both themes, open the images, describe in writing what you see, list every defect, fix, repeat (at least three rounds). Compare side by side with the mockup screens and close the gaps. Do not say a screen is good without having looked at it.

## 5. Honesty rules (binding, from `AGENTS.md`)

Every surface that shows simulated platform state carries SIMULATED (stamp or violet token). Never write "synced with Shopee", "connected to Shopee", "confirmed by Shopee" or Vietnamese equivalents as if real. Missing is not zero; unknown is not failed; planned is not actual; a recommendation is not an acceptance and not a performed action; operator-reported is not provider-observed; observation is not causation (the assistant says "tín hiệu cho thấy", never "sẽ tăng doanh số" or "gây ra"); confidence comes from sample size only. Unpin is a guessed call: say so in the assumptions drawer.

## 6. Ownership and limits

Own: `next/src/components/livedesk/**`, `next/src/app/page.tsx`, `next/src/app/start/**`, `next/src/app/desk/**`, `next/src/app/legacy/**` (keep working), new styles and fonts for the new screens, `next/src/__tests__/livedesk/ui/**`, `next/acceptance/livedesk-browser.mjs`, `docs/livedesk/**`. Small additive edits allowed in `next/src/lib/livedesk/types.ts` and `hooks.ts` as in section 1, and in `next/src/components/shell/**` only if the legacy nav needs a link to the new routes. Anything else: stop and describe it.

Hard rules: the Lab and its harness (fingerprint `9d723008`) and the engine and Copilot tests must still pass unchanged; no test removed or weakened (update a Live Desk UI test only when the screen it checks legitimately changed, and say so); no new dependency (fonts are files, not packages); no `any`. Existing test ids used by `next/acceptance/livedesk-browser.mjs` (`live-desk`, `desk-run`, `desk-pause`, `desk-unpin`, `desk-end`, `desk-fingerprint`, `desk-lang-en`, `desk-lang-vi`, `desk-skip-300`, `start-flow`, `start-connect`, `start-sample`, `start-live`, `home-flow`, `legacy-links`, `livedesk-frame`, `desk-pin-<id>`, `desk-accept-<id>`) are contracts: keep them, or update the harness in the same commit and say so. The demo launcher `scripts/competition/launcher.mjs` recognises the Home by `data-testid="home-flow"` and `truth-panel`; keep both on Home.

## 7. Process, verification, report

```bash
git worktree add ../livelift-wp7 -b agent/claude/wp7-calm-ui origin/claude/youthful-galileo-92o0nz
cd ../livelift-wp7/next && npm ci
```

Commit small; push only `agent/claude/wp7-calm-ui`; never force-push, never merge. Verify from `next/`: `npm run typecheck && npm run lint && npm test && npm run build` (baseline: 87 files, 1,380 passed, 57 skipped; yours must pass with more). Extend `next/acceptance/livedesk-browser.mjs` to cover the new screens, Vietnamese default, the recap, the journey overlay, both themes, presenter mode, axe-core 4.13.0 with zero violations, no horizontal overflow, equal run fingerprints across runs; run it, and run the Platform Lab harness (`next/acceptance/lab-browser.mjs`, axe 4.13.0) and report that it still prints PASS with fingerprint `9d723008`. Also start the app with `./start-livelift-demo` from the repository root and confirm it reports PASS and opens the new Home.

Write `docs/livedesk/DESIGN-NOTES.md` (decisions, tokens, motion rules, what is intent versus real) and update `docs/livedesk/README.md` (run it, the 90-second Vietnamese demo script). Save 2560×1440 screenshots of every key state, both themes, in `docs/livedesk/screens/`. Report in the `AGENTS.md` format: branch and SHA; files changed and any outside ownership with why; every verify command with its summary line; what you could not check; the screenshots. State plainly anything you did not verify.
