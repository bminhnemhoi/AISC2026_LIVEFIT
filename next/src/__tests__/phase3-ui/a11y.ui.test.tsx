import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React, { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: new URLSearchParams(), path: "/live/real-1/operate" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.path,
  useSearchParams: () => nav.search,
}));
const connection = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("next/server", () => ({ connection }));
vi.mock("next/font/google", () => ({ Rubik: () => ({ variable: "--font-rubik" }) }));

import RootLayout from "@/app/layout";
import HomePage from "@/app/page";
import LoginPage from "@/app/login/page";
import NewPage from "@/app/live/new/page";
import OperatePage from "@/app/live/[sessionId]/operate/page";
import PreparePage from "@/app/live/[sessionId]/prepare/page";
import ReviewPage from "@/app/live/[sessionId]/review/page";
import SessionsPage from "@/app/sessions/page";
import { CommandStateContext, Dialog, LiveAnnouncer } from "@/components/ui";
import { announce, announcer } from "@/lib/client/announcer";
import { authStore } from "@/lib/client/authStore";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { sessionStore } from "@/lib/store/sessionStore";
import { FakeRoom } from "../helpers/fakeRoom";
import { auditAccessibility, realShow, renderPage, renderPlain, tabbables, type PageComponent } from "./support";

let restore: (() => void) | null = null;
const open = (room: FakeRoom): FakeRoom => {
  restore = room.install();
  return room;
};

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
  cleanup();
  restore?.();
  restore = null;
  for (const el of Array.from(document.body.querySelectorAll("[data-keep-live]"))) el.remove();
});

/** A dialog the way a screen uses it: an opener, content behind it, fields inside it. */
function Harness({ onConfirm = () => undefined }: { onConfirm?: () => void }): React.ReactElement {
  const [isOpen, setOpen] = useState(false);
  return (
    <div id="app">
      <h1>Page</h1>
      <button type="button" id="opener" onClick={() => setOpen(true)}>
        Open
      </button>
      <a href="#elsewhere">Elsewhere</a>
      <Dialog isOpen={isOpen} onClose={() => setOpen(false)} title="Confirm the thing" description="This describes what confirming does." confirmText="Do it" onConfirm={onConfirm}>
        <label htmlFor="why">Reason</label>
        <input id="why" />
      </Dialog>
    </div>
  );
}

describe("dialogs: focus, trap, restore and a background that cannot be reached", () => {
  it("names and describes the dialog, moves focus in, and makes everything behind it inert and hidden", () => {
    const live = document.body.appendChild(document.createElement("div"));
    live.setAttribute("data-keep-live", "");
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Confirm the thing" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("This describes what confirming does.");
    expect(screen.getByLabelText("Reason")).toHaveFocus(); // first control inside

    const app = document.getElementById("app")!.parentElement as HTMLElement; // RTL's container, a direct child of <body>
    expect(app).toHaveAttribute("inert");
    expect(app).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull(); // gone from the accessibility tree
    expect(live).not.toHaveAttribute("inert"); // announcements still arrive
    expect(dialog.closest("[inert]")).toBeNull();
  });

  it("Tab and Shift+Tab wrap inside the dialog and never reach the page", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    const inside = tabbables(dialog);
    expect(inside.map((el) => el.textContent || el.id)).toEqual(["why", "Cancel", "Do it"]);
    const [first, , last] = inside;
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    for (const el of tabbables(document.body)) expect(dialog.contains(el)).toBe(true); // nothing outside is tabbable
  });

  it("Escape closes it, gives focus back to what opened it, and the page is reachable again", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();
    const app = document.getElementById("app")!.parentElement as HTMLElement;
    expect(app).not.toHaveAttribute("inert");
    expect(app).not.toHaveAttribute("aria-hidden");
    expect(document.body.style.overflow).toBe("");
  });

  it("restores exactly what it changed, including a background that was already hidden", () => {
    const other = document.body.appendChild(document.createElement("div"));
    other.setAttribute("aria-hidden", "true");
    other.setAttribute("inert", "");
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(other).toHaveAttribute("aria-hidden", "true");
    expect(other).toHaveAttribute("inert");
    other.remove();
  });

  it("a busy command dialog says the action is already sent and cannot be cancelled from here, and does not close", () => {
    const onClose = vi.fn();
    render(
      <CommandStateContext.Provider value={{ busy: true, error: null }}>
        <Dialog isOpen onClose={onClose} title="End LIVE" description="Ends tracking." confirmText="End tracking" onConfirm={() => undefined} />
      </CommandStateContext.Provider>
    );
    const dialog = screen.getByRole("dialog", { name: "End LIVE" });
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("dialog-busy-note")).toHaveTextContent(/already been sent to the room\. This window cannot cancel it/);
    expect(screen.getByRole("button", { name: "Waiting for confirmation…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled(); // not offered while it could imply cancelling
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.textContent).not.toMatch(/cancelled|will be cancelled|stop the action/i);
  });

  it("a refusal is shown inside the dialog as plain text, with the live region carrying the announcement", () => {
    render(
      <CommandStateContext.Provider value={{ busy: false, error: "The room changed since you looked." }}>
        <Dialog isOpen onClose={() => undefined} title="Add note" confirmText="Save" onConfirm={() => undefined} />
      </CommandStateContext.Provider>
    );
    expect(screen.getByTestId("dialog-command-error")).toHaveTextContent("The room changed since you looked.");
    expect(screen.getByTestId("dialog-command-error")).not.toHaveAttribute("role"); // announced once, by the shared region
  });

  it("on the REAL desk, End LIVE opens a named dialog, traps focus, and returns focus to End LIVE on Escape", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("end-live-header-btn")).not.toBeDisabled());
    const endBtn = screen.getByTestId("end-live-header-btn");
    endBtn.focus();
    await act(async () => {
      fireEvent.click(endBtn);
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(auditAccessibility()).toEqual([]);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(endBtn).toHaveFocus();
  });

  it("the sign-out warning is a named, described dialog that returns focus to Sign out", async () => {
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
    const signOut = screen.getByTestId("sign-out-btn");
    signOut.focus();
    await act(async () => {
      fireEvent.click(signOut);
    });
    const dialog = await screen.findByRole("dialog", { name: /Sign out with an action still waiting/ });
    expect(dialog).toHaveAccessibleDescription(/does not cancel, undo or fail/);
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(signOut).toHaveFocus();
  });
});

