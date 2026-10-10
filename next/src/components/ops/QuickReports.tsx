"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { QUICK_CUES, quickCueNoteText, type QuickCue } from "@/lib/intelligence/quickCues";

/**
 * Operator quick reports: five one-tap OPERATOR REPORTS for moments TikTok gives LiveLift no way to see (raw comments,
 * pins). Each one is recorded through the ordinary note command, so the room stamps it, history lists it and Review
 * labels it "Operator reported". It is the operator's word, never platform confirmation, and it changes no show state.
 *
 * Keyboard: the trigger opens the list and moves focus into it; Up/Down move; Enter or Space records; Escape closes and
 * returns focus. Nothing is recorded until a cue is chosen.
 */
export function QuickReports({ onReport }: { onReport: (noteText: string, cue: QuickCue) => void }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const onPointer = (e: PointerEvent): void => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const at = items.current.findIndex((el) => el === document.activeElement);
    const next = e.key === "ArrowDown" ? (at + 1) % QUICK_CUES.length : (at - 1 + QUICK_CUES.length) % QUICK_CUES.length;
    items.current[next]?.focus();
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <Button
        ref={trigger}
        variant="ghost"
        size="desk"
        icon="ri-flashlight-line"
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        onClick={() => setOpen((v) => !v)}
        data-testid="quick-report-btn"
      >
        Quick report
      </Button>
      {open && (
        <div
          id={`${uid}-panel`}
          role="group"
          aria-label="Quick operator reports"
          data-testid="quick-report-panel"
          className="z-50 rounded-[12px] border border-[#2A303A] bg-[#161B22] p-2 shadow-[0_10px_28px_rgba(0,0,0,0.5)] origin-top-right motion-safe:animate-pop-in max-sm:origin-bottom max-sm:[--pop-from:6px] max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 sm:absolute sm:right-0 sm:top-full sm:mt-1 sm:w-[460px]"
        >
          <p className="px-2 pb-1 pt-0.5 text-[14px] font-semibold uppercase tracking-[0.8px] text-[#CAD0DA]">Operator reported</p>
          <ul className="sm:grid sm:grid-cols-2 sm:gap-x-1">
            {QUICK_CUES.map((cue, i) => (
              <li key={cue.id}>
                <button
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  type="button"
                  data-testid={`quick-cue-${cue.id}`}
                  onClick={() => {
                    onReport(quickCueNoteText(cue), cue);
                    close();
                  }}
                  className="flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-[8px] px-2.5 text-left hover:bg-[#1E232B]"
                >
                  <i className={`${cue.icon} text-[20px] text-[#CAD0DA]`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[16px] text-[#F5F7FC]">{cue.label}</span>
                    {/* Phone: the one-line hint helps. Desk: the labels are enough and the panel stays short. */}
                    <span className="block text-[14px] leading-snug text-[#9AA5B5] sm:sr-only">{cue.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="px-2 pb-1 pt-1.5 text-[13px] leading-snug text-[#9AA5B5]">Recorded as a timestamped note. LiveLift cannot read TikTok comments; this is what you saw, not a platform confirmation.</p>
        </div>
      )}
    </div>
  );
}
