import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy — LiveLift",
  description: "TikTok identity and credential handling in the LiveLift competition and development project.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      lead="LiveLift is currently a competition and development project."
      glance={[
        { icon: "ri-user-follow-line", text: "A TikTok profile is read only after your explicit consent." },
        { icon: "ri-lock-2-line", text: "Provider credentials are stored encrypted on the server, never in browser storage." },
        { icon: "ri-link-unlink-m", text: "Disconnecting deletes the local credentials and the stored profile." },
      ]}
      sections={[
        {
          id: "tiktok-consent-and-identity",
          title: "TikTok consent and identity",
          body: <p>After your explicit OAuth consent, LiveLift may process your TikTok basic profile identity, such as an app-specific account identifier, display name, and avatar, within the permissions you grant. This information is used to identify and display the connected profile.</p>,
        },
        {
          id: "provider-credentials",
          title: "Provider credentials",
          body: <p>Provider access and refresh tokens are stored encrypted server-side. They are never exposed to browser storage, including localStorage and sessionStorage.</p>,
        },
        {
          id: "disconnecting",
          title: "Disconnecting",
          body: <p>Disconnecting TikTok deletes local provider credentials and the stored TikTok profile identity. LiveLift also attempts to revoke authorization with TikTok, but provider revocation may not be confirmed. A disconnect timestamp and revocation status may remain.</p>,
        },
        {
          id: "data-use",
          title: "Data use",
          body: <p>LiveLift does not sell user data. These pages do not add tracking or analytics.</p>,
        },
      ]}
      sibling={{ href: "/terms", label: "Terms of Use", summary: "Acceptable use, platform integrations and your responsibility." }}
    />
  );
}
