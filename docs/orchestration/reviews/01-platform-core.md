# WP3 phase 1: SIMULATED platform core review

Reviewed 2026-10-08 on `agent/codex/wp3-verification`, source baseline
`949770f` (`949770f docs(orchestration): record slide and poster specifications`).
This is an audit of the repository's SIMULATED Shopee model, not verification of
real Shopee behaviour. No source, existing tests, dependencies, lockfiles or CI
were changed. Phase 2 waits for the operator to announce the Lab route.

Nine findings follow, including two explicit specification mismatches (P01 and
P05). High means a broken core workflow, lost evidence or an unusable reload;
medium means a misleading record or violated contract; low means a recoverable
interaction problem. The reproductions use the real bridge and hook/panel
callers. Every defect assertion is committed as `it.fails`, with its reason in
the title; no existing test is skipped or weakened.

## Reproduction and sampling

From `next/`:

```bash
npx vitest run src/__tests__/platform/property --reporter=verbose
npx vitest run src/__tests__/platform/property -t 'P0[1-9]:' --reporter=verbose
```

The second command executes the expected failures. For verification, the newly
added files' `it.fails` markers were temporarily changed to ordinary `it`, then
restored byte-for-byte in a `finally` block. The final ordinary run reported
**18 failed | 13 skipped (31)**, exit 1; all 18 failures were the intended
assertions, not setup errors. Those 13 skips came solely from the test-name
filter. The P06 panel case confirmed a TypeError from the damaged blob.

The dependency-free generator is xorshift32, seeds **1–2,048**, with injected
`SCENARIO_START_MS`. Each core sequence has 16 actions and each bridge sequence
has 8. Core actions include all ten API endpoints, mixed valid/invalid item
batches, host actions, all four faults, both assumptions and JSON round trips.
Bridge actions include host start/end/pin/unpin, LiveLift pin, faults,
assumptions, reload and sync. Replays compare byte-identical serialized outputs;
the core replay throws if `Date.now()` or `Math.random()` is used.

Other seeded checks cover 2,048 successful pin sequences, 2,048 repeated healthy
syncs, 2,048 healthy endings, and 2,048 failed-pin recovery sequences. Eight mixed
API/host sequences each exceed the ledger cap with 340 entries. A pin followed
by 101 idle syncs checks echo suppression after its request leaves the ledger.
Sixteen rendered panel cases check the actual caller's accepted/performed and
refused/attempted records.

The codebase-memory graph was indexed for this worktree and used at Tier 2 for
symbol discovery, both-direction bridge traces and exact source snippets.
Coverage checks found no recorded gaps in the cited platform files or domain
helpers. That is a best-effort signal; direct source reads and executed tests
support the findings below, not a claim of exhaustive graph completeness.

The compact tests below share imports from `@/lib/platform`,
`@/components/platform/usePlatformWorld`, `@/lib/domain`, Vitest and Testing
Library. `world()`, `linked()` and `T` come from
[`generator.ts`](../../../next/src/__tests__/platform/property/generator.ts).
`world()` creates an active SIMULATED show and fresh platform; `linked()` runs
its first sync. The committed tests contain all imports and setup.

## P01 — Medium: strict sync idempotence fails and the returned call list hides reads

**Location:** `next/src/lib/platform/sync.ts:438`, `:439`, `:458`;
`pollPlatform` at `:129`, `:141`, `:142`.

**Sequence:** initialize a linked active show, then repeat `syncCycle` with the
identical session, platform, sync state and clock. Three API reads are appended
and `seq` increases by three, while `CycleResult.calls` is empty. All 2,048 seeded
checks changed state. The existing tests check only the returned write list.

**Impact:** the requested “changes nothing and makes no calls” property is false.
Polling also evicts accepted writes from the 300-entry log even when the show is
idle; the successful-pin rollover test demonstrates this after 101 cycles.
The platform payload and show commands remain unchanged in healthy repeats.

**Minimal test:**

