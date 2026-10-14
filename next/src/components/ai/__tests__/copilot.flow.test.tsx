import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/",
  useSearchParams: () => nav.search,
}));

import OperatePage from "@/app/live/[sessionId]/operate/page";
import ReviewPage from "@/app/live/[sessionId]/review/page";
import { sessionStore } from "@/lib/store/sessionStore";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { authStore } from "@/lib/client/authStore";
import { FakeRoom } from "../../../__tests__/helpers/fakeRoom";
import { realShow, renderPage, type PageComponent } from "../../../__tests__/phase3-ui/support";
import type { AiStatusView } from "@/contracts/ai";
import type { Session } from "@/contracts";
import { runOperate, runReview } from "@/lib/server/ai/service";
import { fixtureProvider } from "@/lib/ai/fixtures";

/**
 * The Copilot inside the REAL pages (Operate desk, Review, Next LIVE), with a deterministic fake model behind a
 * fake `/api/v3/ai/*` and the repo's FakeRoom behind everything else. No network, no account.
 */

type AiCallRecord = { path: string; method: string; headers: Record<string, string>; body: { sessionId?: string; session?: Session } | null };
interface AiFake {
  calls: AiCallRecord[];
  status: AiStatusView;
  /** What POST /operate and /review answer with. Default: the fixture model through the real service. */
  answer: (task: "operate" | "review", body: NonNullable<AiCallRecord["body"]>) => Promise<unknown> | unknown;
}

let restore: (() => void) | null = null;

/** Compose the AI endpoints over a FakeRoom. The room's own routes are untouched. */
function installAi(room: FakeRoom, over: Partial<AiFake> = {}): AiFake {
  const undoRoom = room.install();
  const roomFetch = globalThis.fetch;
  const ai: AiFake = {
    calls: [],
    status: { state: "ready", model: "fixture-model-1", configIssues: [] },
    answer: async (task, body) => {
      const session = body.session ?? room.sessions.find((s) => s.id === body.sessionId)!;
      return task === "operate" ? runOperate(session, session.virtualNowMs ?? room.nowMs, [], { provider: fixtureProvider }) : runReview(session, [], { provider: fixtureProvider });
    },
    ...over,
  };
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input instanceof Request ? input.url : input), "http://room.test");
    if (!url.pathname.startsWith("/api/v3/ai/")) return roomFetch(input, init);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
    ai.calls.push({ path: url.pathname, method: (init?.method ?? "GET").toUpperCase(), headers, body: init?.body ? (JSON.parse(String(init.body)) as AiCallRecord["body"]) : null });
    if (url.pathname === "/api/v3/ai/status") return Response.json(ai.status);
    const task = url.pathname.endsWith("/operate") ? "operate" : "review";
    return Response.json(await ai.answer(task, JSON.parse(String(init?.body))));
  });
  restore = () => {
    vi.unstubAllGlobals();
    undoRoom();
  };
  return ai;
}
const posts = (ai: AiFake) => ai.calls.filter((c) => c.method === "POST");

function advanceRehearsal(id: string, steps: number): void {
  for (let i = 0; i < steps; i++) {
    const r = sessionStore.applyNextScriptStep(id);
    if (!r?.receipt || r.receipt.outcome === "rejected") throw new Error(`step ${i} failed`);
  }
}
function finishRehearsal(id: string): void {
  for (;;) {
    const r = sessionStore.applyNextScriptStep(id);
    if (!r || !r.step || !r.receipt || r.receipt.outcome === "rejected") return;
  }
}
const openCopilotTab = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(await screen.findByTestId("support-tab-copilot"));
  });
};
const state = () => screen.getByTestId("copilot-state");

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
  cleanup();
  restore?.();
  restore = null;
});

