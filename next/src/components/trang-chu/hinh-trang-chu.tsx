// Hình vẽ tay riêng của trang giới thiệu (D-021: SVG tự viết, không ảnh sinh). Hình tĩnh, dùng được ở máy chủ.
// Không phần tử nào nghiêng; màu theo D-026 (lấy từ MAU của minh-hoa).
import React from "react";
import { MAU, PHONG } from "@/components/minh-hoa";

/** Đường người xem dùng chung: lên dần, đỉnh quanh phút 33, rồi xuống. */
function duongNguoiXem(x0: number, x1: number, yDay: number, yDinh: number, dinh = 0.55): string {
  const w = x1 - x0;
  const xd = x0 + w * dinh;
  return [
    `M${x0} ${yDay - 18}`,
    `C${x0 + w * 0.2} ${yDay - 22}, ${x0 + w * 0.35} ${yDay - 40}, ${xd - w * 0.1} ${yDinh + 10}`,
    `S${xd + w * 0.05} ${yDinh - 4}, ${xd + w * 0.12} ${yDinh + 14}`,
    `S${x0 + w * 0.85} ${yDay - 40}, ${x1} ${yDay - 30}`,
  ].join(" ");
}

/** Vấn đề: phút 30 ghim áo, phút 35 đơn tăng, đúng lúc đông khách nhất. */
export function HinhVanDe({ className }: { className?: string }): React.ReactElement {
  const x0 = 36;
  const x1 = 516;
  const day = 204;
  const xPhut = (p: number) => x0 + ((x1 - x0) * p) / 60;
  const xGhim = xPhut(30);
  const xDon = xPhut(35);
  return (
    <svg
      viewBox="0 0 560 240"
      className={`tc-hinh${className ? ` ${className}` : ""}`}
      role="img"
      aria-label="Đường người xem lên cao quanh phút 30 đến 35. Phút 30 ghim áo, phút 35 đơn tăng, nên không biết đơn tăng vì ghim hay vì đông khách."
      focusable="false"
    >
      {/* nền giờ đông khách */}
      <rect x={xPhut(24)} y={30} width={xPhut(44) - xPhut(24)} height={day - 30} rx={10} fill={MAU.anh} opacity={0.55} />
      <text x={xPhut(34)} y={20} textAnchor="middle" fontFamily={PHONG} fontSize={15} fontWeight={600} fill={MAU.mucNau}>
        Giờ đông khách
      </text>
      {/* trục */}
      <line x1={x0} y1={day} x2={x1} y2={day} stroke={MAU.vach} strokeWidth={2} />
      {[0, 15, 30, 45, 60].map((p) => (
        <text key={p} x={xPhut(p)} y={day + 22} textAnchor="middle" fontFamily={PHONG} fontSize={14} fill={MAU.mucNhat}>
          {`phút ${p}`}
        </text>
      ))}
      {/* người xem */}
      <path d={duongNguoiXem(x0, x1, day, 70)} fill="none" stroke={MAU.nguoiXem} strokeWidth={4} strokeLinecap="round" />
      <text x={x0 + 4} y={day - 30} fontFamily={PHONG} fontSize={14} fontWeight={600} fill={MAU.nguoiXem}>
        Người xem
      </text>
      {/* ghim lúc phút 30 */}
      <line x1={xGhim} y1={70} x2={xGhim} y2={day} stroke={MAU.bat} strokeWidth={2.5} strokeDasharray="6 5" />
      <g transform={`translate(${xGhim} 70)`}>
        <rect x={-62} y={-30} width={68} height={28} rx={14} fill={MAU.bat} />
        <text x={-28} y={-11} textAnchor="middle" fontFamily={PHONG} fontSize={14} fontWeight={700} fill="#ffffff">
          Ghim áo
        </text>
      </g>
      {/* đơn tăng lúc phút 35 */}
      <line x1={xDon} y1={92} x2={xDon} y2={day} stroke={MAU.don} strokeWidth={2.5} strokeDasharray="6 5" />
      <g transform={`translate(${xDon} 92)`}>
        <rect x={6} y={-30} width={84} height={28} rx={14} fill={MAU.don} />
        <text x={48} y={-11} textAnchor="middle" fontFamily={PHONG} fontSize={14} fontWeight={700} fill="#ffffff">
          Đơn tăng
        </text>
      </g>
      {/* dấu hỏi */}
      <g transform={`translate(${xPhut(49)} 104)`}>
        <circle r={26} fill={MAU.le} stroke={MAU.mucNau} strokeWidth={2.2} />
        <text y={10} textAnchor="middle" fontFamily={PHONG} fontSize={30} fontWeight={700} fill={MAU.gach}>
          ?
        </text>
      </g>
    </svg>
  );
}

/** Thẻ trái: ghim rơi đúng đỉnh đông khách, hai lý do chồng lên nhau. */
export function HinhDoanCu({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 320 132" className={`tc-hinh${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <rect x={146} y={10} width={92} height={104} rx={8} fill={MAU.anh} opacity={0.6} />
      <line x1={12} y1={114} x2={308} y2={114} stroke={MAU.vach} strokeWidth={2} />
      <path d={duongNguoiXem(12, 308, 114, 26)} fill="none" stroke={MAU.nguoiXem} strokeWidth={3.5} strokeLinecap="round" />
      <line x1={186} y1={18} x2={186} y2={114} stroke={MAU.bat} strokeWidth={2.5} strokeDasharray="5 4" />
      <circle cx={186} cy={18} r={8} fill={MAU.bat} />
      <text x={196} y={22} fontFamily={PHONG} fontSize={14} fontWeight={600} fill={MAU.muc}>
        Ghim
      </text>
    </svg>
  );
}

