import React from "react";
import { CardStack, CardTote, CommentChips, HostPhone, InkArrow, PaperClip, PriceTag, RingLight, UnknownNote } from "./brand";
import { MAU_HINH, PHONG, PHONG_SO, nghieng } from "./mau";
import "./minh-hoa.css";

/**
 * Chép từ components/livedesk/art.tsx (bản gốc giữ nguyên) và Việt hoá mọi chữ trong hình.
 *
 * Khác bản gốc:
 * - không đọc `useShell()`: chữ đi qua props, mặc định tiếng Việt, nên dùng được ở mọi trang;
 * - màu viết thẳng (MAU_HINH), không cần calm.css; bố cục tờ "bản vẽ" nằm ở minh-hoa.css (lớp `mh-*`);
 * - mọi hình đứng thẳng, phần trang trí nghiêng tối đa 2° (luật hình bản 3.1);
 * - StartArt: "LIVE" / "GHIM", nhãn "CHUẨN BỊ BUỔI LIVE"; bỏ các dòng tiếng Anh; chip MINH HOẠ là chữ HTML thật.
 */

/** Dấu canh chỉnh ở góc tờ, như trên bản in. */
export function Cross({ className }: { className: string }) {
  return (
    <svg className={`mh-cross ${className}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 1v14M1 8h14" fill="none" stroke={MAU_HINH.mucNhat} strokeWidth="1" />
      <circle cx="8" cy="8" r="3.4" fill="none" stroke={MAU_HINH.mucNhat} strokeWidth="1" />
    </svg>
  );
}

/** Thước vạch: vạch dài mỗi 10, vạch vừa mỗi 5; con trỏ đỏ gạch đặt ở `mark` (0 đến 400). */
export function SpecRuler({ label, mark = 300 }: { label?: string; mark?: number }) {
  return (
    <div className="mh-ruler">
      <svg viewBox="0 0 400 22" preserveAspectRatio="none" width="100%" height="22" focusable="false" aria-hidden="true">
        {Array.from({ length: 41 }, (_, i) => (
          <line key={i} x1={i * 10} x2={i * 10} y1={22} y2={i % 10 === 0 ? 6 : i % 5 === 0 ? 12 : 17} stroke={MAU_HINH.mucNhat} strokeWidth="1" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
        ))}
        <path d={`M${mark} 2 l6 0 l-3 7 z`} fill={MAU_HINH.gach} />
      </svg>
      {label && <span className="mh-kicker">{label}</span>}
    </div>
  );
}

/** Một hình đặt trên tờ: trái, trên, rộng tính theo % sân khấu; nghiêng bị giới hạn ±2°. */
function Spot({ left, top, width, tilt = 0, children }: { left: number; top: number; width: number; tilt?: number; children: React.ReactNode }) {
  return <span className="mh-spot" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, rotate: `${nghieng(tilt)}deg` }}>{children}</span>;
}

function Sheet({ className, kicker, ruler, giant, children }: { className: string; kicker: string; ruler?: string; giant?: string; children: React.ReactNode }) {
  return (
    <div className={`mh-sheet ${className}`} aria-hidden="true">
      <Cross className="tl" />
      <Cross className="tr" />
      <Cross className="bl" />
      <Cross className="br" />
      <span className="mh-kicker">{kicker}</span>
      <div className="mh-stage">
        {giant && (
          <svg className="mh-giant" viewBox="0 0 300 100" focusable="false">
            <text x="0" y="86" fontFamily={PHONG_SO} fontWeight={700} fontSize={104} letterSpacing="-0.04em" fill={MAU_HINH.anh} opacity={0.6}>{giant}</text>
          </svg>
        )}
        {children}
      </div>
      <SpecRuler label={ruler} />
    </div>
  );
}

/* Hình Bắt đầu giữ kiểu nhãn dán cắt khuôn (chủ dự án thích): defs, nhãn dán và thước riêng. */

/** Chuyển màu và mẫu chấm cho một hình; mỗi hình có id riêng để một hình bị ẩn không làm trắng hình khác. */
export function ArtDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={MAU_HINH.giay} />
        <stop offset="1" stopColor={MAU_HINH.giayB} />
      </linearGradient>
      <linearGradient id={`${id}-kraft`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={MAU_HINH.kraftA} />
        <stop offset="1" stopColor={MAU_HINH.kraftB} />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0.6">
        <stop offset="0.2" stopColor={MAU_HINH.bong} stopOpacity="0" />
        <stop offset="0.32" stopColor={MAU_HINH.bong} stopOpacity="0.5" />
        <stop offset="0.44" stopColor={MAU_HINH.bong} stopOpacity="0" />
      </linearGradient>
      <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill={MAU_HINH.vach} /></pattern>
    </defs>
  );
}

/** Nhãn dán cắt khuôn: viền cắt mềm, lề trắng, thân giấy hoặc kraft, nét mực nâu và một vệt bóng. */
export function Sticker({ art, d, fill, children }: { art: string; d: string; fill: "paper" | "kraft"; children?: React.ReactNode }) {
  return (
    <g>
      <path d={d} fill="none" stroke={MAU_HINH.vienCat} strokeWidth={15} strokeLinejoin="round" />
      <path d={d} fill={MAU_HINH.le} stroke={MAU_HINH.le} strokeWidth={12} strokeLinejoin="round" />
      <path d={d} fill={`url(#${art}-${fill})`} stroke={MAU_HINH.mucNau} strokeWidth={2.4} strokeLinejoin="round" />
      <path d={d} fill={`url(#${art}-sheen)`} />
      {children}
    </g>
  );
}

/** Nét mực nâu dùng chung cho chi tiết bên trong nhãn dán. */
export const NET = { stroke: MAU_HINH.mucNau, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

const Reg = ({ x, y }: { x: number; y: number }) => (
  <g fill="none" stroke={MAU_HINH.mucNhat} strokeWidth={1} opacity={0.55}><circle cx={x} cy={y} r="6" /><path d={`M${x} ${y - 10}v20M${x - 10} ${y}h20`} shapeRendering="crispEdges" /></g>
);

/** Thước vạch: vạch mỗi 10 đơn vị, vạch dài mỗi 50; `mark` đặt con trỏ cách đầu thước bấy nhiêu đơn vị. */
function Ruler({ x, y, ticks, width = ticks * 10, mark }: { x: number; y: number; ticks: number; width?: number; mark?: number }) {
  return (
    <g stroke={MAU_HINH.mucNhat} strokeWidth={1} fill="none" opacity={0.7}>
      <path d={`M${x} ${y}H${x + width}`} shapeRendering="crispEdges" />
      {Array.from({ length: ticks + 1 }, (_, i) => (<path key={i} d={`M${x + i * 10} ${y}v${i % 5 === 0 ? -8 : -4}`} shapeRendering="crispEdges" />))}
      {mark !== undefined && <path d={`M${x + mark} ${y - 16}l6 8 6-8z`} fill={MAU_HINH.mucNau} stroke="none" />}
    </g>
  );
}

/**
 * Bắt đầu: điện thoại đang LIVE và chiếc áo có thẻ treo, dưới dòng "CHUẨN BỊ BUỔI LIVE".
 * `nhan` là chip nguồn bằng chữ HTML (mặc định MINH HOẠ); truyền `null` để ẩn khi trang đã có nhãn riêng.
 */
export function StartArt({ nhan = "MINH HOẠ", className }: { nhan?: string | null; className?: string }) {
  return (
    <figure className={`mh-art mh-start-art${className ? ` ${className}` : ""}`} data-minh-hoa="start-art">
      <svg viewBox="0 0 440 320" focusable="false" aria-hidden="true">
        <ArtDefs id="mh-start" />

        <text x="0" y="96" fontFamily={PHONG_SO} fontWeight={700} fontSize={112} letterSpacing="-0.04em" fill={MAU_HINH.anh} opacity={0.55}>LIVE</text>
        <text x="168" y="262" fontFamily={PHONG_SO} fontWeight={700} fontSize={112} letterSpacing="-0.04em" fill={MAU_HINH.anh} opacity={0.55}>GHIM</text>

        <Reg x={12} y={14} />
        <Reg x={424} y={300} />
        <text x="30" y="24" fontFamily={PHONG} fontWeight={600} fontSize={13} letterSpacing="0.04em" fill={MAU_HINH.mucNau}>CHUẨN BỊ BUỔI LIVE</text>
        <g>
          {["L", "I", "V", "E"].map((ch, i) => (
            <g key={ch} transform={`translate(${352 + i * 21} 12)`}>
              <circle r="8" fill="none" stroke={MAU_HINH.mucNhat} strokeWidth={1} opacity={0.75} />
              <text y="3.5" fontFamily={PHONG_SO} fontWeight={600} fontSize={8.5} textAnchor="middle" fill={MAU_HINH.mucNau}>{ch}</text>
            </g>
          ))}
        </g>
        <rect x="380" y="34" width="54" height="36" fill="url(#mh-start-dots)" />

        {/* điện thoại đang LIVE */}
        <g transform={`translate(58 112) rotate(${nghieng(-8)} 60 96)`}>
          <Sticker art="mh-start" fill="paper" d="M22 0h76a22 22 0 0 1 22 22v148a22 22 0 0 1 -22 22h-76a22 22 0 0 1 -22 -22v-148a22 22 0 0 1 22 -22z">
            <rect x="12" y="20" width="96" height="150" rx="12" fill={MAU_HINH.kem} stroke={MAU_HINH.mucNau} strokeWidth={2} />
            <rect x="46" y="8" width="28" height="6" rx="3" fill={MAU_HINH.mucNau} />
            <g transform="translate(22 32)">
              <rect width="38" height="16" rx="8" fill={MAU_HINH.le} stroke={MAU_HINH.mucNau} strokeWidth={1.6} />
              <circle cx="9" cy="8" r="3" fill={MAU_HINH.gach} />
              <text x="24" y="11.5" fontFamily={PHONG_SO} fontWeight={700} fontSize={8.5} textAnchor="middle" fill={MAU_HINH.mucNau}>LIVE</text>
            </g>
            <path d="M74 126c0-6 8-9 11-3 3-6 11-3 11 3 0 7-11 13-11 13s-11-6-11-13z" fill={MAU_HINH.gachNhat} stroke={MAU_HINH.gach} strokeWidth={1.8} strokeLinejoin="round" />
            <path d="M84 104c0-4 5-6 7-2 2-4 7-2 7 2 0 4-7 8-7 8s-7-4-7-8z" fill={MAU_HINH.gachNhat} stroke={MAU_HINH.gach} strokeWidth={1.5} strokeLinejoin="round" />
            <path d="M24 148h44M24 158h30" {...NET} />
          </Sticker>
        </g>

        {/* chiếc áo có thẻ treo trơn */}
        <g transform={`translate(236 118) rotate(${nghieng(8)} 80 80)`}>
          <Sticker art="mh-start" fill="kraft" d="M56 18q24 18 48 0l46 22-14 36-22-9v76h-68v-76l-22 9-14-36z">
            <path d="M56 18q24 18 48 0" {...NET} />
            <path d="M58 70v70M102 70v70" {...NET} strokeWidth={1.5} opacity={0.45} />
            <g transform={`translate(108 92) rotate(${nghieng(14)})`}>
              <path d="M0 6l6-6h18v28h-24z" fill={MAU_HINH.le} stroke={MAU_HINH.mucNau} strokeWidth={1.6} strokeLinejoin="round" />
              <circle cx="6" cy="7" r="2" fill={MAU_HINH.mucNau} />
            </g>
          </Sticker>
        </g>

        <Ruler x={226} y={294} ticks={20} width={204} mark={106} />
      </svg>
      {nhan && <figcaption className="mh-chip mh-chip-nguon">{nhan}</figcaption>}
    </figure>
  );
}

/** Tổng kết: các món của buổi live và điều người xem nói; "hết buổi". */
export function RecapArt({ kicker = "HẾT BUỔI" }: { kicker?: string }) {
  return (
    <Sheet className="mh-recap-art" kicker={kicker}>
      <Spot left={8} top={0} width={20}><CardStack strokeScale={1.6} /></Spot>
      <Spot left={36} top={26} width={22}><InkArrow strokeScale={1.4} /></Spot>
      <Spot left={66} top={2} width={26}><CommentChips strokeScale={1.6} /></Spot>
    </Sheet>
  );
}

/** Lưu trữ: các màn kế hoạch cũ. */
export function LegacyArt({ kicker = "LƯU TRỮ", ruler = "CÁC MÀN TRƯỚC ĐÂY", giant = "LỊCH" }: { kicker?: string; ruler?: string; giant?: string }) {
  return (
    <Sheet className="mh-legacy-art" kicker={kicker} ruler={ruler} giant={giant}>
      <Spot left={6} top={20} width={42} tilt={-2}><CardStack strokeScale={1.15} /></Spot>
      <Spot left={40} top={12} width={7}><PaperClip strokeScale={1.2} /></Spot>
      <Spot left={56} top={48} width={34} tilt={2}><PriceTag strokeScale={1.15} /></Spot>
    </Sheet>
  );
}

/** Bốn bước ở trang chủ cũ, mỗi bước một hình: kết nối (điện thoại người dẫn), sản phẩm, lên sóng (đèn vòng), bàn. */
export function StepArt({ step }: { step: number }) {
  const Drawing = [HostPhone, CardTote, RingLight, CommentChips][step] ?? CardStack;
  return <span className="mh-step-art" aria-hidden="true"><Drawing strokeScale={1.5} /></span>;
}

/** Ô "điều chưa biết" ở tổng kết mang tờ ghi chú. */
export function UnknownSticker({ label = "Chưa biết" }: { label?: string }) {
  return <span className="mh-unknown-sticker" aria-hidden="true"><UnknownNote label={label} strokeScale={1.3} /></span>;
}

/** Trạng thái trống cũ: chồng thẻ, chưa ghim gì. Hình mới cho trạng thái trống là `TrangThaiTrong` (hinh.tsx). */
export function EmptyArt() {
  return <span className="mh-empty-art" aria-hidden="true"><CardStack strokeScale={1.3} /></span>;
}
