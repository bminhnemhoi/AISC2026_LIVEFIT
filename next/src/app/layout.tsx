import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { connection } from "next/server";
import { LiveAnnouncer } from "@/components/ui/LiveAnnouncer";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LiveLift — Livestream Commerce Operational Desk",
  description:
    "Operational decision, evidence, replay, and learning workspace for livestream commerce.",
};

export const viewport: Viewport = {
  themeColor: "#090B0F",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Production serves a per-request CSP nonce (set by the platform's proxy). Next.js can only apply a nonce to
  // the scripts and styles it emits while it renders the page for that request, so no page may be prerendered
  // at build time. `connection()` opts the whole tree into dynamic rendering without weakening the CSP and
  // without reading the nonce here: Next.js picks it up from the request's Content-Security-Policy itself.
  await connection();

  return (
    <html lang="en" className="dark">
      <body className={`${rubik.variable} min-h-screen bg-[#090B0F] text-[#F5F7FC] antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-[8px] focus:bg-[#DFFF00] focus:px-4 focus:py-2 focus:font-medium focus:text-[#111407]"
        >
          Skip to main content
        </a>
        {children}
        <LiveAnnouncer />
      </body>
    </html>
  );
}
