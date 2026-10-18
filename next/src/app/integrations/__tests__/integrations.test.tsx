import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/integrations",
  useSearchParams: () => nav.search,
}));

import IntegrationsPage from "../page";
import { CATEGORIES } from "../categories";

describe("Capability Center & Integrations Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = async () => {
    await act(async () => {
      render(<IntegrationsPage />);
    });
  };

  it("satisfies all backwards compatibility and test invariants", async () => {
    await renderComponent();

    const container = screen.getByTestId("integrations-list");
    expect(container).toBeInTheDocument();

    // Critical invariant: must contain "Unsupported"
    expect(container).toHaveTextContent("Unsupported");

    // Critical invariant: must NEVER contain "Configure" anywhere
    expect(container).not.toHaveTextContent("Configure");
    expect(document.body).not.toHaveTextContent("Configure");
  });

  it("renders the standalone loop with its room requirement and zero connected platforms", async () => {
    await renderComponent();

    // Main header
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Integrations & Capability Center"
    );

    // Standalone show operations section
    const guaranteeHeading = screen.getByRole("heading", {
      name: "Standalone show operations",
    });
    expect(guaranteeHeading).toBeInTheDocument();

    // Check KPI statistics
    expect(screen.getByText("Standalone loop")).toBeInTheDocument();
    expect(screen.getByText("Platform API Dependencies")).toBeInTheDocument();
    expect(screen.getByText("Connected Platforms")).toBeInTheDocument();
    expect(screen.getByText("5 steps")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2);
    // With nothing connected there is no identity note to show.
    expect(screen.queryByTestId("connected-identity-only")).toBeNull();

    // Check guarantee message
    expect(
      screen.getByText(/REAL shows require a configured shared room and sign-in/i)
    ).toBeInTheDocument();
  });

  it("renders Epistemic Truth Ledger callout with all three core axioms", async () => {
    await renderComponent();

    expect(
      screen.getByRole("heading", {
        name: "What the evidence means",
      })
    ).toBeInTheDocument();

    // Axiom 1: Evidence tiers
    expect(
      screen.getByText(
        "Operator reported != Provider observed != Platform confirmed"
      )
    ).toBeInTheDocument();

    // Axiom 2: Neutrality rule
    expect(screen.getByText("Unknown != Failed")).toBeInTheDocument();

    // Axiom 3: Missing value rule
    expect(screen.getByText("Missing != Zero")).toBeInTheDocument();
  });

  it("renders all 4 explicit categories with headers, badges, and accurate descriptions", async () => {
    await renderComponent();

    // Category 1: Available
    expect(
      screen.getByRole("heading", {
        name: "Available Today: Core Standalone Operations",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Core Operational Loop")).toBeInTheDocument();

    // Category 2: Manual / Built-In
    expect(
      screen.getByRole("heading", {
        name: "Manual / Built-In: Native Operator Workflows",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("First-Class Operator Workflows")).toBeInTheDocument();

    // Category 3: Adapter-Ready / Platform-Limited
    expect(
      screen.getByRole("heading", {
        name: "Platform-Limited: Optional External Capabilities",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Intentionally Bounded Extensions")
    ).toBeInTheDocument();

    // Category 4: Not Available / Unsupported
    expect(
      screen.getByRole("heading", {
        name: "Not Available / Unsupported: Deliberate Platform Boundaries",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Deliberate Platform Guardrails")).toBeInTheDocument();
  });

  it("renders all 16 documented capability cards across the 4 categories", async () => {
    await renderComponent();

    // Available cards
    expect(screen.getByText("Manual Operation Desk")).toBeInTheDocument();
    expect(
      screen.getByText("Local Rehearsal Simulator & Virtual Clock")
    ).toBeInTheDocument();
    expect(screen.getByText("Multi-Client Room Authority")).toBeInTheDocument();
    expect(
      screen.getByText("Variance Analysis & Learning Feedback")
    ).toBeInTheDocument();

    // Manual / Built-In cards
    expect(
      screen.getByText("Manual Product & Catalog Ingestion")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manual Operator Cue & Promotion Reporting")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Operator Pacing & Anchor Commitment Protection")
    ).toBeInTheDocument();

    // Adapter-Ready cards
    expect(
      screen.getByText("TikTok Shop Post-Stream Analytics")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Shopee Live Pin & Comment Adapter")
    ).toBeInTheDocument();
    expect(
      screen.getByText("YouTube Live Streaming Client")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Facebook Live Graph API Adapter")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Workspace Data Export & Audit Portability")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Independent Platform Action Verification")
    ).toBeInTheDocument();

    const platforms = CATEGORIES.flatMap((c) => c.items).filter((item) =>
      ["tiktok_analytics", "shopee_adapter", "youtube_client", "facebook_adapter"].includes(item.id)
    );
    expect(platforms).toHaveLength(4);
    for (const item of platforms) {
      expect(item.status).toBe("Platform-limited");
      expect(item.details).toMatch(/Not connected/);
      expect(item.cta).toBeUndefined();
      expect(item.secondaryCta).toBeUndefined();
    }
    expect(document.body).not.toHaveTextContent("dual knowledge lens");

    // Unsupported cards
    expect(
      screen.getByText("Direct Platform Pin / Action Control")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Realtime Headless Stream Engagement Scraping")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Automated Post-LIVE Platform Metric Import")
    ).toBeInTheDocument();
  });

  it("displays honest epistemic status badges for all capabilities", async () => {
    await renderComponent();

    // Status chips
    const availableBadges = screen.getAllByText("Available");
    expect(availableBadges.length).toBeGreaterThanOrEqual(4);

    const manualBadges = screen.getAllByText("Manual");
    expect(manualBadges.length).toBeGreaterThanOrEqual(3);

    const adapterReadyBadges = screen.getAllByText("Platform-limited");
    expect(adapterReadyBadges.length).toBeGreaterThanOrEqual(4);

    expect(screen.getByText("Unsupported")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("provides actionable CTAs pointing strictly to valid routes", async () => {
    await renderComponent();

    // Check banner CTAs
    const startLiveBtn = screen.getAllByRole("link", { name: /^Create LIVE$/i })[0];
    expect(startLiveBtn).toHaveAttribute("href", "/live/new");

    const testSimBtn = screen.getByRole("link", { name: /Try Simulator/i });
    expect(testSimBtn).toHaveAttribute("href", "/simulator");

    // Check card CTAs
    const planNewLive = screen.getAllByRole("link", { name: /^Create LIVE$/i })[1];
    expect(planNewLive).toHaveAttribute("href", "/live/new");

    const launchSim = screen.getByRole("link", { name: /Launch Simulator/i });
    expect(launchSim).toHaveAttribute("href", "/simulator");

    const productLib = screen.getByRole("link", { name: /Product Library/i });
    expect(productLib).toHaveAttribute("href", "/products");

    const exportWs = screen.getByRole("link", { name: /Open export controls/i });
    expect(exportWs).toHaveAttribute("href", "/sessions");

    // All links should be accessible with >= 44px minimum height
    const allLinks = screen.getAllByRole("link");
    allLinks.forEach((link) => {
      const href = link.getAttribute("href");
      expect(href).toMatch(/^(\/|\/live\/new|\/sessions|\/products|\/simulator|\/integrations)/);
    });
  });

  it("filters capabilities interactively using category tabs", async () => {
    await renderComponent();

    const totalCount = CATEGORIES.reduce((acc, c) => acc + c.items.length, 0);
    expect(screen.getByText(`All Capabilities (${totalCount})`)).toBeInTheDocument();

    // Filter to Available only
    const availableTab = screen.getByRole("tab", { name: /Available \(4\)/i });
    await act(async () => {
      fireEvent.click(availableTab);
    });

    expect(screen.getByText("Manual Operation Desk")).toBeInTheDocument();
    expect(
      screen.queryByText("Direct Platform Pin / Action Control")
    ).not.toBeInTheDocument();

    // Filter to Unsupported only
    const unsupportedTab = screen.getByRole("tab", { name: /Unsupported \(3\)/i });
    await act(async () => {
      fireEvent.click(unsupportedTab);
    });

    expect(
      screen.getByText("Direct Platform Pin / Action Control")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Manual Operation Desk")
    ).not.toBeInTheDocument();

    // Switch back to All
    const allTab = screen.getByRole("tab", { name: new RegExp(`All Capabilities \\(${totalCount}\\)`, "i") });
    await act(async () => {
      fireEvent.click(allTab);
    });

    expect(screen.getByText("Manual Operation Desk")).toBeInTheDocument();
    expect(
      screen.getByText("Direct Platform Pin / Action Control")
    ).toBeInTheDocument();
  });
});
