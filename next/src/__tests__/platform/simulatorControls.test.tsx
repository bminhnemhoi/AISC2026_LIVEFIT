import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SCENARIO_START_MS, createScenarioSession, effectiveNowMs } from "@/lib/domain";
import type { Session } from "@/contracts";
import { SimulatorStrip } from "@/components/ops/SimulatorStrip";
import { useSimulatorControls, type ClockCommand } from "@/components/platform/lab/useSimulatorControls";

const T = SCENARIO_START_MS;

function Harness({ session, run, scripted }: { session: Session; run: (b: ClockCommand) => void; scripted: boolean }): React.ReactElement {
  const sim = useSimulatorControls({
    session,
    nowMs: 0,
    nextAnchorMs: T + 12 * 60_000,
    run,
    script: scripted ? { apply: (say) => say("Step rejected. Skip it if you already did this by hand."), skip: (say) => say(null) } : undefined,
  });
  return <SimulatorStrip {...sim.strip} />;
}

afterEach(cleanup);

describe("useSimulatorControls, shared by Operate and the Lab", () => {
  it("each clock control sends the same command on every desk", () => {
    const run = vi.fn();
    render(<Harness session={createScenarioSession("buffered")} run={run} scripted={false} />);
    expect(screen.getByTestId("virtual-clock")).toHaveTextContent("20:00:00");
    fireEvent.click(screen.getByTestId("sim-plus-30s"));
    fireEvent.click(screen.getByTestId("sim-plus-5m"));
    fireEvent.click(screen.getByTestId("sim-to-anchor"));
    expect(run.mock.calls.map((c) => c[0])).toEqual([
      { type: "advance_clock", byMs: 30_000 },
      { type: "advance_clock", byMs: 300_000 },
      { type: "set_clock", toMs: T + 11 * 60_000 },
    ]);
  });

  it("offers the scenario script only where the desk asks for it, and shows what the script said", () => {
    const { unmount } = render(<Harness session={createScenarioSession("buffered")} run={vi.fn()} scripted={false} />);
    expect(screen.queryByTestId("sim-apply-step")).toBeNull();
    unmount();
    render(<Harness session={createScenarioSession("buffered")} run={vi.fn()} scripted />);
    expect(screen.getByTestId("sim-step-label")).toHaveTextContent("Start the simulated session at 20:00");
    fireEvent.click(screen.getByTestId("sim-apply-step"));
    expect(screen.getByRole("status")).toHaveTextContent("Skip it if you already did this by hand.");
    fireEvent.click(screen.getByTestId("sim-skip-step"));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Run / Pause for the rehearsal clock", () => {
  function RunHarness({ session, run, nextAnchorMs, autoRun = true }: { session: Session; run: (b: ClockCommand) => void; nextAnchorMs: number | null; autoRun?: boolean }): React.ReactElement {
    const sim = useSimulatorControls({ session, nowMs: 0, nextAnchorMs, run, autoRun });
    return <SimulatorStrip {...sim.strip} />;
  }
  const active = (): Session => ({ ...createScenarioSession("buffered"), lifecycle: "active" });

  afterEach(() => vi.useRealTimers());

  it("is absent unless the desk asks for it, so the Lab keeps its own timing", () => {
    render(<RunHarness session={active()} run={vi.fn()} nextAnchorMs={null} autoRun={false} />);
    expect(screen.queryByTestId("sim-run")).toBeNull();
  });

  it("sends one recorded advance_clock a second at the chosen speed, and stops on Pause", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    render(<RunHarness session={active()} run={run} nextAnchorMs={null} />);
    fireEvent.click(screen.getByTestId("sim-speed-60"));
    fireEvent.click(screen.getByTestId("sim-run"));
    expect(screen.getByTestId("sim-run")).toHaveAttribute("aria-pressed", "true");
    vi.advanceTimersByTime(3000);
    expect(run.mock.calls.map((c) => c[0])).toEqual(Array(3).fill({ type: "advance_clock", byMs: 60_000 }));
    fireEvent.click(screen.getByTestId("sim-run"));
    vi.advanceTimersByTime(3000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("pauses one minute before the next hard anchor instead of running past it", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const session = active();
    const start = effectiveNowMs(session, 0);
    render(<RunHarness session={session} run={run} nextAnchorMs={start + 60_000 + 20_000} />);
    fireEvent.click(screen.getByTestId("sim-speed-60"));
    fireEvent.click(screen.getByTestId("sim-run"));
    for (let second = 0; second < 5; second++) act(() => void vi.advanceTimersByTime(1000));
    expect(run.mock.calls.map((c) => c[0])).toEqual([{ type: "advance_clock", byMs: 20_000 }]);
    expect(screen.getByTestId("sim-run")).toHaveAttribute("aria-pressed", "false");
  });

  it("does not run an ended show", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    render(<RunHarness session={{ ...active(), lifecycle: "ended" }} run={run} nextAnchorMs={null} />);
    fireEvent.click(screen.getByTestId("sim-run"));
    vi.advanceTimersByTime(3000);
    expect(run).not.toHaveBeenCalled();
  });
});
