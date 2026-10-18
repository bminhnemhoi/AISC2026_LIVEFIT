import { describe, expect, it } from "vitest";
import { SCENARIOS, createScenarioSession, createSession, currentPlan } from "@/lib/domain";
import type { Session } from "@/contracts";
import { DIRECTOR_DURATION_MS, DIRECTOR_STEPS, applyDirectorStep, directorAvailability, runDirector, type DirectorStepId } from "./director";
import { initialLabState, labNow, labRecords, type LabState } from "./lab";
import { promotionStatus } from "./shopeeLive";
import { callLogDigest } from "./wire";
import { readsOf } from "./world";

const fresh = (scenario: "buffered" | "missed" | "minimum" = "buffered"): LabState => initialLabState(createScenarioSession(scenario));

/** Play the story up to and including the named step. */
function upTo(id: DirectorStepId, start: LabState = fresh()): LabState {
  return runDirector(start, DIRECTOR_STEPS.findIndex((s) => s.id === id) + 1);
}

const writes = (s: LabState): string[] =>
  s.world.sim.ledger.flatMap((e) => (e.kind === "api" && !e.readOnly ? [`${e.endpoint}:${e.envelope.error || "ok"}`] : e.kind === "host_app" ? [`host:${e.action}`] : []));
const codes = (s: LabState): string[] => s.world.notices.map((n) => n.code);

describe("the Demo Director", () => {
  it("replays byte-for-byte: two runs give the same call log, the same digest and the same records", () => {
    for (const scenario of SCENARIOS) {
      const a = runDirector(fresh(scenario.id));
      const b = runDirector(fresh(scenario.id));
      expect(JSON.stringify(a.world.sim.ledger), scenario.id).toBe(JSON.stringify(b.world.sim.ledger));
      expect(JSON.stringify(readsOf(a.world)), scenario.id).toBe(JSON.stringify(readsOf(b.world)));
      expect(callLogDigest(a.world.sim.ledger, readsOf(a.world))).toBe(callLogDigest(b.world.sim.ledger, readsOf(b.world)));
      expect(JSON.stringify(a.session.events)).toBe(JSON.stringify(b.session.events));
    }
  });

  it("is a 90 second story whose steps are in order", () => {
    const at = DIRECTOR_STEPS.map((s) => s.atMs);
    expect(at[0]).toBe(0);
    expect(at.at(-1)).toBe(DIRECTOR_DURATION_MS);
    expect(DIRECTOR_DURATION_MS).toBe(90_000);
    expect(at.every((t, i) => i === 0 || t > at[i - 1])).toBe(true);
    expect(new Set(DIRECTOR_STEPS.map((s) => s.id)).size).toBe(DIRECTOR_STEPS.length);
  });

  it("tells the plan's story: the full sequence of writes and host actions", () => {
    expect(writes(runDirector(fresh()))).toEqual([
      "create_session:ok", "add_item_list:ok", "start_session:ok", "create_promotion:ok",
      "update_show_item:ok",
      "host:pin_item",
      "end_session:ok",
    ]);
  });

  it("the show starts, then LiveLift opens the live and loads the planned products", () => {
    const started = upTo("show-starts");
    expect(started.session.lifecycle).toBe("active");
    expect(started.world.sim.ledger).toEqual([]);
    const opened = upTo("live-opens");
    const live = Object.values(opened.world.sim.sessions)[0];
    expect(live.status).toBe("ongoing");
    expect(live.items.map((i) => i.itemId)).toEqual([100001, 100002]);
    expect(opened.world.sim.promotions.map((p) => p.name)).toEqual(["Flash Sale announcement"]);
  });

  it("LiveLift's pin is performed with a request id and stays unverified", () => {
    const s = upTo("livelift-pins");
    const [record] = labRecords(s.session, s.trace);
    expect(record).toMatchObject({ state: "performed", source: "request_accepted" });
    expect(s.session.events.at(-1)?.summary).toMatch(/platform verification unknown/);
  });

  it("the host's pin is invisible to LiveLift until the next read, which records Provider observed (SIMULATED)", () => {
    const hosted = upTo("host-pins");
    expect(Object.values(hosted.world.sim.sessions)[0].showingItemId).toBe(100002);
    expect(labRecords(hosted.session, hosted.trace).map((r) => r.source)).toEqual(["request_accepted"]);
    const noticed = upTo("livelift-notices");
    expect(labRecords(noticed.session, noticed.trace)[0]).toMatchObject({ title: "Pin Cargo Pants", source: "provider_observed" });
  });

  it("authorisation expires: LiveLift says so once, keeps quiet while it lasts, and says when it recovers", () => {
    expect(codes(upTo("auth-expires")).filter((c) => c === "platform_problem")).toHaveLength(1);
    const manual = upTo("stays-manual");
    expect(codes(manual).filter((c) => c === "platform_problem")).toHaveLength(1);
    expect(manual.world.sync.problem).toMatch(/You are not authorized/);
    const back = upTo("recovers");
    expect(codes(back).filter((c) => c === "platform_recovered")).toHaveLength(1);
    expect(back.world.sync.problem).toBeNull();
  });

  it("the flash sale is active at its anchor, and the show moves to it", () => {
    const s = upTo("flash-sale");
    expect(new Date(labNow(s)).toISOString()).toBe("2026-10-03T13:12:00.000Z");
    expect(promotionStatus(s.world.sim.promotions[0], labNow(s))).toBe("active");
    const active = currentPlan(s.session).segments.find((g) => g.id === s.session.runtime.currentSegmentId);
    expect(active?.kind).toBe("promotion");
  });

  it("the live ends on the platform when the show ends, and the recap changes nothing", () => {
    const ended = upTo("live-ends");
    expect(ended.session.lifecycle).toBe("ended");
    expect(Object.values(ended.world.sim.sessions)[0].status).toBe("ended");
    const recap = upTo("recap");
    expect(recap.world.sim.ledger).toEqual(ended.world.sim.ledger);
    expect(readsOf(recap.world)).toEqual(readsOf(ended.world));
  });

  it("plays the same story on all three seeded rehearsals without a refused desk command", () => {
    for (const scenario of SCENARIOS) {
      const s = runDirector(fresh(scenario.id));
      expect(codes(s), scenario.id).not.toContain("show_refused");
      expect(codes(s), scenario.id).not.toContain("record_refused");
      expect(labRecords(s.session, s.trace).map((r) => r.source).sort(), scenario.id).toEqual(["provider_observed", "request_accepted"]);
    }
  });

  it("says why a plan cannot carry the story, and then does nothing", () => {
    const base = createScenarioSession("buffered");
    const plan = currentPlan(base);
    const make = (patch: Partial<Parameters<typeof createSession>[0]>): Session =>
      createSession({ id: "x", title: "x", environment: "SIMULATED", timezone: base.timezone, plannedStartMs: plan.plannedStartMs, nowMs: plan.plannedStartMs, products: base.products, segments: plan.segments, cues: plan.cues, ...patch });
    expect(directorAvailability(make({})).ok).toBe(true);
    expect(directorAvailability(make({ segments: plan.segments.filter((s) => s.kind !== "promotion") }))).toEqual({ ok: false, reason: "flash" });
    expect(directorAvailability(make({ products: base.products.slice(0, 1) }))).toEqual({ ok: false, reason: "products" });
    const unfit = initialLabState(make({ segments: plan.segments.filter((s) => s.kind !== "promotion") }));
    expect(applyDirectorStep(unfit, 0)).toBe(unfit);
  });
});
