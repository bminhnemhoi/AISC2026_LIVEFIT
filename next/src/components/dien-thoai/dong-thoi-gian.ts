/**
 * Phần thuần (không React) của khung điện thoại live: đường tệp chuẩn của người dẫn AI, đọc tệp dòng thời gian,
 * tìm món người dẫn đang nói, đổi đường YouTube sang trình phát nhúng, định dạng số và giá.
 */

/** Video người dẫn AI (V1 tạo, không commit). Chưa có tệp thì khung điện thoại tự dùng hình dự phòng. */
export const DUONG_VIDEO_NGUOI_DAN = "/xem/nguoi-dan-ai.mp4";
/** Dòng thời gian món người dẫn nói tới, do máy chép lời (faster-whisper) rồi dò tên món. */
export const DUONG_DONG_THOI_GIAN = "/xem/nguoi-dan-ai.json";

/** Một đoạn: từ giây `tu_s` tới trước giây `den_s`, người dẫn nói về món `mon`. `loi` là lời đã chép (tuỳ chọn). */
export interface DoanDongThoiGian {
  tu_s: number;
  den_s: number;
  mon: string;
  loi?: string;
}

function laSo(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/**
 * Đọc tệp dòng thời gian. Nhận mảng đoạn, hoặc đối tượng có khoá `dong_thoi_gian`, `doan` hay `segments`.
 * Bỏ đoạn hỏng (thiếu số, tên rỗng, den_s ≤ tu_s); sắp theo `tu_s`. Không đọc được gì thì trả mảng rỗng.
 */
export function docDongThoiGian(du: unknown): DoanDongThoiGian[] {
  const goc = Array.isArray(du)
    ? du
    : du && typeof du === "object"
      ? ((du as Record<string, unknown>).dong_thoi_gian ?? (du as Record<string, unknown>).doan ?? (du as Record<string, unknown>).segments)
      : null;
  if (!Array.isArray(goc)) return [];
  const ra: DoanDongThoiGian[] = [];
  for (const x of goc) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const tu = o.tu_s ?? o.start;
    const den = o.den_s ?? o.end;
    const mon = typeof o.mon === "string" ? o.mon.trim() : "";
    if (!laSo(tu) || !laSo(den) || den <= tu || !mon) continue;
    const doan: DoanDongThoiGian = { tu_s: tu, den_s: den, mon };
    if (typeof o.loi === "string" && o.loi.trim()) doan.loi = o.loi.trim();
    ra.push(doan);
  }
  return ra.sort((a, b) => a.tu_s - b.tu_s);
}

/** Đoạn chứa giây `t` (tu_s ≤ t < den_s); không có thì null. */
export function doanTai(dong: readonly DoanDongThoiGian[] | undefined, t: number): DoanDongThoiGian | null {
  if (!dong || !Number.isFinite(t)) return null;
  for (const d of dong) if (d.tu_s <= t && t < d.den_s) return d;
  return null;
}

/** Tên món người dẫn đang nói tới ở giây `t`; không có thì null. */
export function monDangNoi(dong: readonly DoanDongThoiGian[] | undefined, t: number): string | null {
  return doanTai(dong, t)?.mon ?? null;
}

export type NguonVideo = { kieu: "video"; src: string } | { kieu: "youtube"; src: string; id: string };

const YOUTUBE = /^(?:https?:)?\/\/(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\//i;
const MA_YOUTUBE = /(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/;

/**
 * Phân loại nguồn: đường YouTube đổi sang trình phát nhúng youtube-nocookie (CSP chỉ cho khung này), tắt tiếng,
 * lặp, có API điều khiển để tạm dừng; còn lại là tệp video (mp4). Chuỗi rỗng thì null.
 */
export function nguonVideo(src: string | null | undefined, goc?: string): NguonVideo | null {
  const s = (src ?? "").trim();
  if (!s) return null;
  if (YOUTUBE.test(s)) {
    const m = s.match(MA_YOUTUBE);
    if (!m) return null;
    const id = m[1];
    const q = new URLSearchParams({ autoplay: "1", mute: "1", loop: "1", playlist: id, playsinline: "1", controls: "0", enablejsapi: "1", rel: "0" });
    if (goc) q.set("origin", goc);
    return { kieu: "youtube", id, src: `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}` };
  }
  return { kieu: "video", src: s };
}

/** Số người xem kiểu vi-VN: 1.234; từ 10.000 viết gọn "12,3 N" (nghìn). */
export function dinhDangNguoiXem(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  const k = Math.round(n);
  if (k < 10000) return k.toLocaleString("vi-VN");
  return `${(Math.floor(k / 100) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} N`;
}

/** Giá kiểu vi-VN: 129.000 đ. */
export function dinhDangGia(gia: number): string {
  return `${Math.round(gia).toLocaleString("vi-VN")} đ`;
}

/** true khi chuỗi truy vấn có `anh-poster=1` (chế độ chụp poster: thay video bằng người dẫn vẽ tay). */
export function laAnhPoster(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    return new URLSearchParams(search).get("anh-poster") === "1";
  } catch {
    return false;
  }
}
