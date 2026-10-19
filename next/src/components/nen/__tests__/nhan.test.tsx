import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  NhanCongBo,
  NhanNguon,
  chonCanh,
  chuNhanCongBo,
  chuNhanNguon,
  nghiaNhanNguon,
  rongBongNghia,
} from "@/components/nen";
import {
  MA_NHAN_CONG_BO,
  MA_NHAN_NGUON,
  NHAN_CONG_BO,
  NHAN_CONG_BO_THEO_MA,
  NHAN_NGUON,
  NHAN_NGUON_THEO_MA,
  type MaNhanNguon,
} from "@/lib/tu-ngu";

describe("NhanNguon: chữ và nghĩa lấy từ canon", () => {
  it.each(NHAN_NGUON.map((n) => [n.id, n.hien_thi, n.nghia] as const))("%s", (ma, hienThi, nghia) => {
    const { container, unmount } = render(<NhanNguon ma={ma} />);
    const nut = screen.getByRole("button", { name: `Nhãn nguồn: ${hienThi}` });
    const id = nut.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    const bong = container.querySelector(`[id="${id}"]`);
    expect(bong).toHaveAttribute("role", "tooltip");
    expect(bong?.textContent).toBe(`${hienThi}: ${nghia}`);
    // trình đọc màn hình nhận câu nghĩa làm mô tả của nút
    expect(nut).toHaveAccessibleDescription(`${hienThi}: ${nghia}`);
    expect(container.querySelector("[data-nhan-nguon]")).toHaveAttribute("data-nhan-nguon", ma);
    unmount();
  });

  it("nhiều mã: chip nối bằng dấu chấm giữa, mỗi mã một dòng nghĩa", () => {
    expect(chuNhanNguon(["DAN_DUNG", "THU_NOI_BO"])).toBe("DÀN DỰNG · THỬ NỘI BỘ");
    expect(nghiaNhanNguon(["DAN_DUNG", "THU_NOI_BO"]).map((d) => d.ten)).toEqual(["DÀN DỰNG", "THỬ NỘI BỘ"]);
    render(<NhanNguon ma={["DAN_DUNG", "THU_NOI_BO"]} />);
    expect(screen.getByRole("button", { name: "Nhãn nguồn: DÀN DỰNG · THỬ NỘI BỘ" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip", { hidden: true }).querySelectorAll(".nen-bong-nghia__dong")).toHaveLength(2);
  });

  it("mã lạ hoặc rỗng thì ném lỗi (không hiện nhãn sai)", () => {
    expect(() => chuNhanNguon("SIMULATED" as MaNhanNguon)).toThrow(/không có trong thuat-ngu.yaml/);
    expect(() => chuNhanNguon([])).toThrow(/ít nhất một mã/);
  });

  it("chạm/bấm thì ghim mở; bấm lại thì đóng; chạm ra ngoài thì đóng", () => {
    const { container } = render(
      <div>
        <NhanNguon ma="MO_PHONG" />
        <p data-testid="ngoai">chữ khác</p>
      </div>,
    );
    const goc = container.querySelector(".nen-nhan-nguon") as HTMLElement;
    const nut = screen.getByRole("button", { name: /MÔ PHỎNG/ });
    expect(goc).not.toHaveAttribute("data-mo");
    fireEvent.click(nut);
    expect(goc).toHaveAttribute("data-mo", "1");
    fireEvent.click(nut);
    expect(goc).not.toHaveAttribute("data-mo");
    fireEvent.click(nut);
    fireEvent.pointerDown(screen.getByTestId("ngoai"));
    expect(goc).not.toHaveAttribute("data-mo");
  });

  it("Esc ẩn câu nghĩa trước (WCAG 1.4.13) và không cho Esc đi tiếp lần đầu", () => {
    const ngoai = vi.fn();
    const { container } = render(
      <div onKeyDown={(e) => e.key === "Escape" && ngoai()}>
        <NhanNguon ma="THAT" />
      </div>,
    );
    const goc = container.querySelector(".nen-nhan-nguon") as HTMLElement;
    const nut = screen.getByRole("button", { name: /THẬT/ });
    fireEvent.click(nut);
    fireEvent.keyDown(nut, { key: "Escape" });
    expect(goc).not.toHaveAttribute("data-mo");
    expect(goc).toHaveAttribute("data-an", "1");
    expect(ngoai).not.toHaveBeenCalled();
    // lần Esc thứ hai đi tiếp (ví dụ để đóng hộp thoại bao ngoài)
    fireEvent.keyDown(nut, { key: "Escape" });
    expect(ngoai).toHaveBeenCalledTimes(1);
    // rời chuột thì lần sau rê vào lại thấy
    fireEvent.mouseLeave(goc);
    expect(goc).not.toHaveAttribute("data-an");
  });

  it("chonCanh: giữ phía ưa thích nếu vừa, sát mép thì đổi phía, không vừa cả hai thì chọn phía rộng hơn", () => {
    expect(rongBongNghia(1280)).toBe(320);
    expect(rongBongNghia(390)).toBe(320);
    expect(rongBongNghia(300)).toBe(268);
    // màn 1280: nhãn ở giữa vừa cả hai phía
    expect(chonCanh(600, 700, 1280, "trai")).toBe("trai");
    expect(chonCanh(600, 700, 1280, "phai")).toBe("phai");
    // sát mép phải: mở về trái
    expect(chonCanh(1100, 1200, 1280, "trai")).toBe("phai");
    // sát mép trái: mở về phải
    expect(chonCanh(20, 120, 1280, "phai")).toBe("trai");
    // điện thoại 390: nhãn ở giữa, không phía nào đủ 320 px, chọn phía rộng hơn
    expect(chonCanh(150, 250, 390, "trai")).toBe("phai");
    expect(chonCanh(100, 200, 390, "phai")).toBe("trai");
  });

  it("rê chuột vào nhãn sát mép phải thì đổi phía mở", () => {
    const { container } = render(<NhanNguon ma="MO_PHONG" />);
    const goc = container.querySelector(".nen-nhan-nguon") as HTMLElement;
    goc.getBoundingClientRect = () => ({ left: 1180, right: 1260, top: 0, bottom: 44, width: 80, height: 44, x: 1180, y: 0, toJSON: () => ({}) });
    const cu = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    expect(goc).toHaveAttribute("data-canh", "trai");
    fireEvent.mouseEnter(goc);
    expect(goc).toHaveAttribute("data-canh", "phai");
    Object.defineProperty(window, "innerWidth", { value: cu, configurable: true });
  });

  it("canh phải và dạng tĩnh (chỉ chip, nghĩa ở title)", () => {
    const { container } = render(
      <>
        <NhanNguon ma="QUAN_SAT" canh="phai" />
        <NhanNguon ma="MINH_HOA" tinh />
      </>,
    );
    const [mot, hai] = Array.from(container.querySelectorAll(".nen-nhan-nguon"));
    expect(mot).toHaveAttribute("data-canh", "phai");
    expect(hai.querySelector("button")).toBeNull();
    expect(hai.querySelector(".nen-chip")).toHaveAttribute("title", `MINH HOẠ: ${NHAN_NGUON_THEO_MA.MINH_HOA.nghia}`);
  });

  it("sắc chip: THẬT đậm, nhóm dàn dựng vàng, MÔ PHỎNG tím, không nhãn nào dùng xanh BẬT hay đỏ gạch", () => {
    const tone = (ma: MaNhanNguon): string | null => {
      const { container, unmount } = render(<NhanNguon ma={ma} />);
      const t = container.querySelector(".nen-chip")?.getAttribute("data-tone") ?? null;
      unmount();
      return t;
    };
    expect(tone("THAT")).toBe("dam");
    expect(tone("DAN_DUNG")).toBe("vang");
    expect(tone("THU_NOI_BO")).toBe("vang");
    expect(tone("MO_PHONG")).toBe("tim");
    for (const ma of MA_NHAN_NGUON) expect(["bat", "gach"]).not.toContain(tone(ma));
  });
});

describe("NhanCongBo", () => {
  it.each(NHAN_CONG_BO.map((n) => [n.id, n.hien_thi] as const))("%s hiện đúng chữ canon", (ma, hienThi) => {
    const { container, unmount } = render(<NhanCongBo ma={ma} />);
    const nhan = container.querySelector(`[data-nhan-cong-bo="${ma}"]`);
    expect(nhan?.textContent).toBe(hienThi);
    expect(chuNhanCongBo(ma)).toBe(hienThi);
    // không bấm được, không đóng được
    expect(container.querySelector("button")).toBeNull();
    unmount();
  });

  it("đúng ba nhãn, chữ đúng như D-015/D-022/D-023", () => {
    expect([...MA_NHAN_CONG_BO]).toEqual(["NGUOI_DAN_AI", "MAY_CHEP_LOI", "CHUA_XAC_MINH"]);
    expect(chuNhanCongBo("NGUOI_DAN_AI")).toBe("NGƯỜI DẪN AI · GIỌNG TỔNG HỢP");
    expect(chuNhanCongBo("MAY_CHEP_LOI")).toBe("MÁY CHÉP LỜI");
    expect(chuNhanCongBo("CHUA_XAC_MINH")).toBe("DÀN DỰNG · CHƯA XÁC MINH");
  });

  it("người dẫn AI mặc định nổi trên video; nhãn khác mặc định phẳng; hienNghia thêm câu nghĩa", () => {
    const { container } = render(
      <>
        <NhanCongBo ma="NGUOI_DAN_AI" />
        <NhanCongBo ma="MAY_CHEP_LOI" hienNghia />
        <NhanCongBo ma="CHUA_XAC_MINH" kieu="noi" />
      </>,
    );
    expect(container.querySelector('[data-nhan-cong-bo="NGUOI_DAN_AI"]')).toHaveAttribute("data-kieu", "noi");
    expect(container.querySelector('[data-nhan-cong-bo="MAY_CHEP_LOI"]')).toHaveAttribute("data-kieu", "phang");
    expect(container.querySelector('[data-nhan-cong-bo="CHUA_XAC_MINH"]')).toHaveAttribute("data-kieu", "noi");
    expect(container.querySelector(".nen-cong-bo__nghia")?.textContent).toBe(NHAN_CONG_BO_THEO_MA.MAY_CHEP_LOI.nghia);
  });
});
