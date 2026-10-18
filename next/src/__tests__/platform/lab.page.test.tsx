import React, { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { applyCommand, createScenarioSession, createSession, SCENARIO_START_MS } from "@/lib/domain";
import type { Session } from "@/contracts";
import { DIRECTOR_STEPS, callLogDigest, initialLabState, readsOf, runDirector } from "@/lib/platform";
import { PlatformLab } from "@/components/platform/lab/PlatformLab";
import { PlatformSyncPanel } from "@/components/platform/PlatformSyncPanel";

vi.mock("@/components/ops/SessionGate", () => ({
  SessionGate: ({ id, children }: { id: string; children: (s: Session, ctx: { source: "local"; archive: false }) => React.ReactNode }) => {
    const real = createSession({ id, title: "Real show", environment: "REAL", timezone: "Asia/Ho_Chi_Minh", plannedStartMs: SCENARIO_START_MS, nowMs: SCENARIO_START_MS });
    return <>{children(real, { source: "local", archive: false })}</>;
  },
}));

const FORBIDDEN = [/synced with Shopee/i, /connected to Shopee/i, /confirmed by Shopee/i, /real-time from Shopee/i];
const STORY = runDirector(initialLabState(createScenarioSession("buffered")));
const STORY_DIGEST = callLogDigest(STORY.world.sim.ledger, readsOf(STORY.world));

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(show: Session = createScenarioSession("buffered")) {
  return render(<PlatformLab show={show} />);
}

const digest = (): string => screen.getByTestId("wire-digest").getAttribute("data-digest") ?? "";
const stepAll = (): void => {
  for (let i = 0; i < DIRECTOR_STEPS.length; i++) fireEvent.click(screen.getByTestId("director-step"));
};

describe("the Platform Lab page", () => {
  it("shows the desk, the wire and the host's app, each marked SIMULATED, with the assumptions on the page", () => {
    mount();
    expect(within(screen.getByTestId("lab-desk")).getByText(/Pin on SIMULATED Live/)).toBeTruthy();
    expect(screen.getByTestId("lab-wire").textContent).toContain("SIMULATED Live");
    expect(screen.getByRole("region", { name: "Host's live app (SIMULATED)" })).toContainElement(screen.getByTestId("host-app"));
    expect(screen.getByTestId("host-app-simulated-badge").textContent).toMatch(/SIMULATED/);
    expect(screen.getByTestId("environment-badge-simulated")).toBeTruthy();
    expect(screen.getByTestId("lab-run-note").textContent).toMatch(/nothing is saved/);
    const strip = screen.getByTestId("assumptions");
    expect(strip.textContent).toContain("Not verified on a real platform");
    expect(within(strip).getByLabelText(/A1 ·/)).toBeChecked();
    expect(within(strip).getByLabelText(/A2 ·/)).toBeChecked();
  });

  it("steps through the story: the same call log as the pure Director, and Reset starts again", () => {
    mount();
    expect(screen.getByTestId("director-caption").textContent).toMatch(/Press Play/);
    fireEvent.click(screen.getByTestId("director-step"));
    fireEvent.click(screen.getByTestId("director-step"));
    expect(screen.getByTestId("director-caption").textContent).toMatch(/LiveLift opens a live on SIMULATED Live.*20:12 flash sale/);
    expect(screen.getAllByTestId("wire-call").map((n) => n.getAttribute("data-endpoint"))).toEqual(["create_session", "add_item_list", "start_session", "create_promotion"]);
    expect(screen.getByTestId("host-app-mode-live")).toBeTruthy();
    stepAll();
    expect(screen.getByTestId("director-progress").textContent).toBe(`Step ${DIRECTOR_STEPS.length} of ${DIRECTOR_STEPS.length}`);
    expect(digest()).toBe(STORY_DIGEST);
    expect(screen.getByTestId("lab-records").querySelector('[data-source="provider_observed"]')).toBeTruthy();
    expect(screen.getByTestId("lab-records").querySelector('[data-source="request_accepted"]')?.textContent).toMatch(/platform verification unknown/);
    fireEvent.click(screen.getByTestId("director-reset"));
    expect(screen.queryAllByTestId("wire-call")).toHaveLength(0);
    stepAll();
    expect(digest()).toBe(STORY_DIGEST);
  });

  it("Play runs the 90 second story to the end on its own, with the same call log", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    mount();
    fireEvent.click(screen.getByTestId("director-play"));
    act(() => {
      vi.advanceTimersByTime(91_000);
    });
    expect(screen.getByTestId("director-progress").textContent).toBe(`Step ${DIRECTOR_STEPS.length} of ${DIRECTOR_STEPS.length}`);
    expect(digest()).toBe(STORY_DIGEST);
    expect(screen.getByTestId("director-play")).toBeTruthy();
  });

  it("the host's pin on the phone is recorded by LiveLift as Provider observed (SIMULATED)", () => {
    mount();
    fireEvent.click(screen.getByTestId("lab-start"));
    fireEvent.click(screen.getByTestId("host-app-bag-button"));
    fireEvent.click(within(screen.getByTestId("bag-drawer")).getByRole("button", { name: "Pin Cargo Pants" }));
    expect(screen.getByTestId("pinned-card").textContent).toContain("Cargo Pants");
    const observed = screen.getByTestId("lab-records").querySelector('[data-source="provider_observed"]');
    expect(observed?.textContent).toContain("Provider observed (SIMULATED)");
    // On the wire: the host's pin on the host lane, then the read that noticed it, then the record it led to.
    const rows = within(screen.getByTestId("wire-rows")).getAllByRole("listitem");
    const record = rows.findIndex((n) => n.getAttribute("data-source") === "provider_observed");
    expect(rows[record - 1].getAttribute("data-endpoint")).toBe("get_session_detail");
    expect(rows.slice(0, record).some((n) => n.getAttribute("data-testid") === "wire-host")).toBe(true);
  });

  it("the phone's End ends the host's live, and the desk and the wire follow", () => {
    mount();
    fireEvent.click(screen.getByTestId("lab-start"));
    fireEvent.click(screen.getByRole("button", { name: "End live broadcast" }));
    expect(screen.getByTestId("host-app-mode-ended")).toBeTruthy();
    expect(screen.getAllByTestId("wire-host").at(-1)?.textContent).toMatch(/Ended the live/);
    expect(screen.getByTestId("lab-notices").textContent).toMatch(/The live ended on the platform/);
  });

  it("a call opens to show its JSON", () => {
    mount();
    fireEvent.click(screen.getByTestId("lab-start"));
    const call = screen.getAllByTestId("wire-call")[0];
    const button = within(call).getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("wire-json").textContent).toContain("POST /api/v2/livestream/create_session");
  });

  it("P switches presenter mode, but not while typing in a field", () => {
    mount();
    const lab = screen.getByTestId("platform-lab");
    expect(lab).toHaveAttribute("data-presenter", "off");
    fireEvent.keyDown(window, { key: "p" });
    expect(lab).toHaveAttribute("data-presenter", "on");
    expect(screen.queryByTestId("lab-sync-now")).toBeNull();
    fireEvent.keyDown(window, { key: "P" });
    expect(lab).toHaveAttribute("data-presenter", "off");
    fireEvent.keyDown(screen.getByTestId("lab-fault"), { key: "p" });
    expect(lab).toHaveAttribute("data-presenter", "off");
  });

  it("switches every Lab line to Vietnamese and back", () => {
    mount();
    fireEvent.click(screen.getByTestId("lab-lang-vi"));
    expect(screen.getByTestId("platform-lab")).toHaveAttribute("lang", "vi");
    expect(screen.getByTestId("director-caption").textContent).toMatch(/Nhấn Phát/);
    expect(screen.getByTestId("assumptions").textContent).toContain("Chưa kiểm chứng trên nền tảng thật");
    fireEvent.click(screen.getByTestId("director-step"));
    expect(screen.getByTestId("director-caption").textContent).toMatch(/Buổi live bắt đầu/);
    fireEvent.click(screen.getByTestId("lab-lang-en"));
    expect(screen.getByTestId("director-caption").textContent).toMatch(/The show starts/);
  });

  it("never claims a connection to Shopee, in either language, at any point of the story", () => {
    mount();
    for (const lang of ["en", "vi"] as const) {
      fireEvent.click(screen.getByTestId(`lab-lang-${lang}`));
      fireEvent.click(screen.getByTestId("director-reset"));
      for (let i = 0; i < DIRECTOR_STEPS.length; i++) {
        fireEvent.click(screen.getByTestId("director-step"));
        for (const bad of FORBIDDEN) expect(document.body.textContent, `${lang} step ${i}`).not.toMatch(bad);
      }
    }
  });

  it("leaves the stored show untouched and stores nothing but the viewer's own choices", () => {
    const show = applyCommand(createScenarioSession("buffered"), { type: "start_live", nowMs: 0 }).session;
    const before = JSON.stringify(show);
    mount(show);
    stepAll();
    expect(JSON.stringify(show)).toBe(before);
    const stored = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i) ?? "");
    expect(stored.filter((k) => !k.startsWith("livelift.lab."))).toEqual([]);
  });

  it("a show the story does not fit says why and keeps Play off", () => {
    const base = createScenarioSession("buffered");
    const plan = base.plans[0];
    mount(createSession({ id: "x", title: "No flash", environment: "SIMULATED", timezone: base.timezone, plannedStartMs: plan.plannedStartMs, nowMs: plan.plannedStartMs, products: base.products, segments: plan.segments.filter((s) => s.kind !== "promotion"), cues: plan.cues }));
    expect(screen.getByTestId("director-caption").textContent).toMatch(/needs a hard-anchored flash sale/);
    expect(screen.getByTestId("director-play")).toBeDisabled();
  });
});

describe("the route and the way in", () => {
  it("a REAL show is told the Lab is for SIMULATED shows, and sent back", async () => {
    const { default: LabPage } = await import("@/app/live/[sessionId]/lab/page");
    const params = Promise.resolve({ sessionId: "real-1" });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <LabPage params={params} />
        </Suspense>
      );
    });
    const box = await screen.findByTestId("lab-not-simulated");
    expect(box.textContent).toMatch(/Platform Lab is for SIMULATED shows/);
    expect(within(box).getByRole("link")).toHaveAttribute("href", "/live/real-1");
  });

  it("the Operate desk's Platform tab links to the Lab", () => {
    const show = applyCommand(createScenarioSession("buffered"), { type: "start_live", nowMs: 0 }).session;
    render(<PlatformSyncPanel session={show} nowMs={SCENARIO_START_MS} onRecord={() => undefined} />);
    expect(screen.getByTestId("platform-open-lab")).toHaveAttribute("href", `/live/${show.id}/lab`);
  });
});
