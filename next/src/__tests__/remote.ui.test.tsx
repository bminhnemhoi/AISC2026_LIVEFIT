import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React, { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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

import PreparePage from "@/app/live/[sessionId]/prepare/page";
import OperatePage from "@/app/live/[sessionId]/operate/page";
import ReviewPage from "@/app/live/[sessionId]/review/page";
import SessionsPage from "@/app/sessions/page";
import { snapshotProducts } from "@/fixtures/library";
import { SCENARIO_BY_ID, applyCommand, createSession } from "@/lib/domain";
import type { Session } from "@/contracts";
import { sessionStore } from "@/lib/store/sessionStore";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { FakeRoom } from "./helpers/fakeRoom";
import { authStore } from "@/lib/client/authStore";

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

function show(room: FakeRoom, id: string, opts: { start?: boolean; end?: boolean } = {}): Session {
  const template = SCENARIO_BY_ID.buffered;
  const { segments, cues } = template.buildPlan(id);
  let s = createSession({
    id,
    title: "Friday launch",
    environment: "REAL",
    timezone: "UTC",
    plannedStartMs: room.nowMs,
    nowMs: room.nowMs,
    products: snapshotProducts(template.productIds),
    segments,
    cues,
    operator: { id: room.actor.id, name: room.actor.name, role: "lead", isLead: true },
  });
  if (opts.start || opts.end) s = applyCommand(s, { type: "start_live", nowMs: room.nowMs }).session;
  if (opts.end) s = applyCommand(s, { type: "end_live", nowMs: room.nowMs + 60_000 }).session;
  room.seed(s);
  return s;
}

let restore: (() => void) | null = null;
const open = (room: FakeRoom): FakeRoom => {
  restore = room.install();
  return room;
};

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

afterEach(() => {
  restore?.();
  restore = null;
});

describe("REAL Operate: operator", () => {
  it("shows connected + operator, and a note is recorded by the room, not by the browser", async () => {
    const room = open(new FakeRoom());
    show(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    expect(await screen.findByTestId("extend-plus-one-btn")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-connection", "connected"));
    expect(screen.getByTestId("access-role")).toHaveTextContent("Operator");
    expect(screen.getByTestId("elapsed-runtime-clock")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-add-note-btn"));
    });
    fireEvent.change(screen.getByTestId("note-input"), { target: { value: "Sizing questions" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    });
    await waitFor(() => expect(room.sessions[0].events.some((e) => e.type === "note_added")).toBe(true));
    // The dialog closes only once the room has answered, and the browser stored no REAL state of its own.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem("livelift.v3.REAL")).toBeNull();
    expect(JSON.stringify(room.posts()[0])).not.toContain("nowMs");
  });

  it("keeps the dialog and the typed text when the room rejects the command", async () => {
    const room = open(new FakeRoom());
    show(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-connection", "connected"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-add-note-btn"));
    });
    fireEvent.change(screen.getByTestId("note-input"), { target: { value: "keep me" } });
    room.revision += 1; // someone else committed first
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    });
    expect(await screen.findByTestId("dialog-command-error")).toHaveTextContent(/room changed/i);
    expect(screen.getByTestId("note-input")).toHaveValue("keep me");
  });

  it("a lost answer to End LIVE is OUTCOME UNKNOWN: no navigation, a banner, and no automatic re-send", async () => {
    const room = open(new FakeRoom());
    show(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-connection", "connected"));
    room.loseNextResponses = 1;
    await act(async () => {
      fireEvent.click(screen.getByTestId("end-live-header-btn"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "End tracking" }));
    });
    const banner = await screen.findByTestId("outcome-unknown-banner");
    expect(banner).toHaveTextContent("OUTCOME UNKNOWN");
    expect(banner).toHaveTextContent(/may or may not have been recorded/);
    expect(nav.push).not.toHaveBeenCalled(); // never claimed as done
    expect(room.posts()).toHaveLength(1);

    // Check status uses the receipt endpoint: the room did commit it. Still no second POST.
    await act(async () => {
      fireEvent.click(screen.getByTestId("outcome-check-btn"));
    });
    expect(await screen.findByTestId("outcome-resolution")).toHaveTextContent(/did record it/);
    expect(room.posts()).toHaveLength(1);
    expect(room.sessions[0].lifecycle).toBe("ended");
  });
});

