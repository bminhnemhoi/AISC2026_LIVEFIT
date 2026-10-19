/**
 * Token của nền giao diện 2.0 (Calm Studio ấm, bảng màu D-026). Đây là nguồn hex cho test; nen.css khai báo đúng các
 * giá trị này thành biến CSS `--n-*` (test token.test.ts so từng biến và kiểm tương phản ≥ 4.5:1 cho mọi cặp chữ/nền).
 *
 * Luật: đỏ gạch chỉ dùng cho LIVE và nút chính. Năm màu D-026 chỉ dùng cho dữ liệu (BẬT, TẮT, người xem, lượt nhấp,
 * đơn), không dùng làm màu trang trí hay màu chữ.
 */
import type { MaNhanCongBo, MaNhanNguon } from "@/lib/tu-ngu";

export const MAU_NEN = {
  /** nền kem của trang */
  nen: "#f6f3ee",
  /** mặt thẻ (giấy) */
  beMat: "#fbf7ef",
  /** chip, mục đang chọn */
  beMat2: "#eae3d8",
  beMat3: "#e2d9cb",
  /** đường kẻ mảnh giữa các hàng (trang trí, không mang nghĩa) */
  vach: "#d8d0c4",
  /** mực nâu: chữ chính */
  muc: "#2a2522",
  /** chữ phụ */
  muc2: "#5a5047",
  /** chữ chú thích, viền nút viền (≥ 3:1 cho viền, ≥ 4.5:1 cho chữ) */
  muc3: "#6e6359",
  /** chữ trên nền tối / nền gạch */
  chuSang: "#fff9f2",
  /** đỏ gạch: LIVE và nút chính */
  gach: "#9e3b2b",
  gachDam: "#873022",
  gachNhat: "#f0d9d0",
  /** chip vàng (DÀN DỰNG, THỬ NỘI BỘ) */
  vang: "#7f5300",
  vangNhat: "#f1e6cc",
  /** chip tím (MÔ PHỎNG), cùng sắc với dấu MÔ PHỎNG của calm.css */
  tim: "#4f3d86",
  timNhat: "#e7e0f2",
  /** D-026 */
  bat: "#3d6b4f",
  batNhat: "#dde6d8",
  tat: "#8a8f98",
  tatNhat: "#e6e7ea",
  /** chữ trên nền TẮT nhạt (xám TẮT chỉ 2,94:1 nên không bao giờ làm màu chữ) */
  tatChu: "#4a4f57",
  nguoiXem: "#2f74b5",
  luotNhap: "#c8691c",
  don: "#9b4fb0",
  /** đường trung tính cho đường nhỏ không mang danh tính */
  trung: "#6e6359",
} as const;

export type TenMauNen = keyof typeof MAU_NEN;

/** Tên biến CSS tương ứng (camelCase → kebab, tiền tố --n-). */
export function bienCss(ten: TenMauNen): string {
  return `--n-${ten.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** Sắc của chip. "dam" là nền mực, chữ sáng. */
export type ToneChip = "trung" | "dam" | "gach" | "vang" | "tim" | "bat" | "tat";

/** Cặp chữ/nền của từng sắc chip (để test tương phản). */
export const CAP_TONE: Readonly<Record<ToneChip, { chu: string; nen: string }>> = {
  trung: { chu: MAU_NEN.muc2, nen: MAU_NEN.beMat2 },
  dam: { chu: MAU_NEN.chuSang, nen: MAU_NEN.muc },
  gach: { chu: MAU_NEN.gachDam, nen: MAU_NEN.gachNhat },
  vang: { chu: MAU_NEN.vang, nen: MAU_NEN.vangNhat },
  tim: { chu: MAU_NEN.tim, nen: MAU_NEN.timNhat },
  bat: { chu: MAU_NEN.bat, nen: MAU_NEN.batNhat },
  tat: { chu: MAU_NEN.tatChu, nen: MAU_NEN.tatNhat },
};

/**
 * Sắc của từng nhãn nguồn. THẬT nổi nhất (nền mực); nhóm dàn dựng màu vàng; MÔ PHỎNG màu tím như dấu cũ; còn lại trung
 * tính. Không nhãn nào dùng xanh BẬT hay đỏ gạch, để nhãn không bị đọc nhầm thành dữ liệu hay nút chính.
 */
export const TONE_NHAN_NGUON: Readonly<Record<MaNhanNguon, ToneChip>> = {
  THAT: "dam",
  DAN_DUNG: "vang",
  THU_NOI_BO: "vang",
  MO_PHONG: "tim",
  GIA_THUYET: "trung",
  THU_CAP: "trung",
  NHAN_AI: "trung",
  QUAN_SAT: "trung",
  MINH_HOA: "trung",
  MAN_MAU: "trung",
};

export const TONE_NHAN_CONG_BO: Readonly<Record<MaNhanCongBo, ToneChip>> = {
  NGUOI_DAN_AI: "dam",
  MAY_CHEP_LOI: "trung",
  CHUA_XAC_MINH: "vang",
};

function kenh(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function doChoi(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Mã màu không hợp lệ: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * kenh((n >> 16) & 255) + 0.7152 * kenh((n >> 8) & 255) + 0.0722 * kenh(n & 255);
}

/** Tỷ lệ tương phản WCAG 2.x giữa hai mã #rrggbb, từ 1 đến 21. */
export function tuongPhan(a: string, b: string): number {
  const [l1, l2] = [doChoi(a), doChoi(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