describe("Operate desk with the Copilot", () => {
  it("existing flow unaffected: NOW / NEXT / WHY / ACTION are intact and nothing is sent to the AI until the tab is opened", async () => {
    advanceRehearsal("sim-buffered", 3);
    const room = new FakeRoom();
    const ai = installAi(room);
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    expect(await screen.findByTestId("now-panel")).toBeInTheDocument();
    expect(screen.getByTestId("next-title")).toHaveTextContent("Flash Sale announcement");
    expect(screen.getByTestId("why-box")).toHaveTextContent("1:00 late");
    expect(screen.getByTestId("recovery-option-end_by")).toHaveTextContent("End Zip Hoodie by 20:12:00");
    // The AI tab exists beside History / Coverage / Plan changes; History is still the default view.
    expect(screen.getByTestId("support-tab-history")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("support-tab-copilot")).toHaveTextContent("AI Copilot");
    expect(ai.calls).toHaveLength(0);
    expect(room.authRequests).toHaveLength(0); // a rehearsal desk still does not talk to the server unprompted
  });

  it("not configured: the Copilot says so, and the desk keeps working (applying the product's own option still records)", async () => {
    advanceRehearsal("sim-buffered", 3);
    installAi(new FakeRoom(), { status: { state: "not_configured", model: null, configIssues: ["LIVELIFT_AI_API_KEY", "LIVELIFT_AI_MODEL", "LIVELIFT_AI_BASE_URL"] } });
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    await openCopilotTab();
    await waitFor(() => expect(state()).toHaveTextContent("Not configured"));
    expect(screen.getByTestId("copilot-config-issues")).toHaveTextContent("LIVELIFT_AI_API_KEY");
    expect(screen.queryByTestId("copilot-ask-btn")).toBeNull();
    expect(screen.getByTestId("layer-product")).toHaveTextContent("not AI");
    // Operate continues normally.
    fireEvent.click(screen.getByTestId("apply-end_by"));
    await act(async () => {});
    expect(sessionStore.getSession("sim-buffered")!.events.some((e) => e.type === "recovery_selected")).toBe(true);
  });

  it("successful suggestion: advice is shown as recommended-not-applied; the show is untouched until the operator clicks Apply", async () => {
    advanceRehearsal("sim-buffered", 3);
    const before = sessionStore.getSession("sim-buffered")!;
    const ai = installAi(new FakeRoom());
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    await openCopilotTab();
    await waitFor(() => expect(state()).toHaveTextContent("Ready"));
    fireEvent.click(screen.getByTestId("copilot-ask-btn"));
    await waitFor(() => expect(state()).toHaveTextContent("Available"));

    // What was sent: the whole SIMULATED rehearsal, with the CSRF marker and the workspace context.
    const sent = posts(ai)[0];
    expect(sent.path).toBe("/api/v3/ai/operate");
    expect(sent.headers["x-livelift-request"]).toBe("1");
    expect(sent.headers["x-livelift-workspace"]).toBeTruthy();
    expect(sent.body).toMatchObject({ sessionId: "sim-buffered", session: { environment: "SIMULATED" } });

    // The three layers, and the recommendation is not an action.
    expect(screen.getByTestId("layer-observed")).toBeInTheDocument();
    expect(screen.getByTestId("layer-interpretation")).toBeInTheDocument();
    expect(screen.getByTestId("layer-recommendation")).toHaveTextContent("not applied");
    expect(screen.getByTestId("ai-recommendation-state")).toHaveTextContent("Recommended · not applied");
    expect(screen.getByTestId("copilot-tab-dot")).toBeInTheDocument();

    // recommendation != acceptance: nothing in the show changed.
    const after = sessionStore.getSession("sim-buffered")!;
    expect(after.revision).toBe(before.revision);
    expect(after.events).toHaveLength(before.events.length);
    expect(after.events.some((e) => e.type === "recovery_selected")).toBe(false);
    expect(screen.queryByTestId("command-ack-banner")).toBeNull();

    // Acceptance is the operator's own click, through the same Apply path as the ACTION list.
    fireEvent.click(screen.getByTestId("ai-apply-btn"));
    await act(async () => {});
    const accepted = sessionStore.getSession("sim-buffered")!;
    expect(accepted.events.some((e) => e.type === "recovery_selected")).toBe(true);
    expect(accepted.revision).toBeGreaterThan(before.revision);
    // The show moved on, so the old analysis can no longer be applied.
    expect(screen.getByTestId("copilot-stale")).toBeInTheDocument();
    expect(screen.getByTestId("ai-apply-btn")).toBeDisabled();
  });

  it.each([
    ["unavailable", { status: "unavailable", reason: "timeout" }, "Unavailable"],
    ["rate limited", { status: "rate_limited", retryAfterSec: 30 }, "Rate limited"],
    ["invalid response", { status: "invalid_response", reason: "unsupported_claim" }, "Invalid response"],
  ])("%s: the state is shown, nothing from the AI is, and the desk is unaffected", async (_name, answer, label) => {
    advanceRehearsal("sim-buffered", 3);
    installAi(new FakeRoom(), { answer: () => answer });
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    await openCopilotTab();
    await waitFor(() => expect(state()).toHaveTextContent("Ready"));
    fireEvent.click(screen.getByTestId("copilot-ask-btn"));
    await waitFor(() => expect(state()).toHaveTextContent(label));
    expect(screen.queryByTestId("copilot-result")).toBeNull();
    expect(screen.queryByTestId("layer-interpretation")).toBeNull();
    expect(screen.getAllByTestId(/^fact-/).length).toBeGreaterThan(2); // facts are still LiveLift's own
    // Retry is possible, and the desk still works.
    expect(screen.getByTestId("copilot-ask-btn")).toBeEnabled();
    fireEvent.click(screen.getByTestId("apply-end_by"));
    await act(async () => {});
    expect(sessionStore.getSession("sim-buffered")!.events.some((e) => e.type === "recovery_selected")).toBe(true);
  });

  it("a server that cannot be reached is 'Unavailable', and is not shown as 'Not configured'", async () => {
    advanceRehearsal("sim-buffered", 3);
    installAi(new FakeRoom(), {
      answer: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    await openCopilotTab();
    await waitFor(() => expect(state()).toHaveTextContent("Ready"));
    fireEvent.click(screen.getByTestId("copilot-ask-btn"));
    await waitFor(() => expect(state()).toHaveTextContent(/Unavailable|Invalid response/));
    expect(state()).not.toHaveTextContent("Not configured");
  });

  it("signed out: the Copilot asks for sign-in, sends nothing, and the desk works", async () => {
    advanceRehearsal("sim-buffered", 3);
    const ai = installAi(new FakeRoom({ signedIn: false }));
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    await openCopilotTab();
    await waitFor(() => expect(state()).toHaveTextContent("Sign in required"));
    expect(ai.calls).toHaveLength(0);
    expect(screen.queryByTestId("copilot-ask-btn")).toBeNull();
    expect(screen.getByTestId("why-box")).toBeInTheDocument();
  });

  it("a viewer can read the Copilot's surface but cannot ask it", async () => {
    advanceRehearsal("sim-buffered", 3);
    const ai = installAi(new FakeRoom({ role: "viewer" }));
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    await openCopilotTab();
    await waitFor(() => expect(state()).toHaveTextContent("Ready"));
    expect(screen.getByTestId("copilot-viewer-note")).toBeInTheDocument();
    expect(screen.queryByTestId("copilot-ask-btn")).toBeNull();
    expect(posts(ai)).toHaveLength(0);
  });

  it("REAL: the request names the show only (the server reads it from the room), and the answer says REAL", async () => {
    const room = new FakeRoom();
    realShow(room, "real-1", { start: true });
    const ai = installAi(room);
    await renderPage(OperatePage as PageComponent, "real-1");
    await openCopilotTab();
    await waitFor(() => expect(state()).toHaveTextContent("Ready"));
    fireEvent.click(screen.getByTestId("copilot-ask-btn"));
    await waitFor(() => expect(state()).toHaveTextContent("Available"));
    expect(posts(ai)[0].body).toEqual({ sessionId: "real-1" });
    expect(screen.getByTestId("ai-footer")).toHaveTextContent("from REAL evidence");
    expect(screen.getByTestId("operate-copilot")).not.toHaveTextContent("This rehearsal is SIMULATED");
    // Nothing was written to the room by the Copilot.
    expect(room.posts()).toHaveLength(0);
  });

  it("SIMULATED is stated on the Copilot surface", async () => {
    advanceRehearsal("sim-buffered", 3);
    installAi(new FakeRoom());
    await renderPage(OperatePage as PageComponent, "sim-buffered");
    await openCopilotTab();
    expect(await screen.findByTestId("operate-copilot")).toHaveTextContent("This rehearsal is SIMULATED");
    expect(screen.getByTestId("fact-environment")).toHaveAttribute("data-fact-kind", "simulated");
  });
});

describe("Review and Next LIVE with the Copilot", () => {
  it("a rehearsal's Review is offline until the Copilot is opened; then it summarises without touching the show", async () => {
    finishRehearsal("sim-buffered");
    const before = JSON.stringify(sessionStore.getSession("sim-buffered"));
    const room = new FakeRoom();
    const ai = installAi(room);
    await renderPage(ReviewPage as PageComponent, "sim-buffered");
    expect(await screen.findByTestId("review-copilot")).toHaveTextContent("A second reading of this show's recorded evidence");
    expect(screen.getByTestId("copilot-unopened-note")).toBeInTheDocument();
    expect(ai.calls).toHaveLength(0);
    expect(screen.getByTestId("fact-platform_limits")).toBeInTheDocument(); // product-logic facts, no AI needed

    fireEvent.click(screen.getByTestId("copilot-open-btn"));
    await waitFor(() => expect(state()).toHaveTextContent("Ready"));
    fireEvent.click(screen.getByTestId("copilot-ask-btn"));
    await waitFor(() => expect(state()).toHaveTextContent("Available"));
    expect(screen.getByTestId("ai-summary")).toHaveTextContent("timing deviations");
    expect(screen.getByTestId("ai-gaps")).toHaveTextContent("unknown, not failed");
    expect(screen.getByTestId("ai-limits")).toHaveTextContent("not established");
    expect(posts(ai)[0].body).toMatchObject({ session: { environment: "SIMULATED" } });
    expect(JSON.stringify(sessionStore.getSession("sim-buffered"))).toBe(before); // the source show is never edited
  });

  it("Next LIVE: AI suggestions are marked, nothing is pre-selected, and only the operator's clicks select and create", async () => {
    finishRehearsal("sim-buffered");
    const source = JSON.stringify(sessionStore.getSession("sim-buffered"));
    const count = sessionStore.getSnapshot().sessions.length;
    installAi(new FakeRoom());
    await renderPage(ReviewPage as PageComponent, "sim-buffered");
    fireEvent.click(await screen.findByTestId("copilot-open-btn"));
    await waitFor(() => expect(state()).toHaveTextContent("Ready"));
    fireEvent.click(screen.getByTestId("copilot-ask-btn"));
    await waitFor(() => expect(state()).toHaveTextContent("Available"));

    // Hand-off only.
    fireEvent.click(screen.getByTestId("ai-open-next-live-btn"));
    const panel = await screen.findByTestId("next-live");
    const suggested = within(panel).getAllByTestId(/^ai-suggests-/);
    expect(suggested).toHaveLength(1);
    expect(suggested[0]).toHaveTextContent("AI suggests");
    expect(suggested[0]).toHaveTextContent("Why (AI):");
    const changeId = suggested[0].getAttribute("data-testid")!.replace("ai-suggests-", "");

    // recommendation != acceptance: nothing is ticked, nothing is created.
    for (const box of within(panel).getAllByRole("checkbox")) expect(box).not.toBeChecked();
    expect(screen.getByTestId("next-live-ai-count")).toHaveTextContent("Nothing is selected until you select it");
    expect(sessionStore.getSnapshot().sessions).toHaveLength(count);

    // The operator selects the suggestion (one click on an explicit button); only that proposal becomes ticked.
    fireEvent.click(screen.getByTestId("select-ai-suggested-btn"));
    expect(screen.getByTestId(`select-${changeId}`)).toBeChecked();
    expect(within(panel).getAllByRole("checkbox").filter((b) => (b as HTMLInputElement).checked)).toHaveLength(1);
    expect(sessionStore.getSnapshot().sessions).toHaveLength(count); // still nothing created

    // Creating is a further explicit act; the source show is never edited by any of this.
    fireEvent.click(screen.getByTestId("create-next-live-cta-btn"));
    await act(async () => {});
    expect(nav.push).toHaveBeenCalledWith(expect.stringMatching(/^\/live\/.+\/prepare$/));
    expect(sessionStore.getSnapshot().sessions).toHaveLength(count + 1);
    expect(JSON.stringify(sessionStore.getSession("sim-buffered"))).toBe(source);
  });

  it("not configured: Review and Next LIVE keep working with product-logic facts and no AI marks", async () => {
    finishRehearsal("sim-buffered");
    installAi(new FakeRoom(), { status: { state: "not_configured", model: null, configIssues: ["LIVELIFT_AI_MODEL"] } });
    await renderPage(ReviewPage as PageComponent, "sim-buffered");
    fireEvent.click(await screen.findByTestId("copilot-open-btn"));
    await waitFor(() => expect(state()).toHaveTextContent("Not configured"));
    expect(screen.queryByTestId("copilot-ask-btn")).toBeNull();
    fireEvent.click(screen.getByTestId("view-next-btn"));
    const panel = await screen.findByTestId("next-live");
    expect(within(panel).queryAllByTestId(/^ai-suggests-/)).toHaveLength(0);
    expect(screen.queryByTestId("select-ai-suggested-btn")).toBeNull();
    expect(screen.getByTestId("create-next-live-cta-btn")).toBeInTheDocument();
  });

  it("REAL: Review checks the Copilot on its own (the room is already in use) and sends the show id only", async () => {
    const room = new FakeRoom();
    realShow(room, "real-1", { end: true });
    const ai = installAi(room);
    await renderPage(ReviewPage as PageComponent, "real-1");
    await waitFor(() => expect(state()).toHaveTextContent("Ready"));
    fireEvent.click(screen.getByTestId("copilot-ask-btn"));
    await waitFor(() => expect(state()).toHaveTextContent("Available"));
    expect(posts(ai)[0].body).toEqual({ sessionId: "real-1" });
    expect(screen.getByTestId("ai-footer")).toHaveTextContent("from REAL evidence");
    expect(room.posts()).toHaveLength(0);
  });
});
