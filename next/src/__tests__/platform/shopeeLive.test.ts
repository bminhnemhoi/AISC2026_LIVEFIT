import { describe, expect, it } from "vitest";
import {
  ENDPOINT_BASIS, SIM_SHOP_ID, callShopee, createShopeeLiveSim, hostAct, ongoingSession, requestIdFor, withAssumptions, withFault,
  type ShopeeLiveSim, type SimItem,
} from "@/lib/platform";

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const item = (itemId: number, name: string): SimItem => ({ itemId, shopId: SIM_SHOP_ID, name, price: 199000, currency: "VND" });
const seeded = (): ShopeeLiveSim => createShopeeLiveSim({ catalog: [item(100001, "Zip Hoodie"), item(100002, "Cargo Pants")] });

/** An API-opened live with both products in the bag. */
function liveWithBag(): { sim: ShopeeLiveSim; sid: number } {
  let sim = seeded();
  const created = callShopee(sim, T, "create_session", { title: "Fall rehearsal" });
  sim = created.sim;
  const sid = created.envelope.response.session_id as number;
  const bag = [{ item_id: 100001, shop_id: SIM_SHOP_ID }, { item_id: 100002, shop_id: SIM_SHOP_ID }];
  sim = callShopee(sim, T, "add_item_list", { session_id: sid, item_list: bag }).sim;
  sim = callShopee(sim, T, "start_session", { session_id: sid }).sim;
  return { sim, sid };
}

describe("update_show_item follows Shopee's published reference", () => {
  it("answers success with the documented envelope", () => {
    const { sim, sid } = liveWithBag();
    const r = callShopee(sim, T, "update_show_item", { session_id: sid, item_id: 100001, shop_id: SIM_SHOP_ID });
    expect(r.ok).toBe(true);
    expect(r.envelope).toEqual({ error: "", message: "", request_id: expect.stringMatching(/^[0-9a-f]{32}$/), response: {} });
    expect(ongoingSession(r.sim)?.showingItemId).toBe(100001);
  });

  it.each([
    ["session_id", { item_id: 1, shop_id: 1 }, "Invalid session_id"],
    ["item_id", { session_id: 1, shop_id: 1 }, "Invalid item_id"],
    ["shop_id", { session_id: 1, item_id: 1 }, "Invalid shop_id"],
  ])("rejects a missing %s as error_param", (_n, params, message) => {
    const r = callShopee(seeded(), T, "update_show_item", params);
    expect(r.envelope).toMatchObject({ error: "error_param", message });
  });

  it("says the session does not exist, is not ongoing, or does not belong to the caller", () => {
    const base = liveWithBag();
    const missing = callShopee(base.sim, T, "update_show_item", { session_id: 42, item_id: 100001, shop_id: SIM_SHOP_ID });
    expect(missing.envelope).toMatchObject({ error: "error_data", message: "The session(session_id:42) is not exist" });

    const ended = callShopee(base.sim, T, "end_session", { session_id: base.sid }).sim;
    const late = callShopee(ended, T, "update_show_item", { session_id: base.sid, item_id: 100001, shop_id: SIM_SHOP_ID });
    expect(late.envelope).toMatchObject({ error: "error_data", message: `The session(session_id:${base.sid}) is not ongoing` });

    // A live the host started in the app is unreachable when the API cannot control it (assumption A1).
    let sim = withAssumptions(seeded(), { appLiveControllable: false });
    sim = hostAct(sim, T, { type: "start_live", title: "From the app" }).sim;
    const sid = ongoingSession(sim)!.sessionId;
    const notMine = callShopee(sim, T, "update_show_item", { session_id: sid, item_id: 100001, shop_id: SIM_SHOP_ID });
    expect(notMine.envelope).toMatchObject({ error: "error_data", message: `The session(session_id:${sid}) is not belong to you` });
  });

  it("a refused call changes nothing on the platform but is still logged", () => {
    const { sim, sid } = liveWithBag();
    const before = JSON.stringify({ ...sim, ledger: [], seq: 0 });
    const r = callShopee(sim, T, "update_show_item", { session_id: sid, item_id: 999, shop_id: SIM_SHOP_ID });
    expect(r.ok).toBe(false);
    expect(JSON.stringify({ ...r.sim, ledger: [], seq: 0 })).toBe(before);
    expect(r.sim.ledger.at(-1)).toMatchObject({ kind: "api", endpoint: "update_show_item", basis: "documented", envelope: { error: "error_data" } });
  });
});

