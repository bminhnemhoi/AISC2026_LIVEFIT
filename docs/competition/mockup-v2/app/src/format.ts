// vi-VN formatting. Missing values are words, never 0.

const num = new Intl.NumberFormat("vi-VN");

export const fmtNum = (n: number) => num.format(n);

/** "199.000 ₫" with a narrow no-break space so the symbol never wraps alone. */
export const fmtPrice = (n: number | null) => (n === null ? null : `${num.format(n)} ₫`);

/** Elapsed live time, mm:ss. */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Spoken duration, e.g. "4 phút 50 giây". */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} giây`;
  return r === 0 ? `${m} phút` : `${m} phút ${r} giây`;
}
