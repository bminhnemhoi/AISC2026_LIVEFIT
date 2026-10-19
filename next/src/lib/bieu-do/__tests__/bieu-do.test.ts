import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tuongPhan } from "@/components/nen/token";
import { funnel } from "@/lib/livelift-api/desk";
import { ExperimentSummarySchema } from "@/lib/livelift-api/gop";
import { BaoCaoSchema, BlockSchema, CommentSchema, SessionSchema, TickSchema, type Block, type Tick } from "@/lib/livelift-api/types";
import { KET_LUAN_THEO_MA } from "@/lib/tu-ngu";
import gopVangJson from "@/lib/livelift-api/__tests__/fixtures/gop-demo-vang.json";
import gopMotJson from "@/lib/livelift-api/__tests__/fixtures/gop-demo-mot-phien.json";
import doi1Json from "./fixtures/phien-doi-1.json";
import doThem1Json from "./fixtures/phien-do-them-1.json";
import chuaDuJson from "./fixtures/phien-chua-du-khoi.json";
import liveJson from "./fixtures/phien-mo-phong-dang-live.json";
import khoaJson from "./fixtures/phien-thu-noi-bo-khoa.json";
import {
  BIEN,
  BIEN_VIEN_TAT,
  KET_LUAN,
  MA_CUA_VUNG,
  MAT_THE,
  MAU,
  NEN,
  TRUC,
  VIEN_TAT,
  PHU_DE_BAT,
  PHU_DE_KHOANG_TIN_CAY,
  PHU_DE_TAT,
  TY_LE_NHAP,
  TY_LE_NHAP_DAY_DU,
  bangCham,
  bangDuongThoiGian,
  bangPheu,
  bangRung,
  bangThuoc,
  bangYDinh,
  buocDep,
  chanUocLuongKhiKhoa,
  chuoiThoiGian,
  coNguonDon,
  daMoKhoa,
  daiKhoi,
  demYDinh,
  dinhNguoiXem,
  doDai,
  dongRungGop,
  dongRungTuBaoCao,
  duongDut,
  duongNhoTyLeNhap,
  ganNhat,
  hinhThoi,
  hinhThoiKhoang,
  khoiTuTicks,
  mienDoiXung,
  moTaCham,
  moTaDuongNho,
  moTaDuongThoiGian,
  moTaPheu,
  moTaRung,
  moTaThuoc,
  moTaYDinh,
  nhanhTai,
  pheuTuXemDenMua,
  phanTram,
  quyenToNenKhoi,
  soDau,
  soGon,
  soNguyen,
  thangTuyenTinh,
  thanhNgang,
  theoCuaSo,
  trungBinhNhanh,
  vachThoiGian,
  vachTu0,
  vungCua,
  vungDuoi,
  yDinhSapXep,
} from "..";

/** Một phiên mẫu chụp từ API :8000 ngày 19/10 (scripts gieo `demo/seed-vang`, `demo/seed`, phòng thử nội bộ). */
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
const doThem1 = phienMau(doThem1Json);
const chuaDu = phienMau(chuaDuJson);
const live = phienMau(liveJson);
const khoa = phienMau(khoaJson);

/** Mọi chữ công khai: không gạch dài, không chữ tắt KTC, không thuật ngữ cũ. (Tên phiên mẫu "CHƯA ĐỦ KHỐI" là tên, được phép.) */
function chuSach(s: string): void {
  expect(s).not.toMatch(/—/);
  expect(s).not.toMatch(/\bKTC\b/);
  expect(s).not.toMatch(/khúc|khoá lịch|lượt bấm trên 1\.000 giây|hoán vị/);
  expect(s).not.toMatch(/\b(click|bucket|viewer|estimate)\b/i);
}

