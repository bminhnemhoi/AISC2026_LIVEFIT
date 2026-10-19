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

/** Ô đo của đường thời gian (giây), để lấy tâm của cửa sổ trượt. */
const O_DO_BANG_S = 30;

/**
 * Mốc dùng để gán nhánh cho một điểm của đường Tỷ lệ nhấp: tâm của cửa sổ trượt `cuaSoS` giây kết thúc ở cuối ô đo
 * `t`. Số ở mốc `t` phần lớn thuộc khối chứa tâm này, không phải khối chứa `t` (soát đợt 2, VÀNG 2).
 */
export function tamCuaSo(t: number, cuaSoS: number): number {
  return t + O_DO_BANG_S - cuaSoS / 2;
}

export interface TuyChonBangDuong {
  /** Mỗi `buocS` giây một dòng (mặc định 5 phút). */
  buocS?: number;
  /** Cửa sổ trượt của Tỷ lệ nhấp (giây), để gán nhánh theo tâm cửa sổ. */
  cuaSoS?: number;
  /** False khi khoá §7 (D-027): bảng chỉ có Người xem, không có cột Tỷ lệ nhấp. */
  coTyLeNhap?: boolean;
}

/**
 * Đường thời gian: mỗi `buocS` giây một dòng (mặc định 5 phút), lấy điểm CUỐI của mỗi 5 phút (cửa sổ trượt khi đó nằm
 * trọn trong 5 phút đó). Cột "Khối" chỉ có khi biểu đồ được phép tô nền theo khối, và ghi nhánh của khối chứa tâm cửa
 * sổ. Khi `coTyLeNhap` là false, bảng không có cột Tỷ lệ nhấp.
 */
export function bangDuongThoiGian(diem: DiemThoiGian[], dai: readonly DaiKhoi[] | null, tuyChon: TuyChonBangDuong | number = {}): BangDuLieu {
  const { buocS = 300, cuaSoS = 120, coTyLeNhap = true } = typeof tuyChon === "number" ? { buocS: tuyChon } : tuyChon;
  const coKhoi = coTyLeNhap && !!dai && dai.length > 0;
  const hang: string[][] = [];
  diem.forEach((d, i) => {
    const sau = diem[i + 1];
    // Lấy điểm cuối của mỗi nhóm `buocS` giây (và điểm cuối cùng).
    if (sau && Math.floor(sau.t / buocS) === Math.floor(d.t / buocS)) return;
    const dong = [moc(d.t + O_DO_BANG_S), soGon(d.nguoiXem)];
    if (coTyLeNhap) dong.push(d.tyLeNhap == null ? "chưa tính được" : soGon(d.tyLeNhap, 2));
    if (coKhoi) {
      const k = nhanhTai(dai, tamCuaSo(d.t, cuaSoS));
      dong.push(k ? `${k.index + 1} · ${tenNhanh(k.nhanh)}` : "");
    }
    hang.push(dong);
  });
  const cot = coTyLeNhap ? ["Thời điểm", "Người xem", "Tỷ lệ nhấp"] : ["Thời điểm", "Người xem"];
  if (coKhoi) cot.push("Khối");
  const tieuDe = coTyLeNhap
    ? `Người xem và Tỷ lệ nhấp, mỗi ${Math.round(buocS / 60)} phút một dòng; Tỷ lệ nhấp tính trên ${Math.round(cuaSoS / 60)} phút trước mốc`
    : `Người xem, mỗi ${Math.round(buocS / 60)} phút một dòng`;
  return { tieuDe, cot, hang };
}

export function bangThuoc(uocLuong: number, thap: number, cao: number, vung: VungKetLuan): BangDuLieu {
  return {
    tieuDe: "Chênh lệch Tỷ lệ nhấp, khối BẬT trừ khối TẮT",
    cot: ["Ước lượng", "Khoảng tin cậy 95%", "Kết luận"],
    hang: [[soDau(uocLuong), `từ ${soDau(thap)} đến ${soDau(cao)}`, KET_LUAN[vung].chu]],
  };
}

/** `anTrungBinh`: chưa đủ khối để so, bảng không có hai dòng trung bình. */
export function bangCham(khoi: KhoiDo[], tb: TrungBinhNhanh, anTrungBinh = false): BangDuLieu {
  const hang = khoi.map((k) => [
    String(k.index + 1),
    tenNhanh(k.nhanh),
    `${moc(k.tu)} đến ${moc(k.den)}`,
    k.tyLe == null ? "không đo được" : soGon(k.tyLe, 2),
    k.lyDo ?? "",
  ]);
  if (!anTrungBinh) {
    hang.push(["", "BẬT trung bình", "", tb.bat == null ? "chưa có" : soGon(tb.bat, 2), `${tb.nBat} khối`]);
    hang.push(["", "TẮT trung bình", "", tb.tat == null ? "chưa có" : soGon(tb.tat, 2), `${tb.nTat} khối`]);
  }
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
