import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { timLoiChu } from "@/lib/tu-ngu";
import {
  AoThun,
  BO_HANG,
  BinhGiuNhiet,
  CanCan,
  DaiDongXu,
  DienThoaiBamLink,
  DienThoaiKhoi,
  DongXu,
  EmptyArt,
  GioHang,
  HinhMon,
  HinhTrong,
  Icons,
  KepToc,
  LICH_MINH_HOA,
  LegacyArt,
  LichNiemPhong,
  MAU,
  MAU_HINH,
  MatXu,
  NGHIENG_TOI_DA,
  NguoiDanVeTay,
  RecapArt,
  StartArt,
  StepArt,
  TrangThaiTrong,
  TuiTote,
  UnknownSticker,
  boDau,
  demLich,
  nghieng,
  socChuNhat,
  socTron,
  timMon,
} from "@/components/minh-hoa";
import * as Brand from "@/components/minh-hoa/brand";
import { TU_ANH_CU, chuCua, gocXoay, tuTiengAnh } from "./kiem-chu";

/** jsdom không có matchMedia: cài một bản giả trả `giam` cho truy vấn giảm chuyển động. */
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

const HINH: [string, React.ReactElement][] = [
  ["AoThun", <AoThun key="a" />],
  ["TuiTote", <TuiTote key="b" />],
  ["BinhGiuNhiet", <BinhGiuNhiet key="c" />],
  ["KepToc", <KepToc key="d" />],
  ["HinhMon lạ", <HinhMon key="e" ten="Món lạ" />],
  ["MatXu bat", <MatXu key="f" mat="bat" />],
  ["MatXu tat nho", <MatXu key="g" mat="tat" nho />],
  ["MatXu chua", <MatXu key="h" mat="chua" />],
  ["DongXu", <DongXu key="i" mat="bat" />],
  ["LichNiemPhong", <LichNiemPhong key="j" />],
  ["DienThoaiBamLink", <DienThoaiBamLink key="k" />],
  ["DienThoaiKhoi bat", <DienThoaiKhoi key="l" khoi="bat" />],
  ["DienThoaiKhoi tat", <DienThoaiKhoi key="m" khoi="tat" mon="kep-toc" />],
  ["CanCan", <CanCan key="n" />],
  ["CanCan bat", <CanCan key="o" ben="bat" />],
  ["GioHang", <GioHang key="p" soMon={3} />],
  ["NguoiDanVeTay", <NguoiDanVeTay key="q" cam="binh-giu-nhiet" />],
  ["HinhTrong", <HinhTrong key="r" />],
  ["TrangThaiTrong", <TrangThaiTrong key="s" tieuDe="Chưa có phiên nào" moTa="Tạo phiên đầu để bắt đầu đo." />],
  ["StartArt", <StartArt key="t" />],
  ["RecapArt", <RecapArt key="u" />],
  ["LegacyArt", <LegacyArt key="v" />],
  ["StepArt", <StepArt key="w" step={2} />],
  ["UnknownSticker", <UnknownSticker key="x" />],
  ["EmptyArt", <EmptyArt key="y" />],
  ["DaiDongXu", <DaiDongXu key="z" phat={false} />],
];

afterEach(() => {
  vi.useRealTimers();
});

