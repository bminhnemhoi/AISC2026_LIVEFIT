import React from "react";
import fs from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KET_LUAN_THEO_MA, timLoiChu } from "@/lib/tu-ngu";
import { BUOC_CO_CHE, CoChe, CoCheSvg, KET_LUAN_CO_CHE, boCucCoChe, ngatDong, toanBoChuCoChe } from "@/components/co-che";
import { xuatCoCheSvg } from "@/components/co-che/xuat";
import { NGHIENG_TOI_DA } from "@/components/minh-hoa";
import { chuCua, gocXoay, tuTiengAnh } from "@/components/minh-hoa/__tests__/kiem-chu";

const CAM_RIENG = /khúc|khoá lịch|khóa lịch|Ghim theo gợi ý|Thí nghiệm có bốc thăm|—/;

function kiemChu(el: Element) {
  const chu = chuCua(el);
  expect(chu).not.toMatch(CAM_RIENG);
  expect(timLoiChu(chu, { thuatNgu: true })).toEqual([]);
  expect(tuTiengAnh(chu)).toEqual([]);
  for (const g of gocXoay(el.innerHTML)) expect(Math.abs(g)).toBeLessThanOrEqual(NGHIENG_TOI_DA);
}

describe("nội dung CoChe", () => {
  it("đủ 4 bước đúng thứ tự của kế hoạch mục 3", () => {
    expect(BUOC_CO_CHE.map((b) => b.so)).toEqual([1, 2, 3, 4]);
    const [b1, b2, b3, b4] = BUOC_CO_CHE;
    expect(b1.tieuDe).toMatch(/đồng xu/);
    expect(b1.tieuDe).toMatch(/niêm phong lịch/);
    expect(b1.phuDe).toContain("khoá bằng mã băm trước giờ live, không ai sửa lén được");
    expect(b2.tieuDe).toMatch(/^Khối BẬT/);
    expect(b2.cau).toContain("món đứng đầu nhóm gợi ý");
    expect(b2.cau).toContain("bốc thăm");
    expect(b2.cau).toContain("có thể khác thẻ gợi ý");
    expect(b3.tieuDe).toMatch(/^Khối TẮT: LiveLift để yên/);
    expect(b3.cau).toContain("có thể vẫn hiện");
    expect(b4.cau).toContain("lượt nhấp theo từng khối");
    expect(b4.cau).toContain("Hết phiên mới so");
    expect(b4.phuDe).toBe("Tỷ lệ nhấp: lượt nhấp hợp lệ / 1.000 giây·người xem.");
  });

  it("ba kết luận ĐỔI / GIỮ / ĐO THÊM, mỗi chữ kèm một câu thường", () => {
    expect(KET_LUAN_CO_CHE.map((k) => k.chu)).toEqual(["ĐỔI", "GIỮ", "ĐO THÊM"]);
    for (const k of KET_LUAN_CO_CHE) expect(k.cau.length).toBeGreaterThan(10);
    // một bộ câu: CoChe dẫn xuất từ canon ket_luan, không tự viết câu riêng (mục 11 soát đợt 1)
    for (const k of KET_LUAN_CO_CHE) {
      expect(k.chu).toBe(KET_LUAN_THEO_MA[k.id].chu);
      expect(k.cau).toBe(KET_LUAN_THEO_MA[k.id].cau);
      expect(`${k.dieuKien}: ${k.loiKhuyen}`).toBe(k.cau);
    }
    // tiêu đề bước 2 trung tính: không nói máy ghim (TikTok và Facebook ghim tay); dòng chân vẫn là cau_ghim
    expect(BUOC_CO_CHE[1].tieuDe).toBe("Khối BẬT: ghim món đầu nhóm gợi ý");
    expect(BUOC_CO_CHE[1].tieuDe).not.toMatch(/máy/i);
  });

  it("toàn bộ chữ không có chữ cấm canon, không 'khúc', không 'khoá lịch', không dấu gạch dài", () => {
    const chu = toanBoChuCoChe();
    expect(chu).not.toMatch(CAM_RIENG);
    expect(timLoiChu(chu, { thuatNgu: true })).toEqual([]);
    expect(tuTiengAnh(chu)).toEqual([]);
  });

  it("ngatDong ngắt theo khoảng trắng, không dòng nào dài quá (trừ một từ quá dài)", () => {
    expect(ngatDong("một hai ba bốn năm", 7)).toEqual(["một hai", "ba bốn", "năm"]);
    expect(ngatDong("  ", 10)).toEqual([]);
    expect(ngatDong("sieu-dai-khong-ngat x", 5)).toEqual(["sieu-dai-khong-ngat", "x"]);
    for (const b of BUOC_CO_CHE) for (const d of ngatDong(b.cau, 31)) expect(d.length).toBeLessThanOrEqual(31);
  });
});

