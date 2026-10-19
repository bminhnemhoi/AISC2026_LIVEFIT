import type { DaiKhoi, DiemThoiGian, DongYDinh, KhoiDo, TrungBinhNhanh } from "./chuoi";
import { KET_LUAN, type VungKetLuan } from "./ket-luan";
import type { Pheu } from "./pheu";
import type { DongRung } from "./rung";
import { moc, phanTram, soDau, soGon, soNguyen } from "./so";

/**
 * Bảng thay biểu đồ ("Xem dạng bảng"): cùng các số đang vẽ, viết ra chữ, để đọc bằng bàn phím, trình đọc màn hình
 * hoặc khi màu không phân biệt được. Không thêm số nào ngoài số trên biểu đồ.
 */

export interface BangDuLieu {
  /** Chú thích của bảng (caption). */
  tieuDe: string;
  cot: string[];
  hang: string[][];
}

const TEN_NHANH: Readonly<Record<"ON" | "OFF" | "WASH", string>> = { ON: "BẬT", OFF: "TẮT", WASH: "Khởi động" };

export function tenNhanh(n: "ON" | "OFF" | "WASH"): string {
  return TEN_NHANH[n];
}

/** Nhánh của mốc `t` theo các dải khối (null khi không có dải nào chứa nó). */
export function nhanhTai(dai: readonly DaiKhoi[], t: number): DaiKhoi | null {
  return dai.find((d) => t >= d.tu && t < d.den) ?? null;
}

/**
 * Đường thời gian: mỗi `buocS` giây một dòng (mặc định 5 phút), lấy đúng điểm đang vẽ ở mốc đó. Cột "Khối" chỉ có khi
 * biểu đồ được phép tô nền theo khối.
 */
export function bangDuongThoiGian(diem: DiemThoiGian[], dai: readonly DaiKhoi[] | null, buocS = 300): BangDuLieu {
  const coKhoi = !!dai && dai.length > 0;
  const hang: string[][] = [];
  let moiNhat = -Infinity;
  diem.forEach((d, i) => {
    const cuoi = i === diem.length - 1;
    if (d.t - moiNhat < buocS - 1e-6 && !cuoi) return;
    moiNhat = d.t;
    const dong = [moc(d.t), soGon(d.nguoiXem), d.tyLeNhap == null ? "chưa tính được" : soGon(d.tyLeNhap, 2)];
    if (coKhoi) {
      const k = nhanhTai(dai, d.t);
      dong.push(k ? `${k.index + 1} · ${tenNhanh(k.nhanh)}` : "");
    }
    hang.push(dong);
  });
  const cot = ["Thời điểm", "Người xem", "Tỷ lệ nhấp"];
  if (coKhoi) cot.push("Khối");
  return { tieuDe: `Người xem và Tỷ lệ nhấp, mỗi ${Math.round(buocS / 60)} phút một dòng`, cot, hang };
}

export function bangThuoc(uocLuong: number, thap: number, cao: number, vung: VungKetLuan): BangDuLieu {
  return {
    tieuDe: "Chênh lệch Tỷ lệ nhấp, khối BẬT trừ khối TẮT",
    cot: ["Ước lượng", "Khoảng tin cậy 95%", "Kết luận"],
    hang: [[soDau(uocLuong), `từ ${soDau(thap)} đến ${soDau(cao)}`, KET_LUAN[vung].chu]],
  };
}

export function bangCham(khoi: KhoiDo[], tb: TrungBinhNhanh): BangDuLieu {
  const hang = khoi.map((k) => [
    String(k.index + 1),
    tenNhanh(k.nhanh),
    `${moc(k.tu)} đến ${moc(k.den)}`,
    k.tyLe == null ? "không đo được" : soGon(k.tyLe, 2),
    k.lyDo ?? "",
  ]);
  hang.push(["", "BẬT trung bình", "", tb.bat == null ? "chưa có" : soGon(tb.bat, 2), `${tb.nBat} khối`]);
  hang.push(["", "TẮT trung bình", "", tb.tat == null ? "chưa có" : soGon(tb.tat, 2), `${tb.nTat} khối`]);
  return { tieuDe: "Tỷ lệ nhấp của từng khối", cot: ["Khối", "Nhánh", "Thời gian", "Tỷ lệ nhấp", "Ghi chú"], hang };
}

function dongBangRung(d: DongRung): string[] {
  if (!d.coSo) return [d.ten, d.nhan ?? "", "", "", d.lyDo];
  return [d.ten, d.nhan ?? "", soDau(d.uocLuong), `từ ${soDau(d.thap)} đến ${soDau(d.cao)}`, KET_LUAN[d.vung].chu];
}

export function bangRung(dong: DongRung[], gop: DongRung | null): BangDuLieu {
  const hang = dong.map(dongBangRung);
  if (gop) hang.push(dongBangRung(gop));
  return { tieuDe: "Chênh lệch Tỷ lệ nhấp BẬT trừ TẮT theo từng phiên", cot: ["Phiên", "Nhãn", "Chênh lệch", "Khoảng tin cậy 95%", "Kết luận"], hang };
}

export function bangYDinh(dong: DongYDinh[]): BangDuLieu {
  return {
    tieuDe: "Bình luận theo ý định (nhãn do máy gán)",
    cot: ["Ý định", "Số bình luận", "Phần"],
    hang: dong.map((d) => [d.ten, soNguyen(d.so), phanTram(d.tyLe)]),
  };
}

export function bangPheu(p: Pheu): BangDuLieu {
  const hang = p.buoc.map((b) => [b.ten, b.so ?? (b.thieu ?? "chưa có"), b.donVi]);
  for (const n of p.noi) hang.push([n.ten, n.giaTri ?? "chưa tính được", n.donVi]);
  return { tieuDe: "Từ xem đến mua", cot: ["Bước", "Số", "Đơn vị"], hang };
}
