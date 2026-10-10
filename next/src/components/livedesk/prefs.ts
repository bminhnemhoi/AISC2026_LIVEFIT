"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Per-viewer choices for the new screens. Language and presenter mode use the Lab's own storage keys
 * (`livelift.lab.lang`, `livelift.lab.presenter`), so one choice holds across the Lab and the Live Desk; the new
 * screens differ only in their default language, Vietnamese. The theme has its own key. Everything starts at the
 * defaults and is restored after mount, so the server render and the first client render are identical.
 */

export type DeskLang = "vi" | "en";
export type DeskTheme = "light" | "dark";

const LANG_KEY = "livelift.lab.lang";
const PRESENTER_KEY = "livelift.lab.presenter";
const THEME_KEY = "livelift.livedesk.theme";

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

export interface DeskPrefs {
  lang: DeskLang;
  setLang: (lang: DeskLang) => void;
  theme: DeskTheme;
  toggleTheme: () => void;
  presenter: boolean;
  togglePresenter: () => void;
}

interface Stored {
  lang: DeskLang;
  theme: DeskTheme;
  presenter: boolean;
}

const DEFAULTS: Stored = { lang: "vi", theme: "light", presenter: false };

/**
 * The choices as last read or set in this page's lifetime. null until the first screen has mounted: the first render
 * after a full page load must use the defaults to match the server, but a screen opened by client navigation starts
 * from the remembered choices, so a dark theme never flashes light between screens.
 */
let remembered: Stored | null = null;

function readStored(): Stored {
  const lang = read(LANG_KEY);
  return {
    lang: lang === "vi" || lang === "en" ? lang : DEFAULTS.lang,
    theme: read(THEME_KEY) === "dark" ? "dark" : "light",
    presenter: read(PRESENTER_KEY) === "1",
  };
}

/** Tests only: forget the remembered choices, as a full page load does. */
export function forgetDeskPrefsForTests(): void {
  remembered = null;
}

export function useDeskPrefs(): DeskPrefs {
  const [prefs, setPrefs] = useState<Stored>(() => remembered ?? DEFAULTS);

  useEffect(() => {
    const stored = remembered ?? readStored();
    remembered = stored;
    setPrefs(stored);
  }, []);

  const change = useCallback((patch: Partial<Stored>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      remembered = next;
      return next;
    });
  }, []);
  const { lang, theme, presenter } = prefs;
  const setLang = useCallback((next: DeskLang) => {
    write(LANG_KEY, next);
    change({ lang: next });
  }, [change]);
  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    write(THEME_KEY, next);
    change({ theme: next });
  }, [change, theme]);
  const togglePresenter = useCallback(() => {
    write(PRESENTER_KEY, presenter ? "0" : "1");
    change({ presenter: !presenter });
  }, [change, presenter]);

  return { lang, setLang, theme, toggleTheme, presenter, togglePresenter };
}

/** The viewer asked for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
