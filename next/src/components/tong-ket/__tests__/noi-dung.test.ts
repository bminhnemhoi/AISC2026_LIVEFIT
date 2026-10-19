import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceLabel } from "@/lib/livelift-api/desk";
import { BaoCaoSchema, type BaoCao, type Session } from "@/lib/livelift-api/types";
import { KET_LUAN_THEO_MA, LOI_THUONG } from "@/lib/tu-ngu";
import {
  CAU_KHOA,
  CAU_QUAN_SAT,
  cauChuaDuKhoi,
  chiTietNguoiKiem,
  demYDinhTuBaoCao,
  dieuChuaBiet,
  dongPhien,
  ketLuanTuBaoCao,
  lamSachCau,
  maBamLich,
  maNhanTuNguon,
  tenPhienHienThi,
  tomTatPhien,
} from "../noi-dung";

const goc = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "lib", "livelift-api", "__tests__", "fixtures", "bao-cao-demo-vang-duong.json"), "utf-8"),
) as unknown;
const DOI = BaoCaoSchema.parse(goc);

function voiKetQua(k: Partial<NonNullable<BaoCao["ket_qua_thi_nghiem"]>>, them: Partial<BaoCao> = {}): BaoCao {
  return { ...DOI, ...them, ket_qua_thi_nghiem: { ...DOI.ket_qua_thi_nghiem!, ...k } } as BaoCao;
}

const PHIEN = {
  session_id: "s1",
  platform: "sim",
  title: "Demo vàng · ĐỔI #1",
  mode: "auto",
  status: "ended",
  planned_duration_min: 90,
  dry_run: false,
  is_demo: true,
  design: { design_hash: "1a6405509fab70ef0813aa841b11e2b63bceeb78ac91cb9446865021a004a317" },
} as unknown as Session;

/** Chữ không được lên màn tổng kết (kế hoạch 3.1 mục 3, thuat-ngu.yaml). */
const CAM = [/—/, /\bKTC\b/, /hoán vị/i, /khóa/i, /\bnull\b/, /CHƯA ĐỦ KHỐI/];

function sach(chu: string) {
  for (const m of CAM) expect(chu, `còn ${m} trong: ${chu}`).not.toMatch(m);
}

describe("ketLuanTuBaoCao", () => {
  it("ĐỔI khi cả khoảng tin cậy trên 0, đúng câu canon", () => {
    const k = ketLuanTuBaoCao(DOI);
    expect(k).toMatchObject({ loai: "ket_luan", ma: "DOI", chu: "ĐỔI", coUocLuong: true });
    if (k.loai === "ket_luan") expect(k.cau).toBe(KET_LUAN_THEO_MA.DOI.cau);
  });

  it("GIỮ khi cả khoảng dưới 0", () => {
    const k = ketLuanTuBaoCao(voiKetQua({ estimate: -1, ci_low: -1.4, ci_high: -0.6 }));
    expect(k).toMatchObject({ ma: "GIU", chu: "GIỮ" });
  });

  it("ĐO THÊM khi khoảng chứa 0", () => {
    const k = ketLuanTuBaoCao(voiKetQua({ estimate: -0.17, ci_low: -0.49, ci_high: 0.18 }));
    expect(k).toMatchObject({ ma: "DO_THEM", chu: "ĐO THÊM", coUocLuong: true });
    if (k.loai === "ket_luan") expect(k.cau).toBe(KET_LUAN_THEO_MA.DO_THEM.cau);
  });

  it("chưa đủ khối: vẫn là ĐO THÊM với câu thường, không có chữ CHƯA ĐỦ làm kết luận", () => {
    const k = ketLuanTuBaoCao(
      voiKetQua({ estimable: false, estimate: null, ci_low: null, ci_high: null, n_blocks: 3, message: "Chưa đủ khối — tuyên bố thiếu" }),
    );
    expect(k).toMatchObject({ loai: "ket_luan", ma: "DO_THEM", chu: "ĐO THÊM", coUocLuong: false });
    if (k.loai === "ket_luan") {
      expect(k.cau).toBe(cauChuaDuKhoi(3));
      sach(k.cau);
    }
  });

  it("khoá §7: không có kết luận, lý do đã chuẩn hoá chữ", () => {
    const k = ketLuanTuBaoCao(
      voiKetQua({ khoa: true, ly_do_khoa: "Phiên đang chạy — ước lượng bị khóa", estimate: null, ci_low: null, ci_high: null }),
    );
    expect(k).toEqual({ loai: "khoa", lyDo: CAU_KHOA });
    sach(CAU_KHOA);
    expect(dongPhien(PHIEN, voiKetQua({ khoa: true, n_blocks: 0 }))).toBe("Phiên 90 phút");
  });

  it("phiên quan sát: không có kết luận, câu nói không bốc thăm (không ĐO THÊM cạnh thước khoá)", () => {
    const k = ketLuanTuBaoCao({ ...DOI, loai_phien: "quan_sat", ket_qua_thi_nghiem: null } as BaoCao);
    expect(k).toEqual({ loai: "quan_sat", cau: CAU_QUAN_SAT });
  });

  it("chưa đủ khối: đúng câu canon LOI_THUONG.chuaDuKhoi; đủ khối mà không ước lượng được thì không nói 'vài khối'", () => {
    expect(cauChuaDuKhoi(3)).toBe(LOI_THUONG.chuaDuKhoi);
    expect(cauChuaDuKhoi(0)).toBe(LOI_THUONG.chuaDuKhoi);
    expect(cauChuaDuKhoi(16)).not.toContain("vài khối");
    const k = ketLuanTuBaoCao(voiKetQua({ estimable: false, n_blocks: 3, n_on: 1, n_off: 2, estimate: null, ci_low: null, ci_high: null }));
    expect(k).toMatchObject({ loai: "ket_luan", ma: "DO_THEM", coUocLuong: false, cau: LOI_THUONG.chuaDuKhoi });
  });

  it("chưa có báo cáo thì đang tải", () => {
    expect(ketLuanTuBaoCao(null)).toEqual({ loai: "dang_tai" });
  });
});

