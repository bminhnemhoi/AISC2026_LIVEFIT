import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React, { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/",
  useSearchParams: () => nav.search,
}));

import HomePage from "@/app/page";
import CreateLivePage from "@/app/live/new/page";
import PreparePage from "@/app/live/[sessionId]/prepare/page";
import OperatePage from "@/app/live/[sessionId]/operate/page";
import ReviewPage from "@/app/live/[sessionId]/review/page";
import SessionsPage from "@/app/sessions/page";
import SimulatorPage from "@/app/simulator/page";
import ProductsPage from "@/app/products/page";
import IntegrationsPage from "@/app/integrations/page";
import { sessionStore } from "@/lib/store/sessionStore";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { FakeRoom } from "./helpers/fakeRoom";
import { authStore } from "@/lib/client/authStore";
import { snapshotProducts } from "@/fixtures/library";
import type { Session } from "@/contracts";
import { scrollCurrentRowIntoView } from "@/components/ops/RunOfShowLive";
import { SCENARIO_BY_ID, SCENARIO_START_MS as SCENARIO_START, applyCommand, createSession } from "@/lib/domain";

type PageComponent = (props: { params: Promise<{ sessionId: string }> }) => React.ReactElement;

async function renderPage(Page: PageComponent, sessionId: string): Promise<void> {
  const params = Promise.resolve({ sessionId });
  await act(async () => {
    render(
      <Suspense fallback={<div>loading</div>}>
        <Page params={params} />
      </Suspense>
    );
  });
}

async function renderPlain(node: React.ReactElement): Promise<void> {
  await act(async () => {
    render(node);
  });
}

/** Apply the first n scripted steps of a stored rehearsal. */
function advanceRehearsal(id: string, steps: number): void {
  for (let i = 0; i < steps; i++) {
    const r = sessionStore.applyNextScriptStep(id);
    if (!r?.receipt || r.receipt.outcome === "rejected") throw new Error(`step ${i} failed`);
  }
}

/** Run a stored rehearsal's script to the end through the store. */
function finishRehearsal(id: string): void {
  for (;;) {
    const r = sessionStore.applyNextScriptStep(id);
    if (!r || !r.step || !r.receipt || r.receipt.outcome === "rejected") return;
  }
}

let restoreFetch: (() => void) | null = null;

/** REAL shows live in the room: stand up a contract-speaking room for the test. */
function openRoom(room = new FakeRoom()): FakeRoom {
  restoreFetch = room.install();
  return room;
}

/** A REAL show built from the 30-minute template, as the room would hold it (planned, not started). */
function templateShow(room: FakeRoom, id: string, title: string, timezone = "UTC"): Session {
  const template = SCENARIO_BY_ID.buffered;
  const { segments, cues } = template.buildPlan(id);
  return createSession({
    id,
    title,
    environment: "REAL",
    timezone,
    plannedStartMs: room.nowMs,
    nowMs: room.nowMs,
    products: snapshotProducts(template.productIds),
    segments,
    cues,
  });
}

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

beforeEach(() => {
  sessionStorage.clear();
  authStore.reset();
  localStorage.clear();
  remoteRoomStore.reset();
  sessionStore.reloadFromStorage();
  nav.push.mockClear();
  nav.replace.mockClear();
  nav.search = new URLSearchParams();
});