describe("thang và vạch", () => {
  it("thang tuyến tính, miền rỗng trả giữa khoảng", () => {
    const t = thangTuyenTinh([0, 10], [100, 0]);
    expect(t(0)).toBe(100);
    expect(t(5)).toBe(50);
    expect(thangTuyenTinh([3, 3], [0, 10])(3)).toBe(5);
  });

  it("bước đẹp 1/2/2,5/5 × 10^k", () => {
    expect(buocDep(10, 4)).toBe(2.5);
    expect(buocDep(62, 4)).toBe(20);
    expect(buocDep(0.9, 4)).toBe(0.25);
    expect(buocDep(0)).toBe(1);
  });

  it("trục giá trị luôn bắt đầu ở 0 và phủ đỉnh", () => {
    const { max, vach } = vachTu0(62);
    expect(vach[0]).toBe(0);
    expect(max).toBeGreaterThanOrEqual(62);
    expect(vach[vach.length - 1]).toBe(max);
    expect(vachTu0(0).vach).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(vachTu0(0.3).vach.every((v) => Number(v.toFixed(6)) === v)).toBe(true);
  });

  it("miền thước đối xứng quanh 0 và chứa 0", () => {
    const m = mienDoiXung([0.93, 1.5, 1.22]);
    expect(m.min).toBe(-m.max);
    expect(m.max).toBeGreaterThan(1.5);
    expect(m.vach).toContain(0);
    expect(mienDoiXung([]).max).toBe(1);
  });

  it("vạch thời gian không quá số nhãn cho phép", () => {
    const v = vachThoiGian(5400, 600, 72);
    expect(v[0]).toBe(0);
    expect(v.length).toBeLessThanOrEqual(Math.floor(600 / 72) + 1);
    expect(v[1] - v[0]).toBeGreaterThanOrEqual(600);
  });
});

describe("cách viết số vi-VN", () => {
  it("dấu phẩy thập phân, dấu trừ in", () => {
    expect(soGon(1.2345, 2)).toBe("1,23");
    expect(soGon(-0.5, 1)).toBe("−0,5");
    expect(soGon(-0.001, 1)).toBe("0");
    expect(soDau(1.2235)).toBe("+1,224");
    expect(soDau(-0.1733)).toBe("−0,173");
    expect(soNguyen(1645)).toBe("1.645");
    expect(phanTram(0.375)).toBe("38%");
    expect(doDai(5400)).toBe("1 giờ 30 phút");
    expect(doDai(2700)).toBe("45 phút");
  });
});

describe("hình học", () => {
  it("đường đứt ở chỗ thiếu số, không nối qua", () => {
    const d = duongDut([
      { x: 0, y: 10 },
      { x: 1, y: 20 },
      { x: 2, y: null },
      { x: 3, y: 5 },
      { x: 4, y: 6 },
    ]);
    expect(d.match(/M/g)?.length).toBe(2);
    expect(d).toBe("M0,10L1,20M3,5L4,6");
    expect(duongDut([{ x: 1, y: 2 }])).toBe("M1,2h0");
    expect(duongDut([])).toBe("");
  });

  it("vùng tô đóng về đáy, bỏ đoạn một điểm", () => {
    expect(vungDuoi([{ x: 0, y: 10 }, { x: 2, y: 4 }], 20)).toBe("M0,10L2,4L2,20L0,20Z");
    expect(vungDuoi([{ x: 0, y: 10 }], 20)).toBe("");
  });

  it("điểm gần nhất", () => {
    expect(ganNhat([0, 30, 60, 90], 44)).toBe(1);
    expect(ganNhat([0, 30, 60, 90], 46)).toBe(2);
    expect(ganNhat([0, 30], -5)).toBe(0);
    expect(ganNhat([0, 30], 500)).toBe(1);
    expect(ganNhat([], 1)).toBe(-1);
  });

  it("hình thoi và thanh bo một đầu", () => {
    expect(hinhThoi(10, 10, 4, 6)).toBe("M6,10L10,4L14,10L10,16Z");
    expect(hinhThoiKhoang(2, 5, 12, 10, 3)).toBe("M2,10L5,7L12,10L5,13Z");
    const t = thanhNgang(0, 0, 100, 20);
    expect(t.startsWith("M0,0H96Q100,0 100,4")).toBe(true);
    expect(t.endsWith("H0Z")).toBe(true);
    expect(thanhNgang(0, 0, 2, 20)).toContain("Q2,0 2,2");
  });
});

