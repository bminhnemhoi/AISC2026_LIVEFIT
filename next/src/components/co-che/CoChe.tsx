"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { CanCan, DienThoaiKhoi, DongXu, LichNiemPhong, useGiamChuyenDong, type MatKhoi } from "@/components/minh-hoa";
import { NhanNguon, type MaNhan } from "@/components/nen";
import { maNhanNguonTu } from "@/components/dien-thoai/nhan";
import { BUOC_CO_CHE, CAU_DAN_CO_CHE, GHI_CHU_GHIM, KET_LUAN_CO_CHE, TIEU_DE_CO_CHE, type BuocCoChe, type MaBuoc } from "./noi-dung";
import "./co-che.css";

/**
 * Màn giải thích ghim (CoChe, mục 3 kế hoạch 3.1), một thành phần cho ba chỗ:
 * - `trang`: landing, bốn thẻ nằm ngang (hai cột trên máy tính bảng, một cột trên điện thoại), hình có chuyển động;
 * - `ngan`: ngăn kéo "?" của bàn thí nghiệm, danh sách dọc gọn, hình tĩnh;
 * - `buoc`: wizard, mỗi lần một bước, nút "Quay lại" / "Tiếp" (48 px).
 * Bản SVG tĩnh cho slide, poster, video nằm ở `CoCheSvg.tsx` và `xuat.tsx`.
 * Mọi khung đứng thẳng; chỉ hình trang trí `aria-hidden` được nghiêng tối đa 2°.
 */

export type BienTheCoChe = "trang" | "ngan" | "buoc";

export interface CoCheProps {
  bienThe?: BienTheCoChe;
  /** tiêu đề; null để ẩn (khi ngăn kéo đã có tiêu đề riêng) */
  tieuDe?: string | null;
  /** thẻ của tiêu đề (mặc định h2) */
  the?: "h2" | "h3";
  /** câu dẫn dưới tiêu đề; null để ẩn (mặc định chỉ hiện ở `trang`) */
  cauDan?: string | null;
  /** chip nguồn của hình theo mã canon, mặc định MINH_HOA; null để ẩn. Chữ cũ trùng canon vẫn nhận, chữ ngoài canon bị bỏ. */
  nhan?: MaNhan | string | null;
  /** hiện dòng "ghim ở đâu" (canon cau_ghim); mặc định true */
  ghiChuGhim?: boolean;
  /** wizard: bước đang hiện (0..3) khi muốn điều khiển từ ngoài */
  buoc?: number;
  /** wizard: báo bước mới */
  onDoiBuoc?: (buoc: number) => void;
  /** wizard: bấm "Đã hiểu" ở bước cuối */
  onXong?: () => void;
  /** chữ nút cuối của wizard */
  chuNutXong?: string;
  className?: string;
}

/** Số lần lật của đồng xu ở bước 1: hai lần (BẬT → TẮT → BẬT), xong trong dưới 5 giây (WCAG 2.2.2). */
export const SO_LAN_LAT_XU = 2;

/** Đồng xu lật BẬT / TẮT mỗi 1,8 giây khi `chay`, tối đa SO_LAN_LAT_XU lần; giảm chuyển động thì đứng yên ở BẬT. */
function useXuLatVong(chay: boolean): MatKhoi {
  const giam = useGiamChuyenDong();
  const [lan, setLan] = useState(0);
  useEffect(() => {
    if (!chay || giam) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setLan(n);
      if (n >= SO_LAN_LAT_XU) window.clearInterval(id);
    }, 1800);
    return () => window.clearInterval(id);
  }, [chay, giam]);
  return chay && !giam && lan % 2 === 1 ? "tat" : "bat";
}

