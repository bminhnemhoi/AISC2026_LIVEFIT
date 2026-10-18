import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Session } from "@/contracts";
import { applyCommand, createScenarioSession, createSession, newSegment, runScript } from "@/lib/domain";

const state = vi.hoisted(() => ({ sessions: [] as Session[], hydrated: true, connection: "connected", snapshot: {} as object | null, storage: "ok" }));
vi.mock("@/components/shell", () => ({ StandardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/ops/ConnectionStatus", () => ({ RoomStatusPanel: () => null }));
vi.mock("@/lib/store/hooks", () => ({
  useSessions: () => ({ hydrated: state.hydrated, sessions: state.sessions, remote: { snapshot: state.snapshot, connection: state.connection, problem: null } }),
  useStoreState: () => ({ storage: state.storage, notices: [] }),
}));
import InsightsPage from "@/app/insights/page";

afterEach(cleanup);
beforeEach(() => { state.sessions = []; state.hydrated = true; state.connection = "connected"; state.snapshot = {}; state.storage = "ok"; });

describe("Insights evidence UI", () => {
  it("exposes measured zero and missing actual distinctly in the same accessible timing table", () => {
    const initial = createSession({ id: "zero-and-missing", title: "Zero and missing", environment: "SIMULATED", timezone: "UTC", plannedStartMs: 0, nowMs: 0,
      segments: [newSegment("opening", { title: "Opening", kind: "opening", targetSec: 60, minSec: 0 }), newSegment("closing", { title: "Unreached", kind: "closing", targetSec: 60 })], cues: [],
    });
    const started = applyCommand(initial, { type: "start_live", nowMs: 0 }).session;
    state.sessions = [applyCommand(started, { type: "end_live", nowMs: 0 }).session];
    render(<InsightsPage />);
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "SIMULATED" } });
    const table = screen.getByRole("table", { name: "Segment timing and operator-declared coverage" });
    const headings = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    const actual = headings.indexOf("Actual") - 1;
    const difference = headings.indexOf("Duration difference") - 1;
    const zeroRow = within(table).getByRole("row", { name: /^Opening / });
    const missingRow = within(table).getByRole("row", { name: /^Unreached / });
    expect(within(zeroRow).getAllByRole("cell")[actual]).toHaveTextContent(/^0:00$/);
    expect(within(zeroRow).getAllByRole("cell")[difference]).toHaveTextContent(/^−1:00 · underrun$/);
    expect(within(missingRow).getAllByRole("cell")[actual]).toHaveTextContent(/^Not recorded$/);
    expect(within(missingRow).getAllByRole("cell")[difference]).toHaveTextContent(/^Unknown$/);
  });

  it("has truthful empty, loading, unavailable and stale states", () => {
    const rendered = render(<InsightsPage />);
    expect(screen.getByTestId("insights-empty")).toHaveTextContent("No sessions match");
    state.snapshot = null;
    rendered.rerender(<InsightsPage />);
    expect(screen.getByTestId("insights-empty")).toHaveTextContent("does not mean there were no REAL shows");
    state.connection = "connecting";
    rendered.rerender(<InsightsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading history");
    state.snapshot = {};
    state.connection = "stale";
    rendered.rerender(<InsightsPage />);
    expect(screen.getByTestId("insights-stale")).toHaveTextContent("may be incomplete");
  });

  it("filters environments and states, exposes equivalent values, and leaves provider metrics unavailable", () => {
    const sim = runScript(createScenarioSession("buffered"));
    state.sessions = [sim, createScenarioSession("minimum"), { ...structuredClone(sim), id: "real", environment: "REAL", title: "REAL observed operations" }];
    render(<InsightsPage />);
    expect(screen.getByTestId("analytics-summaries")).toHaveTextContent("REAL observed operations");
    expect(screen.getByTestId("analytics-summaries")).not.toHaveTextContent(sim.title);
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "SIMULATED" } });
    expect(screen.getByTestId("analytics-summaries")).not.toHaveTextContent("REAL observed operations");
    expect(screen.getByTestId("analytics-detail")).toHaveTextContent("SIMULATED reports are rehearsal evidence");
    expect(screen.getByTestId("analytics-detail")).toHaveTextContent("Platform verification: unknown");
    const timing = screen.getByRole("table", { name: "Segment timing and operator-declared coverage" });
    expect(within(timing).getByText("+3:00 · overrun")).toBeInTheDocument();
    expect(timing.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThan(0);
    expect(timing.parentElement?.tabIndex).toBe(0);
    expect(screen.getByText(/Unavailable: no provider-observed/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Show state"), { target: { value: "planned" } });
    expect(screen.getByTestId("analytics-summaries")).toHaveTextContent("minimum exhausted");
    expect(screen.getByTestId("analytics-detail")).toHaveTextContent("Not recorded");
    fireEvent.change(screen.getByLabelText("From date (UTC)"), { target: { value: "2027-01-01" } });
    expect(screen.getByTestId("insights-empty")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId("analytics-summaries")).toHaveTextContent(sim.title);
  });

  it("draws overrun in amber, explains the colours, and says 'not recorded' instead of drawing a missing value as zero", () => {
    const sim = runScript(createScenarioSession("buffered"));
    state.sessions = [sim, createScenarioSession("minimum")];
    render(<InsightsPage />);
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "SIMULATED" } });
    expect(screen.getAllByRole("list", { name: "Chart key" })[0]).toHaveTextContent("Recorded, overrun");
    const timing = screen.getByRole("table", { name: "Segment timing and operator-declared coverage" });
    const overrunRow = within(timing).getByText("+3:00 · overrun").closest("tr") as HTMLElement;
    expect(overrunRow.querySelector("rect[fill='#F6C875']")).not.toBeNull();
    expect(overrunRow.querySelector("rect[fill='#DFFF00']")).toBeNull();
    fireEvent.change(screen.getByLabelText("Show state"), { target: { value: "planned" } });
    const planned = screen.getByRole("table", { name: "Segment timing and operator-declared coverage" });
    expect(within(planned).getAllByText("not recorded").length).toBeGreaterThan(0);
    // A value that is missing has no bar at all; the only rects are the planned ones.
    expect(planned.querySelectorAll("rect[fill='#DFFF00'], rect[fill='#F6C875'], rect[fill='#5FD3C0']")).toHaveLength(0);
  });

  it("lists each provider metric as unavailable, never as a number", () => {
    render(<InsightsPage />);
    const list = screen.getByRole("list", { name: "Provider metrics, all unavailable" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    for (const li of within(list).getAllByRole("listitem")) expect(li).toHaveTextContent("Unavailable");
    expect(list.textContent).not.toMatch(/\d/);
  });
});
