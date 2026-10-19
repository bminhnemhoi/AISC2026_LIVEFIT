import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KET_LUAN_THEO_MA, LOI_THUONG, timLoiChu } from "@/lib/tu-ngu";
import { roomPulse, verdict, type EstimateState } from "@/lib/livelift-api/desk";
import type { Tick } from "@/lib/livelift-api/types";
import { duongNhoTyLeNhap } from "@/lib/bieu-do";
import { chuCua, tuTiengAnh } from "@/components/minh-hoa/__tests__/kiem-chu";
import {
  PHU_DE_NUT_GHIM,
  TheBayGio,
  TheDoiDau,
  cauHoiMoiNhat,
  cheDoGhim,
  daiKhoiBan,
  maNhanNguon,
  quyenSoSanh,
  trangThaiBayGio,
} from "@/components/ban";

const KHOI = [
  { block_index: 0, start_offset_s: 0, end_offset_s: 300, is_washout: false, assignment: "ON" as const },
  { block_index: 1, start_offset_s: 300, end_offset_s: 600, is_washout: false, assignment: "OFF" as const },
  { block_index: 2, start_offset_s: 600, end_offset_s: 900, is_washout: false, assignment: "ON" as const },
];
const GHIM = { product_id: "P1", name: "Áo thun cotton", price: 129000, stock: 10 };

function trangThai(index: number, assignment: "ON" | "OFF", conGiay = 120, ghim: typeof GHIM | null = GHIM) {
  return {
    elapsed_s: index * 300 + (300 - conGiay),
    current_block: { index, phase: "experiment", assignment, is_washout: false, seconds_remaining: conGiay },
    pinned_product: ghim,
  };
}

const THAT = { kind: "that" as const, text: "THẬT" };
const THU_NOI_BO = { kind: "dan_dung" as const, text: "DÀN DỰNG · THỬ NỘI BỘ" };
const DAN_DUNG = { kind: "dan_dung" as const, text: "DÀN DỰNG" };
const MO_PHONG = { kind: "mo_phong" as const, text: "MÔ PHỎNG" };
const LIB_CHO = { cho: true, dong: "mở khoá sớm vì DÀN DỰNG" };
const LIB_KHONG = { cho: false, dong: "Phiên THẬT đang live: ..." };

