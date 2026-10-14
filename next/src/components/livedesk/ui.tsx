"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./prefs";

/** Small shared pieces of the new screens: ticking numbers, the SIMULATED stamp, the confidence meter, buttons, FLIP. */

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** A number that ticks to its new value in 320 ms (text only, tabular figures, so nothing shifts). */
export function Num({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number): void => {
      const k = Math.min(1, (now - start) / 320);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return <span className="num">{format(shown)}</span>;
}

/** SIMULATED as a rotated outline stamp, or (quiet) a straight violet word inside running text. */
export function SimTag({ children = "SIMULATED", quiet = false }: { children?: React.ReactNode; quiet?: boolean }) {
  return <span className={`sim-tag${quiet ? " is-quiet" : ""}`}>{children}</span>;
}

/** A title in one weight with one deliberate phrase on a strip of kraft tape; the text reads the same without the tape. */
export function TapeTitle({ text, mark }: { text: string; mark: string }) {
  const at = text.indexOf(mark);
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<span className="tape-mark">{mark}</span>{text.slice(at + mark.length)}</>;
}

export function Meter({ level, label }: { level: "low" | "medium" | "high"; label: string }) {
  const on = level === "low" ? 1 : level === "medium" ? 2 : 3;
  return (
    <span className={`meter is-${level}`} role="img" aria-label={label}>
      {[1, 2, 3].map((i) => <i key={i} className={i <= on ? "on" : ""} />)}
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ink" | "quiet";
  size?: "md" | "sm" | "lg";
  icon?: React.ReactElement;
};

export function Button({ variant = "secondary", size = "md", icon, children, className, ...rest }: ButtonProps) {
  return (
    <button type="button" className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ""}`} {...rest}>
      {icon}
      {children !== undefined && <span>{children}</span>}
    </button>
  );
}

/** FLIP: rows slide from their old place when the list order changes (transform only). */
export function useFlip<T extends HTMLElement>(keys: string[]): React.RefObject<T | null> {
  const container = useRef<T>(null);
  const rects = useRef(new Map<string, number>());
  const signature = keys.join("|");
  useIsoLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    const next = new Map<string, number>();
    for (const item of items) next.set(item.dataset.flip ?? "", item.offsetTop);
    if (!prefersReducedMotion()) {
      for (const item of items) {
        const before = rects.current.get(item.dataset.flip ?? "");
        const after = next.get(item.dataset.flip ?? "") ?? 0;
        if (before === undefined || Math.abs(before - after) < 1) continue;
        item.style.transition = "none";
        item.style.transform = `translateY(${before - after}px)`;
        requestAnimationFrame(() => {
          item.style.transition = "transform var(--t-slow) var(--ease)";
          item.style.transform = "";
        });
      }
    }
    rects.current = next;
  }, [signature]);
  return container;
}
