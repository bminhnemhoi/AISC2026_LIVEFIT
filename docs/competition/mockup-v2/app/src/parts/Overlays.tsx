// Modal surfaces: the "Về dữ liệu này" drawer, the key list, and the end-live confirmation.
// Each traps focus, closes on Escape, and returns focus to where it came from.

import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { CONFIDENCE_RULE, DISMISS_COOLDOWN, FLASH_MIN_CART, FLASH_MIN_STOCK, MIN_MENTIONS, SWITCH_MARGIN } from "../engine";
import { fmtClock } from "../format";
import { IconClose } from "../icons";
import { endLive, later, platformCondition, setState, useStore } from "../store";
import { jumpTo } from "../story";
import { Button, SimTag } from "../ui";

function useTrap(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("button, [href], textarea, input");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>("button:not([disabled]), [href], textarea, input"));
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

function Sheet({ title, onClose, children, side = "right" }: { title: string; onClose: () => void; children: ComponentChildren; side?: "right" | "center" }) {
  const ref = useTrap(onClose);
  return (
    <div class={`overlay is-${side}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`sheet sheet-${side}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={ref}>
        <div class="sheet-head">
          <h2 id="sheet-title">{title}</h2>
          <button type="button" class="icon-btn" aria-label="Đóng" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function DataDrawer() {
  const open = useStore((s) => s.drawer);
  const started = useStore((s) => s.started);
  const ended = useStore((s) => s.ended);
  if (!open) return null;
  const close = () => setState({ drawer: false });
  const go = (f: () => void) => () => {
    close();
    f();
  };
  return (
    <Sheet title="Về dữ liệu này" onClose={close}>
      <section class="about">
        <h3>Cái gì là mô phỏng</h3>
        <ul>
          <li>
            Nền tảng là <SimTag quiet>SIMULATED Shopee Live</SimTag>, chạy ngay trong trang. Không có gì được gửi tới Shopee.
          </li>
          <li>Người xem, bình luận, lượt thêm giỏ là dữ liệu mẫu theo kịch bản cố định: chạy lại sẽ ra đúng các con số này.</li>
          <li>Sản phẩm, tên tài khoản và bình luận đều là hư cấu.</li>
        </ul>
      </section>
      <section class="about">
        <h3>Trợ lý gợi ý theo luật nào</h3>
        <ul>
          <li>Chỉ đọc 2 phút gần nhất. Gợi ý ghim khi một sản phẩm được nhắc từ {MIN_MENTIONS} bình luận, và hơn sản phẩm đang ghim ít nhất {SWITCH_MARGIN}.</li>
          <li>Độ tin cậy chỉ dựa vào cỡ mẫu, không có phần trăm tự đặt. {CONFIDENCE_RULE}</li>
          <li>
            Flash sale: gợi ý khi sản phẩm đang ghim có từ {FLASH_MIN_CART} lượt thêm giỏ trong 2 phút, nhiều hơn 2 phút trước, và còn từ {FLASH_MIN_STOCK} sản phẩm.
          </li>
          <li>Bỏ qua một gợi ý thì trợ lý không nhắc lại sản phẩm đó trong {DISMISS_COOLDOWN / 60} phút.</li>
          <li>Trợ lý nói “tín hiệu cho thấy”, không nói nguyên nhân. Thêm giỏ không phải đơn hàng.</li>
        </ul>
      </section>
      <section class="about">
        <h3>Thông tin cá nhân</h3>
        <ul>
          <li>Số điện thoại trong bình luận được che trước khi hiển thị và trước khi lưu.</li>
        </ul>
      </section>
      <section class="about">
        <h3>Thiết kế so với thật</h3>
        <ul>
          <li>“Đã lưu” ở thanh trên là ý đồ thiết kế: bản thật lưu mọi thao tác vào cơ sở dữ liệu. Mockup này không có máy chủ và không lưu gì.</li>
          <li>Chế độ Thí nghiệm bị khoá vì buổi mẫu ngắn hơn 90 phút.</li>
        </ul>
      </section>
      <section class="about">
        <h3>Xem các trạng thái</h3>
        <div class="state-grid">
          <Button size="sm" onClick={go(() => jumpTo(0))}>Chưa có sản phẩm</Button>
          <Button
            size="sm"
            onClick={go(() => {
              setState({ deskLoading: true, screen: "desk" });
              later(1600, () => setState({ deskLoading: false }));
            })}
            disabled={!started || ended}
          >
            Đang tải
          </Button>
          <Button size="sm" onClick={go(() => jumpTo(5))}>Độ tin cậy thấp</Button>
          <Button size="sm" onClick={go(() => jumpTo(8))}>Flash sale chưa đủ tín hiệu</Button>
          <Button size="sm" onClick={go(platformCondition)} disabled={!started || ended}>
            Hết hạn quyền truy cập
          </Button>
          <Button size="sm" onClick={go(() => setState({ screen: "desk", lockNote: true }))} disabled={!started}>
            Thí nghiệm bị khoá
          </Button>
          <Button size="sm" onClick={go(() => jumpTo(14))}>Xác nhận kết thúc</Button>
        </div>
      </section>
    </Sheet>
  );
}

const KEYS: [string, string][] = [
  ["→  ←", "Bước tiếp, bước trước của kịch bản"],
  ["Space", "Tự chạy hoặc dừng kịch bản"],
  ["R", "Bắt đầu lại từ đầu"],
  ["1  2  3", "Chuẩn bị, Live Desk, Tổng kết"],
  ["J", "Bật, tắt Hành trình dữ liệu"],
  ["T", "Giao diện sáng hoặc tối"],
  ["P", "Chế độ trình chiếu: ẩn thanh dưới"],
  ["?", "Danh sách phím này"],
  ["Esc", "Đóng lớp đang mở"],
];

export function KeysHelp() {
  const open = useStore((s) => s.help);
  if (!open) return null;
  const close = () => setState({ help: false });
  return (
    <Sheet title="Phím tắt khi trình bày" onClose={close} side="center">
      <table class="keys">
        <tbody>
          {KEYS.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">
                {k.split("  ").map((x) => (
                  <kbd key={x}>{x}</kbd>
                ))}
              </th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}

export function ConfirmEnd() {
  const open = useStore((s) => s.confirmEnd);
  return open ? <ConfirmEndDialog /> : null;
}

function ConfirmEndDialog() {
  const t = useStore((s) => s.t);
  const ref = useTrap(() => setState({ confirmEnd: false }));
  return (
    <div class="overlay is-center">
      <div class="sheet sheet-center confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-h" aria-describedby="confirm-d" ref={ref}>
        <h2 id="confirm-h">Kết thúc buổi live lúc {fmtClock(t)}?</h2>
        <p id="confirm-d">
          LiveLift dừng đọc tín hiệu và lập bản tổng kết. Sản phẩm trên điện thoại người dẫn không bị thay đổi; nếu muốn bỏ ghim, bạn làm trên điện thoại.
        </p>
        <div class="row end">
          <Button variant="quiet" onClick={() => setState({ confirmEnd: false })} data-autofocus>
            Tiếp tục live
          </Button>
          <Button variant="ink" onClick={endLive}>
            Kết thúc và xem tổng kết
          </Button>
        </div>
      </div>
    </div>
  );
}
