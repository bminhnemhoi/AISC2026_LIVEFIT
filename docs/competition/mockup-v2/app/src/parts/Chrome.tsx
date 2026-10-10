// Header (brand, mode switch, live status, saved status, journey toggle, end live),
// the quiet presenter dock, and the one-time platform condition banner.

import { fmtClock } from "../format";
import { activeOutage, viewersNow } from "../engine";
import {
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconInfo,
  IconKeyboard,
  IconLink,
  IconLock,
  IconMoon,
  IconPause,
  IconPlay,
  IconRoute,
  IconSaved,
  IconSkip,
  IconStop,
  IconSun,
} from "../icons";
import { reconnect, setPlaying, setState, skipMinute, useStore, worldOf, type Screen } from "../store";
import { BEATS, jumpTo, next, prev, setAutoplay } from "../story";
import { Num, SampleTag, SimTag } from "../ui";
import { JBadge } from "./Journey";

function ModeSwitch() {
  const mode = useStore((s) => s.mode);
  const lockNote = useStore((s) => s.lockNote);
  return (
    <div class="modes" role="group" aria-label="Chế độ của trợ lý">
      <button type="button" class="mode" aria-pressed={mode === "observe"} onClick={() => setState({ mode: "observe" })}>
        Quan sát
      </button>
      <button type="button" class="mode" aria-pressed={mode === "suggest"} onClick={() => setState({ mode: "suggest" })}>
        Đề xuất
      </button>
      <button
        type="button"
        class="mode is-locked"
        aria-disabled="true"
        aria-expanded={lockNote}
        aria-controls="lock-note"
        onClick={() => setState({ lockNote: !lockNote })}
      >
        <IconLock size={16} />
        Thí nghiệm
      </button>
      {lockNote && (
        <div class="popover" id="lock-note" role="note">
          <p class="popover-title">Chế độ Thí nghiệm chưa mở</p>
          <p>Cần phiên từ 90 phút và đủ người xem. Buổi mẫu này dài 30 phút, nên LiveLift không chạy thí nghiệm và không đưa ra kết luận nhân quả.</p>
          <button type="button" class="btn btn-secondary btn-sm" onClick={() => setState({ lockNote: false })}>
            <span>Đã hiểu</span>
          </button>
        </div>
      )}
    </div>
  );
}

const TRAIL: { id: Screen; label: string }[] = [
  { id: "setup", label: "Chuẩn bị" },
  { id: "desk", label: "Live Desk" },
  { id: "recap", label: "Tổng kết" },
];

