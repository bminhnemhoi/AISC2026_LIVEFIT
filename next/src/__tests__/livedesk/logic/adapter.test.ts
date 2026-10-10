import { describe, expect, it } from "vitest";
import { createScenarioSession } from "@/lib/domain";
import { PREPARED_LIVE_TITLE, conditionOf, emptyPlatformWorld, simulatedShopeeAdapter as adapter } from "@/lib/livedesk/adapter";
import * as S from "@/lib/livedesk/session";
import {
  ENDPOINT_BASIS, GUESSED_ENDPOINTS, OBSERVED_PREFIX, SHOPEE_ENDPOINTS, callLogDigest, canCallApi, capabilityFor, initialLabState, readsOf,
  runDirector, unpinFromLiveLift,
} from "@/lib/platform";
import { idOf, liveDesk, writes } from "./helpers";

const T0 = S.DESK_EPOCH_MS;

describe("SIMULATED Live adapter: product sync", () => {
  it("queues products until connected, then syncs each with add_item_list on a prepared live", () => {
    const queued = S.importSamplePack(S.initialDeskState());
    expect(queued.products.map((p) => p.sync.state)).toEqual(["queued", "queued", "queued", "queued"]);
    expect(queued.world.sim.ledger).toEqual([]);
    const synced = S.connect(queued);
    expect(synced.products.every((p) => p.sync.state === "synced" && p.sync.detail === null)).toBe(true);
    expect(writes(synced)).toEqual(["create_session:ok", "add_item_list:ok", "add_item_list:ok", "add_item_list:ok", "add_item_list:ok"]);
    const live = Object.values(synced.world.sim.sessions)[0];
    expect(live).toMatchObject({ title: PREPARED_LIVE_TITLE, status: "created" });
    expect(live.items).toHaveLength(4);
  });

  it("keeps a missing price missing: null on the platform and 'Not entered' (null label) on the desk", () => {
    const s = S.importSamplePack(S.connect(S.initialDeskState()));
    const tote = s.products.find((p) => p.name === "Canvas Tote")!;
    expect(tote.price).toBeNull();
    expect(S.buildStartView(s).products.find((p) => p.name === "Canvas Tote")!.priceLabel).toBeNull();
    expect(s.world.sim.catalog.find((c) => c.name === "Canvas Tote")!.price).toBeNull();
  });

  it("marks a product failed with the platform's own words when the platform refuses", () => {
    const faulted = S.setPlatformFault(S.connect(S.initialDeskState()), "token_expired");
    const s = S.importSamplePack(faulted);
    expect(s.products.every((p) => p.sync.state === "failed")).toBe(true);
    expect(s.products[0].sync.detail).toBe("error_auth: You are not authorized");
    expect(S.startBlockedReason(s)).toMatch(/No product has synced/);
    // Fixed and imported again: the failed ones are tried again.
    const retried = S.importText(S.setPlatformFault(s, null), "NEW-1, Wool Scarf, 99000 VND, 5");
    expect(retried.products.every((p) => p.sync.state === "synced")).toBe(true);
  });

  it("reports skipped rows and stock problems in the import note", () => {
    const s = S.importText(S.connect(S.initialDeskState()), "A1, Hat, 10 USD, 3\n, nameless, 5\nA2, Bag, 12.5, lots\nA1, Again, 1");
    expect(s.products.map((p) => p.name)).toEqual(["Hat"]);
    expect(s.importNote).toBe('1 imported, 3 rows skipped: no code or name; stock "lots" is not a whole number; code already imported');
    expect(S.buildStartView(s).products[0].priceLabel).toBe("10.00 USD");
  });

  it("gates Start live: connected and at least one synced product; then create (already prepared) and start", () => {
    expect(S.startBlockedReason(S.initialDeskState())).toMatch(/Connect/);
    expect(S.startBlockedReason(S.connect(S.initialDeskState()))).toMatch(/Import/);
    expect(S.startLive(S.initialDeskState()).liveId).toBeNull();
    const { state, liveId } = liveDesk();
    expect(liveId).toBe("live-1");
    expect(writes(state)).toEqual(["create_session:ok", "add_item_list:ok", "add_item_list:ok", "add_item_list:ok", "add_item_list:ok", "start_session:ok"]);
    expect(S.startBlockedReason(state)).toMatch(/already running/);
    expect(Object.values(state.world.sim.sessions)[0].status).toBe("ongoing");
  });

  it("opens a new live (create_session then start_session) when none is waiting", () => {
    const first = liveDesk().state;
    const ended = S.endLive(first);
    const again = S.startLive(ended);
    expect(again.liveId).toBe("live-2");
    expect(writes(again.state).slice(-4)).toEqual(["end_session:ok", "create_session:ok", "add_item_list:ok", "start_session:ok"]);
  });
});

