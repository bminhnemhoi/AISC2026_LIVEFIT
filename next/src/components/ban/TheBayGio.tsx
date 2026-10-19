"use client";

import React from "react";
import { NutBam, NutLienKet } from "@/components/nen";
import { mmss } from "@/lib/livelift-api/desk";
import { TU } from "@/lib/tu-ngu";
import type { BayGio } from "./logic";

/** Phụ đề lời thường của nút ghim, lấy từ canon (phần sau "; " của nghĩa). */
export const PHU_DE_NUT_GHIM: string =
  TU.ghimMonKhoiNay.phu_de ?? (TU.ghimMonKhoiNay.nghia ?? "").split("; ").slice(1).join("; ");

const BAN_KINH = 40;
const CHU_VI = 2 * Math.PI * BAN_KINH;

/** Vòng đếm ngược tới hết khối. Màu theo khối (BẬT xanh, TẮT xám), chữ ở giữa nói rõ còn bao lâu. */
function VongDem({ phanCon, conGiay, loai }: { phanCon: number; conGiay: number | null; loai: BayGio["loai"] }) {
  return (
    <div className="ban-vong" data-loai={loai}>
      <svg viewBox="0 0 100 100" width="80" height="80" aria-hidden="true">
        <circle cx="50" cy="50" r={BAN_KINH} className="ban-vong__nen" />
        <circle
          cx="50"
          cy="50"
          r={BAN_KINH}
          className="ban-vong__dac"
          strokeDasharray={`${CHU_VI * phanCon} ${CHU_VI}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="ban-vong__so" aria-label={conGiay == null ? undefined : `còn ${mmss(conGiay)} trong khối`}>
        {conGiay == null ? "--:--" : mmss(conGiay)}
      </span>
    </div>
  );
}

const CHU_KHOI: Record<BayGio["loai"], string> = {
  bat: "Khối BẬT",
  tat: "Khối TẮT",
  troi: "Khoảng chuyển",
  ngoai_khoi: "Ngoài lịch khối",
  ket_thuc: "Phiên đã kết thúc",
  chua_phat: "Chưa phát",
};

export interface TheBayGioProps {
  bayGio: BayGio;
  sessionId: string;
  /** Món đang ghim trên nền tảng (kể cả còn từ khối trước). */
  monGhim: { ten: string; gia?: number | null } | null;
  dangGhim: boolean;
  onGhim: () => void;
  thongBao: string | null;
}

/** Thẻ "Bây giờ": khối hiện tại, vòng đếm ngược, món đang ghim và nút chính "Ghim món của khối này". */
export function TheBayGio({ bayGio, sessionId, monGhim, dangGhim, onGhim, thongBao }: TheBayGioProps) {
  const b = bayGio;
  const coKhoi = b.loai === "bat" || b.loai === "tat" || b.loai === "troi";
  return (
    <section className="ban-the ban-bay-gio" aria-labelledby="ban-h-bay-gio" data-loai={b.loai}>
      <h2 id="ban-h-bay-gio" className="ban-the__tieu-de">
        Bây giờ
      </h2>
      <div className="ban-bay-gio__dau">
        {coKhoi ? <VongDem phanCon={b.phanCon} conGiay={b.conGiay} loai={b.loai} /> : null}
        <div className="ban-bay-gio__khoi">
          <p className="ban-bay-gio__ten-khoi" data-loai={b.loai}>
            {CHU_KHOI[b.loai]}
          </p>
          {b.soKhoi != null ? (
            <p className="ban-phu">
              Khối {b.soKhoi}/{b.tongKhoi} · còn lại trong khối
            </p>
          ) : b.loai === "ngoai_khoi" ? (
            <p className="ban-phu">Đã qua hết {b.tongKhoi} khối. Kết thúc phiên để xem tổng kết.</p>
          ) : null}
        </div>
      </div>

      <div className="ban-mon" data-co-mon={monGhim ? "1" : undefined}>
        <p className="ban-mon__nhan">Đang ghim</p>
        <p className="ban-mon__ten">{monGhim ? monGhim.ten : "Chưa ghim món nào"}</p>
        {monGhim?.gia != null ? <p className="ban-phu">{monGhim.gia.toLocaleString("vi-VN")} đ</p> : null}
        {b.conTuKhoiTruoc ? (
          <p className="ban-phu" data-testid="off-block-carryover">
            Còn từ khối trước: khối TẮT không tự gỡ ghim.
          </p>
        ) : null}
      </div>

      {b.hienNut ? (
        <div className="ban-bay-gio__nut">
          <NutBam bien="chinh" cao={48} rong disabled={!b.ghimDuoc || dangGhim} dangChay={dangGhim} onClick={onGhim}>
            {TU.ghimMonKhoiNay.chu}
          </NutBam>
          <p className="ban-phu">{b.lyDoKhoaNut ?? PHU_DE_NUT_GHIM}</p>
        </div>
      ) : b.loai === "ket_thuc" || b.loai === "ngoai_khoi" ? (
        <div className="ban-bay-gio__nut">
          <NutLienKet href={`/phien/${sessionId}/tong-ket`} bien="chinh" cao={48} rong>
            Xem tổng kết
          </NutLienKet>
        </div>
      ) : null}
      {thongBao ? (
        <p className="ban-phu" role="status">
          {thongBao}
        </p>
      ) : null}
    </section>
  );
}