describe.each(["trang", "ngan"] as const)("CoChe biến thể %s", (bienThe) => {
  it("có đủ 4 bước, tiêu đề, ba kết luận, chip MINH HOẠ và câu ghim ở đâu", () => {
    const { container } = render(<CoChe bienThe={bienThe} />);
    const buoc = container.querySelectorAll(".cc-the");
    expect(buoc).toHaveLength(4);
    BUOC_CO_CHE.forEach((b, i) => {
      expect(buoc[i].getAttribute("data-buoc")).toBe(String(b.so));
      expect(within(buoc[i] as HTMLElement).getByText(b.tieuDe)).toBeInTheDocument();
      expect(within(buoc[i] as HTMLElement).getByText(b.cau)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { level: 2, name: "Ghim được đo thế nào: 4 bước" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    for (const k of KET_LUAN_CO_CHE) expect(screen.getByText(k.chu)).toBeInTheDocument();
    expect(screen.getByText("MINH HOẠ")).toBeInTheDocument();
    expect(container.textContent).toContain("ghim tay theo thẻ lịch");
    expect(container.querySelector(`[data-co-che="${bienThe}"]`)).not.toBeNull();
    kiemChu(container);
  });

  it("hình của bước chỉ để trang trí (aria-hidden), không nút nào nằm trong phần tử bị xoay", () => {
    const { container } = render(<CoChe bienThe={bienThe} />);
    for (const h of Array.from(container.querySelectorAll(".cc-hinh"))) expect(h.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("CoChe chuyển động", () => {
  it("trang: đồng xu bước 1 lật BẬT → TẮT → BẬT rồi dừng (dưới 5 giây)", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<CoChe bienThe="trang" />);
      const mat = () => container.querySelector(".cc-hinh-xu .mh-xu")?.getAttribute("data-mat");
      expect(mat()).toBe("bat");
      act(() => {
        vi.advanceTimersByTime(1800);
      });
      expect(mat()).toBe("tat");
      act(() => {
        vi.advanceTimersByTime(1800);
      });
      expect(mat()).toBe("bat");
      act(() => {
        vi.advanceTimersByTime(20000);
      });
      expect(mat()).toBe("bat");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ngan: hình tĩnh, đồng xu không lật, điện thoại khối BẬT không có lớp chuyển động", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<CoChe bienThe="ngan" />);
      expect(container.querySelector(".mh-dong")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(container.querySelector(".cc-hinh-xu .mh-xu")?.getAttribute("data-mat")).toBe("bat");
    } finally {
      vi.useRealTimers();
    }
  });

  it("css minh-hoa: hình động trang trí chạy hữu hạn, có khối giảm chuyển động", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../minh-hoa/minh-hoa.css"), "utf8");
    expect(css).not.toMatch(/infinite/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});

describe("CoChe tuỳ chọn", () => {
  it("ẩn tiêu đề, chip và câu ghim khi được yêu cầu; vùng vẫn có nhãn đọc", () => {
    const { container } = render(<CoChe bienThe="ngan" tieuDe={null} nhan={null} ghiChuGhim={false} />);
    expect(container.querySelector(".cc-tieu-de")).toBeNull();
    expect(container.textContent).not.toContain("MINH HOẠ");
    expect(container.textContent).not.toContain("ghim tay theo thẻ lịch");
    expect(screen.getByRole("region", { name: "Ghim được đo thế nào: 4 bước" })).toBeInTheDocument();
  });

  it("nhan theo mã canon; chữ ngoài canon bị bỏ (cả bản SVG)", () => {
    const { container, rerender } = render(<CoChe bienThe="ngan" nhan="MO_PHONG" />);
    expect(container.querySelector("[data-nhan-nguon]")?.getAttribute("data-nhan-nguon")).toBe("MO_PHONG");
    rerender(<CoChe bienThe="ngan" nhan="SIMULATED" />);
    expect(container.querySelector("[data-nhan-nguon]")).toBeNull();
    expect(container.textContent).not.toContain("SIMULATED");
    expect(xuatCoCheSvg("ngang", "SIMULATED")).not.toContain("SIMULATED");
    expect(xuatCoCheSvg("ngang", "MINH HOẠ")).toContain(">MINH HOẠ<");
  });

  it("trang có câu dẫn, ngan thì không (trừ khi truyền)", () => {
    const { container: a } = render(<CoChe bienThe="trang" />);
    expect(a.querySelector(".cc-cau-dan")?.textContent).toContain("Ghim món này, khách có bấm mua nhiều hơn không?");
    const { container: b } = render(<CoChe bienThe="ngan" />);
    expect(b.querySelector(".cc-cau-dan")).toBeNull();
    const { container: c } = render(<CoChe bienThe="ngan" cauDan="Câu riêng." />);
    expect(c.querySelector(".cc-cau-dan")?.textContent).toBe("Câu riêng.");
  });

  it("tiêu đề h3 thì tiêu đề bước là h4", () => {
    render(<CoChe bienThe="ngan" the="h3" />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(4);
  });
});

describe("CoChe biến thể buoc (wizard)", () => {
  it("đi hết 4 bước bằng Tiếp / Quay lại; bước cuối gọi onXong", () => {
    const xong = vi.fn();
    const doi = vi.fn();
    const { container } = render(<CoChe bienThe="buoc" onXong={xong} onDoiBuoc={doi} />);
    kiemChu(container);
    const quayLai = screen.getByRole("button", { name: "Quay lại" });
    expect(quayLai).toBeDisabled();
    expect(screen.getByText("Bước 1/4")).toBeInTheDocument();
    expect(screen.getByText(BUOC_CO_CHE[0].tieuDe)).toBeInTheDocument();
    for (let i = 1; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Tiếp" }));
      expect(screen.getByText(`Bước ${i + 1}/4`)).toBeInTheDocument();
      expect(screen.getByText(BUOC_CO_CHE[i].tieuDe)).toBeInTheDocument();
      expect(doi).toHaveBeenLastCalledWith(i);
    }
    expect(screen.queryByRole("button", { name: "Tiếp" })).toBeNull();
    for (const k of KET_LUAN_CO_CHE) expect(screen.getByText(k.chu)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đã hiểu" }));
    expect(xong).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(screen.getByText("Bước 3/4")).toBeInTheDocument();
    // tiêu điểm về nội dung bước mới
    expect(document.activeElement?.classList.contains("cc-wizard-buoc")).toBe(true);
    // bước hiện tại được đánh dấu
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain(BUOC_CO_CHE[2].tieuDe);
  });

  it("không có onXong thì bước cuối là nút Xem lại từ đầu", () => {
    render(<CoChe bienThe="buoc" buoc={3} />);
    expect(screen.getByText("Bước 4/4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem lại từ đầu" })).toBeInTheDocument();
  });

  it("điều khiển từ ngoài: prop buoc quyết định bước hiện, ngoài khoảng thì kẹp lại", () => {
    const doi = vi.fn();
    const { rerender } = render(<CoChe bienThe="buoc" buoc={1} onDoiBuoc={doi} />);
    expect(screen.getByText("Bước 2/4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp" }));
    expect(doi).toHaveBeenCalledWith(2);
    expect(screen.getByText("Bước 2/4")).toBeInTheDocument();
    rerender(<CoChe bienThe="buoc" buoc={9} onDoiBuoc={doi} />);
    expect(screen.getByText("Bước 4/4")).toBeInTheDocument();
  });

  it("nút của wizard dùng lớp cc-nut (48 px trong co-che.css), nút chính có lớp cc-nut-chinh", () => {
    render(<CoChe bienThe="buoc" />);
    expect(screen.getByRole("button", { name: "Quay lại" }).className).toBe("cc-nut");
    expect(screen.getByRole("button", { name: "Tiếp" }).className).toContain("cc-nut-chinh");
    const css = fs.readFileSync(path.resolve(__dirname, "../co-che.css"), "utf8");
    const khoi = css.slice(css.indexOf(".cc-nut {"), css.indexOf("}", css.indexOf(".cc-nut {")));
    expect(khoi).toMatch(/min-height:\s*48px/);
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).not.toMatch(/rotate/);
  });
});

describe("CoChe bản SVG tĩnh", () => {
  it.each(["ngang", "doc"] as const)("%s: SVG tự đủ, đủ 4 bước, không chữ cấm, không lớp CSS bắt buộc", (huong) => {
    const svg = xuatCoCheSvg(huong);
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).not.toMatch(/<(div|span|p|button|style|script)\b/);
    expect(svg).not.toMatch(/url\(#/);
    expect(svg).not.toMatch(CAM_RIENG);
    for (const b of BUOC_CO_CHE) expect(svg).toContain(`data-buoc="${b.so}"`);
    for (const k of KET_LUAN_CO_CHE) expect(svg).toContain(`>${k.chu}<`);
    expect(svg).toContain(">MINH HOẠ<");
    for (const g of gocXoay(svg)) expect(Math.abs(g)).toBeLessThanOrEqual(NGHIENG_TOI_DA);
    const { container } = render(<CoCheSvg huong={huong} />);
    kiemChu(container);
  });

  it("ngang là 1600 × 900; chữ nằm trong thẻ, thẻ và chân nằm trong khung", () => {
    const bc = boCucCoChe("ngang");
    expect([bc.rong, bc.cao]).toEqual([1600, 900]);
    for (const t of bc.the) {
      expect(t.x + t.rong).toBeLessThanOrEqual(bc.rong - 40);
      expect(t.chu.day).toBeLessThanOrEqual(t.y + t.cao);
      for (const d of t.chu.dong) expect(d.y).toBeLessThan(t.y + t.cao);
    }
    const yChan = Math.max(...bc.chan.map((d) => d.y));
    expect(yChan).toBeLessThan(bc.yChip + 32);
    expect(bc.yChip + 32).toBeLessThanOrEqual(bc.cao);
  });

  it("doc rộng 1000, các thẻ không chồng nhau, chữ nằm trong thẻ", () => {
    const bc = boCucCoChe("doc");
    expect(bc.rong).toBe(1000);
    for (let i = 0; i < bc.the.length; i++) {
      const t = bc.the[i];
      expect(t.chu.day).toBeLessThanOrEqual(t.y + t.cao);
      expect(t.hinh.y + t.hinh.cao).toBeLessThanOrEqual(t.y + t.cao);
      if (i > 0) expect(t.y).toBeGreaterThanOrEqual(bc.the[i - 1].y + bc.the[i - 1].cao);
    }
    expect(bc.yChip + 32).toBeLessThanOrEqual(bc.cao);
  });

  it("ghi tệp SVG khi có biến XUAT_CO_CHE_DIR (cho slide, poster, video)", () => {
    const thuMuc = process.env.XUAT_CO_CHE_DIR;
    if (!thuMuc) return;
    fs.mkdirSync(thuMuc, { recursive: true });
    for (const huong of ["ngang", "doc"] as const) fs.writeFileSync(path.join(thuMuc, `co-che-${huong}.svg`), xuatCoCheSvg(huong), "utf8");
    expect(fs.existsSync(path.join(thuMuc, "co-che-ngang.svg"))).toBe(true);
  });
});

describe("tệp nguồn co-che", () => {
  it("không chứa dấu gạch dài, 'khúc', 'khoá lịch', chính tả cũ", () => {
    const thuMuc = path.resolve(__dirname, "..");
    for (const ten of fs.readdirSync(thuMuc)) {
      if (!/\.(tsx?|css)$/.test(ten)) continue;
      const van = fs.readFileSync(path.join(thuMuc, ten), "utf8");
      expect(van.includes("—"), ten).toBe(false);
      expect(van, ten).not.toMatch(/khúc|khoá lịch|khóa|hóa|xóa|minh họa/);
    }
  });
});
