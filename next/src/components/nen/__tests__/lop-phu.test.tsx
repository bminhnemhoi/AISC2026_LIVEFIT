import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Hop, NganKeo, useXacNhan } from "@/components/nen";
import { soLopPhuDangMo } from "@/components/nen/lop-phu";

function NganThu({ onDong = () => {} }: { onDong?: () => void }): React.ReactElement {
  const [mo, setMo] = useState(false);
  return (
    <div data-testid="trang">
      <button type="button" onClick={() => setMo(true)}>
        Mở giải thích
      </button>
      <NganKeo
        mo={mo}
        onDong={() => {
          onDong();
          setMo(false);
        }}
        tieuDe="Máy ghim thế nào"
        moTa="Bốn bước, từ tung đồng xu tới kết luận"
        chanTrang={<button type="button">Đã hiểu</button>}
      >
        <p>thân ngăn kéo</p>
        <button type="button">Bước tiếp</button>
      </NganKeo>
    </div>
  );
}

describe("NganKeo", () => {
  it("đóng thì không dựng gì; mở thì là hộp thoại có tên, mô tả, tiêu điểm nằm trong", () => {
    render(<NganThu />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const mo = screen.getByRole("button", { name: "Mở giải thích" });
    mo.focus();
    fireEvent.click(mo);
    const hop = screen.getByRole("dialog", { name: "Máy ghim thế nào" });
    expect(hop).toHaveAttribute("aria-modal", "true");
    expect(hop).toHaveAccessibleDescription("Bốn bước, từ tung đồng xu tới kết luận");
    expect(hop.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole("button", { name: "Đóng" })).toBe(document.activeElement);
    expect(document.body.style.overflow).toBe("hidden");
    // phía sau bị làm trơ
    expect(screen.getByTestId("trang").closest("[inert]")).not.toBeNull();
  });

  it("Esc đóng, trả tiêu điểm về nút đã mở, gỡ inert và khoá cuộn", () => {
    const dong = vi.fn();
    render(<NganThu onDong={dong} />);
    const mo = screen.getByRole("button", { name: "Mở giải thích" });
    mo.focus();
    fireEvent.click(mo);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dong).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(mo);
    expect(document.querySelector("[inert]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(soLopPhuDangMo()).toBe(0);
  });

  it("Tab vòng trong ngăn kéo; chạm nền thì đóng, chạm trong thì không", () => {
    const dong = vi.fn();
    render(<NganThu onDong={dong} />);
    fireEvent.click(screen.getByRole("button", { name: "Mở giải thích" }));
    const cuoi = screen.getByRole("button", { name: "Đã hiểu" });
    cuoi.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Đóng" }));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cuoi);
    fireEvent.mouseDown(screen.getByText("thân ngăn kéo"));
    expect(dong).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.querySelector(".nen-lop-phu") as Element);
    expect(dong).toHaveBeenCalledTimes(1);
  });

  it("khoaDong: Esc, nền và nút Đóng đều không đóng", () => {
    const dong = vi.fn();
    render(
      <NganKeo mo onDong={dong} tieuDe="Đang lưu" khoaDong phia="duoi" rong={480}>
        <p>x</p>
      </NganKeo>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(document.querySelector(".nen-lop-phu") as Element);
    expect(screen.getByRole("button", { name: "Đóng" })).toBeDisabled();
    expect(dong).not.toHaveBeenCalled();
    expect(document.querySelector(".nen-lop-phu")).toHaveAttribute("data-phia", "duoi");
    expect((document.querySelector(".nen-ngan") as HTMLElement).style.getPropertyValue("--n-rong-ngan")).toBe("480px");
  });
});

describe("Hop", () => {
  it("hai nút cao 48; Huỷ gọi onDong; Đồng ý gọi onXacNhan", () => {
    const dong = vi.fn();
    const xn = vi.fn();
    render(<Hop mo onDong={dong} onXacNhan={xn} tieuDe="Bắt đầu phiên?" moTa="Lịch sẽ được niêm phong." />);
    const hop = screen.getByRole("dialog", { name: "Bắt đầu phiên?" });
    expect(hop).toHaveAccessibleDescription("Lịch sẽ được niêm phong.");
    const huy = screen.getByRole("button", { name: "Huỷ" });
    const dongY = screen.getByRole("button", { name: "Đồng ý" });
    expect(huy).toHaveAttribute("data-cao", "48");
    expect(dongY).toHaveAttribute("data-cao", "48");
    expect(dongY).toHaveAttribute("data-bien", "chinh");
    // không nguy hiểm: tiêu điểm vào nút xác nhận
    expect(document.activeElement).toBe(dongY);
    fireEvent.click(huy);
    expect(dong).toHaveBeenCalledTimes(1);
    fireEvent.click(dongY);
    expect(xn).toHaveBeenCalledTimes(1);
  });

  it("nguy hiểm: role alertdialog, tiêu điểm đầu ở nút Huỷ, chữ nút do trang đặt", () => {
    render(
      <Hop mo onDong={() => {}} onXacNhan={() => {}} tieuDe="Kết thúc phiên?" nutXacNhan="Kết thúc phiên" nguyHiem />,
    );
    expect(screen.getByRole("alertdialog", { name: "Kết thúc phiên?" })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Huỷ" }));
    expect(screen.getByRole("button", { name: "Kết thúc phiên" })).toBeInTheDocument();
  });

  it("onXacNhan trả Promise: khoá hai nút và Esc cho tới khi xong", async () => {
    let xong: () => void = () => {};
    const dong = vi.fn();
    render(
      <Hop
        mo
        onDong={dong}
        onXacNhan={() => new Promise<void>((r) => (xong = r))}
        tieuDe="Gửi?"
        nutXacNhan="Gửi"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(screen.getByRole("button", { name: "Gửi" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dong).not.toHaveBeenCalled();
    await act(async () => {
      xong();
    });
    expect(screen.getByRole("button", { name: "Gửi" })).not.toHaveAttribute("aria-busy");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dong).toHaveBeenCalledTimes(1);
  });

  it("nutHuy=null: hộp chỉ báo tin, một nút, bấm thì đóng", () => {
    const dong = vi.fn();
    render(<Hop mo onDong={dong} tieuDe="Đã lưu" nutHuy={null} nutXacNhan="Xong" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Xong" }));
    expect(dong).toHaveBeenCalledTimes(1);
  });

  it("chồng lớp: Esc chỉ đóng lớp trên cùng", () => {
    const dongNgan = vi.fn();
    const dongHop = vi.fn();
    render(
      <>
        <NganKeo mo onDong={dongNgan} tieuDe="Ngăn">
          <p>x</p>
        </NganKeo>
        <Hop mo onDong={dongHop} tieuDe="Hộp" />
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dongHop).toHaveBeenCalledTimes(1);
    expect(dongNgan).not.toHaveBeenCalled();
  });
});

describe("useXacNhan thay window.confirm", () => {
  function Trang({ ketQua }: { ketQua: (v: boolean) => void }): React.ReactElement {
    const { hoi, hop } = useXacNhan();
    return (
      <>
        <button
          type="button"
          onClick={async () => ketQua(await hoi({ tieuDe: "Xoá phiên?", nutXacNhan: "Xoá", nguyHiem: true }))}
        >
          Xoá phiên
        </button>
        {hop}
      </>
    );
  }

  it("Xoá → true; Huỷ → false; Esc → false", async () => {
    const ketQua = vi.fn();
    render(<Trang ketQua={ketQua} />);
    const mo = screen.getByRole("button", { name: "Xoá phiên" });

    fireEvent.click(mo);
    expect(screen.getByRole("alertdialog", { name: "Xoá phiên?" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    });
    expect(ketQua).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(mo);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    });
    expect(ketQua).toHaveBeenLastCalledWith(false);

    fireEvent.click(mo);
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(ketQua).toHaveBeenLastCalledWith(false);
    expect(ketQua).toHaveBeenCalledTimes(3);
  });
});
