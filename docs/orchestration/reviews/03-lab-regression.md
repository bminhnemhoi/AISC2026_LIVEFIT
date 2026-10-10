# WP3c: production Lab regression

2026-10-08, `agent/codex/wp3c-regression`, based on
`d462c2ba2be6c609f14757484d3d15bcecf9a7fc` (WP1c/WP2c integrated).
Only the requested P04/P05 tests and review evidence changed. Source and
`next/acceptance/lab-browser.mjs` remain unchanged. This verifies SIMULATED
Shopee only.

## Production rerun

Fresh build `rzxfdIwyFqWvaOHwVTgt9`. Node v26.10.0, Playwright 1.64.0,
axe-core 4.13.0, Chromium headless shell 153.0.8010.12. Run from `next/`:

```bash
npm run build
NODE_PATH=/tmp/noma-review/node_modules \
CHROMIUM_PATH=/home/towfienes/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell \
node acceptance/lab-browser.mjs > ../docs/orchestration/reviews/03-lab-browser-output.txt 2>&1
```

[Exact stdout/stderr, including every failed check](03-lab-browser-output.txt).
Browser command exited **1**, with this exact summary:

```text
LAB BROWSER HARNESS: FAIL; 234 passed, 123 failed; 84 axe states; 0 aborted
```

Each viewport completed two timed plays: EN/UTC/normal motion, then
VI/Asia/Ho_Chi_Minh/Presenter/reduced motion. No runtime blockers or aborted
journeys. Each pair's `two-run-fingerprint` passed: **9d723008 / 9d723008**
at 1920×1080, 1280×720 and 390×844. All simulation-label and honesty-overflow
checks passed. All three reduced-motion runs recorded only `auto` wire scrolls
and no active CSS motion. Stored show preservation and runtime-error checks
also passed. Axe found violations in **51/84** scans; zero violations is not met.

## Exact checks returned to owners

The following names apply at **all three viewports**, both runs unless qualified.
They partition all 123 failed checks (51 axe, 66 geometry, 6 focus).

| Owner | Exact check names | Observed result / next owner action |
| --- | --- | --- |
| WP2c | `state3-axe` | `scrollable-region-focusable`: synthetic-comments `role="log"` region has `tabindex="-1"`, no focusable content and scrolls. Make it reachable by keyboard. |
| WP2c | `state4-axe`, `state5-axe`, `state6-axe`, `state7-axe`, `state8-axe`, `state9-axe`, `state10-axe` | `heading-order` on pinned-product `<h4>` plus the same `scrollable-region-focusable` failure. Repair phone semantics without suppressing axe rules. |
| WP2c | `state2-axe` **run 1 only** | `color-contrast`: scheduled countdown `in 12:00`, target `.rounded-md > .tabular-nums`, 10 px normal. Ratios 2.20 at 1920, 1.65 at 1280, against required 4.5:1. Also fails at 390. |
| WP2c | `state4-axe` **run 1 at 1920/1280 only**, additional rule | `color-contrast`: pinned initials `ZH` (1.26 / 1.78) and item ID `#100001` (1.13 / 1.35), required 4.5:1. Values are the scan's composited colors during entry animation, not proof that the final dark-token pairs fail. Owner should inspect animation legibility as well as settled contrast. Reduced-motion runs have no color-contrast violations. |
| WP2c / WP3 acceptance contract | `state2-phone-layout`, `state3-phone-layout`, `state4-phone-layout`, `state5-phone-layout`, `state6-phone-layout`, `state7-phone-layout`, `state8-phone-layout`, `state9-phone-layout`, `state10-phone-layout`, `state11-phone-layout`, `state12-phone-layout` | `host-app-bag` now names different regions across modes: idle preview, live bag-button wrapper, ended summary. Its geometry therefore cannot match the idle baseline. Agree stable region semantics with the verifier; this failure alone does not prove the outer phone jumps. Do not silently relax the test. |
| WP3 acceptance journey (WP2c focus remains unverified here) | `phone-pin-keyboard-focus` | All six fail waiting 15 seconds for `[data-testid^="host-app-pin-"]`. The unchanged harness resets, steps twice and tries to Tab to a pin without opening `host-app-bag-button`. `BagDrawer` returns null while closed. Update the real keyboard journey to open the drawer before verifying pin→enabled-Unpin focus; the current timeout is not evidence that WP2c's focus fix fails. |

