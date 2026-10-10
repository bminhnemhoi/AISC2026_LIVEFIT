# WP3b: Platform Lab adversarial review and browser acceptance

Round-3 housekeeping: this review and its exact output remain historical.
The oversized browser JSON was removed; the three linked frames now show the
fresh integrated build. Current results and compact diagnostics are in
[03-lab-regression.md](03-lab-regression.md).

Reviewed 2026-10-08 on `agent/codex/wp3b-acceptance`, created from
`origin/claude/youthful-galileo-92o0nz` at
`f3b1dd64081cf9e79179bbd100cf870385ac363c`. This audits **SIMULATED Shopee**;
it does not verify real Shopee behaviour. No source, existing tests, dependencies,
lockfiles or CI were changed.

The round-2 P01 and P05 decisions are accepted: idle sync may log reads in its
own bounded ring, and a genuine provider observation has no outbound request ID.
L01 below is a concrete instance of the separately acknowledged reason-marker
limitation, not a request to invent an ID for an observation. This baseline
still mounts `HostAppPlaceholder`; integrating the finished phone is already
assigned to WP1b. L04/L05 describe the currently mounted phone and must be
rechecked after that integration.

Six findings follow. Medium means misleading evidence, a required honesty gate
failure or an interaction/reflow problem; low means a bounded layout/copy problem.
Reproductions for L01/L02/L06 are new `it.fails` cases with reasons in their titles.
L03–L05 are strict browser assertions; the harness deliberately exits nonzero
on those defects rather than weakening the acceptance gate.

## Reproduction and sampling

From `next/`:

```bash
npx vitest run src/__tests__/platform/property/lab.property.test.tsx --reporter=verbose
node acceptance/lab-browser.mjs --self-test
npm run build
NODE_PATH=/tmp/noma-review/node_modules \
CHROMIUM_PATH=/home/towfienes/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell \
node acceptance/lab-browser.mjs
```

Playwright and axe-core are installed outside the product. The paths above are
the actual local run; another host can provide its own `NODE_PATH`,
`CHROMIUM_PATH` and optional `AXE_PATH`. No dependency was added or installed.
The harness imports the existing `final-runtime.mjs`, builds the existing ops
tooling in a disposable private copy, authenticates a synthetic operator over
local HTTPS and serves the **production `.next` build**. Providers remain
unconfigured. Temporary DB, certificate, logs and browser profiles stay under
the owned reviews folder and are deleted at completion. No credential appears
in an attached frame or output.

The new dependency-free property uses the existing xorshift32 generator, seeds
**1–2,048**, all three scenario plans, and random presentation-time increments
up to 20 seconds. It compares the complete serialized Lab state and ledger
with an ordered Director run, including all records and traces. Duplicate due
ticks, Reset and JSON round trips are also exercised.

All five L01/L02/L06 assertions were additionally run as ordinary tests by
temporarily changing only this new file's markers and restoring it byte for byte
in `finally`. Result: **5 failed | 6 skipped (11)**, exit 1, with the intended
classification/label/translation assertions rather than setup errors. The six skips are
solely the name filter. Output: [02-lab-reproductions.txt](02-lab-reproductions.txt).

The source audit used the codebase-memory graph for discovery, caller/callee
traces and source snippets, with Tier 2 coverage checks on relied-on paths.
No recorded gaps were found in the cited Lab/platform files. Coverage remains
a best-effort signal; the relevant source was read directly as well.

## L01 — Medium: operator reason text can impersonate trusted provenance

**Location:** `next/src/lib/platform/lab.ts:119`, `:175`, `:178`;
the shared classifier is `next/src/lib/platform/sync.ts:344`.

**Input:** start the Lab show, then send a typed `show` command containing an
operator `report_manual_action` whose reason starts with
`Provider observed (SIMULATED)` or `acceptedReason("synthetic-unaccepted-request")`.
There has been no platform call, accepted request or read.

**Impact:** `labRecords` labels the record `provider_observed` or
`request_accepted` solely from the operator's text. Both the ledger and trace
are empty. The normal bridge paths preserve provenance; this is the documented
marker limitation exposed at the reducer's public typed command boundary.
The current Lab has no free-text manual-report field, so this is not claimed
as an observed browser input attack.

