# WP3f: final production Lab acceptance — PASS

2026-10-08, branch `agent/codex/wp3f-pass`, from integration
`65e08b5f743f0d1a8b5049c53ccabe750a18c03c` containing WP2e's containment
fix. Source and harness remain unchanged. This tests SIMULATED Shopee only.

## Exact result

```text
LAB BROWSER HARNESS: PASS; 357 passed, 0 failed; 84 axe states; 0 aborted
```

**PASS.** The unchanged harness ran **once**, exited 0, and completed all six
journeys without blockers or aborts. [Exact stdout/stderr](06-lab-browser-output.txt).

| Evidence | Observed count / result |
| --- | --- |
| Checks | **357 passed, 0 failed** |
| Axe scans | **84**, zero violations |
| Completed journeys | **6/6**, two per viewport |
| Director fingerprints | **6** completed fingerprints; **3/3** pair comparisons pass |
| Stable-region checks | **72/72** pass; maximum x/y/width/height delta **0 px** |
| Bag-trigger containment | **54/54** pass, live states 2–10 in all six journeys |
| Keyboard pin focus | **6/6** pass on enabled `host-app-unpin-100001` inside the phone |

All simulation-label, forbidden-phrase/overflow, reduced-motion,
source-show-preservation and runtime-error checks pass. There are no failed
checks to return to an owner. L03 remains fixed.

Run 1 = EN / UTC / normal motion. Run 2 = VI / Presenter /
Asia/Ho_Chi_Minh / reduced motion.

| Viewport | Run 1 fingerprint | Run 2 fingerprint |
| --- | --- | --- |
| 1920×1080 | `9d723008` | `9d723008` |
| 1280×720 | `9d723008` | `9d723008` |
| 390×844 | `9d723008` | `9d723008` |

## Bag containment arithmetic

Frame = `host-app`; trigger = `host-app-bag-button`. Boxes are
`(x, y, width, height)` in CSS px, in document coordinates including page scroll.
The measured state 2 boxes below attain the minimum bottom clearance for
each viewport/run. All nine present-trigger states (2–10) were checked per
row: **36/36** containment checks at these two viewports pass.

| Viewport | Run | Frame box | Trigger box | Frame bottom − trigger bottom = clearance |
| --- | --- | --- | --- | --- |
| 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1006, 652, 95.265625, 44)` | `(290.5 + 417.5) − (652 + 44) = 708 − 696 = 12 px` |
| 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1006, 652, 95.265625, 44)` | `(325.46875 + 382.53125) − (652 + 44) = 708 − 696 = 12 px` |
| 390×844 | 1 | `(8, 509.5, 374, 658.3125)` | `(18, 1117.8125, 95.265625, 44)` | `(509.5 + 658.3125) − (1117.8125 + 44) = 1167.8125 − 1161.8125 = 6 px` |
| 390×844 | 2 | `(8, 581.5, 374, 658.3125)` | `(18, 1189.8125, 95.265625, 44)` | `(581.5 + 658.3125) − (1189.8125 + 44) = 1239.8125 − 1233.8125 = 6 px` |

All four edges are inside, with positive trigger dimensions. Minimum
clearances across all nine live states in each run:

| Viewport | Run | Left | Top | Right | Bottom |
| --- | --- | --- | --- | --- | --- |
| 1280×720 | 1 | 18 | 361.5 | 166.734375 | 12 |
| 1280×720 | 2 | 18 | 326.53125 | 166.734375 | 12 |
| 390×844 | 1 | 10 | 608.3125 | 268.734375 | 6 |
| 390×844 | 2 | 10 | 608.3125 | 268.734375 | 6 |

For example, at 1280 the horizontal bounds are
`1006 − 988 = 18` left and `(988 + 280) − (1006 + 95.265625) = 166.734375` right.
At 390 they are `18 − 8 = 10` left and
`(8 + 374) − (18 + 95.265625) = 268.734375` right.
No tolerance or rounding was added to the strict containment assertion.

## Production run and verification

Fresh build **JSeYM8wFDZXN7GeR9-UGl**; Node v26.10.0, Playwright 1.64.0,
axe-core 4.13.0, Chromium headless shell 153.0.8010.12.
Run: 2026-10-08T15:53:04.273Z–15:58:13.941Z.
From `next/`:

```bash
npm run build
NODE_PATH=/tmp/noma-review/node_modules \
CHROMIUM_PATH=/home/towfienes/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell \
node acceptance/lab-browser.mjs > ../docs/orchestration/reviews/06-lab-browser-output.txt 2>&1
```

- `npm run build`: exit 0; `✓ Compiled successfully in 4.4s`;
  `✓ Generating static pages using 15 workers (14/14) in 592ms`.
- `npm run typecheck`: exit 0; `tsc --noEmit`, no diagnostics.
- `npm run lint`: exit 0; `eslint .`, no diagnostics.
- `npm test`: exit 0; `Test Files 78 passed (78)`;
  `Tests 1248 passed | 57 skipped (1305)`.
- Pre-commit `gitleaks git --staged --no-banner`: no leaks.
  `osv-scanner --lockfile=next/package-lock.json`: 331 packages, `No issues found`.

## Retained evidence and limits

- [Exact browser output](06-lab-browser-output.txt)
- [1920×1080 EN, state 6](06-lab-browser/1920x1080-run1-state6.png)
- [1280×720 VI/Presenter, state 6](06-lab-browser/1280x720-run2-state6.png)
- [390×844 VI/Presenter, state 6](06-lab-browser/390x844-run2-state6.png)

Kept exactly three fresh frames. Removed the harness's temporary `results.json`
and other 15 frames after extracting and verifying the measurements above;
private runtime files were cleaned up. Historical reviews and artifacts remain
unchanged. Only this report, exact output and three frames are committed.
No files outside review ownership changed; no source, harness, test, dependency,
lockfile or CI edits. No merge and no additional browser run.

The requested automated acceptance gate passes. `color-contrast` remains
**incomplete in all 84 axe scans**; this is separate from zero violations.
No manual assistive-technology audit or screenshot-baseline comparison was
performed, and the result does not certify full accessibility or real Shopee.
