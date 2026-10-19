import { render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/phien" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

import {
  AppShell,
  DIEU_HUONG,
  TOI_DA_THANH_DUOI,
  Th,
  ThanhTren,
  OSo,
  laMucHienTai,
  mucDangMo,
  mucHien,
  type MucDieuHuong,
} from "@/components/nen";
import { TU, timLoiChu } from "@/lib/tu-ngu";

beforeEach(() => {
  nav.path = "/phien";
});

describe("dieu-huong.ts", () => {
  it("hôm nay chỉ hiện Giới thiệu và Phiên live; bốn mục còn lại để sẵn nhưng tắt", () => {
    expect(mucHien().map((m) => m.id)).toEqual(["gioi-thieu", "phien"]);
    expect(DIEU_HUONG.map((m) => m.id)).toEqual(["gioi-thieu", "tong-quan", "phien", "phat-lai", "minh-hoa", "quan-tri"]);
    expect(DIEU_HUONG.find((m) => m.id === "minh-hoa")?.href).toBe("/minh-hoa");
  });

  it("batThem bật mục chưa có trang; Quản trị chỉ hiện cho vai quản trị", () => {
    expect(mucHien({ batThem: ["tong-quan", "quan-tri"] }).map((m) => m.id)).toEqual(["gioi-thieu", "tong-quan", "phien"]);
    expect(mucHien({ batThem: ["quan-tri"], vai: "nguoi-ban" }).map((m) => m.id)).not.toContain("quan-tri");
    expect(mucHien({ batThem: ["quan-tri"], vai: "quan-tri" }).map((m) => m.id)).toContain("quan-tri");
  });

  it("so khớp đường dẫn theo ranh giới thư mục, bỏ query và dấu / cuối", () => {
    const phien = { href: "/phien" };
    expect(laMucHienTai(phien, "/phien")).toBe(true);
    expect(laMucHienTai(phien, "/phien/")).toBe(true);
    expect(laMucHienTai(phien, "/phien/abc/tong-ket?x=1")).toBe(true);
    expect(laMucHienTai(phien, "/phien-cu")).toBe(false);
    expect(laMucHienTai(phien, null)).toBe(false);
    const goc = { href: "/gioi-thieu", cungTrang: ["/"] };
    expect(laMucHienTai(goc, "/")).toBe(true);
    expect(laMucHienTai(goc, "/#doi")).toBe(true);
    expect(laMucHienTai(goc, "/xem/abc")).toBe(false);
  });

  it("mục khớp cụ thể hơn thắng", () => {
    const ds = [
      { id: "phien", href: "/phien" },
      { id: "tong-quan", href: "/phien/tong" },
    ] as unknown as MucDieuHuong[];
    expect(mucDangMo(ds, "/phien/tong/1")).toBe("tong-quan");
    expect(mucDangMo(ds, "/phien/1")).toBe("phien");
    expect(mucDangMo(ds, "/khac")).toBeNull();
  });

  it("chữ điều hướng sạch chữ cấm, chữ ngắn đủ ngắn cho thanh dưới, đủ chỗ cho 5 mục", () => {
    for (const m of DIEU_HUONG) {
      expect(timLoiChu(`${m.nhan} ${m.ngan}`, { thuatNgu: true })).toEqual([]);
      expect(m.ngan.length).toBeLessThanOrEqual(10);
    }
    expect(TOI_DA_THANH_DUOI).toBe(5);
  });
});

describe("AppShell", () => {
  it("có thanh trái, thanh dưới, thanh trên và vùng chính #main-content; mục đang mở có aria-current", () => {
    render(
      <AppShell tieuDe={TU.danhSachPhien.hien} phuDe="Mỗi phiên chia khối 5 phút" nhanNguon="MO_PHONG">
        <p>nội dung</p>
      </AppShell>,
    );
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveTextContent("nội dung");
    expect(screen.getByRole("heading", { level: 1, name: "Các phiên live đang đo hiệu quả ghim" })).toBeInTheDocument();

    const trai = within(screen.getByTestId("nen-thanh-trai")).getByRole("navigation", { name: "Điều hướng chính" });
    const links = within(trai).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/gioi-thieu", "/phien"]);
    expect(within(trai).getByRole("link", { name: "Phiên live" })).toHaveAttribute("aria-current", "page");
    expect(within(trai).getByRole("link", { name: "Giới thiệu" })).not.toHaveAttribute("aria-current");

    const duoi = screen.getByTestId("nen-thanh-duoi");
    expect(within(duoi).getByRole("link", { name: "Phiên live" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Nhãn nguồn: MÔ PHỎNG" })).toBeInTheDocument();
  });

  it("đường dẫn con vẫn sáng mục cha; hienTai ghi đè; thuGon đặt data-thu-gon", () => {
    nav.path = "/phien/abc/tong-ket";
    const { rerender } = render(
      <AppShell thuGon>
        <p>x</p>
      </AppShell>,
    );
    expect(screen.getByTestId("nen-app")).toHaveAttribute("data-thu-gon", "1");
    expect(screen.queryByTestId("nen-thanh-tren")).toBeNull();
    const trai = screen.getByTestId("nen-thanh-trai");
    expect(within(trai).getByRole("link", { name: "Phiên live" })).toHaveAttribute("aria-current", "page");
    rerender(
      <AppShell hienTai="gioi-thieu">
        <p>x</p>
      </AppShell>,
    );
    expect(within(trai).getByRole("link", { name: "Giới thiệu" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nen-app")).not.toHaveAttribute("data-thu-gon");
  });

  it("batThem và vai đi xuống cả hai thanh; thanh dưới không quá 5 mục", () => {
    render(
      <AppShell batThem={["tong-quan", "phat-lai", "minh-hoa", "quan-tri"]} vai="quan-tri">
        <p>x</p>
      </AppShell>,
    );
    expect(within(screen.getByTestId("nen-thanh-trai")).getAllByRole("link")).toHaveLength(1 + 6);
    expect(within(screen.getByTestId("nen-thanh-duoi")).getAllByRole("link")).toHaveLength(5);
  });

  it("đường dẫn null (dựng trên máy chủ) thì không mục nào sáng", () => {
    nav.path = null;
    render(
      <AppShell>
        <p>x</p>
      </AppShell>,
    );
    expect(screen.getByTestId("nen-thanh-trai").querySelector('[aria-current="page"]')).toBeNull();
  });
});

describe("ThanhTren", () => {
  it("ĐANG LIVE, nhãn nguồn, hành động; tiêu đề cấp 1 mặc định", () => {
    render(
      <ThanhTren
        tieuDe="Bàn thí nghiệm"
        live
        nhanNguon={["DAN_DUNG", "THU_NOI_BO"]}
        hanhDong={<button type="button">Kết thúc phiên</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Bàn thí nghiệm" })).toBeInTheDocument();
    expect(screen.getByText("ĐANG LIVE")).toHaveAttribute("data-live", "1");
    expect(screen.getByRole("button", { name: "Nhãn nguồn: DÀN DỰNG · THỬ NỘI BỘ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kết thúc phiên" })).toBeInTheDocument();
  });
});

describe("Th và OSo", () => {
  it("Th có tiêu đề thì là section được đặt tên; có nhãn nguồn và hành động ở đầu thẻ", () => {
    render(
      <Th tieuDe="Từ xem đến mua" phuDe="mỗi bước một con số" nhanNguon="MO_PHONG" hanhDong={<a href="/x">Xem</a>}>
        <p>thân</p>
      </Th>,
    );
    const the = screen.getByRole("region", { name: "Từ xem đến mua" });
    expect(the).toHaveClass("nen-the");
    expect(the).toHaveAttribute("data-dem", "vua");
    expect(within(the).getByRole("heading", { level: 2 })).toHaveTextContent("Từ xem đến mua");
    expect(within(the).getByText("mỗi bước một con số")).toBeInTheDocument();
    expect(within(the).getByRole("button", { name: "Nhãn nguồn: MÔ PHỎNG" })).toBeInTheDocument();
  });

  it("Th không tiêu đề là div; as và capTieuDe đổi được", () => {
    const { container, rerender } = render(<Th dem="nho">x</Th>);
    expect(container.firstElementChild?.tagName).toBe("DIV");
    expect(container.querySelector(".nen-the__dau")).toBeNull();
    rerender(
      <Th as="article" tieuDe="A" capTieuDe={3}>
        x
      </Th>,
    );
    expect(container.firstElementChild?.tagName).toBe("ARTICLE");
    expect(screen.getByRole("heading", { level: 3, name: "A" })).toBeInTheDocument();
  });

  it("OSo lấy nhãn và phụ đề từ canon khi truyền tu", () => {
    render(<OSo tu={TU.tyLeNhap} giaTri="12,4" nhanNguon="MO_PHONG" duongNho={<svg data-testid="dn" />} />);
    const o = screen.getByRole("group", { name: "Tỷ lệ nhấp" });
    expect(o).toHaveTextContent("12,4");
    expect(within(o).getByText("lượt nhấp hợp lệ / 1.000 giây·người xem")).toBeInTheDocument();
    expect(within(o).getByRole("button", { name: "Nhãn nguồn: MÔ PHỎNG" })).toBeInTheDocument();
    expect(within(o).getByTestId("dn").closest(".nen-oso__duong-nho")).not.toBeNull();
  });

  it("OSo: chưa có số, đơn vị, thay đổi có mũi tên và chữ (không chỉ bằng màu)", () => {
    const { container, rerender } = render(<OSo nhan="Người xem" giaTri={null} />);
    expect(container.querySelector(".nen-oso")).toHaveAttribute("data-trong", "1");
    expect(screen.getByText("Chưa có số")).toBeInTheDocument();
    rerender(
      <OSo
        nhan="Người xem"
        giaTri="1.284"
        donVi="người"
        phuDe="đang xem phiên"
        thayDoi={{ chu: "+12% so với khối TẮT", huong: "len", danhGia: "tot" }}
      />,
    );
    expect(container.querySelector(".nen-oso")).not.toHaveAttribute("data-trong");
    expect(screen.getByText("người")).toHaveClass("nen-oso__don-vi");
    const td = container.querySelector(".nen-oso__thay-doi");
    expect(td).toHaveAttribute("data-danh-gia", "tot");
    expect(td?.textContent).toBe("↑ +12% so với khối TẮT");
    expect(() => render(<OSo giaTri="1" />)).toThrow(/cần `nhan` hoặc `tu`/);
  });
});
