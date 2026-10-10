import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Session } from "@/contracts";
import { SessionStore } from "@/lib/store/sessionStore";
import { SCENARIO_START_MS, newSegment, proposeChanges } from "@/lib/domain";

const T0 = SCENARIO_START_MS;
const at = (m: number, s = 0): number => T0 + (m * 60 + s) * 1000;
const REAL_KEY = "livelift.v3.REAL";
const SIM_KEY = "livelift.v3.SIMULATED";

function boot(): SessionStore {
  const store = new SessionStore();
  store.hydrate();
  return store;
}

function newRealShow(store: SessionStore, title = "Manual show"): Session {
  const created = store.createSession({
    title,
    environment: "REAL",
    timezone: "Asia/Ho_Chi_Minh",
    plannedStartMs: T0,
    start: { type: "blank" },
  });
  if (!created.ok) throw new Error(created.reason);
  const edit = store.editDraft(created.session.id, (draft, alloc) => {
    draft.plans[0].segments.push(
      newSegment(alloc.segmentId(), { title: "Opening", kind: "opening", targetSec: 180, minSec: 120 }),
      newSegment(alloc.segmentId(), { title: "Product A", targetSec: 360, minSec: 240 })
    );
  });
  if (!edit.ok) throw new Error(edit.reason);
  return edit.session;
}

const storedSessions = (key: string): Session[] => JSON.parse(localStorage.getItem(key)!).sessions as Session[];
const stored = (key: string, id: string): Session | undefined => storedSessions(key).find((s) => s.id === id);
const notes = (s: Session | undefined | null): string[] => (s?.events ?? []).filter((e) => e.type === "note_added").map((e) => String(e.data.text));

