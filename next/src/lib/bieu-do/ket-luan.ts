import { KET_LUAN_THEO_MA, PHU_DE_KHOI, TU, type KetLuanCanon, type MaKetLuan } from "@/lib/tu-ngu";

/**
 * Ba vùng của thước khoảng tin cậy: GIỮ (cả khoảng bên trái vạch 0), ĐO THÊM (khoảng chạm vạch 0), ĐỔI (cả khoảng bên
 * phải). Cùng luật với `verdict()` của desk.ts: chỉ nhìn khoảng tin cậy 95%, không nhìn p.
 *
 * Mọi chữ ở đây ĐỌC từ `@/lib/tu-ngu` (canon thuat-ngu.yaml, khoá `ket_luan`, `phu_de`, `ngan`), không chép lại: một
 * bộ câu cho thước, CoChe, bàn thí nghiệm và tổng kết.
 */

export type VungKetLuan = "giu" | "do_them" | "doi";

export interface MoTaVung {
  /** Chữ lớn (canon `ket_luan.chu`). */
  chu: string;
  /** Câu lời thường đi kèm chữ in hoa (canon `ket_luan.cau`). */
  cau: string;
  /** Chữ đặt trên thước (canon `ket_luan.nhan_thuoc`). */
  nhanThuoc: string;
}

/** Mã vùng của thước sang mã kết luận của canon. */
export const MA_CUA_VUNG: Readonly<Record<VungKetLuan, MaKetLuan>> = { giu: "GIU", do_them: "DO_THEM", doi: "DOI" };

function moTa(k: KetLuanCanon): MoTaVung {
  return Object.freeze({ chu: k.chu, cau: k.cau, nhanThuoc: k.nhan_thuoc });
}

/** Bí danh theo vùng của `KET_LUAN_THEO_MA` (tu-ngu). Giữ tên cũ để không vỡ người dùng. */
export const KET_LUAN: Readonly<Record<VungKetLuan, MoTaVung>> = Object.freeze({
  giu: moTa(KET_LUAN_THEO_MA[MA_CUA_VUNG.giu]),
  do_them: moTa(KET_LUAN_THEO_MA[MA_CUA_VUNG.do_them]),
  doi: moTa(KET_LUAN_THEO_MA[MA_CUA_VUNG.doi]),
});

export const THU_TU_VUNG: readonly VungKetLuan[] = ["giu", "do_them", "doi"];

/** Vùng của một khoảng tin cậy. Khoảng không hữu hạn thì không có vùng. */
export function vungCua(thap: number, cao: number): VungKetLuan | null {
  if (!Number.isFinite(thap) || !Number.isFinite(cao)) return null;
  if (thap > 0) return "doi";
  if (cao < 0) return "giu";
  return "do_them";
}

function canCo(chu: string | undefined, ten: string): string {
  if (!chu) throw new Error(`bieu-do/ket-luan: canon thiếu ${ten}`);
  return chu;
}

/** Phụ đề lời thường của khoảng tin cậy 95% (thuat-ngu.yaml, khoá phu_de). */
export const PHU_DE_KHOANG_TIN_CAY = canCo(TU.khoangTinCay.phu_de, "phu_de của khoảng tin cậy");

/** Dạng ngắn của chỉ số chính và tên đầy đủ (thuat-ngu.yaml, khoá ngan). */
export const TY_LE_NHAP = TU.tyLeNhap.hien;
export const TY_LE_NHAP_DAY_DU = TU.tyLeNhap.dung;

/** Phụ đề khối BẬT/TẮT (thuat-ngu.yaml, khoá phu_de, phần sau dấu chấm phẩy). */
export const PHU_DE_BAT = `BẬT: ${PHU_DE_KHOI.bat}`;
export const PHU_DE_TAT = `TẮT: ${PHU_DE_KHOI.tat}`;