describe("Home, Sessions, Simulator", () => {
  it("first run shows no fabricated REAL history, only the Simulator entry", async () => {
    openRoom(); // a signed-in, connected room with no shows: only then is "first run" the truth
    await renderPlain(<HomePage />);
    expect(await screen.findByTestId("first-run")).toBeInTheDocument();
    expect(screen.getByTestId("try-simulator-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("active-live-card")).toBeNull();
    // Every show on this device at first run is a rehearsal and is labelled as one.
    const prepared = within(screen.getByTestId("prepared-list"));
    expect(prepared.getAllByTestId("environment-badge-simulated").length).toBeGreaterThan(0);
    expect(prepared.queryByTestId("environment-badge-real")).toBeNull();
  });

  it("an active show takes the priority slot with a Continue LIVE link", async () => {
    advanceRehearsal("sim-buffered", 2);
    await renderPlain(<HomePage />);
    const card = await screen.findByTestId("active-live-card");
    expect(card).toHaveTextContent("Zip Hoodie");
    expect(card).toHaveTextContent("SIMULATED · Tracking active");
    expect(screen.getByTestId("continue-live-btn").closest("a")).toHaveAttribute("href", "/live/sim-buffered/operate");
  });

  it("Sessions lists shows by environment and offers Duplicate", async () => {
    await renderPlain(<SessionsPage />);
    expect(await screen.findByTestId("sessions-table")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-sim-buffered")).toBeInTheDocument();
    const envFilter = screen.getByLabelText("Environment");
    fireEvent.change(envFilter, { target: { value: "REAL" } });
    expect(await screen.findByTestId("sessions-empty")).toBeInTheDocument();
  });

  it("the Simulator page names the scenarios, what to watch for, and that it is SIMULATED", async () => {
    await renderPlain(<SimulatorPage />);
    expect(await screen.findByTestId("scenario-list")).toBeInTheDocument();
    expect(screen.getByTestId("sim-explainer")).toHaveTextContent("virtual clock");
    expect(screen.getByTestId("scenario-minimum")).toHaveTextContent("No feasible recovery under current constraints");
    expect(screen.getByTestId("completed-rehearsals")).toBeInTheDocument();
  });

  it("Products and Integrations render honest static surfaces", async () => {
    await renderPlain(<ProductsPage />);
    expect(screen.getByTestId("products-grid")).toBeInTheDocument();
    expect(screen.getByText("Not entered")).toBeInTheDocument(); // M04 has no price — never 0
    const integrations = await (async () => {
      await renderPlain(<IntegrationsPage />);
      return screen.getByTestId("integrations-list");
    })();
    expect(integrations).toHaveTextContent("Unsupported");
    expect(integrations).not.toHaveTextContent("Configure");
  });
});

describe("Create LIVE", () => {
  it("creates a REAL show in the room from the 30-minute template and opens Prepare", async () => {
    const room = openRoom();
    await renderPlain(<CreateLivePage />);
    fireEvent.click(await screen.findByTestId("start-template"));
    const submit = screen.getByTestId("submit-create-live-btn");
    // A REAL show can only be created while the room is reachable and this browser is an operator.
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText(/Session title/), { target: { value: "Friday launch" } });
    await act(async () => {
      fireEvent.click(submit);
    });
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const created = room.sessions;
    expect(created.length).toBe(1);
    expect(created[0].environment).toBe("REAL");
    expect(created[0].title).toBe("Friday launch");
    expect(created[0].plans[0].segments.length).toBe(6);
    expect(created[0].lifecycle).toBe("planned");
    expect(created[0].operator.name).toBe("Mai"); // identity comes from the signed-in account, not the form
    expect(nav.push).toHaveBeenCalledWith(`/live/${created[0].id}/prepare`);
    // The browser keeps no REAL authority of its own.
    expect(sessionStore.list("REAL")).toEqual([]);
    expect(localStorage.getItem("livelift.v3.REAL")).toBeNull();
  });

  it("copying a previous session is limited to the same environment", async () => {
    openRoom(); // Only a loaded room can establish that there are no REAL shows to copy.
    nav.search = new URLSearchParams("from=sim-buffered");
    await renderPlain(<CreateLivePage />);
    await screen.findByTestId("previous-picker");
    expect(screen.getByTestId("simulated-toggle")).toBeChecked();
    fireEvent.click(screen.getByTestId("simulated-toggle")); // switch to REAL
    expect(await screen.findByText(/no REAL session to copy/i)).toBeInTheDocument();
  });
});

describe("Competition workflow polish", () => {
  it("copying a completed REAL show explains inherited details and uses its timezone", async () => {
    const room = openRoom();
    let source = templateShow(room, "real-1", "Completed source", "UTC");
    source = applyCommand(source, { type: "start_live", nowMs: room.nowMs }).session;
    source = applyCommand(source, { type: "end_live", nowMs: room.nowMs + 60_000 }).session;
    room.seed(source);
    nav.search = new URLSearchParams("from=real-1");
    await renderPlain(<CreateLivePage />);
    await screen.findByTestId("previous-picker");
    expect(screen.getByLabelText("Timezone")).toBeDisabled();
    expect(screen.getByLabelText("Timezone")).toHaveValue("UTC");
    expect(screen.getByText(/timezone, objective and account label carry forward/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Planned date"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("Planned start"), { target: { value: "21:00" } });
    await act(async () => { fireEvent.click(screen.getByTestId("submit-create-live-btn")); });
    await waitFor(() => expect(room.sessions.length).toBe(2));
    expect(room.sessions[1].timezone).toBe("UTC");
    expect(room.sessions[1].plans[0].plannedStartMs).toBe(Date.parse("2026-10-10T21:00:00Z"));
    expect(room.posts().at(-1)!.type).toBe("create_next");
  });

  it("explains missing Create fields and selects the sample pack linked from Products", async () => {
    nav.search = new URLSearchParams("env=sim&pack=pack_02");
    await renderPlain(<CreateLivePage />);
    expect(screen.getByTestId("start-pack")).toBeChecked();
    expect(screen.getByLabelText("Pack")).toHaveValue("pack_02");
    fireEvent.change(screen.getByLabelText(/Session title/), { target: { value: " " } });
    expect(screen.getByTestId("submit-create-live-btn")).toBeDisabled();
    expect(screen.getByText("Enter a title, planned date and valid start time to create this LIVE.")).toBeInTheDocument();
  });

  it("does not describe unavailable previous REAL shows as an empty catalog", async () => {
    const room = openRoom();
    room.offline = true;
    await renderPlain(<CreateLivePage />);
    fireEvent.click(screen.getByTestId("start-previous"));
    expect(screen.getByTestId("previous-picker")).toHaveTextContent("Previous REAL shows have not loaded");
    expect(screen.getByTestId("previous-picker")).not.toHaveTextContent("There is no REAL session");
  });

  it("clears all Sessions filters and ignores spaces around a search", async () => {
    openRoom();
    await renderPlain(<SessionsPage />);
    fireEvent.change(screen.getByLabelText("Find a session"), { target: { value: "  Fall collection  " } });
    expect(screen.getByTestId("session-row-sim-buffered")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Show state"), { target: { value: "ended" } });
    expect(screen.getByTestId("sessions-empty")).toHaveTextContent("No sessions match");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Find a session")).toHaveValue("");
    expect(screen.getByLabelText("Show state")).toHaveValue("all");
    expect(screen.getByTestId("session-row-sim-buffered")).toBeInTheDocument();
  });

  it.each([["", null], ["0", 0]])("edits a linked product with price %s while preserving references and sample origin", async (input, expected) => {
    const before = structuredClone(sessionStore.getSession("sim-buffered")!);
    await renderPage(PreparePage as PageComponent, before.id);
    fireEvent.click(within(screen.getByTestId("prepare-product-list")).getByText("Cargo Pants"));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Updated cargo" } });
    fireEvent.change(screen.getByLabelText("Price (optional)"), { target: { value: input } });
    fireEvent.change(screen.getByLabelText("Operator notes"), { target: { value: "Explain sizing" } });
    fireEvent.click(screen.getByRole("button", { name: "Save product details" }));
    const after = sessionStore.getSession(before.id)!;
    expect(after.products.find((p) => p.code === "M03")).toMatchObject({ name: "Updated cargo", price: expected, notes: "Explain sizing", source: "sample_library" });
    expect(after.plans[0].segments).toEqual(before.plans[0].segments);
    expect(after.plans[0].cues).toEqual(before.plans[0].cues);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Change saved to this rehearsal's plan");
  });

  it("validates product details and retains the input when browser storage refuses a save", async () => {
    await renderPage(PreparePage as PageComponent, "sim-buffered");
    fireEvent.click(within(screen.getByTestId("prepare-product-list")).getByText("Cargo Pants"));
    const save = screen.getByRole("button", { name: "Save product details" });
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: " " } });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "My cargo" } });
    fireEvent.change(screen.getByLabelText("Price (optional)"), { target: { value: "-1" } });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Price (optional)"), { target: { value: "42" } });
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("QuotaExceededError"); });
    fireEvent.click(save);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Product name")).toHaveValue("My cargo");
    expect(screen.getByTestId("dialog-command-error")).toBeInTheDocument();
    expect(sessionStore.getSession("sim-buffered")!.products.find((p) => p.code === "M03")!.name).toBe("Cargo Pants");
    spy.mockRestore();
    fireEvent.click(save);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sessionStore.getSession("sim-buffered")!.products.find((p) => p.code === "M03")!.name).toBe("My cargo");
  });

  it("saves REAL product details through save_prepare and does not claim an unknown outcome was saved", async () => {
    const room = openRoom();
    room.seed(templateShow(room, "real-1", "Real products"));
    await renderPage(PreparePage as PageComponent, "real-1");
    fireEvent.click(within(await screen.findByTestId("prepare-product-list")).getByText("Cargo Pants"));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Real cargo" } });
    room.loseNextResponses = 1;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save product details" })); });
    expect(room.posts().at(-1)!.type).toBe("save_prepare");
    expect(room.sessions[0].products.find((p) => p.code === "M03")!.name).toBe("Real cargo");
    expect(screen.getByTestId("save-status")).toHaveTextContent("Action outcome unknown");
    expect(document.body.textContent).not.toContain("Change saved to this show's plan");
    await act(async () => { await remoteRoomStore.refreshNow(); });
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveTextContent("Saved to the room"));
  });

  it("shows a pending REAL save and disables product inputs until confirmation", async () => {
    const room = openRoom();
    room.seed(templateShow(room, "real-1", "Pending product edit"));
    await renderPage(PreparePage as PageComponent, "real-1");
    fireEvent.click(within(await screen.findByTestId("prepare-product-list")).getByText("Cargo Pants"));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Confirmed cargo" } });
    const fetchRoom = globalThis.fetch;
    let release: (() => Promise<void>) | undefined;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (init?.method === "POST") return new Promise<Response>((resolve) => {
        release = async () => resolve(await fetchRoom(input, init));
      });
      return fetchRoom(input, init);
    });
    fireEvent.click(screen.getByRole("button", { name: "Save product details" }));
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveTextContent("Waiting for confirmation"));
    expect(screen.getByLabelText("Product name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Waiting for confirmation…" })).toBeDisabled();
    expect(room.sessions[0].products.find((p) => p.code === "M03")!.name).toBe("Cargo Pants");
    await act(async () => { await release!(); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(room.sessions[0].products.find((p) => p.code === "M03")!.name).toBe("Confirmed cargo");
    spy.mockRestore();
  });

  it("keeps the operating history scroll region reachable by keyboard", async () => {
    advanceRehearsal("sim-buffered", 2);
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    const history = screen.getByRole("tabpanel", { name: "History" });
    expect(history).toHaveAttribute("tabindex", "0");
    history.focus();
    expect(history).toHaveFocus();
  });

  it("previews Next LIVE at the selected start and creates exactly that schedule without changing history", async () => {
    nav.search = new URLSearchParams("view=next");
    await renderPage(ReviewPage as PageComponent, "sim-buffered-done");
    const before = JSON.stringify(sessionStore.getSession("sim-buffered-done"));
    fireEvent.change(screen.getByLabelText("Planned date"), { target: { value: "2026-10-08" } });
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "21:00" } });
    expect(screen.getByTestId("next-plan-start")).toHaveTextContent("Oct 8 · 21:00:00 · Asia/Ho_Chi_Minh");
    expect(screen.getByTestId("clone-preview")).toHaveTextContent("21:12:00");
    expect(screen.getByTestId("clone-preview")).not.toHaveTextContent("20:12:00");
    fireEvent.click(screen.getByTestId("create-next-live-cta-btn"));
    const created = sessionStore.list("SIMULATED").find((s) => s.derivedFrom?.sessionId === "sim-buffered-done")!;
    expect(created.plans[0].plannedStartMs).toBe(Date.parse("2026-10-08T21:00:00+07:00"));
    expect(created.plans[0].segments.find((s) => s.title === "Flash Sale announcement")!.anchorOffsetSec).toBe(720);
    expect(created.events).toEqual([]);
    expect(JSON.stringify(sessionStore.getSession("sim-buffered-done"))).toBe(before);
  });

  it("explains an invalid Next LIVE date instead of silently disabling Create", async () => {
    nav.search = new URLSearchParams("view=next");
    await renderPage(ReviewPage as PageComponent, "sim-buffered-done");
    fireEvent.change(screen.getByLabelText("Planned date"), { target: { value: "" } });
    expect(screen.getByTestId("create-next-live-cta-btn")).toBeDisabled();
    expect(screen.getByTestId("next-plan-start")).toHaveTextContent("Choose a valid date");
    expect(screen.getByText("Enter a title, planned date and valid start time to create the next LIVE.")).toBeInTheDocument();
  });

  it("Review distinguishes recorded reports from missing confirmation and Products offers a pack handoff", async () => {
    await renderPage(ReviewPage as PageComponent, "sim-buffered-done");
    expect(screen.getByTestId("review-reading-note")).toHaveTextContent("A report or attempt may still be recorded");
    expect(screen.getByTestId("review-reading-note")).not.toHaveTextContent("mean nothing was recorded");
    cleanup();
    await renderPlain(<ProductsPage />);
    fireEvent.click(screen.getByRole("tab", { name: /Packs/ }));
    fireEvent.click(screen.getByTestId("inspect-pack-pack_02"));
    expect(screen.getByRole("link", { name: "Create LIVE with this sample pack" })).toHaveAttribute("href", "/live/new?pack=pack_02");
  });
});

