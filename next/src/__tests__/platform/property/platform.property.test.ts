import { describe, expect, it, vi } from "vitest";
import {
  ENDPOINT_BASIS, SHOPEE_ENDPOINTS, SIM_SHOP_ID, callShopee, createShopeeLiveSim, hostAct, ongoingSession, withAssumptions, withFault,
  type HostAction, type ShopeeFault, type ShopeeLiveSim,
} from "@/lib/platform";
import { SEQUENCES, T, seeded } from "./generator";

const faults: Array<ShopeeFault | null> = [null, "token_expired", "region_unsupported", "rate_limited", "server_error"];
const catalog = [1, 2, 3].map((itemId) => ({ itemId, shopId: SIM_SHOP_ID, name: `Synthetic item ${itemId}`, price: itemId === 1 ? null : 99000, currency: "VND" }));

function platformState(sim: ShopeeLiveSim) {
  const { seq, ledger, ...state } = sim;
  void seq;
  void ledger;
  return state;
}

function run(seed: number, steps: number, verify = false): ShopeeLiveSim {
  const pick = seeded(seed);
  let sim = withAssumptions(createShopeeLiveSim({ catalog }), { appLiveControllable: pick(2) === 0, detailExposesShowingItem: pick(2) === 0 });
  let nowMs = T;
  for (let step = 0; step < steps; step++) {
    nowMs += pick(5000);
    const before = JSON.stringify(sim);
    const previous = sim;
    const operation = pick(8);
    let accepted: boolean | undefined;
    if (operation === 0) sim = withFault(sim, faults[pick(faults.length)]);
    else if (operation === 1) sim = withAssumptions(sim, { appLiveControllable: pick(2) === 0, detailExposesShowingItem: pick(2) === 0 });
    else if (operation === 2) sim = JSON.parse(JSON.stringify(sim)) as ShopeeLiveSim;
    else if (operation === 3) {
      const itemId = pick(5) + 1;
      const actions: HostAction[] = [
        { type: "start_live", title: `Synthetic host ${seed}` }, { type: "end_live" },
        { type: "add_live_item", itemId }, { type: "remove_live_item", itemId },
        { type: "pin_item", itemId }, { type: "unpin_item" },
        { type: "add_catalog_item", item: { ...catalog[0], itemId } },
        { type: "create_promotion", name: "Synthetic flash", startMs: nowMs + 1000, endMs: nowMs + 60000, itemIds: [itemId] },
      ];
      const result = hostAct(sim, nowMs, actions[pick(actions.length)]);
      sim = result.sim;
      accepted = result.ok;
    } else {
      const endpoint = SHOPEE_ENDPOINTS[pick(SHOPEE_ENDPOINTS.length)];
      const ids = Object.keys(sim.sessions).map(Number);
      const sessionId = ids.length && pick(4) !== 0 ? ids[pick(ids.length)] : 42;
      const itemId = pick(5) + 1;
      const itemList = pick(4) === 0 ? [] : [{ item_id: itemId, shop_id: SIM_SHOP_ID }];
      if (pick(3) === 0) itemList.push({ item_id: 999, shop_id: SIM_SHOP_ID });
      const params = {
        session_id: sessionId, item_id: itemId, shop_id: pick(4) === 0 ? 0 : SIM_SHOP_ID,
        title: pick(4) === 0 ? "" : `Synthetic live ${seed}`, name: "Synthetic flash", item_list: itemList,
        start_time: Math.floor(nowMs / 1000) + (pick(2) === 0 ? 60 : -60), end_time: Math.floor(nowMs / 1000) + 120,
      };
      const result = callShopee(sim, nowMs, endpoint, params);
      sim = result.sim;
      accepted = result.ok;
    }
    if (verify) {
      const context = `seed=${seed}, step=${step}, operation=${operation}`;
      expect(JSON.stringify(previous), context).toBe(before);
      if (accepted === false) expect(platformState(sim), context).toEqual(platformState(previous));
      expect(sim.ledger.length, context).toBeLessThanOrEqual(300);
      expect(sim.ledger.every((entry, i) => i === 0 || entry.seq > sim.ledger[i - 1].seq), context).toBe(true);
      expect(sim.ledger.at(-1)?.seq ?? 0, context).toBe(sim.seq);
      expect(Object.values(sim.sessions).filter((session) => session.status === "ongoing").length, context).toBeLessThanOrEqual(1);
    }
  }
  return sim;
}

describe("seeded SIMULATED platform properties", () => {
  it("replays 2,048 mixed action sequences byte-identically without wall clock or randomness", { timeout: 60000 }, () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("Unexpected wall clock"); });
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Unexpected randomness"); });
    try {
      for (let seed = 1; seed <= SEQUENCES; seed++) {
        expect(JSON.stringify(run(seed, 16)), `seed=${seed}`).toBe(JSON.stringify(run(seed, 16)));
      }
    } finally {
      clock.mockRestore();
      random.mockRestore();
    }
  });

  it("refused API/host calls preserve platform state and inputs; ledgers stay bounded and ordered over 2,048 sequences", { timeout: 60000 }, () => {
    for (let seed = 1; seed <= SEQUENCES; seed++) run(seed, 16, true);
  });

  it("discards a partially modified add_item_list draft when a later item is invalid", () => {
    let sim = createShopeeLiveSim({ catalog });
    const created = callShopee(sim, T, "create_session", { title: "Synthetic batch" });
    sim = created.sim;
    const result = callShopee(sim, T, "add_item_list", {
      session_id: created.envelope.response.session_id,
      item_list: [{ item_id: 1, shop_id: SIM_SHOP_ID }, { item_id: 999, shop_id: SIM_SHOP_ID }],
    });
    expect(result.ok).toBe(false);
    expect(platformState(result.sim)).toEqual(platformState(sim));
    expect(result.sim.ledger.at(-1)).toMatchObject({ envelope: { error: "error_param" } });
  });

  it("retains exactly the last 300 entries with increasing seq after mixed ledger rollover", { timeout: 60000 }, () => {
    for (let seed = 1; seed <= 8; seed++) {
      const pick = seeded(seed);
      let sim = createShopeeLiveSim({ catalog });
      for (let step = 1; step <= 340; step++) {
        sim = pick(2) === 0
          ? callShopee(sim, T + step, "get_promotion_list", {}).sim
          : hostAct(sim, T + step, { type: ongoingSession(sim) ? "end_live" : "start_live", title: "Synthetic rollover" }).sim;
        expect(sim.ledger.length).toBe(Math.min(step, 300));
        expect(sim.ledger[0].seq).toBe(Math.max(1, step - 299));
        expect(sim.ledger.at(-1)?.seq).toBe(step);
        expect(sim.ledger.every((entry, i) => i === 0 || entry.seq === sim.ledger[i - 1].seq + 1)).toBe(true);
      }
    }
  });

  it("marks only update_show_item documented; every other simulated call remains inferred", () => {
    expect(SHOPEE_ENDPOINTS.filter((endpoint) => ENDPOINT_BASIS[endpoint] === "documented")).toEqual(["update_show_item"]);
  });

  it("P09: caller mutation rewrites a historical request because ledger params are not cloned", () => {
    const params = { title: "Original synthetic title" };
    const result = callShopee(createShopeeLiveSim(), T, "create_session", params);
    expect(result.ok).toBe(true);
    params.title = "Later caller mutation";
    expect(result.sim.ledger.at(-1)).toMatchObject({ params: { title: "Original synthetic title" } });
  });
});
