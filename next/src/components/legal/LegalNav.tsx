"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const;

/** Terms and Privacy side by side; the page you are on is marked. */
export function LegalNav(): React.ReactElement {
  const pathname = usePathname();
  return (
    <nav aria-label="Legal" className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-[44px] items-center rounded-[8px] px-3.5 text-[16px] font-medium transition-colors ${
              active ? "bg-[#242A22] text-[#DFFF00]" : "text-[#CAD0DA] hover:bg-[#1B2028] hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
