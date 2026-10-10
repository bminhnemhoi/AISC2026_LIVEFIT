import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSUMPTIONS, simulateSecond, viewersAt, type EngineWorld } from "@/lib/livedesk/engine";
import * as S from "@/lib/livedesk/session";
import { idOf, liveDesk } from "./helpers";

const world: EngineWorld = {
  products: [{ id: "a", name: "Zip Hoodie", stock: 24 }, { id: "b", name: "Cargo Pants", stock: null }],
  showingProductId: "a",
  shownForSec: 40,
};

/** One scripted rehearsal: actions at fixed seconds, the clock advanced in whatever batches `plan` gives. */
function rehearse(plan: (remaining: number) => number): S.DeskState {
  const { state: start } = liveDesk();
  const actions: Record<number, (s: S.DeskState) => S.DeskState> = {
    0: (s) => S.pin(s, idOf(s, "Zip Hoodie")),
    95: (s) => S.unpin(s),
    95.5: (s) => S.pin(s, idOf(s, "Linen Shirt")),
    240: (s) => S.pin(s, idOf(s, "Cargo Pants")),
    241: (s) => S.setSpeed(S.setRunning(s, true), 60),
    300: (s) => S.unpin(s),
  };
  const at = Object.keys(actions).map(Number).sort((a, b) => a - b);
  let s = start;
  const end = 600;
  while (s.live!.elapsedSec <= end) {
    const sec = s.live!.elapsedSec;
    for (const t of at) if (Math.floor(t) === sec) s = actions[t](s);
    const nextAction = at.find((t) => Math.floor(t) > sec);
    const limit = Math.min(nextAction === undefined ? end + 1 : Math.floor(nextAction), end + 1) - sec;
    if (limit <= 0) break;
    s = S.advance(s, Math.max(1, Math.min(limit, plan(limit))));
  }
  return s;
}

describe("the realtime generator (SIMULATED)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is a pure function of (seed, second, world): no clock, no Math.random", () => {
    vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("wall clock"); });
    vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("randomness"); });
    for (let sec = 1; sec <= 300; sec++) expect(simulateSecond(7, sec, world)).toEqual(simulateSecond(7, sec, structuredClone(world)));
    expect(simulateSecond(7, 10, world)).not.toEqual(simulateSecond(8, 10, world));
  });

  it("gives the same log for the same actions whatever the tick batching (Run, Pause, speeds, skips)", () => {
    const oneByOne = rehearse(() => 1);
    const batches = [7, 13, 30, 1, 60, 300, 5];
    let i = 0;
    const batched = rehearse(() => batches[i++ % batches.length]);
    const bigSkips = rehearse((left) => left);
    expect(S.fingerprintOf(batched)).toBe(S.fingerprintOf(oneByOne));
    expect(S.fingerprintOf(bigSkips)).toBe(S.fingerprintOf(oneByOne));
    expect(JSON.stringify(batched)).toBe(JSON.stringify(oneByOne));
    expect(JSON.stringify(bigSkips)).toBe(JSON.stringify(oneByOne));
    // And a different action time changes it.
    let moved = liveDesk().state;
    moved = S.advance(moved, 1);
    moved = S.pin(moved, idOf(moved, "Zip Hoodie"));
    moved = S.advance(moved, 599);
    expect(S.fingerprintOf(moved)).not.toBe(S.fingerprintOf(oneByOne));
  });

  it("Pause stops nothing it should not: the clock only moves through advance()", () => {
    const { state } = liveDesk();
    const paused = S.setRunning(S.setRunning(state, true), false);
    expect(paused.live!.elapsedSec).toBe(0);
    expect(S.skip(paused, 30).live!.elapsedSec).toBe(30);
    expect(S.skip(paused, 45).live!.elapsedSec).toBe(0);
  });

  it("only produces masked comments, and the mask is visible on some of them", () => {
    const masked: string[] = [];
    for (let sec = 1; sec <= 3000; sec++) {
      for (const c of simulateSecond(3, sec, world).comments) {
        expect(c.text).not.toMatch(/\d{3,4}[\s.]?\d{3}[\s.]?\d{3}/);
        expect(c.text).not.toContain("@example.com");
        if (c.piiMasked) masked.push(c.text);
      }
    }
    expect(masked.length).toBeGreaterThan(5);
    expect(masked.some((t) => t.includes("[SĐT]"))).toBe(true);
    expect(masked.some((t) => t.includes("[EMAIL]"))).toBe(true);
  });

  it("responds to what is showing the way the listed assumptions say", () => {
    const none: EngineWorld = { ...world, showingProductId: null, shownForSec: 0 };
    expect(viewersAt(1, 600, world)).toBeGreaterThan(viewersAt(1, 600, none));
    const carts = (w: EngineWorld, id: string): number => {
      let n = 0;
      for (let sec = 1; sec <= 2000; sec++) n += simulateSecond(5, sec, w).addToCart.filter((x) => x === id).length;
      return n;
    };
    expect(carts(world, "a")).toBeGreaterThan(carts(world, "b") * 3);
    expect(ASSUMPTIONS.every((a) => a.startsWith("SIMULATED"))).toBe(true);
    expect(ASSUMPTIONS.join(" ")).toMatch(/not findings/);
  });

  it("never sells more than the entered stock", () => {
    const soldOut: EngineWorld = { products: [{ id: "a", name: "Zip Hoodie", stock: 0 }], showingProductId: "a", shownForSec: 200 };
    for (let sec = 1; sec <= 1000; sec++) expect(simulateSecond(9, sec, soldOut).purchases).toEqual([]);
    let s = liveDesk().state;
    s = S.pin(s, idOf(s, "Cargo Pants"));
    s = S.advance(s, 1800);
    expect(s.products.find((p) => p.name === "Cargo Pants")!.stock).toBeGreaterThanOrEqual(0);
    expect(s.products.find((p) => p.name === "Canvas Tote")!.stock).toBeNull();
  });
});
