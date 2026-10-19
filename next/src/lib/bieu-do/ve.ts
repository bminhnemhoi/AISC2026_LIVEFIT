/**
 * Hình học nhỏ cho các biểu đồ SVG tự dựng: đường, vùng tô, hình thoi, thanh bo một đầu, tìm điểm gần nhất.
 * Thuần, không React. Toạ độ đã qua thang (pixel), làm tròn 1 chữ số để chuỗi `d` ngắn.
 */

export interface DiemVe {
  x: number;
  /** null: thiếu số, đường đứt ở đây (không nối qua chỗ thiếu). */
  y: number | null;
}

const r1 = (v: number): string => (Math.round(v * 10) / 10).toString();

function doan(diem: DiemVe[]): Array<Array<{ x: number; y: number }>> {
  const out: Array<Array<{ x: number; y: number }>> = [];
  let cur: Array<{ x: number; y: number }> = [];
  for (const d of diem) {
    if (d.y == null || !Number.isFinite(d.y) || !Number.isFinite(d.x)) {
      if (cur.length) out.push(cur);
      cur = [];
      continue;
    }
    cur.push({ x: d.x, y: d.y });
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Đường nối các điểm; mỗi đoạn liền bắt đầu bằng M. Một điểm lẻ loi vẫn có mặt (M x,y h0) để nét tròn hiện thành chấm. */
export function duongDut(diem: DiemVe[]): string {
  return doan(diem)
    .map((d) => (d.length === 1 ? `M${r1(d[0].x)},${r1(d[0].y)}h0` : d.map((p, i) => `${i ? "L" : "M"}${r1(p.x)},${r1(p.y)}`).join("")))
    .join("");
}

/** Vùng tô dưới đường tới đáy `y0`, từng đoạn liền một vùng. */
export function vungDuoi(diem: DiemVe[], y0: number): string {
  return doan(diem)
    .filter((d) => d.length > 1)
    .map((d) => `${d.map((p, i) => `${i ? "L" : "M"}${r1(p.x)},${r1(p.y)}`).join("")}L${r1(d[d.length - 1].x)},${r1(y0)}L${r1(d[0].x)},${r1(y0)}Z`)
    .join("");
}

/** Chỉ số phần tử của `xs` (tăng dần) gần `x` nhất; -1 khi rỗng. */
export function ganNhat(xs: readonly number[], x: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[hi] - x) < Math.abs(xs[lo] - x) ? hi : lo;
}

/** Hình thoi tâm (cx, cy), nửa rộng `rx`, nửa cao `ry` (kết quả gộp trên biểu đồ rừng). */
export function hinhThoi(cx: number, cy: number, rx: number, ry: number): string {
  return `M${r1(cx - rx)},${r1(cy)}L${r1(cx)},${r1(cy - ry)}L${r1(cx + rx)},${r1(cy)}L${r1(cx)},${r1(cy + ry)}Z`;
}

/**
 * Hình thoi của kết quả gộp trên biểu đồ rừng: mũi trái ở đầu dưới khoảng tin cậy, mũi phải ở đầu trên, đỉnh và đáy
 * ở điểm ước lượng (nên lệch khi khoảng không đối xứng, đúng như số).
 */
export function hinhThoiKhoang(xThap: number, xUoc: number, xCao: number, cy: number, ry: number): string {
  return `M${r1(xThap)},${r1(cy)}L${r1(xUoc)},${r1(cy - ry)}L${r1(xCao)},${r1(cy)}L${r1(xUoc)},${r1(cy + ry)}Z`;
}

/**
 * Thanh ngang mọc từ gốc `x0` sang phải, dài `w`: đầu dữ liệu bo `r` (4 px theo luật nét), gốc vuông.
 * Thanh ngắn hơn bán kính thì bo nhỏ lại cho vừa.
 */
export function thanhNgang(x0: number, y: number, w: number, h: number, r = 4): string {
  const ww = Math.max(0, w);
  const rr = Math.max(0, Math.min(r, ww, h / 2));
  return `M${r1(x0)},${r1(y)}H${r1(x0 + ww - rr)}Q${r1(x0 + ww)},${r1(y)} ${r1(x0 + ww)},${r1(y + rr)}V${r1(y + h - rr)}Q${r1(x0 + ww)},${r1(y + h)} ${r1(x0 + ww - rr)},${r1(y + h)}H${r1(x0)}Z`;
}

/** Giới hạn v trong [lo, hi]. */
export function kep(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
