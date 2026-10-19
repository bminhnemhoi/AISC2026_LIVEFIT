import React from "react";
import { MAU } from "./mau";
import { Goc, NET, NET_MANH, NhanDan, chuNhat, type HinhProps } from "./nen-ve";
import "./minh-hoa.css";

/**
 * Bốn món của bộ hàng dùng chung (D-025), vẽ tay kiểu nhãn dán: Áo thun cotton basic · Túi tote canvas ·
 * Bình giữ nhiệt inox 750ml · Set 3 kẹp tóc càng cua. Không có chữ trong hình.
 */

const XANH_RIEU = "#8a9a7b";
const XANH_RIEU_DAM = "#6f7f61";
const INOX = "#cfd3d8";
const INOX_SANG = "#eef0f2";
const INOX_TOI = "#9aa1a9";
const DOI_MOI = "#a0673f";

/** Áo thun cotton basic. */
export function AoThun(p: HinhProps) {
  return (
    <Goc viewBox="0 0 120 120" {...p}>
      <NhanDan than={XANH_RIEU} d="M44 18Q60 32 76 18L102 29 112 53 95 60 93 55V106H27V55L25 60 8 53 18 29Z">
        <path d="M44 18Q60 32 76 18" {...NET} />
        <path d="M27 55L25 42M93 55L95 42" {...NET_MANH} stroke={XANH_RIEU_DAM} />
        <path d="M31 99H89" {...NET_MANH} stroke={XANH_RIEU_DAM} strokeDasharray="3 3" />
        <rect x="55" y="25" width="10" height="7" rx="1" fill={MAU.le} stroke={MAU.mucNau} strokeWidth={1.2} />
      </NhanDan>
    </Goc>
  );
}

/** Túi tote canvas. */
export function TuiTote(p: HinhProps) {
  return (
    <Goc viewBox="0 0 120 120" {...p}>
      {/* quai túi: lề trắng, viền mực, thân kraft đậm */}
      <g fill="none" strokeLinecap="round">
        <path d="M40 48C40 14 56 14 56 48M64 48C64 14 80 14 80 48" stroke={MAU.vienCat} strokeWidth={16} />
        <path d="M40 48C40 14 56 14 56 48M64 48C64 14 80 14 80 48" stroke={MAU.le} strokeWidth={13} />
        <path d="M40 48C40 14 56 14 56 48M64 48C64 14 80 14 80 48" stroke={MAU.mucNau} strokeWidth={7} />
        <path d="M40 48C40 14 56 14 56 48M64 48C64 14 80 14 80 48" stroke={MAU.kraftB} strokeWidth={4} />
      </g>
      <NhanDan than="kraft" d={chuNhat(24, 44, 72, 64, 4)}>
        <path d="M30 52H90" {...NET_MANH} strokeDasharray="3 3" />
        <rect x="44" y="64" width="32" height="26" rx="3" fill={MAU.le} stroke={MAU.mucNau} strokeWidth={1.6} />
        <path d="M51 77q9-9 18 0" {...NET_MANH} stroke={MAU.gach} />
      </NhanDan>
    </Goc>
  );
}

/** Bình giữ nhiệt inox 750ml. */
export function BinhGiuNhiet(p: HinhProps) {
  return (
    <Goc viewBox="0 0 120 120" {...p}>
      <NhanDan than={INOX} d={chuNhat(40, 26, 40, 86, 10)}>
        <rect x="47" y="34" width="6" height="68" rx="3" fill={INOX_SANG} />
        <path d="M40 40H80M40 98H80" {...NET_MANH} stroke={INOX_TOI} />
      </NhanDan>
      {/* nắp */}
      <NhanDan than={MAU.mucNau} d={chuNhat(44, 8, 32, 22, 6)}>
        <path d="M50 14H70" stroke={MAU.mucNhat} strokeWidth={2} strokeLinecap="round" />
      </NhanDan>
    </Goc>
  );
}

