import { providerSnapshot } from "./wireFixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/",
  useSearchParams: () => nav.search,
}));

import ReviewPage from "@/app/live/[sessionId]/review/page";
import { sessionStore } from "@/lib/store/sessionStore";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { authStore } from "@/lib/client/authStore";
import { buildReview } from "@/lib/domain";
import { buildScenarioRaw } from "@/lib/intelligence";
import { FakeRoom } from "../helpers/fakeRoom";
import { realShow } from "../phase3-ui/support";

type PageComponent = (props: { params: Promise<{ sessionId: string }> }) => React.ReactElement;

async function renderReview(sessionId: string): Promise<void> {
  const params = Promise.resolve({ sessionId });
  const Page = ReviewPage as PageComponent;
  await act(async () => {
    render(
      <Suspense fallback={<div>loading</div>}>
        <Page params={params} />
      </Suspense>
    );
  });
}

const SIM = "sim-buffered-done";
const later = (): void => {
  fireEvent.click(screen.getByTestId("perspective-later"));
};
const pick = (scenario: string): void => {
  fireEvent.change(screen.getByTestId("fixture-select"), { target: { value: scenario } });
};

let restore: Array<() => void> = [];
afterEach(() => {
  cleanup();
  for (const r of restore.reverse()) r();
  restore = [];
});
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.reset();
  remoteRoomStore.reset();
  sessionStore.reloadFromStorage();
  nav.search = new URLSearchParams();
});

describe("Review perspective: As known then / With later evidence", () => {
  it("opens on As known then, with two explicit, named perspectives and no provider data in sight", async () => {
    await renderReview(SIM);
    const tabs = await screen.findByRole("tablist", { name: "Review perspective" });
    const [known, laterTab] = within(tabs).getAllByRole("tab");
    expect(known).toHaveTextContent(/as known then/i);
    expect(laterTab).toHaveTextContent(/with later evidence/i);
    expect(known).toHaveAttribute("aria-selected", "true");
    expect(laterTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("review-perspective-panel")).toHaveAttribute("data-perspective", "known");
    expect(screen.getByTestId("known-then-note")).toHaveTextContent("No provider data is mixed in");
    expect(screen.getByTestId("provider-then-note")).toHaveTextContent("none recorded in LiveLift");
    expect(screen.queryByTestId("later-evidence-view")).toBeNull();
    expect(screen.queryByTestId("evidence-timeline")).toBeNull();
    expect(screen.queryByText(/fixture provider evidence/i)).toBeNull();
  });

  it("With later evidence discloses, before anything else, that the operator did not have this data", async () => {
    await renderReview(SIM);
    await screen.findByTestId("perspective-switch");
    later();
    const disclosure = await screen.findByTestId("later-evidence-disclosure");
    expect(disclosure).toHaveTextContent("This data was not available to the operator during the LIVE.");
    expect(disclosure).toHaveTextContent(/fetched/i);
    expect(screen.getByTestId("review-perspective-panel")).toHaveAttribute("data-perspective", "later");
    expect(screen.getByTestId("perspective-later")).toHaveAttribute("aria-selected", "true");
    // The recorded timeline is shown beside it; the "as known then" summary is not mixed in.
    expect(screen.queryByTestId("review-summary")).toBeNull();
    expect(screen.queryByTestId("known-then-replay")).toBeNull();
  });

  it("switching perspectives (and fixture states) reads only: the recorded session is byte-identical and nothing is fetched", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    restore.push(() => fetchSpy.mockRestore());
    const before = JSON.stringify(sessionStore.getSession(SIM));
    await renderReview(SIM);
    await screen.findByTestId("perspective-switch");
    later();
    await screen.findByTestId("evidence-timeline");
    for (const s of ["ambiguous", "zero_clicks", "missing_clicks", "rate_limited", "rich"]) pick(s);
    fireEvent.click(screen.getByTestId("perspective-known"));
    expect(await screen.findByTestId("review-summary")).toBeInTheDocument();
    expect(JSON.stringify(sessionStore.getSession(SIM))).toBe(before);
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("live-intelligence"))).toHaveLength(0);
  });

  it("is keyboard operable: one tab stop, arrows and Home/End move and select", async () => {
    await renderReview(SIM);
    const known = await screen.findByTestId("perspective-known");
    const laterTab = screen.getByTestId("perspective-later");
    expect(known).toHaveAttribute("tabindex", "0");
    expect(laterTab).toHaveAttribute("tabindex", "-1");
    known.focus();
    fireEvent.keyDown(known, { key: "ArrowRight" });
    expect(laterTab).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(laterTab);
    expect(laterTab).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(laterTab, { key: "Home" });
    expect(known).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(known);
    fireEvent.keyDown(known, { key: "End" });
    expect(laterTab).toHaveAttribute("aria-selected", "true");
    // The tab controls a real panel that names it.
    expect(laterTab.getAttribute("aria-controls")).toBe("review-perspective-panel");
    expect(screen.getByTestId("review-perspective-panel")).toHaveAttribute("aria-labelledby", "perspective-tab-later");
  });

  it("can be opened straight onto later evidence from the address (?perspective=later&evidence=...)", async () => {
    nav.search = new URLSearchParams("perspective=later&evidence=ambiguous");
    await renderReview(SIM);
    expect(await screen.findByTestId("later-evidence-view")).toBeInTheDocument();
    expect(screen.getByTestId("fixture-select")).toHaveValue("ambiguous");
  });
});

