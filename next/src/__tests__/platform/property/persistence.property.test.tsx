import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { PlatformSyncPanel } from "@/components/platform/PlatformSyncPanel";
import { addNotices, freshWorld, usePlatformWorld, type PlatformWorld } from "@/components/platform/usePlatformWorld";
import { applyCommand, createScenarioSession, currentPlan, type CommandBody } from "@/lib/domain";
import { withFault } from "@/lib/platform";
import { T, linked, seeded, world } from "./generator";

const key = (sessionId: string) => `livelift.platformSim.v1.${sessionId}`;

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const damaged: Array<{ reason: string; corrupt: (w: PlatformWorld) => unknown }> = [
  { reason: "missing sim.assumptions", corrupt: (w) => ({ ...w, sim: { ...w.sim, assumptions: undefined } }) },
  { reason: "missing sim.sessions", corrupt: (w) => ({ ...w, sim: { ...w.sim, sessions: undefined } }) },
  { reason: "missing sim.seq", corrupt: (w) => ({ ...w, sim: { ...w.sim, seq: undefined } }) },
  { reason: "null sync.promotionRefused", corrupt: (w) => ({ ...w, sync: { ...w.sync, promotionRefused: null } }) },
  { reason: "missing sync.promotions", corrupt: (w) => ({ ...w, sync: { ...w.sync, promotions: undefined } }) },
  { reason: "missing nextNoticeId", corrupt: (w) => ({ ...w, nextNoticeId: undefined }) },
];

