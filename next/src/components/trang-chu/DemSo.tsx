"use client";

import React, { useEffect, useRef, useState } from "react";
import { NHIP, muonGiamChuyenDong } from "@/components/minh-hoa";

interface PhanSo {
  /** chữ giữ nguyên (dấu, đơn vị, mũi tên) hoặc một số */
  chu: string;
  so?: number;
  soLe?: number;
}

/** Tách "−46% → −35%" thành chữ và số (dấu phẩy thập phân kiểu Việt). */
export function tachSo(chu: string): PhanSo[] {
  const ra: PhanSo[] = [];
  let cuoi = 0;
  for (const m of chu.matchAll(/\d+(?:,\d+)?/g)) {
    const i = m.index ?? 0;
    if (i > cuoi) ra.push({ chu: chu.slice(cuoi, i) });
    const [nguyen, le = ""] = m[0].split(",");
    ra.push({ chu: m[0], so: Number(`${nguyen}.${le || "0"}`), soLe: le.length });
    cuoi = i + m[0].length;
  }
  if (cuoi < chu.length) ra.push({ chu: chu.slice(cuoi) });
  return ra;
}

/** Ghép lại chuỗi ở tỷ lệ t (0..1) của đường đếm; t = 1 cho đúng chuỗi gốc. */
export function ghepSo(phan: readonly PhanSo[], t: number): string {
  return phan
    .map((p) => {
      if (p.so === undefined) return p.chu;
      if (t >= 1) return p.chu;
      return (p.so * t).toFixed(p.soLe ?? 0).replace(".", ",");
    })
    .join("");
}

/**
 * Số đếm lên trong 800 ms khi lọt vào màn hình. Máy chủ và lần vẽ đầu luôn ra đúng chuỗi gốc (ảnh chụp toàn trang
 * và trình đọc màn hình thấy số thật); giảm chuyển động thì không đếm.
 */
export function DemSo({ chu, className }: { chu: string; className?: string }): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const [hien, setHien] = useState(chu);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || typeof requestAnimationFrame === "undefined") return;
    if (muonGiamChuyenDong()) return;
    const phan = tachSo(chu);
    let raf = 0;
    const io = new IntersectionObserver(
      (ds) => {
        if (!ds.some((d) => d.isIntersecting)) return;
        io.disconnect();
        const batDau = performance.now();
        const buoc = (bay: number) => {
          const p = Math.min(1, (bay - batDau) / NHIP.demSo);
          setHien(ghepSo(phan, 1 - Math.pow(1 - p, 3)));
          if (p < 1) raf = requestAnimationFrame(buoc);
        };
        raf = requestAnimationFrame(buoc);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [chu]);

  return (
    <span ref={ref} className={className} data-so={chu}>
      {hien}
    </span>
  );
}
