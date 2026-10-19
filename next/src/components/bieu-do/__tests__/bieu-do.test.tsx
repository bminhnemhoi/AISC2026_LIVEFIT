import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dongRungGop, dongRungTuBaoCao } from "@/lib/bieu-do/rung";
import { khoiTuTicks, type KhoiDo } from "@/lib/bieu-do/chuoi";
import { CAU_MO_SOM_MO_PHONG, chanUocLuongKhiKhoa } from "@/lib/bieu-do/khoa";
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
    // Tiêu đề có "95%" (tên của khoảng tin cậy); ngoài nó không có số nào.
    expect((container.textContent ?? "").replace(/95%/g, "")).not.toMatch(/\d/);
    expect(screen.queryByRole("button", { name: /bảng/ })).toBeNull();
  });

  it("thước: nhãn ước lượng gần 0 né vạch 0 (soát đợt 2 ĐỎ 4), có viền nền", () => {
    render(<ThuocKhoangTinCay khoa={false} uocLuong={0.165} thap={-0.3} cao={1.6} />);
    const nhan = screen.getByTestId("bd-thuoc-nhan-uoc");
    const vach = screen.getByTestId("bd-vach-0");
    expect(nhan.textContent).toBe("+0,165");
    expect(nhan.getAttribute("data-neo")).toBe("start");
    expect(Number(nhan.getAttribute("x"))).toBeGreaterThan(Number(vach.getAttribute("x1")));
    expect(nhan.getAttribute("class")).toContain("bd-chu-vien");
    // Ước lượng âm gần 0: nhãn nằm bên trái vạch.
    render(<ThuocKhoangTinCay khoa={false} uocLuong={-0.1} thap={-1.6} cao={0.3} />);
    const am = screen.getAllByTestId("bd-thuoc-nhan-uoc")[1];
    expect(am.getAttribute("data-neo")).toBe("end");
    // Ước lượng xa 0: canh giữa tại điểm.
    render(<ThuocKhoangTinCay khoa={false} uocLuong={1.22} thap={0.93} cao={1.5} />);
    expect(screen.getAllByTestId("bd-thuoc-nhan-uoc")[2].getAttribute("data-neo")).toBe("middle");
  });

  it("thước: tiêu đề có 95%, anVung ẩn danh sách ba vùng, nút bảng ẩn khi chụp", () => {
    render(<ThuocKhoangTinCay khoa={false} uocLuong={1.22} thap={0.93} cao={1.5} anVung />);
    expect(screen.getByText("Khoảng tin cậy 95% của chênh lệch")).toBeInTheDocument();
    expect(screen.queryByTestId("bd-thuoc-vung")).toBeNull();
    expect(screen.getByRole("button", { name: "Xem dạng bảng" }).hasAttribute("data-an-khi-chup")).toBe(true);
    // Phụ đề có bản ngắn cho khung hẹp.
    expect(document.querySelector(".bd-phu-de-ngan")?.textContent).toMatch(/^Đo lại/);
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

  it("lý do của máy chủ qua chuanHoaChu: không gạch dài, không chữ tắt KTC (soát đợt 1 mục 9)", () => {
    const k = { ...chuaDu.baoCao.ket_qua_thi_nghiem!, message: "Chưa xác định KTC — cần thêm khối TẮT" };
    const p = thuocTuBaoCao({ ...chuaDu.baoCao, ket_qua_thi_nghiem: k });
    expect(p.lyDo).toBe("Chưa xác định khoảng tin cậy, cần thêm khối TẮT");
    render(<ThuocKhoangTinCay khoa={false} lyDo="KTC rỗng — thiếu khối" />);
    const o = screen.getByTestId("bd-thuoc");
    expect(o.textContent).toContain("khoảng tin cậy rỗng, thiếu khối");
    kiemChu(o);
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

  it("chưa đủ khối (anTrungBinh): không đường, không chữ trung bình ở chú giải, câu mô tả và bảng (soát đợt 2 VÀNG 1, 52)", () => {
    const k = khoiTuTicks(chuaDu.khoi, chuaDu.ticks, chuaDu.phien.start_ts, chuaDu.phien.end_ts);
    expect(k.length).toBeGreaterThan(0);
    render(<ChamTheoKhoi khoa={false} khoiDo={k} anTrungBinh />);
    expect(screen.queryByTestId("bd-tb-bat")).toBeNull();
    expect(screen.queryByTestId("bd-tb-tat")).toBeNull();
    const khung = screen.getByTestId("bd-cham");
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toMatch(/trung bình/i);
    expect(khung.querySelector(".bd-chu-giai")?.textContent).not.toMatch(/trung bình/);
    expect(screen.getByText(/Chưa đủ khối để so BẬT với TẮT/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem dạng bảng" }));
    expect(screen.getByRole("table").textContent).not.toMatch(/trung bình/);
  });

  it("nút xem dạng bảng đổi qua lại, bảng có đủ khối", () => {
    render(<ChamTheoKhoi khoa={false} khoiDo={khoiDoi1} />);
    const nut = screen.getByRole("button", { name: "Xem dạng bảng" });
    expect(nut).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(nut);
    const bang = screen.getByRole("table");
    expect(within(bang).getAllByRole("row")).toHaveLength(1 + 16 + 2);
    expect(screen.queryByTestId("bd-cham-ve")).toBeNull();
    // Một nhãn cố định, trạng thái ở aria-pressed (soát đợt 1 mục 16).
    const nutSau = screen.getByRole("button", { name: "Xem dạng bảng" });
    expect(nutSau).toBe(nut);
    expect(nutSau).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Xem biểu đồ" })).toBeNull();
    fireEvent.click(nutSau);
    expect(nutSau).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("bd-cham-ve")).toBeInTheDocument();
  });
});

describe("đường thời gian", () => {
  const nguonThat = { kind: "that" as const, text: "THẬT" };

  it("phiên THẬT đang live: một màu, không tô nền theo khối, kể cả khi lỡ truyền toNenKhoi", () => {
    render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} toNenKhoi nguon={nguonThat} dangLive thoiLuongS={5400} />);
    expect(screen.queryByTestId("bd-dai-khoi")).toBeNull();
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toContain("chưa tô màu BẬT/TẮT");
    expect(screen.queryByText(/BẬT: ghim món theo lịch/)).toBeNull();
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toContain("Nền tô theo khối");
  });

  // D-027: phiên có người bấm còn khoá thì không có chuỗi Tỷ lệ nhấp theo thời gian ở đâu cả.
  const nguonKhoa = [
    { ten: "THẬT", nguon: { kind: "that" as const, text: "THẬT" } },
    { ten: "THỬ NỘI BỘ", nguon: sourceLabel({ platform: "lab", is_demo: false, dry_run: true }) },
    { ten: "DÀN DỰNG", nguon: sourceLabel({ platform: "lab", is_demo: false, dry_run: false }) },
  ];
  for (const { ten, nguon } of nguonKhoa) {
    it(`khoá §7 (D-027): ${ten} đang live có điểm đo thì chỉ có Người xem`, () => {
      const { container } = render(
        <DuongThoiGian ticks={doi1.ticks} batDauTs={doi1.phien.start_ts} khoi={doi1.khoi} toNenKhoi nguon={nguon} dangLive khoa />,
      );
      expect(container.querySelector('[data-testid="bd-duong-ty-le-nhap"]')).toBeNull();
      expect(container.querySelector('[data-testid="bd-duong-nguoi-xem"]')).not.toBeNull();
      expect(screen.queryByTestId("bd-dai-khoi")).toBeNull();
      expect(screen.getByText("Người xem theo thời gian")).toBeInTheDocument();
      const aria = screen.getByRole("img").getAttribute("aria-label") ?? "";
      expect(aria).not.toContain("Tỷ lệ nhấp gần nhất");
      // Ô nhắc chỉ có người xem.
      const vung = container.querySelector('rect[fill="transparent"]') as SVGRectElement;
      fireEvent.pointerMove(vung, { clientX: 300, clientY: 50 });
      expect(container.querySelector(".bd-nhac")?.textContent).not.toMatch(/tỷ lệ nhấp/i);
      // Bảng thay ảnh không có cột Tỷ lệ nhấp, không cột Khối.
      fireEvent.click(screen.getByRole("button", { name: "Xem dạng bảng" }));
      expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Thời điểm", "Người xem"]);
      expect(screen.getByTestId("bd-dong-to-nen").textContent).toContain(`${ten} đang live`);
    });
  }

  it("khoá §7: hết phiên mà máy chủ còn khoá thì vẫn chỉ có Người xem; mở rồi thì có đủ", () => {
    const nguon = sourceLabel({ platform: "lab", is_demo: false, dry_run: true });
    const { container, unmount } = render(<DuongThoiGian ticks={doi1.ticks} batDauTs={doi1.phien.start_ts} khoi={doi1.khoi} toNenKhoi nguon={nguon} khoa />);
    expect(container.querySelector('[data-testid="bd-duong-ty-le-nhap"]')).toBeNull();
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toContain("chưa mở");
    unmount();
    const mo = render(<DuongThoiGian ticks={doi1.ticks} batDauTs={doi1.phien.start_ts} khoi={doi1.khoi} toNenKhoi nguon={nguon} khoa={false} />);
    expect(mo.container.querySelector('[data-testid="bd-duong-ty-le-nhap"]')).not.toBeNull();
    expect(screen.getByTestId("bd-dai-khoi")).toBeInTheDocument();
    expect(screen.queryByTestId("bd-dong-to-nen")).toBeNull();
  });

  it("lỡ truyền toNenKhoi mà quên nguon: không tô nền, không tự ghi dòng mở khoá (soát đợt 1 mục 3)", () => {
    render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} toNenKhoi dangLive thoiLuongS={5400} />);
    expect(screen.queryByTestId("bd-dai-khoi")).toBeNull();
    expect(screen.queryByTestId("bd-dong-to-nen")).toBeNull();
    expect(screen.queryByText(/mở khoá sớm/)).toBeNull();
    expect(screen.queryByText(/BẬT: ghim món theo lịch/)).toBeNull();
  });

  it("phòng THỬ NỘI BỘ đang live: không tô nền theo khối, nói vì sao", () => {
    const nguon = sourceLabel({ platform: "lab", is_demo: false, dry_run: true });
    expect(nguon.text).toBe("DÀN DỰNG · THỬ NỘI BỘ");
    render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} toNenKhoi nguon={nguon} dangLive />);
    expect(screen.queryByTestId("bd-dai-khoi")).toBeNull();
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toContain("THỬ NỘI BỘ đang live");
    expect(screen.queryByText(/mở khoá sớm/)).toBeNull();
  });

  it("phiên MÔ PHỎNG không bật toNenKhoi: không nền, không dòng mở khoá", () => {
    render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} nguon={sourceLabel(live.phien)} dangLive />);
    expect(screen.queryByTestId("bd-dai-khoi")).toBeNull();
    expect(screen.queryByTestId("bd-dong-to-nen")).toBeNull();
  });

  it("ghiChu của người gọi (d.toNen.dong) được hiện nguyên văn", () => {
    render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} toNenKhoi nguon={sourceLabel(live.phien)} dangLive ghiChu="mở khoá sớm vì MÔ PHỎNG" />);
    expect(screen.getByTestId("bd-dai-khoi")).toBeInTheDocument();
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toBe("mở khoá sớm vì MÔ PHỎNG");
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
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toBe(CAU_MO_SOM_MO_PHONG);
    expect(container.querySelector('[data-testid="bd-duong-ty-le-nhap"]')).not.toBeNull();
    expect(screen.getByText(/BẬT: ghim món theo lịch/)).toBeInTheDocument();
    expect(container.querySelector('[data-testid="bd-duong-nguoi-xem"]')?.getAttribute("d")).toMatch(/^M/);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Nền tô theo khối");
  });

  it("phòng DÀN DỰNG đang live: khoá như THỬ NỘI BỘ (D-027), vẫn có nhãn nguồn", () => {
    const nguon = sourceLabel({ platform: "lab", is_demo: false, dry_run: false });
    expect(nguon.text).toBe("DÀN DỰNG");
    const { container } = render(<DuongThoiGian ticks={live.ticks} batDauTs={live.phien.start_ts} khoi={live.khoi} toNenKhoi nguon={nguon} dangLive />);
    expect(screen.queryByTestId("bd-dai-khoi")).toBeNull();
    expect(container.querySelector('[data-testid="bd-duong-ty-le-nhap"]')).toBeNull();
    expect(screen.getByTestId("bd-dong-to-nen").textContent).toContain("DÀN DỰNG đang live");
    expect(screen.getByText("DÀN DỰNG")).toBeInTheDocument();
  });

  it("câu mô tả thay ảnh và bảng 5 phút", () => {
    render(<DuongThoiGian ticks={doi1.ticks} batDauTs={doi1.phien.start_ts} khoa={false} />);
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
    const { container } = render(<DuongThoiGian ticks={doi1.ticks} batDauTs={doi1.phien.start_ts} khoa={false} />);
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
    // Ô đầu là thời gian xem (phút·người xem), không phải số người; nối có đơn vị đầy đủ (soát đợt 2 VÀNG 21, 36, 37).
    expect(container.querySelector('[data-buoc="xem"]')?.textContent).toContain("Thời gian xem");
    expect(container.querySelector('.bd-pheu-noi-don-vi')?.textContent).toBe("lượt nhấp hợp lệ / 1.000 giây·người xem");
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