**Minimal test:**

```ts
const started = applyLabCommand(initialLabState(createScenarioSession("buffered")),
  { kind: "show", body: { type: "start_live" } });
const reported = applyLabCommand(started, { kind: "show", body: {
  type: "report_manual_action", action: "pin_product", productId: "prod_m02",
  targetLabel: "Zip Hoodie", report: "performed",
  reason: "Provider observed (SIMULATED): operator typed this",
} });
expect(reported.world.sim.ledger).toEqual([]);
expect(reported.trace).toEqual([]);
expect(labRecords(reported.session)[0].source).toBe("operator_reported");
// receives provider_observed; an accepted prefix similarly receives request_accepted
```

**Smallest safe repair:** in the Lab, derive trusted attribution from explicit
bridge provenance/trace and default untrusted show reports to operator-reported.
For persisted domain records, a structured marker still needs separately
authorized domain ownership. Do not fabricate observation request IDs.

**Executable:** two L01 expected failures in
`next/src/__tests__/platform/property/lab.property.test.tsx`.

## L02 — Medium: Director and Assumptions lack their own SIMULATED label

**Location:** `next/src/components/platform/lab/DirectorBar.tsx:40`, `:81`;
`next/src/components/platform/lab/AssumptionsStrip.tsx:22`, `:27`.

**Sequence:** open the Lab before playback, in either language. The Director
shows controls and simulated progress without a SIMULATED badge or word. Its
later label depends on the caption; several captions omit it. The amber
Assumptions surface never has its own SIMULATED label. The top-level badge,
desk clock, wire lanes and phone do have it.

**Impact:** the explicit "SIMULATED on every simulated surface" requirement is
not met. A persistent label must survive captions, language changes and crops;
violet progress bars alone are not a simulation badge. Assumptions' caveat
about real Shopee remains useful but does not identify its simulated state.

**Minimal test:**

```tsx
render(<PlatformLab show={createScenarioSession("buffered")} />);
for (const surface of ["director", "assumptions"])
  expect(screen.getByTestId(surface).textContent).toMatch(/\bSIMULATED\b/);
// both fail, even though the ancestor header has its own badge
```

**Smallest safe repair:** add a persistent existing SIMULATED badge/word inside
each surface, independent of captions and toggles.

**Executable:** two L02 expected failures in the new property file; every
browser state's `simulation-labels` check inspects the five surfaces separately.

## L03 — Medium: Vietnamese Director controls overflow the 390 px viewport

**Location:** `next/src/components/platform/lab/DirectorBar.tsx:42`, `:44`,
`:48`, `:49`.

**Sequence:** use 390×844, switch to VI and enable Presenter. The outer controls
row wraps, but its inner group keeps Play/Pause, Step and Reset in one unbroken
row. Their Vietnamese labels, fixed Play/Pause minimum width and gaps require
more than the available width.

**Impact:** the document is **398 px wide in a 390 px viewport**; the Reset
control extends past the right edge. This persists during the Director rather
than being a loading frame. The English normal-mode journey fits.

**Minimal browser test** (after opening `/live/sim-buffered/lab`):

```js
await page.setViewportSize({ width: 390, height: 844 });
await page.getByTestId('lab-lang-vi').click();
await page.getByTestId('lab-presenter').click();
const size = await page.evaluate(() => ({
  client: document.documentElement.clientWidth,
  scroll: document.documentElement.scrollWidth,
}));
assert(size.scroll <= size.client + 1); // 398 > 391
```

**Smallest safe repair:** allow the inner control group to wrap on narrow
screens, preserving reachable controls and their touch targets. Do not reduce
the Vietnamese labels or hide Reset.

**Executable:** `state*-honesty-overflow` in `lab-browser.mjs`;
[mobile Vietnamese frame](02-lab-browser/390x844-run2-state6.png).

## L04 — Low: entering live mode shrinks the phone bag by 26.5 px

**Location:** `next/src/components/platform/lab/HostAppPlaceholder.tsx:84`,
`:86`, `:108`, `:111`, `:112`.