describe("trangThaiBayGio: thẻ Bây giờ", () => {
  it("khối BẬT trên phiên mô phỏng: nút ghim bấm được, điện thoại có thẻ ghim, vòng đếm đúng phần còn lại", () => {
    const b = trangThaiBayGio({ status: "live", platform: "sim" }, trangThai(0, "ON", 150), KHOI);
    expect(b.loai).toBe("bat");
    expect(b.ghimDuoc).toBe(true);
    expect(b.hienNut).toBe(true);
    expect(b.lyDoKhoaNut).toBeNull();
    expect(b.ghimDienThoai).toEqual({ ten: "Áo thun cotton", gia: 129000 });
    expect(b.phanCon).toBeCloseTo(0.5);
    expect(b.soKhoi).toBe(1);
    expect(b.tongKhoi).toBe(3);
  });

  it("khối TẮT trên nền tảng: nút khoá, món cũ còn ghim (D-012) nên điện thoại vẫn hiện món, ghi là còn từ khối trước", () => {
    const b = trangThaiBayGio({ status: "live", platform: "sim" }, trangThai(1, "OFF"), KHOI);
    expect(b.loai).toBe("tat");
    expect(b.ghimDuoc).toBe(false);
    expect(b.lyDoKhoaNut).toBe("Khối TẮT: đội làm như thường lệ.");
    expect(b.ghimDienThoai).toEqual({ ten: "Áo thun cotton", gia: 129000 });
    expect(b.conTuKhoiTruoc).toBe(true);
    expect(b.khachKhongThayGhim).toBe(false);
  });

  it("khối TẮT ở phòng xem: khách không thấy thẻ ghim nào, không ghi 'còn từ khối trước'", () => {
    const b = trangThaiBayGio({ status: "live", platform: "lab" }, trangThai(1, "OFF"), KHOI);
    expect(b.loai).toBe("tat");
    expect(b.conTuKhoiTruoc).toBe(false);
    expect(b.ghimDienThoai).toBeNull();
    expect(b.khachKhongThayGhim).toBe(true);
    render(<TheBayGio bayGio={b} sessionId="s1" monGhim={{ ten: "Bình giữ nhiệt" }} dangGhim={false} onGhim={() => undefined} thongBao={null} />);
    expect(screen.getByTestId("lab-off-khong-ghim")).toHaveTextContent("Phòng xem: khối TẮT không hiện thẻ ghim cho khách.");
    expect(screen.queryByTestId("off-block-carryover")).toBeNull();
    expect(screen.queryByText("Bình giữ nhiệt")).toBeNull();
  });

  it("số khối đếm trong các khối đo, bỏ khoảng chuyển: không bao giờ vượt tổng", () => {
    const coChuyen = [
      KHOI[0],
      { block_index: 1, start_offset_s: 300, end_offset_s: 360, is_washout: true, assignment: null },
      { ...KHOI[1], block_index: 2 },
      { ...KHOI[2], block_index: 3 },
    ];
    const b = trangThaiBayGio(
      { status: "live", platform: "sim" },
      { elapsed_s: 1000, current_block: { index: 3, phase: "experiment", assignment: "ON", is_washout: false, seconds_remaining: 60 }, pinned_product: null },
      coChuyen,
    );
    expect(b.tongKhoi).toBe(3);
    expect(b.soKhoi).toBe(3);
  });

  it("phòng dàn dựng: khối BẬT không ghim tay, máy tự ghim", () => {
    const b = trangThaiBayGio({ status: "live", platform: "lab" }, trangThai(0, "ON"), KHOI);
    expect(b.ghimDuoc).toBe(false);
    expect(b.lyDoKhoaNut).toMatch(/máy tự ghim/);
  });

  it("phiên đã kết thúc, hoặc đã qua hết khối: không có nút ghim", () => {
    expect(trangThaiBayGio({ status: "ended", platform: "sim" }, trangThai(0, "ON"), KHOI).loai).toBe("ket_thuc");
    const ngoai = trangThaiBayGio({ status: "live", platform: "sim" }, { elapsed_s: 2000, current_block: null, pinned_product: null }, KHOI);
    expect(ngoai.loai).toBe("ngoai_khoi");
    expect(ngoai.hienNut).toBe(false);
  });
});

