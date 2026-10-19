"use client";

import { useSyncExternalStore } from "react";

/**
 * Nhịp chuyển động chung (mục 3 kế hoạch 3.1): 120/200/320 ms, đồng xu lật 600 ms, số đếm lên 800 ms.
 * Người dùng bật "giảm chuyển động" thì mọi hình động của U3 đứng yên ở khung cuối.
 */
export const NHIP = { nhanh: 120, vua: 200, cham: 320, latXu: 600, demSo: 800 } as const;

const TRUY_VAN = "(prefers-reduced-motion: reduce)";

function mq(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(TRUY_VAN);
}

/** Đọc một lần, ngoài React: true khi người dùng muốn giảm chuyển động (hoặc trang ép `data-motion="reduce"`). */
export function muonGiamChuyenDong(): boolean {
  if (typeof document !== "undefined" && document.querySelector('[data-motion="reduce"]')) return true;
  return mq()?.matches ?? false;
}

function dangKy(cb: () => void): () => void {
  const m = mq();
  if (!m) return () => {};
  m.addEventListener?.("change", cb);
  return () => m.removeEventListener?.("change", cb);
}

/** Hook: true khi cần giảm chuyển động. Máy chủ luôn trả false; trình duyệt đọc lại ngay khi gắn. */
export function useGiamChuyenDong(): boolean {
  return useSyncExternalStore(dangKy, muonGiamChuyenDong, () => false);
}
