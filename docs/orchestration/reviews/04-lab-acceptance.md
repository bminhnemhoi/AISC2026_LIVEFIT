# WP3d: acceptance harness contracts, before WP2d merge

2026-10-08, branch `agent/codex/wp3d-acceptance`, from integration
`7ed2df4a1380092118a48efdf1572f5ba8b5e333`. Harness change committed as
`4ac2352`; the production run started before that commit and records the base
SHA. Product source remained the integration baseline throughout.

## Changes

Geometry now compares `host-app` and `lab-phone-zone` against state 1,
and the live viewer **row**, when present, against its first appearance in
that viewport/language journey. All four dimensions must stay within 1 px.
The viewer row is the parent of the `host-app-viewers` wrapper containing
`viewer-pill`; the pill's count-dependent width is not the row's width.
Every present `host-app-bag-button` must have positive dimensions and lie
inside the outer frame. A missing bag trigger in live mode fails.

The keyboard journey Tabs to `host-app-bag-button`, opens it with Enter,
Tabs to a pin and presses Enter. Focus must remain on an enabled control
inside the phone, not merely an arbitrary element inside it.

Expanded the existing dependency-free self-check for the 1 px boundary,
each geometry dimension, bag containment and zero-size triggers. Verified
byte-for-byte that simulation labels, forbidden phrases, the default axe scan,
fingerprints, reduced motion, stored-show preservation and runtime-error
assertion blocks are unchanged. No rule suppression or source edit.

## Fresh production run

Build `HWlkKphAfrpcYulCEpepw`; Node v26.10.0, Playwright 1.64.0,
axe-core 4.13.0, Chromium headless shell 153.0.8010.12.
From `next/`:

```bash
npm run build
NODE_PATH=/tmp/noma-review/node_modules \
CHROMIUM_PATH=/home/towfienes/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell \
node acceptance/lab-browser.mjs > ../docs/orchestration/reviews/04-lab-browser-output.txt 2>&1
```

[Exact stdout/stderr](04-lab-browser-output.txt), exit **1**:

```text
LAB BROWSER HARNESS: FAIL; 286 passed, 71 failed; 84 axe states; 0 aborted
```

Six timed journeys completed at 1920×1080, 1280×720 and 390×844, EN/UTC
then VI/Presenter/Asia/Ho_Chi_Minh/reduced motion. All six fingerprints remain
**9d723008**. Every stable-region measurement had **0 px maximum delta**.
All six `phone-pin-keyboard-focus` checks passed with enabled
`BUTTON[data-testid="host-app-unpin-100001"]` focused inside the phone.
Every simulation-label, honesty-overflow, reduced-motion, source-preservation
and runtime-error check passed. L03 remains fixed.

The old cross-mode bag-baseline failures and closed-drawer focus timeouts are
gone. The expectation that only axe would fail is **not met**: the new
containment assertion exposes additional phone bounds failures.

## Exact failed checks returned to WP2d

| Viewport / run | Exact check names | Result |
| --- | --- | --- |
| All three viewports, both runs | `state3-axe` | `scrollable-region-focusable` |
| All three viewports, both runs | `state4-axe`, `state5-axe`, `state6-axe`, `state7-axe`, `state8-axe`, `state9-axe`, `state10-axe` | `heading-order` and `scrollable-region-focusable` |
| All three viewports, run 1 | `state2-axe`; additionally `state4-axe` | `color-contrast` (scheduled countdown / pinned-card entry animation) |
| 1280×720, both runs | `state3-phone-layout`, `state4-phone-layout`, `state5-phone-layout`, `state6-phone-layout`, `state7-phone-layout`, `state8-phone-layout`, `state9-phone-layout`, `state10-phone-layout` | `Bag trigger lies outside the phone frame` |
| 390×844, both runs | `state7-phone-layout`, `state8-phone-layout` | Same containment assertion; **0.1875 px** below the outer boundary |

These cover **51 axe + 20 containment = 71 failures**. The 1280 failures
are substantial; the four 390 failures are subpixel boundary overruns under
the strict containment assertion. They are not stable-frame movement.

Minimal reproduction: open the production Lab at 1280×720, select VI and
Presenter, Step six times, and compare `host-app-bag-button` with `host-app`:
frame `(x=988, y=325.46875, w=280, h=382.53125)`, bottom **708**;
trigger `(x=1008, y=884.84375, w=99.265625, h=44)`, bottom **928.84375**.
The trigger is below the frame by **220.84375 px**. At EN state 6 the
frame also ends at 708, while the trigger ends at 893.875.
At 390×844 VI state 7, frame bottom is **1239.8125**, trigger bottom **1240**.
These are document coordinates measured together; page scroll is included.
WP2d owns the phone; no source repair was attempted here.

All 84 scans still have `aria-prohibited-attr` and `color-contrast`
**incomplete** results. These are recorded separately from violations;
they do not certify accessibility. WP2d's semantic and manual contrast work
remains pending.

## Verification and retained evidence

- `npm run typecheck`: exit 0, `tsc --noEmit`, no diagnostics.
- `npm run lint`: exit 0, `eslint .`, no diagnostics.
- `npm test`: exit 0; `Test Files 78 passed (78)`;
  `Tests 1248 passed | 57 skipped (1305)`.
- `npm run build`: exit 0; `✓ Compiled successfully in 2.2s`;
  `✓ Generating static pages using 15 workers (14/14) in 560ms`.
- `node --check acceptance/lab-browser.mjs`: exit 0.
- `node acceptance/lab-browser.mjs --self-test`: `LAB HARNESS SELF-CHECK: PASS`.
- Pre-commit `gitleaks git --staged --no-banner`: no leaks.
  `osv-scanner --lockfile=next/package-lock.json`: 331 packages, `No issues found`.

Retained three fresh frames in `04-lab-browser/`:

- [1920×1080 EN, state 6](04-lab-browser/1920x1080-run1-state6.png)
- [1280×720 VI/Presenter, state 6](04-lab-browser/1280x720-run2-state6.png)
- [390×844 VI/Presenter, state 6](04-lab-browser/390x844-run2-state6.png)

The harness's transient `results.json` and other 15 frames were removed after
extracting the compact diagnostics. Historical round-2/3 output, markdown and
three retained frames were preserved. Private runtime files were cleaned up.
Only `next/acceptance/lab-browser.mjs` and reviews files changed; nothing
outside ownership, no dependencies, source, existing tests, lockfiles or CI.

Stopping after commit/push. Waiting for the operator's WP2d merge notification;
the authorized post-merge rerun will happen **once**, against another fresh build.
No screenshot-baseline or assistive-technology audit was performed.
Acceptance is **DO NOT SHIP** pending axe and containment fixes; no PASS claim.
