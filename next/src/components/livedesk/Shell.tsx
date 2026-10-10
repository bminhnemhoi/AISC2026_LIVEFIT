"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentLive } from "@/lib/livedesk/hooks";
import { COPY, type DeskCopy } from "./copy";
import { IconClose, IconKeyboard, IconMoon, IconRoute, IconSun } from "./icons";
import { useDeskPrefs, type DeskLang, type DeskPrefs } from "./prefs";
import { Sheet } from "./Sheet";
import { SimTag } from "./ui";
import "./calm.css";

/**
 * The frame every new screen shares: the Calm Studio wrapper (`.ld`, which scopes the tokens), the top bar, the data
 * journey column, the quiet bottom bar and the keys. Screens put their own pieces into the bar through props.
 */

export type DeskScreen = "home" | "start" | "desk" | "recap" | "legacy";

interface ShellContext {
  lang: DeskLang;
  c: DeskCopy;
  prefs: DeskPrefs;
  journey: boolean;
  stage: number;
  setStage: (n: number) => void;
  /** True when a modal surface is open: the screens' own keys stay quiet. */
  modalOpen: boolean;
}

const Ctx = createContext<ShellContext | null>(null);

export function useShell(): ShellContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShell outside Shell");
  return ctx;
}

/** A numbered badge inside a real element; shown only while the data journey is open. */
export function JBadge({ n }: { n: number }) {
  const { journey, stage } = useShell();
  if (!journey) return null;
  return <span className={`jbadge${stage === n ? " is-active" : ""}`} aria-hidden="true">{n}</span>;
}

/** Typing in a field must never trigger a screen key. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
}

interface Box { x: number; y: number; w: number; h: number }
const PAD = 6;

function measure(): Record<number, Box> {
  const out: Record<number, Box> = {};
  for (let n = 1; n <= 6; n++) {
    const el = document.querySelector<HTMLElement>(`.ld [data-journey="${n}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    out[n] = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
  }
  return out;
}

/** A slight dim with clear windows over the six elements, and a ring on the active one. It covers nothing. */
function JourneyScrim({ stage }: { stage: number }) {
  const [boxes, setBoxes] = useState<Record<number, Box>>({});
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const update = (): void => {
      setBoxes(measure());
      setVp({ w: window.innerWidth, h: window.innerHeight });
    };
    update();
    const id = window.setInterval(update, 300);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [stage]);
  if (Object.keys(boxes).length === 0 || vp.w === 0) return null;
  const active = stage ? boxes[stage] : null;
  return (
    <svg className="journey-scrim" width={vp.w} height={vp.h} aria-hidden="true">
      <defs>
        <mask id="journey-mask">
          <rect width={vp.w} height={vp.h} fill="white" />
          {Object.entries(boxes).map(([n, b]) => <rect key={n} x={b.x} y={b.y} width={b.w} height={b.h} fill="black" />)}
        </mask>
      </defs>
      <rect width={vp.w} height={vp.h} fill="var(--scrim-soft)" mask="url(#journey-mask)" />
      {active && <rect key={stage} className="journey-ring" x={active.x} y={active.y} width={active.w} height={active.h} />}
    </svg>
  );
}