describe("SIMULATED platform persistence and caller properties", () => {
  it("rejects invalid JSON, unrelated shapes and obsolete-version keys", () => {
    const session = createScenarioSession("buffered");
    for (const raw of ["{broken", "null", "[]", "{}", JSON.stringify({ sim: {}, sync: {} })]) {
      window.localStorage.setItem(key(session.id), raw);
      const mounted = renderHook(() => usePlatformWorld(session));
      expect(mounted.result.current.world).toEqual(freshWorld(session));
      mounted.unmount();
    }
    window.localStorage.clear();
    const old = freshWorld(session);
    old.sim = withFault(old.sim, "token_expired");
    window.localStorage.setItem(`livelift.platformSim.v0.${session.id}`, JSON.stringify(old));
    const mounted = renderHook(() => usePlatformWorld(session));
    expect(mounted.result.current.world.sim.fault).toBeNull();
  });

  it("preserves a complete world across structuredClone, storage and remount with ordered capped notices", () => {
    const session = createScenarioSession("buffered");
    const mounted = renderHook(() => usePlatformWorld(session));
    act(() => {
      mounted.result.current.update((w) => addNotices(w, T, Array.from({ length: 25 }, (_, i) => ({ code: `synthetic_${i}`, summary: `Synthetic notice ${i}` }))));
    });
    const saved = structuredClone(mounted.result.current.world);
    expect(saved.notices).toHaveLength(20);
    expect(saved.notices.map((notice) => notice.id)).toEqual(Array.from({ length: 20 }, (_, i) => 25 - i));
    expect(saved.nextNoticeId).toBe(26);
    mounted.unmount();
    const restored = renderHook(() => usePlatformWorld(session));
    expect(restored.result.current.world).toEqual(saved);
    expect(structuredClone(restored.result.current.world)).toEqual(saved);
  });

  it("keeps an update in memory if localStorage refuses the write", () => {
    const session = createScenarioSession("buffered");
    const mounted = renderHook(() => usePlatformWorld(session));
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("Synthetic storage quota"); });
    act(() => {
      mounted.result.current.update((w) => ({ ...w, auto: false }));
    });
    expect(mounted.result.current.world.auto).toBe(false);
    expect(mounted.result.current.latest().auto).toBe(false);
  });

  it("the real panel caller reports accepted pins with request ids and refused pins as attempted", () => {
    for (let seed = 1; seed <= 16; seed++) {
      window.localStorage.clear();
      const w = linked();
      const pick = seeded(seed);
      const stored: PlatformWorld = { ...w, notices: [], nextNoticeId: 1, auto: false };
      const shouldAccept = pick(2) === 0;
      if (!shouldAccept) stored.sim = withFault(stored.sim, "token_expired");
      window.localStorage.setItem(key(w.session.id), JSON.stringify(stored));
      const record = vi.fn<(command: CommandBody) => void>();
      const mounted = render(<PlatformSyncPanel session={w.session} nowMs={T} onRecord={record} />);
      const productId = currentPlan(w.session).cues.find((cue) => cue.action === "pin_product")!.productId!;
      fireEvent.click(screen.getByTestId(`pin-${productId}`));
      expect(record).toHaveBeenCalledTimes(1);
      const command = record.mock.calls[0][0];
      expect(command).toMatchObject({ report: shouldAccept ? "performed" : "attempted" });
      const saved = JSON.parse(window.localStorage.getItem(key(w.session.id))!) as PlatformWorld;
      const request = saved.sim.ledger.filter((entry) => entry.kind === "api" && entry.endpoint === "update_show_item").at(-1);
      expect(request?.kind).toBe("api");
      if (!request || request.kind !== "api") throw new Error("Panel made no pin request");
      expect(request.envelope.error === "").toBe(shouldAccept);
      expect("reason" in command && command.reason).toContain(request.envelope.request_id);
      expect("reason" in command && command.reason).toContain("SIMULATED");
      mounted.unmount();
    }
  });

  it.each(damaged)("P06: stored $reason passes shallow validation instead of recovering a fresh world", ({ corrupt }) => {
    const session = createScenarioSession("buffered");
    window.localStorage.setItem(key(session.id), JSON.stringify(corrupt(freshWorld(session))));
    const mounted = renderHook(() => usePlatformWorld(session));
    expect(mounted.result.current.world).toEqual(freshWorld(session));
  });

  it("P06: reloading a blob without sim.assumptions crashes the platform panel", () => {
    const w = world();
    window.localStorage.setItem(key(w.session.id), JSON.stringify(damaged[0].corrupt(freshWorld(w.session))));
    expect(() => render(<PlatformSyncPanel session={w.session} nowMs={T} onRecord={() => undefined} />)).not.toThrow();
  });

  it("P07: changing to a show with no stored world carries the previous show's platform and notices", () => {
    const first = createScenarioSession("buffered", { id: "synthetic-show-a" });
    const second = createScenarioSession("buffered", { id: "synthetic-show-b" });
    const mounted = renderHook(({ session }) => usePlatformWorld(session), { initialProps: { session: first } });
    act(() => {
      mounted.result.current.update((w) => addNotices({ ...w, sim: withFault(w.sim, "token_expired") }, T, [{ code: "synthetic_a", summary: "Only show A" }]));
    });
    mounted.rerender({ session: second });
    expect(mounted.result.current.world).toEqual(freshWorld(second));
  });

  it("P08: resetting an active panel with auto-sync enabled does not open the live again", () => {
    const w = world();
    render(<PlatformSyncPanel session={w.session} nowMs={T} onRecord={() => undefined} />);
    expect(screen.getByTestId("platform-linked").textContent).toContain("ongoing");
    fireEvent.click(screen.getByTestId("platform-reset"));
    expect(screen.getByTestId("platform-auto")).toBeChecked();
    expect(screen.getByTestId("platform-linked").textContent).toContain("ongoing");
  });

  it("P04: a refused duplicate start links a created session and removes the UI needed to link the existing host live", () => {
    const planned = createScenarioSession("buffered");
    const mounted = render(<PlatformSyncPanel session={planned} nowMs={T} onRecord={() => undefined} />);
    fireEvent.click(screen.getByTestId("host-go-live"));
    const started = applyCommand(planned, { type: "start_live", nowMs: T });
    expect(started.receipt.outcome).toBe("committed");
    const session = started.session;
    mounted.rerender(<PlatformSyncPanel session={session} nowMs={T} onRecord={() => undefined} />);
    expect(screen.getByTestId("platform-problem").textContent).toContain("Another livestream is ongoing");
    expect(screen.queryByTestId("platform-link")).not.toBeNull();
  });
});
