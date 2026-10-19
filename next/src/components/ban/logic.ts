import type { MaNhan } from "@/components/nen/nhan";
import type { SourceLabel } from "@/lib/livelift-api/desk";
import type { Block, Comment, OperatorState, Session } from "@/lib/livelift-api/types";

/**
 * Hàm thuần của bàn thí nghiệm và màn người dẫn (U4). Không gọi mạng, không React: mỗi trạng thái trên màn truy được
 * về một hàm ở đây, và mỗi hàm có test.
 */

/** Chip nguồn theo canon cho nhãn nguồn của phiên. CHẠY THỬ (phiên tập dượt) chưa có mã riêng nên dùng THỬ NỘI BỘ. */
export function maNhanNguon(nhan: Pick<SourceLabel, "kind" | "text">): MaNhan {
  if (nhan.kind === "mo_phong") return "MO_PHONG";
  if (nhan.kind === "that") return "THAT";
  if (nhan.kind === "chay_thu") return "THU_NOI_BO";
  return laThuNoiBo(nhan) ? ["DAN_DUNG", "THU_NOI_BO"] : "DAN_DUNG";
}

export function laThuNoiBo(nhan: Pick<SourceLabel, "kind" | "text">): boolean {
  return nhan.kind === "chay_thu" || nhan.text.includes("THỬ NỘI BỘ");
}

/** Nhãn chính để ghép câu ("DÀN DỰNG · THỬ NỘI BỘ" → "THỬ NỘI BỘ", "MÔ PHỎNG" → "MÔ PHỎNG"). */
export function tenNguonNgan(nhan: Pick<SourceLabel, "kind" | "text">): string {
  if (laThuNoiBo(nhan)) return "THỬ NỘI BỘ";
  return nhan.text.split("·")[0].trim();
}

export interface QuyenSoSanh {
  /** Được tô nền BẬT/TẮT lên đường thời gian. */
  toNen: boolean;
  /** Được hiện ước lượng, thước khoảng tin cậy và kết luận. Chỉ khi máy chủ trả khoa=false. */
  hienKetQua: boolean;
  /** Dòng giải thích đặt dưới biểu đồ; null khi không cần. */
  dong: string | null;
}

/**
 * Khoá §7 của bàn thí nghiệm, lớp ngoài cùng. Kết quả chỉ hiện khi máy chủ nói rõ khoa=false.
 * Tô nền theo khối: MÔ PHỎNG và DÀN DỰNG được mở sớm (có dòng giải thích); THẬT, THỬ NỘI BỘ và CHẠY THỬ thì không,
 * cho tới khi máy chủ mở khoá. `toNenLib` là quyền của lib/bieu-do (quyenToNenKhoi): bàn chỉ được hẹp lại, không nới ra.
 */
export function quyenSoSanh(
  nhan: Pick<SourceLabel, "kind" | "text">,
  dangLive: boolean,
  khoa: boolean,
  toNenLib: { cho: boolean; dong: string | null },
): QuyenSoSanh {
  const ten = tenNguonNgan(nhan);
  const nguonMoSom = !laThuNoiBo(nhan) && (nhan.kind === "mo_phong" || nhan.kind === "dan_dung");
  if (!nguonMoSom && khoa) {
    return {
      toNen: false,
      hienKetQua: false,
      dong: dangLive
        ? `Phiên ${ten} đang live: không tô nền theo khối tới khi hết phiên, để không ai nhìn trộm kết quả giữa chừng.`
        : null,
    };
  }
  return {
    toNen: toNenLib.cho,
    hienKetQua: !khoa,
    dong: toNenLib.cho ? toNenLib.dong : null,
  };
}

export type LoaiBayGio = "chua_phat" | "ket_thuc" | "ngoai_khoi" | "troi" | "bat" | "tat";

export interface BayGio {
  loai: LoaiBayGio;
  /** Số thứ tự khối (bắt đầu từ 1); null khi ngoài khối. */
  soKhoi: number | null;
  tongKhoi: number;
  conGiay: number | null;
  /** Phần còn lại của khối, 0..1 (cho vòng đếm ngược). */
  phanCon: number;
  /** Nút "Ghim món của khối này" bấm được. */
  ghimDuoc: boolean;
  /** Vì sao nút bị khoá (null khi bấm được, hoặc khi không hiện nút). */
  lyDoKhoaNut: string | null;
  /** Hiện nút ghim (khoá hay mở). Không hiện khi phiên đã kết thúc hoặc chưa phát. */
  hienNut: boolean;
  /** Món hiện trên điện thoại: chỉ ở khối BẬT. */
  ghimDienThoai: { ten: string; gia?: number } | null;
  /** Ở khối TẮT mà món của khối trước vẫn còn ghim (D-012). */
  conTuKhoiTruoc: boolean;
}

