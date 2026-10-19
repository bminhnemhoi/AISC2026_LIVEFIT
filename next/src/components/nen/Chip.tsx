import React from "react";
import type { ToneChip } from "./token";
import "./nen.css";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Mặc định "trung". "gach" chỉ dùng cho chỗ gắn với LIVE; "bat"/"tat" chỉ cho khối BẬT/TẮT. */
  tone?: ToneChip;
  /** Biểu tượng nhỏ trước chữ (trang trí). */
  bieuTuong?: React.ReactNode;
}

/** Chip dạng viên thuốc, chỉ để đọc (không bấm được). Cần bấm thì dùng NutBam. */
export function Chip({ tone = "trung", bieuTuong, className, children, ...rest }: ChipProps): React.ReactElement {
  return (
    <span className={["nen-chip", className].filter(Boolean).join(" ")} data-tone={tone} {...rest}>
      {bieuTuong ? (
        <span className="nen-chip__bieu-tuong" aria-hidden="true">
          {bieuTuong}
        </span>
      ) : null}
      {children}
    </span>
  );
}
