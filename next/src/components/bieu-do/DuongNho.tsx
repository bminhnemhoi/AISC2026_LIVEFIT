"use client";

import { BIEN, type TenMau } from "@/lib/bieu-do/mau";
import { moTaDuongNho } from "@/lib/bieu-do/mo-ta";
import { thangTuyenTinh } from "@/lib/bieu-do/thang";
import { duongDut } from "@/lib/bieu-do/ve";
import "./bieu-do.css";

/**
 * Đường nhỏ (sparkline) cho ô số: một chuỗi, đáy là 0, chấm ở điểm mới nhất. Không trục, không nhãn: số chính nằm
 * trong ô số bên cạnh; câu mô tả thay ảnh nói đủ điểm gần nhất và cao nhất.
 */

export interface DuongNhoProps {
  giaTri: Array<number | null>;
  /** Tên chuỗi, dùng trong câu mô tả. */
  ten: string;
  mau?: TenMau;
  rong?: number;
  cao?: number;
}

export function DuongNho({ giaTri, ten, mau = "trung", rong = 96, cao = 28 }: DuongNhoProps) {
  const so = giaTri.filter((v): v is number => v != null && Number.isFinite(v));
  const lon = so.length ? Math.max(...so, 0) : 0;
  const pad = 4;
  const x = thangTuyenTinh([0, Math.max(1, giaTri.length - 1)], [pad, rong - pad]);
  const y = thangTuyenTinh([0, lon > 0 ? lon : 1], [cao - pad, pad]);
  const pts = giaTri.map((v, i) => ({ x: x(i), y: v == null || !Number.isFinite(v) ? null : y(v) }));
  let cuoi = -1;
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i].y != null) {
      cuoi = i;
      break;
    }
  }
  return (
    <svg
      className="bd bd-duong-nho"
      width={rong}
      height={cao}
      viewBox={`0 0 ${rong} ${cao}`}
      role="img"
      aria-label={moTaDuongNho(ten, giaTri)}
      data-testid="bd-duong-nho"
    >
      <line x1={pad} x2={rong - pad} y1={cao - pad} y2={cao - pad} stroke="var(--bd-luoi)" strokeWidth={1} />
      <path d={duongDut(pts)} fill="none" stroke={BIEN[mau]} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      {cuoi >= 0 ? <circle cx={pts[cuoi].x} cy={pts[cuoi].y as number} r={3} fill={BIEN[mau]} stroke="var(--bd-nen)" strokeWidth={1.5} /> : null}
    </svg>
  );
}
