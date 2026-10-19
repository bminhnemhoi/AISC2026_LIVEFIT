// Chép từ components/livedesk/brand.tsx (bản đó sinh bằng docs/brand/assets/source/build_tsx.py; bản gốc giữ nguyên).
// Khác bản gốc: màu viết thẳng từ MAU_HINH (không cần calm.css, xuất được SVG tĩnh); mọi góc nghiêng giới hạn trong ±2°
// (luật hình bản 3.1); lớp gốc đổi thành "mh-brand". Hình chỉ để trang trí: aria-hidden, không có chữ tiếng Anh.
import React from "react";
import { MAU_HINH, PHONG } from "./mau";

/** docs/brand/assets/chong-the.svg */
export function CardStack({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 132 152" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <g transform="rotate(-2 70 86)">
        <rect x="30" y="36" width="80" height="100" strokeWidth={1.8 * strokeScale} fill={MAU_HINH.giay} stroke={MAU_HINH.muc} />
      </g>
      <g transform="rotate(-2 62 74)">
        <rect x="22" y="24" width="80" height="100" strokeWidth={1.8 * strokeScale} fill={MAU_HINH.giay} stroke={MAU_HINH.muc} />
      </g>
      <g transform="rotate(2 54 62)">
        <rect x="14" y="12" width="80" height="100" strokeWidth={3 * strokeScale} fill={MAU_HINH.giay} stroke={MAU_HINH.muc} />
      </g>
      <g transform="rotate(2 54 62)">
        <rect x="24" y="22" width="60" height="42" fill={MAU_HINH.anh} />
        <g transform="translate(34.2 23.2) scale(0.66)">
          <path d="M20 14 Q30 -2 40 14 Q30 24 20 14 Z" fill={MAU_HINH.gach} />
          <path d="M22 14 Q30 3 38 14 Q30 20 22 14 Z" opacity=".35" fill={MAU_HINH.giay} />
          <path d="M20 14 L8 22 L12 34 L18 31 L18 52 L42 52 L42 31 L48 34 L52 22 L40 14 Q30 26 20 14 Z" fill={MAU_HINH.gach} />
          <path d="M26 22 V30 M34 22 V30" strokeWidth={1.8 * strokeScale} opacity=".7" stroke={MAU_HINH.giay} />
          <path d="M22 41 H38 V50 H22 Z" fill="none" strokeWidth={1.8 * strokeScale} opacity=".5" stroke={MAU_HINH.giay} />
        </g>
        <circle cx="31" cy="29" r="3.4" fill={MAU_HINH.gach} />
        <rect x="24" y="76" width="60" height="4.4" fill={MAU_HINH.muc} />
        <rect x="24" y="86" width="30" height="4.4" fill={MAU_HINH.muc} />
      </g>
      <polygon points="42.0,4.0 80.0,4.0 77.8,6.7 80.0,9.3 77.8,12.0 80.0,14.7 77.8,17.3 80.0,20.0 42.0,20.0 44.2,17.3 42.0,14.7 44.2,12.0 42.0,9.3 44.2,6.7" opacity="0.92" transform="rotate(-2 61.0 12.0)" fill={MAU_HINH.kraft} />
    </svg>
  );
}

/** docs/brand/assets/den-livestream.svg */
export function RingLight({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 160 232" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <circle cx="80" cy="76" r="62" fill="none" strokeWidth={7 * strokeScale} stroke={MAU_HINH.muc} />
      <circle cx="80" cy="76" r="50" fill="none" strokeWidth={1.4 * strokeScale} stroke={MAU_HINH.vach} />
      <rect x="62" y="48" width="36" height="62" rx="5" fill={MAU_HINH.muc} />
      <rect x="66" y="53" width="28" height="52" rx="2" fill={MAU_HINH.anh} />
      <rect x="69" y="56" width="12" height="6" fill={MAU_HINH.gach} />
      <line x1="80" x2="80" y1="138" y2="176" strokeWidth={5 * strokeScale} stroke={MAU_HINH.muc} />
      <line x1="80" x2="44" y1="176" y2="224" strokeWidth={5 * strokeScale} stroke={MAU_HINH.muc} />
      <line x1="80" x2="116" y1="176" y2="224" strokeWidth={5 * strokeScale} stroke={MAU_HINH.muc} />
      <line x1="80" x2="80" y1="176" y2="228" strokeWidth={5 * strokeScale} stroke={MAU_HINH.muc} />
      <circle cx="138" cy="22" r="9" fill={MAU_HINH.gach} />
    </svg>
  );
}