describe("the import note never outlives the list it describes", () => {
  it("importing the sample twice, then removing every product, leaves no stale 'code already imported' note", () => {
    let s = S.importSamplePack(S.connect(S.initialDeskState()));
    s = S.importSamplePack(s);
    expect(s.importNote).toBe("0 imported, 4 rows skipped: code already imported");
    for (const p of [...s.products]) s = S.removeProduct(s, p.id);
    expect(s.products).toEqual([]);
    expect(s.importNote).toBeNull();
    // A fresh import after that is accepted and says so.
    s = S.importSamplePack(s);
    expect(s.products).toHaveLength(4);
    expect(s.importNote).toBe("4 imported, 0 rows skipped");
  });
});

describe("free pin and unpin", () => {
  it("pins immediately after start, with no schedule, cooldown or confirmation", () => {
    const { state, liveId } = liveDesk();
    const pinned = S.pin(state, idOf(state, "Zip Hoodie"));
    expect(pinned.live!.elapsedSec).toBe(0);
    expect(pinned.live!.showingProductId).toBe(idOf(state, "Zip Hoodie"));
    expect(writes(pinned).at(-1)).toBe("update_show_item:ok");
    const view = S.buildDeskView(pinned, liveId)!;
    expect(view.showingProductId).toBe(idOf(state, "Zip Hoodie"));
    expect(view.products.find((p) => p.showing)!.name).toBe("Zip Hoodie");
    expect(view.charts.viewers.markers).toEqual([{ atSec: 0, kind: "pin", label: "You pinned Zip Hoodie (SIMULATED)" }]);
  });

  it("repeats freely in the same second: pin, unpin, pin, pin another (one shows at a time)", () => {
    let s = liveDesk().state;
    s = S.pin(s, idOf(s, "Zip Hoodie"));
    s = S.unpin(s);
    expect(s.live!.showingProductId).toBeNull();
    s = S.pin(s, idOf(s, "Zip Hoodie"));
    s = S.pin(s, idOf(s, "Cargo Pants"));
    expect(s.live!.showingProductId).toBe(idOf(s, "Cargo Pants"));
    expect(Object.values(s.world.sim.sessions)[0].showingItemId).toBe(s.world.sync.links.find((l) => l.productId === idOf(s, "Cargo Pants"))!.itemId);
    expect(writes(s).slice(-4)).toEqual(["update_show_item:ok", "unpin_show_item:ok", "update_show_item:ok", "update_show_item:ok"]);
    expect(s.live!.markers.map((m) => m.kind)).toEqual(["pin", "unpin", "pin", "pin"]);
    s = S.advance(s, 10);
    s = S.unpin(s);
    s = S.unpin(s);
    expect(s.live!.markers.map((m) => m.kind)).toEqual(["pin", "unpin", "pin", "pin", "unpin"]);
    expect(s.live!.banner).toBeNull();
  });

  it("unpin is the guessed, shape-inferred call, labelled so in the platform and the capability table", () => {
    expect(SHOPEE_ENDPOINTS).toContain("unpin_show_item");
    expect(GUESSED_ENDPOINTS).toEqual(["unpin_show_item"]);
    expect(ENDPOINT_BASIS.unpin_show_item).toBe("inferred");
    const row = capabilityFor("shopee_live", "unpin");
    expect(row.basis).toBe("not_documented");
    expect(row.note).toMatch(/guessed, no Shopee page found/);
    // Real Shopee stays operator-assisted: the Lab and Operate keep their own path.
    expect(canCallApi("shopee_live", "unpin")).toBe(false);
    expect(unpinFromLiveLift()).toMatchObject({ ok: false, reason: "unsupported" });
  });

  it("refuses to pin outside a live or a product that is not synced, without calling", () => {
    const s = S.importSamplePack(S.connect(S.initialDeskState()));
    expect(S.pin(s, idOf(s, "Zip Hoodie"))).toBe(s);
    const { state } = liveDesk();
    expect(S.pin(state, "prod_nope")).toBe(state);
  });
});

