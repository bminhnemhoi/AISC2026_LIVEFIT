"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DUONG_DONG_THOI_GIAN, docDongThoiGian, laAnhPoster, type DoanDongThoiGian } from "./dong-thoi-gian";

const khongDangKy = () => () => {};

/** true sau khi gắn vào trình duyệt; máy chủ và lần hydrate đầu luôn false. */
export function useDaGan(): boolean {
  return useSyncExternalStore(
    khongDangKy,
    () => true,
    () => false,
  );
}

function dangKyDiaChi(cb: () => void): () => void {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
}

/**
 * true khi trang mở với `?anh-poster=1` (mục 4 kế hoạch 3.1: chế độ chụp thay video bằng người dẫn vẽ tay).
 * Máy chủ không biết chuỗi truy vấn nên trả false; trang nào cần chắc từ máy chủ thì truyền `cheDoPoster`.
 */
export function useCheDoAnhPoster(): boolean {
  return useSyncExternalStore(
    dangKyDiaChi,
    () => laAnhPoster(window.location.search),
    () => false,
  );
}

/**
 * Tải tệp dòng thời gian của người dẫn AI (mặc định /xem/nguoi-dan-ai.json). Chưa có tệp, lỗi mạng hay tệp hỏng thì
 * trả mảng rỗng: khung điện thoại chỉ ẩn dòng "Người dẫn đang nói về".
 */
export function useDongThoiGian(duong: string | null = DUONG_DONG_THOI_GIAN): DoanDongThoiGian[] {
  const [dong, setDong] = useState<DoanDongThoiGian[]>([]);
  useEffect(() => {
    if (!duong) return;
    let huy = false;
    fetch(duong, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!huy) setDong(docDongThoiGian(j));
      })
      .catch(() => {
        if (!huy) setDong([]);
      });
    return () => {
      huy = true;
    };
  }, [duong]);
  return dong;
}
