import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KET_LUAN_THEO_MA, timLoiChu } from "@/lib/tu-ngu";
import { verdict, type EstimateState } from "@/lib/livelift-api/desk";
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

  it("khối TẮT: nút khoá với câu 'đội làm như thường lệ', điện thoại không có thẻ ghim, món cũ ghi là còn từ khối trước", () => {
    const b = trangThaiBayGio({ status: "live", platform: "sim" }, trangThai(1, "OFF"), KHOI);
    expect(b.loai).toBe("tat");
    expect(b.ghimDuoc).toBe(false);
    expect(b.lyDoKhoaNut).toBe("Khối TẮT: đội làm như thường lệ.");
    expect(b.ghimDienThoai).toBeNull();
    expect(b.conTuKhoiTruoc).toBe(true);
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
  it("THẬT đang live và còn khoá: không tô nền, không hiện kết quả, có câu giải thích", () => {
    const q = quyenSoSanh(THAT, true, true, LIB_KHONG);
    expect(q).toMatchObject({ toNen: false, hienKetQua: false });
    expect(q.dong).toMatch(/không tô nền theo khối/);
  });

  it("THỬ NỘI BỘ đang live: khoá như phiên thật, kể cả khi lib cho tô nền DÀN DỰNG", () => {
    const q = quyenSoSanh(THU_NOI_BO, true, true, LIB_CHO);
    expect(q.toNen).toBe(false);
    expect(q.hienKetQua).toBe(false);
    expect(q.dong).toMatch(/THỬ NỘI BỘ đang live/);
  });

  it("MÔ PHỎNG và DÀN DỰNG được mở sớm kèm dòng giải thích; kết quả chỉ hiện khi máy chủ mở khoá", () => {
    const moPhong = quyenSoSanh(MO_PHONG, true, false, { cho: true, dong: "mở khoá sớm vì MÔ PHỎNG" });
    expect(moPhong).toEqual({ toNen: true, hienKetQua: true, dong: "mở khoá sớm vì MÔ PHỎNG" });
    const danDungKhoa = quyenSoSanh(DAN_DUNG, true, true, LIB_CHO);
    expect(danDungKhoa.toNen).toBe(true);
    expect(danDungKhoa.hienKetQua).toBe(false);
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
    expect(verdict(est(-0.9, -0.1)).detail).toContain(KET_LUAN_THEO_MA.GIU.cau);
    expect(verdict(est(-0.2, 0.6)).detail).toBe(KET_LUAN_THEO_MA.DO_THEM.cau);
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
    expect(el.textContent).toContain("Ghim món này, khách có bấm nhiều hơn không?");
    kiemChu(el);
  });

  it("khi mở: chữ kết luận canon và thước khoảng tin cậy", () => {
    const { container } = render(
      <TheDoiDau goiY={goiY} hienKetQua thuoc={{ uocLuong: 0.5, thap: 0.1, cao: 0.9 }} ketLuan="DOI" nhanNguon="MO_PHONG" dongMoSom="Phiên đang live: mở khoá sớm vì MÔ PHỎNG." />,
    );
    expect(container.querySelector("[data-ket-luan='DOI']")).toHaveTextContent(KET_LUAN_THEO_MA.DOI.chu);
    expect(screen.queryByTestId("ban-ket-qua-khoa")).toBeNull();
  });
});

vi.mock("@/lib/livelift-api/client", () => ({
  api: {
    session: vi.fn(async () => ({ session_id: "s1", platform: "sim", mode: "auto", status: "live", planned_duration_min: 90, dry_run: false, is_demo: true })),
    comments: vi.fn(async () => [
      { comment_id: "c1", ts: "2026-10-19T05:00:01Z", text: "giá bao nhiêu vậy shop", intent: "hoi_gia", pii_kinds: [] },
      { comment_id: "c2", ts: "2026-10-19T05:00:02Z", text: "đẹp quá", intent: "cam_on_khen", pii_kinds: [] },
    ]),
  },
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
    kiemChu(khung, false);
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