describe("Prepare", () => {
  it("shows the timed Run of Show with the anchor buffer and zero-duration cues", async () => {
    await renderPage(PreparePage as PageComponent, "sim-buffered");
    expect(await screen.findByTestId("prepare-ros-list")).toBeInTheDocument();
    expect(screen.getByTestId("buffer-row")).toHaveTextContent("Idle buffer 3:00 until the 20:12:00 anchor");
    expect(screen.getByTestId("ros-summary")).toHaveTextContent("6 segments");
    expect(screen.getByTestId("ros-summary")).toHaveTextContent("4 zero-duration cues");
    expect(screen.getByTestId("schedule-impact")).toHaveTextContent("Flash Sale announcement");
    expect(screen.getByTestId("plan-ready")).toBeInTheDocument();
    expect(screen.getByTestId("rehearsal-guide")).toBeInTheDocument();
  });

  it("MISSING != ZERO: a missing duration blocks Start and reads 'Not entered'", async () => {
    sessionStore.editDraft("sim-missed", (d) => {
      d.plans[0].segments[3].targetSec = null;
    });
    await renderPage(PreparePage as PageComponent, "sim-missed");
    expect(await screen.findByTestId("plan-blocked")).toHaveTextContent("Resolve 1 blocker");
    expect(screen.getByTestId("duration-missing")).toHaveTextContent("Not entered");
    expect(screen.getByTestId("start-live-cta-btn")).toBeDisabled();
  });

  it("a plan that cannot meet its own anchor is disclosed with the exact deficit and cannot start (UI-05)", async () => {
    sessionStore.editDraft("sim-missed", (d) => {
      d.plans[0].segments[0].targetSec = 7 * 60; // Opening 7m + Zip Hoodie 6m arrives 20:13, one minute after the anchor
    });
    await renderPage(PreparePage as PageComponent, "sim-missed");
    const deficits = await screen.findAllByTestId("deficit-row");
    expect(deficits[0]).toHaveTextContent("Arrives 20:13:00");
    expect(deficits[0]).toHaveTextContent("1:00 after its 20:12:00 anchor");
    expect(deficits[1]).toHaveTextContent("1:00 after its 20:26:00 anchor"); // the delay carries through to Closing
    expect(screen.getByTestId("readiness-issues")).toHaveTextContent("cannot start at 20:12:00");
    expect(screen.getByTestId("plan-blocked")).toBeInTheDocument(); // not "Plan ready"
    expect(screen.queryByTestId("plan-ready")).toBeNull();
    expect(screen.getByTestId("start-live-cta-btn")).toBeDisabled();
  });

  it("Start LIVE locks the baseline, starts the show and opens the desk", async () => {
    await renderPage(PreparePage as PageComponent, "sim-buffered");
    // A SIMULATED show never says "Start LIVE": it names the mode and says nothing is broadcast.
    const cta = await screen.findByTestId("start-live-cta-btn");
    expect(cta).toHaveTextContent("Start SIMULATED session");
    expect(cta).not.toHaveTextContent("Start LIVE");
    expect(screen.getByTestId("start-helper")).toHaveTextContent("Nothing is broadcast");
    fireEvent.click(cta);
    await act(async () => {});
    const s = sessionStore.getSession("sim-buffered")!;
    expect(s.lifecycle).toBe("active");
    expect(s.baselineLocked).toBe(true);
    expect(nav.push).toHaveBeenCalledWith("/live/sim-buffered/operate");
  });

  it("an unknown id is a real not-found state — never another show", async () => {
    openRoom();
    await renderPage(PreparePage as PageComponent, "no-such-show");
    expect(await screen.findByTestId("session-not-found")).toHaveTextContent("no-such-show");
    expect(screen.queryByTestId("prepare-ros-list")).toBeNull();
  });

  it("an unknown id is NOT 'not found' while the room cannot be reached", async () => {
    const room = openRoom();
    room.offline = true;
    await renderPage(PreparePage as PageComponent, "real-1");
    expect(await screen.findByTestId("session-unavailable")).toHaveTextContent("cannot tell you whether");
    expect(screen.queryByTestId("session-not-found")).toBeNull();
  });
});