describe("quyenSoSanh: khoá §7 của bàn", () => {
  it("THẬT đang live và còn khoá: không tô nền, không chuỗi Tỷ lệ nhấp, không kết quả, có câu giải thích", () => {
    const q = quyenSoSanh(THAT, true, true, LIB_KHONG);
    expect(q).toMatchObject({ toNen: false, hienKetQua: false, khoaChuoi: true });
    expect(q.dong).toMatch(/chưa tô màu BẬT\/TẮT và chưa hiện Tỷ lệ nhấp theo thời gian/);
  });

  it("THỬ NỘI BỘ đang live: khoá như phiên thật, kể cả khi lib cho tô nền DÀN DỰNG", () => {
    const q = quyenSoSanh(THU_NOI_BO, true, true, LIB_CHO);
    expect(q.toNen).toBe(false);
    expect(q.hienKetQua).toBe(false);
    expect(q.dong).toMatch(/THỬ NỘI BỘ đang live/);
  });

  it("D-027: chỉ MÔ PHỎNG được mở sớm; DÀN DỰNG có người bấm khoá như phiên thật, kể cả khi lib lỡ cho", () => {
    const moPhongSom = quyenSoSanh(MO_PHONG, true, true, { cho: true, dong: "câu mở sớm" });
    expect(moPhongSom).toEqual({ toNen: true, hienKetQua: false, khoaChuoi: false, dong: "câu mở sớm" });
    const moPhongMo = quyenSoSanh(MO_PHONG, true, false, { cho: true, dong: null });
    expect(moPhongMo).toEqual({ toNen: true, hienKetQua: true, khoaChuoi: false, dong: null });
    const danDungKhoa = quyenSoSanh(DAN_DUNG, true, true, LIB_CHO);
    expect(danDungKhoa).toMatchObject({ toNen: false, hienKetQua: false, khoaChuoi: true });
    expect(quyenSoSanh(DAN_DUNG, false, true, LIB_CHO).khoaChuoi).toBe(true);
    expect(quyenSoSanh(DAN_DUNG, false, false, { cho: true, dong: null })).toMatchObject({ khoaChuoi: false, hienKetQua: true });
  });

  it("D-027: Nhịp phòng khi khoá không tính gì từ lượt nhấp theo cửa sổ", () => {
    const ticks: Tick[] = [];
    const moiCuaSo: Array<[number, number]> = [[60, 3], [55, 3], [62, 4], [58, 3], [61, 3], [20, 0], [18, 0]];
    moiCuaSo.forEach(([v, c], w) => {
      for (let i = 0; i < 10; i++) {
        ticks.push({ ts_bucket: new Date((w * 10 + i) * 30000).toISOString(), viewers: v, comment_rate: 0, click_count: c });
      }
    });
    const p = roomPulse(ticks, { chiNguoiXem: true });
    expect(p.clickBand).toBeNull();
    expect(p.windows.every((w) => w.clickRate === 0)).toBe(true);
    expect(p.last?.clickRate).toBe(0);
    expect(p.alert).toBe(true);
    expect(p.note).toMatch(/^Người xem dưới dải bình thường/);
    expect(p.note).not.toMatch(/lượt nhấp/);
  });

  it("đường nhỏ Tỷ lệ nhấp: không có trên THỬ NỘI BỘ hay THẬT đang live khi còn khoá", () => {
    const phien = { start_ts: "2026-10-19T05:00:00Z" };
    const ticks = [{ ts_bucket: "2026-10-19T05:00:30Z", viewers: 10, comment_rate: 0, click_count: 1 }];
    for (const [nguon, lib] of [
      [THU_NOI_BO, LIB_CHO],
      [THAT, LIB_KHONG],
    ] as const) {
      const q = quyenSoSanh(nguon, true, true, lib);
      expect(duongNhoTyLeNhap(ticks, phien, { khoa: true, toNen: { cho: q.toNen } })).toBeNull();
    }
    const moPhong = quyenSoSanh(MO_PHONG, true, false, { cho: true, dong: null });
    expect(duongNhoTyLeNhap(ticks, phien, { khoa: false, toNen: { cho: moPhong.toNen } })).not.toBeNull();
  });

  it("bàn chỉ hẹp lại, không nới quyền của lib", () => {
    expect(quyenSoSanh(MO_PHONG, true, false, { cho: false, dong: null }).toNen).toBe(false);
  });

  it("THẬT đã xong và máy chủ mở khoá: hiện kết quả", () => {
    expect(quyenSoSanh(THAT, false, false, { cho: false, dong: null }).hienKetQua).toBe(true);
  });
});

