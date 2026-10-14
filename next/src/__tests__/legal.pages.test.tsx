import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LegalLayout from "@/app/(legal)/layout";
import TermsPage, { metadata as termsMetadata } from "@/app/(legal)/terms/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/(legal)/privacy/page";

describe("public legal pages", () => {
  it.each([
    { Page: TermsPage, title: "Terms of Use", metadata: termsMetadata },
    { Page: PrivacyPage, title: "Privacy Policy", metadata: privacyMetadata },
  ])("renders $title without an account or provider connection", ({ Page, title, metadata }) => {
    render(<LegalLayout><Page /></LegalLayout>);

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(within(main).getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(within(main).getByText(/currently a competition and development project/)).toBeInTheDocument();
    expect(metadata.title).toBe(`${title} — LiveLift`);
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("states acceptable use, integration limits, and user responsibility", () => {
    render(<TermsPage />);
    expect(screen.getByText(/lawful, authorized activities/)).toBeInTheDocument();
    expect(screen.getByText(/does not guarantee that TikTok or other platform integrations/)).toBeInTheDocument();
    expect(screen.getByText(/You are responsible for complying/)).toBeInTheDocument();
  });

  it("explains consent, token storage, disconnect deletion, and no data sales", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/After your explicit OAuth consent/)).toBeInTheDocument();
    expect(screen.getByText(/stored encrypted server-side/)).toHaveTextContent(/never exposed to browser storage/);
    expect(screen.getByText(/deletes local provider credentials/)).toHaveTextContent(/provider revocation may not be confirmed/);
    expect(screen.getByText(/does not sell user data/)).toBeInTheDocument();
  });
});
