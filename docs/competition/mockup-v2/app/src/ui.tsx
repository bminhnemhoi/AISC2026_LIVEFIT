// Small shared pieces: ticking numbers, the SIMULATED tag, confidence meter, FLIP lists.

import type { ComponentChildren, JSX } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { fmtNum } from "./format";
import type { Confidence } from "./engine";
import { CONFIDENCE_LABEL } from "./engine";

export const reducedMotion = () =>
  document.documentElement.dataset.motion === "reduce" ||
  document.documentElement.dataset.instant === "1" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number that ticks to its new value (transform-free: text only, tabular figures, no shift). */
export function Num({ value, format = fmtNum }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reducedMotion() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
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
  return <span class="num">{format(shown)}</span>;
}

export function SimTag({ children = "SIMULATED", quiet = false }: { children?: ComponentChildren; quiet?: boolean }) {
  return <span class={`sim-tag${quiet ? " is-quiet" : ""}`}>{children}</span>;
}

export function SampleTag() {
  return <span class="sample-tag">Dữ liệu mẫu</span>;
}

export function Meter({ level }: { level: Confidence }) {
  const on = level === "low" ? 1 : level === "medium" ? 2 : 3;
  return (
    <span class={`meter is-${level}`} role="img" aria-label={`Độ tin cậy ${CONFIDENCE_LABEL[level]}`}>
      {[1, 2, 3].map((i) => (
        <i key={i} class={i <= on ? "on" : ""} />
      ))}
    </span>
  );
}

export function Skeleton({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <span class="skeleton" style={{ width: typeof w === "number" ? `${w}px` : w, height: `${h}px`, borderRadius: `${r}px` }} />;
}

type BtnProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ink" | "quiet";
  size?: "md" | "sm" | "lg";
  icon?: JSX.Element;
};

export function Button({ variant = "secondary", size = "md", icon, children, class: cls, ...rest }: BtnProps) {
  return (
    <button type="button" class={`btn btn-${variant} btn-${size} ${cls ?? ""}`} {...rest}>
      {icon}
      {children !== undefined && <span>{children}</span>}
    </button>
  );
}

/** FLIP: rows slide from their old position when the list order changes. */
export function useFlip(keys: string[]) {
  const container = useRef<HTMLElement>(null);
  const rects = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    const next = new Map<string, number>();
    for (const item of items) next.set(item.dataset.flip as string, item.offsetTop);
    if (!reducedMotion()) {
      for (const item of items) {
        const before = rects.current.get(item.dataset.flip as string);
        const after = next.get(item.dataset.flip as string) as number;
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
  }, [keys.join("|")]);
  return container;
}
