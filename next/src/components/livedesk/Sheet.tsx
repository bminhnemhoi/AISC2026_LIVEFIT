"use client";

import React, { useEffect, useRef } from "react";
import { IconClose } from "./icons";

/** A dialog that traps focus, closes on Escape and returns focus to where it came from. */
export function useTrap<T extends HTMLElement>(onClose: () => void): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("button:not([disabled]), [href], textarea, input");
    first?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab" && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>("button:not([disabled]), [href], textarea, input, [tabindex='0']"));
        if (!items.length) return;
        const a = items[0];
        const z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (back && document.contains(back)) back.focus();
    };
  }, []);
  return ref;
}

export function Sheet({ title, closeLabel, onClose, children, side = "right", testId }: {
  title: string; closeLabel: string; onClose: () => void; children: React.ReactNode; side?: "right" | "center"; testId?: string;
}) {
  const ref = useTrap<HTMLDivElement>(onClose);
  return (
    <div className={`overlay is-${side}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet sheet-${side}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={ref} data-testid={testId}>
        <div className="sheet-head">
          <h2 id="sheet-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label={closeLabel} onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
