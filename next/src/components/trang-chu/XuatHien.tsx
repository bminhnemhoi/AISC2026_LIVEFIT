"use client";

import React, { useEffect, useRef } from "react";
import { muonGiamChuyenDong } from "@/components/minh-hoa";

/**
 * Hiện dần (280 ms) khi phần tử cuộn vào màn hình. Phần tử luôn hiện sẵn: lớp `is-vao` chỉ thêm một hình động ngắn
 * lúc nó chạm mép màn hình, nên ảnh chụp toàn trang (không cuộn) vẫn đủ nội dung. Phần đã nằm trong màn đầu và chế độ
 * giảm chuyển động thì không diễn gì.
 */
export function XuatHien({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || muonGiamChuyenDong()) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const io = new IntersectionObserver(
      (ds) => {
        if (!ds.some((d) => d.isIntersecting)) return;
        el.classList.add("is-vao");
        io.disconnect();
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`tc-xh${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </div>
  );
}
