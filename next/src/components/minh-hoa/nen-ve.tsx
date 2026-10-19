import React from "react";
import { MAU_HINH } from "./mau";

/**
 * Viên gạch dựng mọi hình vẽ tay của U3: khung SVG gốc, nhãn dán cắt khuôn, nét mực nâu và sọc chéo cho khối TẮT.
 * Không dùng gradient hay id (nhiều hình trên một trang không đụng nhau, và xuất SVG tĩnh không cần gì thêm).
 */

/** Props chung của một hình: mọi thuộc tính của thẻ `<svg>` (đặt x, y, width, height khi lồng vào SVG lớn) và `title`. */
export type HinhProps = Omit<React.SVGProps<SVGSVGElement>, "children" | "viewBox" | "ref"> & {
  /** Có `title` thì hình là ảnh có nhãn (role="img"); không có thì chỉ để trang trí (aria-hidden). */
  title?: string;
};

/** Thẻ `<svg>` gốc: xmlns để xuất tĩnh, lớp `mh-hinh` để trang đặt cỡ. */
export function Goc({ viewBox, title, className, children, ...rest }: HinhProps & { viewBox: string; children: React.ReactNode }) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true as const };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} className={`mh-hinh${className ? ` ${className}` : ""}`} focusable="false" {...a11y} {...rest}>
      {children}
    </svg>
  );
}

/** Nét mực nâu cho chi tiết bên trong nhãn dán. */
export const NET = { stroke: MAU_HINH.mucNau, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
/** Nét mảnh hơn. */
export const NET_MANH = { ...NET, strokeWidth: 1.5 } as const;

/** Đường tròn viết bằng `d` (dùng làm thân nhãn dán). */
export function tron(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** Hình chữ nhật bo góc viết bằng `d`. */
export function chuNhat(x: number, y: number, w: number, h: number, r = 0): string {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  if (k === 0) return `M${x} ${y}h${w}v${h}h${-w}z`;
  return `M${x + k} ${y}h${w - 2 * k}a${k} ${k} 0 0 1 ${k} ${k}v${h - 2 * k}a${k} ${k} 0 0 1 ${-k} ${k}h${-(w - 2 * k)}a${k} ${k} 0 0 1 ${-k} ${-k}v${-(h - 2 * k)}a${k} ${k} 0 0 1 ${k} ${-k}z`;
}

/**
 * Nhãn dán cắt khuôn: viền cắt mềm, lề trắng, thân giấy (hoặc kraft, hoặc một màu), nét mực nâu.
 * Cùng kiểu với StartArt, chỉ bỏ gradient để hình xuất tĩnh được.
 */
export function NhanDan({ d, than = "giay", children }: { d: string; than?: "giay" | "kraft" | string; children?: React.ReactNode }) {
  const fill = than === "giay" ? MAU_HINH.giay : than === "kraft" ? MAU_HINH.kraftA : than;
  return (
    <g>
      <path d={d} fill="none" stroke={MAU_HINH.vienCat} strokeWidth={15} strokeLinejoin="round" />
      <path d={d} fill={MAU_HINH.le} stroke={MAU_HINH.le} strokeWidth={12} strokeLinejoin="round" />
      <path d={d} fill={fill} stroke={MAU_HINH.mucNau} strokeWidth={2.4} strokeLinejoin="round" />
      {children}
    </g>
  );
}

/**
 * Sọc chéo 45° nằm gọn trong hình chữ nhật (x, y, w, h), cách nhau `buoc`. Trả về `d` của các đoạn thẳng.
 * Dùng cho khối TẮT (D-026: xám kèm sọc), không cần pattern hay clipPath.
 */
export function socChuNhat(x: number, y: number, w: number, h: number, buoc = 6): string {
  const parts: string[] = [];
  // các đường x' + y' = c, với x' = X - x, y' = Y - y, c chạy từ buoc tới w + h
  for (let c = buoc; c < w + h; c += buoc) {
    const x1 = Math.min(c, w);
    const y1 = c - x1;
    const y2 = Math.min(c, h);
    const x2 = c - y2;
    parts.push(`M${r2(x + x1)} ${r2(y + y1)}L${r2(x + x2)} ${r2(y + y2)}`);
  }
  return parts.join("");
}

/** Sọc chéo 45° nằm gọn trong hình tròn tâm (cx, cy) bán kính r. */
export function socTron(cx: number, cy: number, r: number, buoc = 6): string {
  const parts: string[] = [];
  // đường u = (X - cx) + (Y - cy) = c; khoảng cách từ tâm = |c| / √2
  const gioiHan = r * Math.SQRT2;
  for (let c = -gioiHan + buoc; c < gioiHan; c += buoc) {
    const d = Math.abs(c) / Math.SQRT2;
    if (d >= r) continue;
    const nua = Math.sqrt(r * r - d * d);
    // trung điểm của dây cung nằm trên đường chéo, hướng dây cung là (1, -1)/√2
    const mx = cx + c / 2;
    const my = cy + c / 2;
    const dx = nua / Math.SQRT2;
    parts.push(`M${r2(mx - dx)} ${r2(my + dx)}L${r2(mx + dx)} ${r2(my - dx)}`);
  }
  return parts.join("");
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