/** Make every write fail, the way a full or locked browser storage does. */
function failWrites(): void {
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new DOMException("QuotaExceededError", "QuotaExceededError");
  });
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("namespaces", () => {
  it("seeds only SIMULATED rehearsal sessions; REAL starts empty — no fabricated real history", () => {
    const store = boot();
    expect(store.list("REAL")).toEqual([]);
    const sims = store.list("SIMULATED");
    expect(sims.length).toBe(4);
    expect(sims.every((s) => s.environment === "SIMULATED")).toBe(true);
    expect(localStorage.getItem(SIM_KEY)).not.toBeNull();
    expect(localStorage.getItem(REAL_KEY)).toBeNull();
  });

  it("an unknown id is not found — it never falls back to another show", () => {
    const store = boot();
    expect(store.getSession("does-not-exist")).toBeNull();
    expect(store.dispatch("does-not-exist", { type: "end_live" })).toBeNull();
  });

  it("refuses to derive a REAL show from a SIMULATED one", () => {
    const store = boot();
    const r = store.createSession({
      title: "Mixed",
      environment: "REAL",
      timezone: "Asia/Ho_Chi_Minh",
      plannedStartMs: T0,
      start: { type: "previous", sourceId: "sim-buffered" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/never mixed/);
    expect(store.list("REAL")).toEqual([]);
  });

  it("a SIMULATED record found in the REAL namespace is set aside, not loaded", () => {
    const store = boot();
    const sim = store.getSession("sim-buffered")!;
    localStorage.setItem(REAL_KEY, JSON.stringify({ v: 1, sessions: [sim] }));
    const again = boot();
    expect(again.list("REAL")).toEqual([]);
    expect(again.getSnapshot().notices.join(" ")).toContain("could not be read");
    expect(localStorage.getItem(`${REAL_KEY}.quarantine`)).not.toBeNull();
  });

  it("REAL shows are attributed to the local operator, never to a fixture person (UI-17)", () => {
    const store = boot();
    const show = newRealShow(store);
    expect(show.operator.name).toBe("Local operator");
    const named = store.createSession({ title: "Named", environment: "REAL", timezone: "UTC", plannedStartMs: T0, operatorName: "  Mai  ", start: { type: "blank" } });
    expect(named.ok && named.session.operator.name).toBe("Mai");
    expect(store.getSession("sim-buffered")!.operator.name).toBe("Simulated operator");
    expect(JSON.stringify(store.list())).not.toContain("Linh");
  });
});

describe("durability", () => {
  it("a show survives a reload with its full history", () => {
    const store = boot();
    const show = newRealShow(store);
    expect(store.dispatch(show.id, { type: "start_live", nowMs: at(0) })!.receipt.outcome).toBe("committed");
    store.dispatch(show.id, { type: "add_note", text: "Host mentioned restock", nowMs: at(1) });
    const before = JSON.stringify(store.getSession(show.id));

    const reloaded = boot(); // a fresh store reading the same localStorage
    expect(JSON.stringify(reloaded.getSession(show.id))).toBe(before);
    expect(reloaded.getSession(show.id)!.events.length).toBe(3); // started + segment_started + note
    expect(reloaded.getSession(show.id)!.baselineLocked).toBe(true);
  });

  it("a duplicate command key is not committed twice", () => {
    const store = boot();
    const show = newRealShow(store);
    store.dispatch(show.id, { type: "start_live", nowMs: at(0) });
    const first = store.dispatch(show.id, { type: "add_note", text: "once", nowMs: at(1), key: "k1" })!;
    const snapshot = localStorage.getItem(REAL_KEY);
    const dup = store.dispatch(show.id, { type: "add_note", text: "once", nowMs: at(2), key: "k1" })!;
    expect(first.duplicate).toBe(false);
    expect(dup.duplicate).toBe(true);
    expect(notes(store.getSession(show.id)).length).toBe(1);
    expect(localStorage.getItem(REAL_KEY)).toBe(snapshot);
  });

  it("prepare edits are rejected once the baseline is locked", () => {
    const store = boot();
    const show = newRealShow(store);
    store.dispatch(show.id, { type: "start_live", nowMs: at(0) });
    const late = store.editDraft(show.id, (d) => {
      d.title = "Renamed";
    });
    expect(late.ok).toBe(false);
    expect(store.getSession(show.id)!.title).toBe("Manual show");
  });

  it("corrupt storage is set aside, not deleted, and the app still boots", () => {
    localStorage.setItem(REAL_KEY, "{not json");
    const store = boot();
    expect(store.getSnapshot().hydrated).toBe(true);
    expect(store.list("REAL")).toEqual([]);
    expect(store.getSnapshot().notices.join(" ")).toContain("set aside, not deleted");
    expect(JSON.parse(localStorage.getItem(`${REAL_KEY}.quarantine`)!)[0]).toBe("{not json");
  });

  it("an unsupported schema version is set aside, not deleted", () => {
    localStorage.setItem(REAL_KEY, JSON.stringify({ v: 99, sessions: [{ anything: true }] }));
    const store = boot();
    expect(store.list("REAL")).toEqual([]);
    expect(store.getSnapshot().notices.join(" ")).toContain("unsupported version");
    expect(localStorage.getItem(`${REAL_KEY}.quarantine`)).toContain("anything");
  });

  it("picks up a commit made in another tab instead of overwriting it", () => {
    const a = boot();
    const b = boot();
    const show = newRealShow(a);
    expect(b.getSession(show.id)).toBeNull();
    window.dispatchEvent(new StorageEvent("storage", { key: REAL_KEY }));
    expect(b.getSession(show.id)?.title).toBe("Manual show");
  });
});

describe("UI-01 a command is acknowledged only once it is durably written", () => {
  it("a failed write is NOT acknowledged, changes nothing in memory or on disk, and keeps the intent for an explicit retry", () => {
    const store = boot();
    const show = newRealShow(store);
    failWrites();
    const r = store.dispatch(show.id, { type: "start_live", nowMs: at(0) })!;
    expect(r.receipt.outcome).toBe("rejected");
    expect(r.receipt.code).toBe("not_persisted");
    expect(r.receipt.message).toMatch(/Not saved/);
    expect(r.session.lifecycle).toBe("planned");
    expect(store.getSession(show.id)!.lifecycle).toBe("planned");
    expect(store.getSnapshot().storage).toBe("write_failed");
    expect(stored(REAL_KEY, show.id)!.lifecycle).toBe("planned");
    expect(r.intent).toMatchObject({ type: "start_live", nowMs: at(0) });

    // Reload agrees with what was acknowledged: nothing.
    vi.restoreAllMocks();
    expect(boot().getSession(show.id)!.lifecycle).toBe("planned");

    // The operator retries explicitly with the same intent; now it is durable.
    const retry = store.dispatch(show.id, r.intent)!;
    expect(retry.receipt.outcome).toBe("committed");
    expect(boot().getSession(show.id)!.lifecycle).toBe("active");
  });

  it("a failed write mid-show leaves the last acknowledged history in memory and on disk", () => {
    const store = boot();
    const show = newRealShow(store);
    store.dispatch(show.id, { type: "start_live", nowMs: at(0) });
    const before = store.getSession(show.id)!;
    failWrites();
    const r = store.dispatch(show.id, { type: "add_note", text: "lost?", nowMs: at(1) })!;
    expect(r.receipt.code).toBe("not_persisted");
    expect(store.getSession(show.id)).toBe(before);
    expect(notes(stored(REAL_KEY, show.id))).toEqual([]);
  });

  it("a draft edit that cannot be saved is not applied", () => {
    const store = boot();
    const show = newRealShow(store);
    failWrites();
    const r = store.editDraft(show.id, (d) => {
      d.title = "Renamed";
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Not saved/);
    expect(store.getSession(show.id)!.title).toBe("Manual show");
  });

  it("creating a show fails honestly when storage refuses the write", () => {
    const store = boot();
    failWrites();
    const r = store.createSession({ title: "X", environment: "REAL", timezone: "UTC", plannedStartMs: T0, start: { type: "blank" } });
    expect(r.ok).toBe(false);
    expect(store.list("REAL")).toEqual([]);
  });

  it("with storage unavailable nothing can be acknowledged — not even a rehearsal", () => {
    failWrites(); // the probe fails, so storage is unavailable from the start
    const store = boot();
    expect(store.getSnapshot().storage).toBe("unavailable");
    expect(store.getSnapshot().notices.join(" ")).toMatch(/unavailable/);
    expect(store.createSession({ title: "X", environment: "REAL", timezone: "UTC", plannedStartMs: T0, start: { type: "blank" } }).ok).toBe(false);
    const r = store.dispatch("sim-buffered", { type: "start_live" })!;
    expect(r.receipt.code).toBe("not_persisted");
    expect(store.getSession("sim-buffered")!.lifecycle).toBe("planned");
  });

  it("a scripted step whose write fails is not applied", () => {
    const store = boot();
    failWrites();
    const r = store.applyNextScriptStep("sim-buffered")!;
    expect(r.receipt?.code).toBe("not_persisted");
    expect(store.getSession("sim-buffered")!.scriptCursor).toBe(0);
    expect(store.getSession("sim-buffered")!.lifecycle).toBe("planned");
  });
});

describe("UI-02 a stale writer can never overwrite newer acknowledged history", () => {
  function twoWindows(): { a: SessionStore; b: SessionStore; id: string; rev: number } {
    const a = boot();
    const show = newRealShow(a);
    a.dispatch(show.id, { type: "start_live", nowMs: at(0) });
    const b = boot(); // hydrated at the same revision as A
    const rev = b.getSession(show.id)!.revision;
    expect(a.getSession(show.id)!.revision).toBe(rev);
    return { a, b, id: show.id, rev };
  }

  it("same revision, before any storage notification: B's stale write is rejected and does not erase A", () => {
    const { a, b, id, rev } = twoWindows();
    expect(a.dispatch(id, { type: "add_note", text: "A committed", expectedRevision: rev, nowMs: at(1) })!.receipt.outcome).toBe("committed");
    const rb = b.dispatch(id, { type: "add_note", text: "B committed", expectedRevision: rev, nowMs: at(1) })!;
    expect(rb.receipt.outcome).toBe("rejected");
    expect(rb.receipt.code).toBe("stale_revision");
    expect(notes(stored(REAL_KEY, id))).toEqual(["A committed"]);
    // B's memory was brought up to date instead of keeping its stale copy.
    expect(notes(b.getSession(id))).toEqual(["A committed"]);
  });

  it("a command without an expected revision is evaluated against the stored state, never written over it", () => {
    const { a, b, id } = twoWindows();
    a.dispatch(id, { type: "add_note", text: "A committed", nowMs: at(1) });
    expect(b.dispatch(id, { type: "add_note", text: "B committed", nowMs: at(1) })!.receipt.outcome).toBe("committed");
    expect(notes(stored(REAL_KEY, id))).toEqual(["A committed", "B committed"]);
  });

  it("a write for one show never erases another show's newer facts", () => {
    const a = boot();
    const one = newRealShow(a, "Show one");
    const two = newRealShow(a, "Show two");
    const b = boot();
    expect(a.editDraft(one.id, (d) => void (d.title = "One · edited in A")).ok).toBe(true);
    expect(b.editDraft(two.id, (d) => void (d.title = "Two · edited in B")).ok).toBe(true);
    expect(stored(REAL_KEY, one.id)!.title).toBe("One · edited in A");
    expect(stored(REAL_KEY, two.id)!.title).toBe("Two · edited in B");
  });

  it("a stale draft edit of the same show is refused and the newer edit survives", () => {
    const a = boot();
    const show = newRealShow(a);
    const b = boot();
    expect(a.editDraft(show.id, (d) => void (d.title = "A wins")).ok).toBe(true);
    const r = b.editDraft(show.id, (d) => void (d.title = "B stale"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/changed in another tab/);
    expect(stored(REAL_KEY, show.id)!.title).toBe("A wins");
    expect(b.getSession(show.id)!.title).toBe("A wins");
  });

  it("two windows creating a show at the same time get different ids", () => {
    const a = boot();
    const b = boot();
    const x = a.createSession({ title: "X", environment: "REAL", timezone: "UTC", plannedStartMs: T0, start: { type: "blank" } });
    const y = b.createSession({ title: "Y", environment: "REAL", timezone: "UTC", plannedStartMs: T0, start: { type: "blank" } });
    expect(x.ok && y.ok).toBe(true);
    if (x.ok && y.ok) expect(x.session.id).not.toBe(y.session.id);
    expect(storedSessions(REAL_KEY).map((s) => s.title).sort()).toEqual(["X", "Y"]);
  });
});

describe("UI-08 one active REAL show per device", () => {
  it("a second REAL show cannot start while one is running, through the direct command path", () => {
    const store = boot();
    const one = newRealShow(store, "One");
    const two = newRealShow(store, "Two");
    expect(store.dispatch(one.id, { type: "start_live", nowMs: at(0) })!.receipt.outcome).toBe("committed");
    const r = store.dispatch(two.id, { type: "start_live", nowMs: at(1) })!;
    expect(r.receipt.outcome).toBe("rejected");
    expect(r.receipt.code).toBe("another_show_active");
    expect(r.activeSessionId).toBe(one.id);
    expect(stored(REAL_KEY, two.id)!.lifecycle).toBe("planned");
    expect(store.activeRealSession()?.id).toBe(one.id);

    store.dispatch(one.id, { type: "end_live", nowMs: at(2) });
    expect(store.dispatch(two.id, { type: "start_live", nowMs: at(3) })!.receipt.outcome).toBe("committed");
  });

  it("is enforced against storage, so a second window with a stale list is also refused", () => {
    const a = boot();
    const one = newRealShow(a, "One");
    const two = newRealShow(a, "Two");
    const b = boot();
    a.dispatch(one.id, { type: "start_live", nowMs: at(0) });
    const r = b.dispatch(two.id, { type: "start_live", nowMs: at(1) })!;
    expect(r.receipt.code).toBe("another_show_active");
  });

  it("rehearsals are scoped separately", () => {
    const store = boot();
    const one = newRealShow(store, "One");
    store.dispatch(one.id, { type: "start_live", nowMs: at(0) });
    expect(store.dispatch("sim-buffered", { type: "start_live" })!.receipt.outcome).toBe("committed");
    expect(store.dispatch("sim-missed", { type: "start_live" })!.receipt.outcome).toBe("committed");
  });
});

describe("UI-10 unreadable envelopes are quarantined, never crash hydration", () => {
  it("JSON null in the REAL namespace", () => {
    localStorage.setItem(REAL_KEY, "null");
    let store: SessionStore | null = null;
    expect(() => (store = boot())).not.toThrow();
    expect(store!.list("REAL")).toEqual([]);
    expect(store!.getSnapshot().notices.join(" ")).toContain("set aside");
    expect(JSON.parse(localStorage.getItem(`${REAL_KEY}.quarantine`)!)).toContain("null");
    // The app is usable again.
    expect(newRealShow(store!).lifecycle).toBe("planned");
  });

  it("a bare array or a number in the SIMULATED namespace", () => {
    localStorage.setItem(SIM_KEY, "[1,2]");
    const store = boot();
    expect(store.list("SIMULATED").length).toBe(4);
    expect(JSON.parse(localStorage.getItem(`${SIM_KEY}.quarantine`)!)).toContain("[1,2]");
    localStorage.setItem(REAL_KEY, "42");
    expect(() => boot()).not.toThrow();
  });

  it("data that cannot be set aside is left untouched and nothing overwrites it", () => {
    localStorage.setItem(REAL_KEY, "{broken");
    failWrites();
    const store = boot();
    expect(localStorage.getItem(REAL_KEY)).toBe("{broken");
    vi.restoreAllMocks();
    // Still unreadable: a commit refuses rather than replacing data it cannot read.
    const r = store.createSession({ title: "X", environment: "REAL", timezone: "UTC", plannedStartMs: T0, start: { type: "blank" } });
    expect(r.ok).toBe(false);
    expect(localStorage.getItem(REAL_KEY)).toBe("{broken");
  });

  it("an unreadable record is preserved verbatim when another record is written", () => {
    const store = boot();
    const show = newRealShow(store);
    const raw = JSON.parse(localStorage.getItem(REAL_KEY)!);
    raw.sessions.push({ id: "future-format", something: "unknown" });
    localStorage.setItem(REAL_KEY, JSON.stringify(raw));
    store.dispatch(show.id, { type: "start_live", nowMs: at(0) });
    expect(JSON.parse(localStorage.getItem(REAL_KEY)!).sessions.some((s: { id: string }) => s.id === "future-format")).toBe(true);
  });
});

describe("UI-18 resetting a rehearsal keeps every unrelated rehearsal history", () => {
  it("reset this run: only that scenario's session changes", () => {
    const store = boot();
    const real = newRealShow(store);
    store.dispatch("sim-buffered", { type: "start_live" });
    store.applyNextScriptStep("sim-buffered");
    store.dispatch("sim-missed", { type: "start_live" });
    const custom = store.createSession({ title: "My rehearsal", environment: "SIMULATED", timezone: "UTC", plannedStartMs: T0, start: { type: "template" } });
    if (!custom.ok) throw new Error(custom.reason);
    const done = JSON.stringify(store.getSession("sim-buffered-done"));
    const next = store.createNext("sim-buffered-done", { title: "Next", plannedStartMs: at(0) + 86_400_000, changeIds: [], note: "" });
    if (!next.ok) throw new Error(next.reason);
    const revBefore = store.getSession("sim-buffered")!.revision;

    expect(store.resetScenario("buffered").ok).toBe(true);

    const fresh = store.getSession("sim-buffered")!;
    expect(fresh.lifecycle).toBe("planned");
    expect(fresh.events).toEqual([]);
    expect(fresh.revision).toBeGreaterThan(revBefore); // a stale screen of the old run cannot act on the new one
    expect(store.getSession("sim-missed")!.lifecycle).toBe("active");
    expect(store.getSession(custom.session.id)).not.toBeNull();
    expect(JSON.stringify(store.getSession("sim-buffered-done"))).toBe(done);
    expect(store.getSession(next.session.id)).not.toBeNull();
    expect(store.getSession(real.id)!.title).toBe("Manual show");
    // And on disk.
    expect(stored(SIM_KEY, "sim-missed")!.lifecycle).toBe("active");
    expect(stored(SIM_KEY, custom.session.id)).toBeDefined();
  });

  it("a stale screen of the old run is rejected after the reset", () => {
    const store = boot();
    store.dispatch("sim-buffered", { type: "start_live" });
    const rev = store.getSession("sim-buffered")!.revision;
    store.resetScenario("buffered");
    const r = store.dispatch("sim-buffered", { type: "start_live", expectedRevision: rev })!;
    expect(r.receipt.code).toBe("stale_revision");
  });

  it("purging every rehearsal is a separate, explicit action and never touches REAL", () => {
    const store = boot();
    const real = newRealShow(store);
    const custom = store.createSession({ title: "Mine", environment: "SIMULATED", timezone: "UTC", plannedStartMs: T0, start: { type: "blank" } });
    if (!custom.ok) throw new Error(custom.reason);
    expect(store.purgeRehearsals().ok).toBe(true);
    expect(store.getSession(custom.session.id)).toBeNull();
    expect(store.list("SIMULATED").length).toBe(4);
    expect(store.getSession(real.id)).not.toBeNull();
    expect(stored(REAL_KEY, real.id)).toBeDefined();
  });
});

describe("Next LIVE and scripts", () => {
  it("creates and persists the next show without touching the source", () => {
    const store = boot();
    const source = store.getSession("sim-buffered-done")!;
    const before = JSON.stringify(source);
    const changeIds = proposeChanges(source).map((p) => p.id);
    const result = store.createNext(source.id, { title: "Next", plannedStartMs: at(0) + 86_400_000, changeIds, note: "n" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(store.getSession(source.id))).toBe(before);
    expect(result.session.environment).toBe("SIMULATED");
    expect(result.session.id).toMatch(/^sim-\d+$/);
    expect(boot().getSession(result.session.id)?.derivedFrom?.sessionId).toBe(source.id);
  });

  it("applies scripted rehearsal steps through the same authority", () => {
    const store = boot();
    const r = store.applyNextScriptStep("sim-buffered")!;
    expect(r.receipt?.outcome).toBe("committed");
    expect(store.getSession("sim-buffered")!.scriptCursor).toBe(1);
    expect(stored(SIM_KEY, "sim-buffered")!.lifecycle).toBe("active");
    // REAL shows have no script.
    const show = newRealShow(store);
    expect(store.applyNextScriptStep(show.id)).toBeNull();
  });
});