**Sequence:** 1280×720, VI, Presenter; compare the idle phone with Director
step 2 (live opens). Its footer switches from one Go Live button to two buttons.
Their Vietnamese text wraps in the narrow phone, increasing the footer height.
The flexible bag list gives up height although the outer phone stays fixed.

**Impact:** the bag viewport falls from **47.359375 px to 20.859375 px** and
clips a product row. The same smaller bag persists through the live states and
expands again at end. Fixed outer dimensions therefore do not satisfy the
requirement that the phone's regions retain their places as state updates.
This finding concerns the stand-in slated for replacement, not the finished
HostApp gallery.

**Minimal browser test** (after setting VI/Presenter at 1280×720):

```js
const bag = page.getByTestId('host-app-bag');
const before = await bag.boundingBox();
await page.getByTestId('director-step').click();
await page.getByTestId('director-step').click();
const after = await bag.boundingBox();
assert(Math.abs(after.height - before.height) <= 1); // differs by 26.5 px
```

**Smallest safe repair:** reserve a consistent footer height for both states
and both languages; verify the finished phone at the actual Lab width after
WP1b integration. Do not merely exclude internal phone regions from the test.

**Executable:** `state*-phone-layout`, which checks document coordinates and
dimensions of the phone zone, phone, bag and viewer row;
[1280 px Vietnamese frame](02-lab-browser/1280x720-run2-state6.png).

## L05 — Medium: pinning from the phone leaves no usable keyboard focus

**Location:** `next/src/components/platform/lab/HostAppPlaceholder.tsx:97`;
the update originates at `next/src/components/platform/lab/PlatformLab.tsx:49`.

**Sequence:** Reset, Step twice so the phone is live, Tab to its first Pin
button, then Enter. The update marks that same button disabled. Chromium either
moves the active element to BODY or retains the now-disabled button; the exact
outcome varies between journeys. Neither leaves an enabled phone control focused.

**Impact:** after a normal keyboard action, the next operation requires the
operator to find their position again. Stable item IDs alone do not handle the
currently focused control becoming unusable. This must also be rechecked in
the finished phone when integrated.

**Minimal browser test** (in the live phone state):

```js
const pin = page.locator('[data-testid^="host-app-pin-"]').first();
// tabTo presses real Tab until document.activeElement is pin
await tabTo(pin);
await page.keyboard.press('Enter');
const usable = await page.evaluate(() =>
  !!document.activeElement?.closest('[data-testid="host-app"]') &&
  !document.activeElement.matches(':disabled'));
assert(usable); // false in every viewport/language journey
```

**Smallest safe repair:** keep the activated pin control focusable with honest
state semantics, or deliberately move focus to the enabled Unpin control after
this user action. Preserve focus on unrelated phone updates.

**Executable:** `phone-pin-keyboard-focus`; exact active-element results are
attached in the browser JSON.

## L06 — Low: LiveLift-generated notice details remain English in VI mode

**Location:** `next/src/components/platform/lab/LabDesk.tsx:193`, `:194`;
the generated host-pin message is `next/src/lib/platform/sync.ts:393`;
`next/src/components/platform/lab/labCopy.ts:300` supplies only a generic headline.

**Sequence:** choose VI and Step six times. Under the Vietnamese heading that
says the host acted, the action detail still says "Host pinned Cargo Pants on
the platform" in English. The headline never translates the verb or includes
the product. Other app-generated notice details use the same unconditional
English rendering path.

**Impact:** dictionary key parity is green while the "Vietnamese toggle for
all Lab copy" requirement remains incomplete. This is a LiveLift-generated
system sentence, not a verbatim provider error, endpoint name or user-entered
product name. The source deliberately marks it `lang="en"`; that accurately
identifies its language but does not translate the action for a VI-only viewer.

**Minimal test:**

```tsx
localStorage.setItem("livelift.lab.lang", "vi");
render(<PlatformLab show={createScenarioSession("buffered")} />);
for (let step = 0; step < 6; step++)
  fireEvent.click(screen.getByTestId("director-step"));
expect(screen.getByTestId("lab-notices").textContent)
  .not.toContain("Host pinned Cargo Pants on the platform"); // fails
```

