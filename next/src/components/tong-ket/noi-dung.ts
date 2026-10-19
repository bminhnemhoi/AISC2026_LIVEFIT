import { daMoKhoa } from "@/lib/bieu-do/khoa";
import { vungCua, type VungKetLuan } from "@/lib/bieu-do/ket-luan";
import { coNguonDon } from "@/lib/bieu-do/pheu";
import { fmtFixed, fmtNum, fmtP, funnel, type SourceLabel } from "@/lib/livelift-api/desk";
import { chuanHoaChu } from "@/lib/livelift-api/gop";
import type { BaoCao, Block, OrderSummary, Session, Tick } from "@/lib/livelift-api/types";
import { KET_LUAN_THEO_MA, type MaKetLuan, type MaNhanNguon } from "@/lib/tu-ngu";

/**
 * Chữ và số của màn tổng kết, tách khỏi React để test được. Mọi câu từ máy chủ đi qua `chuanHoaChu` (bỏ dấu gạch dài,
 * "KTC", "hoán vị", chính tả "khóa").
 */

/* ---------- nhãn nguồn ---------- */

/** Nhãn nguồn canon của một phiên, từ nhãn của bàn thí nghiệm (`sourceLabel`). "CHẠY THỬ" của bàn cũ là THỬ NỘI BỘ. */
export function maNhanTuNguon(nguon: SourceLabel | null, phien?: Pick<Session, "dry_run" | "is_demo"> | null): MaNhanNguon[] {
  if (!nguon) return ["MO_PHONG"];
  switch (nguon.kind) {
    case "mo_phong":
      return ["MO_PHONG"];
    case "dan_dung":
      return phien?.dry_run && !phien.is_demo ? ["DAN_DUNG", "THU_NOI_BO"] : ["DAN_DUNG"];
    case "chay_thu":
      return ["THU_NOI_BO"];
    case "that":
      return ["THAT"];
  }
}

/* ---------- kết luận ---------- */

export const VUNG_THEO_MA: Readonly<Record<MaKetLuan, VungKetLuan>> = { DOI: "doi", GIU: "giu", DO_THEM: "do_them" };
const MA_THEO_VUNG: Readonly<Record<VungKetLuan, MaKetLuan>> = { doi: "DOI", giu: "GIU", do_them: "DO_THEM" };

export type KetLuanTongKet =
  | { loai: "dang_tai" }
  /** Khoá §7: không có kết luận, không có số. */
  | { loai: "khoa"; lyDo: string }
  /** `coUocLuong` false khi phiên chưa đủ khối hoặc không bốc thăm: vẫn là ĐO THÊM, không phải "CHƯA ĐỦ". */
  | { loai: "ket_luan"; ma: MaKetLuan; chu: string; cau: string; coUocLuong: boolean };

/** Câu thường cho phiên chưa ước lượng được. Không hứa con số ngưỡng: ngưỡng nằm ở chi tiết cho người kiểm. */
export function cauChuaDuKhoi(nKhoi: number): string {
  return nKhoi > 0
    ? `Mới đo được ${nKhoi} khối, chưa đủ để so khối BẬT với khối TẮT. Chạy thêm phiên rồi gộp lại.`
    : "Chưa có khối nào đo được, nên chưa so được khối BẬT với khối TẮT. Chạy thêm phiên rồi gộp lại.";
}

export const CAU_KHOA = "Kết quả chỉ mở khi phiên kết thúc, để không ai nhìn trộm giữa chừng.";

export const CAU_QUAN_SAT =
  "Phiên này không bốc thăm BẬT/TẮT, nên chưa so được. Lần sau bật Chế độ Thí nghiệm để đo.";

export function ketLuanTuBaoCao(baoCao: BaoCao | null | undefined): KetLuanTongKet {
  if (!baoCao) return { loai: "dang_tai" };
  if (baoCao.loai_phien === "quan_sat") {
    return { loai: "ket_luan", ma: "DO_THEM", chu: KET_LUAN_THEO_MA.DO_THEM.chu, cau: CAU_QUAN_SAT, coUocLuong: false };
  }
  const k = baoCao.ket_qua_thi_nghiem;
  if (!daMoKhoa(baoCao) || !k) {
    // Lời thường trên thẻ; lý do kỹ thuật của máy chủ nằm ở "Chi tiết cho người kiểm" (Vì sao còn khoá).
    return { loai: "khoa", lyDo: CAU_KHOA };
  }
  const coSo = k.estimable && isFiniteNum(k.estimate) && isFiniteNum(k.ci_low) && isFiniteNum(k.ci_high);
  const vung = coSo ? vungCua(k.ci_low as number, k.ci_high as number) : null;
  if (!vung) {
    return { loai: "ket_luan", ma: "DO_THEM", chu: KET_LUAN_THEO_MA.DO_THEM.chu, cau: cauChuaDuKhoi(k.n_blocks), coUocLuong: false };
  }
  const ma = MA_THEO_VUNG[vung];
  return { loai: "ket_luan", ma, chu: KET_LUAN_THEO_MA[ma].chu, cau: KET_LUAN_THEO_MA[ma].cau, coUocLuong: true };
}

function isFiniteNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/* ---------- dòng ngắn dưới kết luận ---------- */

/** "Phiên 90 phút · 16 khối đo được". Thời lượng lấy từ báo cáo (đã phát), không có thì lấy thời lượng dự kiến. */
export function dongPhien(phien: Pick<Session, "planned_duration_min"> | null, baoCao: BaoCao | null): string | null {
  const giay = baoCao?.tong_quan.thoi_luong_s;
  const phut = giay != null && Number.isFinite(giay) ? Math.round(giay / 60) : (phien?.planned_duration_min ?? null);
  const nKhoi = baoCao?.ket_qua_thi_nghiem?.n_blocks;
  const phan: string[] = [];
  if (phut != null) phan.push(`Phiên ${fmtNum(phut, 0)} phút`);
  if (nKhoi != null && daMoKhoa(baoCao)) phan.push(`${nKhoi} khối đo được`);
  return phan.length ? phan.join(" · ") : null;
}

/* ---------- tóm tắt 3 câu ---------- */

const NHAN_HUY_HIEU: Readonly<Record<string, string>> = {
  thi_nghiem: "Từ bốc thăm",
  quan_sat: "Số đếm",
  thieu_du_lieu: "Còn thiếu",
};

export interface CauTomTat {
  text: string;
  huyHieu: string | null;
}

/**
 * Lưới an toàn cho câu của máy chủ chưa nạp lại narrate.py mới (bản cũ còn "null", "~", "lần vẽ lại", "CV"…).
 * narrate.py hiện tại không sinh các cụm này nữa; hàm chỉ đổi chữ, không đổi số.
 */
export function lamSachCau(text: string): string {
  return chuanHoaChu(text)
    .replace(/Hệ thống (tạo thêm|làm GIẢM)/g, "Ghim theo lịch $1")
    .replace(/hệ thống làm/g, "ghim theo lịch làm")
    .replace(/nếu chuỗi vẫn null/gi, "nếu vẫn chưa rõ")
    .replace(/\bnull\b/g, "chưa rõ")
    .replace(/~\s*/g, "khoảng ")
    .replace(/lần vẽ lại/g, "lần bốc thăm lại")
    .replace(/\bCV\b/g, "hệ số biến thiên")
    .replace(/ước lượng đầu tiên/g, "ước lượng")
    .replace(/hiệu ứng/g, "hiệu quả")
    .replace(/\[\s*([^;\]]+);\s*([^\]]+)\]/g, "từ $1 đến $2");
}

export function tomTatPhien(baoCao: BaoCao | null): CauTomTat[] {
  return (baoCao?.tom_tat_3_cau ?? [])
    .map((c) => ({ text: lamSachCau(c.text), huyHieu: c.badge ? (NHAN_HUY_HIEU[c.badge] ?? null) : null }))
    .filter((c) => c.text.length > 0);
}

/* ---------- điều chưa biết ---------- */

/** Giới hạn của kết quả, nói thẳng bằng lời thường. Chỉ dựa trên thứ có trong phiên và báo cáo, không thêm số. */
export function dieuChuaBiet(ma: readonly MaNhanNguon[], baoCao: BaoCao | null, coYDinh: boolean): string[] {
  const ra: string[] = [];
  if (ma.includes("MO_PHONG")) ra.push("Số của phiên này do máy sinh (MÔ PHỎNG) và máy biết trước đáp án. Đây chưa phải buổi live thật.");
  if (ma.includes("DAN_DUNG")) ra.push("Người bấm là người trong phòng xem dàn dựng, mua bằng tiền ảo.");
  if (ma.includes("THU_NOI_BO")) ra.push("Chỉ có người trong nhóm tham gia, nên số này không vào kết quả gộp.");
  if (!ma.includes("THAT")) ra.push("Chưa có phiên nào với người bán thật.");
  const k = baoCao?.ket_qua_thi_nghiem;
  if (k && !k.khoa && k.estimable) ra.push("Một phiên chưa đủ để chốt. Kết luận cuối cùng cần gộp nhiều phiên cùng cách đo.");
  ra.push("Ở đây chỉ đo lượt nhấp, chưa đo doanh thu.");
  if (coYDinh) ra.push("Ý định trong bình luận do máy tự gán nhãn, có thể sai.");
  return ra;
}

/* ---------- chi tiết cho người kiểm ---------- */