/** docs/brand/assets/dien-thoai-livestream.svg */
export function HostPhone({ className, strokeScale: _strokeScale }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 140 240" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="132" height="232" rx="16" fill={MAU_HINH.muc} />
      <rect x="11" y="11" width="118" height="218" rx="10" fill={MAU_HINH.anh} />
      <rect x="11" y="11" width="118" height="70" fill="#CDBEA6" />
      <g fill="#8A9A7B">
        <rect x="20" y="24" width="20" height="46" />
      </g>
      <rect x="46" y="24" width="20" height="46" fill="#C98A6B" />
      <rect x="72" y="24" width="20" height="46" fill="#7F93AE" />
      <rect x="98" y="24" width="20" height="46" fill={MAU_HINH.kraft} />
      <circle cx="70" cy="104" r="17" fill="#E9CDB6" />
      <path d="M40 190 Q40 128 70 128 Q100 128 100 190 Z" fill={MAU_HINH.giay} />
      <path d="M58 138 L70 156 L82 138 Z" fill={MAU_HINH.gach} />
      <rect x="18" y="18" width="30" height="13" fill={MAU_HINH.gach} />
      <rect x="24" y="23" width="18" height="3" fill={MAU_HINH.giay} />
      <rect x="54" y="18" width="30" height="13" opacity=".78" fill={MAU_HINH.muc} />
      <rect x="100" y="18" width="22" height="13" opacity=".78" fill={MAU_HINH.muc} />
      <rect x="18" y="168" width="64" height="9" opacity=".75" fill={MAU_HINH.muc} />
      <rect x="18" y="181" width="48" height="9" opacity=".75" fill={MAU_HINH.muc} />
      <rect x="18" y="196" width="104" height="26" fill={MAU_HINH.giay} />
      <rect x="24" y="202" width="14" height="14" fill={MAU_HINH.anh} />
      <rect x="44" y="203" width="40" height="4" fill={MAU_HINH.muc} />
      <rect x="44" y="211" width="24" height="4" fill={MAU_HINH.gach} />
      <rect x="96" y="203" width="20" height="13" fill={MAU_HINH.muc} />
    </svg>
  );
}

/** docs/brand/assets/binh-luan-chip.svg */
export function CommentChips({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 190 168" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <circle cx="16" cy="22" r="9" opacity=".18" fill={MAU_HINH.muc} />
      <rect x="34" y="11" width="30" height="9" strokeWidth={.8 * strokeScale} strokeOpacity=".45" fill={MAU_HINH.gachNhat} stroke={MAU_HINH.muc} />
      <rect x="34" y="25" width="124" height="6" fill={MAU_HINH.muc} />
      <line x1="0" x2="190" y1="43" y2="43" strokeWidth={1 * strokeScale} stroke={MAU_HINH.vach} />
      <circle cx="16" cy="62" r="9" opacity=".18" fill={MAU_HINH.muc} />
      <rect x="34" y="51" width="36" height="9" fill="#E8E0C8" strokeWidth={.8 * strokeScale} strokeOpacity=".45" stroke={MAU_HINH.muc} />
      <rect x="34" y="65" width="100" height="6" fill={MAU_HINH.muc} />
      <line x1="0" x2="190" y1="83" y2="83" strokeWidth={1 * strokeScale} stroke={MAU_HINH.vach} />
      <circle cx="16" cy="102" r="9" opacity=".18" fill={MAU_HINH.muc} />
      <rect x="34" y="91" width="26" height="9" strokeWidth={.8 * strokeScale} strokeOpacity=".45" fill={MAU_HINH.anh} stroke={MAU_HINH.muc} />
      <rect x="34" y="105" width="136" height="6" fill={MAU_HINH.muc} />
      <line x1="0" x2="190" y1="123" y2="123" strokeWidth={1 * strokeScale} stroke={MAU_HINH.vach} />
      <circle cx="16" cy="142" r="9" opacity=".18" fill={MAU_HINH.muc} />
      <rect x="34" y="131" width="30" height="9" strokeWidth={.8 * strokeScale} strokeOpacity=".45" fill={MAU_HINH.gachNhat} stroke={MAU_HINH.muc} />
      <rect x="34" y="145" width="110" height="6" fill={MAU_HINH.muc} />
      <line x1="0" x2="190" y1="163" y2="163" strokeWidth={1 * strokeScale} stroke={MAU_HINH.vach} />
    </svg>
  );
}

