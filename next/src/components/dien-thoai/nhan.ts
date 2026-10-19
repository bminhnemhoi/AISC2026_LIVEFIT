/**
 * Chuẩn hoá nhãn nguồn của khung điện thoại về mã canon (hàm thuần). Nhận mã (`"DAN_DUNG"`), nhiều mã, hoặc chữ cũ
 * trùng chữ canon (`"DÀN DỰNG"`, `"DÀN DỰNG · THỬ NỘI BỘ"`). Chữ ngoài canon (ví dụ chữ tiếng Anh) bị bỏ.
 */
import { MA_NHAN_NGUON, NHAN_NGUON, type MaNhanNguon } from "@/lib/tu-ngu";
import type { MaNhan } from "@/components/nen";

const LA_MA = new Set<string>(MA_NHAN_NGUON);

function maCuaManh(manh: string): MaNhanNguon | null {
  const s = manh.normalize("NFC").trim();
  if (!s) return null;
  if (LA_MA.has(s)) return s as MaNhanNguon;
  const hoa = s.toLocaleUpperCase("vi-VN");
  return NHAN_NGUON.find((n) => n.hien_thi.normalize("NFC") === hoa)?.id ?? null;
}

/** Danh sách mã canon (không trùng, giữ thứ tự); rỗng khi không có nhãn hợp lệ nào. */
export function maNhanNguonTu(nhan: MaNhan | string | null | undefined): MaNhanNguon[] {
  if (nhan == null) return [];
  const manh = typeof nhan === "string" ? nhan.split("·") : Array.from(nhan as readonly string[]);
  const ra: MaNhanNguon[] = [];
  for (const m of manh) {
    const ma = maCuaManh(m);
    if (ma && !ra.includes(ma)) ra.push(ma);
  }
  return ra;
}
