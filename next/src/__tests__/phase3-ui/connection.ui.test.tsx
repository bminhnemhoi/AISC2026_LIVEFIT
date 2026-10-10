import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: new URLSearchParams(), path: "/live/real-1/operate" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.path,
  useSearchParams: () => nav.search,
}));

import HomePage from "@/app/legacy/home/page";
import SessionsPage from "@/app/sessions/page";
import OperatePage from "@/app/live/[sessionId]/operate/page";
import { LiveAnnouncer } from "@/components/ui";
import { announcer } from "@/lib/client/announcer";
import { authStore } from "@/lib/client/authStore";
import { addPending } from "@/lib/client/pendingEnvelopes";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { sessionStore } from "@/lib/store/sessionStore";
import type { CommandEnvelope } from "@/contracts/authority";
import { FakeRoom } from "../helpers/fakeRoom";
import { renderPage, renderPlain, realShow, type PageComponent } from "./support";

let restore: (() => void) | null = null;
const open = (room: FakeRoom): FakeRoom => {
  restore = room.install();
  return room;
};
const polite = (): string => screen.getByTestId("live-polite").textContent ?? "";
const assertive = (): string => screen.getByTestId("live-assertive").textContent ?? "";
const spoken = (): string[] => announcer.getSnapshot().map((a) => a.text);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.reset();
  announcer.reset();
  remoteRoomStore.reset();
  sessionStore.reloadFromStorage();
  nav.push.mockClear();
  nav.search = new URLSearchParams();
  nav.path = "/live/real-1/operate";
});
afterEach(() => {
  restore?.();
  restore = null;
});

const poll = async (): Promise<void> => {
  await act(async () => {
    await remoteRoomStore.refreshNow();
  });
};

describe("a failing backend is never an empty room or a first-time setup", () => {
  it.each([
    ["storage_unavailable", (r: FakeRoom) => (r.storageDown = true), /storage is not available/],
    ["backend_unavailable", (r: FakeRoom) => (r.backendDown = true), /server is not available/],
  ])("Home with %s says why, and offers neither the first-run card nor an empty list", async (problem, arrange, text) => {
    const room = open(new FakeRoom());
    nav.path = "/";
    // The session service answers; the room behind it does not.
    await authStore.bootstrap();
    arrange(room);
    await renderPlain(<HomePage />);
    const panel = await screen.findByTestId("room-status-panel");
    await waitFor(() => expect(panel).toHaveAttribute("data-problem", problem));
    expect(panel).toHaveTextContent(text);
    expect(panel).toHaveTextContent(/does not mean the room is empty/);
    expect(screen.queryByTestId("first-run")).toBeNull();
    expect(within(panel).getByRole("link", { name: /Simulator/ })).toBeInTheDocument(); // rehearsals stay one click away
  });

  it("Sessions explains that 'none listed' is not 'none exist'", async () => {
    const room = open(new FakeRoom());
    nav.path = "/sessions";
    await authStore.bootstrap();
    room.storageDown = true;
    await renderPlain(<SessionsPage />);
    expect(await screen.findByTestId("room-status-panel")).toHaveAttribute("data-problem", "storage_unavailable");
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "REAL" } }); // the REAL list: nothing could be loaded
    expect(await screen.findByTestId("sessions-empty")).toHaveTextContent(/does not mean there are none/);
  });

  it("when the sign-in service itself is down, Home says that and keeps asking", async () => {
    const room = open(new FakeRoom());
    nav.path = "/";
    room.backendDown = true; // the session endpoint answers 503 too
    await renderPlain(<HomePage />);
    const panel = await screen.findByTestId("room-status-panel");
    expect(panel).toHaveAttribute("data-problem", "auth_unavailable");
    expect(screen.queryByTestId("first-run")).toBeNull();
    room.backendDown = false;
    await act(async () => {
      fireEvent.click(screen.getByTestId("panel-retry-btn"));
    });
    await waitFor(() => expect(screen.queryByTestId("room-status-panel")).toBeNull());
    expect(await screen.findByTestId("first-run")).toBeInTheDocument(); // a connected, genuinely empty room is first run
  });

  it("signed out, Home invites sign-in instead of showing first run", async () => {
    open(new FakeRoom({ signedIn: false }));
    nav.path = "/";
    await renderPlain(<HomePage />);
    const panel = await screen.findByTestId("room-status-panel");
    expect(panel).toHaveAttribute("data-problem", "signed_out");
    expect(within(panel).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2F");
    expect(screen.queryByTestId("first-run")).toBeNull();
  });
});