**Smallest safe repair:** format app-generated notice details from typed action
data through `labCopy`, preserving dynamic product names and the provider-source
marker. Raw provider errors and wire JSON can remain clearly marked original
evidence; do not rewrite the canonical evidence reason to translate its source.

**Executable:** L06 expected failure in the new property file. The VI Director
state 6 surface text in `results.json` also contains this exact untranslated detail.

## Areas with no defect found in the exercised cases

- **Lab evidence, normal paths:** accepted outbound pins remain `performed`
  with their actual accepted request ID and platform verification unknown;
  refused pins remain attempts. A host pin creates no show record until a
  successful read, then keeps `Provider observed (SIMULATED)` without a made-up
  mutation ID. JSON round trips preserved the two sources. L01 is the untrusted
  reason exception; P02 from review 01 remains an owner task on this baseline.
- **Director/reducer determinism:** all 2,048 sampled presentation schedules
  matched the complete ordered run. Repeated due ticks added no evidence and
  Reset replay matched. Browser runs vary locale, timezone, language, Presenter,
  reduced motion and timing; fingerprint comparison is recorded below. Clock
  deltas only select due steps; the script's show clock determines request
  parameters. No hidden wall-clock/random/Intl dependency in the call log was
  found. Different OS/ICU/browser versions were not tested.
- **View model:** examined idle/live/ended selection, missing price/viewer
  values, frozen ended time, synthetic comments, reaction ordering and fault
  banners. Currency uses an explicit `vi-VN` formatter with a fallback;
  presentation formatting does not feed platform requests. No defect found
  in the exercised normal states. This is not a claim that synthetic viewers
  or comments are real observations or that Unicode collation is identical
  across every runtime.
- **Wire/world:** inspected causal seq ordering, refusal envelopes, documented
  versus inferred labels, call JSON, FNV digest, fresh-world isolation and the
  20-notice cap. No new defect found in these exercised paths. A digest is a
  diagnostic fingerprint, not cryptographic proof. The pending P01 read ring
  and P09 immutable-ledger fixes remain relevant; this review does not claim
  those are already fixed.
- **Preferences and keyboard toggles:** valid VI/Presenter state restored on
  reload; damaged preference values fell back; read/write storage refusal left
  in-memory toggles usable. P ignored input/select/textarea, modifiers and
  repeated keys, and its listener was removed on unmount. Real Tab/Enter/Space
  operated language and Presenter controls without losing their focus.
  Play→Pause retained focus. L05 is the phone exception. IME composition and
  assistive-technology navigation were not exercised.
- **Vietnamese keys:** inspected both dictionaries, all Director captions,
  fault labels and every current notice code. Existing parity/empty-copy tests
  and the VI browser journey passed. System controls/captions have VI values;
  show/product names remain fixture content. Raw errors/reasons remain English,
  with `lang="en"` on the desk. L06 covers the app-generated notice details
  missed by dictionary-parity tests; fully translated prose is not certified.
- **Motion and source isolation:** each reduced-motion run exercised wire
  scrolling with `auto` and checked CSS durations. Lab use left the stored
  SIMULATED show byte-identical. No unexpected HTTP, JS or console error was
  found in completed browser journeys. No forbidden phrase appeared in the
  rendered text.

## Browser output and verification

The harness audits states 0–12 and an expanded request/reply in both runs at
each viewport using axe's default rules without exclusions. It **pauses only
during each asynchronous axe scan**, then
continues timed playback using the shipped 2× control. This prevents a scan
from mixing the DOM and styles of two states; no reducer, clock or application
state is injected. An earlier unpaused scan reported a contrast failure during
the first state transition; the stable scan was used for the final result.
All five surfaces are checked locally, rather than accepting the ancestor
header's badge for every region. Layout checks include inner phone regions,
not just the outer frame. Checks accumulate failures and complete the remaining
journeys rather than stopping at the first defect.

Attached artifacts:

- [Exact browser stdout/stderr](02-lab-browser-output.txt)
- Structured JSON removed in round 3; see the compact diagnostics in
  [03-lab-regression.md](03-lab-regression.md).