describe("SIMULATED later evidence is visibly a fixture", () => {
  it("labels fixture provider evidence at the top and on every tier mark", async () => {
    await renderReview(SIM);
    await screen.findByTestId("perspective-switch");
    later();
    const banner = await screen.findByTestId("fixture-banner");
    expect(banner).toHaveTextContent("FIXTURE PROVIDER EVIDENCE");
    expect(banner).toHaveTextContent(/not TikTok data/i);
    expect(screen.getByTestId("later-evidence-view")).toHaveAttribute("data-origin", "fixture");
    expect(screen.getByTestId("later-evidence-disclosure")).toHaveTextContent("Fixture provider evidence");
    expect(screen.queryByTestId("tier-provider")).toBeNull();
    expect(screen.getByTestId("provenance")).toHaveTextContent("Fixture generator (not TikTok)");
  });
});

describe("missing != zero, in the chart, the table and the attribution", () => {
  const openLater = async (scenario: string): Promise<void> => {
    await renderReview(SIM);
    await screen.findByTestId("perspective-switch");
    later();
    await screen.findByTestId("fixture-select");
    pick(scenario);
  };
  const cellsFor = (metric: string): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(`[data-testid^="attribution-"][data-coverage] [data-metric="${metric}"] [data-state]`));

  it("a recorded zero is drawn as a visible 0 and read as 0", async () => {
    await openLater("zero_clicks");
    fireEvent.click(screen.getByTestId("metric-clicks"));
    const chart = screen.getByTestId("evidence-chart");
    const minutes = chart.querySelectorAll("[data-minute]");
    expect(minutes.length).toBeGreaterThan(5);
    expect(Array.from(minutes).every((m) => m.getAttribute("data-state") === "zero")).toBe(true);
    expect(screen.getByLabelText("Chart key")).toHaveTextContent("Recorded as 0");
    expect(screen.getByLabelText("Chart key")).not.toHaveTextContent("Not recorded");
    const states = cellsFor("clicks").map((c) => c.getAttribute("data-state"));
    expect(states.length).toBeGreaterThan(0);
    expect(states.filter((s) => s === "zero").length).toBeGreaterThan(0);
    expect(states).not.toContain("missing");
    expect(screen.getByTestId("metric-clicks").closest("label")).toHaveTextContent("all 0");
  });

  it("a missing value is words, never a bar, never 0", async () => {
    await openLater("missing_clicks");
    const label = screen.getByTestId("metric-clicks").closest("label");
    expect(label).toHaveTextContent("not recorded");
    fireEvent.click(screen.getByTestId("metric-clicks"));
    const note = screen.getByTestId("metric-missing-note");
    expect(note).toHaveTextContent("was not recorded for any provider minute");
    expect(note).toHaveTextContent("This is not zero.");
    expect(screen.queryByTestId("evidence-chart")).toBeNull(); // no empty track that could read as zero
    const states = cellsFor("clicks");
    expect(states.length).toBeGreaterThan(0);
    expect(states.every((c) => c.getAttribute("data-state") === "missing" && c.textContent === "Not recorded")).toBe(true);
    // The product table says the same.
    const products = screen.getByTestId("product-performance");
    expect(products).toHaveTextContent("Not recorded");
    expect(within(products).queryAllByText("0")).toHaveLength(0);
  });

  it("zero GMV and missing GMV are different things, and an amount always names its currency", async () => {
    await openLater("zero_gmv");
    const zero = screen.getByTestId("product-performance");
    expect(zero).toHaveTextContent("VND 0");
    pick("missing_gmv");
    const missing = screen.getByTestId("product-performance");
    expect(missing).not.toHaveTextContent("VND 0");
    expect(missing).toHaveTextContent("Not recorded");
    pick("rich");
    expect(screen.getByTestId("product-performance").textContent).toMatch(/VND [\d,]+/);
  });

  it("a minute that overlaps two segments is a deliberate state: marked, explained, and assigned to neither", async () => {
    await openLater("ambiguous");
    expect(screen.getByTestId("key-boundary")).toHaveTextContent("Boundary minute: overlaps a segment edge, not assigned");
    const hollow = document.querySelectorAll('[data-minute][data-boundary="true"]');
    expect(hollow.length).toBeGreaterThan(0);
    const row = document.querySelector<HTMLElement>('[data-testid^="attribution-"][data-coverage="ambiguous"]');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("Boundary minutes not assigned");
    const id = row!.getAttribute("data-testid")!.replace("attribution-", "");
    fireEvent.click(screen.getByTestId(`attribution-toggle-${id}`));
    const detail = screen.getByTestId(`ambiguous-${id}`);
    expect(detail).toHaveTextContent("Attribution ambiguous at");
    expect(detail).toHaveTextContent("Not assigned to either.");
    expect(screen.getByTestId(`attribution-toggle-${id}`)).toHaveAttribute("aria-expanded", "true");
    // The minute table twin labels the same minutes.
    fireEvent.click(within(screen.getByTestId("minute-table-details")).getByText(/Minute-by-minute table/));
    expect(document.querySelectorAll('[data-testid="minute-row"][data-boundary="true"]').length).toBe(hollow.length);
  });

  it("raw comment text is never offered, and unsupported comment counts say so instead of showing zero", async () => {
    await openLater("unsupported_comments");
    expect(screen.getByTestId("metric-comments").closest("label")).toHaveTextContent("not offered");
    const id = document.querySelector<HTMLElement>('[data-testid^="attribution-"][data-coverage]')!.getAttribute("data-testid")!.replace("attribution-", "");
    fireEvent.click(screen.getByTestId(`attribution-toggle-${id}`));
    const comments = within(screen.getByTestId(`attribution-details-${id}`)).getByText("Comment count").closest("div")!;
    expect(comments).toHaveTextContent("Not offered by the provider");
    expect(comments.textContent).not.toMatch(/\b0\b/);
    expect(screen.getByTestId("evidence-limits")).toHaveTextContent(/Raw LIVE chat text is not available from the official API/);
  });

  it("segments that never ran have nothing to attribute, and a missing duration is not drawn as zero", async () => {
    await openLater("rich");
    const review = buildReview(sessionStore.getSession(SIM)!)!;
    const notRun = review.rows.filter((r) => r.actual === null);
    for (const r of notRun) {
      const row = screen.getByTestId(`attribution-${r.segmentId}`);
      expect(row).toHaveAttribute("data-coverage", "unattributed");
      expect(row).toHaveTextContent(/did not run|Skipped|Incomplete record/);
      expect(row).not.toHaveTextContent(/\b0:00\b/);
    }
  });
});

