# Live Desk: architecture of the logic (WP5a)

Everything here is **SIMULATED**. Nothing talks to Shopee. The platform is the in-memory SIMULATED Shopee Live from
`next/src/lib/platform/`; the viewers, comments, add-to-carts and purchases come from a seeded generator. None of it is a
measurement, and none of it is ever treated as learning from real data.

The screens (WP5b) never touch any of this directly. They call `useStartFlow()` and `useLiveDesk(liveId)` from
`next/src/lib/livedesk/hooks.ts`, render the view models in `types.ts`, and send every intent back through the returned
actions.

```
screens ──► hooks.ts ──► store.ts (one state, localStorage "livelift.livedesk.SIMULATED")
                │
                ▼
           session.ts  ── start flow, the virtual clock, operator actions, view models
            │      │
            │      ├──► copilot/  signals.ts → rules.ts → lifecycle.ts      (client-safe)
            │      │              ai.ts (server only: optional model refinement)
            ▼      │
       adapter.ts ─┴──► engine.ts (readMetrics) ──► pii.ts, intent.ts
            │
            ▼
   lib/platform: shopeeLive.ts (callShopee, hostAct), sync.ts (pinFromLiveLift, pollPlatform, diffSnapshots), world.ts
```

## 1. The platform adapter (`adapter.ts`)

`LivePlatformAdapter<W>` is platform-neutral: `syncProducts`, `removeProduct`, `startLive`, `endLive`, `pin`, `unpin`,
`schedulePromotion`, `observe` (what is showing, and what the host changed) and `readMetrics`. All are pure: world in,
world out. The only implementation is `simulatedShopeeAdapter`, whose world is the existing `PlatformWorld`.

It wraps the existing simulation and sync bridge and forks neither:

| Adapter call | What it does on SIMULATED Shopee | Basis |
|---|---|---|
| `syncProducts` | Puts the product in the SIMULATED shop catalog, opens a live in its `created` state if none is waiting (`create_session`), then `add_item_list` for that one product | inferred |
| `removeProduct` | `delete_item_list` from the waiting or running live | inferred |
| `startLive` | `start_session` on the waiting live; if none is waiting, `create_session`, `add_item_list` for every synced product, then `start_session` | inferred |
| `endLive` | `end_session` | inferred |
| `pin` | `pinFromLiveLift` from `sync.ts`, which calls `update_show_item` (adding the item to the live first if needed) | **documented** (copied from Shopee's reference) |
| `unpin` | `unpin_show_item` | **guess, no Shopee page found** (see 2) |
| `schedulePromotion` | `create_promotion` (Shopee's separate flash-sale module) | inferred |
| `observe` | `pollPlatform` (three reads, kept in the read log, never the call log), then `diffSnapshots` against the last baseline | inferred / unverified |
| `readMetrics` | The seeded generator (`engine.ts`). SIMULATED Shopee serves no live metrics of its own | simulation only |

Decisions the brief left open, chosen as the simplest that keeps the evidence model:

- **Why the first sync opens a live.** `add_item_list` needs a `session_id`, so a product cannot be "added to the
  platform" before a live exists. The adapter therefore opens the live (`create_session`, status `created`, not on air)
  when the first product syncs, and Start live runs `start_session` on it. When no live is waiting (for example after
  an earlier live ended), Start live runs `create_session` then `start_session` itself.
- **The catalog.** The SIMULATED shop's catalog holds every product the operator imports, the same way the Lab's shop
  holds a show's pack (`catalogFromProducts`). The simulation has no catalog call, so this step is not a platform call
  and is not logged.
- **Sync failures** are shown in the platform's own words, `error: message`, for example `error_auth: You are not authorized`.
  Failed products are tried again on the next import or on connect.
- **Missing is not zero.** A missing price is stored as `null` on the desk and in the catalog, and shown as "Not entered".
  A missing stock is `null`, and purchases never run it down.
- **LiveLift's own changes are never reported back as observed.** Every outbound call re-reads the platform and makes
  that read the new baseline, exactly as `sync.ts` does.
- **The host's hands.** A pin or unpin the host makes in the SIMULATED host app (`session.hostAction`, which uses
  `hostAct`) is found at the next read and becomes a marker labelled `Provider observed (SIMULATED): the host pinned …`
  (`host_pin` or `host_unpin`). A new pin that replaces an old one counts as one `host_pin`.
- **Conditions.** A refusal is mapped to a condition only to pick the banner's tone. The words are always the platform's:
  `error_auth` means authorisation expired; an `error_server` saying "too many requests" means a rate limit; any other
  `error_server` is a server error. On any of these the desk stops reading, says it once in the banner, and leaves the
  operator to carry on by hand. The next operator action that succeeds resumes reading and says "SIMULATED Shopee is
  answering again." A plain refusal (`error_data`, `error_param`) is said once and does not stop reading.

## 2. The unpin guess

Shopee's reference has no page for clearing the showing item: `update_show_item` requires an `item_id`. The Live Desk
still needs an ordinary Unpin button, so the simulation answers a call that LiveLift made up:

- `unpin_show_item`, path `/api/v2/livestream/unpin_show_item`. The name and the path are placeholders. The only
  parameter is `session_id`, it needs an ongoing live, and it clears whatever is showing (an empty showcase stays empty).
- In `shopeeLive.ts` it is in `ENDPOINT_BASIS` as `inferred`, and it is the single entry of the new `GUESSED_ENDPOINTS`,
  which records that even the name is a guess. No existing call, the Director script and the Lab fingerprint
  **9d723008** are unchanged. A test pins the fingerprint.
- In `capabilities.ts` the Shopee `unpin` row stays `operator_assisted` / `not_documented`, because that is what is
  known about real Shopee. Its note now adds: the Live Desk's SIMULATED Shopee answers a guessed unpin call
  (`unpin_show_item`), "guessed, no Shopee page found", never Shopee's behaviour. Keeping the row operator-assisted keeps
  the Lab and Operate on their existing operator path (`unpinFromLiveLift` still answers `unsupported`).

## 3. The realtime generator (`engine.ts`)

`simulateSecond(seed, second, world)` is a pure function. It uses no wall clock, no `Math.random` and no memory: every
draw is FNV-1a of `(seed, second, purpose)`. `world` is the synced products (id, name, stock), the product showing as
LiveLift last read it, and how long it has been showing.

`session.advance` plays the virtual seconds one at a time, in order. Operator actions happen at the current second.
Run at any speed, Pause, Skip (+30 s, +1 min, +5 min) and any tick batching therefore give the same log and the same
fingerprint for the same actions. Tests compare one-by-one, mixed batches and large skips byte for byte.

Each second produces:

- **Viewers**: a seeded climb over the first minutes with a wobble. A pinned product lifts them slightly.
- **Comments**: Vietnamese templates. While a product is pinned, most comments are about it; the others name another
  product. A few carry obviously fake phone numbers (`0123 456 789`, `0900 000 000`) and an `example.com` email, so the
  mask is visible.
- **Add-to-carts**: per product. The pinned product draws far more, rising over its first two minutes on show.
- **Purchases**: about one add-to-cart in three, never beyond the entered stock.

Raw comment text never leaves `engine.ts`. Each comment goes through `maskPii`, is classified on the masked text, and
is attributed to the product it names (else the one showing) before it is returned. The store masks comment text again
when it loads a saved desk.

The assumptions are listed in `ASSUMPTIONS`, each starting with "SIMULATED", and each view model carries them for the
"Simulation assumptions" panel:

1. Viewers follow a seeded curve that climbs over the first few minutes and then wobbles. A pinned product lifts them a little.
2. Comments per second grow with the number of viewers.
3. While a product is pinned, comments ask more about its price and size and more viewers say they will buy it. Comments about other products name them.
4. A pinned product draws far more add-to-carts than the others, rising over its first two minutes on show.
5. About one add-to-cart in three becomes a purchase at once. A purchase lowers stock only when stock was entered.
6. A few comments carry obviously fake phone numbers and emails so the PII mask is visible.
7. These are assumptions written into the simulation, not findings about real viewers or about Shopee.

### Comment intents (`intent.ts`)

This is a port of the original keyword baseline (`src/livelift/nlp/intent.py`). Labels are checked in the original's
priority order (`chot_don > hoi_size > van_chuyen > hoi_gia > che_dat`, else `khac`), on whole words, case- and
diacritics-insensitive. They map to the desk's five intents:

| Original | Desk |
|---|---|
| `chot_don` | `ready_to_buy` |
| `hoi_size` | `ask_size` |
| `hoi_gia` | `ask_price` |
| `van_chuyen`, `che_dat`, `khac` | `other` |
| `cam_on_khen` | `praise` |

`praise` has no keyword set in the original baseline: its class exists only in the trained v2 model. The praise phrases
are LiveLift's own, taken from that class's guideline in `labels.py`, and are checked last so they never override an
intent the original recognises.

### PII mask (`pii.ts`)

This ports the original scrubber (`src/livelift/ingest/pii/`): phones (split, O-for-0, +84, spelled out, mixed),
emails, social links and handles (with the original's price, time and size exceptions), bank accounts after a context
word, order and tracking codes, addresses (street numbers, keyword-led spans, "địa chỉ:", "q7", a unit after a shipping
word) and names (after "tên", surname-led, after an honorific, lowercase vocatives and self-introductions). The overlap
priority and the replacement tokens (`[SĐT]`, `[EMAIL]` and so on) are the original's.

One difference: the administrative-unit list is shorter than the original's full province list, covering large cities
and districts only. JavaScript's `\b` is ASCII-only, so word edges are written with Unicode classes.

## 4. The session (`session.ts`) and the store (`store.ts`)

- **Start flow.** Connect (SIMULATED, one click), import CSV/TSV, or use the sample pack, then Start live. The import
  reuses the Prepare screen's parser (`parseProductRows`, `toProductSnapshots`) for `code, name, price` and reads an
  optional fourth column, stock. Start live is enabled only when connected and at least one product has synced. A
  start the platform refuses is reported in `importNote` in the platform's words.
- **Clock.** The virtual clock starts at 20:00:00 (Vietnam time) on 2026-10-09. Each second, the platform is read every
  5 s, the generator plays the second, the viewer chart is sampled every 10 s, and the Copilot is re-scored every 15 s.
  The hooks wake every 250 ms and play `elapsed × speed` whole seconds, at most 300 per wake. Speeds are 1×, 5×, 15×
  and 60×.
- **Free pin and unpin.** Allowed any time during the live, for any synced product, with no schedule, cooldown or
  confirmation, repeatedly and in the same second. One product shows at a time. A new pin replaces the old one.
- **Reset** returns the live to second 0: the platform and products as they were when the live started.
- **Fingerprint.** A rolling FNV-1a over every simulated second and operator action, folded with the Lab's
  `callLogDigest` of both platform logs. It is 8 hex characters, and `null` before the first event.
- **Persistence.** One JSON blob in the browser under `livelift.livedesk.SIMULATED`, written at most every 300 ms. The
  V3 key `livelift.v3.SIMULATED` is never written. A stored blob is checked with Zod, both platform worlds go through
  the platform's own `parseWorld`, and anything else starts a fresh desk.

## 5. The Copilot (`copilot/`)

**Inputs** (`signals.ts`). Per synced product, over the last 2 minutes: ask-price, ask-size and ready-to-buy comments
(attributed as above), add-to-carts in this window and in the window before it, the stock (or "Not entered"), and the
time since it was last shown. Counts only.

**Rules** (`rules.ts`). Deterministic, and always available with no key:

- `show_next`: among products not showing, the most buying interest. Ready-to-buy counts twice; ask-price, ask-size and
  add-to-cart count once. It needs at least 3 events.
- `flash_sale`: for the product showing, at least 4 add-to-carts in the last 2 minutes, more than in the 2 minutes
  before, and entered stock of at least 10. Unknown stock is never "healthy".
- **Confidence** comes from the sample size alone: under 10 events is low, under 25 is medium, else high. There are no
  probabilities and no percentages. Headlines begin "Signals suggest …" and never claim a cause or a result.

**Lifecycle** (`lifecycle.ts`). `proposed → accepted | dismissed`, by the operator only; `accepted → performed`, only
when the platform as read shows it done.

- Accepting a `show_next` is the operator's click: it pins the product, and the suggestion becomes performed when the
  read-back shows that product. A pin the platform refuses leaves it accepted.
- Accepting a `flash_sale` schedules a SIMULATED promotion one minute ahead, lasting 10 minutes, through
  `create_promotion`. It becomes performed once the platform lists that promotion and its start time has passed.
- Dismissing never calls the platform.
- A proposed suggestion the latest signals no longer support is withdrawn; it was never acted on.

**Model refinement** (`ai.ts`, server only). The model may only re-rank the rule candidates and reword their headlines.
Sample size and confidence stay the rules' own.

- It receives the aggregated counts and at most three masked, sanitised excerpts of 80 characters per candidate
  product. It never sees a raw comment.
- Its reply is checked with Zod (strict) and wording rules: it must start "Signals suggest", name the candidate's
  product, and contain no percentages, probabilities, likelihoods, causes, promised results or forbidden phrases.
- With no key the status is `rules_only`. A timeout, error, malformed reply or broken rule gives `ai_fallback`, with
  every suggestion labelled `rules`.
- Each suggestion's `source` says `rules` or `ai`. The panel label is one of "Rules only (SIMULATED data)",
  "AI model, rules as fallback (SIMULATED data)" or "AI model unavailable, showing rules (SIMULATED data)".
- Tests use deterministic fake providers only. No test calls a real provider.

## 6. Environment variables for AI providers

All are server-side and read at call time. A deployment with any problem is "not configured", and problems are reported
by variable name only.

| Variable | Meaning |
|---|---|
| `LIVELIFT_AI_PROVIDER` | **New.** Wire format: unset or `openai_compatible` (Chat Completions), `anthropic` (Messages API, `x-api-key`, `anthropic-version: 2023-06-01`), or `gemini` (`generateContent`, key in the `x-goog-api-key` header, never the URL). Anything else is "not configured" |
| `LIVELIFT_AI_BASE_URL` | https, or http to this machine only. Examples: `https://api.openai.com/v1`, `https://api.anthropic.com/v1`, `https://generativelanguage.googleapis.com/v1beta` |
| `LIVELIFT_AI_API_KEY` | The provider's key |
| `LIVELIFT_AI_MODEL` | The provider's model id |
| `LIVELIFT_AI_TIMEOUT_MS` | 1,000 to 60,000 (default 20,000) |
| `LIVELIFT_AI_MAX_OUTPUT_TOKENS` | 100 to 4,000 (default 900) |
| `LIVELIFT_AI_JSON_MODE` | `on` (default) or `off`. JSON mode for OpenAI-compatible and Gemini |

The providers use plain `fetch` and add no dependency. They share one exchange (`exchangeJson` in `provider.ts`): one
POST, a hard timeout over headers and body, a bounded reply, no redirects, and a closed failure vocabulary. Provider text
is never kept. The existing Operate and Review Copilots use the same selection, and their behaviour is unchanged while
the variable is unset.

## 7. Known limits

- **The model refinement is not wired to the browser.** It runs on the server and needs an API route, which is outside
  WP5a's ownership. Until a route exists, the desk is always `rules_only`. `session.applyCopilotAi` is ready to merge a
  route's result.
- **Host-app actions and fault injection have no screen action.** `session.hostAction` (the host pins or unpins in the
  SIMULATED app) and `session.setPlatformFault` exist and are tested, but `LiveDeskActions` has no slot for them. The
  simulated phone can show what the audience sees; driving it needs a contract change by the operator.
- **First render.** The server renders an empty desk, so a hard reload of `/desk/[liveId]` shows `view === null` until
  the browser's stored desk loads (one render later).
- **Promotions.** A flash sale goes through Shopee's separate flash-sale module, as the simulation models it, scheduled
  one minute ahead because the modelled `create_promotion` requires a start time in the future. Nothing found fires a
  sale inside a live.