Minimal reproduction for the axe/geometry failures: open the production Lab,
use Play at 2×, pause at the named Director state, run default `axe.run(document)`
or compare the four harness region boxes against state 0. Example 390 px VI
`host-app-bag` boxes: state 1 `(x=26, y=852.15625, w=338, h=174)`;
state 2 `(20, 1173.8125, 99.265625, 44)`;
state 12 `(47, 997.15625, 296, 38)`.

Separate from violations, all 84 scans retain `aria-prohibited-attr` and
`color-contrast` **incomplete** results. The former now targets phone generic
containers (`.min-w-\[200px\]`, `.shadow-xs`, `div[data-testid="viewer-pill"]`,
`.bg-\[\#13161C\]\/95`), not `wire-scroll`: return those to WP2c for semantic
review. Gradient/translucent contrast still needs manual checking; this rerun
does not certify that work. Incomplete is not counted as a violation or a pass.

## P04, P05 and L03

- **P04 ordinary test:** an unlinked host live remains ongoing when the show
  ends. No automatic mutation/command is sent. LiveLift discloses the need to
  end it in the app with a SIMULATED problem notice exactly once; repeated sync
  preserves the problem and the host live without another notice.
- **P05 ordinary test:** a genuine provider observation creates `performed`
  with its `Provider observed (SIMULATED)` attribution and no request ID, after
  a successful read, with no outbound mutation call.
- **No `it.fails` or `it.skip` remain in the platform property folder.** The
  full suite's 57 skips are existing skips elsewhere.
- **L03 confirmed fixed:** `390x844-run2` checks
  `state0-honesty-overflow` through `state12-honesty-overflow` all pass with
  `{client: 390, scroll: 390}`. VI/Presenter controls visibly wrap inside the
  390 px frame. No Director source edit was made.

## Verification and evidence housekeeping

- `npm run typecheck && npm run lint && npm test`: exit **0**; typecheck/lint
  clean; `Test Files 78 passed (78)`;
  `Tests 1248 passed | 57 skipped (1305)`.
- `npm run build`: exit **0**; `✓ Compiled successfully in 3.4s`;
  static page generation completed, **14/14 in 483ms**.
- Focused P04/P05 run: `Test Files 1 passed (1)`;
  `Tests 2 passed | 9 skipped (11)` (name filter only).
- Pre-commit security gate: `gitleaks git --staged --no-banner`: no leaks;
  `osv-scanner --lockfile=next/package-lock.json`: 331 packages, `No issues found`.

Preserved the historical round-2 markdown and exact output. Replaced the three
retained frame paths with this fresh production run, deleted `results.json`
after extracting the compact diagnostics above, and deleted the other 15 frames
in a separate housekeeping commit. Temporary private runtime files were removed
by the harness. Exactly three PNGs remain:

- [1920×1080 EN, state 6](02-lab-browser/1920x1080-run1-state6.png)
- [1280×720 VI/Presenter, state 6](02-lab-browser/1280x720-run2-state6.png)
- [390×844 VI/Presenter, state 6](02-lab-browser/390x844-run2-state6.png)

No file outside ownership changed; no source, dependency, lockfile or CI edits.
The requested rerun is complete, but the PASS target is **not achieved**.
No screenshot baseline comparison or assistive-technology audit was performed.
L05 remains unverified by this unchanged browser journey; owner fixes and an
updated drawer interaction must precede a successful acceptance rerun.