describe("REAL Operate: stale, disconnected and read-only", () => {
  it("losing the room freezes the desk: stale banner, controls disabled, last state kept", async () => {
    const room = open(new FakeRoom());
    show(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());

    room.offline = true;
    await act(async () => {
      await remoteRoomStore.refreshNow();
    });
    expect(await screen.findByTestId("stale-banner")).toHaveTextContent("last confirmed state");
    expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-connection", "stale");
    expect(screen.getByTestId("extend-plus-one-btn")).toBeDisabled();
    expect(screen.getByTestId("quick-add-note-btn")).toBeDisabled();
    expect(screen.getByTestId("end-live-header-btn")).toBeDisabled();
    expect(screen.getByText("Friday launch")).toBeInTheDocument(); // the last committed snapshot is still shown
    expect(room.posts()).toHaveLength(0);
  });

  it("a viewer sees the desk read-only: role shown, mutation controls disabled, nothing sent", async () => {
    const room = open(new FakeRoom({ role: "viewer", actor: { id: "v-1", name: "Linh" } }));
    show(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    expect(await screen.findByTestId("access-role")).toHaveTextContent("Viewer · read-only");
    expect(screen.getByTestId("viewer-identity")).toHaveTextContent("Viewing as Linh");
    expect(screen.getByTestId("desk-readonly-note")).toHaveTextContent("read-only");
    expect(screen.getByTestId("extend-plus-one-btn")).toBeDisabled();
    expect(screen.getByTestId("quick-add-note-btn")).toBeDisabled();
    expect(screen.getByTestId("end-live-header-btn")).toBeDisabled();
    // The information itself is still rendered.
    expect(screen.getByTestId("operator-toolbar")).toBeInTheDocument();
    expect(screen.getByLabelText("Run of Show panel")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("extend-plus-one-btn"));
    expect(room.posts()).toHaveLength(0);
    // Let the poll that follows the first contact finish inside act, so its store update is not applied after the test.
    await act(async () => {
      await remoteRoomStore.refreshNow();
    });
  });
});

describe("REAL Prepare", () => {
  it("saves the whole editable draft as one save_prepare, and the dialog waits for the room", async () => {
    const room = open(new FakeRoom());
    show(room, "real-1");
    await renderPage(PreparePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveTextContent("Saved to the room"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("edit-details-btn"));
    });
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByDisplayValue("Friday launch"), { target: { value: "Friday launch v2" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: /save|confirm/i }));
    });
    await waitFor(() => expect(room.sessions[0].title).toBe("Friday launch v2"));
    const sent = room.posts().at(-1)!;
    expect(sent.type).toBe("save_prepare");
    expect(Object.keys(sent.payload).sort()).toEqual(["accountLabel", "cues", "objective", "plannedStartMs", "products", "segments", "timezone", "title"]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Start LIVE is a server command; the desk opens only after the room confirms", async () => {
    const room = open(new FakeRoom());
    show(room, "real-1");
    await renderPage(PreparePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("start-live-cta-btn")).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId("start-live-cta-btn"));
    });
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/live/real-1/operate"));
    expect(room.sessions[0].lifecycle).toBe("active");
    expect(room.posts().at(-1)!.type).toBe("start_live");
  });

  it("a viewer cannot edit or start", async () => {
    const room = open(new FakeRoom({ role: "viewer" }));
    show(room, "real-1");
    await renderPage(PreparePage as PageComponent, "real-1");
    expect(await screen.findByTestId("prepare-readonly-note")).toHaveTextContent("read-only");
    expect(screen.getByTestId("start-live-cta-btn")).toBeDisabled();
    expect(screen.getByTestId("add-segment-btn")).toBeDisabled();
    expect(screen.getByTestId("save-status")).toHaveTextContent("Read-only");
  });
});