```ts
const w = linked();
const again = syncCycle(w.session, w.sim, w.sync, T);
expect(again.calls).toEqual([]); // passes, despite actual read traffic
expect(again.sim.seq).toBe(w.sim.seq); // receives w.sim.seq + 3
```

**Smallest safe resolution:** make the contract explicit about read traffic and
include it in the returned call accounting. If literal no-call idempotence is
required for identical simulation inputs, handle that case without eliminating
the polling needed to observe changed inputs. Do not suppress host-state reads
merely to make the test pass.

**Executable:** P01 in
[`sync.property.test.ts`](../../../next/src/__tests__/platform/property/sync.property.test.ts).

## P02 — High: a refused pin destroys the good baseline, causing echo and lost host evidence

**Location:** `next/src/lib/platform/sync.ts:158`, `:290`, `:295`, `:348`, `:355`.

**Sequence:** after LiveLift opens the live, loads products and schedules its
promotion, inject `token_expired` and attempt a LiveLift pin. `rebase` stores a
failed snapshot with empty items/promotions and unobservable showing. Clear the
fault and sync. Existing products are described as host additions and the
existing LiveLift promotion is reported as newly seen. This happens for all
2,048 sampled product/fault combinations, including all four fault types.

**Impact:** unknown becomes empty. LiveLift echoes its own changes as host
activity. If the host pins during the outage before the refused LiveLift pin,
the first successful recovery read emits zero pin commands: comparison skips
the transition from the poisoned `unobservable` baseline. The API refusal itself
does preserve platform payload; this defect is in bridge state and evidence.

**Minimal test:**

```ts
const w = linked();
const pin = pinFromLiveLift(withFault(w.sim, "token_expired"),
  w.sync, w.sync.links[0].productId, T);
expect(pin.outcome.ok).toBe(false);
const healed = syncCycle(w.session, withFault(pin.sim, null), pin.sync, T);
expect(healed.notices.filter(n =>
  ["item_added_known", "promotion_scheduled", "observed"].includes(n.code)
)).toEqual([]); // receives two product notices and one promotion notice
```

**Smallest safe repair:** retain the last successful baseline when rebasing fails
and surface the read problem separately. Compare recovery against successful
evidence, never against missing fields synthesized by a failed read.

**Executable:** three P02 tests in `sync.property.test.ts`: minimal echo,
seeded echo, and lost host pin.

## P03 — High: a partially opened live cannot resume after its product load is repaired

**Location:** `next/src/lib/platform/sync.ts:209`, `:213`, `:221`, `:222`.

**Sequence:** start with a catalog missing the linked products. `create_session`
succeeds; `add_item_list` refuses. Restore the catalog and sync again. Product
loading succeeds, but `start_session` is never attempted because `createdNow`
is false in subsequent cycles. The linked session remains `created` forever.

**Impact:** correcting the failure does not recover the show. No individual
refused call mutates platform payload, but the multi-call workflow is stranded.

**Minimal test:**

```ts
const w = world();
const first = syncCycle(w.session, { ...w.sim, catalog: [] }, w.sync, T);
const retry = syncCycle(w.session,
  { ...first.sim, catalog: w.sim.catalog }, first.sync, T);
expect(retry.calls.find(c => c.endpoint === "add_item_list")?.ok).toBe(true);
expect(ongoingSession(retry.sim)?.sessionId).toBe(retry.sync.providerSessionId);
// receives undefined; linked session is still created
```

**Smallest safe repair:** resume starting an API-created linked session whose
successful read says `created`, after its missing products load successfully.
Do not reopen ended lives or guess a host session's ownership.

**Executable:** P03 in `sync.property.test.ts`.

## P04 — High: a pre-existing host live gets stranded behind an unusable API link

**Location:** `next/src/lib/platform/sync.ts:213`, `:222`, `:224`;
`next/src/components/platform/PlatformSyncPanel.tsx:191`.

