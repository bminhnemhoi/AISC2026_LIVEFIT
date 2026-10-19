import React from "react";
import fs from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timLoiChu } from "@/lib/tu-ngu";
import {
  DUONG_DONG_THOI_GIAN,
  DUONG_VIDEO_NGUOI_DAN,
  DienThoaiLive,
  dinhDangGia,
  dinhDangNguoiXem,
  docDongThoiGian,
  doanTai,
  laAnhPoster,
  monDangNoi,
  nguonVideo,
  type DoanDongThoiGian,
} from "@/components/dien-thoai";
import { NGHIENG_TOI_DA } from "@/components/minh-hoa";
import { chuCua, gocXoay, tuTiengAnh } from "@/components/minh-hoa/__tests__/kiem-chu";

const HUY_HIEU = "NGƯỜI DẪN AI · GIỌNG TỔNG HỢP";
const DONG: DoanDongThoiGian[] = [
  { tu_s: 0, den_s: 30, mon: "Áo thun cotton basic" },
  { tu_s: 30, den_s: 75, mon: "Túi tote canvas" },
];
const BINH_LUAN = Array.from({ length: 6 }, (_, i) => ({ id: i, ten: `Khách ${i + 1}`, noiDung: `Bình luận số ${i + 1}` }));

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;

beforeEach(() => {
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, writable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, writable: true, value: pause });
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

function khung(): HTMLElement {
  return screen.getByTestId("dien-thoai-live");
}

function caiMatchMedia(giam: boolean): () => void {
  const cu = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (q: string) => ({ matches: giam && q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} }),
  });
  return () => {
    if (cu) Object.defineProperty(window, "matchMedia", cu);
    else delete (window as unknown as Record<string, unknown>).matchMedia;
  };
}

describe("huy hiệu NGƯỜI DẪN AI luôn hiện khi laNguoiDanAI", () => {
  it("video mp4 đang phát: có huy hiệu HTML và data-nguoi-dan-ai; video tắt tiếng, tự phát", () => {
    render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} laNguoiDanAI />);
    expect(screen.getByText(HUY_HIEU).tagName).toBe("P");
    expect(khung()).toHaveAttribute("data-nguoi-dan-ai");
    const v = khung().querySelector("video") as HTMLVideoElement;
    expect(v).not.toBeNull();
    expect(v.muted).toBe(true);
    expect(v.getAttribute("src")).toBe("/xem/nguoi-dan-ai.mp4");
    expect(play).toHaveBeenCalled();
    expect(khung().getAttribute("data-che-do")).toBe("video");
  });

  it("tạm dừng: video dừng, huy hiệu vẫn hiện; bấm lại thì phát", () => {
    render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} laNguoiDanAI />);
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng video" }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByText(HUY_HIEU)).toBeInTheDocument();
    expect(khung()).toHaveAttribute("data-nguoi-dan-ai");
    play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Phát video" }));
    expect(play).toHaveBeenCalled();
  });

  it("nút tiếng: mặc định tắt tiếng, bấm thì bật", () => {
    render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} laNguoiDanAI />);
    const v = khung().querySelector("video") as HTMLVideoElement;
    fireEvent.click(screen.getByRole("button", { name: "Bật tiếng" }));
    expect(v.muted).toBe(false);
    expect(screen.getByRole("button", { name: "Tắt tiếng" })).toBeInTheDocument();
  });

  it("video lỗi (chưa có tệp): chuyển sang hình dự phòng, huy hiệu vẫn hiện", () => {
    render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} laNguoiDanAI />);
    fireEvent.error(khung().querySelector("video") as HTMLVideoElement);
    expect(khung().querySelector("video")).toBeNull();
    expect(khung().querySelector(".dt-ve-tay")).not.toBeNull();
    expect(screen.getByText("MINH HOẠ")).toBeInTheDocument();
    expect(screen.getByText(HUY_HIEU)).toBeInTheDocument();
    expect(khung()).toHaveAttribute("data-nguoi-dan-ai");
    expect(khung().getAttribute("data-che-do")).toBe("du-phong");
  });

  it("video lỗi và có ảnh tĩnh dự phòng: hiện ảnh, huy hiệu vẫn hiện", () => {
    render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} anhDuPhong="/xem/nguoi-dan-ai.jpg" laNguoiDanAI />);
    fireEvent.error(khung().querySelector("video") as HTMLVideoElement);
    expect(khung().querySelector("img")?.getAttribute("src")).toBe("/xem/nguoi-dan-ai.jpg");
    expect(screen.getByText(HUY_HIEU)).toBeInTheDocument();
  });

  it("không có src: hình người dẫn vẽ tay + MINH HOẠ, huy hiệu vẫn hiện", () => {
    render(<DienThoaiLive laNguoiDanAI />);
    expect(khung().querySelector("video, iframe")).toBeNull();
    expect(khung().querySelector(".dt-ve-tay")).not.toBeNull();
    expect(screen.getByText("MINH HOẠ")).toBeInTheDocument();
    expect(screen.getByText(HUY_HIEU)).toBeInTheDocument();
  });

  it("YouTube: khung nhúng youtube-nocookie tắt tiếng, có huy hiệu", () => {
    render(<DienThoaiLive src="https://www.youtube.com/watch?v=abcdEFGH123" laNguoiDanAI />);
    const f = khung().querySelector("iframe");
    expect(f?.getAttribute("src")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abcdEFGH123\?/);
    expect(f?.getAttribute("src")).toContain("mute=1");
    expect(screen.getByText(HUY_HIEU)).toBeInTheDocument();
    expect(khung().getAttribute("data-che-do")).toBe("youtube");
  });

  it("giảm chuyển động: video không tự phát, nút là Phát video, không có tim bay; huy hiệu vẫn hiện", () => {
    const traLai = caiMatchMedia(true);
    try {
      render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} laNguoiDanAI />);
      expect(screen.getByRole("button", { name: "Phát video" })).toBeInTheDocument();
      expect(play).not.toHaveBeenCalled();
      expect(khung().querySelectorAll(".dt-tim-bay")).toHaveLength(0);
      expect(screen.getByText(HUY_HIEU)).toBeInTheDocument();
    } finally {
      traLai();
    }
  });

  it("không phải người dẫn AI: không huy hiệu, không data-nguoi-dan-ai", () => {
    render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} />);
    expect(screen.queryByText(HUY_HIEU)).toBeNull();
    expect(khung()).not.toHaveAttribute("data-nguoi-dan-ai");
  });
});