describe("chuỗi thời gian từ điểm đo thật của API", () => {
  it("mỗi điểm đo một điểm, trục giây từ đầu phiên", () => {
    const c = chuoiThoiGian(doi1.ticks, doi1.phien.start_ts);
    expect(c).toHaveLength(180);
    expect(c[0].t).toBeCloseTo(0, 3);
    expect(c[1].t).toBeCloseTo(30, 3);
    expect(c[179].t).toBeCloseTo(5370, 3);
    expect(Math.max(...c.map((d) => d.nguoiXem))).toBeCloseTo((doi1.baoCao.tong_quan.nguoi_xem as { dinh: number }).dinh, 6);
  });

  it("tỷ lệ nhấp trượt 2 phút, null khi mẫu số dưới 60 giây·người xem", () => {
    const tick = (s: number, viewers: number, clicks: number): Tick => ({
      ts_bucket: new Date(Date.UTC(2026, 9, 19, 0, 0, s)).toISOString(),
      viewers,
      comment_rate: 0,
      click_count: clicks,
    });
    const ticks = [tick(0, 1, 0), tick(30, 10, 3), tick(60, 10, 3), tick(90, 10, 0), tick(120, 10, 0), tick(150, 10, 0)];
    const c = chuoiThoiGian(ticks, ticks[0].ts_bucket, 120);
    expect(c[0].tyLeNhap).toBeNull(); // 30 giây·người xem
    expect(c[1].tyLeNhap).toBeCloseTo((3 / 330) * 1000, 6);
    // Tại 150 giây, cửa sổ 120 giây giữ các ô 60, 90, 120, 150.
    expect(c[5].tyLeNhap).toBeCloseTo((3 / 1200) * 1000, 6);
  });

  it("không có giờ bắt đầu thì không có trục thời gian", () => {
    expect(chuoiThoiGian(doi1.ticks, null)).toEqual([]);
    expect(khoiTuTicks(doi1.khoi, doi1.ticks, null)).toEqual([]);
  });

  it("gộp theo cửa sổ 5 phút cho đường nhỏ", () => {
    const w = theoCuaSo(doi1.ticks, doi1.phien.start_ts);
    expect(w).toHaveLength(18);
    expect(w[0].tu).toBe(0);
    expect(w.reduce((s, x) => s + x.nhap, 0)).toBe(294);
    expect(theoCuaSo(doi1.ticks, null)).toEqual([]);
  });

  it("đường nhỏ Tỷ lệ nhấp: phiên THẬT hay THỬ NỘI BỘ đang live (khoá, không được mở sớm) thì không có chuỗi nào", () => {
    const that = quyenToNenKhoi({ kind: "that", text: "THẬT" }, true);
    expect(duongNhoTyLeNhap(live.ticks, live.phien, { khoa: true, toNen: that })).toBeNull();
    const thuNoiBo = quyenToNenKhoi({ kind: "dan_dung", text: "DÀN DỰNG · THỬ NỘI BỘ" }, true);
    expect(duongNhoTyLeNhap(live.ticks, live.phien, { khoa: true, toNen: thuNoiBo })).toBeNull();
    // Thiếu quyền thì coi như khoá.
    expect(duongNhoTyLeNhap(live.ticks, live.phien, { khoa: true })).toBeNull();
    expect(duongNhoTyLeNhap(live.ticks, live.phien, { khoa: true, toNen: null })).toBeNull();
  });

  it("đường nhỏ Tỷ lệ nhấp: MÔ PHỎNG (mở sớm) hay đã mở khoá thì có chuỗi, cửa sổ trượt không theo khối", () => {
    const moPhong = quyenToNenKhoi({ kind: "mo_phong", text: "MÔ PHỎNG" }, true);
    const c = duongNhoTyLeNhap(live.ticks, live.phien, { khoa: true, toNen: moPhong });
    expect(Array.isArray(c)).toBe(true);
    expect((c as Array<number | null>).length).toBeGreaterThan(2);
    // Phiên đã mở khoá: có chuỗi, mỗi phút một điểm (90 phút: khoảng 90 điểm), không phải 18 điểm của từng khối 5 phút.
    const daMo = duongNhoTyLeNhap(doi1.ticks, doi1.phien, { khoa: false }) as Array<number | null>;
    expect(daMo.length).toBeGreaterThanOrEqual(85);
    expect(daMo.length).toBeLessThanOrEqual(92);
    // Mỗi điểm là cửa sổ trượt 2 phút, không phải tỷ lệ của một khối 5 phút.
    const tron = chuoiThoiGian(doi1.ticks, doi1.phien.start_ts, 120).map((d) => d.tyLeNhap);
    expect(daMo[daMo.length - 1]).toBe(tron[tron.length - 1]);
    const khoi5 = theoCuaSo(doi1.ticks, doi1.phien.start_ts, 300).map((w) => w.tyLeNhap);
    expect(daMo).not.toEqual(khoi5);
    expect(duongNhoTyLeNhap(doi1.ticks, { start_ts: null }, { khoa: false })).toEqual([]);
  });

  it("đỉnh người xem", () => {
    expect(dinhNguoiXem([])).toBeNull();
    expect(dinhNguoiXem(live.ticks)).toBe(62);
  });
});