/** docs/brand/assets/gia-treo-do.svg */
export function Rack({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 228 176" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <line x1="14" x2="214" y1="30" y2="30" strokeWidth={4 * strokeScale} stroke={MAU_HINH.muc} />
      <line x1="14" x2="14" y1="30" y2="170" strokeWidth={4 * strokeScale} stroke={MAU_HINH.muc} />
      <line x1="214" x2="214" y1="30" y2="170" strokeWidth={4 * strokeScale} stroke={MAU_HINH.muc} />
      <line x1="2" x2="40" y1="170" y2="170" strokeWidth={4 * strokeScale} stroke={MAU_HINH.muc} />
      <line x1="188" x2="226" y1="170" y2="170" strokeWidth={4 * strokeScale} stroke={MAU_HINH.muc} />
      <path d="M50 30 L50 38 M36 48 L50 38 L64 48 Z" fill="none" strokeWidth={2 * strokeScale} stroke={MAU_HINH.muc} />
      <g transform="translate(18.5 46.5) scale(1.05)">
        <path d="M21 10 Q30 17 39 10 L53 18 L47 29 L42 26 L42 52 L18 52 L18 26 L13 29 L7 18 Z" fill="#8A9A7B" />
      </g>
      <path d="M92 30 L92 38 M78 48 L92 38 L106 48 Z" fill="none" strokeWidth={2 * strokeScale} stroke={MAU_HINH.muc} />
      <g transform="translate(60.5 46.5) scale(1.05)">
        <path d="M20 14 Q30 -2 40 14 Q30 24 20 14 Z" fill={MAU_HINH.gach} />
        <path d="M22 14 Q30 3 38 14 Q30 20 22 14 Z" opacity=".35" fill={MAU_HINH.giay} />
        <path d="M20 14 L8 22 L12 34 L18 31 L18 52 L42 52 L42 31 L48 34 L52 22 L40 14 Q30 26 20 14 Z" fill={MAU_HINH.gach} />
        <path d="M26 22 V30 M34 22 V30" strokeWidth={1.8 * strokeScale} opacity=".7" stroke={MAU_HINH.giay} />
        <path d="M22 41 H38 V50 H22 Z" fill="none" strokeWidth={1.8 * strokeScale} opacity=".5" stroke={MAU_HINH.giay} />
      </g>
      <path d="M134 30 L134 38 M120 48 L134 38 L148 48 Z" fill="none" strokeWidth={2 * strokeScale} stroke={MAU_HINH.muc} />
      <g transform="translate(102.5 46.5) scale(1.05)">
        <path d="M18 7 H42 L45 53 H33 L30 24 L27 53 H15 Z" fill={MAU_HINH.muc} />
        <path d="M18 12 H42" strokeWidth={2 * strokeScale} opacity=".5" stroke={MAU_HINH.giay} />
      </g>
      <path d="M176 30 L176 38 M162 48 L176 38 L190 48 Z" fill="none" strokeWidth={2 * strokeScale} stroke={MAU_HINH.muc} />
      <g transform="translate(144.5 46.5) scale(1.05)">
        <path d="M22 26 C22 6 38 6 38 26" fill="none" strokeWidth={3.2 * strokeScale} stroke={MAU_HINH.kraft} />
        <rect x="12" y="25" width="36" height="29" fill={MAU_HINH.kraft} />
        <rect x="19" y="33" width="22" height="3" opacity=".55" fill={MAU_HINH.giay} />
      </g>
    </svg>
  );
}