describe("nhãn nguồn và dòng ngắn", () => {
  it("map nhãn của bàn sang mã canon", () => {
    expect(maNhanTuNguon(sourceLabel(PHIEN))).toEqual(["MO_PHONG"]);
    const lab = { ...PHIEN, platform: "lab", is_demo: false, dry_run: true } as Session;
    expect(maNhanTuNguon(sourceLabel(lab), lab)).toEqual(["DAN_DUNG", "THU_NOI_BO"]);
    const that = { ...PHIEN, platform: "youtube", is_demo: false } as Session;
    expect(maNhanTuNguon(sourceLabel(that), that)).toEqual(["THAT"]);
  });

  it("Phiên X phút · N khối đo được", () => {
    expect(dongPhien(PHIEN, DOI)).toBe("Phiên 90 phút · 16 khối đo được");
  });

  it("phiên đang live: ghi đã chạy X/Y phút", () => {
    const dangChay = { ...DOI, tong_quan: { ...DOI.tong_quan, thoi_luong_s: 63 * 60 } } as BaoCao;
    expect(dongPhien(PHIEN, dangChay, true)).toBe("Đã chạy 63/90 phút · 16 khối đo được");
    const chuaCoThoiLuong = { ...DOI, tong_quan: { ...DOI.tong_quan, thoi_luong_s: null } } as unknown as BaoCao;
    const batDau = { ...PHIEN, start_ts: "2026-10-19T07:00:00Z" } as Session;
    expect(dongPhien(batDau, chuaCoThoiLuong, true, Date.parse("2026-10-19T07:40:00Z"))).toBe("Đã chạy 40/90 phút · 16 khối đo được");
    expect(dongPhien(batDau, chuaCoThoiLuong, true, Date.parse("2026-10-19T08:43:00Z"))).toBe("Đã chạy 103 phút (dự kiến 90) · 16 khối đo được");
  });

  it("tên phiên bỏ chữ nội bộ của máy gieo mẫu", () => {
    expect(tenPhienHienThi("Demo vàng · ĐỔI #1")).toBe("Phiên mẫu · ĐỔI #1");
    expect(tenPhienHienThi("Phiên đang phát (mô phỏng) · gieo 13:43 19/10")).toBe("Phiên đang phát (mô phỏng)");
    expect(tenPhienHienThi(null)).toBe("Phiên LiveLift");
  });
});

