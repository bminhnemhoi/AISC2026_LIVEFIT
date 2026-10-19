/**
 * Ba vùng của thước khoảng tin cậy: GIỮ (cả khoảng bên trái vạch 0), ĐO THÊM (khoảng chạm vạch 0), ĐỔI (cả khoảng bên
 * phải). Cùng luật với `verdict()` của desk.ts: chỉ nhìn khoảng tin cậy 95%, không nhìn p.
 */

export type VungKetLuan = "giu" | "do_them" | "doi";

export interface MoTaVung {
  chu: string;
  /** Câu lời thường đi kèm chữ in hoa (bảng từ mục 3 kế hoạch 3.1). */
  cau: string;
  /** Chữ ngắn đặt trên thước. */
  nhanThuoc: string;
}

export const KET_LUAN: Readonly<Record<VungKetLuan, MoTaVung>> = {
  giu: {
    chu: "GIỮ",
    cau: "Cả khoảng nằm bên trái vạch 0: khối BẬT có ít lượt nhấp hơn, nên giữ cách làm cũ.",
    nhanThuoc: "GIỮ cách cũ",
  },
  do_them: {
    chu: "ĐO THÊM",
    cau: "Khoảng còn chạm vạch 0: chưa đủ bằng chứng theo hướng nào, cần đo thêm phiên.",
    nhanThuoc: "ĐO THÊM khi khoảng chạm vạch 0",
  },
  doi: {
    chu: "ĐỔI",
    cau: "Cả khoảng nằm bên phải vạch 0: khối BẬT có nhiều lượt nhấp hơn, nên đổi sang cách ghim của LiveLift.",
    nhanThuoc: "ĐỔI sang LiveLift",
  },
};

export const THU_TU_VUNG: readonly VungKetLuan[] = ["giu", "do_them", "doi"];

/** Vùng của một khoảng tin cậy. Khoảng không hữu hạn thì không có vùng. */
export function vungCua(thap: number, cao: number): VungKetLuan | null {
  if (!Number.isFinite(thap) || !Number.isFinite(cao)) return null;
  if (thap > 0) return "doi";
  if (cao < 0) return "giu";
  return "do_them";
}

/** Phụ đề lời thường của khoảng tin cậy 95% (thuat-ngu.yaml, khoá phu_de). */
export const PHU_DE_KHOANG_TIN_CAY = "đo lại nhiều lần thì khoảng 95/100 dải như vậy chứa hiệu quả thật";

/** Tên đầy đủ của chỉ số chính và dạng ngắn (thuat-ngu.yaml, khoá ngan). */
export const TY_LE_NHAP = "Tỷ lệ nhấp";
export const TY_LE_NHAP_DAY_DU = "lượt nhấp hợp lệ / 1.000 giây·người xem";

/** Phụ đề khối BẬT/TẮT (thuat-ngu.yaml, khoá phu_de, phần sau dấu chấm phẩy). */
export const PHU_DE_BAT = "BẬT: LiveLift ghim";
export const PHU_DE_TAT = "TẮT: đội làm như thường";