/** Set 3 kẹp tóc càng cua, kẹp trên tấm bìa giấy. */
export function KepToc(p: HinhProps) {
  const mau = [DOI_MOI, MAU.ghiChu, XANH_RIEU];
  return (
    <Goc viewBox="0 0 120 120" {...p}>
      <NhanDan d={chuNhat(14, 12, 92, 96, 8)}>
        <circle cx="60" cy="22" r="4" fill={MAU.le} stroke={MAU.mucNau} strokeWidth={1.6} />
      </NhanDan>
      {mau.map((m, i) => {
        const y = 36 + i * 24;
        return (
          <g key={i}>
            {/* răng kẹp */}
            <path d={`M36 ${y + 8}q-2 9 2 14M46 ${y + 9}q-1 9 1 14M56 ${y + 9}q0 9 0 14M66 ${y + 9}q0 9 0 14M76 ${y + 9}q1 9-1 14M84 ${y + 8}q2 9-2 14`} fill="none" stroke={MAU.mucNau} strokeWidth={5.2} strokeLinecap="round" />
            <path d={`M36 ${y + 8}q-2 9 2 14M46 ${y + 9}q-1 9 1 14M56 ${y + 9}q0 9 0 14M66 ${y + 9}q0 9 0 14M76 ${y + 9}q1 9-1 14M84 ${y + 8}q2 9-2 14`} fill="none" stroke={m} strokeWidth={2.6} strokeLinecap="round" />
            {/* thân kẹp */}
            <rect x="30" y={y} width="60" height="12" rx="6" fill={m} stroke={MAU.mucNau} strokeWidth={2} />
            <path d={`M38 ${y + 4}H50`} stroke={MAU.le} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
          </g>
        );
      })}
    </Goc>
  );
}

export type MaMon = "ao-thun" | "tui-tote" | "binh-giu-nhiet" | "kep-toc";

export interface MonHang {
  ma: MaMon;
  /** mã trong phòng xem (scripts/mo_phong_xem.py) */
  productId: string;
  ten: string;
  /** giá MINH HOẠ, đồng; người xem mua bằng tiền ảo */
  gia: number;
  Hinh: (p: HinhProps) => React.ReactElement;
}

/** Bộ hàng D-025, cùng tên và giá với `scripts/mo_phong_xem.py` (SAN_PHAM_MAC_DINH). */
export const BO_HANG: readonly MonHang[] = [
  { ma: "ao-thun", productId: "LAB-1", ten: "Áo thun cotton basic", gia: 129000, Hinh: AoThun },
  { ma: "tui-tote", productId: "LAB-2", ten: "Túi tote canvas", gia: 89000, Hinh: TuiTote },
  { ma: "binh-giu-nhiet", productId: "LAB-3", ten: "Bình giữ nhiệt inox 750ml", gia: 159000, Hinh: BinhGiuNhiet },
  { ma: "kep-toc", productId: "LAB-4", ten: "Set 3 kẹp tóc càng cua", gia: 39000, Hinh: KepToc },
];

/** Bỏ dấu và chữ hoa để so tên món. */
export function boDau(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

/**
 * Tìm món trong bộ hàng theo tên, mã món hoặc mã sản phẩm (không phân biệt dấu, chữ hoa). Nhận cả tên gọi khác
 * mà người dẫn hay nói ("áo", "túi", "bình", "kẹp"). Không thấy thì trả null.
 */
export function timMon(ten: string | null | undefined): MonHang | null {
  if (!ten) return null;
  const k = boDau(ten.trim());
  if (!k) return null;
  const dung = BO_HANG.find((m) => m.ma === k || m.productId.toLowerCase() === k || boDau(m.ten) === k);
  if (dung) return dung;
  const tu: Record<MaMon, RegExp> = {
    "ao-thun": /\bao\b|ao thun|t-?shirt/,
    "tui-tote": /\btui\b|tote/,
    "binh-giu-nhiet": /\bbinh\b|giu nhiet/,
    "kep-toc": /\bkep\b|cang cua/,
  };
  return BO_HANG.find((m) => tu[m.ma].test(k)) ?? null;
}

/** Hình của một món theo tên; món lạ thì vẽ thẻ giá trơn. */
export function HinhMon({ ten, ...p }: HinhProps & { ten: string | null | undefined }) {
  const mon = timMon(ten);
  if (mon) return <mon.Hinh {...p} />;
  return (
    <Goc viewBox="0 0 120 120" {...p}>
      <NhanDan d="M14 60L56 18H104V102H56Z">
        <circle cx="56" cy="60" r="6" fill={MAU.kem} stroke={MAU.mucNau} strokeWidth={2} />
        <path d="M70 40H94M70 54H94M70 70H86" {...NET} />
      </NhanDan>
    </Goc>
  );
}