describe("the REAL desk through losing and regaining the room", () => {
  it("storage failure freezes the desk with the true reason, retries by itself, and announces loss and return once each", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await act(async () => {
      const { render } = await import("@testing-library/react");
      render(<LiveAnnouncer />);
    });
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());

    room.storageDown = true;
    await poll();
    const banner = await screen.findByTestId("stale-banner");
    expect(banner).toHaveAttribute("data-problem", "storage_unavailable");
    expect(banner).toHaveTextContent(/storage is not available/);
    expect(banner).toHaveTextContent(/last confirmed state/);
    expect(screen.getByTestId("connection-chip")).toHaveTextContent(/Room storage unavailable/);
    expect(screen.getByTestId("extend-plus-one-btn")).toBeDisabled();
    expect(screen.getByText("Friday launch")).toBeInTheDocument();
    expect(polite()).toMatch(/Lost contact with the room/);

    await poll();
    await poll(); // more failures are not more announcements
    expect(spoken().filter((t) => /Lost contact/.test(t))).toHaveLength(1);

    room.storageDown = false;
    await poll();
    await waitFor(() => expect(screen.queryByTestId("stale-banner")).toBeNull());
    expect(polite()).toMatch(/Reconnected to the room/);
    expect(spoken().filter((t) => /Reconnected/.test(t))).toHaveLength(1);
    expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled();
  });

  it("an unreachable room reads as reconnecting, distinct from a backend that answers 503", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    room.offline = true;
    await poll();
    expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-problem", "unreachable");
    expect(screen.getByTestId("connection-chip")).toHaveTextContent(/Not current · reconnecting/);
    room.offline = false;
    room.backendDown = true;
    await poll();
    expect(screen.getByTestId("connection-chip")).toHaveTextContent(/Room unavailable/);
    expect(screen.getByTestId("connection-chip")).not.toHaveTextContent(/Not current/);
  });

  it("a wrong deployment (404) is named, offers sign-out, and is never 'show not found'", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    room.workspaceId = "ws-other"; // the server enforces another workspace …
    room.sessionContext = { workspaceId: "ws-1" }; // … than the one this session says it belongs to
    await renderPage(OperatePage as PageComponent, "real-1");
    const gate = await screen.findByTestId("session-unavailable");
    expect(gate).toHaveAttribute("data-problem", "wrong_deployment");
    expect(gate).toHaveTextContent("different workspace");
    expect(screen.queryByTestId("session-not-found")).toBeNull();
    expect(screen.getByTestId("stale-banner")).toHaveTextContent(/not the one this server is set up for/);
    expect(screen.getByTestId("banner-sign-out-btn")).toBeInTheDocument();
    expect(room.posts()).toHaveLength(0);
  });

  it("a server that says 'context required' is a session-context problem with a re-check, not a missing show", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    room.failRoomWith = { status: 400, code: "context_required" };
    await renderPage(OperatePage as PageComponent, "real-1");
    const gate = await screen.findByTestId("session-unavailable");
    expect(gate).toHaveAttribute("data-problem", "context_required");
    expect(screen.getByTestId("connection-chip")).toHaveTextContent("Session context problem");
    const before = room.requests.length;
    room.failRoomWith = null;
    await act(async () => {
      fireEvent.click(screen.getByTestId("reconnect-btn"));
    });
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).toBeInTheDocument());
    expect(room.requests.length).toBeGreaterThan(before);
  });

  it("a session that ends is announced assertively, once, and the desk stays readable but frozen", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await act(async () => {
      const { render } = await import("@testing-library/react");
      render(<LiveAnnouncer />);
    });
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    room.revokeSession();
    await poll();
    expect(assertive()).toMatch(/Your session ended/);
    await poll();
    expect(spoken().filter((t) => /session ended/i.test(t))).toHaveLength(1);
    expect(screen.getByTestId("stale-banner")).toHaveAttribute("data-problem", "session_ended");
    expect(screen.getByText("Friday launch")).toBeInTheDocument();
    expect(screen.getByTestId("extend-plus-one-btn")).toBeDisabled();
  });
});

