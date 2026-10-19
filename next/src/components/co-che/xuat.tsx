import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MaNhan } from "@/components/nen/nhan";
import { CoCheSvg, type HuongCoChe } from "./CoCheSvg";

/**
 * Xuất CoChe thành chuỗi SVG tự đủ (có khai báo XML) để chép vào slide, poster, video.
 * Chỉ gọi ở máy chủ hoặc trong script/test; không nhập tệp này vào thành phần phía trình duyệt.
 * Ghi ra tệp: đặt biến XUAT_CO_CHE_DIR rồi chạy `npx vitest run src/components/co-che` (xem test).
 */
export function xuatCoCheSvg(huong: HuongCoChe = "ngang", nhan: MaNhan | string | null = "MINH_HOA"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderToStaticMarkup(<CoCheSvg huong={huong} nhan={nhan} />)}\n`;
}
