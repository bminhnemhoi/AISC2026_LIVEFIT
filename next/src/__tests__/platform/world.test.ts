import { describe, expect, it } from "vitest";
import { createScenarioSession } from "@/lib/domain";
import { addNotices, freshWorld, initialLabState, parseWorld, runDirector, type PlatformWorld } from "@/lib/platform";

/** A world that has every part filled in: the Demo Director's full story. */
const full = (): PlatformWorld => runDirector(initialLabState(createScenarioSession("buffered"))).world;
const roundTrip = (w: unknown): unknown => JSON.parse(JSON.stringify(w));

describe("reading a stored platform world back", () => {
  it("accepts a fresh world and a world with every part filled in, unchanged", () => {
    const fresh = freshWorld(createScenarioSession("buffered"));
    expect(parseWorld(roundTrip(fresh))).toEqual(fresh);
    const w = full();
    expect(w.sim.ledger.some((e) => e.kind === "host_app")).toBe(true);
    expect(w.readLog!.entries.length).toBeGreaterThan(0);
    expect(w.sync.last).not.toBeNull();
    expect(parseWorld(roundTrip(w))).toEqual(w);
  });

  it("migrates a world saved before the read log and live ownership existed, assuming nothing about ownership", () => {
    const w = full();
    const { readLog, ...old } = w;
    void readLog;
    const { openedByLiveLift, ...oldSync } = w.sync;
    void openedByLiveLift;
    const parsed = parseWorld(roundTrip({ ...old, sync: oldSync }));
    expect(parsed?.readLog).toEqual({ entries: [], next: 1 });
    expect(parsed?.sync.openedByLiveLift).toBe(false);
    expect(parsed?.sim).toEqual(w.sim);
  });

  const breaks: Array<[string, (w: PlatformWorld) => unknown]> = [
    ["a NaN counter", (w) => ({ ...w, sim: { ...w.sim, seq: Number.NaN } })],
    ["a call counter behind its own log", (w) => ({ ...w, sim: { ...w.sim, seq: 1 } })],
    ["a notice counter that would reuse an id", (w) => ({ ...addNotices(w, 0, [{ code: "x", summary: "x" }]), nextNoticeId: 1 })],
    ["a read counter that would reuse a number", (w) => ({ ...w, readLog: { ...w.readLog!, next: 1 } })],
    ["a session filed under another id", (w) => ({ ...w, sim: { ...w.sim, sessions: { 1: Object.values(w.sim.sessions)[0] } } })],
    ["a live with an unknown status", (w) => ({ ...w, sim: { ...w.sim, sessions: Object.fromEntries(Object.entries(w.sim.sessions).map(([k, s]) => [k, { ...s, status: "paused" }])) } })],
    ["a call log entry without its reply", (w) => ({ ...w, sim: { ...w.sim, ledger: w.sim.ledger.map((e, i) => (i === 0 ? { ...e, envelope: undefined } : e)) } })],
    ["a last read without what was showing", (w) => ({ ...w, sync: { ...w.sync, last: { ...w.sync.last!, showing: undefined } } })],
    ["a null promotion map", (w) => ({ ...w, sync: { ...w.sync, promotions: null } })],
    ["an unknown condition", (w) => ({ ...w, sim: { ...w.sim, fault: "power_cut" } })],
    ["ownership that is not a yes or no", (w) => ({ ...w, sync: { ...w.sync, openedByLiveLift: "yes" } })],
    ["a read log entry that is not a read", (w) => ({ ...w, readLog: { ...w.readLog!, entries: [{ ...w.readLog!.entries[0], kind: "api" }] } })],
  ];
  it.each(breaks)("refuses %s", (_, corrupt) => {
    expect(parseWorld(roundTrip(corrupt(full())))).toBeNull();
  });

  it("refuses what is not a world at all", () => {
    for (const raw of [null, [], "world", 3, {}, { sim: {}, sync: {} }]) expect(parseWorld(raw)).toBeNull();
  });
});