describe("chế độ poster", () => {
  it("cheDoPoster: không video, không khung nhúng, không data-nguoi-dan-ai; người dẫn vẽ tay + MINH HOẠ", () => {
    render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} anhDuPhong="/xem/nguoi-dan-ai.jpg" laNguoiDanAI cheDoPoster />);
    expect(khung().querySelector("video, iframe, img")).toBeNull();
    expect(khung().querySelector(".dt-ve-tay")).not.toBeNull();
    expect(screen.getByText("MINH HOẠ")).toBeInTheDocument();
    expect(khung()).not.toHaveAttribute("data-nguoi-dan-ai");
    expect(screen.queryByText(HUY_HIEU)).toBeNull();
    expect(khung().getAttribute("data-che-do")).toBe("poster");
    expect(play).not.toHaveBeenCalled();
  });

  it("?anh-poster=1 trên địa chỉ trang cũng bật chế độ poster", () => {
    window.history.replaceState({}, "", "/xem/abc?anh-poster=1");
    render(<DienThoaiLive src="https://youtu.be/abcdEFGH123" laNguoiDanAI />);
    expect(khung().querySelector("video, iframe")).toBeNull();
    expect(khung()).not.toHaveAttribute("data-nguoi-dan-ai");
    expect(khung().classList.contains("is-poster")).toBe(true);
  });
});

describe("người dẫn đang nói về (MÁY CHÉP LỜI)", () => {
  it("đổi theo giây của video", () => {
    render(<DienThoaiLive src={DUONG_VIDEO_NGUOI_DAN} dongThoiGian={DONG} laNguoiDanAI />);
    const v = khung().querySelector("video") as HTMLVideoElement;
    const toi = (t: number) => {
      Object.defineProperty(v, "currentTime", { configurable: true, get: () => t });
      fireEvent.timeUpdate(v);
    };
    toi(12);
    expect(khung().querySelector(".dt-noi-ve")?.textContent).toContain("Người dẫn đang nói về: Áo thun cotton basic");
    expect(screen.getByText("MÁY CHÉP LỜI")).toBeInTheDocument();
    toi(40);
    expect(khung().querySelector(".dt-noi-ve")?.textContent).toContain("Túi tote canvas");
    toi(200);
    expect(khung().querySelector(".dt-noi-ve")).toBeNull();
  });

  it("không có video (hình dự phòng) thì không hiện dòng này", () => {
    render(<DienThoaiLive dongThoiGian={DONG} />);
    expect(khung().querySelector(".dt-noi-ve")).toBeNull();
  });
});