describe("operator and viewer", () => {
  it("a role change observed in the room takes effect without a reload and is announced", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await act(async () => {
      const { render } = await import("@testing-library/react");
      render(<LiveAnnouncer />);
    });
    await waitFor(() => expect(screen.getByTestId("access-role")).toHaveTextContent("Operator"));
    expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled();
    room.role = "viewer"; // an administrator changed the role; the room reports it on the next read
    await poll();
    expect(screen.getByTestId("access-role")).toHaveTextContent("Viewer");
    expect(screen.getByTestId("extend-plus-one-btn")).toBeDisabled();
    expect(screen.getByTestId("desk-readonly-note")).toBeInTheDocument();
    expect(polite()).toMatch(/read-only viewer/);
  });
});

describe("signing out from the desk", () => {
  it("with nothing waiting it signs out at once and the protected view disappears from the page", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    expect(screen.getByTestId("account-name")).toHaveTextContent("Mai");
    await act(async () => {
      fireEvent.click(screen.getByTestId("sign-out-btn"));
    });
    const gate = await screen.findByTestId("session-unavailable");
    expect(gate).toHaveAttribute("data-problem", "signed_out");
    expect(document.body.textContent).not.toContain("Friday launch");
    expect(screen.queryByTestId("extend-plus-one-btn")).toBeNull();
    expect(room.signedIn).toBe(false);
    // And nothing REAL is polled any more.
    const before = room.requests.length;
    await poll();
    expect(room.requests).toHaveLength(before);
  });

  it("with an action still unanswered it asks first, says nothing was cancelled or failed, and then signs out", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    room.dropNextPosts = 1; // the request never reaches the room, so a lookup finds no record — which proves nothing
    await act(async () => {
      fireEvent.click(screen.getByTestId("end-live-header-btn"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "End tracking" }));
    });
    await screen.findByTestId("outcome-unknown-banner");

    await act(async () => {
      fireEvent.click(screen.getByTestId("sign-out-btn"));
    });
    const dialog = await screen.findByRole("dialog", { name: "Sign out with an action still waiting?" });
    expect(dialog).toHaveAccessibleDescription(/does not cancel, undo or fail/);
    expect(within(dialog).getByTestId("signout-waiting")).toHaveTextContent(/no record of .*End LIVE.*does not prove it failed/);
    // The reconcile it ran is a lookup, never a second send.
    expect(room.posts()).toHaveLength(1);
    expect(room.signedIn).toBe(true);

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Stay signed in" }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(room.signedIn).toBe(true);
  });

  it("confirming signs out; the unresolved record stays saved for this account and is never shown to another", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    room.dropNextPosts = 1;
    await act(async () => {
      fireEvent.click(screen.getByTestId("end-live-header-btn"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "End tracking" }));
    });
    await screen.findByTestId("outcome-unknown-banner");
    await act(async () => {
      fireEvent.click(screen.getByTestId("sign-out-btn"));
    });
    const dialog = await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    });
    await waitFor(() => expect(room.signedIn).toBe(false));
    expect(localStorage.getItem("livelift.v3.remote.pending")).toContain("actor-1");

    // Another account signs in on the same browser: it never sees her pending work.
    await act(async () => {
      await authStore.login({ username: "linh", password: room.accounts.linh.password });
    });
    await poll();
    expect(screen.queryByTestId("outcome-unknown-banner")).toBeNull();
    expect(screen.queryByTestId("quarantine-list")).toBeNull();
  });
});

