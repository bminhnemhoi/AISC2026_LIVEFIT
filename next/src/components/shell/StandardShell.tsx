"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountControl } from "@/components/auth/AccountControl";
import { ConnectionChip, RemoteBanners } from "@/components/ops/ConnectionStatus";
import { Wordmark } from "@/components/ui/BrandMark";
import { useRemoteState } from "@/lib/store/hooks";

export interface StandardShellProps {
  activeSessionId?: string | null;
  activeSessionTitle?: string | null;
  deskLiveId?: string | null;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Rehearsal destinations keep the SIMULATED violet so they never read as REAL. */
  tone?: "simulated";
}

/** The work loop, in the order an operator uses it. */
const WORK_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "ri-home-5-line" },
  { href: "/sessions", label: "Sessions", icon: "ri-stack-line" },
  { href: "/products", label: "Products", icon: "ri-shopping-bag-3-line" },
  { href: "/insights", label: "Insights", icon: "ri-bar-chart-line" },
];
/** Places that are about rehearsing and about what is (not) connected. */
const MORE_NAV: NavItem[] = [
  { href: "/simulator", label: "Simulator", icon: "ri-flask-line", tone: "simulated" },
  { href: "/integrations", label: "Integrations", icon: "ri-plug-line" },
];

const DESK_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "ri-home-5-line" },
  { href: "/start", label: "Start", icon: "ri-play-line", tone: "simulated" },
];
const DESK_MORE_NAV: NavItem[] = [
  { href: "/integrations", label: "Integrations", icon: "ri-plug-line" },
  { href: "/legacy", label: "Legacy", icon: "ri-archive-line" },
];

export const StandardShell: React.FC<StandardShellProps> = ({
  activeSessionId = null,
  activeSessionTitle = null,
  deskLiveId = null,
  children,
}) => {
  const pathname = usePathname();
  const deskFlow = pathname === "/" || pathname === "/start" || pathname?.startsWith("/desk/") || pathname === "/legacy" || pathname === "/integrations";
  const workNav = deskFlow ? [...DESK_NAV, ...(deskLiveId ? [{ href: `/desk/${encodeURIComponent(deskLiveId)}`, label: "Desk", icon: "ri-dashboard-line", tone: "simulated" as const }] : [])] : WORK_NAV;
  const moreNav = deskFlow ? DESK_MORE_NAV : MORE_NAV;
  // Where a REAL room is in use its connection status takes the place of the "This device" note (same space, no wider header).
  const roomInUse = useRemoteState().active;
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);

  const isNavActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname?.startsWith(path)) return true;
    return false;
  };

  // Following a link closes the menu. Escape closes it and puts focus back on the button that opened it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const renderLink = ({ href, label, icon, tone }: NavItem): React.ReactElement => {
    const active = isNavActive(href);
    const colour = active
      ? tone === "simulated"
        ? "text-[#C8B2FF] bg-[#211F2B]"
        : "text-[#DFFF00] bg-[#242A22]"
      : "text-[#C8CDD6] hover:text-white hover:bg-[#1B2028]";
    return (
      <Link
        key={href}
        href={href}
        className={`min-h-[44px] px-3.5 lg:px-3 rounded-[8px] flex items-center gap-2.5 lg:gap-2 text-[16px] lg:text-[15px] font-medium transition-colors ${colour}`}
        aria-current={active ? "page" : undefined}
      >
        <i className={`${icon} text-[18px] lg:max-[1559px]:hidden ${tone === "simulated" && !active ? "text-[#C8B2FF]" : ""}`} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090B0F] text-[#F5F7FC]">
      {/*
        Global header. From 1024px the brand, the two navigation groups and the account sit on one 64px row. Below
        that the row is the brand and a Menu button, and everything else opens in a stacked panel: a phone header
        used to wrap into four rows and take a third of the screen.
      */}
      <header className="sticky top-0 z-40 shrink-0 bg-[#101319] border-b border-[#1E232B] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-2 min-h-[60px] lg:h-[64px]">
          <Link href="/" className="min-h-[44px] inline-flex items-center rounded-[8px] pr-2 text-[#F5F7FC] hover:opacity-90" aria-label="LiveLift home">
            <Wordmark />
          </Link>

          <button
            ref={menuButton}
            type="button"
            className="lg:hidden ml-auto min-h-[44px] min-w-[44px] px-3 rounded-[8px] inline-flex items-center gap-2 text-[16px] font-medium text-[#F5F7FC] bg-[#1B2028] hover:bg-[#242A34] cursor-pointer"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
            data-testid="nav-menu-btn"
          >
            <i className={open ? "ri-close-line text-[20px]" : "ri-menu-line text-[20px]"} aria-hidden="true" />
            <span>{open ? "Close" : "Menu"}</span>
          </button>

          <div
            id={menuId}
            className={`${open ? "flex max-lg:motion-safe:animate-fade-in" : "hidden"} lg:flex basis-full lg:basis-auto lg:flex-1 min-w-0 flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 pt-2 pb-3 lg:py-0 max-h-[calc(100dvh-64px)] overflow-y-auto lg:max-h-none lg:overflow-visible`}
          >
            {/* Primary navigation: the work loop, then rehearse and connect */}
            <nav className="flex flex-col lg:flex-row lg:items-center gap-1 lg:ml-3" aria-label="Main Navigation">
              {workNav.map(renderLink)}
              <span className="hidden lg:block mx-1.5 h-6 w-px bg-[#2A303A]" aria-hidden="true" />
              <span className="lg:hidden mt-2 mb-0.5 px-3.5 text-[13px] font-semibold tracking-[1.4px] uppercase text-[#9AA5B5]" aria-hidden="true">Rehearse and connect</span>
              {moreNav.map(renderLink)}
            </nav>

            {/* Active session return + who is signed in */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 text-[#CAD0DA] border-t border-[#1E232B] pt-3 lg:border-0 lg:pt-0">
              {activeSessionId && (
                <Link
                  href={`/live/${activeSessionId}/operate`}
                  className="min-h-[44px] min-w-[44px] px-3.5 lg:max-[1279px]:px-0 py-1.5 rounded-[8px] bg-[#1E2718] border border-[#3E5224] text-[#DFFF00] text-[15px] font-medium flex items-center lg:max-[1279px]:justify-center gap-2 hover:bg-[#283620] transition-colors max-w-full lg:max-w-[260px] shrink-0"
                  title={`Return to active session: ${activeSessionTitle || activeSessionId}`}
                  aria-label={`Return to the active LIVE: ${activeSessionTitle || "open desk"}`}
                >
                  <span className="w-2 h-2 shrink-0 rounded-full bg-[#DFFF00] motion-safe:animate-pulse" aria-hidden="true" />
                  {/* The row is tight on a desktop: the dot alone from 1024px, the words from 1280px, the show's title only when there is room. */}
                  <span className="truncate lg:max-[1279px]:hidden" aria-hidden="true">
                    Active LIVE<span className="hidden min-[1700px]:inline">: {activeSessionTitle || "Open Desk"}</span>
                    <span className="min-[1700px]:hidden lg:hidden">: {activeSessionTitle || "Open Desk"}</span>
                  </span>
                </Link>
              )}

              {roomInUse ? (
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-3 gap-y-1">
                  <ConnectionChip />
                  <AccountControl />
                </div>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-[15px] text-[#CAD0DA] px-2 min-h-[44px]"
                  title="Rehearsals are stored in this browser only. REAL shows live in the shared room."
                >
                  <i className="ri-computer-line" aria-hidden="true" />
                  <span>This device</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <RemoteBanners />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col outline-none">
        {children}
      </main>
    </div>
  );
};
