// The presenter's scripted story. Each beat is a small set of ordinary user actions, so the
// mockup is in exactly the same state whether the presenter clicks or the story drives it.
// Going back replays every earlier beat instantly from a clean state: deterministic.

import {
  clearTimers,
  clockTo,
  connect,
  dismissFlash,
  endLive,
  getState,
  importProducts,
  initialState,
  isBusy,
  later,
  pin,
  platformCondition,
  reconnect,
  setState,
  startLive,
  stopClock,
  unpin,
  useSampleCsv,
} from "./store";

export interface Beat {
  title: string;
  /** milliseconds the beat stays on screen when the story autoplays */
  hold: number;
  run: () => void;
}

const desk = () => setState({ screen: "desk", mode: "suggest", journey: false, journeyStage: 0, confirmEnd: false });

export const BEATS: Beat[] = [
  { title: "Chuẩn bị: chưa có sản phẩm", hold: 3500, run: () => undefined },
  { title: "Kết nối SIMULATED Shopee Live", hold: 3500, run: connect },
  { title: "Dán CSV sản phẩm", hold: 3000, run: useSampleCsv },
  { title: "Nhập: từng dòng được nạp, Túi vải tote chưa có giá", hold: 5000, run: importProducts },
  {
    title: "Bắt đầu live: 120 người xem",
    hold: 4500,
    run: startLive,
  },
  { title: "Bình luận đầu tiên, gợi ý độ tin cậy thấp", hold: 6000, run: () => (desk(), clockTo(120, 2600)) },
  { title: "Thêm tín hiệu: độ tin cậy trung bình", hold: 7000, run: () => (desk(), clockTo(240, 2600)) },
  { title: "Ghim Áo hoodie zip theo gợi ý", hold: 5000, run: () => (desk(), pin("hoodie", "suggestion")) },
  { title: "Flash sale: chưa đủ tín hiệu", hold: 5000, run: () => (desk(), clockTo(390, 2200)) },
  { title: "Flash sale: nên chạy trong 1 phút", hold: 6000, run: () => (desk(), clockTo(540, 2200)) },
  { title: "Người vận hành bỏ qua flash sale", hold: 4000, run: () => dismissFlash("hoodie") },
  {
    title: "Nền tảng báo hết hạn quyền truy cập",
    hold: 6500,
    run: () => {
      desk();
      clockTo(660, 1800);
      later(1850, platformCondition);
    },
  },
  {
    title: "Kết nối lại, dữ liệu chạy tiếp",
    hold: 4500,
    run: () => {
      desk();
      clockTo(750, 1600);
      later(1650, reconnect);
    },
  },
  {
    title: "Tự đổi ghim: bỏ Hoodie, ghim Quần cargo",
    hold: 6000,
    run: () => {
      desk();
      clockTo(900, 2000);
      later(2100, () => unpin("hoodie"));
      later(2700, () => pin("cargo", "list"));
    },
  },
  {
    title: "Kết thúc live?",
    hold: 4000,
    run: () => {
      desk();
      clockTo(1780, 2200);
      later(2300, () => setState({ confirmEnd: true }));
    },
  },
  { title: "Tổng kết và điều chưa biết", hold: 8000, run: endLive },
  {
    // The journey is shown on the richest moment of the story (04:00, the medium suggestion),
    // so every one of the six stages has something real to point at.
    title: "Hành trình dữ liệu: sáu bước, xem lại lúc 04:00",
    hold: 9000,
    run: () => {
      replayTo(6);
      setState({ beat: BEATS.length - 1, journey: true, journeyStage: 0 });
    },
  },
];

let autoTimer = 0;

/** Rebuild the state of beat `n` from scratch, with no animation. */
export function replayTo(n: number) {
  const keep = getState();
  stopClock();
  clearTimers();
  setState({ ...initialState(), theme: keep.theme, presenter: keep.presenter, instant: true });
  for (let i = 1; i <= n; i++) BEATS[i].run();
  setState({ instant: false, beat: n, autoplay: keep.autoplay && n < BEATS.length - 1 });
  // let the DOM settle without entrance animations, then re-enable them
  document.documentElement.dataset.instant = "1";
  requestAnimationFrame(() => requestAnimationFrame(() => delete document.documentElement.dataset.instant));
}

/** While the data journey is open on the Live Desk, → and ← step through its six stages first. */
function stepJourney(dir: 1 | -1): boolean {
  const s = getState();
  if (!s.journey || s.screen !== "desk" || !s.started) return false;
  const n = s.journeyStage + dir;
  if (n < 0 || n > 6) return false;
  setState({ journeyStage: n });
  return true;
}

export function next() {
  if (stepJourney(1)) return;
  const s = getState();
  const n = s.beat + 1;
  if (n >= BEATS.length) {
    setAutoplay(false);
    return;
  }
  // A beat still playing out is finished instantly first, so the next one starts from a known state.
  if (isBusy()) replayTo(s.beat);
  setState({ beat: n });
  BEATS[n].run();
  scheduleAuto();
}

export function prev() {
  if (stepJourney(-1)) return;
  const s = getState();
  replayTo(Math.max(0, s.beat - 1));
  scheduleAuto();
}

export function reset() {
  setState({ autoplay: false });
  window.clearTimeout(autoTimer);
  replayTo(0);
}

export function jumpTo(n: number) {
  replayTo(Math.max(0, Math.min(BEATS.length - 1, n)));
  scheduleAuto();
}

export function setAutoplay(on: boolean) {
  setState({ autoplay: on });
  scheduleAuto();
}

function scheduleAuto() {
  window.clearTimeout(autoTimer);
  const s = getState();
  if (!s.autoplay) return;
  if (s.beat >= BEATS.length - 1) {
    setState({ autoplay: false });
    return;
  }
  autoTimer = window.setTimeout(next, BEATS[s.beat].hold);
}