/** Lịch bốc thăm minh hoạ cho thẻ phải (12 khối). */
const LICH_THE: readonly ("bat" | "tat")[] = ["bat", "tat", "tat", "bat", "bat", "tat", "bat", "tat", "tat", "bat", "tat", "bat"];

/** Thẻ phải: khối BẬT và TẮT rải đều cả giờ đông lẫn giờ vắng. */
export function HinhBocTham({ className }: { className?: string }): React.ReactElement {
  const x0 = 12;
  const w = (308 - x0) / LICH_THE.length;
  return (
    <svg viewBox="0 0 320 132" className={`tc-hinh${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="tc-soc-boc-tham" width={6} height={6} patternUnits="userSpaceOnUse">
          <rect width={6} height={6} fill={MAU.tatNhat} />
          <path d="M-1 7 7 -1" stroke={MAU.tat} strokeWidth={1.4} />
        </pattern>
      </defs>
      {LICH_THE.map((m, i) => (
        <g key={i}>
          <rect
            x={x0 + i * w + 1.5}
            y={88}
            width={w - 3}
            height={26}
            rx={4}
            fill={m === "bat" ? MAU.bat : "url(#tc-soc-boc-tham)"}
            stroke={m === "bat" ? MAU.bat : MAU.tat}
            strokeWidth={1.2}
          />
          <text
            x={x0 + i * w + w / 2}
            y={106}
            textAnchor="middle"
            fontFamily={PHONG}
            fontSize={12}
            fontWeight={700}
            fill={m === "bat" ? "#ffffff" : MAU.muc}
          >
            {m === "bat" ? "B" : "T"}
          </text>
        </g>
      ))}
      <path d={duongNguoiXem(12, 308, 84, 18)} fill="none" stroke={MAU.nguoiXem} strokeWidth={3.5} strokeLinecap="round" />
    </svg>
  );
}

/** Bàn thí nghiệm thu nhỏ: hàng ô số, biểu đồ ở giữa, dải khối, danh sách món kèm nút ghim. */
export function HinhBan({ className }: { className?: string }): React.ReactElement {
  const khoi = ["bat", "tat", "bat", "tat", "tat", "bat", "bat", "tat"] as const;
  return (
    <svg viewBox="0 0 300 180" className={`tc-hinh${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="tc-soc-ban" width={5} height={5} patternUnits="userSpaceOnUse">
          <rect width={5} height={5} fill={MAU.tatNhat} />
          <path d="M-1 6 6 -1" stroke={MAU.tat} strokeWidth={1.2} />
        </pattern>
      </defs>
      <rect x={2} y={2} width={296} height={176} rx={14} fill={MAU.le} stroke={MAU.vach} strokeWidth={2} />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${14 + i * 64} 14)`}>
          <rect width={56} height={34} rx={8} fill={MAU.giay} stroke={MAU.vach} strokeWidth={1.5} />
          <rect x={8} y={8} width={26} height={5} rx={2.5} fill={MAU.anh} />
          <rect x={8} y={19} width={36} height={8} rx={4} fill={[MAU.nguoiXem, MAU.luotNhap, MAU.don][i]} opacity={0.85} />
        </g>
      ))}
      <rect x={14} y={58} width={184} height={78} rx={8} fill={MAU.giay} stroke={MAU.vach} strokeWidth={1.5} />
      <path d="M24 120 C54 112 70 92 96 96 S140 74 160 82 S186 70 190 66" fill="none" stroke={MAU.nguoiXem} strokeWidth={3} strokeLinecap="round" />
      <path d="M24 126 C50 124 70 116 96 118 S140 104 160 110 S186 100 190 98" fill="none" stroke={MAU.luotNhap} strokeWidth={3} strokeLinecap="round" />
      {khoi.map((m, i) => (
        <rect
          key={i}
          x={14 + i * 23.5}
          y={146}
          width={20}
          height={20}
          rx={4}
          fill={m === "bat" ? MAU.bat : "url(#tc-soc-ban)"}
          stroke={m === "bat" ? MAU.bat : MAU.tat}
          strokeWidth={1}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(210 ${14 + i * 40})`}>
          <rect width={78} height={32} rx={8} fill={i === 0 ? MAU.batNhat : MAU.giay} stroke={i === 0 ? MAU.bat : MAU.vach} strokeWidth={1.5} />
          <rect x={8} y={8} width={16} height={16} rx={4} fill={MAU.kraftA} />
          <rect x={30} y={10} width={26} height={5} rx={2.5} fill={MAU.anh} />
          <rect x={30} y={19} width={18} height={5} rx={2.5} fill={MAU.anh} />
          <circle cx={66} cy={16} r={6} fill={i === 0 ? MAU.bat : "none"} stroke={i === 0 ? MAU.bat : MAU.mucNhat} strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}