describe("restore: notice and quarantine on screen", () => {
  const envelope = (id: string): CommandEnvelope => ({ commandId: id, roomId: "room-1", sessionId: "real-1", expectedRevision: 1, type: "end_live", payload: {} }) as CommandEnvelope;

  it("shows the restore time, the backup time and the backup revision, warns about newer commands, and never says failed", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    room.generation = "gen-2";
    room.recoveryNotice = { restoredAtMs: Date.UTC(2026, 9, 7, 3, 30), backupTakenAtMs: Date.UTC(2026, 9, 6, 22, 15), backupRevision: 41 };
    await renderPage(OperatePage as PageComponent, "real-1");
    const notice = await screen.findByTestId("recovery-notice");
    expect(notice).toHaveTextContent("This room was restored from a backup.");
    expect(within(notice).getByTestId("recovery-revision")).toHaveTextContent("41");
    const times = notice.querySelectorAll("time");
    expect(Array.from(times).map((t) => t.getAttribute("datetime"))).toEqual(["2026-10-07T03:30:00.000Z", "2026-10-06T22:15:00.000Z"]);
    expect(notice).toHaveTextContent(/after the backup may be missing/);
    expect(notice).toHaveTextContent(/unknown, not failed/);
    expect(notice.textContent).not.toMatch(/performed|ended|confirmed by/i); // no invented platform facts
    // The room itself was loaded fresh from the restored data.
    await waitFor(() => expect(screen.getByText("Friday launch")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId("recovery-dismiss-btn"));
    });
    expect(screen.queryByTestId("recovery-notice")).toBeNull();
  });

  it("lists old-generation and legacy pending commands as recovery items with only 'Set aside' — no check, no retry", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    room.generation = "gen-2";
    addPending({ scope: { actorId: "actor-1", workspaceId: "ws-1", generation: "gen-1" }, envelope: envelope("cmd-old"), label: "End LIVE" });
    localStorage.setItem("livelift.v3.remote.pending", JSON.stringify({ v: 2, pending: [{ scope: { actorId: "actor-1", workspaceId: "ws-1", generation: "gen-1" }, envelope: envelope("cmd-old"), label: "End LIVE" }, { scope: null, envelope: envelope("cmd-legacy"), label: "Add note" }] }));
    await renderPage(OperatePage as PageComponent, "real-1");
    const list = await screen.findByTestId("quarantine-list");
    const items = within(list).getAllByTestId("quarantine-item");
    expect(items.map((i) => i.getAttribute("data-reason"))).toEqual(["older_generation", "legacy"]);
    expect(items[0]).toHaveTextContent(/before the room was restored/);
    expect(items[1]).toHaveTextContent(/older version of LiveLift/);
    expect(screen.queryByTestId("outcome-check-btn")).toBeNull();
    expect(screen.queryByTestId("outcome-retry-btn")).toBeNull();
    expect(room.posts()).toHaveLength(0);
    expect(room.requests.some((r) => r.path.includes("cmd-old") || r.path.includes("cmd-legacy"))).toBe(false);
    // The desk is not blocked by them.
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());

    await act(async () => {
      fireEvent.click(within(items[0]).getByTestId("quarantine-dismiss-btn"));
    });
    expect(within(screen.getByTestId("quarantine-list")).getAllByTestId("quarantine-item")).toHaveLength(1);
  });

  it("a generation change under a live desk drops what was shown and resnapshots in full", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    const mark = room.requests.length;
    room.generation = "gen-2";
    room.recoveryNotice = { restoredAtMs: 2000, backupTakenAtMs: 1000, backupRevision: 0 };
    await poll(); // 409 recovery_required → the session is re-read → a new generation
    await waitFor(() => expect(screen.getByTestId("recovery-notice")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-connection", "connected"));
    const reads = room.requests.slice(mark).filter((r) => r.path.startsWith("/api/v3/room"));
    expect(reads.some((r) => r.headers["x-livelift-generation"] === "gen-2" && !r.path.includes("afterRevision"))).toBe(true);
    expect(screen.getByText("Friday launch")).toBeInTheDocument();
    expect(room.posts()).toHaveLength(0);
  });
});