describe("tỷ lệ nhấp từng khối khớp ước lượng của máy chủ", () => {
  it.each([
    ["ĐỔI #1", doi1],
    ["ĐO THÊM #1", doThem1],
  ])("%s: hiệu trung bình BẬT trừ TẮT bằng ước lượng của /bao-cao", (_ten, p) => {
    const k = khoiTuTicks(p.khoi, p.ticks, p.phien.start_ts, p.phien.end_ts);
    const tb = trungBinhNhanh(k);
    const kq = p.baoCao.ket_qua_thi_nghiem!;
    expect(tb.nBat).toBe(kq.n_on);
    expect(tb.nTat).toBe(kq.n_off);
    expect((tb.bat as number) - (tb.tat as number)).toBeCloseTo(kq.estimate as number, 4);
  });

  it("khối quá ít người xem: không đo được, không phải bằng 0", () => {
    const k = khoiTuTicks(chuaDu.khoi, chuaDu.ticks, chuaDu.phien.start_ts, chuaDu.phien.end_ts);
    expect(k).toHaveLength(3);
    const tb = trungBinhNhanh(k);
    expect(tb.nBat + tb.nTat).toBe(chuaDu.baoCao.ket_qua_thi_nghiem!.n_blocks);
    for (const x of k) expect(x.doDuoc ? x.tyLe : null).toBe(x.tyLe);
  });

  it("khối sau lúc phiên dừng: không phát, có lý do", () => {
    const k = khoiTuTicks(doi1.khoi, doi1.ticks.slice(0, 60), doi1.phien.start_ts, doi1.ticks[59].ts_bucket);
    const sau = k.filter((x) => x.tu >= 1800);
    expect(sau.length).toBeGreaterThan(0);
    expect(sau.every((x) => !x.doDuoc && x.tyLe === null && x.lyDo?.includes("không phát"))).toBe(true);
  });

  it("phiên đang live: khối chưa tới bị bỏ, không tính là không đo được", () => {
    const k = khoiTuTicks(live.khoi, live.ticks, live.phien.start_ts, null);
    const cuoi = (live.ticks.length - 1) * 30 + 30;
    expect(k.every((x) => x.tu < cuoi)).toBe(true);
    expect(k.length).toBeLessThan(live.khoi.length);
  });

  it("dải khối sắp theo thời gian, khối khởi động là WASH", () => {
    const blocks: Block[] = [
      { block_id: "b", block_index: 1, phase: "mid", assignment: "ON", is_washout: false, start_offset_s: 300, end_offset_s: 600 },
      { block_id: "a", block_index: 0, phase: "early", assignment: null, is_washout: true, start_offset_s: 0, end_offset_s: 300 },
    ];
    const d = daiKhoi(blocks);
    expect(d.map((x) => x.nhanh)).toEqual(["WASH", "ON"]);
    expect(nhanhTai(d, 450)?.index).toBe(1);
    expect(nhanhTai(d, 9999)).toBeNull();
  });
});