describe("hàm nhỏ", () => {
  it("maNhanNguon theo canon", () => {
    expect(maNhanNguon(MO_PHONG)).toBe("MO_PHONG");
    expect(maNhanNguon(THAT)).toBe("THAT");
    expect(maNhanNguon(DAN_DUNG)).toBe("DAN_DUNG");
    expect(maNhanNguon(THU_NOI_BO)).toEqual(["DAN_DUNG", "THU_NOI_BO"]);
  });

  it("cheDoGhim: Tự ghim / Chỉ gợi ý / Quan sát", () => {
    expect(cheDoGhim({ mode: "auto" }, "thi_nghiem")).toBe("Tự ghim");
    expect(cheDoGhim({ mode: "suggest" }, "thi_nghiem")).toBe("Chỉ gợi ý");
    expect(cheDoGhim({ mode: "auto" }, "quan_sat")).toBe("Quan sát");
  });

  it("cauHoiMoiNhat: 3 câu hỏi mới nhất, bỏ câu không phải hỏi", () => {
    const bl = [
      { text: "chào shop", intent: "chao_hoi", ts: "2026-10-19T05:00:01Z" },
      { text: "giá bao nhiêu", intent: "hoi_gia", ts: "2026-10-19T05:00:02Z" },
      { text: "có size L không?", intent: null, ts: "2026-10-19T05:00:03Z" },
      { text: "ship mấy ngày", intent: "van_chuyen", ts: "2026-10-19T05:00:04Z" },
      { text: "màu đỏ còn không", intent: "hoi_sanpham", ts: "2026-10-19T05:00:05Z" },
    ];
    expect(cauHoiMoiNhat(bl).map((c) => c.text)).toEqual(["màu đỏ còn không", "ship mấy ngày", "có size L không?"]);
  });

  it("cauHoiMoiNhat: câu trùng chữ (khác hoa thường, khoảng trắng, dấu hỏi) chỉ còn bản mới nhất", () => {
    const bl = [
      { text: "ship về [ĐỊA CHỈ] bao lâu tới", intent: "van_chuyen", ts: "2026-10-19T05:00:01Z" },
      { text: "Ship về  [ĐỊA CHỈ] bao lâu tới?", intent: "van_chuyen", ts: "2026-10-19T05:00:02Z" },
      { text: "ship về [ĐỊA CHỈ] bao lâu tới ", intent: "van_chuyen", ts: "2026-10-19T05:00:03Z" },
      { text: "giá bao nhiêu", intent: "hoi_gia", ts: "2026-10-19T05:00:00Z" },
    ];
    const ra = cauHoiMoiNhat(bl);
    expect(ra.map((c) => c.ts)).toEqual(["2026-10-19T05:00:03Z", "2026-10-19T05:00:00Z"]);
  });

  it("daiKhoiBan: qua / nay / tới và loại khối", () => {
    const d = daiKhoiBan(KHOI, 400);
    expect(d.map((x) => `${x.loai}:${x.trangThai}`)).toEqual(["bat:qua", "tat:nay", "bat:toi"]);
  });

  it("verdict của desk dùng đúng câu canon ĐỔI / GIỮ / ĐO THÊM", () => {
    const est = (lo: number, hi: number): EstimateState => ({
      kind: "estimate",
      estimate: (lo + hi) / 2,
      ciLow: lo,
      ciHigh: hi,
      pValue: null,
      pText: null,
      nBlocks: 16,
      nOn: 8,
      nOff: 8,
      crossesZero: lo <= 0 && hi >= 0,
    });
    expect(verdict(est(0.2, 0.9))).toMatchObject({ label: KET_LUAN_THEO_MA.DOI.nhan_thuoc, detail: KET_LUAN_THEO_MA.DOI.cau });
    expect(verdict(est(-0.9, -0.1)).detail).toBe(KET_LUAN_THEO_MA.GIU.cau);
    expect(verdict(est(-0.2, 0.6)).detail).toBe(KET_LUAN_THEO_MA.DO_THEM.cau);
    expect(verdict({ kind: "not_enough", nBlocks: 3, message: "x" })).toMatchObject({ kind: "do_them", detail: LOI_THUONG.chuaDuKhoi });
  });
});

/** `tiengAnh=false` cho màn có chữ dữ liệu (bình luận của khách) và câu nghĩa của nhãn canon. */
function kiemChu(el: Element, tiengAnh = true) {
  const chu = chuCua(el);
  expect(chu).not.toMatch(/—|Ghim theo gợi ý|khúc|khoá lịch|bàn trợ live/);
  expect(timLoiChu(chu, { thuatNgu: true })).toEqual([]);
  if (tiengAnh) expect(tuTiengAnh(chu)).toEqual([]);
}

describe("TheBayGio", () => {
  it("khối BẬT: nút chính 'Ghim món của khối này' mang data-nut-chinh và phụ đề canon", () => {
    const b = trangThaiBayGio({ status: "live", platform: "sim" }, trangThai(0, "ON"), KHOI);
    const { container } = render(
      <TheBayGio bayGio={b} sessionId="s1" monGhim={{ ten: "Áo thun cotton", gia: 129000 }} dangGhim={false} onGhim={() => undefined} thongBao={null} />,
    );
    const nut = screen.getByRole("button", { name: "Ghim món của khối này" });
    expect(nut).toBeEnabled();
    expect(nut).toHaveAttribute("data-nut-chinh");
    expect(PHU_DE_NUT_GHIM).toMatch(/máy chọn trong nhóm gợi ý/);
    expect(container.textContent).toContain(PHU_DE_NUT_GHIM);
    kiemChu(container);
  });

  it("khối TẮT: nút khoá, ghi 'Khối TẮT: đội làm như thường lệ', giữ data-testid off-block-carryover", () => {
    const b = trangThaiBayGio({ status: "live", platform: "sim" }, trangThai(1, "OFF"), KHOI);
    const { container } = render(
      <TheBayGio bayGio={b} sessionId="s1" monGhim={{ ten: "Áo thun cotton" }} dangGhim={false} onGhim={() => undefined} thongBao={null} />,
    );
    expect(screen.getByRole("button", { name: "Ghim món của khối này" })).toBeDisabled();
    expect(container.textContent).toContain("Khối TẮT: đội làm như thường lệ.");
    expect(screen.getByTestId("off-block-carryover")).toBeInTheDocument();
  });
});

