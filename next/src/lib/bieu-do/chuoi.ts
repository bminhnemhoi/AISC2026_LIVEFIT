import { INTENT_DISPLAY } from "@/lib/livelift-api/desk";
import type { Block, Comment, Tick } from "@/lib/livelift-api/types";
import type { QuyenToNen } from "./khoa";

/**
 * Biến đổi dữ liệu API thành chuỗi để vẽ. Thuần, không React, không gọi mạng.
 *
 * Không hàm nào ở đây tính ước lượng nhân quả: kết luận ĐỔI / GIỮ / ĐO THÊM và khoảng tin cậy luôn lấy từ máy chủ.
 * `khoiTuTicks` tính tỷ lệ nhấp TỪNG KHỐI theo đúng luật của `core/features.py block_frame` (bỏ 60 giây đầu khối,
 * mẫu số là giây·người xem đo được, khối dưới 60 giây·người xem là không đo được) để vẽ chấm; chỉ được gọi khi kết
 * quả đã mở khoá (xem `khoa.ts`). Trên 4 phiên mẫu, hiệu trung bình BẬT trừ TẮT từ hàm này khớp ước lượng của máy
 * chủ tới 4 chữ số (kiểm 19/10/2026).
 */

/** Độ rộng một điểm đo của API (giây). */
export const O_DO_S = 30;
/** Bỏ 60 giây đầu mỗi khối (reports.py BURN_IN_S). */
export const BO_DAU_KHOI_S = 60;
/** Dưới ngưỡng này một khối không có tỷ lệ nhấp (features.py MIN_EXPOSURE_VIEWER_S). */
export const PHOI_TOI_THIEU = 60;

function msTs(ts: string): number {
  return Date.parse(ts);
}

/** Giây tính từ lúc phiên bắt đầu. */
export function giayTuBatDau(ts: string, batDauTs: string): number {
  return (msTs(ts) - msTs(batDauTs)) / 1000;
}

interface DiemTho {
  t: number;
  nguoiXem: number;
  nhap: number;
}

function diemTho(ticks: Tick[], batDauTs: string): DiemTho[] {
  return ticks
    .map((k) => ({ t: giayTuBatDau(k.ts_bucket, batDauTs), nguoiXem: Math.max(0, k.viewers), nhap: Math.max(0, k.click_count ?? 0) }))
    .filter((d) => Number.isFinite(d.t) && d.t > -1e-6)
    .sort((a, b) => a.t - b.t);
}

export interface DiemThoiGian {
  /** Giây từ đầu phiên (đầu ô đo). */
  t: number;
  nguoiXem: number;
  /** Tỷ lệ nhấp (lượt nhấp hợp lệ / 1.000 giây·người xem) trên `cuaSoS` giây gần nhất; null khi mẫu số quá nhỏ. */
  tyLeNhap: number | null;
}

/**
 * Hai chuỗi của đường thời gian: người xem theo từng ô 30 giây, và tỷ lệ nhấp trượt trên `cuaSoS` giây gần nhất
 * (một ô 30 giây quá ồn để đọc). Không có giờ bắt đầu thì không có trục thời gian: trả mảng rỗng.
 */
export function chuoiThoiGian(ticks: Tick[], batDauTs: string | null | undefined, cuaSoS = 120): DiemThoiGian[] {
  if (!batDauTs) return [];
  const tho = diemTho(ticks, batDauTs);
  const out: DiemThoiGian[] = [];
  let dau = 0;
  let phoi = 0;
  let nhap = 0;
  for (let i = 0; i < tho.length; i++) {
    phoi += tho[i].nguoiXem * O_DO_S;
    nhap += tho[i].nhap;
    while (dau < i && tho[dau].t <= tho[i].t - cuaSoS) {
      phoi -= tho[dau].nguoiXem * O_DO_S;
      nhap -= tho[dau].nhap;
      dau++;
    }
    out.push({ t: tho[i].t, nguoiXem: tho[i].nguoiXem, tyLeNhap: phoi >= PHOI_TOI_THIEU ? (nhap / phoi) * 1000 : null });
  }
  return out;
}

