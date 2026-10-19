import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { NutBam, NutLienKet, caoNut } from "@/components/nen";

describe("NutBam", () => {
  it("mặc định là nút phụ, cao 44, type=button (không lỡ gửi biểu mẫu)", () => {
    const gui = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={gui}>
        <NutBam>Lưu</NutBam>
      </form>,
    );
    const nut = screen.getByRole("button", { name: "Lưu" });
    expect(nut).toHaveAttribute("type", "button");
    expect(nut).toHaveAttribute("data-bien", "phu");
    expect(nut).toHaveAttribute("data-cao", "44");
    expect(nut).toHaveClass("nen-nut", "nen-nut--phu");
    fireEvent.click(nut);
    expect(gui).not.toHaveBeenCalled();
  });

  it("nút chính cao 48; nút viền cao 44; cao truyền vào thắng để cùng nhóm cao bằng nhau", () => {
    render(
      <>
        <NutBam bien="chinh">Bắt đầu phiên</NutBam>
        <NutBam bien="vien">Huỷ</NutBam>
        <NutBam bien="vien" cao={48}>
          Để sau
        </NutBam>
      </>,
    );
    expect(screen.getByRole("button", { name: "Bắt đầu phiên" })).toHaveAttribute("data-cao", "48");
    expect(screen.getByRole("button", { name: "Huỷ" })).toHaveAttribute("data-cao", "44");
    expect(screen.getByRole("button", { name: "Để sau" })).toHaveAttribute("data-cao", "48");
    expect(caoNut()).toBe(44);
    expect(caoNut("chinh")).toBe(48);
    expect(caoNut("phu", 48)).toBe(48);
    // nút chính luôn 48 (luật hình mục 3); kiem_giao_dien.py nhận ra nó qua data-nut-chinh
    expect(caoNut("chinh", 44)).toBe(48);
    expect(screen.getByRole("button", { name: "Bắt đầu phiên" })).toHaveAttribute("data-nut-chinh");
    expect(screen.getByRole("button", { name: "Huỷ" })).not.toHaveAttribute("data-nut-chinh");
  });

  it("đang chạy: khoá, aria-busy, ba chấm thay biểu tượng, không gọi onClick", () => {
    const bam = vi.fn();
    render(
      <NutBam bien="chinh" dangChay onClick={bam} bieuTuong={<svg data-testid="bt" />}>
        Kết thúc phiên
      </NutBam>,
    );
    const nut = screen.getByRole("button", { name: "Kết thúc phiên" });
    expect(nut).toBeDisabled();
    expect(nut).toHaveAttribute("aria-busy", "true");
    expect(nut.querySelector(".nen-nut__cho")).not.toBeNull();
    expect(screen.queryByTestId("bt")).toBeNull();
    fireEvent.click(nut);
    expect(bam).not.toHaveBeenCalled();
  });

  it("biểu tượng nằm trước chữ; rong; chuyển ref và thuộc tính khác", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <NutBam ref={ref} rong bieuTuong={<svg data-testid="bt" />} aria-describedby="x" className="them">
        Ghim món của khối này
      </NutBam>,
    );
    const nut = screen.getByRole("button", { name: "Ghim món của khối này" });
    expect(ref.current).toBe(nut);
    expect(nut).toHaveAttribute("data-rong", "1");
    expect(nut).toHaveAttribute("aria-describedby", "x");
    expect(nut).toHaveClass("them");
    expect(nut.firstElementChild).toContainElement(screen.getByTestId("bt"));
  });
});

describe("NutLienKet", () => {
  it("là liên kết thật (giữ nút Lùi), mang cùng lớp và chiều cao", () => {
    render(
      <NutLienKet href="/phien" bien="chinh">
        Dùng thử bản demo
      </NutLienKet>,
    );
    const a = screen.getByRole("link", { name: "Dùng thử bản demo" });
    expect(a).toHaveAttribute("href", "/phien");
    expect(a).toHaveClass("nen-nut", "nen-nut--chinh");
    expect(a).toHaveAttribute("data-cao", "48");
    expect(a).toHaveAttribute("data-nut-chinh");
  });
});
