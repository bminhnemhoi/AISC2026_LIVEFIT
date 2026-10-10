# WP3e: final production Lab rerun

2026-10-08, branch `agent/codex/wp3e-final`, created from integration
`9d7c275a98d62aa81136f1df19ffff9df789fe2e` containing WP2d's axe fixes and
WP3d's harness changes. Read `AGENTS.md` and `ROUND-4.md`. Source and harness
remain unchanged. This tests SIMULATED Shopee only.

## Exact result

```text
LAB BROWSER HARNESS: FAIL; 337 passed, 20 failed; 84 axe states; 0 aborted
```

**FAIL, not PASS.** The harness ran **once**, exited 1, and completed all six
journeys without blockers or aborts. [Exact stdout/stderr](05-lab-browser-output.txt).
Fresh production build **PUJr3Tce9xArltWtDuP8g**. Node v26.10.0,
Playwright 1.64.0, axe-core 4.13.0, Chromium headless shell 153.0.8010.12.
Run started at 2026-10-08T14:59:55.334Z and finished at 15:05:04.708Z.

From `next/`:

```bash
npm run build
NODE_PATH=/tmp/noma-review/node_modules \
CHROMIUM_PATH=/home/towfienes/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell \
node acceptance/lab-browser.mjs > ../docs/orchestration/reviews/05-lab-browser-output.txt 2>&1
```

## Every failed check and its measurements

All **20** failures have the exact error `Bag trigger lies outside the phone frame`.
Return them to the phone owner, **WP2d**. No axe, focus or stable-region checks
failed. The layout check fails on containment after its stability assertions pass.

Each box below is `(x, y, width, height)` in CSS px, measured in document
coordinates together, including page scroll. Frame = `host-app`;
trigger = `host-app-bag-button`. Bottom excess is
`trigger.y + trigger.height - frame.y - frame.height` (positive means outside).
Run 1 = EN / UTC / normal motion; run 2 = VI / Presenter /
Asia/Ho_Chi_Minh / reduced motion. Each row is a separate failed check.

| Exact check name | Viewport | Run | Frame box | Trigger box | Bottom excess (px) |
| --- | --- | --- | --- | --- | --- |
| `state3-phone-layout` | 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1008, 746.5, 99.265625, 44)` | 82.5 |
| `state4-phone-layout` | 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1008, 849.875, 99.265625, 44)` | 185.875 |
| `state5-phone-layout` | 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1008, 849.875, 99.265625, 44)` | 185.875 |
| `state6-phone-layout` | 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1008, 849.875, 99.265625, 44)` | 185.875 |
| `state7-phone-layout` | 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1008, 927.875, 99.265625, 44)` | 263.875 |
| `state8-phone-layout` | 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1008, 927.875, 99.265625, 44)` | 263.875 |
| `state9-phone-layout` | 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1008, 849.875, 99.265625, 44)` | 185.875 |
| `state10-phone-layout` | 1280×720 | 1 | `(988, 290.5, 280, 417.5)` | `(1008, 849.875, 99.265625, 44)` | 185.875 |
| `state3-phone-layout` | 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1008, 781.46875, 99.265625, 44)` | 117.46875 |
| `state4-phone-layout` | 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1008, 884.84375, 99.265625, 44)` | 220.84375 |
| `state5-phone-layout` | 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1008, 884.84375, 99.265625, 44)` | 220.84375 |
| `state6-phone-layout` | 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1008, 884.84375, 99.265625, 44)` | 220.84375 |
| `state7-phone-layout` | 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1008, 962.84375, 99.265625, 44)` | 298.84375 |
| `state8-phone-layout` | 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1008, 962.84375, 99.265625, 44)` | 298.84375 |
| `state9-phone-layout` | 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1008, 884.84375, 99.265625, 44)` | 220.84375 |
| `state10-phone-layout` | 1280×720 | 2 | `(988, 325.46875, 280, 382.53125)` | `(1008, 884.84375, 99.265625, 44)` | 220.84375 |
| `state7-phone-layout` | 390×844 | 1 | `(8, 509.5, 374, 658.3125)` | `(20, 1124, 99.265625, 44)` | 0.1875 |
| `state8-phone-layout` | 390×844 | 1 | `(8, 509.5, 374, 658.3125)` | `(20, 1124, 99.265625, 44)` | 0.1875 |
| `state7-phone-layout` | 390×844 | 2 | `(8, 581.5, 374, 658.3125)` | `(20, 1196, 99.265625, 44)` | 0.1875 |
| `state8-phone-layout` | 390×844 | 2 | `(8, 581.5, 374, 658.3125)` | `(20, 1196, 99.265625, 44)` | 0.1875 |