describe("the host's own hands, observed through the sync", () => {
  it("records a host pin and unpin as provider observed (SIMULATED) markers at the next read", () => {
    let s = liveDesk().state;
    s = S.pin(s, idOf(s, "Zip Hoodie"));
    s = S.advance(s, 2);
    s = S.hostAction(s, { type: "pin", productId: idOf(s, "Linen Shirt") });
    expect(s.live!.showingProductId).toBe(idOf(s, "Zip Hoodie"));
    s = S.advance(s, 3);
    expect(s.live!.showingProductId).toBe(idOf(s, "Linen Shirt"));
    expect(s.live!.markers.at(-1)).toEqual({ atSec: 5, kind: "host_pin", productId: idOf(s, "Linen Shirt"), label: `${OBSERVED_PREFIX}: the host pinned Linen Shirt` });
    s = S.hostAction(s, { type: "unpin" });
    s = S.advance(s, 5);
    expect(s.live!.markers.at(-1)).toMatchObject({ atSec: 10, kind: "host_unpin", label: `${OBSERVED_PREFIX}: the host unpinned Linen Shirt` });
    expect(s.world.notices[0].summary).toMatch(/^Provider observed \(SIMULATED\)/);
  });

  it("never reports LiveLift's own pin or unpin back as observed", () => {
    let s = liveDesk().state;
    s = S.pin(s, idOf(s, "Zip Hoodie"));
    s = S.advance(s, 20);
    s = S.unpin(s);
    s = S.advance(s, 20);
    expect(s.live!.markers.map((m) => m.kind)).toEqual(["pin", "unpin"]);
  });
});

describe("platform conditions", () => {
  it("stops, says it once, and resumes when an operator action succeeds", () => {
    let s = liveDesk().state;
    s = S.setPlatformFault(s, "token_expired");
    s = S.advance(s, 5);
    expect(s.live!.halted).toBe(true);
    expect(s.live!.banner).toEqual({ tone: "danger", text: 'Authorisation expired on SIMULATED Live: "You are not authorized". The Live Desk stopped calling it. Carry on in the app by hand.' });
    const readsBefore = readsOf(s.world).length;
    s = S.advance(s, 30);
    expect(readsOf(s.world).length).toBe(readsBefore);
    const pinned = S.pin(s, idOf(s, "Zip Hoodie"));
    expect(pinned.live!.showingProductId).toBeNull();
    expect(pinned.live!.markers).toEqual([]);
    s = S.pin(S.setPlatformFault(pinned, null), idOf(s, "Zip Hoodie"));
    expect(s.live!.halted).toBe(false);
    expect(s.live!.banner).toEqual({ tone: "info", text: "SIMULATED Live is answering again." });
    expect(s.live!.showingProductId).toBe(idOf(s, "Zip Hoodie"));
  });

  it("names rate limits and server errors in the platform's words", () => {
    expect(conditionOf("error_server", "Too many requests, please try again later")).toBe("rate_limited");
    expect(conditionOf("error_server", "Something wrong. Please try later.")).toBe("server_error");
    expect(conditionOf("error_auth", "You are not authorized")).toBe("auth_expired");
    expect(conditionOf("error_data", "data not exist")).toBe("refused");
    let s = S.setPlatformFault(liveDesk().state, "rate_limited");
    s = S.unpin(s);
    expect(s.live!.banner).toMatchObject({ tone: "warn", text: expect.stringContaining('"Too many requests, please try again later"') });
  });

  it("keeps the live running when the platform refuses to end it", () => {
    const s = S.endLive(S.setPlatformFault(liveDesk().state, "server_error"));
    expect(s.live!.mode).toBe("live");
    expect(s.live!.banner!.text).toMatch(/server error/);
  });
});

describe("adapter shape", () => {
  it("reads go to the read log, never the call log", () => {
    const w = adapter.syncProducts(emptyPlatformWorld(), [{ productId: "p", name: "P", price: null, currency: "VND" }], T0).world;
    const observed = adapter.observe(w, T0 + 5000).world;
    expect(observed.sim.ledger).toEqual(w.sim.ledger);
    expect(readsOf(observed).length).toBeGreaterThan(readsOf(w).length);
  });

  it("serves metrics from the seeded generator", () => {
    const world = { products: [{ id: "p", name: "P", stock: 3 }], showingProductId: "p", shownForSec: 1 };
    expect(adapter.readMetrics(1, 5, world)).toEqual(adapter.readMetrics(1, 5, world));
  });
});

describe("the Platform Lab is untouched", () => {
  it("the Director still tells the same story with fingerprint 9d723008", () => {
    const story = runDirector(initialLabState(createScenarioSession("buffered")));
    expect(callLogDigest(story.world.sim.ledger, readsOf(story.world))).toBe("9d723008");
    expect(story.world.sim.ledger.some((e) => e.kind === "api" && e.endpoint === "unpin_show_item")).toBe(false);
  });
});