describe("REAL Review and Next LIVE", () => {
  it("creates the next show through the room and opens its Prepare", async () => {
    const room = open(new FakeRoom());
    show(room, "real-1", { start: true, end: true });
    nav.search = new URLSearchParams("view=next");
    await renderPage(ReviewPage as PageComponent, "real-1");
    const create = await screen.findByTestId("create-next-live-cta-btn");
    await waitFor(() => expect(create).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(create);
    });
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    expect(room.sessions).toHaveLength(2);
    const next = room.sessions[1];
    expect(next.derivedFrom?.sessionId).toBe("real-1");
    expect(next.lifecycle).toBe("planned");
    expect(next.events).toHaveLength(0); // nothing from the first show's history is carried over
    expect(nav.push).toHaveBeenCalledWith(`/live/${next.id}/prepare`);
    expect(room.posts().at(-1)!.type).toBe("create_next");
    expect(room.posts().at(-1)!.sessionId).toBe("real-1");
  });

  it("a viewer can read the review but cannot append or create the next show", async () => {
    const room = open(new FakeRoom({ role: "viewer" }));
    show(room, "real-1", { start: true, end: true });
    await renderPage(ReviewPage as PageComponent, "real-1");
    expect(await screen.findByTestId("review-readonly-note")).toBeInTheDocument();
    expect(screen.getByTestId("review-history")).toBeInTheDocument();
    expect(screen.queryByTestId("review-add-note-btn")).toBeNull();
    fireEvent.click(screen.getByTestId("view-next-btn"));
    expect(await screen.findByTestId("create-next-live-cta-btn")).toBeDisabled();
  });
});

describe("legacy local REAL data", () => {
  /** A REAL show recorded in this browser before Phase 2. */
  function legacyEnded(): string {
    const made = sessionStore.createSession({ title: "Old local show", environment: "REAL", timezone: "UTC", plannedStartMs: Date.now(), start: { type: "template" } });
    if (!made.ok) throw new Error(made.reason);
    sessionStore.dispatch(made.session.id, { type: "start_live", nowMs: Date.now() });
    sessionStore.dispatch(made.session.id, { type: "end_live", nowMs: Date.now() + 60_000 });
    return made.session.id;
  }

  it("is listed under a clearly labelled local archive, never among room shows", async () => {
    open(new FakeRoom());
    const id = legacyEnded();
    await act(async () => {
      render(<SessionsPage />);
    });
    const archive = await screen.findByTestId("legacy-archive");
    expect(archive).toHaveTextContent("Local archive · before shared authority");
    expect(archive).toHaveTextContent("never uploaded or merged");
    expect(within(archive).getByTestId(`archive-row-${id}`)).toHaveTextContent("Local archive");
    expect(within(archive).getByRole("link", { name: /View archived review/ })).toHaveAttribute("href", `/live/${id}/review?archive=1`);
    expect(screen.queryByTestId(`session-row-${id}`)).toBeNull();
  });

  it("opens read-only: labelled, no appending, no Next LIVE, and no upload to the room", async () => {
    const room = open(new FakeRoom());
    const id = legacyEnded();
    nav.search = new URLSearchParams("archive=1");
    await renderPage(ReviewPage as PageComponent, id);
    expect(await screen.findByTestId("archive-note")).toHaveTextContent(/never uploaded or merged/);
    expect(screen.queryByTestId("review-add-note-btn")).toBeNull();
    fireEvent.click(screen.getByTestId("view-next-btn"));
    expect(await screen.findByTestId("next-live-blocked")).toHaveTextContent(/local archive/i);
    expect(screen.getByTestId("create-next-live-cta-btn")).toBeDisabled();
    expect(room.posts()).toHaveLength(0);
  });

  it("cannot be prepared or operated", async () => {
    open(new FakeRoom());
    const id = legacyEnded();
    nav.search = new URLSearchParams("archive=1");
    await renderPage(OperatePage as PageComponent, id);
    expect(await screen.findByTestId("archive-readonly")).toHaveTextContent("read-only");
  });
});

