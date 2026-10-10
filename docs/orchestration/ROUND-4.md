# Round 4: the last browser failures

**Date 2026-10-08.** Everything through round 3 is merged. On the merged tree: typecheck and lint clean, **1,248 tests pass, 0 expected failures**, build green.
The production browser harness still reports `FAIL; 234 passed, 123 failed` (report: `reviews/03-lab-regression.md`). Zero aborted journeys, and the Director's call-log fingerprint is identical across all six runs (`9d723008`).
All simulation-label and overflow checks pass, and L03 is confirmed fixed. The 123 failures split three ways:

| Failures | Cause | Fix |
|---|---|---|
| 51 axe | Real accessibility defects in the phone | WP2d |
| 66 geometry | The harness uses `host-app-bag` as a cross-mode baseline, but that id now names an idle preview, a live button wrapper and an ended summary | WP3d, decision below |
| 6 focus | The harness never opens the bag drawer, so the pin buttons it waits for do not exist | WP3d |

## Decisions

- **Geometry.** The requirement is that the phone does not jump when its state changes, not that the bag is the same element in every mode. The harness will therefore measure the outer phone frame (`host-app`), the phone zone (`lab-phone-zone`) and the viewer row where present, and assert they are unchanged (within 1 px) across states 1 to 12 for a given viewport and language, and that the bag trigger lies inside the frame. This tests the real requirement; it is not a relaxation.
- **Focus.** The journey opens `host-app-bag-button` first, then Tab to a pin, Enter, and expects an enabled phone control to keep focus.
- **Contract.** These test ids stay, with the same meaning: `host-app`, `host-app-simulated-badge`, `host-app-go-live`, `host-app-end`, `host-app-bag-button`, `host-app-pin-<itemId>`, `host-app-pinned`, `host-app-mode-idle|live|ended`, `viewer-pill`, `elapsed-label`.

Read `AGENTS.md`. Branch from the updated integration branch. Do only the items below, then stop. Same report format.

## WP2d, Antigravity (fast tier)

Branch `agent/antigravity/wp2d-axe`. Files: `next/src/components/platform/host-app/**` and its tests only. Do not suppress or disable any axe rule.

1. **`scrollable-region-focusable`.** The synthetic-comments `role="log"` region scrolls but cannot be reached by keyboard. Make it reachable (`tabIndex={0}`) with an accessible name that says the chat is synthetic, without stealing focus on new comments.
2. **`heading-order`.** The pinned product title is an `<h4>` out of order. Use a non-heading element, or the correct level for where the phone sits.
3. **`color-contrast`, countdown.** The scheduled-promotion countdown (`in 12:00`, 10 px) measured 2.20:1 at 1920 and 1.65:1 at 1280. Bring it to at least 4.5:1 on its real background at every width.
4. **`color-contrast`, entry animation.** Pinned initials and item id measured 1.1 to 1.8:1 during the pin transition. Animate `transform` only (no opacity fade on text), or otherwise guarantee at least 4.5:1 at every frame. Settled contrast must still pass.
5. **`aria-prohibited-attr` (incomplete).** Generic containers (`viewer-pill`, shadowed and translucent wrappers) carry `aria-*` they cannot have. Remove them or give the element a role that allows them.
6. List the gradient and translucent text pairs you checked by hand, with ratios.

Check at 1920×1080, 1280×720 and 390×844, in English and Vietnamese. Run typecheck, lint, tests, build.

## WP3d, Codex. Start now, in parallel with WP2d (quota is not a constraint; speed is).

Branch `agent/codex/wp3d-acceptance`. Files: `next/acceptance/lab-browser.mjs` and `docs/orchestration/reviews/**`.

1. Change the geometry checks and the focus journey as decided above. Keep every honesty check as it is.
2. Run against a fresh production build and attach the output. Expect the geometry and focus failures to be gone; the axe failures belong to WP2d and may remain until it merges. Commit and push, then stop and wait: the operator will tell you when WP2d is merged, and you then re-run **once** against the new build. The target is `LAB BROWSER HARNESS: PASS`. Anything still failing goes back to its owner with the exact check name.
3. If it passes, say so plainly and list the retained frames.

## Then

If the harness passes: the operator merges, and Antigravity starts the media capture (round 2, Part B). Freeze 2026-10-15; slide due 2026-10-19.
