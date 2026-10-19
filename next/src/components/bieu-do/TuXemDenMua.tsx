"use client";

import { Fragment, useMemo } from "react";
import { bangPheu } from "@/lib/bieu-do/bang";
import { BIEN } from "@/lib/bieu-do/mau";
import { moTaPheu } from "@/lib/bieu-do/mo-ta";
import { pheuTuXemDenMua } from "@/lib/bieu-do/pheu";
import { funnel } from "@/lib/livelift-api/desk";
import type { OrderSummary, Tick } from "@/lib/livelift-api/types";
import { KhungBieuDo, type MucTieuDe } from "./dung-chung";

/**
 * "Từ xem đến mua": ba bước đo bằng ba đơn vị khác nhau, nên là ba ô số có tên và đơn vị, nối bằng tỷ lệ chuyển
 * (không vẽ phễu có độ rộng tỷ lệ, vì độ rộng giữa hai đơn vị khác nhau không có nghĩa). Không có nguồn đơn thì bước
 * cuối nói rõ, không in 0.
 */

export interface TuXemDenMuaProps {
  ticks: Tick[];
  don: OrderSummary | null;
  /** Phiên có nguồn đơn không (`coNguonDon(phien)`: phòng xem có đơn tiền ảo). */
  coNguonDon: boolean;
  /** Tên bước cuối, ví dụ "Đơn tiền ảo" ở phòng xem. */
  tenDon?: string;
  tieuDe?: string;
  nhan?: string | null;
  dangTai?: boolean;
  muc?: MucTieuDe;
}

function MuiTen() {
  return (
    <span className="bd-pheu-mui" aria-hidden="true">
      <svg className="bd-pheu-mui-ngang" width="24" height="16" viewBox="0 0 24 16" focusable="false">
        <path d="M2 8h18M15 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg className="bd-pheu-mui-doc" width="16" height="20" viewBox="0 0 16 20" focusable="false">
        <path d="M8 2v14M3 11l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function TuXemDenMua({ ticks, don, coNguonDon, tenDon = "Đơn", tieuDe = "Từ xem đến mua", nhan, dangTai, muc }: TuXemDenMuaProps) {
  const p = useMemo(() => funnel(ticks, don), [ticks, don]);
  const pheu = useMemo(() => pheuTuXemDenMua(p, coNguonDon, tenDon), [p, coNguonDon, tenDon]);
  return (
    <KhungBieuDo
      tieuDe={tieuDe}
      phuDe="Thời gian xem, rồi lượt nhấp, rồi đơn; giữa hai bước là tỷ lệ chuyển"
      nhan={nhan}
      moTa={moTaPheu(p, coNguonDon)}
      bang={bangPheu(pheu)}
      dangTai={dangTai}
      muc={muc}
      testId="bd-pheu"
    >
      <ol className="bd-pheu">
        {pheu.buoc.map((b, i) => (
          <Fragment key={b.khoa}>
            <li className="bd-pheu-buoc" data-buoc={b.khoa}>
              <span className="bd-pheu-ten">
                <i className="bd-mau-o" style={{ background: BIEN[b.mau] }} aria-hidden="true" />
                {b.ten}
              </span>
              {b.so != null ? (
                <>
                  <span className="bd-pheu-so">{b.so}</span>
                  <span className="bd-pheu-don-vi">{b.donVi}</span>
                </>
              ) : (
                <span className="bd-pheu-thieu">{b.thieu}</span>
              )}
            </li>
            {i < pheu.noi.length ? (
              <li className="bd-pheu-noi" aria-label={`${pheu.noi[i].ten}: ${pheu.noi[i].giaTri ?? "chưa tính được"}`}>
                <MuiTen />
                <span>{pheu.noi[i].ten}</span>
                <strong>{pheu.noi[i].giaTri ?? "chưa tính được"}</strong>
                <small className="bd-pheu-noi-don-vi">{pheu.noi[i].donVi}</small>
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </KhungBieuDo>
  );
}
