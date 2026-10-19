/**
 * Bảng màu cố định cho mọi hình vẽ tay (D-021) và các nhánh BẬT/TẮT (D-026).
 *
 * Hình minh hoạ dùng màu viết thẳng (không qua biến CSS), để cùng một hình xuất được ra SVG tĩnh cho slide, poster và
 * video mà không cần tệp CSS nào. Các hình là "nhãn dán cắt khuôn" (die-cut): viền cắt, lề trắng, thân giấy hoặc kraft,
 * nét mực nâu; nên trên nền tối chúng vẫn đọc như một miếng dán thật.
 */
export const MAU_HINH = {
  /** mực đậm (chữ, nét chính của hình thương hiệu) */
  muc: "#2a2522",
  /** mực nâu: nét của nhãn dán */
  mucNau: "#5a5047",
  /** mực nhạt: chữ phụ trên hình */
  mucNhat: "#6e6359",
  /** giấy: thân thẻ */
  giay: "#fbf7ef",
  giayB: "#ece3d4",
  /** nền kem của Calm Studio */
  kem: "#f6f3ee",
  /** lề trắng của nhãn dán */
  le: "#fffdf8",
  /** viền cắt mềm quanh nhãn dán */
  vienCat: "#d8d0c4",
  /** đường kẻ mảnh */
  vach: "#d8d0c4",
  /** ô ảnh trong thẻ */
  anh: "#e2d9cb",
  kraft: "#c9b48a",
  kraftA: "#e6d6b6",
  kraftB: "#cdb68a",
  /** đỏ gạch: chỉ cho LIVE và nút chính */
  gach: "#9e3b2b",
  gachNhat: "#f0d9d0",
  /** giấy ghi chú */
  ghiChu: "#efe5cb",
  /** bóng sáng trên nhãn dán */
  bong: "#ffffff",
  /** da của người dẫn vẽ tay (một màu phẳng, không phải ảnh) */
  da: "#e9cdb6",
  toc: "#4a3a2e",
  /** D-026: BẬT, TẮT (kèm sọc và chữ T), người xem, lượt nhấp, đơn */
  bat: "#3d6b4f",
  batNhat: "#dde6d8",
  tat: "#8a8f98",
  tatNhat: "#e6e7ea",
  nguoiXem: "#2f74b5",
  luotNhap: "#c8691c",
  don: "#9b4fb0",
  /** vàng đậm cho cảnh báo nhẹ (chữ trên nền sáng đạt 4.5:1) */
  vang: "#7f5300",
} as const;

export type TenMauHinh = keyof typeof MAU_HINH;

/** @deprecated Dùng MAU_HINH (trùng tên với MAU của @/lib/bieu-do, mục 10 soát đợt 1). Giữ tới khi ghép nhánh. */
export const MAU = MAU_HINH;
/** @deprecated Dùng TenMauHinh. */
export type TenMau = TenMauHinh;

/** Phông chữ trong hình: Be Vietnam Pro (có bộ chữ tiếng Việt, tự lưu trữ ở calm.css), rồi phông hệ thống. */
export const PHONG = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif';
export const PHONG_SO = 'ui-monospace, "SFMono-Regular", "DejaVu Sans Mono", Menlo, Consolas, monospace';

/** Góc nghiêng lớn nhất cho phần trang trí `aria-hidden` (luật hình mục 3 kế hoạch 3.1). */
export const NGHIENG_TOI_DA = 2;

/** Giới hạn một góc nghiêng trong ±2°. */
export function nghieng(deg: number): number {
  return Math.max(-NGHIENG_TOI_DA, Math.min(NGHIENG_TOI_DA, deg));
}
