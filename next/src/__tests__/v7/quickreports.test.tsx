import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/",
  useSearchParams: () => nav.search,
}));

import OperatePage from "@/app/live/[sessionId]/operate/page";
import ReviewPage from "@/app/live/[sessionId]/review/page";
import { QuickReports } from "@/components/ops/QuickReports";
import { sessionStore } from "@/lib/store/sessionStore";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { authStore } from "@/lib/client/authStore";
import { QUICK_CUES, QUICK_CUE_SUFFIX, quickCueNoteText } from "@/lib/intelligence";

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

function advance(id: string, steps: number): void {
  for (let i = 0; i < steps; i++) {
    const r = sessionStore.applyNextScriptStep(id);
    if (!r?.receipt || r.receipt.outcome === "rejected") throw new Error(`step ${i} failed`);
  }
}
function finish(id: string): void {
  for (;;) {
    const r = sessionStore.applyNextScriptStep(id);
    if (!r || !r.step || !r.receipt || r.receipt.outcome === "rejected") return;
  }
}

afterEach(cleanup);
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.reset();
  remoteRoomStore.reset();
  sessionStore.reloadFromStorage();
  nav.search = new URLSearchParams();
});

describe("QuickReports control", () => {
  it("offers the five operator reports, labelled as the operator's word, and records nothing until one is chosen", () => {
    const onReport = vi.fn();
    render(<QuickReports onReport={onReport} />);
    const trigger = screen.getByTestId("quick-report-btn");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("quick-report-panel")).toBeNull();
    fireEvent.click(trigger);
    const panel = screen.getByTestId("quick-report-panel");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveTextContent(/operator reported/i);
    expect(panel).toHaveTextContent(/cannot read TikTok comments/i);
    expect(panel).toHaveTextContent(/not a platform confirmation/i);
    expect(within(panel).getAllByRole("button").map((b) => b.querySelector("span span")?.textContent)).toEqual([
      "Price questions rising",
      "CTA delivered",
      "Product pin changed",
      "Audience reaction spike",
      "Unexpected issue",
    ]);
    expect(onReport).not.toHaveBeenCalled();
  });

  it("records through the ordinary note text, closes, and hands focus back to the trigger", () => {
    const onReport = vi.fn();
    render(<QuickReports onReport={onReport} />);
    const trigger = screen.getByTestId("quick-report-btn");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("quick-cue-price_questions"));
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport.mock.calls[0][0]).toBe("Price questions rising (operator-reported quick cue)");
    expect(onReport.mock.calls[0][0].endsWith(QUICK_CUE_SUFFIX)).toBe(true);
    expect(screen.queryByTestId("quick-report-panel")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("is fast from the keyboard: focus lands on the first cue, arrows wrap, Escape closes and returns focus", () => {
    render(<QuickReports onReport={vi.fn()} />);
    const trigger = screen.getByTestId("quick-report-btn");
    fireEvent.click(trigger);
    const first = screen.getByTestId("quick-cue-price_questions");
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByTestId("quick-cue-unexpected_issue")); // wraps
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Escape" });
    expect(screen.queryByTestId("quick-report-panel")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the operator taps elsewhere", () => {
    render(
      <div>
        <QuickReports onReport={vi.fn()} />
        <button type="button">elsewhere</button>
      </div>
    );
    fireEvent.click(screen.getByTestId("quick-report-btn"));
    fireEvent.pointerDown(screen.getByText("elsewhere"));
    expect(screen.queryByTestId("quick-report-panel")).toBeNull();
  });

  it("every target is at least 44px tall and the panel never blocks the desk on a phone", () => {
    render(<QuickReports onReport={vi.fn()} />);
    fireEvent.click(screen.getByTestId("quick-report-btn"));
    expect(screen.getByTestId("quick-report-btn").className).toMatch(/min-h-\[44px\]/);
    for (const cue of QUICK_CUES) expect(screen.getByTestId(`quick-cue-${cue.id}`).className).toMatch(/min-h-\[48px\]/);
    // A fixed sheet on a phone (no clipping by the desk), an anchored popover from sm up.
    expect(screen.getByTestId("quick-report-panel").className).toMatch(/max-sm:fixed/);
    expect(screen.getByTestId("quick-report-panel").className).toMatch(/sm:absolute/);
  });
});

