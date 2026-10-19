import type { Funnel } from "@/lib/livelift-api/desk";
import type { DaiKhoi, DiemThoiGian, DongYDinh, KhoiDo, TrungBinhNhanh } from "./chuoi";
import { KET_LUAN, TY_LE_NHAP_DAY_DU, type VungKetLuan } from "./ket-luan";
import type { DongRung } from "./rung";
import { doDai, phanTram, soDau, soGon, soNguyen } from "./so";

/**
 * Câu mô tả thay ảnh cho từng biểu đồ (aria-label của vùng vẽ). Dựng từ đúng các số đang vẽ, không thêm số nào khác.
 * Không có dấu gạch dài, không chữ tắt "KTC" (thuat-ngu.yaml: trên giao diện viết đủ chữ).
 */

export function moTaDuongThoiGian(diem: DiemThoiGian[], tuyChon: { cuaSoS?: number; dai?: DaiKhoi[] | null } = {}): string {
  if (diem.length === 0) return "Đường thời gian: chưa có điểm đo người xem nào.";
  const dau = diem[0];
  const cuoi = diem[diem.length - 1];
  const dinh = Math.max(...diem.map((d) => d.nguoiXem));
  const cuaSo = doDai(tuyChon.cuaSoS ?? 120);
  const tyLe =
    cuoi.tyLeNhap == null
      ? `Tỷ lệ nhấp gần nhất chưa tính được vì quá ít người xem.`
      : `Tỷ lệ nhấp gần nhất ${soGon(cuoi.tyLeNhap, 2)} ${TY_LE_NHAP_DAY_DU}, tính trên ${cuaSo} gần nhất.`;
  let cau = `Đường thời gian ${doDai(cuoi.t + 30)}: người xem từ ${soGon(dau.nguoiXem)} tới ${soGon(cuoi.nguoiXem)}, cao nhất ${soGon(dinh)}. ${tyLe}`;
  if (tuyChon.dai?.length) {
    const nBat = tuyChon.dai.filter((d) => d.nhanh === "ON").length;
    const nTat = tuyChon.dai.filter((d) => d.nhanh === "OFF").length;
    cau += ` Nền tô theo khối: ${nBat} khối BẬT, ${nTat} khối TẮT.`;
  }
  return cau;
}

export function moTaThuoc(uocLuong: number, thap: number, cao: number, vung: VungKetLuan): string {
  return `Chênh lệch Tỷ lệ nhấp, khối BẬT trừ khối TẮT: ${soDau(uocLuong)}; khoảng tin cậy 95% từ ${soDau(thap)} đến ${soDau(cao)}. ${KET_LUAN[vung].chu}: ${KET_LUAN[vung].cau}`;
}

export function moTaCham(khoi: KhoiDo[], tb: TrungBinhNhanh): string {
  if (khoi.length === 0) return "Chưa có khối BẬT hay TẮT nào để vẽ.";
  const bo = tb.nBo ? `, ${tb.nBo} khối không đo được` : "";
  const bat = tb.bat == null ? "chưa có" : soGon(tb.bat, 2);
  const tat = tb.tat == null ? "chưa có" : soGon(tb.tat, 2);
  return `${khoi.length} khối: ${tb.nBat} khối BẬT đo được, ${tb.nTat} khối TẮT đo được${bo}. Trung bình Tỷ lệ nhấp: BẬT ${bat}, TẮT ${tat} ${TY_LE_NHAP_DAY_DU}. Chấm là mô tả từng khối; kết luận lấy từ phân tích đã đăng ký trước.`;
}

function cauDong(d: DongRung): string {
  if (!d.coSo) return `${d.ten}: chưa có ước lượng (${d.lyDo.replace(/\.$/, "")})`;
  return `${d.ten}: ${soDau(d.uocLuong)}, khoảng từ ${soDau(d.thap)} đến ${soDau(d.cao)}, ${KET_LUAN[d.vung].chu}`;
}

export function moTaRung(dong: DongRung[], gop: DongRung | null): string {
  if (dong.length === 0 && !gop) return "Chưa có phiên nào để so.";
  const dau = `Chênh lệch Tỷ lệ nhấp BẬT trừ TẮT của ${dong.length} phiên, kèm khoảng tin cậy 95%.`;
  const cac = dong.map(cauDong).join(". ");
  const cuoi = gop ? ` Kết quả gộp, ${cauDong(gop)}.` : "";
  return `${dau}${cac ? ` ${cac}.` : ""}${cuoi}`;
}

export function moTaYDinh(dong: DongYDinh[]): string {
  if (dong.length === 0) return "Chưa có bình luận nào được gán nhãn ý định.";
  const tong = dong.reduce((s, d) => s + d.so, 0);
  const cac = dong.map((d) => `${d.ten} ${soNguyen(d.so)} (${phanTram(d.tyLe)})`).join(", ");
  return `${soNguyen(tong)} bình luận có nhãn ý định do máy gán. ${cac}.`;
}

export function moTaPheu(p: Funnel, coNguonDon: boolean): string {
  const don = coNguonDon ? `${soNguyen(p.orders)} đơn` : "chưa có nguồn đơn";
  const tyLe = p.clickRate == null ? "" : ` Tỷ lệ nhấp ${soGon(p.clickRate, 2)} ${TY_LE_NHAP_DAY_DU}.`;
  return `Từ xem đến mua: ${soNguyen(p.viewerMinutes)} phút·người xem, ${soNguyen(p.clicks)} lượt nhấp hợp lệ, ${don}.${tyLe}`;
}

export function moTaDuongNho(ten: string, giaTri: Array<number | null>): string {
  const so = giaTri.filter((v): v is number => v != null && Number.isFinite(v));
  if (so.length === 0) return `${ten}: chưa có số.`;
  return `${ten}: ${so.length} điểm, gần nhất ${soGon(so[so.length - 1], 2)}, cao nhất ${soGon(Math.max(...so), 2)}.`;
}
