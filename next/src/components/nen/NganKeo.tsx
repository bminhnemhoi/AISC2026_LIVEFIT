"use client";

import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/minh-hoa/icons";
import { useDaGan, useLopPhu } from "./lop-phu";
import { NutBam } from "./NutBam";
import "./nen.css";

export interface NganKeoProps {
  mo: boolean;
  onDong: () => void;
  tieuDe: React.ReactNode;
  /** Một câu dưới tiêu đề (đọc cho trình đọc màn hình làm mô tả). */
  moTa?: React.ReactNode;
  /**
   * "phai": trượt từ phải (mặc định); trên điện thoại (≤ 640 px) tự thành tấm trượt từ dưới lên.
   * "duoi": luôn là tấm trượt từ dưới lên.
   */
  phia?: "phai" | "duoi";
  /** Chiều rộng trên máy tính, px; mặc định 400. */
  rong?: number;
  /** Hàng nút ở chân ngăn kéo. */
  chanTrang?: React.ReactNode;
  /** Không cho đóng (đang chạy lệnh): khoá Esc, chạm nền và nút Đóng. */
  khoaDong?: boolean;
  /** Chữ cho nút đóng; mặc định "Đóng". */
  chuDong?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Ngăn kéo (drawer): bảng phụ trượt vào từ cạnh màn, ví dụ nút "?" mở phần giải thích ghim. */
export function NganKeo({
  mo,
  onDong,
  tieuDe,
  moTa,
  phia = "phai",
  rong = 400,
  chanTrang,
  khoaDong = false,
  chuDong = "Đóng",
  children,
  className,
}: NganKeoProps): React.ReactElement | null {
  const daGan = useDaGan();
  const lop = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLDivElement>(null);
  const idTieuDe = useId();
  const idMoTa = useId();
  useLopPhu(mo && daGan, onDong, hop, lop, { khoaDong });

  if (!daGan || !mo) return null;
  return createPortal(
    <div
      ref={lop}
      className="nen-lop-phu"
      data-loai="ngan"
      data-phia={phia}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !khoaDong) onDong();
      }}
    >
      <div
        ref={hop}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTieuDe}
        aria-describedby={moTa != null ? idMoTa : undefined}
        tabIndex={-1}
        className={["nen-ngan", className].filter(Boolean).join(" ")}
        style={{ "--n-rong-ngan": `${rong}px` } as React.CSSProperties}
      >
        <div className="nen-ngan__dau">
          <div className="nen-ngan__chu">
            <h2 id={idTieuDe} className="nen-ngan__tieu-de">
              {tieuDe}
            </h2>
            {moTa != null ? (
              <p id={idMoTa} className="nen-ngan__mo-ta">
                {moTa}
              </p>
            ) : null}
          </div>
          <NutBam bien="vien" onClick={onDong} disabled={khoaDong} bieuTuong={<IconClose size={18} />}>
            {chuDong}
          </NutBam>
        </div>
        <div className="nen-ngan__than">{children}</div>
        {chanTrang != null ? <div className="nen-ngan__chan">{chanTrang}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