function Trail() {
  const screen = useStore((s) => s.screen);
  const started = useStore((s) => s.started);
  const ended = useStore((s) => s.ended);
  return (
    <nav class="trail" aria-label="Các màn">
      <ol>
        {TRAIL.map((x, i) => {
          const enabled = x.id === "setup" || (x.id === "desk" && started) || (x.id === "recap" && ended);
          return (
            <li key={x.id}>
              <button
                type="button"
                class="trail-step"
                aria-current={screen === x.id ? "step" : undefined}
                disabled={!enabled}
                onClick={() => setState({ screen: x.id, journey: false })}
              >
                <span class="trail-n">{i + 1}</span>
                {x.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function LiveStatus() {
  const t = useStore((s) => s.t);
  const ended = useStore((s) => s.ended);
  const outages = useStore((s) => s.outages);
  const actions = useStore((s) => s.actions);
  const viewers = viewersNow({ t, actions, outages });
  if (ended) {
    return (
      <div class="live-status is-ended">
        <IconStop size={16} />
        <span>Đã kết thúc lúc {fmtClock(t)}</span>
      </div>
    );
  }
  return (
    <div class="live-status" aria-label={`Đang live, ${fmtClock(t)}, ${viewers === null ? "chưa rõ" : viewers} người xem`}>
      <span class="live-dot" aria-hidden="true" />
      <span class="live-word">LIVE</span>
      <span class="live-time num">{fmtClock(t)}</span>
      <span class="live-sep" aria-hidden="true" />
      <span class="live-viewers">
        {viewers === null ? <span class="unknown">chưa rõ</span> : <Num value={viewers} />}
        <span class="live-unit"> người xem</span>
      </span>
    </div>
  );
}

function Saved() {
  const saving = useStore((s) => s.saving);
  return (
    <div class="saved" title="Ý đồ thiết kế: bản thật lưu vào cơ sở dữ liệu. Mockup này không lưu gì.">
      <IconSaved size={18} />
      <span>{saving ? "Đang lưu…" : "Đã lưu"}</span>
    </div>
  );
}

export function Header() {
  const screen = useStore((s) => s.screen);
  const started = useStore((s) => s.started);
  const ended = useStore((s) => s.ended);
  const journey = useStore((s) => s.journey);
  const presenter = useStore((s) => s.presenter);
  return (
    <header class="hdr">
      <div class="hdr-brand">
        <span class="wordmark">
          Live<span class="wordmark-lift">Lift</span>
        </span>
      </div>
      {screen === "desk" ? <ModeSwitch /> : <Trail />}
      <div class="hdr-spacer" />
      {started && screen === "desk" && <LiveStatus />}
      <SimTag>SIMULATED Shopee Live</SimTag>
      {/* presenter mode drops status chrome but keeps the sample-data label visible */}
      {presenter ? <SampleTag /> : <Saved />}
      <button
        type="button"
        class="btn btn-secondary btn-md journey-toggle"
        aria-pressed={journey}
        onClick={() => setState({ journey: !journey, journeyStage: 0, screen: started ? "desk" : screen, lockNote: false })}
      >
        <IconRoute />
        <span>Hành trình dữ liệu</span>
      </button>
      {screen === "desk" && started && (
        <span class="jtarget" data-journey="6">
          <JBadge n={6} />
          {ended ? (
            <button type="button" class="btn btn-ink btn-md" onClick={() => setState({ screen: "recap", journey: false })}>
              <span>Xem tổng kết</span>
            </button>
          ) : (
            <button type="button" class="btn btn-ink btn-md" onClick={() => setState({ confirmEnd: true })}>
              <span>Kết thúc live</span>
            </button>
          )}
        </span>
      )}
    </header>
  );
}

export function PlatformBanner() {
  const s = useStore((x) => x);
  const outage = activeOutage(worldOf(s));
  if (!outage || s.screen !== "desk" || s.ended) return null;
  return (
    <div class="banner" role="alert">
      <IconAlert class="banner-icon" />
      <div class="banner-text">
        <p class="banner-title">
          Hết hạn quyền truy cập <SimTag quiet>SIMULATED Shopee Live</SimTag>
        </p>
        <p>
          Nền tảng báo một lần lúc {fmtClock(outage.from)}. LiveLift đã ngừng gọi nền tảng và tạm dừng gợi ý. Bạn tiếp tục ghim trên điện thoại;
          bấm “Ghi tay” để LiveLift ghi lại việc bạn làm.
        </p>
      </div>
      <button type="button" class="btn btn-secondary btn-md" onClick={reconnect}>
        <IconLink />
        <span>Kết nối lại</span>
      </button>
    </div>
  );
}

function ClockControl() {
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  return (
    <div class="clock" role="group" aria-label="Đồng hồ mô phỏng">
      <button type="button" class="dock-btn" aria-label={playing ? "Dừng đồng hồ" : "Chạy đồng hồ"} onClick={() => setPlaying(!playing)}>
        {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        <span class="dock-label">{playing ? "Dừng" : "Chạy"}</span>
      </button>
      <div class="speed" role="group" aria-label="Tốc độ">
        {([15, 60] as const).map((v) => (
          <button key={v} type="button" class="dock-btn" aria-pressed={speed === v} onClick={() => setState({ speed: v })}>
            {v}×
          </button>
        ))}
      </div>
      <button type="button" class="dock-btn" onClick={skipMinute}>
        <IconSkip size={18} />
        <span>+1 phút</span>
      </button>
    </div>
  );
}

export function Dock() {
  const screen = useStore((s) => s.screen);
  const started = useStore((s) => s.started);
  const ended = useStore((s) => s.ended);
  const beat = useStore((s) => s.beat);
  const autoplay = useStore((s) => s.autoplay);
  const theme = useStore((s) => s.theme);
  return (
    <footer class="dock">
      <div class="dock-group">
        <SampleTag />
      </div>
      <div class="dock-group story" role="group" aria-label="Kịch bản trình bày">
        <button type="button" class="dock-btn icon-only" aria-label="Bước trước" onClick={prev} disabled={beat === 0}>
          <IconChevronLeft size={18} />
        </button>
        <button type="button" class="story-step" onClick={() => jumpTo(beat)} title="Dựng lại bước này">
          <span class="num">
            {beat}/{BEATS.length - 1}
          </span>
          <span class="story-title">{BEATS[beat].title}</span>
        </button>
        <button type="button" class="dock-btn icon-only" aria-label="Bước tiếp" onClick={next} disabled={beat === BEATS.length - 1}>
          <IconChevronRight size={18} />
        </button>
        <button type="button" class="dock-btn" aria-pressed={autoplay} onClick={() => setAutoplay(!autoplay)}>
          {autoplay ? <IconPause size={18} /> : <IconPlay size={18} />}
          <span>{autoplay ? "Dừng kịch bản" : "Tự chạy"}</span>
        </button>
      </div>
      <div class="dock-group dock-end">
        {screen === "desk" && started && !ended && <ClockControl />}
        <button type="button" class="dock-btn" onClick={() => setState({ drawer: true })}>
          <IconInfo size={18} />
          <span>Về dữ liệu này</span>
        </button>
        <button type="button" class="dock-btn" onClick={() => setState({ theme: theme === "light" ? "dark" : "light" })}>
          {theme === "light" ? <IconMoon size={18} /> : <IconSun size={18} />}
          <span class="dock-label">{theme === "light" ? "Giao diện tối" : "Giao diện sáng"}</span>
        </button>
        <button type="button" class="dock-btn" onClick={() => setState({ help: true })}>
          <IconKeyboard size={18} />
          <span class="dock-label">Phím tắt</span>
        </button>
      </div>
    </footer>
  );
}

