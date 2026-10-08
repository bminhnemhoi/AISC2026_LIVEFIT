import { wireSnapshot } from "./wireFixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Session } from "@/contracts";
import type { AiFact, ReviewAvailable } from "@/contracts/ai";

const state = vi.hoisted(() => ({ sessions: [] as Session[] }));
vi.mock("@/components/shell", () => ({ StandardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/ops/ConnectionStatus", () => ({ RoomStatusPanel: () => null }));
vi.mock("@/lib/store/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store/hooks")>()),
  useSessions: () => ({ hydrated: true, sessions: state.sessions, remote: { snapshot: {}, connection: "connected", problem: null } }),
  useStoreState: () => ({ storage: "ok", notices: [], hydrated: true, sessions: state.sessions }),
}));

import InsightsPage from "@/app/insights/page";
import IntegrationsPage from "@/app/integrations/page";
import { ReviewCopilot } from "@/components/ai/ReviewCopilot";
import type { AiCopilot } from "@/components/ai/useAiCopilot";
import { CapabilityLedger } from "@/components/intelligence/CapabilityLedger";
import { LaterEvidenceView } from "@/components/intelligence/LaterEvidenceView";
import { PerspectiveTabs } from "@/components/intelligence/PerspectiveTabs";
import { ProductPerformanceTable } from "@/components/intelligence/ProductPerformanceTable";
import { ProviderStatePanel } from "@/components/intelligence/ProviderState";
import { authStore } from "@/lib/client/authStore";
import { buildReview, createScenarioSession, runScript, type Review } from "@/lib/domain";
import { buildLedger, fixtureResultFor, parseSnapshot, STATE_WORDS, type LiveIntelligenceSnapshot, type LiveIntelligenceState } from "@/lib/intelligence";

afterEach(cleanup);
beforeEach(() => {
  authStore.reset();
  state.sessions = [];
});

const ended = (scenario: "buffered" | "missed" = "buffered", id?: string): Session => runScript(createScenarioSession(scenario, id ? { id } : {}));
const reviewOf = (s: Session): Review => buildReview(s)!;

describe("capabilities: unavailable is a stated fact, not a broken control", () => {
  it("spells each state in words, with the reason beside it", () => {
    render(
      <CapabilityLedger
        rows={buildLedger({
          loginKit: "connected",
          server: [{ key: "product_clicks", state: "NOT_CONFIGURED", support: "POST_LIVE", scope: null, note: "" }],
        })}
      />
    );
    expect(screen.getByTestId("capability-login_kit")).toHaveTextContent(STATE_WORDS.connected);
    expect(screen.getByTestId("capability-shop_analytics")).toHaveTextContent("ACCESS NOT CONFIGURED");
    expect(screen.getByTestId("capability-creator_realtime")).toHaveTextContent("PARTNER ACCESS REQUIRED");
    expect(screen.getByTestId("capability-raw_chat")).toHaveTextContent("UNSUPPORTED BY OFFICIAL API");
    expect(screen.getByTestId("capability-pin_control")).toHaveTextContent("UNSUPPORTED BY OFFICIAL API");
    expect(screen.getByTestId("capability-raw_chat")).toHaveTextContent(/never shows comments/i);
    // Nothing offers to "fix" what the platform does not offer: the ledger has no buttons at all.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("the Integrations page carries the same ledger, without claiming anything it has not been told", async () => {
    await act(async () => {
      render(<IntegrationsPage />);
    });
    const section = screen.getByTestId("provider-evidence-access");
    expect(section).toHaveTextContent("Provider evidence access");
    expect(within(section).getByTestId("capability-raw_chat")).toHaveAttribute("data-state", "unsupported");
    expect(within(section).getByTestId("capability-pin_control")).toHaveAttribute("data-state", "unsupported");
    expect(within(section).getByTestId("capability-creator_realtime")).toHaveAttribute("data-state", "partner_access_required");
    // Nobody has asked the server (no session): not "not configured", not "available" either.
    expect(within(section).getByTestId("capability-shop_analytics")).toHaveAttribute("data-state", "unknown");
    expect(within(section).getByTestId("capability-shop_analytics")).toHaveTextContent("NOT CHECKED");
    expect(section).not.toHaveTextContent("AVAILABLE");
  });
});

