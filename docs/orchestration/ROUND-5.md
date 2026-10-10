# Round 5: the phone must stay inside its frame

**Date 2026-10-08.** The final production run (`reviews/05-lab-final.md`, tree `9d7c275`) reads
`LAB BROWSER HARNESS: FAIL; 337 passed, 20 failed; 84 axe states; 0 aborted`.

Everything else passes: **0 axe violations in 84 of 84 scans**, keyboard focus 6 of 6, the phone frame, its zone and the viewer row move **0 px** across states, the Director fingerprint is identical (`9d723008`) across all six runs, and every SIMULATED-label, forbidden-phrase, overflow, reduced-motion and source-preservation check passes.

All 20 failures are one defect: `Bag trigger lies outside the phone frame`.

| Viewport | Language / run | Frame (x, y, w, h) | How far the trigger sits below the frame |
|---|---|---|---|
| 1280×720 | EN (run 1), states 3 to 10 | `(988, 290.5, 280, 417.5)` | 82.5 to 263.9 px |
| 1280×720 | VI, Presenter (run 2), states 3 to 10 | `(988, 325.47, 280, 382.53)` | 117.5 to 298.8 px |
| 390×844 | EN and VI, states 7 and 8 | `(8, 509.5, 374, 658.3125)` | 0.1875 px |

Cause: at 1280×720 the phone zone is short (a 280 × 417 px frame). The phone's inner content (video area, pinned card, promotion banner, comments) is taller than the frame, so the bag trigger, the bottom row, is pushed out past the frame's edge. At 390 px the 0.1875 px overrun is a sub-pixel rounding of the frame's fractional height against a 44 px trigger.

## WP5, Antigravity: `agent/antigravity/wp2e-contain`

Files: `next/src/components/platform/host-app/**` and its tests only. Keep every test id in the round-4 "Contract" list.

1. Make the phone's inner layout a column inside the fixed frame: the video, pinned card, promotion banner and comments share the space above a **footer row that never leaves the frame** (bag trigger, ON AIR). The comment stream and video area are the parts that shrink (`min-h-0`, `flex-1`, internal scroll), not the footer.
2. **Do not change the frame's outer size or the zone's size.** The harness checks they move 0 px between states, and that must stay 0.
3. Every interactive element (bag trigger, End, pin, Unpin, the drawer's controls) must lie fully inside the frame in states 3 to 10 at 1280×720 in English and in Vietnamese with Presenter mode, and at 390×844 for states 7 and 8, with no sub-pixel overrun. Use whole-pixel sizes or flexible rows so a 44 px control cannot exceed a fractional frame by 0.19 px.
4. The bag drawer must still open inside the phone and keep focus behaviour from round 3 (L05). Keep SIMULATED legible at every size. No axe rule may be suppressed, and the axe result must stay at 0 violations.
5. Verify yourself, with your own browser, at 1280×720 (EN, and VI with Presenter) stepping the Director to states 3 to 10, and at 390×844 for states 7 and 8: print the frame box and every interactive element's box and show the containment arithmetic in your report.

Run typecheck, lint, tests, build. Push the branch, do not merge, report in the AGENTS.md format.

## Then

The operator merges and tells Codex to re-run the harness once. A PASS ends the code work; media capture and the slide follow.