describe("provider states are plain statements, not faults", () => {
  const cases: Array<[string, string, RegExp]> = [
    ["not_configured", "not_configured", /No provider evidence is set up on this server/],
    ["access_not_granted", "access_not_granted", /Access to TikTok Shop analytics has not been granted/],
    ["auth_expired", "auth_expired", /authorization has expired/],
    ["rate_limited", "rate_limited", /limiting requests/],
    ["unavailable", "unavailable", /could not be fetched/],
  ];
  it.each(cases)("%s", async (scenario, kind, text) => {
    await renderReview(SIM);
    await screen.findByTestId("perspective-switch");
    later();
    await screen.findByTestId("fixture-select");
    pick(scenario);
    const panel = await screen.findByTestId("provider-state");
    expect(panel).toHaveAttribute("data-kind", kind);
    expect(panel).toHaveTextContent(text);
    expect(panel).toHaveTextContent("never shown as 0");
    expect(screen.queryByTestId("evidence-timeline")).toBeNull();
    expect(screen.queryByTestId("segment-attribution")).toBeNull();
    // The fixture label stays: these are fixture states of a SIMULATED rehearsal.
    expect(screen.getByTestId("fixture-banner")).toBeInTheDocument();
  });
});

describe("REAL shows: provider evidence comes from the server or not at all", () => {
  async function openRealReview(respond: (url: string) => Response | null): Promise<{ session: ReturnType<typeof realShow> }> {
    const room = new FakeRoom();
    restore.push(room.install());
    const session = realShow(room, "real-1", { end: true });
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => respond(String(input)) ?? inner(input, init)) as typeof fetch;
    restore.push(() => {
      globalThis.fetch = inner;
    });
    await renderReview("real-1");
    return { session };
  }

  it("with no provider configured the later view says so, and shows no numbers and no fixture label", async () => {
    await openRealReview(url => url.includes("/intelligence/evidence") ? new Response(JSON.stringify({ state: "NOT_CONFIGURED" }), { status: 200 }) : null); // the fake room has no live-intelligence route: a server without provider evidence
    fireEvent.click(await screen.findByTestId("perspective-later"));
    await waitFor(() => expect(screen.getByTestId("later-evidence-view")).toHaveAttribute("data-state", "not_configured"));
    expect(screen.getByTestId("provider-state")).toHaveTextContent("No provider evidence is set up on this server");
    expect(screen.queryByTestId("fixture-banner")).toBeNull();
    expect(screen.queryByTestId("fixture-select")).toBeNull();
    expect(screen.queryByTestId("evidence-timeline")).toBeNull();
    expect(screen.getByTestId("later-evidence-view")).not.toHaveAttribute("data-origin");
  });

  it("shows a real provider snapshot as provider-observed, with its provenance, and never as a fixture", async () => {
    let sessionJson: ReturnType<typeof realShow> | null = null;
    const { session } = await openRealReview((url) => {
      if (!url.includes("/api/v3/intelligence/evidence?") || sessionJson === null) return null;
      const review = buildReview(sessionJson)!;
      return new Response(JSON.stringify({ state: "AVAILABLE", snapshot: providerSnapshot(buildScenarioRaw({ ...sessionJson, environment: "SIMULATED" }, review, "rich")) }), { status: 200 });
    });
    sessionJson = session;
    fireEvent.click(await screen.findByTestId("perspective-later"));
    await waitFor(() => expect(screen.getByTestId("later-evidence-view")).toHaveAttribute("data-state", "available"));
    expect(screen.getByTestId("later-evidence-view")).toHaveAttribute("data-origin", "provider");
    expect(screen.getByTestId("later-evidence-disclosure")).toHaveTextContent("This data was not available to the operator during the LIVE.");
    expect(screen.getByTestId("later-evidence-disclosure")).toHaveTextContent("TikTok Shop");
    expect(screen.getByTestId("provenance")).toHaveTextContent("Provider observed");
    expect(screen.queryByTestId("fixture-banner")).toBeNull();
    expect(screen.queryByTestId("tier-fixture")).toBeNull();
  });

  it("refuses fixture evidence sent for a REAL show instead of displaying it", async () => {
    let sessionJson: ReturnType<typeof realShow> | null = null;
    const { session } = await openRealReview((url) => {
      if (!url.includes("/api/v3/intelligence/evidence?") || sessionJson === null) return null;
      const review = buildReview(sessionJson)!;
      return new Response(JSON.stringify({ state: "AVAILABLE", snapshot: buildScenarioRaw({ ...sessionJson, environment: "SIMULATED" }, review, "rich") }), { status: 200 }); // provider: "fixture"
    });
    sessionJson = session;
    fireEvent.click(await screen.findByTestId("perspective-later"));
    await waitFor(() => expect(screen.getByTestId("provider-state")).toHaveAttribute("data-kind", "unavailable"));
    expect(screen.getByTestId("provider-state")).toHaveTextContent(/fixture or SIMULATED evidence for a REAL show/i);
    expect(screen.queryByTestId("evidence-timeline")).toBeNull();
    expect(screen.queryByTestId("segment-attribution")).toBeNull();
  });

  it("access not granted and rate limiting arrive as their own states, with no data", async () => {
    await openRealReview((url) => (url.includes("/intelligence/evidence") ? new Response(JSON.stringify({ state: "ACCESS_NOT_GRANTED" }), { status: 200 }) : null));
    fireEvent.click(await screen.findByTestId("perspective-later"));
    await waitFor(() => expect(screen.getByTestId("provider-state")).toHaveAttribute("data-kind", "access_not_granted"));
    expect(screen.getByTestId("provider-state")).toHaveTextContent("never shown as 0");
  });
});