The 16 failures at 1280×720 exceed the frame by **82.5–298.84375 px**.
The four 390×844 failures exceed it by **0.1875 px** under the unchanged
strict containment assertion. Neither is movement of the outer phone frame.
The 1 px stability tolerance does not apply to containment in this harness.
No assertion was relaxed, no value rounded away, and no source fix attempted.

## Passing evidence and limits

- **Axe: 84/84 scans, zero violations.** `aria-prohibited-attr` no longer
  appears in incomplete results. `color-contrast` remains **incomplete in all
  84 scans**; automated checks alone do not certify gradient/translucent contrast
  or full accessibility.
- **Stable regions:** maximum difference across x/y/width/height is **0 px**
  for `host-app`, `lab-phone-zone` and the live viewer row, within each of the
  six viewport/language journeys. No stability assertion fails in the 72
  state-layout checks; 52 pass and the 20 listed above fail on containment.
- **Keyboard focus: 6/6 pass.** After opening the drawer and pinning, focus is
  on enabled `BUTTON[data-testid="host-app-unpin-100001"]`, inside the phone
  (`inPhone=true`, `control=true`, `disabled=false`).
- **Director:** all three `two-run-fingerprint` comparisons pass,
  **9d723008 / 9d723008** at 1920×1080, 1280×720 and 390×844.
- All simulation-label, forbidden-phrase/overflow, reduced-motion,
  source-show-preservation and runtime-error checks pass. L03 remains fixed.
  The simulation never contacts Shopee or becomes real learning.

## Verification

- `npm run build`: exit 0; `✓ Compiled successfully in 3.5s`;
  `✓ Generating static pages using 15 workers (14/14) in 597ms`.
- `npm run typecheck`: final exit 0; `tsc --noEmit`, no diagnostics.
- `npm run lint`: exit 0; `eslint .`, no diagnostics.
- `npm test`: exit 0; `Test Files 78 passed (78)`;
  `Tests 1248 passed | 57 skipped (1305)`.
- The first typecheck overlapped the build's replacement of `.next/types`
  and exited 2 with TS6053 missing generated files; lint/tests did not run in
  that chain. Repeating the verification chain after the build completed gave
  the clean results above. The browser harness was **not repeated**.
- Pre-commit `gitleaks git --staged --no-banner`: no leaks.
  `osv-scanner --lockfile=next/package-lock.json`: 331 packages, `No issues found`.

## Retained artifacts and ownership

- [Exact browser output](05-lab-browser-output.txt)
- [1920×1080 EN, state 6](05-lab-browser/1920x1080-run1-state6.png)
- [1280×720 VI/Presenter, state 6](05-lab-browser/1280x720-run2-state6.png)
- [390×844 VI/Presenter, state 6](05-lab-browser/390x844-run2-state6.png)

Only this report, the exact output and three fresh frames are committed.
Historical reviews/output/frames are preserved. The harness's temporary JSON
and 15 extra frames were removed after extracting all measurements above;
its private runtime files were cleaned up. No files outside review ownership
changed; no source, harness, tests, dependency, lockfile or CI edits.

The requested single rerun is complete; the acceptance target remains blocked
by the listed containment checks. No manual assistive-technology audit or
screenshot-baseline comparison was performed. No merge or additional rerun.
