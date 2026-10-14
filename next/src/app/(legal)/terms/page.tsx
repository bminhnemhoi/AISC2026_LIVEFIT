import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Use — LiveLift",
  description: "Terms of use for the LiveLift competition and development project.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Use"
      lead="LiveLift is currently a competition and development project. Features may change or be unavailable."
      glance={[
        { icon: "ri-shield-check-line", text: "Lawful and authorized use only." },
        { icon: "ri-plug-line", text: "Platform integrations are not guaranteed to be available or approved." },
        { icon: "ri-scales-3-line", text: "You follow the rules of TikTok and any other platform you use." },
      ]}
      sections={[
        {
          id: "acceptable-use",
          title: "Acceptable use",
          body: <p>Use LiveLift only for lawful, authorized activities. Do not misuse another person’s data or account, bypass access controls, or disrupt the service.</p>,
        },
        {
          id: "platform-integrations",
          title: "Platform integrations",
          body: <p>LiveLift does not guarantee that TikTok or other platform integrations are available, approved, or will continue to work. Connecting a profile does not grant access to livestream, shop, or platform action features.</p>,
        },
        {
          id: "your-responsibility",
          title: "Your responsibility",
          body: <p>You are responsible for complying with applicable laws and the terms, policies, and permissions of TikTok and any other platform you use with LiveLift.</p>,
        },
      ]}
      sibling={{ href: "/privacy", label: "Privacy Policy", summary: "How a connected TikTok profile and its credentials are handled." }}
    />
  );
}
