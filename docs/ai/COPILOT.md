# AI Copilot (V1)

The AI Copilot is an **advisor** for the operator. It reads what LiveLift has recorded about one show and says what it
sees, why it matters and what the operator might do. It is never the authority: it cannot start, change, skip, apply or
accept anything, and every recommendation stays a recommendation until the operator acts on it.

LiveLift works exactly as before with no AI configured. The Copilot is optional, off by default, and a failure in it never
touches the show.

```
CREATE → PREPARE → OPERATE → REVIEW → NEXT LIVE
                      │          │          │
          Operate Copilot   Review Copilot   Next LIVE suggestions
```

## Configuration

Server-side only. The browser never holds a key and never learns a URL; the key is never logged. Nothing is committed:
`next/.env.production.example` carries placeholders only.

| Variable | Required | Meaning |
| --- | --- | --- |
| `LIVELIFT_AI_BASE_URL` | yes | OpenAI-compatible API base, e.g. `https://api.openai.com/v1`. `https` only; plain `http` only to `localhost`, `127.0.0.1` or `[::1]` (a local model server). No credentials, query or fragment in the URL. |
| `LIVELIFT_AI_API_KEY` | yes | The provider key (8-512 printable characters). Sent only as the `Authorization: Bearer` header of the provider call. |
| `LIVELIFT_AI_MODEL` | yes | Your provider's model id. Shown to the operator next to the answer. |
| `LIVELIFT_AI_TIMEOUT_MS` | no | 1000-60000, default 20000. |
| `LIVELIFT_AI_MAX_OUTPUT_TOKENS` | no | 100-4000, default 900. |
| `LIVELIFT_AI_JSON_MODE` | no | `off` stops sending `response_format: {"type":"json_object"}` (for endpoints that reject it). Default on. |

Docker: `docker-compose.v3.yml` passes the six variables through (empty = not configured). Nothing else in the deployment
changes.

A missing or invalid variable is reported **by name, never by value** (`Not configured`, with the names an administrator
must set). A local server that needs no key still needs a non-empty placeholder (at least 8 characters).

### States

The Copilot is always in exactly one truthful state:

| State | Meaning |
| --- | --- |
| Not configured | The server has no usable AI configuration. Nothing is sent anywhere. |
| Ready | Configured. Nothing is sent until the operator asks. |
| Generating… | One request is in flight. |
| Available | A validated answer is shown. |
| Unavailable | The provider could not be reached, timed out, returned an error or rejected the credentials. |
| Rate limited | The provider (or LiveLift's own per-operator limit, 20 requests per 10 minutes) said to slow down. |
| Invalid response | The model answered, but LiveLift refused the answer (see "What the AI cannot claim"). Nothing from it is shown. |

Also shown, never confused with the above: *Checking…*, *Sign in required*, *Status unavailable* (the server could not be
asked - not the same as "Not configured").

## Provider contract

`src/lib/server/ai/provider.ts` defines one interface:

```ts
interface AiProvider { readonly model: string; complete(request: { system: string; user: string }): Promise<string> }
```

The default implementation `POST {LIVELIFT_AI_BASE_URL}/chat/completions` with
`{ model, messages: [{role:"system"}, {role:"user"}], temperature: 0.2, max_tokens, response_format }` and reads
`choices[0].message.content`. Redirects are refused (they could carry the key elsewhere). Responses are size-bounded.

| Provider answer | State |
| --- | --- |
| 200 with content | validated, then Available or Invalid response |
| 429 (honours `Retry-After`) | Rate limited |
| 401 / 403 | Unavailable (credentials rejected: check `LIVELIFT_AI_API_KEY`) |
| 408 / 504 / no answer in time | Unavailable (timeout) |
| 5xx / other 4xx | Unavailable (provider error) |
| not JSON / oversized | Invalid response |
| network failure | Unavailable (network) |

The provider's own error text is **discarded**: it can echo parts of the request, and it is not LiveLift's to show, log or
store. Logs carry only fixed codes such as `ai_operate_unavailable_timeout`.

To use another vendor, implement `AiProvider` (or point `LIVELIFT_AI_BASE_URL` at an OpenAI-compatible gateway).

## What the AI is given

One typed document per request (`src/contracts/ai.ts`, built in `src/lib/ai/context.ts`):

- **Facts** - sentences LiveLift composed itself from recorded commands and schedule arithmetic, each labelled `recorded`,
  `computed`, `operator_reported`, `gap` (not established) or `simulated`.
- Segment and cue evidence (targets, minimums, anchors, actuals, operator-reported cue state).
- **Candidate options / changes** - the options and Next LIVE adjustments LiveLift's own logic already computed, by alias
  (`opt1`, `chg1`). This is the only thing the AI can recommend.
- Operator notes, follow-ups, corrections and up to three earlier shows of the **same environment** (REAL with REAL,
  SIMULATED with SIMULATED), as **untrusted text**.
- `platform`: `live`, `shop`, `analytics`, `nativeActions` are all `not_established`.

Not sent: credentials, tokens, workspace or account identifiers, sessions of other environments, anything outside the one
show. Free text is normalised, stripped of invisible characters, length-bounded, and scrubbed of anything credential-shaped
(API keys, bearer tokens, JWTs, `KEY=value`, emails). In addition the server removes the **exact value** of every
environment secret (`*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`) from the outgoing prompt, so even pasting the
deployment's own key into a note cannot leak it.

A REAL show is read by the server from the room by id: the browser cannot hand the Copilot invented REAL evidence. A
SIMULATED rehearsal exists only in the browser, so it is sent whole, validated, and refused if it claims to be REAL.

## What it can do

**Operate Copilot** (tab *AI Copilot* beside History / Coverage / Plan changes; nothing is requested until the tab is
opened and the operator presses *Analyse this show*):

- Observed facts, live, labelled **OBSERVED FACT** (or **PRODUCT LOGIC · not AI** when no AI is configured).
- **AI INTERPRETATION** - what is happening and why, citing the facts it rests on.
- **AI RECOMMENDATION** - at most two of the options already shown in ACTION, with *Why (AI)*; marked
  *Recommended · not applied*.
- A non-executable *Next · AI suggestion* (guidance only, no button) and what the evidence does not establish.

> "Opening is 47 seconds behind plan." / "Suggested recovery: shorten Q&A by 30 seconds." / "Why: Opening exceeded its
> planned duration."

**Review Copilot** (on *Plan vs Actual*): a concise summary, important timing deviations, cue/report gaps, evidence
limitations and suggested Next LIVE improvements, using up to three earlier same-environment shows for recurrence.

**Next LIVE**: AI suggestions mark existing proposals (*AI suggests · Why (AI)*). See below.

## What the AI cannot claim

Enforced in code, not only in the prompt (`src/lib/ai/output.ts`). Any violation rejects the whole answer as **Invalid
response**:

| Rule | Check |
| --- | --- |
| Only supplied evidence | it may cite only fact ids that exist and name only listed option / change aliases |
| No invented numbers | every number in its text must appear in the evidence it was given |
| No platform or audience claims | LiveLift has no TikTok performance analytics: "performed poorly", "viewers dropped", "caused sales" etc. are refused. *"Product D04 had no confirmed platform outcome"* is allowed. |
| No action presented as done | "I have applied...", "was already applied" are refused |
| No links or markup | URLs, HTML and code fences are refused |
| No extra fields | an unexpected key (an attempt to smuggle a command) fails the schema |

Frozen semantics the Copilot respects: missing is not zero; planned is not actual; recommendation is not acceptance;
acceptance is not an attempt; an attempt is not performed; operator reported is not provider observed, which is not
platform confirmed; unknown is not failed; REAL is not SIMULATED; observation is not causation.

## How recommendations are accepted

1. The Copilot recommends an option by alias. LiveLift resolves it to the option **its own logic computed**; the answer
   carries no command.
2. It is shown as *Recommended · not applied*. The show is unchanged; nothing runs on render, on analysis or on refresh.
3. The operator clicks *Apply option* (or *Apply exception* / *Review...* for exceptions and commitment changes). That
   click goes through the **same** apply path as the ACTION list, with the same acknowledgements. The recorded decision is
   the operator's, in the normal history.
4. If the show changed since the analysis (a different revision), the advice is marked out of date and cannot be applied;
   an option that is no longer offered cannot be applied. REAL controls that are locked (read-only, offline, a command
   pending) disable it.

Next LIVE: the Review Copilot never selects anything and never creates the next show. Suggested proposals are marked; the
operator may press *Select the N suggested* (one explicit click that ticks only those) or tick boxes by hand, and creating
the next show is a further explicit action. The source show is never edited.

## Prompt-injection and data safety

- **Role boundary.** `SYSTEM` holds every instruction and nothing a person wrote. `USER` is one JSON evidence document,
  introduced as data. Notes, titles, product names and imported text are strings inside it. `<` and `>` are escaped so text
  cannot forge a boundary tag.
- **Allowlist output.** A model that is talked into misbehaving still cannot name an unknown option, cite nothing, invent
  numbers, link out or claim anything about the platform: the answer is refused.
- **Bounded damage.** The worst a hostile note can do is steer a recommendation among options that LiveLift itself computed,
  each of which still needs the operator's click.
- Tests include adversarial note text (`ai.core.test.ts`, `ai.server.test.ts`).

## Competition demo flow

1. Sign in as an operator. Open *Simulator* and start the **Fall collection rehearsal** (SIMULATED).
2. Step the simulator to **20:07**: the host says Zip Hoodie needs 6 more minutes; the 20:12 Flash Sale is at risk.
   NOW / NEXT / WHY / ACTION show the situation and the clean option *End Zip Hoodie by 20:12:00*.
3. Open the **AI Copilot** tab. With no AI configured it says **Not configured** and shows the facts as *Product logic - not
   AI*: the desk is unaffected.
4. With AI configured: press **Analyse this show**. Point out the three layers - **Observed fact**, **AI interpretation**,
   **AI recommendation (not applied)** - and the *Based on facts 1, 3* citations.
5. Press **Apply option**: only now does the show change, and the history records the operator's decision.
6. Finish the rehearsal, open **Review**, press *Check the AI Copilot* then **Analyse this show**: summary, deviations,
   cue/report gaps ("unknown, not failed"), evidence limits ("no confirmed platform outcome").
7. Open **Next LIVE**: AI-suggested proposals are marked; nothing is ticked. Press *Select the 1 suggested*, review the
   resulting plan, then create the next LIVE. The source show is unchanged.

To rehearse without an AI account use the fixture provider (verification only):

```sh
NODE_OPTIONS="--import $PWD/scripts/ai-fixture-preload.mjs" \
LIVELIFT_AI_BASE_URL=https://ai.fixture.test/v1 LIVELIFT_AI_API_KEY=fixture-key-0123456789 LIVELIFT_AI_MODEL=fixture-model-1 \
LIVELIFT_AI_FIXTURE_CONTROL=/tmp/ai-fixture.json npm run start
# echo '{"mode":"429"}' > /tmp/ai-fixture.json   # ok | slow | timeout | 429 | 500 | 401 | malformed | injected | claim | number
```

The fixture is deterministic and **is not an AI**: it proves LiveLift's behaviour, not any model's quality.

## Tests

`npm test` needs no AI account. Fixtures: `src/lib/ai/fixtures.ts` (a well-behaved fake model) and a fake HTTP provider in
`src/lib/server/ai/ai.server.test.ts`.

- `src/lib/ai/ai.core.test.ts` - context, redaction, role boundary, output validation.
- `src/lib/server/ai/ai.server.test.ts` - configuration, provider failures (timeout, rate limit, provider error, malformed),
  secret redaction (key never in logs, responses or provider body), routes (auth, CSRF, REAL vs SIMULATED, rate limit).
- `src/components/ai/__tests__/copilot.ui.test.tsx`, `copilot.flow.test.tsx` - every state, three-layer labelling,
  recommendation not auto-applied, Next LIVE selection, existing Operate flow unaffected, mobile source guards.

## Known limits

- One show is one observation: recurrence uses at most three earlier same-environment shows in the room. SIMULATED
  rehearsals are analysed one at a time.
- The Copilot reads; it does not learn, and it stores nothing (answers live in the browser until the page is left).
- A pre-Phase-2 local archive is not in the room, so the Review Copilot is unavailable for it (the product-logic facts
  still show).
- `max_tokens` and `temperature` are sent as-is; models that reject them need a gateway that adapts the request.