export type NhanhKhoi = "ON" | "OFF" | "WASH";

export interface DaiKhoi {
  index: number;
  nhanh: NhanhKhoi;
  tu: number;
  den: number;
}

/** Các dải khối theo thời gian, để tô nền (chỉ khi được phép, xem `quyenToNenKhoi`). */
export function daiKhoi(khoi: Block[]): DaiKhoi[] {
  return [...khoi]
    .sort((a, b) => a.start_offset_s - b.start_offset_s)
    .map((b) => ({ index: b.block_index, nhanh: b.is_washout || !b.assignment ? "WASH" : b.assignment, tu: b.start_offset_s, den: b.end_offset_s }));
}

export interface KhoiDo {
  index: number;
  nhanh: "ON" | "OFF";
  tu: number;
  den: number;
  /** Giây·người xem trong cửa sổ đo của khối. */
  phoi: number;
  /** Lượt nhấp hợp lệ trong cửa sổ đo. */
  nhap: number;
  /** Lượt nhấp hợp lệ / 1.000 giây·người xem; null khi khối không đo được. */
  tyLe: number | null;
  doDuoc: boolean;
  lyDo: string | null;
}

/**
 * Tỷ lệ nhấp của từng khối BẬT/TẮT, mô tả, theo luật của máy chủ. `ketThucTs`: lúc phiên thật sự dừng (khối chưa phát
 * thì không đo được, không phải bằng 0). Phiên đang live (không có `ketThucTs`): khối chưa tới (bắt đầu sau điểm đo
 * cuối) bị bỏ hẳn, không tính là "không đo được".
 */
export function khoiTuTicks(khoi: Block[], ticks: Tick[], batDauTs: string | null | undefined, ketThucTs?: string | null): KhoiDo[] {
  if (!batDauTs) return [];
  const tho = diemTho(ticks, batDauTs);
  const rong = tho.length > 1 ? tho[1].t - tho[0].t : O_DO_S;
  const dauDo = tho.length ? tho[0].t : 0;
  const cuoiDo = tho.length ? tho[tho.length - 1].t + rong : 0;
  const hetPhien = ketThucTs ? giayTuBatDau(ketThucTs, batDauTs) : Infinity;
  const out: KhoiDo[] = [];
  for (const b of [...khoi].sort((x, y) => x.start_offset_s - y.start_offset_s)) {
    if (b.is_washout || !b.assignment) continue;
    if (!ketThucTs && b.start_offset_s >= cuoiDo) continue;
    const dai = b.end_offset_s - b.start_offset_s;
    const tu = b.start_offset_s + Math.min(BO_DAU_KHOI_S, Math.max(dai - 30, 0));
    const den = Math.min(b.end_offset_s, hetPhien);
    const lo = Math.max(tu, dauDo);
    const hi = Math.min(den, cuoiDo);
    let phoi = 0;
    let nhap = 0;
    if (tho.length && hi > lo) {
      tho.forEach((d, i) => {
        const t1 = i + 1 < tho.length ? tho[i + 1].t : d.t + rong;
        const a = Math.max(d.t, lo);
        const z = Math.min(t1, hi);
        if (z > a) phoi += d.nguoiXem * (z - a);
        if (d.t >= lo && d.t < hi) nhap += d.nhap;
      });
    }
    let lyDo: string | null = null;
    if (den <= tu) lyDo = "Khối không phát (phiên dừng trước khối này).";
    else if (!tho.length || hi <= lo) lyDo = "Chưa có điểm đo người xem trong khối.";
    else if (phoi < PHOI_TOI_THIEU) lyDo = "Quá ít người xem để tính tỷ lệ nhấp.";
    out.push({
      index: b.block_index,
      nhanh: b.assignment,
      tu: b.start_offset_s,
      den: b.end_offset_s,
      phoi,
      nhap,
      tyLe: lyDo ? null : (nhap / phoi) * 1000,
      doDuoc: lyDo === null,
      lyDo,
    });
  }
  return out;
}

