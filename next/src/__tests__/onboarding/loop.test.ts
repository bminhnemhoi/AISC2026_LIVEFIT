import { describe, it, expect } from "vitest";
import type { Session } from "@/contracts";
import { deriveLoopGuide } from "@/components/onboarding/loop";
import { snapshotProducts } from "@/fixtures/library";
import { SCENARIO_BY_ID, applyCommand, createSession, seedSimulatorSessions } from "@/lib/domain";

const NOW = Date.UTC(2026, 9, 6, 13, 0, 0);

function real(id: string, lifecycle: "planned" | "active" | "ended"): Session {
  const { segments, cues } = SCENARIO_BY_ID.buffered.buildPlan(id);
  let s = createSession({
    id,
    title: `Real ${id}`,
    environment: "REAL",
    timezone: "UTC",
    plannedStartMs: NOW,
    nowMs: NOW,
    products: snapshotProducts(SCENARIO_BY_ID.buffered.productIds),
    segments,
    cues,
  });
  if (lifecycle !== "planned") s = applyCommand(s, { type: "start_live", nowMs: NOW }).session;
  if (lifecycle === "ended") s = applyCommand(s, { type: "end_live", nowMs: NOW + 60_000 }).session;
  expect(s.lifecycle).toBe(lifecycle);
  return s;
}

const step = (sessions: Session[], id: string) => deriveLoopGuide(sessions).steps.find((s) => s.id === id)!;

describe("loop guide: where the Create → Prepare → Operate → Review → Next LIVE loop can be entered", () => {
  it("names the five steps in order", () => {
    expect(deriveLoopGuide([]).steps.map((s) => s.label)).toEqual(["Create", "Prepare", "Operate", "Review", "Next LIVE"]);
  });

  it("with no shows at all, only Create is open and every other step says why not", () => {
    const guide = deriveLoopGuide([]);
    expect(guide.current).toBe("create");
    expect(step([], "create").href).toBe("/live/new");
    for (const id of ["prepare", "operate", "review", "next"]) expect(step([], id).href).toBeNull();
    expect(step([], "prepare").action).toMatch(/once you create/i);
    expect(step([], "review").action).toMatch(/when a show ends/i);
  });

  it("with only the shipped rehearsals, the visitor is still at Create, and rehearsal links are marked", () => {
    const sims = seedSimulatorSessions();
    expect(deriveLoopGuide(sims).current).toBe("create");
    const prepare = step(sims, "prepare");
    expect(prepare.href).toMatch(/^\/live\/sim-[^/]+\/prepare$/);
    expect(prepare.rehearsal).toBe(true);
    const review = step(sims, "review");
    expect(review.href).toBe("/live/sim-buffered-done/review");
    expect(review.rehearsal).toBe(true);
    // Nothing is running, so Operate has nothing to open.
    expect(step(sims, "operate").href).toBeNull();
  });

  it("a planned REAL show makes Prepare the next step, and is not marked as a rehearsal", () => {
    const sessions = [...seedSimulatorSessions(), real("r1", "planned")];
    const guide = deriveLoopGuide(sessions);
    expect(guide.current).toBe("prepare");
    const prepare = step(sessions, "prepare");
    expect(prepare.href).toBe("/live/r1/prepare");
    expect(prepare.rehearsal).toBe(false);
  });

  it("a running show makes Operate the next step, REAL or not", () => {
    const sessions = [...seedSimulatorSessions(), real("r1", "active")];
    expect(deriveLoopGuide(sessions).current).toBe("operate");
    expect(step(sessions, "operate").href).toBe("/live/r1/operate");

    const rehearsal = seedSimulatorSessions().map((s) =>
      s.id === "sim-buffered" ? applyCommand(s, { type: "start_live", nowMs: s.plans[0].plannedStartMs }).session : s
    );
    const g = deriveLoopGuide(rehearsal);
    expect(g.current).toBe("operate");
    expect(step(rehearsal, "operate").rehearsal).toBe(true);
  });

  it("an ended REAL show with nothing planned makes Review the next step", () => {
    const sessions = [...seedSimulatorSessions(), real("r1", "ended")];
    expect(deriveLoopGuide(sessions).current).toBe("review");
    expect(step(sessions, "review").href).toBe("/live/r1/review");
  });

  it("a REAL show is linked ahead of a rehearsal in the same stage", () => {
    const sessions = [...seedSimulatorSessions(), real("r1", "ended")];
    expect(step(sessions, "review").rehearsal).toBe(false);
  });
});
