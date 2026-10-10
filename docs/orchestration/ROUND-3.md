# Round 3: close the gaps found at integration

**Date 2026-10-08.** Rounds 1 and 2 are merged into `claude/youthful-galileo-92o0nz`.

Integration found two drifts between agents, not logic faults, and the operator fixed them in one line each:
`lab.page.test.tsx` looked for the test id `host-app-phone`, which WP2b renamed to `host-app`; and Codex's `lab.property.test.tsx` imported `ledgerDigest`, which WP1b replaced with `callLogDigest(ledger, readsOf(world))`.
**Rule from now on:** a `data-testid` or an exported function that another agent's test uses is a contract. Do not rename or remove one without keeping the old name working and saying so in your report.

Read `AGENTS.md`. Branch from the updated integration branch. Keep this round small: do the listed items and stop. Same report format.

## Open items

| Id | What | Owner |
|---|---|---|
| L01 | The Lab trusts the text of an operator's reason: a typed `Provider observed (SIMULATED)` or accepted-request prefix is labelled as provider evidence. Derive trusted attribution from the bridge's own trace; a show report with no bridge trace is operator-reported. | WP1c |
| L02 | The Director bar and the Assumptions strip carry no SIMULATED label of their own. Add a persistent one inside each, independent of captions and language. | WP1c |
| L06 | In Vietnamese mode the notice detail "Host pinned Cargo Pants on the platform" stays English. Build LiveLift-generated notice sentences from typed data through `labCopy` (keep product names and raw provider errors as they are, marked as original). | WP1c |
| Axe, incomplete | `aria-prohibited-attr` on the wire's scrollable container, in every scan. Give it a role and an accessible name that allow it, or restructure; do not suppress the rule. | WP1c |
| L03 | Vietnamese Director controls overflowed 390 px (398 px document). WP1b says it fixed this; **confirm**, do not redo. | WP3c |
| L05 | After pinning from the phone with the keyboard, no enabled phone control keeps focus. Keep focus usable: move it to the enabled Unpin control, or keep the pinned control focusable with honest state. Unrelated phone updates must not move focus. | WP2c |
| Axe, incomplete | Gradient contrast in the phone cannot be judged automatically. Check by hand against the dark tokens, fix any text that fails AA, report the pairs you checked. | WP2c |
| P04, P05 tests | Both `it.fails` encode the old contract (P04: an unlinked host live cannot be ended automatically, so the honest behaviour is *disclose*; P05: observation carries no request id). Restate them as ordinary tests of the new contract. | WP3c |
| Housekeeping | `docs/orchestration/reviews/02-lab-browser/results.json` (16,000 lines) and 18 frames are too heavy for the tree. Keep the markdown, the output text and 3 frames; delete the rest in a new commit. | WP3c |

## WP1c, Claude Code (Sonnet-class, medium effort is enough)

Branch `agent/claude-code/wp1c-honesty`. Files as before. Items L01, L02, L06 and the wire `aria-prohibited-attr`.
When an item is fixed, change only its own `it.fails` to `it` in `property/lab.property.test.tsx` (same exception as round 2). Add tests for anything not already covered.
Do **not** touch `host-app/**`.

## WP2c, Antigravity (fast tier)

Branch `agent/antigravity/wp2c-focus`. Files as before. Items L05 and the gradient-contrast check. Keep every existing `data-testid` working (see the rule above).
Then stop. **Do not start the media capture yet**; the operator will say when.

## WP3c, Codex (balanced tier, medium effort)

Branch `agent/codex/wp3c-regression`. Files as before. Wait until the operator says WP1c and WP2c are merged, then:
re-run `next/acceptance/lab-browser.mjs` against the new production build and attach the output; restate P04 and P05; confirm L03; do the housekeeping; report which expected failures remain and why.
The target is `LAB BROWSER HARNESS: PASS`. Anything still failing goes back to its owner with the exact check name.

## Order

1. WP1c and WP2c run in parallel. 2. Operator merges both and runs the gates. 3. WP3c re-runs the acceptance. 4. If it passes, WP2 captures the media (Part B of round 2). 5. Freeze 2026-10-15.