describe("TheDoiDau: hàng 3", () => {
  const goiY = { tieuDe: "Ghim Bình giữ nhiệt", lyDo: "Bán chạy giờ này" };

  it("khi khoá: không có số, không có kết luận, chỉ câu khoá", () => {
    const { container } = render(
      <TheDoiDau goiY={goiY} hienKetQua={false} thuoc={{ uocLuong: 0.5, thap: 0.1, cao: 0.9 }} ketLuan="DOI" nhanNguon="THAT" />,
    );
    const el = container.querySelector("[data-chup='the-doi-dau']") as HTMLElement;
    expect(el).not.toBeNull();
    expect(screen.getByTestId("ban-ket-qua-khoa")).toHaveTextContent("Đang khoá tới hết phiên để không ai nhìn trộm");
    expect(el.querySelector("[data-ket-luan]")).toBeNull();
    expect(el.textContent).not.toMatch(/0,5|0,1|0,9/);
    expect(el.textContent).toContain("Đoán theo số liệu cũ");
    expect(el.textContent).toContain("Ghim món này, khách có bấm mua nhiều hơn không?");
    kiemChu(el);
  });

  it("chưa đủ khối: ĐO THÊM kèm đúng câu LOI_THUONG.chuaDuKhoi", () => {
    render(
      <TheDoiDau goiY={goiY} hienKetQua thuoc={{ lyDo: "Cần thêm khối đo được để vẽ khoảng tin cậy." }} ketLuan="DO_THEM" cauKetLuan={LOI_THUONG.chuaDuKhoi} nhanNguon="MO_PHONG" />,
    );
    expect(screen.getByTestId("ban-cau-chua-du-khoi")).toHaveTextContent(LOI_THUONG.chuaDuKhoi);
  });

  it("phiên quan sát: không ổ khoá, không hứa so BẬT với TẮT", () => {
    render(<TheDoiDau goiY={goiY} hienKetQua={false} thuoc={{}} ketLuan={null} nhanNguon="THAT" quanSat />);
    expect(screen.getByTestId("ban-quan-sat")).toHaveTextContent("Phiên quan sát: không bốc thăm nên không so BẬT với TẮT");
    expect(screen.queryByTestId("ban-ket-qua-khoa")).toBeNull();
  });

  it("khi mở: chữ kết luận canon và thước khoảng tin cậy", () => {
    const { container } = render(
      <TheDoiDau goiY={goiY} hienKetQua thuoc={{ uocLuong: 0.5, thap: 0.1, cao: 0.9 }} ketLuan="DOI" nhanNguon="MO_PHONG" dongMoSom="Phiên đang live: mở khoá sớm vì MÔ PHỎNG." />,
    );
    expect(container.querySelector("[data-ket-luan='DOI']")).toHaveTextContent(KET_LUAN_THEO_MA.DOI.chu);
    expect(screen.queryByTestId("ban-ket-qua-khoa")).toBeNull();
  });
});