**Sequence:** on a planned show, click “Go live in the app”, then start the
LiveLift show. Sync creates and links a second session, loads it, and receives
“Another livestream is ongoing” when starting it. Because `linked` now points
to that `created` session, `live && !linked` hides the existing host live's link
control. End the show and sync: the host live remains ongoing, while the linked
API session remains created. The pure bridge and rendered panel both reproduce.

**Impact:** normal host-first operation loses its intended linking path and
violates the brief's unconditional ended-show property. An unlinked live cannot
be safely auto-ended using undocumented discovery; the usable manual link and
clear end-state limitation are the necessary repairs.

**Minimal UI test:**

```tsx
const planned = createScenarioSession("buffered");
const view = render(<PlatformSyncPanel session={planned} nowMs={T}
  onRecord={() => undefined} />);
fireEvent.click(screen.getByTestId("host-go-live"));
const active = applyCommand(planned, { type: "start_live", nowMs: T }).session;
view.rerender(<PlatformSyncPanel session={active} nowMs={T}
  onRecord={() => undefined} />);
expect(screen.getByTestId("platform-problem").textContent)
  .toContain("Another livestream is ongoing");
expect(screen.queryByTestId("platform-link")).not.toBeNull(); // receives null
```

**Smallest safe repair:** preserve access to explicit host-session linking when
the automatic session failed to start, and disclose any ongoing unlinked live
when ending the show. P03 covers resuming the stranded API session.

**Executable:** P04 in `sync.property.test.ts` and
[`persistence.property.test.tsx`](../../../next/src/__tests__/platform/property/persistence.property.test.tsx).

## P05 — Medium, contract mismatch: provider observation is emitted as performed without accepted mutation evidence

**Location:** `next/src/lib/platform/sync.ts:378`, `:382`, `:329`.

**Sequence:** the host pins an existing bag item; a successful sync reads it.
The resulting command is `report_cue` with `report: "performed"` and reason
`Provider observed (SIMULATED)`. No `update_show_item` request was accepted and
the command contains no request id.

**Impact:** the user-requested universal “performed implies an accepted request
id” property does not hold. This is a specification/evidence-model mismatch,
not evidence that a failed LiveLift request is recorded as successful: the
actual panel's outbound accepted/refused cases pass. A host action legitimately
has no accepted LiveLift mutation request. Provider observation, operator report
and API acceptance must remain distinct.

**Minimal test:**

```ts
const w = linked();
const itemId = w.sync.last!.itemIds[0];
const sim = hostAct(w.sim, T, { type: "pin_item", itemId }).sim;
const [command] = syncCycle(w.session, sim, w.sync, T).commands;
expect(command).toMatchObject({ report: "performed" });
expect("reason" in command && command.reason).toContain("request_id");
// receives only the provider-observed reason
```

**Smallest safe resolution:** define accepted-request evidence for outbound
performance separately from provider-observed host action evidence. Resolve
the universal property or add a distinct observation record; never fabricate
an acceptance/request id for a host action. A contract change may need files
outside WP1/WP3 ownership and therefore belongs to the operator.

**Executable:** P05 in `sync.property.test.ts`; the passing actual-panel caller
property is in `persistence.property.test.tsx`.

## P06 — High: shallow storage validation accepts blobs that crash or corrupt the rehearsal

**Location:** `next/src/components/platform/usePlatformWorld.ts:31`, `:33`,
`:34`, `:41`; consuming panel at `PlatformSyncPanel.tsx:96` and `:141`.

**Input:** a valid v1 world with any of `sim.assumptions`, `sim.sessions`,
`sim.seq`, `sync.promotions`, or `nextNoticeId` removed, or
`sync.promotionRefused: null`. All six blobs pass `isWorld`. In particular,
`typeof null === "object"` lets the null refusal map through.

**Impact:** a missing assumptions object crashes the panel on reload. Missing
session/maps break consumers, and missing counters permit NaN notice ids or
call sequences. These are schema-drift/corrupted-blob cases, not evidence of
localStorage performing partial writes. Invalid JSON and unrelated objects are
correctly rejected; blocked writes correctly keep the in-memory world working.

