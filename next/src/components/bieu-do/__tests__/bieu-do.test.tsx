import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dongRungGop, dongRungTuBaoCao } from "@/lib/bieu-do/rung";
import { khoiTuTicks, type KhoiDo } from "@/lib/bieu-do/chuoi";
import { chanUocLuongKhiKhoa } from "@/lib/bieu-do/khoa";
import { ExperimentSummarySchema } from "@/lib/livelift-api/gop";
import { sourceLabel } from "@/lib/livelift-api/desk";
import { BaoCaoSchema, BlockSchema, CommentSchema, SessionSchema, TickSchema } from "@/lib/livelift-api/types";
import gopVangJson from "@/lib/livelift-api/__tests__/fixtures/gop-demo-vang.json";
import doi1Json from "@/lib/bieu-do/__tests__/fixtures/phien-doi-1.json";
import chuaDuJson from "@/lib/bieu-do/__tests__/fixtures/phien-chua-du-khoi.json";
import liveJson from "@/lib/bieu-do/__tests__/fixtures/phien-mo-phong-dang-live.json";
import khoaJson from "@/lib/bieu-do/__tests__/fixtures/phien-thu-noi-bo-khoa.json";
import { BieuDoRung, ChamTheoKhoi, DuongNho, DuongThoiGian, ThanhYDinh, ThuocKhoangTinCay, TuXemDenMua, thuocTuBaoCao } from "..";

function phienMau(json: unknown) {
  const j = json as Record<string, unknown>;
  return {
    phien: SessionSchema.parse(j.phien),
    khoi: BlockSchema.array().parse(j.khoi),
    ticks: TickSchema.array().parse(j.ticks),
    binhLuan: CommentSchema.array().parse(j.binhLuan),
    baoCao: BaoCaoSchema.parse(j.baoCao),
  };
}

const doi1 = phienMau(doi1Json);
const chuaDu = phienMau(chuaDuJson);
const live = phienMau(liveJson);
const khoa = phienMau(khoaJson);
const khoiDoi1 = khoiTuTicks(doi1.khoi, doi1.ticks, doi1.phien.start_ts, doi1.phien.end_ts);

/** Không chữ tiếng Anh, không gạch dài trên phần nhìn thấy. */
function kiemChu(el: HTMLElement): void {
  const chu = el.textContent ?? "";
  expect(chu).not.toMatch(/—/);
  expect(chu).not.toMatch(/\bKTC\b/);
  expect(chu).not.toMatch(/\b(click|viewer|estimate|table|chart|loading|locked)\b/i);
}