/** docs/brand/assets/gio-hang-them.svg */
export function CartPlusOne({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 124 104" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <path d="M6 12 H24 L40 74 H100 L112 34 H30" fill="none" strokeWidth={5 * strokeScale} strokeLinejoin="round" stroke={MAU_HINH.muc} />
      <circle cx="48" cy="92" r="8" fill={MAU_HINH.muc} />
      <circle cx="92" cy="92" r="8" fill={MAU_HINH.muc} />
      <rect x="76" y="2" width="42" height="26" fill={MAU_HINH.gach} />
      <path d="M88.82000000000001 16.82V14.68H91.78V11.72H93.92V14.68H96.88000000000001V16.82H93.92V19.78H91.78V16.82Z M105.56 7.199999999999999V22.0H102.88V11.12H100.06V9.5L100.52 9.36Q101.7 9.02 102.44 8.58Q103.17999999999999 8.14 103.84 7.379999999999999L104.02 7.199999999999999Z" fill={MAU_HINH.giay} />
    </svg>
  );
}

/** docs/brand/assets/the-gia.svg */
export function PriceTag({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 118 104" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <path d="M10 52 L52 10 H108 V94 H52 Z" strokeWidth={3 * strokeScale} strokeLinejoin="miter" fill={MAU_HINH.giay} stroke={MAU_HINH.muc} />
      <circle cx="52" cy="52" r="6" strokeWidth={2.4 * strokeScale} fill={MAU_HINH.kem} stroke={MAU_HINH.muc} />
      <rect x="66" y="30" width="30" height="5" fill={MAU_HINH.muc} />
      <rect x="66" y="44" width="30" height="5" fill={MAU_HINH.muc} />
      <rect x="66" y="64" width="22" height="9" fill="none" stroke="#8A5A00" strokeWidth={1.6 * strokeScale} strokeDasharray="3 2" />
      <path d="M52 46 C46 22 30 10 14 8" fill="none" strokeWidth={2 * strokeScale} stroke={MAU_HINH.muc} />
    </svg>
  );
}

/** docs/brand/assets/ghi-chu-chua-biet.svg */
export function UnknownNote({ className, label = "Chưa biết", strokeScale = 1 }: { className?: string; label?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 168 134" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <g transform="rotate(-2 84 70)">
        <rect x="8" y="14" width="152" height="112" strokeWidth={1.4 * strokeScale} fill={MAU_HINH.ghiChu} stroke={MAU_HINH.muc} />
        <rect x="16" y="22" width="136" height="96" fill="none" strokeWidth={1.2 * strokeScale} strokeDasharray="5 4" stroke={MAU_HINH.muc} />
        <text x="84" y="80" textAnchor="middle" fill={MAU_HINH.muc} fontFamily={PHONG} fontWeight={500} fontSize={22}>{label}</text>
        <path d="M60 94 H108" strokeWidth={2.4 * strokeScale} stroke={MAU_HINH.gach} />
      </g>
      <polygon points="54.0,2.0 110.0,2.0 107.8,5.0 110.0,8.0 107.8,11.0 110.0,14.0 107.8,17.0 110.0,20.0 54.0,20.0 56.2,17.0 54.0,14.0 56.2,11.0 54.0,8.0 56.2,5.0" opacity="0.92" transform="rotate(2 82.0 11.0)" fill={MAU_HINH.kraft} />
    </svg>
  );
}

/** docs/brand/assets/ghim-tron.svg */
export function PushPin({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 40 52" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <path d="M20 50 L20 28" strokeWidth={2.4 * strokeScale} stroke={MAU_HINH.muc} />
      <circle cx="20" cy="16" r="13" strokeWidth={2.4 * strokeScale} fill={MAU_HINH.gach} stroke={MAU_HINH.muc} />
      <path d="M14 12 A8 8 0 0 1 22 8" fill="none" strokeWidth={2.4 * strokeScale} opacity=".7" stroke={MAU_HINH.giay} />
    </svg>
  );
}

/** docs/brand/assets/kep-giay.svg */
export function PaperClip({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 30 76" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <path d="M20 22 V54 A9 9 0 0 1 2 54 V16 A7 7 0 0 1 16 16 V52" fill="none" strokeWidth={2.6 * strokeScale} strokeLinecap="round" transform="translate(4 0)" stroke={MAU_HINH.muc} />
    </svg>
  );
}

/** docs/brand/assets/mui-ten-nghieng.svg */
export function InkArrow({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 120 60" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <path d="M4 46 C34 54 68 40 98 14" fill="none" strokeWidth={2.6 * strokeScale} strokeLinecap="round" stroke={MAU_HINH.muc} />
      <path d="M80 12 L102 10 L98 32" fill="none" strokeWidth={2.6 * strokeScale} strokeLinecap="round" strokeLinejoin="round" stroke={MAU_HINH.muc} />
    </svg>
  );
}

