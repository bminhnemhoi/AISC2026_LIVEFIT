import React, { useId } from "react";
import { NhanNguon } from "./NhanNguon";
import type { MaNhan } from "./nhan";
import "./nen.css";

type ThTag = "div" | "section" | "article" | "aside";

export interface ThProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Thẻ HTML; mặc định "section" khi có tiêu đề, "div" khi không. */
  as?: ThTag;
  tieuDe?: React.ReactNode;
  /** Câu lời thường ngay dưới tiêu đề. */
  phuDe?: React.ReactNode;
  /** Cấp tiêu đề; mặc định 2. */
  capTieuDe?: 2 | 3 | 4;
  /** Nút hay liên kết ở góc phải đầu thẻ. */
  hanhDong?: React.ReactNode;
  /** Nhãn nguồn của số trong thẻ, hiện ở đầu thẻ. */
  nhanNguon?: MaNhan;
  /** Đệm trong: "vua" 24 px (mặc định), "nho" 16 px, "khong" 0. */
  dem?: "vua" | "nho" | "khong";
}

/** Thẻ của giao diện 2.0: nền giấy, bo 12 px, bóng mềm. Có tiêu đề thì thẻ được đặt tên theo tiêu đề. */
export function Th({
  as,
  tieuDe,
  phuDe,
  capTieuDe = 2,
  hanhDong,
  nhanNguon,
  dem = "vua",
  className,
  children,
  ...rest
}: ThProps): React.ReactElement {
  const idTieuDe = useId();
  const Tag = as ?? (tieuDe ? "section" : "div");
  const H = `h${capTieuDe}` as "h2" | "h3" | "h4";
  const coDau = tieuDe != null || phuDe != null || hanhDong != null || nhanNguon != null;
  return (
    <Tag
      className={["nen-the", className].filter(Boolean).join(" ")}
      data-dem={dem}
      aria-labelledby={tieuDe != null && !rest["aria-label"] ? idTieuDe : undefined}
      {...rest}
    >
      {coDau ? (
        <div className="nen-the__dau">
          <div className="nen-the__chu">
            {tieuDe != null ? (
              <H id={idTieuDe} className="nen-the__tieu-de">
                {tieuDe}
              </H>
            ) : null}
            {phuDe != null ? <p className="nen-the__phu-de">{phuDe}</p> : null}
          </div>
          {nhanNguon != null || hanhDong != null ? (
            <div className="nen-the__hanh-dong">
              {nhanNguon != null ? <NhanNguon ma={nhanNguon} canh="phai" /> : null}
              {hanhDong}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