**Minimal test:**

```ts
const session = createScenarioSession("buffered");
const saved = freshWorld(session);
localStorage.setItem(`livelift.platformSim.v1.${session.id}`, JSON.stringify({
  ...saved, sim: { ...saved.sim, assumptions: undefined }
}));
const mounted = renderHook(() => usePlatformWorld(session));
expect(mounted.result.current.world).toEqual(freshWorld(session));
// accepts the damaged world instead
```

**Smallest safe repair:** validate the complete persisted shape and required
finite counters before accepting it; reject null maps and recover a fresh
world or explicitly migrate a supported schema version. Do not rely on the
type assertion to validate JSON.

**Executable:** six P06 shape cases plus the actual-panel crash test in
`persistence.property.test.tsx`.

## P07 — Medium: changing shows carries the previous platform world when the new show has no saved world

**Location:** `next/src/components/platform/usePlatformWorld.ts:69`, `:73`,
`:75`, `:87`.

**Sequence:** mount the hook for show A, set a fault or add notices, and rerender
the same hook for show B with no stored blob. The session-id effect does
nothing when `load(B)` returns null. The ref/state continue to contain A's
world, and the next update saves it under B's key.

**Impact:** platform sessions, links, notices and conditions can be attributed
to the wrong rehearsal. This was reproduced as a hook rerender; whether a
particular router navigation remounts the panel was not browser-tested.

**Minimal test:**

```ts
const a = createScenarioSession("buffered", { id: "synthetic-a" });
const b = createScenarioSession("buffered", { id: "synthetic-b" });
const h = renderHook(({ session }) => usePlatformWorld(session),
  { initialProps: { session: a } });
act(() => { h.result.current.update(w => ({
  ...w, sim: withFault(w.sim, "token_expired")
})); });
h.rerender({ session: b });
expect(h.result.current.world).toEqual(freshWorld(b)); // still has A's fault
```

**Smallest safe repair:** on session-id change, initialize both ref and state
from that show's valid stored world or its own fresh world.

**Executable:** P07 in `persistence.property.test.tsx`.

## P08 — Low: Reset leaves an active auto-sync panel idle until another dependency changes

**Location:** `next/src/components/platform/usePlatformWorld.ts:93`;
`next/src/components/platform/PlatformSyncPanel.tsx:101`.

**Sequence:** with an active linked show, normal conditions, auto-sync on and
a paused clock, click Reset. The fresh world has no live, but all auto-sync
effect dependencies retain their values, so it never opens a replacement.

**Impact:** the UI says auto-sync is enabled while no live is linked. “Sync now”
or advancing the clock recovers it; no data-loss claim is made for intentional
Reset.

**Minimal test:**

```tsx
const w = world();
render(<PlatformSyncPanel session={w.session} nowMs={T}
  onRecord={() => undefined} />);
fireEvent.click(screen.getByTestId("platform-reset"));
expect(screen.getByTestId("platform-auto")).toBeChecked();
expect(screen.getByTestId("platform-linked").textContent).toContain("ongoing");
// receives "No live is linked yet..."
```

**Smallest safe repair:** explicitly run sync after a reset when auto-sync and
the active lifecycle require it, using the newly reset world.

**Executable:** P08 in `persistence.property.test.tsx`.

## P09 — Medium: the ledger holds the caller's mutable request object

**Location:** `next/src/lib/platform/shopeeLive.ts:377`.

**Input:** make a call with a params object, then reuse/mutate that object.
The ledger's historical request changes because `params` is stored by reference,
even though the simulation itself was cloned. The returned envelope is likewise
shared with its newly appended ledger entry; the concrete test covers params.

**Impact:** call-log evidence no longer describes the request that produced the
response, undermining replay/export consistency when callers reuse objects.
Current panel callers use fresh literals, so ordinary panel reuse was not
claimed as an observed failure.

**Minimal test:**