describe("live regions: restrained, deliberate, never driven by a clock", () => {
  it("two always-present regions: polite status and assertive alert, each holding only its latest message", () => {
    render(<LiveAnnouncer />);
    expect(screen.getByTestId("live-polite")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("live-polite")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("live-assertive")).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("live-assertive")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByTestId("live-polite").textContent).toBe(""); // present and empty: nothing is read at load
    act(() => announce("Contact restored.", "polite"));
    act(() => announce("Your session ended.", "assertive"));
    act(() => announce("Another polite one.", "polite"));
    expect(screen.getByTestId("live-polite")).toHaveTextContent("Another polite one.");
    expect(screen.getByTestId("live-polite")).not.toHaveTextContent("Contact restored.");
    expect(screen.getByTestId("live-assertive")).toHaveTextContent("Your session ended.");
  });

  it("the same sentence twice in a row is one announcement; the same sentence later is announced again", () => {
    render(<LiveAnnouncer />);
    act(() => announce("Signed out."));
    act(() => announce("Signed out."));
    expect(announcer.getSnapshot()).toHaveLength(1);
    act(() => announce("Something else."));
    act(() => announce("Signed out."));
    expect(announcer.getSnapshot().map((a) => a.text)).toEqual(["Signed out.", "Something else.", "Signed out."]);
  });

  it("a running REAL desk announces nothing as time passes: no live region holds a clock, and none changes while it ticks", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    render(<LiveAnnouncer />);
    await waitFor(() => expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-connection", "connected"));
    const logBefore = announcer.getSnapshot().length;

    // Structure: neither the clock nor the contact age sits inside anything that is read aloud.
    const lives = Array.from(document.querySelectorAll('[aria-live], [role="status"], [role="alert"]'));
    for (const region of lives) {
      expect(region.contains(screen.getByTestId("elapsed-runtime-clock"))).toBe(false);
      expect(region.contains(screen.getByTestId("connection-chip"))).toBe(false);
    }

    // Behaviour: let the clock, the 1 s poll and the contact age tick, and watch every live region.
    const records: string[] = [];
    const observer = new MutationObserver((list) => list.forEach((r) => records.push(`${(r.target as Element).nodeName}:${r.type}`)));
    for (const region of lives) observer.observe(region, { childList: true, characterData: true, subtree: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2300));
    });
    observer.disconnect();
    expect(records).toEqual([]);
    expect(announcer.getSnapshot()).toHaveLength(logBefore);
  });

  it("while contact is lost the 'last contact Ns ago' counter changes on screen but never in a live region", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    render(<LiveAnnouncer />);
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    room.offline = true;
    await act(async () => {
      await remoteRoomStore.refreshNow();
    });
    expect(announcer.getSnapshot().filter((a) => /Lost contact/.test(a.text))).toHaveLength(1);
    const lives = Array.from(document.querySelectorAll('[aria-live], [role="status"], [role="alert"]'));
    const records: string[] = [];
    const observer = new MutationObserver((list) => list.forEach((r) => records.push(r.type)));
    for (const region of lives) observer.observe(region, { childList: true, characterData: true, subtree: true });
    const chip = screen.getByTestId("connection-chip");
    const before = chip.textContent;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2300));
    });
    observer.disconnect();
    expect(chip.textContent).not.toBe(before); // the count did move on screen …
    expect(records).toEqual([]); // … and nothing was spoken for it
    expect(announcer.getSnapshot().filter((a) => /Lost contact/.test(a.text))).toHaveLength(1);
  });

  it("the WHY box is not itself a live region (its detail counts down); only a change of situation is spoken", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("why-box")).toBeInTheDocument());
    const why = screen.getByTestId("why-box");
    expect(why).not.toHaveAttribute("aria-live");
    expect(why).not.toHaveAttribute("role");
    expect(why.querySelector("[aria-live], [role='status']")).toBeNull();
    const spokenWhy = screen.getByTestId("why-announce");
    expect(spokenWhy).toHaveAttribute("aria-live", "polite");
    expect(spokenWhy.textContent).not.toMatch(/\b\d+:\d\d\b.*(remain|buffer)/); // the countdown text is not in it
  });

  it("a command's final answer is announced once through the shared region", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    render(<LiveAnnouncer />);
    await waitFor(() => expect(screen.getByTestId("quick-add-note-btn")).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-add-note-btn"));
    });
    fireEvent.change(screen.getByTestId("note-input"), { target: { value: "Sizing questions" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    });
    await waitFor(() => expect(screen.getByTestId("live-polite")).toHaveTextContent(/Add note: recorded by the room/));
    expect(announcer.getSnapshot().filter((a) => /recorded by the room/.test(a.text))).toHaveLength(1);

    room.revision += 1; // someone else committed first
    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-add-note-btn"));
    });
    fireEvent.change(screen.getByTestId("note-input"), { target: { value: "second" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    });
    await waitFor(() => expect(screen.getByTestId("live-assertive")).toHaveTextContent(/not accepted/));
  });
});