describe("Operate desk", () => {
  it("shows NOW, NEXT, WHY and ACTION when the host estimate puts the anchor at risk", async () => {
    advanceRehearsal("sim-buffered", 3); // 20:07 — host: Zip Hoodie needs 6 more minutes
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    expect(await screen.findByTestId("now-panel")).toBeInTheDocument();
    expect(screen.getByTestId("now-title")).toHaveTextContent("Zip Hoodie");
    expect(screen.getByTestId("now-actual-elapsed")).toHaveTextContent("4:00");
    expect(screen.getByTestId("next-title")).toHaveTextContent("Flash Sale announcement");
    const why = screen.getByTestId("why-box");
    expect(why).toHaveTextContent("committed for 20:12:00");
    expect(why).toHaveTextContent("20:13:00");
    expect(why).toHaveTextContent("1:00 late");
    expect(screen.getByTestId("recovery-option-end_by")).toHaveTextContent("End Zip Hoodie by 20:12:00");
    expect(screen.getByTestId("ros-row-sim-buffered:flash")).toHaveTextContent("Hard anchor 20:12:00");
    expect(screen.getByTestId("projected-finish")).toBeInTheDocument();
    expect(screen.getByTestId("virtual-clock")).toHaveTextContent("20:07:00");
    expect(screen.getByTestId("simulator-strip")).toHaveTextContent("SIMULATED");
  });

  it("applying the clean option records the decision and leaves the anchor at 20:12:00", async () => {
    advanceRehearsal("sim-buffered", 3);
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    fireEvent.click(await screen.findByTestId("apply-end_by"));
    await act(async () => {});
    const s = sessionStore.getSession("sim-buffered")!;
    expect(s.events.some((e) => e.type === "recovery_selected")).toBe(true);
    expect(s.plans[0].segments[2].anchorOffsetSec).toBe(12 * 60); // baseline untouched
    expect(s.plans[s.plans.length - 1].segments[2].anchorOffsetSec).toBe(12 * 60); // current plan too
    expect(screen.getByTestId("command-ack-banner")).toHaveTextContent("committed to end by 20:12:00");
    expect(screen.getByTestId("why-box")).toHaveTextContent("On track");
    expect(screen.getByTestId("ros-row-sim-buffered:flash")).toHaveTextContent("Hard anchor 20:12:00");
  });

  it("says plainly when no clean recovery exists, and offers only exceptions and commitment changes", async () => {
    advanceRehearsal("sim-minimum", 2); // 20:07 — Zip Hoodie cannot reach its minimum before 20:12
    await renderPage(OperatePage as PageComponent, "sim-minimum");
    expect(await screen.findByTestId("no-feasible-recovery")).toHaveTextContent("No feasible recovery under current constraints");
    const list = screen.getByTestId("recovery-list");
    expect(within(list).queryByTestId("apply-shorten_pending")).toBeNull();
    expect(list).toHaveTextContent(/Exception|Commitment change/);
  });

  it("an exception needs explicit acknowledgement before it is recorded", async () => {
    advanceRehearsal("sim-minimum", 2);
    await renderPage(OperatePage as PageComponent, "sim-minimum");
    fireEvent.click(await screen.findByTestId("apply-close_now"));
    await act(async () => {});
    expect(screen.getByTestId("ack-message")).toHaveTextContent(/minimum/);
    expect(sessionStore.getSession("sim-minimum")!.runtime.currentSegmentId).toContain(":a"); // nothing happened yet
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply with exception" }));
    });
    const s = sessionStore.getSession("sim-minimum")!;
    expect(s.runtime.segments["sim-minimum:a"].belowMinimum).toBe(true);
    expect(s.runtime.segments["sim-minimum:a"].coverage).toBe("partial");
  });

  it("Choose next refuses to cross a hard anchor and says why", async () => {
    advanceRehearsal("sim-buffered", 2);
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    fireEvent.click(await screen.findByTestId("choose-next-btn"));
    await act(async () => {});
    const list = screen.getByTestId("choose-next-list");
    expect(list).toHaveTextContent("Already next");
    expect(list).toHaveTextContent("hard anchor");
    expect(screen.getByTestId("choose-next-sim-buffered:b")).toBeDisabled();
  });

  it("a cue report is a report: attempted stays unknown, performed stays unverified", async () => {
    advanceRehearsal("sim-buffered", 5); // 20:12 — Flash Sale running, its cue is due
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    expect(await screen.findByTestId("cue-title")).toHaveTextContent("Activate Flash Sale in TikTok");
    await act(async () => {
      fireEvent.click(screen.getByTestId("cue-attempted-btn"));
    });
    const s = sessionStore.getSession("sim-buffered")!;
    expect(s.runtime.cues["sim-buffered:cue-flash"].state).toBe("attempted");
    expect(screen.getByTestId("ros-cue-sim-buffered:cue-flash")).toHaveTextContent("Attempted · outcome unknown");
  });

  it("only a running show has a desk; a planned or ended show points to where the work is", async () => {
    await renderPage(OperatePage as PageComponent, "sim-minimum");
    expect(await screen.findByTestId("operate-not-running")).toHaveTextContent("has not started");
  });

  it("End LIVE shows what will be recorded, freezes the runtime and opens Review", async () => {
    advanceRehearsal("sim-buffered", 5);
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    fireEvent.click(await screen.findByTestId("end-live-header-btn"));
    await act(async () => {});
    const dialog = screen.getByTestId("end-live-dialog");
    // A SIMULATED rehearsal never claims to stop a platform broadcast: none exists.
    expect(dialog).toHaveTextContent("Nothing was broadcast");
    expect(dialog).not.toHaveTextContent("platform broadcast");
    expect(dialog).toHaveTextContent("not reached");
    expect(dialog).toHaveTextContent("no report");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "End tracking" }));
    });
    expect(sessionStore.getSession("sim-buffered")!.lifecycle).toBe("ended");
    expect(nav.push).toHaveBeenCalledWith("/live/sim-buffered/review");
  });
});