- [1920×1080 EN](02-lab-browser/1920x1080-run1-state6.png)
- [1280×720 VI/Presenter](02-lab-browser/1280x720-run2-state6.png)
- [390×844 VI/Presenter](02-lab-browser/390x844-run2-state6.png)

Final run: Node **v26.10.0**, Playwright **1.64.0**, axe-core **4.13.0**,
Chromium headless shell **153.0.8010.12**, production build
`5Ql_nwB_wTHEfsiemorP-`. Recorded run HEAD is `b405384`; product source remains
the `f3b1dd6` baseline (the first WP3b commit added only tooling/tests).

| Viewport | Timed plays completed | End fingerprints | Axe scans / violations |
| --- | --- | --- | --- |
| 1920×1080 | 2/2 | `483ac05b` / `483ac05b` | 28 / 0 |
| 1280×720 | 2/2 | `483ac05b` / `483ac05b` | 28 / 0 |
| 390×844 | 2/2 | `483ac05b` / `483ac05b` | 28 / 0 |

Each completed log contains **39 API calls**. All six runs left the phone
ended, preserved the stored show, completed keyboard/preference checks, and
reported no unexpected browser/network errors. Reduced-motion runs used only
`auto` wire scrolling and had no active CSS motion. Forbidden-phrase assertions
passed in all 78 initial/Director states, including the states whose separate
overflow assertion failed.
Run 1 uses EN, normal mode, UTC and normal motion. Run 2 uses VI, Presenter,
Asia/Ho_Chi_Minh and reduced motion, in a fresh browser context.

**Overall acceptance: FAIL**, exit 1, as required for an honest verifier:

```text
LAB BROWSER HARNESS: FAIL; 251 passed, 106 failed; 84 axe states; 0 aborted
```

The 106 failing checks are **78 surface-label checks (L02), 13 mobile overflow
checks (L03), 9 phone-region layout checks (L04), and 6 focus checks (L05)**.
No journey was aborted and no runtime/tool blocker remained. Axe reported
zero violations in all 84 scans, but returned incomplete checks for gradient
contrast in the phone and `aria-prohibited-attr` on the wire's focusable scroll
container in every scan. Their targets are attached; they require manual
accessibility review. Zero reported violations is not a complete accessibility
certification. Visual comparison against a baseline remains INCONCLUSIVE.

Requested verification, from `next/`:

| Command | Observed summary |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit`, exit 0, no diagnostics |
| `npm run lint` | `eslint .`, exit 0, no diagnostics |
| `npm test` | `Test Files 77 passed (77)`; `Tests 1191 passed \| 23 expected fail \| 57 skipped (1271)`; duration 47.06 s; exit 0 |
| `npm run build` | `Compiled successfully in 7.5s`; static pages `14/14`; `/live/[sessionId]/lab` present; exit 0 |
| `node --check acceptance/lab-browser.mjs` | exit 0, no diagnostics |
| `node acceptance/lab-browser.mjs --self-test` | `LAB HARNESS SELF-CHECK: PASS`, exit 0 |
| `osv-scanner --lockfile=next/package-lock.json` | `found 331 packages`; `No issues found`; exit 0 |
| `gitleaks git --staged --verbose --redact` | `no leaks found` in both commit batches; exit 0 |

Staged diff inspection found only additions in WP3's three owned paths;
`git diff --cached --check` passed after trimming an extra trailing blank line
from the reproduction log. No temporary/private runtime files are staged.

The integrated baseline's 1,185 passes and 57 skips remain; this one new test
file adds six passes and five explicit expected failures. Existing tests and
expected-failure markers were not edited.

**Pending:** WP1b integration was not merged into this reviewed baseline.
The required post-merge property rerun and accounting of expected failures that
flip therefore remain pending. The integration remote was fetched again and
still pointed to `f3b1dd6`. The original P01 strict-whole-state and P05
accepted-ID assertions encode the old contract; they cannot simply be promoted
to ordinary tests after the round-2 decisions. They need an authorized
restatement, while this review's normal bridge check already enforces the
revised P05 rule. No existing test was edited to hide that mismatch.
No source repair is attempted by WP3b. Automated
axe and measured geometry do not replace screen-reader/manual accessibility
testing; screenshot regression is **INCONCLUSIVE** without a reference baseline.