describe("sign-in states on the REAL desk", () => {
  it("signed out: the desk says so, offers sign-in, sends nothing to the room, and never says 'not found'", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    show(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    const gate = await screen.findByTestId("session-unavailable");
    expect(gate).toHaveAttribute("data-problem", "signed_out");
    expect(gate).toHaveTextContent("Sign in to open this show");
    expect(screen.queryByTestId("session-not-found")).toBeNull();
    expect(screen.getByTestId("stale-banner")).toHaveTextContent("signed out");
    for (const link of screen.getAllByRole("link", { name: "Sign in" })) expect(link).toHaveAttribute("href", expect.stringContaining("/login?next="));
    expect(room.requests).toHaveLength(0); // nothing reaches the room without a session
    expect(screen.getByTestId("connection-chip")).toHaveTextContent("Signed out");
  });

  it("a session the room rejects mid-show is 'session ended': the last state stays, frozen and read-only", async () => {
    const room = open(new FakeRoom());
    show(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    room.revokeSession();
    await act(async () => {
      await remoteRoomStore.refreshNow();
    });
    expect(await screen.findByTestId("stale-banner")).toHaveTextContent(/session ended/i);
    expect(screen.getByTestId("connection-chip")).toHaveTextContent("Session ended");
    expect(screen.getByTestId("extend-plus-one-btn")).toBeDisabled();
    expect(screen.getByText("Friday launch")).toBeInTheDocument(); // the last confirmed state, not an empty room
    expect(screen.getAllByRole("link", { name: "Sign in again" }).length).toBeGreaterThan(0);
  });
});

describe("recovery attribution on the REAL desk", () => {
  it("applying a shown recovery sends its attribution; merely showing it sends nothing", async () => {
    const room = open(new FakeRoom());
    const t = room.nowMs;
    // Same state as the rehearsal at 20:07: Zip Hoodie running, host says 6 more minutes, anchor at risk.
    let s = show(room, "real-1");
    room.sessions = [];
    room.revision = 0;
    s = applyCommand(s, { type: "start_live", nowMs: t }).session;
    s = applyCommand(s, { type: "advance_segment", nowMs: t + 3 * 60_000 }).session;
    s = applyCommand(s, { type: "set_remaining_estimate", segmentId: "real-1:a", remainingSec: 360, nowMs: t + 7 * 60_000 }).session;
    room.seed(s);
    room.nowMs = t + 7 * 60_000;

    await renderPage(OperatePage as PageComponent, "real-1");
    expect(await screen.findByTestId("recovery-option-end_by")).toHaveTextContent("End Zip Hoodie by");
    await waitFor(() => expect(screen.getByTestId("apply-end_by")).not.toBeDisabled());
    expect(room.posts()).toHaveLength(0); // a recommendation is not an acceptance

    await act(async () => {
      fireEvent.click(screen.getByTestId("apply-end_by"));
    });
    await waitFor(() => expect(room.posts()).toHaveLength(1));
    const sent = room.posts()[0];
    expect(sent.type).toBe("commit_end_by");
    expect(sent.payload).toMatchObject({ recoveryId: expect.any(String), recoveryLabel: expect.stringContaining("End Zip Hoodie by") });
    await waitFor(() => expect(room.sessions[0].events.some((e) => e.type === "recovery_selected")).toBe(true));
    // Selecting a recovery is a decision about the plan: it records no cue attempt or performance.
    expect(room.sessions[0].events.some((e) => e.type.startsWith("cue_"))).toBe(false);
  });
});
