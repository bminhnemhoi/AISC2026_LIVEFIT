import { afterEach, describe, expect, it, vi } from "vitest";
import { SCENARIO_START_MS, applyCommand, createScenarioSession } from "@/lib/domain";
import type { Session } from "@/contracts";
import {
  SIM_SHOP_ID, freshWorld, hostAct, pinFromLiveLift, priceLabel, syncCycle, toHostAppViewModel, withFault,
  type HostAppWords, type ShopeeFault, type ShopeeLiveSim, type SyncState,
} from "@/lib/platform";

const T = SCENARIO_START_MS;

const WORDS: HostAppWords = {
  faults: { token_expired: "auth expired", region_unsupported: "region", rate_limited: "rate", server_error: "server" },
  startsIn: (c) => `in ${c}`,
  endsIn: (c) => `ends in ${c}`,
  comments: ["first", "second", "third"],
  reactions: { pinned: (n) => `pinned ${n}!`, pinnedInApp: "host pinned something", promotion: (n) => `sale ${n}!` },
};

function started(): Session {
  return applyCommand(createScenarioSession("buffered"), { type: "start_live", nowMs: 0 }).session;
}

/** A show that is running, with the platform live opened by LiveLift's first sync. */
function opened(): { session: Session; sim: ShopeeLiveSim; sync: SyncState } {
  const session = started();
  const w = freshWorld(session);
  const r = syncCycle(session, w.sim, w.sync, T);
  return { session, sim: r.sim, sync: r.sync };
}

afterEach(() => vi.restoreAllMocks());

