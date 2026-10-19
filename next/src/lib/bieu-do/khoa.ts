import type { SourceKind, SourceLabel } from "@/lib/livelift-api/desk";
import type { BaoCao } from "@/lib/livelift-api/types";

/**
 * Khoá §7 phía giao diện (tiền đăng ký: không nhìn trộm kết quả giữa phiên).
 *
 * Máy chủ là nơi khoá thật: khi `khoa=true` nó không chạy ước lượng nên không có số nào để lộ. Ở đây là lớp thứ hai:
 * - chỉ coi là "đã mở" khi máy chủ nói RÕ `khoa === false` (thiếu báo cáo, phiên quan sát, lỗi mạng: đều là khoá);
 * - báo cáo đang khoá bị xoá mọi trường ước lượng trước khi tới component, kể cả khi máy chủ lỡ gửi;
 * - nền BẬT/TẮT trên đường thời gian chỉ có ở phiên do máy sinh (MÔ PHỎNG) hoặc phòng dàn dựng (DÀN DỰNG).
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

/** Nguồn được tô nền theo khối trên đường thời gian, kể cả khi đang live. */
export const NGUON_DUOC_TO_NEN: ReadonlySet<SourceKind> = new Set<SourceKind>(["mo_phong", "dan_dung"]);

export interface QuyenToNen {
  cho: boolean;
  /** Dòng giải thích đặt dưới biểu đồ; null khi không cần nói gì. */
  dong: string | null;
}

/** Nhãn chính, bỏ phần phụ sau dấu chấm giữa: "DÀN DỰNG · THỬ NỘI BỘ" → "DÀN DỰNG". */
function nhanChinh(text: string): string {
  return text.split("·")[0].trim();
}

/**
 * Có được tô nền BẬT/TẮT lên đường thời gian không. MÔ PHỎNG và DÀN DỰNG: được, và nói rõ là mở khoá sớm.
 * THẬT hay CHẠY THỬ đang live: không, đường vẽ một màu tới khi hết phiên.
 */
export function quyenToNenKhoi(nguon: Pick<SourceLabel, "kind" | "text">, dangLive: boolean): QuyenToNen {
  if (NGUON_DUOC_TO_NEN.has(nguon.kind)) return { cho: true, dong: `mở khoá sớm vì ${nhanChinh(nguon.text)}` };
  if (dangLive) {
    return {
      cho: false,
      dong: `Phiên ${nhanChinh(nguon.text)} đang live: không tô nền theo khối tới khi hết phiên, để không ai nhìn trộm kết quả giữa chừng.`,
    };
  }
  return { cho: false, dong: null };
}