describe("faults use the documented error vocabulary and leave the platform alone", () => {
  it.each([
    ["token_expired", "error_auth", "You are not authorized"],
    ["region_unsupported", "error_server", "The API is not supported for current region"],
    ["rate_limited", "error_server", "Too many requests, please try again later"],
    ["server_error", "error_server", "Something wrong. Please try later."],
  ] as const)("%s", (fault, error, message) => {
    const { sim, sid } = liveWithBag();
    const r = callShopee(withFault(sim, fault), T, "update_show_item", { session_id: sid, item_id: 100001, shop_id: SIM_SHOP_ID });
    expect(r.envelope).toMatchObject({ error, message });
    expect(ongoingSession(r.sim)?.showingItemId).toBeNull();
  });
});

describe("the other endpoints are honest about being guesses", () => {
  it("only update_show_item is marked documented", () => {
    const documented = Object.entries(ENDPOINT_BASIS).filter(([, b]) => b === "documented").map(([e]) => e);
    expect(documented).toEqual(["update_show_item"]);
  });

  it("one live at a time, and items must come from the shop's catalog", () => {
    const { sim } = liveWithBag();
    const second = callShopee(sim, T, "create_session", { title: "Second" });
    const started = callShopee(second.sim, T, "start_session", { session_id: second.envelope.response.session_id });
    expect(started.ok).toBe(false);
    const stranger = callShopee(sim, T, "add_item_list", { session_id: ongoingSession(sim)!.sessionId, item_list: [{ item_id: 5, shop_id: SIM_SHOP_ID }] });
    expect(stranger.envelope).toMatchObject({ error: "error_param", message: "Invalid item_id" });
  });

  it("promotions must be scheduled in the future", () => {
    const sim = seeded();
    const past = callShopee(sim, T, "create_promotion", { name: "Flash", start_time: Math.floor(T / 1000) - 60, end_time: Math.floor(T / 1000) + 600, item_list: [{ item_id: 100001, shop_id: SIM_SHOP_ID }] });
    expect(past.ok).toBe(false);
    const future = callShopee(sim, T, "create_promotion", { name: "Flash", start_time: Math.floor(T / 1000) + 60, end_time: Math.floor(T / 1000) + 600, item_list: [{ item_id: 100001, shop_id: SIM_SHOP_ID }] });
    expect(future.ok).toBe(true);
  });
});

describe("determinism", () => {
  it("the same calls on the same clock give identical state and request ids", () => {
    const run = () => {
      const { sim, sid } = liveWithBag();
      return callShopee(sim, T, "update_show_item", { session_id: sid, item_id: 100002, shop_id: SIM_SHOP_ID }).sim;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    expect(requestIdFor(1)).toBe(requestIdFor(1));
    expect(requestIdFor(1)).not.toBe(requestIdFor(2));
  });

  it("keeps the call log bounded", () => {
    let sim = seeded();
    for (let i = 0; i < 400; i++) sim = callShopee(sim, T, "get_promotion_list", {}).sim;
    expect(sim.ledger.length).toBe(300);
    expect(sim.seq).toBe(400);
  });
});

describe("the host acting in the Shopee app", () => {
  it("is not an API call: it ignores faults and is logged as host activity", () => {
    let sim = withFault(seeded(), "token_expired");
    sim = hostAct(sim, T, { type: "start_live", title: "From the app" }).sim;
    expect(ongoingSession(sim)?.origin).toBe("shopee_app");
    expect(sim.ledger.at(-1)).toMatchObject({ kind: "host_app", ok: true });
  });

  it("can only pin an item that is in the live bag", () => {
    let sim = hostAct(seeded(), T, { type: "start_live", title: "Live" }).sim;
    expect(hostAct(sim, T, { type: "pin_item", itemId: 100001 }).ok).toBe(false);
    sim = hostAct(sim, T, { type: "add_live_item", itemId: 100001 }).sim;
    const pinned = hostAct(sim, T, { type: "pin_item", itemId: 100001 });
    expect(pinned.ok).toBe(true);
    expect(ongoingSession(pinned.sim)?.showingItemId).toBe(100001);
    expect(ongoingSession(hostAct(pinned.sim, T, { type: "unpin_item" }).sim)?.showingItemId).toBeNull();
  });
});
