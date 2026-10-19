// Chép từ components/livedesk/icons.tsx (bản gốc giữ nguyên) và thêm bộ biểu tượng điều hướng của giao diện 2.0.
// Một bộ: lưới 20 px, nét 1,75, đầu và góc tròn. Mặc định chỉ để trang trí (aria-hidden); nút nào dùng biểu tượng
// cũng phải có chữ đi kèm. Không có chữ trong hình.

import React from "react";

export type IconProps = { size?: number; className?: string };
type P = IconProps;

function Svg({ size = 20, className: cls, children }: P & { children: React.ReactElement | React.ReactElement[] }) {
  return (
    <svg
      className={`mh-icon${cls ? ` ${cls}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12.5 2.75 17.25 7.5" />
    <path d="M13.9 3.9 9.6 8.2l-3.4-.4-1.95 1.95 6 6 1.95-1.95-.4-3.4 4.3-4.3" />
    <path d="m7.25 12.75-4.5 4.5" />
  </Svg>
);
export const IconUnpin = (p: P) => (
  <Svg {...p}>
    <path d="m3 3 14 14" />
    <path d="M13.9 3.9 11.5 6.3m-1.9 1.9-3.4-.4-1.95 1.95 6 6 1.95-1.95-.4-3.4" />
    <path d="m7.25 12.75-4.5 4.5" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 4.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L7.4 4.1a.6.6 0 0 0-.9.5Z" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v11M13 4.5v11" />
  </Svg>
);
export const IconSkip = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5v9l6.5-4.5L4 5.5Z" />
    <path d="M10.5 5.5v9L17 10l-6.5-4.5Z" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="4.25" y="8.75" width="11.5" height="8" rx="2" />
    <path d="M6.75 8.75V6.5a3.25 3.25 0 0 1 6.5 0v2.25" />
  </Svg>
);
export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M10 2.75 4.25 5v4.6c0 3.6 2.45 6.4 5.75 7.65 3.3-1.25 5.75-4.05 5.75-7.65V5L10 2.75Z" />
    <path d="m7.5 10 1.75 1.75L12.75 8.5" />
  </Svg>
);
export const IconTag = (p: P) => (
  <Svg {...p}>
    <path d="M3.25 10.4V4.25a1 1 0 0 1 1-1h6.15l6.35 6.35a1 1 0 0 1 0 1.4l-5.75 5.75a1 1 0 0 1-1.4 0L3.25 10.4Z" />
    <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconRuler = (p: P) => (
  <Svg {...p}>
    <path d="m2.75 13.25 10.5-10.5 4 4-10.5 10.5-4-4Z" />
    <path d="m6 10 1.5 1.5M8.5 7.5 10 9M11 5l1.5 1.5" />
  </Svg>
);
export const IconBag = (p: P) => (
  <Svg {...p}>
    <path d="M4.25 7h11.5l-.85 9.1a1 1 0 0 1-1 .9H6.1a1 1 0 0 1-1-.9L4.25 7Z" />
    <path d="M7.25 7V5.75a2.75 2.75 0 0 1 5.5 0V7" />
    <path d="m7.75 11.75 1.6 1.6 3-3.1" />
  </Svg>
);
export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M16.75 9.5c0 3.2-3 5.75-6.75 5.75-.9 0-1.75-.15-2.55-.4L3.5 16.25l1.2-3.2c-.9-1-1.45-2.2-1.45-3.55 0-3.2 3-5.75 6.75-5.75s6.75 2.55 6.75 5.75Z" />
  </Svg>
);
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M1.75 10S4.75 4.25 10 4.25 18.25 10 18.25 10 15.25 15.75 10 15.75 1.75 10 1.75 10Z" />
    <circle cx="10" cy="10" r="2.5" />
  </Svg>
);
export const IconSaved = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 15.25a3.75 3.75 0 0 1-.4-7.48 5 5 0 0 1 9.7 1.23 3.13 3.13 0 0 1-.3 6.25H5.5Z" />
    <path d="m7.75 11.25 1.6 1.6 3-3" />
  </Svg>
);
export const IconRoute = (p: P) => (
  <Svg {...p}>
    <circle cx="4.75" cy="15.25" r="2" />
    <circle cx="15.25" cy="4.75" r="2" />
    <path d="M6.75 15.25h5.5a2.5 2.5 0 0 0 0-5h-4.5a2.5 2.5 0 0 1 0-5h5.5" />
  </Svg>
);
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.05 1.05M14.25 14.25l1.05 1.05M4.7 15.3l1.05-1.05M14.25 5.75l1.05-1.05" />
  </Svg>
);
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M16.5 12.1A6.75 6.75 0 0 1 7.9 3.5a6.75 6.75 0 1 0 8.6 8.6Z" />
  </Svg>
);
export const IconKeyboard = (p: P) => (
  <Svg {...p}>
    <rect x="2.25" y="5" width="15.5" height="10" rx="2" />
    <path d="M5.5 8.25h.01M8.5 8.25h.01M11.5 8.25h.01M14.5 8.25h.01M6.5 11.75h7" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9.25v4.5M10 6.5h.01" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="m5 5 10 10M15 5 5 15" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M8.7 3.4 2.4 14.5a1.5 1.5 0 0 0 1.3 2.25h12.6a1.5 1.5 0 0 0 1.3-2.25L11.3 3.4a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M10 8v3.5M10 14h.01" />
  </Svg>
);
export const IconBolt = (p: P) => (
  <Svg {...p}>
    <path d="M11 2.75 4.5 11h5l-1 6.25L15.5 9h-5l.5-6.25Z" />
  </Svg>
);
export const IconSignal = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 16.5v-3M7.83 16.5V10M12.17 16.5V6.5M16.5 16.5V3.5" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m12 4.5-5.5 5.5 5.5 5.5" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m8 4.5 5.5 5.5L8 15.5" />
  </Svg>
);
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 11.5a3.25 3.25 0 0 0 4.6 0l2.65-2.65a3.25 3.25 0 0 0-4.6-4.6L10 5.4" />
    <path d="M11.5 8.5a3.25 3.25 0 0 0-4.6 0L4.25 11.15a3.25 3.25 0 0 0 4.6 4.6L10 14.6" />
  </Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M10 13V3.5M6.25 7.25 10 3.5l3.75 3.75" />
    <path d="M3.5 12.5v2.75a1.25 1.25 0 0 0 1.25 1.25h10.5a1.25 1.25 0 0 0 1.25-1.25V12.5" />
  </Svg>
);
export const IconQuestion = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M7.9 7.75a2.15 2.15 0 0 1 4.2.6c0 1.45-2.1 1.9-2.1 3.15M10 14h.01" />
  </Svg>
);
export const IconStop = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="5" width="10" height="10" rx="2" />
  </Svg>
);

