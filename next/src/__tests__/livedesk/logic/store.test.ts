import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveDesk, useStartFlow } from "@/lib/livedesk";
import * as S from "@/lib/livedesk/session";
import {
  SERVER_DESK_STATE, flushDeskState, getDeskState, loadDeskState, parseDeskState, replaceDeskStateForTests, serializeDeskState,
} from "@/lib/livedesk/store";
import { idOf, liveDesk } from "./helpers";

beforeEach(() => {
  window.localStorage.clear();
  replaceDeskStateForTests(S.initialDeskState());
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("browser persistence", () => {
  it("round-trips a full desk through its stored form", () => {
    let s = liveDesk().state;
    s = S.advance(S.pin(s, idOf(s, "Zip Hoodie")), 400);
    s = S.hostAction(s, { type: "pin", productId: idOf(s, "Linen Shirt") });
    s = S.advance(s, 30);
    const back = parseDeskState(JSON.parse(serializeDeskState(s)));
    expect(back).toEqual(s);
    expect(S.fingerprintOf(back!)).toBe(S.fingerprintOf(s));
  });

  it("refuses a broken blob and starts afresh", () => {
    expect(parseDeskState(null)).toBeNull();
    expect(parseDeskState({ version: 2 })).toBeNull();
    const s = JSON.parse(serializeDeskState(liveDesk().state));
    expect(parseDeskState({ ...s, world: { ...s.world, sim: { ...s.world.sim, seq: -1 } } })).toBeNull();
    expect(parseDeskState({ ...s, live: { ...s.live, atStart: { ...s.live.atStart, world: {} } } })).toBeNull();
    window.localStorage.setItem(S.STORAGE_KEY, "{not json");
    expect(loadDeskState(window.localStorage)).toEqual(S.initialDeskState());
  });

  it("masks comment text again on the way in", () => {
    const s = JSON.parse(serializeDeskState(S.advance(liveDesk().state, 30)));
    s.live.comments[0] = { ...s.live.comments[0], text: "gọi 0123 456 789 nhé", piiMasked: false };
    const back = parseDeskState(s)!;
    expect(back.live!.comments[0]).toMatchObject({ text: "gọi [SĐT] nhé", piiMasked: true });
  });

  it("writes only under livelift.livedesk.SIMULATED, never the V3 key", () => {
    const writes = vi.spyOn(window.localStorage, "setItem");
    const { result } = renderHook(() => useStartFlow());
    act(() => {
      result.current.actions.onConnect();
      result.current.actions.onImportSamplePack();
      result.current.actions.onStartLive();
    });
    flushDeskState();
    expect(writes).toHaveBeenCalled();
    expect(new Set(writes.mock.calls.map((c) => c[0]))).toEqual(new Set(["livelift.livedesk.SIMULATED"]));
    expect(window.localStorage.getItem("livelift.v3.SIMULATED")).toBeNull();
    replaceDeskStateForTests(null);
    expect(getDeskState().live?.id).toBe("live-1");
  });
});

describe("the hooks", () => {
  it("run the start flow: connect, import, start live", () => {
    const { result } = renderHook(() => useStartFlow());
    expect(result.current.view).toMatchObject({ platformLabel: "SIMULATED Live", connected: false, products: [], importNote: null });
    expect(result.current.view.startBlockedReason).toMatch(/Connect/);
    expect(result.current.actions.onStartLive()).toBeNull();
    act(() => result.current.actions.onImportText("A-1, Hat, 10 USD, 2"));
    expect(result.current.view.products[0].sync).toEqual({ state: "queued", detail: null });
    act(() => result.current.actions.onConnect());
    expect(result.current.view.products[0].sync.state).toBe("synced");
    act(() => result.current.actions.onRemoveProduct(result.current.view.products[0].id));
    expect(result.current.view.products).toEqual([]);
    act(() => result.current.actions.onImportSamplePack());
    expect(result.current.view.startBlockedReason).toBeNull();
    let id: string | null = null;
    act(() => { id = result.current.actions.onStartLive(); });
    expect(id).toBe("live-1");
    expect(result.current.view.startBlockedReason).toMatch(/already running/);
  });

  it("drive the Live Desk: pin and unpin right after start, run the clock, accept, end", () => {
    replaceDeskStateForTests(liveDesk().state);
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveDesk("live-1"));
    const hoodie = result.current.view!.products.find((p) => p.name === "Zip Hoodie")!.id;
    act(() => result.current.actions.onPin(hoodie));
    expect(result.current.view!.showingProductId).toBe(hoodie);
    act(() => result.current.actions.onUnpin());
    expect(result.current.view!.showingProductId).toBeNull();
    act(() => result.current.actions.onPin(hoodie));
    act(() => { result.current.actions.onSpeed(60); result.current.actions.onRun(); });
    expect(result.current.view!.clock).toMatchObject({ running: true, speed: 60 });
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.view!.viewers).not.toBeNull();
    const ran = getDeskState().live!.elapsedSec;
    expect(ran).toBeGreaterThanOrEqual(500);
    act(() => result.current.actions.onPause());
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(getDeskState().live!.elapsedSec).toBe(ran);
    act(() => result.current.actions.onSkip(60));
    expect(getDeskState().live!.elapsedSec).toBe(ran + 60);
    const proposed = result.current.view!.copilot.suggestions.find((s) => s.state === "proposed");
    expect(proposed).toBeDefined();
    act(() => result.current.actions.onAcceptSuggestion(proposed!.id));
    expect(result.current.view!.copilot.suggestions.find((s) => s.id === proposed!.id)!.state).not.toBe("proposed");
    act(() => result.current.actions.onReset());
    expect(result.current.view!.clock.elapsedLabel).toBe("00:00");
    act(() => result.current.actions.onEndLive());
    expect(result.current.view!.mode).toBe("ended");
    expect(result.current.view!.showingProductId).toBeNull();
  });

  it("ignore actions for another live and return null for an unknown id", () => {
    replaceDeskStateForTests(liveDesk().state);
    const { result } = renderHook(() => useLiveDesk("live-9"));
    expect(result.current.view).toBeNull();
    act(() => result.current.actions.onEndLive());
    expect(getDeskState().live!.mode).toBe("live");
  });

  it("render the same empty desk on the server every time", () => {
    expect(SERVER_DESK_STATE).toEqual(S.initialDeskState());
  });
});
