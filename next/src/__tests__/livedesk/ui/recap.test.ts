import { describe, expect, it } from "vitest";
import { buildRecapView } from "@/lib/livedesk/hooks";
import {
  acceptSuggestionAction, advance, buildDeskView, connect, dismissSuggestionAction, endLive, importSamplePack, initialDeskState, pin, startLive, unpin,
  type DeskState,
} from "@/lib/livedesk/session";
import { confidenceFor } from "@/lib/livedesk/copilot";
import { ASSUMPTIONS } from "@/lib/livedesk/engine";
import { COPY } from "@/components/livedesk/copy";
import { readSignal, tAssumption, tBanner, tImportNote, tStartBlocked } from "@/components/livedesk/i18n";

/** The recap builder (additive, hooks.ts) on the real session: no fixtures, the engine as it is. */

function started(): { state: DeskState; id: string } {
  let state = importSamplePack(connect(initialDeskState()));
  const r = startLive(state);
  state = r.state;
  return { state, id: r.liveId! };
}

describe("buildRecapView", () => {
  it("is null for an unknown live and before any live", () => {
    expect(buildRecapView(initialDeskState(), "live-1")).toBeNull();
    const { state } = started();
    expect(buildRecapView(state, "nope")).toBeNull();
  });

  it("starts empty: nothing sampled, nothing on show, every minute's carts unknown rather than zero", () => {
    const { state, id } = started();
    const r = buildRecapView(advance(state, 125), id)!;
    expect(r.mode).toBe("live");
    expect(r.peakViewers).toBeGreaterThan(0);
    expect(r.bands).toEqual([]);
    expect(r.cartsPerMinute).toEqual([null, null, null]);
    expect(r.cartsOnShow).toBeNull();
    expect(r.operatorPins).toBe(0);
  });

  it("turns pins and unpins into bands with product names, and counts carts only where something was on show", () => {
    const run = started();
    const id = run.id;
    let state = run.state;
    const [hoodie, cargo] = state.products;
    state = advance(state, 30);
    state = pin(state, hoodie.id);
    state = advance(state, 60);
    state = pin(state, cargo.id);
    state = advance(state, 60);
    state = unpin(state);
    state = advance(state, 70);
    state = endLive(state);
    const r = buildRecapView(state, id)!;
    expect(r.mode).toBe("ended");
    expect(r.marks.map((m) => [m.atSec, m.kind, m.productName])).toEqual([[30, "pin", "Zip Hoodie"], [90, "pin", "Cargo Pants"], [150, "unpin", "Cargo Pants"]]);
    expect(r.bands).toEqual([
      { productId: hoodie.id, productName: "Zip Hoodie", fromSec: 30, toSec: 90, by: "operator" },
      { productId: cargo.id, productName: "Cargo Pants", fromSec: 90, toSec: 150, by: "operator" },
    ]);
    expect(r.durationSec).toBe(220);
    expect(r.cartsPerMinute.length).toBe(4);
    expect(r.cartsPerMinute[3]).toBeNull();
    expect(r.cartsPerMinute.slice(0, 3).every((v) => v !== null)).toBe(true);
    expect(r.cartsOnShow).toBe((r.cartsPerMinute.slice(0, 3) as number[]).reduce((a, b) => a + b, 0));
    expect(r.operatorPins).toBe(2);
    expect(r.rows.filter((row) => row.suggestion === null).map((row) => [row.atSec, row.action, row.outcome])).toEqual([[30, "pin", "self"], [90, "pin", "self"], [150, "unpin", "self"]]);
    // Suggestions still proposed when the live ended were never answered: not accepted, not dismissed.
    for (const row of r.rows.filter((x) => x.suggestion !== null)) expect(row.outcome).toBe("no_response");
    expect(r.missing).toEqual([{ id: state.products[2].id, name: "Canvas Tote", price: true, stock: true }]);
    expect(r.fingerprint).toBe(buildDeskView(state, id)!.fingerprint);
  });

  it("matches an accepted pin suggestion to its pin, keeps dismissed and unanswered ones apart", () => {
    const run = started();
    const id = run.id;
    let state = run.state;
    state = pin(state, state.products[1].id);
    let suggestion = null;
    for (let i = 0; i < 60 && !suggestion; i++) {
      state = advance(state, 15);
      suggestion = state.live!.suggestions.find((s) => s.kind === "show_next" && s.state === "proposed") ?? null;
    }
    expect(suggestion).not.toBeNull();
    state = acceptSuggestionAction(state, suggestion!.id);
    const acceptedAt = state.live!.elapsedSec;
    let other = null;
    for (let i = 0; i < 60 && !other; i++) {
      state = advance(state, 15);
      other = state.live!.suggestions.find((s) => s.state === "proposed") ?? null;
    }
    expect(other).not.toBeNull();
    state = dismissSuggestionAction(state, other!.id);
    state = endLive(advance(state, 30));
    const r = buildRecapView(state, id)!;
    const taken = r.rows.find((row) => row.suggestion?.id === suggestion!.id)!;
    expect(["accepted", "performed"]).toContain(taken.outcome);
    expect(taken.actedAtSec).toBe(acceptedAt);
    expect(r.rows.find((row) => row.suggestion?.id === other!.id)!.outcome).toBe("dismissed");
    // The accepted suggestion's pin is not listed again as the operator's own.
    expect(r.rows.filter((row) => row.action === "pin" && row.outcome === "self" && row.atSec === acceptedAt)).toEqual([]);
    for (const row of r.rows.filter((x) => x.suggestion && x.outcome !== "accepted" && x.outcome !== "performed" && x.outcome !== "dismissed")) expect(row.outcome).toBe("no_response");
  });
});

