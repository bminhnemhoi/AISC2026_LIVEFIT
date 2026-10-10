"use client";

import { useCallback, useEffect, useState } from "react";
import type { LabLang } from "./labCopy";

const LANG_KEY = "livelift.lab.lang";
const PRESENTER_KEY = "livelift.lab.presenter";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A viewer convenience only: without storage the choice lasts until the page is closed.
  }
}

/** Typing in a field must never flip presenter mode. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
}

/** Per-viewer Lab choices: language and presenter mode (key P). Both start at the defaults so the server render matches. */
export function useLabPreferences(): { lang: LabLang; setLang: (l: LabLang) => void; presenter: boolean; togglePresenter: () => void } {
  const [lang, setLangState] = useState<LabLang>("en");
  const [presenter, setPresenter] = useState(false);

  useEffect(() => {
    // Restored after mount, so the server render and the first client render are identical.
    const storedLang = read(LANG_KEY);
    if (storedLang === "vi" || storedLang === "en") setLangState(storedLang);
    if (read(PRESENTER_KEY) === "1") setPresenter(true);
  }, []);

  const setLang = useCallback((l: LabLang) => {
    setLangState(l);
    write(LANG_KEY, l);
  }, []);

  const togglePresenter = useCallback(() => {
    setPresenter((p) => !p);
  }, []);

  useEffect(() => {
    write(PRESENTER_KEY, presenter ? "1" : "0");
  }, [presenter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() !== "p" || e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      togglePresenter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePresenter]);

  return { lang, setLang, presenter, togglePresenter };
}

/** The viewer asked for less motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (!query) return;
    const update = (): void => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
