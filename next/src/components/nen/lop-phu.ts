"use client";

/**
 * Phần chung của ngăn kéo (NganKeo) và hộp thoại (Hop): giữ tiêu điểm trong lớp phủ, Esc để đóng, trả tiêu điểm về
 * chỗ cũ, khoá cuộn trang, làm trơ (inert) mọi thứ phía sau. Nhiều lớp chồng nhau thì chỉ lớp trên cùng nhận Esc.
 */
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const CO_THE_FOCUS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

const khongDoi = (): (() => void) => () => {};

/** true sau khi đã gắn vào trình duyệt; false khi dựng trên máy chủ. Không gây lệch khi hydrate. */
export function useDaGan(): boolean {
  return useSyncExternalStore(
    khongDoi,
    () => true,
    () => false,
  );
}

/** Ngăn xếp các lớp phủ đang mở; phần tử cuối là lớp trên cùng. */
const nganXep: object[] = [];
let soKhoaCuon = 0;

/** Số lớp phủ đang mở (để test). */
export function soLopPhuDangMo(): number {
  return nganXep.length;
}

function lamTroPhiaSau(chu: HTMLElement): () => void {
  const daDoi: Array<{ el: HTMLElement; inert: boolean; an: string | null }> = [];
  for (const el of Array.from(document.body.children)) {
    if (!(el instanceof HTMLElement) || el === chu || el.contains(chu)) continue;
    if (el.hasAttribute("data-keep-live") || el.tagName === "SCRIPT" || el.tagName.includes("-")) continue;
    daDoi.push({ el, inert: el.hasAttribute("inert"), an: el.getAttribute("aria-hidden") });
    el.setAttribute("inert", "");
    el.setAttribute("aria-hidden", "true");
  }
  return () => {
    for (const { el, inert, an } of daDoi) {
      if (!inert) el.removeAttribute("inert");
      if (an === null) el.removeAttribute("aria-hidden");
      else el.setAttribute("aria-hidden", an);
    }
  };
}

export interface TuyChonLopPhu {
  /** Phần tử nhận tiêu điểm đầu tiên; không có thì tìm [data-tu-focus], rồi phần tử bấm được đầu tiên, rồi chính hộp. */
  focusDau?: RefObject<HTMLElement | null>;
  /** Không cho đóng bằng Esc (ví dụ đang chạy lệnh). */
  khoaDong?: boolean;
}

/**
 * Gắn hành vi lớp phủ vào `hop` (phần tử có role="dialog") khi `mo` là true.
 * `lop` là phần tử lớp phủ gắn thẳng vào <body> (để làm trơ phần còn lại).
 */
export function useLopPhu(
  mo: boolean,
  onDong: () => void,
  hop: RefObject<HTMLElement | null>,
  lop: RefObject<HTMLElement | null>,
  tuyChon: TuyChonLopPhu = {},
): void {
  const moiNhat = useRef({ onDong, khoaDong: tuyChon.khoaDong ?? false });
  useEffect(() => {
    moiNhat.current = { onDong, khoaDong: tuyChon.khoaDong ?? false };
  });
  const focusDau = tuyChon.focusDau;

  useEffect(() => {
    if (!mo) return;
    const khoa = {};
    nganXep.push(khoa);
    const truoc = document.activeElement as HTMLElement | null;
    const goc = hop.current;
    const dich =
      focusDau?.current ??
      goc?.querySelector<HTMLElement>("[data-tu-focus]") ??
      goc?.querySelector<HTMLElement>(CO_THE_FOCUS) ??
      goc;
    dich?.focus();

    if (soKhoaCuon++ === 0) document.body.style.overflow = "hidden";
    const moKhoa = lop.current ? lamTroPhiaSau(lop.current) : null;

    const phim = (e: KeyboardEvent): void => {
      if (nganXep[nganXep.length - 1] !== khoa) return;
      if (e.key === "Escape") {
        if (moiNhat.current.khoaDong) return;
        e.stopPropagation();
        moiNhat.current.onDong();
        return;
      }
      if (e.key !== "Tab" || !hop.current) return;
      const ds = Array.from(hop.current.querySelectorAll<HTMLElement>(CO_THE_FOCUS));
      if (ds.length === 0) {
        e.preventDefault();
        hop.current.focus();
        return;
      }
      const dau = ds[0];
      const cuoi = ds[ds.length - 1];
      const dang = document.activeElement;
      if (e.shiftKey && (dang === dau || dang === hop.current)) {
        e.preventDefault();
        cuoi.focus();
      } else if (!e.shiftKey && dang === cuoi) {
        e.preventDefault();
        dau.focus();
      } else if (!hop.current.contains(dang)) {
        e.preventDefault();
        dau.focus();
      }
    };
    document.addEventListener("keydown", phim);

    return () => {
      document.removeEventListener("keydown", phim);
      moKhoa?.();
      if (--soKhoaCuon === 0) document.body.style.overflow = "";
      const i = nganXep.indexOf(khoa);
      if (i >= 0) nganXep.splice(i, 1);
      if (truoc && truoc.isConnected) truoc.focus?.();
    };
  }, [mo, hop, lop, focusDau]);
}
