import React from "react";
import { MAU, PHONG } from "./mau";
import { Goc, socTron, type HinhProps } from "./nen-ve";

/** Mặt đồng xu: BẬT (xanh), TẮT (xám kèm sọc, D-026) hoặc chưa tung (kraft, dấu hỏi). */
export type MatKhoi = "bat" | "tat";
export type MatXuKieu = MatKhoi | "chua";

/** Nhãn đọc cho từng mặt (dùng cho aria-label và chữ thay thế). */
export const TEN_MAT: Record<MatXuKieu, string> = { bat: "BẬT", tat: "TẮT", chua: "chưa tung" };

/**
 * Một mặt đồng xu, vẽ tĩnh (không hook), dùng được trong SVG xuất cho slide và poster.
 * `nho`: chỉ một chữ B / T (đồng xu nhỏ trong dải 16 khối); không thì ghi đủ BẬT / TẮT.
 */
export function MatXu({ mat, nho = false, ...p }: HinhProps & { mat: MatXuKieu; nho?: boolean }) {
  const chu = mat === "chua" ? "?" : nho ? (mat === "bat" ? "B" : "T") : TEN_MAT[mat];
  const coChu = nho ? 26 : chu.length > 1 ? 15 : 22;
  return (
    <Goc viewBox="0 0 64 64" {...p}>
      {/* lề trắng của nhãn dán */}
      <circle cx="32" cy="32" r="31" fill={MAU.le} stroke={MAU.vienCat} strokeWidth={1.5} />
      {mat === "bat" && (
        <g>
          <circle cx="32" cy="32" r="27" fill={MAU.bat} stroke={MAU.mucNau} strokeWidth={2} />
          <circle cx="32" cy="32" r="21.5" fill="none" stroke={MAU.batNhat} strokeWidth={1.4} strokeDasharray="2.5 2.5" opacity={0.85} />
          <text x="32" y={32 + coChu * 0.36} textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={coChu} fill="#ffffff">{chu}</text>
        </g>
      )}
      {mat === "tat" && (
        <g>
          <circle cx="32" cy="32" r="27" fill={MAU.tatNhat} stroke={MAU.mucNau} strokeWidth={2} />
          <path d={socTron(32, 32, 26, 5.5)} stroke={MAU.tat} strokeWidth={1.6} />
          <circle cx="32" cy="32" r={nho ? 15 : 17} fill={MAU.le} stroke={MAU.tat} strokeWidth={1.4} />
          <text x="32" y={32 + (nho ? 20 : 13) * 0.36} textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={nho ? 20 : 13} fill={MAU.muc}>{chu}</text>
        </g>
      )}
      {mat === "chua" && (
        <g>
          <circle cx="32" cy="32" r="27" fill={MAU.kraftA} stroke={MAU.mucNau} strokeWidth={2} />
          <circle cx="32" cy="32" r="21.5" fill="none" stroke={MAU.kraftB} strokeWidth={1.4} />
          <text x="32" y={32 + coChu * 0.36} textAnchor="middle" fontFamily={PHONG} fontWeight={700} fontSize={coChu} fill={MAU.mucNau}>{chu}</text>
        </g>
      )}
    </Goc>
  );
}

/**
 * Lịch MINH HOẠ cho 16 khối (8 BẬT, 8 TẮT), cố định để ảnh chụp và video luôn giống nhau.
 * Không phải lịch của phiên nào; lịch thật do lõi bốc thăm và niêm phong.
 */
export const LICH_MINH_HOA: readonly MatKhoi[] = [
  "bat", "tat", "tat", "bat", "bat", "tat", "bat", "tat",
  "tat", "bat", "tat", "bat", "bat", "tat", "tat", "bat",
];

/** Đếm số khối BẬT và TẮT của một lịch. */
export function demLich(lich: readonly MatKhoi[]): { bat: number; tat: number } {
  let bat = 0;
  for (const m of lich) if (m === "bat") bat++;
  return { bat, tat: lich.length - bat };
}