describe("thanh ý định", () => {
  it("sắp giảm dần, Khác luôn cuối, phần cộng lại bằng 1", () => {
    const d = yDinhSapXep(demYDinh(doi1.binhLuan));
    expect(d.map((x) => x.nhan)).toEqual(["van_chuyen", "chot_don", "che_dat", "hoi_gia", "hoi_size", "khac"]);
    expect(d[0].ten).toBe("Vận chuyển");
    expect(d.reduce((s, x) => s + x.tyLe, 0)).toBeCloseTo(1, 9);
    expect(d.reduce((s, x) => s + x.so, 0)).toBe(64);
  });

  it("quá số nhóm thì gộp đuôi vào Khác, không mất bình luận", () => {
    const d = yDinhSapXep({ a: 5, b: 4, c: 3, d: 2, khac: 1 }, 2);
    expect(d.map((x) => [x.nhan, x.so])).toEqual([
      ["a", 5],
      ["b", 4],
      ["khac", 6],
    ]);
  });

  it("bình luận chưa có nhãn bị bỏ qua; rỗng thì không có thanh", () => {
    expect(demYDinh([{ intent: null }, { intent: "hoi_gia" }])).toEqual({ hoi_gia: 1 });
    expect(yDinhSapXep({})).toEqual([]);
  });
});

describe("khoá §7 phía giao diện", () => {
  it("chỉ mở khi máy chủ nói rõ khoa === false", () => {
    expect(daMoKhoa(doi1.baoCao)).toBe(true);
    expect(daMoKhoa(khoa.baoCao)).toBe(false);
    expect(daMoKhoa(null)).toBe(false);
    expect(daMoKhoa({ loai_phien: "quan_sat", ket_qua_thi_nghiem: null })).toBe(false);
    expect(daMoKhoa({ loai_phien: "thi_nghiem", ket_qua_thi_nghiem: undefined })).toBe(false);
  });

  it("báo cáo đang khoá bị xoá mọi ước lượng, kể cả khi máy chủ lỡ gửi", () => {
    const loGui = { ...khoa.baoCao, ket_qua_thi_nghiem: { ...khoa.baoCao.ket_qua_thi_nghiem!, estimate: 9, ci_low: 1, ci_high: 2, p_value: 0.01, estimable: true } };
    const an = chanUocLuongKhiKhoa(loGui);
    expect(an.ket_qua_thi_nghiem).toMatchObject({ khoa: true, estimable: false, estimate: null, ci_low: null, ci_high: null, p_value: null });
    expect(chanUocLuongKhiKhoa(doi1.baoCao)).toBe(doi1.baoCao);
  });

  it("tô nền khối: MÔ PHỎNG và DÀN DỰNG được (mở khoá sớm), THẬT và THỬ NỘI BỘ đang live thì không", () => {
    expect(quyenToNenKhoi({ kind: "mo_phong", text: "MÔ PHỎNG" }, true)).toEqual({ cho: true, dong: "mở khoá sớm vì MÔ PHỎNG" });
    expect(quyenToNenKhoi({ kind: "dan_dung", text: "DÀN DỰNG" }, true)).toEqual({ cho: true, dong: "mở khoá sớm vì DÀN DỰNG" });
    const thuNoiBo = quyenToNenKhoi({ kind: "dan_dung", text: "DÀN DỰNG · THỬ NỘI BỘ" }, true);
    expect(thuNoiBo.cho).toBe(false);
    expect(thuNoiBo.dong).toContain("THỬ NỘI BỘ đang live");
    expect(thuNoiBo.dong).not.toMatch(/mở khoá sớm/);
    expect(quyenToNenKhoi({ kind: "dan_dung", text: "DÀN DỰNG · THỬ NỘI BỘ" }, false).cho).toBe(true);
    const that = quyenToNenKhoi({ kind: "that", text: "THẬT" }, true);
    expect(that.cho).toBe(false);
    expect(that.dong).toContain("không tô nền theo khối");
    expect(quyenToNenKhoi({ kind: "chay_thu", text: "CHẠY THỬ" }, true).cho).toBe(false);
    expect(quyenToNenKhoi({ kind: "that", text: "THẬT" }, false)).toEqual({ cho: false, dong: null });
  });
});