describe("Review and Next LIVE", () => {
  it("Plan vs Actual is derived from this run: overruns, anchors, cues and history", async () => {
    await renderPage(ReviewPage as PageComponent, "sim-buffered-done");
    const table = await screen.findByTestId("plan-actual-table");
    const hoodie = within(table).getByTestId("review-row-sim-buffered-done:a");
    expect(hoodie).toHaveTextContent("20:03:00–20:09:00");
    expect(hoodie).toHaveTextContent("20:03:00–20:12:00");
    expect(hoodie).toHaveTextContent("+3:00 duration");
    expect(within(table).getByTestId("review-row-sim-buffered-done:flash")).toHaveTextContent("anchor met");
    expect(screen.getByTestId("review-summary")).toHaveTextContent("2/2 on time");
    expect(screen.getByTestId("cue-results")).toHaveTextContent("Platform verification: Unknown");
    expect(screen.getByTestId("review-history")).toHaveTextContent("Operator chose: End Zip Hoodie by 20:12:00");
    expect(screen.getByTestId("plan-revisions")).toHaveTextContent("Committed to end Zip Hoodie by 20:12:00");
    expect(screen.getByTestId("simulated-review-note")).toBeInTheDocument();
  });

  it("Completed is not coverage: the row states coverage beside the outcome, and unknown is explained as not failed", async () => {
    await renderPage(ReviewPage as PageComponent, "sim-buffered-done");
    const hoodie = await screen.findByTestId("review-row-sim-buffered-done:a");
    expect(hoodie).toHaveTextContent(/Completed · coverage partial/); // declared partial: a completed segment is not a covered one
    expect(hoodie).not.toHaveTextContent("coverage complete");
    // A completed segment nobody declared coverage for is labelled unknown, never complete and never failed.
    const opening = screen.getByTestId("review-row-sim-buffered-done:open");
    expect(opening).toHaveTextContent(/Completed · coverage not declared/);
    expect(opening).toHaveTextContent("coverage not declared · unknown");
    expect(screen.getByTestId("segments-coverage-note")).toHaveTextContent("not that everything planned was covered");
    expect(screen.getByTestId("review-reading-note")).toHaveTextContent("not failures");
  });

  it("Next LIVE keeps coverage context beside proposals and carries none of it into the new session", async () => {
    nav.search = new URLSearchParams("view=next");
    await renderPage(ReviewPage as PageComponent, "sim-buffered-done");
    await screen.findByTestId("next-live");
    expect(screen.getByTestId("only-selected-note")).toHaveTextContent("Only the boxes you tick");
    expect(screen.getByTestId("proposal-context-duration:sim-buffered-done:a")).toHaveTextContent("Coverage partial · follow-up: Remaining Zip Hoodie points");
    expect(screen.getByTestId("coverage-followups")).toHaveTextContent("not copied into the next plan");
    await act(async () => {
      fireEvent.click(screen.getByTestId("create-next-live-cta-btn"));
    });
    const created = sessionStore.list("SIMULATED").find((s) => s.derivedFrom?.sessionId === "sim-buffered-done")!;
    expect(created.derivedFrom?.appliedChanges).toEqual([]);
    expect(created.events).toEqual([]);
    expect(Object.values(created.runtime.segments).every((r) => r.coverage === null && !r.followUp)).toBe(true);
  });

  it("a missed anchor is shown as late against the unchanged commitment, never as recovered", async () => {
    finishRehearsal("sim-missed");
    await renderPage(ReviewPage as PageComponent, "sim-missed");
    const flash = await screen.findByTestId("review-row-sim-missed:flash");
    expect(flash).toHaveTextContent("Hard anchor 20:12:00");
    expect(flash).toHaveTextContent("anchor late 1:00");
    const qa = screen.getByTestId("review-row-sim-missed:qa");
    expect(qa).toHaveTextContent("Skipped — nothing performed");
    expect(within(qa).getByTestId("no-actual")).toBeInTheDocument();
  });

  it("a correction is appended beside the original, never over it", async () => {
    await renderPage(ReviewPage as PageComponent, "sim-buffered-done");
    const before = sessionStore.getSession("sim-buffered-done")!.events.length;
    const target = sessionStore.getSession("sim-buffered-done")!.events.find((e) => e.type === "segment_ended")!;
    fireEvent.click(await screen.findByTestId("perspective-later"));
    fireEvent.click(await screen.findByTestId(`correct-${target.id}`));
    await act(async () => {});
    fireEvent.change(screen.getByTestId("correction-input"), { target: { value: "Host says it ended a minute later" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Append correction" }));
    });
    const after = sessionStore.getSession("sim-buffered-done")!;
    expect(after.events.length).toBe(before + 1);
    expect(after.events.find((e) => e.id === target.id)).toEqual(target);
    expect(screen.getByTestId("history-correction_added")).toHaveTextContent("Original record retained");
  });

  it("Next LIVE: selected changes create a genuinely new, different plan and leave the source untouched", async () => {
    nav.search = new URLSearchParams("view=next");
    await renderPage(ReviewPage as PageComponent, "sim-buffered-done");
    const sourceBefore = JSON.stringify(sessionStore.getSession("sim-buffered-done"));

    expect(await screen.findByTestId("next-live")).toBeInTheDocument();
    expect(screen.getByTestId("proposals-observed")).toHaveTextContent("Zip Hoodie: 6:00 → 9:00");
    expect(screen.getByTestId("proposals-tradeoff")).toHaveTextContent("Opening: 3:00 → 2:00");

    // Nothing is applied until selected: the preview equals the baseline.
    expect(screen.getByTestId("feasible-note")).toHaveTextContent("Flash Sale announcement 3:00 buffer");

    fireEvent.click(screen.getByTestId("select-duration:sim-buffered-done:a"));
    expect(screen.getByTestId("clone-preview")).toHaveTextContent("9:00");
    expect(screen.getByTestId("feasible-note")).toHaveTextContent("Flash Sale announcement 0:00 buffer");
    fireEvent.click(screen.getByTestId("select-tradeoff:sim-buffered-done:open"));
    expect(screen.getByTestId("feasible-note")).toHaveTextContent("Flash Sale announcement 1:00 buffer");

    fireEvent.change(screen.getByTestId("next-note-input"), { target: { value: "Test a longer Zip Hoodie." } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("create-next-live-cta-btn"));
    });

    const created = sessionStore.list("SIMULATED").find((s) => s.derivedFrom?.sessionId === "sim-buffered-done")!;
    expect(created).toBeDefined();
    expect(nav.push).toHaveBeenCalledWith(`/live/${created.id}/prepare`);
    expect(JSON.stringify(sessionStore.getSession("sim-buffered-done"))).toBe(sourceBefore);
    expect(created.events).toEqual([]);
    expect(created.runtime.startedAtMs).toBeNull();
    const targets = Object.fromEntries(created.plans[0].segments.map((x) => [x.title, x.targetSec]));
    expect(targets["Zip Hoodie"]).toBe(540);
    expect(targets["Opening"]).toBe(120);
  });

  it("selected changes that conflict with a hard anchor show the exact deficit and need acknowledgement", async () => {
    finishRehearsal("sim-minimum");
    nav.search = new URLSearchParams("view=next");
    await renderPage(ReviewPage as PageComponent, "sim-minimum");
    await screen.findByTestId("next-live");
    fireEvent.click(screen.getByTestId("select-duration:sim-minimum:open"));
    fireEvent.click(screen.getByTestId("select-duration:sim-minimum:a"));
    const feasibility = screen.getByTestId("clone-feasibility");
    expect(feasibility).toHaveTextContent("Infeasible with these changes");
    expect(feasibility).toHaveTextContent("arrive 4:00 late");
    const create = screen.getByTestId("create-next-live-cta-btn");
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByTestId("ack-infeasible"));
    expect(create).not.toBeDisabled();
  });

  it("a new Prepare shows where the plan came from and that history was not copied", async () => {
    const source = sessionStore.getSession("sim-buffered-done")!;
    const result = sessionStore.createNext(source.id, {
      title: "Next show",
      plannedStartMs: source.plans[0].plannedStartMs + 86_400_000,
      changeIds: [`duration:${source.id}:a`],
      note: "Longer hoodie",
    });
    if (!result.ok) throw new Error(result.reason);
    await renderPage(PreparePage as PageComponent, result.session.id);
    const banner = await screen.findByTestId("derived-from");
    expect(banner).toHaveTextContent("Collection launch · rehearsal (completed)");
    expect(banner).toHaveTextContent("Zip Hoodie: 6:00 → 9:00");
    expect(banner).toHaveTextContent("Actual runtime, reports and history were not copied");
    expect(screen.getByTestId("schedule-impact")).toHaveTextContent("Flash Sale announcement · 20:12:00no buffer"); // 9:00 hoodie leaves exactly no slack
  });
});