export interface TrungBinhNhanh {
  bat: number | null;
  tat: number | null;
  nBat: number;
  nTat: number;
  /** Khối không đo được, không vào trung bình. */
  nBo: number;
}

/** Trung bình KHÔNG trọng số của tỷ lệ nhấp các khối đo được, mỗi nhánh (cùng cách máy chủ ước lượng). */
export function trungBinhNhanh(khoi: KhoiDo[]): TrungBinhNhanh {
  const bat = khoi.filter((k) => k.doDuoc && k.nhanh === "ON").map((k) => k.tyLe as number);
  const tat = khoi.filter((k) => k.doDuoc && k.nhanh === "OFF").map((k) => k.tyLe as number);
  const tb = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return { bat: tb(bat), tat: tb(tat), nBat: bat.length, nTat: tat.length, nBo: khoi.filter((k) => !k.doDuoc).length };
}

export interface DongYDinh {
  nhan: string;
  ten: string;
  so: number;
  /** Phần của tổng bình luận có nhãn, từ 0 đến 1. */
  tyLe: number;
}

/** Đếm nhãn ý định từ danh sách bình luận (bình luận chưa có nhãn thì bỏ qua). */
export function demYDinh(binhLuan: Pick<Comment, "intent">[]): Record<string, number> {
  const dem: Record<string, number> = {};
  for (const c of binhLuan) if (c.intent) dem[c.intent] = (dem[c.intent] ?? 0) + 1;
  return dem;
}

/**
 * Thanh ý định: sắp giảm dần, "Khác" luôn đứng cuối; quá `toiDa` nhóm thì gộp phần đuôi vào "Khác" (không sinh thêm
 * nhóm, không bỏ bình luận nào).
 */
export function yDinhSapXep(dem: Record<string, number>, toiDa = 6): DongYDinh[] {
  const cap = Object.entries(dem).filter(([, n]) => n > 0);
  const tong = cap.reduce((s, [, n]) => s + n, 0);
  if (tong === 0) return [];
  let khac = cap.find(([k]) => k === "khac")?.[1] ?? 0;
  const chinh = cap
    .filter(([k]) => k !== "khac")
    .sort((a, b) => b[1] - a[1] || (INTENT_DISPLAY[a[0]] ?? a[0]).localeCompare(INTENT_DISPLAY[b[0]] ?? b[0], "vi"));
  const giu = chinh.slice(0, Math.max(1, toiDa));
  for (const [, n] of chinh.slice(giu.length)) khac += n;
  const out = giu.map(([k, n]) => ({ nhan: k, ten: INTENT_DISPLAY[k] ?? k, so: n, tyLe: n / tong }));
  if (khac > 0) out.push({ nhan: "khac", ten: INTENT_DISPLAY.khac, so: khac, tyLe: khac / tong });
  return out;
}

export interface CuaSo {
  /** Giây đầu cửa sổ, từ đầu phiên. */
  tu: number;
  /** Người xem trung bình trong cửa sổ. */
  nguoiXem: number;
  /** Lượt nhấp hợp lệ trong cửa sổ. */
  nhap: number;
  /** Tỷ lệ nhấp trong cửa sổ; null khi mẫu số dưới 60 giây·người xem. */
  tyLeNhap: number | null;
}