describe("structure of the critical screens (not axe: the audit this lane can run without a new package)", () => {
  it("Login", async () => {
    open(new FakeRoom({ signedIn: false }));
    nav.path = "/login";
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    expect(auditAccessibility()).toEqual([]);
  });

  it("Home and Sessions (with Export)", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    nav.path = "/";
    await renderPlain(<HomePage />);
    await screen.findByTestId("active-live-card");
    expect(auditAccessibility()).toEqual([]);
    cleanup();
    nav.path = "/sessions";
    await renderPlain(<SessionsPage />);
    await screen.findByTestId("export-control");
    expect(auditAccessibility()).toEqual([]);
  });

  it("Create", async () => {
    open(new FakeRoom());
    nav.path = "/live/new";
    await renderPlain(<NewPage />);
    await screen.findByTestId("submit-create-live-btn");
    expect(auditAccessibility()).toEqual([]);
  });

  it("Prepare, Operate and Review of a REAL show, and the Next LIVE panel", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true, end: true });
    realShow(room, "real-2");
    for (const [Page, id, search] of [
      [PreparePage, "real-2", ""],
      [OperatePage, "real-1", ""],
      [ReviewPage, "real-1", ""],
      [ReviewPage, "real-1", "view=next"],
    ] as const) {
      nav.search = new URLSearchParams(search);
      await renderPage(Page as PageComponent, id);
      await waitFor(() => expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-connection", "connected"));
      expect(auditAccessibility(), `${id} ${search}`).toEqual([]);
      cleanup();
    }
  });

  it.each([
    ["Operate", "operate", "real-1", ["quick-add-note-btn", "choose-next-btn", "skip-segment-btn", "cue-report-btn"]],
    ["Review", "review", "real-3", ["review-add-note-btn"]],
    ["Prepare", "prepare", "real-2", ["edit-details-btn", "add-segment-btn"]],
  ] as const)("every dialog opened from %s is named, modal, has labelled fields and is described", async (_label, page, id, openers) => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    realShow(room, "real-2");
    realShow(room, "real-3", { start: true, end: true });
    const Page = { operate: OperatePage, review: ReviewPage, prepare: PreparePage }[page] as PageComponent;
    await renderPage(Page, id);
    await waitFor(() => expect(screen.getByTestId("connection-chip")).toHaveAttribute("data-connection", "connected"));
    if (page === "review") fireEvent.click(await screen.findByTestId("perspective-later"));
    for (const opener of openers) {
      const btn = await screen.findByTestId(opener);
      await waitFor(() => expect(btn).not.toBeDisabled());
      btn.focus(); // a real click or Enter focuses the opener first; jsdom's click does not
      await act(async () => {
        fireEvent.click(btn);
      });
      const dialog = await screen.findByRole("dialog");
      expect(auditAccessibility(), `${page}/${opener}`).toEqual([]);
      expect(dialog.getAttribute("aria-describedby"), `${page}/${opener} has a description`).toBeTruthy();
      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(btn).toHaveFocus();
    }
  });

  it("the connection and sign-in states: stale, signed out, session ended, quarantine, restore notice", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    room.offline = true;
    await act(async () => {
      await remoteRoomStore.refreshNow();
    });
    expect(auditAccessibility()).toEqual([]);
    room.offline = false;
    room.revokeSession();
    await act(async () => {
      await remoteRoomStore.refreshNow();
    });
    await screen.findAllByRole("link", { name: "Sign in again" });
    expect(auditAccessibility()).toEqual([]);
  });

  it("every critical action is a native button, link or labelled field in DOM order, with no reordering tabindex", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPage(OperatePage as PageComponent, "real-1");
    await waitFor(() => expect(screen.getByTestId("extend-plus-one-btn")).not.toBeDisabled());
    const focusables = tabbables(document.body);
    const nonNative = focusables.filter((el) => !["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && el.getAttribute("tabindex") !== "0");
    expect(nonNative).toEqual([]);
    for (const testid of ["end-live-header-btn", "quick-add-note-btn", "extend-plus-one-btn"]) {
      const el = screen.getByTestId(testid);
      expect(el.tagName).toBe("BUTTON");
      expect(focusables).toContain(el);
    }
    // The skip link's target exists and can take focus.
    expect(document.getElementById("main-content")).toHaveAttribute("tabindex", "-1");
  });
});