/* ---------- thêm cho giao diện 2.0 (U3, 19/10) ---------- */

/** Giới thiệu: ngôi nhà nhỏ có cửa. */
export const IconGioiThieu = (p: P) => (
  <Svg {...p}>
    <path d="M3.25 9.1 10 3.5l6.75 5.6" />
    <path d="M4.75 8v8.25h10.5V8" />
    <path d="M8.25 16.25v-4.5h3.5v4.5" />
  </Svg>
);
/** Tổng quan: bốn ô số, một ô cao. */
export const IconTongQuan = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="6" height="8" rx="1.5" />
    <rect x="11" y="3" width="6" height="5" rx="1.5" />
    <rect x="3" y="13" width="6" height="4" rx="1.5" />
    <rect x="11" y="10" width="6" height="7" rx="1.5" />
  </Svg>
);
/** Phiên live: chấm phát sóng và hai vòng sóng. */
export const IconPhienLive = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="1.75" fill="currentColor" />
    <path d="M6.6 6.6a4.8 4.8 0 0 0 0 6.8M13.4 6.6a4.8 4.8 0 0 1 0 6.8" />
    <path d="M4.2 4.2a8.2 8.2 0 0 0 0 11.6M15.8 4.2a8.2 8.2 0 0 1 0 11.6" />
  </Svg>
);
/** Phát lại: mũi tên vòng quanh nút phát. */
export const IconPhatLai = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10a6.5 6.5 0 1 0 1.9-4.6" />
    <path d="M3.25 3.25v3.5h3.5" />
    <path d="M8.6 7.6v4.8l3.9-2.4-3.9-2.4Z" />
  </Svg>
);
/** Live Desk minh hoạ: bút chì vẽ trên tờ giấy. */
export const IconMinhHoa = (p: P) => (
  <Svg {...p}>
    <path d="M3.25 16.75h7" />
    <path d="m12.6 3.9 3.5 3.5-7.6 7.6-4.1.6.6-4.1 7.6-7.6Z" />
    <path d="m11.1 5.4 3.5 3.5" />
  </Svg>
);
/** Quản trị: ba thanh trượt. */
export const IconQuanTri = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
    <circle cx="7" cy="5.5" r="1.75" fill="currentColor" />
    <circle cx="13" cy="10" r="1.75" fill="currentColor" />
    <circle cx="8.5" cy="14.5" r="1.75" fill="currentColor" />
  </Svg>
);
/** Đồng xu tung (bốc thăm). */
export const IconDongXu = (p: P) => (
  <Svg {...p}>
    <ellipse cx="10" cy="10" rx="6.75" ry="6.75" />
    <ellipse cx="10" cy="10" rx="4.25" ry="4.25" />
    <path d="M10 7.5v5" />
  </Svg>
);
/** Lịch niêm phong: tờ lịch có dấu tròn. */
export const IconLichNiemPhong = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4.25" width="14" height="12.5" rx="2" />
    <path d="M3 8h14M6.75 2.75v3M13.25 2.75v3" />
    <circle cx="12.25" cy="12.5" r="2.25" />
  </Svg>
);
/** Giỏ hàng. */
export const IconGioHang = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 3.5h2.2l1.9 8.75h8.2l1.7-6.25H5.6" />
    <circle cx="7.75" cy="15.75" r="1.25" />
    <circle cx="14" cy="15.75" r="1.25" />
  </Svg>
);
/** Tim (thả tim trên live). */
export const IconTim = (p: P) => (
  <Svg {...p}>
    <path d="M10 16.25s-6.25-3.6-6.25-8.1A3.4 3.4 0 0 1 10 6.3a3.4 3.4 0 0 1 6.25 1.85c0 4.5-6.25 8.1-6.25 8.1Z" />
  </Svg>
);
/** Loa đang tắt tiếng. */
export const IconTatTieng = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 7.75h2.75L10 4.5v11l-3.75-3.25H3.5v-4.5Z" />
    <path d="m13 8 4 4M17 8l-4 4" />
  </Svg>
);
/** Loa đang bật tiếng. */
export const IconBatTieng = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 7.75h2.75L10 4.5v11l-3.75-3.25H3.5v-4.5Z" />
    <path d="M13 7.5a3.5 3.5 0 0 1 0 5M15.25 5.25a6.6 6.6 0 0 1 0 9.5" />
  </Svg>
);

/**
 * Sáu mục điều hướng của giao diện 2.0 (mục 4 kế hoạch 3.1). Chữ là thuật ngữ canon; đường dẫn theo bảng màn hình.
 * Khung chung (U1) quyết định mục nào hiện; ở đây chỉ gắn chữ với biểu tượng cho nhất quán.
 */
export const MUC_DIEU_HUONG = [
  { id: "gioi-thieu", nhan: "Giới thiệu", href: "/gioi-thieu", Icon: IconGioiThieu },
  { id: "tong-quan", nhan: "Tổng quan", href: "/tong-quan", Icon: IconTongQuan },
  { id: "phien", nhan: "Phiên live", href: "/phien", Icon: IconPhienLive },
  { id: "phat-lai", nhan: "Phát lại", href: "/phat-lai", Icon: IconPhatLai },
  { id: "minh-hoa", nhan: "Live Desk minh hoạ", href: "/minh-hoa", Icon: IconMinhHoa },
  { id: "quan-tri", nhan: "Quản trị", href: "/quan-tri", Icon: IconQuanTri },
] as const satisfies readonly { id: string; nhan: string; href: string; Icon: (p: P) => React.ReactElement }[];

export type MucDieuHuong = (typeof MUC_DIEU_HUONG)[number];