describe("Operate desk details", () => {
  it("the Extend hint is honest when the anchor is already late", async () => {
    advanceRehearsal("sim-buffered", 3); // host estimate puts Flash Sale 1:00 late
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    const hint = await screen.findByTestId("extend-hint");
    expect(hint).toHaveTextContent("already 1:00 late");
    expect(hint).not.toHaveTextContent("uses buffer");
  });

  it("the Extend hint states the cost before it is committed", async () => {
    advanceRehearsal("sim-buffered", 5); // Zip Hoodie ends exactly at the anchor: no slack left
    sessionStore.dispatch("sim-buffered", { type: "advance_segment" });
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    // Flash Sale is now running; the next anchor is Closing 20:26, with B 8:00 + Q&A 3:00 filling the time.
    const hint = await screen.findByTestId("extend-hint");
    expect(hint.textContent).toMatch(/late|buffer|unchanged/);
  });

  it("returning to the current row scrolls only the Run of Show list, never the whole desk", () => {
    document.body.innerHTML = `
      <main id="desk" style="overflow:auto">
        <div id="box" data-ros-scroll>
          <ol><li id="row" aria-current="step">Zip Hoodie</li></ol>
        </div>
      </main>`;
    const box = document.getElementById("box") as HTMLElement;
    const desk = document.getElementById("desk") as HTMLElement;
    const row = document.getElementById("row") as HTMLElement;
    box.getBoundingClientRect = () => ({ top: 100, bottom: 300 }) as DOMRect;
    row.getBoundingClientRect = () => ({ top: 350, bottom: 400 }) as DOMRect;
    const spy = vi.fn();
    (row as HTMLElement & { scrollIntoView: () => void }).scrollIntoView = spy;
    (box as HTMLElement & { scrollIntoView: () => void }).scrollIntoView = spy;

    scrollCurrentRowIntoView(row);

    expect(box.scrollTop).toBe(400 - 300 + 8);
    expect(desk.scrollTop).toBe(0);
    expect(spy).not.toHaveBeenCalled(); // scrollIntoView would have scrolled every ancestor
    document.body.innerHTML = "";
  });
});

