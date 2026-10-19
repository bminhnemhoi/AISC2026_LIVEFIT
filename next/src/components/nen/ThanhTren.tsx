import React from "react";
import { NhanNguon } from "./NhanNguon";
import type { MaNhan } from "./nhan";
import "./nen.css";

export interface ThanhTrenProps {
  tieuDe: React.ReactNode;
  /** Câu lời thường dưới tiêu đề (ví dụ phụ đề canon của danh sách phiên). */
  phuDe?: React.ReactNode;
  /** Cấp của tiêu đề; mặc định 1 (thanh trên là tiêu đề trang). */
  capTieuDe?: 1 | 2;
  /** Nhãn nguồn của dữ liệu trên trang; rê chuột hoặc chạm để đọc nghĩa. */
  nhanNguon?: MaNhan;
  /** Hiện viên "ĐANG LIVE" màu đỏ gạch. */
  live?: boolean;
  /** Phần bên trái tiêu đề (ví dụ liên kết quay lại). */
  trai?: React.ReactNode;
  /** Nút bên phải; tối đa một nút chính. */
  hanhDong?: React.ReactNode;
  className?: string;
}

/** Thanh trên của trang: tiêu đề, phụ đề, nhãn nguồn, ĐANG LIVE, các nút. Dính ở đầu khi cuộn. */
export function ThanhTren({
  tieuDe,
  phuDe,
  capTieuDe = 1,
  nhanNguon,
  live = false,
  trai,
  hanhDong,
  className,
}: ThanhTrenProps): React.ReactElement {
  const H = capTieuDe === 1 ? "h1" : "h2";
  return (
    <header className={["nen-thanh-tren", className].filter(Boolean).join(" ")} data-testid="nen-thanh-tren">
      <div className="nen-thanh-tren__trai">
        {trai}
        <div className="nen-thanh-tren__chu">
          <H className="nen-thanh-tren__tieu-de">{tieuDe}</H>
          {phuDe != null ? <p className="nen-thanh-tren__phu-de">{phuDe}</p> : null}
        </div>
      </div>
      {live || nhanNguon != null || hanhDong != null ? (
        <div className="nen-thanh-tren__phai">
          {live ? (
            <span className="nen-live" data-live="1">
              <span className="nen-live__cham" aria-hidden="true" />
              ĐANG LIVE
            </span>
          ) : null}
          {nhanNguon != null ? <NhanNguon ma={nhanNguon} canh="phai" /> : null}
          {hanhDong}
        </div>
      ) : null}
    </header>
  );
}
