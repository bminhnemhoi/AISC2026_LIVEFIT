/**
 * Hàm thuần cho nhãn nguồn (không "use client", nên trang dựng trên máy chủ gọi được). Chữ và nghĩa lấy từ canon
 * qua lib/tu-ngu.ts.
 */
import { NHAN_NGUON_THEO_MA, type MaNhanNguon } from "@/lib/tu-ngu";

export type MaNhan = MaNhanNguon | readonly MaNhanNguon[];

/** Danh sách mã đã kiểm: ít nhất một mã, mọi mã có trong canon. */
export function dsMaNhan(ma: MaNhan): readonly MaNhanNguon[] {
  const ds = typeof ma === "string" ? [ma] : ma;
  if (ds.length === 0) throw new Error("NhanNguon: cần ít nhất một mã nhãn");
  for (const m of ds) {
    if (!NHAN_NGUON_THEO_MA[m]) throw new Error(`NhanNguon: mã "${m}" không có trong thuat-ngu.yaml`);
  }
  return ds;
}

/** Chữ hiện trên chip, lấy từ canon: "MÔ PHỎNG", hoặc "DÀN DỰNG · THỬ NỘI BỘ" khi có nhiều mã. */
export function chuNhanNguon(ma: MaNhan): string {
  return dsMaNhan(ma)
    .map((m) => NHAN_NGUON_THEO_MA[m].hien_thi)
    .join(" · ");
}

/** Từng dòng nghĩa (tên nhãn và câu nghĩa trong canon). */
export function nghiaNhanNguon(ma: MaNhan): { ten: string; nghia: string }[] {
  return dsMaNhan(ma).map((m) => ({ ten: NHAN_NGUON_THEO_MA[m].hien_thi, nghia: NHAN_NGUON_THEO_MA[m].nghia }));
}

/** Bề rộng lớn nhất của bong bóng nghĩa (khớp nen.css: min(320px, 100vw - 32px)). */
export function rongBongNghia(rongMan: number): number {
  return Math.max(0, Math.min(320, rongMan - 32));
}

/**
 * Chọn phía mở bong bóng nghĩa để không tràn khỏi màn: giữ phía ưa thích nếu vừa, không thì đổi phía; cả hai đều
 * không vừa thì chọn phía rộng hơn. `trai`/`phai` là mép trái/phải của nhãn (px tính từ mép trái màn).
 */
export function chonCanh(trai: number, phai: number, rongMan: number, ua: "trai" | "phai", le = 16): "trai" | "phai" {
  const rong = rongBongNghia(rongMan);
  const choPhai = rongMan - le - trai; // chỗ khi mở về bên phải (canh trái)
  const choTrai = phai - le; // chỗ khi mở về bên trái (canh phải)
  const vuaTrai = choPhai >= rong;
  const vuaPhai = choTrai >= rong;
  if (ua === "trai" ? vuaTrai : vuaPhai) return ua;
  if (ua === "trai" ? vuaPhai : vuaTrai) return ua === "trai" ? "phai" : "trai";
  return choPhai >= choTrai ? "trai" : "phai";
}