describe("provider state panel", () => {
  const states: Array<[LiveIntelligenceState, RegExp]> = [
    [{ kind: "not_configured" }, /no provider evidence is set up/i],
    [{ kind: "access_not_granted" }, /has not been granted/i],
    [{ kind: "auth_expired" }, /has expired/i],
    [{ kind: "rate_limited", retryAfterSec: 45 }, /about 45 seconds/],
    [{ kind: "rate_limited", retryAfterSec: 300 }, /about 5 minutes/],
    [{ kind: "unsupported" }, /does not offer this evidence/i],
    [{ kind: "unavailable", reason: "settling", message: "still settling" }, /still settling/i],
    [{ kind: "unavailable", reason: "network", message: "The server could not be reached." }, /could not be fetched/i],
    [{ kind: "unavailable", reason: "rejected_fixture", message: "fixture refused" }, /could not trust the evidence/i],
    [{ kind: "signed_out" }, /sign in/i],
    [{ kind: "not_applicable", message: "A local archive." }, /local archive/i],
  ];
  it.each(states)("%j", (st, text) => {
    render(<ProviderStatePanel state={st} onRetry={() => undefined} />);
    const panel = screen.getByTestId("provider-state");
    expect(panel).toHaveTextContent(text);
    expect(panel).toHaveTextContent("never shown as 0");
    expect(panel.textContent).not.toMatch(/\b0 (clicks|orders|sales)\b/);
  });

  it("offers Try again only where trying again can help", () => {
    const retry = vi.fn();
    const { rerender } = render(<ProviderStatePanel state={{ kind: "rate_limited", retryAfterSec: 10 }} onRetry={retry} />);
    fireEvent.click(screen.getByTestId("provider-retry-btn"));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<ProviderStatePanel state={{ kind: "unsupported" }} onRetry={retry} />);
    expect(screen.queryByTestId("provider-retry-btn")).toBeNull();
    rerender(<ProviderStatePanel state={{ kind: "unavailable", reason: "malformed", message: "bad" }} onRetry={retry} />);
    expect(screen.queryByTestId("provider-retry-btn")).toBeNull(); // untrusted data is not fixed by asking again
  });

  it("fetching is announced politely and busy", () => {
    render(<ProviderStatePanel state={{ kind: "fetching" }} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Fetching provider evidence");
  });
});