describe("tóm tắt, điều chưa biết, chi tiết", () => {
  it("tóm tắt 3 câu sạch chữ cấm, huy hiệu bằng tiếng Việt", () => {
    const t = tomTatPhien(DOI);
    expect(t).toHaveLength(3);
    for (const c of t) sach(c.text);
    expect(t[0].huyHieu).toBe("Từ bốc thăm");
    // Câu "Việc nên làm…" là lời khuyên: không mang huy hiệu bằng chứng (không "Số đếm").
    expect(t[2].text).toMatch(/^Việc nên làm/);
    expect(t[2].huyHieu).toBeNull();
  });

  it("lưới an toàn cho câu cũ của máy chủ", () => {
    const cu =
      "Chưa đủ bằng chứng (ước lượng -0,173, KTC 95% [-0,490; +0,181] còn chứa 0) — tích lũy thêm ~16 phiên, CV đo được 0,62, kiểm định hoán vị 1.000 lần vẽ lại; nếu chuỗi vẫn null, hiệu ứng thật nhỏ.";
    const moi = lamSachCau(cu);
    sach(moi);
    expect(moi).toContain("từ −0,490 đến +0,181");
    expect(moi).toContain("ước lượng −0,173");
    expect(lamSachCau("dư âm (hiệu ứng lưu)")).toBe("dư âm (hiệu ứng lưu)");
    expect(lamSachCau("tạo thêm 1,2 lượt nhấp trên mỗi 1.000 giây·người xem")).toContain("lượt nhấp hợp lệ / 1.000 giây·người xem");
    expect(moi).toContain("khoảng 16 phiên");
    expect(moi).toContain("kiểm định ngẫu nhiên hoá 1.000 lần bốc thăm lại");
  });

  it("điều chưa biết nói thẳng MÔ PHỎNG và chưa có người bán thật", () => {
    const ds = dieuChuaBiet(["MO_PHONG"], DOI, true);
    expect(ds.join(" ")).toContain("MÔ PHỎNG");
    expect(ds).toContain("Chưa có phiên nào với người bán thật.");
    for (const c of ds) sach(c);
    expect(dieuChuaBiet(["THAT"], DOI, false)).not.toContain("Chưa có phiên nào với người bán thật.");
  });

  it("chi tiết cho người kiểm có p, kiểm định ngẫu nhiên hoá, khối bỏ, mã băm lịch", () => {
    const khoi = Array.from({ length: 18 }, (_, i) => ({
      block_id: `b${i}`,
      block_index: i,
      phase: "mid",
      assignment: i % 2 ? "ON" : "OFF",
      is_washout: false,
      start_offset_s: i * 300,
      end_offset_s: (i + 1) * 300,
    })) as never;
    const ct = chiTietNguoiKiem({ phien: PHIEN, baoCao: DOI, khoi, ticks: [], don: null });
    const theoNhan = Object.fromEntries(ct.map((d) => [d.nhan, d.giaTri]));
    expect(theoNhan["Giá trị p"]).toMatch(/^p < 0,001$/);
    expect(theoNhan["Kiểm định ngẫu nhiên hoá"]).toContain("1.000");
    expect(theoNhan["Khối bỏ, không vào phép đo"]).toBe("2");
    expect(theoNhan["Mã băm lịch đã niêm phong"]).toBe("1a6405509fab…");
    // Số có dấu như thước (+0,932, dấu trừ "−"), nhãn Tỷ lệ nhấp đúng chữ canon.
    expect(theoNhan["Chênh lệch Tỷ lệ nhấp (BẬT trừ TẮT)"]).toBe("+1,224");
    expect(theoNhan["Khoảng tin cậy 95%"]).toBe("từ +0,932 đến +1,498");
    expect(theoNhan).toHaveProperty(["Tỷ lệ nhấp (lượt nhấp hợp lệ / 1.000 giây·người xem)"]);
    const am = chiTietNguoiKiem({ phien: PHIEN, baoCao: voiKetQua({ estimate: -0.173, ci_low: -0.49, ci_high: 0.181 }), khoi, ticks: [], don: null });
    expect(Object.fromEntries(am.map((d) => [d.nhan, d.giaTri]))["Khoảng tin cậy 95%"]).toBe("từ −0,490 đến +0,181");
    // Phiên còn live: khối chưa phát không phải "khối bỏ".
    const live = chiTietNguoiKiem({ phien: { ...PHIEN, status: "live" } as Session, baoCao: DOI, khoi, ticks: [], don: null });
    expect(live.map((d) => d.nhan)).not.toContain("Khối bỏ, không vào phép đo");
    expect(maBamLich(PHIEN)).toHaveLength(64);
    for (const d of ct) sach(`${d.nhan} ${d.giaTri}`);
  });

  it("khoá §7: chi tiết không có ước lượng, khoảng tin cậy hay p", () => {
    const khoa = voiKetQua({ khoa: true, ly_do_khoa: "đang khoá", estimate: null, ci_low: null, ci_high: null, p_value: null, n_draws: null });
    const ct = chiTietNguoiKiem({ phien: PHIEN, baoCao: khoa, khoi: [], ticks: [], don: null });
    const nhan = ct.map((d) => d.nhan);
    expect(nhan).not.toContain("Giá trị p");
    expect(nhan).not.toContain("Khoảng tin cậy 95%");
    expect(nhan).toContain("Vì sao còn khoá");
  });

  it("đếm ý định lấy từ báo cáo", () => {
    expect(demYDinhTuBaoCao(DOI)).toMatchObject({ van_chuyen: expect.any(Number) });
    expect(demYDinhTuBaoCao(null)).toBeNull();
  });
});