/** docs/brand/assets/bang-dinh-kraft.svg */
export function KraftTape({ className, strokeScale: _strokeScale }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 160 64" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <polygon points="8.0,6.0 152.0,6.0 149.8,10.3 152.0,14.7 149.8,19.0 152.0,23.3 149.8,27.7 152.0,32.0 8.0,32.0 10.2,27.7 8.0,23.3 10.2,19.0 8.0,14.7 10.2,10.3" opacity="0.92" transform="rotate(-2 80.0 19.0)" fill={MAU_HINH.kraft} />
      <polygon points="20.0,36.0 130.0,36.0 127.8,39.7 130.0,43.3 127.8,47.0 130.0,50.7 127.8,54.3 130.0,58.0 20.0,58.0 22.2,54.3 20.0,50.7 22.2,47.0 20.0,43.3 22.2,39.7" opacity="0.92" transform="rotate(1.5 75.0 47.0)" fill={MAU_HINH.kraft} />
    </svg>
  );
}

/** docs/brand/assets/the-san-pham-ao-hoodie.svg */
export function CardHoodie({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 112 118" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <rect x="7" y="24" width="64" height="82" fill="none" strokeWidth={1.6 * strokeScale} transform="rotate(2 39 65)" stroke={MAU_HINH.muc} />
      <g transform="rotate(-2 54 58)">
        <rect x="20" y="12" width="68" height="88" strokeWidth={3 * strokeScale} fill={MAU_HINH.giay} stroke={MAU_HINH.muc} />
        <rect x="28" y="22" width="52" height="40" fill={MAU_HINH.anh} />
        <g transform="translate(35.4 23.4) scale(0.62)">
          <path d="M20 14 Q30 -2 40 14 Q30 24 20 14 Z" fill={MAU_HINH.gach} />
          <path d="M22 14 Q30 3 38 14 Q30 20 22 14 Z" opacity=".35" fill={MAU_HINH.giay} />
          <path d="M20 14 L8 22 L12 34 L18 31 L18 52 L42 52 L42 31 L48 34 L52 22 L40 14 Q30 26 20 14 Z" fill={MAU_HINH.gach} />
          <path d="M26 22 V30 M34 22 V30" strokeWidth={1.8 * strokeScale} opacity=".7" stroke={MAU_HINH.giay} />
          <path d="M22 41 H38 V50 H22 Z" fill="none" strokeWidth={1.8 * strokeScale} opacity=".5" stroke={MAU_HINH.giay} />
        </g>
        <circle cx="35" cy="29" r="3.6" fill={MAU_HINH.gach} />
        <rect x="28" y="72" width="52" height="4.4" fill={MAU_HINH.muc} />
        <rect x="28" y="82" width="26" height="4.4" fill={MAU_HINH.muc} />
      </g>
      <polygon points="37.0,3.0 71.0,3.0 68.8,5.5 71.0,8.0 68.8,10.5 71.0,13.0 68.8,15.5 71.0,18.0 37.0,18.0 39.2,15.5 37.0,13.0 39.2,10.5 37.0,8.0 39.2,5.5" opacity="0.92" transform="rotate(2 54.0 10.5)" fill={MAU_HINH.kraft} />
    </svg>
  );
}

/** docs/brand/assets/the-san-pham-quan-cargo.svg */
export function CardCargo({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 112 118" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <rect x="7" y="24" width="64" height="82" fill="none" strokeWidth={1.6 * strokeScale} transform="rotate(2 39 65)" stroke={MAU_HINH.muc} />
      <g transform="rotate(-2 54 58)">
        <rect x="20" y="12" width="68" height="88" strokeWidth={3 * strokeScale} fill={MAU_HINH.giay} stroke={MAU_HINH.muc} />
        <rect x="28" y="22" width="52" height="40" fill={MAU_HINH.anh} />
        <g transform="translate(35.4 23.4) scale(0.62)">
          <path d="M18 7 H42 L45 53 H33 L30 24 L27 53 H15 Z" fill={MAU_HINH.muc} />
          <path d="M18 12 H42" strokeWidth={2 * strokeScale} opacity=".5" stroke={MAU_HINH.giay} />
        </g>
        <circle cx="35" cy="29" r="3.6" fill={MAU_HINH.gach} />
        <rect x="28" y="72" width="52" height="4.4" fill={MAU_HINH.muc} />
        <rect x="28" y="82" width="26" height="4.4" fill={MAU_HINH.muc} />
      </g>
      <polygon points="37.0,3.0 71.0,3.0 68.8,5.5 71.0,8.0 68.8,10.5 71.0,13.0 68.8,15.5 71.0,18.0 37.0,18.0 39.2,15.5 37.0,13.0 39.2,10.5 37.0,8.0 39.2,5.5" opacity="0.92" transform="rotate(2 54.0 10.5)" fill={MAU_HINH.kraft} />
    </svg>
  );
}

