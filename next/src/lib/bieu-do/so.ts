import { fmtFixed, fmtNum, mmss } from "@/lib/livelift-api/desk";
import { soCoDau } from "@/lib/livelift-api/gop";

/**
 * Cách viết số trên biểu đồ, theo vi-VN (dấu phẩy thập phân, dấu chấm nghìn) và dấu trừ in "−".
 * Dùng lại hàm của desk.ts/gop.ts để thẻ số, câu tóm tắt và biểu đồ in cùng một chuỗi.
 */

/** Số nguyên có dấu chấm nghìn: 1.645. */
export function soNguyen(n: number): string {
  return fmtNum(Math.round(n), 0);
}

/** Tối đa `chuSo` chữ số thập phân, bỏ số 0 thừa: 1,2 · 62. Số âm in dấu "−". */
export function soGon(n: number, chuSo = 1): string {
  const s = fmtNum(Math.abs(n), chuSo);
  return n < 0 && s !== "0" ? `−${s}` : s;
}

/** Đúng `chuSo` chữ số, có dấu: +1,224 · −0,173. */
export function soDau(n: number, chuSo = 3): string {
  return soCoDau(n, chuSo);
}

export function soCoDinh(n: number, chuSo = 2): string {
  return fmtFixed(n, chuSo);
}

/** Phần trăm gọn: 38%. */
export function phanTram(tyLe: number, chuSo = 0): string {
  return `${fmtNum(tyLe * 100, chuSo)}%`;
}

/** Mốc thời gian trong phiên: 12:30 (phút:giây). */
export function moc(giay: number): string {
  return mmss(giay);
}

/** Độ dài phiên bằng lời: "45 phút", "1 giờ 30 phút". */
export function doDai(giay: number): string {
  const phut = Math.max(0, Math.round(giay / 60));
  if (phut < 60) return `${phut} phút`;
  const gio = Math.floor(phut / 60);
  const du = phut % 60;
  return du ? `${gio} giờ ${du} phút` : `${gio} giờ`;
}
