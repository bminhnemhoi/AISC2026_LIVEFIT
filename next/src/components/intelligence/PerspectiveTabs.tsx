"use client";

import React, { useRef } from "react";

export type Perspective = "known" | "later";

const TABS: ReadonlyArray<{ id: Perspective; title: string; blurb: string; icon: string }> = [
  { id: "known", title: "As known then", blurb: "What you knew during the LIVE", icon: "ri-eye-line" },
  { id: "later", title: "With later evidence", blurb: "Provider data fetched afterwards", icon: "ri-database-2-line" },
];

/**
 * The Review perspective switch. Two explicit, named views of the same ended show; never a generic toggle.
 * Switching is view state only: it reads, it never writes, and it cannot change the recorded session.
 *
 * Tabs pattern: one tab stop, arrow keys / Home / End move and select, the panel it controls is `panelId`.
 */
export function PerspectiveTabs({ value, onChange, panelId }: { value: Perspective; onChange: (next: Perspective) => void; panelId: string }): React.ReactElement {
  const refs = useRef<Record<Perspective, HTMLButtonElement | null>>({ known: null, later: null });

  const go = (to: Perspective): void => {
    onChange(to);
    refs.current[to]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const i = TABS.findIndex((t) => t.id === value);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") go(TABS[(i + 1) % TABS.length].id);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") go(TABS[(i + TABS.length - 1) % TABS.length].id);
    else if (event.key === "Home") go(TABS[0].id);
    else if (event.key === "End") go(TABS[TABS.length - 1].id);
    else return;
    event.preventDefault();
  };

  return (
    <div data-testid="perspective-switch" role="tablist" aria-label="Review perspective" onKeyDown={onKeyDown} className="grid max-w-[880px] grid-cols-1 gap-1 rounded-[12px] bg-[#101319] p-1 sm:grid-cols-2">
      {TABS.map((t) => {
        const selected = t.id === value;
        const tone = selected ? (t.id === "later" ? "bg-[#17202B] shadow-[inset_0_0_0_1px_#2C3A4C]" : "bg-[#252A34] shadow-[inset_0_0_0_1px_#39414D]") : "hover:bg-[#181C23]";
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`perspective-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            data-testid={`perspective-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`min-h-[56px] cursor-pointer rounded-[9px] px-4 py-2 text-left flex items-center gap-3 transition-colors ${tone}`}
          >
            <i className={`${t.icon} text-[20px] ${selected ? (t.id === "later" ? "text-[#B4C6DD]" : "text-[#F5F7FC]") : "text-[#8A95A5]"}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className={`block text-[15px] font-semibold uppercase tracking-[0.8px] ${selected ? "text-[#F5F7FC]" : "text-[#CAD0DA]"}`}>{t.title}</span>
              <span className={`block text-[14px] leading-snug ${selected ? "text-[#CAD0DA]" : "text-[#9AA5B5]"}`}>{t.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