describe("toHostAppViewModel", () => {
  it("before any live: idle, with the shop's products as the bag preview and nothing invented", () => {
    const session = createScenarioSession("buffered");
    const w = freshWorld(session);
    const vm = toHostAppViewModel(w.sim, w.sync, session, T, WORDS);
    expect(vm).toMatchObject({ mode: "idle", title: session.title, sessionId: null, viewers: null, elapsedLabel: null, promotion: null, comments: [], banner: null });
    expect(vm.bag.map((b) => b.name)).toEqual(w.sim.catalog.map((c) => c.name));
    expect(vm.bag.every((b) => !b.pinned)).toBe(true);
  });

  it("an unknown price is null, never zero; known prices are formatted for vi-VN in their own currency", () => {
    expect(priceLabel(null, "VND")).toBeNull();
    expect(priceLabel(199000, "VND")).toBe(new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(199000));
    expect(priceLabel(199000, "VND")).toContain("199.000");
    expect(priceLabel(36, "USD")).toBe(new Intl.NumberFormat("vi-VN", { style: "currency", currency: "USD" }).format(36));
    expect(priceLabel(5, "not-a-code")).toBe("5 not-a-code");

    const session = createScenarioSession("buffered");
    const w = freshWorld(session);
    const sim = hostAct(w.sim, T, { type: "add_catalog_item", item: { itemId: 200001, shopId: SIM_SHOP_ID, name: "mystery box", price: null, currency: "VND" } }).sim;
    const item = toHostAppViewModel(sim, w.sync, session, T, WORDS).bag.find((b) => b.itemId === 200001)!;
    expect(item.priceLabel).toBeNull();
    expect(item.initials).toBe("MB");
  });

  it("once LiveLift opens the live: live mode, the platform's session id, the loaded bag and a simulated clock", () => {
    const { session, sim, sync } = opened();
    const vm = toHostAppViewModel(sim, sync, session, T + 65_000, WORDS);
    expect(vm.mode).toBe("live");
    expect(vm.sessionId).toBe(sync.providerSessionId);
    expect(vm.elapsedLabel).toBe("01:05");
    expect(vm.bag.map((b) => b.name)).toEqual(["Zip Hoodie", "Cargo Pants"]);
    expect(typeof vm.viewers).toBe("number");
    expect(vm.viewers).toBeGreaterThan(0);
  });

  it("shows the pinned product, and a viewer reaction names it a few seconds later", () => {
    const { session, sim, sync } = opened();
    const pinned = pinFromLiveLift(sim, sync, "prod_m03", T + 10_000);
    expect(pinned.outcome.ok).toBe(true);
    const right = toHostAppViewModel(pinned.sim, pinned.sync, session, T + 11_000, WORDS);
    expect(right.bag.filter((b) => b.pinned).map((b) => b.name)).toEqual(["Cargo Pants"]);
    expect(right.comments.some((c) => c.text === "pinned Cargo Pants!")).toBe(false);
    const later = toHostAppViewModel(pinned.sim, pinned.sync, session, T + 14_000, WORDS);
    expect(later.comments.some((c) => c.text === "pinned Cargo Pants!")).toBe(true);
  });

  it("comments are synthetic, deterministic and bounded; their users are visibly invented", () => {
    const { session, sim, sync } = opened();
    const a = toHostAppViewModel(sim, sync, session, T + 600_000, WORDS);
    const b = toHostAppViewModel(sim, sync, session, T + 600_000, WORDS);
    expect(a.comments).toEqual(b.comments);
    expect(a.comments.length).toBe(12);
    expect(a.comments.every((c) => /^viewer_\d{4}$/.test(c.user) && WORDS.comments.includes(c.text))).toBe(true);
    expect(new Set(a.comments.map((c) => c.id)).size).toBe(a.comments.length);
  });

  it("never reads the wall clock or randomness", () => {
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");
    const { session, sim, sync } = opened();
    now.mockClear();
    random.mockClear();
    toHostAppViewModel(sim, sync, session, T + 120_000, WORDS);
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it("a promotion counts down while scheduled, counts down to its end while active, and stops when over", () => {
    // A live the host started in the app, so the plan's own flash sale is not scheduled alongside.
    const session = createScenarioSession("buffered");
    const { sim: idle, sync } = freshWorld(session);
    const sim = hostAct(idle, T, { type: "start_live", title: "From the app" }).sim;
    const promo = hostAct(sim, T, { type: "create_promotion", name: "Flash", startMs: T + 130_000, endMs: T + 400_000, itemIds: [100001] }).sim;
    expect(toHostAppViewModel(promo, sync, session, T, WORDS).promotion).toEqual({ name: "Flash", status: "scheduled", countdownLabel: "in 02:10" });
    expect(toHostAppViewModel(promo, sync, session, T + 130_000, WORDS).promotion).toEqual({ name: "Flash", status: "active", countdownLabel: "ends in 04:30" });
    expect(toHostAppViewModel(promo, sync, session, T + 400_000, WORDS).promotion).toEqual({ name: "Flash", status: "ended", countdownLabel: null });
  });

  it("each platform condition becomes a banner with a tone", () => {
    const { session, sim, sync } = opened();
    const tones: Record<ShopeeFault, string> = { token_expired: "danger", region_unsupported: "warn", rate_limited: "warn", server_error: "danger" };
    for (const fault of Object.keys(tones) as ShopeeFault[]) {
      expect(toHostAppViewModel(withFault(sim, fault), sync, session, T, WORDS).banner).toEqual({ tone: tones[fault], text: WORDS.faults[fault] });
    }
    expect(toHostAppViewModel(sim, sync, session, T, WORDS).banner).toBeNull();
  });

  it("after the live ends: a quiet summary with no simulated audience", () => {
    const { session, sim, sync } = opened();
    const ended = hostAct(sim, T + 90_000, { type: "end_live" }).sim;
    const vm = toHostAppViewModel(ended, sync, session, T + 200_000, WORDS);
    expect(vm).toMatchObject({ mode: "ended", sessionId: sync.providerSessionId, viewers: null, promotion: null, elapsedLabel: "01:30" });
  });

  it("a live the host started in the app is shown too", () => {
    const session = createScenarioSession("buffered");
    const w = freshWorld(session);
    const sim = hostAct(w.sim, T, { type: "start_live", title: "From the app" }).sim;
    const vm = toHostAppViewModel(sim, w.sync, session, T, WORDS);
    expect(vm).toMatchObject({ mode: "live", title: "From the app", bag: [] });
  });
});
