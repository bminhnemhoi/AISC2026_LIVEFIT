import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ path: "/insights" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/store/hooks", () => ({ useRemoteState: () => ({ active: false }) }));
vi.mock("@/components/ops/ConnectionStatus", () => ({ ConnectionChip: () => null, RemoteBanners: () => null }));
vi.mock("@/components/auth/AccountControl", () => ({ AccountControl: () => null }));

import { StandardShell } from "@/components/shell/StandardShell";
import LegalLayout from "@/app/(legal)/layout";
import TermsPage from "@/app/(legal)/terms/page";
import PrivacyPage from "@/app/(legal)/privacy/page";
import { auditAccessibility } from "./phase3-ui/support";

beforeEach(() => {
  nav.path = "/insights";
});
afterEach(cleanup);

describe("Global navigation", () => {
  it("offers every destination once, in two groups, and marks where you are", () => {
    render(<StandardShell>content</StandardShell>);
    const main = screen.getByRole("navigation", { name: "Main Navigation" });
    const links = within(main).getAllByRole("link").map((a) => [a.textContent?.trim(), a.getAttribute("href")]);
    expect(links).toEqual([
      ["Home", "/"],
      ["Sessions", "/sessions"],
      ["Products", "/products"],
      ["Insights", "/insights"],
      ["Simulator", "/simulator"],
      ["Integrations", "/integrations"],
    ]);
    expect(within(main).getByRole("link", { name: "Insights" })).toHaveAttribute("aria-current", "page");
    expect(within(main).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("Integrations is current on its own page and Simulator keeps the SIMULATED violet", () => {
    nav.path = "/simulator";
    render(<StandardShell>content</StandardShell>);
    const sim = screen.getByRole("link", { name: "Simulator" });
    expect(sim).toHaveAttribute("aria-current", "page");
    expect(sim.className).toContain("#C8B2FF");
    cleanup();
    nav.path = "/integrations";
    render(<StandardShell>content</StandardShell>);
    expect(screen.getByRole("link", { name: "Integrations" })).toHaveAttribute("aria-current", "page");
  });

  it("the brand is a labelled link home and its mark is decorative", () => {
    render(<StandardShell>content</StandardShell>);
    const home = screen.getByRole("link", { name: "LiveLift home" });
    expect(home).toHaveAttribute("href", "/");
    expect(home.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("the phone menu is a disclosure: collapsed by default, labelled, and Escape closes it and returns focus", () => {
    render(<StandardShell>content</StandardShell>);
    const button = screen.getByTestId("nav-menu-btn");
    expect(button).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    expect(panel).toContainElement(screen.getByRole("navigation", { name: "Main Navigation" }));
    expect(panel?.className).toContain("hidden");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveTextContent("Close");
    expect(panel?.className).not.toMatch(/(^|\s)hidden(\s|$)/);

    screen.getByRole("link", { name: "Sessions" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(button);
  });

  it("every header control is at least 44px tall by class", () => {
    render(<StandardShell>content</StandardShell>);
    for (const a of within(screen.getByRole("banner")).getAllByRole("link")) expect(a.className).toContain("min-h-[44px]");
    expect(screen.getByTestId("nav-menu-btn").className).toContain("min-h-[44px]");
  });
});

describe("Legal pages", () => {
  it.each([
    { Page: TermsPage, path: "/terms", sibling: "/privacy", siblingName: "Privacy Policy" },
    { Page: PrivacyPage, path: "/privacy", sibling: "/terms", siblingName: "Terms of Use" },
  ])("$path marks itself current, links to its sibling and to the product, and passes the structural audit", ({ Page, path, sibling, siblingName }) => {
    nav.path = path;
    render(<LegalLayout><Page /></LegalLayout>);
    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(within(legal).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.getAttribute("href"))).toEqual([path]);
    const related = screen.getByRole("complementary", { name: "Related page" });
    expect(within(related).getByRole("link")).toHaveAttribute("href", sibling);
    expect(within(related).getByRole("link")).toHaveTextContent(siblingName);
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
    expect(footer.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(footer.getByRole("link", { name: "What is supported" })).toHaveAttribute("href", "/integrations");
    expect(auditAccessibility()).toEqual([]);
  });

  it.each([{ Page: TermsPage }, { Page: PrivacyPage }])("every entry in the page index points at a real, named section", ({ Page }) => {
    render(<Page />);
    const index = screen.getByRole("navigation", { name: "On this page" });
    const anchors = within(index).getAllByRole("link");
    expect(anchors.length).toBeGreaterThanOrEqual(3);
    for (const a of anchors) {
      const id = a.getAttribute("href")?.slice(1) ?? "";
      const section = document.getElementById(id);
      expect(section, id).not.toBeNull();
      expect(section?.tagName).toBe("SECTION");
      expect(within(section as HTMLElement).getByRole("heading", { level: 2 })).toHaveTextContent(a.textContent ?? "");
    }
  });

  it("claims nothing beyond the original wording: no company, no tracking, no dates", () => {
    const { container } = render(<LegalLayout><PrivacyPage /></LegalLayout>);
    const text = container.textContent ?? "";
    expect(text).toMatch(/does not sell user data/);
    expect(text).not.toMatch(/\b(Inc|Ltd|LLC|GmbH|Co\.)\b|last updated|effective|©|cookie/i);
  });
});
