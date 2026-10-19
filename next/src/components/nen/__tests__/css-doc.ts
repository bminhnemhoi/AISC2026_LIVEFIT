/** Bộ đọc CSS rất nhỏ cho test: tách quy tắc (kể cả trong @media, @container, @keyframes) và khai báo. */
import { readFileSync } from "node:fs";
import path from "node:path";

export interface QuyTac {
  /** Bộ chọn của khối chứa khai báo. */
  boChon: string;
  /** Các khối bao ngoài (ví dụ "@media (max-width: 767px)", "@keyframes nen-cho"). */
  cha: readonly string[];
  khai: ReadonlyArray<{ ten: string; giaTri: string }>;
}

export function docTep(tuongDoi: string): string {
  return readFileSync(path.resolve(process.cwd(), tuongDoi), "utf8");
}

export function tachQuyTac(css: string): QuyTac[] {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const ra: QuyTac[] = [];
  const ngan: string[] = [];
  let dem = "";
  for (const ch of s) {
    if (ch === "{") {
      ngan.push(dem.trim());
      dem = "";
    } else if (ch === "}") {
      const boChon = ngan.pop() ?? "";
      const than = dem.trim();
      if (than) {
        const khai = than
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => {
            const i = d.indexOf(":");
            return { ten: d.slice(0, i).trim(), giaTri: d.slice(i + 1).trim() };
          });
        ra.push({ boChon, cha: [...ngan], khai });
      }
      dem = "";
    } else {
      dem += ch;
    }
  }
  return ra;
}

/** Góc (độ) của một giá trị rotate đơn: "-1.5deg" → -1.5, "0" → 0, "0.25turn" → 90. null nếu không đọc được. */
export function goc(giaTri: string): number | null {
  const v = giaTri.trim();
  if (v === "0" || v === "none") return 0;
  const m = /^(-?\d*\.?\d+)(deg|turn|rad|grad)$/.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "deg" ? n : m[2] === "turn" ? n * 360 : m[2] === "rad" ? (n * 180) / Math.PI : n * 0.9;
}
