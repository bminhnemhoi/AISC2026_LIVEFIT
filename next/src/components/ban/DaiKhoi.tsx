import React from "react";
import { PHU_DE_KHOI } from "@/lib/tu-ngu";
import type { ODaiKhoi } from "./logic";

const CHU: Record<ODaiKhoi["loai"], string> = { bat: "B", tat: "T", troi: "" };
const TEN: Record<ODaiKhoi["loai"], string> = { bat: "BẬT", tat: "TẮT", troi: "khoảng chuyển" };
const TRANG_THAI: Record<ODaiKhoi["trangThai"], string> = { qua: "đã qua", nay: "đang chạy", toi: "sắp tới" };

/**
 * Dải khối B/T của người bán (người dẫn và khách không bao giờ thấy). BẬT xanh có chữ B, TẮT xám có sọc và chữ T,
 * khối đang chạy nổi viền mực, khối sắp tới mờ. Chỉ là lịch: không kèm số theo khối (khoá §7).
 */
export function DaiKhoi({ o }: { o: ODaiKhoi[] }) {
  const nBat = o.filter((x) => x.loai === "bat").length;
  const nTat = o.filter((x) => x.loai === "tat").length;
  return (
    <div className="ban-dai">
      <div className="ban-dai__dau">
        <p className="ban-dai__tieu-de">Lịch khối · chỉ người bán thấy</p>
        <p className="ban-phu ban-dai__chu-giai">
          <span className="ban-o-mau" data-loai="bat" aria-hidden="true" /> BẬT: {PHU_DE_KHOI.bat}
          <span className="ban-o-mau" data-loai="tat" aria-hidden="true" /> TẮT: {PHU_DE_KHOI.tat}
        </p>
      </div>
      <ol
        className="ban-dai__ds"
        aria-label={`Lịch ${o.length} khối: ${nBat} khối BẬT, ${nTat} khối TẮT`}
        data-testid="ban-dai-khoi"
        data-nhieu={o.length > 24 ? "" : undefined}
      >
        {o.map((x) => (
          <li
            key={x.so}
            className="ban-dai__o"
            data-loai={x.loai}
            data-trang-thai={x.trangThai}
            style={{ flexGrow: x.rongPhanTram }}
            title={`Khối ${x.so}: ${TEN[x.loai]}, ${TRANG_THAI[x.trangThai]}`}
            aria-current={x.trangThai === "nay" ? "step" : undefined}
          >
            <span aria-hidden="true">{CHU[x.loai]}</span>
            <span className="nen-an">{`Khối ${x.so}: ${TEN[x.loai]}, ${TRANG_THAI[x.trangThai]}`}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