describe("thẻ ghim, giỏ hàng, bình luận, số người xem", () => {
  it("thẻ ghim thẳng có tên, giá, hai nút; bấm gọi đúng hàm; Mua tăng giỏ", () => {
    const xem = vi.fn();
    const mua = vi.fn();
    const gio = vi.fn();
    const ghim = { ten: "Bình giữ nhiệt inox 750ml", gia: 159000 };
    render(<DienThoaiLive ghim={ghim} onXemNgay={xem} onMua={mua} onGioHang={gio} />);
    const the = screen.getByTestId("dien-thoai-ghim");
    expect(the.textContent).toContain("Bình giữ nhiệt inox 750ml");
    expect(the.textContent).toContain("159.000 đ");
    fireEvent.click(screen.getByRole("button", { name: "Xem ngay" }));
    expect(xem).toHaveBeenCalledWith(ghim);
    expect(screen.getByRole("button", { name: "Giỏ hàng, 0 món" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mua (tiền ảo)" }));
    expect(mua).toHaveBeenCalledWith(ghim);
    fireEvent.click(screen.getByRole("button", { name: "Giỏ hàng, 1 món" }));
    expect(gio).toHaveBeenCalledTimes(1);
    for (const g of gocXoay(khung().outerHTML)) expect(Math.abs(g)).toBeLessThanOrEqual(NGHIENG_TOI_DA);
  });

  it("khối TẮT (ghim null): không thẻ ghim; khoaNut: nút bị khoá", () => {
    const { rerender } = render(<DienThoaiLive ghim={null} />);
    expect(screen.queryByTestId("dien-thoai-ghim")).toBeNull();
    rerender(<DienThoaiLive ghim={{ ten: "Túi tote canvas", gia: 89000 }} khoaNut />);
    expect(screen.getByRole("button", { name: "Xem ngay" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mua (tiền ảo)" })).toBeDisabled();
  });

  it("soTrongGio điều khiển từ ngoài", () => {
    render(<DienThoaiLive ghim={{ ten: "Túi tote canvas" }} soTrongGio={3} />);
    fireEvent.click(screen.getByRole("button", { name: "Mua (tiền ảo)" }));
    expect(screen.getByRole("button", { name: "Giỏ hàng, 3 món" })).toBeInTheDocument();
  });

  it("bình luận: hiện 4 dòng mới nhất; tự chạy thì vòng qua danh sách", () => {
    vi.useFakeTimers();
    const { rerender } = render(<DienThoaiLive binhLuan={BINH_LUAN} />);
    let dong = Array.from(khung().querySelectorAll(".dt-bl-dong")).map((x) => x.textContent);
    expect(dong).toEqual(["Khách 3 Bình luận số 3", "Khách 4 Bình luận số 4", "Khách 5 Bình luận số 5", "Khách 6 Bình luận số 6"]);
    rerender(<DienThoaiLive binhLuan={BINH_LUAN} binhLuanTuChay />);
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    dong = Array.from(khung().querySelectorAll(".dt-bl-dong")).map((x) => x.textContent);
    expect(dong[0]).toBe("Khách 2 Bình luận số 2");
  });

  it("LIVE và số người xem kiểu vi-VN", () => {
    render(<DienThoaiLive soNguoiXem={1234} nhanNguon="DÀN DỰNG" />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByLabelText("1.234 người xem")).toBeInTheDocument();
    expect(screen.getByText("DÀN DỰNG")).toBeInTheDocument();
  });

  it("chữ trong khung: không tiếng Anh, không chữ cấm canon", () => {
    render(
      <DienThoaiLive
        src={DUONG_VIDEO_NGUOI_DAN}
        dongThoiGian={DONG}
        ghim={{ ten: "Áo thun cotton basic", gia: 129000 }}
        binhLuan={BINH_LUAN}
        soNguoiXem={58}
        laNguoiDanAI
        nhanNguon="DÀN DỰNG"
      />,
    );
    const chu = chuCua(khung());
    expect(tuTiengAnh(chu)).toEqual([]);
    expect(timLoiChu(chu, { thuatNgu: true })).toEqual([]);
    expect(chu).not.toMatch(/—/);
  });
});

describe("hàm thuần", () => {
  it("đường tệp chuẩn của người dẫn AI", () => {
    expect(DUONG_VIDEO_NGUOI_DAN).toBe("/xem/nguoi-dan-ai.mp4");
    expect(DUONG_DONG_THOI_GIAN).toBe("/xem/nguoi-dan-ai.json");
  });

  it("docDongThoiGian nhận mảng hoặc đối tượng bọc, bỏ đoạn hỏng, sắp theo giây", () => {
    const tep = {
      dong_thoi_gian: [
        { tu_s: 30, den_s: 60, mon: "Túi tote canvas", loi: " các bạn xem túi nha " },
        { tu_s: 0, den_s: 30, mon: "Áo thun cotton basic" },
        { tu_s: 70, den_s: 65, mon: "hỏng" },
        { tu_s: "a", den_s: 80, mon: "hỏng" },
        { tu_s: 90, den_s: 99, mon: "  " },
        null,
      ],
    };
    expect(docDongThoiGian(tep)).toEqual([
      { tu_s: 0, den_s: 30, mon: "Áo thun cotton basic" },
      { tu_s: 30, den_s: 60, mon: "Túi tote canvas", loi: "các bạn xem túi nha" },
    ]);
    expect(docDongThoiGian([{ start: 1, end: 2, mon: "x" }])).toEqual([{ tu_s: 1, den_s: 2, mon: "x" }]);
    expect(docDongThoiGian({ doan: [] })).toEqual([]);
    expect(docDongThoiGian(null)).toEqual([]);
    expect(docDongThoiGian("rác")).toEqual([]);
  });

  it("monDangNoi và doanTai: tu_s ≤ t < den_s", () => {
    expect(monDangNoi(DONG, 0)).toBe("Áo thun cotton basic");
    expect(monDangNoi(DONG, 29.99)).toBe("Áo thun cotton basic");
    expect(monDangNoi(DONG, 30)).toBe("Túi tote canvas");
    expect(monDangNoi(DONG, 75)).toBeNull();
    expect(monDangNoi(undefined, 5)).toBeNull();
    expect(doanTai(DONG, Number.NaN)).toBeNull();
  });

  it("nguonVideo: mp4 giữ nguyên, YouTube đổi sang nocookie có tắt tiếng và API", () => {
    expect(nguonVideo("/xem/nguoi-dan-ai.mp4")).toEqual({ kieu: "video", src: "/xem/nguoi-dan-ai.mp4" });
    expect(nguonVideo("")).toBeNull();
    expect(nguonVideo(undefined)).toBeNull();
    for (const url of ["https://youtu.be/abcdEFGH123", "https://www.youtube.com/watch?v=abcdEFGH123&t=5", "https://www.youtube.com/live/abcdEFGH123", "https://www.youtube.com/shorts/abcdEFGH123"]) {
      const n = nguonVideo(url, "http://127.0.0.1:3130");
      expect(n?.kieu).toBe("youtube");
      if (n?.kieu !== "youtube") continue;
      expect(n.id).toBe("abcdEFGH123");
      const q = new URL(n.src).searchParams;
      expect(new URL(n.src).origin).toBe("https://www.youtube-nocookie.com");
      expect(q.get("mute")).toBe("1");
      expect(q.get("enablejsapi")).toBe("1");
      expect(q.get("origin")).toBe("http://127.0.0.1:3130");
    }
    expect(nguonVideo("https://www.youtube.com/")).toBeNull();
  });

  it("định dạng số người xem và giá", () => {
    expect(dinhDangNguoiXem(58)).toBe("58");
    expect(dinhDangNguoiXem(1234)).toBe("1.234");
    expect(dinhDangNguoiXem(12345)).toBe("12,3 N");
    expect(dinhDangNguoiXem(-1)).toBe("0");
    expect(dinhDangGia(129000)).toBe("129.000 đ");
  });

  it("laAnhPoster đọc chuỗi truy vấn", () => {
    expect(laAnhPoster("?anh-poster=1")).toBe(true);
    expect(laAnhPoster("?a=2&anh-poster=1")).toBe(true);
    expect(laAnhPoster("?anh-poster=0")).toBe(false);
    expect(laAnhPoster("")).toBe(false);
    expect(laAnhPoster(null)).toBe(false);
  });
});

describe("tệp nguồn dien-thoai", () => {
  it("css: nút tròn 44 px, nút thẻ ghim 48 px, huy hiệu chữ 12 px, có giảm chuyển động, không xoay", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../dien-thoai.css"), "utf8");
    const khoi = (sel: string) => css.slice(css.indexOf(`${sel} {`), css.indexOf("}", css.indexOf(`${sel} {`)));
    expect(khoi(".dt-nut-tron")).toMatch(/width:\s*44px/);
    expect(khoi(".dt-nut-tron")).toMatch(/height:\s*44px/);
    expect(khoi(".dt-nut")).toMatch(/min-height:\s*48px/);
    expect(khoi(".dt-ai")).toMatch(/font-size:\s*12px/);
    expect(khoi(".dt-ai")).toMatch(/min-height:\s*22px/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).not.toMatch(/rotate/);
  });

  it("không chứa dấu gạch dài, chính tả cũ", () => {
    const thuMuc = path.resolve(__dirname, "..");
    for (const ten of fs.readdirSync(thuMuc)) {
      if (!/\.(tsx?|css)$/.test(ten)) continue;
      const van = fs.readFileSync(path.join(thuMuc, ten), "utf8");
      expect(van.includes("—"), ten).toBe(false);
      expect(van, ten).not.toMatch(/khúc|khoá lịch|khóa|hóa|xóa|minh họa/);
    }
  });
});