const apiGia = vi.hoisted(() => ({
  session: vi.fn(async () => ({ session_id: "s1", platform: "sim", mode: "auto", status: "live", planned_duration_min: 90, dry_run: false, is_demo: true })),
  schedule: vi.fn(async () => []),
  sessions: vi.fn(async () => [
    { session_id: "s0", platform: "lab", mode: "auto", status: "live", planned_duration_min: 90, dry_run: false, is_demo: false },
    { session_id: "s1", platform: "sim", mode: "auto", status: "live", planned_duration_min: 90, dry_run: false, is_demo: true },
  ]),
  comments: vi.fn(async () => [
    { comment_id: "c1", ts: "2026-10-19T05:00:01Z", text: "giá bao nhiêu vậy shop", intent: "hoi_gia", pii_kinds: [] },
    { comment_id: "c2", ts: "2026-10-19T05:00:02Z", text: "đẹp quá", intent: "cam_on_khen", pii_kinds: [] },
    { comment_id: "c3", ts: "2026-10-19T05:00:03Z", text: "ship về [ĐỊA CHỈ] bao lâu tới", intent: "van_chuyen", pii_kinds: ["dia_chi"] },
    { comment_id: "c4", ts: "2026-10-19T05:00:04Z", text: "ship về [ĐỊA CHỈ] bao lâu tới", intent: "van_chuyen", pii_kinds: ["dia_chi"] },
    { comment_id: "c5", ts: "2026-10-19T05:00:05Z", text: "Ship về [ĐỊA CHỈ] bao lâu tới?", intent: "van_chuyen", pii_kinds: ["dia_chi"] },
  ]),
}));

vi.mock("@/lib/livelift-api/client", () => ({
  api: apiGia,
  useHostView: () => ({ state: { pinned_product: "Áo thun cotton", price: 129000, stock: 10, elapsed_s: 75 }, error: null }),
}));

describe("HostView: màn người dẫn", () => {
  it("tên món lớn, giá, câu hỏi của khách; không bao giờ có BẬT/TẮT hay lịch khối", async () => {
    const { HostView } = await import("@/components/phien/HostView");
    const { container } = render(<HostView sessionId="s1" />);
    const khung = container.querySelector("[data-chup='nguoi-dan']") as HTMLElement;
    expect(khung).toHaveAttribute("data-vung-chinh");
    expect(screen.getByTestId("host-view")).toBe(khung);
    expect(screen.getByTestId("nguoi-dan-mon")).toHaveTextContent("Áo thun cotton");
    await waitFor(() => expect(khung.textContent).toContain("giá bao nhiêu vậy shop"));
    expect(khung.textContent).not.toContain("đẹp quá");
    expect(khung.textContent).not.toMatch(/BẬT|TẮT|Khối \d|khối B|khối T/);
    expect(khung.textContent).toContain("Khách đang hỏi");
    expect(screen.getByTestId("nguoi-dan-nguon-hoi")).toHaveTextContent("Lấy từ bình luận của khách");
    // câu trùng chỉ còn một, chỗ đã che đọc thành lời thường
    const cau = screen.getByTestId("nguoi-dan-cau-hoi").querySelectorAll("li");
    expect([...cau].map((li) => li.textContent)).toEqual(["Ship về (đã che địa chỉ) bao lâu tới?", "giá bao nhiêu vậy shop"]);
    expect(khung.textContent).toContain("còn 10 trong kho");
    kiemChu(khung, false);
  });

  it("không gọi bản ghi phiên hay lịch (có lịch BẬT/TẮT đã niêm phong): nhãn nguồn lấy từ danh sách phiên", async () => {
    const { HostView } = await import("@/components/phien/HostView");
    apiGia.session.mockClear();
    apiGia.schedule.mockClear();
    render(<HostView sessionId="s1" />);
    await waitFor(() => expect(apiGia.sessions).toHaveBeenCalled());
    expect(apiGia.session).not.toHaveBeenCalled();
    expect(apiGia.schedule).not.toHaveBeenCalled();
  });
});

describe("nguồn của U4 không chứa chữ cấm", () => {
  it("không '—', không 'Ghim theo gợi ý' trong tệp giao diện", () => {
    const goc = path.resolve(__dirname, "..");
    const tep = [
      ...fs.readdirSync(goc).filter((t) => /\.(tsx|ts|css)$/.test(t)).map((t) => path.join(goc, t)),
      path.resolve(goc, "../phien/ExperimentDesk.tsx"),
      path.resolve(goc, "../phien/HostView.tsx"),
    ];
    for (const t of tep) {
      const s = fs.readFileSync(t, "utf8");
      expect(s, t).not.toMatch(/—|Ghim theo gợi ý/);
    }
  });
});