describe("khoá §7: không vẽ thước hay chấm khi khoa=true", () => {
  it("thước khoá: không số, không hình, kể cả khi lỡ truyền số", () => {
    const { container } = render(<ThuocKhoangTinCay khoa uocLuong={1.2} thap={0.9} cao={1.5} />);
    expect(screen.getByTestId("bd-thuoc-khoa")).toBeInTheDocument();
    expect(screen.queryByTestId("bd-thuoc-ve")).toBeNull();
    // Chỉ còn đúng một hình: biểu tượng ổ khoá.
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("line, [data-testid^='bd-thuoc-']:not([data-testid='bd-thuoc-khoa'])")).toBeNull();
    expect(container.textContent).not.toMatch(/\d/);
    expect(screen.queryByRole("button", { name: /bảng/ })).toBeNull();
  });

  it("chấm khoá: không chấm nào, kể cả khi lỡ truyền khoiDo", () => {
    const { container } = render(<ChamTheoKhoi khoa khoiDo={khoiDoi1} />);
    expect(screen.getByTestId("bd-cham-khoa")).toBeInTheDocument();
    expect(screen.queryByTestId("bd-cham-ve")).toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelectorAll("[data-nhanh]")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("báo cáo phòng thử nội bộ đang khoá cho ra thước khoá", () => {
    expect(thuocTuBaoCao(chanUocLuongKhiKhoa(khoa.baoCao))).toEqual({ khoa: true });
    expect(thuocTuBaoCao(null)).toEqual({ khoa: true });
    const p = thuocTuBaoCao(doi1.baoCao);
    expect(p.khoa).toBe(false);
    expect(p.uocLuong).toBe(doi1.baoCao.ket_qua_thi_nghiem!.estimate);
    const thieu = thuocTuBaoCao(chuaDu.baoCao);
    expect(thieu.khoa).toBe(false);
    expect(thieu.uocLuong).toBeUndefined();
    expect(thieu.lyDo).toContain("Chưa đủ khối");
  });
});

describe("thước khoảng tin cậy khi đã mở", () => {
  it("vẽ điểm, khoảng, vạch 0, ba vùng có chữ; vùng đúng được đánh dấu", () => {
    render(<ThuocKhoangTinCay {...thuocTuBaoCao(doi1.baoCao)} nhan="MÔ PHỎNG" />);
    expect(screen.getByTestId("bd-thuoc-ve")).toBeInTheDocument();
    expect(screen.getByTestId("bd-vach-0")).toBeInTheDocument();
    expect(screen.getByTestId("bd-thuoc-diem")).toBeInTheDocument();
    const vung = within(screen.getByTestId("bd-thuoc-vung")).getAllByRole("listitem");
    expect(vung.map((v) => v.dataset.vung)).toEqual(["giu", "do_them", "doi"]);
    expect(vung.filter((v) => v.getAttribute("aria-current") === "true").map((v) => v.dataset.vung)).toEqual(["doi"]);
    expect(vung.map((v) => v.textContent)).toEqual([expect.stringContaining("GIỮ"), expect.stringContaining("ĐO THÊM"), expect.stringContaining("ĐỔI")]);
    const hinh = screen.getByRole("img");
    expect(hinh.getAttribute("aria-label")).toContain("+1,224");
    expect(hinh.getAttribute("aria-label")).toContain("khoảng tin cậy 95%");
    kiemChu(screen.getByTestId("bd-thuoc"));
  });

  it("đã mở nhưng thiếu khối: nói lý do, không vẽ thước", () => {
    render(<ThuocKhoangTinCay {...thuocTuBaoCao(chuaDu.baoCao)} />);
    expect(screen.queryByTestId("bd-thuoc-ve")).toBeNull();
    expect(screen.getByText(/Chưa có ước lượng/)).toBeInTheDocument();
  });

  it("chế độ gọn chỉ giữ câu của vùng đang chọn", () => {
    render(<ThuocKhoangTinCay khoa={false} uocLuong={-0.17} thap={-0.49} cao={0.18} gon />);
    const vung = within(screen.getByTestId("bd-thuoc-vung")).getAllByRole("listitem");
    expect(vung.filter((v) => v.querySelector(".bd-vung-cau")).map((v) => v.dataset.vung)).toEqual(["do_them"]);
  });
});

describe("chấm theo khối khi đã mở", () => {
  it("chấm BẬT đặc, TẮT rỗng có sọc, đường trung bình hai nhánh", () => {
    const { container } = render(<ChamTheoKhoi khoa={false} khoiDo={khoiDoi1} />);
    expect(container.querySelectorAll('[data-nhanh="ON"]')).toHaveLength(9);
    expect(container.querySelectorAll('[data-nhanh="OFF"]')).toHaveLength(7);
    const tat = container.querySelector('[data-nhanh="OFF"] circle:last-child') as SVGCircleElement;
    expect(tat.getAttribute("fill")).toMatch(/^url\(#bd-soc-cham/);
    expect(screen.getByTestId("bd-tb-bat")).toBeInTheDocument();
    expect(screen.getByTestId("bd-tb-tat")).toBeInTheDocument();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("9 khối BẬT đo được, 7 khối TẮT đo được");
    kiemChu(screen.getByTestId("bd-cham"));
  });

  it("khối không đo được không vẽ thành 0 mà được đếm ở ghi chú", () => {
    const khoi: KhoiDo[] = [
      { index: 0, nhanh: "ON", tu: 0, den: 300, phoi: 900, nhap: 3, tyLe: 3.33, doDuoc: true, lyDo: null },
      { index: 1, nhanh: "OFF", tu: 300, den: 600, phoi: 10, nhap: 0, tyLe: null, doDuoc: false, lyDo: "Quá ít người xem để tính tỷ lệ nhấp." },
    ];
    const { container } = render(<ChamTheoKhoi khoa={false} khoiDo={khoi} />);
    expect(container.querySelectorAll('[data-nhanh="OFF"]')).toHaveLength(0);
    expect(screen.getByText(/1 khối không đo được/)).toBeInTheDocument();
  });

  it("nút xem dạng bảng đổi qua lại, bảng có đủ khối", () => {
    render(<ChamTheoKhoi khoa={false} khoiDo={khoiDoi1} />);
    const nut = screen.getByRole("button", { name: "Xem dạng bảng" });
    expect(nut).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(nut);
    const bang = screen.getByRole("table");
    expect(within(bang).getAllByRole("row")).toHaveLength(1 + 16 + 2);
    expect(screen.queryByTestId("bd-cham-ve")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xem biểu đồ" }));
    expect(screen.getByTestId("bd-cham-ve")).toBeInTheDocument();
  });
});

describe("đường thời gian", () => {
  const nguonThat = { kind: "that" as const, text: "THẬT" };

  it("phiên THẬT đang live: một màu, không tô nền theo khối, kể cả khi lỡ truyền toNenKhoi", () => {
    render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} toNenKhoi nguon={nguonThat} dangLive thoiLuongS={5400} />);
    expect(screen.queryByTestId("bd-dai-khoi")).toBeNull();
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toContain("không tô nền theo khối");
    expect(screen.queryByText(/BẬT: LiveLift ghim/)).toBeNull();
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toContain("Nền tô theo khối");
  });

  it("không truyền toNenKhoi thì không tô nền, dù là phiên MÔ PHỎNG", () => {
    render(<DuongThoiGian ticks={doi1.ticks} batDauTs={doi1.phien.start_ts} khoi={doi1.khoi} />);
    expect(screen.queryByTestId("bd-dai-khoi")).toBeNull();
  });

  it("phiên MÔ PHỎNG: tô nền BẬT/TẮT kèm dòng mở khoá sớm", () => {
    const nguon = sourceLabel(live.phien);
    expect(nguon.text).toBe("MÔ PHỎNG");
    const { container } = render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} toNenKhoi nguon={nguon} dangLive thoiLuongS={5400} />);
    const dai = screen.getByTestId("bd-dai-khoi");
    expect(dai.querySelectorAll('[data-nhanh="ON"]').length + dai.querySelectorAll('[data-nhanh="OFF"]').length).toBe(16);
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toBe("mở khoá sớm vì MÔ PHỎNG");
    expect(screen.getByText(/BẬT: LiveLift ghim/)).toBeInTheDocument();
    expect(container.querySelector('[data-testid="bd-duong-nguoi-xem"]')?.getAttribute("d")).toMatch(/^M/);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Nền tô theo khối");
  });

  it("phòng DÀN DỰNG được tô nền, có nhãn nguồn", () => {
    const nguon = sourceLabel({ platform: "lab", is_demo: false, dry_run: true });
    render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} toNenKhoi nguon={nguon} dangLive />);
    expect(screen.getByTestId("bd-dai-khoi")).toBeInTheDocument();
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toBe("mở khoá sớm vì DÀN DỰNG");
    expect(screen.getByText("DÀN DỰNG · THỬ NỘI BỘ")).toBeInTheDocument();
  });

  it("câu mô tả thay ảnh và bảng 5 phút", () => {
    render(<DuongThoiGian ticks={doi1.ticks} batDauTs={doi1.phien.start_ts} />);
    const nhan = screen.getByRole("img").getAttribute("aria-label") ?? "";
    expect(nhan).toMatch(/^Đường thời gian 1 giờ 30 phút: người xem từ 1 tới/);
    fireEvent.click(screen.getByRole("button", { name: "Xem dạng bảng" }));
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Thời điểm", "Người xem", "Tỷ lệ nhấp"]);
    kiemChu(screen.getByTestId("bd-duong-thoi-gian"));
  });

  it("chưa có điểm đo: ô trống bằng lời, không vẽ trục rỗng", () => {
    const { container } = render(<DuongThoiGian ticks={[]} batDauTs={khoa.phien.start_ts} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText("Chưa có điểm đo người xem nào.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xem dạng bảng" })).toBeNull();
  });

  it("rê chuột hiện ô nhắc có cả hai chuỗi", () => {
    const { container } = render(<DuongThoiGian ticks={doi1.ticks} batDauTs={doi1.phien.start_ts} />);
    const vung = container.querySelector('rect[fill="transparent"]') as SVGRectElement;
    fireEvent.pointerMove(vung, { clientX: 300, clientY: 50 });
    const nhac = container.querySelector(".bd-nhac");
    expect(nhac?.textContent).toContain("người xem");
    expect(nhac?.textContent).toContain("tỷ lệ nhấp");
    fireEvent.pointerLeave(vung);
    expect(container.querySelector(".bd-nhac")).toBeNull();
  });
});