describe("hình minh hoạ: chữ tiếng Việt, đứng thẳng", () => {
  it("bộ dò chữ tiếng Anh bắt được chữ cũ của bản gốc, bỏ qua tiếng Việt không dấu", () => {
    expect(tuTiengAnh("INSTRUCTIONS · PREPARE THE SHOW · PIN WHAT SELLS · ON AIR")).toEqual(["INSTRUCTIONS", "PREPARE", "THE", "SHOW", "PIN", "WHAT", "SELLS", "ON", "AIR"]);
    expect(tuTiengAnh("LIVE GHIM tung khoi nguoi xem SHA LiveLift")).toEqual([]);
  });

  it.each(HINH)("%s không có chữ tiếng Anh, không chữ cấm, nghiêng ≤ 2°", (_ten, el) => {
    const { container } = render(el);
    const chu = chuCua(container);
    expect(tuTiengAnh(chu)).toEqual([]);
    for (const cu of TU_ANH_CU) expect(chu).not.toContain(cu);
    expect(timLoiChu(chu, { thuatNgu: true })).toEqual([]);
    for (const g of gocXoay(container.innerHTML)) expect(Math.abs(g)).toBeLessThanOrEqual(NGHIENG_TOI_DA);
  });

  it("mọi hình trong brand.tsx và mọi biểu tượng đều aria-hidden, không chữ tiếng Anh, nghiêng ≤ 2°", () => {
    const ds = [
      ...Object.entries(Brand).filter(([, v]) => typeof v === "function"),
      ...Object.entries(Icons).filter(([k, v]) => k.startsWith("Icon") && typeof v === "function"),
    ] as [string, (p: object) => React.ReactElement][];
    expect(ds.length).toBeGreaterThan(30);
    for (const [ten, H] of ds) {
      const { container, unmount } = render(<H />);
      const svg = container.querySelector("svg");
      expect(svg, ten).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden"), ten).toBe("true");
      expect(tuTiengAnh(chuCua(container)), ten).toEqual([]);
      for (const g of gocXoay(container.innerHTML)) expect(Math.abs(g), ten).toBeLessThanOrEqual(NGHIENG_TOI_DA);
      unmount();
    }
  });

  it("StartArt Việt hoá: LIVE, GHIM, CHUẨN BỊ BUỔI LIVE và chip MINH HOẠ là chữ HTML", () => {
    const { container } = render(<StartArt />);
    const chu = container.textContent ?? "";
    expect(chu).toContain("GHIM");
    expect(chu).toContain("CHUẨN BỊ BUỔI LIVE");
    const chip = container.querySelector("figcaption");
    expect(chip?.textContent).toBe("MINH HOẠ");
    const { container: c2 } = render(<StartArt nhan={null} />);
    expect(c2.querySelector("figcaption")).toBeNull();
  });

  it("hình có title thì là ảnh có nhãn; không title thì aria-hidden", () => {
    const { container } = render(
      <>
        <AoThun title="Áo thun cotton basic" />
        <AoThun />
      </>,
    );
    const [co, khong] = Array.from(container.querySelectorAll("svg"));
    expect(co.getAttribute("role")).toBe("img");
    expect(co.getAttribute("aria-label")).toBe("Áo thun cotton basic");
    expect(khong.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("bộ hàng D-025", () => {
  it("đúng bốn tên món, đúng thứ tự", () => {
    expect(BO_HANG.map((m) => m.ten)).toEqual(["Áo thun cotton basic", "Túi tote canvas", "Bình giữ nhiệt inox 750ml", "Set 3 kẹp tóc càng cua"]);
    expect(new Set(BO_HANG.map((m) => m.productId)).size).toBe(4);
  });

  it("timMon nhận tên đủ, mã, mã sản phẩm, tên gọi khác; không thấy thì null", () => {
    expect(timMon("Áo thun cotton basic")?.ma).toBe("ao-thun");
    expect(timMon("AO THUN COTTON BASIC")?.ma).toBe("ao-thun");
    expect(timMon("tui-tote")?.ma).toBe("tui-tote");
    expect(timMon("LAB-3")?.ma).toBe("binh-giu-nhiet");
    expect(timMon("cái bình này")?.ma).toBe("binh-giu-nhiet");
    expect(timMon("kẹp càng cua")?.ma).toBe("kep-toc");
    expect(timMon("áo")?.ma).toBe("ao-thun");
    expect(timMon("điện thoại")).toBeNull();
    expect(timMon("")).toBeNull();
    expect(timMon(null)).toBeNull();
  });

  it("boDau bỏ dấu và chữ hoa", () => {
    expect(boDau("Đồng Xu BẬT")).toBe("dong xu bat");
  });
});

describe("hàm vẽ", () => {
  it("nghieng giới hạn ±2°", () => {
    expect(nghieng(8)).toBe(2);
    expect(nghieng(-14)).toBe(-2);
    expect(nghieng(1.5)).toBe(1.5);
  });

  it("socChuNhat: mọi đầu mút nằm trong hình chữ nhật", () => {
    const [x, y, w, h] = [10, 20, 34, 24];
    const d = socChuNhat(x, y, w, h, 6);
    const so = Array.from(d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)).map((m) => [Number(m[1]), Number(m[2])]);
    expect(so.length).toBeGreaterThan(4);
    for (const [px, py] of so) {
      expect(px).toBeGreaterThanOrEqual(x - 0.01);
      expect(px).toBeLessThanOrEqual(x + w + 0.01);
      expect(py).toBeGreaterThanOrEqual(y - 0.01);
      expect(py).toBeLessThanOrEqual(y + h + 0.01);
    }
  });

  it("socTron: mọi đầu mút nằm trong hình tròn", () => {
    const d = socTron(32, 32, 26, 5.5);
    const so = Array.from(d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)).map((m) => [Number(m[1]), Number(m[2])]);
    expect(so.length).toBeGreaterThan(4);
    for (const [px, py] of so) expect(Math.hypot(px - 32, py - 32)).toBeLessThanOrEqual(26.02);
  });

  it("lịch minh hoạ: 16 khối, 8 BẬT, 8 TẮT", () => {
    expect(LICH_MINH_HOA).toHaveLength(16);
    expect(demLich(LICH_MINH_HOA)).toEqual({ bat: 8, tat: 8 });
  });
});

describe("đồng xu", () => {
  it("đổi mặt thì có mặt cũ khép lại và mặt mới mở ra, nhãn đọc theo mặt mới", () => {
    const { container, rerender } = render(<DongXu mat="bat" />);
    const xu = container.querySelector(".mh-xu");
    expect(xu?.getAttribute("aria-label")).toBe("Đồng xu: khối BẬT");
    expect(container.querySelector(".mh-xu-ra")).toBeNull();
    rerender(<DongXu mat="tat" />);
    expect(container.querySelector(".mh-xu")?.getAttribute("aria-label")).toBe("Đồng xu: khối TẮT");
    expect(container.querySelector(".mh-xu-ra")).not.toBeNull();
    expect(container.querySelector(".mh-xu-vao")).not.toBeNull();
    expect(container.querySelector(".mh-xu")?.getAttribute("data-mat")).toBe("tat");
  });

  it("dải 16 khối lật lần lượt rồi báo 8 BẬT · 8 TẮT", () => {
    vi.useFakeTimers();
    const xong = vi.fn();
    const { container } = render(<DaiDongXu buocMs={100} choKhiThay={false} onXong={xong} />);
    const o = () => Array.from(container.querySelectorAll(".mh-dai-o"));
    expect(o()).toHaveLength(16);
    expect(o().filter((x) => x.getAttribute("data-mat") !== "chua")).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(o().filter((x) => x.getAttribute("data-mat") !== "chua")).toHaveLength(5);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(o().filter((x) => x.getAttribute("data-mat") !== "chua")).toHaveLength(16);
    expect(container.textContent).toContain("8 khối BẬT · 8 khối TẮT");
    expect(container.textContent).toContain("BẬT: ghim món theo lịch");
    expect(container.textContent).toContain("TẮT: đội làm như thường");
    expect(xong).toHaveBeenCalledTimes(1);
  });

  it("giảm chuyển động: dải hiện ngay cả lịch, không chờ", () => {
    const traLai = caiMatchMedia(true);
    try {
      const { container } = render(<DaiDongXu choKhiThay={false} />);
      expect(Array.from(container.querySelectorAll(".mh-dai-o")).filter((x) => x.getAttribute("data-mat") !== "chua")).toHaveLength(16);
    } finally {
      traLai();
    }
  });

  it("nút Tung lại cao 44 px theo lớp mh-nut và không nằm trong phần tử bị xoay", () => {
    const { getByRole } = render(<DaiDongXu choKhiThay={false} nutTungLai />);
    const nut = getByRole("button", { name: "Tung lại" });
    expect(nut.className).toContain("mh-nut");
    let el: HTMLElement | null = nut;
    while (el) {
      expect(el.style.rotate ?? "").toBe("");
      expect(el.getAttribute("transform") ?? "").not.toMatch(/rotate/);
      el = el.parentElement;
    }
  });
});

describe("biểu tượng điều hướng", () => {
  it("sáu biểu tượng mà DIEU_HUONG của nền dùng vẫn có; cấu hình nhãn và đường dẫn không còn trùng ở minh-hoa", async () => {
    const minhHoa = await import("@/components/minh-hoa");
    expect("MUC_DIEU_HUONG" in minhHoa).toBe(false);
    for (const Icon of [Icons.IconGioiThieu, Icons.IconTongQuan, Icons.IconPhienLive, Icons.IconPhatLai, Icons.IconMinhHoa, Icons.IconQuanTri]) {
      const { container, unmount } = render(<Icon size={24} />);
      expect(container.querySelector("svg")?.getAttribute("width")).toBe("24");
      unmount();
    }
  });
});

describe("bảng màu hình", () => {
  it("MAU_HINH là tên mới; MAU chỉ còn là bí danh cũ; màu D-026 đúng", () => {
    expect(MAU).toBe(MAU_HINH);
    expect(MAU_HINH.bat).toBe("#3d6b4f");
    expect(MAU_HINH.tat).toBe("#8a8f98");
    expect(MAU_HINH.nguoiXem).toBe("#2f74b5");
    expect(MAU_HINH.luotNhap).toBe("#c8691c");
    expect(MAU_HINH.don).toBe("#9b4fb0");
  });
});

describe("DienThoaiKhoi: chip khối nằm ngoài màn hình của khách", () => {
  it.each(["bat", "tat"] as const)("khối %s: chip B/T nằm bên phải thân máy, không đè lên màn hình", (khoi) => {
    const { container } = render(<DienThoaiKhoi khoi={khoi} />);
    const chip = container.querySelector("[data-chip-khoi]");
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toBe(khoi === "bat" ? "B" : "T");
    // màn hình của khách: x 34..118 trong hệ toạ độ của thân máy; chip đặt từ x ≥ 128 (ngoài thân máy)
    const x = Number(chip?.querySelector("rect")?.getAttribute("x"));
    expect(x).toBeGreaterThanOrEqual(128);
  });
});

describe("tệp nguồn minh-hoa", () => {
  it("không chứa dấu gạch dài, không chữ cấm của canon", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const thuMuc = path.resolve(__dirname, "..");
    for (const ten of fs.readdirSync(thuMuc)) {
      if (!/\.(tsx?|css)$/.test(ten)) continue;
      const van = fs.readFileSync(path.join(thuMuc, ten), "utf8");
      expect(van.includes("—"), ten).toBe(false);
      expect(van, ten).not.toMatch(/khúc|khoá lịch|khóa|hóa|xóa|minh họa/);
    }
  });
});
