import { describe, expect, it } from "vitest";
import {
  HEALTHY_STOCK, acceptSuggestion, aggregateSignals, confidenceFor, dismissSuggestion, markPerformed, mergeCandidates, scoreRules,
  type ProductSignals, type SuggestionRecord,
} from "@/lib/livedesk/copilot";
import * as S from "@/lib/livedesk/session";
import { idOf, liveDesk } from "./helpers";

const sig = (patch: Partial<ProductSignals> & { productId: string }): ProductSignals => ({
  name: patch.productId.toUpperCase(), askPrice: 0, askSize: 0, readyToBuy: 0, addToCart: 0, addToCartBefore: 0, stock: 20, sinceShownSec: null, showing: false, ...patch,
});

describe("Copilot signals", () => {
  it("counts each intent and add-to-cart per product over the last two minutes, and the two before", () => {
    const out = aggregateSignals({
      nowSec: 300,
      products: [{ id: "a", name: "A", stock: 5, lastShownAtSec: 100 }, { id: "b", name: "B", stock: null, lastShownAtSec: null }],
      showingProductId: "b",
      comments: [
        { atSec: 290, intent: "ask_price", aboutProductId: "a" },
        { atSec: 181, intent: "ready_to_buy", aboutProductId: "a" },
        { atSec: 180, intent: "ready_to_buy", aboutProductId: "a" }, // outside the window
        { atSec: 250, intent: "ask_size", aboutProductId: "b" },
        { atSec: 250, intent: "praise", aboutProductId: "a" },
        { atSec: 250, intent: "ask_price", aboutProductId: null },
      ],
      addToCart: [{ atSec: 299, productId: "b" }, { atSec: 100, productId: "b" }, { atSec: 61, productId: "b" }, { atSec: 60, productId: "b" }],
    });
    expect(out[0]).toMatchObject({ productId: "a", askPrice: 1, readyToBuy: 1, askSize: 0, addToCart: 0, stock: 5, sinceShownSec: 200, showing: false });
    expect(out[1]).toMatchObject({ productId: "b", askSize: 1, addToCart: 1, addToCartBefore: 2, stock: null, sinceShownSec: 0, showing: true });
  });
});

describe("the rules scorer", () => {
  it("ranks show-next by buying interest among products not showing, and needs a minimum sample", () => {
    const c = scoreRules([
      sig({ productId: "a", readyToBuy: 3, askPrice: 1 }),
      sig({ productId: "b", askPrice: 5, askSize: 1, showing: true }),
      sig({ productId: "c", askPrice: 2, askSize: 1, addToCart: 1 }),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "show_next", productId: "a", headline: "Signals suggest showing A next", sampleSize: 4, confidence: "low" });
    expect(c[0].signals).toContainEqual({ label: "Ready to buy, last 2 min", value: "3 comments" });
    expect(c[0].signals).toContainEqual({ label: "Last shown", value: "Not shown yet" });
    expect(scoreRules([sig({ productId: "a", askPrice: 2 })])).toEqual([]);
  });

  it("proposes flash-sale timing only when add-to-carts are rising and entered stock is healthy", () => {
    const base = { productId: "s", showing: true, addToCart: 6, addToCartBefore: 2, stock: HEALTHY_STOCK };
    expect(scoreRules([sig(base)])).toEqual([expect.objectContaining({ kind: "flash_sale", productId: "s", sampleSize: 8, headline: "Signals suggest a flash sale on S in the next minute" })]);
    expect(scoreRules([sig({ ...base, addToCartBefore: 6 })])).toEqual([]);
    expect(scoreRules([sig({ ...base, stock: HEALTHY_STOCK - 1 })])).toEqual([]);
    expect(scoreRules([sig({ ...base, stock: null })])).toEqual([]);
    expect(scoreRules([sig({ ...base, showing: false })]).some((c) => c.kind === "flash_sale")).toBe(false);
  });

  it("takes confidence from sample size alone, and never states a probability or a cause", () => {
    expect([confidenceFor(0), confidenceFor(9), confidenceFor(10), confidenceFor(24), confidenceFor(25)]).toEqual(["low", "low", "medium", "medium", "high"]);
    const all = scoreRules([sig({ productId: "a", readyToBuy: 30 }), sig({ productId: "s", showing: true, addToCart: 9, addToCartBefore: 1 })]);
    expect(all.map((c) => c.confidence)).toEqual(["high", "medium"]);
    for (const c of all) {
      expect(c.headline).toMatch(/^Signals suggest /);
      expect(JSON.stringify(c)).not.toMatch(/%|probab|chance|caus|will increase/i);
    }
  });
});

