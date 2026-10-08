import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import HomePage from "@/app/page";
import { sessionStore } from "@/lib/store/sessionStore";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { authStore } from "@/lib/client/authStore";
import { FakeRoom } from "../helpers/fakeRoom";
import { auditAccessibility, realShow, renderPlain } from "../phase3-ui/support";

let restoreFetch: (() => void) | null = null;

function openRoom(room = new FakeRoom()): FakeRoom {
  restoreFetch = room.install();
  return room;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.reset();
  remoteRoomStore.reset();
  sessionStore.reloadFromStorage();
});

afterEach(() => {
  cleanup();
  restoreFetch?.();
  restoreFetch = null;
});

describe("Home on a first visit", () => {
  it("says what LiveLift is and who it is for, in product language", async () => {
    openRoom();
    await renderPlain(<HomePage />);
    const hero = await screen.findByTestId("first-run");
    expect(hero).toHaveTextContent("Plan the show");
    expect(hero).toHaveTextContent("operator who works beside a host");
    expect(hero).toHaveTextContent("It sits next to TikTok, not inside it");
    // The old engineering vocabulary does not lead the page.
    expect(hero).not.toHaveTextContent(/hard anchors/i);
  });

  it("offers three entry points: create, rehearse, and a finished Review", async () => {
    openRoom();
    await renderPlain(<HomePage />);
    const entries = within(await screen.findByTestId("entry-points"));
    expect(entries.getByTestId("create-live-btn").closest("a")).toHaveAttribute("href", "/live/new");
    expect(entries.getByTestId("try-simulator-btn").closest("a")).toHaveAttribute("href", "/simulator");
    // The sample Review is a completed REHEARSAL, and the card says so.
    const sample = entries.getByTestId("sample-review-btn").closest("a");
    expect(sample).toHaveAttribute("href", "/live/sim-buffered-done/review");
    expect(sample?.closest("li")).toHaveTextContent(/completed rehearsal/i);
  });

  it("shows the five-step loop with Create as the next step, and later steps say when they open", async () => {
    openRoom();
    await renderPlain(<HomePage />);
    const guide = within(await screen.findByTestId("loop-guide"));
    expect(guide.getAllByRole("listitem").map((li) => li.querySelector("h3")?.textContent)).toEqual([
      "Create",
      "Prepare",
      "Operate",
      "Review",
      "Next LIVE",
    ]);
    expect(screen.getByTestId("loop-step-create")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("loop-step-operate")).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("loop-step-operate")).toHaveTextContent("Opens when a show starts");
    // Rehearsal links are labelled as rehearsals, not passed off as the operator's shows.
    expect(screen.getByTestId("loop-step-review")).toHaveTextContent("(rehearsal)");
  });

  it("explains REAL, SIMULATED and what is not connected, and claims no integration", async () => {
    openRoom();
    await renderPlain(<HomePage />);
    const panel = await screen.findByTestId("truth-panel");
    expect(panel).toHaveTextContent("REAL");
    expect(panel).toHaveTextContent("SIMULATED");
    expect(panel).toHaveTextContent("never counts as real history");
    expect(panel).toHaveTextContent("does not pin, promote or read analytics on TikTok");
    expect(within(panel).getByRole("link", { name: "See what is supported" })).toHaveAttribute("href", "/integrations");
    const home = document.body.textContent ?? "";
    expect(home).not.toMatch(/connected to TikTok|syncs? with TikTok|live analytics|AI-powered|guarantee/i);
  });

  it("an empty Prepared list tells the visitor what to do instead of a bare 'none'", async () => {
    openRoom();
    // Run every scripted rehearsal to its end: nothing is left prepared.
    for (const id of ["sim-buffered", "sim-missed", "sim-minimum"]) {
      for (;;) {
        const r = sessionStore.applyNextScriptStep(id);
        if (!r || !r.step || !r.receipt || r.receipt.outcome === "rejected") break;
      }
    }
    await renderPlain(<HomePage />);
    expect(await screen.findByTestId("prepared-empty")).toHaveTextContent("Create a LIVE");
    expect(screen.queryByTestId("prepared-list")).toBeNull();
    expect(screen.getByTestId("ended-list")).toBeInTheDocument();
    expect(screen.getByTestId("try-simulator-btn")).toBeInTheDocument();
  });
});

describe("Home once the operator has shows of their own", () => {
  it("does not repeat the first-run pitch: a compact guide and a next move instead", async () => {
    const room = openRoom();
    realShow(room, "real-1", { start: true, end: true });
    await renderPlain(<HomePage />);
    const idle = await screen.findByTestId("idle-card");
    expect(screen.queryByTestId("first-run")).toBeNull();
    expect(idle).toHaveTextContent("No LIVE is running");
    expect(within(idle).getByTestId("idle-next-btn").closest("a")).toHaveAttribute("href", "/live/real-1/review");
    // Compact guide: step names and links only, and the loop points at Review.
    expect(screen.getByTestId("loop-step-review")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText(/Name the show, pick when it starts/)).toBeNull();
  });

  it("a running show leads Home and the guide points at Operate", async () => {
    const room = openRoom();
    realShow(room, "real-1", { start: true });
    await renderPlain(<HomePage />);
    const card = await screen.findByTestId("active-live-card");
    expect(card).toHaveTextContent("REAL");
    expect(screen.queryByTestId("first-run")).toBeNull();
    expect(screen.queryByTestId("idle-card")).toBeNull();
    expect(screen.getByTestId("loop-step-operate")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("loop-step-operate").querySelector("a")).toHaveAttribute("href", "/live/real-1/operate");
  });
});

describe("Home onboarding is accessible", () => {
  it("passes the structural audit on first run and with an idle operator", async () => {
    const room = openRoom();
    await renderPlain(<HomePage />);
    await screen.findByTestId("first-run");
    expect(auditAccessibility()).toEqual([]);
    cleanup();
    realShow(room, "real-1", { start: true, end: true });
    await renderPlain(<HomePage />);
    await screen.findByTestId("idle-card");
    expect(auditAccessibility()).toEqual([]);
  });
});

describe("Home when the room cannot be asked", () => {
  it("shows the problem, not first-run guidance, so a failure never looks like an empty account", async () => {
    const room = openRoom(new FakeRoom({ signedIn: false }));
    expect(room.signedIn).toBe(false);
    await renderPlain(<HomePage />);
    await act(async () => {});
    expect(await screen.findByTestId("room-status-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("first-run")).toBeNull();
    expect(screen.queryByTestId("idle-card")).toBeNull();
  });

  it("still explains the loop, but calls no step 'next' because the account's state is unknown", async () => {
    openRoom(new FakeRoom({ signedIn: false }));
    await renderPlain(<HomePage />);
    await screen.findByTestId("room-status-panel");
    expect(screen.getByTestId("loop-guide")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-current") === "step")).toHaveLength(0);
    expect(screen.queryByText("Your next step")).toBeNull();
  });
});