describe("ba vùng kết luận", () => {
  it("ĐỔI khi cả khoảng trên 0, GIỮ khi cả khoảng dưới 0, ĐO THÊM khi chạm 0", () => {
    expect(vungCua(0.93, 1.5)).toBe("doi");
    expect(vungCua(-0.49, 0.18)).toBe("do_them");
    expect(vungCua(-1, -0.2)).toBe("giu");
    expect(vungCua(0, 1)).toBe("do_them");
    expect(vungCua(NaN, 1)).toBeNull();
  });

  it("chữ kết luận là bí danh của KET_LUAN trong tu-ngu (canon ket_luan), không chép lại", () => {
    const yaml = readFileSync(path.resolve(process.cwd(), "../docs/canon/thuat-ngu.yaml"), "utf8");
    for (const v of ["giu", "do_them", "doi"] as const) {
      const canon = KET_LUAN_THEO_MA[MA_CUA_VUNG[v]];
      expect(KET_LUAN[v]).toEqual({ chu: canon.chu, cau: canon.cau, nhanThuoc: canon.nhan_thuoc });
      expect(yaml).toContain(`nhan_thuoc: "${KET_LUAN[v].nhanThuoc}"`);
      expect(yaml).toContain(`cau: "${KET_LUAN[v].cau}"`);
      expect(yaml).toContain(`chu: "${KET_LUAN[v].chu}"`);
    }
  });

  it("chữ khớp canon thuat-ngu.yaml (phu_de, ngan)", () => {
    const yaml = readFileSync(path.resolve(process.cwd(), "../docs/canon/thuat-ngu.yaml"), "utf8");
    expect(yaml).toContain(`phu_de: "${PHU_DE_KHOANG_TIN_CAY}"`);
    expect(yaml).toContain(`ngan: "${TY_LE_NHAP}"`);
    expect(yaml).toContain(`- dung: "${TY_LE_NHAP_DAY_DU}"`);
    expect(yaml).toContain(`${PHU_DE_BAT} · ${PHU_DE_TAT}"`);
    for (const v of Object.values(KET_LUAN)) {
      expect(`${v.chu} ${v.cau}`).not.toMatch(/CHƯA ĐỦ/);
      chuSach(v.cau);
      chuSach(v.nhanThuoc);
    }
  });
});