describe("product performance: no invented matches, no mixed money", () => {
  const product = (id: string, code: string, name: string) => ({ id, code, name, price: null, currency: "USD", priority: "normal" as const, status: "enabled" as const, talkingPoints: [], constraints: [], initials: "PR" });
  const raw = (rows: unknown[]) => {
    const p = parseSnapshot(wireSnapshot({ productPerformance: rows, productMappings: [{ liveLiftProductId: "p1", providerProductId: "100001" }, { liveLiftProductId: "p2", providerProductId: "100003" }, { liveLiftProductId: "p3", providerProductId: "100003" }] }));
    if (!p.ok) throw new Error("bad");
    return p.snapshot;
  };
  const review = {
    rows: [
      { productId: "p1", title: "Hoodie pitch", actual: { startMs: 0, endMs: 1, durSec: 1 }, outcome: "completed" },
      { productId: "p1", title: "Hoodie recap", actual: { startMs: 2, endMs: 3, durSec: 1 }, outcome: "completed" },
    ],
  } as unknown as Review;

  it("shows ambiguous, unmatched, repeated and session-level products exactly as they are", () => {
    const products = [product("p1", "A01", "Zip Hoodie"), product("p2", "B01", "Same name"), product("p3", "B02", "Same name")];
    const snapshot = raw([
      { productId: "100001", skuId: "A", impressions: 100, clicks: 0, orders: 0, gmv: { amount: "0", currency: "VND" }, availability: "available" },
      { productId: "100001", skuId: "B", impressions: 40, clicks: 5, orders: 1, gmv: { amount: "90000", currency: "VND" }, ctor: { numerator: "1", denominator: "5" }, availability: "available" },
      { productId: "100003", productLabel: "same name", impressions: 9, availability: "available" },
      { productId: "tt-9", productLabel: "Unmapped listing", impressions: 7, clicks: null, gmv: { amount: "12", currency: "USD" }, availability: "available" },
    ]);
    render(<ProductPerformanceTable snapshot={snapshot} products={products} review={review} origin="fixture" />);
    const rows = screen.getAllByTestId("product-row");
    expect(rows.map((r) => r.getAttribute("data-match"))).toEqual(["matched", "matched", "ambiguous", "unmatched"]);
    expect(rows[0]).toHaveTextContent("Matched to A01 · mapped by the server");
    expect(rows[2]).toHaveTextContent("Ambiguous: could be B01 or B02. Not assigned to any.");
    expect(rows[3]).toHaveTextContent("Not matched to a LiveLift product.");
    expect(rows[3]).toHaveTextContent("provider id tt-9"); // the provider's own label and id, not a LiveLift product
    // 0 clicks => the rate is "not defined", not 0% and not missing.
    expect(rows[0]).toHaveTextContent("Not defined (0 clicks)");
    expect(rows[1]).toHaveTextContent("20%");
    // A recorded zero and a missing value never read alike.
    expect(within(rows[0]).getAllByText("0")).toHaveLength(2); // clicks and orders; GMV reads "VND 0"
    expect(within(rows[3]).getAllByText("Not recorded").length).toBeGreaterThanOrEqual(2); // clicks and orders were never sent
    // Repeated mapping and session-level figure.
    expect(within(rows[0]).getByTestId("sibling-note")).toHaveTextContent("2 provider rows map to this product");
    expect(within(rows[0]).getByTestId("session-level-note")).toHaveTextContent("ran in 2 segments");
    expect(within(rows[0]).getByTestId("session-level-note")).toHaveTextContent("not split by segment");
    // Two currencies: each stays in its own, and there is no total row.
    expect(screen.getByTestId("mixed-currency-note")).toHaveTextContent("none are added together");
    expect(rows[0]).toHaveTextContent("VND 0");
    expect(rows[3]).toHaveTextContent("USD 12");
    expect(screen.queryByText(/total/i)).toBeNull();
  });

  it("says when the provider supplied no product rows, without calling that zero", () => {
    render(<ProductPerformanceTable snapshot={raw([])} products={[]} review={review} origin="provider" />);
    expect(screen.getByTestId("no-product-rows")).toHaveTextContent("not the same as no product activity");
  });

  it("rejects monetary evidence without a stated currency instead of displaying invented money", () => {
    expect(parseSnapshot(wireSnapshot({ productPerformance: [{ productId: "x", productLabel: "Thing", gmv: { amount: "1500" }, availability: "available" }] }))).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("AI: operations evidence, provider evidence, interpretation, recommendation", () => {
  const session = ended();
  const facts: AiFact[] = [
    { id: "f1", topic: "timing", kind: "recorded", text: "Zip Hoodie ran 3:00 over its plan." },
    { id: "f2", topic: "provider_clicks", kind: "recorded", evidenceTier: "provider_observed", source: "fixture", fetchedAt: 1, perspective: "later_evidence", text: "Provider-observed clicks per minute were higher during Zip Hoodie." },
  ];
  const result: ReviewAvailable = {
    status: "available",
    task: "review",
    environment: "SIMULATED",
    model: "fixture-model",
    generatedAtMs: 0,
    asOfMs: session.runtime.endedAtMs ?? 0,
    facts,
    basis: { revision: session.revision, criticalSegmentId: null, recoveryStatus: "none" },
    output: {
      summary: { text: "A summary of operations.", cites: ["f1"] },
      deviations: [
        { text: "Hoodie overran.", cites: ["f1"] },
        { text: "Clicks were higher in the Hoodie window.", cites: ["f2"] },
      ],
      gaps: [],
      evidenceLimits: [],
      nextLive: [
        { change: { id: "c1", title: "Shorten Hoodie", detail: "Plan it shorter.", basis: "observed" }, why: "It overran.", cites: ["f1"] },
        { change: { id: "c2", title: "Move the flash sale earlier", detail: "Try an earlier slot.", basis: "tradeoff" }, why: "Clicks were higher.", cites: ["f2"] },
      ],
      manualIdeas: [],
    },
  };
  const copilot: AiCopilot<ReviewAvailable> = { phase: "available", model: "fixture-model", configIssues: [], failure: null, result, viewer: false, canAsk: true, ask: vi.fn(), recheck: vi.fn() };
  const mount = (perspective: "known" | "later" | undefined) =>
    render(<ReviewCopilot copilot={copilot} perspective={perspective} session={session} source="local" archive={false} facts={facts} opened onOpen={() => undefined} onOpenNextLive={() => undefined} />);

  it("later: provider facts sit in their own labelled group, and statements resting on them say so", () => {
    mount("later");
    expect(screen.getByTestId("layer-operations")).toHaveTextContent("Operations evidence");
    expect(screen.getByTestId("provider-facts")).toHaveTextContent("Provider evidence");
    expect(screen.getByTestId("provider-facts")).toHaveTextContent(/not known during the LIVE/);
    expect(screen.getByTestId("provider-facts")).toHaveTextContent("Provider observed · later");
    expect(screen.getAllByTestId("layer-interpretation").length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("ai-deviations")).getByTestId("basis-later")).toHaveTextContent("includes later provider evidence");
    expect(screen.getAllByTestId("ai-next-live-item")).toHaveLength(2);
    // Numbers stay stable across the two groups: "fact 2" is the provider fact.
    expect(screen.getByTestId("provider-facts")).toHaveTextContent("2");
  });

  it("known: nothing the operator could not have known is shown, and what is withheld is counted", () => {
    mount("known");
    expect(screen.queryByTestId("provider-facts")).toBeNull();
    expect(screen.getByTestId("provider-facts-withheld")).toHaveTextContent("1 provider fact belongs to later evidence");
    expect(screen.getByTestId("ai-withheld-note")).toHaveTextContent("2 AI statements rest on evidence the operator did not have");
    expect(screen.getByTestId("ai-deviations")).toHaveTextContent("Hoodie overran.");
    expect(screen.getByTestId("ai-deviations")).not.toHaveTextContent("Clicks were higher");
    expect(screen.getAllByTestId("ai-next-live-item")).toHaveLength(1);
    expect(screen.getByTestId("ai-next-live-item")).toHaveAttribute("data-change-id", "c1");
    expect(screen.queryByText(/Move the flash sale/)).toBeNull();
  });

  it("known: an analysis using post-LIVE operator records stays in the later perspective", () => {
    const late = structuredClone(session);
    late.events.push({ ...late.events.at(-1)!, id: "late-note", seq: late.events.length + 1, type: "note_added", recordedAtMs: late.runtime.endedAtMs! + 1, data: { text: "POST LIVE ONLY" } });
    render(<ReviewCopilot copilot={copilot} perspective="known" session={late} source="local" archive={false} facts={[facts[0]]} opened onOpen={() => undefined} onOpenNextLive={() => undefined} />);
    expect(screen.getByTestId("ai-summary-withheld")).toHaveTextContent("records appended after the LIVE");
    expect(screen.queryByTestId("ai-summary")).toBeNull();
    expect(screen.queryByText("Hoodie overran.")).toBeNull();
    expect(screen.queryByText("POST LIVE ONLY")).toBeNull();
    expect(screen.getByTestId("layer-operations")).toBeInTheDocument();
  });

  it("the recommendation is advice: recommended, not applied, with nothing to click that applies it", () => {
    for (const perspective of ["known", "later", undefined] as const) {
      cleanup();
      mount(perspective);
      expect(screen.getByTestId("layer-recommendation")).toHaveTextContent("AI recommendation");
      expect(screen.getByTestId("layer-recommendation")).toHaveTextContent("not selected, not applied");
      expect(screen.getByTestId("ai-recommended-not-applied")).toHaveTextContent("Recommended, not applied.");
      expect(screen.queryByRole("button", { name: /apply|accept|confirm/i })).toBeNull();
      expect(screen.getByTestId("ai-open-next-live-btn")).toHaveTextContent("Choose in Next LIVE");
    }
  });
});

describe("Insights: platform evidence is kept apart from LiveLift operations", () => {
  const withSessions = (): void => {
    const buffered = ended("buffered");
    const missed = ended("missed");
    state.sessions = [buffered, missed, { ...structuredClone(buffered), id: "real-1", environment: "REAL", title: "REAL observed operations" }];
  };

  it("labels two bands, operations first, and keeps them in separate sections", () => {
    withSessions();
    render(<InsightsPage />);
    const operations = screen.getByTestId("band-operations");
    const platform = screen.getByTestId("platform-evidence");
    expect(within(operations).getByRole("heading", { level: 2 })).toHaveTextContent("LiveLift operations");
    expect(within(platform).getByRole("heading", { level: 2 })).toHaveTextContent("Platform evidence");
    expect(operations.compareDocumentPosition(platform) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(platform).toHaveTextContent(/never added together/);
    expect(operations.contains(platform)).toBe(false);
  });

  it("a REAL show asks only when the operator asks, offers no fixture, and never shows fixture evidence", () => {
    withSessions();
    render(<InsightsPage />);
    const panel = screen.getByTestId("platform-evidence");
    expect(panel).toHaveAttribute("data-environment", "REAL");
    expect(screen.getByTestId("platform-evidence-idle")).toHaveTextContent("fetched when you ask");
    expect(screen.getByTestId("platform-evidence-request")).toHaveTextContent("Check provider evidence");
    expect(panel).not.toHaveTextContent(/fixture/i);
    expect(within(panel).getByRole("list", { name: "Provider metrics, all unavailable" })).toHaveTextContent("GMV — Unavailable");
    fireEvent.click(screen.getByTestId("platform-evidence-request"));
    // Nobody is signed in here, so the server cannot be asked: waiting or signed out, never a result, never a fixture.
    expect(["fetching", "signed_out"]).toContain(screen.getByTestId("platform-evidence-body").getAttribute("data-state"));
    expect(panel).not.toHaveTextContent(/fixture/i);
    expect(screen.queryByTestId("fixture-banner")).toBeNull();
    expect(screen.queryByTestId("evidence-timeline")).toBeNull();
  });

  it("a SIMULATED rehearsal shows fixture evidence only after an explicit, labelled opt-in", () => {
    withSessions();
    render(<InsightsPage />);
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "SIMULATED" } });
    const panel = screen.getByTestId("platform-evidence");
    expect(panel).toHaveAttribute("data-environment", "SIMULATED");
    expect(panel).toHaveTextContent(/Unavailable: no provider-observed/);
    expect(screen.queryByTestId("fixture-banner")).toBeNull();
    expect(screen.queryByTestId("segment-attribution")).toBeNull();
    fireEvent.click(screen.getByTestId("platform-evidence-request"));
    expect(screen.getByTestId("fixture-banner")).toHaveTextContent("FIXTURE PROVIDER EVIDENCE");
    expect(screen.getByTestId("segment-attribution")).toBeInTheDocument();
    expect(screen.getByTestId("product-performance")).toBeInTheDocument();
    expect(screen.getByTestId("later-evidence-disclosure")).toHaveTextContent("not available to the operator during the LIVE");
    // The trend compares shows only where fixture evidence exists, and lower-bounds totals with holes.
    expect(screen.getByTestId("evidence-trend")).toHaveTextContent("lower bound");
  });
});

describe("layout contract (what a phone and a tablet get)", () => {
  const session = ended();
  const review = reviewOf(session);
  const result = fixtureResultFor(session, review, "ambiguous");
  if (result?.kind !== "available") throw new Error("fixture");
  const snapshot: LiveIntelligenceSnapshot = result.snapshot;
  const intelligence = { state: result as LiveIntelligenceState, reload: () => undefined, refresh: () => undefined, canRefresh: false, refreshing: false };
  const mount = () => render(<LaterEvidenceView session={session} review={review} intelligence={intelligence} scenario="ambiguous" onScenario={() => undefined} onRetry={() => undefined} />);

  it("the perspective switch stacks on a phone, sits side by side from sm, and every tab is a tall target", () => {
    render(<PerspectiveTabs value="known" onChange={() => undefined} panelId="p" />);
    expect(screen.getByTestId("perspective-switch").className).toMatch(/grid-cols-1/);
    expect(screen.getByTestId("perspective-switch").className).toMatch(/sm:grid-cols-2/);
    for (const id of ["known", "later"]) expect(screen.getByTestId(`perspective-${id}`).className).toMatch(/min-h-\[56px\]/);
    // The blurbs are short enough to stay on one line at 375px.
    for (const t of screen.getAllByRole("tab")) expect(t.querySelectorAll("span span")[1].textContent!.length).toBeLessThanOrEqual(36);
  });

  it("attribution stacks on a phone, pairs up on a tablet, and only becomes columns from lg; 44px detail targets", () => {
    mount();
    const table = screen.getByRole("table", { name: "Segment attribution" });
    expect(table.closest(".overflow-x-auto")).toBeNull();
    const header = within(table).getAllByRole("row")[0];
    expect(header.className).toMatch(/\bhidden\b/);
    expect(header.className).toMatch(/lg:grid/);
    const firstRow = within(table).getAllByRole("row")[1];
    expect(firstRow.className).toMatch(/grid-cols-1/);
    expect(firstRow.className).toMatch(/sm:grid-cols-2/); // tablet: duration beside evidence
    expect(firstRow.className).toMatch(/lg:grid-cols-\[/);
    const toggles = screen.getAllByRole("button", { name: /Details/ });
    expect(toggles.length).toBeGreaterThan(0);
    for (const t of toggles) expect(t.className).toMatch(/min-h-\[44px\]/);
    // Details are progressive: closed until asked for.
    for (const t of toggles) expect(t).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector('[data-testid^="attribution-details-"]')).toBeNull();
  });

  it("product performance stacks below lg and only becomes columns on a wide desk", () => {
    render(<ProductPerformanceTable snapshot={snapshot} products={session.products} review={review} origin="fixture" />);
    const table = screen.getByRole("table", { name: "Product performance" });
    expect(table.closest(".overflow-x-auto")).toBeNull();
    expect(within(table).getAllByRole("row")[0].className).toMatch(/hidden.*lg:grid/);
    expect(table.querySelector(".lg\\:contents")).not.toBeNull();
  });

  it("the chart is drawn in percentages, so it can never be wider than its column", () => {
    mount();
    const minutes = Array.from(document.querySelectorAll<HTMLElement>("[data-minute]"));
    expect(minutes.length).toBeGreaterThan(5);
    for (const m of minutes) {
      expect(m.style.left).toMatch(/%$/);
      expect(m.style.width).toMatch(/%$/);
    }
    expect(screen.getByTestId("evidence-chart").style.width).toBe("");
    // The metric choices are real radios in one group with tall targets.
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(6);
    expect(new Set(radios.map((r) => r.getAttribute("name"))).size).toBe(1);
    for (const r of radios) expect(r.nextElementSibling!.className).toMatch(/min-h-\[44px\]/);
  });

  it("the minute table keeps one metric column on a phone; the rest return from md", () => {
    mount();
    fireEvent.click(within(screen.getByTestId("minute-table-details")).getByText(/Minute-by-minute table/));
    const head = screen.getAllByRole("columnheader");
    const hiddenOnPhone = head.filter((h) => /\bhidden\b/.test(h.className) && /md:table-cell/.test(h.className));
    expect(hiddenOnPhone.length).toBe(5); // six metrics, one shown
    expect(screen.getByRole("region", { name: "Minute-by-minute provider evidence" })).toHaveAttribute("tabindex", "0"); // scrollable by keyboard
  });

  it("the later view only splits into two columns on a wide desk, so a tablet is not a squeezed desktop", () => {
    mount();
    const grid = screen.getByLabelText("Evidence provenance and limits").parentElement!;
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/xl:grid-cols-/);
  });

  it("every chart has its table, and the chart itself has a spoken summary", () => {
    mount();
    const summary = screen.getByTestId("evidence-chart").getAttribute("aria-label")!;
    expect(summary).toMatch(/per provider minute/);
    expect(summary).toMatch(/Peak/);
    expect(screen.getByTestId("minute-table-details")).toBeInTheDocument();
    const rows = within(screen.getByTestId("minute-table-details")).getAllByTestId("minute-row");
    expect(rows).toHaveLength(snapshot.minuteBuckets.length);
  });
});