describe("Stage-2 audit repairs in the UI", () => {
  it("UI-06: an unresolved attempt does not block reporting a later cue; an unplanned action has its own path", async () => {
    advanceRehearsal("sim-buffered", 5); // 20:12 — Flash Sale running, its cue due
    sessionStore.dispatch("sim-buffered", { type: "report_cue", cueId: "sim-buffered:cue-flash", report: "attempted" });
    sessionStore.dispatch("sim-buffered", { type: "set_clock", toMs: SCENARIO_START + 15 * 60_000 });
    sessionStore.dispatch("sim-buffered", { type: "advance_segment" }); // Cargo Pants starts; its pin cue is due
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    // The bar has moved on to the next unreported cue; the attempt stays visible as unresolved.
    expect(await screen.findByTestId("cue-title")).toHaveTextContent("Pin Cargo Pants");
    expect(screen.getByTestId("cue-unresolved-btn")).toHaveTextContent("1 attempt unresolved");
    await act(async () => {
      fireEvent.click(screen.getByTestId("cue-performed-btn"));
    });
    let s = sessionStore.getSession("sim-buffered")!;
    expect(s.runtime.cues["sim-buffered:cue-pin-b"].state).toBe("performed");
    expect(s.runtime.cues["sim-buffered:cue-flash"].state).toBe("attempted");

    // Unplanned action: target, action, time and outcome.
    fireEvent.click(screen.getByTestId("cue-report-btn"));
    await act(async () => {});
    fireEvent.change(screen.getByTestId("report-target"), { target: { value: "new" } });
    expect(screen.getByTestId("unplanned-fields")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Record report" }));
    });
    s = sessionStore.getSession("sim-buffered")!;
    const actions = Object.values(s.runtime.actions);
    expect(actions.length).toBe(1);
    expect(actions[0]).toMatchObject({ action: "pin_product", state: "performed" });
    expect(s.runtime.cues["sim-buffered:cue-flash"].state).toBe("attempted");
  });

  it("UI-07: after an end-by commitment, Next asks for coverage instead of assuming it", async () => {
    advanceRehearsal("sim-buffered", 4); // end-by 20:12 committed
    sessionStore.dispatch("sim-buffered", { type: "set_clock", toMs: SCENARIO_START + 12 * 60_000 });
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    fireEvent.click(await screen.findByTestId("advance-btn"));
    await act(async () => {});
    expect(screen.getByTestId("coverage-dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("coverage-followup"), { target: { value: "Fit comparison" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Record and continue" }));
    });
    const run = sessionStore.getSession("sim-buffered")!.runtime.segments["sim-buffered:a"];
    expect(run).toMatchObject({ state: "completed", coverage: "partial", followUp: "Fit comparison" });
  });

  it("UI-04: the host can say the remaining time is unknown, distinct from no estimate", async () => {
    advanceRehearsal("sim-buffered", 2); // Zip Hoodie running
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    expect(await screen.findByTestId("now-end-line")).toHaveTextContent("planned target");
    fireEvent.click(screen.getByTestId("estimate-open-btn"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("estimate-unknown-btn"));
    });
    expect(screen.getByTestId("now-end-line")).toHaveTextContent("remaining time unknown");
    expect(sessionStore.getSession("sim-buffered")!.runtime.segments["sim-buffered:a"].remainingUnknownAtMs).not.toBeNull();
  });

  it("UI-01: a command that cannot be saved is not shown as done, and can be retried explicitly", async () => {
    advanceRehearsal("sim-buffered", 2);
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId("quick-add-note-btn"));
    });
    fireEvent.change(screen.getByTestId("note-input"), { target: { value: "Sizing questions" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    });
    expect(screen.getByTestId("unsaved-banner")).toHaveTextContent("Not saved");
    expect(screen.queryByTestId("command-ack-banner")).toBeNull();
    expect(sessionStore.getSession("sim-buffered")!.events.some((e) => e.type === "note_added")).toBe(false);
    spy.mockRestore();
    await act(async () => {
      fireEvent.click(screen.getByTestId("unsaved-retry-btn"));
    });
    expect(screen.queryByTestId("unsaved-banner")).toBeNull();
    expect(sessionStore.getSession("sim-buffered")!.events.filter((e) => e.type === "note_added").map((e) => e.data.text)).toEqual(["Sizing questions"]);
  });

  it("UI-08: Prepare blocks a second REAL show and links to the running one", async () => {
    const room = openRoom();
    room.seed(templateShow(room, "real-1", "Running show"));
    room.seed(templateShow(room, "real-2", "Second show"));
    const running = applyCommand(room.sessions[0], { type: "start_live", rebaseToNow: true, nowMs: room.nowMs });
    expect(running.receipt.outcome).toBe("committed");
    room.sessions = [running.session, room.sessions[1]];
    room.revision += 1;
    await renderPage(PreparePage as PageComponent, room.sessions[1].id);
    expect(await screen.findByTestId("other-show-active")).toHaveTextContent("Running show is running in this room");
    expect(screen.getByTestId("start-live-cta-btn")).toBeDisabled();
  });

  it("UI-14: an incomplete record reads as incomplete, never 'Did not run'", async () => {
    const done = sessionStore.getSession("sim-buffered-done")!;
    // Review reads stored data: inject the censored record directly into storage.
    const raw = JSON.parse(localStorage.getItem("livelift.v3.SIMULATED")!);
    const rec = raw.sessions.find((s: { id: string }) => s.id === done.id);
    rec.runtime.segments[`${done.id}:a`].endedAtMs = null;
    localStorage.setItem("livelift.v3.SIMULATED", JSON.stringify(raw));
    sessionStore.reloadFromStorage();
    await renderPage(ReviewPage as PageComponent, done.id);
    const row = await screen.findByTestId(`review-row-${done.id}:a`);
    expect(row).toHaveAttribute("data-outcome", "incomplete");
    expect(within(row).getByTestId("incomplete-actual")).toHaveTextContent("Started 20:03:00 · end not recorded");
    expect(row).not.toHaveTextContent("Did not run");
  });

  it("UI-12/13: import keeps distinct codes; a product a cue targets cannot be removed", async () => {
    await renderPage(PreparePage as PageComponent, "sim-missed");
    fireEvent.click(await screen.findByTestId("import-btn"));
    await act(async () => {});
    fireEvent.change(screen.getByTestId("import-text"), { target: { value: "A-B\tFirst item\t0\nA_B\tSecond item\t" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import 2 products" }));
    });
    const codes = sessionStore.getSession("sim-missed")!.products.map((p) => p.code);
    expect(codes).toEqual(expect.arrayContaining(["A-B", "A_B"]));
    // Cargo Pants is the target of pin/unpin cues.
    fireEvent.click(within(screen.getByTestId("prepare-product-list")).getByText("Cargo Pants"));
    await act(async () => {});
    expect(screen.getByTestId("product-used-by")).toHaveTextContent("cue “Pin Cargo Pants”");
    expect(screen.getByTestId("remove-product-btn")).toBeDisabled();
  });

  it("UI-16: product cards open by keyboard and Inspect pack works; UI-17: no fixture person in the shell", async () => {
    await renderPlain(<ProductsPage />);
    const card = screen.getByTestId("product-card-prod_m01");
    expect(card).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(await screen.findByText("Product: Ribbed Tee")).toBeInTheDocument();
    // The product dialog is modal: everything behind it is inert until it is closed (Escape), as it is for a real user.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Packs/ })).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: /Packs/ }));
    fireEvent.click(screen.getByTestId("inspect-pack-pack_02"));
    expect(await screen.findByTestId("pack-dialog")).toHaveTextContent("Ribbed Tee");
    expect(screen.getByTestId("sample-library-notice")).toHaveTextContent("sample library");
    expect(document.body.textContent).not.toContain("Linh");
  });

  it("UI-18: resetting one scenario keeps other rehearsals", async () => {
    advanceRehearsal("sim-buffered", 2);
    advanceRehearsal("sim-missed", 2);
    await renderPlain(<SimulatorPage />);
    fireEvent.click(await screen.findByTestId("reset-buffered"));
    await act(async () => {});
    expect(screen.getByTestId("reset-scenario-dialog")).toHaveTextContent("Every other rehearsal");
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset this run" }));
    });
    expect(sessionStore.getSession("sim-buffered")!.lifecycle).toBe("planned");
    expect(sessionStore.getSession("sim-missed")!.lifecycle).toBe("active");
    expect(sessionStore.getSession("sim-buffered-done")!.lifecycle).toBe("ended");
  });
});