describe("màu D-026", () => {
  it("giá trị sáng đúng D-026", () => {
    expect([MAU.bat.sang, MAU.tat.sang, MAU.nguoiXem.sang, MAU.luotNhap.sang, MAU.don.sang]).toEqual(["#3d6b4f", "#8a8f98", "#2f74b5", "#c8691c", "#9b4fb0"]);
  });

  it("nét dữ liệu đạt 3:1 trên nền (WCAG 1.4.11), trừ TẮT sáng có mã phụ (sọc, chữ T)", () => {
    for (const ten of ["bat", "nguoiXem", "luotNhap", "don", "trung"] as const) {
      expect(tuongPhan(MAU[ten].sang, NEN.sang)).toBeGreaterThanOrEqual(3);
      expect(tuongPhan(MAU[ten].toi, NEN.toi)).toBeGreaterThanOrEqual(3);
    }
    expect(tuongPhan(MAU.tat.sang, NEN.sang)).toBeLessThan(3);
  });

  it("viền chấm TẮT, sọc và trục đạt 3:1 trên nền và mặt thẻ, cả sáng lẫn tối (soát đợt 1 mục 15)", () => {
    for (const [mau, ten] of [
      [VIEN_TAT, "viền TẮT"],
      [TRUC, "trục"],
    ] as const) {
      expect(tuongPhan(mau.sang, NEN.sang), `${ten} sáng / nền`).toBeGreaterThanOrEqual(3);
      expect(tuongPhan(mau.sang, MAT_THE.sang), `${ten} sáng / thẻ`).toBeGreaterThanOrEqual(3);
      expect(tuongPhan(mau.toi, NEN.toi), `${ten} tối / nền`).toBeGreaterThanOrEqual(3);
      expect(tuongPhan(mau.toi, MAT_THE.toi), `${ten} tối / thẻ`).toBeGreaterThanOrEqual(3);
    }
    // Màu tô TẮT giữ D-026; CSS khai báo đúng các giá trị đã kiểm.
    expect(MAU.tat.sang).toBe("#8a8f98");
    const css = readFileSync(path.resolve(process.cwd(), "src/components/bieu-do/bieu-do.css"), "utf8");
    expect(css).toContain(`--bd-tat-vien: var(--n-tat-chu, ${VIEN_TAT.sang});`);
    expect(css).toContain(`--bd-tat-vien: ${VIEN_TAT.toi};`);
    expect(css.match(new RegExp(`--bd-truc: ${TRUC.sang};`, "g"))).toHaveLength(2);
    expect(css).not.toMatch(/--bd-truc: #a99b89/);
    expect(BIEN_VIEN_TAT).toBe("var(--bd-tat-vien)");
  });

  it("mã vẽ dùng biến CSS", () => {
    expect(BIEN.bat).toBe("var(--bd-bat)");
  });
});

describe("biểu đồ rừng", () => {
  it("phiên có ước lượng: số nguyên từ /bao-cao, vùng theo khoảng", () => {
    const d = dongRungTuBaoCao(doi1.phien, doi1.baoCao);
    expect(d).toMatchObject({ coSo: true, vung: "doi", nhan: "MÔ PHỎNG", ten: "Demo vàng · ĐỔI #1" });
    if (d.coSo) expect(d.uocLuong).toBe(doi1.baoCao.ket_qua_thi_nghiem!.estimate);
    expect(dongRungTuBaoCao(doThem1.phien, doThem1.baoCao)).toMatchObject({ coSo: true, vung: "do_them" });
  });

  it("phiên khoá hay thiếu khối vẫn có hàng, kèm lý do", () => {
    expect(dongRungTuBaoCao(khoa.phien, khoa.baoCao)).toMatchObject({ coSo: false, lyDo: "Khoá tới khi hết phiên.", nhan: "DÀN DỰNG · THỬ NỘI BỘ" });
    const thieu = dongRungTuBaoCao(chuaDu.phien, chuaDu.baoCao);
    expect(thieu.coSo).toBe(false);
    if (!thieu.coSo) chuSach(thieu.lyDo);
    expect(dongRungTuBaoCao(doi1.phien, null)).toMatchObject({ coSo: false });
  });

  it("hàng gộp: hình thoi, nhãn MÔ PHỎNG cho kho demo", () => {
    const g = dongRungGop(ExperimentSummarySchema.parse(gopVangJson));
    expect(g).toMatchObject({ loai: "gop", coSo: true, vung: "doi", nhan: "MÔ PHỎNG", ten: "Gộp 6 phiên" });
    const mot = dongRungGop(ExperimentSummarySchema.parse(gopMotJson));
    expect(mot.coSo).toBe(false);
  });
});

describe("câu mô tả thay ảnh", () => {
  it("đường thời gian nói khoảng, đỉnh, tỷ lệ gần nhất; nói nền khối chỉ khi có", () => {
    const c = chuoiThoiGian(doi1.ticks, doi1.phien.start_ts);
    const khong = moTaDuongThoiGian(c);
    expect(khong).toContain("1 giờ 30 phút");
    expect(khong).not.toContain("Nền tô theo khối");
    const co = moTaDuongThoiGian(c, { dai: daiKhoi(doi1.khoi) });
    expect(co).toContain("9 khối BẬT, 7 khối TẮT");
    chuSach(co);
    expect(moTaDuongThoiGian([])).toContain("chưa có điểm đo");
  });

  it("thước, chấm, rừng, ý định, phễu, đường nhỏ", () => {
    const cau = [
      moTaThuoc(1.2235, 0.932, 1.498, "doi"),
      moTaCham(khoiTuTicks(doi1.khoi, doi1.ticks, doi1.phien.start_ts, doi1.phien.end_ts), trungBinhNhanh(khoiTuTicks(doi1.khoi, doi1.ticks, doi1.phien.start_ts, doi1.phien.end_ts))),
      moTaRung([dongRungTuBaoCao(doi1.phien, doi1.baoCao), dongRungTuBaoCao(chuaDu.phien, chuaDu.baoCao)], dongRungGop(ExperimentSummarySchema.parse(gopVangJson))),
      moTaYDinh(yDinhSapXep(demYDinh(doi1.binhLuan))),
      moTaPheu(funnel(doi1.ticks, null), false),
      moTaDuongNho("Người xem", [1, null, 3]),
    ];
    expect(cau[0]).toContain("+1,224");
    expect(cau[0]).toContain("ĐỔI");
    expect(cau[1]).toContain("9 khối BẬT đo được");
    expect(cau[2]).toContain("Kết quả gộp");
    expect(cau[3]).toContain("64 bình luận");
    expect(cau[4]).toContain("chưa có nguồn đơn");
    expect(cau[5]).toBe("Người xem: 2 điểm, gần nhất 3, cao nhất 3.");
    cau.forEach(chuSach);
    expect(moTaDuongNho("Đơn", [null])).toBe("Đơn: chưa có số.");
  });
});

describe("từ xem đến mua", () => {
  it("không có nguồn đơn thì không in 0", () => {
    const p = pheuTuXemDenMua(funnel(doi1.ticks, { tong_don: 0, tong_san_pham: 0, tong_doanh_thu: 0 }), false);
    expect(p.buoc[2].so).toBeNull();
    expect(p.buoc[2].thieu).toContain("Chưa có nguồn đơn");
    expect(p.noi[1].giaTri).toBeNull();
    expect(p.buoc[1].so).toBe("294");
  });

  it("phòng xem có nguồn đơn tiền ảo", () => {
    expect(coNguonDon({ platform: "lab" })).toBe(true);
    expect(coNguonDon({ platform: "sim" })).toBe(false);
    expect(coNguonDon(null)).toBe(false);
    const p = pheuTuXemDenMua(funnel(doi1.ticks, { tong_don: 12, tong_san_pham: 12, tong_doanh_thu: 0 }), true, "Đơn tiền ảo");
    expect(p.buoc[2]).toMatchObject({ so: "12", ten: "Đơn tiền ảo" });
    expect(p.noi[1].giaTri).toBe(soGon((12 / 294) * 100, 1));
  });
});

describe("bảng thay biểu đồ", () => {
  it("đường thời gian: mỗi 5 phút một dòng, cột Khối chỉ khi được tô nền", () => {
    const c = chuoiThoiGian(doi1.ticks, doi1.phien.start_ts);
    const b = bangDuongThoiGian(c, null);
    expect(b.cot).toEqual(["Thời điểm", "Người xem", "Tỷ lệ nhấp"]);
    expect(b.hang.length).toBe(19); // 0, 5, ..., 85 phút và điểm cuối
    const k = bangDuongThoiGian(c, daiKhoi(doi1.khoi));
    expect(k.cot).toContain("Khối");
    expect(k.hang[0][3]).toBe("1 · BẬT");
  });

  it("các bảng khác có đủ dòng và chữ sạch", () => {
    const k = khoiTuTicks(doi1.khoi, doi1.ticks, doi1.phien.start_ts, doi1.phien.end_ts);
    const bang = [
      bangThuoc(1.2235, 0.932, 1.498, "doi"),
      bangCham(k, trungBinhNhanh(k)),
      bangRung([dongRungTuBaoCao(doi1.phien, doi1.baoCao)], null),
      bangYDinh(yDinhSapXep(demYDinh(doi1.binhLuan))),
      bangPheu(pheuTuXemDenMua(funnel(doi1.ticks, null), false)),
    ];
    expect(bang[1].hang).toHaveLength(18);
    expect(bang[4].hang).toHaveLength(5);
    for (const b of bang) chuSach([b.tieuDe, ...b.cot, ...b.hang.flat()].join(" | "));
  });
});