/** Hình của một bước. `dong`: có chuyển động (landing). Chỉ để trang trí: chữ của bước đã nói đủ. */
export function HinhBuoc({ ma, dong = false, className }: { ma: MaBuoc; dong?: boolean; className?: string }) {
  const mat = useXuLatVong(dong && ma === "tung-xu");
  return (
    <div className={`cc-hinh cc-hinh-${ma}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {ma === "tung-xu" && (
        <>
          <LichNiemPhong />
          <span className="cc-hinh-xu">
            <DongXu mat={mat} />
          </span>
        </>
      )}
      {ma === "khoi-bat" && <DienThoaiKhoi khoi="bat" className={dong ? "mh-dong" : undefined} />}
      {ma === "khoi-tat" && <DienThoaiKhoi khoi="tat" mon="tui-tote" />}
      {ma === "so-sanh" && <CanCan />}
    </div>
  );
}

/**
 * Ba kết luận, mỗi chữ kèm câu canon. `chiDieuKien`: chỉ giữ phần điều kiện của câu (trước dấu hai chấm), cho chỗ
 * chật như bốn thẻ nằm ngang của landing; câu đủ nằm trong ngăn kéo, wizard và bản SVG dọc.
 */
export function DanhSachKetLuan({ gon = false, chiDieuKien = false }: { gon?: boolean; chiDieuKien?: boolean }) {
  return (
    <ul className={`cc-ket-luan${gon ? " is-gon" : ""}`} aria-label="Ba kết luận có thể có">
      {KET_LUAN_CO_CHE.map((k) => (
        <li key={k.ma} className={`cc-kl cc-kl-${k.ma}`} data-ket-luan={k.id}>
          <span className="cc-kl-chu">{k.chu}</span>
          {chiDieuKien || !k.loiKhuyen ? (
            <span className="cc-kl-cau">{chiDieuKien ? k.dieuKien : k.cau}</span>
          ) : (
            <span className="cc-kl-cau">
              <b className="cc-kl-dk">{k.dieuKien}:</b> {k.loiKhuyen}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function NoiDungBuoc({ b, TheTieuDe, gon = false, chiDieuKien = false }: { b: BuocCoChe; TheTieuDe: "h3" | "h4"; gon?: boolean; chiDieuKien?: boolean }) {
  return (
    <div className="cc-chu">
      <TheTieuDe className="cc-tieu-de-buoc">{b.tieuDe}</TheTieuDe>
      <p className="cc-cau">{b.cau}</p>
      <p className="cc-phu-de">{b.phuDe}</p>
      {b.ma === "so-sanh" && <DanhSachKetLuan gon={gon} chiDieuKien={chiDieuKien} />}
    </div>
  );
}

function SoBuoc({ so, tong }: { so: number; tong: number }) {
  return (
    <span className="cc-so">
      <span aria-hidden="true">{so}</span>
      <span className="cc-an">{`Bước ${so} trên ${tong}`}</span>
    </span>
  );
}

function ChanCoChe({ ghiChuGhim, nhan }: { ghiChuGhim: boolean; nhan: MaNhan | string | null }) {
  const ma = maNhanNguonTu(nhan);
  if (!ghiChuGhim && ma.length === 0) return null;
  return (
    <div className="cc-chan">
      {ghiChuGhim && <p className="cc-ghi-chu">{GHI_CHU_GHIM}</p>}
      {ma.length > 0 && <NhanNguon ma={ma} tinh className="cc-nhan" />}
    </div>
  );
}

export function CoChe({
  bienThe = "trang",
  tieuDe = TIEU_DE_CO_CHE,
  the: The = "h2",
  cauDan,
  nhan = "MINH_HOA",
  ghiChuGhim = true,
  buoc,
  onDoiBuoc,
  onXong,
  chuNutXong = "Đã hiểu",
  className,
}: CoCheProps) {
  const idTieuDe = useId();
  const cauDanHien = cauDan === undefined ? (bienThe === "trang" ? CAU_DAN_CO_CHE : null) : cauDan;
  const TheBuoc = The === "h2" ? "h3" : "h4";
  const lop = `cc cc-${bienThe}${className ? ` ${className}` : ""}`;
  const dau = (
    <>
      {tieuDe && <The id={idTieuDe} className="cc-tieu-de">{tieuDe}</The>}
      {cauDanHien && <p className="cc-cau-dan">{cauDanHien}</p>}
    </>
  );
  const nhanVung = tieuDe ? { "aria-labelledby": idTieuDe } : { "aria-label": TIEU_DE_CO_CHE };

  if (bienThe === "buoc") {
    return (
      <section className={lop} data-co-che="buoc" {...nhanVung}>
        {dau}
        <WizardCoChe buoc={buoc} onDoiBuoc={onDoiBuoc} onXong={onXong} chuNutXong={chuNutXong} TheBuoc={TheBuoc} />
        <ChanCoChe ghiChuGhim={ghiChuGhim} nhan={nhan} />
      </section>
    );
  }

  const dong = bienThe === "trang";
  return (
    <section className={lop} data-co-che={bienThe} {...nhanVung}>
      {dau}
      <ol className="cc-ds">
        {BUOC_CO_CHE.map((b) => (
          <li key={b.ma} className={`cc-the cc-the-${b.ma}`} data-buoc={b.so}>
            <div className="cc-the-dau">
              <SoBuoc so={b.so} tong={BUOC_CO_CHE.length} />
              <HinhBuoc ma={b.ma} dong={dong} />
            </div>
            <NoiDungBuoc b={b} TheTieuDe={TheBuoc} gon={bienThe === "ngan"} chiDieuKien={bienThe === "trang"} />
          </li>
        ))}
      </ol>
      <ChanCoChe ghiChuGhim={ghiChuGhim} nhan={nhan} />
    </section>
  );
}

function WizardCoChe({
  buoc,
  onDoiBuoc,
  onXong,
  chuNutXong,
  TheBuoc,
}: {
  buoc?: number;
  onDoiBuoc?: (b: number) => void;
  onXong?: () => void;
  chuNutXong: string;
  TheBuoc: "h3" | "h4";
}) {
  const tong = BUOC_CO_CHE.length;
  const [noiBo, setNoiBo] = useState(0);
  const hienTai = Math.max(0, Math.min(tong - 1, buoc ?? noiBo));
  const b = BUOC_CO_CHE[hienTai];
  const vung = useRef<HTMLDivElement>(null);
  const daDoi = useRef(false);

  const doi = (moi: number) => {
    const k = Math.max(0, Math.min(tong - 1, moi));
    daDoi.current = true;
    if (buoc === undefined) setNoiBo(k);
    onDoiBuoc?.(k);
  };

  // đổi bước bằng nút thì đưa tiêu điểm về nội dung bước mới (người dùng bàn phím, trình đọc màn hình)
  useEffect(() => {
    if (!daDoi.current) return;
    vung.current?.focus();
  }, [hienTai]);

  const cuoi = hienTai === tong - 1;
  return (
    <div className="cc-wizard">
      <ol className="cc-tien-do" aria-label="Tiến độ">
        {BUOC_CO_CHE.map((x, i) => (
          <li key={x.ma} className={`cc-cham${i === hienTai ? " is-hien" : i < hienTai ? " is-qua" : ""}`} aria-current={i === hienTai ? "step" : undefined}>
            <span className="cc-an">{`Bước ${x.so}: ${x.tieuDe}`}</span>
          </li>
        ))}
      </ol>
      <div ref={vung} className="cc-wizard-buoc" tabIndex={-1} aria-live="polite" data-buoc={b.so}>
        <p className="cc-dem-buoc">{`Bước ${b.so}/${tong}`}</p>
        <HinhBuoc ma={b.ma} dong />
        <NoiDungBuoc b={b} TheTieuDe={TheBuoc} />
      </div>
      <div className="cc-nut-hang">
        <button type="button" className="cc-nut" onClick={() => doi(hienTai - 1)} disabled={hienTai === 0}>
          Quay lại
        </button>
        {cuoi ? (
          onXong ? (
            <button type="button" className="cc-nut cc-nut-chinh" onClick={() => onXong()}>
              {chuNutXong}
            </button>
          ) : (
            <button type="button" className="cc-nut cc-nut-chinh" onClick={() => doi(0)}>
              Xem lại từ đầu
            </button>
          )
        ) : (
          <button type="button" className="cc-nut cc-nut-chinh" onClick={() => doi(hienTai + 1)}>
            Tiếp
          </button>
        )}
      </div>
    </div>
  );
}
