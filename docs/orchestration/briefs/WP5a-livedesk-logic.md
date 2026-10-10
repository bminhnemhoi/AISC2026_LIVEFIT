# WP5a: Live Desk logic (engine, adapter, Copilot)

You are one of two agents. The other builds the screens (WP5b) at the same time, in another worktree. Work alone, finish in one pass, do not ask questions; where this brief is silent choose the simplest option that keeps the evidence model and say so in the report.

## Read first
1. `AGENTS.md` (root) and `next/AGENTS.md` (this is not the Next.js you know, though you write little UI).
2. **The full spec: `docs/orchestration/briefs/WP5-livedesk.md`.** Sections 1 to 3 and 3.6 are binding. You build 3.2, 3.3, 3.5, the import and start flow of 3.1 as logic, and the intent and PII parts of 3.4. Skip the screens.
3. **The contract: `next/src/lib/livedesk/types.ts`, `fixtures.ts`, `hooks.ts`.** The screens are written against these. Do not change `types.ts` or `fixtures.ts`. If you truly need a change, stop and describe it in the report; the operator changes it for both agents.
4. The code you build on: `next/src/lib/platform/*`, `next/src/lib/server/ai/*`, the CSV/TSV import used by the Prepare screen. Reference only, do not copy Python: https://github.com/bminhnemhoi/AISC2026_LIVEFIT (`src/livelift/nlp/intent.py`, `labels.py`, `src/livelift/ingest/pii/`).

## What you deliver
1. `adapter.ts`: `LivePlatformAdapter` and its SIMULATED Shopee implementation over the existing platform and sync bridge. Do not fork or rewrite them. Add the shape-inferred `unpin` to the simulated platform without changing any existing call, the Director script or fingerprint **9d723008** (39 calls); update `capabilities.ts` so the unpin row says it is a guess with no Shopee page found.
2. `engine.ts`: seeded, deterministic realtime generator: pure function of (seed, second, world), so Run, Pause, speed changes and skips give the same log for the same actions. Viewers, comments (Vietnamese, with a few obviously fake phone numbers and emails), add-to-cart, purchases. The generator's response to what is showing is a documented assumption exposed through `assumptions`.
3. `intent.ts`, `pii.ts`: TypeScript port of the original's comment intents (map them to the five in the contract) and Vietnamese PII masking, with your own tests. Raw comment text never leaves the engine.
4. `copilot/`: signal aggregation, rules scorer (show next, flash-sale timing), optional AI refinement through `lib/server/ai` with extra providers by environment variable and plain `fetch`, Zod validation, fallback to rules with the right `aiStatus`. Confidence from sample size only; no invented probabilities. Suggestion lifecycle proposed → accepted or dismissed → performed only when the platform shows that product. Wording says "signals suggest", never "caused".
5. `session.ts`: the live's state, persisted in the browser under `livelift.livedesk.SIMULATED` only (never `livelift.v3.SIMULATED`), plus the start flow: connect, import CSV/TSV (reuse the existing parser; missing price stays null), sample pack, per-product sync with the platform's own error text, start live (`create_session` then `start_session`), end live.
6. `hooks.ts`: replace the stub bodies with the real implementation. The signatures stay exactly as they are. Free pin and unpin: any time, any synced product, no schedule or cooldown or confirmation; a host-side change in the simulated host app is observed through the existing sync and appears as a marker (`host_pin`, `host_unpin`).
7. Tests under `next/src/__tests__/livedesk/logic/**`: determinism across different tick batching, adapter sync and failure states, free pin/unpin right after start and repeated, host change observed, intent rules, PII mask, Copilot scoring and fallback labelling, suggestion lifecycle, the view models satisfy the contract, SIMULATED appears in every label and no forbidden phrase ("synced with Shopee", "connected to Shopee", "confirmed by Shopee") appears in any string you produce.
8. `docs/livedesk/ARCHITECTURE.md`: the adapter, the engine, the assumptions, the Copilot's inputs and limits, the unpin guess, the environment variables for AI providers.

## Ownership
Own: `next/src/lib/livedesk/**` (except `types.ts` and `fixtures.ts`), `next/src/__tests__/livedesk/logic/**`, `docs/livedesk/ARCHITECTURE.md`. Small edits allowed: `next/src/lib/platform/capabilities.ts` and `shopeeLive.ts` for the inferred unpin only, `next/src/lib/server/ai/**` for extra providers. Anything else: stop and describe it in the report. You write no screens, routes or navigation.

## Rules
The Lab, its Director script and fingerprint 9d723008 must not change. No test removed or weakened. No new dependency. No `any`. Match the surrounding style.

## Process and report
```bash
git worktree add ../livelift-wp5a -b agent/claude/wp5a-logic origin/claude/youthful-galileo-92o0nz
cd ../livelift-wp5a/next && npm ci
```
Commit small, push only `agent/claude/wp5a-logic`, never force, never merge. Verify from `next/`: `npm run typecheck && npm run lint && npm test` (baseline 78 files, 1,252 passed, 57 skipped; yours must pass with more). Report in the AGENTS.md format and say plainly what you could not verify.