export interface DongChiTiet {
  nhan: string;
  giaTri: string;
  /** Giá trị đầy đủ khi `giaTri` đã rút gọn (mã băm). */
  day?: string;
}

/** Mã băm lịch đã niêm phong (session.design.design_hash), nếu máy chủ trả. */
export function maBamLich(phien: Session | null): string | null {
  const design = (phien as { design?: { design_hash?: unknown } } | null)?.design;
  const h = design?.design_hash;
  return typeof h === "string" && h.length > 0 ? h : null;
}

/** Bảng số cho người kiểm: ước lượng, khoảng tin cậy, p, kiểm định ngẫu nhiên hoá, khối bỏ, mã băm lịch, phễu cả phiên. */
export function chiTietNguoiKiem(args: {
  phien: Session | null;
  baoCao: BaoCao | null;
  khoi: Block[];
  ticks: Tick[];
  don: OrderSummary | null;
}): DongChiTiet[] {
  const { phien, baoCao, khoi, ticks, don } = args;
  const ra: DongChiTiet[] = [];
  const k = baoCao?.ket_qua_thi_nghiem;
  const moKhoa = daMoKhoa(baoCao);
  if (k && moKhoa) {
    if (k.estimable && isFiniteNum(k.estimate) && isFiniteNum(k.ci_low) && isFiniteNum(k.ci_high)) {
      ra.push({ nhan: "Chênh lệch tỷ lệ nhấp (BẬT trừ TẮT)", giaTri: `${k.estimate >= 0 ? "+" : ""}${fmtFixed(k.estimate, 3)}` });
      ra.push({ nhan: "Khoảng tin cậy 95%", giaTri: `từ ${fmtFixed(k.ci_low, 3)} đến ${fmtFixed(k.ci_high, 3)}` });
    }
    const p = fmtP(k.p_value ?? null, k.n_draws ?? null);
    if (p) ra.push({ nhan: "Giá trị p", giaTri: p });
    if (k.n_draws) ra.push({ nhan: "Kiểm định ngẫu nhiên hoá", giaTri: `${fmtNum(k.n_draws, 0)} lần bốc thăm lại` });
    if (k.message) ra.push({ nhan: "Ghi chú của máy", giaTri: chuanHoaChu(k.message) });
  }
  if (k) {
    ra.push({ nhan: "Khối đo được", giaTri: `${k.n_blocks} (${k.n_on} BẬT, ${k.n_off} TẮT)` });
    const lich = khoi.filter((b) => !b.is_washout && b.assignment != null).length;
    if (lich > 0 && moKhoa) ra.push({ nhan: "Khối bỏ, không vào phép đo", giaTri: String(Math.max(0, lich - k.n_blocks)) });
    if (!moKhoa && k.ly_do_khoa) ra.push({ nhan: "Vì sao còn khoá", giaTri: chuanHoaChu(k.ly_do_khoa) });
  }
  const bam = maBamLich(phien);
  if (bam) ra.push({ nhan: "Mã băm lịch đã niêm phong", giaTri: `${bam.slice(0, 12)}…`, day: bam });
  const f = funnel(ticks, don);
  ra.push({ nhan: "Phút·người xem", giaTri: fmtNum(f.viewerMinutes, 0) });
  ra.push({ nhan: "Lượt nhấp hợp lệ", giaTri: String(f.clicks) });
  ra.push({ nhan: "Lượt nhấp / 1.000 giây·người xem", giaTri: f.clickRate == null ? "chưa có" : fmtNum(f.clickRate, 3) });
  ra.push({ nhan: phien?.platform === "lab" ? "Đơn (tiền ảo)" : "Đơn", giaTri: coNguonDon(phien) ? String(f.orders) : "chưa có nguồn đơn" });
  ra.push({ nhan: "Bình luận", giaTri: baoCao ? String(baoCao.tong_quan.tong_binh_luan) : "chưa có" });
  if (baoCao?.nhan) ra.push({ nhan: "Loại báo cáo", giaTri: chuanHoaChu(baoCao.nhan) });
  return ra;
}

/** Đếm ý định từ báo cáo (phan_bo_y_dinh.dem_theo_nhan), nếu có. */
export function demYDinhTuBaoCao(baoCao: BaoCao | null): Record<string, number> | null {
  const pb = (baoCao as { phan_bo_y_dinh?: { dem_theo_nhan?: unknown } } | null)?.phan_bo_y_dinh;
  const dem = pb?.dem_theo_nhan;
  if (!dem || typeof dem !== "object") return null;
  const ra: Record<string, number> = {};
  for (const [k, v] of Object.entries(dem as Record<string, unknown>)) if (isFiniteNum(v)) ra[k] = v;
  return Object.keys(ra).length ? ra : null;
}
