/**
 * Bảng màu biểu đồ D-026 (một bảng cho giao diện 2.0, K9 và poster).
 *
 * Màu sáng là đúng giá trị D-026. Màu tối là cùng sắc độ, chỉnh độ sáng cho nền tối #1f1a17 của Calm Studio.
 * Cả hai bộ đã chạy qua validator của skill dataviz (19/10/2026):
 *
 * - Người xem / Lượt nhấp / Đơn, cặp kề nhau: ĐẠT mọi cổng, sáng (nền #f6f3ee) và tối (nền #1f1a17).
 * - BẬT / TẮT: tách màu cho người mù màu ĐẠT (sáng ΔE 15,6; tối ΔE 14,6). TẮT cố ý là xám (cổng "độ đậm màu" báo
 *   trượt là chủ ý). TẮT sáng chỉ đạt 2,94:1 trên nền, nên màu tô giữ D-026 nhưng VIỀN chấm TẮT và sọc vẽ bằng
 *   `VIEN_TAT` (≥ 3:1, WCAG 1.4.11), kèm mã phụ: sọc chéo, chữ T, chấm rỗng, chú giải và bảng số.
 * - Người xem và Đơn KHÔNG phân biệt được với người mù màu đỏ lục (ΔE 3,0): không bao giờ đặt hai màu này cạnh nhau
 *   mà không có chữ. Trên giao diện chúng không chung một biểu đồ; bước phễu luôn có tên.
 *
 * Mã vẽ dùng biến CSS (`BIEN`) để tự đổi theo giao diện sáng/tối. Hex chỉ dùng khi xuất SVG tĩnh (slide, poster).
 */

export type TenMau = "bat" | "tat" | "nguoiXem" | "luotNhap" | "don" | "trung";

export const MAU: Readonly<Record<TenMau, { sang: string; toi: string }>> = {
  bat: { sang: "#3d6b4f", toi: "#58a878" },
  tat: { sang: "#8a8f98", toi: "#686d76" },
  nguoiXem: { sang: "#2f74b5", toi: "#3f86cc" },
  luotNhap: { sang: "#c8691c", toi: "#d0782a" },
  don: { sang: "#9b4fb0", toi: "#a865c0" },
  /** Một chuỗi không mang danh tính (thanh ý định, đường nhỏ trung tính): than chì của Calm Studio. */
  trung: { sang: "#6e6359", toi: "#b9a891" },
};

/** Nền biểu đồ Calm Studio, để kiểm tương phản. */
export const NEN = { sang: "#f6f3ee", toi: "#1f1a17" } as const;

/** Mặt thẻ chứa biểu đồ (nhạt hơn nền ở giao diện sáng, đậm hơn ở giao diện tối), để kiểm tương phản. */
export const MAT_THE = { sang: "#fbf7ef", toi: "#2e2722" } as const;

/**
 * Viền chấm TẮT và sọc chéo của khối TẮT: cùng sắc xám với TẮT nhưng đậm hơn để phần tử đồ hoạ đạt ≥ 3:1 trên nền
 * (sáng trùng `--n-tat-chu` của components/nen). Màu tô TẮT vẫn là D-026.
 */
export const VIEN_TAT = { sang: "#4a4f57", toi: "#a0a5ae" } as const;

/** Trục và vạch chia của biểu đồ: ≥ 3:1 trên cả nền và mặt thẻ (biến `--bd-truc`). */
export const TRUC = { sang: "#8a7d6c", toi: "#8a7d6c" } as const;

export const BIEN: Readonly<Record<TenMau, string>> = {
  bat: "var(--bd-bat)",
  tat: "var(--bd-tat)",
  nguoiXem: "var(--bd-nguoi-xem)",
  luotNhap: "var(--bd-luot-nhap)",
  don: "var(--bd-don)",
  trung: "var(--bd-trung)",
};

/** Biến CSS của viền chấm TẮT và sọc (xem `VIEN_TAT`). */
export const BIEN_VIEN_TAT = "var(--bd-tat-vien)";
