/**
 * Thang đo và vạch chia cho các biểu đồ tự dựng. Thuần, không React: mỗi hàm có test.
 */

export type Thang = (v: number) => number;

/** Thang tuyến tính: đoạn [d0, d1] sang [r0, r1]. Miền rỗng thì trả giữa khoảng ra. */
export function thangTuyenTinh([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]): Thang {
  const span = d1 - d0;
  if (!Number.isFinite(span) || span === 0) return () => (r0 + r1) / 2;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Bước "đẹp" (1, 2, 2,5, 5 × 10^k) để chia `span` thành khoảng `n` đoạn. */
export function buocDep(span: number, n = 4): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const tho = span / Math.max(1, n);
  const mu = 10 ** Math.floor(Math.log10(tho));
  const r = tho / mu;
  const he = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
  return he * mu;
}

function lamTron(v: number, buoc: number): number {
  // Bỏ sai số dấu phẩy động (0,30000000000000004).
  const soLe = Math.max(0, -Math.floor(Math.log10(buoc)) + 2);
  return Number(v.toFixed(soLe));
}

/**
 * Vạch trục từ 0 (luật dataviz: trục giá trị luôn bắt đầu ở 0). `max` âm hoặc 0 vẫn trả về [0, 1] để trục không sập.
 */
export function vachTu0(max: number, n = 4): { max: number; vach: number[] } {
  const m = Number.isFinite(max) && max > 0 ? max : 1;
  const buoc = buocDep(m, n);
  const tren = Math.ceil(m / buoc - 1e-9) * buoc;
  const vach: number[] = [];
  for (let v = 0; v <= tren + buoc / 2; v += buoc) vach.push(lamTron(v, buoc));
  return { max: lamTron(tren, buoc), vach };
}

/**
 * Miền đối xứng quanh 0 cho thước khoảng tin cậy và biểu đồ rừng: hai phía (GIỮ bên trái, ĐỔI bên phải) rộng bằng
 * nhau, nên mắt không bị lừa vì một phía dài hơn. Có lề 20% để đầu khoảng không chạm mép.
 */
export function mienDoiXung(giaTri: number[], n = 2): { min: number; max: number; vach: number[] } {
  const huuHan = giaTri.filter(Number.isFinite);
  const lon = huuHan.length ? Math.max(...huuHan.map(Math.abs)) : 0;
  const goc = lon > 0 ? lon * 1.2 : 1;
  const buoc = buocDep(goc, n);
  const bien = Math.ceil(goc / buoc - 1e-9) * buoc;
  const vach: number[] = [];
  for (let v = -bien; v <= bien + buoc / 2; v += buoc) vach.push(lamTron(v, buoc) || 0);
  return { min: -lamTron(bien, buoc), max: lamTron(bien, buoc), vach };
}

/** Bước vạch thời gian (giây) sao cho không quá `toiDa` nhãn trên trục. */
export function buocThoiGian(mienS: number, toiDa: number): number {
  const cac = [60, 120, 300, 600, 900, 1200, 1800, 3600];
  return cac.find((s) => mienS / s <= Math.max(1, toiDa)) ?? 3600;
}

export function vachThoiGian(mienS: number, rongVe: number, rongNhan = 72): number[] {
  const buoc = buocThoiGian(mienS, Math.max(2, Math.floor(rongVe / rongNhan)));
  const out: number[] = [];
  for (let t = 0; t <= mienS + 0.5; t += buoc) out.push(t);
  return out;
}
