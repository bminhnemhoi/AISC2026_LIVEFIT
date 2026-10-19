import type { SourceKind, SourceLabel } from "@/lib/livelift-api/desk";
import type { BaoCao } from "@/lib/livelift-api/types";

/**
 * Khoá §7 phía giao diện (tiền đăng ký: không nhìn trộm kết quả giữa phiên).
 *
 * Máy chủ là nơi khoá thật: khi `khoa=true` nó không chạy ước lượng nên không có số nào để lộ. Ở đây là lớp thứ hai:
 * - chỉ coi là "đã mở" khi máy chủ nói RÕ `khoa === false` (thiếu báo cáo, phiên quan sát, lỗi mạng: đều là khoá);
 * - báo cáo đang khoá bị xoá mọi trường ước lượng trước khi tới component, kể cả khi máy chủ lỡ gửi;
 * - nền BẬT/TẮT trên đường thời gian và chuỗi Tỷ lệ nhấp theo thời gian (mọi thứ để so BẬT với TẮT khi còn khoá)
 *   chỉ có ở phiên do máy sinh (MÔ PHỎNG). Phiên THẬT, CHẠY THỬ, THỬ NỘI BỘ và DÀN DỰNG: không, tới khi máy chủ trả
 *   `khoa=false` (D-027). Dùng `choHienTyLeNhapTheoThoiGian` ở mọi màn.
 */

type CoKetQua = Pick<BaoCao, "loai_phien" | "ket_qua_thi_nghiem">;

/** True chỉ khi đây là phiên thí nghiệm và máy chủ báo kết quả không khoá. */
export function daMoKhoa(baoCao: CoKetQua | null | undefined): boolean {
  return !!baoCao && baoCao.loai_phien === "thi_nghiem" && baoCao.ket_qua_thi_nghiem?.khoa === false;
}

/** Báo cáo an toàn để đưa xuống giao diện: khi khoá thì không còn ước lượng, khoảng tin cậy hay p. */
export function chanUocLuongKhiKhoa<T extends CoKetQua>(baoCao: T): T {
  const k = baoCao.ket_qua_thi_nghiem;
  if (!k || k.khoa === false) return baoCao;
  return {
    ...baoCao,
    ket_qua_thi_nghiem: { ...k, khoa: true, estimable: false, estimate: null, ci_low: null, ci_high: null, p_value: null, n_draws: null },
  };
}

/**
 * Nguồn được mở sớm (tô nền theo khối, chuỗi Tỷ lệ nhấp theo thời gian) khi máy chủ còn khoá. D-027: chỉ MÔ PHỎNG,
 * vì số do máy sinh. DÀN DỰNG, THỬ NỘI BỘ, CHẠY THỬ và THẬT đều có người bấm nên khoá tới khi máy chủ trả `khoa=false`.
 */
export const NGUON_DUOC_TO_NEN: ReadonlySet<SourceKind> = new Set<SourceKind>(["mo_phong"]);

export interface QuyenToNen {
  cho: boolean;
  /** Dòng giải thích đặt dưới biểu đồ; null khi không cần nói gì. */
  dong: string | null;
}

/** Nhãn chính, bỏ phần phụ sau dấu chấm giữa: "DÀN DỰNG · CHƯA XÁC MINH" → "DÀN DỰNG". */
function nhanChinh(text: string): string {
  return text.split("·")[0].trim();
}

/** Phòng THỬ NỘI BỘ mang nhãn "DÀN DỰNG · THỬ NỘI BỘ" (desk.sourceLabel). */
function laThuNoiBo(text: string): boolean {
  return /THỬ NỘI BỘ/.test(text);
}

/** Tên ngắn của nguồn cho câu giải thích: "THỬ NỘI BỘ" cho phòng thử nội bộ, còn lại là nhãn chính. */
function tenNguon(nguon: Pick<SourceLabel, "text">): string {
  return laThuNoiBo(nguon.text) ? "THỬ NỘI BỘ" : nhanChinh(nguon.text);
}

/** Câu khi MÔ PHỎNG đang live và được mở sớm. */
export const CAU_MO_SOM_MO_PHONG =
  "Đây là MÔ PHỎNG nên BẬT/TẮT và Tỷ lệ nhấp theo thời gian hiện ngay; phiên có người thật bấm chỉ hiện khi hết phiên.";

/**
 * Có được tô nền BẬT/TẮT lên đường thời gian, và hiện chuỗi Tỷ lệ nhấp theo thời gian, không (D-027).
 * - Máy chủ đã mở (`khoa === false`): được, không cần dòng giải thích.
 * - Còn khoá, nguồn MÔ PHỎNG: được (mở sớm); đang live thì nói rõ vì sao, hết phiên thì không nói gì.
 * - Còn khoá, nguồn khác (THẬT, CHẠY THỬ, THỬ NỘI BỘ, DÀN DỰNG): không, kèm dòng giải thích.
 * `khoa` mặc định true: thiếu thông tin thì coi như còn khoá.
 */
export function quyenToNenKhoi(nguon: Pick<SourceLabel, "kind" | "text">, dangLive: boolean, khoa = true): QuyenToNen {
  if (khoa === false) return { cho: true, dong: null };
  if (NGUON_DUOC_TO_NEN.has(nguon.kind) && !laThuNoiBo(nguon.text)) {
    return { cho: true, dong: dangLive ? CAU_MO_SOM_MO_PHONG : null };
  }
  const ten = tenNguon(nguon);
  if (dangLive) {
    return {
      cho: false,
      dong: `Phiên ${ten} đang live: biểu đồ chưa tô màu BẬT/TẮT và chưa hiện Tỷ lệ nhấp theo thời gian tới khi hết phiên, để không ai nhìn trộm kết quả giữa chừng.`,
    };
  }
  return { cho: false, dong: `Kết quả của phiên ${ten} chưa mở: biểu đồ chưa tô màu BẬT/TẮT và chưa hiện Tỷ lệ nhấp theo thời gian.` };
}

/**
 * Hàm dùng chung cho mọi màn (D-027): có được hiện chuỗi Tỷ lệ nhấp theo thời gian (đường, đường nhỏ, bảng thay ảnh,
 * câu mô tả, ô nhắc, dải Tỷ lệ nhấp trong Nhịp phòng) và tô nền theo khối không. Chỉ MÔ PHỎNG được mở sớm; nguồn khác
 * phải chờ máy chủ trả `khoa=false`. Thiếu nguồn thì chỉ mở khi máy chủ đã mở.
 * Người xem và tổng lượt nhấp hợp lệ cả phiên thì luôn được hiện.
 */
export function choHienTyLeNhapTheoThoiGian(
  nguon: Pick<SourceLabel, "kind" | "text"> | null | undefined,
  dangLive: boolean,
  khoa: boolean,
): boolean {
  if (!nguon) return khoa === false;
  return quyenToNenKhoi(nguon, dangLive, khoa).cho;
}