describe("UI-09: a REAL clock behind recorded time is surfaced, not silently applied", () => {
  it("shows the discontinuity, keeps time moving forward, and records it through the room", async () => {
    const room = openRoom();
    room.seed(templateShow(room, "real-1", "Clock show", "Asia/Ho_Chi_Minh"));
    const started = applyCommand(room.sessions[0], { type: "start_live", nowMs: room.nowMs });
    expect(started.receipt.outcome).toBe("committed");
    room.sessions = [started.session];
    room.revision += 1;
    room.clockBehindByMs = 10 * 60_000; // the room's clock is 10 minutes behind time it already recorded
    await renderPage(OperatePage as PageComponent, "real-1");
    expect(await screen.findByTestId("clock-discontinuity")).toHaveTextContent("The room's clock is behind recorded time by");
    // serverNowMs is already the corrected time: the 10-minute gap is disclosed, never added to what the desk shows.
    expect(screen.getByTestId("elapsed-runtime-clock")).toHaveTextContent(/^0:\d\d$/);
    const record = screen.getByTestId("clock-discontinuity-record-btn");
    await waitFor(() => expect(record).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(record);
    });
    await waitFor(() => expect(room.sessions[0].events.some((e) => e.type === "clock_discontinuity")).toBe(true));
    // The browser never supplied a time: the command carries none.
    const sent = room.posts().at(-1)!;
    expect(sent.type).toBe("acknowledge_clock_discontinuity");
    expect(JSON.stringify(sent)).not.toContain("nowMs");
    const times = room.sessions[0].events.map((e) => e.recordedAtMs);
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });
});
