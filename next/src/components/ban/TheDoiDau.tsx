"use client";

import React from "react";
import { ThuocKhoangTinCay } from "@/components/bieu-do";
import { Chip, NhanNguon, type MaNhan } from "@/components/nen";
import type { ThuocKhoangTinCayProps } from "@/components/bieu-do/ThuocKhoangTinCay";
import { mmss } from "@/lib/livelift-api/desk";
import { CHO_CANON, KET_LUAN_THEO_MA, type MaKetLuan } from "@/lib/tu-ngu";

const hoaDau = (chu: string): string => chu.charAt(0).toUpperCase() + chu.slice(1);

/**
 * Hình MINH HOẠ vì sao đoán theo số liệu cũ dễ nhầm: người bán hay ghim đúng lúc đông khách, nên lượt nhấp cao lúc
 * ghim có thể do giờ đông chứ không do ghim. Không có số; chỉ là hình giải thích.
 */
function HinhNhamLan() {
  // đường người xem: thấp, lên đỉnh giữa phiên, xuống lại
  const duong = "M8 70 C 40 68, 60 60, 90 40 S 130 14, 150 16 S 190 34, 210 52 S 250 66, 272 66";
  const ghim = [118, 138, 158, 178];
  return (
    <figure className="ban-nham">
      <svg viewBox="0 0 280 88" role="img" aria-label="Hình minh hoạ: các lần ghim dồn vào giờ đông khách, nên khó tách tác dụng của ghim khỏi giờ đông.">
        <rect x="104" y="6" width="92" height="70" rx="8" className="ban-nham__vung" />
        <path d={duong} className="ban-nham__duong" />
        {ghim.map((x) => (
          <g key={x} transform={`translate(${x} 78)`} className="ban-nham__ghim">
            <path d="M0 -12 L5 -4 L-5 -4 Z" />
            <line x1="0" y1="-4" x2="0" y2="4" />
          </g>
        ))}
        <line x1="8" y1="84" x2="272" y2="84" className="ban-nham__truc" />
      </svg>
      <figcaption className="ban-nham__chu">
        <span>
          <i className="ban-nham__mau" data-loai="xem" aria-hidden="true" /> người xem
        </span>
        <span>
          <i className="ban-nham__mau" data-loai="ghim" aria-hidden="true" /> lúc ghim, dồn vào giờ đông
        </span>
        <NhanNguon ma="MINH_HOA" />
      </figcaption>
    </figure>
  );
}

export interface GoiYTuongQuan {
  tieuDe: string;
  lyDo: string;
}

export interface TheDoiDauProps {
  /** Thẻ gợi ý kiểu nền tảng (tương quan) đầu tiên của máy chủ; null khi chưa có. */
  goiY: GoiYTuongQuan | null;
  /** Câu máy chủ giải thích vì sao chưa có gợi ý. */
  ghiChuGoiY?: string | null;
  /** Được hiện kết quả (máy chủ đã trả khoa=false). */
  hienKetQua: boolean;
  /** Số cho thước, chỉ đọc khi hienKetQua. */
  thuoc: Pick<ThuocKhoangTinCayProps, "uocLuong" | "thap" | "cao" | "lyDo">;
  /** Mã kết luận khi đã có ước lượng. */
  ketLuan: MaKetLuan | null;
  nhanNguon: MaNhan;
  /** Dòng giải thích khi mở sớm (MÔ PHỎNG, DÀN DỰNG). */
  dongMoSom?: string | null;
  /** Giây còn lại tới hết phiên (khi đang khoá và đang live); null thì không hiện. */
  conLaiS?: number | null;
}

/**
 * Hàng 3 của bàn thí nghiệm (ảnh slide `the-doi-dau`): hai cách trả lời cùng một câu hỏi.
 * Trái: đoán theo số liệu cũ (tương quan) kèm nhãn rủi ro. Phải: LiveLift bốc thăm; khoá tới hết phiên trừ khi
 * máy chủ đã mở khoá.
 */
export function TheDoiDau({ goiY, ghiChuGoiY, hienKetQua, thuoc, ketLuan, nhanNguon, dongMoSom, conLaiS }: TheDoiDauProps) {
  const kl = ketLuan ? KET_LUAN_THEO_MA[ketLuan] : null;
  return (
    <section className="ban-the ban-doi-dau" aria-labelledby="ban-h-doi-dau" data-chup="the-doi-dau">
      <div className="ban-doi-dau__dau">
        <p className="ban-phu">Hai cách trả lời cùng một câu hỏi</p>
        <h2 id="ban-h-doi-dau" className="ban-doi-dau__cau-hoi">
          Ghim món này, khách có bấm nhiều hơn không?
        </h2>
      </div>
      <div className="ban-doi-dau__hai">
        <div className="ban-doi-dau__ben" data-ben="tuong-quan">
          <p className="ban-doi-dau__ten">
            {hoaDau(CHO_CANON.tuongQuan)} <span className="ban-phu">(tương quan)</span>
          </p>
          {goiY ? (
            <>
              <p className="ban-doi-dau__goi-y">{goiY.tieuDe}</p>
              <p className="ban-phu">{goiY.lyDo}</p>
            </>
          ) : (
            <p className="ban-phu">{ghiChuGoiY ?? "Chưa có gợi ý."}</p>
          )}
          <HinhNhamLan />
          <p className="ban-doi-dau__cach">
            Cách này nhìn số cũ: lúc ghim thì khách nhấp nhiều hơn. Nhưng lúc ghim cũng hay là lúc đông khách, nên không tách được
            nhờ ghim hay nhờ giờ.
          </p>
          <div className="ban-doi-dau__nhan">
            <Chip tone="vang">Dễ nhầm</Chip>
            <span className="ban-phu">giờ đông khách trùng giờ ghim</span>
          </div>
        </div>
        <div className="ban-doi-dau__ben" data-ben="boc-tham">
          <div className="ban-doi-dau__ten-hang">
            <p className="ban-doi-dau__ten">LiveLift bốc thăm</p>
            {hienKetQua ? <NhanNguon ma={nhanNguon} canh="phai" /> : null}
          </div>
          {hienKetQua ? (
            <>
              {kl ? (
                <p className="ban-doi-dau__ket-luan" data-ket-luan={kl.id}>
                  {kl.chu}
                </p>
              ) : null}
              <ThuocKhoangTinCay khoa={false} {...thuoc} gon muc={3} tieuDe="Khoảng tin cậy của chênh lệch BẬT trừ TẮT" />
              {dongMoSom ? <p className="ban-phu">{dongMoSom}</p> : null}
            </>
          ) : (
            <div className="ban-doi-dau__khoa" data-testid="ban-ket-qua-khoa">
              <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" className="ban-khoa-icon">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <p className="ban-doi-dau__goi-y">Đang khoá tới hết phiên để không ai nhìn trộm</p>
              <p className="ban-phu">
                Lịch bốc thăm đã niêm phong trước giờ live. Hết phiên mới so khối BẬT với khối TẮT, ra ĐỔI, GIỮ hoặc ĐO THÊM.
              </p>
              <div className="ban-thuoc-mo" aria-hidden="true">
                {(["GIU", "DO_THEM", "DOI"] as const).map((ma) => (
                  <span key={ma}>{KET_LUAN_THEO_MA[ma].chu}</span>
                ))}
              </div>
              {conLaiS != null ? <p className="ban-doi-dau__goi-y">Mở sau khoảng {mmss(conLaiS)} nữa</p> : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