/** docs/brand/assets/the-san-pham-tui-tote.svg */
export function CardTote({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 112 118" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <rect x="7" y="24" width="64" height="82" fill="none" strokeWidth={1.6 * strokeScale} transform="rotate(2 39 65)" stroke={MAU_HINH.muc} />
      <g transform="rotate(-2 54 58)">
        <rect x="20" y="12" width="68" height="88" strokeWidth={3 * strokeScale} fill={MAU_HINH.giay} stroke={MAU_HINH.muc} />
        <rect x="28" y="22" width="52" height="40" fill={MAU_HINH.anh} />
        <g transform="translate(35.4 23.4) scale(0.62)">
          <path d="M22 26 C22 6 38 6 38 26" fill="none" strokeWidth={3.2 * strokeScale} stroke={MAU_HINH.kraft} />
          <rect x="12" y="25" width="36" height="29" fill={MAU_HINH.kraft} />
          <rect x="19" y="33" width="22" height="3" opacity=".55" fill={MAU_HINH.giay} />
        </g>
        <circle cx="35" cy="29" r="3.6" fill={MAU_HINH.gach} />
        <rect x="28" y="72" width="52" height="4.4" fill={MAU_HINH.muc} />
        <rect x="28" y="82" width="26" height="4.4" fill={MAU_HINH.muc} />
      </g>
      <polygon points="37.0,3.0 71.0,3.0 68.8,5.5 71.0,8.0 68.8,10.5 71.0,13.0 68.8,15.5 71.0,18.0 37.0,18.0 39.2,15.5 37.0,13.0 39.2,10.5 37.0,8.0 39.2,5.5" opacity="0.92" transform="rotate(2 54.0 10.5)" fill={MAU_HINH.kraft} />
    </svg>
  );
}

/** docs/brand/assets/the-san-pham-ao-linen.svg */
export function CardLinen({ className, strokeScale = 1 }: { className?: string; strokeScale?: number }) {
  return (
    <svg viewBox="0 0 112 118" className={`mh-brand${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <rect x="7" y="24" width="64" height="82" fill="none" strokeWidth={1.6 * strokeScale} transform="rotate(2 39 65)" stroke={MAU_HINH.muc} />
      <g transform="rotate(-2 54 58)">
        <rect x="20" y="12" width="68" height="88" strokeWidth={3 * strokeScale} fill={MAU_HINH.giay} stroke={MAU_HINH.muc} />
        <rect x="28" y="22" width="52" height="40" fill={MAU_HINH.anh} />
        <g transform="translate(35.4 23.4) scale(0.62)">
          <path d="M21 10 Q30 17 39 10 L53 18 L47 29 L42 26 L42 52 L18 52 L18 26 L13 29 L7 18 Z" fill="#8A9A7B" />
        </g>
        <circle cx="35" cy="29" r="3.6" fill={MAU_HINH.gach} />
        <rect x="28" y="72" width="52" height="4.4" fill={MAU_HINH.muc} />
        <rect x="28" y="82" width="26" height="4.4" fill={MAU_HINH.muc} />
      </g>
      <polygon points="37.0,3.0 71.0,3.0 68.8,5.5 71.0,8.0 68.8,10.5 71.0,13.0 68.8,15.5 71.0,18.0 37.0,18.0 39.2,15.5 37.0,13.0 39.2,10.5 37.0,8.0 39.2,5.5" opacity="0.92" transform="rotate(2 54.0 10.5)" fill={MAU_HINH.kraft} />
    </svg>
  );
}