describe("the audit is not vacuous", () => {
  it("reports unnamed controls, unlabelled fields, duplicate ids, positive tabindex, unnamed dialogs and dangling references", () => {
    render(
      <div>
        <button type="button" />
        <a href="#x"></a>
        <input />
        <p id="dup">a</p>
        <p id="dup">b</p>
        <div tabIndex={3}>x</div>
        <div role="dialog" />
        <input aria-label="ok" aria-describedby="nowhere" />
      </div>
    );
    const issues = auditAccessibility();
    for (const expected of [/control without an accessible name: <button>/, /control without an accessible name: <a>/, /field without a label/, /duplicate id: dup/, /positive tabindex/, /dialog without a name/, /dialog that is not modal/, /missing id \(nowhere\)/, /without a level-1 heading/]) {
      expect(issues.some((i) => expected.test(i)), String(expected)).toBe(true);
    }
  });
});

describe("page chrome: skip link, live regions and the dynamic-rendering contract", () => {
  it("the root layout opts into dynamic rendering, has a skip link to #main-content, and hosts the live regions", async () => {
    connection.mockClear();
    const tree = await RootLayout({ children: <main id="main-content">Body</main> });
    expect(connection).toHaveBeenCalledTimes(1); // per-request rendering, so the platform's CSP nonce can be applied
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('<html lang="en"');
    expect(html).toMatch(/<a href="#main-content"[^>]*>Skip to main content<\/a>/);
    expect(html).toContain('data-keep-live');
    expect(html).toContain('role="status"');
    expect(html).toContain('role="alert"');
    expect(html.indexOf("Skip to main content")).toBeLessThan(html.indexOf("Body")); // first in tab order
    expect(html).not.toMatch(/nonce|unsafe-inline|dangerouslySetInnerHTML|<script/i); // the layout adds no inline script or style of its own
  });

  it("global styles keep a visible focus ring and honour reduced motion", () => {
    const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
    expect(css).toMatch(/:focus-visible[\s\S]*outline:\s*2px solid/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms/);
    expect(css).toMatch(/transition-duration:\s*0\.01ms/);
  });
});