/**
 * Gộp điểm đo theo cửa sổ `buocS` giây (mặc định 5 phút), cho đường nhỏ Người xem và bảng 5 phút.
 *
 * CẢNH BÁO khoá §7: cửa sổ cắt theo đồng hồ từ đầu phiên, mà trong phiên 90 phút các khối 1 tới 14 nằm đúng ở
 * [300k, 300k+300) giây, nên cửa sổ 300 giây TRÙNG KHÍT từng khối. `.tyLeNhap` của hàm này vì vậy là tỷ lệ nhấp của
 * từng khối: KHÔNG dùng cho đường nhỏ Tỷ lệ nhấp. Dùng `duongNhoTyLeNhap` (trả null khi còn khoá và không được mở sớm).
 */
export function theoCuaSo(ticks: Tick[], batDauTs: string | null | undefined, buocS = 300): CuaSo[] {
  if (!batDauTs || buocS <= 0) return [];
  const tho = diemTho(ticks, batDauTs);
  const nhom = new Map<number, { tong: number; n: number; nhap: number }>();
  for (const d of tho) {
    const k = Math.floor(d.t / buocS);
    const g = nhom.get(k) ?? { tong: 0, n: 0, nhap: 0 };
    g.tong += d.nguoiXem;
    g.n += 1;
    g.nhap += d.nhap;
    nhom.set(k, g);
  }
  return [...nhom.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, g]) => {
      const phoi = g.tong * O_DO_S;
      return { tu: k * buocS, nguoiXem: g.tong / g.n, nhap: g.nhap, tyLeNhap: phoi >= PHOI_TOI_THIEU ? (g.nhap / phoi) * 1000 : null };
    });
}

export interface TuyChonDuongNho {
  /** True trừ khi máy chủ nói rõ kết quả đã mở (`DuLieuPhien.khoa`). */
  khoa: boolean;
  /** Quyền mở sớm của nguồn (`DuLieuPhien.toNen`). Thiếu thì coi như không được mở sớm. */
  toNen?: Pick<QuyenToNen, "cho"> | null;
  /** Cửa sổ trượt (giây), mặc định 120: ngắn hơn một khối và không cắt theo ranh giới khối. */
  cuaSoS?: number;
  /** Lấy một điểm mỗi `buocS` giây (mặc định 60) cho đường nhỏ khỏi dày. */
  buocS?: number;
}

/**
 * Chuỗi Tỷ lệ nhấp cho đường nhỏ của ô số, đã qua khoá §7.
 *
 * - Trả `null` (không có đường nào) khi `khoa` là true và nguồn không được mở sớm, tức phiên THẬT, CHẠY THỬ hay THỬ
 *   NỘI BỘ đang live: ô số khi đó chỉ được có đường nhỏ Người xem.
 * - Ngược lại trả tỷ lệ nhấp trượt trên `cuaSoS` giây gần nhất, mỗi `buocS` giây một điểm. Cửa sổ trượt không trùng
 *   ranh giới khối (khác `theoCuaSo(…, 300)`), nên đường nhỏ không thành chuỗi tỷ lệ từng khối.
 * - Không có giờ bắt đầu: mảng rỗng.
 */
export function duongNhoTyLeNhap(
  ticks: Tick[],
  phien: { start_ts?: string | null } | null | undefined,
  { khoa, toNen = null, cuaSoS = 120, buocS = 60 }: TuyChonDuongNho,
): Array<number | null> | null {
  if (khoa && toNen?.cho !== true) return null;
  const diem = chuoiThoiGian(ticks, phien?.start_ts, cuaSoS);
  if (!diem.length) return [];
  const buoc = Math.max(O_DO_S, buocS);
  const out: Array<number | null> = [];
  let moc = -Infinity;
  for (let i = 0; i < diem.length; i++) {
    const cuoi = i === diem.length - 1;
    if (diem[i].t >= moc + buoc - 1e-6 || cuoi) {
      out.push(diem[i].tyLeNhap);
      moc = diem[i].t;
    }
  }
  return out;
}

/** Đỉnh người xem cùng lúc trong các điểm đo. */
export function dinhNguoiXem(ticks: Tick[]): number | null {
  return ticks.length ? Math.max(...ticks.map((t) => Math.max(0, t.viewers))) : null;
}