```ts
const params = { title: "Original synthetic title" };
const result = callShopee(createShopeeLiveSim(), T, "create_session", params);
params.title = "Later caller mutation";
expect(result.sim.ledger.at(-1)).toMatchObject({
  params: { title: "Original synthetic title" }
}); // receives "Later caller mutation"
```

**Smallest safe repair:** snapshot params when appending the ledger entry; avoid
sharing mutable envelope data with the caller if historical replies must also
be immutable.

**Executable:** P09 in
[`platform.property.test.ts`](../../../next/src/__tests__/platform/property/platform.property.test.ts).

## Areas with no defect found in the exercised cases

- **Refused-call platform atomicity:** 2,048 mixed 16-action sequences preserved
  platform payload on API and host refusals. A valid first item followed by an
  invalid item reproduced draft mutation inside `add_item_list`, but the public
  call correctly discarded it. Inputs were unchanged. Seq/log entries are
  expected to advance on a refusal.
- **Healthy no-echo:** successful pins, including products newly added by the
  pin helper, produced no observed commands/notices on subsequent sync. This
  continued after the accepted pin entry fell off the ledger. P02 is the failed
  rebase exception.
- **Healthy ending and ordering:** 2,048 reachable, fault-free linked lives
  ended after the show ended. The ledger showed promotion/detail/item reads
  before `end_session`, and the pending host observation was seen before that
  write. This does not claim success for refused end requests, A1=false app
  lives or unlinked lives; those cannot honestly guarantee automatic ending.
- **Ledger mechanics:** every valid-state sampled sequence stayed at or below
  300 entries with increasing seq. Eight 340-entry mixed sequences retained
  exactly entries 41–340. No successful echo-suppression dependency on evicted
  entries was found. P01 affects log retention, and P09 affects historical data.
- **Valid persistence:** a complete cloned world round-tripped through storage
  and remount; notices capped at 20 with increasing ids. Invalid JSON, unrelated
  shapes and old-version keys were ignored; write refusal preserved memory.
  P06 covers same-version schema corruption; P07 covers show changes.
- **Capabilities, exports and host-app types:** `index.ts` reexports the three
  modules. Only `update_show_item` is marked documented; all other call shapes
  remain inferred. `unpinFromLiveLift` makes no guessed API call. A1/A2 are
  explicit. The presentational contract has nullable viewer/price fields and
  labels comments synthetic. No defect found in these exercised metadata/type
  cases; real platform capabilities and official documentation were not
  independently verified.
- **Determinism and honesty scope:** no wall-clock/random calls were found in
  either platform directory, and seeded replay matched. The panel has its
  SIMULATED top-level marker and violet host-app marker; the current Operate
  caller mounts it only for SIMULATED shows. This source/DOM review does not
  certify per-surface labels, contrast, layout, motion or axe acceptance.

## Verification and remaining work

The requested commands were run from `next/`, sequentially as
`npm run typecheck && npm run lint && npm test`:

| Command | Observed summary |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit`, exit 0, no diagnostics |
| `npm run lint` | `eslint .`, exit 0, no diagnostics |
| `npm test` | `Test Files 68 passed (68)`; `Tests 1108 passed \| 18 expected fail \| 57 skipped (1183)`; duration 44.80 s; exit 0 |

The baseline's 65 files, 1,095 passes and 57 skips are preserved; the three new
test files add 13 passes and 18 explicit expected failures. Ordinary reproduction
ran after this gate and restored the tested files byte-for-byte.

No UI source was changed, so build/screenshots are outside this phase. Browser acceptance,
production HTTPS, axe on three viewports, Demo Director replay, layout shift
and reduced-motion checks are **SKIPPED: phase 2 not yet requested**.

The pre-commit `security-gate` skill's dependency check ran against the unchanged
product lockfile: `Scanned .../next/package-lock.json file and found 331 packages`
and `No issues found`, exit 0. This result is limited to that scanner run.
`gitleaks git --staged --verbose --redact` checked both staged commit batches:
`no leaks found`, exit 0 in each. Diff inspection showed only the five additions
in WP3's owned directories; `git diff --cached --check` exited 0.