function JourneyPanel({ c, stage, setStage, onClose, onDesk }: { c: DeskCopy; stage: number; setStage: (n: number) => void; onClose: () => void; onDesk: boolean }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => {
      if (back && document.contains(back)) back.focus();
    };
  }, []);
  return (
    <aside className="journey-panel" aria-labelledby="journey-h" data-testid="journey-panel">
      <div className="journey-head">
        <h2 id="journey-h">{c.journey}</h2>
        <button type="button" className="icon-btn" aria-label={c.journeyClose} ref={close} onClick={onClose}><IconClose /></button>
      </div>
      <p className="journey-sub">{c.journeySub}</p>
      <ol className="journey-list">
        {c.stages.map((s, i) => {
          const n = i + 1;
          return (
            <li key={n}>
              <button type="button" className="journey-stage" aria-current={stage === n ? "step" : undefined} data-testid={`journey-stage-${n}`}
                onMouseEnter={() => setStage(n)} onFocus={() => setStage(n)} onClick={() => setStage(stage === n ? 0 : n)}>
                <span className="journey-n" aria-hidden="true">{n}</span>
                <span className="journey-body">
                  <span className="journey-title"><span className="sr-only">{c.stageWord} {n}: </span>{s.title}</span>
                  <span className="journey-text">{s.text}</span>
                  <span className="journey-where">{onDesk ? `${c.where}: ${s.where}` : c.journeyNoDesk}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="journey-hint">{c.journeyHint}</p>
    </aside>
  );
}

/** The LiveLift mark, the team's logo redrawn flat: an L with a fold, a growth bar, a lift arrow and live-signal arcs. Same
 * geometry as docs/brand/logo (build_logo.py). Colours come from the theme tokens. */
function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="270 190 780 780" width="36" height="36" aria-hidden="true" focusable="false">
      <path className="logo-ink" d="M530 248 V812 H430 C350 812 310 770 310 700 V440 C310 415 322 402 342 390 Z" />
      <path className="logo-ink" d="M310 760 C310 900 380 962 480 962 H975 L905 848 H520 C400 848 330 815 310 760 Z" />
      <path className="logo-acc" d="M700 342 V780 H570 V398 Z" />
      <path className="logo-acc" d="M520 815 C660 805 800 725 810 553 L733 553 L855 425 L975 553 L912 553 C905 700 800 815 640 818 Z" />
      <path className="logo-arc" d="M815 228 C910 230 985 300 1000 410" />
      <path className="logo-arc" d="M818 312 C870 315 915 350 922 405" />
    </svg>
  );
}

function Nav({ screen, c }: { screen: DeskScreen; c: DeskCopy }) {
  const live = useCurrentLive();
  const deskHref = live ? `/desk/${encodeURIComponent(live.id)}` : null;
  const recapHref = live?.mode === "ended" ? `/desk/${encodeURIComponent(live.id)}/recap` : null;
  const items: { id: DeskScreen; n: number | null; label: string; href: string | null; off?: string }[] = [
    { id: "start", n: 1, label: c.start, href: "/start" },
    { id: "desk", n: 2, label: c.desk, href: deskHref, off: c.navDeskOff },
    { id: "recap", n: 3, label: c.recap, href: recapHref, off: c.navRecapOff },
  ];
  return (
    <nav className="trail" aria-label={c.navLabel} data-testid="desk-nav">
      <ol>
        {items.map((item) => (
          <li key={item.id} className={`nav-${item.id}`}>
            {item.href ? (
              <Link href={item.href} className="trail-step" aria-current={screen === item.id ? "page" : undefined} data-testid={`nav-${item.id}`}>
                {item.n !== null && <span className="trail-n" aria-hidden="true">{item.n}</span>}
                {item.label}
              </Link>
            ) : (
              <span className="trail-step is-off" aria-disabled="true" title={item.off} data-testid={`nav-${item.id}`}>
                {item.n !== null && <span className="trail-n" aria-hidden="true">{item.n}</span>}
                {item.label}
                <span className="sr-only">. {item.off}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Shell({ screen, children, headerStatus, headerEnd, dockStart, dockCenter, dockEnd, onSpace, modalOpen = false }: {
  screen: DeskScreen;
  children: React.ReactNode;
  /** Desk only: LIVE status. */
  headerStatus?: React.ReactNode;
  /** Desk only: End live. */
  headerEnd?: React.ReactNode;
  dockStart?: React.ReactNode;
  dockCenter?: React.ReactNode;
  dockEnd?: React.ReactNode;
  onSpace?: () => void;
  modalOpen?: boolean;
}) {
  const prefs = useDeskPrefs();
  const { lang, setLang, theme, toggleTheme, presenter, togglePresenter } = prefs;
  const c = COPY[lang];
  const router = useRouter();
  const live = useCurrentLive();
  const [journey, setJourney] = useState(false);
  const [stage, setStage] = useState(0);
  const [help, setHelp] = useState(false);
  const blocked = modalOpen || help;

  const toggleJourney = useCallback(() => {
    setJourney((on) => !on);
    setStage(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "Escape" && journey && !blocked) {
        setJourney(false);
        setStage(0);
        return;
      }
      if (blocked) return;
      if (journey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        setStage((s) => (e.key === "ArrowDown" ? (s >= 6 ? 1 : s + 1) : s <= 1 ? 6 : s - 1));
        return;
      }
      if (e.repeat) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "j") toggleJourney();
      else if (key === "p") togglePresenter();
      else if (key === "t") toggleTheme();
      else if (key === "?") setHelp(true);
      else if (key === " " && onSpace) {
        if ((e.target as HTMLElement | null)?.closest?.("button, a, summary")) return;
        e.preventDefault();
        onSpace();
      } else if (key === "1") router.push("/start");
      else if (key === "2" && live) router.push(`/desk/${encodeURIComponent(live.id)}`);
      else if (key === "3" && live?.mode === "ended") router.push(`/desk/${encodeURIComponent(live.id)}/recap`);
      else return;
      if (key !== " ") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [journey, blocked, toggleJourney, togglePresenter, toggleTheme, onSpace, router, live]);

  const ctx: ShellContext = { lang, c, prefs, journey, stage, setStage, modalOpen: blocked };
  return (
    <Ctx.Provider value={ctx}>
      <div className={`ld screen-${screen}${presenter ? " is-presenter" : ""}${journey ? " is-journey" : ""}`} data-theme={theme}
        data-presenter={presenter ? "1" : "0"} lang={lang} data-testid="livedesk-frame" data-screen={screen}>
        <header className="hdr">
          <div className="hdr-brand">
            <Link href="/" className="wordmark" aria-label={`LiveLift, ${c.home}`}><LogoMark />{/* L3: one weight; the dot of the i in "Lift" is a small upward wedge (the link's label carries the name) */}<span>Live<span className="wordmark-lift">L<span className="wordmark-i">ı</span>ft</span></span></Link>
          </div>
          <Nav screen={screen} c={c} />
          <div className="hdr-spacer" />
          {headerStatus}
          <SimTag><span className="stamp-long">{c.stamp}</span><span className="stamp-short">SIMULATED</span></SimTag>
          <button type="button" className="btn btn-secondary btn-md journey-toggle" aria-pressed={journey} onClick={toggleJourney} data-testid="journey-toggle">
            <IconRoute />
            <span>{c.journey}</span>
          </button>
          {headerEnd}
        </header>
        <main className="stage" id="main-content">
          <div className="screen-wrap is-entering">{children}</div>
        </main>
        {journey && <JourneyPanel c={c} stage={stage} setStage={setStage} onClose={toggleJourney} onDesk={screen === "desk"} />}
        {journey && screen === "desk" && <JourneyScrim stage={stage} />}
        {!presenter && (
          <footer className="dock">
            <div className="dock-group">
              <span className="sample-tag">{c.simData}</span>
              {dockStart}
            </div>
            <div className="dock-group dock-middle">{dockCenter}</div>
            <div className="dock-group dock-end">
              {dockEnd}
              <div className="lang-switch" role="group" aria-label={c.langLabel}>
                <button type="button" aria-pressed={lang === "vi"} onClick={() => setLang("vi")} data-testid="desk-lang-vi" lang="vi">VI<span className="sr-only"> Tiếng Việt</span></button>
                <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} data-testid="desk-lang-en" lang="en">EN<span className="sr-only"> English</span></button>
              </div>
              <button type="button" className="dock-btn" onClick={toggleTheme} data-testid="theme-toggle">
                {theme === "light" ? <IconMoon size={18} /> : <IconSun size={18} />}
                <span className="dock-label">{theme === "light" ? c.themeDark : c.themeLight}</span>
              </button>
              <button type="button" className="dock-btn" onClick={() => setHelp(true)} data-testid="keys-open">
                <IconKeyboard size={18} />
                <span className="dock-label">{c.keys}</span>
              </button>
            </div>
          </footer>
        )}
        {help && (
          <Sheet title={c.keysTitle} closeLabel={c.close} onClose={() => setHelp(false)} side="center" testId="keys-sheet">
            <table className="keys">
              <tbody>
                {c.keyList.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k.split("  ").map((x) => <kbd key={x}>{x}</kbd>)}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sheet>
        )}
      </div>
    </Ctx.Provider>
  );
}