/** Trạng thái thẻ "Bây giờ" từ phiên, trạng thái người vận hành và lịch khối. */
export function trangThaiBayGio(
  phien: Pick<Session, "status" | "platform">,
  state: Pick<OperatorState, "current_block" | "pinned_product" | "elapsed_s"> | null,
  khoi: Pick<Block, "block_index" | "start_offset_s" | "end_offset_s" | "is_washout" | "assignment">[],
): BayGio {
  const tongKhoi = khoi.filter((b) => !b.is_washout && b.assignment).length;
  const ghim = state?.pinned_product ?? null;
  const coBan = {
    soKhoi: null,
    tongKhoi,
    conGiay: null,
    phanCon: 0,
    ghimDuoc: false,
    lyDoKhoaNut: null,
    hienNut: false,
    ghimDienThoai: null,
    conTuKhoiTruoc: false,
  } satisfies Omit<BayGio, "loai">;
  if (phien.status === "ended" || phien.status === "cancelled") return { ...coBan, loai: "ket_thuc" };
  if (phien.status !== "live") return { ...coBan, loai: "chua_phat" };
  const cb = state?.current_block ?? null;
  if (!cb) return { ...coBan, loai: "ngoai_khoi" };
  const b = khoi.find((k) => k.block_index === cb.index);
  const dai = b ? Math.max(1, b.end_offset_s - b.start_offset_s) : 300;
  const conGiay = Math.max(0, cb.seconds_remaining);
  const phanCon = Math.min(1, Math.max(0, conGiay / dai));
  const chung = { ...coBan, soKhoi: cb.index + 1, conGiay, phanCon, hienNut: true };
  if (cb.is_washout || !cb.assignment) {
    return { ...chung, loai: "troi", lyDoKhoaNut: "Khoảng chuyển giữa hai khối: chưa ghim." };
  }
  if (cb.assignment === "OFF") {
    return { ...chung, loai: "tat", lyDoKhoaNut: "Khối TẮT: đội làm như thường lệ.", conTuKhoiTruoc: !!ghim };
  }
  const phongDanDung = phien.platform === "lab";
  return {
    ...chung,
    loai: "bat",
    ghimDuoc: !phongDanDung,
    lyDoKhoaNut: phongDanDung ? "Phòng dàn dựng: máy tự ghim ở khối BẬT." : null,
    ghimDienThoai: ghim ? { ten: ghim.name, gia: ghim.price } : null,
  };
}

export type CheDoGhim = "Tự ghim" | "Chỉ gợi ý" | "Quan sát";

/** Chế độ ghim theo canon: Tự ghim (mode auto), Chỉ gợi ý (mode suggest), Quan sát (phiên không bốc thăm). */
export function cheDoGhim(phien: Pick<Session, "mode">, loaiPhien: string | null | undefined): CheDoGhim {
  if (loaiPhien && loaiPhien !== "thi_nghiem") return "Quan sát";
  return phien.mode === "auto" ? "Tự ghim" : "Chỉ gợi ý";
}

/** Thời gian còn lại của cả phiên (giây), không âm. */
export function conLaiPhien(phien: Pick<Session, "planned_duration_min">, daChayS: number): number {
  return Math.max(0, phien.planned_duration_min * 60 - daChayS);
}

const Y_DINH_HOI = new Set(["hoi_gia", "hoi_size", "hoi_sanpham", "van_chuyen", "hoi_daily"]);

/** Bình luận là câu hỏi: nhãn ý định hỏi, hoặc có dấu "?". */
export function laCauHoi(c: Pick<Comment, "intent" | "text">): boolean {
  return (!!c.intent && Y_DINH_HOI.has(c.intent)) || c.text.includes("?");
}

/** N câu hỏi mới nhất của khách (mới nhất trước), cho màn người dẫn. */
export function cauHoiMoiNhat<T extends Pick<Comment, "intent" | "text" | "ts">>(binhLuan: readonly T[], n = 3): T[] {
  return [...binhLuan]
    .filter(laCauHoi)
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    .slice(0, n);
}

export type ToneYDinh = "dam" | "tim" | "vang" | "trung";

/** Màu chip ý định trên ngăn bình luận: hỏi (đậm), chốt đơn (tím, cùng họ màu Đơn), chê đắt (vàng), còn lại trung tính. */
export function toneYDinh(intent: string | null | undefined): ToneYDinh {
  if (!intent) return "trung";
  if (intent === "chot_don") return "tim";
  if (intent === "che_dat") return "vang";
  if (Y_DINH_HOI.has(intent)) return "dam";
  return "trung";
}

export interface ODaiKhoi {
  so: number;
  loai: "bat" | "tat" | "troi";
  trangThai: "qua" | "nay" | "toi";
  rongPhanTram: number;
}

/** Dải khối B/T cho người bán: chỉ lịch, không kèm số theo khối (khoá §7). */
export function daiKhoiBan(
  khoi: Pick<Block, "block_index" | "start_offset_s" | "end_offset_s" | "is_washout" | "assignment">[],
  daChayS: number,
): ODaiKhoi[] {
  if (khoi.length === 0) return [];
  const tong = Math.max(...khoi.map((b) => b.end_offset_s)) || 1;
  return khoi.map((b) => ({
    so: b.block_index + 1,
    loai: b.is_washout || !b.assignment ? "troi" : b.assignment === "ON" ? "bat" : "tat",
    trangThai: daChayS >= b.end_offset_s ? "qua" : daChayS >= b.start_offset_s ? "nay" : "toi",
    rongPhanTram: ((b.end_offset_s - b.start_offset_s) / tong) * 100,
  }));
}