describe("Operate: a quick report is an ordinary, authoritative note", () => {
  it("adds exactly one note_added event and changes nothing else about the show", async () => {
    advance("sim-buffered", 2);
    const before = sessionStore.getSession("sim-buffered")!;
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    fireEvent.click(await screen.findByTestId("quick-report-btn"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-cue-cta_delivered"));
    });
    const after = sessionStore.getSession("sim-buffered")!;
    expect(after.events).toHaveLength(before.events.length + 1);
    const event = after.events[after.events.length - 1];
    expect(event.type).toBe("note_added");
    expect(event.data.text).toBe("CTA delivered (operator-reported quick cue)");
    expect(event.summary).toContain("operator-reported quick cue");
    // Nothing about the runtime, the plan or the cues moved: the report is not an action or a confirmation.
    expect(after.runtime).toEqual(before.runtime);
    expect(after.plans).toEqual(before.plans);
    expect(after.lifecycle).toBe("active");
    // It is visible in the desk's own history, in the operator's words.
    expect(screen.getByTestId("command-ack-banner")).toHaveTextContent("operator-reported quick cue");
  });

  it("sits in the operator toolbar beside Note, not among NOW / NEXT, and is not a second way to report a performed cue", async () => {
    advance("sim-buffered", 2);
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    const toolbar = await screen.findByTestId("operator-toolbar");
    expect(within(toolbar).getByTestId("quick-add-note-btn")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("quick-report-btn")).toBeInTheDocument();
    expect(toolbar.tagName).toBe("FIELDSET"); // disabled as a whole when the room is read-only or unreachable
    // Opening the list reports nothing by itself.
    const before = sessionStore.getSession("sim-buffered")!.events.length;
    fireEvent.click(screen.getByTestId("quick-report-btn"));
    expect(sessionStore.getSession("sim-buffered")!.events).toHaveLength(before);
  });
});

describe("Review labels a quick cue as an operator report, in the order it was known", () => {
  it("replays it in the operator lane, with what the plan expected and what was running", async () => {
    advance("sim-buffered", 2);
    const res = sessionStore.dispatch("sim-buffered", { type: "add_note", text: quickCueNoteText(QUICK_CUES[2]) });
    expect(res?.receipt.outcome).toBe("committed");
    finish("sim-buffered");
    await renderPage(ReviewPage as PageComponent, "sim-buffered");
    const replay = await screen.findByTestId("known-then-replay");
    const row = within(replay).getAllByTestId("replay-operator").find((r) => r.textContent?.includes("Product pin changed"))!;
    expect(row).toHaveTextContent("Operator reported: Product pin changed");
    expect(row).toHaveTextContent("Operator report");
    expect(row).toHaveTextContent(/A report, not a platform confirmation/);
    expect(within(row).getByTestId("replay-context")).toHaveTextContent(/plan expected/);
  });

  it("keeps a note appended after the LIVE out of the replay but counts it", async () => {
    finish("sim-buffered");
    const ended = sessionStore.getSession("sim-buffered")!;
    const res = sessionStore.dispatch("sim-buffered", { type: "add_note", text: "Thought about it the next day", nowMs: (ended.runtime.endedAtMs ?? 0) + 3_600_000 });
    expect(res?.receipt.outcome).toBe("committed");
    await renderPage(ReviewPage as PageComponent, "sim-buffered");
    const replay = await screen.findByTestId("known-then-replay");
    expect(replay).not.toHaveTextContent("Thought about it the next day");
    expect(screen.getByTestId("replay-appended-note")).toHaveTextContent("recorded after the LIVE ended");
    // It is still in the append-only history, where later records belong.
    expect(screen.getByTestId("review-history")).toHaveTextContent("Thought about it the next day");
  });
});
