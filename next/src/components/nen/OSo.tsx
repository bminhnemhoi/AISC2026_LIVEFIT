import React, { useId } from "react";
import { nhanVaPhuDe, type TuMuc } from "@/lib/tu-ngu";
import { NhanNguon } from "./NhanNguon";
import type { MaNhan } from "./nhan";
import "./nen.css";

export interface ThayDoi {
  /** Chữ đã định dạng, có dấu và mốc so sánh, ví dụ "+12% so với phiên trước". */
  chu: string;
  huong: "len" | "xuong" | "ngang";
  /** Hướng này tốt hay xấu cho người bán; bỏ trống thì hiện màu trung tính. */
  danhGia?: "tot" | "xau";
}

export interface OSoProps {
  /** Lấy nhãn và phụ đề từ canon, ví dụ TU.tyLeNhap → "Tỷ lệ nhấp" kèm phụ đề đầy đủ. */
  tu?: TuMuc;
  /** Nhãn ô số (viết hoa chữ đầu, không dấu hai chấm). Bắt buộc khi không truyền `tu`. */
  nhan?: string;
  /** Giá trị đã định dạng kiểu Việt ("1.284", "12,4"). null hoặc undefined: chưa có số. */
  giaTri?: React.ReactNode;
  donVi?: string;
  /** Phụ đề lời thường; ghi đè phụ đề lấy từ `tu`. */
  phuDe?: string;
  nhanNguon?: MaNhan;
  thayDoi?: ThayDoi;
  /** Chỗ cho đường nhỏ (biểu đồ của U2); nằm sát đáy ô. */
  duongNho?: React.ReactNode;
  /** Chữ hiện khi chưa có số; mặc định "Chưa có số". */
  chuTrong?: string;
  className?: string;
}

const MUI_TEN: Record<ThayDoi["huong"], string> = { len: "↑", xuong: "↓", ngang: "→" };

/**
 * Ô số KPI: nhãn, nhãn nguồn, giá trị lớn, phụ đề, thay đổi (mũi tên + chữ, không chỉ bằng màu) và chỗ cho đường nhỏ.
 * Số lớn dùng chữ số tỷ lệ (không tabular) theo luật dataviz.
 */
export function OSo({
  tu,
  nhan,
  giaTri,
  donVi,
  phuDe,
  nhanNguon,
  thayDoi,
  duongNho,
  chuTrong = "Chưa có số",
  className,
}: OSoProps): React.ReactElement {
  const idNhan = useId();
  const tuCanon = tu ? nhanVaPhuDe(tu) : null;
  const chuNhan = nhan ?? tuCanon?.nhan;
  if (!chuNhan) throw new Error("OSo: cần `nhan` hoặc `tu`");
  const chuPhuDe = phuDe ?? tuCanon?.phuDe;
  const trong = giaTri === null || giaTri === undefined || giaTri === "";
  return (
    <div
      className={["nen-oso", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={idNhan}
      data-trong={trong ? "1" : undefined}
    >
      <div className="nen-oso__dau">
        <p id={idNhan} className="nen-oso__nhan">
          {chuNhan}
        </p>
        {nhanNguon != null ? <NhanNguon ma={nhanNguon} canh="phai" /> : null}
      </div>
      <p className="nen-oso__gia-tri">
        {trong ? (
          chuTrong
        ) : (
          <>
            <span>{giaTri}</span>
            {donVi ? <span className="nen-oso__don-vi">{donVi}</span> : null}
          </>
        )}
      </p>
      {chuPhuDe ? <p className="nen-oso__phu-de">{chuPhuDe}</p> : null}
      {thayDoi ? (
        <p className="nen-oso__thay-doi" data-danh-gia={thayDoi.danhGia}>
          <span aria-hidden="true">{MUI_TEN[thayDoi.huong]} </span>
          {thayDoi.chu}
        </p>
      ) : null}
      {duongNho ? <div className="nen-oso__duong-nho">{duongNho}</div> : null}
    </div>
  );
}