describe("Words the screens add", () => {
  it("every generator assumption has a Vietnamese translation that keeps the SIMULATED label", () => {
    for (const a of ASSUMPTIONS) {
      const vi = tAssumption(a, "vi");
      expect(vi).not.toBe(a);
      expect(vi.startsWith("SIMULATED:")).toBe(true);
      expect(tAssumption(a, "en")).toBe(a);
    }
  });

  it("the confidence bands in the copy match the rules", () => {
    expect([9, 10, 24, 25].map(confidenceFor)).toEqual(["low", "medium", "medium", "high"]);
    expect(COPY.vi.aboutRuleList({ min: 3, rising: 4, stock: 10 })[1]).toContain("thấp dưới 10 tín hiệu, trung bình 10 đến 24, cao từ 25");
  });

  it("translations keep the platform's own words and never change an unknown sentence", () => {
    expect(tBanner('SIMULATED Live is rate limiting: "Too many requests". The Live Desk stopped calling it. Carry on in the app by hand.', "vi"))
      .toBe('SIMULATED Live đang giới hạn tần suất gọi: "Too many requests". Live Desk đã ngừng gọi nền tảng. Bạn tiếp tục thao tác bằng tay trong ứng dụng.');
    expect(tBanner("Something new", "vi")).toBe("Something new");
    expect(tImportNote("4 imported, 0 rows skipped", "vi")).toBe("Đã nhập 4, bỏ qua 0 dòng");
    expect(tImportNote('Start live: SIMULATED Live refused: "error_param"', "vi")).toBe('Bắt đầu live: SIMULATED Live từ chối: "error_param"');
    expect(tStartBlocked("Unknown reason", "vi")).toBe("Unknown reason");
    expect(readSignal({ label: "Stock", value: "Not entered" }, "vi")).toMatchObject({ count: null, missing: true, text: "Chưa nhập" });
    expect(readSignal({ label: "Ask price, last 2 min", value: "7 comments" }, "vi")).toMatchObject({ key: "price", count: 7, text: "7 bình luận" });
    expect(readSignal({ label: "Last shown", value: "1:20 ago" }, "vi").text).toBe("1:20 trước");
  });
});
