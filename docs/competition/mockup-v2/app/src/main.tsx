// Entry: renders the shell, wires the presenter keys, applies theme and presenter mode,
// and exposes a tiny hook (window.__lift) that the screenshot and verification scripts use.

import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ConfirmEnd, DataDrawer, KeysHelp } from "./parts/Overlays";
import { Dock, Header } from "./parts/Chrome";
import { JourneyPanel, JourneyScrim } from "./parts/Journey";
import { LiveDesk } from "./screens/LiveDesk";
import { Recap } from "./screens/Recap";
import { Setup } from "./screens/Setup";
import { getState, setState, subscribe, useStore, type Screen, type State } from "./store";
import { BEATS, jumpTo, next, prev, reset, setAutoplay } from "./story";

const SCREENS: Record<Screen, () => preact.JSX.Element> = { setup: Setup, desk: LiveDesk, recap: Recap };

/** Crossfade with an 8 px shift: the old screen fades out while the new one fades in. */
function Screens() {
  const screen = useStore((s) => s.screen);
  const [leaving, setLeaving] = useState<Screen | null>(null);
  const prevScreen = useRef(screen);
  useEffect(() => {
    if (prevScreen.current === screen) return;
    const reduce = document.documentElement.dataset.instant === "1" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      setLeaving(prevScreen.current);
      const id = window.setTimeout(() => setLeaving(null), 200);
      prevScreen.current = screen;
      return () => window.clearTimeout(id);
    }
    prevScreen.current = screen;
  }, [screen]);
  const Current = SCREENS[screen];
  const Old = leaving ? SCREENS[leaving] : null;
  return (
    <div class="stage">
      {Old && (
        <div class="screen-wrap is-leaving" aria-hidden="true" inert>
          <Old />
        </div>
      )}
      <div class="screen-wrap is-entering" key={screen}>
        <Current />
      </div>
    </div>
  );
}

function App() {
  const presenter = useStore((s) => s.presenter);
  const journey = useStore((s) => s.journey);
  return (
    <div class={`app${presenter ? " is-presenter" : ""}${journey ? " is-journey" : ""}`}>
      <a class="skip" href="#main">
        Bỏ qua tới nội dung chính
      </a>
      <Header />
      <Screens />
      <JourneyPanel />
      {!presenter && <Dock />}
      <JourneyScrim />
      <DataDrawer />
      <KeysHelp />
      <ConfirmEnd />
    </div>
  );
}

// ---------- keys ----------

function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);
}

function anyModal(s: State) {
  return s.drawer || s.help || s.confirmEnd;
}

window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
  const s = getState();
  const k = e.key;
  if (k === "Escape") {
    if (s.lockNote) setState({ lockNote: false });
    else if (s.journey && !anyModal(s)) setState({ journey: false, journeyStage: 0 });
    return;
  }
  // Story keys always work, so the presenter is never stuck behind a dialog.
  const storyKey = k === "ArrowRight" || k === "ArrowLeft";
  if (anyModal(s) && !storyKey && k !== "?") return;
  if (storyKey && (s.drawer || s.help)) setState({ drawer: false, help: false });
  const onButton = (e.target as HTMLElement | null)?.closest("button");
  switch (k) {
    case "ArrowRight":
      e.preventDefault();
      next();
      break;
    case "ArrowLeft":
      e.preventDefault();
      prev();
      break;
    case " ":
      if (onButton) return; // Space on a focused button presses that button
      e.preventDefault();
      setAutoplay(!s.autoplay);
      break;
    case "r":
    case "R":
      reset();
      break;
    case "t":
    case "T":
      setState({ theme: s.theme === "light" ? "dark" : "light" });
      break;
    case "p":
    case "P":
      setState({ presenter: !s.presenter });
      break;
    case "j":
    case "J":
      if (!s.journey && !s.started) {
        setState({ journey: true, journeyStage: 0 });
      } else setState({ journey: !s.journey, journeyStage: 0, screen: s.started ? "desk" : s.screen, lockNote: false });
      break;
    case "ArrowDown":
    case "ArrowUp":
      if (!s.journey) return;
      e.preventDefault();
      setState({ journeyStage: Math.max(1, Math.min(6, s.journeyStage + (k === "ArrowDown" ? 1 : -1))) });
      break;
    case "1":
      setState({ screen: "setup", journey: false });
      break;
    case "2":
      if (!s.started) jumpTo(6);
      setState({ screen: "desk", journey: false });
      break;
    case "3":
      if (!s.ended) jumpTo(15);
      setState({ screen: "recap", journey: false });
      break;
    case "?":
      setState({ help: !s.help });
      break;
    default:
      return;
  }
});

// ---------- theme, presenter, motion ----------

function applyRootFlags() {
  const s = getState();
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.screen = s.screen;
  // presenter mode raises the type scale (tokens.css) for slides and the back of the hall
  if (s.presenter) root.dataset.presenter = "1";
  else delete root.dataset.presenter;
}
subscribe(applyRootFlags);

// ---------- URL state for screenshots: ?beat=9&theme=dark&presenter=1&journey=1&motion=reduce ----------

const q = new URLSearchParams(location.search);
if (q.get("theme") === "dark") setState({ theme: "dark" });
if (q.get("motion") === "reduce") document.documentElement.dataset.motion = "reduce";
if (q.get("presenter") === "1") setState({ presenter: true });
const beat = Number(q.get("beat"));
if (beat > 0 && beat < BEATS.length) jumpTo(beat);
if (q.get("journey") === "1") setState({ journey: true, screen: getState().started ? "desk" : getState().screen });
applyRootFlags();

declare global {
  interface Window {
    __lift: { get: () => State; set: (p: Partial<State>) => void; jump: (n: number) => void; beats: number };
  }
}
window.__lift = { get: getState, set: setState, jump: jumpTo, beats: BEATS.length };

render(<App />, document.getElementById("app") as HTMLElement);