describe("the suggestion lifecycle", () => {
  const cand = (productId: string) => ({ kind: "show_next" as const, productId, headline: `Signals suggest showing ${productId} next`, signals: [], sampleSize: 4, confidence: "low" as const, source: "rules" as const });

  it("proposed -> accepted or dismissed only by the operator; only proposed ones move", () => {
    const { list } = mergeCandidates([], [cand("a")], 30, 1);
    expect(list[0]).toMatchObject({ id: "s1", state: "proposed", atSec: 30 });
    const accepted = acceptSuggestion(list, "s1");
    expect(accepted.moved?.state).toBe("accepted");
    expect(dismissSuggestion(accepted.list, "s1").moved).toBeNull();
    expect(dismissSuggestion(list, "s1").moved?.state).toBe("dismissed");
    expect(acceptSuggestion(list, "nope").moved).toBeNull();
  });

  it("accepted -> performed only when the platform shows the product", () => {
    const accepted: SuggestionRecord[] = [{ ...cand("a"), id: "s1", atSec: 0, state: "accepted", promotionId: null }];
    expect(markPerformed(accepted, { showingProductId: "b", promotions: [], nowMs: 0 })[0].state).toBe("accepted");
    expect(markPerformed(accepted, { showingProductId: null, promotions: [], nowMs: 0 })[0].state).toBe("accepted");
    expect(markPerformed(accepted, { showingProductId: "a", promotions: [], nowMs: 0 })[0].state).toBe("performed");
    const proposed: SuggestionRecord[] = [{ ...accepted[0], state: "proposed" }];
    expect(markPerformed(proposed, { showingProductId: "a", promotions: [], nowMs: 0 })[0].state).toBe("proposed");
  });

  it("keeps settled suggestions, refreshes proposed ones in place and withdraws stale proposals", () => {
    let { list, nextId } = mergeCandidates([], [cand("a")], 10, 1);
    ({ list, nextId } = mergeCandidates(list, [cand("a")], 20, nextId));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "s1", atSec: 10 });
    const accepted = acceptSuggestion(list, "s1").list;
    ({ list, nextId } = mergeCandidates(accepted, [cand("b")], 30, nextId));
    expect(list.map((s) => [s.id, s.state, s.productId])).toEqual([["s1", "accepted", "a"], ["s2", "proposed", "b"]]);
    ({ list } = mergeCandidates(list, [], 40, nextId));
    expect(list.map((s) => s.id)).toEqual(["s1"]);
  });

  it("on the desk: accept pins (operator's click), then performed once the platform shows it", () => {
    let s = liveDesk().state;
    s = S.pin(s, idOf(s, "Zip Hoodie"));
    s = S.advance(s, 600);
    const proposed = s.live!.suggestions.find((x) => x.state === "proposed" && x.kind === "show_next");
    expect(proposed).toBeDefined();
    expect(s.live!.showingProductId).toBe(idOf(s, "Zip Hoodie"));
    const done = S.acceptSuggestionAction(s, proposed!.id);
    expect(done.live!.suggestions.find((x) => x.id === proposed!.id)!.state).toBe("performed");
    expect(done.live!.showingProductId).toBe(proposed!.productId);
  });

  it("on the desk: an accepted pin the platform refuses stays accepted, never performed", () => {
    let s = liveDesk().state;
    s = S.advance(s, 600);
    const proposed = s.live!.suggestions.find((x) => x.state === "proposed" && x.kind === "show_next")!;
    const refused = S.acceptSuggestionAction(S.setPlatformFault(s, "server_error"), proposed.id);
    expect(refused.live!.suggestions.find((x) => x.id === proposed.id)!.state).toBe("accepted");
    expect(refused.live!.banner?.tone).toBe("danger");
  });

  it("on the desk: an accepted flash sale is performed only once its promotion has started", () => {
    let s = liveDesk().state;
    s = S.pin(s, idOf(s, "Linen Shirt"));
    let flash;
    for (let i = 0; i < 120 && !flash; i++) {
      s = S.advance(s, 15);
      flash = s.live!.suggestions.find((x) => x.kind === "flash_sale" && x.state === "proposed");
    }
    expect(flash).toBeDefined();
    let a = S.acceptSuggestionAction(s, flash!.id);
    const rec = a.live!.suggestions.find((x) => x.id === flash!.id)!;
    expect(rec).toMatchObject({ state: "accepted", promotionId: expect.any(Number) });
    expect(a.world.sim.promotions.at(-1)!.name).toBe("Flash sale Linen Shirt (SIMULATED)");
    a = S.advance(a, 55);
    expect(a.live!.suggestions.find((x) => x.id === flash!.id)!.state).toBe("accepted");
    a = S.advance(a, 10);
    expect(a.live!.suggestions.find((x) => x.id === flash!.id)!.state).toBe("performed");
  });

  it("dismiss is recorded and never touches the platform", () => {
    let s = S.advance(liveDesk().state, 600);
    const proposed = s.live!.suggestions.find((x) => x.state === "proposed")!;
    const calls = s.world.sim.ledger.length;
    s = S.dismissSuggestionAction(s, proposed.id);
    expect(s.live!.suggestions.find((x) => x.id === proposed.id)!.state).toBe("dismissed");
    expect(s.world.sim.ledger.length).toBe(calls);
  });
});
