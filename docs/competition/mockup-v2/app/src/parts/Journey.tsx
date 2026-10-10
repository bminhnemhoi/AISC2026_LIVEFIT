// "Hành trình dữ liệu": the six stages of the Data Driven Business topic, shown on the
// Live Desk without covering anything. The page dims slightly; six small numbered badges
// sit inside the real elements (in the layout, so they push nothing over content); the
// stages are listed in one ordered panel that takes its own column. Hovering, focusing or
// stepping a stage (↑ ↓ or →) rings its element.

import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { IconClose } from "../icons";
import { setState, useStore } from "../store";

export interface Stage {
  n: number;
  title: string;
  text: string;
  where: string;
}

export const STAGES: Stage[] = [
  { n: 1, title: "Thu thập", text: "Bình luận, người xem, thêm giỏ đổ về từng giây.", where: "Khung Bình luận" },
  { n: 2, title: "Làm sạch", text: "Che số điện thoại trước khi hiện và lưu.", where: "Dòng “đã che”, cuối khung Bình luận" },
  { n: 3, title: "Phân tích", text: "Đếm ý định trong 2 phút qua.", where: "Bốn ô đếm ý định" },
  { n: 4, title: "Khai thác insight", text: "Biến số đếm thành lý do, kèm cỡ mẫu.", where: "Ba con số và độ tin cậy" },
  { n: 5, title: "Đề xuất giải pháp", text: "Nên ghim gì; người vận hành quyết định.", where: "Câu trả lời lớn ở giữa" },
  { n: 6, title: "Đánh giá hiệu quả", text: "Nhận, bỏ qua, tự làm, và điều chưa biết.", where: "Nút Kết thúc live, mở Tổng kết" },
];

/** A numbered badge placed inside a real element. Rendered only while the journey is on. */
export function JBadge({ n }: { n: number }) {
  const on = useStore((s) => s.journey);
  const active = useStore((s) => s.journeyStage === n);
  if (!on) return null;
  return (
    <span class={`jbadge${active ? " is-active" : ""}`} aria-hidden="true">
      {n}
    </span>
  );
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;

function measure(): Record<number, Box> {
  const out: Record<number, Box> = {};
  for (const s of STAGES) {
    const el = document.querySelector<HTMLElement>(`[data-journey="${s.n}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    out[s.n] = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
  }
  return out;
}

/** Slight dim with clear windows over the six elements, and a ring on the active one. */
export function JourneyScrim() {
  const on = useStore((s) => s.journey);
  const stage = useStore((s) => s.journeyStage);
  const screen = useStore((s) => s.screen);
  const t = useStore((s) => s.t);
  const [boxes, setBoxes] = useState<Record<number, Box>>({});
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useLayoutEffect(() => {
    if (!on) return;
    const update = () => {
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
  }, [on, screen, t, stage]);
  if (!on || Object.keys(boxes).length === 0) return null;
  const active = stage ? boxes[stage] : null;
  return (
    <svg class="journey-scrim" width={vp.w} height={vp.h} aria-hidden="true">
      <defs>
        <mask id="journey-mask">
          <rect width={vp.w} height={vp.h} fill="white" />
          {Object.entries(boxes).map(([n, b]) => (
            <rect key={n} x={b.x} y={b.y} width={b.w} height={b.h} rx="0" fill="black" />
          ))}
        </mask>
      </defs>
      <rect width={vp.w} height={vp.h} fill="var(--scrim-soft)" mask="url(#journey-mask)" />
      {active && <rect key={stage} class="journey-ring" x={active.x} y={active.y} width={active.w} height={active.h} rx="0" />}
    </svg>
  );
}

/** The ordered list of stages, in its own layout column. */
export function JourneyPanel() {
  const on = useStore((s) => s.journey);
  const stage = useStore((s) => s.journeyStage);
  const started = useStore((s) => s.started);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!on) return;
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => {
      if (back && document.contains(back)) back.focus();
    };
  }, [on]);
  if (!on) return null;
  return (
    <aside class="journey-panel" aria-labelledby="journey-h">
      <div class="journey-head">
        <h2 id="journey-h">Hành trình dữ liệu</h2>
        <button type="button" class="icon-btn" aria-label="Đóng hành trình dữ liệu" ref={close} onClick={() => setState({ journey: false, journeyStage: 0 })}>
          <IconClose />
        </button>
      </div>
      <p class="journey-sub">Sáu việc của đề tài Data Driven Business, và chỗ mỗi việc diễn ra trên Live Desk.</p>
      <ol class="journey-list">
        {STAGES.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              class="journey-stage"
              aria-current={stage === s.n ? "step" : undefined}
              onMouseEnter={() => setState({ journeyStage: s.n })}
              onFocus={() => setState({ journeyStage: s.n })}
              onClick={() => setState({ journeyStage: stage === s.n ? 0 : s.n })}
            >
              <span class="journey-n" aria-hidden="true">
                {s.n}
              </span>
              <span class="journey-body">
                <span class="journey-title">
                  <span class="sr-only">Bước {s.n}: </span>
                  {s.title}
                </span>
                <span class="journey-text">{s.text}</span>
                <span class="journey-where">{started ? `Ở đâu: ${s.where}` : "Bắt đầu live để thấy trên Live Desk"}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p class="journey-hint">Rê chuột hoặc bấm ↑ ↓ để xem từng bước.</p>
    </aside>
  );
}