describe("biểu đồ rừng", () => {
  it("mỗi phiên một hàng, kết quả gộp là hình thoi, phiên khoá vẫn có hàng", () => {
    const dong = [dongRungTuBaoCao(doi1.phien, doi1.baoCao), dongRungTuBaoCao(chuaDu.phien, chuaDu.baoCao), dongRungTuBaoCao(khoa.phien, khoa.baoCao)];
    const gop = dongRungGop(ExperimentSummarySchema.parse(gopVangJson));
    const { container } = render(<BieuDoRung dong={dong} gop={gop} />);
    expect(container.querySelectorAll('[data-testid="bd-rung-phien"]')).toHaveLength(1);
    expect(screen.getByTestId("bd-rung-gop").querySelector("path")?.getAttribute("d")).toMatch(/^M.*Z$/);
    expect(screen.getByText("Đang khoá")).toBeInTheDocument();
    expect(screen.getAllByText("ĐỔI").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Kết quả gộp");
    kiemChu(screen.getByTestId("bd-rung"));
  });

  it("không có phiên: nói bằng lời", () => {
    render(<BieuDoRung dong={[]} />);
    expect(screen.getByText("Chưa có phiên nào để so.")).toBeInTheDocument();
  });
});

describe("thanh ý định, từ xem đến mua, đường nhỏ", () => {
  it("thanh ý định sắp giảm dần, Khác cuối", () => {
    const { container } = render(<ThanhYDinh binhLuan={doi1.binhLuan} />);
    const thu = [...container.querySelectorAll("[data-y-dinh]")].map((e) => (e as HTMLElement).dataset.yDinh);
    expect(thu[0]).toBe("van_chuyen");
    expect(thu[thu.length - 1]).toBe("khac");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("64 bình luận");
    kiemChu(screen.getByTestId("bd-y-dinh"));
  });

  it("thanh ý định rỗng", () => {
    render(<ThanhYDinh binhLuan={[]} />);
    expect(screen.getByText("Chưa có bình luận nào được gán nhãn ý định.")).toBeInTheDocument();
  });

  it("không có nguồn đơn thì không in 0", () => {
    const { container } = render(<TuXemDenMua ticks={doi1.ticks} don={{ tong_don: 0, tong_san_pham: 0, tong_doanh_thu: 0 }} coNguonDon={false} />);
    const don = container.querySelector('[data-buoc="don"]') as HTMLElement;
    expect(don.textContent).toContain("Chưa có nguồn đơn");
    expect(don.querySelector(".bd-pheu-so")).toBeNull();
    expect(container.querySelector('[data-buoc="nhap"] .bd-pheu-so')?.textContent).toBe("294");
    kiemChu(screen.getByTestId("bd-pheu"));
  });

  it("phòng xem có đơn tiền ảo", () => {
    const { container } = render(<TuXemDenMua ticks={doi1.ticks} don={{ tong_don: 7, tong_san_pham: 7, tong_doanh_thu: 0 }} coNguonDon tenDon="Đơn tiền ảo" />);
    expect(container.querySelector('[data-buoc="don"] .bd-pheu-so')?.textContent).toBe("7");
    expect(screen.getByText("Đơn tiền ảo")).toBeInTheDocument();
  });

  it("đường nhỏ có câu mô tả, đứt ở chỗ thiếu số", () => {
    const { container } = render(<DuongNho giaTri={[1, 2, null, 4]} ten="Người xem" mau="nguoiXem" />);
    const svg = screen.getByRole("img");
    expect(svg.getAttribute("aria-label")).toBe("Người xem: 3 điểm, gần nhất 4, cao nhất 4.");
    expect(container.querySelector("path")?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
  });
});
